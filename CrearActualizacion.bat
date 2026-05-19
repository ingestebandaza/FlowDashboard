@echo off
setlocal

set "APP_DIR=%~dp0"
set "APP_DIR=%APP_DIR:~0,-1%"
set "OWNER=ingestebandaza"
set "REPO=FlowDashboard"
set "DIST_DIR=%APP_DIR%\dist"
set "BUILD_DIR=%APP_DIR%\build_fixed"
set "RELEASE_DIR=%APP_DIR%\release_packages"
set "STAGING_DIR=%RELEASE_DIR%\staging"

cd /d "%APP_DIR%"

for /f "usebackq delims=" %%v in (`python -c "import app_meta; print(app_meta.APP_VERSION)"`) do set "VERSION=%%v"

if "%VERSION%"=="" (
  echo ERROR: No se pudo leer APP_VERSION desde app_meta.py
  pause
  exit /b 1
)

set "ZIP_NAME=FlowDashboard-%VERSION%.zip"
set "ZIP_PATH=%RELEASE_DIR%\%ZIP_NAME%"
set "PACKAGE_URL=https://github.com/%OWNER%/%REPO%/releases/download/v%VERSION%/%ZIP_NAME%"

echo.
echo ========================================
echo  Crear paquete de actualizacion
echo ========================================
echo Version: %VERSION%
echo.

echo [1/7] Cerrando FlowDashboard si esta abierto...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process FlowDashboard -ErrorAction SilentlyContinue | Stop-Process -Force" >nul 2>nul

echo [2/7] Comprobando PyInstaller...
python -m PyInstaller --version >nul 2>nul
if errorlevel 1 (
  echo PyInstaller no esta instalado. Instalando...
  python -m pip install pyinstaller
  if errorlevel 1 (
    echo ERROR: No se pudo instalar PyInstaller.
    pause
    exit /b 1
  )
)

echo [3/7] Preparando configuracion de update...
if not exist "%APP_DIR%\update_config.json" (
  copy /Y "%APP_DIR%\update_config.example.json" "%APP_DIR%\update_config.json" >nul
)

echo [4/7] Compilando EXE...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$target='%BUILD_DIR%'; if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }" >nul 2>nul
python -m PyInstaller launcher.spec --noconfirm --workpath "%BUILD_DIR%" --distpath "%DIST_DIR%"
if errorlevel 1 (
  echo ERROR: Fallo la compilacion.
  pause
  exit /b 1
)

echo [5/7] Preparando ZIP...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$release='%RELEASE_DIR%'; $staging='%STAGING_DIR%'; $null=New-Item -ItemType Directory -Force -Path $release; if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }; $null=New-Item -ItemType Directory -Force -Path $staging; Copy-Item -LiteralPath '%DIST_DIR%\FlowDashboard.exe' -Destination $staging -Force; foreach ($file in @('wsapi_demo.html','wsapi.js','Login.js','Register.js','logo.png')) { $src=Join-Path '%APP_DIR%' $file; if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination $staging -Force } }; if (Test-Path -LiteralPath '%APP_DIR%\.supabase_config.json') { Copy-Item -LiteralPath '%APP_DIR%\.supabase_config.json' -Destination $staging -Force }; if (Test-Path -LiteralPath '%APP_DIR%\update_config.json') { Copy-Item -LiteralPath '%APP_DIR%\update_config.json' -Destination $staging -Force }; if (Test-Path -LiteralPath '%ZIP_PATH%') { Remove-Item -LiteralPath '%ZIP_PATH%' -Force }; Compress-Archive -Path ($staging + '\*') -DestinationPath '%ZIP_PATH%' -Force"
if errorlevel 1 (
  echo ERROR: No se pudo crear el ZIP.
  pause
  exit /b 1
)

echo [6/7] Calculando SHA256...
for /f "usebackq delims=" %%h in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-FileHash -Algorithm SHA256 -LiteralPath '%ZIP_PATH%').Hash.ToLower()"`) do set "SHA256=%%h"

if "%SHA256%"=="" (
  echo ERROR: No se pudo calcular el SHA256.
  pause
  exit /b 1
)

echo [7/7] Actualizando update.json...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$manifest=[ordered]@{version='%VERSION%'; package_url='%PACKAGE_URL%'; sha256='%SHA256%'}; $json=ConvertTo-Json -InputObject $manifest; [System.IO.File]::WriteAllText('%APP_DIR%\update.json', $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))"

echo.
echo Listo.
echo ZIP:
echo %ZIP_PATH%
echo.
echo URL que debe existir en GitHub Release:
echo %PACKAGE_URL%
echo.
echo SHA256:
echo %SHA256%
echo.
echo Siguiente paso:
echo 1. Sube este ZIP a una Release de GitHub con tag v%VERSION%.
echo 2. Despues de subir el ZIP, haz commit y push de update.json.
echo.
pause
