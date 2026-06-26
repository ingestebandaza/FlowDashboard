@echo off
setlocal enabledelayedexpansion

set ADB=C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe
set DEVICE=192.168.1.11:5555

echo Deteniendo APK FlowAgent en %DEVICE%...
%ADB% -s %DEVICE% shell am force-stop com.flowlogin.agent
echo APK detenido.

echo.
echo Esperando 3 segundos...
timeout /t 3 /nobreak

echo.
echo Reabriendo APK FlowAgent en %DEVICE%...
%ADB% -s %DEVICE% shell am start -n com.flowlogin.agent/.MainActivity
echo APK reabierto.

echo.
echo Esperando 5 segundos para que se registre...
timeout /t 5 /nobreak

echo.
echo Consultando mappings en backend...
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://localhost:5000/api/devices/mappings' -Method GET -TimeoutSec 5; Write-Host 'Mappings encontrados:' $r.Count; $r | ForEach-Object { Write-Host '  - AndroidId: ' $_.androidId ', Serial: ' $_.adbSerial } } catch { Write-Host 'Error:' $_ }"

echo.
echo Listo.
