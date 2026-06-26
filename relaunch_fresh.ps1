$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$activity = 'com.flowlogin.agent/.MainActivity'

$devices = & $adb devices | Select-String 'device$' | ForEach-Object { ($_ -split '\s+')[0] }
Write-Host "Relanzando $($devices.Count) APKs frescos con serial..." -ForegroundColor Cyan

$jobs = @()
foreach ($d in $devices) {
    $jobs += Start-Job -ScriptBlock {
        param($adb, $activity, $d)
        & $adb -s $d shell am start -n $activity `
            --es host 127.0.0.1 `
            --es serial $d `
            --ei port 8766 `
            --ez autoconnect true 2>&1 | Out-Null
        "OK $d"
    } -ArgumentList $adb, $activity, $d
}
$jobs | Wait-Job -Timeout 30 | Receive-Job | ForEach-Object { Write-Host $_ -ForegroundColor Green }
$jobs | Remove-Job -Force

Write-Host ""
Write-Host "Esperando 8s..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

Write-Host "Verificando seriales en agentes..." -ForegroundColor Cyan
try {
    $agents = Invoke-RestMethod -Uri 'http://localhost:8765/agents' -TimeoutSec 5
    $conSerial = ($agents.agents | Where-Object { $_.serial -ne '' }).Count
    $sinSerial = ($agents.agents | Where-Object { $_.serial -eq '' }).Count
    Write-Host "Agentes con serial: $conSerial / $($agents.agents.Count)" -ForegroundColor Green
    if ($sinSerial -gt 0) { Write-Host "Sin serial aun: $sinSerial" -ForegroundColor Yellow }
    $agents.agents | ForEach-Object { 
        $color = if ($_.serial) { 'Green' } else { 'Yellow' }
        Write-Host "  $($_.agentId) -> serial=$($_.serial)" -ForegroundColor $color
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
