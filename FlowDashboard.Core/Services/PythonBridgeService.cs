using System.Diagnostics;
using System.Net.Http;

namespace FlowDashboard.Core.Services;

public class PythonBridgeService
{
    private readonly HttpClient _httpClient;
    private readonly string _pythonServerUrl = "http://localhost:8765";
    private Process? _pythonProcess;

    public PythonBridgeService()
    {
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(_pythonServerUrl),
            Timeout = TimeSpan.FromSeconds(30)
        };
    }

    public async Task EnsurePythonServerRunning()
    {
        // Verificar si el servidor Python ya está corriendo
        if (await IsPythonServerRunning())
        {
            Console.WriteLine("✅ Servidor Python ya está corriendo");
            return;
        }

        // Intentar iniciar el servidor Python
        Console.WriteLine("🔄 Iniciando servidor Python...");
        StartPythonServer();

        // Esperar a que el servidor esté listo
        for (int i = 0; i < 10; i++)
        {
            await Task.Delay(1000);
            if (await IsPythonServerRunning())
            {
                Console.WriteLine("✅ Servidor Python iniciado correctamente");
                return;
            }
        }

        Console.WriteLine("⚠️ No se pudo verificar el servidor Python. Asegúrate de que local_adb_server.py esté corriendo.");
    }

    private async Task<bool> IsPythonServerRunning()
    {
        try
        {
            var response = await _httpClient.GetAsync("/health");
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private void StartPythonServer()
    {
        try
        {
            var projectRoot = ResolveProjectRoot();
            var pythonScript = Path.Combine(projectRoot, "local_adb_server.py");
            var bundledAdb = Path.Combine(projectRoot, "scrcpy-win64-v4.0", "adb.exe");

            if (!File.Exists(pythonScript))
            {
                Console.WriteLine($"❌ No se encontró local_adb_server.py");
                return;
            }

            var startInfo = new ProcessStartInfo
            {
                FileName = "python",
                Arguments = $"\"{pythonScript}\"",
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = projectRoot
            };
            if (File.Exists(bundledAdb))
            {
                startInfo.Environment["FLOWDASHBOARD_ADB"] = bundledAdb;
                startInfo.Environment["PATH"] = Path.GetDirectoryName(bundledAdb) + Path.PathSeparator + startInfo.Environment["PATH"];
            }
            startInfo.Environment["FLOWDASHBOARD_BASE_DIR"] = AppPaths.BaseDir;
            startInfo.Environment["FLOWDASHBOARD_RESOURCE_DIR"] = AppPaths.ResourceDir;
            startInfo.Environment["FLOWDASHBOARD_DATA_DIR"] = AppPaths.DataDir;

            _pythonProcess = Process.Start(startInfo);
            Console.WriteLine($"🐍 Servidor Python iniciado (PID: {_pythonProcess?.Id})");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error iniciando servidor Python: {ex.Message}");
        }
    }

    private static string ResolveProjectRoot()
    {
        var candidates = new[] { AppPaths.BaseDir, Directory.GetCurrentDirectory(), AppContext.BaseDirectory };

        foreach (var candidate in candidates)
        {
            if (File.Exists(Path.Combine(candidate, "local_adb_server.py")))
            {
                return candidate;
            }
        }

        return Directory.GetCurrentDirectory();
    }

    public async Task<T?> CallPythonEndpoint<T>(string endpoint, HttpMethod method, object? data = null)
    {
        try
        {
            HttpResponseMessage response;

            if (method == HttpMethod.Get)
            {
                response = await _httpClient.GetAsync(endpoint);
            }
            else if (method == HttpMethod.Post)
            {
                var content = new StringContent(
                    System.Text.Json.JsonSerializer.Serialize(data),
                    System.Text.Encoding.UTF8,
                    "application/json"
                );
                response = await _httpClient.PostAsync(endpoint, content);
            }
            else
            {
                throw new NotSupportedException($"Método HTTP {method} no soportado");
            }

            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            return System.Text.Json.JsonSerializer.Deserialize<T>(json);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error llamando a Python {endpoint}: {ex.Message}");
            return default;
        }
    }

    public async Task<bool> StartFlowLogin(string serial, List<object> accounts)
    {
        var result = await CallPythonEndpoint<Dictionary<string, object>>(
            "/flowlogin/start",
            HttpMethod.Post,
            new { serial, accounts }
        );

        return result != null;
    }

    public async Task<Dictionary<string, object>?> GetFlowLoginStatus(string serial)
    {
        return await CallPythonEndpoint<Dictionary<string, object>>(
            $"/flowlogin/status?serial={serial}",
            HttpMethod.Get
        );
    }
}
