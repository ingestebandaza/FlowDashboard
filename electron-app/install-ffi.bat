@echo off
echo Instalando ffi-napi para window embedding...
cd /d "%~dp0"
npm install ffi-napi ref-napi
echo.
echo Instalacion completada!
pause
