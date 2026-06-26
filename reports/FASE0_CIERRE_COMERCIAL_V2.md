# Informe de cierre - FASE 0 (Baseline e instrumentacion)

Proyecto: FlowDashboard 2.0.0 (producto comercial)
Rama: commercial/v2.0.0
Fecha: 2026-06-27
Documento gobernante: PLAN_MAESTRO_IMPLEMENTACION_COMERCIAL_FLOWDASHBOARD_2.0.0.md (Fase 0, linea 264) + ANEXO_CONTROL_COHERENCIA_CODIGO_RUNTIME_DOCUMENTACION.md (formato seccion 14)

---

## 1. Objetivo de la fase

Establecer una linea base (baseline) reproducible del producto comercial real antes de iniciar las fases 1-15:
- Versionar el codigo fuente comercial real en la rama commercial/v2.0.0.
- Crear punto de restauracion y etiqueta (tag) de baseline.
- Verificar que el producto arranca y funciona end-to-end con el lanzador oficial abrir_electron.bat.
- Detectar y corregir cualquier discrepancia entre lo documentado y el comportamiento real en ejecucion.

## 2. Alcance

Incluye: control de versiones (git), .gitignore comercial, punto de restauracion, validacion de arranque (C# 5000, Python 8765, Electron), conectividad de dispositivos.
Excluye: cambios funcionales en componentes protegidos (pipeline de video H.264, scrcpy, control tactil, sesiones Grid/Focus, CoordinateMapper, presets). No se modifico ninguno.

## 3. Estado inicial encontrado

- Rama de trabajo creada commercial/v2.0.0 a partir del historico existente.
- 984 archivos en seguimiento tras versionar la fuente comercial real.
- Binarios pesados e irremplazables (APK/, AutoJs6/, *.exe, FlowDashboard.exe) presentes en disco pero NO aptos para git.
- Carpeta Eliminar/ con material que debe permanecer en disco pero fuera de git (incluye DOCUMENTACION_TECNICA.md, documento prohibido como fuente).
- .venv del proyecto sin dependencias: el lanzador cae a un Python de desarrollo del sistema.

## 4. Cambios realizados

1. Baseline de codigo comercial versionado en commercial/v2.0.0.
   - Commit b3b47e8c: baseline FASE 0 v2.0.0 (fuente comercial real).
   - Commit 20e6924d: exclusion de .abacusai/ y repo embebido flow_agent_monolito/.
2. .gitignore comercial ampliado para excluir binarios pesados y artefactos: AutoJs6/, APK/, Eliminar/, Herramientas/*.exe, FlowDashboard.exe, *.err, *.out, .abacusai/, flow_agent_monolito/, launcher_log*.txt.
3. Tag de baseline baseline-commercial-v2.0.0 -> 20e6924d (tag previo pre-commercial-v2 conservado en d4ae086).
4. Punto de restauracion en disco (fuera de git): restore_points/2026-06-27_0037_PRE_COMMERCIAL_V2/ con evidencia de runtime (fase0_runtime_evidence.txt).
5. CORRECCION DE BUG (ver seccion 7), commit f32db16c.

## 5. Verificacion en runtime

Arranque con abrir_electron.bat -> abrir_electron.ps1 (lanzador oficial). Secuencia [1/5..5/5]:
- [1/5] Servidor ADB iniciado (scrcpy-win64-v4.0\adb.exe).
- [2/5] Backend C# escuchando en 127.0.0.1:5000; GET /api/health -> 200, version 2.0.0, productMode:false, isFrozen:false (modo desarrollo, esperado).
- [3/5] Backend Python escuchando en 127.0.0.1:8765; GET /health -> 200. Puertos auxiliares activos: 8766 (FlowAgent), 8767 (WS WebP), 8768 (H.264 raw).
- [4/5] Auto-conexion: estado original DESHABILITADO (decision "Fase 8A").
- [5/5] Electron arranca con --disable-http-cache (4 procesos).
Evidencia guardada en restore_points/2026-06-27_0037_PRE_COMMERCIAL_V2/fase0_runtime_evidence.txt.

## 6. Pruebas de dispositivos (cantidad variable)

- Identidad de dispositivo por MAC: device_key_from_parts -> mac:<mac>, con fallback a serial (local_adb_server.py:1235-1238). Nombres en device_names.json; inventario en device_inventory.json (DATA_DIR). Orden, grupos y nombres dependen de la identidad fisica, NO de la IP.
- Inventario observado: 17 entradas / 17 IPs conocidas (sin hardcodeo en codigo; el inventario es dato de runtime).
- Sin IPs, conteos ni seriales hardcodeados en el codigo corregido. La deteccion de subredes es automatica (get_local_subnets via psutil).

## 7. Hallazgo critico y correccion (BUG)

Sintoma: al abrir con abrir_electron.bat, el dashboard quedaba en "Cargando dispositivos" y no aparecia ninguno; solo aparecian tras un adb connect IP:5555 manual.
Causa raiz: el lanzador reinicia el servidor ADB, lo que pierde las conexiones TCP (WiFi). La decision "Fase 8A" (local_adb_server.py:9238-9240) hacia que la conexion requiriese accion explicita del usuario; nada reconectaba al arrancar.
Correccion (local_adb_server.py):
- Flag AUTO_SCAN_ON_START_ENABLED (env FLOWDASHBOARD_DISABLE_AUTO_SCAN) y AUTO_SCAN_ON_START_DELAY=3.0 (tras linea 372).
- Funcion auto_scan_on_start() (antes de reconnect_known_devices, ~9375): hilo daemon que espera 3s, llama reconnect_known_devices() y luego start_network_scan(get_local_subnets(), port=5555, timeout=250, concurrency=48, connect_adb=True). No-op si esta deshabilitado o no hay subredes.
- Llamada a auto_scan_on_start() en serve_forever() justo antes de server.serve_forever() (~9287).
Validacion: py_compile OK. Se desconectaron los 17 dispositivos, se cerro el producto y se relanzo -> 17 dispositivos reconectados automaticamente en ~15s, conservando nombres y posiciones. Confirmado visualmente por el usuario.
Commit: f32db16c. Punto de restauracion previo: restore_points/2026-06-27_0100_PRE_AUTO_SCAN_STARTUP/.

## 8. Componentes protegidos

No se modifico ninguno: stream-renderer-h264.js, scrcpy_raw_streamer.py, scrcpy_raw_ws_server.py, scrcpy_control_channel.py, protocolo FDH1, parser H.264, WebCodecs, sesiones Grid/Focus, CoordinateMapper, taps/swipes/drag/live touch, Back/Home/Recents, presets, scrcpy-control, fallback ADB, pipeline de video. La correccion solo toca la logica de arranque/reconexion (auto_scan_on_start) y reutiliza funciones de escaneo ya existentes.

## 9. Coherencia codigo / runtime / documentacion

Discrepancias detectadas (a tratar en fases posteriores):
- .venv sin dependencias; el lanzador cae a un Python de desarrollo hardcodeado (abrir_electron.ps1:90). Empaquetado a revisar en FASE 5.
- .gitignore linea 17 *.spec puede ocultar specs de PyInstaller necesarios para empaquetado (revisar FASE 5).
- h264_canary_config.json esta gitignored (revisar si debe versionarse).
- PROJECT_CONTEXT.md afirma fases ya validadas; contradice el mandato de re-verificar todo. Se corregira la documentacion para reflejar el flujo real.
- DOCUMENTACION_TECNICA.md vive en Eliminar/ y esta prohibido como fuente.

## 10. Riesgos y mitigaciones

- Riesgo: el escaneo automatico al arrancar podria generar trafico de red en subredes grandes. Mitigacion: concurrency y timeout acotados, y flag de desactivacion FLOWDASHBOARD_DISABLE_AUTO_SCAN.
- Riesgo: dependencia de un Python de desarrollo externo. Mitigacion: pendiente FASE 5 (empaquetado Python).
- Riesgo: binarios criticos fuera de git. Mitigacion: conservados en disco + documentados en handoff; punto de restauracion creado.

## 11. Rollback

- Tag baseline-commercial-v2.0.0 (20e6924d) para volver al estado pre-correccion.
- restore_points/2026-06-27_0100_PRE_AUTO_SCAN_STARTUP/ con copia de local_adb_server.py previa.
- Revertir la correccion: git revert f32db16c (o restaurar el archivo desde el punto de restauracion).

## 12. Evidencias

- restore_points/2026-06-27_0037_PRE_COMMERCIAL_V2/fase0_runtime_evidence.txt (health, puertos, procesos).
- restore_points/2026-06-27_0100_PRE_AUTO_SCAN_STARTUP/ (README.txt, adb_devices_before.txt, copia de local_adb_server.py).
- Historial git: b3b47e8c, 20e6924d, f32db16c.
- Confirmacion visual del usuario: dispositivos aparecen automaticamente y conservan nombres/posiciones.

## 13. Configuracion / secretos

Excluidos de git y verificados como no rastreados: .supabase_config.json, mail_config.json, device_names.json. Sin secretos en el codigo. Supabase: solo verificacion de codigo/config (sin escrituras destructivas), segun lo acordado.

## 14. Checklist de aceptacion FASE 0

- [x] Rama commercial/v2.0.0 con fuente comercial real versionada.
- [x] Tag de baseline creado.
- [x] .gitignore comercial (binarios pesados, Eliminar/, logs) aplicado.
- [x] Punto de restauracion creado en disco (fuera de git).
- [x] Producto arranca con abrir_electron.bat (C# 5000, Python 8765, Electron, puertos auxiliares).
- [x] Dispositivos (cantidad variable) detectados; identidad por MAC; sin hardcodeo.
- [x] Bug de reconexion WiFi detectado, corregido y validado en runtime + confirmacion del usuario.
- [x] Componentes protegidos intactos.
- [x] Working tree git limpio tras commit f32db16c.

## 15. Conclusion y siguiente fase

FASE 0 cerrada. Baseline reproducible establecido, producto operativo end-to-end y un bug real de arranque (no aparicion de dispositivos WiFi) corregido y validado. Siguiente: FASE 1 (verificacion y correccion de la documentacion para que refleje el flujo real del programa), segun PLAN_MAESTRO linea 312.
