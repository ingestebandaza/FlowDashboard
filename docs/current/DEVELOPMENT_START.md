# Development Start

STATUS: CURRENT
Last verified against code: 2026-06-27
Last verified against runtime: 2026-06-27
Canonical replacement: N/A
Owner: FlowDashboard

Date: 2026-06-27

Use this checklist before modifying FlowDashboard.

## Read First

1. `AGENTS.md`
2. `PROJECT_CONTEXT.md`
3. `docs/master_technical_specification.md`
4. `docs/current/CURRENT_ARCHITECTURE.md`
5. `docs/current/REPOSITORY_MAP.md`
6. `archive/LEGACY_INDEX.md`

Do not use `DOCUMENTACION_TECNICA.md` as a current source.

## Start The Dashboard

Use the official launcher:

```powershell
.\abrir_electron.bat
```

The launcher starts or checks:

- bundled ADB from `scrcpy-win64-v4.0\adb.exe`;
- C# backend on `5000`;
- Python backend on `8765`;
- FlowAgent socket on `8766`;
- legacy WebP socket on `8767`;
- H.264 raw WS on `8768`;
- Electron UI from `electron-app/`.
- shared writable data root at `scratch\flowdashboard-data-runtime`.

Electron main also runs `electron-app/src/main/runtime-manager.js`. When the
launcher already started C# and Python, RuntimeManager records them as external
healthy services and does not kill them on exit. When Electron owns a sidecar,
its logs go to `scratch\flowdashboard-data-runtime\logs\runtime`.

Important: the launcher intentionally restarts Python-bound ports `8765-8768`.
Do not run it during a live device test unless that restart is acceptable.

Because that restart drops Wi-Fi/TCP device connections, the Python backend
auto-recovers them on startup: a few seconds after it is ready it reconnects the
known inventory devices and scans the auto-detected local subnets. Set
`FLOWDASHBOARD_DISABLE_AUTO_SCAN=1` to turn this off.

## Data Root

In development, `abrir_electron.ps1` sets:

```text
FLOWDASHBOARD_DATA_DIR=scratch\flowdashboard-data-runtime
```

Electron, Python and C# use this same root for approved mutable data:

- `device_names.json`
- `device_groups.json`
- `device_inventory.json`
- `device_mappings.json`
- `device_registrations.json`
- `license.json`
- `update_config.json`

The first run copies approved files from the repository root only if the target
file does not already exist. This is idempotent and does not migrate secrets.

## Health Checks

Useful read-only checks:

```text
GET http://127.0.0.1:8765/health
GET http://127.0.0.1:8765/devices
GET http://127.0.0.1:8765/agents
GET http://127.0.0.1:8765/streaming/raw/sessions
GET http://127.0.0.1:8765/control/scrcpy-sessions
GET http://127.0.0.1:8765/recordings/active
GET http://127.0.0.1:5000/api/health
GET http://127.0.0.1:5000/api/streaming/stats
```

From Electron preload, `window.electronAPI.getRuntimeStatus()` returns the
RuntimeManager view of C#, Python, resource paths, warnings and sidecar
ownership.

## Validation Commands

For renderer syntax:

```powershell
node --check electron-app\src\renderer\app.js
node --check electron-app\src\renderer\stream-renderer-h264.js
node --check electron-app\src\renderer\flow-touch.js
node --check electron-app\src\renderer\stream-renderer.js
```

For Python syntax:

```powershell
python -m py_compile local_adb_server.py scrcpy_raw_streamer.py scrcpy_raw_ws_server.py scrcpy_control_channel.py
```

For packaged Python runtime:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build\build-python.ps1 -Clean
build\runtime\python\FlowDashboard.Backend.exe --self-check
```

When testing the packaged `/health`, stop any development Python already using
`8765-8768` first, then run the exe with `FLOWDASHBOARD_PRODUCT_MODE=1`,
`FLOWDASHBOARD_RESOURCE_DIR`, `FLOWDASHBOARD_DATA_DIR`, `FLOWDASHBOARD_ADB`,
`SCRCPY_PATH` and `SCRCPY_SERVER_JAR` pointing to the intended runtime/resource
roots.

For C#:

```powershell
dotnet build FlowDashboard.Core\FlowDashboard.Core.csproj -c Release --no-restore
```

For packaged C# runtime:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build\build-dotnet.ps1 -Clean
```

When testing the published executable directly, set `FLOWDASHBOARD_PRODUCT_MODE=1`,
`FLOWDASHBOARD_RESOURCE_DIR`, `FLOWDASHBOARD_DATA_DIR`, `FLOWDASHBOARD_ADB`,
`SCRCPY_PATH` and `FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART=1`.

For the Phase 8 Electron/NSIS installer:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build\build-electron-installer.ps1 -Clean -SkipVersionSync
```

The verified output is under `release_packages\`. The internal installer is
unsigned until a later code-signing phase.

For the Phase 9 Electron updater:

```powershell
node --check electron-app\src\main\update-manager.js
node --check electron-app\src\main\index.js
node --check electron-app\preload\preload.js
node --check electron-app\src\renderer\app.js
```

The updater is active only in packaged builds unless
`FLOWDASHBOARD_FORCE_UPDATE_CHECK=1` is set for diagnostics.

## Before Moving Files

Before moving a file to `archive/` or `scripts/`:

1. Search references across the repository.
2. Register known consumers in `archive/LEGACY_INDEX.md`.
3. Confirm whether runtime uses the path.
4. Keep a temporary shim if any current path depends on it.
5. Validate `abrir_electron.bat`.

## Protected Incident Separation

Commercial cleanup must not quietly change video/control behavior. H.264,
scrcpy, Focus/Grid canvas lifecycle and `/control/*` changes require a separate
approved incident with its own restore point and validation.
