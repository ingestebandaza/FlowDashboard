$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'

$all = @(
    '192.168.1.11:5555','192.168.1.38:5555','192.168.1.39:5555','192.168.1.40:5555',
    '192.168.1.41:5555','192.168.1.42:5555','192.168.1.43:5555','192.168.1.44:5555',
    '192.168.1.45:5555','192.168.1.46:5555','192.168.1.47:5555','192.168.1.48:5555',
    '192.168.1.49:5555','192.168.1.50:5555','192.168.1.51:5555','192.168.1.52:5555',
    '192.168.1.53:5555'
)

$connected = & $adb devices | Select-String 'device$' | ForEach-Object { ($_ -split '\s+')[0] }
Write-Host "Ya conectados: $($connected.Count)" -ForegroundColor Green
$connected | ForEach-Object { Write-Host "  OK $_" -ForegroundColor Green }

$missing = $all | Where-Object { $connected -notcontains $_ }
Write-Host ""
Write-Host "Faltan: $($missing.Count)" -ForegroundColor Yellow

if ($missing.Count -gt 0) {
    Write-Host "Conectando los que faltan en paralelo..." -ForegroundColor Cyan
    $jobs = @()
    foreach ($d in $missing) {
        $jobs += Start-Job -ScriptBlock {
            param($adb, $d)
            $r = & $adb connect $d 2>&1
            "$d : $r"
        } -ArgumentList $adb, $d
    }
    $jobs | Wait-Job -Timeout 20 | Receive-Job | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
    $jobs | Remove-Job -Force

    # Verificar resultado final
    Start-Sleep -Seconds 2
    $connected2 = & $adb devices | Select-String 'device$' | ForEach-Object { ($_ -split '\s+')[0] }
    Write-Host ""
    Write-Host "Total conectados ahora: $($connected2.Count)/17" -ForegroundColor Cyan
}
