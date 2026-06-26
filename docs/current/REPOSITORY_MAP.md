# Repository Map

STATUS: CURRENT
Last verified against code: 2026-06-27
Last verified against runtime: 2026-06-27
Canonical replacement: N/A
Owner: FlowDashboard

Date: 2026-06-27

This map classifies the workspace by current role. It does not delete or move
runtime files; legacy candidates are listed in `archive/LEGACY_INDEX.md`.

## Current Runtime

| Path | Status | Notes |
|---|---|---|
| `electron-app/` | current | Main Electron product UI and renderer code. |
| `electron-app/electron-builder.config.js` | current build config | Phase 8 Electron Builder/NSIS config. Consumes commercial resources and produces `release_packages`. |
| `electron-app/assets/icon.ico` | generated/current asset | Installer icon generated from `electron-app/assets/icon.png`; regenerate through the Phase 8 build script. |
| `electron-app/src/main/path-resolver.js` | current | Dev/production path resolver, approved JSON allowlist and idempotent data migration. |
| `electron-app/src/main/runtime-manager.js` | current | Electron sidecar supervisor for C#, Python, health checks, logs and clean shutdown. |
| `electron-app/src/main/update-manager.js` | current | Phase 9 updater using `electron-updater` and GitHub Releases. |
| `FlowDashboard.Core/` | current | C# backend on port `5000`. |
| `FlowDashboard.Core/Services/AppPaths.cs` | current | C# base/resource/data path resolver and atomic data writes. |
| `scripts/build/build-dotnet.ps1` | current build script | Publishes C# self-contained runtime to `build\runtime\dotnet`. |
| `build/runtime/dotnet/` | generated runtime | Phase 6 packaged C# sidecar output. Regenerate instead of hand-editing. |
| `scripts/build/prepare-commercial-resources.ps1` | current build script | Prepares Phase 7 commercial resource staging under `build\staging\commercial-resources`. |
| `build/staging/commercial-resources/` | generated staging | Phase 7 installer input layout with runtime, scrcpy, FlowAgent, FlowTrackName, scripts and notices. Regenerate instead of hand-editing. |
| `scripts/build/build-electron-installer.ps1` | current build script | Phase 8 installer build. Rebuilds commercial resources, runs packaged preflight and calls Electron Builder. |
| `release_packages/` | generated release output | Phase 8 NSIS installer, blockmap, `win-unpacked` and installer manifest. Regenerate instead of hand-editing. |
| `local_adb_server.py` | current | Python backend on port `8765`; owns device, control, FlowAgent, H.264 bridge and licensing endpoints. |
| `build_specs/FlowDashboard.Backend.spec` | current build spec | PyInstaller onedir spec for packaged Python backend. |
| `build_specs/FlowDashboard.MailHelper.spec` | current build spec | PyInstaller spec for FlowMail stdin/stdout helper exe. |
| `scripts/build/build-python.ps1` | current build script | Builds `build\runtime\python\FlowDashboard.Backend.exe` and `FlowDashboard.MailHelper.exe`. |
| `build/runtime/python/` | generated runtime | Phase 5 packaged Python sidecar output. Regenerate instead of hand-editing. |
| `scrcpy_raw_streamer.py` | current/protected | H.264 raw scrcpy session manager. |
| `scrcpy_raw_ws_server.py` | current/protected | WS `8768` H.264 transport. |
| `scrcpy_control_channel.py` | current/protected | Manual scrcpy-control socket path. |
| `scrcpy_manager.py` | current/legacy-adjacent | Native scrcpy/WebP support used by older paths; verify before changing. |
| `scrcpy-win64-v4.0/` | current/protected | Bundled ADB, scrcpy and scrcpy-server runtime. |
| `flow_agent_monolito/` | current automation source | AutoJs6 monolith fork for FlowAgent APK. |
| `flow_agent_apk/` | legacy stable + build assets | Contains legacy APK 0.3.8 path and shared signing/build assets. Do not remove. |
| `Login.js` | current automation | FlowLogin script consumed by automation flow. |
| `Register.js` | current/automation-adjacent | Registration automation artifact; verify before changing. |
| `abrir_electron.bat` | current launcher | Official launcher for this workspace. |
| `abrir_electron.ps1` | current launcher | Actual startup logic. |
| `version.json` | current metadata | Single source of truth for product version/name/channel. |
| `app_meta.py` | current metadata | Synchronized to `2.0.0` by `scripts/release/sync-version.ps1`. |
| `archive/legacy-updater/update.json` | legacy updater manifest | Historical Python updater manifest, moved to archive. Phase 9 does not mutate or use it. |
| `h264_canary_config.json` | optional local config | Read by the launcher when present for H.264 canary/frame_meta settings. Device-specific (`frameMetaSerials`), gitignored and not version-controlled; the launcher works without it. |

## Current Documentation

| Path | Status | Notes |
|---|---|---|
| `AGENTS.md` | required | Local operating rules for agents and developers. |
| `PROJECT_CONTEXT.md` | required | Living project memory. Update it with functional, visual or structural changes. |
| `docs/master_technical_specification.md` | required | Active technical specification. |
| `docs/current/` | current | Quick current-state documentation created in Phase 1. |
| `docs/commercial/` | current | Commercial docs and notices. Phase 7 adds resource staging documentation and third-party notices; Phase 8 records installer consumption. |
| `docs/architecture/` | current placeholder | Architecture notes/diagrams for later phases. |

## Current Commercial Plan

| Path | Status | Notes |
|---|---|---|
| `PLAN_MAESTRO_IMPLEMENTACION_COMERCIAL_FLOWDASHBOARD_2.0.0.md` | current plan | Phase-gated commercial implementation plan. |
| `ANEXO_CONTROL_COHERENCIA_CODIGO_RUNTIME_DOCUMENTACION.md` | current plan | Coherence and verification annex. |
| `scripts/release/sync-version.ps1` | current release script | Synchronizes version metadata from `version.json`. |
| `scripts/build/build-python.ps1` | current build script | Produces the packaged Python backend and FlowMail helper. |
| `scripts/build/build-dotnet.ps1` | current build script | Produces the packaged self-contained C# backend. |
| `scripts/build/prepare-commercial-resources.ps1` | current build script | Produces `build\staging\commercial-resources` and `RESOURCE_MANIFEST.json`. |
| `scripts/build/build-electron-installer.ps1` | current build script | Produces `release_packages\FlowDashboard-Setup-2.0.0.exe`, `latest.yml` and `PHASE9_UPDATER_INSTALLER_MANIFEST.json`. |
| `scripts/diagnostics/verify-documentation-consistency.ps1` | current diagnostic script | Checks active docs/code for version/name contradictions. |

## Runtime Data And Local State

These paths may contain local runtime data, generated logs, captures, recordings,
device metadata or sensitive information. Do not document secrets or copy them
into public docs.

| Path | Handling |
|---|---|
| `.supabase_config.json` | secret-bearing local config; do not quote contents. |
| `.flowlogin_payloads/` | payload/runtime data; do not copy secrets into docs. |
| `device_names.json` | local device names/profiles; describe structure only. |
| `device_groups.json` | local grouping state. |
| `device_inventory.json` | local device inventory; migrated to data root when missing. |
| `device_mappings.json` | local stable-device mapping; migrated to data root when missing. |
| `device_registrations.json` | local registration cache; migrated to data root when missing. |
| `license.json` | local license cache used by Electron; migrated to data root when missing. |
| `update_config.json` | local updater config; migrated to data root when missing. |
| `recordings/` | generated recordings. |
| `scratch/` | local temporary runtime state. |
| `scratch/flowdashboard-data-runtime/` | development data root set by `abrir_electron.ps1`. |
| `scratch/flowdashboard-data-runtime/logs/runtime/` | RuntimeManager sidecar stdout/stderr logs. |
| `reports/` | generated reports; verify freshness before relying on them. |
| `restore_points/` | snapshots and rollback material. |

## Legacy And Experimental Areas

| Path | Status | Notes |
|---|---|---|
| `archive/legacy-dashboard/wsapi_demo.html` | legacy dashboard | Moved to archive; keep for historical reference only; product is Electron. |
| `archive/legacy-dashboard/wsapi.js` | legacy helper | Moved to archive; legacy dashboard helper; no new features. |
| `FlowDashboard.exe` | unverified legacy package | Existing binary in root; exact runtime role not verified. |
| `archive/legacy-launchers/launcher.py`, root `launcher.spec`, `archive/legacy-launchers/Crearexe.bat` | legacy packaging | Old Python/PyInstaller path; `launcher.py` and `Crearexe.bat` moved to archive, `launcher.spec` still at root. |
| `archive/legacy-launchers/CrearActualizacion.bat`, `archive/legacy-updater/updater.py` | legacy updater | Moved to archive. Superseded by Electron UpdateManager and GitHub Releases. |
| `abrir_dashboard*`, `INICIAR_FLOWDASHBOARD*` | legacy launchers | Official launcher is `abrir_electron.bat`. |
| `PASOS_*`, `LISTO_*`, `SOLUCION_*`, `PRUEBA_*`, `RESUMEN_*`, `INSTRUCCIONES_*` | historical notes | Use only as history, not as source of truth. |
| `hotfix*`, `spike*`, `dump*`, `window_dump*` | experiments/debug artifacts | Keep out of current architecture decisions. |
| root `scrcpy-server`, root `scrcpy-server.jar` | redundant copies | Bundled current copy is under `scrcpy-win64-v4.0/`. |
| `docs_legacy/` | legacy docs | Historical only. |

## New Phase 1 Buckets

Created for classification and future cleanup:

- `archive/legacy-dashboard/`
- `archive/legacy-updater/`
- `archive/legacy-sql/`
- `archive/legacy-launchers/`
- `archive/experiments/`
- `scripts/dev/`
- `scripts/build/`
- `scripts/release/`
- `scripts/diagnostics/`
- `build/runtime/`
- `build/staging/`

Phase 1 creates the buckets and index. It intentionally avoids mass-moving files
that could affect runtime paths.
