# Release Notes - FlowDashboard 2.0.0

STATUS: CURRENT
Last verified against code: 2026-06-24
Last verified against runtime: 2026-06-24
Canonical replacement: N/A
Owner: FlowDashboard

## Commercial Migration

- Unified application version source through version.json.
- Synchronized Electron, Python metadata, C# assembly metadata and update manifest to 2.0.0.
- Runtime packaging now includes Python, C#, commercial resources and an internal unsigned Electron/NSIS installer under `release_packages`.
- Update management now uses Electron `electron-updater` with GitHub Releases; the legacy Python updater was archived.
- Code signing, clean-machine installation validation, real N -> N+1 update validation, entitlements and admin panel remain in later phases.

