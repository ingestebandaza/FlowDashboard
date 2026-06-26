$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$activity = 'com.flowlogin.agent/.MainActivity'

$devices = & $adb devices | Select-String 'device$' | ForEach-Object { ($_ -split '\s+')[0] }
Write-Host "Forzando cierre completo y reinicio en $($devices.Count) dispositivos..." -ForegroundColor Cyan

$jobs = @()
foreach ($d in $devices) {
    $jobs += Start-Job -ScriptBlock {
        param($adb, $activity, $d)
        # Limpiar SharedPreferences viejas para forzar deteccion de IP WiFi
        & $adb -s $d shell pm clear com.flowlogin.agent 2>&1 | Out-Null
        Start-Sleep -Milliseconds 1000
        # Lanzar con serial via Intent (doble seguro)
        & $adb -s $d shell am start -n $activity `
            --es host 127.0.0.1 `
            --es serial $d `
            --ei port 8766 `
            --ez autoconnect true 2>&1 | Out-Null
        "OK $d"
    } -ArgumentList $adb, $activity, $d
}
$jobs | Wait-Job -Timeout 40 | Receive-Job | ForEach-Object { Write-Host $_ -ForegroundColor Green }
$jobs | Remove-Job -Force

Write-Host ""
Write-Host "Esperando 10s para que los APKs arranquen frescos..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "Verificando seriales..." -ForegroundColor Cyan
try {
    $agents = Invoke-RestMethod -Uri 'http://localhost:8765/agents' -TimeoutSec 5
    Write-Host "Agentes: $($agents.agents.Count)" -ForegroundColor Cyan
    $agents.agents | ForEach-Object {
        $color = if ($_.serial) { 'Green' } else { 'Red' }
        Write-Host "  $($_.agentId) serial=$($_.serial)" -ForegroundColor $color
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
