# setup_flowagent_completo.ps1
# Desinstala e instala FlowAgent en todos los devices, de 4 en 4.
# Activa accesibilidad, IME, overlay y captura de pantalla automaticamente.
# Idempotente: si ya tiene v1.0.0 con todo activo, solo reaplicar reverse.
#
# Uso: .\setup_flowagent_completo.ps1 [-BatchSize 4] [-ForceReinstall]

param(
    [int]$BatchSize = 4,
    [switch]$ForceReinstall
)

$ErrorActionPreference = "Continue"
$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$apk = 'C:\DASHBOARD\FlowDashboard\flow_agent_monolito\app\build\outputs\apk\app\release\agent-v1.0.0-universal.apk'
$pkg = 'com.flowlogin.agent'
$activity = 'com.flowlogin.agent/.MainActivity'
$accessSvc = 'com.flowlogin.agent/org.autojs.autojs.core.accessibility.AccessibilityServiceUsher'
$imeSvc = 'com.flowlogin.agent/.FlowKeyboardService'
$expectedVersion = '1.0.0'

if (-not (Test-Path $apk)) {
    Write-Host "ERROR: APK no encontrado: $apk" -ForegroundColor Red
    exit 1
}

# Listar devices
$devOut = & $adb devices 2>&1
$devices = @()
foreach ($line in $devOut) {
    if ($line -match '^([\w\.\:]+)\s+device\s*$') { $devices += $matches[1] }
}
if ($devices.Count -eq 0) {
    Write-Host "ERROR: No hay dispositivos conectados." -ForegroundColor Red
    exit 1
}
Write-Host "Dispositivos: $($devices.Count)" -ForegroundColor Cyan
$devices | ForEach-Object { Write-Host "  - $_" }
Write-Host ""

$deployBlock = {
    param($serial, $adb, $apk, $pkg, $activity, $accessSvc, $imeSvc, $expectedVersion, $forceReinstall)

    $log = @()
    $result = @{ Serial = $serial; Action = "unknown"; Log = $log; Error = "" }

    function Run { param($args_) & $adb @args_ 2>&1 | Out-Null }
    function RunOut { param($args_) (& $adb @args_ 2>&1) -join "`n" }

    # 1. Verificar version instalada
    $pkgInfo = RunOut @("-s", $serial, "shell", "dumpsys", "package", $pkg)
    $hasCorrectVersion = $pkgInfo -match "versionName=$expectedVersion"

    # 2. Verificar si está instalado (cualquier versión)
    $isInstalled = $pkgInfo -match "versionName="

    $needsInstall = -not $isInstalled -or $forceReinstall

    if (-not $needsInstall) {
        # Ya tiene FlowAgent. Solo reaplicar reverse y abortar silenciosamente
        # para no saltar la pantalla al frente ni interrumpir al usuario.
        $log += "[$serial] ya tiene FlowAgent instalado - solo reverse"
        Run @("-s", $serial, "reverse", "tcp:8766", "tcp:8766")
        Run @("-s", $serial, "reverse", "tcp:5000", "tcp:5000")
        Run @("-s", $serial, "reverse", "tcp:8765", "tcp:8765")
        $result.Action = "reverse-only"
        $result.Log = $log
        return $result
    }

    # Despliegue completo (no estaba instalado)
    $log += "[$serial] despliegue completo (install=$needsInstall)"

    # 5. Forzar stop
    Run @("-s", $serial, "shell", "am", "force-stop", $pkg)
    Start-Sleep -Milliseconds 300

    if ($needsInstall) {
        # 6. Desinstalar version vieja
        $u = RunOut @("-s", $serial, "uninstall", $pkg)
        $log += "[$serial] uninstall: $u"
        # Desinstalar AutoJs6 standalone si existe
        RunOut @("-s", $serial, "uninstall", "org.autojs.autojs6") | Out-Null

        # 7. Instalar APK con -r (replace) y -d (allow downgrade) para maxima compatibilidad
        $i = RunOut @("-s", $serial, "install", "-r", "-d", $apk)
        $log += "[$serial] install: $i"
        if ($i -notmatch "Success") {
            $result.Action = "install-failed"
            $result.Error = $i
            $result.Log = $log
            return $result
        }
    }

    # 8. Permisos basicos
    Run @("-s", $serial, "shell", "pm", "grant", $pkg, "android.permission.WRITE_SECURE_SETTINGS")
    Run @("-s", $serial, "shell", "pm", "grant", $pkg, "android.permission.READ_EXTERNAL_STORAGE")
    Run @("-s", $serial, "shell", "pm", "grant", $pkg, "android.permission.WRITE_EXTERNAL_STORAGE")
    $log += "[$serial] permisos basicos OK"

    # 9. Overlay (SYSTEM_ALERT_WINDOW) via appops
    Run @("-s", $serial, "shell", "appops", "set", $pkg, "SYSTEM_ALERT_WINDOW", "allow")
    $log += "[$serial] overlay OK"

    # 10. Accesibilidad
    Run @("-s", $serial, "shell", "settings", "put", "secure", "enabled_accessibility_services", $accessSvc)
    Run @("-s", $serial, "shell", "settings", "put", "secure", "accessibility_enabled", "1")
    $log += "[$serial] accesibilidad OK"

    # 11. IME FlowKeyboard
    Run @("-s", $serial, "shell", "ime", "enable", $imeSvc)
    Run @("-s", $serial, "shell", "ime", "set", $imeSvc)
    $log += "[$serial] IME OK"

    # 12. Orientacion portrait forzada
    Run @("-s", $serial, "shell", "settings", "put", "system", "accelerometer_rotation", "0")
    Run @("-s", $serial, "shell", "settings", "put", "system", "user_rotation", "0")
    $log += "[$serial] portrait OK"

    # 13. ADB reverse (8766 FlowAgent socket, 5000 backend C#, 8765 Python)
    Run @("-s", $serial, "reverse", "tcp:8766", "tcp:8766")
    Run @("-s", $serial, "reverse", "tcp:5000", "tcp:5000")
    Run @("-s", $serial, "reverse", "tcp:8765", "tcp:8765")
    $log += "[$serial] reverse OK"

    # 14. Lanzar MainActivity con request_capture=true para disparar el dialogo
    Run @("-s", $serial, "shell", "am", "start", "-n", $activity,
          "--es", "host", "127.0.0.1", "--es", "serial", $serial,
          "--ei", "port", "8766", "--ez", "autoconnect", "true",
          "--ez", "request_capture", "true")
    $log += "[$serial] launch con request_capture=true OK"

    # 15. Esperar 5s a que aparezca el dialogo de MediaProjection
    #     (el servicio de accesibilidad tarda ~3-4s en arrancar tras la instalacion)
    Start-Sleep -Seconds 5

    # 16. Aceptar dialogo via uiautomator dump usando resource-id del sistema Android.
    #     SOLUCION ROBUSTA: resource-id estables en TODOS los fabricantes y versiones:
    #       com.android.systemui:id/remember -> CheckBox "Don't show again"
    #       android:id/button1              -> Boton positivo ("Start now")
    $dumpPath = "/sdcard/flowdashboard_mp.xml"
    & $adb -s $serial shell uiautomator dump $dumpPath 2>$null | Out-Null
    Start-Sleep -Milliseconds 600
    $uiXml = (& $adb -s $serial shell cat $dumpPath 2>$null) -join "`n"
    & $adb -s $serial shell rm -f $dumpPath 2>$null | Out-Null

    function Get-NodeCenter { param([string]$xml, [string]$rid)
        $pat = "resource-id=`"$([regex]::Escape($rid))`"[^>]*bounds=`"(\[[^\]]+\]\[[^\]]+\])`""
        if ($xml -match $pat) {
            $b = $matches[1]
            if ($b -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') {
                return @{ X = [int](([int]$matches[1]+[int]$matches[3])/2); Y = [int](([int]$matches[2]+[int]$matches[4])/2) }
            }
        }
        return $null
    }

    # Buscar checkbox por resource-id
    $cbCoord = Get-NodeCenter -xml $uiXml -rid "com.android.systemui:id/remember"
    if (-not $cbCoord) {
        if ($uiXml -match 'checkable="true"[^>]*bounds="(\[[^\]]+\]\[[^\]]+\])"') {
            $b = $matches[1]
            if ($b -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') {
                $cbCoord = @{ X = [int](([int]$matches[1]+[int]$matches[3])/2); Y = [int](([int]$matches[2]+[int]$matches[4])/2) }
            }
        }
    }
    if (-not $cbCoord) { $cbCoord = @{ X = 540; Y = 1520 } }  # fallback 1080x1920

    # Buscar boton positivo por resource-id universal
    $snCoord = Get-NodeCenter -xml $uiXml -rid "android:id/button1"
    if (-not $snCoord) { $snCoord = @{ X = 751; Y = 1651 } }  # fallback 1080x1920

    # TAP 1: marcar checkbox "Don't show again"
    & $adb -s $serial shell input tap $cbCoord.X $cbCoord.Y 2>$null | Out-Null
    Start-Sleep -Milliseconds 700
    # TAP 2: boton "Start now"
    & $adb -s $serial shell input tap $snCoord.X $snCoord.Y 2>$null | Out-Null
    Start-Sleep -Milliseconds 800
    $log += "[$serial] dialogo aceptado: checkbox($($cbCoord.X),$($cbCoord.Y)) + start($($snCoord.X),$($snCoord.Y))"

    # 17. Esperar 3s y verificar si el agente conecto al socket
    Start-Sleep -Seconds 3
    try {
        $agents = Invoke-RestMethod -Uri "http://127.0.0.1:8765/agents" -TimeoutSec 3 -ErrorAction Stop
        $agentConnected = $agents.agents | Where-Object { $_.serial -eq $serial }
        if ($agentConnected) {
            $log += "[$serial] agente conectado al socket (accessibility=$($agentConnected.accessibility))"
        } else {
            $log += "[$serial] agente aun no conectado (auto-reconnect loop lo hara)"
        }
    } catch {
        $log += "[$serial] no se pudo verificar agente: $_"
    }

    # 14. Lanzar MainActivity con request_capture=true para disparar el dialogo
    Run @("-s", $serial, "shell", "am", "start", "-n", $activity,
          "--es", "host", "127.0.0.1", "--es", "serial", $serial,
          "--ei", "port", "8766", "--ez", "autoconnect", "true",
          "--ez", "request_capture", "true")
    $log += "[$serial] launch con request_capture=true OK"

    # 15. Esperar 4s a que aparezca el dialogo de MediaProjection
    Start-Sleep -Seconds 4

    # 16. Aceptar dialogo via uiautomator dump usando resource-id del sistema Android.
    #     Estos resource-id son ESTABLES en todos los fabricantes y versiones:
    #       com.android.systemui:id/remember -> CheckBox "Don't show again"
    #       android:id/button1              -> Boton positivo ("Start now")
    $dumpPath = "/sdcard/flowdashboard_mp.xml"
    & $adb -s $serial shell uiautomator dump $dumpPath 2>$null | Out-Null
    Start-Sleep -Milliseconds 600
    $uiXml = (& $adb -s $serial shell cat $dumpPath 2>$null) -join "`n"
    & $adb -s $serial shell rm -f $dumpPath 2>$null | Out-Null

    function Get-NodeCenter { param([string]$xml, [string]$rid)
        $pat = "resource-id=`"$([regex]::Escape($rid))`"[^>]*bounds=`"(\[[^\]]+\]\[[^\]]+\])`""
        if ($xml -match $pat) {
            $b = $matches[1]
            if ($b -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') {
                return @{ X = [int](([int]$matches[1]+[int]$matches[3])/2); Y = [int](([int]$matches[2]+[int]$matches[4])/2) }
            }
        }
        return $null
    }

    # Buscar checkbox por resource-id
    $cbCoord = Get-NodeCenter -xml $uiXml -rid "com.android.systemui:id/remember"
    if (-not $cbCoord) {
        # Fallback: cualquier elemento checkable=true en el dialogo
        if ($uiXml -match 'checkable="true"[^>]*bounds="(\[[^\]]+\]\[[^\]]+\])"') {
            $b = $matches[1]
            if ($b -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') {
                $cbCoord = @{ X = [int](([int]$matches[1]+[int]$matches[3])/2); Y = [int](([int]$matches[2]+[int]$matches[4])/2) }
            }
        }
    }
    if (-not $cbCoord) { $cbCoord = @{ X = 540; Y = 1520 } }  # fallback 1080x1920

    # Buscar boton positivo por resource-id universal
    $snCoord = Get-NodeCenter -xml $uiXml -rid "android:id/button1"
    if (-not $snCoord) { $snCoord = @{ X = 751; Y = 1651 } }  # fallback 1080x1920

    # TAP 1: marcar checkbox "Don't show again"
    & $adb -s $serial shell input tap $cbCoord.X $cbCoord.Y 2>$null | Out-Null
    Start-Sleep -Milliseconds 700
    # TAP 2: boton "Start now"
    & $adb -s $serial shell input tap $snCoord.X $snCoord.Y 2>$null | Out-Null
    Start-Sleep -Milliseconds 800
    $log += "[$serial] dialogo aceptado: checkbox($($cbCoord.X),$($cbCoord.Y)) + start($($snCoord.X),$($snCoord.Y))"

    # 17. Esperar 3s y verificar si el agente conecto al socket
    Start-Sleep -Seconds 3
    try {
        $agents = Invoke-RestMethod -Uri "http://127.0.0.1:8765/agents" -TimeoutSec 3 -ErrorAction Stop
        $agentConnected = $agents.agents | Where-Object { $_.serial -eq $serial }
        if ($agentConnected) {
            $log += "[$serial] agente conectado al socket"
            if ($agentConnected.meta -and $agentConnected.meta.accessibility) {
                $body = @{ serial = $serial; command = @{ name = "capture_screen_start" }; type = "command" } | ConvertTo-Json -Compress
                Invoke-RestMethod -Uri "http://127.0.0.1:8765/agent/command" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 5 -ErrorAction SilentlyContinue | Out-Null
                $log += "[$serial] capture_screen_start enviado"
            }
        } else {
            $log += "[$serial] agente aun no conectado (auto-reconnect loop lo hara)"
        }
    } catch {
        $log += "[$serial] no se pudo verificar agente: $_"
    }

    $result.Action = "deployed"
    $result.Log = $log
    return $result
}

# Procesar en bloques
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
        $jobs += Start-Job -ScriptBlock $deployBlock `
            -ArgumentList $serial, $adb, $apk, $pkg, $activity, $accessSvc, $imeSvc, $expectedVersion, $ForceReinstall.IsPresent
    }

    Write-Host "  esperando bloque $blockNum (timeout 120s)..."
    $null = Wait-Job -Job $jobs -Timeout 120

    foreach ($job in $jobs) {
        if ($job.State -eq 'Running') { Stop-Job -Job $job }
        $r = Receive-Job -Job $job -ErrorAction SilentlyContinue
        if ($r) {
            $allResults += $r
            $color = switch ($r.Action) {
                'deployed'      { 'Green' }
                'reverse-only'  { 'Cyan' }
                'install-failed'{ 'Red' }
                default         { 'Yellow' }
            }
            Write-Host "  [$($r.Serial)] $($r.Action)" -ForegroundColor $color
            if ($r.Error) { Write-Host "    ERROR: $($r.Error)" -ForegroundColor Red }
        }
        Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    }
    Write-Host ""
}

# Resumen
$deployed    = ($allResults | Where-Object { $_.Action -eq 'deployed' }).Count
$reverseOnly = ($allResults | Where-Object { $_.Action -eq 'reverse-only' }).Count
$failed      = ($allResults | Where-Object { $_.Action -eq 'install-failed' }).Count

Write-Host "===== RESUMEN =====" -ForegroundColor Cyan
Write-Host "  Total:          $total"
Write-Host "  Desplegados:    $deployed" -ForegroundColor Green
Write-Host "  Solo reverse:   $reverseOnly" -ForegroundColor Cyan
Write-Host "  Fallidos:       $failed" -ForegroundColor $(if ($failed -gt 0) { 'Red' } else { 'Gray' })

if ($failed -gt 0) {
    Write-Host "`n  Devices con error:" -ForegroundColor Red
    $allResults | Where-Object { $_.Action -eq 'install-failed' } | ForEach-Object {
        Write-Host "    - $($_.Serial): $($_.Error)" -ForegroundColor Red
    }
}

# Log detallado
Write-Host "`n===== LOG DETALLADO =====" -ForegroundColor DarkGray
foreach ($r in $allResults) {
    foreach ($line in $r.Log) { Write-Host $line -ForegroundColor DarkGray }
}
