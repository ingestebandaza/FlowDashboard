# Obtener agentes del servidor Python y registrar mappings en backend C#
Write-Host "Sincronizando mappings desde Python hacia backend C#..." -ForegroundColor Cyan

try {
    $agents = Invoke-RestMethod -Uri 'http://localhost:8765/agents' -TimeoutSec 5
    Write-Host "Agentes en Python: $($agents.agents.Count)" -ForegroundColor Yellow
    
    $ok = 0
    $fail = 0
    
    foreach ($a in $agents.agents) {
        $androidId = $a.agentId
        $serial = $a.serial
        
        if (-not $serial) {
            Write-Host "  SKIP $androidId (sin serial)" -ForegroundColor Gray
            continue
        }
        
        try {
            $body = @{ androidId = $androidId; adbSerial = $serial } | ConvertTo-Json
            $r = Invoke-RestMethod -Uri 'http://localhost:5000/api/devices/register' -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 5
            Write-Host "  OK $serial -> $androidId" -ForegroundColor Green
            $ok++
        } catch {
            Write-Host "  FAIL $serial -> $androidId : $_" -ForegroundColor Red
            $fail++
        }
    }
    
    Write-Host ""
    Write-Host "Mappings registrados: $ok / $($agents.agents.Count)" -ForegroundColor Cyan
    
    # Verificar mappings en C#
    $mappings = Invoke-RestMethod -Uri 'http://localhost:5000/api/devices/mappings' -TimeoutSec 5
    Write-Host "Mappings en backend C#: $($mappings.Count)" -ForegroundColor Green
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
