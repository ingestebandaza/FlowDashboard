$adb = 'c:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$serial = '192.168.1.43:5555'

Write-Host "=== 1. Dispositivos ADB ==="
& $adb devices

Write-Host "`n=== 2. FlowAgent instalado y version ==="
$installed = & $adb -s $serial shell dumpsys package com.flowlogin.agent 2>&1 | Select-String 'versionName'
Write-Host $installed

Write-Host "`n=== 3. Backend Python (puerto 8765) ==="
$pyConn = (Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue) | Select-Object -First 1
if ($pyConn) { Write-Host "OK: Python listening en 8765 (PID $($pyConn.OwningProcess))" }
else { Write-Host "X: Python NO esta escuchando en 8765 (backend caido)" }

Write-Host "`n=== 4. Backend C# (puerto 5000) ==="
$csConn = (Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue) | Select-Object -First 1
if ($csConn) { Write-Host "OK: C# listening en 5000 (PID $($csConn.OwningProcess))" }
else { Write-Host "X: C# NO esta escuchando en 5000 (backend caido)" }

Write-Host "`n=== 5. FlowAgent socket (puerto 8766) ==="
$agentConn = (Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue) | Select-Object -First 1
if ($agentConn) { Write-Host "OK: socket FlowAgent listening en 8766 (PID $($agentConn.OwningProcess))" }
else { Write-Host "X: socket FlowAgent NO esta escuchando en 8766" }

Write-Host "`n=== 6. /agents - quien esta conectado ==="
try {
  $r = Invoke-RestMethod 'http://127.0.0.1:8765/agents' -TimeoutSec 3
  $count = if ($r.agents) { $r.agents.Count } else { 0 }
  Write-Host "agents conectados: $count"
  if ($count -gt 0) { $r.agents | Select-Object serial, agentVersion, accessibility, keyboardActive | Format-List }
} catch { Write-Host "X: no se pudo consultar /agents - $_" }

Write-Host "`n=== 7. adb reverse ==="
& $adb -s $serial reverse --list

Write-Host "`n=== 8. Activity en foreground del .43 ==="
& $adb -s $serial shell "dumpsys activity activities | grep mResumedActivity | head -2"

Write-Host "`n=== 9. Permisos clave del FlowAgent ==="
$perms = @('WRITE_SECURE_SETTINGS','READ_EXTERNAL_STORAGE','BIND_ACCESSIBILITY_SERVICE')
foreach ($p in $perms) {
  $check = & $adb -s $serial shell "dumpsys package com.flowlogin.agent | grep $p" 2>&1
  Write-Host "$p : $check"
}

Write-Host "`n=== 10. Accessibility activa ==="
$acc = & $adb -s $serial shell "settings get secure enabled_accessibility_services" 2>&1
Write-Host "enabled_accessibility_services: $acc"

Write-Host "`n=== 11. IME default ==="
$ime = & $adb -s $serial shell "settings get secure default_input_method" 2>&1
Write-Host "default_input_method: $ime"
