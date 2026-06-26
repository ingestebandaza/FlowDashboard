$serial = '192.168.1.48:5555'
$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'

function Get-Focus {
    & $adb -s $serial shell dumpsys window windows | Select-String -Pattern 'mCurrentFocus|mFocusedApp'
}

Write-Host '--- Initial Focus ---'
Get-Focus

Write-Host '--- Opening Settings ---'
& $adb -s $serial shell am start -a android.settings.SETTINGS | Out-Null
Start-Sleep -Seconds 2
Get-Focus

Write-Host '--- Sending Home via scrcpy_control ---'
$body = @{ serial = $serial; name = 'home'; preferScrcpy = $true } | ConvertTo-Json
$res = Invoke-RestMethod -Uri http://127.0.0.1:8765/control/keyevent -Method Post -Body $body -ContentType 'application/json'
Write-Host ('Response: ok={0}, method={1}' -f $res.ok, $res.method)
Start-Sleep -Seconds 2
Get-Focus

Write-Host '--- Opening Settings Again ---'
& $adb -s $serial shell am start -a android.settings.SETTINGS | Out-Null
Start-Sleep -Seconds 2
Get-Focus

Write-Host '--- Sending Home via adb_input ---'
$body2 = @{ serial = $serial; name = 'home'; preferScrcpy = $false } | ConvertTo-Json
$res2 = Invoke-RestMethod -Uri http://127.0.0.1:8765/control/keyevent -Method Post -Body $body2 -ContentType 'application/json'
Write-Host ('Response: ok={0}, method={1}' -f $res2.ok, $res2.method)
Start-Sleep -Seconds 2
Get-Focus
