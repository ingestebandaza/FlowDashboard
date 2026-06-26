@echo off
echo =================================================
echo === DIAG FULL: estado actual del flow streaming ==
echo =================================================
echo.

echo --- 1) Procesos Python/dotnet activos ---
powershell -NoProfile -Command "Get-Process | Where-Object { $_.Name -match 'python|FlowDashboard|dotnet|electron|scrcpy' } | Select-Object Id, Name, @{N='CPU';E={[Math]::Round($_.CPU,1)}}, @{N='RAM_MB';E={[Math]::Round($_.WorkingSet/1MB,0)}} | Format-Table -AutoSize"
echo.

echo --- 2) Puertos LISTENING ---
netstat -ano | findstr "LISTENING" | findstr ":5000 :5037 :8765 :8766 :8767 :8768 :3000"
echo.

echo --- 3) /api/health backend C# ---
powershell -NoProfile -Command "try { (Invoke-RestMethod -Uri 'http://127.0.0.1:5000/api/health' -TimeoutSec 2 -ErrorAction Stop) | ConvertTo-Json -Compress } catch { 'C# down' }"
echo.

echo --- 4) /health Python server + features ---
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:8765/health' -TimeoutSec 2 -ErrorAction Stop; $r.features | Where-Object { $_ -match 'raw|h264|stream' } } catch { 'Python down: ' + $_.Exception.Message }"
echo.

echo --- 5) /streaming/raw/sessions ---
powershell -NoProfile -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:8765/streaming/raw/sessions' -TimeoutSec 2 -ErrorAction Stop | ConvertTo-Json -Depth 3 -Compress } catch { 'endpoint down: ' + $_.Exception.Message }"
echo.

echo --- 6) adb devices ---
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" devices
echo.

echo --- 7) adb forwards activos ---
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" forward --list
echo.

echo --- 8) FlowAgent v1.0.0 instalado en .11 ---
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" -s 192.168.1.11:5555 shell dumpsys package com.flowlogin.agent ^| findstr "versionName"
echo.

echo --- 9) Existencia jar pusheado en .11 ---
"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe" -s 192.168.1.11:5555 shell ls -la /data/local/tmp/scrcpy-server-manual.jar 2^>nul
echo.

echo --- 10) Ultimas 30 lineas del log Python ---
if exist "C:\DASHBOARD\FlowDashboard\.upload_tmp\python_server.log" (
    powershell -NoProfile -Command "Get-Content 'C:\DASHBOARD\FlowDashboard\.upload_tmp\python_server.log' -Tail 30"
) else (
    echo no log disponible
)
echo.

echo =================================================
echo === FIN DIAG ===================================
echo =================================================
