# Detiene backend, recompila Release y vuelve a arrancarlo.
$ErrorActionPreference = 'Continue'

Write-Host "[1/4] Deteniendo backend en uso..." -ForegroundColor Cyan
Get-Process -Name 'FlowDashboard.Core' -ErrorAction SilentlyContinue | ForEach-Object { 
    try { Stop-Process -Id $_.Id -Force } catch { }
}
Start-Sleep -Seconds 2

Write-Host "[2/4] Compilando Release..." -ForegroundColor Cyan
Set-Location 'C:\DASHBOARD\FlowDashboard\FlowDashboard.Core'
$buildOut = & dotnet build -c Release --nologo -v minimal 2>&1
$buildExit = $LASTEXITCODE
if ($buildExit -ne 0) {
    Write-Host "ERROR: build fallo (exit $buildExit)." -ForegroundColor Red
    $buildOut | Select-Object -Last 20 | Write-Host
    exit 1
}
Write-Host "Build OK." -ForegroundColor Green

Write-Host "[3/4] Lanzando backend Release..." -ForegroundColor Cyan
$exe = 'C:\DASHBOARD\FlowDashboard\FlowDashboard.Core\bin\Release\net8.0\FlowDashboard.Core.exe'
Start-Process -FilePath $exe -WorkingDirectory 'C:\DASHBOARD\FlowDashboard' -WindowStyle Hidden

Write-Host "[4/4] Esperando /api/health..." -ForegroundColor Cyan
$ok = $false
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        Invoke-RestMethod -Uri 'http://127.0.0.1:5000/api/health' -TimeoutSec 2 -ErrorAction Stop | Out-Null
        $ok = $true
        break
    } catch { }
}
if ($ok) {
    Write-Host "Backend operativo." -ForegroundColor Green
} else {
    Write-Host "Backend no respondio en 20s." -ForegroundColor Red
    exit 1
}
