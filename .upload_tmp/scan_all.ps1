# Escanea todas las IPs conocidas y devuelve los seriales que respondieron a adb connect
$adb = 'c:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'

# Lista combinada: IPs vistas en payloads + rangos comunes del cliente
$candidates = @(
    '192.168.1.11','192.168.1.12','192.168.1.39','192.168.1.40','192.168.1.41',
    '192.168.1.42','192.168.1.43','192.168.1.44','192.168.1.45','192.168.1.46',
    '192.168.1.47','192.168.1.48','192.168.1.49','192.168.1.50','192.168.1.51',
    '192.168.1.52','192.168.1.53',
    '192.168.1.134','192.168.1.135','192.168.1.136','192.168.1.137','192.168.1.138',
    '192.168.1.139','192.168.1.140','192.168.1.141','192.168.1.142','192.168.1.143',
    '192.168.1.144','192.168.1.146','192.168.1.147','192.168.1.148','192.168.1.150'
)

Write-Host "Probando $($candidates.Count) IPs..." -ForegroundColor Cyan

$jobs = @()
foreach ($ip in $candidates) {
    $jobs += Start-Job -ScriptBlock {
        param($ip, $adb)
        $result = & $adb connect "${ip}:5555" 2>&1
        if ($result -match 'connected to|already connected') {
            return "${ip}:5555"
        }
        return $null
    } -ArgumentList $ip, $adb
}

# Esperar todos los jobs con timeout 8s c/u
$null = Wait-Job -Job $jobs -Timeout 12
$connected = @()
foreach ($job in $jobs) {
    $r = Receive-Job -Job $job
    if ($r) { $connected += $r }
    Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
}

Write-Host "`nRespondieron $($connected.Count) dispositivos:" -ForegroundColor Green
$connected | ForEach-Object { Write-Host "  - $_" }

# Confirmar con adb devices
Write-Host "`nadb devices:" -ForegroundColor Cyan
$out = & $adb devices
$confirmed = @()
foreach ($line in $out) {
    if ($line -match '^([\w\.\:]+)\s+device\s*$') {
        $confirmed += $matches[1]
    }
}
Write-Host "Confirmados por ADB: $($confirmed.Count)"
$confirmed | ForEach-Object { Write-Host "  - $_" }

# Guardar lista en archivo para que el script de despliegue lo use
$confirmed | Out-File 'c:\DASHBOARD\FlowDashboard\.upload_tmp\connected_devices.txt' -Encoding utf8
Write-Host "`nLista guardada en .upload_tmp\connected_devices.txt"
