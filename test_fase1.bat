@echo off
echo ========================================
echo PRUEBA FASE 1 - FlowDashboard Pro
echo ========================================
echo.
echo Este script iniciara:
echo 1. Servidor C# (ADB) en puerto 5000
echo 2. Servidor Python (FlowLogin) en puerto 8765
echo 3. Electron App
echo.
echo Presiona Ctrl+C para detener todo
echo.
pause

echo.
echo [1/3] Iniciando servidor C#...
start "C# Server" cmd /k "cd FlowDashboard.Core && dotnet run"
timeout /t 3 /nobreak > nul

echo [2/3] Iniciando servidor Python...
start "Python Server" cmd /k "python local_adb_server.py"
timeout /t 2 /nobreak > nul

echo [3/3] Iniciando Electron App...
cd electron-app
npm start

echo.
echo Cerrando servidores...
taskkill /FI "WINDOWTITLE eq C# Server*" /F > nul 2>&1
taskkill /FI "WINDOWTITLE eq Python Server*" /F > nul 2>&1
