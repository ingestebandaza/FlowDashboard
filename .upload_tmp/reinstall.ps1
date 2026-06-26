$adb = 'c:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$serial = '192.168.1.43:5555'
$apk = 'c:\DASHBOARD\FlowDashboard\flow_agent_monolito\app\build\outputs\apk\app\debug\agent-v1.0.0-arm64-v8a.apk'

Write-Host "==> Installing APK"
& $adb -s $serial install -r $apk

Write-Host "==> Granting permissions"
& $adb -s $serial shell pm grant com.flowlogin.agent android.permission.WRITE_SECURE_SETTINGS
& $adb -s $serial shell pm grant com.flowlogin.agent android.permission.READ_EXTERNAL_STORAGE

Write-Host "==> Forcing portrait now"
& $adb -s $serial shell settings put system accelerometer_rotation 0
& $adb -s $serial shell settings put system user_rotation 0

Write-Host "==> Re-enabling accessibility (changes lost after reinstall)"
& $adb -s $serial shell settings put secure enabled_accessibility_services com.flowlogin.agent/com.flowlogin.agent.FlowAccessibilityService
& $adb -s $serial shell settings put secure accessibility_enabled 1

Write-Host "==> Re-setting FlowKeyboard as default IME"
& $adb -s $serial shell ime enable com.flowlogin.agent/.FlowKeyboardService
& $adb -s $serial shell ime set com.flowlogin.agent/.FlowKeyboardService

Write-Host "==> Reverse tunnel"
& $adb -s $serial reverse tcp:8766 tcp:8766

Write-Host "==> Launch FlowAgent main"
& $adb -s $serial shell am start -n com.flowlogin.agent/.MainActivity --es host 127.0.0.1 --es serial $serial --ei port 8766 --ez autoconnect true

Start-Sleep 5
Write-Host "==> Verifying state"
& $adb -s $serial shell "settings get system accelerometer_rotation; settings get system user_rotation; dumpsys window | grep mCurrentRotation | head -1"
