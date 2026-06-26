# Script para instalar FlowAgent APK en todos los dispositivos conectados
# Sin rotacion de pantalla

$APK_PATH = "c:\DASHBOARD\FlowDashboard\flow_agent_apk\build\flowagent-debug.apk"
$ADB_PATH = "adb"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FlowAgent APK Installer - Todos los Dispositivos" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que el APK existe
if (-not (Test-Path $APK_PATH)) {
    Write-Host "ERROR: APK no encontrado en $APK_PATH" -ForegroundColor Red
    exit 1
}

Write-Host "APK encontrado: $APK_PATH" -ForegroundColor Green
Write-Host "Tamaño: $(((Get-Item $APK_PATH).Length / 1KB).ToString('F2')) KB" -ForegroundColor Green
Write-Host ""

# Obtener lista de dispositivos conectados
Write-Host "Obteniendo dispositivos conectados..." -ForegroundColor Yellow
$devices = & $ADB_PATH devices | Select-Object -Skip 1 | Where-Object { $_ -match "device$" } | ForEach-Object { ($_ -split '\s+')[0] }

if ($devices.Count -eq 0) {
    Write-Host "ERROR: No hay dispositivos conectados" -ForegroundColor Red
    exit 1
}

Write-Host "Dispositivos encontrados: $($devices.Count)" -ForegroundColor Green
Write-Host ""

# Instalar en cada dispositivo
$successCount = 0
$failCount = 0

foreach ($device in $devices) {
    Write-Host "---" -ForegroundColor Cyan
    Write-Host "Instalando en: $device" -ForegroundColor Cyan
    
    # Desinstalar version anterior (si existe)
    Write-Host "  [1/3] Desinstalando version anterior..." -ForegroundColor Gray
    & $ADB_PATH -s $device uninstall com.flowlogin.agent 2>&1 | Out-Null
    
    # Instalar nuevo APK
    Write-Host "  [2/3] Instalando nuevo APK..." -ForegroundColor Gray
    $installOutput = & $ADB_PATH -s $device install -r $APK_PATH 2>&1
    
    if ($installOutput -match "Success") {
        Write-Host "  [3/3] Verificando instalacion..." -ForegroundColor Gray
        $packageCheck = & $ADB_PATH -s $device shell pm list packages | Select-String "com.flowlogin.agent"
        
        if ($packageCheck) {
            Write-Host "  OK Instalacion exitosa en $device" -ForegroundColor Green
            $successCount++
            
            # Informacion del dispositivo
            $model = & $ADB_PATH -s $device shell getprop ro.product.model
            $android = & $ADB_PATH -s $device shell getprop ro.build.version.release
            Write-Host "    Modelo: $model | Android: $android" -ForegroundColor Gray
        }
        else {
            Write-Host "  ERROR Verificacion fallida en $device" -ForegroundColor Red
            $failCount++
        }
    }
    else {
        Write-Host "  ERROR Instalacion fallida en $device" -ForegroundColor Red
        Write-Host "    Error: $installOutput" -ForegroundColor Red
        $failCount++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Resumen de Instalacion" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total de dispositivos: $($devices.Count)" -ForegroundColor White
Write-Host "Instalaciones exitosas: $successCount" -ForegroundColor Green
Write-Host "Instalaciones fallidas: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "OK Todas las instalaciones completadas exitosamente" -ForegroundColor Green
}
else {
    Write-Host "ADVERTENCIA Algunas instalaciones fallaron. Revisa los errores arriba." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Proximos pasos:" -ForegroundColor Cyan
Write-Host "1. Abre FlowAgent en cada dispositivo" -ForegroundColor Gray
Write-Host "2. Habilita el servicio de Accesibilidad" -ForegroundColor Gray
Write-Host "3. Verifica que el Socket este conectado" -ForegroundColor Gray
Write-Host ""
