@echo off
echo Matando procesos conflictivos...
taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM adb.exe /T >nul 2>&1
taskkill /F /IM scrcpy.exe /T >nul 2>&1
taskkill /F /IM FlowDashboard.Core.exe /T >nul 2>&1
taskkill /F /IM electron.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul
echo Reiniciando ADB server limpio...
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" kill-server
timeout /t 1 /nobreak >nul
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" start-server
echo ADB reiniciado.
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" devices
echo Listo.
