$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$devices = & $adb devices | Select-String 'device$' | ForEach-Object { ($_ -split '\s+')[0] }

Write-Host "Verificando version instalada en $($devices.Count) dispositivos..." -ForegroundColor Cyan
Write-Host ""

$jobs = @()
foreach ($d in $devices) {
    $jobs += Start-Job -ScriptBlock {
        param($adb, $d)
        $r = & $adb -s $d shell dumpsys package com.flowlogin.agent 2>&1 | Select-String 'versionName|versionCode'
        "$d -> $r"
    } -ArgumentList $adb, $d
}
$jobs | Wait-Job -Timeout 20 | Receive-Job | ForEach-Object { Write-Host $_ -ForegroundColor White }
$jobs | Remove-Job -Force
