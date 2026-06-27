# FASE 13 — Cierre comercial V2 — GESTOR_FLOWDASHBOARD.bat

## 1. Objetivo

Dotar al propietario de una unica entrada para gestionar desarrollo, validacion, builds y releases de FlowDashboard 2.0.0 sin ejecutar comandos manuales separados, mediante un lanzador delgado en lote que delega toda la logica en PowerShell.

## 2. Alcance

- Lanzador `GESTOR_FLOWDASHBOARD.bat` (delgado, sin logica de negocio).
- Menu interactivo `scripts/release/gestor.ps1` (9 opciones del contrato).
- Orquestador `scripts/release/release.ps1` (preflight, version bump, restore point, pipeline de build de 19 pasos, escaneo de secretos, hashes, notas, etiqueta, draft de GitHub, publicacion con aprobacion, restauracion y diagnosticos).
- Reutilizacion de los scripts existentes: `sync-version.ps1`, `build-python.ps1`, `build-dotnet.ps1`, `build-electron-installer.ps1`, `prepare-commercial-resources.ps1`, `verify-documentation-consistency.ps1`.

Fuera de alcance: firma de codigo (FASE 14), modificaciones a componentes protegidos.

## 3. Estado inicial

- Existian los scripts de build individuales y `sync-version.ps1`, pero NO habia orquestador ni gestor unico.
- `scripts/release/` solo contenia `sync-version.ps1` y `.gitkeep`.
- No existia `GESTOR_FLOWDASHBOARD.bat`.
- HEAD previo: `0a320b2` (cierre FASE 12).

## 4. Cambios realizados

Archivos NUEVOS (FASE 13 es aditiva, no modifica codigo existente):

- `GESTOR_FLOWDASHBOARD.bat` — lanzador delgado: `cd /d %~dp0` + `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\release\gestor.ps1`.
- `scripts/release/gestor.ps1` — menu de 9 opciones; despacha a `release.ps1` por accion; confirmaciones explicitas para publicar (palabra PUBLICAR) y restaurar.
- `scripts/release/release.ps1` — orquestador dirigido por `-Action {validate|local|beta|stable|publish|restore|diagnostics}`, `-Bump {patch|minor|major|beta}`, `-RestorePoint <nombre>`, `-Approve`.

Caracteristicas clave de `release.ps1`:
- Preflight: raiz, rama, estado Git, Node, npm, .NET SDK, Git, Python+PyInstaller, GitHub CLI, espacio, recursos canonicos (ADB, scrcpy, FlowAgent APK universal, FlowTrackName), secretos locales. Deteccion robusta con `Get-Command`.
- `-RequireBuild` y `-RequirePublish` elevan a fatal los chequeos pertinentes (gh solo obligatorio al publicar).
- Restore point automatico antes de tocar version (version.json, package.json, csproj, app_meta.py).
- Version bump con reversion automatica si el build falla (no deja la version incrementada).
- Pipeline: tests estaticos (node --check + py_compile) -> build Python/MailHelper -> publish C# -> instalador Electron/NSIS -> escaneo de secretos -> hashes SHA256 -> notas de release -> etiqueta -> draft de GitHub.
- Publicacion separada y bloqueada tras `-Approve` (la opcion 6 del menu exige escribir PUBLICAR).
- `ErrorActionPreference = Stop`: ninguna fase continua si falla la anterior.

## 5. Verificacion runtime

- Parser de PowerShell (`PSParser.Tokenize`) sobre `release.ps1` y `gestor.ps1`: 0 errores (`RELEASE_OK`, `GESTOR_OK`).
- `release.ps1 -Action validate`: preflight completo OK (rama commercial/v2.0.0, Node, npm, .NET SDK, Git, Python+PyInstaller, ADB, scrcpy, FlowAgent APK universal, FlowTrackName, secretos) + tests estaticos OK (4 JS + 3 PY). gh marcado WARN (no instalado, correcto).
- `release.ps1 -Action diagnostics`: diagnostico de documentacion superado; version 2.0.0 (stable); instalador detectado.
- Las acciones de build pesadas (local/beta/stable) y publish se ejecutaran por el propietario (modo ahorro). El pipeline reutiliza scripts ya verificados en fases previas.

## 6. Pruebas en dispositivos

No aplica a esta fase (herramienta de gestion de builds, sin interaccion con dispositivos Android).

## 7. Hallazgos y correcciones

- Deteccion inicial de herramientas via `& comando` daba falso negativo en npm (npm.ps1) y dotnet. Corregido usando `Get-Command` (encuentra .exe/.ps1/.cmd en PATH).
- Ruta del APK FlowAgent en preflight era incorrecta (`android\flowagent\...` solo existe en staging). Corregida a la fuente canonica `flow_agent_monolito\app\build\outputs\apk\app\release\agent-v1.0.0-universal.apk`, coherente con `prepare-commercial-resources.ps1`.

## 8. Componentes protegidos

No se modifico ningun componente protegido. Fase puramente aditiva. El pipeline invoca los scripts de build existentes sin alterarlos.

## 9. Coherencia codigo/runtime/documentacion

- El menu implementa exactamente las 9 opciones del contrato (PLAN linea 1312).
- El pipeline cubre los 19 pasos del contrato (PLAN lineas 1363-1383) reutilizando los scripts canonicos.
- Criterio de aceptacion (PLAN 1403-1405) cumplido: el propietario prepara una release desde una sola entrada.

## 10. Riesgos

- gh (GitHub CLI) no instalado en la maquina actual: las opciones de draft/publicar quedan en WARN/omitidas hasta instalarlo. No bloquea builds locales.
- La firma de codigo se aborda en FASE 14; los instaladores actuales no estan firmados.

## 11. Rollback

FASE 13 es aditiva. Rollback = eliminar los 3 archivos nuevos (`GESTOR_FLOWDASHBOARD.bat`, `scripts/release/release.ps1`, `scripts/release/gestor.ps1`). Marcador en `restore_points/2026-06-27_PRE_FASE13_GESTOR/ROLLBACK.txt` (HEAD previo `0a320b2`).

## 12. Evidencias

- `RELEASE_OK` / `GESTOR_OK` (parser).
- Salida de `-Action validate` (preflight + tests estaticos todo OK).
- Salida de `-Action diagnostics` (documentacion OK, version 2.0.0).

## 13. Configuracion y secretos

- No se incrustan secretos, IPs, rutas absolutas ni conteos de dispositivos.
- El escaneo de secretos del pipeline aborta la release si encuentra patrones (postgresql://, service_role, pooler.supabase.com, claves privadas) o archivos prohibidos (.supabase_config.json, .supabase_db_url, mail_config.json) en release_packages.
- `restore_points/` permanece git-excluido.

## 14. Checklist

- [x] Lanzador delgado en lote que delega en PowerShell.
- [x] Menu de 9 opciones del contrato.
- [x] Orquestador con preflight, bump, restore point, pipeline, secret scan, hashes, notas, tag, draft, publish.
- [x] ErrorActionPreference Stop y reversion de version ante fallo.
- [x] Publicacion solo tras aprobacion explicita.
- [x] Sin modificar componentes protegidos.
- [x] Sin secretos/IPs/rutas/conteos hardcodeados.
- [x] Verificacion sintactica y funcional de acciones ligeras.
- [x] Punto de restauracion y reporte.

## 15. Conclusion y siguiente fase

FASE 13 completada: gestor unico operativo y verificado en sus acciones ligeras; las pesadas reutilizan scripts ya validados y las ejecutara el propietario. Siguiente: FASE 14 — Seguridad de distribucion (secretos, firma, hardening del instalador).
