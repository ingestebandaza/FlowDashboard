$r = Invoke-RestMethod -Uri 'http://localhost:8765/agents' -TimeoutSec 5
Write-Host "Agentes: $($r.agents.Count)" -ForegroundColor Cyan
foreach ($a in $r.agents) {
    $serial = $a.serial
    $version = $a.agentVersion
    $color = if ($serial) { 'Green' } else { 'Red' }
    Write-Host "  $($a.agentId)  serial=$serial  version=$version" -ForegroundColor $color
}
