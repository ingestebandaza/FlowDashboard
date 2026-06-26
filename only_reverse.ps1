$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'

$devices = & $adb devices | Select-String 'device$' | ForEach-Object { ($_ -split '\s+')[0] }
Write-Host "Configurando ADB reverse en $($devices.Count) dispositivos (sin tocar APKs)..." -ForegroundColor Cyan

$jobs = @()
foreach ($d in $devices) {
    $jobs += Start-Job -ScriptBlock {
        param($adb, $d)
        & $adb -s $d reverse tcp:8766 tcp:8766 2>&1 | Out-Null
        & $adb -s $d reverse tcp:5000 tcp:5000 2>&1 | Out-Null
        "OK reverse $d"
    } -ArgumentList $adb, $d
}
$jobs | Wait-Job -Timeout 20 | Receive-Job | ForEach-Object { Write-Host $_ -ForegroundColor Green }
$jobs | Remove-Job -Force

Write-Host ""
Write-Host "Esperando 5s para que los APKs se reconecten solos..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "Verificando agentes..." -ForegroundColor Cyan
try {
    $agents = Invoke-RestMethod -Uri 'http://localhost:8765/agents' -TimeoutSec 5
    Write-Host "Agentes conectados: $($agents.agents.Count)" -ForegroundColor Cyan
    $agents.agents | ForEach-Object {
        $color = if ($_.serial) { 'Green' } else { 'Red' }
        Write-Host "  $($_.agentId) serial=$($_.serial)" -ForegroundColor $color
    }
} catch {
    Write-Host "Error consultando agentes: $_" -ForegroundColor Red
}
