$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$apk = 'c:\DASHBOARD\FlowDashboard\flow_agent_apk\build\flowagent-debug.apk'
$package = 'com.flowlogin.agent'

# Obtener lista de dispositivos
$devices = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '^\S+\s+device$' } | ForEach-Object { ($_ -split '\s+')[0] }

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'INSTALANDO APK EN TODOS LOS DISPOSITIVOS' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host "Total de dispositivos: $($devices.Count)" -ForegroundColor Yellow
Write-Host ''

$count = 0
foreach ($device in $devices) {
    $count++
    Write-Host "[$count/$($devices.Count)] Procesando $device..." -ForegroundColor Cyan
    
    # Desinstalar versión anterior
    Write-Host "  [1/2] Desinstalando $package..." -ForegroundColor Gray
    & $adb -s $device uninstall $package 2>&1 | Out-Null
    
    # Instalar nueva versión
    Write-Host "  [2/2] Instalando APK..." -ForegroundColor Gray
    $result = & $adb -s $device install -r $apk 2>&1
    
    if ($result -match 'Success') {
        Write-Host "  OK Instalado correctamente" -ForegroundColor Green
    } else {
        Write-Host "  ERROR en instalacion" -ForegroundColor Red
        Write-Host "    $result" -ForegroundColor Red
    }
    Write-Host ''
}

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'INSTALACION COMPLETADA' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
