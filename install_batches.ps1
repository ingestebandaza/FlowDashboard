$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$apk = 'C:\DASHBOARD\FlowDashboard\flow_agent_apk\build\flowagent-debug.apk'

$devices = & $adb devices | Select-String 'device$' | ForEach-Object { ($_ -split '\s+')[0] }
Write-Host "Total: $($devices.Count) dispositivos" -ForegroundColor Cyan

$batchSize = 5
$total = $devices.Count
$ok = 0
$fail = 0

for ($i = 0; $i -lt $total; $i += $batchSize) {
    $batch = $devices[$i..([Math]::Min($i + $batchSize - 1, $total - 1))]
    Write-Host "Lote $([Math]::Floor($i/$batchSize)+1): $($batch -join ', ')" -ForegroundColor Yellow

    $jobs = @()
    foreach ($d in $batch) {
        $jobs += Start-Job -ScriptBlock {
            param($adb, $apk, $d)
            $r = & $adb -s $d install $apk 2>&1
            & $adb -s $d reverse tcp:8766 tcp:8766 2>&1 | Out-Null
            & $adb -s $d reverse tcp:5000 tcp:5000 2>&1 | Out-Null
            if ($r -match 'Success') { "OK $d" } else { "FAIL $d" }
        } -ArgumentList $adb, $apk, $d
    }

    $results = $jobs | Wait-Job -Timeout 60 | Receive-Job
    $jobs | Remove-Job -Force

    foreach ($r in $results) {
        if ($r -match '^OK') { Write-Host "  $r" -ForegroundColor Green; $ok++ }
        else { Write-Host "  $r" -ForegroundColor Red; $fail++ }
    }
}

Write-Host ""
Write-Host "Resultado: $ok OK / $fail FAIL de $total dispositivos" -ForegroundColor Cyan
