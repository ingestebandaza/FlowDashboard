# Prueba un stream scrcpy real contra el primer device conectado.
# Abre WebSocket binario, espera 3s, mide bytes recibidos y cierra.
$ErrorActionPreference = 'Continue'

$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'

Write-Host "=== Prueba de stream H.264 real ===" -ForegroundColor Cyan

$devOut = & $adb devices 2>&1
$devices = @()
foreach ($line in $devOut) {
    if ($line -match '^([\w\.\:]+)\s+device\s*$') { $devices += $matches[1] }
}

if ($devices.Count -eq 0) {
    Write-Host "Sin devices conectados, abortando." -ForegroundColor Yellow
    exit 0
}

$serial = $devices[0]
Write-Host "Probando con $serial..." -ForegroundColor DarkGray

# WebSocket via .NET ClientWebSocket.
Add-Type -AssemblyName System.Net.WebSockets
$uri = [Uri]"ws://127.0.0.1:5000/api/videostream/ws/$serial`?quality=240&fps=8"

$ws = New-Object System.Net.WebSockets.ClientWebSocket
$cts = New-Object System.Threading.CancellationTokenSource
$cts.CancelAfter([TimeSpan]::FromSeconds(15))

try {
    $connectTask = $ws.ConnectAsync($uri, $cts.Token)
    $connectTask.Wait()
    if ($ws.State -ne [System.Net.WebSockets.WebSocketState]::Open) {
        Write-Host "WebSocket no abrio: $($ws.State)" -ForegroundColor Red
        exit 1
    }
    Write-Host "WebSocket conectado." -ForegroundColor Green

    # Leer durante 4s y contar bytes.
    $totalBytes = 0
    $msgCount = 0
    $buffer = New-Object byte[] 65536
    $deadline = [DateTime]::UtcNow.AddSeconds(4)
    while ([DateTime]::UtcNow -lt $deadline -and $ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
        $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buffer)
        $rcvCts = New-Object System.Threading.CancellationTokenSource
        $rcvCts.CancelAfter([TimeSpan]::FromSeconds(2))
        try {
            $rcvTask = $ws.ReceiveAsync($seg, $rcvCts.Token)
            $rcvTask.Wait()
            $totalBytes += $rcvTask.Result.Count
            $msgCount++
        } catch {
            break
        }
    }

    Write-Host "Bytes recibidos en 4s: $totalBytes en $msgCount mensajes." -ForegroundColor Green

    # Cerrar limpio.
    try {
        $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "test", $cts.Token).Wait()
    } catch { }

    if ($totalBytes -gt 1024) {
        Write-Host "OK: stream H.264 funcionando." -ForegroundColor Green
        exit 0
    } else {
        Write-Host "AVISO: muy pocos bytes recibidos. Revisar scrcpy logs." -ForegroundColor Yellow
        exit 2
    }
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    exit 1
} finally {
    if ($ws) { $ws.Dispose() }
}
