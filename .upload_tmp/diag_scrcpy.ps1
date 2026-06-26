# Diagnostico completo de la version de scrcpy y formatos soportados.
$ErrorActionPreference = 'Continue'
$scrcpy = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\scrcpy.exe'

Write-Host "=== scrcpy --version ===" -ForegroundColor Cyan
& $scrcpy --version 2>&1 | Out-Host

Write-Host ""
Write-Host "=== scrcpy --help (record) ===" -ForegroundColor Cyan
$help = & $scrcpy --help 2>&1
$help | Select-String -Pattern 'record|format|codec|video' | Out-Host

Write-Host ""
Write-Host "=== Listado de archivos en scrcpy-win64-v4.0 ===" -ForegroundColor Cyan
Get-ChildItem 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0' | Select-Object Name, Length | Out-Host
