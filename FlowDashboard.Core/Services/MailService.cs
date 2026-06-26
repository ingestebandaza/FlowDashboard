using System.Net;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using MailKit;
using MailKit.Net.Imap;
using MailKit.Search;
using MailKit.Security;
using MimeKit;

namespace FlowDashboard.Core.Services;

public sealed class MailService
{
    private readonly object _lock = new();
    private readonly string _configPath;
    private readonly string _contentRootPath;
    private MailConfig? _config;
    private string _status = "not_configured";
    private string _message = "Mail no configurado.";

    public MailService(IWebHostEnvironment env)
    {
        _contentRootPath = env.ContentRootPath;
        var legacyPath = Path.Combine(env.ContentRootPath, "mail_config.json");
        _configPath = AppPaths.DataFile("mail_config.json");
        AppPaths.MigrateFileIfMissing(legacyPath, _configPath);
        _config = LoadConfig();
        if (_config is not null)
        {
            _status = "configured";
            _message = "Mail configurado.";
        }
    }

    public MailStatus GetStatus()
    {
        lock (_lock)
        {
            return new MailStatus
            {
                Configured = _config is not null,
                Connected = _status == "connected",
                Status = _status,
                Email = _config?.Email ?? "",
                Message = _message
            };
        }
    }

    public async Task<MailStatus> ConnectAsync(string email, string appPassword, CancellationToken cancellationToken)
    {
        email = NormalizeEmail(email);
        appPassword = string.IsNullOrWhiteSpace(appPassword) ? GetAppPassword() : NormalizeAppPassword(appPassword);
        if (string.IsNullOrWhiteSpace(email)) throw new InvalidOperationException("Email requerido.");
        if (string.IsNullOrWhiteSpace(appPassword)) throw new InvalidOperationException("Contrasena app requerida.");

        await ProbeConnectionAsync(email, appPassword, cancellationToken);

        lock (_lock)
        {
            _config = new MailConfig
            {
                Email = email,
                Provider = "gmail",
                EncryptedAppPassword = Protect(appPassword),
                UpdatedAt = DateTimeOffset.UtcNow
            };
            SaveConfig(_config);
            _status = "connected";
            _message = "Conectado";
        }
        return GetStatus();
    }

    public async Task<MagicLinkSearchResult> SearchSpotifyMagicLinkAsync(MagicLinkSearchRequest request, CancellationToken cancellationToken)
    {
        var targetEmail = NormalizeEmail(request.TargetEmail);
        if (string.IsNullOrWhiteSpace(targetEmail)) throw new InvalidOperationException("targetEmail requerido.");

        var config = _config ?? throw new InvalidOperationException("Mail no configurado.");
        var password = GetAppPassword();
        if (string.IsNullOrWhiteSpace(password)) throw new InvalidOperationException("Contrasena app no disponible.");

        try
        {
            return await SearchSpotifyMagicLinkWithMailKitAsync(config.Email, password, targetEmail, request.RequestedAfterUtc, request.RequireRecent, cancellationToken);
        }
        catch (InvalidOperationException ex) when (IsSchannelTlsFailure(ex))
        {
            return await SearchSpotifyMagicLinkWithPythonAsync(config.Email, password, targetEmail, request.RequestedAfterUtc, request.RequireRecent, cancellationToken);
        }
    }

    public async Task<JsonElement> DebugSearchSpotifyMagicLinkAsync(MailDebugSearchRequest request, CancellationToken cancellationToken)
    {
        var targetEmail = NormalizeEmail(request.TargetEmail);
        if (string.IsNullOrWhiteSpace(targetEmail)) throw new InvalidOperationException("targetEmail requerido.");

        var config = _config ?? throw new InvalidOperationException("Mail no configurado.");
        var password = GetAppPassword();
        if (string.IsNullOrWhiteSpace(password)) throw new InvalidOperationException("Contrasena app no disponible.");

        return await RunPythonFlowMailJsonAsync(new
        {
            action = "debug_search",
            email = config.Email,
            appPassword = password,
            targetEmail,
            requestedAfterUtc = (request.RequestedAfterUtc ?? DateTimeOffset.UtcNow.AddHours(-4)).ToString("O"),
            minutesBack = request.MinutesBack <= 0 ? 240 : request.MinutesBack
        }, cancellationToken);
    }

    private async Task<MagicLinkSearchResult> SearchSpotifyMagicLinkWithMailKitAsync(
        string email,
        string password,
        string targetEmail,
        DateTimeOffset? requestedAfterUtc,
        bool requireRecent,
        CancellationToken cancellationToken)
    {
        var requestedAfter = requestedAfterUtc ?? DateTimeOffset.UtcNow.AddMinutes(-20);
        var since = requestedAfter.AddMinutes(-15).UtcDateTime.Date;
        var best = new MagicLinkCandidate();

        using var client = await ConnectGmailImapAsync(cancellationToken);
        await client.AuthenticateAsync(email, password, cancellationToken);

        foreach (var folder in GetCandidateFolders(client))
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                await folder.OpenAsync(FolderAccess.ReadOnly, cancellationToken);
                var uids = await folder.SearchAsync(SearchQuery.DeliveredAfter(since), cancellationToken);
                foreach (var uid in uids.Reverse().Take(60))
                {
                    var message = await folder.GetMessageAsync(uid, cancellationToken);
                    var candidate = ScoreMessage(message, targetEmail, requestedAfter, requireRecent);
                    if (candidate.Score > best.Score) best = candidate;
                    if (best.Score >= 90) break;
                }
            }
            catch
            {
                // Algunas carpetas especiales de Gmail pueden no estar disponibles segun cuenta/idioma.
            }
            if (best.Score >= 90) break;
        }

        await client.DisconnectAsync(true, cancellationToken);

        if (best.Score <= 0 || string.IsNullOrWhiteSpace(best.Url))
        {
            return new MagicLinkSearchResult { Found = false, Message = "No se encontro magic link FlowMail." };
        }

        return new MagicLinkSearchResult
        {
            Found = best.Score >= 55,
            Url = best.Url,
            Score = best.Score,
            Subject = best.Subject,
            From = best.From,
            Message = best.Score >= 55 ? "Magic link encontrado." : "Candidato debil descartado."
        };
    }

    private async Task ProbeConnectionAsync(string email, string password, CancellationToken cancellationToken)
    {
        try
        {
            using var client = await ConnectGmailImapAsync(cancellationToken);
            await client.AuthenticateAsync(email, password, cancellationToken);
            await client.Inbox.OpenAsync(FolderAccess.ReadOnly, cancellationToken);
            await client.DisconnectAsync(true, cancellationToken);
        }
        catch (InvalidOperationException ex) when (IsSchannelTlsFailure(ex))
        {
            await ProbeConnectionWithPythonAsync(email, password, cancellationToken);
        }
    }

    private static async Task<ImapClient> ConnectGmailImapAsync(CancellationToken cancellationToken)
    {
        var client = CreateGmailImapClient(checkCertificateRevocation: true);
        try
        {
            await client.ConnectAsync("imap.gmail.com", 993, SecureSocketOptions.SslOnConnect, cancellationToken);
            return client;
        }
        catch (SslHandshakeException)
        {
            client.Dispose();

            var retryClient = CreateGmailImapClient(checkCertificateRevocation: false);
            try
            {
                await retryClient.ConnectAsync("imap.gmail.com", 993, SecureSocketOptions.SslOnConnect, cancellationToken);
                return retryClient;
            }
            catch (Exception retryError)
            {
                retryClient.Dispose();
                throw new InvalidOperationException(
                    "No se pudo establecer TLS con Gmail IMAP. Se intento validar el certificado con revocacion activada y luego sin consulta de revocacion, pero Windows/.NET siguio rechazando la conexion. Revisa fecha/hora de Windows, certificados raiz, proxy/antivirus SSL o firewall para imap.gmail.com:993.",
                    retryError);
            }
        }
        catch
        {
            client.Dispose();
            throw;
        }
    }

    private static ImapClient CreateGmailImapClient(bool checkCertificateRevocation)
    {
        return new ImapClient
        {
            CheckCertificateRevocation = checkCertificateRevocation
        };
    }

    private async Task ProbeConnectionWithPythonAsync(string email, string password, CancellationToken cancellationToken)
    {
        var result = await RunPythonFlowMailAsync(new
        {
            action = "probe",
            email,
            appPassword = password
        }, cancellationToken);
        if (!result.Ok)
        {
            throw new InvalidOperationException(result.MessageOrDefault("No se pudo conectar Gmail via Python/OpenSSL."));
        }
    }

    private async Task<MagicLinkSearchResult> SearchSpotifyMagicLinkWithPythonAsync(
        string email,
        string password,
        string targetEmail,
        DateTimeOffset? requestedAfterUtc,
        bool requireRecent,
        CancellationToken cancellationToken)
    {
        var result = await RunPythonFlowMailAsync(new
        {
            action = "search",
            email,
            appPassword = password,
            targetEmail,
            requestedAfterUtc = (requestedAfterUtc ?? DateTimeOffset.UtcNow.AddMinutes(-20)).ToString("O"),
            requireRecent
        }, cancellationToken);

        return new MagicLinkSearchResult
        {
            Found = result.Found,
            Url = result.Url ?? "",
            Score = result.Score,
            Subject = result.Subject ?? "",
            From = result.From ?? "",
            Message = result.MessageOrDefault(result.Found ? "Magic link encontrado." : "No se encontro magic link FlowMail.")
        };
    }

    private async Task<PythonFlowMailResult> RunPythonFlowMailAsync(object payload, CancellationToken cancellationToken)
    {
        var output = await RunPythonFlowMailRawAsync(payload, cancellationToken);
        PythonFlowMailResult? result = null;
        if (!string.IsNullOrWhiteSpace(output))
        {
            result = JsonSerializer.Deserialize<PythonFlowMailResult>(output, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        return result ?? new PythonFlowMailResult { Ok = false, Message = "FlowMail Python no devolvio respuesta valida." };
    }

    private async Task<JsonElement> RunPythonFlowMailJsonAsync(object payload, CancellationToken cancellationToken)
    {
        var output = await RunPythonFlowMailRawAsync(payload, cancellationToken);
        if (string.IsNullOrWhiteSpace(output))
        {
            throw new InvalidOperationException("FlowMail Python no devolvio respuesta valida.");
        }
        using var document = JsonDocument.Parse(output);
        return document.RootElement.Clone();
    }

    private async Task<string> RunPythonFlowMailRawAsync(object payload, CancellationToken cancellationToken)
    {
        var helperPath = ResolveFlowMailHelperPath();
        if (string.IsNullOrWhiteSpace(helperPath))
        {
            throw new InvalidOperationException("FlowMail no encontro el helper Python local.");
        }

        var helperIsExecutable = string.Equals(Path.GetExtension(helperPath), ".exe", StringComparison.OrdinalIgnoreCase);
        var startInfo = new ProcessStartInfo
        {
            FileName = helperIsExecutable ? helperPath : ResolvePythonExecutable(),
            UseShellExecute = false,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            WorkingDirectory = Path.GetDirectoryName(helperPath) ?? _contentRootPath
        };
        if (!helperIsExecutable)
        {
            startInfo.ArgumentList.Add(helperPath);
        }

        using var process = new Process { StartInfo = startInfo };
        process.Start();

        var inputJson = JsonSerializer.Serialize(payload);
        await process.StandardInput.WriteAsync(inputJson.AsMemory(), cancellationToken);
        process.StandardInput.Close();

        var outputTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var errorTask = process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken);

        var output = (await outputTask).Trim();
        var error = (await errorTask).Trim();
        if (process.ExitCode != 0)
        {
            if (!string.IsNullOrWhiteSpace(output))
            {
                return output;
            }
            if (!string.IsNullOrWhiteSpace(error))
            {
                throw new InvalidOperationException("FlowMail Python fallo sin exponer credenciales.");
            }
            throw new InvalidOperationException("FlowMail Python fallo.");
        }
        return output;
    }

    private string ResolveFlowMailHelperPath()
    {
        var candidates = new[]
        {
            Environment.GetEnvironmentVariable("FLOWDASHBOARD_MAIL_HELPER_EXE") ?? "",
            Path.Combine(AppPaths.ResourceDir, "runtime", "python", "FlowDashboard.MailHelper.exe"),
            Path.Combine(AppPaths.BaseDir, "build", "runtime", "python", "FlowDashboard.MailHelper.exe"),
            Path.Combine(AppContext.BaseDirectory, "FlowDashboard.MailHelper.exe"),
            Path.Combine(Environment.GetEnvironmentVariable("FLOWDASHBOARD_BASE_DIR") ?? "", "FlowDashboard.Core", "Services", "flowmail_imap_helper.py"),
            Path.Combine(Directory.GetCurrentDirectory(), "FlowDashboard.Core", "Services", "flowmail_imap_helper.py"),
            Path.Combine(_contentRootPath, "Services", "flowmail_imap_helper.py"),
            Path.Combine(AppContext.BaseDirectory, "flowmail_imap_helper.py")
        };
        return candidates.FirstOrDefault(File.Exists) ?? "";
    }

    private static string ResolvePythonExecutable()
    {
        var configured = Environment.GetEnvironmentVariable("FLOWDASHBOARD_PYTHON");
        return string.IsNullOrWhiteSpace(configured) ? "python" : configured;
    }

    private static bool IsSchannelTlsFailure(Exception ex)
    {
        return ex.Message.Contains("No se pudo establecer TLS con Gmail IMAP", StringComparison.OrdinalIgnoreCase) ||
               (ex.InnerException is not null && IsSchannelTlsFailure(ex.InnerException));
    }

    private IEnumerable<IMailFolder> GetCandidateFolders(ImapClient client)
    {
        var yielded = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        IMailFolder? inbox = client.Inbox;
        if (inbox is not null && yielded.Add(inbox.FullName)) yield return inbox;

        foreach (var folder in EnumerateFolders(client).Where(IsUsefulFolder))
        {
            if (yielded.Add(folder.FullName)) yield return folder;
        }
    }

    private static IEnumerable<IMailFolder> EnumerateFolders(ImapClient client)
    {
        foreach (var ns in client.PersonalNamespaces)
        {
            var root = client.GetFolder(ns);
            foreach (var folder in SafeGetSubfolders(root, true)) yield return folder;
        }
    }

    private static IEnumerable<IMailFolder> SafeGetSubfolders(IMailFolder folder, bool recurse)
    {
        IList<IMailFolder> children;
        try { children = folder.GetSubfolders(false); }
        catch { yield break; }
        foreach (var child in children)
        {
            yield return child;
            if (!recurse) continue;
            foreach (var nested in SafeGetSubfolders(child, true)) yield return nested;
        }
    }

    private static bool IsUsefulFolder(IMailFolder folder)
    {
        var name = (folder.FullName + " " + folder.Name).ToLowerInvariant();
        return name.Contains("spam") || name.Contains("junk") || name.Contains("all mail") ||
               name.Contains("todos") || name.Contains("promotions") || name.Contains("promociones");
    }

    private static MagicLinkCandidate ScoreMessage(MimeMessage message, string targetEmail, DateTimeOffset requestedAfter, bool requireRecent)
    {
        var html = message.HtmlBody ?? "";
        var text = message.TextBody ?? "";
        var body = WebUtility.HtmlDecode(html + "\n" + text);
        var from = string.Join(" ", message.From.Mailboxes.Select(m => $"{m.Name} {m.Address}")).Trim();
        var to = string.Join(" ", message.To.Mailboxes.Select(m => m.Address)).Trim();
        var subject = message.Subject ?? "";

        var link = ExtractSpotifyMagicLink(body);
        if (string.IsNullOrWhiteSpace(link)) return new MagicLinkCandidate();

        var score = 0;
        if (ContainsEmail(to, targetEmail)) score += 35;
        if (ContainsEmail(body, targetEmail)) score += 35;
        if (from.Contains("spotify", StringComparison.OrdinalIgnoreCase)) score += 15;
        if (from.Contains("spotify.com", StringComparison.OrdinalIgnoreCase)) score += 15;
        if (subject.Contains("spotify", StringComparison.OrdinalIgnoreCase)) score += 8;
        if (subject.Contains("account", StringComparison.OrdinalIgnoreCase) || subject.Contains("login", StringComparison.OrdinalIgnoreCase)) score += 5;
        if (message.Date >= requestedAfter.AddMinutes(-5)) score += 10;
        else if (requireRecent) return new MagicLinkCandidate();

        return new MagicLinkCandidate
        {
            Score = score,
            Url = link,
            Subject = subject,
            From = from
        };
    }

    private static string ExtractSpotifyMagicLink(string value)
    {
        value = WebUtility.HtmlDecode(value ?? "");
        var matches = Regex.Matches(value, @"https://accounts\.spotify\.com/login/ott/music[^\s""'<>]+", RegexOptions.IgnoreCase);
        foreach (Match match in matches)
        {
            var url = match.Value.Replace("&amp;", "&").TrimEnd('.', ',', ')', ']');
            if (url.Contains("token=", StringComparison.OrdinalIgnoreCase) &&
                url.Contains("passwordToken=", StringComparison.OrdinalIgnoreCase))
            {
                return url;
            }
        }
        return "";
    }

    private static bool ContainsEmail(string value, string email)
    {
        return (value ?? "").IndexOf(email, StringComparison.OrdinalIgnoreCase) >= 0;
    }

    private string GetAppPassword()
    {
        var config = _config;
        return config is null ? "" : Unprotect(config.EncryptedAppPassword);
    }

    private MailConfig? LoadConfig()
    {
        try
        {
            if (!File.Exists(_configPath)) return null;
            return JsonSerializer.Deserialize<MailConfig>(File.ReadAllText(_configPath));
        }
        catch
        {
            return null;
        }
    }

    private void SaveConfig(MailConfig config)
    {
        var json = JsonSerializer.Serialize(config, new JsonSerializerOptions { WriteIndented = true });
        AppPaths.AtomicWriteText(_configPath, json + Environment.NewLine);
    }

    private static string Protect(string value)
    {
        var bytes = Encoding.UTF8.GetBytes(value);
        var protectedBytes = ProtectedData.Protect(bytes, null, DataProtectionScope.CurrentUser);
        return Convert.ToBase64String(protectedBytes);
    }

    private static string Unprotect(string value)
    {
        var bytes = Convert.FromBase64String(value);
        var plain = ProtectedData.Unprotect(bytes, null, DataProtectionScope.CurrentUser);
        return Encoding.UTF8.GetString(plain);
    }

    private static string NormalizeEmail(string value) => (value ?? "").Trim().ToLowerInvariant();

    private static string NormalizeAppPassword(string value)
    {
        return Regex.Replace(value ?? "", @"\s+", "");
    }

    private sealed class MailConfig
    {
        public string Email { get; set; } = "";
        public string Provider { get; set; } = "gmail";
        public string EncryptedAppPassword { get; set; } = "";
        public DateTimeOffset UpdatedAt { get; set; }
    }

    private sealed class MagicLinkCandidate
    {
        public int Score { get; set; }
        public string Url { get; set; } = "";
        public string Subject { get; set; } = "";
        public string From { get; set; } = "";
    }

    private sealed class PythonFlowMailResult
    {
        [JsonPropertyName("ok")]
        public bool Ok { get; set; }
        [JsonPropertyName("found")]
        public bool Found { get; set; }
        [JsonPropertyName("url")]
        public string? Url { get; set; }
        [JsonPropertyName("score")]
        public int Score { get; set; }
        [JsonPropertyName("subject")]
        public string? Subject { get; set; }
        [JsonPropertyName("from")]
        public string? From { get; set; }
        [JsonPropertyName("message")]
        public string? Message { get; set; }

        public string MessageOrDefault(string fallback)
        {
            return string.IsNullOrWhiteSpace(Message) ? fallback : Message;
        }
    }
}

public sealed class MailConnectRequest
{
    public string Email { get; set; } = "";
    public string AppPassword { get; set; } = "";
}

public sealed class MailStatus
{
    public bool Configured { get; set; }
    public bool Connected { get; set; }
    public string Status { get; set; } = "";
    public string Email { get; set; } = "";
    public string Message { get; set; } = "";
}

public sealed class MagicLinkSearchRequest
{
    public string TargetEmail { get; set; } = "";
    public DateTimeOffset? RequestedAfterUtc { get; set; }
    public bool RequireRecent { get; set; }
}

public sealed class MailDebugSearchRequest
{
    public string TargetEmail { get; set; } = "";
    public DateTimeOffset? RequestedAfterUtc { get; set; }
    public int MinutesBack { get; set; } = 240;
}

public sealed class MagicLinkSearchResult
{
    public bool Found { get; set; }
    public string Url { get; set; } = "";
    public int Score { get; set; }
    public string Subject { get; set; } = "";
    public string From { get; set; } = "";
    public string Message { get; set; } = "";
}
