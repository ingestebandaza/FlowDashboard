@echo off
setlocal enabledelayedexpansion

echo === Probando Registro de Dispositivos ===
echo.

set ADB=C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe

echo [1] Obteniendo dispositivos conectados...
%ADB% devices

echo.
echo [2] Abriendo FlowAgent en primer dispositivo...
for /f "tokens=1" %%A in ('%ADB% devices ^| findstr "device$" ^| findstr /v "List"') do (
    echo Abriendo en %%A
    %ADB% -s %%A shell am start -n com.flowlogin.agent/.MainActivity
    goto :done
)

:done
echo.
echo [3] Esperando 10 segundos para que se registre...
timeout /t 10 /nobreak

echo.
echo [4] Consultando mappings en backend...
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://localhost:5000/api/devices/mappings' -Method GET -TimeoutSec 5; Write-Host 'Mappings encontrados:' $r.Count; $r | ForEach-Object { Write-Host '  - ' $_.androidId ' -> ' $_.adbSerial } } catch { Write-Host 'Error:' $_ }"

echo.
echo === Prueba Completada ===
