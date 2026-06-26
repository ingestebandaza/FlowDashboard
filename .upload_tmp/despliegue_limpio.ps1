# Despliegue limpio del FlowAgent monolito v1.0.0 a todos los dispositivos.
# Para cada dispositivo:
#   1. Desinstala FlowAgent viejo (com.flowlogin.agent) y AutoJs6 standalone (org.autojs.autojs6)
#      para evitar conflictos de permisos PLUGIN.
#   2. Instala el APK nuevo desde release.
#   3. Concede permisos: WRITE_SECURE_SETTINGS, READ_EXTERNAL_STORAGE.
#   4. Activa accessibility service.
#   5. Habilita y selecciona FlowKeyboard como IME default.
#   6. Aplica adb reverse tcp:8766 + tcp:5000.
#   7. Lanza MainActivity con --es host 127.0.0.1 --ez autoconnect true.
#   8. Espera y verifica que el agente conecte al socket.

$adb = 'c:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$apk = 'c:\DASHBOARD\FlowDashboard\flow_agent_monolito\app\build\outputs\apk\app\release\agent-v1.0.0-arm64-v8a.apk'

if (-not (Test-Path $apk)) {
    Write-Host "ERROR: APK no encontrado en $apk" -ForegroundColor Red
    Write-Host "Build aun no terminado o fallo." -ForegroundColor Red
    exit 1
}

$apkSize = [math]::Round((Get-Item $apk).Length / 1MB, 1)
$apkAge = ((Get-Date) - (Get-Item $apk).LastWriteTime).TotalMinutes
Write-Host "APK: $apk ($apkSize MB, hace $([int]$apkAge) min)" -ForegroundColor Cyan

# 1. Listar dispositivos
$devicesOutput = & $adb devices 2>&1
$devices = @()
foreach ($line in $devicesOutput) {
    if ($line -match '^([\w\.\:]+)\s+device\s*$') {
        $devices += $matches[1]
    }
}

if ($devices.Count -eq 0) {
    Write-Host "ERROR: No hay dispositivos conectados" -ForegroundColor Red
    exit 1
}

Write-Host "`nDispositivos detectados: $($devices.Count)" -ForegroundColor Cyan
$devices | ForEach-Object { Write-Host "  - $_" }

$results = @()

foreach ($serial in $devices) {
    Write-Host "`n========================================" -ForegroundColor Yellow
    Write-Host "  $serial" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow

    $report = [PSCustomObject]@{
        Serial = $serial
        Steps = @()
        Errors = @()
        Connected = $false
    }

    # 1. Detener FlowAgent corriendo
    Write-Host "[1/8] force-stop FlowAgent..."
    & $adb -s $serial shell am force-stop com.flowlogin.agent 2>&1 | Out-Null
    $report.Steps += "force-stop"

    # 2. Desinstalar viejo FlowAgent
    Write-Host "[2/8] uninstall FlowAgent viejo..."
    $u1 = & $adb -s $serial uninstall com.flowlogin.agent 2>&1
    if ($u1 -match 'Success') {
        $report.Steps += "uninstall flowagent OK"
    } else {
        $report.Steps += "uninstall flowagent: $u1"
    }

    # 3. Desinstalar AutoJs6 standalone si existe (conflicto PLUGIN)
    Write-Host "[3/8] uninstall AutoJs6 standalone..."
    $u2 = & $adb -s $serial uninstall org.autojs.autojs6 2>&1
    $report.Steps += "uninstall autojs6: $($u2 -join ' ')"

    # 4. Instalar APK nuevo
    Write-Host "[4/8] install APK nuevo..."
    $i = & $adb -s $serial install -r $apk 2>&1
    if ($i -match 'Success') {
        $report.Steps += "install OK"
    } else {
        $report.Errors += "install fallo: $($i -join ' ')"
        Write-Host "  ERROR: $i" -ForegroundColor Red
        $results += $report
        continue
    }

    # 5. Permisos
    Write-Host "[5/8] grant permissions..."
    & $adb -s $serial shell pm grant com.flowlogin.agent android.permission.WRITE_SECURE_SETTINGS 2>&1 | Out-Null
    & $adb -s $serial shell pm grant com.flowlogin.agent android.permission.READ_EXTERNAL_STORAGE 2>&1 | Out-Null
    $report.Steps += "permissions granted"

    # 6. Accessibility + IME
    Write-Host "[6/8] accessibility + IME default..."
    & $adb -s $serial shell settings put secure enabled_accessibility_services com.flowlogin.agent/com.flowlogin.agent.FlowAccessibilityService 2>&1 | Out-Null
    & $adb -s $serial shell settings put secure accessibility_enabled 1 2>&1 | Out-Null
    & $adb -s $serial shell ime enable com.flowlogin.agent/.FlowKeyboardService 2>&1 | Out-Null
    & $adb -s $serial shell ime set com.flowlogin.agent/.FlowKeyboardService 2>&1 | Out-Null
    & $adb -s $serial shell settings put system accelerometer_rotation 0 2>&1 | Out-Null
    & $adb -s $serial shell settings put system user_rotation 0 2>&1 | Out-Null
    $report.Steps += "accessibility + IME + portrait"

    # 7. Reverse + launch
    Write-Host "[7/8] reverse + launch MainActivity..."
    & $adb -s $serial reverse tcp:8766 tcp:8766 2>&1 | Out-Null
    & $adb -s $serial reverse tcp:5000 tcp:5000 2>&1 | Out-Null
    & $adb -s $serial shell am start -n com.flowlogin.agent/.MainActivity --es host 127.0.0.1 --es serial $serial --ei port 8766 --ez autoconnect true 2>&1 | Out-Null
    $report.Steps += "launched"

    # 8. Esperar a que conecte y verificar
    Write-Host "[8/8] verificando conexion..."
    Start-Sleep -Seconds 6
    try {
        $resp = Invoke-RestMethod -Uri 'http://127.0.0.1:8765/agents' -TimeoutSec 5
        $myAgent = $resp.agents | Where-Object { $_.serial -eq $serial }
        if ($myAgent) {
            $report.Connected = $true
            $report.Steps += "agent v$($myAgent.agentVersion) connected"
            Write-Host "  OK conectado: v$($myAgent.agentVersion), accessibility=$($myAgent.accessibility), keyboard=$($myAgent.keyboardActive)" -ForegroundColor Green
        } else {
            $report.Errors += "agent no aparece en /agents"
            Write-Host "  WARN agente no conectado aun" -ForegroundColor Yellow
        }
    } catch {
        $report.Errors += "no se pudo consultar /agents: $_"
        Write-Host "  X no se pudo consultar /agents" -ForegroundColor Red
    }

    $results += $report
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  RESUMEN" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
$ok = ($results | Where-Object { $_.Connected }).Count
$total = $results.Count
Write-Host "$ok / $total dispositivos conectados al socket" -ForegroundColor $(if ($ok -eq $total) { 'Green' } else { 'Yellow' })

foreach ($r in $results) {
    $color = if ($r.Connected) { 'Green' } else { 'Yellow' }
    $status = if ($r.Connected) { 'OK' } else { 'incompleto' }
    Write-Host "`n[$($r.Serial)] $status" -ForegroundColor $color
    if ($r.Errors.Count -gt 0) {
        Write-Host "  ERRORES:" -ForegroundColor Red
        $r.Errors | ForEach-Object { Write-Host "    - $_" }
    }
}
