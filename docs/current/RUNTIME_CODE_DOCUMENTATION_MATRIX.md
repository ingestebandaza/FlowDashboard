# Runtime Code Documentation Matrix

STATUS: CURRENT
Last verified against code: 2026-06-24
Last verified against runtime: 2026-06-24
Canonical replacement: N/A
Owner: FlowDashboard

Date: 2026-06-24

This matrix reconciles the current runtime, code and documentation after the
commercial Phase 9 Electron updater implementation.

| Component | Codigo canonico | Proceso/runtime | Puerto | Launcher | Documentacion | Estado verificado |
|---|---|---|---:|---|---|---|
| Electron | `electron-app/`, `electron-app/src/main/path-resolver.js`, `electron-app/src/main/runtime-manager.js` | Electron renderer/main + sidecar supervisor | local process | `abrir_electron.bat` | `docs/current/CURRENT_ARCHITECTURE.md` | VERIFIED: path resolver and RuntimeManager active by syntax; runtime launch retested in Phase 4 |
| Electron updater | `electron-app/src/main/update-manager.js`, `electron-app/package.json`, `electron-app/electron-builder.config.js` | Electron main + `electron-updater` | local process/GitHub Releases | Electron IPC | `docs/current/BUILD_AND_RELEASE.md` | VERIFIED BY SYNTAX: provider `ingestebandaza/FlowDashboard`, renderer IPC wired; N -> N+1 release test pending |
| Python | `local_adb_server.py`, `app_meta.py`, `build_specs/FlowDashboard.Backend.spec` | Python backend script or packaged `FlowDashboard.Backend.exe` | 8765 | `abrir_electron.bat` + Electron RuntimeManager | `docs/master_technical_specification.md` | VERIFIED: dev `/health` OK; packaged exe self-check OK; packaged `/health` OK with `productMode=true` and `isFrozen=true` |
| C# | `FlowDashboard.Core/`, `FlowDashboard.Core/Services/AppPaths.cs`, `scripts/build/build-dotnet.ps1` | dev exe or self-contained `build/runtime/dotnet/FlowDashboard.Core.exe` | 5000 | `abrir_electron.bat` + Electron RuntimeManager | `docs/current/BUILD_AND_RELEASE.md` | VERIFIED: published exe `/api/health` OK, version 2.0.0, productMode true, packaged ADB available |
| ADB | `scrcpy-win64-v4.0/adb.exe` | ADB server | 5037 | `abrir_electron.bat` | `docs/current/CURRENT_ARCHITECTURE.md` | VERIFIED: launcher starts bundled ADB |
| scrcpy | `scrcpy-win64-v4.0/scrcpy.exe`, `scrcpy-server.jar` | scrcpy sidecars | ADB sockets | Python/backend calls | `docs/master_technical_specification.md` | VERIFIED: runtime paths configured |
| H.264 | `scrcpy_raw_streamer.py`, `scrcpy_raw_ws_server.py`, `stream-renderer-h264.js` | Python WS + Electron WebCodecs | 8768 | `abrir_electron.bat` | `docs/current/CURRENT_ARCHITECTURE.md` | VERIFIED: service available; black-screen incident deferred |
| Control | `scrcpy_control_channel.py`, `/control/*`, `flow-touch.js` | scrcpy-control | dynamic ADB sockets | Python backend | `docs/current/CURRENT_ARCHITECTURE.md` | VERIFIED BY SYNTAX; runtime manual interaction not retested in Phase 2 |
| FlowAgent | `flow_agent_monolito/`, `local_adb_server.py`, staged `android/flowagent/agent-v1.0.0-arm64-v8a.apk` | APK socket | 8766 | Python backend | `docs/master_technical_specification.md` | VERIFIED: Phase 7 metadata reports versionName 1.0.0 and versionCode 106; runtime agents not retested in Phase 7 |
| FlowKeyboard | FlowAgent APK + `local_adb_server.py` | Android IME via FlowAgent | 8766 | explicit automation prep | `docs/current/CURRENT_ARCHITECTURE.md` | VERIFIED: agents expose keyboard status |
| FlowLogin | `Login.js`, Python FlowLogin endpoints | FlowAgent automation | 8766 + ADB | explicit user action | `PROJECT_CONTEXT.md` | CODE MAPPED; not executed in Phase 2 |
| FlowMail | `FlowDashboard.Core/Services/MailService.cs`, `build_specs/FlowDashboard.MailHelper.spec` | C# mail service + packaged `FlowDashboard.MailHelper.exe` | 5000 + stdin/stdout helper | C# backend | `docs/master_technical_specification.md` | BUILD VERIFIED: helper exe produced; runtime mail login not executed in Phase 5 |
| Inspector | renderer inspector + Python UIAutomator/ADB endpoints | ADB/UIAutomator | 8765 | Python backend | `docs/current/CURRENT_ARCHITECTURE.md` | CODE MAPPED; not executed in Phase 2 |
| OCR | FlowAgent/Python OCR/template endpoints | explicit capture flow | 8765/8766 | explicit user action | `docs/current/CURRENT_ARCHITECTURE.md` | CODE MAPPED; not executed in Phase 2 |
| FlowTrackName | `Herramientas/FlowTrackName.exe` and renderer panel | local tool | n/a | explicit user action | `docs/current/REPOSITORY_MAP.md` | HASH REGISTERED: Phase 7 records size 32087726 and SHA-256 in RESOURCE_MANIFEST; startup smoke is optional/manual |
| Licencia | `local_adb_server.py`, Supabase config | Python backend | 8765 | Python backend | `docs/current/SECURITY.md` | CODE MAPPED; secrets not inspected |
| Actualizador legacy | `archive/legacy-updater/updater.py`, disabled `/update-check` shim in `local_adb_server.py` | disabled compatibility path | 8765 | Python backend | `archive/LEGACY_INDEX.md` | ARCHIVED: Python updater replaced by Electron UpdateManager; endpoints return `legacy_updater_disabled` |
| Instalador | `electron-app/package.json`, `electron-app/electron-builder.config.js`, `scripts/build/build-electron-installer.ps1` | NSIS build | n/a | release script | `docs/current/BUILD_AND_RELEASE.md` | VERIFIED: Phase 9 generated `release_packages\FlowDashboard-Setup-2.0.0.exe`, SHA-256 `4e5f01bf7ee32cda53021a09497bfe6939d6d83a92aa38b7c91dfa330eb38500`, plus `latest.yml`; unsigned internal build |
| Python packaging | `scripts/build/build-python.ps1`, `build_specs/*.spec` | PyInstaller onedir | n/a | build script | `docs/current/BUILD_AND_RELEASE.md` | VERIFIED: `build\runtime\python` contains backend/helper exe and self-check passed |
| C# packaging | `scripts/build/build-dotnet.ps1`, `FlowDashboard.Core/FlowDashboard.Core.csproj` | self-contained win-x64 publish | n/a | build script | `docs/current/BUILD_AND_RELEASE.md` | VERIFIED: `build\runtime\dotnet` contains runtime markers and `/api/health` passed |
| Commercial resources | `scripts/build/prepare-commercial-resources.ps1`, `build/staging/commercial-resources/` | installer input staging | n/a | build script | `docs/commercial/COMMERCIAL_RESOURCES.md` | VERIFIED: Phase 9 rebuild generated 460 files, 304413385 bytes, manifest and no known secret-bearing paths |

## Version Evidence

Single source of truth:

```text
version.json
```

Synchronized targets:

- `electron-app/package.json`
- `electron-app/package-lock.json`
- root `package.json`
- `app_meta.py`
- `electron-app/src/main/update-manager.js`
- `FlowDashboard.Core/FlowDashboard.Core.csproj`
- `FlowDashboard.Core/Program.cs` runtime health
- `RELEASE_NOTES_2.0.0.md`

Script:

```text
scripts/release/sync-version.ps1
```
