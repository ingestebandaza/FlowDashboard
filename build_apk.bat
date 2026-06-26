@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo  COMPILANDO APK FLOWAGENT
echo ============================================================
echo.

cd /d c:\DASHBOARD\FlowDashboard\flow_agent_apk

echo [1/3] Limpiando build anterior...
if exist build rmdir /s /q build
echo Limpieza completada.

echo.
echo [2/3] Compilando APK...
call gradlew.bat assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Compilacion fallida!
    pause
    exit /b 1
)
echo Compilacion completada.

echo.
echo [3/3] Verificando APK...
if exist build\outputs\apk\debug\app-debug.apk (
    for %%F in (build\outputs\apk\debug\app-debug.apk) do (
        echo APK generado: %%~nxF (%%~zF bytes)
    )
) else (
    echo ERROR: APK no encontrado!
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  COMPILACION EXITOSA
echo ============================================================
echo.
echo APK listo en: build\outputs\apk\debug\app-debug.apk
echo.
