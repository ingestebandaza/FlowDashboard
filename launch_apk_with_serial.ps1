$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$activity = 'com.flowlogin.agent/.MainActivity'

$devices = & $adb devices | Select-String 'device$' | ForEach-Object { ($_ -split '\s+')[0] }
Write-Host "Lanzando FlowAgent en $($devices.Count) dispositivos con serial correcto..." -ForegroundColor Cyan

$jobs = @()
foreach ($d in $devices) {
    $jobs += Start-Job -ScriptBlock {
        param($adb, $activity, $d)
        # Lanzar con host, serial y puerto como extras
        & $adb -s $d shell am start -n $activity `
            --es host 127.0.0.1 `
            --es serial $d `
            --ei port 8766 `
            --ez autoconnect true 2>&1 | Out-Null
        "Lanzado $d con serial=$d"
    } -ArgumentList $adb, $activity, $d
}

$jobs | Wait-Job -Timeout 30 | Receive-Job | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }
$jobs | Remove-Job -Force

Write-Host ""
Write-Host "Esperando 6s para que los APKs se conecten..." -ForegroundColor Yellow
Start-Sleep -Seconds 6

Write-Host "Verificando mappings en backend C#..." -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod -Uri 'http://localhost:5000/api/devices/mappings' -Method GET -TimeoutSec 5
    Write-Host "Mappings registrados: $($r.Count)" -ForegroundColor Green
    $r | ForEach-Object { Write-Host "  $($_.adbSerial) -> $($_.androidId)" -ForegroundColor White }
} catch {
    Write-Host "No se pudo consultar mappings (backend puede no estar corriendo)" -ForegroundColor Yellow
}
