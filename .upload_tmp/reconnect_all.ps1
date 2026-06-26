$adb = 'c:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$ips = @(
    '192.168.1.11','192.168.1.38','192.168.1.39','192.168.1.40','192.168.1.41',
    '192.168.1.42','192.168.1.43','192.168.1.44','192.168.1.45','192.168.1.46',
    '192.168.1.47','192.168.1.48','192.168.1.49','192.168.1.50','192.168.1.51',
    '192.168.1.52','192.168.1.53'
)

$jobs = @()
foreach ($ip in $ips) {
    $jobs += Start-Job -ScriptBlock {
        param($ip, $adb)
        & $adb connect "${ip}:5555" 2>&1
    } -ArgumentList $ip, $adb
}

$null = Wait-Job -Job $jobs -Timeout 15
foreach ($j in $jobs) {
    Receive-Job -Job $j -ErrorAction SilentlyContinue | Out-Null
    Remove-Job -Job $j -Force -ErrorAction SilentlyContinue
}

Start-Sleep 2
& $adb devices
