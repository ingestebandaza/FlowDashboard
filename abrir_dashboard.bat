@echo off
setlocal

set "APP_DIR=%~dp0"
set "APP_DIR=%APP_DIR:~0,-1%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%APP_DIR%\abrir_dashboard.ps1"
if errorlevel 1 (
  echo.
  echo ERROR: No se pudo iniciar FlowDashboard correctamente.
  echo Revisa el mensaje anterior para ver que servidor o dependencia fallo.
  echo.
  pause
  exit /b 1
)
