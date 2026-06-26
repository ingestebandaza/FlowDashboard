# Test scrcpy directo contra .11 para ver si genera frames H.264 en stdout.
$ErrorActionPreference = 'Continue'

$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$scrcpy = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\scrcpy.exe'
$serial = '192.168.1.11:5555'

Write-Host "=== Test scrcpy directo ($serial) ===" -ForegroundColor Cyan

# Asegurar que el device esta conectado.
& $adb connect $serial 2>&1 | Out-Null
Start-Sleep -Milliseconds 500

# Lanzar scrcpy con record a stdout y capturar.
$args = @(
    '-s', $serial,
    '--video-codec=h264',
    '--max-size=240',
    '--max-fps=8',
    '--video-bit-rate=300k',
    '--no-audio', '--no-control', '--no-window',
    '--video-source=display',
    '--record-format=mp4',
    '--record=-'
)

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $scrcpy
$psi.Arguments = ($args -join ' ')
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

Write-Host "Args: $($psi.Arguments)" -ForegroundColor DarkGray

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
$proc.Start() | Out-Null

# Leer stdout en async durante 4s.
$bytes = 0
$deadline = [DateTime]::UtcNow.AddSeconds(4)
$buf = New-Object byte[] 65536
$stream = $proc.StandardOutput.BaseStream

while ([DateTime]::UtcNow -lt $deadline -and -not $proc.HasExited) {
    $readTask = $stream.ReadAsync($buf, 0, $buf.Length)
    if ($readTask.Wait(1500)) {
        if ($readTask.Result -le 0) { break }
        $bytes += $readTask.Result
    } else {
        break
    }
}

# stderr de scrcpy.
$stderrBuf = ""
if ($proc.StandardError.Peek() -ge 0) {
    $stderrTask = $proc.StandardError.ReadToEndAsync()
    if ($stderrTask.Wait(500)) { $stderrBuf = $stderrTask.Result }
}

try { $proc.Kill() } catch { }
try { $proc.WaitForExit(2000) } catch { }

Write-Host "Bytes en stdout: $bytes" -ForegroundColor $(if ($bytes -gt 1024) { 'Green' } else { 'Yellow' })
if ($stderrBuf) {
    Write-Host "--- stderr ---" -ForegroundColor DarkGray
    Write-Host $stderrBuf -ForegroundColor DarkGray
}
