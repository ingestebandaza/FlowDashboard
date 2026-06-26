# Informe de cierre - FASE 1 (Clasificacion canonica y archivo legacy)

Proyecto: FlowDashboard 2.0.0 (producto comercial)
Rama: commercial/v2.0.0
Fecha: 2026-06-27
Documento gobernante: PLAN_MAESTRO (Fase 1, linea 312) + ANEXO (formato seccion 14)

---

## 1. Objetivo de la fase

Evitar que personas o IAs confundan componentes vigentes con experimentos o productos antiguos: estructura canonica de carpetas (docs/, archive/, scripts/, build/), documentos obligatorios y clasificacion de archivos legacy sin romper rutas de runtime.

## 2. Alcance

Incluye: verificacion de la estructura y documentos creados por una ejecucion previa, comprobacion de su exactitud contra el codigo/runtime real, y correccion de discrepancias en la documentacion. Excluye: cambios funcionales y mover archivos de runtime (solo se ajusto documentacion).

## 3. Estado inicial encontrado

La estructura y los documentos obligatorios YA existian (creados por una ejecucion previa):
- docs/current/ (CURRENT_ARCHITECTURE.md, REPOSITORY_MAP.md, DEVELOPMENT_START.md, BUILD_AND_RELEASE.md, SECURITY.md, RUNTIME_CODE_DOCUMENTATION_MATRIX.md), docs/commercial/, docs/architecture/.
- archive/ (legacy-dashboard, legacy-launchers, legacy-updater, legacy-sql, experiments) + LEGACY_INDEX.md.
- scripts/ (dev, build, release, diagnostics), build/ (runtime, staging).
- README.md raiz.
Conforme al mandato, NO se confio en estos documentos: se verificaron contra el codigo real.

## 4. Cambios realizados (solo documentacion)

1. CURRENT_ARCHITECTURE.md: anadido el comportamiento de auto-reconexion/escaneo de dispositivos al arrancar (fix de FASE 0), con la variable FLOWDASHBOARD_DISABLE_AUTO_SCAN; fechas verificadas a 2026-06-27.
2. DEVELOPMENT_START.md: misma nota de auto-recuperacion de conexiones Wi-Fi al reiniciar puertos; fechas a 2026-06-27.
3. REPOSITORY_MAP.md: h264_canary_config.json reclasificado como config local opcional gitignored (especifica del entorno, frameMetaSerials); actualizadas ubicaciones reales de legacy movidos a archive/; fechas a 2026-06-27.
4. LEGACY_INDEX.md: corregido el texto que afirmaba "sin mover" archivos (varios SI fueron movidos a archive/ en una limpieza posterior); columnas de ruta actualizadas a su ubicacion real; fechas a 2026-06-27.
Commit: fc7bcf6.

## 5. Verificacion en runtime

Producto en ejecucion durante la fase (lanzado con abrir_electron.bat). Health tras los cambios: C# /api/health ok v2.0.0; Python /health ok; /devices = 17. Los cambios son solo documentales y no alteran el runtime.

## 6. Pruebas de dispositivos

Sin impacto en dispositivos. Se confirmo conectividad (17 dispositivos) como evidencia de que la documentacion editada no afecto el funcionamiento.

## 7. Hallazgos y discrepancias corregidas

- Documentos obligatorios y scripts/specs referenciados existen todos (build-python.ps1, build-dotnet.ps1, prepare-commercial-resources.ps1, build-electron-installer.ps1, sync-version.ps1, verify-documentation-consistency.ps1, *.spec, AppPaths.cs, path-resolver.js, runtime-manager.js, update-manager.js, archive/legacy-updater/updater.py).
- El lanzador define FLOWDASHBOARD_DATA_DIR=scratch\flowdashboard-data-runtime y FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART=1 (abrir_electron.ps1:12,34,35): coincide con la doc.
- Discrepancia 1: h264_canary_config.json documentado como "current config" pero esta gitignored y contiene IPs especificas del cliente. Correcto que este gitignored (sin IPs hardcodeadas en git); se aclaro en la doc.
- Discrepancia 2: la doc afirmaba que FASE 1 no movio archivos, pero wsapi*, launcher.py, Crearexe.bat, CrearActualizacion.bat y update*.json fueron movidos a archive/. Corregidas rutas en LEGACY_INDEX y REPOSITORY_MAP.
- Falta de reflejo del fix de FASE 0 (auto-reconexion al arrancar): anadido a la doc.

## 8. Componentes protegidos

No se modifico ninguno. Cambios exclusivamente en archivos .md de documentacion.

## 9. Coherencia codigo / runtime / documentacion

- Coherencia restablecida en los documentos canonicos (rutas legacy reales, config local, comportamiento de arranque).
- Item de coherencia de bajo riesgo pendiente (no bloqueante): path-resolver.js:11 mantiene update_config.json en la allowlist de migracion desde la raiz, pero el archivo se movio a archive/legacy-updater/. En desarrollo el data root ya tiene su copia (migracion no necesaria); en empaquetado el updater crea su propia config. No rompe nada; se documenta para revisarlo si se reorganiza el updater.
- RUNTIME_CODE_DOCUMENTATION_MATRIX.md contiene afirmaciones "VERIFIED" sobre empaquetado de fases 5-9 que NO se re-verificaron aqui; se re-comprobaran en sus fases y se corregira el matrix si procede.

## 10. Riesgos y mitigaciones

- Riesgo: rutas legacy en docs podian inducir a buscar archivos en raiz que ya estan en archive/. Mitigado: rutas corregidas.
- Riesgo: confiar en claims "VERIFIED" no comprobados del matrix. Mitigado: se re-verificaran en fases 5-9.

## 11. Rollback

git revert fc7bcf6 restaura la documentacion previa. No hay cambios de codigo ni de runtime que revertir.

## 12. Evidencias

- Verificacion de existencia de documentos/scripts/specs (todos OK).
- Localizacion real de legacy: archive/legacy-dashboard/{wsapi.js,wsapi_demo.html}, archive/legacy-launchers/{launcher.py,Crearexe.bat,CrearActualizacion.bat}, archive/legacy-updater/{updater.py,update.json,update_config.json,update_config.example.json}; aun en raiz: launcher.spec, FlowDashboard.exe, abrir_dashboard*, INICIAR_FLOWDASHBOARD*, supabase_*.sql (7).
- Health post-cambios: C# ok v2.0.0, Python ok, 17 dispositivos.
- Commit fc7bcf6.

## 13. Configuracion / secretos

Sin cambios. h264_canary_config.json (IPs del entorno) correctamente gitignored; SECURITY.md sin modificar.

## 14. Checklist de aceptacion FASE 1

- [x] Estructura docs/current, docs/commercial, docs/architecture presente.
- [x] archive/ con buckets legacy-dashboard/-launchers/-updater/-sql/experiments + LEGACY_INDEX.md.
- [x] scripts/ (dev/build/release/diagnostics) y build/ (runtime/staging) presentes.
- [x] Documentos obligatorios presentes: README, CURRENT_ARCHITECTURE, REPOSITORY_MAP, DEVELOPMENT_START, BUILD_AND_RELEASE, SECURITY, archive/LEGACY_INDEX.
- [x] Documentacion verificada contra codigo real y discrepancias corregidas.
- [x] DOCUMENTACION_TECNICA.md marcado como prohibido como fuente.
- [x] Lanzador oficial validado (producto operativo, 17 dispositivos).
- [x] Criterio de aceptacion: otra IA puede identificar en <5 min producto vigente, launcher, backends, recursos, legacy y fuentes de verdad.

## 15. Conclusion y siguiente fase

FASE 1 cerrada. La estructura canonica ya existia y es valida; se corrigieron las discrepancias de documentacion detectadas para que reflejen el flujo y la ubicacion reales. Siguiente: FASE 2 (versionado unico 2.0.0), PLAN_MAESTRO linea 390 — verificar que version.json es la unica fuente de verdad y que todos los objetivos sincronizados (package.json, app_meta.py, csproj, update-manager.js, etc.) coinciden en 2.0.0.
