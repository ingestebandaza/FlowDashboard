# fix_accessibility_y_captura.ps1
# Reactiva la accesibilidad en todos los devices y luego acepta el dialogo
# de MediaProjection usando resource-id del sistema (robusto para cualquier Android).
#
# El problema: despues de reinstalar el APK, Android puede desactivar el servicio
# de accesibilidad. Hay que: 1) forzar stop, 2) reactivar accessibility, 3) lanzar
# la app, 4) esperar que el servicio arranque, 5) aceptar el dialogo de captura.

param([int]$BatchSize = 4)

$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$pkg = 'com.flowlogin.agent'
$activity = 'com.flowlogin.agent/.MainActivity'
$accessSvc = 'com.flowlogin.agent/com.flowlogin.agent.FlowAccessibilityService'

$devOut = & $adb devices 2>&1
$devices = @()
foreach ($line in $devOut) {
    if ($line -match '^([\w\.\:]+)\s+device\s*$') { $devices += $matches[1] }
}
if ($devices.Count -eq 0) { Write-Host "Sin devices." -ForegroundColor Red; exit 1 }
Write-Host "Devices: $($devices.Count)" -ForegroundColor Cyan

$jobBlock = {
    param($serial, $adb, $pkg, $activity, $accessSvc)
    $log = @()

    function Run { param($a) & $adb @a 2>&1 | Out-Null }
    function RunOut { param($a) (& $adb @a 2>&1) -join "`n" }

    # 1. Force-stop
    Run @("-s", $serial, "shell", "am", "force-stop", $pkg)
    Start-Sleep -Milliseconds 300

    # 2. Reactivar accesibilidad (puede haberse desactivado tras reinstall)
    Run @("-s", $serial, "shell", "settings", "put", "secure", "enabled_accessibility_services", $accessSvc)
    Run @("-s", $serial, "shell", "settings", "put", "secure", "accessibility_enabled", "1")
    $log += "[$serial] accesibilidad reactivada"

    # 3. Lanzar app con request_capture=true
    Run @("-s", $serial, "shell", "am", "start", "-n", $activity,
          "--es", "host", "127.0.0.1", "--es", "serial", $serial,
          "--ei", "port", "8766", "--ez", "autoconnect", "true",
          "--ez", "request_capture", "true")
    $log += "[$serial] app lanzada con request_capture=true"

    # 4. Esperar a que aparezca el dialogo (el servicio de accesibilidad tarda ~3-4s en arrancar)
    Start-Sleep -Seconds 5

    # 5. Dump UI y buscar elementos por resource-id del sistema Android
    #    Estos resource-id son ESTABLES en todos los fabricantes y versiones:
    #      com.android.systemui:id/remember -> CheckBox "Don't show again"
    #      android:id/button1              -> Boton positivo ("Start now")
    $dumpRemote = "/sdcard/flowdashboard_mp.xml"
    Run @("-s", $serial, "shell", "uiautomator", "dump", $dumpRemote)
    Start-Sleep -Milliseconds 600
    $xml = RunOut @("-s", $serial, "shell", "cat", $dumpRemote)
    Run @("-s", $serial, "shell", "rm", "-f", $dumpRemote)

    function Get-Center { param([string]$xml, [string]$rid)
        $pat = "resource-id=`"$([regex]::Escape($rid))`"[^>]*bounds=`"(\[[^\]]+\]\[[^\]]+\])`""
        if ($xml -match $pat) {
            $b = $matches[1]
            if ($b -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') {
                return @{ X = [int](([int]$matches[1]+[int]$matches[3])/2); Y = [int](([int]$matches[2]+[int]$matches[4])/2) }
            }
        }
        return $null
    }

    $cbCoord = Get-Center -xml $xml -rid "com.android.systemui:id/remember"
    if (-not $cbCoord) {
        # Fallback: cualquier CheckBox en el dialogo
        if ($xml -match 'checkable="true"[^>]*bounds="(\[[^\]]+\]\[[^\]]+\])"') {
            $b = $matches[1]
            if ($b -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') {
                $cbCoord = @{ X = [int](([int]$matches[1]+[int]$matches[3])/2); Y = [int](([int]$matches[2]+[int]$matches[4])/2) }
            }
        }
    }
    if (-not $cbCoord) { $cbCoord = @{ X = 540; Y = 1520 } }

    $snCoord = Get-Center -xml $xml -rid "android:id/button1"
    if (-not $snCoord) { $snCoord = @{ X = 751; Y = 1651 } }

    $log += "[$serial] checkbox: $($cbCoord.X),$($cbCoord.Y) | start: $($snCoord.X),$($snCoord.Y)"

    # 6. TAP 1: marcar "Don't show again"
    Run @("-s", $serial, "shell", "input", "tap", $cbCoord.X, $cbCoord.Y)
    Start-Sleep -Milliseconds 700

    # 7. TAP 2: "Start now"
    Run @("-s", $serial, "shell", "input", "tap", $snCoord.X, $snCoord.Y)
    Start-Sleep -Milliseconds 800

    $log += "[$serial] dialogo aceptado"
    return @{ Serial = $serial; Status = "ok"; Log = $log }
}

$allResults = @()
$total = $devices.Count
$blockNum = 0

for ($i = 0; $i -lt $total; $i += $BatchSize) {
    $blockNum++
    $block = $devices[$i..([Math]::Min($i + $BatchSize - 1, $total - 1))]
    Write-Host "`n=== Bloque $blockNum/$([Math]::Ceiling($total / $BatchSize)) ($($block.Count) devices) ===" -ForegroundColor Yellow

    $jobs = @()
    foreach ($s in $block) {
        Write-Host "  $s..."
        $jobs += Start-Job -ScriptBlock $jobBlock -ArgumentList $s, $adb, $pkg, $activity, $accessSvc
    }

    $null = Wait-Job -Job $jobs -Timeout 50
    foreach ($j in $jobs) {
        if ($j.State -eq 'Running') { Stop-Job -Job $j }
        $r = Receive-Job -Job $j -ErrorAction SilentlyContinue
        if ($r) {
            $allResults += $r
            $color = if ($r.Status -eq 'ok') { 'Green' } else { 'Red' }
            Write-Host "  [$($r.Serial)] $($r.Status)" -ForegroundColor $color
        }
        Remove-Job -Job $j -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "`n=== Esperando 6s para que la captura arranque ===" -ForegroundColor Cyan
Start-Sleep -Seconds 6

# Verificar via /agents
Write-Host "`n=== Estado final ===" -ForegroundColor Cyan
try {
    $agents = Invoke-RestMethod -Uri "http://127.0.0.1:8765/agents" -TimeoutSec 5
    $total_agents = $agents.agents.Count
    $acc_ok = ($agents.agents | Where-Object { $_.accessibility }).Count
    $cap_ok = ($agents.agents | Where-Object { $_.meta -and $_.meta.capture }).Count
    Write-Host "Agentes conectados: $total_agents/$total" -ForegroundColor Cyan
    Write-Host "Con accesibilidad:  $acc_ok/$total" -ForegroundColor $(if ($acc_ok -eq $total) { 'Green' } else { 'Yellow' })
    Write-Host "Con captura activa: $cap_ok/$total" -ForegroundColor $(if ($cap_ok -eq $total) { 'Green' } else { 'Yellow' })
    foreach ($a in $agents.agents) {
        $acc = if ($a.accessibility) { 'acc:OK' } else { 'acc:X' }
        $cap = if ($a.meta -and $a.meta.capture) { 'cap:OK' } else { 'cap:X' }
        $color = if ($a.accessibility) { 'Green' } else { 'Yellow' }
        Write-Host "  [$($a.serial)] $acc $cap" -ForegroundColor $color
    }
} catch {
    Write-Host "No se pudo verificar /agents: $_" -ForegroundColor Yellow
}

Write-Host "`n=== LOG ===" -ForegroundColor DarkGray
foreach ($r in $allResults) {
    foreach ($line in $r.Log) { Write-Host $line -ForegroundColor DarkGray }
}
