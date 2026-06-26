# Build And Release

STATUS: CURRENT
Last verified against code: 2026-06-24
Last verified against runtime: 2026-06-24
Canonical replacement: N/A
Owner: FlowDashboard

Date: 2026-06-24

This document describes the current build/release state found during Phase 0 and
the commercial packaging phases through Phase 8.

## Current Development Startup

The verified startup path is:

```powershell
.\abrir_electron.bat
```

It starts ADB, checks/starts the C# backend, restarts the Python backend and
opens Electron from `electron-app/`.

It also sets:

```text
FLOWDASHBOARD_DATA_DIR=scratch\flowdashboard-data-runtime
```

Later production phases must set this to Electron user data, normally under the
installed user's `%APPDATA%\FlowDashboard` equivalent.

Phase 4 adds `electron-app/src/main/runtime-manager.js`. Electron now has a
main-process supervisor that prepares sidecar environment variables, detects
healthy external services, starts missing C#/Python sidecars when a runtime is
available, waits for `/api/health` and `/health`, writes sidecar logs under
`dataRoot\logs\runtime`, and stops only Electron-owned child processes.

The development launcher still remains the verified entry point for repository
work. Packaged production now has the Python sidecar from Phase 5, the C#
self-contained runtime from Phase 6, the Phase 7 commercial resource staging
layout and the Phase 8 Electron/NSIS installer consuming that staging folder.

## Electron

Location:

```text
electron-app/
```

Observed package metadata:

- `name`: `flowdashboard`
- `version`: `2.0.0`
- `productName`: `FlowDashboard`
- `appId`: `com.flowdashboard.app`
- artifact name: `FlowDashboard-Setup-2.0.0.${ext}`
- builder target: NSIS
- current builder config: `electron-app\electron-builder.config.js`
- NSIS is one-click, per-user, creates desktop/start-menu shortcuts and keeps
  app data on uninstall.

These values are synchronized from `version.json` by
`scripts/release/sync-version.ps1`.

## Python Backend

Location:

```text
local_adb_server.py
```

Development launcher selection order:

1. `FLOWDASHBOARD_PYTHON`
2. `.venv\Scripts\python.exe`
3. `python\python.exe`
4. hardcoded developer Python
5. `python` from PATH

Development caveat:

- `.venv` exists but lacks required dependencies.
- `python\python.exe` portable runtime does not exist.
- Current runtime falls back to the developer Python path.

Commercial Phase 5 output:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build\build-python.ps1 -Clean
```

Outputs:

```text
build\runtime\python\FlowDashboard.Backend.exe
build\runtime\python\FlowDashboard.MailHelper.exe
```

The backend is built with PyInstaller `onedir` from
`build_specs\FlowDashboard.Backend.spec`. It includes the required runtime
modules for scrcpy H.264 raw WS, scrcpy-control, WebSocket and backend imports.
It excludes secrets, local data, payloads, logs, recordings, SQL, admin panel
and Android source trees.

Validated Phase 5 checks:

- `FlowDashboard.Backend.exe --self-check` returns `ok=true`,
  `productMode=true`, `isFrozen=true`, ADB/scrcpy/server jar present, and raw
  H.264/control modules available.
- Clean `/health` test after stopping the dev Python backend showed
  `baseDir=build\runtime\python`, `resourceDir=C:\DASHBOARD\FlowDashboard`,
  `dataDir=scratch\flowdashboard-data-runtime`, `productMode=true`,
  `isFrozen=true`.
- The packaged backend opened listeners on `8765`, `8766`, `8767` and `8768`
  from `FlowDashboard.Backend.exe`.

Python now supports `FLOWDASHBOARD_DATA_DIR` for approved mutable data,
recordings, temporary uploads, icon cache and diagnostic logs.

In product mode, local license fallback is disabled, `.supabase_config.json` is
not loaded from the package, and `SUPABASE_SERVICE_ROLE_KEY` is ignored by the
backend process.

## C# Backend

Location:

```text
FlowDashboard.Core/
```

Validated command:

```powershell
dotnet build FlowDashboard.Core\FlowDashboard.Core.csproj -c Release --no-restore
```

Observed result during Phase 0:

- build succeeded;
- warning: requested `AdvancedSharpAdbClient >= 3.3.7`, resolved `3.3.12`.

C# now supports `FLOWDASHBOARD_DATA_DIR` for `device_mappings.json` and
encrypted `mail_config.json`, with migration from the prior content root when
the target file is missing.

When `FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART=1`, C# does not try to
start Python itself. This is the normal Electron RuntimeManager path and avoids
double Python startup races.

Commercial Phase 6 output:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build\build-dotnet.ps1 -Clean
```

Output:

```text
build\runtime\dotnet\FlowDashboard.Core.exe
```

The publish is `win-x64`, Release, self-contained, and intentionally avoids
trimming, Native AOT, single-file and ReadyToRun.

Validated Phase 6 checks:

- `FlowDashboard.Core.exe` runs without installed .NET runtime dependency.
- `/api/health` reports `version=2.0.0`, `productMode=true`,
  `dataDir=scratch\flowdashboard-data-runtime` and packaged ADB status.
- `AdbService` and `ScrcpyService` resolve resources from environment or
  `scrcpy-win64-v4.0`, not Android SDK, `C:\adb` or PATH.
- ADB temp/log output is redirected to `DataDir\.adb_tmp` by default.
- If ADB cannot start, C# remains alive and reports degraded ADB state in
  `/api/health` instead of showing an application error.

## Commercial Resources

Commercial Phase 7 command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build\prepare-commercial-resources.ps1 -Clean
```

Verified output:

```text
build\staging\commercial-resources\
```

The folder mirrors the future `process.resourcesPath` structure:

- `runtime\python\FlowDashboard.Backend.exe`
- `runtime\python\FlowDashboard.MailHelper.exe`
- `runtime\dotnet\FlowDashboard.Core.exe`
- `scrcpy-win64-v4.0\adb.exe`
- `scrcpy-win64-v4.0\scrcpy.exe`
- `scrcpy-win64-v4.0\scrcpy-server.jar`
- `android\flowagent\agent-v1.0.0-arm64-v8a.apk`
- `Herramientas\FlowTrackName.exe`
- `scripts\Login.js`
- `scripts\Register.js`
- `THIRD_PARTY_NOTICES.txt`
- `RESOURCE_MANIFEST.json`

Validated Phase 7 output from the current Phase 9 rebuild:

- `fileCount=460`
- `totalBytes=304413385`
- FlowAgent `arm64-v8a`, `versionName=1.0.0`, `versionCode=106`
- universal FlowAgent APK is available in the Gradle output but intentionally
  excluded from Phase 7; the package is arm64-only until a later product
  decision enables multi-ABI support.
- FlowTrackName SHA-256:
  `fba6a00129f63726c590819c19f1c64f90a6801bbf419a17adb675409016177e`
- known local data/secrets are rejected by the staging script.

The exact inventory and hashes live in
`build\staging\commercial-resources\RESOURCE_MANIFEST.json`.

## Electron Installer

Commercial Phase 8 command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build\build-electron-installer.ps1 -Clean -SkipVersionSync
```

The script rebuilds commercial resources, runs the packaged Python preflight and
then runs Electron Builder with:

```text
electron-app\electron-builder.config.js
```

Verified output:

```text
release_packages\FlowDashboard-Setup-2.0.0.exe
release_packages\FlowDashboard-Setup-2.0.0.exe.blockmap
release_packages\latest.yml
release_packages\win-unpacked\
release_packages\PHASE9_UPDATER_INSTALLER_MANIFEST.json
```

Validated Phase 9 updater-aware output from 2026-06-24:

- installer size: `259716917` bytes
- installer SHA-256:
  `4e5f01bf7ee32cda53021a09497bfe6939d6d83a92aa38b7c91dfa330eb38500`
- `latest.yml` SHA-256:
  `963621489ef365e02e3c1944181c44f60e9aec40c7d975ff8305517d363b158d`
- packaged `resources\app-update.yml` points to GitHub Releases
  `ingestebandaza/FlowDashboard`.
- `win-unpacked\resources` contains the packaged Python runtime, C# runtime,
  bundled scrcpy/ADB, FlowAgent monolith APK, FlowTrackName, scripts, notices
  and `RESOURCE_MANIFEST.json`.
- packaged Python self-check passed from
  `release_packages\win-unpacked\resources`, with `productMode=true`,
  `isFrozen=true` and FlowAgent resolved from
  `android\flowagent\agent-v1.0.0-arm64-v8a.apk`.
- packaged C# health check passed from
  `release_packages\win-unpacked\resources`, with `version=2.0.0`,
  `productMode=true`, `adb.available=true` and bundled ADB path.
- `app.asar` contains 936 entries and the release scan found no known
  secret/local-data paths such as Supabase config, FlowLogin payloads, device
  JSON, recordings, restore points or SQL files.
- The installer is intentionally unsigned in this internal build. Public
  distribution still requires a real code-signing certificate/signing pipeline.

## Version State

Current source of truth:

```text
version.json
```

| File/API | Version |
|---|---|
| `version.json` | `2.0.0` |
| `electron-app/package.json` | `2.0.0` |
| `app_meta.py` | `2.0.0` |
| Python `/health` | `2.0.0` |
| C# `/api/health` | `2.0.0` |

## Release Buckets

Created in Phase 1:

- `scripts/build/`
- `scripts/release/`
- `build/runtime/`
- `build/staging/`

Phase 5 now uses these buckets for Python packaging:

- `scripts/build/build-python.ps1`
- `build_specs/FlowDashboard.Backend.spec`
- `build_specs/FlowDashboard.MailHelper.spec`
- `build/runtime/python/`
- `build/staging/pyinstaller-*`

Phase 7 uses these buckets for commercial resources:

- `scripts/build/prepare-commercial-resources.ps1`
- `build/staging/commercial-resources/`
- `docs/commercial/THIRD_PARTY_NOTICES.txt`
- `docs/commercial/COMMERCIAL_RESOURCES.md`

Phase 8 uses these buckets for Electron/NSIS packaging:

- `electron-app\electron-builder.config.js`
- `scripts/build/build-electron-installer.ps1`
- `release_packages\`
- `electron-app\assets\icon.ico`

Phase 9 uses these buckets for Electron updates:

- `electron-app\src\main\update-manager.js`
- `electron-app\package.json`
- `electron-app\package-lock.json`
- `archive\legacy-updater\updater.py`
- `release_packages\latest.yml`

## Electron Updater

Commercial Phase 9 replaces the legacy Python updater with Electron
main-process update management.

Runtime wiring:

- `UpdateManager` uses `electron-updater`.
- preload exposes `getUpdateStatus`, `checkForUpdates`,
  `installDownloadedUpdate`, `deferDownloadedUpdate` and `onUpdateStatus`.
- renderer `checkForUpdates()` now uses Electron IPC instead of Python
  `/update-check` and `/update-status`.
- `local_adb_server.py` keeps those legacy endpoints only as disabled shims
  returning `legacy_updater_disabled`.

Provider:

```text
GitHub Releases: ingestebandaza/FlowDashboard
```

Release artifacts expected for update delivery:

- `FlowDashboard-Setup-2.0.0.exe`
- `FlowDashboard-Setup-2.0.0.exe.blockmap`
- `latest.yml`
- release notes/checksums

`scripts\build\build-electron-installer.ps1` now fails a full installer build
if `latest.yml` is missing. The Python `updater.py` script was archived under
`archive\legacy-updater\updater.py`.

## Current Release Rule

Do not ship a public commercial package until these are closed:

- code signing is configured and verified;
- clean-machine install/startup is verified without developer Python, .NET SDK
  or Android SDK dependencies;
- update N -> N+1 is verified from a real GitHub Release;
- licensing model is verified for the commercial package;
- Grid/H.264 known post-reboot incident is either fixed or explicitly released
  as a known issue with an update plan.
