@echo off
echo === Reiniciando Python server (para reload del modulo) ===
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8765 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8768 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul

echo === Arrancando Python server ===
cd /d C:\DASHBOARD\FlowDashboard
start "local_adb_server" /B "C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe" -u local_adb_server.py > .upload_tmp\python_server.log 2>&1
timeout /t 8 /nobreak >nul

echo === Test 17 sesiones (con spawn_lock) ===
"C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe" -u .upload_tmp\test_17_sessions.py > .upload_tmp\test_17.log 2>&1
type .upload_tmp\test_17.log
