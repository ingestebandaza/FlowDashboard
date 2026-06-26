$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'

$devices = @(
    '192.168.1.11:5555','192.168.1.38:5555','192.168.1.39:5555','192.168.1.40:5555',
    '192.168.1.41:5555','192.168.1.42:5555','192.168.1.43:5555','192.168.1.44:5555',
    '192.168.1.45:5555','192.168.1.49:5555','192.168.1.50:5555','192.168.1.51:5555',
    '192.168.1.52:5555','192.168.1.53:5555'
)

Write-Host "Abriendo FlowAgent en $($devices.Count) dispositivos..." -ForegroundColor Cyan

$jobs = @()
foreach ($d in $devices) {
    $jobs += Start-Job -ScriptBlock {
        param($adb, $d)
        & $adb -s $d shell am start -n com.flowlogin.agent/.MainActivity --es host 127.0.0.1 --es serial $d --ei port 8766 --ez autoconnect true 2>&1 | Out-Null
        "Abierto $d"
    } -ArgumentList $adb, $d
}

$jobs | Wait-Job -Timeout 30 | Receive-Job | ForEach-Object { Write-Host $_ -ForegroundColor Green }
$jobs | Remove-Job -Force

Write-Host "Esperando 5s para que los APKs se conecten al backend..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Verificar mappings registrados
Write-Host "Verificando mappings en backend C#..." -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod -Uri 'http://localhost:5000/api/devices/mappings' -Method GET -TimeoutSec 5
    Write-Host "Mappings registrados: $($r.Count)" -ForegroundColor Green
    $r | ForEach-Object { Write-Host "  $($_.adbSerial) -> $($_.androidId)" -ForegroundColor White }
} catch {
    Write-Host "Error consultando mappings: $_" -ForegroundColor Red
}
