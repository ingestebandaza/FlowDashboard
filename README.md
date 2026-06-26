# FlowDashboard

STATUS: CURRENT
Last verified against code: 2026-06-23
Last verified against runtime: 2026-06-23
Canonical replacement: N/A
Owner: FlowDashboard

FlowDashboard is the Electron dashboard currently used to manage Android devices,
manual control, Grid/Focus video, FlowLogin automation and commercial licensing
work.

## Start Here

Before changing this repository, read these files in this order:

1. `AGENTS.md`
2. `PROJECT_CONTEXT.md`
3. `docs/master_technical_specification.md`
4. `docs/current/CURRENT_ARCHITECTURE.md`
5. `docs/current/REPOSITORY_MAP.md`

`DOCUMENTACION_TECNICA.md` is legacy/prohibited as a current technical source.
Do not use it to make implementation decisions.

## Current Product

- Current product: Electron dashboard in `electron-app/`.
- Official launcher: `abrir_electron.bat`.
- Python backend: `local_adb_server.py` on port `8765`.
- C# backend: `FlowDashboard.Core` on port `5000`.
- Current Grid/Focus video: scrcpy H.264 raw/frame_meta via Python WS `8768`.
- Current manual control: scrcpy-control via `/control/*`, with ADB input as safe fallback.
- FlowAgent is for automation, FlowLogin, scripts, intelligent dumps, FlowKeyboard,
  OCR/template workflows and technical comparison. It is not an automatic fallback
  for manual control.

## Canonical Documentation

- `docs/current/CURRENT_ARCHITECTURE.md`: active runtime architecture.
- `docs/current/REPOSITORY_MAP.md`: what each top-level area is for.
- `docs/current/DEVELOPMENT_START.md`: how to start the project safely.
- `docs/current/BUILD_AND_RELEASE.md`: current build/release state and gaps.
- `docs/current/SECURITY.md`: security rules for local secrets, licensing and distribution.
- `archive/LEGACY_INDEX.md`: files treated as legacy, experimental or historical.

## Commercial Plan

The commercial 2.0.0 migration is phase-gated by:

- `PLAN_MAESTRO_IMPLEMENTACION_COMERCIAL_FLOWDASHBOARD_2.0.0.md`
- `ANEXO_CONTROL_COHERENCIA_CODIGO_RUNTIME_DOCUMENTACION.md`

Phase 1 classified the repository and created the canonical documentation
structure without modifying protected runtime video/control code.
