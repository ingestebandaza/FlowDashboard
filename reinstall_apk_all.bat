@echo off
setlocal enabledelayedexpansion

set ADB=C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe
set APK=C:\DASHBOARD\FlowDashboard\flow_agent_apk\build\flowagent-debug.apk

echo ============================================================
echo  DESINSTALANDO Y REINSTALANDO APK EN TODOS LOS DISPOSITIVOS
echo ============================================================
echo.

echo [1/3] Obteniendo lista de dispositivos...
for /f "tokens=1" %%A in ('%ADB% devices ^| findstr "device$" ^| findstr /v "List"') do (
    set DEVICE=%%A
    echo.
    echo Procesando: !DEVICE!
    
    echo   - Desinstalando APK anterior...
    %ADB% -s !DEVICE! uninstall com.flowlogin.agent 2>nul
    
    echo   - Instalando nuevo APK...
    %ADB% -s !DEVICE! install -r "!APK!"
    
    if !ERRORLEVEL! EQU 0 (
        echo   ✓ Instalacion exitosa
    ) else (
        echo   ✗ Error en instalacion
    )
)

echo.
echo [2/3] Configurando ADB reverse para todos los dispositivos...
for /f "tokens=1" %%A in ('%ADB% devices ^| findstr "device$" ^| findstr /v "List"') do (
    set DEVICE=%%A
    echo   - Configurando reverse para !DEVICE!...
    %ADB% -s !DEVICE% reverse tcp:8766 tcp:8766
    %ADB% -s !DEVICE% reverse tcp:5000 tcp:5000
)

echo.
echo [3/3] Verificando instalacion...
%ADB% devices

echo.
echo ============================================================
echo  REINSTALACION COMPLETADA
echo ============================================================
echo.
echo Proximos pasos:
echo 1. Abre el APK FlowAgent en un dispositivo
echo 2. Verifica que se conecta a localhost:8766
echo 3. Verifica que se registra en el backend
echo.
