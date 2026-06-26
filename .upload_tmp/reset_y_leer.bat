@echo off
taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM adb.exe /T >nul 2>&1
timeout /t 1 /nobreak >nul
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" start-server
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" connect 192.168.1.11:5555
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" devices
echo LISTO
