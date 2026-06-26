# Mappings correctos: androidId -> IP real del dispositivo
# Obtenidos de la sesion anterior donde los seriales eran correctos
$correctMappings = @(
    @{ androidId="ec3d6b5297d0bc95"; adbSerial="192.168.1.11:5555" },
    @{ androidId="ab496ae532e2b3d4"; adbSerial="192.168.1.38:5555" },
    @{ androidId="1eb64864d12325b6"; adbSerial="192.168.1.39:5555" },
    @{ androidId="392ec79b232ce8f5"; adbSerial="192.168.1.40:5555" },
    @{ androidId="ca620dc1686ace0a"; adbSerial="192.168.1.41:5555" },
    @{ androidId="584dcbc53ac8c631"; adbSerial="192.168.1.42:5555" },
    @{ androidId="95fd186385d0d5a4"; adbSerial="192.168.1.43:5555" },
    @{ androidId="d2a18d6000029708"; adbSerial="192.168.1.44:5555" },
    @{ androidId="ca277a41916ad1ae"; adbSerial="192.168.1.45:5555" },
    @{ androidId="1bb5218574279d85"; adbSerial="192.168.1.46:5555" },
    @{ androidId="b94945429d96e5f3"; adbSerial="192.168.1.47:5555" },
    @{ androidId="cb610076f5377904"; adbSerial="192.168.1.48:5555" },
    @{ androidId="f3761412899f2a69"; adbSerial="192.168.1.49:5555" },
    @{ androidId="b9304649ecf3816a"; adbSerial="192.168.1.50:5555" },
    @{ androidId="1f7ea381dd02e951"; adbSerial="192.168.1.51:5555" },
    @{ androidId="8bf237baa8b83964"; adbSerial="192.168.1.52:5555" },
    @{ androidId="bf391ad042f30dc7"; adbSerial="192.168.1.53:5555" }
)

$now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")

$mappingsList = $correctMappings | ForEach-Object {
    @{
        AndroidId    = $_.androidId
        AdbSerial    = $_.adbSerial
        RegisteredAt = $now
        LastSeen     = $now
    }
}

Write-Host "Registrando $($mappingsList.Count) mappings correctos en backend C#..." -ForegroundColor Cyan

$ok = 0
foreach ($m in $correctMappings) {
    try {
        $body = @{ androidId=$m.androidId; adbSerial=$m.adbSerial } | ConvertTo-Json
        Invoke-RestMethod -Uri 'http://localhost:5000/api/devices/register' -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 5 | Out-Null
        Write-Host "  OK $($m.adbSerial) -> $($m.androidId)" -ForegroundColor Green
        $ok++
    } catch {
        Write-Host "  FAIL $($m.adbSerial): $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Registrados: $ok/17" -ForegroundColor Cyan

# Verificar
$r = Invoke-RestMethod -Uri 'http://localhost:5000/api/devices/mappings' -TimeoutSec 5
Write-Host "Mappings en backend: $($r.Count)" -ForegroundColor Green
$r.value | ForEach-Object { Write-Host "  $($_.adbSerial) -> $($_.androidId)" -ForegroundColor White }
