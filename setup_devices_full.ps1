$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$apk = 'C:\DASHBOARD\FlowDashboard\flow_agent_apk\build\flowagent-debug.apk'
$package = 'com.flowlogin.agent'
$activity = 'com.flowlogin.agent/.MainActivity'
$service = 'com.flowlogin.agent/com.flowlogin.agent.FlowAccessibilityService'

$devices = & $adb devices | Select-String 'device$' | ForEach-Object { ($_ -split '\s+')[0] }
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SETUP COMPLETO - $($devices.Count) dispositivos" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# PASO 1: Desinstalar e instalar APK en lotes
Write-Host ""
Write-Host "Paso 1/4: Instalando APK 0.3.7..." -ForegroundColor Yellow
$batchSize = 5
for ($i = 0; $i -lt $devices.Count; $i += $batchSize) {
    $batch = $devices[$i..([Math]::Min($i + $batchSize - 1, $devices.Count - 1))]
    $jobs = @()
    foreach ($d in $batch) {
        $jobs += Start-Job -ScriptBlock {
            param($adb, $apk, $pkg, $d)
            & $adb -s $d uninstall $pkg 2>&1 | Out-Null
            $r = & $adb -s $d install $apk 2>&1
            if ($r -match 'Success') { "OK $d" } else { "FAIL $d" }
        } -ArgumentList $adb, $apk, $package, $d
    }
    $jobs | Wait-Job -Timeout 60 | Receive-Job | ForEach-Object {
        if ($_ -match '^OK') { Write-Host "  $_" -ForegroundColor Green }
        else { Write-Host "  $_" -ForegroundColor Red }
    }
    $jobs | Remove-Job -Force
}

# PASO 2: Activar accesibilidad via ADB (sin Laixi)
Write-Host ""
Write-Host "Paso 2/4: Activando accesibilidad via ADB..." -ForegroundColor Yellow
$jobs = @()
foreach ($d in $devices) {
    $jobs += Start-Job -ScriptBlock {
        param($adb, $d, $service)
        # Obtener servicios de accesibilidad actuales
        $current = & $adb -s $d shell settings get secure enabled_accessibility_services 2>&1
        $current = $current.Trim()
        if ($current -eq 'null' -or $current -eq '') {
            $new = $service
        } elseif ($current -notmatch [regex]::Escape($service)) {
            $new = "$current`:$service"
        } else {
            $new = $current  # ya está activado
        }
        & $adb -s $d shell settings put secure enabled_accessibility_services $new 2>&1 | Out-Null
        & $adb -s $d shell settings put secure accessibility_enabled 1 2>&1 | Out-Null
        "OK accesibilidad $d"
    } -ArgumentList $adb, $d, $service
}
$jobs | Wait-Job -Timeout 20 | Receive-Job | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }
$jobs | Remove-Job -Force

# PASO 3: Configurar ADB reverse
Write-Host ""
Write-Host "Paso 3/4: Configurando ADB reverse..." -ForegroundColor Yellow
$jobs = @()
foreach ($d in $devices) {
    $jobs += Start-Job -ScriptBlock {
        param($adb, $d)
        & $adb -s $d reverse tcp:8766 tcp:8766 2>&1 | Out-Null
        & $adb -s $d reverse tcp:5000 tcp:5000 2>&1 | Out-Null
        "OK reverse $d"
    } -ArgumentList $adb, $d
}
$jobs | Wait-Job -Timeout 20 | Receive-Job | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }
$jobs | Remove-Job -Force

# PASO 4: Lanzar APK con serial
Write-Host ""
Write-Host "Paso 4/4: Lanzando FlowAgent con serial..." -ForegroundColor Yellow
$jobs = @()
foreach ($d in $devices) {
    $jobs += Start-Job -ScriptBlock {
        param($adb, $activity, $d)
        # NO hacer force-stop — mata el servicio de accesibilidad
        # Solo lanzar la Activity con el serial
        & $adb -s $d shell am start -n $activity --es host 127.0.0.1 --es serial $d --ei port 8766 --ez autoconnect true 2>&1 | Out-Null
        "OK lanzado $d"
    } -ArgumentList $adb, $activity, $d
}
$jobs | Wait-Job -Timeout 30 | Receive-Job | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }
$jobs | Remove-Job -Force

Write-Host ""
Write-Host "Esperando 15s para que los APKs se conecten..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Verificar resultado
Write-Host ""
Write-Host "Verificando agentes..." -ForegroundColor Cyan
try {
    $agents = Invoke-RestMethod -Uri 'http://localhost:8765/agents' -TimeoutSec 5
    $conSerial = ($agents.agents | Where-Object { $_.serial -and $_.serial -ne '' }).Count
    Write-Host "Agentes conectados: $($agents.agents.Count)/$($devices.Count)" -ForegroundColor Green
    Write-Host "Con serial: $conSerial/$($agents.agents.Count)" -ForegroundColor $(if ($conSerial -eq $agents.agents.Count) { 'Green' } else { 'Yellow' })
    Write-Host "Version: $($agents.agents[0].agentVersion)" -ForegroundColor Cyan
} catch {
    Write-Host "Error verificando agentes: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SETUP COMPLETADO" -ForegroundColor Cyan
Write-Host "NOTA: El permiso de captura de pantalla" -ForegroundColor Yellow
Write-Host "aparece automaticamente al abrir el APK." -ForegroundColor Yellow
Write-Host "Acepta el dialogo en cada telefono." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
