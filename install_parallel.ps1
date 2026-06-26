$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$apk = 'C:\DASHBOARD\FlowDashboard\flow_agent_apk\build\flowagent-debug.apk'

$devices = @(
    '192.168.1.11:5555','192.168.1.38:5555','192.168.1.39:5555','192.168.1.40:5555',
    '192.168.1.41:5555','192.168.1.42:5555','192.168.1.43:5555','192.168.1.44:5555',
    '192.168.1.45:5555','192.168.1.49:5555','192.168.1.50:5555','192.168.1.51:5555',
    '192.168.1.52:5555','192.168.1.53:5555'
)

Write-Host "Instalando APK en $($devices.Count) dispositivos en paralelo..." -ForegroundColor Cyan

$jobs = @()
foreach ($d in $devices) {
    $jobs += Start-Job -ScriptBlock {
        param($adb, $apk, $d)
        & $adb -s $d uninstall com.flowlogin.agent 2>&1 | Out-Null
        $r = & $adb -s $d install -r $apk 2>&1
        & $adb -s $d reverse tcp:8766 tcp:8766 2>&1 | Out-Null
        & $adb -s $d reverse tcp:5000 tcp:5000 2>&1 | Out-Null
        if ($r -match 'Success') { "OK $d" } else { "FAIL $d : $r" }
    } -ArgumentList $adb, $apk, $d
}

Write-Host "Esperando resultados..." -ForegroundColor Yellow
$results = $jobs | Wait-Job -Timeout 60 | Receive-Job
$jobs | Remove-Job -Force

$results | ForEach-Object {
    if ($_ -match '^OK') { Write-Host $_ -ForegroundColor Green }
    else { Write-Host $_ -ForegroundColor Red }
}
Write-Host "Listo." -ForegroundColor Cyan
