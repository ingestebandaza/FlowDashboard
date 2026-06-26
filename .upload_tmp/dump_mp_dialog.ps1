# Captura el XML del dialogo de MediaProjection para analizar su estructura real.
# Ejecutar MIENTRAS el dialogo esta visible en pantalla.
param([string]$Serial = "192.168.1.11:5555")

$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'

Write-Host "Lanzando FlowAgent con request_capture=true en $Serial..." -ForegroundColor Cyan
& $adb -s $Serial shell am force-stop com.flowlogin.agent 2>$null | Out-Null
Start-Sleep -Milliseconds 400
& $adb -s $Serial shell am start -n com.flowlogin.agent/.MainActivity --ez request_capture true --es host 127.0.0.1 --ei port 8766 --ez autoconnect true 2>$null | Out-Null

Write-Host "Esperando 4s a que aparezca el dialogo..." -ForegroundColor Yellow
Start-Sleep -Seconds 4

Write-Host "Dumpeando UI..." -ForegroundColor Cyan
& $adb -s $Serial shell uiautomator dump /sdcard/mp_dialog.xml 2>&1 | Out-Null
Start-Sleep -Milliseconds 500

$xml = & $adb -s $Serial shell cat /sdcard/mp_dialog.xml 2>&1
Write-Host "`n=== XML del dialogo ===" -ForegroundColor Green
Write-Host ($xml -join "`n")

# Guardar a archivo local para analizar
$xml | Out-File -FilePath "C:\DASHBOARD\FlowDashboard\.upload_tmp\mp_dialog_dump.xml" -Encoding utf8
Write-Host "`nGuardado en .upload_tmp\mp_dialog_dump.xml" -ForegroundColor Green
