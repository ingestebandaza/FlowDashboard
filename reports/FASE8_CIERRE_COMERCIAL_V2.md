# FASE 8 - Cierre comercial v2.0.0: Instalador NSIS unico

## 1. Objetivo
Generar un unico instalador comercial Windows (NSIS) mediante electron-builder que empaquete la app Electron y todos los recursos runtime (Python, C#, ADB/scrcpy, APK FlowAgent, herramientas) para instalar y ejecutar FlowDashboard 2.0.0 en una maquina limpia sin .NET ni Python preinstalados. Referencia: PLAN_MAESTRO lineas 793-879.

## 2. Alcance
- scripts/build/build-electron-installer.ps1 (orquestador del instalador).
- electron-app/electron-builder.config.js (configuracion electron-builder, ya correcta).
- Verificacion del self-check del backend empaquetado y de los recursos incluidos en el paquete.
- NO se modifican componentes protegidos (pipeline de video, control scrcpy, touch, etc.).

## 3. Estado inicial
- electron-builder.config.js correcto: appId com.flowdashboard.app, productName desde version.json, artifactName FlowDashboard-Setup-${version}.${ext}, asar true, output ../release_packages, extraResources copia **/* desde build/staging/commercial-resources, target win nsis x64, nsis perMachine=false oneClick=false con accesos directos.
- build-electron-installer.ps1 referenciaba el APK arm64 (agent-v1.0.0-arm64-v8a.apk) en 3 puntos, incoherente con FASE 7 (APK universal).
- El ejecutable empaquetado FlowDashboard.Backend.exe era el de FASE 5 (obsoleto): resolvia el APK al path arm64 ya inexistente en staging, lo que hacia fallar el self-check del instalador.

## 4. Cambios realizados
- scripts/build/build-electron-installer.ps1: tres referencias arm64 -> universal
  - linea 140 Assert-File android\flowagent\agent-v1.0.0-universal.apk
  - linea 168 regex agent-v1\.0\.0-universal\.apk$
  - linea 219 requiredPackagedFiles resources\android\flowagent\agent-v1.0.0-universal.apk
- Regeneracion de los ejecutables Python con scripts\build\build-python.ps1 -Clean para embeber la logica de FASE 7 (prioridad APK universal en local_adb_server.py:285-326):
  - build\runtime\python\FlowDashboard.Backend.exe (3.535.008 bytes)
  - build\runtime\python\FlowDashboard.MailHelper.exe (8.589.615 bytes)
- No se modifico electron-builder.config.js (ya correcto; el APK universal se incluye via extraResources **/*).

## 5. Verificacion runtime
- Self-check del nuevo Backend.exe contra staging (FLOWDASHBOARD_PRODUCT_MODE=1, RESOURCE_DIR=build/staging/commercial-resources):
  - ok=true, appVersion=2.0.0, productMode=true, isFrozen=true
  - adbExists=true, scrcpyExists=true, scrcpyRawAvailable=true, scrcpyControlAvailable=true, websocketAvailable=true
  - flowAgentApk -> ...android\flowagent\agent-v1.0.0-universal.apk, flowAgentApkExists=true
- Build del instalador (build-electron-installer.ps1 -Clean) completado sin errores:
  - sync-version -> prepare-commercial-resources -Clean -> self-check (OK, regex universal satisfecho) -> ico -> npm run build:win -> asserts latest.yml + recursos.

## 6. Pruebas en dispositivos
- No aplica a esta fase (empaquetado/instalador). La validacion funcional con dispositivos se mantiene de fases previas. La validacion de instalacion en VM limpia se documenta como checklist de aceptacion (seccion 14) a ejecutar por el usuario sobre el .exe generado.

## 7. Hallazgos y correcciones
- Hallazgo: regla de artefacto obsoleto. Cualquier cambio en local_adb_server.py (fuente Python) exige reconstruir FlowDashboard.Backend.exe con build-python.ps1 antes de empaquetar; lo mismo aplica a C# con build-dotnet.ps1. FASE 7 cambio el .py pero el exe seguia siendo de FASE 5.
- Correccion: regenerados los exe Python y corregidas las referencias arm64->universal en el orquestador.
- El .venv del repo estaba vacio; para construir se instalo requirements.txt + pyinstaller en .venv (websockets 15.0.1, psutil 7.2.2, websocket-client 1.9.0, pyinstaller 6.21.0).

## 8. Componentes protegidos
- No se modifico ningun componente protegido: stream-renderer-h264.js, flow-touch.js, scrcpy_raw_streamer.py, scrcpy_raw_ws_server.py, scrcpy_control_channel.py, protocolo FDH1, parser H.264, WebCodecs, sesiones Grid/Focus, CoordinateMapper, taps/swipes/drag/live touch, Back/Home/Recents, presets, scrcpy-control, fallback ADB, pipeline de video, scrcpy-win64-v4.0/.

## 9. Coherencia codigo-runtime-documentacion
- Fuente (local_adb_server.py) prioriza APK universal; el exe empaquetado ahora coincide (self-check resuelve universal); el orquestador valida universal; el paquete final contiene universal. Coherente.
- electron-builder.config.js artifactName produce exactamente FlowDashboard-Setup-2.0.0.exe (coincide con criterio de aceptacion del plan).
- Nota de coherencia menor (sin impacto): electron-app/package.json mantiene un bloque "build" embebido obsoleto que NO se usa porque build:win invoca --config electron-builder.config.js.

## 10. Riesgos
- El instalador (354 MB) y artefactos en release_packages estan gitignored por peso; se versiona solo el tooling y el informe.
- Si en el futuro se vuelve a tocar el .py o el .cs sin regenerar los exe, el self-check del instalador volveria a fallar (mitigado por documentar la regla de artefacto obsoleto).

## 11. Rollback
- restore_points/2026-06-27_0320_PRE_FASE8_INSTALLER/build-electron-installer.ps1 (orquestador previo a los cambios arm64->universal).
- Reversion: restaurar ese archivo. Los exe Python se regeneran con build-python.ps1.

## 12. Evidencias
- release_packages/FlowDashboard-Setup-2.0.0.exe (354.791.881 bytes, SHA-256 846de4278e7da209e8bcf3ff0d0c4763db112176ac9bf331f9ce34fa1f09ca3d)
- release_packages/latest.yml (version 2.0.0, size 354791881, sha512 6BJ49CI3...RDVpw==)
- release_packages/PHASE9_UPDATER_INSTALLER_MANIFEST.json (winUnpackedExists=true, resourcesDirExists=true, packagedResourceChecks 9/9 exists=true):
  - resources/runtime/python/FlowDashboard.Backend.exe 3.535.008
  - resources/runtime/dotnet/FlowDashboard.Core.exe 151.552
  - resources/scrcpy-win64-v4.0/adb.exe 8.485.016
  - resources/scrcpy-win64-v4.0/scrcpy.exe 715.950
  - resources/android/flowagent/agent-v1.0.0-universal.apk 183.871.298
  - resources/Herramientas/FlowTrackName.exe 32.087.726
  - resources/scripts/Login.js 41.163
  - resources/THIRD_PARTY_NOTICES.txt 2.943
  - resources/RESOURCE_MANIFEST.json 121.386
- Self-check JSON con flowAgentApk universal y flowAgentApkExists=true.

## 13. Configuracion y secretos
- No se versionan secretos. .supabase_config.json, mail_config.json, device_names.json, h264_canary_config.json siguen gitignored.
- supabaseConfigured=false en el self-check de empaquetado (entorno de build sin credenciales), correcto.
- No se hardcodean IPs, conteos de dispositivos, seriales ni rutas.

## 14. Checklist de aceptacion
- [x] electron-builder.config.js produce FlowDashboard-Setup-2.0.0.exe.
- [x] Instalador generado en release_packages (354 MB).
- [x] latest.yml generado (compatibilidad updater FASE 9).
- [x] win-unpacked/resources contiene los 9 recursos requeridos (universal APK incluido, no arm64).
- [x] Self-check del backend empaquetado ok=true y resuelve APK universal.
- [ ] (Usuario) Instalar el .exe en VM limpia sin .NET/Python y verificar arranque y deteccion de dispositivos.

## 15. Conclusion y siguiente fase
FASE 8 completada y verificada: instalador NSIS unico generado correctamente con todos los recursos comerciales empaquetados (APK universal) y backend Python regenerado coherente con FASE 7. Pendiente la prueba de instalacion en VM limpia por parte del usuario. Siguiente: FASE 9 (auto-updater electron-updater, latest.yml, update_config.json) segun PLAN_MAESTRO linea 881.
