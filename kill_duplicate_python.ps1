# Matar el Python duplicado (PID 7520 - .venv)
Write-Host "Verificando procesos Python duplicados..." -ForegroundColor Cyan

$pythons = Get-Process -Name python -ErrorAction SilentlyContinue
foreach ($p in $pythons) {
    Write-Host "  PID $($p.Id) | $($p.Path)" -ForegroundColor White
}

Write-Host ""
Write-Host "Matando Python del .venv (proceso duplicado)..." -ForegroundColor Yellow

# Matar el que viene del .venv
$venvPython = Get-Process -Name python -ErrorAction SilentlyContinue | 
    Where-Object { $_.Path -match "\.venv" }

foreach ($p in $venvPython) {
    Write-Host "  Matando PID $($p.Id) ($($p.Path))" -ForegroundColor Red
    Stop-Process -Id $p.Id -Force
}

# También matar el Python313 si está corriendo (no es el nuestro)
$py313 = Get-Process -Name python -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -match "Python313" }

foreach ($p in $py313) {
    Write-Host "  Matando Python313 PID $($p.Id)" -ForegroundColor Red
    Stop-Process -Id $p.Id -Force
}

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Procesos Python restantes:" -ForegroundColor Cyan
Get-Process -Name python -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  PID $($_.Id) | $($_.Path)" -ForegroundColor Green
}
