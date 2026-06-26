@echo off
echo ========================================
echo   CONECTANDO DISPOSITIVOS POR WIFI
echo ========================================
echo.

REM Conectar todos los dispositivos conocidos
adb connect 192.168.1.11:5555
adb connect 192.168.1.12:5555
adb connect 192.168.1.39:5555
adb connect 192.168.1.40:5555
adb connect 192.168.1.41:5555
adb connect 192.168.1.45:5555
adb connect 192.168.1.50:5555
adb connect 192.168.1.51:5555
adb connect 192.168.1.53:5555
adb connect 192.168.1.134:5555
adb connect 192.168.1.135:5555
adb connect 192.168.1.136:5555
adb connect 192.168.1.137:5555
adb connect 192.168.1.138:5555
adb connect 192.168.1.139:5555
adb connect 192.168.1.140:5555
adb connect 192.168.1.141:5555
adb connect 192.168.1.142:5555
adb connect 192.168.1.143:5555
adb connect 192.168.1.144:5555
adb connect 192.168.1.146:5555
adb connect 192.168.1.147:5555
adb connect 192.168.1.148:5555
adb connect 192.168.1.150:5555

echo.
echo ========================================
echo   DISPOSITIVOS CONECTADOS:
echo ========================================
adb devices

echo.
pause
