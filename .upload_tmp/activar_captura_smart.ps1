# activar_captura_smart.ps1
#
# Acepta el dialogo de MediaProjection en todos los devices conectados.
#
# SOLUCION ROBUSTA - funciona en cualquier Android/OEM/resolucion:
#   - Usa resource-id del sistema Android (estables en todos los fabricantes):
#       * com.android.systemui:id/remember  -> CheckBox "Don't show again"
#       * android:id/button1               -> Boton positivo ("Start now")
#   - Calcula el centro del bounds de cada elemento para el tap
#   - Fallback a coordenadas tipicas si uiautomator falla
#   - Verifica que la captura quedo activa via /agents
#
# Orden correcto:
#   1. Tap en CheckBox "Don't show again" (marcarlo)
#   2. Tap en boton "Start now"
#
# Uso: .\activar_captura_smart.ps1 [-BatchSize 4]

param([int]$BatchSize = 4)

$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'

# Fallback para 1080x1920 (Samsung S8/S9) si uiautomator falla
# Checkbox "Don't show again": bounds [70,1478][1010,1562] -> centro 540,1520
# Boton "Start now":           bounds [514,1604][989,1699] -> centro 751,1651
$FB_CHECKBOX_X = 540; $FB_CHECKBOX_Y = 1520
$FB_STARTNOW_X = 751; $FB_STARTNOW_Y = 1651

$devOut = & $adb devices 2>&1
$devices = @()
foreach ($line in $devOut) {
    if ($line -match '^([\w\.\:]+)\s+device\s*$') { $devices += $matches[1] }
}
if ($devices.Count -eq 0) {
    Write-Host "Sin devices conectados." -ForegroundColor Red
    exit 1
}
Write-Host "Devices: $($devices.Count)" -ForegroundColor Cyan

$jobBlock = {
    param($serial, $adb, $fbCbX, $fbCbY, $fbSnX, $fbSnY)

    $log = @()
    $status = "error"

    function RunAdb { param($a) & $adb @a 2>&1 }

    # Funcion: extrae el centro de un bounds "[x1,y1][x2,y2]"
    function Get-Center { param([string]$b)
        if ($b -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') {
            return @{
                X = [int](([int]$matches[1] + [int]$matches[3]) / 2)
                Y = [int](([int]$matches[2] + [int]$matches[4]) / 2)
            }
        }
        return $null
    }

    # Funcion: busca un nodo por resource-id en el XML y devuelve su centro
    function Find-ById { param([string]$xml, [string]$rid)
        # Patron: resource-id="<rid>" ... bounds="[x1,y1][x2,y2]"
        $pat = "resource-id=`"$([regex]::Escape($rid))`"[^>]*bounds=`"(\[[^\]]+\]\[[^\]]+\])`""
        if ($xml -match $pat) { return Get-Center -b $matches[1] }
        return $null
    }

    try {
        # 1. Force-stop para limpiar estado anterior
        RunAdb @("-s", $serial, "shell", "am", "force-stop", "com.flowlogin.agent") | Out-Null
        Start-Sleep -Milliseconds 400

        # 2. Lanzar con request_capture=true para disparar el dialogo del sistema
        RunAdb @("-s", $serial, "shell", "am", "start",
            "-n", "com.flowlogin.agent/.MainActivity",
            "--ez", "request_capture", "true",
            "--es", "host", "127.0.0.1",
            "--ei", "port", "8766",
            "--ez", "autoconnect", "true") | Out-Null
        $log += "[$serial] lanzado con request_capture=true"

        # 3. Esperar a que aparezca el dialogo (el sistema tarda ~2-3s)
        Start-Sleep -Seconds 4

        # 4. Dump UI via uiautomator para encontrar elementos por resource-id
        $dumpRemote = "/sdcard/flowdashboard_mp_dialog.xml"
        RunAdb @("-s", $serial, "shell", "uiautomator", "dump", $dumpRemote) | Out-Null
        Start-Sleep -Milliseconds 600
        $xml = (RunAdb @("-s", $serial, "shell", "cat", $dumpRemote)) -join "`n"
        RunAdb @("-s", $serial, "shell", "rm", "-f", $dumpRemote) | Out-Null

        # 5. Buscar CheckBox "Don't show again" por resource-id del sistema
        #    resource-id="com.android.systemui:id/remember" — estable en todos los Android
        $cbCoord = Find-ById -xml $xml -rid "com.android.systemui:id/remember"
        if ($cbCoord) {
            $log += "[$serial] checkbox encontrado por resource-id en $($cbCoord.X),$($cbCoord.Y)"
        } else {
            # Fallback: buscar por checkable=true en el dialogo
            $pat2 = 'checkable="true"[^>]*bounds="(\[[^\]]+\]\[[^\]]+\])"'
            if ($xml -match $pat2) {
                $cbCoord = Get-Center -b $matches[1]
                $log += "[$serial] checkbox encontrado por checkable=true en $($cbCoord.X),$($cbCoord.Y)"
            } else {
                $cbCoord = @{ X = $fbCbX; Y = $fbCbY }
                $log += "[$serial] checkbox: usando fallback $fbCbX,$fbCbY"
            }
        }

        # 6. Buscar boton "Start now" por resource-id universal
        #    resource-id="android:id/button1" — boton positivo en TODOS los AlertDialog de Android
        $snCoord = Find-ById -xml $xml -rid "android:id/button1"
        if ($snCoord) {
            $log += "[$serial] 'Start now' encontrado por resource-id en $($snCoord.X),$($snCoord.Y)"
        } else {
            $snCoord = @{ X = $fbSnX; Y = $fbSnY }
            $log += "[$serial] 'Start now': usando fallback $fbSnX,$fbSnY"
        }

        # 7. TAP 1: marcar el checkbox "Don't show again"
        RunAdb @("-s", $serial, "shell", "input", "tap", $cbCoord.X, $cbCoord.Y) | Out-Null
        Start-Sleep -Milliseconds 700

        # 8. TAP 2: boton "Start now"
        RunAdb @("-s", $serial, "shell", "input", "tap", $snCoord.X, $snCoord.Y) | Out-Null
        Start-Sleep -Milliseconds 800

        $log += "[$serial] taps enviados: checkbox($($cbCoord.X),$($cbCoord.Y)) + start($($snCoord.X),$($snCoord.Y))"
        $status = "ok"

    } catch {
        $log += "[$serial] ERROR: $_"
        $status = "error"
    }

    return @{ Serial = $serial; Status = $status; Log = $log }
}

# Procesar en bloques
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
        $jobs += Start-Job -ScriptBlock $jobBlock `
            -ArgumentList $s, $adb, $FB_CHECKBOX_X, $FB_CHECKBOX_Y, $FB_STARTNOW_X, $FB_STARTNOW_Y
    }

    $null = Wait-Job -Job $jobs -Timeout 45
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

# Esperar a que la captura arranque
Write-Host "`n=== Esperando 5s para que la captura arranque ===" -ForegroundColor Cyan
Start-Sleep -Seconds 5

# Verificar via /agents
Write-Host "`n=== Verificando captura activa ===" -ForegroundColor Cyan
try {
    $agents = Invoke-RestMethod -Uri "http://127.0.0.1:8765/agents" -TimeoutSec 5
    foreach ($r in $allResults) {
        $agent = $agents.agents | Where-Object { $_.serial -eq $r.Serial }
        $captureOk = $agent -and $agent.meta -and $agent.meta.capture
        $color = if ($captureOk) { 'Green' } else { 'Yellow' }
        $mark  = if ($captureOk) { 'CAPTURA ACTIVA' } else { 'captura pendiente' }
        Write-Host "  [$($r.Serial)] $mark" -ForegroundColor $color
    }
} catch {
    Write-Host "  No se pudo verificar /agents: $_" -ForegroundColor Yellow
}

# Resumen
Write-Host "`n=== RESUMEN ===" -ForegroundColor Cyan
$ok = ($allResults | Where-Object { $_.Status -eq 'ok' }).Count
Write-Host "$ok/$total taps enviados"

# Log detallado
Write-Host "`n=== LOG ===" -ForegroundColor DarkGray
foreach ($r in $allResults) {
    foreach ($line in $r.Log) { Write-Host $line -ForegroundColor DarkGray }
}
