$adb      = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$interval = 20  # segundos entre verificaciones

Write-Host "Watchdog ADB Reverse iniciado (cada $interval segundos)" -ForegroundColor Cyan
Write-Host "Presiona Ctrl+C para detener" -ForegroundColor Gray
Write-Host ""

while ($true) {
    # Leer devices con timeout para evitar bloqueos
    $devOut = ""
    $p = Start-Process -FilePath $adb -ArgumentList "devices" -NoNewWindow -PassThru `
        -RedirectStandardOutput "$env:TEMP\wd_dev.txt" -ErrorAction SilentlyContinue
    $p.WaitForExit(5000) | Out-Null
    if (-not $p.HasExited) { $p.Kill() }
    $devOut = Get-Content "$env:TEMP\wd_dev.txt" -ErrorAction SilentlyContinue

    $devices = @()
    $devOut -split "`n" | ForEach-Object {
        if ($_ -match "^([^\s]+)\s+device$") { $devices += $matches[1] }
    }

    if ($devices.Count -gt 0) {
        foreach ($d in $devices) {
            foreach ($port in @("8766", "5000", "8765")) {
                $p = Start-Process -FilePath $adb -ArgumentList "-s $d reverse tcp:$port tcp:$port" `
                    -NoNewWindow -PassThru -ErrorAction SilentlyContinue
                $p.WaitForExit(3000) | Out-Null
                if (-not $p.HasExited) { $p.Kill() }
            }
        }
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Reverse OK en $($devices.Count) dispositivos" -ForegroundColor Green
    } else {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Sin dispositivos conectados" -ForegroundColor Yellow
    }

    Start-Sleep -Seconds $interval
}
