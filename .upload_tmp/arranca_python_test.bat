@echo off
REM Arranca Python server, espera a que este listo, corre test E2E, y mata Python.
cd /d C:\DASHBOARD\FlowDashboard

REM Matar instancias previas
taskkill /F /IM python.exe /FI "WINDOWTITLE eq local_adb_server*" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8765 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8768 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul

REM Arrancar Python en background con log.
start "local_adb_server" /B "C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe" -u local_adb_server.py > .upload_tmp\python_server.log 2>&1
echo Esperando 8s a que arranque...
timeout /t 8 /nobreak >nul

REM Test.
"C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe" -u .upload_tmp\test_ws_e2e.py > .upload_tmp\test_ws_e2e.log 2>&1
type .upload_tmp\test_ws_e2e.log

REM Cleanup.
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8765 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8768 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
