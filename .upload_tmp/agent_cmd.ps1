param(
  [Parameter(Mandatory=$true)][string]$Cmd,
  [string]$Text = "",
  [int]$Index = -1,
  [string]$Pkg = ""
)
$agentId = '95fd186385d0d5a4'
$body = @{ name = $Cmd }
if ($Text) { $body.text = $Text }
if ($Index -ge 0) { $body.index = $Index }
if ($Pkg) { $body.packageName = $Pkg }
$payload = @{ agentId = $agentId; command = $body } | ConvertTo-Json -Compress -Depth 5
Write-Host "Sending: $payload"
Invoke-RestMethod -Uri 'http://127.0.0.1:8765/agent/command' -Method Post -ContentType 'application/json' -Body $payload | ConvertTo-Json -Depth 8
