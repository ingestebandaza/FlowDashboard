@echo off
echo === Mata todo lo relacionado ===
taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM adb.exe /T >nul 2>&1
taskkill /F /IM scrcpy.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul

echo === Reiniciar ADB server ===
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" start-server
timeout /t 1 /nobreak >nul

echo === Reconectar el .11 ===
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" connect 192.168.1.11:5555

echo === Arrancar Python ===
cd /d C:\DASHBOARD\FlowDashboard
start "local_adb_server" /B "C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe" -u local_adb_server.py > .upload_tmp\python_server.log 2>&1
timeout /t 6 /nobreak >nul

echo === Test 1 sesion via WS (solo .11) ===
"C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe" -u .upload_tmp\test_pocos_sesiones.py > .upload_tmp\test_5.log 2>&1
type .upload_tmp\test_5.log
