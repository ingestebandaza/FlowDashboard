$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$apk = 'C:\DASHBOARD\FlowDashboard\flow_agent_apk\build\flowagent-debug.apk'

$devices = & $adb devices | Select-String 'device$' | ForEach-Object { ($_ -split '\s+')[0] }

Write-Host "Instalando en $($devices.Count) dispositivos..." -ForegroundColor Cyan

$jobs = @()
foreach ($d in $devices) {
    $jobs += Start-Job -ScriptBlock {
        param($adb, $apk, $d)
        $r = & $adb -s $d install $apk 2>&1
        & $adb -s $d reverse tcp:8766 tcp:8766 2>&1 | Out-Null
        & $adb -s $d reverse tcp:5000 tcp:5000 2>&1 | Out-Null
        if ($r -match 'Success') { "OK $d" } else { "FAIL $d : $r" }
    } -ArgumentList $adb, $apk, $d
}

$jobs | Wait-Job -Timeout 90 | Receive-Job | ForEach-Object {
    if ($_ -match '^OK') { Write-Host $_ -ForegroundColor Green }
    else { Write-Host $_ -ForegroundColor Red }
}
$jobs | Remove-Job -Force
Write-Host "Instalacion completada." -ForegroundColor Cyan
