Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class W {
    public delegate bool EnumProc(IntPtr h, IntPtr p);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
    [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumProc cb, IntPtr p);
    [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
    [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int n);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
}
"@

function GetTitle($h) {
    $len = [W]::GetWindowTextLength($h)
    if ($len -le 0) { return "" }
    $sb = New-Object System.Text.StringBuilder ($len + 2)
    [W]::GetWindowText($h, $sb, $sb.Capacity) | Out-Null
    return $sb.ToString()
}
function GetClass($h) {
    $sb = New-Object System.Text.StringBuilder 256
    [W]::GetClassName($h, $sb, 256) | Out-Null
    return $sb.ToString()
}

$scrcpyPids = (Get-Process -Name scrcpy -ErrorAction SilentlyContinue).Id
"scrcpy PIDs: $($scrcpyPids -join ', ')"
""

"--- All windows belonging to scrcpy PIDs (any level) ---"
$results = New-Object System.Collections.ArrayList
$cb = [W+EnumProc]{
    param($h, $p)
    [uint32]$wpid = 0
    [W]::GetWindowThreadProcessId($h, [ref]$wpid) | Out-Null
    if ($scrcpyPids -contains $wpid) {
        [void]$results.Add(@{ H=$h; PID=$wpid })
    }
    return $true
}
# Top-level
[W]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
"Top-level windows of scrcpy procs: $($results.Count)"
foreach ($r in $results | Select-Object -First 5) {
    $rc = New-Object W+RECT; [W]::GetWindowRect($r.H, [ref]$rc) | Out-Null
    "  H=$($r.H) pid=$($r.PID) cls='$(GetClass $r.H)' title='$(GetTitle $r.H)' parent=$([W]::GetParent($r.H)) rect=$($rc.L),$($rc.T),$($rc.R),$($rc.B)"
}

# Now use GetAncestor on each scrcpy main window... but MainWindowHandle is 0 if reparented.
# So instead, let's enumerate all top-level windows and find any HWND whose process is scrcpy
"---"
"Looking for any HWND across all desktops belonging to scrcpy PID..."
# Use ToolHelp to find threads, then EnumThreadWindows
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class T {
    public delegate bool EnumProc(IntPtr h, IntPtr p);
    [DllImport("user32.dll")] public static extern bool EnumThreadWindows(uint threadId, EnumProc cb, IntPtr p);
}
"@
foreach ($pidVal in ($scrcpyPids | Select-Object -First 3)) {
    $proc = Get-Process -Id $pidVal -ErrorAction SilentlyContinue
    if (-not $proc) { continue }
    foreach ($th in $proc.Threads) {
        $found = New-Object System.Collections.ArrayList
        $cb2 = [T+EnumProc]{
            param($h, $p)
            [void]$found.Add($h)
            return $true
        }
        [T]::EnumThreadWindows([uint32]$th.Id, $cb2, [IntPtr]::Zero) | Out-Null
        foreach ($h in $found) {
            $cls = GetClass $h
            $par = [W]::GetParent($h)
            $rc = New-Object W+RECT; [W]::GetWindowRect($h, [ref]$rc) | Out-Null
            $vis = [W]::IsWindowVisible($h)
            $style = [W]::GetWindowLong($h, -16)
            $isChild = ($style -band 0x40000000) -ne 0
            "  pid=$pidVal tid=$($th.Id) H=$h cls='$cls' parent=$par WS_CHILD=$isChild visible=$vis rect=$($rc.L),$($rc.T),$($rc.R),$($rc.B) size=$($rc.R-$rc.L)x$($rc.B-$rc.T) title='$(GetTitle $h)'"
        }
    }
}
