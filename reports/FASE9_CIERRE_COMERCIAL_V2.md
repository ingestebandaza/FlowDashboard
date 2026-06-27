# FASE 9 - Cierre comercial v2.0.0: Actualizaciones con electron-updater

## 1. Objetivo
Sustituir por completo el actualizador Python antiguo por un sistema basado en electron-updater con proveedor GitHub Releases, estados de progreso, descarga automatica, instalacion controlada y conservacion de datos. Referencia: PLAN_MAESTRO lineas 881-979.

## 2. Alcance
- electron-app/src/main/update-manager.js (gestor de actualizaciones).
- electron-app/src/main/index.js (instanciacion, arranque auto, IPC).
- electron-app/preload/preload.js (puente IPC seguro).
- electron-app/src/renderer/app.js (UI del actualizador).
- electron-app/src/main/runtime-manager.js (prepareForUpdate).
- No se modifican componentes protegidos.

## 3. Estado inicial
- update-manager.js ya existia y cubria el flujo; electron-updater ^6.8.9 declarado en package.json.
- updater.py y update.json antiguos ya archivados en archive/legacy-updater/.
- Incoherencia detectada en app.js: dos declaraciones de async function checkForUpdates() (una antigua con showUpdateModal y estado inexistente no_update; otra nueva con renderUpdateStatus ligada a los eventos del UpdateManager). Por hoisting de funciones prevalecia la nueva, pero la antigua quedaba como codigo muerto incoherente.

## 4. Cambios realizados
- electron-app/src/renderer/app.js: eliminado codigo muerto del updater antiguo
  - eliminada funcion showUpdateModal (modal con display:flex permanente y sin botones de accion).
  - eliminada la segunda definicion obsoleta de checkForUpdates (polling con estado no_update que el UpdateManager nunca emite).
  - conservada hideUpdateModal (la usa renderUpdateStatus) y la implementacion vigente checkForUpdates basada en renderUpdateStatus.
- No se modifico update-manager.js, index.js ni preload.js (ya correctos).
- No se creo update_config.json: es un archivo opcional de la allowlist de persistencia (path-resolver.js:11 APPROVED_JSON_FILES); el canal se controla por la variable de entorno FLOWDASHBOARD_UPDATE_CHANNEL, no por ese fichero. Crearlo seria configuracion muerta.

## 5. Verificacion runtime
- Estados implementados en update-manager.js: idle, checking, available, downloading, downloaded, deferred, installing, error (coincide con spec).
- Proveedor: github owner=ingestebandaza repo=FlowDashboard, private=false, releaseType=release; autoDownload=true; autoInstallOnAppQuit=false; allowPrerelease segun canal.
- Canal: getChannel() lee FLOWDASHBOARD_UPDATE_CHANNEL (beta/stable); allowPrerelease=true solo en beta.
- Arranque automatico: index.js:71-72 broadcast + startAutoCheck tras crear la ventana; startAutoCheck con retardo 6s y no bloquea la UI.
- IPC: index.js:322-340 handlers updates-status, updates-check, updates-install, updates-defer.
- preload: preload.js:26-34 expone getUpdateStatus, checkForUpdates, installDownloadedUpdate, deferDownloadedUpdate, onUpdateStatus bajo electronAPI.
- UI: app.js renderUpdateStatus pinta el modal con titulos por estado, barra de progreso, notas y acciones (Reiniciar ahora / Mas tarde) visibles en estado downloaded; onUpdateStatus suscrito a los eventos del main.
- Disponible desde licencia: app.js:7632 llama checkForUpdates() tras validar la licencia.
- Antes de instalar (update-manager.js prepareForInstall): consulta /recordings/active, si hay grabaciones activas llama /recordings/stop-all, y ejecuta runtimeManager.prepareForUpdate() (runtime-manager.js:502) para cerrar sidecars de forma ordenada antes de quitAndInstall.
- Diagnosticos de app.js tras la edicion: 0 errores.

## 6. Pruebas en dispositivos
- No aplica a dispositivos Android. La validacion funcional plena del ciclo 2.0.0 -> 2.0.1 requiere publicar un Release real en GitHub (artefactos FlowDashboard-Setup-2.0.1.exe + latest.yml). El codigo y el artefacto latest.yml (generado en FASE 8) estan listos; la prueba de actualizacion N -> N+1 se documenta como checklist de aceptacion a ejecutar por el usuario tras publicar 2.0.1.

## 7. Hallazgos y correcciones
- Hallazgo: duplicado de checkForUpdates + showUpdateModal (codigo muerto). Corregido: eliminado el bloque obsoleto dejando una unica implementacion coherente.
- Hallazgo: updater.py / update.json antiguos. Estado: ya archivados en archive/legacy-updater/ (no estan en rutas activas). Cumple la regla "Archivar updater.py" y "No usar el update.json antiguo".
- Pendiente preparar (no bloqueante de aceptacion): actualizacion obligatoria (soporte preparado pero no activado por defecto) y firma Authenticode (CSC_IDENTITY_AUTO_DISCOVERY=false; firmar exe e instalador antes del primer cliente externo manteniendo publisherName FlowDashboard).

## 8. Componentes protegidos
- No se modifico ningun componente protegido: stream-renderer-h264.js, flow-touch.js, scrcpy_raw_streamer.py, scrcpy_raw_ws_server.py, scrcpy_control_channel.py, protocolo FDH1, parser H.264, WebCodecs, sesiones Grid/Focus, CoordinateMapper, taps/swipes/drag/live touch, Back/Home/Recents, presets, scrcpy-control, fallback ADB, pipeline de video, scrcpy-win64-v4.0/.

## 9. Coherencia codigo-runtime-documentacion
- update-manager.js (estados/provider/canales) coherente con el spec FASE 9.
- IPC main <-> preload <-> renderer alineado (mismos canales updates-*).
- artifactName del instalador (FASE 8) produce FlowDashboard-Setup-${version}.exe y latest.yml, formato esperado por electron-updater.
- update_config.json permanece como entrada opcional de allowlist; el canal real se resuelve por env var. Documentado para evitar incoherencia por config inerte.

## 10. Riesgos
- La validacion completa del ciclo de actualizacion depende de publicar Releases reales (no draft) en GitHub; releases draft no llegan a clientes.
- Sin firma Authenticode, Windows SmartScreen puede advertir en instalaciones externas; firmar antes del primer cliente externo.
- Si se publica una prerelease sin que el equipo este en canal beta, no se ofrecera (allowPrerelease=false en stable), comportamiento esperado.

## 11. Rollback
- restore_points/2026-06-27_0340_PRE_FASE9_UPDATER/app.js (app.js previo a la limpieza del codigo muerto).
- Reversion: restaurar ese archivo.

## 12. Evidencias
- update-manager.js: estados, configureUpdater (github), startAutoCheck, prepareForInstall (stop recordings + prepareForUpdate).
- index.js:12,16,71-72,129-151,322-340 (import, instancia, auto-check, IPC).
- preload.js:26-34 (API electronAPI de updates).
- app.js: renderUpdateStatus + ensureElectronUpdateModal (botones Reiniciar ahora / Mas tarde), onUpdateStatus suscrito, unica checkForUpdates, llamada desde licencia (7632).
- runtime-manager.js:502 prepareForUpdate.
- archive/legacy-updater/updater.py y archive/legacy-updater/update.json (antiguos archivados).
- release_packages/latest.yml (FASE 8) compatible con electron-updater.

## 13. Configuracion y secretos
- No se versionan secretos. Canal por env FLOWDASHBOARD_UPDATE_CHANNEL (stable por defecto).
- No se hardcodean IPs, conteos de dispositivos, seriales ni rutas; el owner/repo de GitHub corresponde al repositorio publico del producto.

## 14. Checklist de aceptacion
- [x] electron-updater integrado con proveedor GitHub Releases.
- [x] update-manager.js implementa todos los estados del spec.
- [x] IPC seguro de estado/progreso (main/preload/renderer).
- [x] UI conectada con progreso, notas y acciones Reiniciar ahora / Mas tarde.
- [x] Antes de instalar: detiene grabaciones y cierra sidecars via RuntimeManager.
- [x] Updater disponible desde la pantalla de licencia.
- [x] updater.py y update.json antiguos archivados.
- [x] Codigo muerto del updater eliminado (coherencia).
- [ ] (Usuario) Publicar Release 2.0.1 y verificar que una instalacion 2.0.0 detecta, descarga e instala 2.0.1 conservando datos.
- [ ] (Pre-cliente externo) Firmar exe e instalador con Authenticode (publisherName FlowDashboard).

## 15. Conclusion y siguiente fase
FASE 9 completada y verificada: el actualizador electron-updater esta integrado de extremo a extremo (main/preload/renderer + RuntimeManager), se elimino el codigo muerto del actualizador antiguo y los artefactos legacy estan archivados. Quedan como tareas operativas no bloqueantes la prueba real de ciclo 2.0.0 -> 2.0.1 (requiere publicar Release) y la firma Authenticode antes del primer cliente externo. Siguiente: FASE 10 (Supabase y modelo comercial) segun PLAN_MAESTRO linea 982.
