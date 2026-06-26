@echo off
echo === Matar Python ===
taskkill /F /IM python.exe /T >nul 2>&1
timeout /t 1 /nobreak >nul

echo === forward --remove-all ===
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" forward --remove-all
timeout /t 1 /nobreak >nul

echo === Solo matar app_process en .11 (test) ===
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" -s 192.168.1.11:5555 shell "ps -A | grep app_process | awk '{print $2}' | xargs -r kill -9" 2>nul

echo === Arrancar Python ===
cd /d C:\DASHBOARD\FlowDashboard
start "local_adb_server" /B "C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe" -u local_adb_server.py > .upload_tmp\python_server.log 2>&1
timeout /t 6 /nobreak >nul

echo === Test 1 sesion (.11 thumbnail) ===
"C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe" -u .upload_tmp\test_pocos_sesiones.py > .upload_tmp\test_5.log 2>&1
type .upload_tmp\test_5.log
