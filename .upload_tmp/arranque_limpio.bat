@echo off
echo [1] Matando procesos previos...
taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM adb.exe /T >nul 2>&1
taskkill /F /IM scrcpy.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2] Reiniciando ADB...
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" start-server
timeout /t 1 /nobreak >nul

echo [3] Reconectando .11 para test...
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" connect 192.168.1.11:5555

echo [4] Verificando sintaxis Python...
"C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe" -c "import py_compile; py_compile.compile('scrcpy_raw_streamer.py', doraise=True); py_compile.compile('scrcpy_raw_ws_server.py', doraise=True); print('SYNTAX OK')"

echo [5] Test directo del streamer (1 sesion)...
"C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe" -u .upload_tmp\test_raw_streamer.py > .upload_tmp\test_raw.log 2>&1
type .upload_tmp\test_raw.log
echo DONE
