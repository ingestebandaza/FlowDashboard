$adb = "C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe"
$serials = @("192.168.1.45:5555", "192.168.1.53:5555")

foreach ($serial in $serials) {
    Write-Host "--- Testing $serial ---"
    
    # 1. Start Settings app
    & $adb -s $serial shell am start -a android.settings.SETTINGS | Out-Null
    Start-Sleep -Seconds 2
    
    $focusPre = & $adb -s $serial shell dumpsys window | Select-String "mCurrentFocus"
    Write-Host "Focus BEFORE: $focusPre"
    
    # 2. Test preferScrcpy = true
    $home1 = @{ serial = $serial; name = "home"; preferScrcpy = $true } | ConvertTo-Json
    $res1 = Invoke-RestMethod -Uri http://127.0.0.1:8765/control/keyevent -Method Post -Body $home1 -ContentType "application/json"
    Start-Sleep -Seconds 2
    
    $focusScrcpy = & $adb -s $serial shell dumpsys window | Select-String "mCurrentFocus"
    Write-Host "Focus AFTER preferScrcpy=true: $focusScrcpy"
    Write-Host "Response: $($res1 | ConvertTo-Json -Compress)"
    
    # 3. Test preferScrcpy = false
    $home2 = @{ serial = $serial; name = "home"; preferScrcpy = $false } | ConvertTo-Json
    $res2 = Invoke-RestMethod -Uri http://127.0.0.1:8765/control/keyevent -Method Post -Body $home2 -ContentType "application/json"
    Start-Sleep -Seconds 2
    
    $focusAdb = & $adb -s $serial shell dumpsys window | Select-String "mCurrentFocus"
    Write-Host "Focus AFTER preferScrcpy=false: $focusAdb"
    Write-Host "Response: $($res2 | ConvertTo-Json -Compress)"
}
