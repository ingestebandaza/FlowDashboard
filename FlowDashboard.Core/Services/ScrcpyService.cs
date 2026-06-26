using FlowDashboard.Core.Models;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace FlowDashboard.Core.Services;

public class ScrcpyService
{
    // ===== Win32 P/Invoke =====

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr GetParent(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr BeginDeferWindowPos(int nNumWindows);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr DeferWindowPos(IntPtr hWinPosInfo, IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool EndDeferWindowPos(IntPtr hWinPosInfo);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", EntryPoint = "GetWindowLong", SetLastError = true)]
    private static extern int GetWindowLong32(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtr", SetLastError = true)]
    private static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", EntryPoint = "SetWindowLong", SetLastError = true)]
    private static extern int SetWindowLong32(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr", SetLastError = true)]
    private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    private const int GWL_STYLE = -16;
    private const int GWL_EXSTYLE = -20;

    private const long WS_CHILD = 0x40000000L;
    private const long WS_VISIBLE = 0x10000000L;
    private const long WS_POPUP = 0x80000000L;
    private const long WS_CAPTION = 0x00C00000L;
    private const long WS_THICKFRAME = 0x00040000L;
    private const long WS_MINIMIZE = 0x20000000L;
    private const long WS_MAXIMIZE = 0x01000000L;
    private const long WS_SYSMENU = 0x00080000L;
    private const long WS_DLGFRAME = 0x00400000L;
    private const long WS_BORDER = 0x00800000L;
    private const long WS_OVERLAPPED = 0x00000000L;
    private const long WS_OVERLAPPEDWINDOW = WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_THICKFRAME | 0x00020000L | 0x00010000L;

    private const long WS_EX_APPWINDOW = 0x00040000L;
    private const long WS_EX_TOOLWINDOW = 0x00000080L;
    private const long WS_EX_TOPMOST = 0x00000008L;
    private const long WS_EX_LAYERED = 0x00080000L;
    private const long WS_EX_DLGMODALFRAME = 0x00000001L;
    private const long WS_EX_WINDOWEDGE = 0x00000100L;
    private const long WS_EX_CLIENTEDGE = 0x00000200L;
    private const long WS_EX_STATICEDGE = 0x00020000L;
    private const long WS_EX_NOACTIVATE = 0x08000000L;

    private static readonly IntPtr HWND_TOP = IntPtr.Zero;
    private const uint SWP_NOACTIVATE = 0x0010;
    private const uint SWP_NOZORDER = 0x0004;
    private const uint SWP_FRAMECHANGED = 0x0020;
    private const uint SWP_SHOWWINDOW = 0x0040;
    private const uint SWP_NOSENDCHANGING = 0x0400;
    private const uint SWP_NOREDRAW = 0x0008;
    private const uint SWP_NOCOPYBITS = 0x0100;
    private const int SW_SHOWNOACTIVATE = 4;
    private const int SW_HIDE = 0;

    // ===== Estado =====

    private class ActiveStream
    {
        public Process Process { get; set; } = null!;
        public IntPtr WindowHandle { get; set; }
        public IntPtr ParentHandle { get; set; }
        public bool Reparented { get; set; }
    }

    private readonly ConcurrentDictionary<string, ActiveStream> _activeStreams = new();
    private readonly string _scrcpyPath;

    public ScrcpyService()
    {
        _scrcpyPath = FindScrcpyPath();
    }

    private string FindScrcpyPath()
    {
        var candidates = new[]
        {
            Environment.GetEnvironmentVariable("SCRCPY_PATH") ?? string.Empty,
            Path.Combine(AppPaths.ResourceDir, "scrcpy-win64-v4.0", "scrcpy.exe"),
            Path.Combine(AppPaths.BaseDir, "scrcpy-win64-v4.0", "scrcpy.exe"),
            Path.Combine(Directory.GetCurrentDirectory(), "scrcpy-win64-v4.0", "scrcpy.exe"),
            Path.Combine(AppContext.BaseDirectory, "scrcpy-win64-v4.0", "scrcpy.exe")
        };

        foreach (var path in candidates)
        {
            if (!string.IsNullOrWhiteSpace(path) && File.Exists(path))
            {
                Console.WriteLine($"[OK] scrcpy empaquetado: {path}");
                return path;
            }
        }

        throw new FileNotFoundException("[ERROR] No se encontro scrcpy.exe empaquetado en scrcpy-win64-v4.0.");
    }

    // ===== API publica =====

    public StreamInfo StartStream(StreamConfig config)
    {
        // Reuso si ya existe y no piden restart
        if (_activeStreams.TryGetValue(config.Serial, out var existing))
        {
            if (!config.Restart && !existing.Process.HasExited)
            {
                // Si llega un parent y aun no estaba reparentado, intentamos reparentar ahora
                if (config.ParentHwnd != 0 && !existing.Reparented)
                {
                    TryAttachToParent(existing, new IntPtr(config.ParentHwnd), config.X, config.Y, config.Width, config.Height);
                }
                else if (existing.Reparented)
                {
                    // Solo reposicionar
                    SetWindowPos(existing.WindowHandle, IntPtr.Zero, config.X, config.Y, config.Width, config.Height,
                        SWP_NOACTIVATE | SWP_NOZORDER | SWP_NOSENDCHANGING);
                }

                return BuildStreamInfo(config.Serial, existing, config);
            }

            StopStream(config.Serial);
        }

        var args = BuildScrcpyArguments(config);

        var startInfo = new ProcessStartInfo
        {
            FileName = _scrcpyPath,
            Arguments = args,
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = Path.GetDirectoryName(_scrcpyPath) ?? Environment.CurrentDirectory
        };

        var process = Process.Start(startInfo);
        if (process == null)
        {
            throw new Exception($"No se pudo iniciar scrcpy para {config.Serial}");
        }

        var active = new ActiveStream { Process = process };
        _activeStreams[config.Serial] = active;

        // Esperar a que la ventana exista para poder reparentar/mover
        var hwnd = WaitForMainWindow(process, config.ParentHwnd != 0 ? 4000 : 1500);
        active.WindowHandle = hwnd;

        if (hwnd != IntPtr.Zero && config.ParentHwnd != 0)
        {
            TryAttachToParent(active, new IntPtr(config.ParentHwnd), config.X, config.Y, config.Width, config.Height);
        }

        Console.WriteLine($"✅ Stream iniciado para {config.Serial} (PID: {process.Id}, HWND: {hwnd}, parent: {config.ParentHwnd})");

        return BuildStreamInfo(config.Serial, active, config);
    }

    /// <summary>
    /// Reposiciona varias ventanas scrcpy en una sola transaccion Win32.
    /// Usa BeginDeferWindowPos/EndDeferWindowPos para que todas las miniaturas se muevan
    /// en el mismo frame del compositor y evitar el efecto escalonado al hacer scroll.
    /// </summary>
    public List<string> RepositionMany(long parentHwnd, List<RepositionItem> items)
    {
        var moved = new List<string>();
        if (items == null || items.Count == 0) return moved;

        var parent = new IntPtr(parentHwnd);
        // Filtra los streams que existen y tienen HWND
        var ready = new List<(RepositionItem item, ActiveStream active)>();
        foreach (var item in items)
        {
            if (!_activeStreams.TryGetValue(item.Serial, out var active)) continue;
            if (active.Process.HasExited) continue;
            if (active.WindowHandle == IntPtr.Zero)
            {
                active.WindowHandle = WaitForMainWindow(active.Process, 500);
                if (active.WindowHandle == IntPtr.Zero) continue;
            }

            // Asegurar reparenting si aun no estaba
            if (parent != IntPtr.Zero && (!active.Reparented || active.ParentHandle != parent))
            {
                TryAttachToParent(active, parent, item.X, item.Y, item.Width, item.Height);
                moved.Add(item.Serial);
                continue;
            }
            ready.Add((item, active));
        }

        if (ready.Count == 0) return moved;

        var hdwp = BeginDeferWindowPos(ready.Count);
        if (hdwp == IntPtr.Zero)
        {
            // Fallback: SetWindowPos uno por uno
            foreach (var (item, active) in ready)
            {
                SetWindowPos(active.WindowHandle, IntPtr.Zero, item.X, item.Y, item.Width, item.Height,
                    SWP_NOACTIVATE | SWP_NOZORDER | SWP_NOSENDCHANGING | SWP_NOCOPYBITS);
                moved.Add(item.Serial);
            }
            return moved;
        }

        foreach (var (item, active) in ready)
        {
            hdwp = DeferWindowPos(hdwp, active.WindowHandle, IntPtr.Zero,
                item.X, item.Y, item.Width, item.Height,
                SWP_NOACTIVATE | SWP_NOZORDER | SWP_NOSENDCHANGING | SWP_NOCOPYBITS);
            if (hdwp == IntPtr.Zero) break;
            moved.Add(item.Serial);
        }

        if (hdwp != IntPtr.Zero)
        {
            EndDeferWindowPos(hdwp);
        }

        return moved;
    }

    /// <summary>
    /// Oculta o muestra todas las ventanas scrcpy reparenteadas en una transaccion.
    /// Usado para acelerar scroll: ocultamos durante el movimiento, mostramos al detenerse.
    /// </summary>
    public void SetVisibilityAll(bool visible)
    {
        foreach (var kvp in _activeStreams)
        {
            var active = kvp.Value;
            if (active.WindowHandle == IntPtr.Zero) continue;
            ShowWindow(active.WindowHandle, visible ? SW_SHOWNOACTIVATE : SW_HIDE);
        }
    }

    public bool StopStream(string serial)
    {
        if (!_activeStreams.TryRemove(serial, out var active))
        {
            return false;
        }

        try
        {
            // Despegar antes de matar para evitar que la destruccion del child afecte al parent
            if (active.Reparented && active.WindowHandle != IntPtr.Zero)
            {
                try { SetParent(active.WindowHandle, IntPtr.Zero); } catch { }
            }

            if (!active.Process.HasExited)
            {
                active.Process.Kill();
                active.Process.WaitForExit(3000);
            }

            Console.WriteLine($"✅ Stream detenido para {serial}");
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error deteniendo stream {serial}: {ex.Message}");
            return false;
        }
    }

    public List<StreamInfo> GetActiveStreams()
    {
        var result = new List<StreamInfo>();

        var dead = _activeStreams.Where(kvp => kvp.Value.Process.HasExited).Select(kvp => kvp.Key).ToList();
        foreach (var serial in dead)
        {
            _activeStreams.TryRemove(serial, out _);
        }

        foreach (var kvp in _activeStreams)
        {
            kvp.Value.Process.Refresh();
            result.Add(new StreamInfo
            {
                Serial = kvp.Key,
                ProcessId = kvp.Value.Process.Id,
                Running = !kvp.Value.Process.HasExited,
                WindowHandle = kvp.Value.WindowHandle.ToInt64()
            });
        }

        return result;
    }

    /// <summary>
    /// Hook deprecado: se mantiene por compatibilidad con el codigo viejo.
    /// El reparenting real ahora ocurre dentro de StartStream cuando se pasa ParentHwnd.
    /// </summary>
    public void EmbedWindow(IntPtr childHandle, IntPtr parentHandle, int x, int y, int width, int height)
    {
        if (childHandle == IntPtr.Zero || parentHandle == IntPtr.Zero) return;
        ApplyChildStyle(childHandle);
        SetParent(childHandle, parentHandle);
        SetWindowPos(childHandle, IntPtr.Zero, x, y, width, height,
            SWP_FRAMECHANGED | SWP_NOACTIVATE | SWP_NOZORDER | SWP_SHOWWINDOW | SWP_NOSENDCHANGING);
        ShowWindow(childHandle, SW_SHOWNOACTIVATE);
    }

    // ===== Helpers internos =====

    private StreamInfo BuildStreamInfo(string serial, ActiveStream active, StreamConfig config)
    {
        return new StreamInfo
        {
            Serial = serial,
            ProcessId = active.Process.Id,
            Running = !active.Process.HasExited,
            WindowHandle = active.WindowHandle.ToInt64(),
            X = config.X,
            Y = config.Y,
            Width = config.Width,
            Height = config.Height
        };
    }

    private void TryAttachToParent(ActiveStream active, IntPtr parent, int x, int y, int width, int height)
    {
        if (active.WindowHandle == IntPtr.Zero || parent == IntPtr.Zero) return;

        try
        {
            try { active.Process.WaitForInputIdle(2000); } catch { }

            ApplyChildStyle(active.WindowHandle);

            // SetParent puede fallar la primera vez si scrcpy aun esta inicializando SDL.
            IntPtr nowParent = IntPtr.Zero;
            for (int attempt = 0; attempt < 3; attempt++)
            {
                SetParent(active.WindowHandle, parent);
                nowParent = GetParent(active.WindowHandle);
                if (nowParent == parent) break;
                Thread.Sleep(150 * (attempt + 1));
            }

            ApplyChildStyle(active.WindowHandle);
            SetWindowPos(active.WindowHandle, IntPtr.Zero, x, y, width, height,
                SWP_FRAMECHANGED | SWP_NOACTIVATE | SWP_NOZORDER | SWP_SHOWWINDOW | SWP_NOSENDCHANGING);
            ShowWindow(active.WindowHandle, SW_SHOWNOACTIVATE);

            active.ParentHandle = parent;
            active.Reparented = nowParent == parent;
            if (!active.Reparented)
            {
                Console.WriteLine($"[Reparent] WARNING: pid={active.Process.Id} no se pudo reparentar al HWND solicitado");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"⚠️ No se pudo reparentar HWND {active.WindowHandle}: {ex.Message}");
        }
    }

    private void ApplyChildStyle(IntPtr hwnd)
    {
        // Quitar todo lo que da bordes/decoracion/popup y dejar solo WS_CHILD|WS_VISIBLE
        long style = GetWindowLongValue(hwnd, GWL_STYLE);
        style &= ~(WS_POPUP | WS_OVERLAPPEDWINDOW | WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZE | WS_MAXIMIZE | WS_DLGFRAME | WS_BORDER);
        style |= WS_CHILD | WS_VISIBLE;
        SetWindowLongValue(hwnd, GWL_STYLE, style);

        long ex = GetWindowLongValue(hwnd, GWL_EXSTYLE);
        ex &= ~(WS_EX_APPWINDOW | WS_EX_TOPMOST | WS_EX_DLGMODALFRAME | WS_EX_WINDOWEDGE | WS_EX_CLIENTEDGE | WS_EX_STATICEDGE);
        ex |= WS_EX_NOACTIVATE; // evita robar el foco al dashboard
        SetWindowLongValue(hwnd, GWL_EXSTYLE, ex);
    }

    private static long GetWindowLongValue(IntPtr hwnd, int index)
    {
        if (IntPtr.Size == 8)
        {
            return GetWindowLongPtr64(hwnd, index).ToInt64();
        }
        return GetWindowLong32(hwnd, index);
    }

    private static void SetWindowLongValue(IntPtr hwnd, int index, long value)
    {
        if (IntPtr.Size == 8)
        {
            SetWindowLongPtr64(hwnd, index, new IntPtr(value));
        }
        else
        {
            SetWindowLong32(hwnd, index, unchecked((int)value));
        }
    }

    private IntPtr WaitForMainWindow(Process process, int timeoutMs)
    {
        var sw = Stopwatch.StartNew();
        while (sw.ElapsedMilliseconds < timeoutMs)
        {
            if (process.HasExited) return IntPtr.Zero;

            process.Refresh();
            if (process.MainWindowHandle != IntPtr.Zero && IsWindowVisible(process.MainWindowHandle))
            {
                return process.MainWindowHandle;
            }

            // Fallback: scrcpy a veces no expone MainWindowHandle inmediatamente; buscamos por PID
            var hwnd = FindWindowByProcessId((uint)process.Id);
            if (hwnd != IntPtr.Zero) return hwnd;

            Thread.Sleep(60);
        }
        return IntPtr.Zero;
    }

    private static IntPtr FindWindowByProcessId(uint pid)
    {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lParam) =>
        {
            GetWindowThreadProcessId(hWnd, out uint windowPid);
            if (windowPid != pid) return true;
            if (!IsWindowVisible(hWnd)) return true;
            int len = GetWindowTextLength(hWnd);
            if (len <= 0) return true; // scrcpy siempre tiene titulo
            found = hWnd;
            return false;
        }, IntPtr.Zero);
        return found;
    }

    private string BuildScrcpyArguments(StreamConfig config)
    {
        var args = new List<string>
        {
            $"--serial={config.Serial}",
            "--no-audio",
            $"--max-size={config.MaxSize}",
            $"--max-fps={config.MaxFps}",
            $"--video-bit-rate={config.BitRate}",
            $"--window-title=\"FlowDashboard - {config.Serial}\"",
            $"--window-x={config.X}",
            $"--window-y={config.Y}",
            $"--window-width={config.Width}",
            $"--window-height={config.Height}",
            "--disable-screensaver",
            // Fondo del letterbox (cuando el aspect ratio del telefono no llena la celda)
            // hace match con el tema oscuro del dashboard, asi las franjas no se notan.
            "--background-color=#0b1220"
        };

        // Modo WebP: usar --no-video para control-only, frames vienen via socket
        if (config.UseWebPStreaming)
        {
            args.Add("--no-video");
        }

        if (config.Borderless)
            args.Add("--window-borderless");

        // Cuando reparentamos al dashboard, NO usamos always-on-top: el z-order lo da la jerarquia padre/hijo
        if (config.AlwaysOnTop && config.ParentHwnd == 0)
            args.Add("--always-on-top");

        if (config.NoControl)
            args.Add("--no-control");
        else
            args.Add("--stay-awake");

        return string.Join(" ", args);
    }
}
