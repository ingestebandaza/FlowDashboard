# Verifica que el backend C# de streaming scrcpy esta vivo y funcional.
$ErrorActionPreference = 'Continue'

Write-Host "=== Verificacion FlowDashboard streaming pipeline ===" -ForegroundColor Cyan

# 1. Detener instancias previas del backend para forzar uso del Release recien compilado.
$procs = Get-Process -Name 'FlowDashboard.Core' -ErrorAction SilentlyContinue
if ($procs) {
    Write-Host "[1/4] Deteniendo $($procs.Count) instancia(s) previas del backend..." -ForegroundColor Yellow
    foreach ($p in $procs) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
} else {
    Write-Host "[1/4] No habia backend corriendo." -ForegroundColor DarkGray
}

# 2. Lanzar el Release recien compilado.
$exe = 'C:\DASHBOARD\FlowDashboard\FlowDashboard.Core\bin\Release\net8.0\FlowDashboard.Core.exe'
if (-not (Test-Path -LiteralPath $exe)) {
    Write-Host "[2/4] ERROR: backend Release no encontrado." -ForegroundColor Red
    exit 1
}
Write-Host "[2/4] Lanzando backend Release..." -ForegroundColor Yellow
Start-Process -FilePath $exe -WorkingDirectory 'C:\DASHBOARD\FlowDashboard' -WindowStyle Hidden

# 3. Esperar a /api/health.
$ok = $false
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $r = Invoke-RestMethod -Uri 'http://127.0.0.1:5000/api/health' -TimeoutSec 2 -ErrorAction Stop
        $ok = $true
        break
    } catch { }
}
if ($ok) {
    Write-Host "[3/4] Backend respondiendo en /api/health." -ForegroundColor Green
} else {
    Write-Host "[3/4] Backend NO respondio en 20s." -ForegroundColor Red
    exit 1
}

# 4. Comprobar el endpoint del video streaming.
try {
    $active = Invoke-RestMethod -Uri 'http://127.0.0.1:5000/api/videostream/active' -TimeoutSec 3 -ErrorAction Stop
    Write-Host "[4/4] /api/videostream/active OK. Streams activos: $($active.Count)" -ForegroundColor Green
} catch {
    Write-Host "[4/4] /api/videostream/active fallo: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Pipeline scrcpy listo." -ForegroundColor Green
Write-Host "WebSocket H.264 disponible en ws://localhost:5000/api/videostream/ws/<serial>?quality=240&fps=8" -ForegroundColor Green
