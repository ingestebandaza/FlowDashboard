$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$activity = 'com.flowlogin.agent/.MainActivity'

$devices = & $adb devices | Select-String 'device$' | ForEach-Object { ($_ -split '\s+')[0] }
Write-Host "Dispositivos: $($devices.Count)" -ForegroundColor Cyan

# Paso 1: Configurar ADB reverse en todos
Write-Host ""
Write-Host "Paso 1: Configurando ADB reverse..." -ForegroundColor Yellow
$jobs = @()
foreach ($d in $devices) {
    $jobs += Start-Job -ScriptBlock {
        param($adb, $d)
        $r1 = & $adb -s $d reverse tcp:8766 tcp:8766 2>&1
        $r2 = & $adb -s $d reverse tcp:5000 tcp:5000 2>&1
        # Verificar que el reverse quedó activo
        $check = & $adb -s $d reverse --list 2>&1
        "  $d -> reverse: $check"
    } -ArgumentList $adb, $d
}
$jobs | Wait-Job -Timeout 20 | Receive-Job | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
$jobs | Remove-Job -Force

# Paso 2: Relanzar APK con serial
Write-Host ""
Write-Host "Paso 2: Relanzando FlowAgent con serial..." -ForegroundColor Yellow
$jobs = @()
foreach ($d in $devices) {
    $jobs += Start-Job -ScriptBlock {
        param($adb, $activity, $d)
        & $adb -s $d shell am start -n $activity --es host 127.0.0.1 --es serial $d --ei port 8766 --ez autoconnect true 2>&1 | Out-Null
        "  Lanzado $d"
    } -ArgumentList $adb, $activity, $d
}
$jobs | Wait-Job -Timeout 30 | Receive-Job | ForEach-Object { Write-Host $_ -ForegroundColor Green }
$jobs | Remove-Job -Force

# Paso 3: Esperar y verificar
Write-Host ""
Write-Host "Esperando 8s para que los APKs se conecten..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

Write-Host ""
Write-Host "Verificando agentes conectados al socket Python..." -ForegroundColor Cyan
try {
    $agents = Invoke-RestMethod -Uri 'http://localhost:8765/agents' -TimeoutSec 5
    Write-Host "Agentes conectados: $($agents.agents.Count)" -ForegroundColor Green
    $agents.agents | ForEach-Object { Write-Host "  - $($_.agentId) serial=$($_.serial)" -ForegroundColor White }
} catch {
    Write-Host "Error consultando agentes: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Verificando mappings en backend C#..." -ForegroundColor Cyan
try {
    $mappings = Invoke-RestMethod -Uri 'http://localhost:5000/api/devices/mappings' -TimeoutSec 5
    Write-Host "Mappings registrados: $($mappings.Count)" -ForegroundColor Green
    $mappings | ForEach-Object { Write-Host "  $($_.adbSerial) -> $($_.androidId)" -ForegroundColor White }
} catch {
    Write-Host "Error consultando mappings: $_" -ForegroundColor Red
}
