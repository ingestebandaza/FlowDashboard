$dest = 'C:\DASHBOARD\FlowDashboard\restore_points\PuntoAntesScrcpyRaw\runtime-files'
New-Item -Path $dest -ItemType Directory -Force | Out-Null

Copy-Item 'C:\DASHBOARD\FlowDashboard\local_adb_server.py' (Join-Path $dest 'local_adb_server.py') -Force -ErrorAction SilentlyContinue
Copy-Item 'C:\DASHBOARD\FlowDashboard\scrcpy_manager.py' (Join-Path $dest 'scrcpy_manager.py') -Force -ErrorAction SilentlyContinue
Copy-Item 'C:\DASHBOARD\FlowDashboard\websocket_server.py' (Join-Path $dest 'websocket_server.py') -Force -ErrorAction SilentlyContinue

$rdest = Join-Path $dest 'electron-renderer'
New-Item -Path $rdest -ItemType Directory -Force | Out-Null
Copy-Item 'C:\DASHBOARD\FlowDashboard\electron-app\src\renderer\stream-renderer-h264.js' (Join-Path $rdest 'stream-renderer-h264.js') -Force -ErrorAction SilentlyContinue
Copy-Item 'C:\DASHBOARD\FlowDashboard\electron-app\src\renderer\flow-touch.js' (Join-Path $rdest 'flow-touch.js') -Force -ErrorAction SilentlyContinue
Copy-Item 'C:\DASHBOARD\FlowDashboard\electron-app\src\renderer\app.js' (Join-Path $rdest 'app.js') -Force -ErrorAction SilentlyContinue
Copy-Item 'C:\DASHBOARD\FlowDashboard\electron-app\src\renderer\index.html' (Join-Path $rdest 'index.html') -Force -ErrorAction SilentlyContinue

Copy-Item 'C:\DASHBOARD\FlowDashboard\FlowDashboard.Core\Services\VideoStreamingService.cs' (Join-Path $dest 'VideoStreamingService.cs') -Force -ErrorAction SilentlyContinue

Write-Host "Restore point creado en $dest"
Get-ChildItem $dest -Recurse | Select-Object FullName, Length | Format-Table -AutoSize
