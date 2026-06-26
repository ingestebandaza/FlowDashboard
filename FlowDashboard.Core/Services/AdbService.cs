using AdvancedSharpAdbClient;
using FlowDashboard.Core.Models;
using System.Collections.Concurrent;
using System.Diagnostics;

namespace FlowDashboard.Core.Services;

public class AdbService
{
    private readonly AdbServer _adbServer;
    private readonly AdbClient _adbClient;
    private readonly ConcurrentDictionary<string, Device> _devices = new();
    private readonly string _adbPath;
    private string _startupError = string.Empty;

    public bool IsAvailable => string.IsNullOrWhiteSpace(_startupError);
    public string StartupError => _startupError;
    public string AdbPath => _adbPath;

    public event EventHandler<Device>? DeviceConnected;
    public event EventHandler<string>? DeviceDisconnected;

    public AdbService()
    {
        // Buscar ADB en las ubicaciones comunes
        _adbPath = FindAdbPath();
        
        _adbServer = new AdbServer();
        _adbClient = new AdbClient();

        InitializeAdbServer();
    }

    private string FindAdbPath()
    {
        var candidates = new[]
        {
            Environment.GetEnvironmentVariable("FLOWDASHBOARD_ADB") ?? string.Empty,
            Path.Combine(AppPaths.ResourceDir, "scrcpy-win64-v4.0", "adb.exe"),
            Path.Combine(AppPaths.BaseDir, "scrcpy-win64-v4.0", "adb.exe"),
            Path.Combine(Directory.GetCurrentDirectory(), "scrcpy-win64-v4.0", "adb.exe"),
            Path.Combine(AppContext.BaseDirectory, "scrcpy-win64-v4.0", "adb.exe")
        };

        foreach (var path in candidates)
        {
            if (!string.IsNullOrWhiteSpace(path) && File.Exists(path))
            {
                Console.WriteLine($"[OK] ADB empaquetado: {path}");
                return path;
            }
        }

        throw new FileNotFoundException("[ERROR] No se encontro adb.exe empaquetado en scrcpy-win64-v4.0.");
    }

    private void InitializeAdbServer()
    {
        try
        {
            ConfigureAdbTempDirectory();
            var status = _adbServer.GetStatus();
            if (!status.IsRunning)
            {
                Console.WriteLine("🔄 Iniciando servidor ADB...");
                _adbServer.StartServer(_adbPath, restartServerIfNewer: true);
                Console.WriteLine("✅ Servidor ADB iniciado");
            }
            else
            {
                Console.WriteLine($"✅ Servidor ADB ya está corriendo (v{status.Version})");
                // NO reiniciar si ya está corriendo — evita desconectar dispositivos TCP
            }
        }
        catch (Exception ex)
        {
            _startupError = ex.Message;
            Console.WriteLine($"[WARN] ADB no pudo iniciar; el backend C# seguira en modo degradado: {ex.Message}");
        }
    }

    private void ConfigureAdbTempDirectory()
    {
        var tempDir = Environment.GetEnvironmentVariable("FLOWDASHBOARD_ADB_TEMP_DIR");
        if (string.IsNullOrWhiteSpace(tempDir))
        {
            tempDir = Path.Combine(AppPaths.DataDir, ".adb_tmp");
        }
        Directory.CreateDirectory(tempDir);
        Environment.SetEnvironmentVariable("TEMP", tempDir);
        Environment.SetEnvironmentVariable("TMP", tempDir);
    }

    public void StartMonitoring()
    {
        if (!IsAvailable)
        {
            Console.WriteLine($"[WARN] Monitoreo ADB omitido: {StartupError}");
            return;
        }

        Console.WriteLine("👀 Iniciando monitoreo de dispositivos...");
        
        var monitor = new DeviceMonitor(new AdbSocket(new System.Net.IPEndPoint(System.Net.IPAddress.Loopback, AdbClient.AdbServerPort)));
        
        monitor.DeviceConnected += (sender, e) =>
        {
            Console.WriteLine($"📱 Dispositivo conectado: {e.Device.Serial}");
            var device = MapDevice(e.Device);
            _devices[device.Serial] = device;
            DeviceConnected?.Invoke(this, device);
        };

        monitor.DeviceDisconnected += (sender, e) =>
        {
            Console.WriteLine($"📴 Dispositivo desconectado: {e.Device.Serial}");
            _devices.TryRemove(e.Device.Serial, out _);
            DeviceDisconnected?.Invoke(this, e.Device.Serial);
        };

        monitor.Start();
    }

    public List<Device> GetConnectedDevices()
    {
        try
        {
            // Usar timeout para evitar bloqueo indefinido si el daemon ADB está ocupado
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            var devicesTask = Task.Run(() => _adbClient.GetDevices(), cts.Token);
            
            if (!devicesTask.Wait(5000))
            {
                Console.WriteLine("⚠️ GetDevices timeout - daemon ADB ocupado, retornando cache");
                return _devices.Values.ToList();
            }

            var result = new List<Device>();
            foreach (var device in devicesTask.Result)
            {
                var mapped = MapDevice(device);
                _devices[mapped.Serial] = mapped;
                result.Add(mapped);
            }

            return result;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error al obtener dispositivos: {ex.Message}");
            return _devices.Values.ToList(); // retornar cache en caso de error
        }
    }

    public async Task<bool> ConnectDevice(string serial)
    {
        try
        {
            serial = NormalizeTcpSerial(serial);
            if (string.IsNullOrWhiteSpace(serial))
            {
                return false;
            }

            var result = await ExecuteAdbCommandWithTimeout("connect", serial, TimeSpan.FromSeconds(5));
            Console.WriteLine($"🔌 Conectando a {serial}: {result}");
            var normalized = result.ToLowerInvariant();
            var success =
                normalized.Contains("connected to") ||
                normalized.Contains("already connected") ||
                normalized.Contains($"connected {serial.ToLowerInvariant()}");

            if (success)
            {
                await Task.Delay(250);
                GetConnectedDevices();
            }

            return success;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error conectando a {serial}: {ex.Message}");
            return false;
        }
    }

    private string NormalizeTcpSerial(string serial)
    {
        serial = (serial ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(serial))
        {
            return string.Empty;
        }

        return serial.Contains(':') ? serial : $"{serial}:5555";
    }

    private async Task<string> ExecuteAdbCommandWithTimeout(string command, string argument, TimeSpan timeout)
    {
        using var process = new Process();
        process.StartInfo = new ProcessStartInfo
        {
            FileName = _adbPath,
            Arguments = $"{command} {argument}",
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true
        };

        process.Start();
        var stdOutTask = process.StandardOutput.ReadToEndAsync();
        var stdErrTask = process.StandardError.ReadToEndAsync();
        using var cts = new CancellationTokenSource(timeout);

        try
        {
            await process.WaitForExitAsync(cts.Token);
        }
        catch (OperationCanceledException)
        {
            try
            {
                if (!process.HasExited)
                {
                    process.Kill(entireProcessTree: true);
                }
            }
            catch
            {
                // Best effort cleanup.
            }
            return $"timeout after {timeout.TotalSeconds:0.#}s";
        }

        var stdOut = await stdOutTask;
        var stdErr = await stdErrTask;
        return string.Join(Environment.NewLine, new[] { stdOut, stdErr }.Where(text => !string.IsNullOrWhiteSpace(text)));
    }

    /// <summary>
    /// Obtiene dispositivos con timeout para evitar bloqueo si el daemon ADB está ocupado.
    /// </summary>
    private List<Device> GetDevicesWithTimeout(int timeoutMs = 5000)
    {
        try
        {
            var task = Task.Run(() => GetConnectedDevices());
            return task.Wait(timeoutMs) ? task.Result : _devices.Values.ToList();
        }
        catch
        {
            return _devices.Values.ToList();
        }
    }

    public async Task<string> ExecuteShellCommand(string serial, string command)
    {
        try
        {
            // Buscar el dispositivo via ADB client directamente con timeout
            var devicesTask = Task.Run(() => _adbClient.GetDevices());
            if (!devicesTask.Wait(5000))
                throw new Exception($"Timeout buscando dispositivo {serial}");
            var device = devicesTask.Result.FirstOrDefault(d => d.Serial == serial);
            if (device == null)
                throw new Exception($"Dispositivo {serial} no encontrado");

            var receiver = new AdvancedSharpAdbClient.Receivers.ConsoleOutputReceiver();
            await _adbClient.ExecuteRemoteCommandAsync(command, device, receiver, CancellationToken.None);
            return receiver.ToString();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error ejecutando comando en {serial}: {ex.Message}");
            throw;
        }
    }

    public async Task<bool> InstallApk(string serial, string apkPath)
    {
        try
        {
            var devicesTask = Task.Run(() => _adbClient.GetDevices());
            if (!devicesTask.Wait(5000)) return false;
            var device = devicesTask.Result.FirstOrDefault(d => d.Serial == serial);
            if (device == null) return false;

            using var stream = File.OpenRead(apkPath);
            await _adbClient.InstallAsync(device, stream);
            Console.WriteLine($"✅ APK instalado en {serial}");
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error instalando APK en {serial}: {ex.Message}");
            return false;
        }
    }

    public async Task<byte[]> CaptureScreenshot(string serial)
    {
        try
        {
            var devicesTask = Task.Run(() => _adbClient.GetDevices());
            if (!devicesTask.Wait(5000))
                throw new Exception($"Timeout buscando dispositivo {serial}");
            var device = devicesTask.Result.FirstOrDefault(d => d.Serial == serial);
            if (device == null)
                throw new Exception($"Dispositivo {serial} no encontrado");

            // Estrategia: Guardar screenshot en el dispositivo y luego descargarlo
            var remotePath = "/sdcard/flowdashboard_screen.png";
            var localPath = Path.Combine(Path.GetTempPath(), $"screenshot_{serial.Replace(":", "_").Replace(".", "_")}.png");
            
            try
            {
                // 1. Capturar screenshot en el dispositivo
                var captureReceiver = new AdvancedSharpAdbClient.Receivers.ConsoleOutputReceiver();
                await _adbClient.ExecuteRemoteCommandAsync($"screencap -p {remotePath}", device, captureReceiver, CancellationToken.None);
                
                // 2. Descargar el archivo usando SyncService
                using (var syncService = new AdvancedSharpAdbClient.SyncService(device))
                {
                    using (var fileStream = File.Create(localPath))
                    {
                        await syncService.PullAsync(remotePath, fileStream, null, CancellationToken.None);
                    }
                }
                
                // 3. Leer el archivo local
                var bytes = await File.ReadAllBytesAsync(localPath);
                
                // 4. Limpiar archivos temporales
                try
                {
                    File.Delete(localPath);
                    var deleteReceiver = new AdvancedSharpAdbClient.Receivers.ConsoleOutputReceiver();
                    await _adbClient.ExecuteRemoteCommandAsync($"rm {remotePath}", device, deleteReceiver, CancellationToken.None);
                }
                catch
                {
                    // Ignorar errores de limpieza
                }
                
                // 5. Verificar que sea una imagen PNG válida
                if (bytes.Length > 8 && 
                    bytes[0] == 0x89 && 
                    bytes[1] == 0x50 && 
                    bytes[2] == 0x4E && 
                    bytes[3] == 0x47)
                {
                    return bytes;
                }
                
                throw new Exception($"Screenshot inválido. Tamaño: {bytes.Length} bytes");
            }
            catch (Exception ex)
            {
                // Limpiar en caso de error
                try
                {
                    if (File.Exists(localPath))
                        File.Delete(localPath);
                }
                catch { }
                
                throw new Exception($"Error en captura: {ex.Message}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error capturando screenshot de {serial}: {ex.Message}");
            throw;
        }
    }

    // Receiver personalizado para capturar screenshots
    private class ScreenshotReceiver : AdvancedSharpAdbClient.Receivers.IShellOutputReceiver
    {
        private readonly MemoryStream _stream = new();

        public bool AddOutput(string line)
        {
            // No usado para datos binarios
            return true;
        }

        public Task<bool> AddOutputAsync(string line, CancellationToken cancellationToken)
        {
            return Task.FromResult(true);
        }

        public void Flush()
        {
            // No necesario
        }

        public Task FlushAsync(CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        public bool ParsesErrors => false;

        public void AddOutput(byte[] data, int offset, int length)
        {
            _stream.Write(data, offset, length);
        }

        public byte[] GetBytes()
        {
            return _stream.ToArray();
        }
    }

    private Device MapDevice(dynamic deviceData)
    {
        Device? existing = null;
        _devices.TryGetValue(deviceData.Serial, out existing);
        
        return new Device
        {
            Serial = deviceData.Serial,
            Model = deviceData.Model ?? "Unknown",
            State = deviceData.State.ToString(),
            Name = existing?.Name,
            Category = existing?.Category,
            Accounts = existing?.Accounts ?? new List<AccountStatus>(),
            IsSelected = existing?.IsSelected ?? false
        };
    }
}
