$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$package = 'com.flowlogin.agent'
$activity = 'com.flowlogin.agent/.MainActivity'
$service = 'com.flowlogin.agent/com.flowlogin.agent.FlowAccessibilityService'

$devices = & $adb devices | Select-String 'device$' | ForEach-Object { ($_ -split '\s+')[0] }
Write-Host "Arranque fresco APK en $($devices.Count) dispositivos..." -ForegroundColor Cyan

# Paso 1: Limpiar datos (borra SharedPreferences viejas) y configurar accesibilidad
Write-Host "Limpiando datos y configurando accesibilidad..." -ForegroundColor Yellow
$jobs = @()
foreach ($d in $devices) {
    $jobs += Start-Job -ScriptBlock {
        param($adb, $d, $package, $service, $activity)
        # Limpiar datos del APK (fuerza arranque fresco)
        & $adb -s $d shell pm clear $package 2>&1 | Out-Null
        Start-Sleep -Milliseconds 500
        # Reactivar accesibilidad (pm clear la borra)
        & $adb -s $d shell settings put secure enabled_accessibility_services $service 2>&1 | Out-Null
        & $adb -s $d shell settings put secure accessibility_enabled 1 2>&1 | Out-Null
        Start-Sleep -Milliseconds 300
        # Lanzar con serial
        & $adb -s $d shell am start -n $activity --es host 127.0.0.1 --es serial $d --ei port 8766 --ez autoconnect true 2>&1 | Out-Null
        "OK $d"
    } -ArgumentList $adb, $d, $package, $service, $activity
}
$jobs | Wait-Job -Timeout 30 | Receive-Job | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }
$jobs | Remove-Job -Force

# Paso 2: Configurar ADB reverse
Write-Host "Configurando ADB reverse..." -ForegroundColor Yellow
$jobs = @()
foreach ($d in $devices) {
    $jobs += Start-Job -ScriptBlock {
        param($adb, $d)
        & $adb -s $d reverse tcp:8766 tcp:8766 2>&1 | Out-Null
        & $adb -s $d reverse tcp:5000 tcp:5000 2>&1 | Out-Null
    } -ArgumentList $adb, $d
}
$jobs | Wait-Job -Timeout 15 | Out-Null
$jobs | Remove-Job -Force

# Paso 3: Esperar y verificar
Write-Host "Esperando 12s para que el APK arranque fresco..." -ForegroundColor Yellow
Start-Sleep -Seconds 12

try {
    $agents = Invoke-RestMethod -Uri 'http://localhost:8765/agents' -TimeoutSec 5
    Write-Host "Agentes: $($agents.agents.Count)/$($devices.Count)" -ForegroundColor Cyan
    $agents.agents | ForEach-Object {
        $color = if ($_.serial -and $_.serial -ne '' -and $_.serial -notmatch '127\.0\.0\.1') { 'Green' } else { 'Yellow' }
        Write-Host "  $($_.agentId) serial=$($_.serial) v=$($_.agentVersion)" -ForegroundColor $color
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
