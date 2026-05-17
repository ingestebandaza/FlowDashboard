@echo off
setlocal

set "DASHBOARD_DIR=%~dp0"
set "DASHBOARD_URL=http://127.0.0.1:8765/health"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$url=$env:DASHBOARD_URL; $dir=$env:DASHBOARD_DIR; $ready=$false; try { $h=Invoke-RestMethod -Uri $url -TimeoutSec 2; if (($h.features -contains 'flowlogin_status') -and ($h.features -contains 'apk_agent_socket') -and ($h.features -contains 'flowagent_setup') -and ($h.features -contains 'flowlogin_agent_runner') -and ($h.features -contains 'flowlogin_fresh_retry') -and ($h.features -contains 'flowagent_auto_ensure') -and ($h.features -contains 'flowlogin_cache_retry') -and ($h.features -contains 'flowlogin_visual_cache_clear') -and ($h.features -contains 'flowlogin_retry_form_fix') -and ($h.features -contains 'flowlogin_clone_list') -and ($h.features -contains 'device_public_ip_flags') -and ($h.features -contains 'device_public_ip_refresh') -and ($h.features -contains 'device_visible_ip') -and ($h.features -contains 'flowagent_socket_app_info_permissions') -and ($h.features -contains 'flowagent_accessibility_diagnostics')) { $ready=$true } } catch {}; if (-not $ready) { $pids=@(); try { $pids += Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $_.OwningProcess } } catch {}; if (-not $pids) { $pids += netstat -ano | Select-String ':8765.*LISTENING' | ForEach-Object { ($_ -split '\s+')[-1] } }; $pids | Select-Object -Unique | Where-Object { $_ -match '^\d+$' } | ForEach-Object { Stop-Process -Id ([int]$_) -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 700; Start-Process -FilePath python -ArgumentList 'local_adb_server.py' -WorkingDirectory $dir -WindowStyle Hidden; Start-Sleep -Seconds 1 }"

start "" "%DASHBOARD_DIR%wsapi_demo.html"

endlocal
