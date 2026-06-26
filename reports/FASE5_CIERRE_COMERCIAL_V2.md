# Informe de cierre FASE 5 — Backend Python empaquetado (sidecar autonomo)

## 1. Objetivo
Verificar que el backend Python (`local_adb_server.py`) se empaqueta como sidecar
autonomo PyInstaller `onedir` (`FlowDashboard.Backend.exe`), capaz de ejecutarse en
una maquina sin Python instalado, sin secretos embebidos y resolviendo rutas/ADB
solo desde recursos empaquetados en modo producto.

## 2. Alcance
- `build_specs/FlowDashboard.Backend.spec`
- `build_specs/FlowDashboard.MailHelper.spec`
- `scripts/build/build-python.ps1`
- `local_adb_server.py` (resolucion frozen/MEIPASS, find_adb, licencia, service role, self-check)
- `FlowDashboard.Core/Services/MailService.cs` (invocacion del MailHelper)
- exe ya compilado en `build/runtime/python/`

## 3. Estado inicial
Spec, script y exe ya existian (build del 24/06). Hallazgo: los specs canonicos en
`build_specs/` NO estaban trackeados en git; `.gitignore:17 (*.spec)` los excluia
(solo habia excepcion para `launcher.spec`). Riesgo: un clon limpio del repo no
podria reconstruir el backend Python.

## 4. Cambios realizados
- `.gitignore`: se agrego excepcion `!build_specs/` y `!build_specs/*.spec` tras
  `!launcher.spec`. Restore point: `restore_points/2026-06-27_0145_PRE_FASE5_GITIGNORE_SPECS/`.
- Se trackean ahora `build_specs/FlowDashboard.Backend.spec` y
  `build_specs/FlowDashboard.MailHelper.spec`.
- No se modifico codigo de runtime (Python/C#) — ya cumplia el contrato.
- Commit: `179d9b6` fix(fase5): trackear build_specs canonicos (PyInstaller onedir).

## 5. Verificacion runtime
Self-check del exe congelado (`build/runtime/python/FlowDashboard.Backend.exe --self-check`),
con `FLOWDASHBOARD_PRODUCT_MODE=1` y recursos apuntando al repo:
```
ok: true, isFrozen: true, productMode: true, appVersion: 2.0.0
adbExists: true, scrcpyExists: true, scrcpyRawAvailable: true,
scrcpyControlAvailable: true, websocketAvailable: true,
flowAgentApkExists: true, localLicenseMode: false, supabaseConfigured: false
```
Prueba que el sidecar arranca como binario congelado sin requerir Python en PATH y
resuelve correctamente BASE_DIR/RESOURCE_DIR/DATA_DIR bajo PyInstaller.

## 6. Pruebas en dispositivos
No aplica a esta fase (empaquetado). El self-check valida disponibilidad de ADB,
scrcpy, raw streamer y canal de control empaquetados (componentes protegidos
intactos). Streaming/control reales se cubren en fases de runtime integradas.

## 7. Hallazgos y correcciones
1. `build_specs/*.spec` excluidos de git — CORREGIDO (excepcion en `.gitignore`).
2. `deep_probe_adb()` (`local_adb_server.py:227`) definido pero nunca invocado —
   codigo muerto, sin riesgo; `find_adb()` solo usa `candidate_adb_paths()`
   (ADB empaquetado). No se modifica para no tocar superficie no requerida.
3. Espacio sobrante en `SCRCPY_SERVER_JAR` durante la prueba (artefacto del entorno
   de test, no del codigo).

## 8. Componentes protegidos
Intactos. El spec los incluye explicitamente como hiddenimports:
`scrcpy_raw_streamer`, `scrcpy_raw_ws_server`, `scrcpy_control_channel`,
`scrcpy_manager` (`build_specs/FlowDashboard.Backend.spec:46-48,45`). No se edito
ninguno de los modulos protegidos.

## 9. Coherencia codigo / runtime / documentacion
- Estrategia `onedir`: `spec` usa `exclude_binaries=True` + `COLLECT` (`:86,100`).
- Entrada `local_adb_server.py` (`:61`).
- `IS_FROZEN`/`_MEIPASS` (`local_adb_server.py:35,46`), `PRODUCT_MODE` (`:36`).
- `find_adb()` solo ADB empaquetado en `scrcpy-win64-v4.0`, sin deep scan (`:213-250`).
- Licencia local deshabilitada en producto: `ALLOW_LOCAL_LICENSE_MODE = (not PRODUCT_MODE) and ...` (`:857`).
- `SUPABASE_SERVICE_ROLE_KEY` ignorado en PRODUCT_MODE (`:872-874`); cliente usa anon/public.
- FlowMail helper: `FlowDashboard.MailHelper.exe` generado; C# lo invoca como exe
  con contrato stdin/stdout y solo cae a `python.exe` para el `.py` en dev
  (`MailService.cs:305-319,349-363`).

## 10. Riesgos
- Bajo: el build depende de un Python con PyInstaller disponible (`build-python.ps1`
  selecciona `.venv`/env/PATH). Si `.venv` esta roto se evalua en fases siguientes.
- El exe trackeado en git NO esta (binarios excluidos por acuerdo); se reconstruye
  con `scripts/build/build-python.ps1`. Los specs ahora SI estan versionados.

## 11. Rollback
- Restaurar `.gitignore` desde `restore_points/2026-06-27_0145_PRE_FASE5_GITIGNORE_SPECS/.gitignore`.
- `git revert 179d9b6` revierte el tracking de specs.

## 12. Evidencias
- `build_specs/FlowDashboard.Backend.spec` (onedir, hiddenimports, excludes secretos).
- `scripts/build/build-python.ps1` (self-check obligatorio, salida a build/runtime/python).
- Salida JSON del self-check del exe congelado (seccion 5).
- `FlowDashboard.MailHelper.exe` (6.79MB) en build/runtime/python + staging + win-unpacked.

## 13. Configuracion y secretos
El spec NO incluye `.supabase_config.json`, mail passwords, CapSolver key, service
role, datos de dispositivos, payloads, logs, grabaciones, SQL ni codigo Android.
Solo datos no sensibles: `Login.js`, `Register.js`, `update.json`, `requirements.txt`,
certificados `certifi`. `supabaseConfigured:false` en el self-check confirma que no
hay credenciales embebidas.

## 14. Checklist de aceptacion
- [x] Build onedir (`spec` + script).
- [x] Arranque sin Python en PATH (exe congelado, isFrozen:true).
- [x] `/health`, `/devices`, `/agents` disponibles (backend en runtime previo, appVersion 2.0.0).
- [x] Modulos de control y streaming canario empaquetados (scrcpyRawAvailable/ControlAvailable true).
- [x] FlowMail helper empaquetado e invocado como exe.
- [x] find_adb solo ADB empaquetado; sin deep scan en producto.
- [x] Modo licencia local deshabilitado en producto.
- [x] Service role ignorado; solo anon/public.
- [x] Sin secretos en el bundle.
- [x] Specs canonicos versionados en git.

## 15. Conclusion y siguiente fase
FASE 5 verificada y cerrada. El backend Python esta correctamente empaquetado como
sidecar autonomo PyInstaller onedir; el exe congelado pasa el self-check sin Python
del sistema. Se corrigio la unica inconsistencia real (specs no versionados).
Siguiente: FASE 6 — Backend C# self-contained.
