# Legacy Index

STATUS: CURRENT
Last verified against code: 2026-06-27
Last verified against runtime: 2026-06-27
Canonical replacement: N/A
Owner: FlowDashboard

Date: 2026-06-27

This index classifies files that should not be treated as current architecture
unless a fresh runtime verification proves otherwise. The original Phase 1 only
marked candidates; a later cleanup actually moved several of them into the
`archive/` buckets. The path column below reflects the real current location as
re-verified on 2026-06-27 (some files now live under `archive/`, others are
still at the repository root).

Before moving any listed file:

1. Search references across the repository.
2. Register known consumers here.
3. Confirm if runtime uses the path.
4. Keep a shim if a current path still depends on it.
5. Validate `abrir_electron.bat`.

## Source Of Truth

Current sources:

- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- `docs/master_technical_specification.md`
- `docs/current/*`

Forbidden as current source:

- `DOCUMENTACION_TECNICA.md`

## Legacy Dashboard

| Path | Classification | Consumers found in Phase 1 | Handling |
|---|---|---|---|
| `archive/legacy-dashboard/wsapi_demo.html` | legacy dashboard | no exact live text references found outside snapshots/reports | Moved to archive on cleanup. Do not add features; keep only for history/migration reference. |
| `archive/legacy-dashboard/wsapi.js` | legacy helper | no exact live text references found outside snapshots/reports | Moved to archive on cleanup. Do not use for new Electron work. |
| `diagnostico_streaming.html` | diagnostic legacy | candidate diagnostic page | Keep out of product runtime. |
| `license_admin.html` | admin/legacy-adjacent | not classified as product runtime in Phase 1 | Verify before moving; may become admin work in later phases. |

## Legacy Launchers And Packaging

| Path | Classification | Consumers found in Phase 1 | Handling |
|---|---|---|---|
| `abrir_dashboard.bat` | legacy launcher | no exact live text references found outside snapshots/reports | Official launcher is `abrir_electron.bat`. |
| `abrir_dashboard.ps1` | legacy launcher | no exact live text references found outside snapshots/reports | Keep until all users/scripts migrate. |
| `abrir_dashboard_pro.bat` | legacy launcher | candidate legacy | Do not use as official launcher. |
| `INICIAR_FLOWDASHBOARD.bat` | legacy launcher | no exact live text references found outside snapshots/reports | Do not use as official launcher. |
| `INICIAR_FLOWDASHBOARD.ps1` | legacy launcher | no exact live text references found outside snapshots/reports | Do not use as official launcher. |
| `launcher.py` | legacy Python launcher | moved to `archive/legacy-launchers/launcher.py` | Old packaging path. |
| `launcher.spec` | legacy PyInstaller spec | still at repository root | Old packaging path. |
| `Crearexe.bat` | legacy packager | moved to `archive/legacy-launchers/Crearexe.bat` | Old packaging path. |
| `FlowDashboard.exe` | unverified legacy binary | no exact live text references found outside snapshots/reports | Do not treat as current product until verified. |

## Legacy Updater

| Path | Classification | Consumers found in Phase 1 | Handling |
|---|---|---|---|
| `archive/legacy-launchers/CrearActualizacion.bat` | legacy updater | moved to archive on cleanup | Superseded by future commercial release pipeline. |
| `archive/legacy-updater/updater.py` | archived legacy updater | Python `/update-check` now returns `legacy_updater_disabled`; Electron uses `electron-updater`. | Historical only; do not restore as active updater. |
| `archive/legacy-updater/update_config.json` | updater config | moved to archive; dev data root keeps its own copy | Do not expose secrets if any are added later. |
| `archive/legacy-updater/update_config.example.json` | updater example | moved to archive on cleanup | Keep only if later updater uses it. |

## SQL And Supabase Artifacts

| Path | Classification | Handling |
|---|---|---|
| `supabase_ELIMINAR_TODO.sql` | destructive SQL | Do not run casually; archive candidate. |
| `supabase_ELIMINAR_TODAS_FIRMAS.sql` | destructive SQL | Do not run casually; archive candidate. |
| `supabase_CREAR_FUNCION.sql` | historical SQL | Verify against current schema before use. |
| `supabase_CREAR_FUNCION_SIN_DIGEST.sql` | historical SQL | Verify against current schema before use. |
| `supabase_HABILITAR_PGCRYPTO.sql` | setup SQL | Verify before use. |
| `supabase_license_rpc.sql` | license SQL | Verify before use. |
| `supabase_license_rpc_LIMPIO.sql` | license SQL | Verify before use. |

## Historical Notes

These root-level note patterns are historical and should not override the
current spec:

- `PASOS_*`
- `LISTO_*`
- `SOLUCION_*`
- `PRUEBA_*`
- `RESUMEN_*`
- `INSTRUCCIONES_*`
- `COMIENZA_AQUI_*`
- `LEEME_*`
- `ESTADO_ACTUAL_EJECUCION.txt`
- `ESTRUCTURA_ARCHIVOS.txt`
- `ARQUITECTURA_*.txt`

Use `docs/current/*` and `docs/master_technical_specification.md` instead.

## Experiments, Hotfixes And Diagnostics

Candidate legacy/diagnostic patterns:

- `hotfix*`
- `spike*`
- `dump*`
- `window_dump*`
- `check_*.ps1`
- `diagnose_*.ps1`
- `diag_*.ps1`
- `find_*.ps1`
- `fix_*.py`
- `test_*.py`
- `test_*.ps1`
- `test_*.bat`
- generated `.out`, `.err`, `.log`, `.csv` files

Some diagnostics may still be useful. Move them only after checking references
and deciding whether they belong in `scripts/diagnostics/`.

## Redundant Runtime Copies

| Path | Classification | Handling |
|---|---|---|
| root `scrcpy-server` | redundant copy | Current runtime should use `scrcpy-win64-v4.0\scrcpy-server.jar`. |
| root `scrcpy-server.jar` | redundant copy | Current runtime should use `scrcpy-win64-v4.0\scrcpy-server.jar`. |

Do not remove these until launcher/backend references are rechecked.

## Evidence

Phase 1 generated candidate evidence here:

```text
restore_points\2026-06-23_080721_PRE_COMMERCIAL_PHASE1_CANON_LEGACY\evidence\legacy-candidates-phase1.json
```
