# Diagnostico crudo del scrcpy-server raw stream.
# TODO el output va a diag_raw.log (no a stdout) para evitar buffer del orquestador.
$ErrorActionPreference = 'Continue'

$logFile = 'C:\DASHBOARD\FlowDashboard\.upload_tmp\diag_raw.log'
Set-Content -Path $logFile -Value '' -Encoding utf8 -Force
function L { param([string]$t); Add-Content -Path $logFile -Value $t -Encoding utf8 }

$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$jarLocal = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\scrcpy-server'
$serial = '192.168.1.11:5555'
$port = 28999
# El server hace Integer.parseInt(scid, 16) -> SCID en HEX, max 7fffffff (31-bit).
# El abstract socket name usa "%08x" del mismo numero, asi que coincide.
$scidHex = '12345678'

L "=== diag_raw_server.ps1 inicio ==="
L "adb = $adb"
L "jar = $jarLocal (size: $((Get-Item $jarLocal).Length))"
L "serial = $serial"
L ""

L "--- 1) adb connect ---"
L (& $adb connect $serial 2>&1 | Out-String)

L "--- 2) push jar ---"
L (& $adb -s $serial push $jarLocal '/data/local/tmp/scrcpy-server-manual.jar' 2>&1 | Out-String)

L "--- 3) limpiar forwards y procesos viejos ---"
L (& $adb -s $serial forward --remove-all 2>&1 | Out-String)
L (& $adb -s $serial shell 'ps -A | grep app_process' 2>&1 | Out-String)

L "--- 4) adb forward tcp:$port -> localabstract:scrcpy_$scidHex ---"
L (& $adb -s $serial forward "tcp:$port" "localabstract:scrcpy_$scidHex" 2>&1 | Out-String)

L "--- 5) Lanzar server (modo raw) ---"
$shellCmd = "CLASSPATH=/data/local/tmp/scrcpy-server-manual.jar app_process / com.genymobile.scrcpy.Server 4.0 scid=$scidHex log_level=info tunnel_forward=true audio=false control=false cleanup=true raw_stream=true video_codec=h264 max_size=240 max_fps=8 video_bit_rate=300000"
L "Comando shell: $shellCmd"

# PowerShell 5.x: usar -ArgumentList con Start-Process o Arguments string.
# Necesito stderr/stdout redirigidos -> Process directo con escape de comillas.
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $adb
# Construyo args como un solo string, con quoting correcto.
$psi.Arguments = '-s "' + $serial + '" shell "' + $shellCmd.Replace('"', '\"') + '"'
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

L "  proc.Arguments = $($psi.Arguments)"

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
[void]$proc.Start()
L "  PID adb shell: $($proc.Id)"

# Dar 1.2s al server para abrir el listener.
Start-Sleep -Milliseconds 1200

L ""
L "--- 6) Conectar TCP a 127.0.0.1:$port ---"
$totalBytes = 0
$head = New-Object byte[] 64
$headLen = 0
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect('127.0.0.1', $port)
    L "  Socket TCP conectado"
    $stream = $tcp.GetStream()
    $stream.ReadTimeout = 1500
    $buf = New-Object byte[] 8192
    $deadline = [DateTime]::UtcNow.AddSeconds(4)
    while ([DateTime]::UtcNow -lt $deadline) {
        try {
            $n = $stream.Read($buf, 0, $buf.Length)
            if ($n -le 0) { break }
            if ($headLen -lt 64) {
                $copy = [Math]::Min(64 - $headLen, $n)
                [Array]::Copy($buf, 0, $head, $headLen, $copy)
                $headLen += $copy
            }
            $totalBytes += $n
        } catch [System.IO.IOException] {
            break
        }
    }
    L "  bytes leidos: $totalBytes"
    if ($headLen -gt 0) {
        $hex = ($head[0..([Math]::Min($headLen,32)-1)] | ForEach-Object { '{0:x2}' -f $_ }) -join ' '
        L "  primeros bytes: $hex"
    }
    $tcp.Close()
} catch {
    L "  ERROR conectando: $_"
}

L ""
L "--- 7) Matar adb shell y leer stderr/stdout ---"
try {
    if (-not $proc.HasExited) { $proc.Kill() }
    [void]$proc.WaitForExit(2000)
} catch {
    L "  excepcion al matar: $_"
}
$serverErr = $proc.StandardError.ReadToEnd()
$serverOut = $proc.StandardOutput.ReadToEnd()
L "  --- stderr server ---"
L $serverErr
L "  --- stdout server (primeros 200 chars) ---"
if ($serverOut.Length -gt 0) {
    L $serverOut.Substring(0, [Math]::Min(200, $serverOut.Length))
} else {
    L '  (vacio)'
}

L ""
L "--- 8) Limpiar ---"
L (& $adb -s $serial forward --remove "tcp:$port" 2>&1 | Out-String)

L "=== fin ==="
