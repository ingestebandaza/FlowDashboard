# Script para matar Laixi y liberar puerto 5000

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Matando Laixi y liberando puerto 5000" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Paso 1: Matar Laixi (procesos Python)
Write-Host "[1/3] Matando Laixi y procesos Python..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.Name -like "*python*" } | ForEach-Object {
    Write-Host "  Matando: $($_.Name) (PID: $($_.Id))"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

# Paso 2: Liberar puerto 5000
Write-Host "[2/3] Liberando puerto 5000..." -ForegroundColor Yellow
$connections = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
if ($connections) {
    foreach ($conn in $connections) {
        $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "  Matando proceso en puerto 5000: $($process.Name) (PID: $($process.Id))"
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }
}
Start-Sleep -Seconds 2

# Paso 3: Verificar que los puertos esten libres
Write-Host "[3/3] Verificando puertos..." -ForegroundColor Yellow
$port5000 = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
$port8765 = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
$port8766 = Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue

if ($port5000) {
    Write-Host "  Puerto 5000 aun en uso" -ForegroundColor Red
} else {
    Write-Host "  Puerto 5000 libre" -ForegroundColor Green
}

if ($port8765) {
    Write-Host "  Puerto 8765 aun en uso" -ForegroundColor Red
} else {
    Write-Host "  Puerto 8765 libre" -ForegroundColor Green
}

if ($port8766) {
    Write-Host "  Puerto 8766 aun en uso" -ForegroundColor Red
} else {
    Write-Host "  Puerto 8766 libre" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Puertos liberados" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora puedes iniciar el backend C#:" -ForegroundColor Cyan
Write-Host "  cd 'c:\DASHBOARD\FlowDashboard\FlowDashboard.Core\bin\Release\net8.0'" -ForegroundColor Cyan
Write-Host "  .\FlowDashboard.Core.exe" -ForegroundColor Cyan
