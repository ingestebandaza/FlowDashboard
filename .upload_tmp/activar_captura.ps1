# Activa la captura MediaProjection en cada device del FlowAgent.
# Para cada serial:
#  1. Lanzar MainActivity con --ez request_capture=true (dispara el dialog del sistema)
#  2. Esperar 3s a que aparezca el dialog
#  3. Tap en checkbox "Don't show again" (~ x=540, y=1520) -- coords aprox para 1080x1920
#  4. Tap en boton "Start now" (~ x=900, y=1670)
# Si las coords no coinciden con todos los devices (OEM diferentes), la version de
# accept se hace via uiautomator dump + busqueda por texto.

param([int]$BatchSize = 4)

$adb = 'c:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'

# Coordenadas tipicas para 1080x1920 (Samsung Galaxy S8/S9 series).
# El bounds de "remember" en .43 era [28,1436][1052,1562] -> centro 540,1499
# El bounds de "Start now" en .43 era [697,1606][1024,1697] -> centro 860,1651
$dontShowX = 540
$dontShowY = 1499
$startNowX = 860
$startNowY = 1651

# Devices conectados
$devOut = & $adb devices 2>&1
$devices = @()
foreach ($line in $devOut) {
    if ($line -match '^([\w\.\:]+)\s+device\s*$') { $devices += $matches[1] }
}
Write-Host "Devices: $($devices.Count)" -ForegroundColor Cyan

$jobBlock = {
    param($serial, $adb, $dx, $dy, $sx, $sy)
    $log = @()
    try {
        # 1. Force-stop por si la activity esta congelada
        & $adb -s $serial shell am force-stop com.flowlogin.agent 2>$null | Out-Null
        Start-Sleep -Milliseconds 300

        # 2. Lanzar con request_capture
        & $adb -s $serial shell am start -n com.flowlogin.agent/.MainActivity --ez request_capture true --es host 127.0.0.1 --ei port 8766 --ez autoconnect true 2>$null | Out-Null
        Start-Sleep -Seconds 4

        # 3. Tap en "Don't show again"
        & $adb -s $serial shell input tap $dx $dy 2>$null | Out-Null
        Start-Sleep -Milliseconds 600

        # 4. Tap en "Start now"
        & $adb -s $serial shell input tap $sx $sy 2>$null | Out-Null
        Start-Sleep -Milliseconds 800

        $log += "$serial OK"
        return @{ Serial = $serial; Status = "ok"; Log = $log }
    } catch {
        $log += "$serial ERR: $_"
        return @{ Serial = $serial; Status = "error"; Log = $log }
    }
}

$results = @()
$total = $devices.Count
$blockNum = 0

for ($i = 0; $i -lt $total; $i += $BatchSize) {
    $blockNum++
    $block = $devices[$i..([Math]::Min($i + $BatchSize - 1, $total - 1))]
    Write-Host "`n=== Bloque $blockNum ($($block.Count) devices) ===" -ForegroundColor Yellow

    $jobs = @()
    foreach ($s in $block) {
        Write-Host "  $s..."
        $jobs += Start-Job -ScriptBlock $jobBlock -ArgumentList $s, $adb, $dontShowX, $dontShowY, $startNowX, $startNowY
    }

    $null = Wait-Job -Job $jobs -Timeout 30
    foreach ($j in $jobs) {
        if ($j.State -eq 'Running') { Stop-Job -Job $j }
        $r = Receive-Job -Job $j -ErrorAction SilentlyContinue
        if ($r) {
            $results += $r
            $color = if ($r.Status -eq 'ok') { 'Green' } else { 'Red' }
            Write-Host "  [$($r.Serial)] $($r.Status)" -ForegroundColor $color
        }
        Remove-Job -Job $j -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "`n=== Esperando 5s para que la captura arranque y empiecen los frames ===" -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host "`n=== RESUMEN ===" -ForegroundColor Cyan
$ok = ($results | Where-Object { $_.Status -eq 'ok' }).Count
Write-Host "$ok/$total acciones ejecutadas"
