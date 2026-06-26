$r = Invoke-RestMethod -Uri 'http://localhost:8765/agents' -TimeoutSec 5
$r.agents[0] | ConvertTo-Json -Depth 5
