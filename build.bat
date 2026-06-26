@echo off
cd /d c:\DASHBOARD\FlowDashboard\FlowDashboard.Core
echo Compilando backend C#...
dotnet build -c Release
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Compilacion exitosa!
    echo El ejecutable esta en: bin\Release\net8.0\FlowDashboard.Core.exe
) else (
    echo.
    echo Error en la compilacion!
)
