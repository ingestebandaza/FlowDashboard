@echo off
echo Matando todos los procesos adb.exe...
taskkill /F /IM adb.exe /T 2>nul
timeout /t 2 /nobreak >nul

echo Iniciando servidor ADB limpio...
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" kill-server 2>nul
timeout /t 1 /nobreak >nul
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" start-server
timeout /t 2 /nobreak >nul

echo Verificando dispositivos...
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" devices

echo.
echo ADB reiniciado. Ahora inicia el dashboard normalmente.
pause
