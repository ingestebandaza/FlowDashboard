@echo off
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo   VERIFICACION DE DASHBOARD - FlowDashboard
echo ============================================================
echo.

REM Verificar que los archivos necesarios existen
echo [1/5] Verificando archivos necesarios...
echo.

set "MISSING=0"

if not exist "wsapi_demo.html" (
    echo   ❌ FALTA: wsapi_demo.html
    set "MISSING=1"
) else (
    echo   ✅ Encontrado: wsapi_demo.html
)

if not exist "wsapi.js" (
    echo   ❌ FALTA: wsapi.js
    set "MISSING=1"
) else (
    echo   ✅ Encontrado: wsapi.js
)

if not exist "streaming_ui_clean.js" (
    echo   ❌ FALTA: streaming_ui_clean.js
    set "MISSING=1"
) else (
    echo   ✅ Encontrado: streaming_ui_clean.js
)

if not exist "local_adb_server.py" (
    echo   ❌ FALTA: local_adb_server.py
    set "MISSING=1"
) else (
    echo   ✅ Encontrado: local_adb_server.py
)

echo.

REM Verificar que NO existen archivos duplicados
echo [2/5] Verificando que NO existen archivos duplicados...
echo.

set "DUPLICATES=0"

if exist "streaming_ui_fixed.js" (
    echo   ⚠️  ENCONTRADO (debe eliminarse): streaming_ui_fixed.js
    set "DUPLICATES=1"
) else (
    echo   ✅ No existe: streaming_ui_fixed.js
)

if exist "streaming_ui_implementation.js" (
    echo   ⚠️  ENCONTRADO (debe eliminarse): streaming_ui_implementation.js
    set "DUPLICATES=1"
) else (
    echo   ✅ No existe: streaming_ui_implementation.js
)

if exist "streaming_ui_styles.css" (
    echo   ⚠️  ENCONTRADO (debe eliminarse): streaming_ui_styles.css
    set "DUPLICATES=1"
) else (
    echo   ✅ No existe: streaming_ui_styles.css
)

echo.

REM Verificar que el HTML carga los scripts correctos
echo [3/5] Verificando que HTML carga scripts correctos...
echo.

findstr /M "streaming_ui_clean.js" wsapi_demo.html >nul
if !errorlevel! equ 0 (
    echo   ✅ HTML carga: streaming_ui_clean.js
) else (
    echo   ❌ HTML NO carga: streaming_ui_clean.js
    set "MISSING=1"
)

findstr /M "wsapi.js" wsapi_demo.html >nul
if !errorlevel! equ 0 (
    echo   ✅ HTML carga: wsapi.js
) else (
    echo   ❌ HTML NO carga: wsapi.js
    set "MISSING=1"
)

echo.

REM Verificar que el servidor está disponible
echo [4/5] Verificando disponibilidad del servidor...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $h=Invoke-RestMethod -Uri 'http://127.0.0.1:8765/health' -TimeoutSec 2; if ($h.status -eq 'ok') { Write-Host '   ✅ Servidor ADB local está ACTIVO'; exit 0 } else { Write-Host '   ⚠️  Servidor responde pero status no es ok'; exit 1 } } catch { Write-Host '   ⚠️  Servidor ADB local NO está activo (normal si no está iniciado)'; exit 1 }"

echo.

REM Resumen
echo [5/5] RESUMEN
echo.

if !MISSING! equ 0 (
    if !DUPLICATES! equ 0 (
        echo   ✅ VERIFICACION EXITOSA
        echo.
        echo   Todos los archivos están en su lugar.
        echo   No hay archivos duplicados.
        echo.
        echo   PRÓXIMOS PASOS:
        echo   1. Ejecuta: abrir_dashboard.bat
        echo   2. Abre el navegador en: http://127.0.0.1:8765/wsapi_demo.html
        echo   3. Presiona: Ctrl + Shift + R (recarga forzada)
        echo   4. Deberías ver:
        echo      - Botón ☰ en esquina superior izquierda
        echo      - Botón "Streaming" en barra de controles
        echo      - Barra de controles STICKY (fija)
        echo      - Menú lateral ocultable
        echo.
    ) else (
        echo   ⚠️  ADVERTENCIA: Existen archivos duplicados
        echo.
        echo   Debes eliminar los archivos duplicados:
        echo   - streaming_ui_fixed.js
        echo   - streaming_ui_implementation.js
        echo   - streaming_ui_styles.css
        echo.
    )
) else (
    echo   ❌ VERIFICACION FALLIDA
    echo.
    echo   Faltan archivos necesarios. Verifica la instalación.
    echo.
)

echo ============================================================
echo.

endlocal
pause
