# Enviar capture_screen_start a todos los agentes
$agents = Invoke-RestMethod -Uri 'http://localhost:8765/agents' -TimeoutSec 5

Write-Host "Iniciando captura en $($agents.agents.Count) dispositivos..." -ForegroundColor Cyan

foreach ($a in $agents.agents) {
    try {
        $body = @{ agentId = $a.agentId; command = @{ name = "capture_screen_start" } } | ConvertTo-Json
        $r = Invoke-RestMethod -Uri 'http://localhost:8765/agent/command' -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 8
        $ok = $r.response.result.ok
        $msg = $r.response.result.message
        if (-not $msg) { $msg = $r.response.result.error }
        $alreadyRunning = (-not $ok) -and ($msg -match 'Captura ya en progreso')
        $permissionPending = (-not $ok) -and ($msg -match 'Solicitando permiso de captura|Acepta el dialogo')
        if ($ok -or $alreadyRunning) { Write-Host "  OK $($a.agentId) - $msg" -ForegroundColor Green }
        elseif ($permissionPending) { Write-Host "  WARN $($a.agentId) - $msg" -ForegroundColor Yellow }
        else { Write-Host "  FAIL $($a.agentId) - $msg" -ForegroundColor Red }
    } catch {
        Write-Host "  ERROR $($a.agentId): $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Esperando 5s y verificando frames en backend C#..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

$stats = Invoke-RestMethod -Uri 'http://localhost:5000/api/streaming/stats' -TimeoutSec 5
Write-Host "Clientes WebSocket conectados: $($stats.connectedClients)" -ForegroundColor Cyan
Write-Host "Frames en cache: $($stats.cachedFrames)" -ForegroundColor Cyan
