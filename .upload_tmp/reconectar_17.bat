@echo off
set ADB=C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe
for %%i in (11 38 39 40 41 42 43 44 45 46 47 48 49 50 51 52 53) do (
    %ADB% connect 192.168.1.%%i:5555 >nul 2>&1
)
%ADB% devices
echo Reconexion completada.
