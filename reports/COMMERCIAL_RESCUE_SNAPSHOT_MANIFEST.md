# Manifiesto de Rescate (Dry Run)

## Evaluación de Estado

He aplicado exclusiones severas a `.gitignore` para eliminar `.venv`, `node_modules`, `dist`, bases de datos SQLite (`.db`), `logs`, y datos de prueba descubiertos (`test/`, `scratch/`, `*.mp4`, `*.png`, `*dump*.xml`). 

Sin embargo, el dry-run revela los siguientes tipos de archivos en estado untracked:

1. **Archivos Comerciales Legítimos (TRACKED_OK):**
   - `electron-app/` (fuentes, `package.json`, `index.js`, `runtime-manager.js`)
   - `FlowDashboard.Core/` (fuentes de C#)
   - `docs/` y `archive/`
   - `version.json`, `update.json`, `updater.py`
   - `abrir_electron.bat`, `abrir_electron.ps1`
   - `scrcpy-win64-v4.0/` (binarios base scrcpy)
   - `flow_agent_monolito/` (fuentes y APK)

2. **Archivos Ambiguos / Test (EXCLUSION_PENDING / DETENTE):**
   - **Scripts Ad-Hoc:** Múltiples `.ps1` en la raíz (ej. `start_capture_all.ps1`, `setup_adb_reverse.ps1`, `matar_puertos.ps1`, `install_apk_all.ps1`). Son evidentemente scripts temporales de diagnóstico/pruebas de fases pasadas.
   - **SQL Scripts:** `supabase_CREAR_FUNCION.sql`, `supabase_ELIMINAR_TODO.sql`, etc. Podrían contener referencias a entorno real.
   - **Archivos de Prueba Python/JS:** `test_concurrent.py`, `test_backend_streaming.py`, `votos.js`, `test.js`.
   - **Artefactos Locales:** `usb_inventory.json`, `temp_dopost.txt`, `.err` y `.out` como `server_start.err`.

## Decisión de Seguridad (FASE B)

**ESTADO: AMBIGUO.**

Cumpliendo tu regla estricta: *"Si aparece cualquier secreto, dato de cliente o archivo ambiguo, detente y no hagas commit"*. 

Como la raíz del proyecto está llena de scripts de prueba, SQLs y archivos `.ps1` ambiguos que no forman parte del entregable limpio comercial de `electron-app/` o `FlowDashboard.Core/`, **he detenido la creación de la rama y no he ejecutado `git add` ni `git commit`**.

El Restore Point (FASE A) ha sido creado exitosamente en `restore_points/2026-06-24_2025_PRE_RUNTIME_MANAGER_HOTFIX`.

Espero tu decisión sobre si añado estos archivos ambiguos al `.gitignore` o si procedemos directamente con la reparación del `RuntimeManager` (Fases C-G) en el working tree actual sin forzar el commit de rescate ahora.
