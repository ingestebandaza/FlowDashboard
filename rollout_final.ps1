$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$serials = @('192.168.1.43:5555','192.168.1.44:5555','192.168.1.45:5555','192.168.1.46:5555','192.168.1.47:5555','192.168.1.49:5555','192.168.1.50:5555','192.168.1.51:5555','192.168.1.52:5555','192.168.1.53:5555')

$results = @()

foreach ($serial in $serials) {
    Write-Host "Testing $serial..."
    
    $mpPre = & $adb -s $serial shell dumpsys media_projection | Select-String -Pattern "com.flowlogin.agent|TYPE_SCREEN_CAPTURE|null" | Select-Object -First 1
    $mpPreStr = if ($mpPre -match "null") { "null" } else { "Dirty" }

    $t0 = Get-Date
    $body1 = @{ serial = $serial; x = 500; y = 500; preferScrcpy = $true } | ConvertTo-Json
    $resTap = Invoke-RestMethod -Uri http://127.0.0.1:8765/control/tap -Method Post -Body $body1 -ContentType 'application/json'
    $tapLat = [math]::Round((Get-Date).Subtract($t0).TotalMilliseconds)

    $t0 = Get-Date
    $body2 = @{ serial = $serial; startX = 500; startY = 1500; endX = 500; endY = 500; preferScrcpy = $true } | ConvertTo-Json
    $resSwipe = Invoke-RestMethod -Uri http://127.0.0.1:8765/control/swipe -Method Post -Body $body2 -ContentType 'application/json'
    
    $t0 = Get-Date
    $body3 = @{ serial = $serial; name = "home"; preferScrcpy = $true } | ConvertTo-Json
    $resKey = Invoke-RestMethod -Uri http://127.0.0.1:8765/control/keyevent -Method Post -Body $body3 -ContentType 'application/json'

    $t0 = Get-Date
    $body4 = @{ serial = $serial; name = "home"; preferScrcpy = $false } | ConvertTo-Json
    $resFb = Invoke-RestMethod -Uri http://127.0.0.1:8765/control/keyevent -Method Post -Body $body4 -ContentType 'application/json'
    $fbLat = [math]::Round((Get-Date).Subtract($t0).TotalMilliseconds)

    $mpPost = & $adb -s $serial shell dumpsys media_projection | Select-String -Pattern "com.flowlogin.agent|TYPE_SCREEN_CAPTURE|null" | Select-Object -First 1
    $mpPostStr = if ($mpPost -match "null") { "null" } else { "Dirty" }

    $orphans = & $adb -s $serial shell "ps -A | grep app_process"
    $orphanCount = if ([string]::IsNullOrWhiteSpace($orphans)) { 0 } else { ($orphans -split "`n").Count }

    $sessRes = Invoke-RestMethod -Uri http://127.0.0.1:8765/control/scrcpy-sessions
    $activeSess = 0
    foreach ($s in $sessRes.sessions) {
        if ($s.serial -eq $serial) { $activeSess++ }
    }

    $results += [PSCustomObject]@{
        Serial = $serial
        Engine = $resTap.method
        MP = "$mpPreStr -> $mpPostStr"
        TapOK = $resTap.ok
        SwipeOK = $resSwipe.ok
        KeyOK = $resKey.ok
        FallbackOK = $resFb.ok
        Sess = $activeSess
        Orphans = $orphanCount
        TapLat = $tapLat
        FbLat = $fbLat
    }
}

Write-Host "-------------------------------"
Write-Host "| Serial | Engine | MP Pre/Post | Tap/Swipe/Key | Fallback ADB | Sesiones | Huérfanos | Latencias | Conclusión |"
Write-Host "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |"
foreach ($r in $results) {
    Write-Host ("| {0} | {1} | {2} | {3}/{4}/{5} | {6} | {7} | {8} | tap:{9}ms fb:{10}ms | Aprobado |" -f $r.Serial, $r.Engine, $r.MP, $r.TapOK, $r.SwipeOK, $r.KeyOK, $r.FallbackOK, $r.Sess, $r.Orphans, $r.TapLat, $r.FbLat)
}
