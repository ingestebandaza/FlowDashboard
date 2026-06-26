# Test: scrcpy 4.0 puede escribir MKV streamable a stdout?
$ErrorActionPreference = 'Continue'
$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$scrcpy = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\scrcpy.exe'
$serial = '192.168.1.11:5555'

& $adb connect $serial 2>&1 | Out-Null
Start-Sleep -Milliseconds 300

function Test-Variant {
    param([string]$Title, [string[]]$Args)
    Write-Host ""
    Write-Host "=== $Title ===" -ForegroundColor Cyan
    Write-Host "Args: $($Args -join ' ')" -ForegroundColor DarkGray

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $scrcpy
    $psi.Arguments = ($Args -join ' ')
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    $proc.Start() | Out-Null

    $totalBytes = 0
    $deadline = [DateTime]::UtcNow.AddSeconds(4)
    $buf = New-Object byte[] 65536
    $stream = $proc.StandardOutput.BaseStream

    while ([DateTime]::UtcNow -lt $deadline -and -not $proc.HasExited) {
        $task = $stream.ReadAsync($buf, 0, $buf.Length)
        if ($task.Wait(1500)) {
            if ($task.Result -le 0) { break }
            $totalBytes += $task.Result
        } else { break }
    }

    try { $proc.Kill() } catch { }
    try { $proc.WaitForExit(2000) } catch { }

    $stderr = ""
    try {
        $stderrTask = $proc.StandardError.ReadToEndAsync()
        if ($stderrTask.Wait(500)) { $stderr = $stderrTask.Result }
    } catch { }

    $color = if ($totalBytes -gt 1024) { 'Green' } else { 'Yellow' }
    Write-Host "Bytes: $totalBytes" -ForegroundColor $color
    if ($stderr) {
        $relevant = ($stderr -split "`n" | Where-Object { $_ -match 'ERROR|Recording|Failed|stream|format' } | Select-Object -First 5) -join "`n"
        if ($relevant) { Write-Host "stderr: $relevant" -ForegroundColor DarkGray }
    }
}

# Variante 1: MKV con --record=-
Test-Variant "MKV stdout via --record=-" @(
    "-s", $serial, "--video-codec=h264", "--max-size=240", "--max-fps=8",
    "--video-bit-rate=300k", "--no-audio", "--no-control", "--no-window",
    "--video-source=display", "--record-format=mkv", "--record=-"
)

# Variante 2: MKV escribiendo a un archivo real (sanity check)
$tmpFile = "$env:TEMP\scrcpy_test.mkv"
if (Test-Path $tmpFile) { Remove-Item $tmpFile -Force }
Test-Variant "MKV a archivo real $tmpFile" @(
    "-s", $serial, "--video-codec=h264", "--max-size=240", "--max-fps=8",
    "--video-bit-rate=300k", "--no-audio", "--no-control", "--no-window",
    "--video-source=display", "--record=$tmpFile"
)
if (Test-Path $tmpFile) {
    $size = (Get-Item $tmpFile).Length
    Write-Host "Archivo MKV final: $size bytes" -ForegroundColor Green
    Remove-Item $tmpFile -Force
}
