@echo off
cd /d "c:\DASHBOARD\FlowDashboard\FlowDashboard.Core"
echo Compilando backend C#...
dotnet build -c Release
echo.
echo Compilación completada.
pause
