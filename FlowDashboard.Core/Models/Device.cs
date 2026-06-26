namespace FlowDashboard.Core.Models;

public class Device
{
    public string Serial { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string? Name { get; set; }
    public string? Category { get; set; }
    public List<AccountStatus> Accounts { get; set; } = new();
    public bool IsSelected { get; set; }
    public StreamInfo? Stream { get; set; }
}

public class AccountStatus
{
    public int Index { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Status { get; set; } = "pending"; // pending, running, success, error, already, review
    public string? Message { get; set; }
}

public class StreamInfo
{
    public string Serial { get; set; } = string.Empty;
    public int ProcessId { get; set; }
    public bool Running { get; set; }
    public long WindowHandle { get; set; }
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
}

public class StreamConfig
{
    public string Serial { get; set; } = string.Empty;
    public int Width { get; set; } = 360;
    public int Height { get; set; } = 720;
    public int X { get; set; } = 80;
    public int Y { get; set; } = 80;
    public int MaxSize { get; set; } = 1080;
    public int MaxFps { get; set; } = 30;
    public string BitRate { get; set; } = "4M";
    public bool Borderless { get; set; } = true;
    public bool AlwaysOnTop { get; set; } = false;
    public bool NoControl { get; set; } = false;
    public bool Restart { get; set; } = false;
    /// <summary>
    /// Si distinto de 0, scrcpy se reparentea como hijo de este HWND tras lanzarse.
    /// Cuando hay parent, las coordenadas X/Y/Width/Height son relativas al area cliente del padre (en pixeles fisicos).
    /// </summary>
    public long ParentHwnd { get; set; } = 0;
    /// <summary>
    /// Si true, scrcpy se lanza con --no-video (control-only mode).
    /// Los frames de pantalla vienen via WebP desde el APK FlowAgent.
    /// </summary>
    public bool UseWebPStreaming { get; set; } = false;
}

public class RepositionItem
{
    public string Serial { get; set; } = string.Empty;
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
}

public class CommandRequest
{
    public string Serial { get; set; } = string.Empty;
    public string Command { get; set; } = string.Empty;
}

public class RegisterDeviceRequest
{
    public string AndroidId { get; set; } = string.Empty;
    public string AdbSerial { get; set; } = string.Empty;
}
