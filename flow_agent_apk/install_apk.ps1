# Script para instalar FlowAgent APK en todos los dispositivos

$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$apk = 'C:\DASHBOARD\FlowDashboard\flow_agent_apk\build\flowagent-debug.apk'

Write-Host "Obteniendo dispositivos conectados..." -ForegroundColor Cyan
$devices = @()
$output = & $adb devices
foreach ($line in $output) {
    if ($line -match '^\d+\.\d+\.\d+\.\d+:\d+') {
        $device = $line.Split()[0]
        $devices += $device
    }
}

Write-Host "Instalando APK en $($devices.Count) dispositivos..." -ForegroundColor Yellow

foreach ($device in $devices) {
    Write-Host "  Desinstalando version anterior en $device..." -ForegroundColor Cyan
    & $adb -s $device uninstall com.flowlogin.agent -ErrorAction SilentlyContinue | Out-Null
    
    Write-Host "  Instalando APK en $device..." -ForegroundColor Cyan
    & $adb -s $device install $apk
    
    Write-Host "  Completado: $device" -ForegroundColor Green
}

Write-Host "Instalacion completada en todos los dispositivos" -ForegroundColor Green
