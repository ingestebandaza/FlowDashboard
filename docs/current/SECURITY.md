# Security

STATUS: CURRENT
Last verified against code: 2026-06-24
Last verified against runtime: 2026-06-24
Canonical replacement: N/A
Owner: FlowDashboard

Date: 2026-06-24

## Secrets And Local Data

Do not copy secret values into documentation, restore point summaries, release
notes or commits.

Sensitive or local-only paths include:

- `.supabase_config.json`
- `.flowlogin_payloads/`
- `device_names.json`
- `device_groups.json`
- account payload files
- generated captures/recordings that may contain private content
- private device identifiers when not necessary for debugging

Documentation may describe the structure of these files, but must not expose
accounts, passwords, service-role keys or full payloads.

## Renderer File Access

Electron renderer JSON persistence is restricted by an allowlist in
`electron-app/src/main/path-resolver.js`.

The renderer cannot pass arbitrary paths to read/write JSON. Rejected inputs
include absolute paths, `..`, path separators and non-JSON extensions.

Writes use a temporary file, fsync, backup and atomic rename.

Shell open/show operations from the renderer are restricted to approved runtime
roots for recordings/logs.

RuntimeManager IPC is diagnostic/control scoped:

- `runtime-status` exposes sidecar state and approved paths only.
- `runtime-prepare-for-update` stops Electron-owned sidecars.
- External services detected on ports `5000` or `8765` are not killed by
  Electron.
- RuntimeManager does not install APKs, start FlowAgent, enable Accessibility or
  request MediaProjection.

## Licensing

The current licensing model uses email/device registration data through the
Python backend and Supabase. The service-role key must stay server-side/local
backend only and must never be exposed in Electron renderer code.

Phase 5 product-mode rules in `local_adb_server.py`:

- `PRODUCT_MODE` is true when running frozen/PyInstaller or when
  `FLOWDASHBOARD_PRODUCT_MODE=1`.
- `.supabase_config.json` is read only outside product mode.
- `SUPABASE_SERVICE_ROLE_KEY` is ignored in product mode.
- local license fallback is disabled in product mode.
- product mode should use public/anon Supabase configuration plus protected
  server-side RPC design, not a service-role key embedded in the package.

Before changing licensing, verify:

- `PROJECT_CONTEXT.md`
- `docs/master_technical_specification.md`
- current Python backend endpoints
- current Supabase schema assumptions

## Device Control Boundaries

Manual control must stay on the control profile:

- video through scrcpy H.264 raw/frame_meta;
- taps/swipes/navigation through scrcpy-control endpoints;
- ADB input only as safe fallback.

FlowAgent/Accessibility must not become an automatic fallback for manual
control.

## MediaProjection Rule

Startup, Grid/Focus and normal manual control must not start Android
MediaProjection or show the capture icon.

Only explicit OCR/template/recording-like actions may request capture, and those
flows must provide a stop path.

## Distribution Risks

Current commercial risks:

- The development launcher can still fall back to a developer Python path, but
  Phase 5 now provides a packaged Python sidecar for product runtime.
- Phase 6 now provides a C# self-contained runtime.
- Phase 7 now provides deterministic resource staging under
  `build\staging\commercial-resources`.
- Phase 8 now provides an internal Electron/NSIS package under
  `release_packages`, but the current installer is unsigned.
- Phase 9 now replaces the Python updater with Electron UpdateManager, but a
  real signed N -> N+1 update has not been validated yet.
- legacy updater/package files exist in root.
- some current product files are untracked by Git in this workspace.

Do not distribute publicly until code signing, updater/licensing behavior and a
clean-machine install/startup test are verified.

## Third-Party Runtime

Use the bundled ADB and scrcpy runtime under:

```text
scrcpy-win64-v4.0/
```

Do not depend on Android Studio, SDK-installed ADB, `C:\adb` or an arbitrary ADB
from PATH.

Phase 6 C# rules:

- `AdbService` uses `FLOWDASHBOARD_ADB` or the bundled
  `scrcpy-win64-v4.0\adb.exe`.
- `ScrcpyService` uses `SCRCPY_PATH` or the bundled
  `scrcpy-win64-v4.0\scrcpy.exe`.
- ADB temp/log files default to `FLOWDASHBOARD_DATA_DIR\.adb_tmp`.
- C# must keep `/api/health` alive with degraded ADB status instead of crashing
  when ADB cannot start.

Phase 7 resource rules:

- Commercial staging is built with
  `scripts\build\prepare-commercial-resources.ps1`.
- The script copies runtime resources only into
  `build\staging\commercial-resources`.
- It rejects known local data and secret-bearing files such as
  `.supabase_config.json`, `.flowlogin_payloads`, device JSON files,
  `mail_config.json`, recordings, reports, restore points and SQL files.
- FlowAgent is staged as `android\flowagent\agent-v1.0.0-arm64-v8a.apk`.
- The universal FlowAgent APK is detected but excluded until a later explicit
  multi-ABI support decision.
- The staging step does not install APKs, launch FlowAgent, enable
  Accessibility, start MediaProjection or interact with connected devices.

Phase 8 installer rules:

- The installer is built by `scripts\build\build-electron-installer.ps1`.
- Electron Builder consumes only `electron-app` application files plus
  `build\staging\commercial-resources`.
- The packaged `app.asar` scan must stay clean of Supabase config,
  FlowLogin payloads, device JSON, `mail_config.json`, recordings, restore
  points, reports and SQL files.
- The current installer is intentionally unsigned for internal validation. A
  public release needs a real signing certificate and verified signature.
- Phase 8 packaging does not install APKs on devices, launch FlowAgent, enable
  Accessibility or start MediaProjection.

Phase 9 updater rules:

- Updates use `electron-updater` in Electron main, not Python `updater.py`.
- Provider is GitHub Releases for `ingestebandaza/FlowDashboard`.
- Legacy Python `/update-check` and `/update-status` are disabled shims only.
- `updater.py` is archived under `archive\legacy-updater\updater.py`.
- Before installing a downloaded update, Electron attempts to stop active
  recordings and calls RuntimeManager update preparation.
- Public update delivery requires Authenticode signing and a validated
  2.0.0 -> 2.0.1 release test.
