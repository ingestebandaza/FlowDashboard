# Commercial Resources

STATUS: CURRENT
Last verified against code: 2026-06-24
Last verified against runtime: 2026-06-24
Canonical replacement: N/A
Owner: FlowDashboard

Date: 2026-06-24

## Phase 7 Scope

Commercial Phase 7 prepares a deterministic resource staging folder for the
Electron installer. Phase 8 consumes this folder through
`electron-app\electron-builder.config.js`. The staging step does not modify
Grid/Focus, H.264, scrcpy-control, FlowTouch, FlowLogin execution or Android
device state.

Build command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build\prepare-commercial-resources.ps1 -Clean
```

Verified output:

```text
build\staging\commercial-resources\
```

This folder mirrors the intended `process.resourcesPath` layout for packaged
Electron builds.

## Staged Layout

```text
commercial-resources\
  runtime\
    python\
      FlowDashboard.Backend.exe
      FlowDashboard.MailHelper.exe
    dotnet\
      FlowDashboard.Core.exe
  scrcpy-win64-v4.0\
    adb.exe
    AdbWinApi.dll
    AdbWinUsbApi.dll
    scrcpy.exe
    scrcpy-server
    scrcpy-server.jar
    required native DLLs and images
  android\
    flowagent\
      agent-v1.0.0-arm64-v8a.apk
  Herramientas\
    FlowTrackName.exe
  scripts\
    Login.js
    Register.js
  THIRD_PARTY_NOTICES.txt
  RESOURCE_MANIFEST.json
```

## FlowAgent ABI Decision

The staged APK is:

```text
android\flowagent\agent-v1.0.0-arm64-v8a.apk
```

The source `output-metadata.json` verifies:

- `versionName`: `1.0.0`
- `versionCode`: `106`
- ABI: `arm64-v8a`

A universal APK exists in the Gradle release output, but it is not included in
Phase 7. The commercial package is therefore arm64-only until a later product
decision explicitly enables multi-ABI support.

## FlowTrackName

FlowTrackName is staged at:

```text
Herramientas\FlowTrackName.exe
```

Phase 7 registers:

- size: `32087726` bytes
- SHA-256:
  `fba6a00129f63726c590819c19f1c64f90a6801bbf419a17adb675409016177e`

Startup smoke test is intentionally optional through
`-SmokeTestFlowTrackName` because the executable has no documented silent CLI
mode. Phase 7 records existence, size, hash and installed path.

## Exclusions

The resource script fails if staged paths include known local or sensitive
runtime data:

- `.supabase_config.json`
- `.flowlogin_payloads/`
- `device_names.json`
- `device_groups.json`
- `device_inventory.json`
- `device_mappings.json`
- `device_registrations.json`
- `mail_config.json`
- `recordings/`
- `reports/`
- `restore_points/`
- SQL files

It also excludes Gradle sources, debug APK outputs, legacy FlowAgent APKs and
root-level redundant `scrcpy-server` copies.

## Verification

The verified Phase 9 rebuild produced:

- `fileCount`: `460`
- `totalBytes`: `304413385`
- `flowAgentAbi`: `arm64-v8a`
- `flowAgentVersion`: `1.0.0+106`
- `universalAvailable`: `true`
- `universalIncluded`: `false`

Exact staged file hashes are recorded in:

```text
build\staging\commercial-resources\RESOURCE_MANIFEST.json
```

## Phase 8/9 Consumption

The verified installer build copies this staging layout into:

```text
release_packages\win-unpacked\resources\
```

Required files verified in the final package:

- `runtime\python\FlowDashboard.Backend.exe`
- `runtime\dotnet\FlowDashboard.Core.exe`
- `scrcpy-win64-v4.0\adb.exe`
- `scrcpy-win64-v4.0\scrcpy.exe`
- `scrcpy-win64-v4.0\scrcpy-server.jar`
- `android\flowagent\agent-v1.0.0-arm64-v8a.apk`
- `Herramientas\FlowTrackName.exe`
- `scripts\Login.js`
- `THIRD_PARTY_NOTICES.txt`
- `RESOURCE_MANIFEST.json`

The current updater-aware installer manifest is:

```text
release_packages\PHASE9_UPDATER_INSTALLER_MANIFEST.json
```
