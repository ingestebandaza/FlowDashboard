# Current Architecture

STATUS: CURRENT
Last verified against code: 2026-06-24
Last verified against runtime: 2026-06-24
Canonical replacement: N/A
Owner: FlowDashboard

Date: 2026-06-24

This document summarizes the runtime architecture verified for the current
FlowDashboard workspace. The authoritative detailed source remains
`docs/master_technical_specification.md`; this file is the quick map for
developers and AI agents.

## Official Entry Point

Use:

```text
abrir_electron.bat
```

The launcher delegates to `abrir_electron.ps1` and performs a clean development
startup:

- starts bundled ADB from `scrcpy-win64-v4.0\adb.exe`;
- checks or starts the C# backend on `http://127.0.0.1:5000`;
- restarts the Python backend and related sockets on `8765-8768`;
- opens Electron from `electron-app/` with `--disable-http-cache`;
- sets `FLOWDASHBOARD_DATA_DIR` to `scratch\flowdashboard-data-runtime` so
  Electron, Python and C# share one writable data root in development;
- sets `FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART=1` because the launcher
  or Electron RuntimeManager owns Python startup;
- does not install APKs, launch FlowAgent or configure accessibility during
  normal startup.

## Paths And Data Roots

Phase 3 introduced `electron-app/src/main/path-resolver.js`.

It resolves `projectRoot`, `resourceRoot`, `runtimeRoot`, `userDataRoot`,
`dataRoot`, `logsRoot`, `recordingsRoot`, `scriptsRoot`, `scrcpyRoot`,
`flowAgentApk` and `flowTrackNameExe`.

In development, resources resolve from the repository. In packaged builds,
resources are expected under `process.resourcesPath` and mutable data under
Electron user data or `FLOWDASHBOARD_DATA_DIR`.

Approved JSON data is migrated idempotently from the repository root to the
data root when missing. Secrets such as `.supabase_config.json` and payload
directories are not auto-migrated.

## Electron Runtime Manager

Phase 4 introduced `electron-app/src/main/runtime-manager.js`.

Responsibilities now implemented in Electron main:

- prepare sidecar environment variables for ADB, scrcpy, resources and data;
- detect development versus packaged mode;
- check required local resources without scanning arbitrary system paths;
- detect healthy external C# and Python services without taking ownership;
- start C# and Python only when their health endpoints are not already active;
- never kill third-party/external port owners indiscriminately;
- supervise sidecars started by Electron with bounded restart and backoff;
- keep separate logs under `dataRoot\logs\runtime`;
- stop only Electron-owned sidecars during app shutdown or update prep.

Development still uses `abrir_electron.bat` as the official entry point. Phase
5 provides the Python sidecar under `build\runtime\python`; Phase 6 provides
the C# self-contained runtime under `build\runtime\dotnet`; Phase 7 stages the
commercial resources under `build\staging\commercial-resources`; Phase 8
builds the Electron/NSIS package under `release_packages`.

## Active Components

| Component | Location | Port/Channel | Current role |
|---|---|---:|---|
| Electron UI | `electron-app/` | local process | Main dashboard UI |
| Electron RuntimeManager | `electron-app/src/main/runtime-manager.js` | local process | Sidecar health/start/stop supervisor |
| Electron UpdateManager | `electron-app/src/main/update-manager.js` | local process | GitHub Releases updater through `electron-updater` |
| Electron packaged app | `release_packages/win-unpacked/` | local process | Phase 8 packaged app layout with `process.resourcesPath` resources |
| NSIS installer | `release_packages/FlowDashboard-Setup-2.0.0.exe` | n/a | Internal unsigned Phase 8 installer |
| Python backend | `local_adb_server.py` | `8765` | devices, licensing, FlowAgent bridge, control endpoints, H.264 bridge |
| Python packaged sidecar | `build/runtime/python/FlowDashboard.Backend.exe` | `8765-8768` | PyInstaller onedir backend for commercial runtime |
| FlowMail packaged helper | `build/runtime/python/FlowDashboard.MailHelper.exe` | stdin/stdout | IMAP helper invoked by C# without generic Python |
| FlowAgent socket | Python backend | `8766` | automation and APK socket channel |
| Legacy WebP socket | Python backend | `8767` | legacy/complementary APK frame path |
| H.264 raw WS | Python backend | `8768` | current Grid/Focus video path |
| C# backend | `FlowDashboard.Core/` | `5000` | ADB API, secondary backend, legacy streaming support |
| C# packaged sidecar | `build/runtime/dotnet/FlowDashboard.Core.exe` | `5000` | Self-contained .NET runtime for commercial sidecar |
| ADB | `scrcpy-win64-v4.0\adb.exe` | `5037` | Android transport |
| scrcpy | `scrcpy-win64-v4.0\scrcpy.exe` and `scrcpy-server.jar` | ADB sockets | video/control/recording substrate |
| Commercial resource staging | `build/staging/commercial-resources/` | n/a | Phase 7 installer input layout with runtime, scrcpy, FlowAgent, FlowTrackName and notices |

Shared writable data root:

```text
FLOWDASHBOARD_DATA_DIR
```

Development launcher value:

```text
scratch\flowdashboard-data-runtime
```

## Runtime Profiles

### Control

Used by Grid, Focus, taps, swipes, live touch, Back, Home and Recents.

Video path:

```text
scrcpy-server.jar
-> ADB socket
-> Python WS 8768
-> Electron WebCodecs
-> Grid/Focus canvas
```

Manual control path:

```text
scrcpy-control
-> Python /control/*
-> scrcpy binary control socket
```

ADB input is a safe fallback. FlowAgent and Accessibility are not automatic
fallbacks for manual control.

### Automation

Used by FlowLogin, scripts, click by text, set text, intelligent dump,
FlowKeyboard and OCR/template actions.

Path:

```text
Electron/Python
-> FlowAgent socket 8766
-> FlowAgent monolith APK
-> AutoJs6/Rhino + AccessibilityServiceUsher + FlowKeyboard
```

Automation preparation or APK updates on devices that already have the agent
must be explicit user actions.

### Inspector

Tree/native/auto inspection should prefer UIAutomator via ADB. Accessibility or
CDP may complement it when available. OCR and hybrid modes are the only modes
allowed to request screen capture/MediaProjection.

### OCR

OCR and template matching may call capture only on explicit demand and must be
able to stop it. Normal Grid/Focus and manual control must not start Android
MediaProjection.

### Recording

Manual recording uses scrcpy/H.264 saved on the PC through:

```text
/recordings/start
/recordings/stop
/recordings/status
/recordings/active
```

It must not start automatically.

## Protected Areas

Do not modify these while doing commercial classification work unless a separate
approved incident requires it:

- `electron-app/src/renderer/stream-renderer-h264.js`
- `electron-app/src/renderer/flow-touch.js`
- H.264 Grid/Focus lifecycle in `electron-app/src/renderer/app.js`
- `scrcpy_raw_streamer.py`
- `scrcpy_raw_ws_server.py`
- `scrcpy_control_channel.py`
- `/control/*` endpoint behavior
- scrcpy packaged runtime under `scrcpy-win64-v4.0/`
- FlowAgent APK behavior unless the phase explicitly targets automation/APK

The known Grid/H.264 post-reboot black-screen incident is intentionally outside
Phase 1 and should be handled as a separate protected update.

## Python Packaging State

Phase 5 added the commercial Python runtime build:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build\build-python.ps1 -Clean
```

Verified outputs:

```text
build\runtime\python\FlowDashboard.Backend.exe
build\runtime\python\FlowDashboard.MailHelper.exe
```

The packaged backend was tested after stopping the development Python process.
It reported `productMode=true`, `isFrozen=true`, `baseDir=build\runtime\python`
and opened listeners on `8765`, `8766`, `8767` and `8768` from
`FlowDashboard.Backend.exe`.

## C# Packaging State

Phase 6 added the commercial C# runtime build:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build\build-dotnet.ps1 -Clean
```

Verified output:

```text
build\runtime\dotnet\FlowDashboard.Core.exe
```

The published backend was tested with `FLOWDASHBOARD_PRODUCT_MODE=1` and
`FLOWDASHBOARD_DATA_DIR=scratch\flowdashboard-data-runtime`. It reported
`version=2.0.0`, `productMode=true`, `adb.available=true` and listened on
loopback port `5000`.

## Commercial Resource Staging

Phase 7 added:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build\prepare-commercial-resources.ps1 -Clean
```

Verified output:

```text
build\staging\commercial-resources\
```

The staged layout mirrors the future packaged `process.resourcesPath`:

```text
runtime\python\
runtime\dotnet\
scrcpy-win64-v4.0\
android\flowagent\agent-v1.0.0-arm64-v8a.apk
Herramientas\FlowTrackName.exe
scripts\Login.js
THIRD_PARTY_NOTICES.txt
RESOURCE_MANIFEST.json
```

`electron-app/src/main/path-resolver.js` and `local_adb_server.py` now prefer
the commercial `android\flowagent` APK path while preserving the development
fallback to the Gradle output tree. `local_adb_server.py` also resolves
automation scripts from `resources\scripts` in packaged layouts.

The verified Phase 9 rebuild produced 460 staged files and `304413385` bytes. FlowAgent is
currently staged as `arm64-v8a` only (`versionName=1.0.0`,
`versionCode=106`); the universal APK exists but is not included until a later
commercial support decision.

## Electron Installer State

Phase 8 added the commercial Electron/NSIS build:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build\build-electron-installer.ps1 -Clean -SkipVersionSync
```

Verified outputs:

```text
release_packages\FlowDashboard-Setup-2.0.0.exe
release_packages\FlowDashboard-Setup-2.0.0.exe.blockmap
release_packages\win-unpacked\
release_packages\latest.yml
release_packages\PHASE9_UPDATER_INSTALLER_MANIFEST.json
```

The final package consumes `build\staging\commercial-resources` through
`electron-app\electron-builder.config.js`. Runtime verification on
`release_packages\win-unpacked\resources` showed:

- Python self-check OK, `productMode=true`, `isFrozen=true`, FlowAgent resolved
  from `android\flowagent\agent-v1.0.0-arm64-v8a.apk`.
- C# `/api/health` OK, `version=2.0.0`, `productMode=true`,
  `adb.available=true`, bundled ADB path.
- `app.asar` scan found no known secret/local-data paths; the current Phase 9
  package has 936 asar entries.

The installer is an internal unsigned build. Public release still requires
code signing and clean-machine install/startup validation.

## Electron Updater State

Phase 9 adds the Electron main-process updater:

```text
electron-app\src\main\update-manager.js
```

Provider:

```text
GitHub Releases: ingestebandaza/FlowDashboard
```

The renderer now talks to Electron IPC for update status, checking, deferring
and installing downloaded updates. The old Python `/update-check` and
`/update-status` endpoints remain only as disabled compatibility shims returning
`legacy_updater_disabled`; `updater.py` is archived under
`archive\legacy-updater\updater.py`.

Before install, `UpdateManager` attempts to stop active recordings through
Python and calls `RuntimeManager.prepareForUpdate()` so Electron-owned sidecars
close cleanly. Public release still requires a signed installer and a real
2.0.0 -> 2.0.1 GitHub Release update test.
