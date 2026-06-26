@echo off
setlocal
set APP_DIR=%~dp0
set APP_DIR=%APP_DIR:~0,-1%
powershell -NoProfile -ExecutionPolicy Bypass -File "%APP_DIR%\abrir_electron.ps1"
if errorlevel 1 (
    echo.
    echo ERROR: Algo fallo al iniciar FlowDashboard.
    pause
)
