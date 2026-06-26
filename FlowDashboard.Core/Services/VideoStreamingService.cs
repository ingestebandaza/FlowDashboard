using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net.WebSockets;
using System.Text;

namespace FlowDashboard.Core.Services;

public class VideoStreamingService
{
    private readonly ConcurrentDictionary<string, StreamSession> _sessions = new();
    private readonly string _scrcpyPath;
    private readonly string _adbPath;

    public VideoStreamingService()
    {
        _scrcpyPath = FindScrcpyPath();
        _adbPath = FindAdbPath();
    }

    private string FindScrcpyPath()
    {
        var candidates = new[]
        {
            @"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\scrcpy.exe",
            @"C:\scrcpy\scrcpy.exe",
            "scrcpy.exe"
        };

        foreach (var path in candidates)
        {
            if (File.Exists(path))
            {
                Console.WriteLine($"✅ Scrcpy encontrado: {path}");
                return path;
            }
        }

        return "scrcpy.exe";
    }

    private string FindAdbPath()
    {
        var candidates = new[]
        {
            @"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe",
            @"C:\adb\adb.exe",
            "adb.exe"
        };

        foreach (var path in candidates)
        {
            if (File.Exists(path))
            {
                return path;
            }
        }

        return "adb.exe";
    }

    public async Task<bool> StartVideoStream(string serial, WebSocket webSocket, int quality = 720, int fps = 30)
    {
        try
        {
            // Detener sesión existente si hay
            if (_sessions.TryGetValue(serial, out var existingSession))
            {
                await StopVideoStream(serial);
            }

            var session = new StreamSession
            {
                Serial = serial,
                WebSocket = webSocket,
                CancellationTokenSource = new CancellationTokenSource()
            };

            _sessions[serial] = session;

            // Iniciar scrcpy con output a stdout
            // @Modified Etapa C2: agregar preset 240p (thumbnail) para grid de 17+ devices.
            // El bitrate bajo (300k) limita CPU para que 17 procesos scrcpy quepan
            // en una maquina modesta sin saturar.
            var bitRate = quality switch
            {
                240 => "300k",  // thumbnail grid
                480 => "1M",
                720 => "2M",
                1080 => "4M",
                _ => "8M" // 4K
            };

            var args = $"-s {serial} " +
                      $"--video-codec=h264 " +
                      $"--max-size={quality} " +
                      $"--max-fps={fps} " +
                      $"--video-bit-rate={bitRate} " +
                      $"--no-audio " +
                      $"--no-control " +
                      $"--no-window " +
                      $"--video-source=display " +
                      // @Fixed Etapa C 2026-05-28: scrcpy 4.x exige --record-format
                      // explicito cuando se hace `--record=-` (stdout). El cliente
                      // WebCodecs parsea fMP4 (boxes ftyp/moov/moof+mdat).
                      $"--record-format=mp4 " +
                      $"--record=-"; // Output a stdout

            var startInfo = new ProcessStartInfo
            {
                FileName = _scrcpyPath,
                Arguments = args,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                WorkingDirectory = Path.GetDirectoryName(_scrcpyPath) ?? Environment.CurrentDirectory
            };

            var process = new Process { StartInfo = startInfo };
            session.Process = process;

            process.Start();

            Console.WriteLine($"🎥 Video stream iniciado para {serial} ({quality}p @ {fps}fps)");

            // Leer stdout y enviar por WebSocket
            _ = Task.Run(async () => await StreamVideoData(session), session.CancellationTokenSource.Token);

            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error iniciando video stream para {serial}: {ex.Message}");
            return false;
        }
    }

    private async Task StreamVideoData(StreamSession session)
    {
        try
        {
            var buffer = new byte[65536]; // 64KB buffer
            var stream = session.Process!.StandardOutput.BaseStream;

            while (!session.CancellationTokenSource.Token.IsCancellationRequested &&
                   session.WebSocket.State == WebSocketState.Open)
            {
                var bytesRead = await stream.ReadAsync(buffer, 0, buffer.Length, session.CancellationTokenSource.Token);
                
                if (bytesRead == 0)
                    break;

                // Enviar datos por WebSocket
                await session.WebSocket.SendAsync(
                    new ArraySegment<byte>(buffer, 0, bytesRead),
                    WebSocketMessageType.Binary,
                    true,
                    session.CancellationTokenSource.Token
                );
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error streaming video para {session.Serial}: {ex.Message}");
        }
        finally
        {
            await StopVideoStream(session.Serial);
        }
    }

    public async Task<bool> StopVideoStream(string serial)
    {
        if (!_sessions.TryRemove(serial, out var session))
        {
            return false;
        }

        try
        {
            session.CancellationTokenSource.Cancel();

            if (session.Process != null && !session.Process.HasExited)
            {
                session.Process.Kill();
                await session.Process.WaitForExitAsync();
            }

            if (session.WebSocket.State == WebSocketState.Open)
            {
                await session.WebSocket.CloseAsync(
                    WebSocketCloseStatus.NormalClosure,
                    "Stream stopped",
                    CancellationToken.None
                );
            }

            session.CancellationTokenSource.Dispose();

            Console.WriteLine($"✅ Video stream detenido para {serial}");
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error deteniendo video stream {serial}: {ex.Message}");
            return false;
        }
    }

    public List<string> GetActiveStreams()
    {
        return _sessions.Keys.ToList();
    }

    private class StreamSession
    {
        public string Serial { get; set; } = string.Empty;
        public WebSocket WebSocket { get; set; } = null!;
        public Process? Process { get; set; }
        public CancellationTokenSource CancellationTokenSource { get; set; } = null!;
    }
}
