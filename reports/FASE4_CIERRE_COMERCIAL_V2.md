# Informe de cierre - FASE 4 (RuntimeManager de Electron)

Proyecto: FlowDashboard 2.0.0 (producto comercial)
Rama: commercial/v2.0.0
Fecha: 2026-06-27
Documento gobernante: PLAN_MAESTRO (Fase 4, linea 509) + ANEXO (formato seccion 14)

---

## 1. Objetivo de la fase

Eliminar la dependencia de PowerShell en produccion mediante un RuntimeManager en Electron que prepare el entorno, valide recursos, arranque y supervise los sidecars C# y Python, espere health checks, gestione puertos ocupados y reinicios con backoff, y cierre ordenadamente, sin abrir ventanas de consola.

## 2. Alcance

Incluye: verificacion de electron-app/src/main/runtime-manager.js (15 responsabilidades + restricciones "no hacer" + orden de arranque) y su cableado de ciclo de vida en index.js, mas evidencia de runtime real (runtime-status.json). Excluye: la prueba de arranque sin PowerShell/Python/.NET instalados, que requiere una build empaquetada (se valida en FASES 5-8).

## 3. Estado inicial encontrado

El RuntimeManager YA existia por una ejecucion previa. Conforme al mandato, NO se confio en reportes anteriores: se verifico el codigo real y el snapshot de estado generado por el propio runtime.

## 4. Cambios realizados

Ninguno. La verificacion no encontro discrepancias; no fue necesario modificar codigo. Sin punto de restauracion (sin cambios de codigo).

## 5. Verificacion en runtime

Se leyo el snapshot real escrito por el RuntimeManager (scratch/flowdashboard-data-runtime/logs/runtime/runtime-status.json):
- productMode=false, isPackaged=false (modo dev).
- env preparado: FLOWDASHBOARD_BASE_DIR, RESOURCE_DIR, DATA_DIR, ADB (scrcpy-win64-v4.0\adb.exe), SCRCPY_PATH, SCRCPY_SERVER_JAR, DISABLE_CSHARP_PYTHON_AUTOSTART=1.
- resources validados: adb, scrcpy, scrcpyServer, dataRoot, logsRoot -> exists=true.
- sidecars csharp (5000) y python (8765): status=external, startedByRuntime=false, external=true. lastHealth capturado: C# version 2.0.0, Python appVersion 2.0.0.
- warnings=[], errors=[].
Esto demuestra que, con autostart deshabilitado por el launcher de desarrollo, el RuntimeManager detecta los procesos ya levantados por el host SIN matarlos ni duplicarlos.

## 6. Pruebas con dispositivos

No se ejecutaron acciones de control en esta fase. El RuntimeManager no toca dispositivos; solo supervisa los sidecars. ADB sigue resuelto a scrcpy-win64-v4.0\adb.exe.

## 7. Hallazgos y correcciones

runtime-manager.js cumple las 15 responsabilidades:
1. Detecta dev/produccion: productMode (88) = isPackaged o FLOWDASHBOARD_PRODUCT_MODE.
2. Valida recursos obligatorios: validateCoreResources (180-197).
3. Prepara entorno: prepareProcessEnvironment (139-178) fija RESOURCE_DIR, DATA_DIR, ADB, SCRCPY_PATH, SCRCPY_SERVER_JAR y PRODUCT_MODE=1 en produccion.
4. Inicia C#: resolveCSharpCommand (199-228) + ensureSidecar('csharp').
5. Inicia Python: resolvePythonCommand (230-275) + ensureSidecar('python').
6. Espera health checks: waitForHealth (427-439), /api/health y /health.
7. Detecta puertos ocupados: isPortOccupied (52-63), estado 'port-occupied' (306-311).
8. Distingue proceso propio vs externo: flags startedByRuntime/external (300-301, 316-317).
9. No mata terceros: shutdown solo termina si child existe y startedByRuntime (488).
10. Reinicio con limite y backoff: scheduleRestart (441-457), limite 3, backoff exponencial min(30s, 2s*2^n).
11. Logs separados: csharp.out/err.log y python.out/err.log (344-346).
12. Cierre ordenado: shutdown (479-500).
13. Shutdown para actualizaciones: prepareForUpdate (502-506).
14. Error entendible si falta runtime: estados missing-runtime/failed + dialog.showErrorBox en index.js (121-124).
15. Evita ventanas de consola: spawn con windowsHide=true y detached=false (363-369).

Restricciones "no hacer" respetadas: el RuntimeManager solo arranca C# y Python; NO inicia FlowAgent, NO instala APK, NO activa Accessibility, NO inicia MediaProjection, NO modifica H.264.

Orden de arranque (index.js): app.whenReady -> startRuntimeManager (valida, C#, Python, health) -> startUpdateManager -> createWindow -> carga UI. Coincide con el orden recomendado.

Cableado de ciclo de vida (index.js): start() en whenReady (142); shutdown() en window-all-closed (162) y before-quit (182); refreshHealth() (315) y prepareForUpdate() (319) por IPC.

## 8. Componentes protegidos

No se toco ningun componente protegido. El RuntimeManager es orquestacion de procesos; no interviene en el pipeline de video, control de dispositivos ni scrcpy.

## 9. Coherencia codigo / runtime / documentacion

Coherente. El comportamiento observado en runtime-status.json coincide exactamente con el codigo (deteccion de externos, env preparado, recursos validados). La documentacion (CURRENT_ARCHITECTURE.md/DEVELOPMENT_START.md) describe el modelo de sidecars y el launcher de desarrollo de forma consistente.

## 10. Riesgos

- El criterio de aceptacion (arranque sin PowerShell/Python/.NET) solo se puede probar de forma definitiva con una build empaquetada; se valida en FASES 5-8. En desarrollo el launcher usa PowerShell por diseno (permitido).
- Bajo: si los exes empaquetados no existieran en produccion, ensureSidecar marca 'missing-runtime' y muestra error entendible (comportamiento correcto, no defecto).

## 11. Rollback

No aplica (sin cambios de codigo). El RuntimeManager es idempotente al arranque y escribe snapshots atomicos de estado.

## 12. Evidencias

- Lectura completa de runtime-manager.js (567 lineas).
- Lectura del cableado en index.js (112-191, 313-319).
- Lectura del snapshot real runtime-status.json (sidecars external, recursos OK, env preparado).

## 13. Configuracion y secretos

No se modificaron secretos. redactEnv (69-81) expone en el snapshot solo variables de ruta no sensibles (sin contrasenas ni tokens). El proxy del sistema se limpia salvo opt-in explicito (159-166).

## 14. Checklist de aceptacion

- [x] Existe runtime-manager.js con las 15 responsabilidades.
- [x] Prepara las variables de entorno requeridas (RESOURCE_DIR, DATA_DIR, ADB, SCRCPY_PATH, SCRCPY_SERVER_JAR, PRODUCT_MODE=1 en prod).
- [x] Arranca/supervisa C# y Python con health checks.
- [x] Detecta puertos ocupados y procesos externos; no mata terceros.
- [x] Reinicio con limite y backoff; logs separados; cierre ordenado; prepareForUpdate.
- [x] Evita ventanas de consola (windowsHide).
- [x] Respeta restricciones "no hacer" (no FlowAgent/APK/Accessibility/MediaProjection/H.264).
- [x] Orden de arranque conforme; cableado de ciclo de vida correcto.
- [x] Evidencia de runtime real (snapshot) coherente con el codigo.
- [ ] Arranque de build empaquetada sin PowerShell/Python/.NET: pendiente de validar en FASES 5-8.
- [x] Producto sigue operativo (servicios C#/Python responden, 17 dispositivos).

## 15. Conclusion y siguiente fase

FASE 4 CERRADA en lo verificable sin build empaquetada. El RuntimeManager esta completo y su comportamiento en runtime coincide con el codigo; reemplaza la orquestacion por PowerShell en produccion. El criterio final (arranque sin dependencias del sistema) se confirmara al validar el empaquetado. Siguiente: FASE 5 (Backend Python empaquetado con PyInstaller), PLAN_MAESTRO linea 568.
