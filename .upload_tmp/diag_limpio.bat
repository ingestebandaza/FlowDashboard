@echo off
cd /d C:\DASHBOARD\FlowDashboard
set ADB=scrcpy-win64-v4.0\adb.exe
set SERIAL=192.168.1.11:5555
set PORT=28100
set SCID=1a2b3c4d

echo === 1) Reconectar device ===
%ADB% connect %SERIAL%
timeout /t 1 /nobreak >nul

echo === 2) Push jar ===
%ADB% -s %SERIAL% push scrcpy-win64-v4.0\scrcpy-server /data/local/tmp/scrcpy-server-manual.jar

echo === 3) Limpiar forwards ===
%ADB% -s %SERIAL% forward --remove-all

echo === 4) Crear forward ===
%ADB% -s %SERIAL% forward tcp:%PORT% localabstract:scrcpy_%SCID%

echo === 5) Lanzar server (stderr a archivo) ===
%ADB% -s %SERIAL% shell "CLASSPATH=/data/local/tmp/scrcpy-server-manual.jar app_process / com.genymobile.scrcpy.Server 4.0 scid=%SCID% log_level=info tunnel_forward=true audio=false control=false cleanup=true raw_stream=true video_codec=h264 max_size=240 max_fps=8 video_bit_rate=300000" > .upload_tmp\server_stdout.log 2> .upload_tmp\server_stderr.log &

echo === 6) Esperar 1.5s ===
timeout /t 2 /nobreak >nul

echo === 7) Conectar y leer bytes ===
"C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe" -u .upload_tmp\probe_tcp.py %PORT% > .upload_tmp\probe.log 2>&1
type .upload_tmp\probe.log

echo === 8) Stderr del server ===
type .upload_tmp\server_stderr.log

echo === 9) Limpiar ===
%ADB% -s %SERIAL% forward --remove-all
