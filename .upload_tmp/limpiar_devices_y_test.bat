@echo off
echo === Matar Python server ===
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8765 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8768 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1

echo === Limpiar adb forwards y procesos scrcpy en devices ===
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" forward --remove-all
for /f "tokens=1" %%s in ('"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" devices ^| findstr "device"') do (
    if not "%%s"=="List" (
        "C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" -s %%s shell pkill -f scrcpy >nul 2>&1
        "C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" -s %%s shell pkill -f app_process >nul 2>&1
    )
)
timeout /t 2 /nobreak >nul

echo === Arrancar Python server limpio ===
cd /d C:\DASHBOARD\FlowDashboard
start "local_adb_server" /B "C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe" -u local_adb_server.py > .upload_tmp\python_server.log 2>&1
timeout /t 6 /nobreak >nul

echo === Test 5 sesiones via WS ===
"C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe" -u .upload_tmp\test_pocos_sesiones.py > .upload_tmp\test_5.log 2>&1
type .upload_tmp\test_5.log
