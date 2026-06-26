@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo   FLOWDASHBOARD PRO - APP DE ESCRITORIO
echo ============================================================
echo.

where cargo >nul 2>nul
if errorlevel 1 (
  echo Rust/Cargo no esta instalado. Tauri lo necesita para compilar la app Pro.
  echo Instala Rust desde https://rustup.rs/ y luego vuelve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias Tauri...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo ERROR: No se pudieron instalar las dependencias.
    pause
    exit /b 1
  )
)

call npm.cmd run tauri:dev
endlocal
