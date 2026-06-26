# Despliegue limpio en bloques paralelos de 4 dispositivos.
# Mas rapido que secuencial (3-5 min vs 10-15 min) y mas estable que todos en paralelo
# (que satura el adb server).
#
# Para cada dispositivo:
#   1. Si ya tiene FlowAgent v1.0.0 con accessibility OK, SOLO reaplicar reverse + relanzar.
#   2. Si tiene version vieja o nada, hacer despliegue completo:
#      uninstall + install + permisos + accessibility + IME + reverse + launch.

param(
    [int]$BatchSize = 4
)

$adb = 'c:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$apk = 'c:\DASHBOARD\FlowDashboard\flow_agent_monolito\app\build\outputs\apk\app\release\agent-v1.0.0-arm64-v8a.apk'
$logfile = 'c:\DASHBOARD\FlowDashboard\.upload_tmp\despliegue_bloques.log'

if (-not (Test-Path $apk)) {
    Write-Host "ERROR: APK no encontrado: $apk" -ForegroundColor Red
    exit 1
}

# 1. Listar dispositivos conectados
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

Write-Host "===== Dispositivos detectados: $($devices.Count) =====" -ForegroundColor Cyan
$devices | ForEach-Object { Write-Host "  - $_" }
Write-Host "Tamano de bloque: $BatchSize`n" -ForegroundColor Cyan

$apkPath = $apk

# Bloque de codigo que se ejecuta por device en paralelo
$deployBlock = {
    param($serial, $adb, $apkPath)

    $log = @()
    $log += "[$serial] inicio: $(Get-Date -Format HH:mm:ss)"

    # 1. Detectar version actual
    $pkgInfo = & $adb -s $serial shell dumpsys package com.flowlogin.agent 2>&1
    $hasV1 = $pkgInfo -match 'versionName=1\.0\.0'

    if ($hasV1) {
        $log += "[$serial] ya en v1.0.0 - reaplicando reverse + launch"
        & $adb -s $serial reverse tcp:8766 tcp:8766 2>$null | Out-Null
        & $adb -s $serial reverse tcp:5000 tcp:5000 2>$null | Out-Null
        & $adb -s $serial shell am start -n com.flowlogin.agent/.MainActivity --es host 127.0.0.1 --es serial $serial --ei port 8766 --ez autoconnect true 2>$null | Out-Null
        return @{ Serial = $serial; Action = "reverse-only"; Log = $log }
    }

    # 2. Despliegue completo
    $log += "[$serial] despliegue completo"
    & $adb -s $serial shell am force-stop com.flowlogin.agent 2>$null | Out-Null

    # uninstall viejo
    $u1 = & $adb -s $serial uninstall com.flowlogin.agent 2>&1
    $log += "[$serial] uninstall: $($u1 -join ' ')"

    # uninstall AutoJs6 standalone si existe
    & $adb -s $serial uninstall org.autojs.autojs6 2>$null | Out-Null

    # install
    $i = & $adb -s $serial install -r $apkPath 2>&1
    $iStr = $i -join ' '
    $log += "[$serial] install: $iStr"
    if ($iStr -notmatch 'Success') {
        return @{ Serial = $serial; Action = "install-failed"; Log = $log; Error = $iStr }
    }

    # permisos
    & $adb -s $serial shell pm grant com.flowlogin.agent android.permission.WRITE_SECURE_SETTINGS 2>$null | Out-Null
    & $adb -s $serial shell pm grant com.flowlogin.agent android.permission.READ_EXTERNAL_STORAGE 2>$null | Out-Null

    # accessibility + IME + portrait
    & $adb -s $serial shell settings put secure enabled_accessibility_services com.flowlogin.agent/com.flowlogin.agent.FlowAccessibilityService 2>$null | Out-Null
    & $adb -s $serial shell settings put secure accessibility_enabled 1 2>$null | Out-Null
    & $adb -s $serial shell ime enable com.flowlogin.agent/.FlowKeyboardService 2>$null | Out-Null
    & $adb -s $serial shell ime set com.flowlogin.agent/.FlowKeyboardService 2>$null | Out-Null
    & $adb -s $serial shell settings put system accelerometer_rotation 0 2>$null | Out-Null
    & $adb -s $serial shell settings put system user_rotation 0 2>$null | Out-Null

    # reverse + launch
    & $adb -s $serial reverse tcp:8766 tcp:8766 2>$null | Out-Null
    & $adb -s $serial reverse tcp:5000 tcp:5000 2>$null | Out-Null
    & $adb -s $serial shell am start -n com.flowlogin.agent/.MainActivity --es host 127.0.0.1 --es serial $serial --ei port 8766 --ez autoconnect true 2>$null | Out-Null

    $log += "[$serial] OK: $(Get-Date -Format HH:mm:ss)"
    return @{ Serial = $serial; Action = "deployed"; Log = $log }
}

# 3. Procesar en bloques
$allResults = @()
$total = $devices.Count
$blockNum = 0

for ($i = 0; $i -lt $total; $i += $BatchSize) {
    $blockNum++
    $block = $devices[$i..([Math]::Min($i + $BatchSize - 1, $total - 1))]
    Write-Host "===== Bloque $blockNum/$([Math]::Ceiling($total / $BatchSize)) ($($block.Count) devices) =====" -ForegroundColor Yellow

    $jobs = @()
    foreach ($serial in $block) {
        Write-Host "  arrancando $serial..."
        $jobs += Start-Job -ScriptBlock $deployBlock -ArgumentList $serial, $adb, $apkPath
    }

    Write-Host "  esperando bloque $blockNum (timeout 90s)..."
    $null = Wait-Job -Job $jobs -Timeout 90

    foreach ($job in $jobs) {
        if ($job.State -eq 'Running') {
            Stop-Job -Job $job
            Write-Host "  TIMEOUT en job $($job.Id)" -ForegroundColor Red
        }
        $r = Receive-Job -Job $job -ErrorAction SilentlyContinue
        if ($r) {
            $allResults += $r
            $color = switch ($r.Action) {
                'deployed' { 'Green' }
                'reverse-only' { 'Cyan' }
                'install-failed' { 'Red' }
                default { 'Yellow' }
            }
            Write-Host "  [$($r.Serial)] $($r.Action)" -ForegroundColor $color
        }
        Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    }
    Write-Host ""
}

# 4. Esperar 8s para que los agentes conecten
Write-Host "===== Esperando 8s para verificacion final =====" -ForegroundColor Yellow
Start-Sleep -Seconds 8

# 5. Verificar /agents
Write-Host "`n===== Verificacion /agents =====" -ForegroundColor Yellow
try {
    $resp = Invoke-RestMethod 'http://127.0.0.1:8765/agents' -TimeoutSec 5
    $connectedSerials = @($resp.agents | ForEach-Object { $_.serial })
    Write-Host "Agentes conectados al socket: $($connectedSerials.Count) / $total" -ForegroundColor Green
    foreach ($r in $allResults) {
        $isConn = $connectedSerials -contains $r.Serial
        $mark = if ($isConn) { 'OK' } else { 'X' }
        $color = if ($isConn) { 'Green' } else { 'Red' }
        Write-Host "  [$mark] $($r.Serial) - $($r.Action)" -ForegroundColor $color
    }
} catch {
    Write-Host "X No se pudo consultar /agents: $_" -ForegroundColor Red
}

# 6. Resumen acciones
$deployed = ($allResults | Where-Object { $_.Action -eq 'deployed' }).Count
$reverseOnly = ($allResults | Where-Object { $_.Action -eq 'reverse-only' }).Count
$failed = ($allResults | Where-Object { $_.Action -eq 'install-failed' }).Count

Write-Host "`n===== RESUMEN =====" -ForegroundColor Cyan
Write-Host "  Total: $total"
Write-Host "  Desplegados (clean install): $deployed" -ForegroundColor Green
Write-Host "  Solo reverse (ya en v1.0.0): $reverseOnly" -ForegroundColor Cyan
Write-Host "  Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { 'Red' } else { 'Gray' })

if ($failed -gt 0) {
    Write-Host "`n  Devices con error:" -ForegroundColor Red
    $allResults | Where-Object { $_.Action -eq 'install-failed' } | ForEach-Object {
        Write-Host "    - $($_.Serial): $($_.Error)" -ForegroundColor Red
    }
}
