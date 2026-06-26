$lines = C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe devices
$serials = @()
foreach ($l in $lines) {
    if ($l -match "^([^\s]+)\s+device$") {
        $s = $matches[1]
        if ($s -notmatch "\d{1,3}\.\d{1,3}\.") {
            $serials += $s
        }
    }
}
foreach ($s in $serials) {
    $serialno = (C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe -s $s shell getprop ro.serialno).Trim()
    $model = (C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe -s $s shell getprop ro.product.model).Trim()
    $tcp = (C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe -s $s shell getprop service.adb.tcp.port).Trim()
    $ip_out = C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe -s $s shell ip -o -4 addr show
    $ip = "NO_IP"
    foreach ($line in ($ip_out -split "
")) {
        if ($line -match "inet\s+(\d+\.\d+\.\d+\.\d+).*?(eth0|wlan0)") {
            $ip = $matches[1] + " (" + $matches[2] + ")"
            break
        } elseif ($line -match "inet\s+(192\.168\.\d+\.\d+)") {
            $ip = $matches[1]
        }
    }
    Write-Host "$s | $serialno | $model | $ip | $tcp"
}
