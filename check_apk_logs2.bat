@echo off
setlocal enabledelayedexpansion

set ADB=C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe
set DEVICE=192.168.1.11:5555

echo Limpiando logcat en %DEVICE%...
%ADB% -s %DEVICE% logcat -c

echo.
echo Esperando 2 segundos...
timeout /t 2 /nobreak

echo.
echo Capturando logs del APK (15 segundos)...
%ADB% -s %DEVICE% logcat *:S FlowAgent:V com.flowlogin.agent:V

echo.
echo Listo.
