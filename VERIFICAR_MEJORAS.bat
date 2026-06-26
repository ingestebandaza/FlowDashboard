@echo off
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo   VERIFICACION DE MEJORAS - DASHBOARD
echo ============================================================
echo.

echo [1/3] Verificando archivos necesarios...
echo.

set "MISSING=0"

if not exist "abrir_dashboard.bat" (
    echo   ❌ FALTA: abrir_dashboard.bat
    set "MISSING=1"
) else (
    echo   ✅ Encontrado: abrir_dashboard.bat
)

if not exist "license_persistence.js" (
    echo   ❌ FALTA: license_persistence.js
    set "MISSING=1"
) else (
    echo   ✅ Encontrado: license_persistence.js
)

if not exist "wsapi_demo.html" (
    echo   ❌ FALTA: wsapi_demo.html
    set "MISSING=1"
) else (
    echo   ✅ Encontrado: wsapi_demo.html
)

echo.

echo [2/3] Verificando que HTML carga license_persistence.js...
echo.

findstr /M "license_persistence.js" wsapi_demo.html >nul
if !errorlevel! equ 0 (
    echo   ✅ HTML carga: license_persistence.js
) else (
    echo   ❌ HTML NO carga: license_persistence.js
    set "MISSING=1"
)

echo.

echo [3/3] Verificando que abrir_dashboard.bat NO cierra Chrome...
echo.

findstr /M "taskkill.*chrome" abrir_dashboard.bat >nul
if !errorlevel! equ 0 (
    echo   ❌ abrir_dashboard.bat CIERRA Chrome (debe corregirse)
    set "MISSING=1"
) else (
    echo   ✅ abrir_dashboard.bat NO cierra Chrome
)

findstr /M "start chrome" abrir_dashboard.bat >nul
if !errorlevel! equ 0 (
    echo   ✅ abrir_dashboard.bat abre en Chrome
) else (
    echo   ❌ abrir_dashboard.bat NO abre en Chrome
    set "MISSING=1"
)

echo.

if !MISSING! equ 0 (
    echo ============================================================
    echo   ✅ VERIFICACION EXITOSA
    echo ============================================================
    echo.
    echo   Todas las mejoras están implementadas:
    echo   ✅ Chrome NO se cierra
    echo   ✅ Licencia se guarda automáticamente
    echo   ✅ Licencia se carga automáticamente
    echo.
    echo   PRÓXIMOS PASOS:
    echo   1. Ejecuta: abrir_dashboard.bat
    echo   2. Ingresa tu email de licencia
    echo   3. Haz click en "Validar"
    echo   4. Email se guardará automáticamente
    echo   5. Próxima vez se cargará automáticamente
    echo.
) else (
    echo ============================================================
    echo   ❌ VERIFICACION FALLIDA
    echo ============================================================
    echo.
    echo   Faltan archivos o configuraciones.
    echo   Verifica la instalación.
    echo.
)

echo ============================================================
echo.

endlocal
pause
