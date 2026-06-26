@echo off
setlocal

set "APP_DIR=%~dp0"
set "APP_DIR=%APP_DIR:~0,-1%"
set "DIST_DIR=%APP_DIR%\dist"
set "BUILD_DIR=%APP_DIR%\build_fixed"
set "EXE_PATH=%DIST_DIR%\FlowDashboard.exe"

echo.
echo ========================================
echo  Creando FlowDashboard.exe
echo ========================================
echo.

cd /d "%APP_DIR%"

echo [1/5] Cerrando FlowDashboard si esta abierto...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process FlowDashboard -ErrorAction SilentlyContinue | Stop-Process -Force" >nul 2>nul

echo [2/5] Comprobando PyInstaller...
python -m PyInstaller --version >nul 2>nul
if errorlevel 1 (
  echo PyInstaller no esta instalado. Instalando...
  python -m pip install pyinstaller
  if errorlevel 1 (
    echo.
    echo ERROR: No se pudo instalar PyInstaller.
    pause
    exit /b 1
  )
)

echo [3/5] Limpiando build temporal...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$target='%BUILD_DIR%'; if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }" >nul 2>nul

echo [4/5] Compilando EXE...
python -m PyInstaller launcher.spec --noconfirm --workpath "%BUILD_DIR%" --distpath "%DIST_DIR%"
if errorlevel 1 (
  echo.
  echo ERROR: Fallo la compilacion.
  pause
  exit /b 1
)

echo [5/5] Copiando configuracion local...
if exist "%APP_DIR%\.supabase_config.json" (
  copy /Y "%APP_DIR%\.supabase_config.json" "%DIST_DIR%\.supabase_config.json" >nul
)
if exist "%APP_DIR%\update_config.json" (
  copy /Y "%APP_DIR%\update_config.json" "%DIST_DIR%\update_config.json" >nul
)

if not exist "%EXE_PATH%" (
  echo.
  echo ERROR: No se encontro el EXE generado:
  echo %EXE_PATH%
  pause
  exit /b 1
)

echo.
echo Listo.
echo EXE generado en:
echo %EXE_PATH%
echo.
pause

