$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$service = 'com.flowlogin.agent/com.flowlogin.agent.FlowAccessibilityService'
$activity = 'com.flowlogin.agent/.MainActivity'

$devices = & $adb devices | Select-String 'device$' | ForEach-Object { ($_ -split '\s+')[0] }
Write-Host "Reactivando accesibilidad en $($devices.Count) dispositivos..." -ForegroundColor Cyan

$jobs = @()
foreach ($d in $devices) {
    $jobs += Start-Job -ScriptBlock {
        param($adb, $d, $service, $activity)
        # Reactivar accesibilidad
        $current = & $adb -s $d shell settings get secure enabled_accessibility_services 2>&1
        $current = $current.Trim()
        if ($current -eq 'null' -or $current -eq '' -or $current -notmatch [regex]::Escape($service)) {
            $new = if ($current -eq 'null' -or $current -eq '') { $service } else { "$current`:$service" }
            & $adb -s $d shell settings put secure enabled_accessibility_services $new 2>&1 | Out-Null
            & $adb -s $d shell settings put secure accessibility_enabled 1 2>&1 | Out-Null
        }
        # Abrir la app para que el servicio arranque
        & $adb -s $d shell am start -n $activity 2>&1 | Out-Null
        "OK $d"
    } -ArgumentList $adb, $d, $service, $activity
}
$jobs | Wait-Job -Timeout 20 | Receive-Job | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }
$jobs | Remove-Job -Force

Write-Host "Esperando 5s..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "Configurando ADB reverse..." -ForegroundColor Cyan
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

Write-Host "Esperando 8s para reconexion..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

try {
    $agents = Invoke-RestMethod -Uri 'http://localhost:8765/agents' -TimeoutSec 5
    Write-Host "Agentes conectados: $($agents.agents.Count)/$($devices.Count)" -ForegroundColor Green
    $agents.agents | ForEach-Object {
        $color = if ($_.serial -and $_.serial -ne '') { 'Green' } else { 'Yellow' }
        Write-Host "  $($_.agentId) serial=$($_.serial) v=$($_.agentVersion)" -ForegroundColor $color
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
