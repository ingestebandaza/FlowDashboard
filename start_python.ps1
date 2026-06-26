$python = "C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe"
$script = "c:\DASHBOARD\FlowDashboard\local_adb_server.py"

Write-Host "Iniciando servidor Python..." -ForegroundColor Cyan
Start-Process -FilePath $python -ArgumentList "-u `"$script`"" -WorkingDirectory "c:\DASHBOARD\FlowDashboard" -WindowStyle Normal

Write-Host "Esperando 8s..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

try {
    $r = Invoke-RestMethod -Uri 'http://localhost:8765/health' -TimeoutSec 5
    Write-Host "Python OK - version: $($r.version)" -ForegroundColor Green
} catch {
    Write-Host "Python aun no responde" -ForegroundColor Red
}
