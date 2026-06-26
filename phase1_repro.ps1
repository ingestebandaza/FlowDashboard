$serial = "192.168.1.45:5555"
$adb = "c:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe"

Write-Host "---- INITIAL STATE ----"
& $adb -s $serial shell dumpsys window windows | Select-String "mCurrentFocus|mFocusedApp"

Write-Host "`n---- SCRCPY_CONTROL ----"
$home_scrcpy = @{ serial = $serial; name = "home"; preferScrcpy = $true } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri http://127.0.0.1:8765/control/keyevent -Method Post -Body $home_scrcpy -ContentType "application/json"

Start-Sleep -Seconds 2
Write-Host "State after scrcpy_control:"
& $adb -s $serial shell dumpsys window windows | Select-String "mCurrentFocus|mFocusedApp"

Write-Host "`n---- ADB_INPUT ----"
$home_adb = @{ serial = $serial; name = "home"; preferScrcpy = $false } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri http://127.0.0.1:8765/control/keyevent -Method Post -Body $home_adb -ContentType "application/json"

Start-Sleep -Seconds 2
Write-Host "State after adb_input:"
& $adb -s $serial shell dumpsys window windows | Select-String "mCurrentFocus|mFocusedApp"
