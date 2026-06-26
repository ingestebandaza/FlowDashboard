$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$apk = 'C:\DASHBOARD\FlowDashboard\flow_agent_apk\build\flowagent-debug.apk'
$package = 'com.flowlogin.agent'

$devices = & $adb devices | Select-String 'device$' | ForEach-Object { ($_ -split '\s+')[0] }

Write-Host "Dispositivos encontrados: $($devices.Count)" -ForegroundColor Cyan
Write-Host "Paso 1/2: Desinstalando en paralelo..." -ForegroundColor Yellow

$jobs = @()
foreach ($d in $devices) {
    $jobs += Start-Job -ScriptBlock {
        param($adb, $package, $d)
        $r = & $adb -s $d uninstall $package 2>&1
        "UNINSTALL $d : $r"
    } -ArgumentList $adb, $package, $d
}
$jobs | Wait-Job -Timeout 30 | Receive-Job | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
$jobs | Remove-Job -Force

Write-Host ""
Write-Host "Paso 2/2: Instalando nuevo APK en paralelo..." -ForegroundColor Yellow

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
$jobs | Wait-Job -Timeout 60 | Receive-Job | ForEach-Object {
    if ($_ -match '^OK') { Write-Host $_ -ForegroundColor Green }
    else { Write-Host $_ -ForegroundColor Red }
}
$jobs | Remove-Job -Force

Write-Host ""
Write-Host "Listo. Ahora Python relanzara el APK con el serial correcto." -ForegroundColor Cyan
