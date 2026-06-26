$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'

# Obtener lista de dispositivos
$devices = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '^\S+\s+device$' } | ForEach-Object { ($_ -split '\s+')[0] }

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'CONFIGURANDO ADB REVERSE' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host "Total de dispositivos: $($devices.Count)" -ForegroundColor Yellow
Write-Host ''

$count = 0
foreach ($device in $devices) {
    $count++
    Write-Host "[$count/$($devices.Count)] Configurando $device..." -ForegroundColor Cyan
    
    # Configurar reverse para puerto 8766 (Socket)
    Write-Host "  - Reverse 8766 (Socket FlowAgent)" -ForegroundColor Gray
    & $adb -s $device reverse tcp:8766 tcp:8766 2>&1 | Out-Null
    
    # Configurar reverse para puerto 5000 (HTTP)
    Write-Host "  - Reverse 5000 (HTTP Backend)" -ForegroundColor Gray
    & $adb -s $device reverse tcp:5000 tcp:5000 2>&1 | Out-Null
    
    Write-Host "  OK Configurado" -ForegroundColor Green
    Write-Host ''
}

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'ADB REVERSE CONFIGURADO' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
