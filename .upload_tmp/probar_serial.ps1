# Verifica como pasar el serial a scrcpy 4.0 cuando hay multiples devices.
$ErrorActionPreference = 'Continue'
$scrcpy = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\scrcpy.exe'
$serial = '192.168.1.11:5555'

# Opcion 1: --serial (forma larga oficial)
Write-Host "Probando: --serial=$serial" -ForegroundColor Cyan
$out = & $scrcpy --serial=$serial --max-size=240 --no-audio --no-control --no-window --record=$env:TEMP\test1.mkv --time-limit=2 2>&1
Write-Host ($out -join "`n").Substring(0, [Math]::Min(800, ($out -join "`n").Length))
if (Test-Path "$env:TEMP\test1.mkv") {
    Write-Host "OK: archivo $((Get-Item "$env:TEMP\test1.mkv").Length) bytes" -ForegroundColor Green
    Remove-Item "$env:TEMP\test1.mkv" -Force
} else {
    Write-Host "FAIL: no se creo archivo" -ForegroundColor Red
}
