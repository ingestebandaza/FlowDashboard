$ErrorActionPreference = "SilentlyContinue"
$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Adb = Join-Path $AppDir "scrcpy-win64-v4.0\adb.exe"
$Package = 'com.flowlogin.agent'
$Activity = 'com.flowlogin.agent/.MainActivity'
$Service = 'com.flowlogin.agent/com.flowlogin.agent.FlowAccessibilityService'

$KnownDevices = @(
    '192.168.1.11:5555','192.168.1.38:5555','192.168.1.39:5555','192.168.1.40:5555',
    '192.168.1.41:5555','192.168.1.42:5555','192.168.1.43:5555','192.168.1.44:5555',
    '192.168.1.45:5555','192.168.1.46:5555','192.168.1.47:5555','192.168.1.48:5555',
    '192.168.1.49:5555','192.168.1.50:5555','192.168.1.51:5555','192.168.1.52:5555',
    '192.168.1.53:5555'
)

$Mappings = @(
    @{s='192.168.1.11:5555';a='ec3d6b5297d0bc95'}, @{s='192.168.1.38:5555';a='ab496ae532e2b3d4'},
    @{s='192.168.1.39:5555';a='1eb64864d12325b6'}, @{s='192.168.1.40:5555';a='392ec79b232ce8f5'},
    @{s='192.168.1.41:5555';a='ca620dc1686ace0a'}, @{s='192.168.1.42:5555';a='584dcbc53ac8c631'},
    @{s='192.168.1.43:5555';a='95fd186385d0d5a4'}, @{s='192.168.1.44:5555';a='d2a18d6000029708'},
    @{s='192.168.1.45:5555';a='ca277a41916ad1ae'}, @{s='192.168.1.46:5555';a='1bb5218574279d85'},
    @{s='192.168.1.47:5555';a='b94945429d96e5f3'}, @{s='192.168.1.48:5555';a='cb610076f5377904'},
    @{s='192.168.1.49:5555';a='f3761412899f2a69'}, @{s='192.168.1.50:5555';a='b9304649ecf3816a'},
    @{s='192.168.1.51:5555';a='1f7ea381dd02e951'}, @{s='192.168.1.52:5555';a='8bf237baa8b83964'},
    @{s='192.168.1.53:5555';a='bf391ad042f30dc7'}
)

function Write-Step { param([string]$Text) Write-Host "" ; Write-Host $Text -ForegroundColor Cyan }
function Invoke-AdbQ { param($Args, $Timeout=8) 
    $p = Start-Process -FilePath $Adb -ArgumentList $Args -PassThru -NoNewWindow -RedirectStandardOutput "$env:TEMP\adb_out.txt" -RedirectStandardError "$env:TEMP\adb_err.txt"
    $p.WaitForExit($Timeout * 1000) | Out-Null
    Get-Content "$env:TEMP\adb_out.txt" -ErrorAction SilentlyContinue
}

Clear-Host
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  FLOWDASHBOARD PRO - INICIANDO" -ForegroundColor Cyan  
Write-Host "============================================================" -ForegroundColor Cyan

# PASO 1: Cerrar procesos anteriores
Write-Step "[1/8] Cerrando sesiones anteriores..."
Get-Process -Name "python","electron","scrcpy" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
@(5000,8765,8766,8767) | ForEach-Object {
    Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 1
Write-Host "   OK" -ForegroundColor Green

# PASO 2: Iniciar ADB
Write-Step "[2/8] Iniciando ADB..."
& $Adb start-server 2>&1 | Out-Null
Start-Sleep -Seconds 2
Write-Host "   OK" -ForegroundColor Green

# PASO 3: Conectar dispositivos
Write-Step "[3/8] Conectando dispositivos..."
$jobs = @()
foreach ($d in $KnownDevices) {
    $jobs += Start-Job -ScriptBlock { param($adb,$d) & $adb connect $d 2>&1 | Out-Null } -ArgumentList $Adb,$d
}
$jobs | Wait-Job -Timeout 15 | Out-Null ; $jobs | Remove-Job -Force
$connected = & $Adb devices | Select-String 'device$' | ForEach-Object { ($_ -split '\s+')[0] }
Write-Host "   $($connected.Count)/$($KnownDevices.Count) dispositivos conectados" -ForegroundColor Green

# PASO 4: Iniciar Backend C#
Write-Step "[4/8] Iniciando servidor C# (puerto 5000)..."
$env:FLOWDASHBOARD_ADB = $Adb
$env:SCRCPY_PATH = Join-Path $AppDir "scrcpy-win64-v4.0\scrcpy.exe"
Start-Process -FilePath "dotnet" -ArgumentList "run" -WorkingDirectory (Join-Path $AppDir "FlowDashboard.Core") -WindowStyle Normal
for ($i=1; $i -le 30; $i++) {
    try { Invoke-RestMethod -Uri 'http://127.0.0.1:5000/api/health' -TimeoutSec 2 | Out-Null; break } catch {}
    Start-Sleep -Milliseconds 500
}
Write-Host "   OK - http://localhost:5000" -ForegroundColor Green

# PASO 5: Iniciar Python
Write-Step "[5/8] Iniciando servidor Python (puerto 8765)..."
$Python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $Python) { $Python = "C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe" }
Start-Process -FilePath $Python -ArgumentList "-u `"$(Join-Path $AppDir 'local_adb_server.py')`"" -WorkingDirectory $AppDir -WindowStyle Normal
for ($i=1; $i -le 20; $i++) {
    try { Invoke-RestMethod -Uri 'http://127.0.0.1:8765/health' -TimeoutSec 2 | Out-Null; break } catch {}
    Start-Sleep -Milliseconds 500
}
Write-Host "   OK - http://localhost:8765" -ForegroundColor Green

# PASO 6: Configurar accesibilidad y ADB reverse
Write-Step "[6/8] Configurando dispositivos (accesibilidad + reverse)..."
$jobs = @()
foreach ($d in $connected) {
    $jobs += Start-Job -ScriptBlock {
        param($adb,$d,$service,$activity)
        & $adb -s $d shell settings put secure enabled_accessibility_services $service 2>&1 | Out-Null
        & $adb -s $d shell settings put secure accessibility_enabled 1 2>&1 | Out-Null
        & $adb -s $d reverse tcp:8766 tcp:8766 2>&1 | Out-Null
        & $adb -s $d reverse tcp:5000 tcp:5000 2>&1 | Out-Null
        & $adb -s $d shell am start -n $activity --es host 127.0.0.1 --es serial $d --ei port 8766 --ez autoconnect true 2>&1 | Out-Null
    } -ArgumentList $Adb,$d,$Service,$Activity
}
$jobs | Wait-Job -Timeout 25 | Out-Null ; $jobs | Remove-Job -Force
Write-Host "   OK" -ForegroundColor Green

# PASO 7: Registrar mappings y esperar agentes
Write-Step "[7/8] Registrando mappings y esperando agentes..."
Start-Sleep -Seconds 10
foreach ($m in $Mappings) {
    try {
        $body = '{"androidId":"' + $m.a + '","adbSerial":"' + $m.s + '"}'
        Invoke-RestMethod -Uri 'http://localhost:5000/api/devices/register' -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 3 | Out-Null
    } catch {}
}
$agents = try { (Invoke-RestMethod -Uri 'http://localhost:8765/agents' -TimeoutSec 5).agents } catch { @() }
Write-Host "   Agentes conectados: $($agents.Count)/$($connected.Count)" -ForegroundColor Green

# Iniciar captura en todos
foreach ($a in $agents) {
    try {
        $body = '{"agentId":"' + $a.agentId + '","command":{"name":"capture_screen_start"}}'
        Invoke-RestMethod -Uri 'http://localhost:8765/agent/command' -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 5 | Out-Null
    } catch {}
}
Write-Host "   Captura iniciada en $($agents.Count) dispositivos" -ForegroundColor Green

# PASO 8: Abrir Electron
Write-Step "[8/8] Abriendo FlowDashboard..."
Start-Process -FilePath "cmd" -ArgumentList "/c npm start" -WorkingDirectory (Join-Path $AppDir "electron-app") -WindowStyle Hidden
Start-Sleep -Seconds 3

# Watchdog en background
Start-Process -FilePath "powershell" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$(Join-Path $AppDir 'watchdog_reverse.ps1')`"" -WindowStyle Hidden

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  FLOWDASHBOARD LISTO" -ForegroundColor Green
Write-Host "  Dispositivos: $($agents.Count) activos" -ForegroundColor Green
Write-Host "  NOTA: Acepta el dialogo de captura en los telefonos" -ForegroundColor Yellow
Write-Host "        si es la primera vez que instalas el APK." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
