# Script para matar Laixi e iniciar el backend C#

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Limpiando Laixi e Iniciando Backend C#" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Paso 1: Matar Laixi
Write-Host "[1/4] Matando Laixi..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.Name -like "*laixi*" -or $_.Name -like "*python*"} | ForEach-Object {
    Write-Host "  Matando: $($_.Name) (PID: $($_.Id))"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

# Paso 2: Matar FlowDashboard anterior
Write-Host "[2/4] Limpiando procesos anteriores de FlowDashboard..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.Name -like "*FlowDashboard*"} | ForEach-Object {
    Write-Host "  Matando: $($_.Name) (PID: $($_.Id))"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

# Paso 3: Liberar puertos
Write-Host "[3/4] Liberando puertos 5000, 8765, 8766..." -ForegroundColor Yellow
$ports = @(5000, 8765, 8766)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "  Matando proceso en puerto $port : $($process.Name) (PID: $($process.Id))"
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            }
        }
    }
}
Start-Sleep -Seconds 2

# Paso 4: Iniciar backend C#
Write-Host "[4/4] Iniciando backend C#..." -ForegroundColor Yellow
$backendPath = "c:\DASHBOARD\FlowDashboard\FlowDashboard.Core\bin\Release\net8.0\FlowDashboard.Core.exe"
if (Test-Path $backendPath) {
    Write-Host "  Ejecutable encontrado: $backendPath"
    Start-Process $backendPath -NoNewWindow
    Write-Host "  ✓ Backend iniciado" -ForegroundColor Green
    Start-Sleep -Seconds 5
} else {
    Write-Host "  ✗ No se encontró el ejecutable del backend" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✓ Backend C# iniciado correctamente" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "El backend está escuchando en:" -ForegroundColor Cyan
Write-Host "  - Puerto 5000 (HTTP/WebSocket)" -ForegroundColor Cyan
Write-Host "  - Puerto 8766 (Socket FlowAgent)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ahora puedes abrir FlowAgent en los dispositivos." -ForegroundColor Green
Write-Host "El Socket debería mostrar: ✓ Conectado (verde)" -ForegroundColor Green
