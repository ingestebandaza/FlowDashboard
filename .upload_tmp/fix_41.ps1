$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$s = '192.168.1.41:5555'
Write-Host "Esperando dialogo en $s..."
Start-Sleep -Seconds 4
& $adb -s $s shell uiautomator dump /sdcard/mp.xml 2>$null | Out-Null
Start-Sleep -Milliseconds 600
$xml = (& $adb -s $s shell cat /sdcard/mp.xml 2>$null) -join "`n"
& $adb -s $s shell rm -f /sdcard/mp.xml 2>$null | Out-Null

$cbX = 540; $cbY = 1520; $snX = 751; $snY = 1651

$pat = "resource-id=`"com.android.systemui:id/remember`"[^>]*bounds=`"(\[[^\]]+\]\[[^\]]+\])`""
if ($xml -match $pat) {
    $b = $matches[1]
    if ($b -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') {
        $cbX = [int](([int]$matches[1]+[int]$matches[3])/2)
        $cbY = [int](([int]$matches[2]+[int]$matches[4])/2)
        Write-Host "checkbox encontrado: $cbX,$cbY"
    }
}
$pat2 = "resource-id=`"android:id/button1`"[^>]*bounds=`"(\[[^\]]+\]\[[^\]]+\])`""
if ($xml -match $pat2) {
    $b = $matches[1]
    if ($b -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') {
        $snX = [int](([int]$matches[1]+[int]$matches[3])/2)
        $snY = [int](([int]$matches[2]+[int]$matches[4])/2)
        Write-Host "start encontrado: $snX,$snY"
    }
}

& $adb -s $s shell input tap $cbX $cbY 2>$null | Out-Null
Start-Sleep -Milliseconds 700
& $adb -s $s shell input tap $snX $snY 2>$null | Out-Null
Write-Host "Taps enviados: checkbox($cbX,$cbY) + start($snX,$snY)"
