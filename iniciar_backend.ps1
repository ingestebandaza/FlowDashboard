# Script para iniciar el backend C# FlowDashboard

Write-Host "Iniciando backend C# FlowDashboard..."
Write-Host ""

# Matar procesos anteriores
Write-Host "[1/3] Limpiando procesos anteriores..."
Get-Process | Where-Object {$_.Name -like "*FlowDashboard*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Iniciar backend C#
Write-Host "[2/3] Iniciando backend C#..."
$backendPath = "c:\DASHBOARD\FlowDashboard\FlowDashboard.Core\bin\Release\net8.0\FlowDashboard.Core.exe"
if (Test-Path $backendPath) {
    Start-Process $backendPath -NoNewWindow
    Write-Host "✓ Backend iniciado"
} else {
    Write-Host "✗ No se encontró el ejecutable del backend"
    exit 1
}

# Esperar a que se inicie
Write-Host "[3/3] Esperando a que el backend se inicie..."
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "✓ Backend C# iniciado correctamente"
Write-Host ""
Write-Host "El backend está escuchando en:"
Write-Host "  - Puerto 5000 (HTTP/WebSocket)"
Write-Host "  - Puerto 8766 (Socket FlowAgent)"
Write-Host ""
Write-Host "Ahora puedes abrir FlowAgent en los dispositivos."
