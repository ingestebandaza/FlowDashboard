## ULTIMOS CAMBIOS (2026-06-29) - Diagnostico fallo Release rapida (codigo 1) tras el fix del icono

**COMMERCIAL-V2-DIAG-RELEASE-WINCODESIGN-01:**
- **Estado:** DIAGNOSTICADO Y RESUELTO. No requirio cambios de codigo adicionales (la config del icono es correcta). El fallo era una descarga transitoria incompleta.
- **Sintoma:** GESTOR opcion 6 (Release rapida, bump patch) fallo con "La release rapida fallo (codigo 1)". El log que se vio estaba truncado tras los 2 PyInstaller; el error real (en el paso electron-builder) no aparecia.
- **Evidencia recogida:** backend+mailhelper PyInstaller OK; self-check del backend empaquetado OK (`ok:true`, exit 0); dotnet publicado OK; `build/staging/commercial-resources` poblado; `release_packages/win-unpacked/FlowDashboard.exe` (176MB) creado PERO con ProductVersion/FileVersion **VACIOS**, y **sin** instalador NSIS ni `latest.yml`. En la cache `winCodeSign` aparecian multiples carpetas numeradas a medio extraer creadas durante la corrida (reintentos).
- **Causa raiz:** el fix del icono (`signAndEditExecutable: true`, ver entrada siguiente) hace que electron-builder invoque **rcedit** para incrustar icono+version en `FlowDashboard.exe`. `rcedit-x64.exe` vive dentro del paquete **winCodeSign**, que electron-builder **descarga de GitHub** la primera vez (~5.6MB). En la corrida del usuario esa descarga/extraccion no se completo, por lo que rcedit no pudo editar el exe (de ahi la version vacia) y el build aborto con codigo 1 DESPUES de empaquetar `win-unpacked` pero ANTES del NSIS. Con `signAndEditExecutable:false` esto no ocurria porque rcedit no se ejecutaba.
- **Resolucion/verificacion:** se ejecuto `npm run build:win` completo: rcedit corrio OK (`command executed`, version incrustada 2.1.2.0), NSIS genero `FlowDashboard-Setup-2.1.2.exe` (354MB) + `latest.yml`, sin errores en el log. `winCodeSign-2.6.0` quedo **cacheado** (`%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0\rcedit-x64.exe`), por lo que las siguientes builds lo reutilizan ("found existing") y no vuelven a descargarlo. La limpieza con `-Clean` solo borra `release_packages`, no la cache de electron-builder.
- **Accion pendiente (usuario):** reintentar GESTOR opcion 6; ahora completa. Si en una maquina con cache limpia volviera a fallar la descarga de winCodeSign por red, basta reintentar (la descarga es puntual y queda cacheada).

## ULTIMOS CAMBIOS (2026-06-29) - Fix icono del instalador: incrustar icono del proyecto en el .exe

**COMMERCIAL-V2-FIX-INSTALLER-ICON-01:**
- **Estado:** IMPLEMENTADO. Solo toca `electron-app/electron-builder.config.js`. No afecta runtime ni codigo protegido.
- **Contexto:** Al instalar `FlowDashboard-Setup-2.1.2.exe`, el icono que aparece en "Programas instalados" / el `.exe` era el icono por defecto de Electron, no el del proyecto. El arte de `assets/icon.ico` (6 tamanos: 16/32/48/64/128/256) es CORRECTO e identico a `assets/icon.png` (diff de pixeles 1.3/765); el problema no era el icono sino que electron-builder no lo incrustaba.
- **Causa:** `win.signAndEditExecutable: false`. Con ese flag, electron-builder no ejecuta `rcedit` y por tanto NO incrusta el icono ni el nombre/version en el `.exe` (el icono solo queda en el instalador NSIS, no en el ejecutable instalado). Confirmado por issues oficiales electron-builder #4343, #5784, #6934.
- **Fix:** `signAndEditExecutable: false` -> `true`. Como no hay certificado y `forceCodeSigning:false`, electron-builder incrusta icono+version SIN firmar (salta la firma). `icon: assets/icon.ico` ya estaba bien.
- **Validacion:** `node -e require(config)` OK (`win.signAndEditExecutable=true`). VERIFICADO con build real: `npm run build:win` completo, rcedit incrusto en `FlowDashboard.exe` ProductVersion=2.1.2.0 / FileVersion=2.1.2 / ProductName=FlowDashboard + el icono. NOTA: el primer build con este flag descarga `winCodeSign` (rcedit) de GitHub; ver entrada COMMERCIAL-V2-DIAG-RELEASE-WINCODESIGN-01 sobre el fallo de release que esto provoco y su resolucion. NOTA: si Windows sigue mostrando el icono viejo por cache, limpiar cache de iconos o reinstalar.

## ULTIMOS CAMBIOS (2026-06-29) - Seguridad servidor: rate-limit anti fuerza bruta en el RPC de licencias

**COMMERCIAL-V2-SEC-RPC-RATELIMIT-01:**
- **Estado:** IMPLEMENTADO (SQL). No toca el cliente ni runtime protegido.
- **Contexto:** El rol `anon` solo puede ejecutar `validate_flowdashboard_license` (`004_validate_v2.sql:244`), que es la unica superficie expuesta. Faltaba proteccion anti fuerza bruta de claves de licencia.
- **Fix:** migracion `database/migrations/009_rate_limit_validation.sql` (+ rollback `rollbacks/009_rollback.sql`). `CREATE OR REPLACE` del RPC con la MISMA firma (13 params) y MISMO contrato de respuesta. Antes de buscar la licencia, cuenta intentos `license_not_found` recientes por `device_hash` e `ip` sobre `app_access_logs` (ventana 10 min; umbral 8/dispositivo, 25/ip) y, si se excede, devuelve `status=error, device_status=rate_limited, reason_code=rate_limited` con mensaje. Solo cuenta `license_not_found`: un usuario con licencia valida (`approved`) o expirada/bloqueada NUNCA se ve afectado. El evento de bloqueo se registra con `decision='throttled'` para no realimentar el contador (self-healing). Dos indices parciales nuevos en `app_access_logs` para el conteo. El cliente (`app.js:7817`) ya maneja cualquier `device_status` desconocido mostrando `message`, asi que no requiere cambios. `scripts/db/apply_migrations.py` ahora incluye los pasos 008 y 009.
- **Validacion:** diff del cuerpo del RPC 009 vs 004 = solo las adiciones previstas; rollback 009 vs 004 = codigo identico. Pendiente (usuario): aplicar `apply_migrations.py --only 009` contra Supabase y verificar.

## ULTIMOS CAMBIOS (2026-06-29) - Endurecimiento: JSON Supabase empaquetado minimo (sin fuga de arquitectura)

**COMMERCIAL-V2-SEC-SUPABASE-JSON-01:**
- **Estado:** IMPLEMENTADO. No toca runtime protegido ni el flujo de carga del backend.
- **Contexto:** El instalador dejaba en `resources/config/public/supabase.json` la copia literal del archivo del repo, con comentarios `_comment_*` que describian arquitectura interna (RLS, migracion 005, nombre de la RPC). La anon key es publica/segura por diseno (RLS estricto + anon solo ejecuta la RPC `validate_flowdashboard_license`), pero esos comentarios facilitaban reconocimiento a un atacante.
- **Fix:** `scripts/build/prepare-commercial-resources.ps1` ya no copia el archivo tal cual; ahora lee el JSON del repo, extrae solo `url`/`anonKey` (acepta tambien `SUPABASE_URL`/`SUPABASE_ANON_KEY`) y escribe en staging un JSON minimo (solo esas dos claves, UTF-8 sin BOM, sin comentarios). El repo conserva el `config/public/supabase.json` documentado. El backend lee `url`/`anonKey`, que se mantienen, asi que no cambia el comportamiento.
- **Validacion:** PSParser del script (OK), generacion del JSON minimo contra el archivo real (solo `url`+`anonKey`). Pendiente (usuario): build 2.1.x y verificar el archivo instalado.

## ULTIMOS CAMBIOS (2026-06-28) - Fix instalador 2.1.x: builder-util-runtime + Supabase publico en PRODUCT_MODE

**COMMERCIAL-V2-FIX-INSTALL-2.1.x-01:**
- **Estado:** IMPLEMENTADO. No modifica H.264/WebCodecs, Grid/Focus, scrcpy-control, FlowTouch, pipeline de video ni el control tactil.
- **Motivo:** Al instalar `FlowDashboard-Setup-2.1.1.exe` en una maquina limpia aparecieron dos fallos.
- **BUG 1 - `Cannot find module 'builder-util-runtime'`:**
  - Causa: `electron-app/electron-builder.config.js` excluia `node_modules/builder-util-runtime/**/*`, pero ese paquete es dependencia en runtime de `electron-updater`, no solo build.
  - Fix: se elimino esa unica linea de exclusion. Se conservan las exclusiones de paquetes solo-build (`app-builder-lib`, `builder-util`, `dmg-builder`, `nsis`, `winCodeSign`, `app-builder-bin`, `electron-builder`).
- **BUG 2 - `Supabase no configurado. No se permite modo local en esta build.`:**
  - Causa: en build empaquetado el backend corre congelado (`PRODUCT_MODE=True`); no leia `.supabase_config.json` y solo tomaba `SUPABASE_URL`/`SUPABASE_ANON_KEY` del entorno, que en una maquina limpia estan vacios. Ademas `config/public/supabase.json` nunca se empaquetaba.
  - Fix (A+B): `local_adb_server.py` ahora, solo en `PRODUCT_MODE`, rellena url/anon vacios desde `config/public/supabase.json` (en `RESOURCE_DIR`) y, como ultimo recurso, desde valores publicos por defecto embebidos. Las variables de entorno siguen teniendo prioridad. `scripts/build/prepare-commercial-resources.ps1` copia `config/public/supabase.json` al staging y lo agrega a `requiredRelativePaths`.
  - Seguridad: la anon key es publica (RLS estricto, migracion 005; rol anon solo ejecuta RPC `validate_flowdashboard_license`). `scan-secrets.ps1` la permite via `Test-PublicAnonJwt`. La service_role sigue bloqueada.
- **BUG 3 - Release rapida abortaba con codigo 1 tras empaquetar:**
  - Causa: `config/public/supabase.json` se empaqueta tambien suelto en `release_packages/win-unpacked/resources/config/public/supabase.json`. El escaner inline de `scripts/release/release.ps1` (Step-SecretScan) busca el literal `service_role` en los `.json` de `release_packages`, y los comentarios del JSON contenian esa palabra, abortando la release.
  - Fix: se reformularon los comentarios `_comment_*` de `config/public/supabase.json` para no incluir los literales bloqueados (`service_role`, etc.) manteniendo el significado. El escaner sigue estricto para el resto.
- **Archivos Actualizados:**
  - `electron-app/electron-builder.config.js`
  - `local_adb_server.py`
  - `scripts/build/prepare-commercial-resources.ps1`
  - `config/public/supabase.json`
  - `PROJECT_CONTEXT.md`
- **Validacion:** `node --check` del config (OK), `py_compile` de `local_adb_server.py` (OK), PSParser del script de preparacion (OK), self-check del backend empaquetado en PRODUCT_MODE (`ok=true`, `supabaseConfigured=true`), `prepare-commercial-resources.ps1` (OK, 443 archivos, supabase.json staged), build completo del instalador con `build-electron-installer.ps1` (`ok=true`, `FlowDashboard-Setup-*.exe` generado), simulacion de Step-SecretScan sobre `release_packages` (limpio) y `scan-secrets -Scope tracked` (0 hallazgos). Pendiente: release 2.1.2 y reinstalacion en maquina limpia (a cargo del usuario).

## ULTIMOS CAMBIOS (2026-06-24) - Fase 9 comercial: actualizador Electron

**COMMERCIAL-V2-PHASE9_ELECTRON_UPDATER-01:**
- **Estado:** IMPLEMENTADO Y VALIDADO CON BUILD COMPLETO. No modifica H.264, Grid/Focus, scrcpy-control, FlowTouch, FlowLogin, control tactil ni el incidente post-reboot omitido por decision del usuario.
- **Motivo:** El plan comercial 2.0.0 exige reemplazar el actualizador Python/update.json por `electron-updater` con GitHub Releases.
- **Restore Point Creado:**
  - `restore_points/2026-06-24_110000_PRE_COMMERCIAL_PHASE9_UPDATER`
- **Archivos Creados/Actualizados:**
  - `electron-app/src/main/update-manager.js`
  - `electron-app/src/main/index.js`
  - `electron-app/preload/preload.js`
  - `electron-app/src/renderer/app.js`
  - `electron-app/electron-builder.config.js`
  - `electron-app/package.json`
  - `electron-app/package-lock.json`
  - `scripts/build/build-electron-installer.ps1`
  - `scripts/release/sync-version.ps1`
  - `scripts/diagnostics/verify-documentation-consistency.ps1`
  - `local_adb_server.py`
  - documentacion vigente.
- **Updater Electron:**
  - Usa `electron-updater`.
  - Provider: GitHub Releases `ingestebandaza/FlowDashboard`.
  - Estados implementados: `idle`, `checking`, `available`, `downloading`, `downloaded`, `deferred`, `installing`, `error`.
  - Preload expone `getUpdateStatus`, `checkForUpdates`, `installDownloadedUpdate`, `deferDownloadedUpdate` y `onUpdateStatus`.
  - Renderer deja de usar Python `/update-check` y `/update-status`.
  - Antes de instalar, intenta detener grabaciones activas y ejecuta `RuntimeManager.prepareForUpdate()`.
- **Legacy:**
  - `updater.py` movido a `archive/legacy-updater/updater.py`.
  - Python `/update-check` y `/update-status` quedan como shims deshabilitados con `legacy_updater_disabled`.
  - `sync-version.ps1` ya no muta `update.json`; queda historico.
- **Build:**
  - `electron-builder.config.js` y `package.json` incluyen `publish` GitHub.
  - `build-electron-installer.ps1` ahora falla en build completo si falta `latest.yml`.
  - Build final genero `release_packages/FlowDashboard-Setup-2.0.0.exe`, `.blockmap`, `latest.yml`, `win-unpacked/` y `PHASE9_UPDATER_INSTALLER_MANIFEST.json`.
  - Instalador final: tamano `259716917` bytes, SHA-256 `4e5f01bf7ee32cda53021a09497bfe6939d6d83a92aa38b7c91dfa330eb38500`.
  - `latest.yml` final: SHA-256 `963621489ef365e02e3c1944181c44f60e9aec40c7d975ff8305517d363b158d`.
  - `win-unpacked/resources/app-update.yml` apunta a GitHub Releases `ingestebandaza/FlowDashboard`.
  - Build interno sin firma digital; `Get-AuthenticodeSignature` reporta no firmado.
- **Validacion Realizada:**
  - `node --check electron-app/src/main/update-manager.js` OK.
  - `node --check electron-app/src/main/index.js` OK.
  - `node --check electron-app/preload/preload.js` OK.
  - `node --check electron-app/src/renderer/app.js` OK.
  - `python -m py_compile local_adb_server.py` OK.
  - parse PowerShell de `build-electron-installer.ps1` OK.
  - `scripts/diagnostics/verify-documentation-consistency.ps1` PASS.
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build/build-electron-installer.ps1 -Clean -SkipVersionSync` OK.
  - `packagedResourceMissing=null` en `PHASE9_UPDATER_INSTALLER_MANIFEST.json`.
  - `app.asar` contiene 936 entradas y el escaneo no encontro rutas conocidas de secretos/datos locales.
- **Pendiente Real:** Validar update real `2.0.0 -> 2.0.1` con GitHub Release, `latest.yml`, blockmap, release notes y firma digital. No se puede cerrar el criterio final de Fase 9 sin publicar una version N+1 real.

## ULTIMOS CAMBIOS (2026-06-24) - Fase 8 comercial: instalador Electron/NSIS interno

**COMMERCIAL-V2-PHASE8_INSTALLER-01:**
- **Estado:** IMPLEMENTADO Y VALIDADO. No modifica H.264, Grid/Focus, scrcpy-control, FlowTouch, FlowLogin, control tactil ni el incidente post-reboot omitido por decision del usuario.
- **Motivo:** El plan comercial 2.0.0 exige que Electron Builder/NSIS consuma el staging comercial real y produzca un paquete instalable sin depender de Python/.NET/Android SDK del PC desarrollador.
- **Restore Point Creado:**
  - `restore_points/2026-06-24_090000_PRE_COMMERCIAL_PHASE8_INSTALLER`
- **Archivos Creados/Actualizados:**
  - `electron-app/electron-builder.config.js`
  - `scripts/build/build-electron-installer.ps1`
  - `electron-app/package.json`
  - `scripts/release/sync-version.ps1`
  - `scripts/diagnostics/verify-documentation-consistency.ps1`
  - documentacion vigente en `docs/current`, `docs/commercial`, `docs/master_technical_specification.md` y `RELEASE_NOTES_2.0.0.md`.
- **Salida Verificada:**
  - `release_packages/FlowDashboard-Setup-2.0.0.exe`
  - `release_packages/FlowDashboard-Setup-2.0.0.exe.blockmap`
  - `release_packages/win-unpacked/`
  - `release_packages/PHASE8_INSTALLER_MANIFEST.json`
- **Installer Verificado:**
  - Tamano: `259523353` bytes.
  - SHA-256: `f0b7f0ce014049daea7dd639d172e861360909ae6879646e56c6c782bfc8a812`.
  - `packagedResourceMissing=null`.
  - Build interno sin firma digital; firma queda pendiente antes de distribucion publica.
- **Runtime Empaquetado Verificado:**
  - Python self-check desde `release_packages/win-unpacked/resources` OK: `productMode=true`, `isFrozen=true`, ADB/scrcpy disponibles y FlowAgent resuelto desde `android/flowagent/agent-v1.0.0-arm64-v8a.apk`.
  - C# `/api/health` desde `release_packages/win-unpacked/resources` OK: `version=2.0.0`, `productMode=true`, `adb.available=true`, ADB empaquetado.
  - `app.asar` contiene 670 entradas y el escaneo no encontro rutas conocidas de secretos/datos locales.
- **Incidente de Validacion Resuelto:**
  - Un primer health check C# quedo colgado por la forma de ejecutar/parar el proceso desde PowerShell. Se encontro que el Core empaquetado si habia respondido `/api/health` 200; se cerro el PID de prueba y se repitio la validacion en pasos separados con resultado OK y puerto 5000 libre al final.
  - Un primer build detecto Python empaquetado stale que aun resolvia una ruta antigua de FlowAgent. Se reconstruyo Fase 5 y el script Fase 8 ahora ejecuta preflight del backend Python empaquetado contra `android/flowagent`.
- **Riesgos Pendientes:** Probar instalacion/arranque en equipo limpio, configurar firma digital, definir/verificar actualizador comercial y mantener el incidente Grid/H.264 post-reboot como actualizacion separada.

## ULTIMOS CAMBIOS (2026-06-23) - Fase 7 comercial: recursos empaquetables

**COMMERCIAL-V2-PHASE7-RESOURCES-01:**
- **Estado:** IMPLEMENTADO Y VALIDADO. No modifica H.264, Grid/Focus, scrcpy-control, FlowTouch, FlowLogin, control tactil ni el incidente post-reboot omitido.
- **Motivo:** El plan comercial 2.0.0 exige preparar recursos distribuibles sin depender de fuentes Gradle completas, copias redundantes, rutas legacy ni datos locales.
- **Restore Point Creado:**
  - `restore_points/2026-06-23_113000_PRE_COMMERCIAL_PHASE7_RESOURCES`
- **Script Creado:**
  - `scripts/build/prepare-commercial-resources.ps1`
- **Salida Verificada:**
  - `build/staging/commercial-resources/`
  - `build/staging/commercial-resources/RESOURCE_MANIFEST.json`
  - `build/staging/commercial-resources/THIRD_PARTY_NOTICES.txt`
- **Layout Comercial Staged:**
  - `runtime/python/FlowDashboard.Backend.exe`
  - `runtime/python/FlowDashboard.MailHelper.exe`
  - `runtime/dotnet/FlowDashboard.Core.exe`
  - `scrcpy-win64-v4.0/` con ADB, scrcpy, scrcpy-server, DLLs oficiales requeridas e imagenes del bundle.
  - `android/flowagent/agent-v1.0.0-arm64-v8a.apk`
  - `Herramientas/FlowTrackName.exe`
  - `scripts/Login.js` y `scripts/Register.js`
- **FlowAgent:**
  - El APK incluido es `arm64-v8a`.
  - `output-metadata.json` verifica `versionName=1.0.0` y `versionCode=106`.
  - Existe APK universal en la salida Gradle, pero Fase 7 NO lo incluye. El paquete queda arm64-only hasta decision comercial explicita de multi-ABI.
  - `electron-app/src/main/path-resolver.js` y `local_adb_server.py` ahora prefieren `android/flowagent/agent-v1.0.0-arm64-v8a.apk` en producto, conservando fallback al arbol Gradle y legacy debug.
- **Scripts de Automation:**
  - `local_adb_server.py` ahora tambien resuelve scripts desde `RESOURCE_DIR/scripts`, necesario para `Login.js` empaquetado.
- **FlowTrackName:**
  - Staged en `Herramientas/FlowTrackName.exe`.
  - Tamano: `32087726` bytes.
  - SHA-256: `fba6a00129f63726c590819c19f1c64f90a6801bbf419a17adb675409016177e`.
  - Smoke test de arranque queda opcional con `-SmokeTestFlowTrackName` porque no hay CLI silencioso documentado.
- **Seguridad / Exclusiones:**
  - El script falla si detecta `.supabase_config.json`, `.flowlogin_payloads`, JSON de dispositivos, `mail_config.json`, recordings, reports, restore points o SQL en staging.
  - No copia fuentes Gradle completas, debug APKs, APK legacy 0.3.8 ni copias root de `scrcpy-server`.
- **Documentacion Actualizada:**
  - `docs/commercial/COMMERCIAL_RESOURCES.md`
  - `docs/commercial/THIRD_PARTY_NOTICES.txt`
  - `docs/master_technical_specification.md`
  - `docs/current/CURRENT_ARCHITECTURE.md`
  - `docs/current/REPOSITORY_MAP.md`
  - `docs/current/BUILD_AND_RELEASE.md`
  - `docs/current/SECURITY.md`
  - `docs/current/RUNTIME_CODE_DOCUMENTATION_MATRIX.md`
  - `scripts/diagnostics/verify-documentation-consistency.ps1`
- **Validacion Realizada:**
  - `scripts/build/prepare-commercial-resources.ps1 -Clean` OK.
  - `fileCount=460`, `totalBytes=304413385` en el rebuild de Fase 8.
  - FlowAgent staged `1.0.0+106`, ABI `arm64-v8a`.
  - Universal APK detectada pero no incluida.
  - Manifest con SHA-256 generado.
- **Riesgos Pendientes:** Fase 8 ya consume este staging. Falta prueba de instalador limpio/VM limpia, firma digital y actualizador comercial. El fallo Grid/H.264 post-reboot sigue fuera de alcance por decision del usuario.
## ULTIMOS CAMBIOS (2026-06-23) - Fase 6 comercial: backend C# self-contained

**COMMERCIAL-V2-PHASE6_DOTNET_SELF_CONTAINED-01:**
- **Estado:** IMPLEMENTADO Y VALIDADO. No modifica H.264, Grid/Focus, scrcpy-control, FlowTouch, FlowAgent, FlowLogin ni el incidente post-reboot omitido.
- **Motivo:** El plan comercial 2.0.0 exige eliminar la dependencia de .NET instalado en el PC cliente.
- **Restore Point Creado:**
  - `restore_points/2026-06-23_101500_PRE_COMMERCIAL_PHASE6_DOTNET_SELF_CONTAINED`
- **Build C#:**
  - Creado `scripts/build/build-dotnet.ps1`.
  - Salida verificada: `build/runtime/dotnet/FlowDashboard.Core.exe`.
  - Publicacion `win-x64`, `Release`, `--self-contained true`.
  - No se activo trimming, Native AOT, single-file ni ReadyToRun.
- **Rutas y Datos:**
  - `AppPaths.DataDir` usa `%LOCALAPPDATA%/FlowDashboard` en modo producto si no existe `FLOWDASHBOARD_DATA_DIR`.
  - `/api/health` reporta `productMode`, `baseDir`, `resourceDir`, `dataDir` y estado ADB.
- **ADB / scrcpy C#:**
  - `AdbService` usa `FLOWDASHBOARD_ADB` o `scrcpy-win64-v4.0/adb.exe` desde `ResourceDir`/`BaseDir`; no depende de Android SDK, `C:\adb` ni PATH.
  - `ScrcpyService` usa `SCRCPY_PATH` o `scrcpy-win64-v4.0/scrcpy.exe` desde recursos empaquetados; no depende de PATH.
  - ADB usa temp/log bajo `FLOWDASHBOARD_ADB_TEMP_DIR` o `DataDir/.adb_tmp`.
  - Si ADB no puede iniciar, C# no revienta con application error: mantiene `/api/health` en modo degradado y reporta `adb.available=false` con el error.
- **Incidente Durante Validacion:**
  - Al probar el self-contained aparecieron ventanas `FlowDashboard.Core.exe - Application Error` porque ADB no podia abrir `%LOCALAPPDATA%/Temp/adb.log` y la excepcion se relanzaba desde `AdbService`.
  - Se corrigio haciendo tolerante el arranque de ADB y moviendo TEMP/TMP de ADB a dataRoot.
- **Documentacion Actualizada:**
  - `docs/master_technical_specification.md`
  - `docs/current/CURRENT_ARCHITECTURE.md`
  - `docs/current/REPOSITORY_MAP.md`
  - `docs/current/DEVELOPMENT_START.md`
  - `docs/current/BUILD_AND_RELEASE.md`
  - `docs/current/SECURITY.md`
  - `docs/current/RUNTIME_CODE_DOCUMENTATION_MATRIX.md`
  - `scripts/diagnostics/verify-documentation-consistency.ps1`
- **Validacion Realizada:**
  - `dotnet build FlowDashboard.Core/FlowDashboard.Core.csproj -c Release --no-restore` OK; advertencias existentes, cero errores.
  - `scripts/build/build-dotnet.ps1 -Clean` OK.
  - `build/runtime/dotnet/FlowDashboard.Core.exe` respondio `/api/health` en `127.0.0.1:5000` con `version=2.0.0`, `productMode=true`, `dataDir=scratch/flowdashboard-data-runtime`, `adb.available=true` y path ADB empaquetado.
  - El proceso publicado fue detenido al terminar la prueba; no se dejo listener activo en `5000`.
- **Riesgos Pendientes:** Faltan layout final de recursos Electron, instalador, actualizador y prueba en VM limpia sin .NET instalado. El fallo Grid/H.264 post-reboot sigue fuera de alcance por decision del usuario.
## ULTIMOS CAMBIOS (2026-06-23) - Fase 5 comercial: backend Python empaquetado

**COMMERCIAL-V2-PHASE5-PYTHON-PACKAGING-01:**
- **Estado:** IMPLEMENTADO Y VALIDADO. No modifica H.264, Grid/Focus, scrcpy-control, FlowTouch, FlowAgent, FlowLogin ni el incidente post-reboot omitido.
- **Motivo:** El plan comercial 2.0.0 exige que el backend Python no dependa del Python instalado en la maquina del desarrollador y pueda ejecutarse como sidecar de producto.
- **Restore Point Creado:**
  - `restore_points/2026-06-23_090000_PRE_COMMERCIAL_PHASE5_PYTHON_PACKAGING`
- **Build Python:**
  - Creado `build_specs/FlowDashboard.Backend.spec`.
  - Creado `build_specs/FlowDashboard.MailHelper.spec`.
  - Creado `scripts/build/build-python.ps1`.
  - Salida verificada: `build/runtime/python/FlowDashboard.Backend.exe`.
  - Salida verificada: `build/runtime/python/FlowDashboard.MailHelper.exe`.
  - El build usa PyInstaller `onedir` e incluye modulos de `local_adb_server.py`, scrcpy H.264 raw, scrcpy-control, WebSocket y dependencias requeridas.
  - El build excluye secretos, datos locales, payloads, logs, recordings, SQL, admin panel y fuentes Android completas.
- **Python Runtime:**
  - `local_adb_server.py` detecta `IS_FROZEN`, `PRODUCT_MODE`, `BASE_DIR`, `RESOURCE_DIR` y `DATA_DIR` para desarrollo y producto.
  - En producto, sin `FLOWDASHBOARD_DATA_DIR`, los datos mutables van a `%LOCALAPPDATA%/FlowDashboard`.
  - `/health` reporta `productMode` e `isFrozen`.
  - `--self-check` valida ADB, scrcpy, `scrcpy-server.jar`, H.264 raw, scrcpy-control, WebSocket y APK FlowAgent.
  - En producto se desactiva local license fallback, no se lee `.supabase_config.json` empaquetado y se ignora `SUPABASE_SERVICE_ROLE_KEY`.
  - En producto el backend obtiene la configuracion publica de Supabase (url + anon key) por este orden: variables de entorno `SUPABASE_URL`/`SUPABASE_ANON_KEY` (override), luego `config/public/supabase.json` empaquetado en `RESOURCE_DIR` (copiado por `prepare-commercial-resources.ps1` a `resources/config/public/supabase.json`), y como ultimo recurso los valores publicos por defecto embebidos en `local_adb_server.py`. La anon key es publica y segura (RLS estricto, migracion 005; el rol anon solo puede ejecutar la RPC `validate_flowdashboard_license`). Este flujo solo aplica en `PRODUCT_MODE`; en desarrollo el comportamiento no cambia.
- **scrcpy Manager:**
  - `scrcpy_manager.py` usa rutas desde `FLOWDASHBOARD_RESOURCE_DIR`, `FLOWDASHBOARD_ADB` y `SCRCPY_SERVER_JAR`; no depende de `adb` del PATH.
- **FlowMail:**
  - `MailService.cs` prefiere `FlowDashboard.MailHelper.exe` si existe y mantiene fallback al script `.py` para desarrollo.
  - RuntimeManager propaga `FLOWDASHBOARD_MAIL_HELPER_EXE` cuando detecta el helper empaquetado.
- **Documentacion Actualizada:**
  - `docs/master_technical_specification.md`
  - `docs/current/CURRENT_ARCHITECTURE.md`
  - `docs/current/REPOSITORY_MAP.md`
  - `docs/current/DEVELOPMENT_START.md`
  - `docs/current/BUILD_AND_RELEASE.md`
  - `docs/current/SECURITY.md`
  - `docs/current/RUNTIME_CODE_DOCUMENTATION_MATRIX.md`
  - `scripts/diagnostics/verify-documentation-consistency.ps1`
- **Validacion Realizada:**
  - `python -m py_compile local_adb_server.py scrcpy_manager.py scrcpy_raw_streamer.py scrcpy_raw_ws_server.py scrcpy_control_channel.py FlowDashboard.Core/Services/flowmail_imap_helper.py` OK.
  - `node --check electron-app/src/main/runtime-manager.js` OK.
  - `dotnet build FlowDashboard.Core/FlowDashboard.Core.csproj -c Release --no-restore` OK; advertencia NU1603 existente, cero errores.
  - `scripts/build/build-python.ps1 -Clean` OK.
  - `FlowDashboard.Backend.exe --self-check` OK con `productMode=true`, `isFrozen=true`, ADB/scrcpy/server jar y modulos raw/control disponibles.
  - Prueba limpia de `/health` tras detener Python de desarrollo: `FlowDashboard.Backend.exe` escucho en `8765`, `8766`, `8767` y `8768`, con `baseDir=build/runtime/python`, `resourceDir=C:\DASHBOARD\FlowDashboard`, `dataDir=scratch/flowdashboard-data-runtime`, `productMode=true` e `isFrozen=true`.
- **Riesgos Pendientes:** Fase 6 aun debe publicar C# self-contained; faltan layout final de recursos Electron, instalador, actualizador y VM limpia. El fallo Grid/H.264 post-reboot sigue fuera de alcance por decision del usuario.
## ULTIMOS CAMBIOS (2026-06-23) - Fase 4 comercial: RuntimeManager Electron

**COMMERCIAL-V2-PHASE4-RUNTIME-MANAGER-01:**
- **Estado:** IMPLEMENTADO Y VALIDADO. No modifica H.264, Grid/Focus, scrcpy-control, FlowTouch, FlowAgent, FlowLogin ni el incidente post-reboot omitido.
- **Motivo:** El plan comercial 2.0.0 exige reducir la dependencia de PowerShell en produccion y mover la supervision de sidecars C#/Python al proceso main de Electron.
- **Restore Point Creado:**
  - `restore_points/2026-06-23_083500_PRE_COMMERCIAL_PHASE4_RUNTIME_MANAGER`
- **Electron:**
  - Creado `electron-app/src/main/runtime-manager.js`.
  - RuntimeManager prepara env de `FLOWDASHBOARD_BASE_DIR`, `FLOWDASHBOARD_RESOURCE_DIR`, `FLOWDASHBOARD_DATA_DIR`, `FLOWDASHBOARD_ADB`, `SCRCPY_PATH`, `SCRCPY_SERVER_JAR` y `FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART`.
  - Detecta servicios externos sanos en C# `5000` y Python `8765`; no los mata al salir si no son procesos hijos de Electron.
  - Si el puerto esta libre y existe runtime, arranca C# y Python con ventanas ocultas, espera health checks y registra logs separados en `dataRoot/logs/runtime`.
  - Si el puerto esta ocupado pero el health falla, reporta puerto ocupado y no mata procesos de terceros.
  - Supervisa solo procesos propios con reinicio limitado y backoff.
  - Agrega IPC `runtime-status` y `runtime-prepare-for-update` expuestos por preload como `getRuntimeStatus()` y `prepareRuntimeForUpdate()`.
- **C# / Launcher:**
  - `FlowDashboard.Core/Program.cs` respeta `FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART=1` para evitar que C# arranque Python en paralelo cuando Electron/launcher gobiernan el runtime.
  - `abrir_electron.ps1` exporta ese flag antes de iniciar C#.
- **Alcance Protegido:** No instala APK, no abre FlowAgent, no activa Accesibilidad, no inicia MediaProjection, no cambia H.264 ni `/control/*`.
- **Documentacion Actualizada:**
  - `docs/master_technical_specification.md`
  - `docs/current/CURRENT_ARCHITECTURE.md`
  - `docs/current/REPOSITORY_MAP.md`
  - `docs/current/DEVELOPMENT_START.md`
  - `docs/current/BUILD_AND_RELEASE.md`
  - `docs/current/SECURITY.md`
  - `docs/current/RUNTIME_CODE_DOCUMENTATION_MATRIX.md`
  - `scripts/diagnostics/verify-documentation-consistency.ps1`
- **Validacion Realizada:**
  - `node --check electron-app/src/main/runtime-manager.js`, `index.js` y `preload.js` OK.
  - `python -m py_compile local_adb_server.py scrcpy_raw_streamer.py scrcpy_raw_ws_server.py scrcpy_control_channel.py` OK.
  - `dotnet build FlowDashboard.Core/FlowDashboard.Core.csproj -c Release --no-restore` OK tras detener exe bloqueante; advertencia NU1603 existente, cero errores.
  - `abrir_electron.bat` OK; Python `/health` y C# `/api/health` reportan `2.0.0` y mismo `dataDir`.
  - `runtime-status.json` reporta `ready=true`, C# y Python como `external`, sin warnings ni errors.
  - `scripts/diagnostics/verify-documentation-consistency.ps1` PASS.
- **Riesgos Pendientes:** Fase 5 aun debe empaquetar Python; Fase 6 aun debe publicar C# self-contained. En desarrollo, `abrir_electron.bat` sigue siendo el entry point verificado.
## ULTIMOS CAMBIOS (2026-06-23) - Fase 3 comercial: rutas, recursos y datos

**COMMERCIAL-V2-PHASE3-PATHS-DATA-01:**
- **Estado:** IMPLEMENTADO Y VALIDADO. No modifica H.264, scrcpy-control, FlowTouch, FlowAgent, FlowLogin ni el incidente post-reboot omitido.
- **Motivo:** El plan comercial 2.0.0 exige que el mismo codigo pueda resolver rutas en desarrollo y produccion, separar recursos de datos mutables, migrar datos aprobados de forma idempotente y bloquear rutas arbitrarias desde renderer.
- **Restore Point Creado:**
  - `restore_points/2026-06-23_082534_PRE_COMMERCIAL_PHASE3_PATHS_DATA`
- **Electron:**
  - Creado `electron-app/src/main/path-resolver.js`.
  - Expone `isPackaged`, `projectRoot`, `resourceRoot`, `runtimeRoot`, `userDataRoot`, `dataRoot`, `logsRoot`, `recordingsRoot`, `scriptsRoot`, `scrcpyRoot`, `flowAgentApk`, `flowTrackNameExe`.
  - Migra de forma idempotente JSON aprobados desde raiz a dataRoot si el destino no existe.
  - IPC `read-json-file` / `write-json-file` ahora rechaza rutas absolutas, `..`, separadores y extensiones no JSON, y solo acepta allowlist.
  - Escritura JSON Electron usa temp + fsync + backup + rename atomico.
  - Acciones shell desde renderer quedan restringidas a recordings/logs aprobados.
  - Logs de consola Electron van a `dataRoot/logs/electron-console.log`.
- **Launcher:**
  - `abrir_electron.ps1` define `FLOWDASHBOARD_DATA_DIR=scratch\flowdashboard-data-runtime` y crea la carpeta junto al userData runtime.
- **Python:**
  - `local_adb_server.py` crea `DATA_DIR` desde `FLOWDASHBOARD_DATA_DIR` o cae a `BASE_DIR`.
  - Usa `DATA_DIR` para `device_names.json`, `device_groups.json`, `device_inventory.json`, `device_registrations.json`, `.flowlogin_payloads`, `recordings`, `.upload_tmp`, `.app_icon_cache` y logs diagnosticos.
  - Migra JSON aprobados desde raiz si faltan en dataRoot.
  - `save_device_names`, `save_device_groups` y `save_device_inventory` usan escritura atomica con `.tmp` y `.bak`.
  - `/health` y client-info reportan `baseDir`, `resourceDir` y `dataDir`.
- **C#:**
  - Creado `FlowDashboard.Core/Services/AppPaths.cs`.
  - `DeviceMappingService` usa `AppPaths.DataDir` para `device_mappings.json` y migra desde la ruta anterior si falta.
  - `MailService` usa `AppPaths.DataDir` para `mail_config.json` cifrado por DPAPI y migra desde content root si falta.
  - Escritura C# usa temp + flushToDisk + backup + move atomico.
  - `PythonBridgeService` propaga `FLOWDASHBOARD_BASE_DIR`, `FLOWDASHBOARD_RESOURCE_DIR` y `FLOWDASHBOARD_DATA_DIR` si inicia Python.
  - `/api/health` reporta `baseDir`, `resourceDir` y `dataDir`.
- **Documentacion Actualizada:**
  - `docs/master_technical_specification.md`
  - `docs/current/CURRENT_ARCHITECTURE.md`
  - `docs/current/REPOSITORY_MAP.md`
  - `docs/current/DEVELOPMENT_START.md`
  - `docs/current/BUILD_AND_RELEASE.md`
  - `docs/current/SECURITY.md`
  - `docs/current/RUNTIME_CODE_DOCUMENTATION_MATRIX.md`
  - `scripts/diagnostics/verify-documentation-consistency.ps1`
- **Validacion Realizada:**
  - `node --check electron-app/src/main/path-resolver.js` OK.
  - `node --check electron-app/src/main/index.js` OK.
  - `node --check electron-app/preload/preload.js` OK.
  - `python -m py_compile local_adb_server.py scrcpy_raw_streamer.py scrcpy_raw_ws_server.py scrcpy_control_channel.py` OK.
  - `dotnet build FlowDashboard.Core/FlowDashboard.Core.csproj -c Release --no-restore` OK tras detener exe bloqueante; quedan advertencias existentes, cero errores.
  - `abrir_electron.bat` OK.
  - Runtime final: Python `/health` y C# `/api/health` reportan `dataDir=C:\DASHBOARD\FlowDashboard\scratch\flowdashboard-data-runtime`; 16 dispositivos; 16 agentes; H.264 disponible con 16 sesiones.
  - `scripts/diagnostics/verify-documentation-consistency.ps1` PASS.
- **Riesgos Pendientes:** Produccion todavia necesita RuntimeManager sin PowerShell (Fase 4), Python empaquetado (Fase 5), C# self-contained (Fase 6) e instalador/actualizador. El dataRoot de desarrollo usa `scratch`; la build final debera apuntar a userData/AppData.
## ULTIMOS CAMBIOS (2026-06-23) - Fase 2 comercial: versionado unico 2.0.0

**COMMERCIAL-V2-PHASE2-VERSION-UNIFICATION-01:**
- **Estado:** IMPLEMENTADO Y VALIDADO. No modifica H.264, scrcpy-control, FlowTouch, FlowAgent, FlowLogin ni el bug post-reboot omitido por decision del usuario.
- **Motivo:** El plan comercial 2.0.0 exige eliminar contradicciones entre metadatos de Electron, Python, C#, update manifest y documentacion activa.
- **Restore Point Creado:**
  - `restore_points/2026-06-23_081609_PRE_COMMERCIAL_PHASE2_VERSION_UNIFICATION`
- **Fuente Unica Creada:**
  - `version.json` con `version=2.0.0`, `channel=stable`, `publisher=FlowDashboard`, `productName=FlowDashboard`.
- **Script Creado:**
  - `scripts/release/sync-version.ps1` sincroniza `electron-app/package.json`, `electron-app/package-lock.json`, `package.json`, `app_meta.py`, `update.json`, `FlowDashboard.Core/FlowDashboard.Core.csproj` y `RELEASE_NOTES_2.0.0.md`.
- **Diagnostico Creado:**
  - `scripts/diagnostics/verify-documentation-consistency.ps1` verifica contradicciones activas de version/nombre y headers STATUS en docs actuales.
- **Codigo/Config Sincronizado:**
  - Electron `name=flowdashboard`, `version=2.0.0`, `productName=FlowDashboard`, `appId=com.flowdashboard.app`, `artifactName=FlowDashboard-Setup-2.0.0.${ext}`.
  - Python `app_meta.py`: `APP_VERSION=2.0.0`.
  - `update.json`: `version=2.0.0` y URL `v2.0.0/FlowDashboard-2.0.0.zip`.
  - C# csproj: `Version=2.0.0`, `AssemblyVersion/FileVersion=2.0.0.0`, `InformationalVersion=2.0.0`, `IncludeSourceRevisionInInformationalVersion=false`.
  - `/api/health` C# ahora reporta `productName=FlowDashboard` y `version=2.0.0` exacto.
  - Renderer activo deja de mostrar `FlowDashboard Pro` en titulo/log/licencia y muestra `FlowDashboard`.
- **Documentacion Actualizada:**
  - `docs/master_technical_specification.md`
  - `docs/current/BUILD_AND_RELEASE.md`
  - `docs/current/REPOSITORY_MAP.md`
  - `docs/current/RUNTIME_CODE_DOCUMENTATION_MATRIX.md`
  - headers `STATUS: CURRENT` en docs actuales y punteros raiz.
- **Validacion Realizada:**
  - `node --check electron-app/src/renderer/app.js` OK.
  - `node --check electron-app/src/main/index.js` OK.
  - `python -m py_compile local_adb_server.py scrcpy_raw_streamer.py scrcpy_raw_ws_server.py scrcpy_control_channel.py` OK.
  - `dotnet build FlowDashboard.Core/FlowDashboard.Core.csproj -c Release --no-restore` OK tras detener el exe bloqueante; quedan advertencias existentes, cero errores.
  - `abrir_electron.bat` OK.
  - Runtime final: Python `/health` `appVersion=2.0.0`; C# `/api/health` `version=2.0.0`; `/update-status` `currentVersion=2.0.0`; 16 dispositivos; 16 agentes; H.264 disponible con 16 sesiones.
  - `scripts/diagnostics/verify-documentation-consistency.ps1` PASS.
- **Riesgos Pendientes:** `.venv` sin dependencias y Python hardcodeado siguen para fase de runtime/packaging; NSIS one-click/directorio se revisara en fases comerciales posteriores; incidente Grid/H.264 post-reboot sigue fuera de alcance.
## ULTIMOS CAMBIOS (2026-06-23) - Fase 1 comercial: clasificacion canonica y legacy

**COMMERCIAL-V2-PHASE1-CANON-LEGACY-01:**
- **Estado:** IMPLEMENTADO Y VALIDADO. No modifica runtime, H.264, scrcpy, control tactil, FlowAgent ni FlowLogin.
- **Motivo:** El plan comercial 2.0.0 requiere separar claramente producto vigente, documentacion fuente de verdad, archivos legacy, experimentos, scripts y futuras areas de build/release para evitar que personas o IAs trabajen sobre componentes historicos.
- **Restore Point Creado:**
  - `restore_points/2026-06-23_080721_PRE_COMMERCIAL_PHASE1_CANON_LEGACY`
- **Estructura Creada:**
  - `docs/current/`
  - `docs/commercial/`
  - `docs/architecture/`
  - `archive/legacy-dashboard/`
  - `archive/legacy-updater/`
  - `archive/legacy-sql/`
  - `archive/legacy-launchers/`
  - `archive/experiments/`
  - `scripts/dev/`
  - `scripts/build/`
  - `scripts/release/`
  - `scripts/diagnostics/`
  - `build/runtime/`
  - `build/staging/`
- **Documentacion Creada:**
  - `README.md`
  - `CURRENT_ARCHITECTURE.md`
  - `REPOSITORY_MAP.md`
  - `DEVELOPMENT_START.md`
  - `BUILD_AND_RELEASE.md`
  - `SECURITY.md`
  - `docs/current/CURRENT_ARCHITECTURE.md`
  - `docs/current/REPOSITORY_MAP.md`
  - `docs/current/DEVELOPMENT_START.md`
  - `docs/current/BUILD_AND_RELEASE.md`
  - `docs/current/SECURITY.md`
  - `archive/LEGACY_INDEX.md`
- **Decisiones de Seguridad:** No se copiaron secretos ni payloads desde `.supabase_config.json`, `.flowlogin_payloads`, `device_names.json` ni datos sensibles. `DOCUMENTACION_TECNICA.md` sigue prohibido como fuente tecnica vigente.
- **Legacy Marcado Sin Mover:** `wsapi_demo.html`, `wsapi.js`, `FlowDashboard.exe`, `launcher.py`, `launcher.spec`, `Crearexe.bat`, `CrearActualizacion.bat`, `updater.py`, launchers antiguos, SQL destructivos, documentos `PASOS_*`, `LISTO_*`, `SOLUCION_*`, `PRUEBA_*`, hotfixes, spikes, dumps y copias raiz de `scrcpy-server` quedan inventariados en `archive/LEGACY_INDEX.md`. No se movieron fisicamente para no romper rutas en un workspace sucio.
- **Evidencia:** `restore_points/2026-06-23_080721_PRE_COMMERCIAL_PHASE1_CANON_LEGACY/evidence/legacy-candidates-phase1.json`.
- **Validacion Realizada:** lectura de reglas vigentes, inventario de candidatos legacy, busqueda de referencias exactas para componentes legacy principales, creacion de docs canonicos, `node --check` en renderers principales, `dotnet build` y validacion de `abrir_electron.bat`.
- **Riesgos Pendientes:** versionado incoherente `1.0.60` vs `2.0.0` pasa a Fase 2; Python de desarrollo/hardcoded queda para fase de empaquetado runtime; incidente Grid/H.264 post-reboot se omite deliberadamente de Fase 1 y queda como actualizacion separada.
## ULTIMOS CAMBIOS (2026-06-23) - Seguimiento Grid post-reconnect H264

**GRID-H264-POST-RECONNECT-CANVAS-SYNC-06:**
- **Estado:** IMPLEMENTADO Y VALIDADO POR SINTAXIS. Pendiente de prueba fisica nueva con reinicio simultaneo.
- **Evidencia nueva del usuario:** En prueba con 8 dispositivos, `.39`, `.38`, `.42` y `.46` recuperaron imagen en Grid. `.11`, `.146`, `.50` y `.45` quedaron negros. La consola mostro `Reabriendo sesion scrcpy post-reconexion` para todos, y al abrir Focus en los fallidos el pipeline existente ya tenia frames y empezo a pintar/controlar correctamente.
- **Conclusion tecnica:** Todos usan el mismo metodo scrcpy/H.264. La diferencia no es FlowAgent ni fallback. Es una carrera de tiempos: algunos telefonos emiten frames nuevos cuando el canvas Grid ya esta reanclado y registrado; otros emiten frames mientras el Grid aun esta reconstruyendo DOM/canvas, y solo Focus recupera porque agrega otro canvas a la sesion viva.
- **Cambio Aplicado:**
  - `app.js`: despues de `forceRestart(serial, null, gridCanvas)`, se llama `scheduleGridPostReconnectCanvasSync(serial)`.
  - `scheduleGridPostReconnectCanvasSync()` asegura el Grid varias veces tras la reapertura: 0 ms, 350 ms, 900 ms, 1.8 s, 3.5 s, 6.5 s y 10 s.
  - Cada intento llama `createCanvasesForVisibleDevices()` y luego `h264Renderer.ensureCanvas(serial, canvas)` si existe canvas. Esto reancla el canvas al DOM y repinta el ultimo frame nuevo sin abrir Focus ni cambiar resolucion.
- **Alcance protegido:** No se modifico backend, `scrcpy_raw_streamer.py`, `scrcpy_raw_ws_server.py`, `stream-renderer-h264.js`, `flow-touch.js`, scrcpy-control, `/control/*`, FlowAgent, FlowLogin, OCR, MediaProjection, presets ni protocolo FDH1.
- **Validacion realizada:** `node --check electron-app/src/renderer/app.js`, `node --check electron-app/src/renderer/stream-renderer-h264.js` y `node --check electron-app/src/renderer/flow-touch.js` OK.
- **Prueba requerida:** repetir reinicio de 8 dispositivos. Resultado esperado: tras `Reabriendo sesion scrcpy post-reconexion`, los dispositivos lentos tambien terminan mostrando imagen en Grid sin entrar a Focus. Puede aparecer de nuevo `Canvas Grid asegurado/repaint desde sesion viva` dentro de la ventana de seguimiento.

## ULTIMOS CAMBIOS (2026-06-23) - Reapertura H264 al volver de reboot/offline

**GRID-H264-REBOOT-STALE-BITMAP-FORCE-REOPEN-05:**
- **Estado:** IMPLEMENTADO Y VALIDADO POR SINTAXIS. Pendiente de prueba fisica con reinicio simultaneo.
- **Restore Point Creado:**
  - `restore_points/2026-06-23_PRE_REBOOT_STALE_FRAME_FORCE_REOPEN`
- **Evidencia nueva del usuario:** Tras reiniciar dispositivos en Grid, ya reaparecen al iniciar, pero Grid y Focus muestran la ultima imagen anterior al reinicio. Los taps/swipes no se ven reflejados y solo cambiar resolucion refresca la imagen.
- **Causa raiz refinada:** La correccion anterior preservo correctamente canvas/sesion durante `offline/rebooting`, pero al volver a `device` la sesion H.264 podia seguir considerandose valida porque tenia `framesDecoded > 0` y un `ImageBitmap` cacheado. Esa regla es necesaria para pantallas estaticas normales, pero es incorrecta despues de un reboot: el ultimo bitmap pertenece a la vida anterior del telefono y debe invalidarse. Cambiar resolucion funcionaba porque forzaba una reapertura limpia de scrcpy/H.264.
- **Cambio Aplicado:**
  - `app.js`: `refreshDeviceStreamAfterReconnect(serial)` ahora fuerza `h264Renderer.forceRestart(serial, null, gridCanvas)` cuando hay transicion real de estado no disponible a `device`.
  - El `null` conserva el preset actual de la sesion, y `gridCanvas` conserva la superficie visual del Grid, pero limpia decoder/bitmap viejo y abre un socket scrcpy nuevo.
  - Se mantiene la regla anterior: durante `offline/rebooting/reconnecting` no se destruye el canvas ni se cierra H.264 solo por mostrar overlay rojo. La reapertura ocurre al volver a `device`.
- **Alcance protegido:** No se modifico backend, `scrcpy_raw_streamer.py`, `scrcpy_raw_ws_server.py`, `stream-renderer-h264.js`, `flow-touch.js`, scrcpy-control, `/control/*`, FlowAgent, FlowLogin, OCR, MediaProjection, presets ni protocolo FDH1.
- **Validacion realizada:** `node --check electron-app/src/renderer/app.js`, `node --check electron-app/src/renderer/stream-renderer-h264.js` y `node --check electron-app/src/renderer/flow-touch.js` OK.
- **Prueba requerida:** abrir con `abrir_electron.bat`, reiniciar varios dispositivos desde Grid y verificar que al volver a `device` Grid/Focus no muestren la imagen previa al reboot. Resultado esperado en consola: `[H264] Reabriendo sesion scrcpy post-reconexion para SERIAL`.

## ULTIMOS CAMBIOS (2026-06-23) - Modelo Grid estable durante reboot/offline

**GRID-STABLE-CANVAS-REBOOT-MODEL-04:**
- **Estado:** IMPLEMENTADO. Pendiente de repetir prueba fisica con reinicio simultaneo.
- **Restore Point Creado:**
  - `restore_points/2026-06-23_PRE_GRID_STABLE_CANVAS_REBOOT_MODEL`
- **Evidencia nueva del usuario:** En la prueba real, varios telefonos que quedaron negros en Grid mostraron logs de resincronizacion y repaint de canvas. Al abrir Focus, el pipeline H.264 existente ya tenia frames validos (`hasValidFrame=true`) y la imagen aparecia sin cambiar Eco/Balanced/Pro. Esto confirma que scrcpy/H.264 seguia vivo y que el fallo estaba en el ciclo de vida DOM/canvas del Grid durante offline/reboot.
- **Causa raiz corregida:** `markDeviceStreamUnavailable()` trataba estados transitorios (`offline`, `rebooting`, `reconnecting`) como si fueran cierre definitivo de stream: hacia `detach()`, limpiaba el canvas, lo removia del DOM y borraba referencias de `streamRenderer.canvases/contexts`. Luego `renderDevices()` reconstruia tarjetas con `innerHTML`, el overlay rojo aparecia, pero el canvas fisico que debia repintar al reconectar podia quedar destruido o desconectado. Focus recuperaba porque agregaba otro canvas a una sesion H.264 viva.
- **Cambio Aplicado:**
  - `app.js`: `markDeviceStreamUnavailable(serial)` ya no cierra la sesion H.264 ni borra el canvas del Grid para estados transitorios. Solo marca el serial como temporalmente no disponible.
  - `app.js`: cuando una tarjeta esta offline/rebooting/reconnecting, `createCanvasesForVisibleDevices()` reancla el canvas existente al contenedor del Grid si el DOM fue reconstruido, dejandolo detras del overlay rojo.
  - `app.js`: cuando el dispositivo vuelve a `device`, se limpia la marca temporal y sigue la ruta normal de asegurar canvas/attach/repaint sin abrir Focus ni cambiar preset.
- **Alcance protegido:** No se modifico backend, `scrcpy_raw_streamer.py`, `scrcpy_raw_ws_server.py`, `stream-renderer-h264.js`, `flow-touch.js`, scrcpy-control, `/control/*`, FlowAgent, FlowLogin, OCR, MediaProjection, presets ni protocolo FDH1.
- **Validacion realizada:** `node --check electron-app/src/renderer/app.js`, `node --check electron-app/src/renderer/stream-renderer-h264.js` y `node --check electron-app/src/renderer/flow-touch.js` OK. Prueba fisica pendiente con 8-10 reinicios simultaneos desde `abrir_electron.bat`. Resultado esperado: tarjetas permanecen en su slot, muestran overlay rojo durante desconexion y recuperan imagen en Grid sin abrir Focus.

## ULTIMOS CAMBIOS (2026-06-23) - Repaint idempotente canvas Grid H264

**GRID-H264-CANVAS-REPAINT-03:**
- **Estado:** IMPLEMENTADO Y VALIDADO POR SINTAXIS. Pendiente de repetir prueba fisica con reinicio simultaneo.
- **Restore Point Creado:**
  - `restore_points/2026-06-23_PRE_GRID_CANVAS_REPAINT_H264`
- **Evidencia nueva:** En el log de la segunda prueba no aparecieron mensajes `[H264-grid] Canvas Grid reattached...`, pero al abrir Focus la sesion ya tenia frames validos. Esto indica que el canvas del Grid podia estar en `session.canvases`, pero haber quedado limpio/negro tras la tarjeta roja de desconexion. Como ya estaba en el Set, el parche anterior no llamaba de nuevo a `addCanvas()` y no repintaba el ultimo bitmap cacheado.
- **Causa raiz refinada:** El problema post-reinicio no era solo sesion H264 muerta ni solo canvas ausente. El caso dominante es sesion viva + canvas Grid existente/registrado + contenido visual limpiado o sin repaint. Focus recupera porque `attachFocus()` agrega un canvas y `addCanvas()` pinta el ultimo `ImageBitmap`.
- **Cambio Aplicado:**
  - `stream-renderer-h264.js`: nuevo `ensureCanvas(serial, canvas)` que poda canvases muertos, llama siempre `session.addCanvas(canvas)` y abre WS solo si no esta abierto/conectando. No cambia preset ni reinicia una sesion sana.
  - `app.js`: cuando el canvas del Grid ya existe y la sesion no necesita reconnect, ahora llama `ensureCanvas()` en cada sincronizacion. Si hay frame valido, esto repinta el ultimo bitmap aunque el canvas ya estuviera registrado.
- **Alcance protegido:** No se modifico backend, scrcpy-control, `/control/*`, Focus UI, FlowAgent, FlowLogin, OCR, MediaProjection, presets ni protocolo FDH1.
- **Validacion realizada:**
  - `node --check electron-app/src/renderer/app.js`
  - `node --check electron-app/src/renderer/stream-renderer-h264.js`
- **Prueba requerida:** reabrir con `abrir_electron.bat` y repetir reinicio simultaneo. Resultado esperado: logs `[H264-grid] Canvas Grid asegurado/repaint desde sesion viva...` durante la resincronizacion post-reconexion, y el Grid recupera imagen sin abrir Focus.
## ULTIMOS CAMBIOS (2026-06-23) - Reattach idempotente canvas Grid H264

**GRID-H264-CANVAS-REATTACH-02:**
- **Estado:** IMPLEMENTADO Y VALIDADO POR SINTAXIS. Pendiente de repetir prueba fisica con reinicio simultaneo.
- **Restore Point Creado:**
  - `restore_points/2026-06-23_PRE_GRID_CANVAS_REATTACH_H264`
- **Evidencia nueva del usuario:** En prueba real con 10 dispositivos reiniciados, 4 recuperaron Grid y 6 quedaron negros. Al abrir Focus uno por uno, `attachFocus()` encontro pipeline existente con `framesDecoded` y `lastFrameAt` avanzando (`hasValidFrame=true`) y la imagen volvio. Esto demuestra que en esos 6 casos el stream no estaba muerto: la sesion H264 estaba viva, pero el canvas visible del Grid no habia quedado registrado como subscriber de esa sesion.
- **Causa raiz refinada:** El primer fix solo recuperaba sesiones sin frame valido. En `createCanvasesForVisibleDevices()`, si el canvas del Grid ya existia y la sesion tenia WebSocket abierto/frames, no se llamaba de nuevo a `h264Renderer.attach()`. Por eso una sesion viva podia seguir decodificando frames para otro canvas stale o para Focus, mientras el canvas DOM visible del Grid quedaba negro.
- **Cambio Aplicado:**
  - `app.js`: cuando el canvas ya existe, ahora verifica `session.canvases.has(canvas)`. Si no esta registrado, llama `h264Renderer.attach(serial, canvas, gridPreset)` aunque la sesion este sana.
  - `stream-renderer-h264.js`: el watchdog de Grid tambien reanade el canvas si ve una sesion viva con frames pero sin ese canvas en `session.canvases`; `addCanvas()` pinta inmediatamente el ultimo bitmap cacheado.
- **Alcance protegido:** No se modifico backend, scrcpy-control, `/control/*`, Focus UI, FlowAgent, FlowLogin, OCR, MediaProjection, presets ni protocolo FDH1.
- **Validacion realizada:**
  - `node --check electron-app/src/renderer/app.js`
  - `node --check electron-app/src/renderer/stream-renderer-h264.js`
- **Prueba requerida:** reabrir con `abrir_electron.bat`, repetir reinicio simultaneo. Resultado esperado: aparecen logs `[H264-grid] Canvas Grid reattached a sesion viva` o `watchdog reattached canvas...` para los casos que antes quedaban negros, y ya no hace falta abrir Focus.
## ULTIMOS CAMBIOS (2026-06-23) - Grid slots estables y recuperacion H264 post-reinicio

**GRID-STABLE-SLOTS-H264-RECONNECT-01:**
- **Estado:** IMPLEMENTADO Y VALIDADO POR SINTAXIS. Pendiente de validacion fisica con reinicio real de telefonos desde `abrir_electron.bat`.
- **Restore Point Creado:**
  - `restore_points/2026-06-23_PRE_GRID_RECONNECT_STABLE_SLOTS_H264`
- **Motivo:** Al reiniciar varios dispositivos desde Grid, las tarjetas pasaban correctamente a pantalla roja de desconexion, pero algunas cambiaban temporalmente de slot visual. Al reconectar, algun stream H264 quedaba negro en Grid y se recuperaba al abrir Focus con doble clic, sin cambiar Eco/Balanced/Pro.
- **Causa verificada en codigo:**
  - `loadDevices()` reconstruia `mergedDevices` poniendo primero los dispositivos reportados por `/devices` y despues los anteriores no reportados. Durante offline/reboot, una tarjeta podia pasar al bloque final del array hasta que el dispositivo volvia a aparecer.
  - `renderDevices()` reconstruye el DOM de la grilla con `innerHTML`; si el orden del array cambia durante offline, el cambio se ve como movimiento fisico de tarjetas.
  - `refreshDeviceStreamAfterReconnect()` usaba un timer de 4 segundos y llamaba `forceRestart()` si `framesDecoded < 120`. Ese umbral no distingue pantalla estatica, boot lento ni stream que acaba de arrancar, y podia cerrar una sesion valida o en progreso.
  - `attachFocus()` tenia recuperacion de sesion stale y watchdog, pero `attach()` de Grid no tenia la misma comprobacion. Esto explica que abrir Focus recupere el stream que Grid no recuperaba por si solo.
- **Cambio Aplicado:**
  - `app.js`: `loadDevices()` ahora mezcla dispositivos preservando el orden previo por identidad estable. Usa candidatos de identidad (`deviceId`, `deviceKey`, MAC, `physicalDeviceId`, `androidId`, `serial`/`activeSerial`) y solo agrega dispositivos realmente nuevos al final.
  - `app.js`: al reconectar un dispositivo ya no se ejecuta `forceRestart()` por `frames < 120`; se programa una resincronizacion de canvas y la recuperacion real queda en el renderer H264.
  - `stream-renderer-h264.js`: se agrego recuperacion Grid por serial con watchdog acotado. Solo recrea la sesion si no hay frame valido tras la ventana de gracia, no mientras el WebSocket sigue en `CONNECTING` salvo timeout largo, y limita los reintentos a 3 por dispositivo.
  - `stream-renderer-h264.js`: `attach()` de Grid ahora poda canvases que ya no estan en el DOM, detecta sesiones stale/congeladas igual que Focus y conserva solo canvases vigentes al recrear sesion.
  - `stream-renderer-h264.js`: `forceRestart()` reutiliza la misma ruta de recreacion segura y conserva alias/canvases vigentes; `detach()` purga alias del mismo master cuando cierra una sesion.
- **Alcance protegido:**
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`, taps, swipes, live touch, Back/Home/Recents, teclado fisico ni `CoordinateMapper`.
  - No se modifico `scrcpy_raw_streamer.py`, `scrcpy_raw_ws_server.py`, presets backend, protocolo FDH1 ni parser frame_meta.
  - No se modifico `flow-touch.js`, FlowAgent, FlowLogin, OCR, MediaProjection, grabacion ni estilos visuales.
- **Validacion realizada:**
  - `node --check electron-app/src/renderer/app.js`
  - `node --check electron-app/src/renderer/stream-renderer-h264.js`
- **Validacion pendiente:** abrir con `abrir_electron.bat`, reiniciar 1 dispositivo y luego 3 dispositivos, verificar que las tarjetas no cambian de slot y que `framesDecoded` vuelve a crecer en Grid sin abrir Focus. No declarar solucion cerrada hasta completar esa prueba fisica.

## ULTIMOS CAMBIOS (2026-06-21) - Eco Focus sin restart extra al abrir

**FOCUS-ECO-OPEN-STABLE-GRID-CLEAR-01:**
- **Estado:** IMPLEMENTADO Y VALIDADO POR SINTAXIS.
- **Restore Point Creado:**
  - `restore_points/2026-06-21_191500_PRE_ECO_FOCUS_HANDOFF_FIX`
- **Motivo:** Tras el cambio `FOCUS-GRID-H264-CLEAN-HANDOFF-01`, abrir Focus en preset Eco podia mostrar distorsion justo despues del primer tap y el usuario noto el aviso nuevo `conectando stream`. La causa probable era el `forceRestart(serial, focusPreset)` agregado antes de `attachFocus()`, que recreaba la sesion H.264 al entrar a Focus y exponia mas la ventana inicial de keyframe/frame estable en Eco.
- **Referencia verificada:**
  - `informacion de scrcpy/doc/develop.md` indica que los frames nuevos solo se producen cuando cambia la superficie y que en arranque puede no enviarse frame si la pantalla no cambia.
  - La misma documentacion describe que los paquetes de video dependen de MediaCodec, headers de frame, flags de config/keyframe y session packets.
  - `informacion de scrcpy/doc/video.md` recuerda que el framerate es variable y que `max-size`/bitrate/fps afectan el comportamiento del encoder.
- **Cambio Aplicado:**
  - Se retiro el `forceRestart()` extra al abrir Focus. La apertura vuelve a usar solo `attachFocus(serial, canvas, preset)`, como antes de la regresion.
  - Al cerrar Focus, ya no se reinicia siempre la sesion hacia el preset de Grid. Primero se consultan stats del renderer: socket conectado, frames decodificados, dimensiones validas y estado del decoder.
  - Solo si la sesion esta rota, sin frame valido, desconectada o esperando keyframe despues de errores, se usa `forceRestart(serial, gridPreset)`.
  - Si la sesion esta sana, el Grid conserva el preset activo de la sesion (incluido Eco) y solo se asegura que su canvas quede attached.
  - `H264StreamRenderer.forceRestart()` ahora limpia los canvases antes de cerrar/recrear la sesion para no dejar pintado el ultimo bitmap viejo o corrupto mientras llega el nuevo frame.
  - El cambio mantiene el beneficio de recuperar Grid cuando hay stream roto sin forzar una reapertura adicional al entrar en Eco.
- **Alcance protegido:**
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`, taps, swipes, teclado fisico ni replica de acciones.
  - No se modifico `scrcpy_raw_streamer.py`, `scrcpy_raw_ws_server.py`, parser FDH1, WebCodecs/decoder ni presets del backend.
  - No se cambio el layout visual de Focus ni estilos de la interfaz.
- **Validacion realizada:**
  - `node --check electron-app/src/renderer/flow-touch.js`
  - `node --check electron-app/src/renderer/stream-renderer-h264.js`
  - `GET http://127.0.0.1:8765/streaming/raw/sessions`: backend disponible, sin sesiones H.264 activas al momento de la consulta.

## ULTIMOS CAMBIOS (2026-06-21) - Handoff limpio Focus/Grid sin frames viejos

**FOCUS-GRID-H264-CLEAN-HANDOFF-01:**
- **Estado:** IMPLEMENTADO Y VALIDADO POR SINTAXIS.
- **Restore Point Creado:**
  - `restore_points/2026-06-21_183937_PRE_FOCUS_GRID_STREAM_HANDOFF`
- **Motivo:** Al cerrar un dispositivo en Focus, el Grid podia quedar mostrando un frame cacheado que no correspondia al estado real del telefono. Al reabrir Focus, se seguia pintando la imagen vieja hasta cambiar manualmente Eco/Balanced/Pro, lo que forzaba una reapertura limpia del stream.
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/stream-renderer-h264.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - `H264StreamRenderer.forceRestart(serial, preset)` ahora acepta un preset destino opcional para recrear la sesion fisica con la calidad correcta.
  - Al abrir Focus, se fuerza un restart limpio de la sesion H.264 del telefono con el preset de Focus antes de enganchar el canvas del overlay.
  - Al cerrar Focus, se elimina el canvas de Focus y se fuerza un restart limpio con el preset vigente del Grid, evitando reutilizar el ultimo bitmap cacheado del Focus.
  - Esto automatiza el efecto que antes se conseguia cambiando manualmente la resolucion, pero solo durante la transicion Grid/Focus.
- **Alcance protegido:**
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`, taps, swipes, teclado fisico ni replica de acciones.
  - No se modifico `scrcpy_raw_streamer.py`, `scrcpy_raw_ws_server.py`, parser FDH1, WebCodecs ni el decoder H.264.
  - No se cambio el layout visual del Focus ni estilos de la interfaz.
- **Validacion realizada:**
  - `node --check electron-app/src/renderer/flow-touch.js`
  - `node --check electron-app/src/renderer/stream-renderer-h264.js`

## ULTIMOS CAMBIOS (2026-06-21) - Presets seguros en consola ADB Grid/Focus

**ADB-SAFE-PRESETS-GRID-FOCUS-01:**
- **Estado:** IMPLEMENTADO Y VALIDADO POR SINTAXIS.
- **Restore Point Creado:**
  - `restore_points/2026-06-21_182101_PRE_ADB_PRESETS_SAFE`
- **Motivo:** El usuario pidio acciones preestablecidas en la consola ADB para poder cambiar/ver resolucion, DPI y acciones basicas desde Grid y desde el panel ADB de Focus sin tocar scrcpy-control, video H.264 ni la interfaz principal de Focus.
- **Archivos Modificados:**
  - `electron-app/src/renderer/app.js`
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - Se agrego una lista compacta de presets ADB reutilizable: ver resolucion, ver DPI, resoluciones 720x1280/900x1600/1080x1920, reset de resolucion, DPI 320/420, reset DPI, Wake y Home.
  - En el modal ADB de Grid, los presets solo rellenan el input del comando; el usuario debe pulsar `Ejecutar`.
  - En el panel ADB flotante de Focus, los presets tambien solo rellenan el input; se conserva la confirmacion bulk existente antes de ejecutar sobre Focus + replicas seleccionadas.
  - Los presets usan exclusivamente el endpoint existente `POST /adb`; no se agregaron endpoints nuevos ni rutas de control nuevas.
  - Se agregaron estilos `.adb-preset-strip` y `.adb-preset-btn` para mantener botones compactos y sin desbordes.
- **Alcance protegido:**
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico `scrcpy_raw_streamer.py`, `scrcpy_raw_ws_server.py` ni `stream-renderer-h264.js`.
  - No se modifico el decoder WebCodecs, el mapping de coordenadas, el canvas de Focus/Grid ni el pipeline H.264.
  - No se cambio el layout principal del modo Focus; solo se agregaron chips dentro de su ventana flotante ADB.
- **Validacion Realizada:**
  - `node --check electron-app/src/renderer/app.js`
  - `node --check electron-app/src/renderer/flow-touch.js`

## ULTIMOS CAMBIOS (2026-06-21) - Grid chip transporte compacto y lapiz de nombre

**GRID-COMPACT-TRANSPORT-NAME-EDIT-01:**
- **Estado:** IMPLEMENTADO Y VALIDADO POR SINTAXIS.
- **Restore Point Creado:**
  - `restore_points/2026-06-21_040523_GRID_COMPACT_TRANSPORT_NAME_EDIT_SNAPSHOT`
- **Motivo:** En Grid, el bloque superior mostraba informacion redundante como `device`, `WIFI/USB` y `Auto/Pref`, ocupando espacio y pudiendo sobreponerse con datos del dispositivo. El cambio de nombre desde Grid debia quedar como accion explicita mediante icono de lapiz y popover pequeno.
- **Archivos Modificados:**
  - `electron-app/src/renderer/app.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - La tarjeta Grid ya no muestra el chip separado de estado `device` ni el texto `Auto/Pref`.
  - El chip de transporte queda reducido a `WIFI` o `USB`, con tooltip de diagnostico y manteniendo clic para abrir la preferencia de transporte.
  - El nombre del dispositivo en Grid se muestra como texto truncado y el editor se abre desde un boton pequeno con icono de lapiz.
  - Se reutiliza `openDeviceNamePopover()` y el guardado existente; no se cambia persistencia ni backend.
  - Se agregaron estilos para que el nombre, lapiz, numero y chip de transporte no se monten entre si en tarjetas pequenas.
- **Validacion Realizada:**
  - `node --check electron-app/src/renderer/app.js`
  - `node --check electron-app/src/renderer/flow-touch.js`
- **Alcance protegido:**
  - No se modifico `local_adb_server.py`, `scrcpy_control_channel.py`, FlowAgent, FlowLogin, APK, OCR, MediaProjection ni pipeline H.264/WebCodecs.
  - No se cambio el comportamiento de seleccion, doble clic a Focus, menu contextual ni preferencia de transporte.

**GRID-COMPACT-TRANSPORT-NAME-EDIT-01B:**
- **Estado:** IMPLEMENTADO Y VALIDADO POR SINTAXIS.
- **Motivo:** Al abrir desde `.bat`, algunos dispositivos ADB WiFi/OTG aparecian como `USB` porque el Grid dependia demasiado de `transports.type`. Ademas, el lapiz quedaba demasiado lejos del nombre y el popover de nombre no cerraba con Cancelar/Guardar por interceptar `click` en fase capture.
- **Cambio Aplicado:**
  - El chip `WIFI/USB` ahora detecta WiFi tambien por serial `:5555`, `connectionType`, `status`, `adbState` y transportes serializados.
  - El boton de lapiz queda inline pegado a la derecha del nombre, no al extremo del bloque.
  - El popover de nombre solo bloquea `pointerdown/mousedown` en capture; el `click` se detiene en burbuja para que los botones internos reciban su accion.
- **Validacion Realizada:**
  - `node --check electron-app/src/renderer/app.js`
- **Alcance protegido:**
  - No se modifico backend, scrcpy-control, H.264, FlowAgent, FlowLogin ni persistencia de nombres.

## ULTIMOS CAMBIOS (2026-06-21) - Focus nombre estable y H.264 tras reconexion

**FOCUS-NAME-H264-RECONNECT-STABILITY-01:**
- **Estado:** IMPLEMENTADO Y VERIFICADO TECNICAMENTE.
- **Restore Point Creado:**
  - `restore_points/2026-06-21_035146_FOCUS_NAME_H264_RECONNECT_SNAPSHOT`
- **Motivo:** En Focus, el popover para editar nombre podia perder escritura cuando el canvas seguia capturando el teclado fisico. Tras reiniciar un dispositivo, Grid podia volver con pantalla negra hasta forzar manualmente un cambio de calidad/resolucion.
- **Archivos Modificados:**
  - `electron-app/src/renderer/app.js`
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/stream-renderer-h264.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - `flow-touch.js` deja de considerar el canvas como destino de teclado si el evento o el foco activo pertenecen a inputs, popovers, ventanas PRO o elementos marcados con `data-flowtouch-ui`.
  - Al abrir el popover de nombre desde Focus, se desactiva el objetivo de teclado del canvas y se quita foco al canvas para evitar que el teclado fisico envie texto al Android.
  - `app.js` marca el popover de nombre como UI de dashboard, refuerza el foco del input al abrirlo y detiene propagacion de eventos de teclado/click dentro del popover.
  - `loadDevices()` ya no mantiene un estado temporal `rebooting/offline` cuando Python vuelve a reportar el dispositivo como `device`.
  - Cuando un dispositivo transiciona de no disponible a `device`, `app.js` agenda un refresco suave del stream.
  - `stream-renderer-h264.js` agrega `forceRestart(serial)` para reiniciar socket/decoder H.264 preservando canvases existentes de Grid/Focus, equivalente al efecto de cambiar calidad pero automatico tras reconexion.
  - El detector de frame valido en `attachFocus()` usa `_frameW/_frameH`, que son las dimensiones reales usadas por la sesion.
- **Alcance protegido:**
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.
  - No se cambio el diseno visual del Focus flotante; solo se aislo el teclado del popover de nombre.
- **Validacion Realizada:**
  - `node --check electron-app/src/renderer/app.js`
  - `node --check electron-app/src/renderer/flow-touch.js`
  - `node --check electron-app/src/renderer/stream-renderer-h264.js`
  - `python -m py_compile local_adb_server.py scrcpy_control_channel.py`
  - `abrir_electron.bat` inicia un Electron unico de usuario; backend Python queda activo.
  - `GET http://127.0.0.1:8765/health`: OK.
  - `GET http://127.0.0.1:8765/devices`: 17 dispositivos en `state=device`.
  - `GET http://127.0.0.1:8765/agents`: 17 FlowAgents conectados.
  - `GET http://127.0.0.1:8765/streaming/raw/sessions`: sesiones H.264 vivas con SPS/PPS/IDR y `startup_stalled=false`.

## ULTIMOS CAMBIOS (2026-06-21) - FlowAgent auto-reconnect y Grid sin frame congelado

**FLOWAGENT-AUTORECONNECT-GRID-OFFLINE-01:**
- **Estado:** IMPLEMENTADO Y VERIFICADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-21_030718_PRE_FLOWAGENT_AUTORECONNECT_GRID_OFFLINE`
- **Motivo:** Al abrir el dashboard con `abrir_electron.bat`, FlowAgent podia aparecer como no conectado hasta pulsar manualmente `Instalar FlowAgent`, aunque el APK ya estuviera instalado. Tras reiniciar un dispositivo, tambien podia quedar sin reconectar automaticamente. Ademas, Grid podia conservar el ultimo frame del telefono mientras el dispositivo estaba desconectado/reiniciando.
- **Archivos Modificados:**
  - `local_adb_server.py`
  - `electron-app/src/renderer/app.js`
  - `docs/master_technical_specification.md`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - `local_adb_server.py` inicia un loop seguro de auto-reconnect para FlowAgent al arrancar el backend Python.
  - El loop solo actua sobre dispositivos ADB online con `com.flowlogin.agent` ya instalado y en version vigente.
  - Para reconectar aplica `adb reverse` en `8766`, `8765` y `5000`, verifica `sys.boot_completed`, relanza `com.flowlogin.agent/.MainActivity` con `host=127.0.0.1`, `serial`, `port=8766` y `autoconnect=true`, y valida socket con `engine_probe`.
  - El loop usa cooldown/backoff por serial y limpieza de sockets FlowAgent stale para no saturar los telefonos ni dejar conexiones obsoletas tras reboot.
  - Si el APK falta o esta viejo, el loop NO instala ni actualiza automaticamente; queda para accion manual del usuario.
  - `app.js` respeta `state/status` reales de `/devices`, agrega estados locales `rebooting/offline` para acciones de energia y limpia el canvas del Grid cuando el dispositivo no esta disponible.
  - La limpieza del canvas se ejecuta tambien si esta disponible el `streamRenderer`, para no depender solo de la instancia H.264 al mostrar estados offline/rebooting.
  - Al reiniciar/apagar desde el dashboard, la tarjeta pasa inmediatamente a estado visual de `rebooting` u `offline` y se elimina el ultimo frame congelado.
  - `docs/master_technical_specification.md` aclara que recomponer socket FlowAgent con reverse + relaunch esta permitido si el APK ya existe y esta vigente, sin reinstalar ni usar FlowAgent para control manual.
- **Validacion Realizada:**
  - `node --check electron-app/src/renderer/app.js`
  - `node --check electron-app/src/renderer/stream-renderer-h264.js`
  - `python -m py_compile local_adb_server.py scrcpy_control_channel.py`
  - `abrir_electron.bat`
  - `GET http://127.0.0.1:8765/health`: OK.
  - `GET http://127.0.0.1:8765/devices`: 17 dispositivos ADB online.
  - `GET http://127.0.0.1:8765/agents`: subio automaticamente hasta 17 FlowAgents conectados tras el arranque, sin pulsar `Instalar FlowAgent`.
  - Re-verificacion posterior tras esperar mas de un ciclo largo: `/agents` se mantuvo en 17 conectados; se ajusto la limpieza stale para no cerrar agentes vivos por TTL cuando no envian heartbeat constante.
  - `adb reverse --list` en dispositivo canary confirma `8766`, `8765` y `5000`.
- **Alcance protegido:**
  - No se modifico `flow-touch.js` ni la interfaz Focus flotante estabilizada.
  - No se modifico `stream-renderer-h264.js` ni el pipeline H.264/WebCodecs.
  - No se modifico `scrcpy_control_channel.py` ni los endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR ni MediaProjection.
  - FlowAgent sigue sin usarse como fallback de control manual; el control manual sigue por scrcpy-control.

## ULTIMOS CAMBIOS (2026-06-21) - Focus texto, teclado fisico y replica controlada

**FOCUS-SCRCPY-TEXT-KEYBOARD-REPLICA-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-21_011754_PRE_SCRCPY_TEXT_KEYBOARD_REPLICA`
- **Motivo:** Completar el plan posterior al Focus flotante estable: permitir texto/clipboard por scrcpy-control, escritura con teclado fisico en el canvas de Focus, replica de control manual desde un Focus maestro hacia dispositivos seleccionados en Grid y acciones masivas con confirmacion.
- **Archivos Modificados:**
  - `scrcpy_control_channel.py`
  - `local_adb_server.py`
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - `scrcpy_control_channel.py` agrega mensajes oficiales de control scrcpy `TYPE_INJECT_TEXT` y `TYPE_SET_CLIPBOARD`, mas keyevents para `enter`, `backspace`, `tab` y flechas.
  - `local_adb_server.py` expone `/control/type-text` y `/control/paste-text`; `type-text` usa scrcpy-control con fallback ADB acotado y `paste-text` usa scrcpy-control sin fallback.
  - El canvas de Focus recibe foco al tocar la pantalla; desde ahi el teclado fisico envia texto imprimible, Enter, Backspace, Tab, flechas y Escape como Back de Android. No captura escritura cuando el usuario esta en inputs, textareas, popovers o ventanas PRO.
  - `Ctrl+V`/`Cmd+V` en el canvas de Focus lee el clipboard del PC y lo envia al dispositivo por `/control/paste-text`.
  - Se agrego el toggle `Replicar acciones` en el header de Focus. Cuando esta activo, taps, swipes, live touch, Back/Home/Recents, texto y paste se replican desde el dispositivo Focus hacia los dispositivos seleccionados en Grid, usando siempre endpoints `/control/*`.
  - En Focus PRO, si `Replicar acciones` esta activo, Apps, instalar APK, Auto.js, ADB Shell, FlowAgent install/check y Energia pueden ejecutarse sobre Focus + seleccionados del Grid. Las acciones de riesgo piden confirmacion con conteo/lista de targets antes de ejecutar.
  - Los errores de replicas se aislan por dispositivo para no bloquear el maestro ni detener el dashboard completo.
- **Validacion Realizada:**
  - `node --check electron-app/src/renderer/flow-touch.js`
  - `node --check electron-app/src/renderer/app.js`
  - `node --check electron-app/src/renderer/stream-renderer-h264.js`
  - `python -m py_compile local_adb_server.py scrcpy_control_channel.py`
- **Alcance protegido:**
  - No se redisenaron ni movieron contenedores del Focus flotante ya estabilizado.
  - No se modifico el pipeline de video H.264/WebCodecs ni `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR ni MediaProjection.
  - FlowAgent no se usa como fallback de control manual; el control manual sigue por scrcpy-control y endpoints `/control/*`.

## ULTIMOS CAMBIOS (2026-06-21) - Focus runtime inmediato, Auto.js simplificado e Inspector flexible

**FOCUS-RUNTIME-AUTOJS-INSPECTOR-REFINEMENT-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-21_004314_PRE_FOCUS_RUNTIME_AUTOJS_INSPECTOR_REFINEMENT`
- **Motivo:** En Focus avanzado, el boton rojo de detener ejecucion podia no aparecer inmediatamente al iniciar `Login.js` hasta alternar a vista clasica y volver. La ventana Auto.js mostraba opciones legacy (`Preparar Auto.js`, `Instalar AutoJs6`, `Forzar reenviar`) que no corresponden al flujo vigente con FlowAgent. El Inspector necesitaba mas espacio util tras capturar UI.
- **Archivos Modificados:**
  - `electron-app/src/renderer/app.js`
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - `app.js` ahora emite `flowdashboard:runtime-state-changed` cuando cambia `runningFlow`.
  - `contextExecutePending()` marca `FlowLogin` como flujo activo al lanzar `/sdcard/Download/Login.js` desde menu contextual, y `contextStopLogin()` limpia el estado al detener.
  - `flow-touch.js` escucha ese evento y refresca inmediatamente el boton flotante de detener en Focus clasico y avanzado.
  - Al cambiar entre vista clasica/avanzada tambien se fuerza refresco del estado runtime.
  - La ventana Auto.js del Focus conserva elegir `.js` y `Detener`, pero reemplaza las opciones legacy por `Instalar FlowAgent`, reutilizando el mismo flujo `contextInstallFlowAgent()` del menu de clic derecho del Grid.
  - Se eliminaron del Focus las opciones visibles `Preparar Auto.js`, `Instalar AutoJs6` y `Forzar reenviar`.
  - El Inspector compacta las acciones de detalle (`Texto`, `Source`, `JSON`, `Tap`, `Click`) y el contenedor de resultados ahora permite resize vertical para ganar espacio despues de `Capturar UI`.
- **Alcance protegido:**
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni el pipeline H.264/WebCodecs.

## ULTIMOS CAMBIOS (2026-06-21) - Focus boton detener visible por ejecucion global

**FOCUS-RUNTIME-STOP-VISIBILITY-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-21_002911_PRE_FOCUS_RUNTIME_STOP_VISIBILITY`
- **Motivo:** El boton rojo de detener ejecucion del modo Focus podia no aparecer aunque el Grid mostrara un flujo en ejecucion, porque Focus solo revisaba estados por cuenta/clon mediante `isDeviceRunning(serial)` y no consideraba el indicador global `runningFlow`.
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - El boton `flowTouchRuntimeStopBtn` ahora aparece en Focus clasico y avanzado si el dispositivo tiene estados activos o si el dashboard tiene un flujo global en ejecucion (`runningFlow`).
  - El tooltip/aria-label del boton muestra el nombre del flujo cuando esta disponible.
  - Al detener desde Focus se aplica una supresion visual corta para evitar que el boton reaparezca inmediatamente mientras se refrescan estados.
- **Alcance protegido:**
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.

## ULTIMOS CAMBIOS (2026-06-21) - Focus header IP, numero flotante y stop arriba

**FOCUS-HEADER-NUMBER-RUNTIME-POSITION-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-21_000450_PRE_FOCUS_HEADER_NUMBER_RUNTIME_POSITION`
- **Motivo:** Refinar posicionamiento visual del Focus: el boton de stop de ejecucion quedaba demasiado abajo, la IP publica debe verse bajo el nombre y el numero del Grid debe quedar como badge flotante fuera del header.
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - El numero del dispositivo se saco del `flowtouch-window-drag-strip` y ahora es un badge flotante independiente a la izquierda del header.
  - El badge conserva el mismo valor persistente del Grid (`app.getDeviceNumber(device)`).
  - La IP publica con bandera queda forzada visible en modo clasico y avanzado, debajo del nombre del dispositivo dentro del header.
  - El boton de stop/runtime se reposiciono en el lateral derecho, arriba de la columna de bolitas de cuentas.
- **Alcance protegido:**
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.

## ULTIMOS CAMBIOS (2026-06-20) - Focus numero, cuentas flotantes y runtime stop

**FOCUS-NUMBER-ACCOUNT-WINDOW-RUNTIME-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_235346_PRE_FOCUS_NUMBER_ACCOUNT_WINDOW_SINGLE_PRO_RUNNING_STOP`
- **Motivo:** Completar UX comercial de Focus mostrando el numero real del dispositivo, haciendo que Cuentas sea una ventana emergente compacta, limitando Focus PRO a una sola ventana activa y agregando indicador/stop de ejecucion activa.
- **Archivos Modificados:**
  - `electron-app/src/renderer/app.js`
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - Focus muestra el mismo numero persistente del Grid usando `app.getDeviceNumber(device)`.
  - El boton lateral `Cuentas` abre el editor existente como modal flotante compacta en Focus, con fondo transparente y sin cubrir visualmente toda la pantalla.
  - Al abrir cualquier ventana PRO (`Apps`, `ADB`, `Archivos`, etc.) se cierra la ventana PRO anterior; solo queda una activa a la vez.
  - Al abrir una ventana PRO se cierra tambien el editor flotante de Cuentas si estaba abierto.
  - Al cerrar Focus se limpian las ventanas flotantes asociadas.
  - Se agrego boton de stop/runtime junto a las bolitas de cuentas; aparece solo cuando `app.isDeviceRunning(serial)` detecta ejecucion activa y permite detener mediante `autoJsStopForSerial(serial)`.
- **Alcance protegido:**
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.

## ULTIMOS CAMBIOS (2026-06-20) - Focus IP, calidad compacta y ventanas PRO libres

**FOCUS-IP-QUALITY-PRO-WINDOWS-SIDE-ACTIONS-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_233848_PRE_FOCUS_IP_QUALITY_FLOAT_WINDOWS_SIDE_ACTIONS`
- **Motivo:** Mejorar el header y las acciones del Focus: mostrar IP publica con bandera en el header visible, ahorrar espacio en Eco/Balanced/Pro usando iconos, permitir que ventanas PRO como Apps se muevan por todo el overlay, y exponer Cuentas/Opciones como botones laterales.
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - La IP publica con bandera se movio al header activo de Focus (`flowTouchFocusIp`), no al bloque legacy oculto.
  - El header mantiene ancho maximo de pantalla del dispositivo y organiza titulo, IP, estados y calidad en filas compactas.
  - Eco/Balanced/Pro usan iconos SVG inline con `title`/`aria-label`, sin texto visible.
  - Los botones `Ver cuentas` y `Opciones del dispositivo` se movieron al rail lateral izquierdo como acciones tipo herramienta, debajo de Inspector.
  - En modo clasico el rail lateral muestra solo Cuentas/Opciones; en avanzado muestra herramientas + Cuentas/Opciones.
  - Las ventanas flotantes PRO (`fp-window`, por ejemplo Apps) ahora se insertan en el overlay completo y se pueden mover con rango de viewport amplio, no encerradas por la shell transformada del Focus.
  - Se corrigio el z-index activo de las ventanas PRO para que no queden detras del Focus.
- **Alcance protegido:**
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.

## ULTIMOS CAMBIOS (2026-06-20) - Focus herramientas sin panel y header ajustado

**FOCUS-HEADER-TOOLS-DOTS-REFINEMENT-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_232901_PRE_FOCUS_HEADER_TOOL_DOTS_REFINEMENT`
- **Motivo:** Refinar el Focus sin contenedor principal: quitar tambien el contenedor visual del lateral de herramientas, limitar el header al ancho del telefono y recuperar las bolitas de cuentas en vista avanzada.
- **Archivos Modificados:**
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - El panel lateral de herramientas ya no dibuja fondo, borde, sombra ni blur; solo quedan visibles los botones individuales.
  - Los botones de herramientas conservan estilo comercial individual con vidrio ligero, color y hover, pero sin caja contenedora detras.
  - El header de Focus queda limitado a `--focus-phone-w`, para no superar el ancho visual de la pantalla del dispositivo.
  - El header puede distribuir su contenido en hasta tres filas: titulo/acciones, estados tecnicos y selector de calidad, manteniendo el ancho del telefono.
  - En vista clasica se siguen ocultando estados tecnicos y selector de calidad para mantener la cabecera compacta.
  - Las bolitas de cuentas vuelven a mostrarse tambien en vista avanzada, posicionadas fuera del borde derecho del telefono.
- **Alcance protegido:**
  - No se modifico `flow-touch.js`.
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.

## ULTIMOS CAMBIOS (2026-06-20) - Focus sin contenedor principal visible

**FOCUS-TRANSPARENT-SHELL-PHONE-RESIZE-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_232236_PRE_FOCUS_TRANSPARENT_SHELL_PHONE_RESIZE`
- **Motivo:** El Focus seguia mostrando una caja/contenedor general alrededor del header, la pantalla y herramientas. La UX deseada es que ese contenedor principal no exista visualmente; solo deben verse las piezas funcionales: header, telefono y herramientas laterales cuando se active avanzado.
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - La shell `flowtouch-focus-shell` queda como superficie logica para posicion, drag, resize y persistencia de geometria, pero ya no dibuja fondo, borde, sombra, padding ni blur.
  - El header, el marco del telefono y el panel de herramientas quedan como contenedores visuales independientes.
  - El asa de redimensionar se movio desde la esquina inferior derecha de la shell al borde inferior derecho del marco del telefono.
  - Se mantiene el resize manual con el mismo handler `data-flowtouch-focus-resize`, sin tocar el canvas, CoordinateMapper, stream ni control tactil.
  - En avanzado se conserva solo el carril de herramientas + telefono; no se reactiva historial ni carril derecho.
- **Alcance protegido:**
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.

## ULTIMOS CAMBIOS (2026-06-20) - Focus avanzado simplificado y resize adaptativo

**FOCUS-ADVANCED-SIMPLIFY-RESPONSIVE-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_231503_PRE_FOCUS_ADVANCED_UI_SIMPLIFY_RESIZE_NAME`
- **Motivo:** Ajustar la UX final de Focus: quitar historial de eventos del modo avanzado, quitar Back/Home/Recents tambien en modo clasico, adaptar mejor el telefono al resize y permitir editar el nombre desde la barra superior.
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - El titulo de la barra superior ahora es el boton editable `flowTouchDeviceNameBtn`, visible en modo clasico y avanzado.
  - El antiguo boton interno de nombre queda como legacy sin ID duplicado.
  - El click sobre el titulo editable no inicia movimiento de ventana; abre el editor de nombre.
  - Se oculto la barra inferior Back/Home/Recents en todos los modos de Focus.
  - Se oculto el historial de eventos del modo avanzado.
  - El avanzado ahora reserva lateral principalmente para herramientas + telefono, sin carril de historial.
  - La vista normal recalcula ancho desde la altura util del telefono para mantener proporcion 9:16.
  - Al agrandar manualmente la ventana en avanzado, las herramientas pasan a mostrar icono + texto en `focus-size-lg`.
- **Alcance protegido:**
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.
- **Validaciones realizadas:**
  - `node --check electron-app\src\renderer\flow-touch.js`: OK.
  - `node --check electron-app\src\renderer\app.js`: OK.
  - `node --check electron-app\src\renderer\stream-renderer-h264.js`: OK.
  - `python -m py_compile local_adb_server.py scrcpy_control_channel.py`: OK.

## ULTIMOS CAMBIOS (2026-06-20) - Focus ventana responsive refinada

**FOCUS-RESPONSIVE-ADVANCED-REFINEMENT-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_230743_PRE_FOCUS_RESPONSIVE_ADVANCED_REFINEMENT`
- **Motivo:** Ajustar la ventana Focus ya movible para que en vista normal se adapte mejor al tamano real de la pantalla del dispositivo, y para que vista avanzada despliegue herramientas laterales sin mostrar controles Back/Home/Recents ni el icono de seis puntos.
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - Se elimino del DOM el boton/icono superior izquierdo de seis puntos (`flowtouch-window-grip`).
  - La geometria default de Focus limpio calcula el ancho desde la altura util del telefono, manteniendo proporcion 9:16 y una ventana mas ajustada.
  - Al abrir Focus limpio desde una geometria avanzada anterior, se normaliza el ancho para volver a ajustarse al telefono.
  - Al activar avanzado, la ventana se ensancha de forma controlada para herramientas + telefono + historial.
  - En avanzado se oculta la barra inferior Back/Home/Recents.
  - En avanzado pequeno/medio las herramientas se mantienen compactas con iconos; al agrandar manualmente la ventana (`focus-size-lg`) aparecen los nombres de las opciones.
- **Alcance protegido:**
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.
- **Validaciones realizadas:**
  - `node --check electron-app\src\renderer\flow-touch.js`: OK.
  - `node --check electron-app\src\renderer\app.js`: OK.
  - `node --check electron-app\src\renderer\stream-renderer-h264.js`: OK.
  - `python -m py_compile local_adb_server.py scrcpy_control_channel.py`: OK.

## ULTIMOS CAMBIOS (2026-06-20) - Focus movimiento por transform

**FOCUS-TRANSFORM-WINDOW-MOVE-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_225712_PRE_FOCUS_TRANSFORM_WINDOW_MOVE`
- **Motivo:** El Focus seguia sin moverse como una ventana normal y mostraba cursor tipo mano/drag. Se elimino la dependencia visual de `left/top` como mecanismo principal y se paso a posicionamiento por `transform: translate3d(...)`, que no pelea con reglas CSS legacy del layout.
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - Nueva clave de geometria `flowdashboard.focus.window.geometry.transform`.
  - La ventana Focus queda en `left:0; top:0` y se mueve visualmente mediante `transform: translate3d(x, y, 0)`.
  - El drag conserva y persiste `--flowtouch-focus-window-x/y`.
  - Resize conserva la posicion transformada en vez de usar `rect.left/top` como base.
  - La barra de movimiento deja de mostrar cursor de mano/grab; usa cursor normal para sentirse mas como titlebar de ventana.
- **Alcance protegido:**
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.
- **Validaciones realizadas:**
  - `node --check electron-app\src\renderer\flow-touch.js`: OK.
  - `node --check electron-app\src\renderer\app.js`: OK.
  - `node --check electron-app\src\renderer\stream-renderer-h264.js`: OK.
  - `python -m py_compile local_adb_server.py scrcpy_control_channel.py`: OK.

## ULTIMOS CAMBIOS (2026-06-20) - Focus como ventana compacta

**FOCUS-WINDOW-REDESIGN-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_221929_PRE_FOCUS_WINDOW_REDESIGN`
- **Motivo:** El Focus seguia sin sentirse movible porque el diseno anterior usaba una shell transparente/logica mas grande que la pantalla visible. Se replanteo como una ventana compacta real, del tamano de la pantalla del telefono, con barra superior de arrastre tipo ventana.
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - Nueva clase visual `focus-window` encima de `focus-v2`.
  - Nueva clave de geometria `flowdashboard.focus.window.geometry.window` para arrancar limpio, sin heredar estados anteriores.
  - La vista limpia usa una ventana compacta alrededor del telefono, con marco visible, colorido y barra superior.
  - Se agrego `flowtouch-window-drag-strip` como zona grande y clara para mover toda la ventana Focus.
  - En modo avanzado, la ventana se ensancha de forma controlada y muestra herramientas pequeñas a la izquierda e historial a la derecha sin cubrir el canvas.
  - El asa lateral se oculta en este rediseño; la barra superior es la zona principal de movimiento.
  - La pantalla del dispositivo mantiene sus IDs y handlers; el canvas sigue siendo zona de taps/swipes y no zona de drag.
- **Alcance protegido:**
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.
- **Validaciones realizadas:**
  - `node --check electron-app\src\renderer\flow-touch.js`: OK.
  - `node --check electron-app\src\renderer\app.js`: OK.
  - `node --check electron-app\src\renderer\stream-renderer-h264.js`: OK.
  - `python -m py_compile local_adb_server.py scrcpy_control_channel.py`: OK.

## ULTIMOS CAMBIOS (2026-06-20) - Focus drag libre

**FOCUS-DRAG-DEDICATED-FIX-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_221458_PRE_FOCUS_DRAG_DEDICATED_FIX`
- **Motivo:** El resize desde la esquina inferior derecha funcionaba, pero el movimiento de la ventana Focus se percibia anclado arriba/izquierda. La causa probable era doble: el drag compartia una ruta demasiado generica con header/botones y el clamp mantenia toda la ventana logica dentro del viewport, aunque parte de esa ventana es transparente.
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - El drag de Focus ahora usa una ruta dedicada para elementos `data-flowtouch-window-drag`.
  - Durante el movimiento se actualizan `left/top` directamente, conservando `width/height` y sin recalcular todo el layout en cada frame.
  - El clamp de geometria permite que la ventana logica salga parcialmente del viewport mientras conserva una zona visible/recuperable, para que el telefono pueda desplazarse libremente por la pantalla aunque el shell sea grande o transparente.
  - El resize mantiene su flujo existente.
- **Alcance protegido:**
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.
- **Validaciones realizadas:**
  - `node --check electron-app\src\renderer\flow-touch.js`: OK.
  - `node --check electron-app\src\renderer\app.js`: OK.
  - `node --check electron-app\src\renderer\stream-renderer-h264.js`: OK.
  - `python -m py_compile local_adb_server.py scrcpy_control_channel.py`: OK.

## ULTIMOS CAMBIOS (2026-06-20) - Focus v2 limpio y movible

**FOCUS-V2-CLEAN-REBUILD-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_211922_PRE_FOCUS_V2_CLEAN_REBUILD`
- **Motivo:** El Focus previo podia heredar geometria rota desde `localStorage`, el header/boton avanzado podia quedar fuera de vista y las reglas CSS antiguas seguian peleando con los paneles laterales. Se aislo la nueva interfaz con clase `focus-v2` y una clave de geometria nueva.
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - Focus usa ahora `flowdashboard.focus.window.geometry.v2`, evitando posiciones/tamanos antiguos guardados.
  - El shell de Focus agrega clase `focus-v2` para que el nuevo CSS no dependa de las reglas legacy.
  - Header y footer quedan dentro de la ventana logica, no con offsets negativos; el boton de modo avanzado queda visible.
  - El cuerpo de Focus queda en una grilla real: herramientas | pantalla del dispositivo | historial.
  - En modo limpio solo queda visible la pantalla del dispositivo con controles externos, sin paneles sobre el canvas.
  - En modo avanzado herramientas e historial aparecen en carriles laterales fuera de la pantalla del dispositivo.
  - Las bolitas de cuentas y el asa lateral se calculan desde el borde real del telefono, para no pisar el canvas ni los paneles al cambiar entre limpio/avanzado.
  - El asa superior y el asa lateral siguen usando `data-flowtouch-window-drag`; mover Focus no mueve la ventana principal de Electron.
  - El resize conserva el mismo handler y solo cambia la presentacion visual.
- **Alcance protegido:**
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.
- **Validaciones realizadas:**
  - `node --check electron-app\src\renderer\flow-touch.js`: OK.
  - `node --check electron-app\src\renderer\app.js`: OK.
  - `node --check electron-app\src\renderer\stream-renderer-h264.js`: OK.
  - `python -m py_compile local_adb_server.py scrcpy_control_channel.py`: OK.
- **Pendiente recomendado:**
  - Validacion visual manual en Electron: abrir un Focus nuevo, mover desde el asa superior o lateral, activar avanzado y confirmar que herramientas/historial quedan fuera del telefono.

## ULTIMOS CAMBIOS (2026-06-20) - Rebuild Focus ventana logica

**FOCUS-LOGICAL-WINDOW-REBUILD-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_204914_PRE_FOCUS_LOGICAL_WINDOW_REBUILD`
- **Motivo:** El enfoque anterior con shell transparente y paneles absolutos seguia produciendo fallos: Focus quedaba pegado arriba/izquierda, el drag no era confiable y las herramientas/historial podian terminar encima de la pantalla del dispositivo. Se rehizo el modelo visual como ventana logica movible con carriles.
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - Focus descarta geometria antigua/invalida si queda pegada arriba-izquierda o demasiado pequena.
  - La geometria default vuelve a centrarse y usa un ancho logico mayor para telefono + laterales.
  - El drag escucha en `window` y `document` durante el movimiento, con fallback `pointer*` y `mouse*`.
  - El shell de Focus vuelve a recibir `pointer-events:auto` para que Electron entregue eventos de drag de forma confiable; las zonas internas de video/paneles siguen controladas explicitamente.
  - El layout avanzado se rehizo como grilla de tres carriles: `herramientas | telefono | historial`.
  - En modo limpio los carriles laterales quedan invisibles, pero el telefono queda como pieza central.
  - En modo avanzado herramientas e historial aparecen en carriles laterales reales, no encima del canvas.
  - Las bolitas de cuentas se posicionan fuera del borde derecho del telefono.
- **Alcance protegido:**
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.
- **Validaciones realizadas:**
  - `node --check electron-app\src\renderer\flow-touch.js`: OK.
  - `node --check electron-app\src\renderer\app.js`: OK.
  - `node --check electron-app\src\renderer\stream-renderer-h264.js`: OK.
  - `python -m py_compile local_adb_server.py scrcpy_control_channel.py`: OK.
  - `GET http://127.0.0.1:8765/health`: OK.
  - `abrir_electron.bat`: Electron reiniciado sin cache HTTP.
  - Log Electron: arranque correcto, H.264 renderer OK, C# y Python conectados.
- **Pendiente recomendado:**
  - Validacion visual manual: abrir Focus nuevo, confirmar que no queda pegado arriba/izquierda, moverlo desde asa superior o lateral y activar avanzado para verificar los carriles laterales.

## ULTIMOS CAMBIOS (2026-06-20) - Focus pantalla libre y rail lateral

**FOCUS-FREE-CANVAS-SIDE-RAILS-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_204316_PRE_FOCUS_FREE_CANVAS_SIDE_RAILS`
- **Motivo:** En modo avanzado, herramientas e historial seguian apareciendo encima de la pantalla del dispositivo. Tambien se necesitaba un asa mas grande y clara para mover Focus libremente sin tocar el canvas.
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - Se agrego un segundo asa de movimiento `flowtouch-side-move-handle` fuera del borde izquierdo del telefono, mas grande que el boton superior.
  - El drag de Focus ahora se puede iniciar desde cualquier elemento con `data-flowtouch-window-drag`; actualmente existen el asa superior y el asa lateral.
  - Herramientas e historial ya no usan clamp visual para meterse dentro del ancho del Focus: se posicionan con offsets fuera del frame real del telefono.
  - El historial se separo mas del borde derecho del telefono.
  - Las bolitas de cuentas se separaron del frame del dispositivo para quedar fuera de la pantalla.
  - La pantalla/canvas del dispositivo queda como zona libre: los paneles avanzados deben desplegarse en los laterales y no encima del contenido del telefono.
- **Alcance protegido:**
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.
- **Validaciones realizadas:**
  - `node --check electron-app\src\renderer\flow-touch.js`: OK.
  - `node --check electron-app\src\renderer\app.js`: OK.
  - `node --check electron-app\src\renderer\stream-renderer-h264.js`: OK.
  - `python -m py_compile local_adb_server.py scrcpy_control_channel.py`: OK.
  - `GET http://127.0.0.1:8765/health`: OK.
  - `abrir_electron.bat`: Electron reiniciado sin cache HTTP.
  - Log Electron: arranque correcto, C# y Python conectados, dispositivos renderizados.
- **Pendiente recomendado:**
  - Validacion visual manual: abrir Focus, arrastrar desde el asa lateral, activar avanzado y confirmar que herramientas/historial/bolitas quedan fuera del telefono.

## ULTIMOS CAMBIOS (2026-06-20) - Separacion drag Dashboard/Focus

**DASHBOARD-FOCUS-DRAG-SEPARATION-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_202250_PRE_DASHBOARD_FOCUS_DRAG_SEPARATION`
- **Motivo:** La barra superior del dashboard no se movia de forma confiable desde la zona del titulo/estado, y el Focus tampoco se desplazaba. Ademas, Focus debia moverse independiente de la ventana principal de Electron y los paneles/bolitas debian salir fuera del frame del telefono.
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - La barra superior de Electron mantiene `-webkit-app-region: drag` en `titlebar`, `titlebar-title` y `titlebar-status`.
  - Solo controles interactivos de la barra (`titlebar-controls`, `status-pill`, `status-panel`) quedan como `no-drag`.
  - Todo el overlay/Focus se marca explicitamente como `-webkit-app-region: no-drag` para que mover Focus no intente mover tambien la ventana principal.
  - El drag/resize de Focus ahora tiene fallback `mousedown/mousemove/mouseup` ademas de `pointer*`, con guardas para no duplicar eventos.
  - Las bolitas de cuentas de Focus se posicionan fuera del borde derecho calculado del telefono usando `--focus-phone-w`.
  - Los drawers avanzados se anclan desde los laterales calculados del telefono:
    - herramientas desde fuera del borde izquierdo.
    - historial desde fuera del borde derecho.
- **Alcance protegido:**
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.
- **Validaciones realizadas:**
  - `node --check electron-app\src\renderer\flow-touch.js`: OK.
  - `node --check electron-app\src\renderer\app.js`: OK.
  - `node --check electron-app\src\renderer\stream-renderer-h264.js`: OK.
  - `python -m py_compile local_adb_server.py scrcpy_control_channel.py`: OK.
  - `GET http://127.0.0.1:8765/health`: OK.
  - `abrir_electron.bat`: Electron reiniciado sin cache HTTP.
  - Log Electron: Focus/H.264 sin errores nuevos visibles; watchdog confirma frames validos al abrir Focus.
- **Pendiente recomendado:**
  - Validacion visual manual:
    - Arrastrar la ventana principal desde titulo/estado superior.
    - Abrir Focus y moverlo desde su asa sin que se mueva la ventana principal.
    - Activar avanzado y confirmar que herramientas/historial salen por fuera del telefono.
    - Confirmar que bolitas de cuentas quedan fuera del frame del dispositivo.

## ULTIMOS CAMBIOS (2026-06-20) - Fix mover Focus y drawers externos

**FOCUS-DRAG-OUTSIDE-DRAWERS-FIX-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_201634_PRE_FOCUS_DRAG_OUTSIDE_DRAWERS_FIX`
- **Motivo:** El boton/asa de mover Focus no desplazaba de forma confiable la ventana y, al activar modo avanzado, herramientas/historial se percibian dentro del contenedor del dispositivo en vez de desplegarse desde sus bordes hacia afuera.
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - El drag/resize de Focus ahora escucha `pointermove`, `pointerup` y `pointercancel` en `window` durante la operacion, para no perder el arrastre al salir del asa o pasar sobre el Grid.
  - Durante drag/resize se agregan clases temporales al `body` para bloquear seleccion accidental y mostrar cursor de arrastre.
  - Se agregaron variables CSS `--focus-phone-h` y `--focus-phone-w` para calcular el tamano real del frame del telefono dentro del Focus.
  - Los drawers de herramientas e historial ahora se posicionan desde los laterales calculados del telefono:
    - Herramientas salen por fuera del borde izquierdo del dispositivo.
    - Historial sale por fuera del borde derecho del dispositivo.
  - El telefono mantiene su frame central y los paneles avanzados dejan de parecer incrustados dentro del area del dispositivo.
- **Alcance protegido:**
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.
- **Validaciones realizadas:**
  - `node --check electron-app\src\renderer\flow-touch.js`: OK.
  - `node --check electron-app\src\renderer\app.js`: OK.
  - `node --check electron-app\src\renderer\stream-renderer-h264.js`: OK.
  - `python -m py_compile local_adb_server.py scrcpy_control_channel.py`: OK.
- **Pendiente recomendado:**
  - Validacion visual manual: arrastrar desde el asa de Focus, abrir modo avanzado y confirmar que herramientas/historial salen fuera del frame del telefono, no encima/dentro de la pantalla.

## ULTIMOS CAMBIOS (2026-06-20) - Focus phone-only limpio

**FOCUS-PHONE-ONLY-CLEAN-MODE-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_182219_PRE_FOCUS_PHONE_ONLY_CLEAN_MODE`
- **Motivo:** El Focus flotante aun se percibia como una ventana visual. El objetivo comercial es que el modo limpio muestre principalmente la pantalla del dispositivo, con controles minimos flotantes y herramientas/historial desplegables bajo demanda.
- **Archivos Modificados:**
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - La shell flotante de Focus ahora es transparente, sin borde visible, sin fondo de ventana y sin sombra global.
  - En modo limpio se ocultan titulo, estado tecnico y selector de calidad para que el elemento visual dominante sea solo el frame del telefono.
  - Los controles principales quedan como botones flotantes: asa de mover, boton de avanzado y cerrar.
  - La barra Back/Home/Recents queda como una pildora flotante sutil en la parte inferior y aumenta visibilidad al hover/focus.
  - Las zonas vacias de la shell dejan pasar eventos hacia el Grid usando `pointer-events: none`; solo canvas, controles, resize handle y drawers capturan eventos.
  - Herramientas e historial se mantienen como drawers glass/translucidos del modo avanzado, sin recuperar apariencia de ventana completa.
- **Alcance protegido:**
  - No se modifico `flow-touch.js` en esta fase.
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.
- **Validaciones realizadas:**
  - `node --check electron-app\src\renderer\flow-touch.js`: OK.
  - `node --check electron-app\src\renderer\app.js`: OK.
  - `node --check electron-app\src\renderer\stream-renderer-h264.js`: OK.
  - `python -m py_compile local_adb_server.py scrcpy_control_channel.py`: OK.
  - `GET http://127.0.0.1:8765/health`: OK.
  - `GET http://127.0.0.1:8765/control/scrcpy-sessions`: disponible; se observo sesion activa al abrir Focus/control en runtime.
  - Log Electron: Focus agrego canvas H.264 y watchdog confirmo frame valido.
- **Pendiente recomendado:**
  - Validacion visual manual: confirmar que en modo limpio solo se percibe la pantalla del dispositivo, que el asa mueve la ventana, que el boton avanzado despliega herramientas/historial y que las zonas transparentes permiten interactuar con el Grid detras.

## ULTIMOS CAMBIOS (2026-06-20) - Focus flotante responsive comercial

**FOCUS-FLOATING-RESPONSIVE-UI-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_180422_PRE_FOCUS_FLOATING_RESPONSIVE_UI`
- **Motivo:** Corregir la primera version de Focus flotante: el header tenia muy poca zona real de arrastre y los paneles de herramientas/historial no respondian al tamano elegido de la ventana Focus.
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - Se agrego un asa dedicada `flowtouch-window-grip` para mover la ventana Focus de forma visible y comoda.
  - El drag/resize de la ventana Focus ahora usa eventos `pointer*` en vez de depender solo de `mousedown/mousemove`, manteniendo mouse/touch mas estable.
  - Se agrego `ResizeObserver` para clasificar el Focus segun su tamano real con clases `focus-size-sm`, `focus-size-md`, `focus-size-lg` y `focus-height-short`.
  - El modo limpio prioriza la pantalla del dispositivo y mantiene controles compactos.
  - El modo avanzado abre herramientas e historial como drawers glass/translucidos desde los laterales, sin obligar a que la ventana crezca ni deforme el telefono.
  - Las herramientas se compactan a iconos en ventanas pequenas y el historial reduce tipografia/controles para evitar desbordes.
  - Se redujo el tamano minimo permitido de Focus a una base mas manejable (`320x360`) con clamp al viewport.
- **Alcance protegido:**
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.
  - No se cambio el pipeline H.264/WebCodecs.
- **Validaciones realizadas:**
  - `node --check electron-app\src\renderer\flow-touch.js`: OK.
  - `node --check electron-app\src\renderer\app.js`: OK.
  - `node --check electron-app\src\renderer\stream-renderer-h264.js`: OK.
  - `python -m py_compile local_adb_server.py scrcpy_control_channel.py`: OK.
  - Arranque runtime con `abrir_electron.bat`: Electron, backend Python/socket y backend C# levantaron.
  - `GET http://127.0.0.1:8765/health`: OK.
  - `GET http://127.0.0.1:5000/api/health`: OK.
  - `GET http://127.0.0.1:8765/control/scrcpy-sessions`: disponible sin sesiones nuevas abiertas por este cambio.
  - `GET http://127.0.0.1:8765/streaming/raw/sessions`: disponible con sesiones H.264 vivas.
- **Pendiente recomendado:**
  - Validacion visual manual en Electron: mover Focus desde el asa, redimensionar, activar/desactivar avanzado, revisar herramientas/historial en ventana pequena/mediana/grande y probar taps/swipes sobre el canvas.
  - Despues de confirmar UX visual, continuar con texto/clipboard, teclado fisico y control multiple.

## ULTIMOS CAMBIOS (2026-06-20) - Focus flotante fase segura

**FOCUS-FLOATING-WINDOW-01:**
- **Estado:** IMPLEMENTADO SOLO FASE A.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_090925_PRE_FLOATING_FOCUS_MASTER_CONTROL`
- **Motivo:** Empezar el plan `FOCUS_FLOATING_MASTER_CONTROL_ACTION_PLAN.md` por la parte mas segura: convertir Focus en una ventana flotante movible/redimensionable encima del Grid sin tocar streaming, coordenadas, backend ni control manual.
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - El modo Focus ahora usa una shell flotante `position: fixed` con clase `is-floating`.
  - El Grid queda visible detras porque el overlay de Focus es transparente y no tiene backdrop.
  - La ventana Focus se puede mover desde el encabezado y redimensionar desde una esquina inferior derecha.
  - La geometria se guarda en `localStorage` con la clave `flowdashboard.focus.window.geometry`.
  - La geometria se limita al viewport para evitar que la ventana quede perdida fuera de pantalla.
- **Alcance protegido:**
  - No se modifico `stream-renderer-h264.js`.
  - No se modifico `CoordinateMapper`.
  - No se modifico `local_adb_server.py`.
  - No se modifico `scrcpy_control_channel.py`.
  - No se modificaron endpoints `/control/*`.
  - No se modifico FlowLogin, FlowMail, `Login.js`, APK, OCR, MediaProjection ni FlowAgent.
  - No se cambio el pipeline H.264/WebCodecs; Focus sigue usando `h264.attachFocus(...)`.
- **Validaciones realizadas:**
  - `node --check electron-app\src\renderer\flow-touch.js`: OK.
  - `node --check electron-app\src\renderer\app.js`: OK.
  - `node --check electron-app\src\renderer\stream-renderer-h264.js`: OK.
  - `python -m py_compile local_adb_server.py scrcpy_control_channel.py`: OK.
  - Arranque runtime con `abrir_electron.bat`: Electron, backend Python/socket y backend C# levantaron.
  - `GET http://127.0.0.1:8765/health`: OK con ADB empaquetado y features scrcpy activas.
  - `GET http://127.0.0.1:5000/api/health`: OK.
  - `GET http://127.0.0.1:8765/streaming/raw/sessions`: disponible con sesiones H.264 vivas despues del arranque de Electron.
  - `GET http://127.0.0.1:8765/control/scrcpy-sessions`: disponible, sin abrir sesiones de control nuevas durante esta fase.
- **Pendiente antes de avanzar a Fase B/C/D:**
  - Validar visualmente en Electron que abrir Focus, moverlo, redimensionarlo, cerrarlo y hacer taps/swipes en el dispositivo activo siguen funcionando.
  - Confirmar que el Grid queda visible y usable detras segun lo esperado.
  - Despues de esa validacion, continuar con texto/clipboard por `scrcpy-control`, teclado fisico en Focus y replicacion de control desde Focus maestro hacia dispositivos seleccionados.

## ULTIMOS CAMBIOS (2026-06-20) - Auditoria documental segura sin DOCUMENTACION_TECNICA

**DOCUMENTATION-AUDIT-CLEANUP-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/20260620_090032_PRE_DOCUMENTATION_AUDIT_CLEANUP`
- **Motivo:** Reducir falsos positivos documentales y dejar clara la jerarquia vigente sin cambiar codigo ni funcionamiento del dashboard.
- **Regla confirmada:** `DOCUMENTACION_TECNICA.md` es legacy/prohibido como fuente tecnica vigente. No se leyo, no se analizo y no se uso para corregir documentacion.
- **Fuentes usadas:** `AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/master_technical_specification.md`, codigo actual y endpoints runtime activos.
- **Archivos Modificados:**
  - `AGENTS.md`
  - `docs/master_technical_specification.md`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - `AGENTS.md` ahora dice explicitamente que `DOCUMENTACION_TECNICA.md` no participa en la jerarquia tecnica y solo puede mencionarse como archivo historico en inventarios.
  - `docs/master_technical_specification.md` conserva la arquitectura vigente; solo se marco la seccion runtime como snapshot variable, se agrego la reverificacion documental del 2026-06-20 y se corrigio la numeracion de secciones/subsecciones.
  - Se mantiene la regla real: Grid/Focus video usa scrcpy H.264/WebCodecs, control manual usa `scrcpy-control` via `/control/*`, ADB queda como fallback seguro y FlowAgent queda separado para automation/FlowKeyboard/OCR/scripts.
- **Validaciones runtime usadas durante la auditoria:**
  - `GET http://127.0.0.1:8765/health`: OK, `appVersion=1.0.60`, ADB empaquetado.
  - `GET http://127.0.0.1:5000/api/health`: OK.
  - `GET http://127.0.0.1:8765/streaming/raw/sessions`: disponible, sin sesiones activas en ese momento.
  - `GET http://127.0.0.1:8765/control/scrcpy-sessions`: disponible, sin sesiones activas en ese momento.
  - `/agents`: 17 FlowAgents conectados con FlowKeyboard activo en ese momento; no se copiaron perfiles, cuentas ni secretos.
- **Alcance:**
  - No se modifica codigo runtime, Electron UI, backend Python, backend C#, FlowLogin, FlowMail, FlowAgent, APK, scrcpy, H.264, control manual, OCR ni MediaProjection.
  - No se movio ni borro ningun archivo.

## ULTIMOS CAMBIOS (2026-06-20) - Focus Inspector resalta nodos y fallback Web

**FOCUS-INSPECTOR-HIGHLIGHT-WEB-FALLBACK-01:**
- **Estado:** IMPLEMENTADO.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_063226_PRE_FOCUS_INSPECTOR_HIGHLIGHT_WEB_FALLBACK`
- **Motivo:** En modo Focus, al abrir la herramienta lateral `Inspector`, la seleccion de nodos no mostraba visualmente el elemento sobre la pantalla del dispositivo. Ademas, el modo `Web` podia quedar vacio cuando no habia target CDP/WebView depurable, mientras `Tree` y `Nativo` si mostraban nodos.
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `electron-app/src/renderer/styles.css`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - El highlight del mini Inspector de Focus ahora fuerza visible la capa local `flowTouchGestureLayer` al seleccionar un nodo, dibuja el rectangulo en el frame del telefono y muestra una etiqueta corta del nodo.
  - Al limpiar seleccion, la capa se vuelve a ocultar si no quedan marcadores o trazos activos.
  - El modo `Web` mantiene primero CDP/JS, pero si no devuelve nodos cae a `UIAutomator` como fallback explicito (`Web fallback UIAutomator`) para evitar una lista vacia en pantallas nativas o apps sin WebView depurable.
- **Validaciones:**
  - `node --check electron-app/src/renderer/flow-touch.js`: OK.
  - Prueba runtime `POST /inspector/dump` en `192.168.1.11:5555`: OK, `16` nodos por `uiautomator`.
  - Prueba runtime `POST /inspector/web-detect` con `cdp` en `192.168.1.11:5555`: devuelve `503`, confirmando el caso que ahora cubre el fallback del frontend.
- **Alcance:**
  - No se modifica backend Python, C#, FlowLogin, FlowMail, FlowAgent, APK, scrcpy, H.264, control manual, OCR ni MediaProjection.

## ULTIMOS CAMBIOS (2026-06-20) - FlowMail reintenta link expirado con correo nuevo

**FLOWMAIL-EXPIRED-LINK-REQUEST-NEW-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** En prueba real, FlowMail abrio un magic link de Spotify en el clon correcto, pero Spotify mostro el dialogo `This link has expired.` con boton `Send new link`. El flujo anterior solo seguia esperando login y podia volver a abrir el link viejo si se generaba un nuevo `requestedAt` sin exigir correo reciente.
- **Archivos Modificados:**
  - `Login.js`
  - `local_adb_server.py`
  - `FlowDashboard.Core/Services/MailService.cs`
  - `FlowDashboard.Core/Services/flowmail_imap_helper.py`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - `Login.js` detecta el texto `<packageName>:id/body` `This link has expired.` dentro del clon esperado y pulsa `<packageName>:id/button_positive` con texto `Send new link`.
  - Tras pulsar `Send new link`, espera de nuevo el mensaje visual de envio si aparece, actualiza el estado `waiting_mail` con `requestedAt = nowIso()` y agrega `flowMail.requireRecent = true`.
  - `local_adb_server.py` conserva `flowMail.requireRecent` en la normalizacion/persistencia y lo envia a `POST /api/mail/search-spotify-link`.
  - `MailService.cs` y `flowmail_imap_helper.py` aceptan `RequireRecent/requireRecent`. Cuando viene activo, descartan candidatos cuyo `Date` sea anterior a `requestedAfterUtc - 5 minutos`, aunque el destinatario, remitente y asunto coincidan. Asi se evita reabrir el link expirado.
  - El reintento en `Login.js` se limita a 2 solicitudes nuevas por espera FlowMail para evitar bucles.
- **Validaciones:**
  - `python -m py_compile local_adb_server.py FlowDashboard.Core/Services/flowmail_imap_helper.py`: OK.
  - `dotnet build FlowDashboard.Core/FlowDashboard.Core.csproj -c Release`: OK tras detener el backend C# que tenia bloqueado el binario.
  - Prueba API normal para `te***@delimpaser.com`: `found=true`, score `113`, subject `Get back into your Spotify account`.
  - Prueba API con `requireRecent=true` y `requestedAfterUtc=now`: `found=false`, confirmando que no reutiliza el correo/link viejo.
- **Revision posterior en runtime:**
  - Gmail agrupa visualmente los correos de Spotify en una conversacion, pero IMAP los devuelve como mensajes separados.
  - Diagnostico posterior mostro 4 candidatos: 2 entradas duplicadas por carpetas (`INBOX` y `[Gmail]/All Mail`) del link nuevo con score `123`, y 2 entradas duplicadas del link viejo con score `113`.
  - El link nuevo tenia una huella/cola distinta al viejo, por lo que FlowMail si estaba leyendo el correo nuevo. El bucle venia de que, si Spotify tambien marcaba ese segundo link como expirado y no llegaba un tercero, el backend podia reabrir la misma URL al cambiar `requestedAt`.
  - `local_adb_server.py` ahora guarda huellas SHA-256 truncadas de URLs FlowMail abiertas por `serial|clone|email`; si la busqueda devuelve una URL ya abierta, no la vuelve a abrir y espera un enlace realmente nuevo. Las huellas caducan tras 4 horas.
- **Runtime:**
  - Se relanzaron C# y Python. C# activo en `5000`; Python activo en `8765/8766/8768`.
- **Alcance:**
  - No se modifica APK, FlowAgent, scrcpy, H.264, control manual, OCR ni MediaProjection.
  - No se documentaron magic links completos, app passwords ni credenciales.

## ULTIMOS CAMBIOS (2026-06-20) - Stop FlowLogin limpia waiting_mail remoto

**FLOWLOGIN-STOP-CLEARS-REMOTE-WAITING-MAIL-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** En prueba real desde la grilla, FlowLogin se detenia visualmente en el dispositivo, pero al abrir el menu contextual del telefono seguia apareciendo solo `Detener FlowLogin` como accion activa. La verificacion runtime en `192.168.1.39:5555` mostro `runningJobs: []`, pero `/sdcard/Download/flowlogin_status.json` seguia con `summary.waiting_mail = 1`, por lo que Electron interpretaba el dispositivo como aun activo.
- **Archivos Modificados:**
  - `local_adb_server.py`
  - `electron-app/src/renderer/app.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - `stop_autojs(...)` ahora tambien llama a `mark_remote_flowlogin_stopped(...)`, que lee el `flowlogin_status.json` remoto y convierte estados `running`, `retrying` y `waiting_mail` a `review` con mensaje `Detenido por usuario`.
  - La limpieza elimina metadata `flowMail` del item remoto detenido, recalcula `summary`, actualiza `updatedAt`, sube el JSON corregido al telefono y sincroniza el estado persistente local del dashboard.
  - El boton/menu de detener en Electron refresca dispositivos y estados despues de llamar a `/autojs/stop`, evitando que el menu quede con una foto vieja del estado anterior.
- **Validaciones:**
  - `python -m py_compile local_adb_server.py`: OK.
  - `node --check electron-app/src/renderer/app.js`: OK.
- **Alcance:**
  - No se modifica el flujo de login, FlowMail, APK, FlowAgent, scrcpy, H.264, control manual, OCR ni MediaProjection.
  - No se documentaron cuentas ni credenciales completas.

## ULTIMOS CAMBIOS (2026-06-20) - FlowMail no bloquea por confirmacion visual

**FLOWMAIL-UI-CONFIRMATION-NON-BLOCKING-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** En prueba real, tras detectar el aviso abroad de 14 dias y pulsar `Log in without password`, `Login.js` marcaba `FlowMail: no confirmo email destino`, programaba intento 2 y empezaba limpieza de cache/datos. El correo de Spotify si llegaba a Gmail para la cuenta objetivo. La revision de codigo confirma que ese mensaje se emitia antes de entrar a `waiting_mail` y antes de consultar Gmail/IMAP.
- **Restore Point Creado:**
  - `restore_points/2026-06-20_013125_PRE_FLOWMAIL_UI_CONFIRMATION_NON_BLOCKING`
- **Archivos Modificados:**
  - `Login.js`
  - `PROJECT_CONTEXT.md`
  - `docs/master_technical_specification.md`
- **Cambio Aplicado:**
  - `findMagicRequestSent(...)` ahora normaliza espacios, mejora el regex de email, usa `idMatches` para `<packageName>:id/request_sent_message` y escanea `android.widget.TextView` cuando Auto.js no encuentra el id directo.
  - La confirmacion visual `We sent you an email...` deja de ser obligatoria. Si no aparece o no se puede parsear, `Login.js` registra un log y continua a `waiting_mail`.
  - La busqueda real queda delegada al backend FlowMail, que ya filtra por destinatario (`targetEmail`), remitente/asunto de Spotify y magic link `accounts.spotify.com/login/ott/music`.
- **Evidencia:**
  - El mensaje `FlowMail: no confirmo email destino` estaba en `Login.js` inmediatamente despues de `findMagicRequestSent(...)` y antes de `waitForFlowMailLogin(...)`.
  - La prueba diagnostica local actual de backend para `teniente@delimpaser.com` devolvio `found=true`, asunto `Get back into your Spotify account`, remitente Spotify, destinatario enmascarado y `hasLink=true`, con token oculto en salida.
- **Alcance:**
  - No se modifica Electron UI, C#, backend Python, FlowAgent, APK, scrcpy, H.264, control manual, OCR ni MediaProjection.
  - No se documentaron app passwords, tokens ni enlaces magic link completos.

## ULTIMOS CAMBIOS (2026-06-20) - FlowMail magic link shell quoting

**FLOWMAIL-MAGICLINK-SHELL-QUOTE-01:**
- **Estado:** IMPLEMENTADO EN ARCHIVOS; requiere cerrar el proceso Python viejo `21676` o reiniciar Windows/backend para que el puerto 8765 use el codigo nuevo.
- **Motivo:** En prueba real, al procesar un correo ya existente de Spotify, Android mostraba el selector `Open with` con varios clones. La prueba aislada de `process_flowmail_waiting(...)` mostro el error `/system/bin/sh: -p: not found`, confirmando que el magic link se partia por los caracteres de shell `#` y `&` antes de aplicar `-p <packageName>`.
- **Archivos Modificados:**
  - `local_adb_server.py`
  - `PROJECT_CONTEXT.md`
  - `docs/master_technical_specification.md`
- **Cambio Aplicado:**
  - `flowmail_open_link(...)` ahora abre el magic link con `adb_shell(...)` y cita la URL completa y el paquete con `_shell_quote(...)`, para preservar `#token`, `&passwordToken`, `&username` y `continue`.
  - `normalize_account_statuses(...)` conserva la metadata `flowMail` (`email`, `requestedAt`, `package`) al normalizar `device_names.json`; antes podia perderse y dejar `waiting_mail` sin datos suficientes para abrir el link.
  - `process_flowmail_waiting(...)` agrega un log seguro cuando no encuentra link, enmascarando el destinatario.
- **Validaciones:**
  - `python -m py_compile local_adb_server.py`: OK.
  - Prueba aislada con el JSON remoto actual: `process_flowmail_waiting(...)` abrio el enlace y el foco quedo en `com.spotify.musid/com.spotify.login.loginflowimpl.LoginActivity`.
  - `cmd package resolve-activity ... com.spotify.musid` confirma que el clon `com.spotify.musid` declara handler para `https://accounts.spotify.com/login/ott/music`.
- **Bloqueo runtime:**
  - Hay un proceso Python viejo `PID 21676` escuchando en `127.0.0.1:8765`, `0.0.0.0:8766` y `127.0.0.1:8768`.
  - `Stop-Process -Id 21676 -Force` y `taskkill /PID 21676 /F` devolvieron `Acceso denegado`.
  - Mientras ese PID siga vivo, `/login-status` puede seguir usando codigo viejo y no reflejar el fix.
- **Alcance:**
  - No se modifica Electron UI, C#, FlowAgent, APK, scrcpy, H.264, control manual, OCR ni MediaProjection.
  - No se documentaron app passwords ni magic links completos.

## ULTIMOS CAMBIOS (2026-06-19) - FlowMail abroad selector y TLS fallback Python

**FLOWMAIL-ABROAD-MAGICLINK-AND-PYTHON-TLS-FALLBACK-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** En prueba real, Spotify mostraba el bloqueo abroad de 14 dias en `<packageName>:id/body` y el boton `OK` en `<packageName>:id/button_positive`, pero `Login.js` no lo detectaba. Luego debe pulsar `<packageName>:id/request_magiclink_lower_button` (`Log in without password`) y validar `<packageName>:id/request_sent_message` con el email de la cuenta. Ademas, Windows/.NET Schannel falla contra Gmail IMAP con `No hay credenciales disponibles en el paquete de seguridad`, mientras Python/OpenSSL conecta correctamente.
- **Archivos Modificados:**
  - `Login.js`
  - `abrir_electron.ps1`
  - `FlowDashboard.Core/Services/MailService.cs`
  - `FlowDashboard.Core/Services/flowmail_imap_helper.py`
  - `PROJECT_CONTEXT.md`
  - `docs/master_technical_specification.md`
- **Cambio Aplicado:**
  - `Login.js` ahora escanea `android.widget.TextView` para detectar el texto exacto `You can only use Spotify abroad for 14 days...` validando el resource id `<packageName>:id/body` cuando esta disponible, por lo que funciona para `musid`, `musie`, `musif`, etc.
  - Tras detectar el aviso, pulsa `<packageName>:id/button_positive` (`OK`), luego `<packageName>:id/request_magiclink_lower_button` (`Log in without password`) y valida `<packageName>:id/request_sent_message` confirmando que el email enviado coincide con la cuenta en ejecucion.
  - La conexion IMAP de FlowMail sigue usando `imap.gmail.com:993` con `SecureSocketOptions.SslOnConnect`.
  - La app password se normaliza quitando espacios internos, asi puede pegarse tal como Google la muestra en bloques.
  - Se agrego helper centralizado `ConnectGmailImapAsync(...)` usado tanto por `POST /api/mail/connect` como por `POST /api/mail/search-spotify-link`.
  - Primero intenta TLS con `CheckCertificateRevocation=true`.
  - Si MailKit lanza `SslHandshakeException`, reintenta con `CheckCertificateRevocation=false`, manteniendo la validacion normal del certificado/cadena. No se acepta certificado self-signed ni se desactiva globalmente la validacion TLS.
  - Si Windows/.NET sigue fallando por Schannel, C# usa `flowmail_imap_helper.py` via `stdin/stdout` como fallback local con Python/OpenSSL. La app password no se pasa por argumentos de proceso ni se escribe en logs.
  - `abrir_electron.ps1` exporta `FLOWDASHBOARD_PYTHON` antes de iniciar C# para que el fallback use el mismo runtime Python validado por el launcher.
- **Validaciones:**
  - `python -m py_compile FlowDashboard.Core/Services/flowmail_imap_helper.py`: OK.
  - `dotnet build FlowDashboard.Core/FlowDashboard.Core.csproj -c Release`: OK tras detener el backend C# que tenia bloqueado `FlowDashboard.Core.exe`.
  - Prueba diagnostica local sin credenciales: Python/OpenSSL conecta a `imap.gmail.com:993` con TLSv1.3; .NET/Schannel falla antes del handshake.
- **Alcance:**
  - No se modifica Electron UI, backend Python local ADB, FlowAgent, H.264, scrcpy, control manual, OCR ni MediaProjection.
  - No se guardaron ni documentaron secretos.

## ULTIMOS CAMBIOS (2026-06-19) - FlowMail para magic links de Spotify

**FLOWMAIL-MAGIC-LINK-01:**
- **Estado:** IMPLEMENTADO, pendiente de prueba canario con el usuario.
- **Motivo:** Agregar una configuracion de Mail App en FlowLogin para conectar una cuenta Gmail mediante app password, persistirla y usarla cuando Spotify muestre el bloqueo de 14 dias abroad. En ese caso `Login.js` debe solicitar el magic link, esperar el correo correcto y continuar el login sin repetir la contrasena en cada arranque del dashboard.
- **Restore Point Creado:**
  - `restore_points/2026-06-19_053130_PRE_FLOWMAIL`
- **Archivos Modificados:**
  - `.gitignore`
  - `FlowDashboard.Core/FlowDashboard.Core.csproj`
  - `FlowDashboard.Core/Program.cs`
  - `FlowDashboard.Core/Services/MailService.cs`
  - `FlowDashboard.Core/Controllers/MailController.cs`
  - `electron-app/src/renderer/app.js`
  - `electron-app/src/renderer/styles.css`
  - `local_adb_server.py`
  - `Login.js`
  - `PROJECT_CONTEXT.md`
  - `docs/master_technical_specification.md`
- **Cambio Aplicado:**
  - Backend C# agrega MailKit y endpoints `GET /api/mail/status`, `POST /api/mail/connect` y `POST /api/mail/search-spotify-link`.
  - La app password se guarda localmente cifrada con DPAPI de Windows en `FlowDashboard.Core/mail_config.json`; el archivo queda ignorado por git. No se guarda la contrasena en `localStorage` ni se documentan secretos.
  - Electron agrega la seccion `configuracion de mail app:` debajo de `Historial de Cuentas`, con email, password oculto, boton `Conectar`/`Reconectar` y estado `Conectado`.
  - `Login.js` detecta el mensaje `You can only use Spotify abroad for 14 days...` acotado al packageName del clon, pulsa `OK`, pulsa `Log in without password`, valida que `request_sent_message` contiene el mismo email de la cuenta y escribe estado `waiting_mail` con metadata FlowMail.
  - `local_adb_server.py` acepta el estado `waiting_mail`, preserva metadata `flowMail`, consulta el backend C# para encontrar el magic link de Spotify y abre el link con `adb shell am start -a android.intent.action.VIEW -d <url> -p <packageName>`, ocultando el token en logs.
  - Electron muestra `waiting_mail` como icono pequeno de mail en lugar de bolita; cuando cambia de estado vuelve a la bolita normal.
- **Validaciones:**
  - `python -m py_compile local_adb_server.py`: OK.
  - `node --check electron-app/src/renderer/app.js`: OK.
  - `dotnet build FlowDashboard.Core/FlowDashboard.Core.csproj`: OK. Persisten warnings legacy del proyecto y warnings CA1416 por DPAPI Windows-only, esperados para este producto Windows.
  - `Login.js` no se valido con Node porque el archivo usa sintaxis Auto.js/floaty XML no compatible con `node --check`.
- **Alcance:**
  - No se ejecuto `Login.js` en dispositivos.
  - No se instalaron, desinstalaron ni actualizaron APKs.
  - No se limpiaron datos de aplicaciones.
  - No se tocaron H.264, scrcpy, WebCodecs, control manual, OCR ni MediaProjection.
  - La prueba real queda pendiente para hacerla junto al usuario con alcance canario.
- **Seguridad:** No se copio ninguna app password, token de magic link, cuenta completa sensible ni credencial en documentacion o logs.

## ULTIMOS CAMBIOS (2026-06-18) - Auditoria tecnica exhaustiva y actualizacion master spec

**MASTER-SPEC-AUDIT-UPDATE-01:**
- **Estado:** COMPLETADO.
- **Motivo:** Incorporacion tecnica, auditoria exhaustiva y verificacion real del proyecto completo. Se leyo codigo fuente, se verifico runtime caliente (procesos, puertos, endpoints), se contrasto documentacion vs realidad y se detecto deuda tecnica de portabilidad.
- **Restore Point Creado:**
  - `restore_points/2026-06-18_082000_PRE_MASTER_SPEC_AUDIT_UPDATE_01`
- **Archivos Modificados:**
  - `docs/master_technical_specification.md` (reescritura completa basada en auditoria)
  - `PROJECT_CONTEXT.md` (esta entrada)
- **Hallazgos Principales:**
  - Runtime funcional en desarrollo: 17 dispositivos WiFi, backends Python/C# activos, ADB empaquetado, H.264 estable.
  - Python usa runtime del desarrollador (`C:\Users\elyup\...\Python310`), no del proyecto. `.venv` existe con Python 3.13.7 pero SIN dependencias. Riesgo comercial critico.
  - .NET 8 Runtime no empaquetado. Requiere instalacion en cliente.
  - `abrir_electron.ps1` linea 87 hardcodea ruta del desarrollador.
  - `electron-console.log` de 112 MB — riesgo de disco.
  - ~85 archivos temporales/legacy en raiz del proyecto.
  - FlowAgent monolito v1.0.0 vCode 106 confirmado activo.
  - `app_meta.py` define `APP_VERSION = "1.0.60"`.
  - H.264/scrcpy-control/Focus: estable, no tocar.
- **Secciones Nuevas en master_technical_specification.md:**
  - §2.3 Seleccion de Python en el launcher
  - §2.4 Empaquetado comercial
  - §2.5 Version del producto
  - §9.3 Constantes de version FlowAgent
  - §12 Electron Frontend Vigente (estructura, IPC, CSP)
  - §15 Herramientas Adicionales
  - §16 Portabilidad y Dependencias
  - §18 Archivos en Raiz del Proyecto
  - §19 Proxima Fase Recomendada
- **Alcance:** Solo documentacion. No se modifico codigo, configuracion, backends, frontend, APK ni scripts.
- **DOCUMENTACION_TECNICA.md:** NO fue leido ni utilizado. Confirmado en `Eliminar/`.

## ULTIMOS CAMBIOS (2026-06-18) - FlowAgent monolito release con verifyText

**FLOWAGENT-MONOLITO-RELEASE-VERIFYTEXT-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** El dashboard instala FlowAgent desde `/flowagent/setup-smart`, que prioriza el APK monolito `app/release` antes que `app/debug`. Tras agregar `verifyText` al FlowKeyboard, era necesario generar un release actualizado para que el boton `Instalar FlowAgent APK` use el APK correcto.
- **Restore Point Creado:**
  - `restore_points/2026-06-18_PRE_FLOWAGENT_MONOLITO_RELEASE_VERIFYTEXT_01`
- **Archivos Modificados:**
  - `local_adb_server.py`
  - `PROJECT_CONTEXT.md`
  - `flow_agent_monolito/version.properties`
- **Artefacto Generado:**
  - `flow_agent_monolito/app/build/outputs/apk/app/release/agent-v1.0.0-arm64-v8a.apk`
- **Cambio Aplicado:**
  - Se ejecuto `:app:assembleAppRelease` del monolito con build exitoso.
  - El APK release actualizado queda con `versionName=1.0.0` y `versionCode=106`.
  - `FLOW_AGENT_EXPECTED_VERSION_CODE` pasa de `105` a `106` para que `/flowagent/setup-smart` actualice telefonos que aun tengan el FlowAgent anterior.
  - La ruta de seleccion de APK no cambia: el backend sigue prefiriendo el monolito release oficial.
- **Uso esperado:** Desde Grid, clic derecho sobre dispositivo(s) -> `Instalar FlowAgent APK`; o desde `FlowVideo` -> `Preparar FlowAgent`. Ambas rutas llaman `/flowagent/setup-smart` y deben instalar/abrir el monolito release actualizado sin solicitar captura/OCR.
- **Alcance:** No se modifica Electron UI, H.264, scrcpy, Grid/Focus, control tactil, OCR ni MediaProjection.

## ULTIMOS CAMBIOS (2026-06-18) - FlowKeyboard verificacion exacta para FlowLogin

**FLOWKEYBOARD-TYPED-TEXT-VERIFY-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** Reforzar `Login.js` para que, al escribir email/password con FlowKeyboard, no dependa de leer el campo de password en pantalla. El teclado debe confirmar exactamente que caracteres pudo emitir, incluyendo passwords con `#`, `?`, `!` y otros simbolos soportados.
- **Restore Point Creado:**
  - `restore_points/2026-06-18_PRE_FLOWKEYBOARD_TYPED_TEXT_VERIFY_01`
- **Archivos Modificados:**
  - `Login.js`
  - `flow_agent_monolito/app/src/main/java/com/flowlogin/agent/FlowKeyboardService.java`
  - `flow_agent_monolito/app/src/main/java/com/flowlogin/agent/runner/HumanInputBridge.java`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - `HumanInputBridge.typeHuman(...)` ahora puede devolver `typedText`, `matchesRequested`, `requestedCount`, `typedCount`, `failedCount`, `failedChars` y `charsFallback` cuando el comando pide `verifyText=true`.
  - `FlowKeyboardService` expone el flag `verifyText` para `keyboard_type_human` manteniendo compatibilidad por defecto.
  - `Login.js` pide `verifyText=true`, mantiene `allowFallback=false`, y bloquea el flujo si el texto emitido no coincide exactamente con el email/password solicitado, si hubo fallback o si hubo caracteres fallidos.
  - Si el telefono conserva un FlowAgent anterior que no soporta `verifyText`, `Login.js` falla con mensaje explicito para actualizar FlowAgent antes de intentar login.
  - Los mensajes de error reportan conteos, no el email/password completo.
- **Alcance:** No se modifica backend Python, Electron, H.264, scrcpy, Grid/Focus, control tactil, OCR ni MediaProjection.

## ULTIMOS CAMBIOS (2026-06-18) - FlowLogin incorrect credentials active package

**LOGINJS-INCORRECT-TEXT-ACTIVE-PACKAGE-FIX-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** En prueba real, Spotify mostraba `This email and password combination is incorrect.`, pero `Login.js` terminaba en `Sin confirmacion segura`. La causa probable es que Auto.js detectaba el texto exacto pero no entregaba el `resource id` completo `<packageName>:id/body`, por lo que el detector estricto lo descartaba.
- **Restore Point Creado:**
  - `restore_points/2026-06-18_PRE_LOGINJS_INCORRECT_TEXT_ACTIVE_PACKAGE_FIX_01`
- **Archivos Modificados:**
  - `Login.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - El detector sigue priorizando `TextView` con id exacto `<packageName>:id/body`.
  - Si Auto.js no expone ese id completo, el texto exacto se acepta solo cuando `currentPackage()` coincide con el paquete del clon/cuenta actual.
  - Esto mantiene la validacion por clon y evita falsos positivos entre paquetes, pero permite detectar el mensaje real cuando el id no llega igual que en UIAutomator.
- **Alcance:** No se modifica backend, APK, FlowAgent, H.264, scrcpy, Grid/Focus, control tactil, OCR ni MediaProjection.

## ULTIMOS CAMBIOS (2026-06-18) - FlowTrackName apertura directa

**FLOWTRACKNAME-DIRECT-LAUNCH-NO-PANEL-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** El usuario indico que el panel flotante intermedio de FlowTrackName no era necesario. Prefiere que al pulsar `Tools > FlowTrackName` se abra directamente la ventana propia de `Herramientas/FlowTrackName.exe`.
- **Restore Point Creado:**
  - `restore_points/2026-06-18_PRE_FLOWTRACKNAME_DIRECT_LAUNCH_NO_PANEL_01`
- **Archivos Modificados:**
  - `electron-app/src/renderer/app.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - `openFlowTrackNamePanel()` ahora llama a `launchFlowTrackNameDirect()` y no crea la ventana flotante del dashboard.
  - El menu `Tools > FlowTrackName` mantiene el indicador de estado, pero ya no abre panel intermedio.
- **Alcance:** No se modifica backend Python, backend C#, APK, FlowAgent, H.264, scrcpy, Grid/Focus, control tactil, FlowLogin, OCR ni MediaProjection.

## ULTIMOS CAMBIOS (2026-06-18) - Tools FlowTrackName Electron panel

**TOOLS-FLOWTRACKNAME-ELECTRON-FLOATING-PANEL-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** Agregar en el menu lateral izquierdo una seccion `Tools`, ubicada debajo de `FlowCategory` y arriba de `Planes`, con una opcion `FlowTrackName` que ejecute `Herramientas/FlowTrackName.exe` desde una ventana flotante controlada por Electron.
- **Restore Point Creado:**
  - `restore_points/2026-06-18_PRE_TOOLS_FLOWTRACKNAME_ELECTRON_FLOATING_PANEL_01`
- **Archivos Modificados:**
  - `electron-app/src/renderer/app.js`
  - `electron-app/src/renderer/styles.css`
  - `electron-app/src/main/index.js`
  - `electron-app/preload/preload.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - Se completo el comportamiento de la seccion `Tools` con persistencia de despliegue en `localStorage`.
  - `FlowTrackName` abre un panel flotante del dashboard y lanza `Herramientas/FlowTrackName.exe`.
  - El panel flotante muestra estado, PID/ruta y permite abrir, consultar estado, detener el proceso y cerrar el panel.
  - Se agregaron canales IPC seguros en Electron main/preload para lanzar, consultar y detener FlowTrackName.
  - Se agregaron estilos acotados para que el menu y el panel mantengan el lenguaje visual del dashboard.
- **Alcance:** No se modifica backend Python, backend C#, APK, FlowAgent, H.264, scrcpy, Grid/Focus, control tactil, FlowLogin, OCR ni MediaProjection.

## ULTIMOS CAMBIOS (2026-06-18) - FlowLogin detector por paquete de clon

**LOGINJS-PACKAGE-SCOPED-INCORRECT-DETECTOR-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** El usuario pidio que el mensaje `This email and password combination is incorrect.` se valide segun la cuenta/clon que se esta ejecutando. Cada cuenta usa siempre el clon del mismo numero y el detector no debe aceptar errores residuales de otro paquete.
- **Restore Point Creado:**
  - `restore_points/2026-06-18_PRE_LOGINJS_PACKAGE_SCOPED_INCORRECT_DETECTOR_01`
- **Archivos Modificados:**
  - `Login.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - `findIncorrectCredentialsMarker(...)` ahora recibe el `packageName` esperado del clon actual.
  - El mensaje de credenciales incorrectas solo se acepta si el texto exacto viene de un `android.widget.TextView` cuyo resource id sea exactamente `<packageName>:id/body`.
  - Se elimina el fallback de credenciales incorrectas por texto exacto sin validar paquete, evitando falsos positivos entre clones.
  - En `confirmOutcome(...)`, un texto exacto de credenciales incorrectas que no pertenezca al paquete esperado no programa reintento como credenciales del clon actual.
- **Alcance:** No se modifica backend, APK, FlowAgent, H.264, scrcpy, Grid/Focus, control tactil, OCR ni MediaProjection.

## ULTIMOS CAMBIOS (2026-06-18) - Focus Auto.js ventana flotante

**FOCUS-AUTOJS-WINDOW-GEOMETRY-FIX-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** En modo Focus, al pulsar la herramienta `Auto.js`, la ventana podia no verse si existia geometria guardada fuera del rango visible. La posicion se guardaba con coordenadas absolutas del viewport, pero luego se restauraba dentro del contenedor Focus, que recorta con `overflow: hidden`.
- **Restore Point Creado:**
  - `restore_points/2026-06-18_PRE_FOCUS_AUTOJS_WINDOW_GEOMETRY_FIX_01`
- **Archivos Modificados:**
  - `electron-app/src/renderer/flow-touch.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - Se agrego normalizacion de posicion/tamano al abrir o reabrir ventanas flotantes Focus, incluyendo `Auto.js`.
  - La geometria persistida de ventanas Focus ahora guarda `offsetLeft`/`offsetTop` relativos al contenedor, no coordenadas absolutas del viewport.
  - El arrastre queda limitado al area visible del contenedor Focus para evitar que una herramienta vuelva a quedar fuera de margen.
  - La misma proteccion aplica a la ventana `Aplicaciones` para evitar reaperturas fuera de margen.
- **Alcance:** No se modifica H.264, scrcpy, Grid/Focus video, control tactil, backend Python, FlowAgent, OCR ni MediaProjection.

## ULTIMOS CAMBIOS (2026-06-18) - Licencia y carga inicial de dispositivos

**LICENSE-DEVICES-STARTUP-RACE-FIX-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** Evitar que la auto-validacion de licencia caiga prematuramente a identidad/MAC del PC cuando `/devices` aun esta calentando ADB al arrancar con muchos dispositivos. Tambien reducir el ruido de consola por `AbortError` cuando `loadDevices()` aborta la llamada Python y usa fallback C#.
- **Restore Point Creado:**
  - `restore_points/2026-06-18_PRE_LICENSE_DEVICES_STARTUP_RACE_FIX_01`
- **Archivos Modificados:**
  - `electron-app/src/renderer/app.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - Se agrego `getFirstKnownAndroidIdentity()` para reutilizar primero `window.app.devices` antes de consultar nuevamente `/devices`.
  - `loadDevices()` ahora conserva `macAddress`, `deviceId` y `activeSerial` cuando Python `/devices` los entrega.
  - `waitForFirstDeviceMac(...)` consulta primero la identidad ya cargada en el frontend y solo despues llama a `/devices`/`/device-mac`.
  - `validateLicense()` vuelve a esperar hasta 8s por identidad Android en validacion manual.
  - La auto-validacion con licencia guardada vuelve a esperar hasta 15s antes de caer a la identidad del PC.
  - El `AbortError` de la carga Python de dispositivos se registra como informacion cuando el fallback C# puede continuar.
- **Alcance:** No se modifica `local_adb_server.py`, backend C#, APK, FlowAgent, FlowLogin, H.264, scrcpy, Grid/Focus, control tactil, OCR ni MediaProjection.

## ULTIMOS CAMBIOS (2026-06-17) - FlowLogin Login.js retry clear data

**LOGINJS-STRICT-INCORRECT-BODY-DETECTOR-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** Asegurar que el mensaje `This email and password combination is incorrect.` se detecte en cualquier clon Spotify sin depender de `com.spotify.musid`, evitando falsos positivos.
- **Restore Point Creado:**
  - `restore_points/2026-06-18_PRE_LOGINJS_STRICT_INCORRECT_BODY_DETECTOR_01`
- **Archivos Modificados:**
  - `Login.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - `scanIncorrectCredentialsTextViews()` ahora exige simultaneamente texto exacto y resource id terminado en `:id/body`.
  - Se elimina el fallback por texto exacto sin id, para que el error de credenciales solo se acepte cuando venga del `TextView` body del paquete/clon abierto.
- **Alcance:** No se modifica backend, APK, H.264, control manual, OCR ni MediaProjection.

**LOGINJS-SCROLL-FORCE-STOP-AFTER-PERMISSIONS-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** Despues de entrar a Permisos/Storage, el flujo vuelve a App info pero la pantalla queda desplazada hacia la zona de permisos. El usuario indico que antes de Force stop debe hacer swipe inverso para volver a ver el boton.
- **Restore Point Creado:**
  - `restore_points/2026-06-17_PRE_LOGINJS_SCROLL_TO_FORCE_STOP_AFTER_PERMISSIONS_01`
- **Archivos Modificados:**
  - `Login.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - Se agrego `clearRetryScrollAppInfoToTop()` para buscar `Force stop`/`Forzar detencion` y, si no esta visible, hacer swipes hacia abajo de contenido antes de pulsarlo.
  - La secuencia queda: Clear cache/data -> Permisos/Storage -> volver a App info -> reajustar scroll hasta Force stop -> Force stop -> segundo intento.
- **Alcance:** No se modifica backend, APK, H.264, control manual, OCR ni MediaProjection.

**LOGINJS-STORAGE-PERMISSION-BEFORE-FORCE-STOP-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** El usuario pidio integrar en `Login.js` la logica de `test.js` para activar permisos de storage en el clon correspondiente despues de Clear cache/Clear data y antes de Force stop, durante el flujo previo al segundo intento.
- **Restore Point Creado:**
  - `restore_points/2026-06-17_PRE_LOGINJS_STORAGE_PERMISSION_BEFORE_FORCE_STOP_01`
- **Archivos Modificados:**
  - `Login.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - Se agrego `clearRetryEnsureStoragePermission(packageName)` y helpers adaptados de `test.js` para entrar a Permisos/Permissions desde App info y activar Storage/Almacenamiento/Files and media.
  - Soporta flujo Android 9 con `Switch` y flujo Android 10+ con `RadioButton`/`Allow`/`Permitir`.
  - La secuencia del segundo intento programado ahora es: Clear cache/data -> activar/revisar permiso storage del clon -> Force stop -> Home -> abrir clon -> segundo login.
  - Si el permiso no aparece o ya no puede cambiarse, se registra en log y se continua con Force stop para no bloquear el segundo intento.
- **Alcance:** No se modifica backend, APK, H.264, control manual, OCR ni MediaProjection.

**LOGINJS-CLEAR-DATA-BEFORE-SECOND-ATTEMPT-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** El usuario pidio que, despues de la primera ronda de intentos, cada cuenta programada para segundo intento limpie cache/datos del clon usando la logica de `clear-cache-data.js` antes de reabrir Spotify y volver a intentar login.
- **Restore Point Creado:**
  - `restore_points/2026-06-17_PRE_LOGINJS_CLEAR_DATA_BEFORE_RETRY_01`
- **Archivos Modificados:**
  - `Login.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - Se integraron en `Login.js` funciones adaptadas de `clear-cache-data.js` para abrir App info del paquete del clon, entrar a Storage/Almacenamiento, ejecutar Clear cache/Clear data, confirmar y hacer Force stop.
  - En la cola `deferredRetries`, antes de cada segundo intento se ejecuta `clearCacheDataForRetry(packageName)`.
  - Tras limpiar cache/datos y cerrar el clon, `Login.js` vuelve a abrir el paquete y ejecuta el segundo intento de login.
  - El resultado del segundo intento se normaliza con `finalizeSecondAttemptResult(...)`: si no es `success` o `already`, queda como `error` final para que la bolita pase a rojo.
- **Alcance:** No se modifica backend, APK, H.264, control manual, OCR ni MediaProjection.

## ULTIMOS CAMBIOS (2026-06-16) - FlowLogin Login.js payload/status fix

**LOGINJS-FAST-EXACT-ERROR-SCAN-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** En prueba real, al aparecer `This email and password combination is incorrect.`, algunas cuentas quedaban con mensaje `Sin confirmacion segura`, lo que indicaba que el detector no estaba leyendo el `TextView` aunque UIAutomator lo mostraba. Ademas, el flujo tardaba demasiado en continuar despues del error.
- **Restore Point Creado:**
  - `restore_points/2026-06-16_PRE_LOGINJS_FAST_EXACT_ERROR_SCAN_01`
- **Archivos Modificados:**
  - `Login.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - Se agrego `scanIncorrectCredentialsTextViews()` para recorrer directamente los `android.widget.TextView` visibles y buscar coincidencia exacta con `This email and password combination is incorrect.`.
  - `confirmOutcome(...)` ahora busca ese error exacto antes de verificar login estable o errores genericos.
  - Se agrego `confirmLoggedInQuick()` para evitar que la confirmacion de login bloquee varios segundos el escaneo del error de credenciales.
  - Se redujo la espera por iteracion para que, cuando el mensaje aparezca, el script continue mucho mas rapido.
  - La deteccion sigue evitando falsos positivos al exigir coincidencia exacta del texto completo.
- **Alcance:** No se modifica backend, APK, H.264, control manual, OCR ni MediaProjection.

**LOGINJS-DEFER-ALL-FIRST-RETRIES-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** En prueba con 10 cuentas invalidas, algunas cuentas quedaban rojas en la primera ronda aunque todas mostraban el mensaje exacto `This email and password combination is incorrect.`. Tambien se observo que algunos clones se cerraban y reabrian inmediatamente al aparecer la pantalla inicial de Spotify, antes de continuar con las siguientes cuentas.
- **Restore Point Creado:**
  - `restore_points/2026-06-16_PRE_LOGINJS_DEFER_ALL_FIRST_RETRIES_01`
- **Archivos Modificados:**
  - `Login.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - En primera ronda, cualquier resultado con `retry=true` ya no ejecuta el segundo intento inmediatamente sobre el mismo clon. La cuenta queda en `retrying` y se agrega a la cola `deferredRetries`, permitiendo continuar con la siguiente cuenta.
  - Se reforzo `findIncorrectCredentialsMarker(...)` para evitar falsos positivos: detecta el texto exacto `This email and password combination is incorrect.` y exige que venga de un nodo cuyo id termine en `:id/body` usando `idMatches(/.*:id\/body$/)`.
  - Se agregaron helpers `nodeId(...)`, `isSpotifyBodyNode(...)` e `isIncorrectCredentialsText(...)` para validar mejor el origen/texto del mensaje.
- **Alcance:** No se modifica backend, APK, H.264, control manual, OCR ni MediaProjection.

**FLOWLOGIN-REQUIRE-FRESH-SCRIPT-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** Verificar y reforzar que cada ejecucion de `Login.js` use el archivo local actualizado, no una copia vieja que haya quedado en `/sdcard/Download/...`.
- **Restore Point Creado:**
  - `restore_points/2026-06-16_PRE_FLOWLOGIN_REQUIRE_FRESH_SCRIPT_01`
- **Archivos Modificados:**
  - `local_adb_server.py`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - En `/autojs/run`, cuando el path remoto corresponde a `Login.js`/`Register.js`, el backend resuelve el script local y lo sube con `adb push` al path remoto antes de ejecutar por socket FlowAgent.
  - Si el script local fresco no existe o no se puede resolver, FlowLogin no se inicia y devuelve un mensaje explicito en lugar de ejecutar una copia remota vieja.
  - El resultado del backend ahora incluye `Script actualizado: Login.js -> <ruta remota>` despues del push correcto.
- **Alcance:** No se modifica APK, H.264, control manual, OCR ni MediaProjection.

**LOGINJS-DEFERRED-INCORRECT-RETRY-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** En prueba real, cuando Spotify mostraba `This email and password combination is incorrect.`, `Login.js` entraba inmediatamente al intento 2 del mismo clon (`retry intento 2`, `recuperando com.spotify.musid`). El usuario pidio que ese mensaje se detecte sin falsos positivos, se programe esa cuenta para segundo intento y el flujo continue con la siguiente cuenta.
- **Restore Point Creado:**
  - `restore_points/2026-06-16_PRE_LOGINJS_DEFERRED_INCORRECT_RETRY_01`
- **Archivos Modificados:**
  - `Login.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - `findIncorrectCredentialsMarker(...)` ahora detecta solo el texto exacto `This email and password combination is incorrect.`, priorizando el id `com.spotify.musid:id/body`.
  - El resultado de credenciales incorrectas agrega `deferRetry=true`.
  - El bucle principal ya no ejecuta inmediatamente el intento 2 para ese caso: deja la cuenta en `retrying`, la agrega a una cola `deferredRetries` y continua con la siguiente cuenta.
  - Al terminar la primera pasada, `Login.js` procesa los reintentos programados. Si el mensaje vuelve a aparecer en esa segunda pasada, la cuenta queda finalmente en `error`.
- **Alcance:** No se modifica backend, APK, H.264, control manual, OCR ni MediaProjection.

**LOGINJS-INCORRECT-CREDENTIAL-RETRY-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** En Spotify, despues de escribir email/password y pulsar login puede aparecer el `TextView` `com.spotify.musid:id/body` con texto `This email and password combination is incorrect.`. El usuario pidio que ese caso se detecte como login no logrado y programe un segundo intento.
- **Restore Point Creado:**
  - `restore_points/2026-06-16_PRE_LOGINJS_INCORRECT_CREDENTIAL_RETRY_01`
- **Archivos Modificados:**
  - `Login.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - Se agrego `findIncorrectCredentialsMarker(...)` para detectar textos especificos de credenciales incorrectas, incluyendo `This email and password combination is incorrect.` y el id `com.spotify.musid:id/body`.
  - `confirmOutcome(...)` evalua ese detector antes del error generico. Cuando aparece, devuelve `status=error` con `retry=true`, permitiendo que el bucle existente cierre/recupere el clon y ejecute el intento 2.
  - Si el mensaje vuelve a aparecer en el intento maximo, la cuenta queda finalmente en `error`.
- **Alcance:** No se modifica backend, APK, H.264, control manual, OCR ni MediaProjection.

**LOGINJS-FLOWKEYBOARD-EMAIL-RETRY-FIX-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** En prueba real, `Login.js` abria el clon, escribia el email visualmente con FlowKeyboard, pero despues cerraba la app y reiniciaba el clon como intento 2 antes de escribir la contrasena.
- **Causa:** Tras `keyboard_type_human`, `Login.js` verificaba el email leyendo `node.text()` y exigia coincidencia exacta. En Spotify/Android el nodo de accesibilidad puede devolver texto atrasado, vacio o haber cambiado de estado aunque el email ya se haya escrito correctamente, provocando `review` con `retry=true`.
- **Restore Point Creado:**
  - `restore_points/2026-06-16_PRE_LOGINJS_EMAIL_RETRY_FIX_01`
- **Archivos Modificados:**
  - `Login.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - FlowKeyboard sigue siendo obligatorio para credenciales (`allowFallback=false`), pero el exito de `keyboard_type_human` ya no se invalida con una lectura exacta posterior de `node.text()`.
  - Si FlowKeyboard devuelve `ok`, el flujo continua hacia contrasena/submit sin cerrar ni reabrir el clon por esa validacion.
- **Alcance:** No se modifica backend, APK, H.264, control manual, OCR ni MediaProjection.

**LOGINJS-FLOWKEYBOARD-REQUIRED-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** El usuario pidio que `Login.js` escriba credenciales usando el IME FlowKeyboard y que se vean visualmente las letras/teclas al introducir texto.
- **Restore Point Creado:**
  - `restore_points/2026-06-16_PRE_LOGINJS_FLOWKEYBOARD_REQUIRED_01`
- **Archivo Modificado:**
  - `Login.js`
  - `PROJECT_CONTEXT.md`
- **Cambio Aplicado:**
  - `Login.js` ahora usa directamente `com.flowlogin.agent.FlowKeyboardService.executeKeyboardCommand(...)` con comando `keyboard_type_human` para email y password.
  - Los campos usan `fieldType=email` y `fieldType=password`, `mistakesEnabled=false` y `allowFallback=false`.
  - FlowKeyboard queda obligatorio para credenciales: si el IME no esta seleccionado, la InputView no esta visible, no hay accesibilidad para `dispatchGesture`, o un caracter no esta soportado por el teclado visual, la cuenta queda en `review` con mensaje `FlowKeyboard ... obligatorio`.
- **Decision:** No hay fallback a `EditText.setText()` para email/password dentro de `Login.js`.
- **Alcance:** No se modifica APK, backend Python, H.264, control manual, OCR ni MediaProjection.

**FLOWLOGIN-SCRIPT-PATH-FIX-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** En pruebas con `192.168.1.11:5555`, FlowLogin desde Grid reportaba "iniciado correctamente" aunque no ejecutaba nada, y desde Focus/Auto.js aparecia `[192.168.1.11:5555] ERROR: adb: error: cannot stat 'login.js': No such file or directory`.
- **Causa:** `resolve_local_script_path(...)` podia resolver `login.js` como ruta relativa/minuscula en vez de devolver la ruta absoluta real `C:\DASHBOARD\FlowDashboard\Login.js`. Luego `adb push login.js ...` fallaba si el proceso Python no estaba en el cwd esperado o si el casing no coincidia.
- **Restore Point Creado:**
  - `restore_points/2026-06-16_PRE_FLOWLOGIN_SCRIPT_PATH_FIX_01`
- **Archivos Modificados:**
  - `local_adb_server.py`
  - `electron-app/src/renderer/app.js`
  - `PROJECT_CONTEXT.md`
- **Cambios Aplicados:**
  - `resolve_local_script_path(...)` ahora devuelve rutas absolutas (`Path.resolve()`) y busca scripts por nombre sin sensibilidad a mayusculas/minusculas dentro de `BASE_DIR` y `RESOURCE_DIR`.
  - El boton FlowLogin de Grid ahora lee `data.result`, lo imprime en consola y convierte errores internos (`ERROR:`, `no se inicio`, `No hay cuentas asignadas`, `Socket FlowAgent obligatorio`) en error visible en lugar de mostrar exito falso solo porque HTTP 200 respondio.
- **Alcance:** No se modifica el script de login, H.264, control, OCR, MediaProjection ni APK.

**AUTOJS-PANEL-FLOWLOGIN-RESULT-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** Al ejecutar `Login.js` desde el panel Auto.js de Focus, el historial solo mostraba `autojs run /sdcard/Download/flowdashboard_autojs/Login.js (...)` y la UI ocultaba la respuesta real del backend. Esto impedia ver si FlowLogin no arrancaba por backend sin reiniciar, falta de cuentas, socket FlowAgent obligatorio o error de preparacion.
- **Restore Point Creado:**
  - `restore_points/2026-06-16_PRE_AUTOJS_PANEL_LOGIN_RESULT_01`
- **Archivos Modificados:**
  - `electron-app/src/renderer/app.js`
  - `electron-app/src/renderer/flow-touch.js`
  - `PROJECT_CONTEXT.md`
- **Cambios Aplicados:**
  - `autoJsRunRemote(...)` ahora envia el `delimiter` actual del dashboard al backend cuando ejecuta scripts remotos.
  - El panel Auto.js ahora muestra un resumen real de `data.result` devuelto por `/autojs/run` y registra en historial `autojs OK/RESP` con las primeras lineas del resultado, en lugar de mostrar siempre una frase generica.
- **Alcance:** Solo diagnostico/visibilidad del panel Auto.js y parametros de ejecucion remota. No se modifica H.264, control, APK, OCR, MediaProjection ni logica visual de bolitas.

**FLOWLOGIN-LOGINJS-PAYLOAD-STATUS-01:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** Evitar que `Login.js` se ejecute desde `/sdcard/Download/Login.js` usando cuentas viejas o inexistentes, y permitir que las bolitas de cuenta reflejen el progreso escrito por el script.
- **Restore Point Creado:**
  - `restore_points/2026-06-16_PRE_FLOWLOGIN_LOGINJS_FIX_205157`
- **Archivos Modificados:**
  - `local_adb_server.py`
  - `Login.js`
  - `PROJECT_CONTEXT.md`
- **Cambios Aplicados:**
  - `local_adb_server.py` ahora detecta `Login.js`/`Register.js` aunque `filePath` sea remoto (`/sdcard/Download/Login.js`), prepara el payload con `prepare_flowlogin_payload(...)`, sube `/sdcard/Download/flowlogin_accounts.json`, borra el status viejo, sube/verifica el script local y recien despues ejecuta por socket FlowAgent.
  - Para FlowLogin/FlowRegister remoto se bloquea el fallback silencioso a AutoJS standalone: el socket FlowAgent sigue siendo obligatorio.
  - `/login-status` ahora intenta leer `/sdcard/Download/flowlogin_status.json`, aplica sus `items` a `device_names.json` mediante `update_device_account_statuses(...)` y devuelve `progress` con claves `clone1..clone10` por serial y por clave estable del dispositivo para actualizar bolitas.
  - Se propaga `mode` desde `/autojs/run` hasta `prepare_flowlogin_payload(...)` para respetar `pending-only` y `retry-all`.
  - `Login.js` ahora incluye `line` en cada item de status, tolera ausencia de permiso overlay sin abortar, valida escritura basica de campos, amplia marcadores ingles/espanol y elimina el click ciego debajo del password como fallback de submit.
- **Decision explicita:** captcha/verificacion/too many siguen marcandose como `error`, no como `review`, por solicitud del usuario.
- **Alcance:** No se modifica H.264, scrcpy-control, OCR, MediaProjection, APK FlowAgent, estilos visuales ni flujo de control manual.

## ULTIMOS CAMBIOS (2026-06-16) - Focus Mode Usability & Visual Enhancements

**FOCUS-UI-ENHANCEMENTS-04:**
- **Estado:** ![IMPLEMENTADO Y VALIDADO](https://img.shields.io/badge/Estado-IMPLEMENTADO_Y_VALIDADO-brightgreen)
- **Motivo:** Resolver problemas de usabilidad en Modo Focus: recortado vertical de los botones de herramientas, posicionamiento/contenido del popover de bolitas de cuenta, modal de edición de cuentas intrusivo (pantalla completa) y arrastre inestable de ventanas flotantes.
- **Archivos Modificados:**
  - [styles.css](file:///C:/DASHBOARD/FlowDashboard/electron-app/src/renderer/styles.css)
  - [app.js](file:///C:/DASHBOARD/FlowDashboard/electron-app/src/renderer/app.js)
  - [flow-touch.js](file:///C:/DASHBOARD/FlowDashboard/electron-app/src/renderer/flow-touch.js)
- **Cambios Aplicados:**
  - **Botones de Herramientas Compactos y Horizontales:** Se redefinieron los botones `.fp-launcher-btn` en CSS para usar `flex-direction: row` con altura fija de `32px` y gap reducido. Se ajustó el tamaño de los iconos SVG a `16px * 16px` eliminando el margen inferior y se redujo el gap en `.focus-pro-panel` a `4px`, previniendo desbordes y garantizando que quepan en viewports con baja resolución vertical.
  - **Popover Minimalista de Bolitas de Cuentas:** Se simplificó la interfaz del popover de estado (removiendo metadatos y cabecera) para mostrar exclusivamente los botones de acción (Reintentar y Reemplazar) de forma compacta. Se cambió el cálculo de posicionamiento para colocarse por defecto a la derecha del dot con fallback a la izquierda, y se actualizó la rotación de la flechita a `225deg` en CSS para apuntar simétricamente hacia el dot.
  - **Editor de Cuentas Flotante Translúcido:** Se implementó una lógica condicional en JS para añadir la clase `.is-focus-floating` al modal `#accountEditorModal` al abrirse desde Modo Focus. En CSS se dotó a esta clase de un fondo translúcido suave (`rgba(2, 8, 20, 0.25)`) y un filtro de desenfoque disminuido (`blur(3px)`), además de un borde y resplandor neón cian en su tarjeta para que luzca flotante sobre el canvas sin bloquear la visión del stream.
  - **Arrastre por Deltas para Ventanas Flotantes:** Se reescribió por completo la lógica de drag en `_enableWindowDragResize` en `flow-touch.js` utilizando desplazamientos delta en `mousemove` a partir del `offsetLeft`/`offsetTop` inicial, solventando el bug de salto de coordenadas provocado por el `position: relative` de `.flowtouch-focus-shell`. Se añadieron límites al drag para evitar ocultar el panel del contenedor.
  - **Sincronización en Tiempo Real de Cuentas y Bolitas en Foco:** Se resolvió el bug por el cual guardar nuevas cuentas en el editor flotante no actualizaba el contador de cabecera (`0/10`) ni las bolitas derechas en Modo Focus sin salir y volver a entrar. Se modificó `updateStatusDots()` para utilizar `querySelectorAll` actualizando simultáneamente los contenedores de la grilla y de Modo Focus. Se añadió una llamada explícita a `updateStatusDots()` en `loadDevices()` y un hook de refresco en `renderDevices()`, logrando sincronización bidireccional inmediata.

## ULTIMOS CAMBIOS (2026-06-16) - Focus Mode Visual Glow & Segmented Quality Controls


**FOCUS-UI-VISUAL-GLOW-02:**
- **Estado:** ![IMPLEMENTADO Y VALIDADO](https://img.shields.io/badge/Estado-IMPLEMENTADO_Y_VALIDADO-brightgreen)
- **Motivo:** Aplicar un rediseño de alta gama a la cabecera y cuerpo del Modo Focus y corregir problemas de solapamiento en pantallas pequeñas/modo clásico, el recorte de la sombra de resplandor, y el estado "OFFLINE" erróneo.
- **Restore Point Creado:**
  - `restore_points/2026-06-16_PRE_FOCUS_UI_VISUAL_GLOW_02`
- **Archivos Modificados:**
  - [flow-touch.js](file:///C:/DASHBOARD/FlowDashboard/electron-app/src/renderer/flow-touch.js)
  - [styles.css](file:///C:/DASHBOARD/FlowDashboard/electron-app/src/renderer/styles.css)
- **Cambios Aplicados:**
  - **Corrección de Estado "OFFLINE":** Se implementó una lógica de fallback en `flow-touch.js` para que si el arreglo de transportes reporta vacío pero el dispositivo emite stream en Focus Mode, se determine de forma segura el tipo de conexión física (WIFI para IPs con colón o punto, USB en caso contrario), permitiendo que el badge muestre su respectivo tipo (`WIFI` o `USB`) con el gradiente neón dinámico.
  - **Adaptación Responsiva de Cabecera (Mobile Header Stack):** Se añadió una media query CSS para pantallas menores a `600px` (o viewports estrechos en modo clásico) que reorganiza el header en columna de dos filas (Fila 1: Título completo, conexión e IP; Fila 2: Segmentos de calidad y botones de herramientas/cierre). Adicionalmente, se configuró `.flowtouch-focus-connection` para truncar su contenido con puntos suspensivos (`text-overflow: ellipsis`) en caso de falta de espacio extremo, evitando solapamientos con la barra segmentada.
  - **Corrección de Animación Recortada en Bordes:** Se modificó `@keyframes scaleInFocus` para realizar una transición fluida basada exclusivamente en escala y opacidad (`scale(0.96)` a `scale(1)`), eliminando la traslación vertical `translateY(20px)` que empujaba la pantalla por fuera de la máscara de overflow en la entrada inicial.
  - **Corrección de Solapamiento en Modo Clásico:** El header técnico `#flowTouchTechHeader` (que muestra el estado de FlowAgent y el watchdog de frames) ahora se oculta de forma automática en Modo Clásico (`is-clean-mode` en el shell) y se muestra únicamente en Modo Avanzado. Esto deja suficiente espacio para el título y las acciones principales en pantallas estrechas, impidiendo que el botón de cerrar se salga de los márgenes o sea inaccesible.
  - **Alineación de Drawer e Historial:** Se corrigió la lógica en JS para alternar dinámicamente la clase `.is-clean-mode` en el shell cuando se abre/cierra la barra avanzada, haciendo que el Historial de Eventos (`.flowtouch-log-panel`) se visualice y oculte correctamente en lugar de quedar permanentemente oculto por la regla de clean-mode.
  - **Corrección de Resplandor Recortado:** Se añadió `padding: 16px !important;` al contenedor principal `.flowtouch-phone-stage` en CSS. Esto crea el espaciado necesario del marco para que el efecto de sombra y brillo pulsante neón de calidad de stream se renderice suavemente sin truncarse en los bordes.
  - **Colorido Permanente de Herramientas:** Se mejoró el estilo visual de los botones `.fp-launcher-btn` en la barra lateral avanzada. Ahora lucen colores y bordes translúcidos específicos de su categoría de forma permanente (no solo en hover), iluminándose a un tono de brillo neón de alta intensidad al pasar el cursor.
  - **Calidad Segmentada:** Reemplazado el `<select>` de calidad por píldoras segmentadas en la cabecera (`.flowtouch-quality-segments`).
  - **Glow Dinámico de Presets:** Configurado un resplandor neón pulsante continuo en `.flowtouch-phone-frame` que cambia según el preset: verde esmeralda (Eco), cian neón (Balanced), y violeta eléctrico (Pro).
  - **Micro-animaciones en Cabecera:**
    - Rotación elástica de 90° y glow rojo en hover del botón Cerrar (`#flowTouchCloseBtn`).
    - Iluminación cian neón activa y escala en hover del botón Avanzado (`#flowTouchAdvancedToggleBtn`).
    - Línea de acento inferior expansiva desde el centro y micro-lápiz de edición dinámico en hover del botón del Nombre del Dispositivo (`#flowTouchDeviceNameBtn`).
  - **Barra Android Ripple:** Efecto de deformación y resplandor al presionar los botones inferiores de Back, Home y Recents.
  - **Insignias y Logs:** Añadidas transiciones `slide-in-up` y badges de color clasificados por tipo de acción en el historial de eventos (TAP, SWIPE, KEY, ERR).
- **Pruebas y Verificación:**
  - Sintaxis de `flow-touch.js` comprobada con Node.js (OK).
  - Lanzamiento del dashboard con `abrir_electron.bat` iniciado en segundo plano.

## ULTIMOS CAMBIOS (2026-06-16) - Focus Mode UI & Side Panel Drawer Responsiveness

**FOCUS-UI-RESTORE-TOOLS-NONCONTROL-01:**
- **Estado:** IMPLEMENTADO Y VALIDADO.
- **Motivo:** Mejorar la interfaz del Modo Focus (Focus Mode) y las herramientas no relacionadas con el control del dispositivo, garantizando una grilla visual premium, aspect-ratio 9:16 robusto en el wrapper sin overflow, y compatibilidad responsiva con pantallas pequeñas sin alterar el motor de video H.264 ni la lógica táctil.
- **Restore Point Creado:**
  - `restore_points/2026-06-16_PRE_FOCUS_UI_RESTORE_TOOLS_NONCONTROL_01`
  - `restore_points/2026-06-16_PRE_FOCUS_UI_RESTORE_TOOLS_NONCONTROL_01_FINAL`
- **Archivos Modificados:**
  - [flow-touch.js](file:///C:/DASHBOARD/FlowDashboard/electron-app/src/renderer/flow-touch.js)
  - [styles.css](file:///C:/DASHBOARD/FlowDashboard/electron-app/src/renderer/styles.css)
- **Cambios Aplicados por Fase:**
  - **Fase 1 (Sintaxis y Estructura):** Se corrigió un error de sintaxis en `flow-touch.js` (comillas/backticks duplicadas al final del template de `openFocus`) que impedía arrancar la aplicación.
  - **Fase 2 (Layout & Phone Wrapper):** Se envolvió el stage de foco en un contenedor flexible `.flowtouch-phone-wrapper` con `height` dinámico basado en `calc(100dvh - 164px)` y `max-height: min(100%, 720px)`. El teléfono mantiene el aspect-ratio `9/16` sin provocar desbordes verticales ni horizontales.
  - **Fase 3 (Paneles de Herramientas y Logs):** Se configuraron la barra de herramientas avanzada (`.focus-pro-panel`) a la izquierda y el historial de eventos (`.flowtouch-log-panel`) a la derecha. En pantallas grandes se acomodan a los lados del teléfono de forma simétrica; en pantallas pequeñas (< 1100px) se transforman automáticamente en drawers superpuestos con efecto frosted-glass.
  - **Fase 4 (Avanzado & SVGs):** El botón "Avanzado" de la cabecera se reemplazó por un icono premium SVG de barras/deslizadores de control, incluyendo su tooltip informativo.
  - **Fase 5 (Gestión de Ventanas Flotantes):** Las ventanas `.fp-window` se montan en `.flowtouch-focus-shell` y su z-index se controla dinámicamente (`z-index: 50` al crearse, `60` al clickarse para traer al frente). Se corrigió la persistencia de geometría guardada en `localStorage` para que sea individual por ventana (ADB, Files, etc.) y no sobrescriba la de Apps.
  - **Fase 6 (Salvaguardas & Resiliencia):** Se auditaron y añadieron validaciones de nulidad en todos los binders de herramientas (Apps, Files, ADB, Auto.js, Sistema, Energía, FlowKeyboard). Esto previene caídas por llamadas asíncronas con overlay cerrado o elementos no montados. Se solucionó el crash potencial del indicador de FlowKeyboard (`#flowTouchKeyboardState`).
- **Pruebas y Verificación:**
  - Se corrió `node --check electron-app/src/renderer/flow-touch.js` con salida limpia (exit 0).
  - La visualización y adaptabilidad de la escala se verificó, constatando que no hay desbordes y que el botón Avanzado (icono SVG) conmuta correctamente la visibilidad de los paneles laterales.
  - Se corroboró que el control táctil (taps, swipes, live-touch, botones Back/Home/Recents) y la conexión de stream (presets Eco, Balanced, Pro) siguen funcionando perfectamente sin alteraciones de MediaProjection ni control.

## ULTIMOS CAMBIOS (2026-06-15) - Consolidacion documental runtime/source of truth

**DOCS-RUNTIME-CONSOLIDATION-20260615:**
- **Estado:** IMPLEMENTADO.
- **Motivo:** La documentacion historica tenia contradicciones sobre H.264, Grid/Focus, `scid`, sesiones `serial|preset`, watchdog, puertos y locks JSON. Algunas secciones antiguas describian estados previos a los fixes de `frame_meta`/`FDH1` y al LKGS actual.
- **Cambio aplicado:** `docs/master_technical_specification.md` fue reescrito como referencia vigente basada en auditoria de codigo y runtime caliente. El documento ahora explicita el flujo actual completo: `abrir_electron.bat`, backend C# `5000`, backend Python `8765`, FlowAgent `8766`, H.264 WS `8768`, ADB empaquetado, `/devices`, `/api/devices`, `/streaming/raw/sessions`, `/control/scrcpy-sessions`, control manual por `scrcpy-control`, fallback ADB y FlowAgent solo bajo demanda.
- **Validacion runtime usada:** `GET /health`, `GET /devices`, `GET /api/devices`, `GET /api/health`, `GET /api/streaming/stats`, `GET /api/streaming/active`, `GET /streaming/raw/sessions`, `GET /control/scrcpy-sessions` y `adb devices -l`.
- **Resultado runtime observado:** 17 dispositivos actuales en estado ADB `device`; `/devices` y `/api/devices` devuelven 17 dispositivos; `/streaming/raw/sessions` disponible; `/control/scrcpy-sessions` disponible con sesiones control-only; `/api/streaming/stats` existe en C# puerto 5000, no en Python 8765.
- **Regla vigente:** Toda IA que trabaje en el proyecto debe considerar `docs/master_technical_specification.md` como baseline actual y tratar secciones historicas contradictorias de `PROJECT_CONTEXT.md` como legacy salvo nueva verificacion runtime. `DOCUMENTACION_TECNICA.md` queda excluido como fuente tecnica vigente.
- **No tocado:** No se modifico Scrcpy Video, H.264, WebCodecs, control manual, FlowAgent, OCR, MediaProjection ni backend runtime.

## ULTIMOS CAMBIOS (2026-06-15) - H.264 Grid/Focus wake preflight

**H264-FOCUS-PAINT-CACHED-FRAME-01:**
- **Estado:** IMPLEMENTADO.
- **Problema real observado:** Grid cargaba correctamente en todos los dispositivos, pero al abrir Focus inicialmente en `eco` podia quedar negro hasta cambiar a `balanced` y volver a `eco`.
- **Causa probable:** Focus se agregaba como canvas nuevo a una sesion H.264 ya viva; si la pantalla estaba estatica, no llegaba un frame nuevo inmediatamente para pintar ese canvas.
- **Cambio aplicado:** `electron-app/src/renderer/stream-renderer-h264.js` conserva el ultimo `ImageBitmap` decodificado por sesion y lo pinta de inmediato cuando se agrega un nuevo canvas. Esto evita que Focus dependa de un cambio de preset o movimiento en pantalla para mostrar la primera imagen.
- **Validacion tecnica:** `node --check electron-app/src/renderer/stream-renderer-h264.js` OK.
- **Prueba pendiente:** abrir con `abrir_electron.bat`, entrar a Focus directamente en `eco` y verificar que pinta sin cambiar a `balanced`.

**H264-VIDEO-WAKE-PREFLIGHT-ALL-DEVICES-01:**
- **Estado:** IMPLEMENTADO Y VALIDADO EN BACKEND.
- **Problema real confirmado:** Los dispositivos `192.168.1.39:5555`, `192.168.1.44:5555`, `192.168.1.48:5555` y `192.168.1.147:5555` aparecian negros en Grid/Focus porque estaban en `mWakefulness=Dozing` y `Display Power: state=OFF`. El frontend podia contar frames decodificados, pero eran frames validos de pantalla apagada.
- **Evidencia runtime:** `.11` estaba `Awake`/`Display Power: state=ON`; los cuatro conflictivos estaban `Dozing`/`OFF`. Tras `KEYCODE_WAKEUP`, los cuatro pasaron a `Awake`/`ON` y el stream H.264 empezo a entregar IDR utiles de varios KB.
- **Cambio aplicado:** `scrcpy_raw_streamer.py` ejecuta un preflight `adb shell input keyevent WAKEUP` antes de crear una sesion H.264 video-only. Esto es necesario porque el modo video usa `control=false`, y en scrcpy v4.0 el `power_on` oficial lo maneja el controlador de control, no el stream de video puro.
- **Validacion:** Con `.39` en `Dozing/OFF`, abrir un WebSocket H.264 `eco` desperto el dispositivo automaticamente y entrego `FDH1 config` + IDR util; despues quedo `Awake/ON`.
- **Regla operativa:** Para abrir la app usar `abrir_electron.bat`. No usar pruebas manuales con `electron.exe` directo.

## AUDITORÍA PROFESIONAL Y LIMPIEZA DE WORKSPACE (2026-06-14)

**PROFESSIONAL-AUDIT-CLEANUP-01:**
- **Estado:** COMPLETADO.
- **Conclusión:** Se realizó una auditoría completa del workspace recursivamente. Se inventariaron y clasificaron todos los archivos del proyecto, resolviendo la estructura del backend C#, backend Python, la app Electron y el APK FlowAgent.
- **Acciones Realizadas:**
  - Se movieron ~925 MB de archivos y directorios obsoletos, temporales o redundantes a la carpeta `Eliminar` en la raíz del proyecto para despejar el espacio de trabajo.
  - Se identificaron dependencias, configuraciones de Supabase y esquemas de persistencia (como `device_names.json` y `device_groups.json`).
  - Se documentaron los hallazgos detalladamente en el artefacto `audit_report.md`.
  - **Ampliación de Auditoría (Visualización, Touch, Licencias, Cuentas, Inspector):** Se completó un diagnóstico técnico minucioso sobre todo el software. Además de las fallas del Focus Mode (aspect ratio rígido 9:16 en CSS, descalibración táctil en rotaciones y bug del touch UP faltante en long press), se detectaron:
    1. Un error crítico en la validación de licencias con Supabase (el backend ignora resultados RPC exitosos devueltos en listas, provocando rechazo incondicional de licencias en producción).
    2. Un bug en el reparto de cuentas de FlowLogin (el frontend no inicializa la lista de cuentas al dividir, causando que el reemplazo de una sola cuenta vacíe y corrompa el perfil de los otros clones en el teléfono, además de escapes dobles de saltos de línea y prompts bloqueantes nativos).
    3. Retrasos de rendimiento críticos en el Inspector de UI (hasta 350 llamadas síncronas consecutivas de WebSocket en CDP, ViewServer obsoleto en puertos fijos que colisionan, y volcados nativos vacíos en comandos como logcat/dumpsys). Todo ha sido consolidado en `audit_report.md`.

## ULTIMOS CAMBIOS (2026-06-13) - Auditoría Canvas Focus

**FOCUS-UI-CANVAS-REFERENCE-AND-ASPECT-SAFE-01:**
- **Estado:** CERRADO EN NO-OP (Auditoría limpia).
- **Conclusión:** No se aplicó parche preventivo. La sospecha de canvas fantasma quedó descartada por comprobación estricta en runtime. El canvas Focus visible está correctamente registrado e hidratado por H.264 (`sameSession=true`, `domCanvasInFocusSet=true`, `domCanvasInPhysicalSet=true`). El layout actual visible de 356x635 conserva fielmente la proporción matemática 9:16 de su base (272x480), descartando la distorsión. El estado H.264 + Control permanece inquebrantable.

## ULTIMOS CAMBIOS (2026-06-11) - FASE 2A y 2B (H.264 & Control Runtime Fix)

**H264-FOCUS-STATIC-SESSION-REOPEN-COMPAT-01:**
- **Estado:** VALIDADO EN RUNTIME.

**Validación runtime Focus .11:**
```text
t0:
- activeSerial: 192.168.1.11:5555
- focusKey: 192.168.1.11:5555|eco
- sameObject: true
- framesDecoded: 23
- frameW: 272
- frameH: 480
- loaderVisible: false
- watchdogs: []
- retryCounts: {}

t10:
- framesDecoded: 23
- sameObject: true
- loaderVisible: false
- watchdogs: []
- retryCounts: {}

t30:
- framesDecoded: 103
- fps: 20.3
- lastFrameAt actualizado
- sameObject: true
- loaderVisible: false
- watchdogs: []
- retryCounts: {}
```

**No volvió a aparecer:**
- Detectada sesion fisica stale/congelada. Cerrando y recreando master.
- closing stale master.
- recreating master attempt.
- Abortando tras 3 reintentos.

**Conclusión:**
- `attachFocus` ya no destruye una sesión H.264 válida por pantalla estática.
- El alias `192.168.1.11:5555|eco` apunta al mismo objeto que el serial físico.
- El loader puede conservar el texto “Conectando stream...” en el DOM, pero está oculto; no es fallo si `loaderVisible=false`.
- `CONTROL-FOCUS-11` y `H264-FOCUS-STATIC-SESSION-REOPEN-COMPAT-01` quedan como LKGS actual.

---

### LKGS ACTUAL:
**H.264 Focus + Control Focus .11 estable.**

**VALIDADO:**
- H.264 Focus .11.
- Static screen compat en video.
- Static screen compat en control.
- Reopen/reattach Focus .11 sin destruir master válido.
- Tap UI Focus.
- Live touch / drag.
- Back / Home / Recents.
- `activeSerial` físico: `192.168.1.11:5555`.
- `focusKey` visual H.264: `192.168.1.11:5555|eco`.
- Backend `scrcpy_control` sin fallback ADB.

> **ADVERTENCIA:** A partir de este LKGS, no aplicar más hotfixes sobre H.264 ni Control Focus .11 salvo bug nuevo reproducible con evidencia runtime. La próxima fase debe ser separada y visual: `FOCUS-UI-RESTORE-TOOLS-NONCONTROL-01`.
- **Archivos tocados:** `stream-renderer-h264.js`.
- **Restore point:** `restore_points/2026-06-13_PRE_H264_FOCUS_STATIC_SESSION_REOPEN_COMPAT_01`.
- **Propósito:** El Control Focus .11 quedó validado completo cuando el stream está vivo o al dejarse en background. Sin embargo, al *reabrir* Focus tras un tiempo de inactividad de pantalla, la función `attachFocus` confundía `lastFrameAt` obsoleto con una sesión muerta y destruía el master válido (`Detectada sesion fisica stale/congelada`). El hotfix blinda la validación en el reingreso comprobando que, si existe un `hasValidFrame` con decodificación real > 0 en memoria y tamaño válido, la sesión subyacente de scrcpy raw NO se mutile por letargo, extendiendo al máximo el `static screen compat`.

**CONTROL-FOCUS-11: VALIDADO COMPLETO**
- **Estado:** Cerrado y sellado exitosamente.
- **Validaciones Confirmadas:**
  - `H.264 Focus .11` permanece estable con tolerancia a hardware rebelde.
  - Compatibilidad certificada con pantallas estáticas/event-driven en capa de video y control.
  - `controlEnabled` sobrevive a letargos prolongados (15-20s sin movimiento visual) reteniendo su capacidad de fuego.
  - Interacciones táctiles (`Tap`, `Live touch / drag`, `Back`, `Home`, `Recents`) ejecutadas sobre la UI de Focus se propagan exitosamente al hardware.
  - Enrutamiento impecable: `activeSerial` rutea control mediante el ID físico puro (`192.168.1.11:5555`), mientras que `focusKey` mantiene el pipeline visual en el alias (`192.168.1.11:5555|eco`).
  - El Backend de control (scrcpy_control) procesa todo sin recurrir al fallback ADB.
- **Acuerdo Arquitectónico:** Queda terminantemente prohibido aplicar nuevos hotfixes sobre H.264 o control Focus `.11`. La arquitectura ha alcanzado su estado del arte operativo.

**HOTFIX CONTROL-FOCUS-STATIC-FRAME-COMPAT-03:**
- **Estado:** Implementado (Frontend Control - Arquitectura H.264 estática).
- **Archivos tocados:** `flow-touch.js`.
- **Restore point:** `restore_points/2026-06-13_PRE_CONTROL_FOCUS_STATIC_FRAME_COMPAT_03`.
- **Propósito:** `CONTROL-FOCUS-STATIC-FRAME-COMPAT-02` corrigió `decodedCount`, pero quedó incompleto porque `stats` H.264 solo se sintetizaba cuando `isStreamAdvancing` era true. Esto causaba auto-disarm en pantallas estáticas debido a objeto nulo. `CONTROL-FOCUS-STATIC-FRAME-COMPAT-03` corrige eso separando `hasH264ValidFrame` de `isStreamAdvancing`. Ahora se retiene y sintetiza el `stats` con `ageMs` orgánico siempre que exista un frame válido en el buffer, desacoplándolo del mutador visual.

**HOTFIX CONTROL-FOCUS-STATIC-FRAME-COMPAT-02:**
- **Estado:** Implementado (Frontend Control - Fix Semántico).
- **Archivos tocados:** `flow-touch.js`.
- **Restore point:** `restore_points/2026-06-13_PRE_CONTROL_FOCUS_STATIC_FRAME_COMPAT_02`.
- **Propósito:** Corrección sintáctica sobre el HOTFIX 01. En el objeto sintetizado que recibe `_refreshFrameState`, la propiedad de *frames* decodificados se expone bajo la clave `count` (no `framesDecoded` como en el stats primario del socket). Al corregir la heurística por `const decodedCount = Number(stats?.framesDecoded ?? stats?.count ?? 0)`, evitamos que `hasValidFrame` sea permanentemente `false` y garantizamos la sobrevivencia del control táctil durante apagones event-driven de frames.

**HOTFIX CONTROL-FOCUS-STATIC-FRAME-COMPAT-01:**
- **Estado:** Implementado (Frontend Control).
- **Archivos tocados:** `flow-touch.js`.
- **Restore point:** `restore_points/2026-06-13_PRE_CONTROL_FOCUS_STATIC_FRAME_COMPAT_01`.
- **Propósito:** Evitar que la capa de interacción táctil (`FlowTouch`) se desactive automáticamente (disarm) cuando Scrcpy detiene el flujo de frames en pantallas estáticas. Previamente, `flow-touch.js` sumaba strikes y mataba la conexión si `ageMs` superaba los 8000ms. Se ha integrado la lógica `isActuallyFrameDead` para que solo se desarme el control si `framesDecoded === 0` o el `canvas` pierde sus dimensiones genuinas, extendiendo la compatibilidad del stream *event-driven* a la capa Input.

**HOTFIX H264-WATCHDOG-STATIC-SCREEN-COMPAT-01:**
- **Estado:** Implementado (Frontend).
- **Archivos tocados:** `stream-renderer-h264.js`.
- **Restore point:** `restore_points/2026-06-12_PRE_H264_STATIC_SCREEN_OR_RAW_STABILITY`.
- **Propósito:** Compatibilizar el Watchdog con el comportamiento *event-driven* de scrcpy, donde una pantalla inerte no genera nuevos bytes ni NAL units. El watchdog original castigaba la falta de nuevos frames a los 10 segundos asumiéndolo un stream zombie. La nueva heurística respeta la vida del stream de inmediato si detecta al menos un frame válido decodificado (`framesDecoded > 0 && lastFrameAt > 0`); dejando la purga y resurrección del master limitada únicamente para los casos reales donde el primer frame nunca llegó (arranque en frío averiado).

**HOTFIX H264-BACKEND-ZERO-FRAME-TRACE-01:**
- **Estado:** Implementado (Instrumentación).
- **Archivos tocados:** `scrcpy_raw_streamer.py`, `scrcpy_raw_ws_server.py`.
- **Restore point:** `restore_points/2026-06-11_PRE_HOTFIX_H264_BACKEND_ZERO_FRAME_TRACE`.
- **Propósito:** Sembrar `logger.info("[H264-BACKEND] ...")` en todos los puntos críticos del ciclo de vida del backend para responder a la incógnita de la "cámara anecoica" que ocurre en el restart de .11: la sesión TCP se crea, el WebSocket conecta, pero el video (los NAL units) jamás llega. Al leer el output Python tras el próximo fallo, sabremos empíricamente si scrcpy está entregando solo 28 bytes de cabecera y abortando (posible contención de MediaCodec), si colapsa con exit_code y stderr (error interno), o si simplemente se queda atrapado en el socket esperando el display de Android.

**HOTFIX H264-WATCHDOG-RETRY-STATE-AND-BACKEND-TRACE-01:**
- **Estado:** Implementado.
- **Archivos tocados:** `stream-renderer-h264.js`.
- **Restore point:** `restore_points/2026-06-11_PRE_HOTFIX_H264_WATCHDOG_RETRY_STATE_BACKEND_TRACE`.
- **Propósito:** Resolver el amnesia del Watchdog... (ver historial).

**HOTFIX H264-MOTION-CORRUPTION-FIX-01:**
- **Estado:** Implementado (Fase Diagnóstico y Micro-Fix).
- **Archivos tocados:** `stream-renderer-h264.js`.
- **Restore point:** `restore_points/2026-06-13_PRE_H264_MOTION_CORRUPTION_FIX_01_stream_renderer.js`.
- **Propósito:** Eliminar el temporizador destructivo `_flushTimeout` (50ms) del parser de NALUs en el frontend. Soluciona el problema de "corrupción dinámica por movimiento" (smearing/artefactos) que ocurría al hacer un swipe rápido. Al permitir que P-frames grandes se ensamblen pacientemente sin ser inyectados rotos al VideoDecoder, se restaura la integridad de la imagen manteniendo la latencia nativa de scrcpy.


**HOTFIX H264-STREAM-ADVANCING-WATCHDOG-01:**
- **Estado:** Implementado.
- **Archivos tocados:** `stream-renderer-h264.js`.
- **Restore point:** `restore_points/2026-06-11_PRE_HOTFIX_H264_STREAM_ADVANCING_WATCHDOG`.
- **Propósito:** El watchdog ya no se engaña con sesiones zombis que portan frames oxidados (`framesDecoded > 0` pero congelados). Ahora usa un `baselineFrames` inicial y exige pruebas periciales de vida continua: progreso matemático en `_framesDecoded` o variación genuina en `_lastFrameAt` con frescura temporal (`freshFrame`). Si pasados 10s el stream falla esta prueba, el watchdog ejecuta un barrido estricto de master y aliases, repitiendo el ciclo hasta 3 veces de forma controlada y transparente mediante logs granulares.

**HOTFIX H264-FIRST-FRAME-WATCHDOG-01:**
- **Estado:** Implementado.
- **Archivos tocados:** `stream-renderer-h264.js`.
- **Restore point:** `restore_points/2026-06-11_PRE_HOTFIX_H264_FIRST_FRAME_WATCHDOG`.
- **Propósito:** Activar un vigilante activo (`_watchdogs`) cada vez que Focus se adjunta al master físico. Si el WebSocket se reporta OPEN pero transcurre la ventana de gracia (10s) y los `_framesDecoded` continúan en 0 (zombi de nacimiento post-reinicio), el watchdog ejecuta un barrido automático: limpia los aliases, extermina la sesión física actual, genera un master fresco e inyecta los canvases salvados; garantizando que la UI nunca se quede en un bucle ciego de "Cargando stream..." por un master silenciado. Permite 3 intentos máximos para proteger contra bucles infinitos.

**HOTFIX H264-MASTER-STALE-RECOVERY-01:**
- **Estado:** Implementado.
- **Archivos tocados:** `stream-renderer-h264.js`.
- **Restore point:** `restore_points/2026-06-11_PRE_HOTFIX_H264_MASTER_STALE_RECOVERY`.
- **Propósito:** Detectar y purgar sesiones físicas "zombies" (stale) en el frontend. Ahora `isSessionAlive(session)` evalúa no solo la existencia del WebSocket, sino que exige vida útil en `_framesDecoded` y frescura en `_lastFrameAt` (< 8000 ms), o tiempo de gracia < 10000 ms durante el arranque (`_openedAt`). Si un teléfono se reconecta y su Grid quedó atascado (congelado en N frames), cuando Focus llama a `attachFocus`, la sesión zombi es purgada y limpiada, creándose una sesión limpia (fresca) sobre la que Focus se adjunta y recupera el H.264 vivo sin que el Loader espere el "stale" infinitamente.

**HOTFIX H264-FOCUS-ATTACH-LIFECYCLE-CONTROL-UI-01:**
- **Estado:** Estabilizado.
- **Archivos tocados:** `stream-renderer-h264.js`, `flow-touch.js`.
- **Restore point:** `restore_points/2026-06-11_PRE_HOTFIX_H264_FOCUS_LIFECYCLE_CONTROL_UI`.
- **Propósito:** 
  1. **Lifecycle/Alias H.264:** Refinada la función `attachFocus` para que, si el Dashboard arranca de cero y Focus se abre *antes* que Grid, se construya inmediatamente el pipeline físico `serial` (ej: `.11`) y luego se haga el alias `serial|eco`, garantizando que cuando Grid despierte, re-utilice ese mismo pipeline físico en lugar de generar colisiones (no más pantalla negra al reiniciar Dashboard).
  2. **Control táctil:** Confirmado por código que `FlowTouchCommandRouter.tap/swipe/keyevent` siempre inyectan el `activeSerial` físico (`192.168.1.11:5555`) hacia los endpoints `/control/*` y nunca envían los alias como `|eco`.
  3. **Layout visual:** Retirado el aspecto dinámico inyectado en un parche anterior (`aspectRatio = width/height`) que corrompía la cascada CSS y causaba que el canvas colapsara, deformando Focus y rompiendo el mapeo de coordenadas del puntero. Focus vuelve a estar 100% centrado y usable.

**HOTFIX H264-FOCUS-ATTACH-EXISTING-PIPELINE-01:**
- **Estado:** Implementado (Frontend).
- **Archivos tocados:** `stream-renderer-h264.js`, `flow-touch.js`.
- **Restore point:** `restore_points/2026-06-11_PRE_HOTFIX_H264_FOCUS_ATTACH_EXISTING_PIPELINE`.
- **Propósito:** Evitar la colisión de capturas de pantalla/encoder MediaCodec en Android por abrir scrcpy múltiples veces para el mismo dispositivo. Ahora `attachFocus` localiza si el Grid tiene una sesión viva para el `serial` físico, se adosa a ese stream H.264 (en vez de pedir `|eco` y colgar Android), registra un alias para que `getStats` funcione transparente y `detachFocus` desasocia limpiamente el canvas sin matar el WebSockets general si todavía queda en uso. Adicionalmente, el loader ahora se oculta de forma certera validando `isStreamAdvancing` (`framesDecoded > 0` y progresión de `lastFrameAt`).

**H264-BACKEND-PUMP-01:**
- **Estado:** Instrumentación inyectada (diagnóstico).
- **Archivos tocados:** `scrcpy_raw_streamer.py`, `scrcpy_raw_ws_server.py`.
- **Restore point:** `restore_points/2026-06-11_PRE_HOTFIX_H264_BACKEND_PUMP_DIAG`.
- **Propósito:** Confirmar si el stream H.264 RAW desde el scrcpy process nativo en Android (via socket abstracto) emite más allá de los primeros 28 bytes hacia el backend en Python, si `stale_sessions` está cerrando incorrectamente procesos al concurrir Grid y Focus, y si WebSocket transmite la data en tiempo real. 
- **Acciones:** Validada compilación, se reinicia el server `local_adb_server.py` suavemente esperando las pruebas locales de DevTools.

**HOTFIX UI-FOCUS-COORDINATE-MAPPER-NULL-01:**
- **Causa raíz real:** En `flow-touch.js`, `CoordinateMapper.fromPointerEvent` era llamado al pasar el mouse por el canvas del Focus. Cuando el decodificador H.264 aún no emitía su primer frame, `this._getFrameSize()` devolvía `null`. El mapper intentaba acceder a `frameSize.width`, rompiendo toda la cola de eventos y saturando el navegador con un `TypeError: Cannot read properties of null` antes de que el stream pudiera arrancar.
- **Archivo tocado:** `electron-app/src/renderer/flow-touch.js`
- **Restore point:** `restore_points/2026-06-11_PRE_HOTFIX_UI_FOCUS_COORDINATE_MAPPER_NULL`
- **Validaciones ejecutadas:** 
  - Comprobación de sintaxis estricta JS `node --check` superada para flow-touch.js y dependencias.
- **Resultado Grid / Focus:** Parche estético aplicado. Queda habilitado el usuario para ejecutar la validación técnica final en H.264 sobre DevTools sin que los logs se ahoguen.

**HOTFIX H264-IDR-RUNTIME-02:**
- **Causa raíz real:** Fragmentación de paquetes TCP en el socket RAW crudo del websocket. Los NALUs de H.264 grandes (IDRs de alta calidad o P-frames con mucho movimiento) se escindían en varios mensajes de WebSockets (WS). Al recibir el primer fragmento, `splitNalus()` cortaba un frame incompleto al terminarse el buffer y lo arrojaba a WebCodecs, resultando en corrupción en el motor del Chromium, el cual se silenciaba (`0 fps`). El último frame del stream además se estancaba en el buffer indefinidamente si la pantalla del teléfono dejaba de cambiar (ausencia de próximo start-code).
- **Archivo tocado:** `electron-app/src/renderer/stream-renderer-h264.js`
- **Restore point:** `restore_points/2026-06-11_PRE_HOTFIX_H264_RESIDUE_RINGBUFFER`
- **Validaciones ejecutadas:** 
  - Comprobación de sintaxis estricta JS `node --check` superada para renderer y touch.
- **Resultado Grid / Focus y Pendientes:** Queda en manos del usuario correr el script de DevTools (`h264Dump`) para confirmar que los FPS suben y sostienen por encima de 0, destrabando la transmisión en Grid y Focus al fin.

**HOTFIX CONTROL-VALIDATE-SERIAL-01:**
- **Causa raíz:** En la iteración anterior, aunque se reabrieron las rutas POST, `_validate_serial()` usaba una validación restrictiva a `d["serial"]` exacto contra el body, en un diccionario desactualizado. Con la FASE 8B multi-transporte, `/devices` provee las entidades unificadas de dispositivos y la caché no coincidía con el nuevo formato semántico, resultando en 404 por dispositivo no hallado a pesar de que ADB sí lo reconocía.
- **Archivo tocado:** `local_adb_server.py`
- **Solución:** Se integró la pseudológica `_resolve_serial(requested, devices)`. Ahora valida el serial contra el array histórico de transportes (`activeSerial`, `physicalDeviceId`, y lista interna de transportes). Si el serial no figura en caché, hace un trigger a `list_devices()` forzando la renovación antes del error 404.
- **Validaciones ejecutadas:** 
  - `POST /control/tap`: Retornó `HTTP 200 OK` con method `scrcpy_control` y latency 920ms en dispositivo test 192.168.1.11.
  - `POST /control/keyevent`: Retornó `HTTP 400 Bad Request` indicando "name debe ser back, home o recents". Esto es un error de semántica de key del test (`"key":"BACK"`) y **confirma que el serial ya pasó la barrera del 404 sin problemas**.


**HOTFIX H264-LIVE-STREAM-01:**
- **Causa raíz:** En `stream-renderer-h264.js`, el `VideoDecoder` se configuraba correctamente tras recibir SPS/PPS, pero se omitía instruir al flujo que descartara los NALs subsecuentes (deltas) hasta no recibir el primer Keyframe (IDR). Esto causaba que el decoder fallara con `A key frame is required` en un loop infinito de reset.
- **Archivo tocado:** `electron-app/src/renderer/stream-renderer-h264.js`
- **Solución:** Se añadió `this._waitingKeyframe = true;` dentro de `_configureDecoder()` tras finalizar la configuración.
- **Validaciones ejecutadas:** 
  - `node --check` validado sin errores.
  - Test de DevTools (H.264 Grid/Focus) pendiente de que el usuario verifique con el streaming visual.

**HOTFIX CONTROL-ENDPOINTS-404-01:**
- **Causa raíz:** Los endpoints `/control/tap` y `/control/keyevent` devolvían código 404 porque el lanzador `abrir_electron.ps1` detectaba `8765/health` y dejaba en memoria un proceso `local_adb_server.py` antiguo, obsoleto ("stale"), que no contenía las rutas de control recién escritas. Además, cuando el servidor sí cuenta con los endpoints, se arrojaba otro tipo de 404 semántico (`Dispositivo no encontrado o no conectado`) si la IP enviada por Invoke-RestMethod no figuraba en `adb devices`.
- **Acciones tomadas:** 
  - Se localizó el proceso específico de python.exe asociado a `local_adb_server.py` y se detuvo selectivamente sin afectar a todo el sistema.
  - Se confirmó que los puertos 8765 y 8768 quedaron libres.
  - Se inició `abrir_electron.bat` limpio.
- **Validaciones ejecutadas:** 
  - `Invoke-RestMethod` sobre endpoints `/control/tap` y `/control/keyevent` arrojando un JSON estructurado desde el motor con `{"error": "Dispositivo no encontrado o no conectado"}`. Esto confirma que el endpoint **ya no es un 404 del ruteador HTTP**, sino del validador de `_validate_serial()`.
  - El servidor Python y el script compilan (`python -m py_compile`).

**Puntos Generales:**
- **Restore point usado:** `restore_points/2026-06-11_PRE_HOTFIX_H264_CONTROL_RUNTIME`
- **Qué quedó pendiente/no verificado:** La validación visual del grid de UI (framesDecoded subiendo, fps > 0 sostenido y lastFrameAt cambiando) y la validación en dispositivo físico de los endpoints de control requieren prueba manual con un ADB device conectado.

## ESTADO ACTUAL - FASE UI-FOCUS-01 (Limpieza Focus Mode & Fix Grabación) - 2026-06-10

**Estado Oficial:** `UI-FOCUS-01 cerrada: Focus Mode limpio + grabación manual MP4 validada desde UI`.

**Cerrado y Comprobado:**
- **Backend Grabación (Variante G):** Modificado `local_adb_server.py` para grabar mediante `STARTUPINFO` `SW_HIDE` (sin ventana, sin `--no-window`). La detención se maneja con `taskkill /PID <pid>` enviando la señal suave `WM_CLOSE`, lo que permite vaciar el archivo y escribir el vital átomo `moov`.
- **Integridad MP4:** Si no se halla `moov` con `_check_mp4_validity()`, el backend reporta grabación corrupta, evitando falsos positivos. Se probó exitosamente (generó MP4 validado).
- **Control de Zombies:** Verificación de `tasklist` confirmando la ausencia de procesos huérfanos de `scrcpy`.
- **Electron IPC:** Añadidos métodos `openPath` y `showItemInFolder` a `preload.js` y `main/index.js` para abrir el MP4 y el directorio respectivo nativamente en Windows.
- **Rediseño Focus Mode:** 
  - Retirado el título redundante.
  - El layout fue transformado para albergar `Modo Limpio` por defecto.
  - El control es implícito al abrir, eliminado el gran panel "Control ON".
  - Se movieron Herramientas, Calidad, y Captura al compact sidebar izquierdo.
  - La grabación ahora dispone de cronómetro real-time y botones para accesar de inmediato a disco tras detener.
- **Sintaxis limpia:** Pasaron los chequeos de sintaxis para `app.js`, `flow-touch.js`, `index.js`, `preload.js` y `local_adb_server.py`.
- **Checkpoint generado:** `restore_points/2026-06-10_UI_FOCUS_01_RECORDING_FIXED_VALIDATED`.

*(Nota: La Fase 8C permanece en pausa hasta que el operador valide manualmente en el Dashboard la Fase UI-FOCUS-01 y las conexiones físicas USB)*

## ESTADO ACTUAL - FASE 8B (Identidad Física y Transportes ADB) - 2026-06-10
**Estado Oficial:** `Fase 8B aprobada en código + validada en WiFi real + pendiente validación física USB/USB+WiFi por operador humano`.

**Cerrado y Comprobado:**
- **Sintaxis limpia:** Validación exitosa de `local_adb_server.py` y `electron-app/src/renderer/app.js` (`python -m py_compile` y `node --check`).
- **Validación real WiFi:** 
  - El sistema extrae correctamente `/devices` para 17 dispositivos WiFi en hardware vivo actual.
  - `activeSerial` apunta correctamente a `ip:5555`.
  - El array de `transports` se llena de forma confiable.
  - `preferredTransport`, `person` y `accountStatuses` persisten correctamente al reiniciar sin borrarse.
  - El backend mantiene intactos los perfiles de control (Live Touch, Dummy Byte, OCR, Recording, MediaProjection).
- **Validación lógica:** 
  - Entornos `unauthorized/offline` saltan la inyección de la shell ADB, previniendo bloqueos del dashboard.
  - La estructura está preparada e hidratada nativamente para multi-transporte (USB + WiFi).
  - La retrocompatibilidad Frontend (`serial = activeSerial`) está consolidada.
- **Diagnóstico UI Integrado:** Se introdujo un Badge visual UI en el grid de dispositivos (`USB|WiFi|USB+WiFi` + `Pref: Auto|USB|WiFi`). Además, un *tooltip diagnóstico visible por hover* entrega `deviceId`, `activeSerial` y los transportes reales asociados sin afectar a la lógica de control.

**Pendiente para validación futura con acceso físico a cable USB:**
- [ ] Probar conexión de un dispositivo *Solo USB*.
- [ ] Probar conexión *Solo USB* cuando el dispositivo esté *Unauthorized*.
- [ ] Probar conexión de *USB + WiFi* en el mismo teléfono.
- [ ] Probar cambio manual *Auto / USB / WiFi* desde la UI con ambos transportes conectados.
- [ ] Confirmar funcionalidad de hardware final de *tap, swipe, Back, Home, Recents* sobre USB y sobre la elección WiFi de manera intercambiada.

*(Nota: La Fase 8C permanece en pausa absoluta hasta consumar el checklist de validación USB física).*

## ULTIMOS CAMBIOS (2026-06-10) - Recuperación de Routing Control / NameError Fix

**Incidente de Control UI Roto:**
- Durante el intento inicial de fallback a ADB, el dashboard Electron perdió totalmente la capacidad de controlar los dispositivos (taps, swipes, botones laterales sin efecto).
- Se diagnosticó que la causa no fue scrcpy ni adb, sino un `500 Internal Server Error` devuelto por el backend Python (`NameError: name 'sys' is not defined`), el cual fallaba silenciosamente en el cliente.
- Este error fue introducido al intentar verificar la constante `CONTROL_SAFE_MODE_ADB` usando `sys.modules` sin haber importado `sys`.

**Solución Implementada:**
- Se corrigió el backend (`local_adb_server.py`) usando `globals().get("CONTROL_SAFE_MODE_ADB", False)`.
- Se implementó la función de routing definitivo `should_force_adb(serial, prefer_scrcpy)`:
  - Motor por defecto: `scrcpy_control`
  - Fallback programado: `adb_input`
  - Excepciones serializadas (`CONTROL_ADB_ONLY_SERIALS`): Actualmente vacía (Ningún dispositivo bloqueado).
- Los endpoints `/control/tap`, `/control/swipe`, y `/control/keyevent` ahora devuelven correctamente el JSON esperado con `method`, `fallbackUsed` y `routingReason` (ej. `serial_adb_only`, `safe_mode_adb`, `preferScrcpy_false`).

**Validación y Pasos Siguientes:**
- Validado a nivel backend con pruebas HTTP exitosas (`200 OK`) usando los motores adecuados por cada caso.
- **`.48` Recuperado Oficialmente:** Se comprobó que el problema de `scrcpy_control` en `.48` se debía al fallo del handshake (dummy byte) en Python, no al dispositivo físico. `.48` fue recuperado totalmente, funciona con Live Touch de manera fluida y fue eliminado de la lista de excepciones `CONTROL_ADB_ONLY_SERIALS`.
- **Nuevo estado oficial:** Control Manual nativo recuperado y validado con `scrcpy_control` + Live Touch en `.44`, `.45`, `.48` y `.53`. ADB queda como fallback, no como motor principal.

## ULTIMOS CAMBIOS (2026-06-10) - Validación Canario FASE 5 scrcpy-control

**Alcance:**
- Se ejecutó la Fase 5 de validación en el dispositivo canario `.43` (Android 9) comprobando la integración estricta de `scrcpy-control` como motor principal para el perfil `control`.
- No se hizo despliegue masivo en la flota. Las pruebas fueron focalizadas y sin afectar los scripts de los demás 16 teléfonos.

**Resultados de Validación:**
- **Control Puro:** Los endpoints `/control/tap`, `/control/swipe`, y `/control/keyevent` inyectan eventos por `scrcpy_control` con latencias de entre 200ms y 500ms usando inyección binaria veloz en el proceso local del servidor Python, todo sin encender `MediaProjection`.
- **Fallback Estructural:** Al inhabilitar scrcpy temporalmente (`preferScrcpy=false`), el sistema rutéo transparentemente hacia `adb_input` con latencias alrededor de 400-800ms.
- **Onboarding Silencioso:** Ejecutar `/flowagent/setup-smart` en un entorno fresco instaló `agent-v1.0.0-universal.apk` sin levantar íconos de captura y sin encender `MediaProjection`.
- **Automatización vs Control:** El agente socket (`FlowAgent / Automation`) probó mantener viva su Accesibilidad y socket independientemente. Las inyecciones manuales no usaron a FlowAgent como fallback, respetando la arquitectura de perfiles separados.
- **Inspector y OCR:** `/inspector/dump` funcionó vía UIAutomator sin pedir captura. OCR explícito: `[!] No verificado completo en FASE 5`. Se verificó que solo se solicita MediaProjection al pedir OCR explícitamente (`/flowagent/ocr-detect`). No se validó reconocimiento OCR completo porque no se aceptó el diálogo manual. No quedó MediaProjection activa. Pendiente prueba OCR completa con aceptación manual y `capture_screen_stop`.
- **Recording:** `[!] Recording pendiente / no operativo real en .43 por fallo de encoder/scrcpy record-only.` Se probó a nivel CLI y backend, pero produce un archivo corrupto. No bloquea el Control.
- **Fugas / Huérfanos:** `/control/scrcpy-sessions` arrojó permanentemente 1 sesión vinculada a `.43` sin leaks tras múltiples taps y reinicios del servidor C# y Python.

**Documentos Actualizados:**
- `reports/fase4_implementation_results.md`
- `reports/fase5_canary_validation.md`
- `TASKS_MONOLITO_PRO.md` (Fase 4, Fase 5 y Fase 6 completadas).

## Cierre consolidación Control `.43` — 2026-06-10

- Control validado en `.43`.
- Motor principal: `scrcpy-control`.
- Fallback: `adb_input`.
- FlowAgent separado para Automation.
- MediaProjection no se activa en Control/Grid/Focus.
- Onboarding FlowAgent no contamina Control.
- OCR y Recording quedan pendientes.
- No se desplegó en flota.

## Excepción `.48` — scrcpy_control silent failure (2026-06-10) [RECUPERADO]

- Tras pruebas directas de inyección en `192.168.1.48:5555`, se confirmó que el silent failure provenía de un bug de sincronización del socket en la capa Python (dummy byte missing), NO del dispositivo físico.
- Al reparar el handshake de `scrcpy_control`, `.48` responde perfectamente y con fluidez usando Live Touch.
- **Acción:** Eliminado de `CONTROL_ADB_ONLY_SERIALS`. Ya no se considera una excepción de hardware o Android.

## Rollout 1 Control — `.53` aprobado (2026-06-10)

- Rollout 1 ejecutado con éxito en un solo dispositivo adicional (`192.168.1.53:5555`).
- Control puro, fallback y limpieza validados sin activar FlowAgent ni MediaProjection.
- **Nota sobre `.44`:** Queda marcado como pendiente de limpieza y diagnóstico por presentar un `MediaProjection` sucio antes de las pruebas. No será usado como canario hasta ser purgado.

## Escalabilidad comercial y descubrimiento dinámico de dispositivos

- `.43-.60` es solo el rack local de pruebas de Esteban.
- El producto final debe funcionar con cualquier cantidad de teléfonos.
- Los dispositivos pueden conectarse por USB o WiFi.
- Los rangos de red deben ser configurables.
- Los dispositivos offline son estados temporales, no fallos.
- Los perfiles deben asignarse dinámicamente por serial detectado.
- No debe haber lógica comercial hardcodeada a `192.168.1.x`.
- No debe decirse que `.54-.60` están fuera del producto, solo fuera de esta sesión de validación local.

## Tareas recomendadas (Backlog) para el sistema de descubrimiento:
- Implementar Discovery dinámico con `adb devices`.
- Añadir botón "Escanear red" en la UI con rango configurable (`192.168.1.1-254`, etc.) sin bloquear la UI principal.
- Clasificar dinámicamente los dispositivos: `online`, `offline`, `unauthorized`, `connected via USB`, `connected via WiFi`.
- Guardar los perfiles (`control/automation/inspector`) por serial real en un storage persistente, no por IP.
- Añadir opciones en la UI para olvidar dispositivos viejos y reintentar conexión individual/masiva.
**Prevalece sobre la nota inmediatamente anterior que decia que faltaba `informacion de scrcpy/`:** la carpeta ya existe y se leyo documentacion local oficial de scrcpy antes de tocar recording.

**Documentacion local scrcpy revisada:**
- `informacion de scrcpy/doc/develop.md`: scrcpy usa servidor en Android y cliente PC; video/audio/control son sockets separados. El modo raw standalone admite `raw_stream=true` y el protocolo de control es interno.
- `informacion de scrcpy/doc/control.md`: control-only existe con `scrcpy --no-video --no-audio`, pero integrar el socket de control requiere implementar el protocolo binario interno. El stream raw actual del dashboard arranca con `control=false`, asi que Focus mantiene control manual por endpoints ADB `/control/*` en esta fase.
- `informacion de scrcpy/doc/recording.md`: grabacion en PC con `--record`, opcional `--no-audio`, `--no-playback`, `--no-control`, `--no-window`. No usa MediaProjection ni FlowAgent.
- `informacion de scrcpy/doc/video.md`: se validaron `--max-size`, `--max-fps`, `--video-bit-rate`.
- `informacion de scrcpy/doc/connection.md`: se valido seleccion de dispositivo con `--serial`.
- `informacion de scrcpy/doc/tunnels.md`: se reviso el contexto de tuneles ADB; no hizo falta cambiar el stream raw.

**Cambios nuevos:**
- Restore point creado: `restore_points/2026-06-09_SCRCPY_DOCS_RECORDING_REDO`.
- `local_adb_server.py` agrega feature `scrcpy_manual_recording` y endpoints:
  - `GET /recordings/active`
  - `POST /recordings/status`
  - `POST /recordings/start`
  - `POST /recordings/stop`
  - `POST /recordings/stop-all`
- La grabacion usa `scrcpy.exe --serial <serial> --no-audio --no-window --no-playback --no-control --record <mp4> --max-size 1080 --max-fps 30 --video-bit-rate 4M`.
- Los MP4 se guardan en `recordings/<serial_sanitizado>/flowrecord_<serial>_<timestamp>.mp4`.
- `electron-app/src/renderer/flow-touch.js` agrega boton compacto Grabar/Detener en Focus. Es accion manual: abrir/cerrar Focus no inicia ni detiene grabacion por si solo.
- `electron-app/src/renderer/styles.css` agrega estado visual `is-recording`.

**Limites/seguridad mantenidos:**
- No se hizo despliegue masivo, instalacion APK ni preparacion de FlowAgent.
- Grid/Focus/control manual siguen sin iniciar FlowAgent, Accesibilidad, MediaProjection, OCR ni OpenCV.
- Prioridad futura para control manual: buscar e implementar primero control nativo de scrcpy usando documentacion real/local y/o codigo fuente oficial de scrcpy como referencia. Debe hacerse con mucho cuidado: restore point, pruebas aisladas, prueba canario en `.43`, validacion de coordenadas/rotacion/multidispositivo y sin romper Grid/Focus ni el stream raw actual.
- ADB input `/control/*` queda como fallback seguro para taps, swipes y Back/Home/Recents si el canal nativo scrcpy falla, no esta disponible o no pasa pruebas.
- El canal de control nativo de scrcpy requiere cliente del protocolo interno; no se debe activar a ciegas ni mezclar con el stream raw actual sin pruebas minuciosas.
- Screenshot manual queda sin cambio funcional en esta pasada; `/screen-snapshot/<serial>` ya existe como ADB screencap puntual y no usa MediaProjection continua.

## ULTIMOS CAMBIOS (2026-06-09) - Canario .43 scrcpy-control + perfiles

**Alcance:**
- Se reinicio el backend Python local porque habia tres procesos Python sirviendo `8765/8766`; quedo una sola instancia con `operation_profiles`, `scrcpy_manual_recording` y `scrcpy_control_first_adb_fallback`.
- No se hizo despliegue masivo, instalacion APK ni setup de FlowAgent en flota. Todas las pruebas funcionales fueron sobre `192.168.1.43:5555`.

**Validacion control:**
- `/control/keyevent` con `name=back` uso canal nativo `scrcpy_control` y creo sesion `scrcpy-control` para `.43` con pantalla `1080x1920`.
- Fallback ADB verificado con `preferScrcpy=false`: `/control/keyevent home`, `/control/tap` y `/control/swipe` respondieron `method=adb_input`.
- Se observo que las rutas `/control/*` dependen de la cache de `/devices`; tras reiniciar backend conviene refrescar `/devices` antes de enviar control.

**Perfiles verificados:**
- `control`: opera por scrcpy-control/ADB y no requiere FlowAgent, Accesibilidad, OCR ni MediaProjection.
- `automation`: `engine_probe` en `.43` por socket existente devolvio `ok=true`, `engine=autojs`, `serviceReady=true`, `serviceClass=AccessibilityServiceUsher`.
- `inspector`: `/inspector/native-detect` y `/inspector/auto-detect` eligieron `uiautomator` y devolvieron nodos sin OCR/MediaProjection.
- `ocr`: `/flowagent/ocr-detect` funciono como accion explicita y devolvio texto/bloques; luego se ejecuto `capture_screen_stop` y respondio `ok=true`.
- `recording`: endpoints start/status/stop funcionan a nivel de proceso, pero el canario `.43` produjo MP4 de 48 bytes. Una prueba CLI directa de scrcpy con `--record` y `--time-limit=6` tambien quedo en 48 bytes y scrcpy termino con codigo `-1073741819`, por lo que el fallo no parece del endpoint sino de scrcpy record-only/encoder en este entorno/dispositivo. Queda pendiente investigar antes de marcar grabacion manual como operativa real.

**Cambios de codigo aplicados en esta pasada:**
- `local_adb_server.py` importa `signal`.
- La grabacion manual ahora arranca scrcpy en un process group propio en Windows, guarda stdout/stderr en un `.log` junto al MP4 y al detener intenta `CTRL_BREAK_EVENT` antes de `terminate/kill`.
- Se ajusto el stop para esperar despues de `kill()` y cerrar handles de log tambien cuando una grabacion queda stale.

**Artefactos de validacion:**
- Screenshot manual OK: `reports/manual_snapshot_192_168_1_43_2026-06-09.png` generado por `/screen-snapshot/192.168.1.43:5555` (ADB screencap puntual).
- Logs de grabacion scrcpy quedan junto a los MP4 en `recordings/192.168.1.43_5555/`.

**Validaciones locales:**
- `python -m py_compile local_adb_server.py scrcpy_control_channel.py` OK.
- `node --check electron-app/src/renderer/flow-touch.js` OK.
- `node --check electron-app/src/renderer/app.js` OK.

## ULTIMOS CAMBIOS (2026-06-09) - Perfiles CONTROL / AUTOMATION / INSPECTION

**Objetivo:**
- Separar formalmente los perfiles operativos para que el dashboard no prepare funciones sensibles al abrir Electron, Grid, Focus o control manual.
- No se hizo despliegue masivo ni instalacion de APKs.

**Perfiles definidos:**
- `control`: ADB + scrcpy raw H.264 para Grid/Focus, taps, swipes, Back/Home/Recents y control manual. No activa FlowAgent, Accesibilidad, MediaProjection, OCR, OpenCV ni captura interna.
- `automation`: FlowLogin, scripts JS, click por texto, set_text, dumps inteligentes y FlowKeyboard. Usa FlowAgent socket + AutoJs6 + AccessibilityServiceUsher + FlowKeyboard solo por accion explicita.
- `inspector`: Tree/Nativo/Auto usa primero UIAutomator por ADB, luego CDP/Accessibility si estan disponibles. No usa OCR por defecto.
- `ocr`: OCR/OpenCV/template matching pueden llamar `capture_screen_start(streamFrames=false)` solo en ese momento.
- `recording`: implementado como accion manual con scrcpy/H.264 guardado en PC, sin MediaProjection por defecto.

**Cambios de codigo:**
- `local_adb_server.py`:
  - Agrega `OPERATION_PROFILES` y feature `operation_profiles`.
  - Agrega endpoints de control manual por ADB: `/control/tap`, `/control/swipe`, `/control/keyevent`.
  - `/flowagent/setup-smart` ahora usa `requestCapture=false` por defecto.
  - `inspector_auto_detect(...)` ya no incluye `screencap_ocr`; Auto no puede pedir captura/OCR.
  - El backend ya no inicia el loop legacy de auto-reconnect/relaunch de FlowAgent al arrancar.
- `electron-app/src/renderer/flow-touch.js`:
  - Taps, swipes, double tap, long press y Back/Home/Recents del Focus usan `/control/*` por ADB input.
  - Armar Control ya no consulta ni exige FlowAgent/Accesibilidad.
  - El estado de FlowAgent queda como diagnostico y no auto-desarma el control manual.
  - Inspector Tree/Hybrid consulta primero UIAutomator y luego Accessibility solo como complemento si ya esta disponible.
- `electron-app/src/renderer/app.js`:
  - La accion contextual `Instalar FlowAgent APK` envia `requestCapture:false`.
  - `setupFlowAgentAll()` usa `/flowagent/setup-smart` con `requestCapture:false`.
  - Textos de ayuda aclaran que FlowAgent no es requisito para Focus/Grid y que OCR/Hybrid son los modos que piden captura.
- `abrir_electron.ps1`:
  - Ya no lanza `.upload_tmp/setup_flowagent_completo.ps1` en background.
  - Mantiene ADB, backend C#, backend Python/socket, WS H.264 y Electron.

**Documentacion y auditoria:**
- Restore point creado: `restore_points/2026-06-09_OPERATION_PROFILES_CONTROL_AUTOMATION_INSPECTION`.
- Nota historica 2026-06-09: en esa auditoria antigua se leyeron varios documentos, incluido `DOCUMENTACION_TECNICA.md`. Desde la auditoria documental 2026-06-20 ese archivo queda legacy/prohibido y no debe usarse como fuente tecnica vigente.
- Nota historica corregida: en una pasada anterior la carpeta `informacion de scrcpy/` no estaba disponible. En la relectura del 2026-06-09 ya existe, se leyo `informacion de scrcpy/doc/` y se implemento recording manual con base en esa documentacion.
- Se detecto documentacion vieja que decia que el arranque lanzaba setup de FlowAgent/captura; el estado vigente esta en `docs/master_technical_specification.md` y en las reglas superiores de este archivo.

**Pendientes/no verificados:**
- No se probo en dispositivo `.43` en esta fase porque no se hizo arranque ni despliegue. Pendiente prueba manual: abrir Electron y confirmar que no aparece icono de MediaProjection; abrir Focus/Grid y tocar/swipe por ADB; Inspector Tree/Nativo/Auto sin captura; OCR solicita captura solo al usar OCR.
- Recording manual queda implementado con boton Grabar/Detener en Focus y endpoints `/recordings/*`; falta prueba operativa real en `.43`.
- Control manual nativo scrcpy queda como siguiente linea de trabajo: implementar primero scrcpy control y dejar ADB como fallback. Requiere estudiar documentacion/codigo real, no dañar lo actual y probar de forma minuciosa antes de reemplazar el comportamiento por defecto.
- Screenshot manual queda sin cambio funcional en esta fase; debe mantenerse por canvas/scrcpy o ADB screencap, no MediaProjection continua.

**Validaciones ejecutadas:**
- `python -m py_compile local_adb_server.py` OK.
- `node --check electron-app/src/renderer/app.js` OK.
- `node --check electron-app/src/renderer/flow-touch.js` OK.
- No se ejecuto prueba real en `.43` ni se arranco Electron durante esta fase; queda pendiente de verificacion manual/operativa.

# FlowDashboard Project Context

Ultima actualizacion: 2026-06-09

## ULTIMOS CAMBIOS (2026-06-08) - Monolito PRO Fase 7 una sola Accesibilidad

**Objetivo completado:**
- FlowAgent monolito queda operando con una sola opcion visible/bound de Accesibilidad en Android:
  - `com.flowlogin.agent/org.autojs.autojs.core.accessibility.AccessibilityServiceUsher`.
- `com.flowlogin.agent/.FlowAccessibilityService` queda deshabilitado en `AndroidManifest.xml` (`android:enabled="false"`), pero el codigo se conserva como helper/rollback interno.
- El socket ya no depende del `onServiceConnected()` del servicio legacy:
  - `AccessibilityServiceUsher.onServiceConnected()` arranca/reinicia `AgentSocketClient`.
  - `AgentSocketClient` reporta `accessibility=true` cuando AutoJs6 esta listo aunque el servicio legacy no exista.
  - El `hello` agrega diagnostico `accessibilityEngine`, `flowAccessibility` y `autoJsAccessibility`.

**Migracion de comandos al engine AutoJs6 por defecto cuando no existe legacy:**
- `AutoJsEngineProbe` ahora atiende comandos legacy sobre AutoJs6:
  - `ping`, `status`, `dump`, `tap`, `swipe`.
  - `home`, `back`, `recents`.
  - `get_edit_texts`, `click_text`, `set_text`, `set_text_index`.
  - `launch_package`, `open_app_info`.
- Las respuestas mantienen `engine=autojs`.
- `HumanInputBridge` ya puede hacer taps humanos del FlowKeyboard usando AutoJs6 si `FlowAccessibilityService` no esta activo.
- `MainActivity` queda `singleTop` para recibir intents de captura/reconexion por `onNewIntent`.

**Captura/OCR sin romper socket:**
- Se elimino definitivamente la solicitud automatica de MediaProjection al abrir `MainActivity`.
- `capture_screen_start` y `capture_screen_stop` se movieron a la ruta de socket, sin depender de `FlowAccessibilityService`.
- `ScreenCaptureThread` acepta `streamFrames`.
- Por defecto `capture_screen_start` usa `streamFrames=false`: mantiene bitmap para OCR/OpenCV, pero no inunda el socket con frames.
- Si en el futuro se quiere streaming por este canal, debe pedirse explicitamente con `streamFrames=true`; para visualizacion principal sigue recomendado scrcpy/H.264.

**Validacion canario `.43`:**
- Instalado APK final `agent-v1.0.0-arm64-v8a.apk`, versionCode 105.
- Android mostro solo `AccessibilityServiceUsher` en `enabled_accessibility_services`; no quedo `FlowAccessibilityService`.
- Socket hello: `accessibilityEngine=autojs`, `flowAccessibility=false`, `autoJsAccessibility=true`.
- Bateria socket:
  - `engine_probe`: `ok=true`, `serviceReady=true`.
  - `status`: `ok=true`, `engine=autojs`, `hasRoot=true`.
  - `dump`: `ok=true`, `engine=autojs`.
  - `get_edit_texts`: `ok=true`, `engine=autojs`.
  - `tap`/`swipe` invalidos: error JSON controlado, sin timeout.
- Scripts JS:
  - Se creo `tools/monolito_fase7_probe.js`.
  - Se subio a `/sdcard/Download/monolito_fase7_probe.js`.
  - `run_script` devolvio `ok=true` tras conceder `READ/WRITE_EXTERNAL_STORAGE`.
  - Marcador creado en el telefono: `/sdcard/Download/flow_fase7_probe.txt`.
- FlowKeyboard humano:
  - Campo real de busqueda en Settings enfocado.
  - `/flowkeyboard/type-human` escribio `Fase7 OK 43`.
  - Resultado: `charsTyped=11`, `charsFallback=0`.
  - Dump AutoJs6 confirmo el texto en el `EditText`.
- OCR:
  - `capture_screen_start` pidio permiso explicitamente.
  - Se acepto `Start now` en `.43`.
  - `ocr_detect` devolvio `ok=true` con texto reconocido de la pantalla FlowAgent.
  - `capture_screen_stop` devolvio `ok=true`.

**Despliegue flota completa:**
- APK final instalado con `Success` en 17/17 dispositivos.
- En 17/17 se forzo:
  - `enabled_accessibility_services=com.flowlogin.agent/org.autojs.autojs.core.accessibility.AccessibilityServiceUsher`.
  - `accessibility_enabled=1`.
  - `FlowKeyboardService` habilitado y seleccionado.
  - permisos `READ_EXTERNAL_STORAGE` y `WRITE_EXTERNAL_STORAGE` para scripts en Android 9.
  - `adb reverse` para `8766`, `8765`, `5000`.
  - relanzamiento de `MainActivity` con `host=127.0.0.1`, `serial=<serial>`, `port=8766`, `autoconnect=true`.
- Primer pase dejo 6 dispositivos con socket vivo pero `serviceReady=false`; se recuperaron con `force-stop` + toggle de Accesibilidad + relaunch.
- Validacion global final:
  - Total: 17.
  - OK: 17/17.
  - `engine_probe`: `ok=true`, `serviceReady=true`, `engine=autojs`.
  - `status`: `ok=true`, `engine=autojs`.
  - `enabled_accessibility_services` en todos: solo `AccessibilityServiceUsher`.
  - `legacyEnabled=false` en 17/17.

**Notas operativas:**
- `keyboardActive=false` puede seguir apareciendo si no hay `InputView` visible; no significa fallo del IME.
- OCR puede tardar, pero ya no debe bloquear el socket con frames si `streamFrames=false`.
- Rollback disponible si fuera necesario:
  - APK legacy real: `flow_agent_apk/backup_0_3_8/flowagent-0.3.8-from-41.apk`.
  - APK monolito previo en restore points.

## ULTIMOS CAMBIOS (2026-06-07) - Monolito PRO Fase 4 jitter

**Fase 4 - medicion base de jitter de taps:**
- Se creo `tools/measure_tap_jitter.py` como herramienta diagnostica de solo reporte.
- La herramienta analiza bounds de nodos exportados en JSON de FlowAgent, dumps XML de `uiautomator` o una muestra incorporada si no hay dispositivo conectado.
- No instala APKs ni toca telefonos; puede analizar dumps tomados previamente.
- Reportes generados:
  - `reports/tap_jitter_measurement_2026-06-07_current.json`.
  - `reports/tap_jitter_measurement_2026-06-07_adaptive.json`.
  - `reports/tap_jitter_measurement_2026-06-07_adaptive_max.json`.
- Resultado con `jitterRatio=0.10`, 1000 iteraciones por nodo y muestra conservadora:
  - 5 nodos medidos.
  - Formula anterior: `outsideTotal=0`, riesgo 3 `high`, 1 `medium`, 1 `low`.
  - Formula ajustada: `outsideTotal=0`, riesgo 1 `high`, 2 `medium`, 2 `low`.
  - El unico `high` restante es un target de 24x24 px, clasificado asi por tamano minimo aunque queda con margen de 2 px.
- Validaciones ejecutadas:
  - `python -m py_compile local_adb_server.py tools\measure_tap_jitter.py` OK.
  - `tools\measure_tap_jitter.py` acepta JSON con BOM (`utf-8-sig`) para dumps generados por PowerShell.

**Fase 4 - ajuste de bounds por modelo/resolucion:**
- `local_adb_server.py` agrega `agent_safe_tap_point(...)`.
- `agent_click_node(...)` ya no sortea casi todo el rectangulo del nodo; ahora aplica margen minimo adaptativo por tamano:
  - nodos menores de 28 px: margen minimo 2 px.
  - nodos de 28 a 47 px: margen minimo 3 px.
  - nodos de 48 px o mas: margen minimo 4 px.
- El margen proporcional sigue usando `jitterRatio` del perfil humano, limitado internamente a `0.35`.
- Si el target es extremadamente pequeno, el rango se colapsa al centro seguro en vez de permitir coordenadas de borde.

**Prueba real en dispositivo:**
- Se reinicio el servidor ADB local empaquetado y se recuperaron las conexiones WiFi conocidas.
- `adb devices` confirmo 17 dispositivos conectados.
- `/health` respondio OK usando ADB empaquetado.
- `/agents` mostro 15 FlowAgents conectados; faltaban `.44` y `.53` al cierre de la medicion, no se forzaron porque la fase se valido sobre `.43`.
- Dump real guardado: `reports/tap_jitter_dump_192_168_1_43_2026-06-07.json`.
- Pantalla medida en `.43`: selector de apps activas del FlowAgent, 35 nodos en dump y 34 bounds validos medidos.
- Reportes reales:
  - `reports/tap_jitter_measurement_192_168_1_43_2026-06-07_current.json`.
  - `reports/tap_jitter_measurement_192_168_1_43_2026-06-07_adaptive.json`.
- Resultado `.43`:
  - Formula anterior: `outsideTotal=0`, 0 `high`, 1 `medium`, 33 `low`.
  - Formula ajustada: `outsideTotal=0`, 0 `high`, 0 `medium`, 34 `low`.
- No se instalo APK y no se desplego en la flota.

**Reconexión forzada de flota por solicitud del usuario:**
- Se reinicio el servidor ADB local empaquetado y se reconectaron los 17 seriales WiFi conocidos con `adb connect`.
- Se reaplico `adb reverse` para `tcp:8766`, `tcp:8765` y `tcp:5000` en toda la flota.
- Se lanzo `com.flowlogin.agent/.MainActivity` con extras `host=127.0.0.1`, `serial=<serial>`, `port=8766`, `autoconnect=true`.
- Primer resultado: ADB 17/17, FlowAgent socket 15/17; faltaban `.44` y `.53`.
- Segundo intento solo en `.44` y `.53`: `am force-stop com.flowlogin.agent`, reverse y relaunch con autoconnect.
- Resultado final: `/agents` reporto `AgentCount=17` y `Missing=[]`.
- Verificacion posterior detecto `.44` y `.53` conectados pero con `accessibility=false`.
- Se forzo en `.44` y `.53`:
  - `enabled_accessibility_services=com.flowlogin.agent/org.autojs.autojs.core.accessibility.AccessibilityServiceUsher:com.flowlogin.agent/.FlowAccessibilityService`.
  - `accessibility_enabled=1`.
  - `ime enable` y `ime set com.flowlogin.agent/.FlowKeyboardService`.
- Resultado final ampliado: `/agents` reporto `AgentCount=17`, `BadCount=0`; todos con Accesibilidad activa y FlowKeyboard instalado.
- No se instalo ni actualizo ningun APK.

## ULTIMOS CAMBIOS (2026-05-31) - FlowKeyboard errores humanos corregidos

**Fase 2 completada - errores opcionales con backspace:**
- `HumanInputBridge` ahora soporta errores humanos opcionales apagados por defecto:
  - `mistakesEnabled`: activa/desactiva la simulacion.
  - `mistakeRate`: probabilidad limitada internamente a maximo `0.35`.
  - `maxMistakes`: limite de correcciones por texto.
- Cuando esta activo, el FlowKeyboard escribe una tecla equivocada soportada, espera brevemente, pulsa backspace en el teclado visual y luego escribe el caracter correcto.
- En campos `password` se desactiva la simulacion de errores aunque se envie `mistakesEnabled=true`.
- La respuesta de `keyboard_type_human` agrega `correctedErrors` sin romper los campos existentes (`charsTyped`, `charsFallback`, `unsupported`, `fieldType`, `totalMs`).
- `local_adb_server.py` propaga los parametros opcionales desde `/flowkeyboard/type-human`.
- `electron-app/src/renderer/app.js` permite pasar esos parametros desde `sendFlowKeyboardType(...)`, manteniendo el comportamiento anterior por defecto.

**Validaciones ejecutadas:**
- `node --check electron-app/src/renderer/app.js` OK.
- `python -m py_compile local_adb_server.py` OK.
- `.\gradlew.bat :app:assembleAppRelease` en `flow_agent_monolito` OK.
- Se reinicio solo el backend Python local para cargar el endpoint actualizado.

**Prueba controlada en un solo dispositivo:**
- Dispositivo: `192.168.1.43:5555`.
- Se instalo/configuro solo `.43` con `tools/install_monolito_device.ps1 -Serial 192.168.1.43:5555`.
- No se ejecuto instalacion masiva en la flota.
- APK instalado en `.43`: `versionName=1.0.0`, `versionCode=103`.
- FlowKeyboard enfocado en `com.android.settings.intelligence:id/search_src_text`.
- Prueba HTTP:
  - Texto: `Flow typo 43`.
  - `mistakesEnabled=true`, `mistakeRate=0.35`, `maxMistakes=3`.
  - Resultado: `ok=true`, `charsTyped=12`, `charsFallback=0`, `correctedErrors=3`, `totalMs=3828`.
- Verificacion via `uiautomator dump`: el `EditText` quedo con `text="Flow typo 43"`.

## ULTIMOS CAMBIOS (2026-05-31) - Plan operativo Monolito PRO

**Documentacion de continuidad creada:**
- `PLAN_MONOLITO_PRO.md`: objetivo, arquitectura deseada, fases, riesgos y validaciones base.
- `TASKS_MONOLITO_PRO.md`: checklist operativo por fases para ejecutar sin romper el monolito.
- `HANDOFF_MONOLITO_PRO.md`: guia para que otra IA/modelo pueda continuar si se corta la sesion.
- `DISPOSITIVOS_PRUEBA_MONOLITO.md`: estado de `.43` y `.48` usados en pruebas previas.

**Decision de proceso:**
- Antes de tocar mas codigo se debe crear restore point y ejecutar auditoria global de mojibake/encoding en APK, dashboard, servidores, scripts y documentacion.
- La fusion a una sola Accesibilidad queda planificada para una fase posterior, no inmediata. Primero se debe migrar y validar comandos sobre un engine AutoJs6 sin quitar `FlowAccessibilityService`.
- Cualquier agente que continue debe leer: `AGENTS.md`, `PROJECT_CONTEXT.md`, `PLAN_MONOLITO_PRO.md`, `TASKS_MONOLITO_PRO.md`, `HANDOFF_MONOLITO_PRO.md` y `DISPOSITIVOS_PRUEBA_MONOLITO.md`.

**Fase 0 completada - Restore point:**
- Ruta: `restore_points/2026-05-31_MONOLITO_PRO_FASE0`.
- Contenido verificado: 19 archivos.
- Incluye: docs de continuidad, `PROJECT_CONTEXT.md`, `local_adb_server.py`, `app.js`, `flow-touch.js`, `styles.css`, manifest y fuentes FlowKeyboard/HumanInputBridge del monolito, APK monolito arm64 actual y APK legacy 0.3.8.
- Siguiente fase: auditoria global mojibake/encoding con script de solo reporte, sin correcciones automaticas.

**Fase 1 iniciada - Auditoria global mojibake/encoding:**
- Script creado: `tools/check_mojibake.py`.
- Modo: solo reporte JSON, no modifica archivos.
- Excluye dependencias/build/restores: `.git`, `.gradle`, `.venv`, `venv`, `env`, `node_modules`, `build`, `dist`, `__pycache__`, `restore_points`, `backup_*` y `.flowlogin_payloads`.
- Reporte limpio generado: `reports/mojibake_report_2026-05-31.json`.
- Resultado inicial: 33 hallazgos, 20 clasificados como `A-ui-visible` y 13 como `B-api-logs-code`.
- Archivos afectados en el reporte inicial: `FlowDashboard.Core/Services/AdbService.cs`, `electron-app/src/renderer/app.js`, `electron-app/src/renderer/app_clean_test.js`, `flow_agent_monolito/app/src/main/assets-app/docs/all.html`, `flow_agent_monolito/app/src/main/assets-app/docs/base64.html`, `flow_agent_monolito/app/src/main/res/layout/flowagent_main.xml`, `flow_agent_monolito/app/src/main/res/values/flowagent_colors.xml`, `flow_agent_monolito/app/src/main/res/values/flowagent_strings.xml`, `flow_agent_monolito/app/src/main/res/values/flowagent_styles.xml`, `wsapi_demo.html`.
- Validacion: `python -m py_compile tools/check_mojibake.py` OK.

**Fase 1 primer lote completado - Correcciones mojibake runtime/UI propia:**
- Corregido en Electron: textos visibles del inspector (`Arbol UI`) y logs/botones corruptos en `electron-app/src/renderer/app.js`.
- Corregido en copia de prueba: `electron-app/src/renderer/app_clean_test.js`.
- Corregido en backend C#: mensajes corruptos de `FlowDashboard.Core/Services/AdbService.cs`.
- Corregido en APK monolito: `flowagent_strings.xml`, `flowagent_colors.xml`, `flowagent_styles.xml`, `flowagent_main.xml`.
- Corregido en legado: confirm corrupto de `wsapi_demo.html`.
- Reporte regenerado: quedaron 2 hallazgos en `flow_agent_monolito/app/src/main/assets-app/docs/all.html` y `flow_agent_monolito/app/src/main/assets-app/docs/base64.html`; son documentacion HTML vendorizada de AutoJs6 con texto chino/ejemplos de encoding, no runtime del FlowAgent.
- Decision: `tools/check_mojibake.py` excluye por defecto `flow_agent_monolito/app/src/main/assets-app/docs` como docs vendorizadas. El reporte actual queda en 0 hallazgos.
- Validaciones ejecutadas:
  - `node --check electron-app/src/renderer/app.js` OK.
  - `node --check electron-app/src/renderer/app_clean_test.js` OK.
  - `dotnet build FlowDashboard.Core/FlowDashboard.Core.csproj` OK con warnings existentes.
  - `.\gradlew.bat :app:assembleAppRelease` en `flow_agent_monolito` OK.
- No se instalo APK en ningun dispositivo durante esta fase.
- Siguiente paso recomendado: probar el APK monolito en 1 dispositivo antes de cualquier despliegue.

**Fase 2 iniciada - FlowKeyboard Humano V2:**
- `FlowKeyboardService` ahora mantiene estado visual `shiftOn` y `symbolsOn`.
- El teclado visible alterna entre modo letras y modo `?123` sin cambiar layout: las teclas QWERTY reutilizan sus ids estables y actualizan labels.
- Mayusculas: `HumanInputBridge` toca visualmente `shift` y despues la letra real. Ya no necesita borrar y reinsertar la mayuscula con `commitText`.
- Numeros: `HumanInputBridge` toca `?123`, luego la tecla numerica mapeada (`q=1` ... `p=0`) y vuelve cuando sea necesario.
- Simbolos comunes soportados por taps reales: `@ . - _ # $ % & * ( ) / ! ? ' " : ; ,` mas espacio.
- Fallback: `keyboard_type_human` acepta `allowFallback`; si `true`, caracteres no cubiertos aun pueden usar `commitText`, pero se reportan en `charsFallback`. Si `false`, se devuelven en `unsupported`.
- Campo: `keyboard_type_human` acepta `fieldType` (`generic`, `email`, `password`, `search`, etc). `password` aumenta latencia minima/maxima; `email` usa una cadencia mas rapida y estable.
- `local_adb_server.py` y helpers Electron ya pasan `fieldType` y `allowFallback` manteniendo compatibilidad con llamadas existentes.
- Validaciones ejecutadas:
  - `node --check electron-app/src/renderer/app.js` OK.
  - `node --check electron-app/src/renderer/app_clean_test.js` OK.
  - `python -m py_compile local_adb_server.py tools/check_mojibake.py` OK.
  - `.\gradlew.bat :app:assembleAppRelease` en `flow_agent_monolito` OK.
- No se instalo APK en ningun dispositivo durante esta fase.

**Prueba controlada .43 - instalacion/configuracion automatica del monolito:**
- Script creado: `tools/install_monolito_device.ps1`.
- Objetivo: instalar/configurar un solo dispositivo de prueba sin tocar la flota.
- Ejecutado en `192.168.1.43:5555`.
- Acciones automatizadas por el script:
  - Fuerza parada de `com.flowlogin.agent`.
  - Desinstala `org.autojs.autojs6` si existe.
  - Desinstala `com.flowlogin.agent` anterior si existe.
  - Instala `flow_agent_monolito/app/build/outputs/apk/app/release/agent-v1.0.0-arm64-v8a.apk`.
  - Configura `adb reverse tcp:8766 tcp:8766` y `tcp:8765`.
  - Aplica appops/permisos runtime principales.
  - Activa accesibilidad real por `settings secure`, con toggle `accessibility_enabled 0 -> 1`.
  - Habilita y selecciona `com.flowlogin.agent/.FlowKeyboardService` como IME default.
  - Abre FlowAgent y automatiza el dialogo de MediaProjection cuando aparece.
  - Reaplica accesibilidad e IME al final porque Samsung puede restaurar teclado tras el dialogo de captura.
- Resultado local Android en `.43`:
  - APK instalado: `versionName=1.0.0`, `versionCode=103`.
  - `dumpsys accessibility`: servicios bound `FlowAgent AutoJS` y `FlowAgent Control`.
  - `default_input_method`: `com.flowlogin.agent/.FlowKeyboardService`.
  - Proceso vivo: `pidof com.flowlogin.agent` devolvio PID.
- Resultado backend:
  - `/flowkeyboard/status` en `.43`: `installed=true`, `available=true`, `enabled=true`, `selected=true`.
  - `/flowkeyboard/command` action `status` responde por socket; cuando no hay campo de texto enfocado devuelve `FlowKeyboard no esta activo como teclado actual`, que es esperado porque Android solo crea el `InputView` al enfocar un input.
  - `/agents` muestra `.43` con `agentVersion=1.0.0`, `accessibility=true`, `keyboardInstalled=true`.
- Prueba real de tipeo humano en `.43` completada:
  - Pantalla usada: Ajustes -> Search (`com.android.settings.intelligence:id/search_src_text`).
  - Antes de escribir se confirmo con `dumpsys input_method`: `mImeWindowVis=Active|Visible`, `mInputViewStarted=true`, `mIsInputViewShown=true`, `mServedView=SearchAutoComplete`.
  - `POST /flowkeyboard/type-human` con texto `Flow Test 43@ok`, `minDelayMs=85`, `maxDelayMs=210`, `fieldType=generic`, `allowFallback=true` -> `ok=true`, `charsTyped=15`, `charsFallback=0`, `totalMs=4139`.
  - Verificacion via `uiautomator dump`: el `EditText` quedo con `text="Flow Test 43@ok"`.
- Nota importante: hay que distinguir `IME seleccionado` de `InputView visible`. Si no hay campo enfocado, `/flowkeyboard/status` puede reportar `selected=true`, pero `keyboard_type_human` devuelve `InputView del FlowKeyboard no esta visible`; al enfocar un `EditText` real, el tipeo humano funciona.

## ULTIMOS CAMBIOS (2026-05-31) - Monolito v1.0.0 FlowKeyboard y Accesibilidad

**Decision:**
- Se mantiene `flow_agent_monolito` como APK principal (`com.flowlogin.agent`, `versionName=1.0.0`, `versionCode=103`), porque `local_adb_server.py` ya prioriza `flow_agent_monolito/app/build/outputs/apk/app/release/agent-v1.0.0-arm64-v8a.apk` antes que el APK legacy 0.3.8.

**Cambios en monolito (`flow_agent_monolito/app/src/main/...`):**
- `FlowKeyboardService` y `HumanInputBridge` del monolito ya tenian `keyboard_type_human` y QWERTY visible con `dispatchGesture`; no se reescribieron.
- Se corrigio la confusion visual de Accesibilidad agregando labels separados:
  - `FlowAgent AutoJS` para `org.autojs.autojs.core.accessibility.AccessibilityServiceUsher`.
  - `FlowAgent Control` para `com.flowlogin.agent.FlowAccessibilityService`.
- Se reforzo el feedback visual del teclado convirtiendo `fa_flow_keyboard_key.xml` y `fa_flow_keyboard_key_primary.xml` en `selector` con estado `pressed`, para que los taps de `HumanInputBridge` (`setPressed(true)`) se vean en la pantalla Android.

**Build y prueba controlada en 1 dispositivo:**
- Build OK: `.\gradlew.bat :app:assembleAppRelease`.
- APK validado: `agent-v1.0.0-arm64-v8a.apk`, package `com.flowlogin.agent`, `versionName=1.0.0`, `versionCode=103`, `minSdk=24`, `targetSdk=36`.
- Dispositivo de prueba: `192.168.1.43:5555`.
- Se desinstalo solo en `.43`: `adb -s 192.168.1.43:5555 uninstall com.flowlogin.agent` -> `Success`.
- Se instalo solo en `.43`: `adb -s 192.168.1.43:5555 install -r flow_agent_monolito/.../agent-v1.0.0-arm64-v8a.apk` -> `Success`.
- Verificacion `.43`: solo queda un paquete `com.flowlogin.agent`; `/flowkeyboard/status` reporta instalado pero `enabled=false`, `selected=false`; `/agents` reporta `.43` conectado con `agentVersion=1.0.0`, `accessibility=false`, `keyboardInstalled=true`, `keyboardActive=false`.
- Nota importante: al desinstalar Android borra permisos de Accesibilidad e IME. Para probar tipeo real en `.43`, activar manualmente `FlowAgent Control` en Accesibilidad y seleccionar `FlowKeyboard`.

## ULTIMOS CAMBIOS (2026-05-31) - FlowKeyboard visual en Android

**FlowKeyboard humano + animacion de teclas en el telefono (`flow_agent_apk/src/com/flowlogin/agent/FlowKeyboardService.java`, `flow_agent_apk/res/layout/flow_keyboard_view.xml`, `flow_agent_apk/res/values/styles.xml`):**
- Se corrigio el sitio de la animacion: no vive en el panel Electron, sino en el teclado Android real (`InputMethodService`) que aparece en la pantalla del dispositivo.
- `FlowKeyboardService` ahora reconoce `keyboard_type_human` / `keyboard_type_text_human`, que es el comando que envia el endpoint `/flowkeyboard/type-human` desde `local_adb_server.py`.
- El modo humano escribe caracter por caracter con `InputConnection.commitText(...)` y delay aleatorio entre `minDelayMs` y `maxDelayMs` (`80-220ms` desde el frontend por defecto).
- El layout del teclado Android ahora muestra filas QWERTY compactas; mientras llega texto remoto, la tecla correspondiente se presiona visualmente en el telefono usando estado `pressed` + animacion breve de escala/opacidad.
- Las acciones manuales del teclado Android (`space`, `backspace`, `done`) tambien disparan el feedback visual correspondiente.
- Se retiro el teclado visual que se habia agregado por error al panel FlowKeyboard de Electron; el dashboard vuelve a ser solo el emisor/control.

**Verificacion:**
- `node --check electron-app/src/renderer/flow-touch.js` OK.
- `node --check electron-app/src/renderer/app.js` OK.
- `python -m py_compile local_adb_server.py` OK.
- Balance CSS: 1352 `{` y 1352 `}`.
- `powershell -ExecutionPolicy Bypass -File .\flow_agent_apk\build_apk.ps1` OK; APK generado en `flow_agent_apk/build/flowagent-debug.apk`.
- Pendiente reinstalar `flow_agent_apk/build/flowagent-debug.apk` en los dispositivos para que la animacion aparezca en Android.

## ULTIMOS CAMBIOS (2026-05-30) - Calidad H.264 automatica por zoom del grid

**Grid H.264 adaptativo (`electron-app/src/renderer/app.js`):**
- El `app.js` principal ya aplica el redisenio documentado de Etapa C: el zoom de la grilla controla automaticamente el preset H.264 del grid.
- Mapeo activo: `< 120px -> thumbnail` (240p/8fps), `120-220px -> eco` (480p/24fps), `> 220px -> balanced` (720p/30fps).
- El preset inicial del `H264StreamRenderer` se calcula desde `deviceZoom` al arrancar y se persiste en `localStorage.flowdashboard.grid.preset`.
- `createCanvasesForVisibleDevices()` conecta cada canvas nuevo/reconectado con `getGridPresetForZoom(this.deviceZoom)` en vez de forzar siempre `thumbnail`.
- `setDeviceZoom()` ahora llama a `setGridQuality()` cuando el zoom cruza un umbral de calidad. Como `Ctrl+scroll` ya actualiza el zoom mediante `setDeviceZoom()`, tambien cambia calidad automaticamente.
- `setGridQuality()` sigue reabriendo sesiones del grid de forma escalonada y ahora excluye correctamente las sesiones de Focus por clave con `|`, sin tocar las sesiones independientes `serial|preset`.

**Verificacion:**
- `node --check electron-app/src/renderer/app.js` OK.
- Pendiente smoke visual en Electron con dispositivos reales para confirmar los cambios de preset al mover slider y con `Ctrl+scroll`.

**Fix Focus Mode sin video (mismo dia):**
- `flow-touch.js` deja de abrir una sesion H.264 independiente `serial|preset` para el canvas grande. El Focus ahora agrega su canvas a la sesion H.264 del grid mediante `h264.attach(serial, focusCanvas, preset)`.
- `closeFocus()` desacopla solo el canvas grande con `h264.detach(serial, focusCanvas)` y restaura el preset del grid calculado por zoom para ese serial.
- `app.js` `setFocusQuality()` cambia el preset de la sesion compartida del serial enfocado y mantiene adjuntos el canvas del grid y el del Focus.
- `app.js` `setGridQuality()` readjunta el canvas del Focus si el zoom cambia mientras el overlay esta abierto.
- Verificacion: `node --check electron-app/src/renderer/app.js` OK y `node --check electron-app/src/renderer/flow-touch.js` OK.

**Fix adicional Focus negro cuando un serial no entrega H.264:**
- Caso real visto en consola: al abrir `192.168.1.48:5555`, no habia `primer chunk` H.264 para ese serial, pero Focus se habia enganchado solo al renderer H.264.
- Se uso temporalmente `StreamRenderer` WebP como diagnostico/fallback para confirmar que el canvas grande no era el problema. Decision final: Focus debe usar solo scrcpy raw H.264 por `scrcpy_raw_ws_server.py`/puerto `8768`.
- `flow-touch.js` ya no registra el canvas grande en WebP; si WebCodecs/H.264 no esta disponible, Focus avisa por consola y no cae silenciosamente a WebP.
- `stream-renderer.js` conserva una proteccion legacy para que WebP no tape H.264 en vistas antiguas, pero no es el motor de Focus.
- Se corrigieron guards en `stream-renderer.js`: `_hydrateExtraCanvasFromLatest()` tolera falta de frame cacheado y `_hasCanvasForSerial()` tolera serial sin extras.
- Verificacion: `node --check electron-app/src/renderer/app.js`, `node --check electron-app/src/renderer/flow-touch.js` y `node --check electron-app/src/renderer/stream-renderer.js` OK.

**Fix Focus usando thumbnail en grande:**
- Log real: `flow-touch.js` abria Focus con `preset=thumbnail`, por eso aun cuando habia H.264 se veia como miniatura escalada y menos fluida.
- `flow-touch.js` ahora solo acepta `eco`, `balanced` o `pro` como preset persistido de Focus. Si `localStorage.flowdashboard.focus.preset` contiene `thumbnail` o un valor viejo, el Focus arranca en `balanced`.
- El selector visual del Focus tambien ignora el preset del grid (`thumbnail/eco` por zoom) y muestra la calidad propia del Focus.
- Probe directo contra `.48` confirmo que ese telefono no entregaba H.264 en `balanced`: `start_session(192.168.1.48:5555, balanced) fallo: Server cerro la conexion sin transmitir`. En ese caso el fallback WebP sigue activo para no dejar negro, pero la solucion de fluidez requiere recuperar H.264 en ese device.
- Verificacion: `node --check electron-app/src/renderer/flow-touch.js` OK.

**Fix scrcpy raw basado en documentacion oficial local:**
- Se reviso `C:\Users\elyup\Downloads\scrcpy-master\scrcpy-master\doc\develop.md`.
- Flujo oficial aplicado: `adb push scrcpy-server-v4.0 /data/local/tmp/scrcpy-server-manual.jar`, `adb forward tcp:<port> localabstract:scrcpy`, `app_process / com.genymobile.scrcpy.Server 4.0 tunnel_forward=true audio=false control=false cleanup=false raw_stream=true max_size=...`.
- Se quito el flag no oficial `video_codec=h264`, que hacia abortar el server en estos devices.
- `_connect_and_probe()` ahora reintenta durante la ventana de timeout si el socket forward acepta pero cierra sin transmitir antes de que el server este listo.
- Probe validado por WebSocket `8768`: `.43` y `.48` reciben H.264 Annex-B real (`00 00 01 67...`) con decenas de chunks en 4s.

Este archivo es la memoria viva del proyecto. Antes de modificar cualquier archivo, leer `AGENTS.md` y este archivo.

> **HISTORICO / OBSOLETO (2026-05-29):** esta entrada antigua presentaba `DOCUMENTACION_TECNICA.md` como referencia tecnica. Desde la auditoria documental 2026-06-20, esa instruccion queda anulada: no leerlo ni basarse en el; usar `AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/master_technical_specification.md`, codigo actual y runtime verificado.

> **NUEVO (2026-05-29):** existe `MIGRACION_HTML_A_ELECTRON.md` en la raiz — inventario detallado de QUE FALTA migrar de `wsapi_demo.html` (legado) al producto Electron para poder eliminar el HTML legado y dejar solo Electron como producto unico. Resumen: 14 areas ya migradas, 6 con refinamientos pendientes, 5 NO migradas (login con MAC del device, panel de scripts JS, contenido real del modal Help, contenido real del modal Planes, panel de APK clones), 7 archivos legados eliminables tras la migracion. Plan de migracion en 4 sesiones. LEER si vas a trabajar en cerrar el legado.

---

## ULTIMOS CAMBIOS (2026-05-30) - Corrección de inicialización y carga de dispositivos

**Solución a TypeError en app.js (`app.js`):**
- Se solucionó el bloqueo en la carga de dispositivos corrigiendo un `TypeError` en `updateStatusPanel()`. El programa intentaba leer `this.streamRenderer.ws.readyState`, pero la conexión WebSocket está almacenada en `this.streamRenderer.connection` (la propiedad `ws` no existía).
- Se implementó un acceso seguro: `const wsState = this.streamRenderer.connection ? this.streamRenderer.connection.readyState : 3;`.
- Esto permite que `checkConnections()` finalice correctamente, desbloqueando la promesa de inicialización y permitiendo que `loadDevices()` sea llamada, cargando la grilla de dispositivos correctamente.

---

## ULTIMOS CAMBIOS (2026-05-29) - Acciones visuales + banderas embebidas + limpieza de textos

**Acciones fijadas (`electron-app/src/renderer/app.js`, `styles.css`):**
- Se quito del sidebar de `Acciones` el texto fijo `Aplicar a ... dispositivo seleccionado`.
- La barra fijada de `Acciones` ahora queda separada visualmente en 3 grupos: seleccionar/deseleccionar, navegacion Android (`Back`, `Home`, `Recents`) y resto de acciones.
- `Seleccionar todo` y `Deseleccionar todo` se agregaron al inicio de la barra fijada con botones cuadrados solo-icono.
- `Back`, `Home` y `Recents` en la barra fijada ahora son cuadrados compactos para liberar espacio.

**FlowCategory fijado:**
- En el main screen fijado ya no aparece el texto `FlowCategory`; solo quedan las opciones visuales.
- Cada opcion del FlowCategory fijado ahora tiene su propio boton Play circular, colorido y animado cuando el flow esta corriendo.

**Banderas e IP publica:**
- Se elimino la dependencia visual de `flagcdn` para las tarjetas y el Focus Mode.
- `renderCountryFlag()` ahora genera banderas SVG inline para paises comunes (`US`, `CO`, `ES`, `MX`, `BR`, `AR`, `CL`, `PE`, `VE`, `EC`, `DO`, `PA`, `CA`, `GB`, `FR`, `DE`, `IT`, `NL`, `PT`, `JP`, `CN`, `IN`, `AU`) y usa codigo de pais como fallback limpio.

**Textos/encoding:**
- Se agrego `sanitizeVisibleText()` para limpiar mojibake visible en nodos de texto y atributos (`title`, `placeholder`, `aria-label`) tras renderizar UI y modales.
- Se corrigio el menu contextual de dispositivo: `Anadir cuentas` y `Cantidad a anadir` ya no muestran caracteres corruptos.
- Se repararon ternarios y optional chaining afectados durante la limpieza mecanica de encoding; `app.js`, `flow-touch.js` e `inspector.js` vuelven a pasar validacion de sintaxis.

**Verificacion:**
- `node --check electron-app/src/renderer/app.js` OK.
- `node --check electron-app/src/renderer/flow-touch.js` OK.
- `node --check electron-app/src/renderer/inspector.js` OK.
- Balance CSS: 1352 `{` y 1352 `}`.

---

## ULTIMOS CAMBIOS (2026-05-29) - Pinned bars adaptativas + Focus IP

**Barras fijadas del main screen (`electron-app/src/renderer/app.js`, `styles.css`):**
- La fila fijada de `Acciones` ahora vive dentro de una pila `sticky` (`main-pinned-stack`) y permanece visible al desplazar el main screen.
- Se elimino el scroll horizontal de acciones fijadas: los chips se adaptan al ancho disponible con grid responsive, texto mas pequeno y peso normal.
- La seccion `FlowCategory` tiene su propio check `Fijar en Main Screen`; cuando esta activo aparece arriba de `Acciones` como una barra compacta con botones visuales para `FlowLogin`, `FlowRegister`, `FlowTrack`, `FlowCache`, `FlowCast`, `FlowApple`, `Flowamazon`, `FlowGram` y `FlowTikTok`.

**Dispositivos y Focus Mode:**
- Los botones rotos de `Actualizar`, `Seleccionar todos` y `Deseleccionar todos` en la seccion `Dispositivos` fueron reemplazados por SVG inline para evitar caracteres corruptos.
- El modo Focus ahora muestra el nombre editable del dispositivo, la IP publica y la bandera real del pais usando el mismo badge que las tarjetas del main screen.
- La bandera se carga como imagen real desde `flagcdn.com/w40` con `srcset` para mayor nitidez; si falla, se muestra el codigo del pais como fallback.

**Verificacion:**
- `node --check electron-app/src/renderer/app.js` OK.
- `node --check electron-app/src/renderer/flow-touch.js` OK.
- Balance CSS: 1338 `{` y 1338 `}`.

---

## ULTIMOS CAMBIOS (2026-05-29) - Pulido Acciones/Grid: banderas, lasso y offline

**Tarjetas de dispositivos (`electron-app/src/renderer/app.js`, `styles.css`):**
- El header de cada tarjeta se hizo mas alto para que la IP publica se vea completa.
- La bandera del pais ahora se renderiza como imagen real por `countryCode` usando `flagcdn.com`; si no hay codigo de pais, queda un placeholder compacto.
- Si un telefono desaparece de `adb devices`, la tarjeta ya no se elimina del main screen: queda presente como `offline/disconnected` con mensaje visual animado e icono de cable/desconexion.
- El streaming no intenta reconectar canvas para tarjetas marcadas offline.

**Main screen y seleccion:**
- La grilla principal de dispositivos ahora permite seleccion por arrastre con rectangulo/lasso, similar al selector de categorias.
- Al cambiar seleccion se actualiza tambien el badge/nota de `Acciones`.

**Acciones (`electron-app/src/renderer/app.js`, `styles.css`):**
- Se agrego `JS` al panel de `Acciones` y a la fila fijada del main screen; reutiliza el modal existente para elegir y ejecutar scripts `.js` en los dispositivos seleccionados.
- El check `Fijar en Main Screen` se hizo mas compacto y el panel de acciones recibio mas espacio vertical para que no se monte sobre Navegacion ni Apps y sistema.
- El modal `Apps` ahora muestra un icono por app: Spotify para paquetes `com.spotify.*` y un icono default para el resto. Si se seleccionan varios telefonos, sigue mostrando la interseccion de apps comunes.

**Encoding/UI:**
- Los controles de ventana (minimizar, maximizar, cerrar) ahora son iconos SVG, evitando caracteres corruptos.
- El item lateral `Configuración` se corrigio con tilde.
- `Navegacion` queda sin tilde para evitar mojibake en esa etiqueta compacta.

**Verificacion:**
- `node --check electron-app/src/renderer/app.js` OK.
- Balance CSS: 1321 `{` y 1321 `}`.

---

## ULTIMOS CAMBIOS (2026-05-29) - Acciones completas + IP publica + nombre editable

**Acciones del sidebar (`electron-app/src/renderer/app.js`, `styles.css`):**
- Se repusieron las acciones `ADB` y `Archivos` dentro de `Acciones`.
- `Back`, `Home` y `Recents` ahora son botones de solo icono.
- `Instalar APKs` pasa a mostrarse como `APKS`.
- Nueva opcion `Spotify` con icono alusivo: abre un modal que lee `/clone-apks` y permite instalar 1, varios o todos los APKs/clones disponibles desde la carpeta `APK/` usando `/clone-apks/install`.
- Se agrego el check `Fijar en Main Screen`: al activarlo persiste en `localStorage.flowdashboard.actionsPinned` y muestra una fila horizontal de accesos rapidos encima de la grilla de dispositivos.
- Se corrigio el texto visible `Navegacion` para evitar mojibake con tilde.

**Tarjetas de dispositivos (`electron-app/src/renderer/app.js`, `styles.css`):**
- Cada tarjeta ahora muestra IP publica y una mini bandera visual basada en `countryCode` cuando el backend la tenga cacheada; si falta, dispara refresco por `/device-public-ip` despues de renderizar.
- El nombre del dispositivo ahora es editable desde la propia tarjeta con popover visual, persistiendo en `/device-name`.
- El boton inferior de cuentas conserva el contador `x/10`, pero ahora usa silueta de persona en vez del icono de lista.

**Verificacion:**
- `node --check electron-app/src/renderer/app.js` OK.
- Balance CSS: 1303 `{` y 1303 `}`.
- Pendiente: smoke visual en Electron con dispositivos reales para confirmar posicionamiento final de la fila fijada y badges de IP.

---

## ULTIMOS CAMBIOS (2026-05-29) - Bolitas de cuenta + Acciones del sidebar

**Bolitas de cuentas (`electron-app/src/renderer/app.js`, `styles.css`):**
- El popover que aparece al pulsar una bolita de cuenta ahora usa la clase real `.dot-popover` y tiene estilos propios. Antes el JS creaba `.dot-popover`, pero el CSS principal estilaba `.dot-tooltip-fixed`, por eso las opciones podian no verse correctamente.
- Al pulsar una bolita se muestran solo dos botones con iconos: Reintentar y Reemplazar. El popover queda anclado junto a la bolita y se cierra con click fuera o scroll.

**Acciones del sidebar (`electron-app/src/renderer/app.js`, `styles.css`):**
- Las acciones ya no usan fallback automatico a todos los dispositivos. Si no hay dispositivos seleccionados, las opciones siguen visibles, pero no ejecutan nada y muestran aviso de seleccion requerida.
- Redisenio visual de `Acciones`: chips compactos con iconos SVG inline, color por tema, hover/press animado, badge de seleccion y estados de aviso.
- Apps ahora consulta las aplicaciones de los dispositivos seleccionados; si hay varios, muestra la interseccion de apps comunes a esos seleccionados.
- Se agrego ventana para `Instalar APKs`, usando `/apps/install` por cada dispositivo seleccionado.
- Se removio la opcion visual `Energia`; ahora hay acciones directas `Reiniciar` y `Apagar`.
- Sistema queda como acciones directas: `Config`, `Wi-Fi`, `Idioma`, `Apps config`, `Accesibilidad` y `Teclado` (seleccion FlowKeyboard via `/flowkeyboard/select-via-settings`).

**Verificacion:**
- `node --check electron-app/src/renderer/app.js` OK.
- Balance CSS: 1262 `{` y 1262 `}`.

---

## ULTIMOS CAMBIOS (2026-05-29) - Sesion 1 migracion legado: login con MAC del device + Help/Plans + redisenio visual modal licencia

**Restore point:** `restore_points/PuntoAntesMigracionLegacy/` (copia de `app.js` y `local_adb_server.py`).

**Login inicial con MAC del device (`app.js`):**
- Nueva funcion `waitForFirstDeviceMac(timeoutMs=8000)`: espera a que `/devices` devuelva al menos 1 device con serial. Si el device trae MAC en el listado la usa; si no, hace `POST /device-mac` para detectarla. Devuelve `{mac, serial}` o `{mac:'', serial:''}` si timeout.
- `validateLicense()` ahora antes de enviar el payload llama `waitForFirstDeviceMac` (8s timeout) si no recibio `opts.deviceMac` y `opts.deviceSerial`. Si no hay device conectado, muestra aviso amarillo "Conecta al menos un dispositivo Android" y aborta. Si lo encuentra, envia `mac_address` (del Android, NO del PC) y `device_serial` al backend, que ya los soportaba en la RPC Supabase (`p_device_serial`).
- IIFE de auto-validacion al cargar reescrita: si NO hay licencia guardada → `showLicenseModal()` directo. Si hay → espera device (15s timeout), si no hay device muestra modal con aviso. Si llega device, valida silenciosamente con MAC + serial.
- Soporta `device_status: 'blocked' | 'revoked'` con mensaje especifico (antes los trataba como error generico).

**Redisenio visual del modal de licencia (Flow Neon):**
- Modal completo reescrito con clases consistentes con el resto del dashboard (`account-editor-modal license-modal is-open`).
- HTML: card con header (logo SVG candado + titulo "FlowDashboard Pro" + subtitulo), 2 campos (Email + Clave), pill de estado de dispositivo Android (`#licenseDevicePill` con dot animado), area de mensaje (`is-info/is-success/is-warn/is-error`), boton submit con icono check + animacion spin cuando esta `.is-busy`, footer con email de soporte.
- Nueva funcion `refreshLicenseDevicePill()` que actualiza cada 3s el pill: dot verde animado + "Dispositivo detectado: 192.168.1.40 (+5 mas)" cuando hay devices, dot amarillo + "Conecta al menos un dispositivo" cuando no, dot gris + "Servidor local desconectado" si Python esta caido.
- Submit con Enter desde cualquier input.
- CSS nuevo en `styles.css` (~280 lineas al final): paleta Flow Neon (`#000`/`#0a0a0a` + acento `#00F5D4` cían neón), border `rgba(0,245,212,.22)`, glow `var(--glow-md)`, animacion `licenseModalIn` (fade + scale), respeta `prefers-reduced-motion`. Inputs con focus glow cían. Boton submit con gradiente Flow Neon. Responsive en 480px.

**Modal Help con contenido real (`app.js`):**
- Reemplazado el contenido placeholder (3 items genericos) por 8 secciones utiles: Conectar dispositivos por WiFi, Preparar FlowAgent, Repartir cuentas (FlowLogin), Focus Mode, Inspector FlowDev, Calidad del streaming, Solucion de problemas, Soporte (con email + version).

**Modal Plans (`app.js`):**
- Botones "Seleccionar X" reemplazados por links `mailto:` con asunto y cuerpo prellenados (`?subject=FlowDashboard%20Starter&body=...`). Footer con email de contacto activo.
- Subtitulo cambia de "Diseño comercial de muestra" a "Contacta para activar o cambiar tu plan" (mas honesto).

**Backend NO se modifica.** El backend Python ya soportaba `device_serial` y `mac_address` en `/validate-license` desde antes.

**Verificacion:**
- `node --check app.js` OK.
- CSS: 1192 `{` y 1192 `}` balanceados.
- Pendiente: probar el flujo completo arrancando Electron con un device real conectado.

---

## ULTIMOS CAMBIOS (2026-05-29) - Grid preset por zoom + Focus independiente

**Arquitectura de calidad del stream (rediseño):**
- Se elimina el selector manual de Calidad del sidebar. El zoom controla el preset del grid automáticamente: `< 120px → thumbnail`, `120-220px → eco`, `> 220px → balanced`.
- El focus siempre tiene su propio WS con preset independiente (selector en el header del focus).
- El socket abstracto `scrcpy` en el device solo acepta UNA conexión TCP. Solución definitiva (confirmada por logs):
  - `stream-renderer-h264.js` `_createFocusSession`: el focus **agrega su canvas a la sesión del grid existente** (mismo WS, mismo decoder). No abre conexión nueva. El canvas del focus recibe los mismos frames que el grid en tiempo real. `closeFocusSession` quita el canvas del focus (identificado por ancestro `#flowTouchFocusOverlay`) sin tocar el WS del grid.
  - El selector de calidad del focus llama `setGridQuality` — cambia el preset de todos los devices incluido el enfocado.
  - `app.js` `createCanvasesForVisibleDevices`: no reconecta el grid para el serial que está en focus (`flowTouch.getActiveSerial()`).
  - `app.js` `setGridQuality`: excluye el serial en focus del escalonado de reconexión.
  - `flow-touch.js` `closeFocus`: reconecta el grid para ese serial al cerrar el focus (300ms delay).

**Fix previo (2026-05-29) - "Insufficient resources" + canvas congelado:**
- `app.js` `setGridQuality`: escalonado 200ms entre devices.
- `stream-renderer-h264.js` `setPreset`: resetea `_reconnectAttempt` en cambios intencionales.
- `flow-touch.js` `openFocus`: cancela timers del escalonado del grid al abrir focus.
- `flow-touch.js` `_attachStreamCanvas`: copia último frame del grid al canvas del focus mientras el WS arranca.

---

## CAMBIOS PREVIOS (2026-05-28 TARDE) - FlowTouch calibración + Setup automático FlowAgent

> [!WARNING]
> **BLOQUE HISTÓRICO OBSOLETO — NO REPRESENTA EL ESTADO ACTUAL.**
> El setup automático con captura fue eliminado/desactivado. La regla vigente está en 'Reglas de Onboarding de Dispositivos'.

**FlowTouch calibración de coordenadas:**
- Nuevo endpoint `GET /device/screen-size?serial=X` → llama `adb shell wm size` y devuelve `{width, height}` reales del display.
- `_getFrameSize()` en `flow-touch.js` ahora: (1) usa `_deviceScreenSize` cacheado via `wm size`, (2) cae a WebP frameSize, (3) cae a H264 stats como último recurso.
- `_fetchDeviceScreenSize(serial)` se llama al abrir el focus mode y cachea la resolución real.
- Antes el mapper usaba 144x240 (resolución del stream H264 thumbnail) en lugar de 1080x1920 (resolución real del device) → taps completamente descalibrados.

**Setup automático FlowAgent:**
- Nuevo script `.upload_tmp/setup_flowagent_completo.ps1` con `-ForceReinstall` flag.
- Desinstala e instala en bloques de 4, activa: accesibilidad, IME FlowKeyboard, overlay SYSTEM_ALERT_WINDOW, portrait forzado, reverse tcp:8766+5000+8765.
- `setup_flow_agent_smart()` en Python ahora también activa overlay y envía `capture_screen_start` si el agente ya está conectado.
- `abrir_electron.ps1` lanza el setup en background al arrancar (idempotente).
- `capture_screen_start` se activa automáticamente via `_flowagent_auto_reconnect_loop` cuando el agente conecta al socket.

**Spec:** `.kiro/specs/etapa-c-streaming-pro/tasks.md`
**Restore points:**
- `restore_points/PuntoAntesEtapaC_StreamingPro/` (antes de Etapa C en general)
- `restore_points/PuntoAntesScrcpyRaw/` (antes del pivot a raw H.264)

**Que es esta etapa:** El streaming pasa al protocolo NATIVO de `scrcpy-server.jar`
v4.0 con `raw_stream=true`. Bypass total de `scrcpy.exe` (CLI). El backend Python
abre directamente un socket TCP al jar (via `adb forward`) y reenvia los bytes
H.264 Annex-B crudos por WebSocket. El cliente alimenta esos NALUs directamente
al `VideoDecoder` de WebCodecs.

**Por que el pivot:**
1. La opcion previa (`scrcpy.exe --record=- --record-format=mp4`) NO sirve para
   live streaming: libavformat buffera el `moov` hasta cerrar el archivo.
2. El protocolo nativo es **lo mismo que usa Laixi**: latencia 50-80 ms LAN,
   sin re-muxing, sin SDL3, sin libavcodec en PC.
3. Para 17 dispositivos thumbnail (240p@8fps@300kbps) son **~510 KB/s totales**
   sin overhead de procesos `scrcpy.exe` ventana-menos.

**Documentacion oficial seguida:**
- https://github.com/Genymobile/scrcpy/blob/master/doc/develop.md
- Modo "standalone server" con flags `tunnel_forward=true raw_stream=true`.
- SCID se parsea como **HEX** (`Integer.parseInt(value, 16)`); el nombre del
  socket abstract es `scrcpy_<%08x>`.

**Arquitectura final:**

```
[device] scrcpy-server.jar (LocalServerSocket "scrcpy_<HEX>")
     |
     |  adb forward tcp:282xx -> localabstract:scrcpy_<HEX>
     v
[PC] scrcpy_raw_streamer.py: socket TCP -> reader thread -> bytes H.264 Annex-B
     |
     |  callback (subscribers)
     v
[PC] scrcpy_raw_ws_server.py: WS server en 127.0.0.1:8768
     |
     |  ws://127.0.0.1:8768/<serial>?preset=thumbnail|eco|balanced|pro
     v
[Electron renderer] stream-renderer-h264.js:
     - splitNalus(Annex-B), detecta SPS/PPS/IDR
     - VideoDecoder.configure() con avcC sintetizado
     - VideoDecoder.decode() -> VideoFrame -> canvas.drawImage
```

**Presets:**
- `thumbnail`: 240p @ 8fps @ 300kbps (grid de 17+ devices).
- `eco`:       480p @ 24fps @ 1Mbps.
- `balanced`:  720p @ 30fps @ 2.5Mbps (default focus).
- `pro`:       1080p @ 30fps @ 5Mbps.

**Archivos NUEVOS:**
- `scrcpy_raw_streamer.py` - gestor de sesiones por (serial, preset). Multiplex de
  subscribers. push del jar idempotente. cleanup automatico al desconectar.
- `scrcpy_raw_ws_server.py` - server WebSocket asyncio en puerto 8768. Por path
  `/<serial>?preset=...` crea o reusa sesion del streamer y bombea bytes.

**Archivos MODIFICADOS:**
- `local_adb_server.py`:
  - import opcional de los dos modulos nuevos.
  - feature flag `scrcpy_raw_h264_ws` en `SERVER_FEATURES`.
  - en `serve_forever`: instancia `ScrcpyRawStreamer` y arranca el WS server.
  - endpoints REST `GET /streaming/raw/sessions` y `POST /streaming/raw/stop`.
- `electron-app/src/renderer/stream-renderer-h264.js`:
  - Reescrito desde cero. Antes parser fMP4 (~500 lineas), ahora parser
    Annex-B simple (~470 lineas pero mas claro).
  - URL base por defecto: `ws://127.0.0.1:8768`.
  - Soporta `attach`/`detach`/`setQuality` con multi-canvas por serial.
  - Auto-reconnect con backoff exponencial.
- `electron-app/src/renderer/app.js`: cambia `wsUrl` de `ws://localhost:5000`
  (backend C#) a `ws://127.0.0.1:8768` (Python WS server).
- `electron-app/src/renderer/flow-touch.js`: `attach()` ya no es Promise.

**Archivos NO modificados:**
- `FlowDashboard.Core/**`: el backend C# queda como fallback opcional. Su
  `VideoStreamingService.cs` con `--record=-` ya no se usa para live streaming
  (mantiene capacidad de grabacion a archivo).
- `flow_agent_monolito/**`: el APK queda igual; el FlowAgent no esta involucrado
  en el streaming H.264 (scrcpy-server es independiente).

**Tests E2E pasados (2026-05-28 PM):**
- Diag manual contra `.11`: 15.231 bytes/4s, primer byte = `00 00 00 01 67 42 80 0d`
  (start code + SPS profile baseline 3.1). VALIDADO.
- Test de modulo Python: `ScrcpyRawStreamer.attach_subscriber` recibe 17.323 bytes
  /5s = 51 chunks, primer byte Annex-B IDR. VALIDADO.
- Test E2E full: arrancar Python server completo, conectar WS desde cliente Python
  externo, recibir 41 chunks/5s. Header SPS+PPS+SEI valido. VALIDADO.

**Pendiente:**
- Smoke E2E desde Electron con `.11` corriendo Spotify para confirmar bypass
  FLAG_SECURE en la UI real.
- UI de presets (selector Eco/Balanced/Pro) en Settings -> FlowVideo.
- Si el `bitmaprenderer` da problemas de calidad en algun device, swap a
  `transferToImageBitmap` + `drawImage`.

---

## CAMBIOS PREVIOS (2026-05-28 AM) - Etapa C v1 "WebCodecs sobre fMP4 C#"

(Esta version quedo como referencia historica. NO usar.)
- Cliente WebCodecs con parser fMP4 que apuntaba a backend C#
  (`ws://localhost:5000/api/videostream/ws/<serial>`).
- Backend C# usaba `scrcpy.exe --record=- --record-format=mp4` -> stdout.
- Problema: `--record=-` con mp4 buffera el `moov` hasta cerrar el archivo, asi
  que el live stream nunca arranca. Fix `--record-format=mp4` aplicado pero el
  fundamental problema persistio.
- **Pivot a raw H.264 nativo (arriba)** resuelve todo.

---

## ULTIMOS CAMBIOS (2026-05-27) - Etapa B "FlowAgent Monolito" cerrada en codigo

**Spec:** `.kiro/specs/flowagent-monolito/` (Fases 0-7 completas, Fase 8-9 diferidas a sesion de despliegue, Fase 10 = este resumen).

**Que es:** FlowAgent ahora es un APK monolitico que embebe AutoJs6 v6.7.0 + OpenCV 4.8.0 + MLKit OCR + Rhino. Reemplaza al FlowAgent 0.3.8 (50KB, codigo Java + d8 artesanal) y al AutoJs6 standalone (Etapa A). Un solo APK de ~100MB con toda la capacidad de Laixi (motor de scripts, OCR, OpenCV) y la firma identica al FlowAgent 0.3.8 desplegado, asi `pm install -r` reemplaza in-place sin perder permisos.

**Componentes nuevos (codigo, sin desplegar):**

| Archivo | Que hace |
|---|---|
| `flow_agent_monolito/` | Fork de AutoJs6 v6.7.0 con tag estable + cambios FlowAgent. Compila con Gradle 9.4 + JDK 21, output `agent-v1.0.0-arm64-v8a.apk` (102 MB, firmado). |
| `flow_agent_monolito/sign.properties` | Apunta al keystore `flow_agent_apk/flowagent-debug.keystore`, alias `androiddebugkey`. SHA-256 verificado identico al APK 0.3.8 desplegado. |
| `flow_agent_monolito/version.properties` | `VERSION_NAME=1.0.0`, `VERSION_BUILD=99` (auto-increment lo lleva a 100 al construir). |
| `app/src/main/java/com/flowlogin/agent/runner/ScriptRunner.java` | Bridge motor scripts AutoJs6 (Rhino). Comandos: `run_script`, `stop_script`. |
| `app/src/main/java/com/flowlogin/agent/runner/OcrBridge.java` | Bridge MLKit Text Recognition (latino + chino). Comando: `ocr_detect`. |
| `app/src/main/java/com/flowlogin/agent/runner/OpenCvBridge.java` | Bridge OpenCV `matchTemplate` con `TM_CCOEFF_NORMED`. Comando: `image_match_template`. |
| `local_adb_server.py` | 4 endpoints nuevos: `POST /flowagent/run-script`, `/flowagent/stop-script`, `/flowagent/ocr-detect`, `/flowagent/find-template`. |

**Diseno clave:**

- Namespace Android: `org.autojs.autojs6` (interno; no se puede cambiar sin romper miles de imports).
- `applicationId`: **`com.flowlogin.agent`** (publico, igual al 0.3.8 deplegado).
- AutoJs6 launcher aliases (`AdaptiveIconAlias`) deshabilitados en el manifest para evitar dos iconos en el drawer.
- `ScreenCaptureThread` expone singleton `getInstance()` + `snapshotLatestBitmap()` para que `OcrBridge` y `OpenCvBridge` reusen el bitmap del MediaProjection activo (evita abrir un VirtualDisplay paralelo, que Android < 14 no soporta).
- MainActivity vertical (`android:screenOrientation="portrait"`), Material 3 (`Theme.Material3.DayNight.NoActionBar`), paleta cyan `#22d3ee` consistente con el dashboard, boton "Activar todo" que encadena los 3 permisos.
- Iconos de la app generados desde `icono.png` 280x280 a 5 densidades + foreground adaptativo + monochrome (Android 13+).

**Validacion automatica via ADB hecha en `.43` (Etapa B):**

- Build firmado con la misma SHA-256 que el FlowAgent 0.3.8 deplegado (`3D:03:FC:28:9D:C2:64:68:CA:7D:4E:DD:6C:ED:D3:66:5D:AA:67:F9:CA:DA:13:46:D0:76:DD:C2:C0:F2:56:71`).
- Instalacion en `.43`: `Success`. Pre-requisito: desinstalar AutoJs6 standalone (Etapa A) por conflicto de `permission android.permission.PLUGIN`.
- MainActivity arranca en portrait (1080x1920).
- `FlowAccessibilityService` activable via `settings put secure enabled_accessibility_services com.flowlogin.agent/com.flowlogin.agent.FlowAccessibilityService`.
- `FlowKeyboardService` activable via `ime enable` + `ime set com.flowlogin.agent/.FlowKeyboardService`.
- AutoJs6 + FlowAgent conviven sin crashes (workers, receivers AutoJs6 + MainActivity FlowAgent simultaneos).

**Pendiente (Fase 8 + 9 diferidas):**

- Probar `run_script` con `Login.js` y `GREEN_SONGS_V14_BY_FENIX.js` reales.
- Probar `ocr_detect` y `image_match_template` desde el dashboard.
- Despliegue gradual `.43` (aceptado) -> 3 dispositivos -> 17 totales.
- El "socket en rojo" del dashboard antes de Etapa B es un problema preexistente del FlowAgent 0.3.8 (no se conecta al backend Python en 8766 sin extras correctos del intent). El monolito tiene el mismo codigo, asi que cuando el dashboard lance el FlowAgent con `--es host <pcip> --ei port 8766` ambos se conectan igual.

**Backup operativo:**

- APK FlowAgent 0.3.8 real pulleado del `.41` y guardado en `flow_agent_apk/backup_0_3_8/flowagent-0.3.8-from-41.apk` (50.847 bytes). Sirve como rollback inmediato (`adb install -r ...`).

---

## RESUMEN EJECUTIVO

FlowDashboard Pro es un dashboard Electron para administrar telefonos Android por ADB WiFi. Permite ver en vivo la pantalla de dispositivos, repartir cuentas, ejecutar FlowLogin/FlowRegister y monitorear el estado de cada dispositivo.

**Estado actual (2026-05-25):** Streaming en vivo funcionando con APK FlowAgent 0.3.7. Sin parpadeo. Arranque automatico con un solo bat. FlowCategory completo con rubber-band, drag & drop, collapse/expand. Slider de gap entre dispositivos. Popover de cuentas redimensionable. Tooltip de bolitas con position:fixed encima de contenedores. Sidebar Electron actualizado con nuevas categorias principales `Planes`, `Configuración` y `Help`, modal comercial de planes en USD, modal de ayuda, bloque inferior informativo con email e iconos compactos, y version dinamica visible en sidebar y titlebar. **Modo Desarrollador (Dev Mode Inspector) Fases 1-3 completadas** — toggle pill-slider, inspector de 3 paneles, 12 endpoints Python `/inspector/*`, frontend completamente conectado con backend.

---

**Estado producto Electron (2026-05-25):** Electron es el producto final. `wsapi_demo.html` queda como legado. `abrir_electron.bat` es el lanzador principal y solo debe iniciar servicios necesarios: ADB, backend C# (`5000`), servidor Python (`8765`), socket FlowAgent (`8766`) y Electron. El arranque no debe instalar APKs, lanzar FlowAgent, activar accesibilidad, registrar mappings hardcodeados ni iniciar capturas automaticamente. La deteccion de dispositivos debe ser real desde ADB/escaneo WiFi.

**Cambio funcional 2026-05-26 (FlowKeyboard Fases 0-3 base):**
- Se crea la especificacion viva en `.kiro/specs/flow-keyboard/` con `requirements.md`, `design.md` y `tasks.md`.
- `flow_agent_apk/src/com/flowlogin/agent/FlowKeyboardService.java` agrega un `InputMethodService` llamado `FlowKeyboard`, incluido dentro del APK FlowAgent.
- Recursos nuevos del teclado:
  - `res/xml/flow_keyboard_method.xml`
  - `res/layout/flow_keyboard_view.xml`
  - drawables `flow_keyboard_bg.xml`, `flow_keyboard_key.xml`, `flow_keyboard_key_primary.xml`
  - strings `flow_keyboard_*`
- `AndroidManifest.xml` declara `.FlowKeyboardService` con permiso `android.permission.BIND_INPUT_METHOD`; el teclado queda disponible al instalar FlowAgent, pero no se activa al arrancar Electron.
- `AgentSocketClient.java` reporta metadata `keyboardInstalled`, `keyboardActive`, `keyboardName` en el hello y enruta comandos `keyboard_*` aunque el AccessibilityService no este activo.
- Comandos socket iniciales: `keyboard_status`, `keyboard_type`, `keyboard_clear`, `keyboard_backspace`, `keyboard_enter`, `keyboard_next`, `keyboard_done`.
- `local_adb_server.py` agrega helpers y endpoints:
  - `POST /flowkeyboard/status`
  - `POST /flowkeyboard/prepare`
  - `POST /flowkeyboard/type`
- `prepare_flow_keyboard(...)` solo habilita/selecciona el IME si hace falta (`ime enable` / `ime set`) y no reinstala APKs.
- Electron agrega panel compacto en `Configuracion -> FlowKeyboard` para verificar estado, preparar dispositivos seleccionados y enviar un texto de prueba manual. Nada se ejecuta automaticamente.
- Esta fase no migra FlowLogin todavia; deja FlowKeyboard listo como canal PRO de escritura para integracion futura con scripts `.js`.
- Verificacion local: `python -m py_compile local_adb_server.py` OK y `flow_agent_apk/build_apk.ps1` genera `flow_agent_apk/build/flowagent-debug.apk` correctamente. No se instalo en telefonos durante esta fase.

**Cambio funcional 2026-05-26 (FlowKeyboard Fases 4.4/5 helpers):**
- `local_adb_server.py` agrega `flow_keyboard_command(...)` y endpoint `POST /flowkeyboard/command` para acciones no-texto: `clear`, `backspace`, `enter`, `next`, `done` y `status`.
- `electron-app/src/renderer/app.js` expone helpers seguros en `window.flow.keyboard`:
  - `flow.keyboard.status(options)`
  - `flow.keyboard.type(text, options)`
  - `flow.keyboard.clear(options)`
  - `flow.keyboard.backspace(count, options)`
  - `flow.keyboard.enter(options)`, `flow.keyboard.next(options)`, `flow.keyboard.done(options)`
- Los helpers usan dispositivos seleccionados por defecto, o `options.serial`/`options.deviceIds` cuando se indique; no ejecutan nada al arrancar.
- `FlowDev Action Console` agrega bloque `FlowKeyboard` con `Status`, `Type`, `Clear`, `Backspace`, `Enter`, `Next` y `Done`, respetando `Dry Run`, logs y gating por FlowDev activo.
- Los previews/logs de FlowDev no muestran el texto real enviado; registran longitud para evitar exponer datos sensibles.
- Aun pendiente: migrar Login/Register gradualmente y probar en dispositivo real antes de usarlo en lote.

**Cambio visual 2026-05-26 (Sidebar Electron organizacion final):**
- `electron-app/src/renderer/app.js` reorganiza el menu lateral para acercar Electron al producto principal:
  - `Escanear Red` sale de `Dispositivos` y queda como opcion principal debajo de `Dispositivos` y encima de `FlowCategory`.
  - `Streaming` deja de mostrarse como opcion del menu lateral; las funciones internas existentes quedan intactas.
  - `Planes` ya no muestra la etiqueta lateral `USD`.
  - `Configuracion` se reorganiza en dos subcategorias visuales tipo FlowCategory: `FlowVideo` y `FlowKeyboard`.
  - `Rendimiento` pasa a llamarse `FlowVideo`; el panel de rendimiento se abre desde esa subcategoria.
  - El toggle de FlowDev debajo del logo queda en modo icon-only, sin texto `Normal`/`Dev`.
- `electron-app/src/renderer/styles.css` agrega flechas SVG unificadas a la derecha (`sidebar-collapse-arrow` / `sidebar-link-arrow`) y fija el bloque inferior de email/Login/Licencia al fondo del sidebar con `position: sticky`.
- No se cambiaron endpoints ni flujos de ejecucion; son ajustes visuales/organizativos del dashboard Electron.

**Correccion 2026-05-26 (FlowVideo conserva arranque manual de imagenes):**
- Al quitar `Streaming` como opcion principal del sidebar, el boton manual `Iniciar Streaming` se reubica dentro de `Configuracion -> FlowVideo`.
- Esto mantiene la regla de no iniciar capturas automaticamente al arrancar Electron, pero conserva una accion explicita para iniciar la fuente de frames cuando los canvases de dispositivos quedan en `preparando video`.
- Se evita duplicar IDs del antiguo bloque oculto (`startStreamBtn`, `streamControlsSidebar`) para que `startStreaming()` encuentre los controles visibles de FlowVideo.

**Correccion 2026-05-26 (FlowAgent visible y setup por deviceIds):**
- Se confirmo que la falta de imagen en la grilla no venia de `FlowKeyboard` ni del logo: Electron tenia WebSocket y canvases, pero `/agents` estaba vacio y `adb reverse --list` no tenia `tcp:8766` en dispositivos activos.
- `Configuracion -> FlowVideo` vuelve a mostrar una accion explicita `Preparar FlowAgent`, junto a `Iniciar Streaming`, para recuperar reverse/socket/captura sin ejecutar nada automaticamente al arrancar.
- `setupFlowAgentAll()` ahora envia un unico `POST /flowagent/setup` con `deviceIds` seleccionados, `install: "auto"` y `launch: true`; antes enviaba `serial`, campo que el backend no consume, y podia repetir la preparacion sobre todos los dispositivos.
- `setup_flow_agent(...)` vuelve a configurar ambos reverses necesarios (`tcp:8766` para socket FlowAgent y `tcp:5000` para backend C#).
- `MainActivity` de FlowAgent procesa `onNewIntent(...)` y reinicia `AgentSocketClient` cuando recibe nuevos extras `host`/`serial`/`port`; asi, si el APK ya estaba abierto, preparar FlowAgent no deja el socket pegado a configuracion anterior.
- La accion sigue siendo manual: configura reverse, instala/actualiza solo si hace falta y abre FlowAgent; si Android solicita MediaProjection, el usuario debe aceptar el dialogo en cada telefono.

**Cambio visual/funcional 2026-05-26 (Logo sidebar + cierre FlowDev Fases 3/4):**
- `electron-app/src/renderer/styles.css` define `.sidebar-logo` con `object-fit: contain`, ancho limitado y altura maxima para que `logo.png` se vea completo en el encabezado del sidebar sin recortes.
- Se verifico FlowDev contra `.kiro/specs/dev-mode-inspector/tasks.md`: las tareas 12-20 ya estaban implementadas en `electron-app/src/renderer/inspector.js` y quedaron marcadas como completadas junto con los subchecks 5.1-5.4.
- `electron-app/src/renderer/stream-renderer.js` ahora soporta canvases adicionales por serial (`extraCanvases`) para que el preview del Inspector pinte en paralelo sin reemplazar el canvas del modo normal.
- `electron-app/src/renderer/inspector.js` desacopla el canvas del Inspector al salir de FlowDev y deshabilita controles del Inspector cuando no hay dispositivos conectados.
- La prioridad frontend de fallback/auto-deteccion queda alineada con backend: `uiautomator -> accessibility -> cdp -> dumpsys -> screencap_ocr`.
- `abrir_electron.ps1` limpia `ELECTRON_RUN_AS_NODE` antes de lanzar Electron para evitar que `require('electron').app` llegue como `undefined`, y abre el `electron.exe` local visible en vez de iniciar `npm` dentro de un `cmd` oculto.

**Cambio funcional 2026-05-26 (FlowDev FASE 1 - incremento Action Console):**
- `electron-app/src/renderer/inspector.js` agrega `FlowDev Action Console` básica:
  - acciones: `Tap`, `Back`, `Home`, `Refresh Hierarchy`
  - modo `Dry Run` persistido en `localStorage` (`flowdashboard.inspector.dryRun`)
- Reutiliza canales existentes sin crear vías nuevas:
  - `Tap` -> `/inspector/tap`
  - `Back/Home` -> prioridad `/agent/command` (si hay FlowAgent), fallback `/adb` con `input keyevent`
  - `Refresh Hierarchy` -> `captureUI()` (endpoints `/inspector/*` existentes)
- La consola solo opera cuando FlowDev está activo (`isFlowDevEnabled`); al desactivar FlowDev se oculta y no ejecuta acciones.

**Cambio funcional 2026-05-26 (FlowDev FASE 1 - incremento Selector recomendado):**
- `electron-app/src/renderer/inspector.js` añade bloque `Selector recomendado` dentro de `FlowDev Action Console`.
- Al seleccionar nodo en el árbol/canvas, calcula y muestra un selector recomendado con nivel de confianza (0-100%) y barra visual:
  - prioridad de recomendación: `resourceId` > `text` > `contentDesc` > `class + index`
  - la confianza baja cuando hay valores repetidos en la captura actual o patrones dinámicos (tokens/ids largos/uuid-like).
- El cálculo es local en frontend (sin nuevas rutas backend) y se reinicia al limpiar selección/árbol.
- Se añadieron estilos dedicados en `electron-app/src/renderer/styles.css` para panel de selector y estados visuales de confianza (`is-high`, `is-medium`, `is-low`).

**Cambio funcional 2026-05-26 (FlowDev FASE 1 - incremento Prompt/Diagnóstico/Search details):**
- `electron-app/src/renderer/inspector.js` agrega botón `Copiar prompt para IA` en Action Console:
  - construye prompt contextual del nodo seleccionado (serial, método, selector recomendado, confianza y diagnóstico base) y lo copia al portapapeles.
- Se añade bloque `Diagnóstico base` en Action Console con métricas de captura actual (nodos totales, nodos con bounds, clickables, profundidad promedio, densidad y salud de selector).
- Ajustes finales de búsqueda/details en inspector:
  - la búsqueda ahora muestra `Sin resultados para "..."` cuando no hay coincidencias;
  - con coincidencias, usa contador navegable `actual/total`;
  - el panel de propiedades incluye campos de detalle útiles para depuración (`nodeId`, `method`, `index`, `parent`, `childrenCount`, `searchMatch`).
- Todo el incremento mantiene gating por FlowDev activo y no introduce rutas nuevas de backend.

**Cambio funcional 2026-05-26 (FlowDev FASE 1 - incremento Diagnóstico avanzado por método):**
- `electron-app/src/renderer/inspector.js` ahora conserva contexto de la última detección (`capture` o `auto-detect`) en `lastDetectionInfo` usando únicamente campos ya existentes de respuesta backend: `method_used`, `timings`, `meta`, `cached`.
- El bloque `Diagnóstico base` se amplía a diagnóstico mixto (base + avanzado), mostrando una segunda línea con:
  - método efectivo usado,
  - origen (`capture`/`auto-detect`),
  - estado de caché,
  - timings por método (cuando existen),
  - resumen de `meta` específico por método (`wm`, `pm_dump`, `logcat`, y fallback genérico).
- En capturas sin nodos, el panel conserva la lectura avanzada para no perder visibilidad de timings/meta.
- Se mantienen rutas y contratos actuales; no se añadieron endpoints nuevos ni cambios backend para este incremento.
- `electron-app/src/renderer/styles.css` añade `white-space: pre-line` en `.flowdev-diagnostic-value` para visualizar correctamente el diagnóstico en dos líneas.

**Cambio funcional 2026-05-26 (FlowDev FASE 1 - incremento Diagnóstico contextual por selección):**
- `electron-app/src/renderer/inspector.js` amplía el diagnóstico del Action Console con una tercera línea contextual al nodo seleccionado.
- El nuevo bloque contextual combina información existente (sin endpoints nuevos):
  - clase objetivo seleccionada,
  - `clickable` y coordenadas,
  - confianza del selector recomendado,
  - método efectivo de detección y timing del método usado,
  - posición en resultados de búsqueda (`actual/total`),
  - alertas de posible inestabilidad por valores dinámicos (`resourceId`, `text`, `contentDesc`).
- Se reutilizan datos locales ya disponibles (`currentNodes`, `selectedNodeId`, `searchResults`, `lastDetectionInfo`) y mantiene compatibilidad con modo normal/FlowDev OFF.

**Cambio funcional 2026-05-26 (FlowDev - Task 24 Persistencia de estado localStorage):**
- `electron-app/src/renderer/inspector.js` implementa `saveState()` y `restoreState()` para estado persistente del Inspector.
- Claves persistidas:
  - `flowdashboard.devMode`
  - `flowdashboard.inspector.detectionMode`
  - `flowdashboard.inspector.selectedSerial`
  - `flowdashboard.inspector.expansionState`
- Compatibilidad hacia atrás: también conserva/lee `flowdashboard.inspector.serial` como clave legacy de serial.
- `restoreState()` se ejecuta al activar Dev Inspector (`onActivate`) y rehidrata método, serial, grupo (`native/web`) y mapa de expansión.
- `saveState()` se dispara en cambios de serial, método de detección, grupo de detección y expansión/colapso de nodos.
- `electron-app/src/renderer/app.js` ahora invoca `devInspector.saveState()` al alternar `flowdashboard.devMode`, manteniendo consistencia entre toggle global y estado del Inspector.

**Cambio funcional 2026-05-26 (FlowDev - Task 21 Auto-detección robusta + fallback):**
- `electron-app/src/renderer/inspector.js` refuerza la auto-detección y captura con aplicación explícita del método efectivo:
  - nuevo `setDetectionMode(mode, options)` para aplicar método, sincronizar grupo (`native/web`), selector UI, chips activos, persistencia y etiqueta.
  - `autoDetect()` ahora consume `POST /inspector/auto-detect`, aplica el método detectado y ejecuta recaptura automática vía `captureUI()`.
- Se añadió fallback automático en `captureUI()` con orden de prioridad compartido (`uiautomator -> accessibility -> cdp -> dumpsys -> screencap_ocr`):
  - si falla el método activo, prueba el siguiente y notifica con toast: `Método [X] falló — usando [Y] como alternativa.`
  - se mantiene estado consistente del método seleccionado y del diagnóstico al resolver fallback.
- Se incorpora tooltip informativo de timings en la etiqueta de método (`#inspectorMethodLabel`) usando los tiempos de auto-detección (`method:ms`), persistidos en `localStorage` (`flowdashboard.inspector.autoDetectTimings`).
- `setDetectionGroup()` y el cambio manual del `<select>` pasan a usar `setDetectionMode()` para evitar divergencias de estado entre grupo/método/UI.
- Sin cambios de backend ni endpoints nuevos; la implementación reutiliza el contrato actual de `inspector/auto-detect` (`method_used`, `timings`).

**Cambio funcional 2026-05-26 (FlowDev - Task 22 Normalización unificada de nodos):**
- `local_adb_server.py` fortalece `normalize_node(raw, method)` para unificar entradas heterogéneas sin romper contrato de nodos del inspector.
- `_parse_bounds_value()` ahora acepta además de `left/top/right/bottom` los formatos `x/y/width/height` y `left/top/width/height`.
- Regla mantenida para consistencia del frontend: si `bounds` no es válido, el nodo queda con `bounds: null`, `centerX: null`, `centerY: null`.
- `normalize_node()` normaliza `children` como lista de ids string no vacíos y preserva metadatos desconocidos en `attributes`.
- `electron-app/src/renderer/inspector.js` ajusta selección visual para nodos sin bounds: al seleccionar un nodo sin coordenadas limpias, se limpia highlight en overlay para evitar rectángulos obsoletos.
- Se corrige el helper de Action Console para gating por coordenadas válidas (`_isNodeActionable` + `_canTapSelectedNode`), manteniendo deshabilitado `Tap` cuando el nodo seleccionado no tiene centro válido.
- `.kiro/specs/dev-mode-inspector/tasks.md` queda actualizado con Task 22 marcada como completada.

**Cambio funcional 2026-05-26 (FlowDev - Task 23 Toasts y manejo de errores sin bloqueo):**
- `electron-app/src/renderer/inspector.js` endurece `showToast(msg, color, duration)` para evitar bloqueos de UI y manejar fallos de DOM de forma segura.
- El toast ahora usa `background` con texto blanco para mejor contraste y respeta una duración mínima segura.
- Si el DOM no está disponible y el tono es de error (`#FF4444`/`#ff4466`), se aplica fallback no bloqueante en `#inspectorPropsTable` con texto rojo (`#FF4444`) y escape de contenido.
- `_showError()` pasa a usar tono `#FF4444` para alinear el fallback de errores críticos.

**Cambio funcional 2026-05-26 (FlowDev - Task 4.1 parse_ui_xml reutilizable):**
- `local_adb_server.py` agrega `parse_ui_xml(xml_string, method="uiautomator")` para centralizar parseo XML del inspector y reutilizar `_xml_to_nodes(...)`.
- `/inspector/dump` ahora genera `xml_str` desde `dump_ui(...)` y construye nodos usando `parse_ui_xml(...)`.
- `/inspector/blind-search` migra a la misma ruta de normalización (`parse_ui_xml(...)`) para mantener formato consistente de nodos y resultados.
- Se limpia typo en `inspector_blind_search` (`text = String = ...` -> `text = ...`) para evitar ruido/ambigüedad en backend.

**Cambio funcional 2026-05-26 (FlowDev - Task 6 blind-search):**
- `local_adb_server.py` refuerza `inspector_blind_search(body)` con validación explícita de `field` (`any`, `text`, `resourceId`, `class`) y error HTTP 400 para valores no soportados.
- Se agrega normalización tolerante para `field=resourceid` (case-insensitive) mapeando internamente a `resourceId`.
- Se mantiene búsqueda case-insensitive sobre nodos normalizados provenientes de `parse_ui_xml(...)` para asegurar consistencia con `/inspector/dump`.

**Cambio funcional 2026-05-26 (FlowDev - Task 7 accessibility-dump):**
- `local_adb_server.py` actualiza `inspector_accessibility_dump(body)` para intentar primero `agent_result(..., {"name":"get_accessibility_tree"}, timeout=10)`.
- Si el agente no soporta ese comando o no retorna nodos, aplica fallback seguro a `agent_dump(..., timeout=10)` para mantener compatibilidad con APK actual.
- Se estandariza manejo de timeout en el endpoint: errores con `timeout`/`no respondio a tiempo` retornan HTTP 408 con mensaje específico.
- Los nodos siguen normalizados vía `normalize_node(..., "accessibility")` y cacheados por serial.

**Cambio funcional 2026-05-26 (FlowDev - Task 8 native-detect):**
- `local_adb_server.py` amplía `inspector_native_detect(body)` para cubrir rutas nativas con salida normalizada:
  - `viewserver`: habilita `service call window 1 i32 4939`, abre `adb forward tcp:4939 tcp:4939`, consulta `LIST` por socket local y normaliza ventanas detectadas vía `normalize_node(..., "viewserver")`.
  - `wm`, `pm_dump`, `logcat`: ahora retornan al menos un nodo de contexto normalizado (además de `meta`) para mantener consistencia con el contrato unificado del Inspector.
- Se asegura cleanup de `adb forward --remove tcp:4939` en bloque `finally` para evitar forwards colgados.
- `screencap_ocr` permanece con respuesta explícita 501 cuando falta dependencia OCR en el host.
- `inspector_native_detect` y `inspector_web_detect` normalizan `method` con `strip().lower()` para tolerar mayúsculas/minúsculas en clientes.
- `inspector_auto_detect` amplía prioridad a `uiautomator -> accessibility -> cdp -> dumpsys -> screencap_ocr`, dejando trazabilidad de timings también para OCR.

**Cambio funcional 2026-05-26 (FlowDev - Task 9 CDP connect/dump):**
- `local_adb_server.py` agrega helpers CDP reutilizables:
  - `_cdp_get_targets(serial)` para forward + GET `/json` con validación robusta de payload.
  - `_cdp_ws_call(...)` para requests CDP por WebSocket con correlación por `id`.
  - `_cdp_extract_bounds_from_box_model(...)`, `_cdp_collect_node_ids(...)`, `_cdp_fetch_bounds_map(...)` para obtener bounds por nodo usando `DOM.getBoxModel`.
- `inspector_cdp_connect(body)` ahora retorna lista de targets normalizada y validada, con errores 503 específicos cuando CDP no está disponible.
- `inspector_cdp_dump(body)` ahora:
  - resuelve target por `target_id` o primer target disponible,
  - ejecuta `DOM.getDocument` + `DOM.querySelectorAll('*')`,
  - calcula bounds para nodos del árbol,
  - normaliza nodos web con atributos enriquecidos (`textContent`, `href`, `src`, `type`, `value`, `disabled`, `hidden`, `nodeId`, `backendNodeId`),
  - devuelve `meta` con trazabilidad (`target_id`, `target_count`, `dom_node_count`, `query_selector_total`, `bounds_count`).

**Cambio funcional 2026-05-26 (FlowDev - Task 10 web-detect):**
- `local_adb_server.py` ajusta `inspector_web_detect(body)` para normalizar `method` con `strip().lower()` y aceptar `options`.
- Para `js_inject`, `react_native`, `ionic`, `flutter`, el endpoint valida CDP activo y reutiliza `inspector_cdp_dump(...)` con `target_id` explícito.
- La respuesta ahora conserva `nodes` unificados y añade metadata específica por método (`web_method`, `target_id`, `target_count`) para trazabilidad.
- Cada nodo web incorpora señales por método en `attributes`:
  - `webMethod`, `targetId`
  - `reactHint` (React Native), `ionicHint` (Ionic), `flutterHint` (Flutter), `jsInjectHint` (JS Inject).
- `network_intercept` se mantiene con 501 explícito cuando falta mitmproxy en host.

**Cambio funcional 2026-05-26 (FlowDev - Task 11 auto-detect):**
- `local_adb_server.py` fortalece `inspector_auto_detect(body)` con validación de nodos por método usando helper `_auto_detect_has_valid_nodes(nodes)`.
- Se mantiene el orden de prioridad requerido: `uiautomator -> accessibility -> cdp -> dumpsys -> screencap_ocr`.
- La respuesta exitosa ahora incluye ambos campos de método para compatibilidad (`method` y `method_used`) junto con `nodes` y `timings`.
- En fallos, el endpoint devuelve `attempts` con trazabilidad por método (`status`, `ok`, `has_nodes`, `error`) además de `timings`.

**Cambio APK 2026-05-25:** FlowAgent 0.3.7 corrige la identidad visible del telefono en Android 9. El serial mostrado y enviado por socket es el serial ADB WiFi (`IP:5555`) inyectado por el dashboard o derivado desde la IP WiFi. El APK ya no borra el serial guardado al reconectar y ya no usa `Build.SERIAL` como fallback visible, porque en Android 9 puede venir vacio/unknown para apps normales. Si no hay serial WiFi, la pantalla muestra `android:<ANDROID_ID>` solo como respaldo. Cuando `FlowAccessibilityService` conecta, reinicia el socket para enviar un hello actualizado con `accessibility=true`. La UI de captura ahora refleja `MediaProjectionHolder` en vez de mostrar siempre inactiva.

**Cambio APK 2026-05-26:** FlowAgent sube a 0.3.8 (versionCode=19). Esta version conserva FlowKeyboard y corrige el relanzamiento desde Electron: `MainActivity.onNewIntent(...)` guarda nuevos extras `host`/`serial`/`port` y reinicia `AgentSocketClient`, evitando que un APK ya abierto quede sin reconectar al preparar FlowAgent.

**Planificacion 2026-05-26 (FlowTouch - control mouse/touch):**
- Se crea punto de restauracion local `restore_points/PuntoAntesdeltouch` antes de implementar control por mouse.
- El punto contiene `git-status-short.txt`, `tracked-changes.diff`, `tracked-files-changed.txt` y copia de archivos runtime criticos de Electron, FlowAgent, servidor Python y specs actuales.
- Se crea la especificacion viva en `.kiro/specs/flow-touch/`:
  - `requirements.md`
  - `design.md`
  - `tasks.md`
- Estado: planificacion solamente. No hay listeners de mouse, taps, swipes ni comandos nuevos activos.
- Enfoque aprobado: **Focus Mode + FlowTouch PRO**. FlowTouch empieza Off; doble click sobre una tarjeta abre una vista grande enfocada del dispositivo; FlowTouch se activa solo dentro de esa vista y solo para ese serial; al cerrar la vista, FlowTouch vuelve a Off y se desmontan listeners.
- Ideas PRO incluidas en la planificacion: header con nombre/serial/estado FlowAgent/FPS, overlay de gesto, botones Back/Home/Recents, anterior/siguiente dispositivo, cierre con `Esc`, historial corto de gestos sin datos sensibles y modo seguro opcional con boton `Activar control`.
- La grilla no envia taps a Android: el doble click en tarjeta solo abre Focus Mode. Los taps/swipes reales solo existen dentro del canvas enfocado.
- Enfoque tecnico previsto: modulo aislado `FlowTouchController` + helper `FlowTouchFocus`, coordenadas desde canvas enfocado, comandos por FlowAgent socket y fallback ADB solo si se autoriza explicitamente.
- Reglas de seguridad: no instalar APKs al arrancar, no activar accesibilidad, no iniciar capturas automaticamente, no tocar FlowLogin/FlowRegister en fases iniciales y documentar cada fase antes de marcarla completada.

**Implementacion 2026-05-26 (FlowTouch Fases 1/2 base sin comandos Android):**
- Se agrega `electron-app/src/renderer/flow-touch.js` con `FlowTouchController` y helper `FlowTouchFocus`; el controlador se instancia desde `app.js`, pero no activa listeners de tap/swipe al arrancar.
- `electron-app/src/renderer/index.html` carga `flow-touch.js` antes de `app.js`.
- Doble click sobre una tarjeta de dispositivo llama `openFlowTouchFocus(serial)` y abre Focus Mode grande para ese serial. El doble click solo abre la vista enfocada; no envia taps, swipes ni comandos Android.
- Focus Mode reutiliza el stream existente mediante `streamRenderer.createCanvas(serial, ..., existingCanvas)` y al cerrar desacopla el canvas extra con `streamRenderer.detachCanvas(...)`, sin reemplazar el canvas normal de la grilla.
- Cerrar con boton o `Esc` limpia intervalo de estado FlowAgent, listeners de teclado, clase visual de tarjeta enfocada y deja FlowTouch Off.
- Los botones Back/Home/Recents se muestran deshabilitados hasta la fase de comandos reales; anterior/siguiente dispositivo solo cambia el Focus Mode.
- Se agregan estilos aislados en `electron-app/src/renderer/styles.css` para overlay, header, quickbar, canvas enfocado, historial e indicador de tarjeta enfocada.
- Verificacion local: `node --check electron-app/src/renderer/app.js` OK, `node --check electron-app/src/renderer/flow-touch.js` OK, carga DOM headless de `index.html` sin `pageerror`, `FlowTouchController.openFocus(...)` crea overlay y `Esc` lo cierra, `/agents` reporta 17 agentes FlowAgent 0.3.8 con accessibility=true, `/api/streaming/stats` reporta `cachedFrames=17` y `/login-status` no reporta jobs activos.
- Pendiente tras esta base: activar tap manual dentro del canvas enfocado, agregar swipe y gestos avanzados. No se modifico backend ni APK en esta fase.

**Implementacion 2026-05-26 (FlowTouch Fase 3 - coordenadas sin comandos Android):**
- `electron-app/src/renderer/stream-renderer.js` agrega metricas locales por serial (`frameStats`) y metodo `getFrameStats(serial)` para exponer FPS suavizado, contador y edad del ultimo frame. No cambia la recepcion ni el pintado de frames.
- `electron-app/src/renderer/flow-touch.js` agrega `CoordinateMapper`, usando `clientX/clientY`, `getBoundingClientRect()`, `canvas.width/height` y clamp a limites validos.
- Focus Mode muestra ahora un pill de FPS/edad de ultimo frame en el header.
- Movimiento/click sobre el canvas enfocado actualiza solo diagnostico local de coordenadas y dibuja un marcador visual temporal; no envia `tap`, `swipe`, `back`, `home`, `recents` ni ningun comando Android.
- Al cerrar Focus Mode se retiran listeners de coordenadas, intervalos de estado y canvas extra.
- Verificacion local: `node --check` OK en `app.js`, `flow-touch.js` y `stream-renderer.js`; prueba DOM headless valida overlay/cierre con `Esc`, marcador local, FPS visible y `CoordinateMapper` con tamaños 180x320, 360x640 y 540x960, incluyendo clamp fuera de borde.
- Pendiente tras Fase 3: ruteador de comandos y tap manual real dentro del canvas enfocado.

**Implementacion 2026-05-26 (FlowTouch Fase 4 - tap manual con armado explicito):**
- `flow-touch.js` agrega `FlowTouchCommandRouter`, que resuelve el agente por serial desde `/agents` y envia comandos por `POST /agent/command`.
- Focus Mode incorpora boton `Activar control`. Por defecto el control sigue Off: clicks sobre el canvas solo mapean coordenadas y dibujan marcador local.
- Al activar control, primero se valida que el FlowAgent del serial exista y tenga `accessibility=true`; si no, el estado muestra error y no se arma el canvas.
- Con control activo, un click dentro del canvas enfocado envia solo `tap` al serial activo. Se mantiene debounce/rate limit simple y `commandInFlight` para evitar duplicados rapidos.
- El estado visual pasa por `Enviando tap`, `Control activo` o `Error de tap`, y el historial registra coordenadas/resultado sin datos sensibles.
- Al cerrar Focus Mode se ejecuta `disableControl()`, se retiran listeners y queda Off.
- Verificacion local: `node --check` OK; prueba DOM headless con `fetch` simulado confirma que un click sin armar no llama `/agent/command`, y con control activo genera `{name:"tap", x:180, y:320}` para el agente resuelto. No se ejecuto tap real sobre telefono en esta fase automatizada.
- Estado real posterior: `/api/streaming/stats` sigue en `cachedFrames=17` y `/login-status` no reporta jobs activos.
- Pendiente: prueba manual real de tap en un telefono enfocado, luego swipe/drag y botones Back/Home/Recents.

**ADB empaquetado:** Todo el producto debe usar `scrcpy-win64-v4.0\adb.exe`. No se debe depender de ADB instalado en el PC, Android Studio, Android SDK del usuario, PATH global ni `C:\adb`.

## ARQUITECTURA COMPLETA

```
[Telefonos Android]
    ↕ ADB WiFi (192.168.1.XX:5555)
    ↕ ADB Reverse tcp:8766 y tcp:5000
[PC Windows]
    ├── local_adb_server.py (Python, puerto 8765/8766)
    │     ├── HTTP API en puerto 8765
    │     ├── Socket FlowAgent en puerto 8766 (recibe hello/frame de APKs)
    │     └── Reenvía frames a backend C# via POST /api/streaming/frames
    ├── FlowDashboard.Core (C#, puerto 5000)
    │     ├── API REST en puerto 5000
    │     ├── WebSocket streaming en /ws/streaming
    │     ├── DeviceMappingService (androidId ↔ serialIP)
    │     └── StreamingWebSocketService (broadcast frames a Electron)
    └── electron-app/ (Electron)
          ├── app.js (renderer principal)
          ├── stream-renderer.js (canvas WebP, ImageBitmap)
          └── index.html
```

---

## FLUJO DE STREAMING

```
APK FlowAgent (Android)
  → captura pantalla via MediaProjection (100ms/frame)
  → comprime a WebP (Android 9: WEBP, Android 10+: WEBP_LOSSY)
  → envía JSON {type:"frame", serial:"androidId", data:"base64", format:"webp"}
  → via socket TCP a localhost:8766 (ADB reverse redirige al PC)

Python (local_adb_server.py)
  → recibe mensaje tipo "frame" en handle_agent_socket()
  → usa agent.agent_id como serial del frame
  → POST http://localhost:5000/api/streaming/frames

Backend C# (StreamingWebSocketService)
  → recibe frame en /api/streaming/frames
  → broadcast a clientes WebSocket suscritos en /ws/streaming

Electron (stream-renderer.js)
  → recibe frame via WebSocket
  → busca canvas por serial o por androidId (via deviceMappings)
  → decodifica con createImageBitmap() (sin parpadeo)
  → dibuja en canvas HTML
```

---

## ARCHIVOS CLAVE

### APK FlowAgent
- **Ubicacion:** `flow_agent_apk/`
- **APK compilado:** `flow_agent_apk/build/flowagent-debug.apk`
- **Version actual:** 0.3.8 (versionCode=19)
- **Compilar:** `powershell -ExecutionPolicy Bypass -File flow_agent_apk/build_apk.ps1`

**Archivos Java importantes:**
- `AgentSocketClient.java` — socket TCP al backend, buildHello() con serial ADB WiFi estable
- `FlowAccessibilityService.java` — servicio de accesibilidad, resuelve identidad ADB WiFi al conectar
- `DeviceIdentity.java` — helper comun para serial WiFi ADB y fallback Android ID
- `ScreenCaptureThread.java` — captura pantalla con MediaProjection, usa rowStride correcto
- `MediaProjectionHolder.java` — almacena MediaProjection globalmente para que el servicio lo use
- `MainActivity.java` — lee Intent extras (host/serial/port), guarda en SharedPreferences

**Notas importantes APK:**
- Android 9 (API 28): usa `Bitmap.CompressFormat.WEBP` (no WEBP_LOSSY)
- En Android 9 no usar `Build.SERIAL` para licencia/identidad visible; puede salir vacio o `unknown`.
- El serial principal es el serial ADB WiFi `IP:5555`, primero desde Intent extra `serial` y luego desde `WifiManager.getConnectionInfo().getIpAddress()`.
- El serial se guarda en SharedPreferences "flow_agent" clave "serial"
- El socket espera 2 segundos al arrancar para que WifiManager esté listo
- MediaProjection se obtiene en MainActivity.onActivityResult() y se guarda en MediaProjectionHolder
- El diálogo de captura de pantalla debe aceptarse manualmente en cada teléfono (seguridad Android)

### Backend C#
- **Ubicacion:** `FlowDashboard.Core/`
- **Puerto:** 5000
- **Iniciar:** `dotnet run` en la carpeta FlowDashboard.Core

**Archivos C# importantes:**
- `Program.cs` — middleware WebSocket en /ws/streaming, registra/desregistra clientes
- `Services/StreamingWebSocketService.cs` — broadcast frames, métodos RegisterClient/UnregisterClient
- `Services/DeviceMappingService.cs` — persiste mappings en device_mappings.json
- `Controllers/StreamingController.cs` — endpoint POST /api/streaming/frames
- `Controllers/DevicesController.cs` — endpoints /api/devices/mapping/{serial} y /api/devices/register

**Mappings persistidos:**
El archivo `device_mappings.json` se guarda en la raíz del proyecto (no en bin/Debug).
Los mappings son: serialIP → androidId
```
192.168.1.11:5555 → ec3d6b5297d0bc95
192.168.1.38:5555 → ab496ae532e2b3d4
192.168.1.39:5555 → 1eb64864d12325b6
192.168.1.40:5555 → 392ec79b232ce8f5
192.168.1.41:5555 → ca620dc1686ace0a
192.168.1.42:5555 → 584dcbc53ac8c631
192.168.1.43:5555 → 95fd186385d0d5a4
192.168.1.44:5555 → d2a18d6000029708
192.168.1.45:5555 → ca277a41916ad1ae
192.168.1.46:5555 → 1bb5218574279d85
192.168.1.47:5555 → b94945429d96e5f3
192.168.1.48:5555 → cb610076f5377904
192.168.1.49:5555 → f3761412899f2a69
192.168.1.50:5555 → b9304649ecf3816a
192.168.1.51:5555 → 1f7ea381dd02e951
192.168.1.52:5555 → 8bf237baa8b83964
192.168.1.53:5555 → bf391ad042f30dc7
```

### Servidor Python
- **Archivo:** `local_adb_server.py`
- **Puerto HTTP:** 8765
- **Puerto Socket APK:** 8766
- **Iniciar:** `python -u local_adb_server.py`

**Cambios importantes en local_adb_server.py:**
- `handle_agent_socket()` maneja mensaje tipo "frame" → reenvía a C# con agent.agent_id como serial
- Al recibir "hello", registra mapping androidId→serialIP en backend C# automaticamente
- Al recibir "hello" con accessibility=true, envía comando capture_screen_start automaticamente
- El serial del agente se obtiene de la IP de conexion (address[0]) como fallback

### Electron App
- **Ubicacion:** `electron-app/`
- **Iniciar:** `npm start` en electron-app/

**Archivos Electron importantes:**
- `src/renderer/app.js` — app principal
- `src/renderer/stream-renderer.js` — renderizado de frames WebP con ImageBitmap
- `src/renderer/styles.css` — estilos

**Cambios importantes en app.js:**
- `loadDevices()` solo llama `renderDevices()` si la lista de dispositivos cambió (evita parpadeo)
- `startPolling()` — polling de dispositivos cada 30s (no cada 5s)
- `statusPollingInterval` — actualiza solo los puntos de estado, NO llama renderDevices()
- `toggleDevice()`, `selectAll()`, `deselectAll()` — actualizan clases CSS sin rerenderizar DOM
- `deviceMappings` — mapa androidId→serialIP para resolver frames
- `createCanvasesForVisibleDevices()` — limpia canvas destruidos del DOM antes de recrear
- `updateStatusDots()` — actualiza puntos de estado sin destruir canvas
- `deviceGap` — gap entre dispositivos, slider en sidebar debajo del zoom, persiste en localStorage
- `setDeviceGap(value)` — actualiza CSS variable `--device-gap` en el deviceList
- `showDotTooltip(event, serial, clone)` — tooltip de bolitas con position:fixed, z-index:99999, encima de contenedores
- `hideDotTooltip()` — oculta tooltip con delay de 80ms para permitir hover sobre botones
- `renderAccountDots()` — ya no incluye `.account-dot-info` ni `.account-dot-tooltip` inline; usa eventos mouseenter/mouseleave

**Cambios importantes en stream-renderer.js:**
- `renderFrame()` usa `createImageBitmap()` para decodificación sin parpadeo
- `handleFrameMessage()` busca canvas por serial directo o por androidId via deviceMappings

---

## SCRIPTS DE UTILIDAD

| Script | Descripcion |
|--------|-------------|
| `abrir_electron.bat` | **LAUNCHER PRINCIPAL ELECTRON** - inicia servicios y Electron sin instalar APKs |
| `INICIAR_FLOWDASHBOARD.bat` | Legacy; no usar para producto final |
| `INICIAR_FLOWDASHBOARD.ps1` | Legacy; contiene automatizaciones antiguas |
| `setup_devices_full.ps1` | Utilidad manual; instala APK, activa accesibilidad, configura reverse y lanza APKs bajo decision explicita |
| `only_reverse.ps1` | Solo configura ADB reverse en todos los dispositivos |
| `fix_mappings.ps1` | Registra los 17 mappings correctos en backend C# |
| `start_capture_all.ps1` | Envía capture_screen_start a todos los agentes |
| `reinstall_parallel.ps1` | Desinstala e instala APK en paralelo en todos |
| `install_batches.ps1` | Instala APK en lotes de 5 |
| `launch_apk_with_serial.ps1` | Lanza APK con serial correcto via Intent |
| `connect_missing.ps1` | Conecta dispositivos que faltan por ADB |
| `check_agents.ps1` | Verifica agentes conectados y sus seriales |
| `check_apk_version.ps1` | Verifica versión del APK instalada en dispositivos |
| `watchdog_reverse.ps1` | Mantiene ADB reverse activo (ejecutar en background) |
| `reactivate_accessibility.ps1` | Reactiva accesibilidad via ADB sin Laixi |
| `fresh_start_apk.ps1` | pm clear + accesibilidad + reverse + lanzar |
| `sync_mappings.ps1` | Sincroniza mappings de Python a C# |

---

## PUERTOS

| Puerto | Servicio | Proceso |
|--------|---------|---------|
| 5000 | Backend C# (HTTP + WebSocket) | FlowDashboard.Core |
| 5037 | ADB Server | adb.exe |
| 8765 | Python HTTP API | local_adb_server.py |
| 8766 | Socket FlowAgent (APKs) | local_adb_server.py |
| 8767 | WebSocket streaming legacy | local_adb_server.py |
| 11434 | Ollama (no interfiere) | ollama.exe |

---

## DISPOSITIVOS

17 Samsung Galaxy S8/S8+ (Android 9, API 28)
- IPs: 192.168.1.11, .38-.53 (puerto 5555)
- Modelo: SM-G955U (S8+) y SM-G950U (S8)
- APK objetivo: com.flowlogin.agent v0.3.7

**ADB Reverse necesario en cada dispositivo:**
```
adb -s 192.168.1.XX:5555 reverse tcp:8766 tcp:8766
adb -s 192.168.1.XX:5555 reverse tcp:5000 tcp:5000
```

---

## PROBLEMAS CONOCIDOS Y SOLUCIONES

### Serial vacío en agentes
**Causa:** El servicio de accesibilidad arranca antes de que WifiManager esté listo.
**Solución actual:** FlowAgent 0.3.7 conserva el serial inyectado por el dashboard y reintenta detectar IP WiFi 5 veces. Si sigue vacío, muestra `android:<ANDROID_ID>` como respaldo y el dashboard debe preparar FlowAgent explicitamente para inyectar `IP:5555`.

### Mappings 404 en Electron
**Causa:** El backend C# se reinició y perdió los mappings en memoria.
**Solución:** Ejecutar `fix_mappings.ps1`. Los mappings se persisten en `device_mappings.json` en la raíz del proyecto.

### ADB reverse se cae
**Causa:** Operaciones ADB de otros programas (Laixi, escaneo de red) resetean el reverse.
**Solucion legacy:** Ejecutar `watchdog_reverse.ps1` en background. Para producto Electron, el reverse debe configurarse solo al preparar FlowAgent de forma explicita.

### Captura inactiva en APK
**Causa:** MediaProjection no disponible (diálogo no aceptado o Laixi ocupando la captura).
**Solución:** Cerrar Laixi completamente, abrir el APK manualmente y aceptar el diálogo de captura.

### Parpadeo en el streaming
**Causa:** `renderDevices()` destruía el DOM cada 2 segundos (statusPollingInterval).
**Solución:** Ya corregido — statusPollingInterval solo actualiza puntos de estado, no rerenderiza.

### Imagen distorsionada
**Causa:** `imageToBitmap()` no usaba `rowStride` correctamente.
**Solución:** Corregido desde APK 0.3.3 usando `copyPixelsFromBuffer()` con rowStride.

### Laixi interfiere con el streaming
**Causa:** `youhu.laixijs` (APK de Laixi en teléfonos) captura pantalla via scrcpy, bloqueando MediaProjection.
**Solución:** Desinstalar Laixi del PC y del APK en teléfonos. Usar `setup_devices_full.ps1` para gestionar permisos sin Laixi.

---

## FLUJO DE ARRANQUE CORRECTO

1. Ejecutar `abrir_electron.bat`.
2. Usar el escaner/conexion del dashboard Electron para conectar dispositivos ADB WiFi.
3. Preparar o instalar FlowAgent solo desde una accion explicita del usuario.
4. Si es primera instalacion del APK: aceptar el dialogo de captura en cada telefono.

---

## NOTAS PARA PRODUCTO VENDIBLE

- El diálogo de MediaProjection (captura de pantalla) debe aceptarse manualmente en cada teléfono — es una restricción de seguridad de Android que no se puede automatizar.
- Los mappings androidId/serialIP no deben depender de scripts hardcodeados en el producto final.
- Para nuevos dispositivos: conectar por ADB WiFi desde Electron, preparar FlowAgent manualmente y dejar que el APK reporte su androidId.
- El watchdog/reverse no debe arrancar automaticamente con Electron; se debe aplicar cuando el usuario prepare FlowAgent o inicie streaming.
- No usar Laixi mientras el dashboard está activo — compite por MediaProjection y ADB.
- En scripts operativos de lote, evitar `am force-stop com.flowlogin.agent` durante recuperacion normal porque puede tumbar el servicio y degradar la conectividad masiva de agentes; preferir relanzar `MainActivity` sin force-stop.
- `launch_apk_all.ps1` y `relaunch_fresh.ps1` quedaron endurecidos para relanzar sin `force-stop` y con extras (`host`, `serial`, `port`, `autoconnect`) para mantener handshake estable del agente.
- El endpoint Python `/agents` expone metadata aplanada (`serial`, `agentVersion`, `accessibility`) en el nivel raiz de cada agente; scripts PowerShell deben leer esos campos directos y no `meta.*`.
- La metrica `cachedFrames` del backend C# (`/api/streaming/stats`) representa cantidad de seriales con ultimo frame en cache y puede mantenerse en 17 aunque el comando actual `capture_screen_start` falle en varios dispositivos por permiso MediaProjection pendiente.
- Verificacion operativa Fase 2/3 (2026-05-25): 3 ciclos consecutivos con `A11Y_OK=17/17`, `REV_OK=17/17`, `AGENT_OK=17/17`, `CAPTURE_OK=17/17`; APK base validado en `versionName=0.3.7`, `versionCode=18` en los 17 equipos. La correccion de reconexion queda en FlowAgent 0.3.8.


**Verificacion 2026-05-26 (FlowTouch Fase 4 - tap real end-to-end):**
- Se valido el canal completo de FlowTouch replicando el payload exacto del Focus Mode (`POST /agent/command` con `{agentId, command:{name:"tap", x, y}, timeout:8}`).
- Estado base verificado: 17 agentes FlowAgent 0.3.8 con `accessibility=true`, `cachedFrames=17`, sin jobs activos.
- Taps reales ejecutados:
  - `192.168.1.43:5555 (10,10)` -> HTTP 200, `result.ok=true`, `message:"tap ejecutado"`.
  - `192.168.1.41:5555 (540,1200)` -> HTTP 200, `result.ok=true`, `message:"tap ejecutado"`.
  - `192.168.1.48:5555 (540,960)` -> HTTP 200, `result.ok=true`, `message:"tap ejecutado"`.
- Cadena confirmada: `flow-touch.js` (FlowTouchCommandRouter) -> Python `/agent/command` -> `send_agent_command(...)` -> socket FlowAgent 8766 -> `FlowAccessibilityService.tap(x,y)` en Android.
- Estado posterior: `cachedFrames=17` sin variacion, `runningJobs` vacio, sin instalaciones de APK ni cambios en backend.
- Pendiente confirmar el mismo flujo iniciado desde la UI del Focus Mode (doble click en tarjeta + Activar control + click en canvas) por el usuario, pero el canal ya quedo validado contra FlowAgent real.


**Correccion 2026-05-26 (FlowTouch Focus Mode no carga imagen en dispositivos lentos):**
- Sintoma reportado: doble click sobre `192.168.1.44` y `192.168.1.11` abria Focus Mode pero el canvas grande quedaba en negro hasta llegar el siguiente frame del stream, que en esos telefonos podia tardar varios segundos.
- Diagnostico: WS probe contra `ws://localhost:5000/ws/streaming` durante 4s mostro frames reales para los 4 seriales probados (`.11=1`, `.44=6`, `.43=15`, `.41=12`); los frames si llegan al backend, pero `.11/.44` tienen baja tasa por pantalla mas estatica/bloqueada. El canvas extra adjuntado por `streamRenderer.createCanvas(serial, w, h, existingCanvas)` solo se pintaba al recibir el SIGUIENTE frame, dejando el Focus Mode aparentemente sin imagen.
- Fix en `electron-app/src/renderer/stream-renderer.js`:
  - Nuevo Map `latestFrameBlobs` que conserva el ultimo `Blob` WebP/PNG por serial.
  - `renderFrame(...)` cachea ese blob ademas de pintar canvas principal y extras.
  - Nuevo helper `_hydrateExtraCanvasFromLatest(serial, targetCanvas)` que se llama al adjuntar un canvas extra: decodifica el ultimo blob conocido y lo dibuja, o como fallback copia del canvas del grid si esta pintado. Asi el Focus Mode arranca con la imagen actual sin esperar al proximo frame del stream.
  - `destroyCanvas(serial)` ahora limpia tambien `latestFrameBlobs` para evitar acumulacion.
- Verificacion local: `node --check electron-app/src/renderer/stream-renderer.js` OK; `node --check electron-app/src/renderer/flow-touch.js` OK; ningun cambio en backend, APK, ni protocolo de stream. La copia del ultimo frame es local en el renderer Electron y respeta el flujo existente.


**Correccion 2026-05-26 (FlowTouch tap aparentemente no funciona - mapeo de coordenadas):**
- Sintoma reportado: al entrar al Focus Mode se veia la imagen pero los taps "no funcionaban" o no parecian hacer nada.
- Diagnostico: el canvas del Focus Mode se crea a 360x640, pero la captura de pantalla del APK (`flow_agent_apk/.../ScreenCaptureThread.java`) es 1080x1920 (hardcodeado) y `FlowAccessibilityService.tap(x, y)` usa `dispatchGesture` con coordenadas en el sistema real del display. `CoordinateMapper.fromPointerEvent(...)` devolvia coordenadas dentro del rango del canvas (max 360x640), por lo que un click en el centro visual del Focus Mode mandaba `tap(180, 320)` y caia en la esquina superior izquierda real del telefono.
- Fix en `electron-app/src/renderer/stream-renderer.js`:
  - Nuevo Map `frameSizes` que guarda `{ width, height }` reales del ultimo `ImageBitmap` decodificado por serial.
  - `renderFrame(...)` actualiza `frameSizes` en cada frame.
  - `_hydrateExtraCanvasFromLatest(...)` tambien rellena `frameSizes` si aun no existe.
  - Nuevo metodo publico `getFrameSize(serial)` -> `{ width, height }` o `null`.
  - `destroyCanvas(serial)` limpia tambien `frameSizes`.
- Fix en `electron-app/src/renderer/flow-touch.js`:
  - `CoordinateMapper.fromPointerEvent(event, canvas, frameSize?)` ahora produce dos pares de coordenadas:
    - `canvasX/canvasY` (dentro del canvas visual) para dibujar el marker local en %.
    - `x/y` proyectadas al sistema real del frame (`frameWidth/frameHeight`) que se envian a FlowAgent.
    - Si `frameSize` no esta disponible, el comportamiento actual cae a usar el tamaño del canvas (legacy) para no romper escenarios sin frame todavia.
  - `FlowTouchController._bindCoordinatePreview()` y `_showLocalTapMarker()` pasan/usan el `frameSize` real via nuevo helper `_getFrameSize()` que delega en `streamRenderer.getFrameSize(activeSerial)`.
- Verificacion local (DOM headless minimo):
  - Click center -> `{ x: 540, y: 960 }` con frame 1080x1920 (correcto, centro real del display S8).
  - Click bottom-right -> `{ x: 1079, y: 1919 }`.
  - Click 25/75 -> `{ x: 270, y: 1440 }`.
  - Click center sin frameSize (legacy) -> `{ x: 180, y: 320 }` (comportamiento previo conservado como fallback).
- Verificaciones de sintaxis: `node --check stream-renderer.js` OK, `node --check flow-touch.js` OK.
- No se modifico backend C#, Python ni APK; el fix es 100% local en el renderer Electron.


**Cambio visual 2026-05-26 (FlowTouch Focus Mode ventana ajustada al tamaño del telefono):**
- `electron-app/src/renderer/styles.css` cambia `.flowtouch-focus-shell` de `width: min(1420px, 100%)` a un `clamp(520px, calc(frameWidth + sidePanels*2 + 60px), 980px)`.
- Se centra verticalmente con `align-items: center`, se reduce padding/gap del main, paneles laterales bajan de 178px a 150px y `flowtouch-phone-frame` ahora deriva su ancho del aspect ratio 9/16 con altura util `min(78vh, 720px)`.
- Resultado: la ventana queda del ancho real del telefono mas dos paneles delgados, en vez de una pantalla casi completa con vacio negro alrededor; el canvas mantiene la imagen completa y el calculo de coordenadas no cambia.

**Implementacion 2026-05-26 (FlowTouch Fase 5 - swipe por drag dentro de Focus Mode):**
- `electron-app/src/renderer/flow-touch.js`:
  - `FlowTouchCommandRouter.swipe(serial, x1, y1, x2, y2, durationMs)` envia `{name:"swipe", startX, startY, endX, endY, duration}` por `POST /agent/command`. Duracion clamp 120-1800ms.
  - `FlowTouchController` reemplaza el viejo handler de `click` por `pointerdown/pointermove/pointerup/pointercancel`. `pointermove` solo actualiza diagnostico local y traza, nunca envia comandos.
  - Tap vs swipe: si el desplazamiento canvas en `pointerup` es <= `gestureTapThresholdPx` (6 px) se trata como tap; mas grande, se envia swipe con duracion = tiempo real del drag.
  - `_handleTapGesture`/`_handleSwipeGesture` y `_sendSwipe` reutilizan debounce/`commandInFlight` y `lastCommandAt` para evitar duplicados.
  - Trail visual mediante `_resetGestureTrail`/`_updateGestureTrail`/`_clearGestureTrail` que mueve un elemento DOM con `left/top/%` y `transform: rotate(...)`. Cero datos sensibles.
  - `_unbindCoordinatePreview` desmonta todos los listeners nuevos y limpia el trail al cerrar Focus Mode.
- `electron-app/src/renderer/styles.css` agrega `.flowtouch-gesture-trail` con gradiente cian y punto cabeza.
- Verificacion local:
  - `node --check flow-touch.js` y `node --check stream-renderer.js` OK.
  - DOM headless: el mapper produce `tap (540,960)`, swipe vertical `(540,1498)->(540,691)` y horizontal `(918,960)->(162,960)` para canvas 360x640 con frame 1080x1920. El router construye payloads exactos `{name:"tap"...}` y `{name:"swipe", startX, startY, endX, endY, duration:420}`.
  - Backend real: `POST /agent/command` con `{name:"swipe", startX:540, startY:1500, endX:540, endY:700, duration:350}` contra `192.168.1.43:5555` -> HTTP 200, `result.ok=true, "swipe ejecutado"`. `cachedFrames=17` y `runningJobs` vacio antes/despues.
- No se modifico backend Python, C# ni APK.


**Implementacion 2026-05-26 (FlowTouch Fase 6 - gestos avanzados y controles PRO):**
- `electron-app/src/renderer/flow-touch.js` agrega al `FlowTouchCommandRouter`:
  - `longPress(serial, x, y, durationMs=700)` que reutiliza `swipe` con mismo origen y destino (no requiere comandos nuevos en APK).
  - `doubleTap(serial, x, y)` envia dos `tap` separados ~120 ms al mismo serial.
  - `back(serial)`, `home(serial)`, `recents(serial)` -> comandos `back`, `home`, `recents` ya soportados por `FlowAccessibilityService`.
- `FlowTouchController` extiende el detector de gestos con:
  - long press automatico cuando el puntero queda quieto >= `longPressDelayMs` (520 ms) sin moverse mas que `gestureTapThresholdPx`.
  - Ctrl/Meta + click forzado a long press.
  - doble tap por dos taps en menos de `doubleTapWindowMs` (280 ms) y dentro de `doubleTapThresholdPx` (22 px).
  - Shift+drag amplia la duracion del swipe a minimo `shiftSlowDurationMs` (900 ms) para gestos mas humanos.
  - rueda del mouse: el `wheel` acumula deltaY y emite `swipe` vertical centrado en el cursor cuando el acumulado supera 32 px y se respetan 240 ms entre emisiones (`wheelEmitMinIntervalMs`).
  - Botones `Back`, `Home`, `Recents` del quickbar ahora envian a FlowAgent solo si el control esta armado; si no, registran que requieren control y muestran estado.
  - Cancelacion segura del timer de long press en `pointerup`/`pointercancel` y al cerrar Focus Mode.
- Verificacion local:
  - `node --check flow-touch.js` OK.
  - DOM headless: payloads exactos generados por `tap`, `swipe`, `longPress` (`swipe` con mismo start/end + duration 700), `doubleTap` (dos `tap`), `back`, `home`, `recents`.
  - Backend real: `home`, `recents`, `back` ejecutados via `POST /agent/command` contra `192.168.1.43:5555` -> los tres devuelven `result.ok=true` con `"<accion> ejecutado"`. Long press como `swipe(540,960 -> 540,960, 700ms)` tambien devuelve `ok:true`.
- No se modifico backend Python, C# ni APK; el `FlowAccessibilityService.tap/swipe/back/home/recents` ya existian.

**Documentacion incremental 2026-05-26 (UI ayuda en quickbar):**
- El bloque `.flowtouch-help` dentro de Focus Mode ahora describe los nuevos atajos:
  - click = tap, drag = swipe, Ctrl+click = long press, Shift+drag = swipe lento, doble click = doble tap, rueda = scroll.
- No se agregaron emojis nuevos al HTML, conforme a las reglas del proyecto.


**Implementacion 2026-05-26 (FlowTouch Fase 7 - UI Pro y ergonomia):**
- `electron-app/src/renderer/app.js` agrega subcategoria `FlowTouch` dentro de `Configuracion`, paralela a `FlowVideo` y `FlowKeyboard`. Es informativa: explica los gestos disponibles, no arma control y no envia comandos.
  - Atajos listados en la UI: click=tap, drag=swipe, Shift+drag=swipe lento, mantener click / Ctrl+click=long press, doble click=doble tap, rueda=scroll vertical, Back/Home/Recents desde el quickbar y Esc para cerrar.
  - Aclara que sin control armado todo es diagnostico local, nada se envia a Android.
- `electron-app/src/renderer/styles.css` agrega:
  - Bloque `.flowtouch-info-panel` con estilo aislado y SVG inline (sin emojis).
  - Cursor `crosshair` y anillo cyan en `.flowtouch-phone-frame` SOLO cuando `<body>` tiene la clase `flowtouch-control-on`.
  - Refuerzo responsive: `@media (max-width:980px)` reduce la altura del frame a `min(62vh, 560px)` y el quickbar pasa a 4 columnas; `@media (max-width:640px)` ajusta a `min(54vh, 460px)` y 2 columnas.
- `electron-app/src/renderer/flow-touch.js` actualiza `_syncControlUi(...)` y `closeFocus()` para mantener la clase `flowtouch-control-on` sincronizada con `controlEnabled`. Asi el cursor/overlay claro solo aparece cuando FlowTouch tiene control armado y se limpia al cerrar.
- Verificacion: `node --check flow-touch.js` y `node --check app.js` OK. La Fase 2 cierra el bullet padre del header (FPS/ultimo frame ya estaba marcado en sub-items).
- No se modifico backend Python, C# ni APK. La nueva subcategoria queda colapsada por defecto y respeta las reglas del sidebar y de no introducir emojis nuevos.


**Implementacion 2026-05-26 (FlowTouch Fase 8 - integracion con FlowKeyboard dentro de Focus Mode):**
- `electron-app/src/renderer/flow-touch.js`:
  - Nuevo bloque `#flowTouchKeyboardBlock` dentro del quickbar de Focus Mode con: pill de estado, textarea `flowTouchKeyboardInput`, botones `Enviar`, `Clear`, `Bksp`, `Enter`, `Next`, `Done` y un boton `Preparar FlowKeyboard` que aparece solo cuando el IME esta instalado pero no seleccionado.
  - `_refreshFlowKeyboardStatus(serial)` invoca `app.requestFlowKeyboardStatus({serial})` y rehidrata el bloque con `_renderFlowKeyboardBlock(...)`. Habilita inputs y botones SOLO cuando `selected===true`.
  - `_sendFlowKeyboardText()` usa `app.sendFlowKeyboardType(serial, text)` y registra solo la longitud (`FlowKeyboard type: N caracteres`); nunca el contenido.
  - `_runFlowKeyboardAction(action)` mapea `clear`, `backspace`, `enter`, `next`, `done` a `app.sendFlowKeyboardCommand(serial, action, options)` con `count:1` para `backspace`.
  - `_prepareFlowKeyboardForActiveSerial()` invoca `POST /flowkeyboard/prepare` solo para el serial activo (`deviceIds:[serial]`) bajo accion explicita del usuario y refresca el estado.
  - El estado se consulta UNA vez al abrir Focus Mode; nada se prepara o activa automaticamente.
- `electron-app/src/renderer/styles.css` agrega estilos aislados para `.flowtouch-keyboard-block`, `.flowtouch-keyboard-head`, `.flowtouch-keyboard-input`, `.flowtouch-keyboard-row` y `.flowtouch-keyboard-prepare`. Sin emojis, sin tocar otros componentes.
- Verificacion local:
  - `node --check flow-touch.js` OK.
  - Backend real: `POST /flowkeyboard/status` con `{serial:"192.168.1.43:5555"}` -> HTTP 200 con `installed:true, enabled:false, selected:false, defaultInputMethod:"com.sec.android.inputmethod/.SamsungKeypad"`. Exactamente el caso en que FlowTouch muestra `Preparar FlowKeyboard` y deja los inputs deshabilitados hasta que el usuario lo prepare.
- No se modifico backend Python, C# ni APK; se reusan helpers existentes de FlowKeyboard (`requestFlowKeyboardStatus`, `sendFlowKeyboardType`, `sendFlowKeyboardCommand`).
- Privacidad: ni los logs de Focus Mode ni los del historial reflejan el texto enviado, solo su longitud, en linea con el resto de FlowKeyboard.


**Correccion visual 2026-05-26 (FlowTouch quickbar y FlowDev panel derecho):**
- Sintoma A: el bloque FlowKeyboard dentro del Focus Mode se salia del quickbar lateral (botones desbordaban a la derecha y el textarea quedaba apretado).
- Sintoma B: en FlowDev al capturar UI y seleccionar un nodo, la lista `Propiedades` del panel derecho crecia y empujaba `Action Console`, `FlowKeyboard` y `logs` fuera de la vista.
- Fix en `electron-app/src/renderer/styles.css`:
  - FlowTouch quickbar: `--flowtouch-side-panel` sube de 150px a 168px (la ventana sigue compacta porque el clamp ahora es 540..1020). El quickbar incluye `overflow-y:auto` para que el contenido extra pueda hacer scroll en vez de empujar el canvas.
  - `.flowtouch-keyboard-block` y `.flowtouch-keyboard-row` quedan con `min-width:0`, `grid-template-columns: repeat(3, minmax(0, 1fr))`, `gap:4px`, y los botones internos `height:28px`, `font-size:0.7rem`, con `text-overflow: ellipsis` para que no desborden cuando el texto es largo (`Backspace`, `Bksp`).
  - `.flowtouch-keyboard-input` recibe `box-sizing: border-box` para respetar el ancho del bloque.
  - `.inspector-panel--right` se vuelve flex column con `min-height:0`, `overflow:hidden`. `#inspectorPropsTable` toma `flex:1 1 auto`, `min-height:0`, `max-height:38vh` con scroll interno; `.inspector-actions` queda `flex:0 0 auto`; `#flowDevActionConsole` recibe `flex:1 1 auto`, `min-height:220px`, `max-height:60vh` y scroll interno. Asi por mas grande que sea la lista de Propiedades, el Action Console y FlowKeyboard del Inspector siempre quedan visibles.
  - `.inspector-props-list` deja de manejar scroll propio (lo hace ahora `#inspectorPropsTable`) para evitar dobles barras.
- Verificacion: `node --check flow-touch.js` OK; cambios solo CSS, no afectan logica de Inspector ni FlowTouch ni envio de comandos.


**Correccion visual 2026-05-26 (FlowTouch FlowKeyboard pill no entraba):**
- Sintoma: la pill de estado (`no habilitado`, `no seleccionado`, `sin estado`) dentro del bloque FlowKeyboard del Focus Mode se salia del quickbar y no se veia completa.
- Fix CSS en `electron-app/src/renderer/styles.css`:
  - `.flowtouch-keyboard-head` con `flex-wrap: wrap`, `gap:6px` y `min-width:0`. Si la pill no cabe en la misma linea, baja a la siguiente sin desbordar.
  - El primer `span` (etiqueta "FlowKeyboard") se trunca con ellipsis para no robarle espacio a la pill.
  - `.flowtouch-keyboard-head .flowtouch-status-pill` recibe `max-width:100%`, `padding:0 7px`, `font-size:0.66rem` y `text-overflow: ellipsis`. Asi siempre cabe dentro del quickbar y, si por algun caso queda recortada, el `title` muestra el texto completo.
- `electron-app/src/renderer/flow-touch.js` agrega `title` descriptivo a `#flowTouchKeyboardState` segun el estado real (`sin estado`, `listo`, `no seleccionado`, `no habilitado`, `no instalado`) para conservar accesibilidad sin exponer datos sensibles.
- Verificacion: `node --check flow-touch.js` OK; sin cambios en backend, ni en lógica de comandos.


**Correccion 2026-05-26 (seleccion de tarjeta en grid no se reflejaba):**
- Sintoma: al hacer click sobre un contenedor de un dispositivo en el layout principal (la grilla a la derecha), no se veia la seleccion verde aunque internamente `selectedDeviceIds` si cambiaba.
- Causa: `toggleDevice(serial)` usaba `document.querySelector('[data-serial="..."]')`, que devuelve el PRIMER match. Como los chips de FlowCategory tambien tienen `data-serial`, y se renderizan antes en el DOM, la clase `is-selected` se aplicaba al chip pero NO a la tarjeta visible del grid; por eso "no se seleccionaba" visualmente.
- Fix en `electron-app/src/renderer/app.js`:
  - `toggleDevice(serial)` ahora usa `querySelectorAll('[data-serial="..."]')` y aplica/quita `is-selected` SOLO en elementos que sean `live-device-card` o `cat-chip`. Asi la tarjeta del grid principal y el chip de la categoria quedan siempre sincronizados con el estado real.
- Verificacion: `node --check app.js` OK; sin cambios en backend ni en lógica de comandos. La cuenta `updateSelectedCount` y los flujos de `selectAll/deselectAll` no se tocan.


**Implementacion 2026-05-26 (FlowTouch Fase 9 - resiliencia):**
- `electron-app/src/renderer/flow-touch.js` agrega:
  - `_autoDisarm(reason)`: helper que llama `disableControl()`, deja el modo en `Control off seguro` y registra el motivo en el historial. Solo actua si habia control armado.
  - `_shouldAutoDisarmFromError(error)`: detecta mensajes tipicos de FlowAgent caido (`no conectado`, `no esta`, `accesibilidad`, `no respondio`, `timeout`, `sin respuesta`, `404`).
  - `_refreshAgentState(serial)` ahora desarma automaticamente si el agente desaparece o pierde accesibilidad mientras el control esta armado.
  - `_refreshFrameState(serial)`:
    - Cierra Focus Mode limpiamente si el `focusCanvas` deja de estar conectado al DOM (ej. rerender de la grilla).
    - Si no hay frames del telefono y hay control armado, desarma con aviso (`sin captura del telefono`). Esto cubre el caso de MediaProjection pendiente.
    - Si los frames quedan detenidos mas de 8 segundos, desarma para no enviar gestos sobre una imagen vieja.
    - Pill `flowTouchFrameState` recibe `title` accesible explicando el caso.
  - Catch de `_sendTap`, `_sendSwipe`, `_sendDoubleTap`, `_sendLongPress`, `_sendNavCommand` invoca `_autoDisarm(...)` si el error sugiere que FlowAgent quedo inestable.
  - `CoordinateMapper.fromPointerEvent(...)` valida que `frameSize.width/height` sean numeros finitos y positivos. Si no, cae al tamaño del canvas (legacy) en vez de proyectar coordenadas con valores invalidos. Las coordenadas se siguen clampeando a `targetWidth-1` y `targetHeight-1`.
- Decision sobre fallback ADB para tap/swipe:
  - Se deja DESACTIVADO por diseño, alineado con AGENTS.md y la regla del producto: FlowLogin tiene a Socket como canal obligatorio. Para FlowTouch tambien, no se permite caer silenciosamente a ADB. El controlador queda preparado para reanudar este punto via flag opt-in explicito si el producto lo requiere despues.
- Verificacion: `node --check flow-touch.js` OK; sin cambios en backend, Python ni APK; sin tocar logica de FlowLogin/FlowRegister; sin cambiar el contrato `POST /agent/command`.


**Validacion 2026-05-26 (FlowTouch Fase 10 - validacion final):**
- `python -m py_compile local_adb_server.py` OK.
- `node --check` OK en `app.js`, `flow-touch.js`, `stream-renderer.js`.
- Endpoints en vivo:
  - `GET /agents`: 17 agentes conectados, 17 con `accessibility=true`.
  - `GET /api/streaming/stats`: `connectedClients=0`, `cachedFrames=17`.
  - `POST /login-status` con `deviceIds:"all"`: `runningJobs=0`. FlowLogin/FlowRegister no estan ejecutando, sigue usando Socket como motor obligatorio (no se introdujo fallback ADB).
- Cobertura previa de pruebas reales acumulada en fases:
  - Fase 4: tap real en `192.168.1.43`, `192.168.1.41`, `192.168.1.48` -> `result.ok=true, "tap ejecutado"`.
  - Fase 5: swipe vertical scroll real en `192.168.1.43:5555 (540,1500 -> 540,700, 350ms)` -> `result.ok=true, "swipe ejecutado"`.
  - Fase 6: `home`, `recents`, `back` reales en `192.168.1.43` -> `result.ok=true`. Long press como `swipe(540,960 -> 540,960, 700ms)` -> `result.ok=true`.
  - Fase 8: `POST /flowkeyboard/status` con `192.168.1.43` -> `installed=true, enabled=false, selected=false`, exactamente el caso que activa el boton "Preparar FlowKeyboard" en Focus Mode.
- No se modifico backend, APK ni protocolo durante la validacion final.


**Cierre 2026-05-26 (FlowTouch Fase 11 - punto de restauracion + instrucciones):**
- Se creo `restore_points/PuntoFlowTouchEstable/` con:
  - `runtime-files/electron-renderer/`: `flow-touch.js`, `stream-renderer.js`, `styles.css`, `app.js`.
  - `runtime-files/specs/`: `requirements.md`, `design.md`, `tasks.md` de `.kiro/specs/flow-touch/`.
  - `runtime-files/PROJECT_CONTEXT.md`: snapshot de la memoria viva.
  - `git-status-short.txt`, `tracked-changes-stat.txt`: snapshots de git.
  - `README.md`: instrucciones de uso, alcance, riesgos remanentes y como restaurar el punto.
- Estado del producto al cerrar FlowTouch:
  - Focus Mode ajustado al tamaño del telefono, con tap/swipe/doble tap/long press/wheel/Shift/Ctrl, Back/Home/Recents, FlowKeyboard manual con Preparar/Type/Clear/Bksp/Enter/Next/Done, indicador de tarjeta enfocada y subcategoria informativa en `Configuracion -> FlowTouch`.
  - Resiliencia activa: auto-desarme si el agente cae, pierde accesibilidad, frames se detienen, captura inactiva o canvas se desconecta del DOM. CoordinateMapper valida `frameSize` con numeros finitos.
  - FlowLogin/FlowRegister intactos: Socket sigue siendo motor obligatorio, sin fallback ADB silencioso.
  - Backend Python, C# y APK sin cambios durante FlowTouch.
- Spec `.kiro/specs/flow-touch/tasks.md` queda con todas las fases marcadas y estado general "COMPLETADO".


**Inicio 2026-05-26 (Focus PRO Panel - Fases 0 y 1):**
- Punto de restauracion `restore_points/PuntoAntesPanelPro/` creado con copia de `flow-touch.js`, `stream-renderer.js`, `styles.css`, `app.js`, `local_adb_server.py` y `PROJECT_CONTEXT.md`. Spec viva en `.kiro/specs/focus-pro-panel/` (`requirements.md`, `design.md`, `tasks.md`).
- Fase 1 implementada en `electron-app/src/renderer/flow-touch.js`:
  - `flowtouch-quickbar` reemplazado por `focus-pro-panel` con secciones `Control`, `Navegacion` y `FlowKeyboard` (esta ultima como acordeon colapsable, arranca cerrada).
  - Switch ON/OFF `flowTouchControlSwitch` reemplaza el boton `Activar control`. Pill `flowTouchControlStatePill` muestra `ON/OFF`.
  - `openFocus(...)` arma el control automaticamente con `_autoArmControlSafely(...)`, valida `accessibility=true` antes de armar y, si pasa, fija `armDebounceUntil = now + 350ms`.
  - `_handleTapGesture(...)` ignora el primer tap dentro del debounce post-apertura, evitando que el doble click de apertura del Focus Mode dispare un tap real.
  - `_toggleControl(forceOn?)` ahora acepta forzar estado ON/OFF para sincronizar con el switch.
  - Botones `Back`, `Home`, `Recents` reciben icono SVG inline antes del texto. La logica `_sendNavCommand` no cambia.
  - Acordeon FlowKeyboard arranca colapsado y abre/cierra al click sobre su header.
- `electron-app/src/renderer/styles.css` agrega:
  - `.focus-pro-panel`, `.fp-block`, `.fp-header`, `.fp-content`, `.fp-arrow`, `.fp-status-pill`.
  - Paleta por seccion (`--fp-color`) con verde para Control, cyan para Navegacion y morado para FlowKeyboard.
  - Switch animado `.fp-switch` con slider y gradient on.
  - Botones `.fp-btn` y `.fp-btn-nav` con hover glow + lift.
  - `prefers-reduced-motion` respetado.
- Auto-disarm de Fase 9 (FlowTouch) sigue activo: si el agente cae o frames se detienen, el switch se desactiva solo y queda en `Control off seguro`.
- Verificacion: `node --check electron-app/src/renderer/flow-touch.js` OK. Sin tocar backend Python, C# ni APK.


**Implementacion 2026-05-26 (Focus PRO Panel - Fases 2 a 10):**
- `local_adb_server.py` agrega helpers y endpoints nuevos:
  - Helpers: `_read_multipart`, `_save_multipart_file`, `_safe_remove`, `_file_sha1`, `apps_list`, `apps_launch`, `apps_force_stop`, `apps_clear_cache`, `apps_uninstall`, `apps_install`, `push_file_to_device`, `system_open_settings`, `power_reboot`, `power_shutdown`, `autojs_detect_package`, `autojs_prepare_overlay`, `autojs_push_script`. Constantes `UPLOAD_TMP_DIR`, `UPLOAD_MAX_BYTES=500MB`, `AUTOJS_REMOTE_DIR=/sdcard/Download/flowdashboard_autojs`, cache por hash `AUTOJS_HASH_CACHE`.
  - Endpoints JSON: `/apps/list`, `/apps/launch`, `/apps/force-stop`, `/apps/clear-cache`, `/apps/uninstall`, `/autojs/prepare-overlay`, `/system/open-settings`, `/power/reboot`, `/power/shutdown`.
  - Endpoints multipart: `/apps/install` (campo `apk`), `/file-push` (campos `file`, `path`), `/autojs/push` (campo `script`, opcional `force`).
  - `do_POST` lee `body` JSON solo cuando NO es multipart, evitando tocar el flujo existente de los demas endpoints.
- `electron-app/src/renderer/app.js` agrega helpers en la clase `App`: `appsList`, `appsLaunch`, `appsForceStop`, `appsClearCache`, `appsUninstall`, `appsInstall`, `pushFile`, `autoJsPushScript`, `autoJsRunRemote`, `autoJsStopForSerial`, `autoJsPrepareOverlay`, `systemOpenSettings`, `powerReboot`, `powerShutdown`, `runAdbFreeCommand`. Todos hacen `_proPanelPostJSON` o `_proPanelPostMultipart`. No tocan helpers existentes ni FlowLogin / FlowRegister.
- `electron-app/src/renderer/flow-touch.js` agrega secciones del panel:
  - `apps`, `archivos`, `adb`, `autojs`, `sistema`, `energia` ademas de `flowkeyboard`.
  - Cada bloque colapsable con flecha que rota.
  - Persistencia abierto/cerrado en `localStorage.flowdashboard.focusPanel.expanded`.
  - Apps: lista con busqueda, toggle "Sistema", botones Copy/Open/Stop/Clr/Uni con confirmacion (Clr y Uni piden doble click).
  - Archivos: drag and drop + picker, ruta editable, hasta 500 MB.
  - ADB Shell: input + Ejecutar + `pre` con scroll que reutiliza `/adb` existente.
  - Auto.js: picker de `.js`, toggle Forzar, ejecutar (push + run), Detener, Preparar Auto.js.
  - Sistema: Configuraciones + atajos Wi-Fi / Apps / Idioma / Accesibilidad.
  - Energia: Reboot / Shutdown con doble click animado y color rojo.
- `electron-app/src/renderer/styles.css` agrega paleta por seccion (`--fp-color`), inputs `.fp-input`, checkbox `.fp-checkbox`, terminal `.fp-pre`, `.fp-btn-mini`, `.fp-btn-danger` con animacion de pulso al confirmar, lista de apps `.fp-app-row` y estilos drop `.is-dragging`.
- Validacion real:
  - `python -m py_compile local_adb_server.py` OK.
  - `node --check` OK en `app.js` y `flow-touch.js`.
  - Reinicio de Python con servidor activo: `/health` HTTP 200.
  - `/apps/list` con `192.168.1.43:5555` -> 18 apps de terceros (incluye `com.flowlogin.agent`, `tv.twitch.android.app`, `com.microsoft.office.outlook`, etc).
  - `/apps/launch com.android.settings` -> `ok:true, via:"agent"`.
  - `/apps/force-stop com.android.settings` -> OK.
  - Errores controlados (HTTP 500) en `system/open-settings` y `autojs/prepare-overlay` con serial vacio.
  - 17 agentes conectados, `cachedFrames=17`, 1 cliente WebSocket activo (Electron). FlowLogin sin jobs.
- No se modifico el APK FlowAgent ni el backend C# de streaming. FlowLogin/FlowRegister/Inspector siguen intactos.


**Correcciones 2026-05-26 (Focus PRO Panel - tolerancia de auto-disarm + ventana flotante de Apps):**
- Sintoma 1: el switch ON automatico se apagaba solo en parpadeos (un fetch fallido a `/agents`, una lectura sin frame, etc).
- Fix: `_refreshAgentState` ya no desarma cuando `fetch /agents` falla (lo trata como hipo de red). Si el agente esta y/o accesibilidad cae, requiere `disarmAgentThreshold=3` ciclos consecutivos antes de desarmar. `_refreshFrameState` requiere `disarmFrameThreshold=4` ciclos consecutivos antes de desarmar. Strikes se resetean al armar y al volver a estado bueno.
- Sintoma 2: la lista de Apps en el panel lateral quedaba muy chica para usarse.
- Fix: el bloque "Aplicaciones" del panel ahora muestra solo un boton "Abrir gestor de Apps". Ese boton abre una ventana flotante (`#fpAppsWindow`) dentro del overlay del Focus Mode, con header arrastrable y esquina inferior derecha redimensionable. Geometria persistida en `localStorage.flowdashboard.focusPanel.appsWindow`.
- La ventana incluye toda la UI antigua (busqueda, toggle "Sistema", Refrescar, Instalar APK, lista) con los mismos eventos. El cierre del Focus Mode tambien cierra la ventana.
- CSS aislado `.fp-window`, `.fp-window-header`, `.fp-window-body`, `.fp-window-resize`. Drag y resize implementados con listeners de raton, sin librerias externas.
- Verificacion: `node --check flow-touch.js` OK. Sin tocar backend, FlowLogin/FlowRegister, Inspector, ni APK.


**Correccion 2026-05-26 (Focus PRO Panel - apps:install fallaba con "Cannot be converted to bool"):**
- Sintoma: al instalar APK desde el panel salia `apps:install FAIL: Cannot be converted to bool` aunque el archivo se subia OK al servidor.
- Causa raiz: `cgi.FieldStorage` no implementa `__bool__`, asi que `if not field` lanzaba `TypeError: Cannot be converted to bool` en `_save_multipart_file(...)`. Ese error subia al cliente como mensaje crudo.
- Fix en `local_adb_server.py`:
  - `_save_multipart_file(...)` ahora compara siempre contra `None` (`if field is None`, `if getattr(field, "file", None) is None`).
  - `apps_install(...)` envuelve `adb install` en try/except, sube el timeout a 480s para APKs grandes, extrae `error_line` legible cuando ADB no reporta `Success` y lo expone en la respuesta JSON.
- Resultado: subir un APK ~100 MB ahora funciona; si la instalacion falla por motivos del telefono (firma, espacio, etc) el frontend muestra el mensaje real de ADB.
- Verificacion: `python -m py_compile local_adb_server.py` OK; servidor reiniciado y `/health` responde HTTP 200; sin tocar el resto de helpers, FlowLogin/FlowRegister, Inspector ni APK.


**Mejora 2026-05-26 (Focus PRO Panel - apps con icono, modal de confirmacion, click directo):**
- Click sobre el header del bloque "Aplicaciones" abre directo la ventana flotante (ya no es acordeon).
- La ventana muestra ahora cada app con icono PNG real extraido del APK base via nuevo endpoint `POST /apps/icon`. El backend hace `pm path` + `adb pull` + lectura del zip y devuelve el PNG mas grande (prioriza `mipmap`/`drawable` con `ic_launcher`/`launcher`/`icon`, fallback a cualquier PNG en el zip). Cachea por (serial, package) en `BASE_DIR/.app_icon_cache`.
- El frontend carga iconos en background con concurrencia 2 para no saturar adb. Cada app arranca con un placeholder SVG y se actualiza al llegar el icono.
- Acciones destructivas (Uninstall, Clear cache) ahora abren un modal de confirmacion PRO `.fp-confirm-layer` con foco inicial en Cancelar, animacion sutil y boton rojo. Reemplaza el doble click rapido anterior, mas claro y mas seguro.
- Bug "Cannot be converted to bool" del install: causa real estaba en `_save_multipart_file` por usar truthiness sobre `cgi.FieldStorage`. Fix descrito en entrada anterior.
- Helper `app.appsIcon(serial, packageName)` agregado en `app.js` para reutilizar el endpoint desde cualquier vista futura.

**Correccion 2026-05-26 (Focus PRO Panel - Auto.js no ejecutaba con ruta remota):**
- Sintoma: subir .js OK, run NO ejecuta el script ni con ni sin "Forzar reenviar".
- Causa raiz 1: `execute_autojs(filePath, ...)` en `local_adb_server.py` llamaba `resolve_local_script_path(filePath)`. Como el frontend pasaba la ruta REMOTA del telefono (`/sdcard/Download/flowdashboard_autojs/...`), `resolve_local_script_path` no encontraba un archivo local, lanzaba `RuntimeError("No se encontro el script")` y nunca llegaba al lanzamiento de intents. La rama de FlowLogin/FlowRegister no se afecto porque ellos siguen pasando solo el nombre del script (`Login.js`/`Register.js`).
- Fix: si `filePath` empieza por `/sdcard/` o `/storage/`, `execute_autojs` salta toda la fase de "push del script local" y solo dispara los intents de Auto.js apuntando a esa ruta remota. La ruta legacy (script local del PC) sigue funcionando igual.
- Causa raiz 2: confirmado con `pm list packages | grep -i autojs` y `... | grep -i laixi` que el dispositivo `192.168.1.43:5555` NO tiene Auto.js ni Laixi instalados. Por eso aunque el push funciona, ningun intent puede ejecutar el .js.
- Resultado: el endpoint ahora responde con `Auto.js no respondio o no esta instalado en este dispositivo` cuando no hay paquete; antes respondia con un error genericode script local. Para correr el GREEN_SONGS_V14_BY_FENIX.js hay que instalar Auto.js (`org.autojs.autojs` o `org.autojs.autojspro`) en cada telefono primero. Despues, el panel "Auto.js" del Focus Mode puede subir y ejecutar el script directo. El boton "Preparar Auto.js" del panel concede `SYSTEM_ALERT_WINDOW` automaticamente para el `floaty.rawWindow` que usa el script.
- Verificacion: `python -m py_compile local_adb_server.py` OK. Servidor reiniciado, `/health` 200, `/apps/list` 200 con 18 apps en `192.168.1.43:5555`. Backend C# y APK sin tocar.


**Cambio visual 2026-05-26 (Focus PRO Panel - iconos default + Spotify):**
- A pedido del usuario se quita la extraccion real de iconos via `/apps/icon` desde el frontend.
- `flow-touch.js` ahora pinta cada app con un icono SVG inline:
  - Default: cuadricula simple en morado neutro (`.fp-app-icon.is-default`).
  - Si el `packageName` empieza por `com.spotify.`, usa logo Spotify simplificado en verde (`.fp-app-icon.is-spotify`).
- Helpers `_appIconClassFor(pkg)` y `_appIconSvgFor(pkg)` aislan la decision para que se pueda extender mas adelante (ej. agregar otros logos por dominio del paquete).
- `app.appsIcon(...)` removido del frontend porque ya no se llama. El endpoint `/apps/icon` queda en el backend por compatibilidad (no se invoca, no afecta nada).
- `styles.css`:
  - `.fp-app-icon.is-default` morado neutro.
  - `.fp-app-icon.is-spotify` fondo verde Spotify (`#1DB954`) con sombra suave y SVG blanco.
  - SVG escalado de 16 a 18 px (default) y 22 px (Spotify) para mejor lectura.
- Sin cambios en `local_adb_server.py` (Python) salvo lo ya hecho previamente. FlowLogin/FlowRegister/Inspector/streaming intactos.
- Verificacion: `node --check flow-touch.js`, `node --check app.js`, `python -m py_compile local_adb_server.py` OK.


**Implementacion 2026-05-26 (AutoJs6 integrado al FlowDashboard - Etapa A):**
- Decision: Etapa A primero (instalar AutoJs6 como APK aparte) porque cero riesgo, deja FlowAgent intacto y compatible Android 9+. Etapa B (embeber Rhino dentro de FlowAgent estilo Laixi) queda para sesion siguiente.
- Punto de restauracion `restore_points/PuntoAntesAutoJs6/` creado con `flow-touch.js`, `app.js`, `styles.css`, `local_adb_server.py` y `PROJECT_CONTEXT.md`.
- APKs disponibles en `AutoJs6/`: 6 variantes de `autojs6 v6.7.0` (universal, arm64-v8a, armeabi-v7a, armeabi, x86, x86_64).
- Universal `autojs6-v6.7.0-universal-047ae62e.apk` validado: `package=org.autojs.autojs6`, `minSdk=24` (Android 7+), `targetSdk=36`. Soporta cualquier arquitectura, ideal para multi-cliente.
- Manifest verificado con `aapt dump xmltree`: el activity de ejecucion de scripts es `org.autojs.autojs.external.open.RunIntentActivity` (namespace interno conserva `autojs`, package del APK es `autojs6`).

Backend (`local_adb_server.py`):
- `AUTOJS_PACKAGES` ampliada con `org.autojs.autojs6` al frente.
- `AUTOJS_CANDIDATE_PACKAGES` (helper `autojs_detect_package`) ampliada igual.
- `autojs_launch_commands` ahora reconoce `org.autojs.autojs6` y arma el intent correcto: `am start -n org.autojs.autojs6/org.autojs.autojs.external.open.RunIntentActivity -a android.intent.action.VIEW -d file:///sdcard/...`. Para legacy (`org.autojs.autojs`, `com.stardust.*`) conserva el intent generico anterior.
- Helpers nuevos:
  - `AUTOJS6_BUNDLED_DIR = BASE_DIR / "AutoJs6"`.
  - `autojs6_bundled_apk()` busca `autojs6-*-universal-*.apk` con fallback a cualquier `autojs6-*.apk`.
  - `autojs_install_bundled(serial)` ejecuta `adb -s <serial> install -r <apk>` con timeout 480s, devuelve `error` legible si falla.
- Endpoint nuevo: `POST /autojs/install-bundled` con body `{ "serial": "..." }`.

Frontend (`app.js`, `flow-touch.js`, `styles.css`):
- `app.autoJsInstallBundled(serial)` en helpers.
- Boton `Instalar AutoJs6` en el panel Auto.js del Focus PRO Panel, debajo de Detener / Preparar Auto.js. Muestra "Instalando AutoJs6 (puede tardar 30-60s)..." mientras corre y reporta resultado en el panel.

Verificacion real (despliegue masivo):
- Python reiniciado, `/health` HTTP 200.
- Instalacion en `192.168.1.43:5555`: `ok:true, raw:"Performing Streamed Install\nSuccess"`. `pm path org.autojs.autojs6` retorna ruta valida.
- Despliegue paralelo (throttle 4 jobs PowerShell) en los otros 16 dispositivos: 16/16 OK, 0 fallos. Total **17/17 dispositivos con AutoJs6 instalado**.
- Prueba end-to-end de ejecucion de script en `.43`:
  1. `POST /autojs/push` con `test_hello.js` -> HTTP 200, `remotePath: "/sdcard/Download/flowdashboard_autojs/test_hello.js"`, `sha1: 6440872ee...`.
  2. `POST /autojs/run` con `filePath: <remotePath>` -> HTTP 200, salida ADB: `Ejecutor detectado: org.autojs.autojs6\nStarting: Intent { act=android.intent.action.VIEW dat=file:///sdcard/.../test_hello.js cmp=org.autojs.autojs6/org.autojs.autojs.external.open.RunIntentActivity }`. La cadena push -> run funciona end-to-end.
- Estado del sistema: `/agents` 17 agentes con `accessibility=true`, `cachedFrames=17`, `runningJobs=0`. FlowLogin no fue afectado.

Lo que NO se modifico:
- Backend C# de streaming.
- APK FlowAgent (queda igual, version 0.3.8).
- FlowLogin / FlowRegister / Inspector / FlowKeyboard.
- Ningun lanzador del proyecto.

Pendiente para el usuario:
- En cada dispositivo, abrir AutoJs6 una vez y aceptar:
  1. Permiso de accesibilidad (Settings -> Accessibility -> AutoJs6 -> ON).
  2. Permiso "Mostrar sobre otras apps" (puede automatizarse via boton Preparar Auto.js del panel, que usa `appops set org.autojs.autojs6 SYSTEM_ALERT_WINDOW allow`).
- Despues, scripts como `GREEN_SONGS_V14_BY_FENIX.js` corren con un click desde el panel.

Etapa B (proximo proyecto): embeber AutoJs6 dentro de FlowAgent (un solo APK), nueva apariencia del FlowAgent. Requiere migracion del build script PowerShell a Gradle, integracion de Rhino + APIs de Auto.js, refactor visual. Queda planificado pero NO ejecutado en esta sesion.


**Analisis 2026-05-26 (Laixi APK - confirmacion de embebido de Auto.js):**
- Se inspecciono el APK `laixi.apk` (`youhu.laixijs` v1.1.0.0, versionCode 1100, minSdk=21, targetSdk=33) presente en la raiz del proyecto.
- Tamaño: 60 MB comprimido / 127 MB descomprimido / 3,465 entradas. 3 archivos `.dex` con 23 MB combinados de bytecode Java/Kotlin.
- Confirmado: Laixi embebe Auto.js completo. La carpeta `assets/modules/` contiene los archivos canonicos del motor (`__app__.js`, `__automator__.js`, `__dialogs__.js`, `__floaty__.js`, `__http__.js`, `__images__.js`, `__io__.js`, `__java_util__.js`, `__selector__.js`, `__shell__.js`, `__storages__.js`, `__threads__.js`, `__timers__.js`, `__ui__.js`, `__$base64__.js`, `__$crypto__.js`, `__$zip__.js`, `__$plugins__.js`, `__$paddle__.js`, `__$media__.js`, `__$continuation__.js`, `__$json2__.js`, `__RootAutomator__.js`). Estos son los wrappers Rhino oficiales del proyecto Auto.js. No es posible imitar esa estructura sin embeber el motor.
- Capas adicionales que Laixi suma sobre Auto.js (esto es lo que justifica los 60 MB):
  - **OpenCV** (`libopencv_java4.so`, 18 MB arm64 / 11 MB armeabi-v7a) para reconocimiento de imagenes y template matching desde scripts.
  - **Tesseract OCR** (`libtesseract.so`, 4 MB / 3 MB) + modelos `assets/models/ocr_v2_for_cpu/`.
  - **MLKit Google OCR** (`libmlkit_google_ocr_pipeline.so`, 10 MB / 6 MB) + modelos `assets/mlkit-google-ocr-models/`.
  - **PaddleOCR** (`libpaddle_light_api_shared.so`, 4 MB) - segundo motor OCR para chino.
  - **p7zip** (`libp7zip.so`) para manipulacion de archivos comprimidos desde JS.
  - **socks5-tunnel** (`libhev-socks5-tunnel.so`) proxy/VPN integrado.
  - **MMKV** (`libmmkv.so`) - storage rapido de Tencent.
  - **Zygisk module propio** (`liblaixi_usb_hide.so` / `liblaixi_usb_hide_arm.so`) que se inyecta en zygote para ocultar la depuracion USB ante apps con anti-deteccion (Spotify, Instagram, etc). Requiere root + Magisk Zygisk.
  - **HiAI** (Huawei NPU acceleration), **Bugly** (Tencent crash reporting).
  - **JackPal Android Terminal** (`libjackpal-androidterm5.so`) terminal Linux integrada para scripts.
- Permisos del manifest: `WRITE_SECURE_SETTINGS`, `MOUNT_UNMOUNT_FILESYSTEMS`, `ACCESS_SUPERUSER`, `MANAGE_EXTERNAL_STORAGE`, `INSTALL_PACKAGES`/`DELETE_PACKAGES`. Diseñado para teléfonos rooteados con permisos elevados.

Implicacion para FlowAgent monolitico:
- Para igualar a Laixi en capacidades hace falta: AutoJs6 embebido (motor Rhino + APIs) + OpenCV + Tesseract/PaddleOCR + opcionalmente Zygisk anti-deteccion. Sin OpenCV/OCR el APK queda en 30-40 MB, con OpenCV+OCR sube a 60-80 MB.
- El proyecto debe migrar de PowerShell artesanal a Gradle real porque AutoJs6 + OpenCV + Tesseract son dependencias Gradle estandar.
- Etapa B planificada en `.kiro/specs/flowagent-monolito/` (proxima sesion). Esta sesion solo confirma el alcance real y mantiene Etapa A (AutoJs6 como APK aparte) operativa.


**Planificacion 2026-05-26 (FlowAgent Monolito - Etapa B):**
- Decision: Etapa B confirmada. Camino 1 (monolito tipo Laixi).
- Justificacion: Laixi vende dashboard + APK monolitico para gestion masiva, asi que FlowDashboard debe ofrecer paridad de despliegue (un solo APK que el cliente instala) o pierde percepcion de PRO.
- Restore point: `restore_points/PuntoAntesFlowAgentMonolito` con copia de:
  - `flow_agent_apk/src` y `flow_agent_apk/res` completos.
  - `flow_agent_apk/AndroidManifest.xml`, `flow_agent_apk/build_apk.ps1`.
  - `local_adb_server.py`.
  - `electron-app/src/renderer/flow-touch.js`, `app.js`, `styles.css`.
  - `PROJECT_CONTEXT.md`.
- Specs en `.kiro/specs/flowagent-monolito/`:
  - `requirements.md`: objetivos, reglas duras, criterios de aceptacion en .43, en flota de 4 y en los 17.
  - `design.md`: arquitectura, fork de AutoJs6 como base, bridges para OCR (MLKit) y OpenCV, nueva UI MainActivity, plan de versionado (v1.0.0, versionCode 100), keystore compartido para `pm install -r`.
  - `tasks.md`: 11 fases (Pre-flight, Setup AutoJs6, Renombrar package, Migracion FlowAgent, Bridge ScriptRunner, Bridge OCR, Bridge OpenCV, Nueva UI, Validacion .43, Despliegue gradual, Documentacion). Anti-deteccion Zygisk queda como Fase 11 opcional.
- NO se ejecuto codigo de la Etapa B en esta sesion. La proxima sesion arranca desde Fase 0 con el plan documentado.
- Etapa A queda en produccion como fallback estable: 17 dispositivos con AutoJs6 v6.7.0 separado, FlowAgent 0.3.8, todo verificado.
- Confirmaciones del usuario para la siguiente sesion:
  - Android Studio instalado o disponibilidad para instalarlo.
  - JDK 17 disponible.
  - Tiempo dedicado 5-8h.
  - Aceptacion del despliegue gradual `.43` -> 3 -> 17.
  - Aceptacion de rollback automatico al FlowAgent 0.3.8 si algo falla.

**Actualización 2026-05-31 (Fase 3 y 4 Monolito PRO - Perfiles Humanos):**
- **Objetivo:** Aplicar variaciones humanas en la duración y precisión de taps/swipes.
- **Archivos modificados:** local_adb_server.py (funciones gent_tap, gent_swipe, gent_click_node) y FlowAccessibilityService.java (función 	ap con duración variable).
- **Estado:** Implementado, APK compilado (gent-v1.0.0-universal.apk) e instalado en dispositivo de prueba 192.168.1.43.

## ULTIMOS CAMBIOS (2026-06-01) - Monolito PRO Fase 4 y 5

**Cambios en local_adb_server.py:**
- Refactorizado gent_swipe para generar puntos de control (controlX, controlY) perpendiculares a la trayectoria, con curva aleatoria (hasta +/- 15%).
- Anadidos helpers de espera dinamica (gent_wait_for_node, gent_wait_for_text) para reducir los hard sleeps y esperar por el DOM/UI con timeouts e intervalos.

**Cambios en FlowAccessibilityService.java (app/src/main/...):**
- Modificado executeCommand para parsear los nuevos controlX y controlY del comando swipe.
- Modificada la generacion del Path del gesto en Java: si recibe controlX y controlY validos, usa Path.quadTo para hacer una curva de Bezier cuadratica nativa, y si no, hace linea recta Path.lineTo.

**Despliegue:**
- Se compilo el APK (ssembleDebug) con las modificaciones nativas.
- Se instalo y activo en el dispositivo de pruebas .43.
- Se reinicio el servidor local Python (local_adb_server.py) para activar el envio de curvas y re-habilitar el streaming WS de la sesion anterior.


## ULTIMOS CAMBIOS (2026-06-01) - Finalizacion Fase 5 e Inicio Fase 6

**Fase 5 Completada (Esperas Dinamicas Avanzadas):**
- Agregados los helpers gent_wait_for_ocr y gent_wait_for_template en local_adb_server.py.
- Estos helpers utilizan los endpoints /flowagent/ocr-detect y /flowagent/find-template del monolito para proveer confirmacion visual real de la interfaz y evitar spamming ciego de clics.

**Fase 6 Iniciada (Arquitectura del Engine):**
- Se acordo que la sintaxis nativa de **AutoJs6** sera el estandar para nuevos scripts (como Login.js).
- Como mecanismo de retrocompatibilidad (bridge legacy) para los comandos del dashboard basados en socket (	ap, swipe), se mantendra operativo FlowAccessibilityService.java, coexistiendo transparentemente con el AccessibilityServiceUsher de AutoJs6.
- Esto permite ejecutar rutinas completas internamente (Rhino) y comandos atomicos remotos (Socket) sin friccion.


## Actualizacion 2026-06-07 - Monolito PRO Fase 4 cerrada, flota recuperada, Fase 6 bloqueada

**Fase 4 - Medicion y ajuste de jitter/bounds:**
- Se creo `tools/measure_tap_jitter.py` para medir riesgo de taps con jitter sobre dumps JSON/XML o muestra integrada.
- Reportes generados:
  - `reports/tap_jitter_measurement_2026-06-07_current.json`
  - `reports/tap_jitter_measurement_2026-06-07_adaptive.json`
  - `reports/tap_jitter_measurement_2026-06-07_adaptive_max.json`
  - `reports/tap_jitter_dump_192_168_1_43_2026-06-07.json`
  - `reports/tap_jitter_measurement_192_168_1_43_2026-06-07_current.json`
  - `reports/tap_jitter_measurement_192_168_1_43_2026-06-07_adaptive.json`
- En `local_adb_server.py` se agrego `agent_safe_tap_point(...)`: limita jitter a `0.35`, respeta margen minimo adaptativo y cae al centro en targets demasiado pequenos.
- `agent_click_node(...)` usa ahora ese punto seguro. Cambio backend-only; no requiere instalar APK.
- Validacion real en `.43`: dump de 35 nodos, 34 bounds validos. Formula adaptativa: `outsideTotal=0`, riesgo alto `0`, medio `0`, bajo `34`.

**Recuperacion ADB y flota:**
- Se reinicio ADB local empaquetado (`scrcpy-win64-v4.0\\adb.exe`) y se reconectaron los 17 seriales WiFi conocidos: `192.168.1.11`, `.38`, `.39`, `.40`, `.41`, `.42`, `.43`, `.44`, `.45`, `.46`, `.47`, `.48`, `.49`, `.50`, `.51`, `.52`, `.53`.
- Se forzo `adb reverse` para `8766`, `8765` y `5000`, y se relanzo FlowAgent con `autoconnect=true`.
- `.44` y `.53` necesitaron `force-stop`, relanzamiento y reactivacion de accesibilidad/IME.
- `.43` quedo afectado por una prueba experimental de Fase 6; se reinstalo el APK estable del monolito, se cerro el dialogo de MediaProjection que bloqueaba el foco, se reactivaron `FlowAgent Control`, `FlowAgent AutoJS` y `FlowKeyboard`.
- Estado final verificado: `/agents` muestra 17/17 agentes, `Bad=0`; `.43` con `accessibility=true`, `keyboardInstalled=true`, `keyboardActive=true`.
- No se instalo masivamente ningun APK nuevo durante esta recuperacion de flota. Solo `.43` recibio reinstalacion estable para rollback del experimento.

**Fase 6 - intento y rollback seguro:**
- Se intento un bridge experimental `AutoJsAccessibilityEngine` usando APIs internas de AutoJs6 (`AccessibilityServiceUsher`/servicio AutoJs).
- El experimento compilo e instalo solo en `.43`, pero produjo respuestas inestables por socket: timeouts, `engine=none` y estados falsos de accesibilidad/teclado tras reinstalar.
- Se revirtio el bridge experimental antes de desplegarlo en flota. `AutoJsAccessibilityEngine.java` no queda en el arbol.
- Queda agregado diagnostico no disruptivo de `engine` en respuestas de socket:
  - `flowaccessibility` para comandos atendidos por `FlowAccessibilityService`.
  - `opencv` para `image_match_template`.
  - `none` cuando no hay AccessibilityService activo.
  - `socket` para errores atrapados en el cliente socket.
- Conclusion: Fase 6 NO queda completa. La siguiente tarea pendiente real es implementar/migrar el engine AutoJs6 de forma segura sin romper el socket ni el binding de servicios. Hasta entonces, el motor estable sigue siendo `FlowAccessibilityService`.


## Actualizacion 2026-06-08 - Fase 6.1/6.2 probe AutoJs6 seguro

**Objetivo:**
- Retomar Fase 6 sin repetir el fallo anterior: primero detectar el estado real del servicio AutoJs6 interno sin ejecutar gestos ni reemplazar el motor estable.

**Restore point:**
- Creado `restore_points/2026-06-08_MONOLITO_PRO_FASE6_SAFE_PROBE`.
- Incluye `PROJECT_CONTEXT.md`, `TASKS_MONOLITO_PRO.md`, `local_adb_server.py`, `AgentSocketClient.java`, `FlowAccessibilityService.java`, `AndroidManifest.xml` y APK release estable previo.

**Cambios APK monolito:**
- Nuevo archivo: `flow_agent_monolito/app/src/main/java/com/flowlogin/agent/runner/AutoJsEngineProbe.java`.
- Nuevo comando socket explicito: `engine_probe`.
- `engine_probe` solo lee:
  - `org.autojs.autojs.core.accessibility.AccessibilityService.Companion.getInstance()`.
  - clase real del servicio.
  - disponibilidad de `rootInActiveWindow` y `fastRootInActiveWindow`.
  - paquete/clase del root cuando existe.
- No llama `dispatchGesture`, no hace taps, no hace swipes, no cambia engine por defecto y no toca FlowLogin.
- El resto de comandos sigue por `FlowAccessibilityService`; el fallback estable queda intacto.

**Validacion:**
- Build ejecutado: `.\gradlew.bat :app:assembleAppRelease` OK.
- Instalacion ejecutada solo en `192.168.1.43:5555`: `adb install -r ...agent-v1.0.0-arm64-v8a.apk` -> `Success`.
- No se instalo en los otros 16 dispositivos.
- Antes de instalar: `/agents` 17/17, `Bad=0`.
- Despues de instalar en `.43`, se reactivaron:
  - `enabled_accessibility_services=com.flowlogin.agent/org.autojs.autojs.core.accessibility.AccessibilityServiceUsher:com.flowlogin.agent/.FlowAccessibilityService`.
  - `accessibility_enabled=1`.
  - `ime enable/set com.flowlogin.agent/.FlowKeyboardService`.
- Prueba `engine_probe` por `/agent/command` en `.43`:
  - `ok=true`.
  - `engine=autojs`.
  - `probeOnly=true`.
  - `serviceReady=true`.
  - `serviceClass=org.autojs.autojs.core.accessibility.AccessibilityServiceUsher`.
  - `rootReady=true`.
  - root observado: `packageName=com.android.systemui`, `className=android.widget.FrameLayout`.
- Prueba baseline `status` por `/agent/command` en `.43`:
  - `ok=true`.
  - `engine=flowaccessibility`.
  - `hasRoot=true`.
- Segundo paso seguro agregado:
  - `AutoJsEngineProbe.dump(maxNodes)` recorre nodos desde `rootInActiveWindow` o `fastRootInActiveWindow`, solo lectura.
  - Nuevo comando socket explicito: `engine_dump`.
  - `dump` tambien acepta opt-in `engine=autojs`; sin ese opt-in sigue usando `FlowAccessibilityService`.
- Prueba comparativa en `.43` con `maxNodes=30`:
  - `engine_dump`: `ok=true`, `engine=autojs`, `count=15`, primer paquete `com.android.systemui`.
  - `dump` legacy: `ok=true`, `engine=flowaccessibility`, `count=5`.
  - Sin timeouts y sin romper el comando legacy.
- Tercer paso seguro agregado:
  - `AutoJsEngineProbe.tap(x,y,duration)` usa `dispatchGesture` del servicio AutoJs6 con `GestureResultCallback`, `CountDownLatch` y timeout corto.
  - Nuevo comando socket explicito: `engine_tap`.
  - `tap` tambien acepta opt-in `engine=autojs`; sin ese opt-in sigue usando `FlowAccessibilityService`.
- Prueba `engine_tap` en `.43`:
  - Pantalla activa: dialogo Android de MediaProjection (`com.android.systemui`).
  - Coordenada elegida: `x=540`, `y=1309`, sobre texto no clicable del dialogo; se evito tocar `Cancel` y `Start now`.
  - Resultado: `ok=true`, `engine=autojs`, `dispatchAccepted=true`, `completed=true`, `cancelled=false`, `timeout=false`, `duration=80`.
  - Verificacion posterior: `engine_dump` siguio respondiendo, el dialogo seguia visible (`Start now` presente), y `status` legacy siguio respondiendo con `engine=flowaccessibility`.
- Cuarto paso seguro agregado:
  - `AutoJsEngineProbe.swipe(...)` usa el mismo helper `dispatchPath(...)` con `GestureResultCallback`, `CountDownLatch` y timeout corto.
  - Soporta linea recta y curva `quadTo` cuando se envian `controlX/controlY`.
  - Nuevo comando socket explicito: `engine_swipe`.
  - `swipe` tambien acepta opt-in `engine=autojs`; sin ese opt-in sigue usando `FlowAccessibilityService`.
- Prueba `engine_swipe` en `.43`:
  - Pantalla activa: el mismo dialogo Android de MediaProjection.
  - Coordenadas elegidas: `startX=540`, `startY=1309`, `endX=560`, `endY=1309`, sobre texto no clicable; micro-movimiento para no pulsar botones ni desplazar la pantalla.
  - Resultado: `ok=true`, `engine=autojs`, `dispatchAccepted=true`, `completed=true`, `cancelled=false`, `timeout=false`, `duration=120`.
  - Verificacion posterior: `engine_dump` siguio respondiendo, `Start now` seguia presente y `status` legacy siguio respondiendo con `engine=flowaccessibility`.
- Nota de estado: `/agents` puede reportar `keyboardActive=false` tras reinstalar si no hay un campo de texto enfocado, aunque Android muestre `default_input_method=com.flowlogin.agent/.FlowKeyboardService`. No se forzo pantalla/tap adicional solo para instanciar el InputView.

**Estado Fase 6:**
- Completado el probe seguro de AutoJs6.
- Completada la lectura de nodos/estado en modo opt-in (`engine_dump` / `dump engine=autojs`).
- Completado `tap` en modo opt-in (`engine_tap` / `tap engine=autojs`).
- Completado `swipe` en modo opt-in (`engine_swipe` / `swipe engine=autojs`).
- `dispatchGesture` queda encapsulado en `dispatchPath(...)` con callback y timeout para `tap` y `swipe`.
- Bateria endpoint por endpoint en `.43` completada:
  - `engine_probe`: `ok=true`, `engine=autojs`.
  - `engine_dump`: `ok=true`, `engine=autojs`, `count=12`.
  - `status` legacy: `ok=true`, `engine=flowaccessibility`.
  - `dump` legacy: `ok=true`, `engine=flowaccessibility`, `count=5`.
  - `engine_tap` con coordenadas invalidas: `ok=false`, error JSON controlado.
  - `engine_swipe` con coordenadas invalidas: `ok=false`, error JSON controlado.
  - `ocr_detect`: `ok=false`, error JSON controlado porque `ScreenCaptureThread` no estaba activo.
  - `image_match_template`: `ok=false`, `engine=opencv`, error JSON controlado por template inexistente.
  - `stop_script` con executionId inexistente: `ok=true`, `stopped=0`.
  - `run_script` con path vacio: `ok=false`, error JSON controlado.
- Decision OCR/image: se mantienen como bridges visuales (`OcrBridge` y `OpenCvBridge`), no como parte del engine de accesibilidad. Ya responden sin bloquear el socket.
- Fase 6 queda cerrada en modo opt-in. Para Fase 7 no se debe desactivar `FlowAccessibilityService` hasta que los comandos por defecto puedan rutearse por AutoJs6 cuando el servicio legacy no exista.

### Actualizacion 2026-06-08 - Fase 6.3 hardening socket / captura explicita

Durante la prueba gradual posterior a `.43`, los dispositivos `192.168.1.44:5555` y `192.168.1.53:5555` aparecian conectados en `/agents` con `lastSeen` reciente, `versionCode=105` y ambos servicios de accesibilidad activos, pero los comandos por `/agent/command` devolvian timeout. Para evitar que cualquier comando pesado bloquee el canal obligatorio del socket:

- `AgentSocketClient.handleIncoming(...)` ahora solo parsea el comando y lanza un worker `FlowAgentCommand-*`.
- El procesamiento real vive en `processCommand(...)` y responde con `synchronized(writer)` para mantener seguro el `PrintWriter`.
- Se agregaron logs `FlowAgentSocket` de comando recibido/completado/error para diagnosticar timeouts reales en logcat.
- El backend `local_adb_server.py` dejo de enviar `capture_screen_start` automaticamente durante `hello`.
- La captura de pantalla queda como accion explicita desde Electron; esto respeta AGENTS.md y evita dialogs de MediaProjection o bloqueos del socket al reconectar.

Validacion local:

- `python -m py_compile local_adb_server.py` OK.
- `.\gradlew.bat :app:assembleAppRelease` OK, APK monolito release generado con `versionCode=105`.

Pendiente inmediato:

- Instalar este build endurecido solo en el grupo de prueba `.43`, `.44`, `.53`.
- Reiniciar backend Python para cargar el cambio de `local_adb_server.py` y limpiar conexiones antiguas.
- Revalidar `engine_probe`, `engine_dump`, `status`, `dump`, `engine_tap` invalido y `engine_swipe` invalido en los 3 dispositivos antes de avanzar a Fase 7 o Fase 8 masiva.

### Actualizacion 2026-06-08 - Fase 6.4 probe AutoJs6 sin lectura de root

En la bateria de 3 dispositivos, `.53` completo comandos inicialmente, pero `.44` y luego `.53` quedaron con `FlowAgentSocket: Command received name=engine_probe` sin `Command completed`. La causa probable es que `engine_probe` todavia llamaba `getRootInActiveWindow()` / `getFastRootInActiveWindow()`, y esas APIs internas de AutoJs6 pueden bloquear en algunos estados de ventana/modelos.

Cambio aplicado:

- `AutoJsEngineProbe.probe()` ahora solo valida disponibilidad del servicio AutoJs6:
  - `ok`.
  - `engine=autojs`.
  - `probeOnly=true`.
  - `serviceReady`.
  - `serviceClass`.
  - `rootRead=false`.
- La lectura de nodos queda exclusivamente en `engine_dump`, que es el comando opt-in de inspeccion de arbol.

Validacion local:

- `.\gradlew.bat :app:assembleAppRelease` OK.
- `python -m py_compile local_adb_server.py` OK.

Pendiente inmediato:

- Reinstalar este build en `.43`, `.44`, `.53`.
- Repetir `engine_probe` primero; luego probar `status` legacy, `engine_tap` invalido y `engine_swipe` invalido.
- Probar `engine_dump` por separado y tratarlo como riesgoso hasta que no tenga timeout propio o fallback controlado.

### Actualizacion 2026-06-08 - Fase 6.5 backend socket anti-respuestas cruzadas

Tras instalar el probe sin lectura de root, `.44` y `.53` mostraron en logcat:

- `FlowAgentSocket: Command received name=engine_probe`.
- `FlowAgentSocket: Command completed name=engine_probe ok=true`.

Pero el backend seguia devolviendo timeout. Esto indica que el APK completaba el comando, pero el servidor no encontraba/despertaba el `pending` asociado al `requestId`, probablemente por reconexiones rapidas durante reinstalacion y sockets antiguos con el mismo `agentId`/serial.

Cambio aplicado en `local_adb_server.py`:

- `register_agent(...)` ahora cierra conexiones previas por `agentId` y tambien por `serial`.
- Al recibir `response`, si el `pending` no esta en la instancia actual, el backend busca globalmente el mismo `requestId` en las demas conexiones antes de descartar la respuesta.

Validacion local:

- `python -m py_compile local_adb_server.py` OK.

Pendiente inmediato:

- Reiniciar backend Python.
- Relanzar FlowAgent en `.43`, `.44`, `.53`.
- Repetir `engine_probe` en los tres y confirmar que el backend ya recibe las respuestas que Android esta completando.

### Actualizacion 2026-06-08 - Fase 6.6 cache global por requestId

La defensa por busqueda global en conexiones visibles no resolvio `.44/.53`: Android seguia completando `engine_probe`, pero HTTP devolvia timeout. Para cubrir respuestas que llegan por una instancia de socket ya reemplazada o fuera de `AGENT_CONNECTIONS`, el backend ahora mantiene una cache global corta:

- `AGENT_RESPONSE_CACHE` guarda respuestas huérfanas por `requestId`.
- `send_agent_command(...)` revisa esa cache antes de declarar timeout.
- La cache purga entradas de mas de 120 segundos.

Validacion local:

- `python -m py_compile local_adb_server.py` OK.

Pendiente inmediato:

- Reiniciar backend y repetir `engine_probe` en `.43/.44/.53`.

### Actualizacion 2026-06-08 - Fase 6.7 respuestas por writer actual del APK

La cache global no resolvio `.44/.53`, y logcat seguia mostrando que Android completaba `engine_probe`. La hipotesis mas probable es que el worker de comando estuviera escribiendo en un `PrintWriter` local asociado a un socket antiguo/cerrado; `PrintWriter.println()` no lanza excepcion, por lo que el APK registraba "completed" aunque la respuesta no llegara al backend.

Cambio aplicado en `AgentSocketClient`:

- `processCommand(...)` ahora responde mediante `sendResponse(...)`.
- `sendResponse(...)` prioriza el `writer` volatil actual del cliente y usa el writer local solo como fallback.
- Se fuerza `flush()` y se registra `writer.checkError()` en logcat si la respuesta no puede salir.

Validacion local:

- `.\gradlew.bat :app:assembleAppRelease` OK.
- `python -m py_compile local_adb_server.py` OK.

Pendiente inmediato:

- Instalar el APK recompilado en `.43`, `.44`, `.53`.
- Repetir `engine_probe` por backend y confirmar que `.44/.53` ya no quedan en timeout.

### Actualizacion 2026-06-08 - Fase 6.8 escritura serializada del socket APK

Como `.44/.53` seguian completando comandos en logcat sin que el backend recibiera respuesta, se reviso la concurrencia del writer:

- `sendFrame(...)` y `sendResponse(...)` podian escribir sobre el mismo `PrintWriter` usando locks distintos.
- Si dos JSON se intercalaban en la misma linea, `local_adb_server.py` descartaba el mensaje por fallo de `json.loads`, dejando el pending en timeout.

Cambio aplicado en `AgentSocketClient`:

- `sendFrame(...)` ahora sincroniza sobre el mismo `PrintWriter`.
- `sendResponse(...)` usa `writeJsonLine(...)`.
- `writeJsonLine(...)` centraliza `println`, `flush` y `checkError`.

Validacion local:

- `.\gradlew.bat :app:assembleAppRelease` OK.
- `python -m py_compile local_adb_server.py` OK.

Pendiente inmediato:

- Instalar este build en `.44` y `.53`.
- Repetir `engine_probe` y revisar si desaparece el timeout.

### Actualizacion 2026-06-08 - Resultado prueba `.44/.53` tras envio redundante

Resultado: el timeout persiste en `.44` y `.53`.

Evidencia:

- Backend `reports/agent_socket_diag.log`:
  - Registra `command_send`.
  - Luego `command_timeout`.
  - No registra `response`, `response_matched`, `response_orphan_cached` ni `json_error`.
- Logcat Android:
  - `.44` recibe el mismo `requestId` y registra `Command completed ... ok=true`.
  - `.53` recibe el mismo `requestId` y registra `Command completed ... ok=true`.

Conclusion actual:

- El comando HTTP -> backend -> socket -> APK si llega.
- El APK procesa `engine_probe` correctamente.
- La respuesta APK -> socket -> backend no llega a Python, ni siquiera corrupta.
- No avanzar a Fase 7 (una sola accesibilidad) ni Fase 8 masiva hasta resolver este retorno de respuesta en al menos `.43/.44/.53`.

Siguiente investigacion recomendada:

- Sustituir `PrintWriter` por escritura directa a `OutputStream` con lock unico y `Socket.setTcpNoDelay(true)`.
- Registrar en APK el puerto local/remoto del socket activo al recibir y responder.
- Registrar en backend eventos `accept`, `hello`, `disconnect` con address/agentId/serial para correlacionar exactamente con el socket Android.
- Probar `ping/status` legacy en `.44/.53` despues de ese cambio, antes de `engine_dump`.

### Actualizacion 2026-06-08 - Fase 6.10 OutputStream directo en APK

Se reemplazo la ruta critica de respuesta del socket en `AgentSocketClient`:

- `PrintWriter` sale de la ruta de respuesta.
- Se usa `OutputStream` directo con `write((payload + "\n").getBytes(UTF_8))` y `flush()`.
- `sendFrame(...)`, `hello` y `sendResponse(...)` comparten escritura por `writeJsonLine(...)`.
- Si falla el retorno del socket, ahora debe aparecer excepcion real en logcat (`sendResponse failed`) en vez de fallo silencioso de `PrintWriter`.

Validacion:

- `python -m py_compile local_adb_server.py` OK.
- APK release regenerado: `flow_agent_monolito/app/build/outputs/apk/app/release/agent-v1.0.0-arm64-v8a.apk`, `LastWriteTime` actualizado tras build.

Pendiente inmediato:

- Instalar en `.44` y `.53`.
- Revalidar `engine_probe`, luego `status` legacy.

### Actualizacion 2026-06-08 - Fase 8 prueba 3 dispositivos OK

Se confirmo la causa practica de los timeouts en `.44/.53`: habia cola/backlog de respuestas en el socket, compatible con captura/frames antiguos saturando el flujo. La recuperacion efectiva fue:

- `am force-stop com.flowlogin.agent` en `.44/.53`.
- Reinicio del backend Python.
- Relanzamiento sin captura automatica.
- APK con `OutputStream` directo instalado.

Prueba de 3 dispositivos completada en `.43`, `.44`, `.53`:

- `engine_probe`: `ok=true`, `engine=autojs`, `serviceReady=true`, `rootRead=false`.
- `status`: `ok=true`, `engine=flowaccessibility`.
- `engine_tap` con coordenadas invalidas: `ok=false`, error JSON controlado.
- `engine_swipe` con coordenadas invalidas: `ok=false`, error JSON controlado.

Estado:

- Socket obligatorio vuelve a responder en los 3 dispositivos.
- AutoJs6 service disponible en los 3.
- `FlowAccessibilityService` se mantiene activo como fallback legacy.
- Ya se puede ampliar a Fase 8 flota completa con instalacion/reinicio controlado.

### Actualizacion 2026-06-08 - Fase 8 flota completa OK

Despliegue y saneamiento completo realizados:

- APK monolito release instalado con `Success` en los 14 dispositivos restantes.
- APK ya estaba instalado/actualizado en `.43`, `.44`, `.53`; se mantuvo el mismo build.
- `am force-stop com.flowlogin.agent` ejecutado en 17/17 para cortar colas viejas de socket/captura.
- Backend Python reiniciado.
- `adb reverse` aplicado en 17/17 para `8766`, `8765` y `5000`.
- Accesibilidad restaurada en 17/17:
  - `com.flowlogin.agent/org.autojs.autojs.core.accessibility.AccessibilityServiceUsher`.
  - `com.flowlogin.agent/.FlowAccessibilityService`.
- `FlowKeyboardService` habilitado y seleccionado en 17/17.
- `MainActivity` lanzada con `host=127.0.0.1`, `port=8766`, `serial=<adb serial>`, `autoconnect=true` en 17/17.

Validacion global:

- `/agents`: 17 agentes conectados, `agentVersion=1.0.0`, `accessibility=true`.
- Bateria socket en 17/17:
  - `engine_probe`: `ok=true`, `engine=autojs`, `serviceReady=true`.
  - `status`: `ok=true`, `engine=flowaccessibility`.
- Sin timeouts en la validacion global.

Notas:

- `keyboardActive=false` puede aparecer en algunos dispositivos cuando no hay campo de texto enfocado; el IME fue habilitado/seleccionado correctamente.
- `hasRoot=false` en algunos `status` indica que no habia ventana accesible/root activo en ese instante, no fallo de socket.
- La captura de pantalla sigue siendo accion explicita; no se lanza automaticamente para evitar backlogs.

### Actualizacion 2026-06-08 - Fase 6.9 diagnostico persistente del socket backend

Como `.44/.53` siguen completando `engine_probe` en Android pero el backend devuelve timeout, se agrego diagnostico persistente local en `reports/agent_socket_diag.log`.

Eventos registrados:

- `command_send` con `agentId`, serial, `requestId` y comando.
- `response` recibida por socket.
- `response_matched`.
- `response_orphan_cached`.
- `json_error` cuando una linea no parsea como JSON.
- `command_cache_hit`.
- `command_timeout`.

Validacion local:

- `python -m py_compile local_adb_server.py` OK.

Uso inmediato:

- Reiniciar backend.
- Ejecutar un `engine_probe` en `.44/.53`.
- Leer las ultimas lineas de `reports/agent_socket_diag.log` para saber si la respuesta entra rota, huerfana o no entra.

### Actualizacion 2026-06-08 - Accion contextual Instalar FlowAgent APK

Se agrego en Electron una opcion nueva en el menu contextual de cada dispositivo:

- `Instalar FlowAgent APK`.
- Opera sobre el dispositivo clicado o sobre la seleccion multiple activa.
- Llama a `/flowagent/setup-smart` con `requestCapture=true` y `forceRelaunch=true`.
- Muestra resumen final con dispositivos ya correctos, instalados/actualizados, socket conectado, captura preparada y errores/avisos.

Backend actualizado:

- `/flowagent/setup-smart` ahora acepta `requestCapture` y `forceRelaunch`.
- El setup inteligente instala solo si falta FlowAgent o si la version instalada es menor que `FLOW_AGENT_EXPECTED_VERSION`.
- El componente de accesibilidad valido para el monolito es `com.flowlogin.agent/org.autojs.autojs.core.accessibility.AccessibilityServiceUsher`.
- Al activar accesibilidad se evita reactivar el servicio legacy `FlowAccessibilityService`, para mantener una sola accesibilidad del monolito.
- Aplica `adb reverse` para `8766`, `8765` y `5000`.
- Concede permisos declarados cuando proceda, habilita overlay por `appops`, selecciona `FlowKeyboardService`, relanza `MainActivity` con autoconnect y valida `engine_probe` por socket.
- Para captura, envia `capture_screen_start` sin streaming de frames (`streamFrames=false`). Si aparece el dialogo de MediaProjection, solo intenta aceptar botones explicitos como `Start now`, `Iniciar ahora`, `Permitir`, `Aceptar` u `OK`; no marca casillas ni navega ajustes generales.
- El APK que instala `/flowagent/setup-smart` se mantiene como el monolito release probado en flota: `flow_agent_monolito/app/build/outputs/apk/app/release/agent-v1.0.0-arm64-v8a.apk`. El `universal.apk` de la misma build queda como fallback, no como preferido.

Validacion local:

- `python -m py_compile local_adb_server.py` OK.
- `node --check electron-app/src/renderer/app.js` OK.

Verificacion de APK activo:

- `/health` reporta `flowAgentApk=C:\DASHBOARD\FlowDashboard\flow_agent_monolito\app\build\outputs\apk\app\release\agent-v1.0.0-arm64-v8a.apk`.
- Archivo verificado: `agent-v1.0.0-arm64-v8a.apk`, `versionCode=105`, `versionName=1.0.0`, ABI `arm64-v8a`.
- SHA256: `61690515E057275AF01D9492B820154124E1D7A33AF480EDDE24549418B4C8D8`.
- `/flowagent/setup-smart` ahora compara tambien `versionCode=105`; si un dispositivo tuviera `versionName=1.0.0` pero `versionCode` menor, se actualiza igualmente.
- Prueba seca en `.43` con `requestCapture=false`: `installed=0`, `alreadyLatest=1`, `connected=1`, `engine_probe OK`, sin errores. Esto confirma que `/flowagent/setup-smart` no reinstala si el monolito actual ya esta correcto.

### Actualizacion 2026-06-08 - Focus control ON y scrcpy raw verificados

Se corrigieron dos causas del estado `Control OFF` / `Sin frame aun` en Focus:

- `flow-touch.js` ahora abre Focus con `h264.attachFocus(serial, canvas, preset)` y guarda la clave real `serial|preset`.
- `_refreshFrameState(...)` lee stats H.264 desde esa clave real, no desde `serial__focus`.
- Al cerrar Focus se llama `detachFocus(serial, preset)` para limpiar la sesion dedicada.
- `FlowTouchCommandRouter.resolveAgent(...)` ya no bloquea el control solo por un `accessibility=false` viejo del hello; ejecuta `engine_probe` y acepta el control si `serviceReady` no es falso.
- `_refreshAgentState(...)` usa el mismo fallback de `engine_probe` antes de mostrar `FlowAgent sin accesibilidad`.
- `local_adb_server.py` actualiza `agent.meta.accessibility=true` cuando un comando `engine_probe` confirma `ok=true` y `serviceReady` valido.

Validacion ejecutada:

- Backend Python reiniciado.
- `/flowagent/setup-smart` en toda la flota con `requestCapture=false`, `forceRelaunch=true`:
  - `total=17`, `alreadyLatest=17`, `connected=17`, `alreadySetup=17`, `withErrors=0`.
  - En 17/17: `agentVersion=1.0.0`, `agentVersionCode=105`, `engine_probe OK`, `accessibilityReady=true`, `socketReady=true`.
- `/agents` despues del saneamiento: `total=17`, `accessibilityTrue=17`, `v105=17`.
- `scrcpy 4.0` verificado con `scrcpy.exe --version`.
- WebSocket raw H.264 escuchando en `127.0.0.1:8768`.
- Prueba WS contra `.43` en preset `balanced`: recibidos 12 chunks / 13064 bytes H.264; la sesion se cerro despues con `/streaming/raw/stop`.

Nota:

- `requestCapture=false` es intencional en el saneamiento de flota porque Focus usa scrcpy raw H.264, no MediaProjection. La captura MediaProjection sigue siendo para OCR/captura interna del FlowAgent y puede pedir permiso visual Android.

### Actualizacion 2026-06-08 - FlowDev Inspector robusto y retorno Focus -> Grid

Se fortalecio el FlowDev Inspector embebido en Focus:

- El modo `Tree` ahora combina dos fuentes en cada `Capturar UI`: `Accessibility` via FlowAgent y `UIAutomator` via ADB.
- `/inspector/dump` acepta `refresh=true` y fuerza un dump fresco de UIAutomator, sin devolver cache vieja.
- Los nodos se deduplican por `sourceId/text/class/bounds` y conservan `source`, `resourceId`, `sourceId`, `contentDesc`, `bounds` y `raw`.
- `Copiar Source ID` usa `sourceId || resourceId` y ya no reporta exito si el valor esta vacio.
- Se agrego fallback de clipboard con textarea para casos donde `navigator.clipboard` falle en Electron.
- El detalle de nodo muestra fuente, texto, Source ID, bounds normalizados, centro, clickable y permite copiar JSON completo.
- `_fpCenterFromBounds` ahora soporta bounds como objeto `{left, top, right, bottom}`, ademas de strings/arrays.

Tambien se corrigio el retorno de Focus a Grid:

- Al cerrar Focus se cierran todas las sesiones H.264 de Focus (`serial|preset`), se desasocia el canvas Focus de cualquier sesion de grilla y se reengancha el canvas de grilla.
- Si la sesion de grilla esta desconectada o lleva mas de 3 segundos sin frame, se reinicia solo esa sesion.
- `H264StreamRenderer.attach(...)` reconecta aunque el canvas ya existiera si el WebSocket no esta abierto.
- Cambiar calidad de Focus ya no adjunta el canvas Focus a la sesion de grilla; usa `attachFocus(...)` independiente para no congelar thumbnails.

Validacion local:

- `node --check electron-app/src/renderer/flow-touch.js` OK.
- `node --check electron-app/src/renderer/stream-renderer-h264.js` OK.
- `node --check electron-app/src/renderer/app.js` OK.
- `python -m py_compile local_adb_server.py` OK.
- Backend Python reiniciado.
- `/devices`: 17 dispositivos visibles.
- `/agents`: 17 agentes visibles.
- Prueba en `192.168.1.43:5555`:
  - `/inspector/dump` con `refresh=true`: `ok=true`, `method=uiautomator`, `cached=false`, `nodes=37`.
  - `/inspector/accessibility-dump`: `ok=true`, `method=accessibility`, `nodes=50`.

### Actualizacion 2026-06-08 - Estabilidad FlowDev Inspector / Control / OCR

Se investigo una inestabilidad al usar FlowDev Inspector en Focus:

- Sintoma observado: al usar OCR/Inspector, el dashboard podia apagar `Control OFF` aunque el dispositivo volviera a aparecer conectado.
- Prueba controlada en `192.168.1.43:5555`:
  - `engine_probe` OK.
  - `/inspector/accessibility-dump` OK con 52 nodos.
  - `/inspector/dump` OK con UIAutomator y 24 nodos.
  - OCR inicialmente podia dejar una ventana corta donde `/flowagent/ocr-detect` devolvia `FlowAgent no conectado`, pero el agente se reconectaba solo y Android seguia con `AccessibilityServiceUsher` habilitado.
- Conclusion: no se confirmo que Android apague la Accesibilidad; el problema era una combinacion de parpadeo/reconexion del socket/captura y auto-disarm demasiado agresivo en Electron.

Cambios aplicados:

- `flow-touch.js`:
  - Mientras FlowDev Inspector esta capturando (`_fpInspectorBusy`), no se auto-desarma el control por lecturas transitorias de agente/frame.
  - `_refreshAgentState(...)` guarda el ultimo `engine_probe` correcto y no apaga control si hay una prueba reciente valida.
  - Antes de auto-desarmar por agente/accesibilidad, intenta `resolveAgent(...)` una vez para confirmar fallo real.
  - El resumen del Inspector muestra errores de OCR/captura en vez de ocultarlos.
- `local_adb_server.py`:
  - Se agrego `wait_agent_for_serial(...)` para esperar reconexiones cortas del FlowAgent.
  - `/flowagent/run-script`, `/flowagent/stop-script`, `/flowagent/ocr-detect`, `/flowagent/find-template` y `/inspector/accessibility-dump` esperan unos segundos al agente si el socket acaba de reconectar.
  - `/flowagent/ocr-detect` hace preflight con `capture_screen_start(streamFrames=false)` antes de ejecutar OCR. Si no hay permiso MediaProjection, devuelve el mensaje de permiso sin tumbar el socket.

Validacion:

- `node --check electron-app/src/renderer/flow-touch.js` OK.
- `python -m py_compile local_adb_server.py` OK.
- Backend Python reiniciado.
- `/devices`: 17 dispositivos.
- `/agents`: 17 agentes.
- Prueba OCR en `.43` despues del cambio:
  - Respuesta estable: `ok=false`, `error=Solicitando permiso de captura. Acepta el dialogo en el telefono.`
  - Despues de la respuesta: agente conectado, `accessibility=true`, `engine_probe ok=true`, `serviceReady=true`.

Nota operativa:

- OCR y captura interna dependen de MediaProjection. Si Android revoca o no concede el permiso, el Inspector debe avisar y mantener Control/Accessibility estables. La visualizacion Focus/Grid sigue usando scrcpy raw H.264 y no depende de MediaProjection.

### Actualizacion 2026-06-08 - FlowDev Inspector: modos Nativo/Web/Auto y resaltado visual

Se amplio el FlowDev Inspector dentro de Focus:

- Nuevos modos visibles:
  - `Nativo`: usa `/inspector/native-detect` con UIAutomator fresco y contexto `dumpsys`.
  - `Web`: usa `/inspector/web-detect` con CDP/WebView cuando la app activa expone debugging web.
  - `Auto`: usa `/inspector/auto-detect` para probar la cadena automatica del backend.
  - Se mantienen `Tree`, `OCR` y `Hybrid`.
- Al seleccionar un nodo detectado, el dashboard dibuja un recuadro sobre la pantalla del telefono usando los `bounds` del nodo.
- El recuadro vive en `flowTouchGestureLayer`, no modifica ni reinicia el canvas H.264/scrcpy.
- Al cerrar la ventana de FlowDev Inspector, el recuadro se limpia y la pantalla Focus sigue visible normalmente.
- Al iniciar una nueva captura, tambien se limpia cualquier recuadro anterior.
- La lista marca visualmente el nodo seleccionado.

Validacion:

- `node --check electron-app/src/renderer/flow-touch.js` OK.
- `python -m py_compile local_adb_server.py` OK.
- Prueba en `192.168.1.43:5555`:
  - `/inspector/native-detect` metodo `uiautomator`: `ok=true`, `nodes=24`.
  - `/inspector/native-detect` metodo `dumpsys`: `ok=true`, `nodes=1`.
  - `/inspector/auto-detect`: `ok=true`, metodo elegido `uiautomator`, `nodes=24`.
  - `/inspector/web-detect` con `cdp`: devolvio `503` porque la app activa no exponia target CDP/WebView; es esperado si no hay WebView debuggeable.


## Auditoría Perfiles Operativos (2026-06-10)

Se realizó una auditoría completa para confirmar la correcta implementación de la refactorización (Etapa C -> Perfiles).

**Hallazgos en el código (OK):**
- El arranque de Electron no lanza FlowAgent ni procesos de Android de forma autónoma.
- El Inspector en modo *Tree* o *Native* no usa captura `screencap_ocr` por defecto.
- El código de `/control/*` utiliza `scrcpy-control` como vía principal y `adb_input` como fallback, nunca requiriendo FlowAgent.
- Todo cumple la regla de oro: "Control limpio por defecto, automatización y OCR solo bajo demanda".

**Correcciones en la documentación:**
- Nota historica: esta auditoria antigua menciona correcciones en `DOCUMENTACION_TECNICA.md`. Desde 2026-06-20 ese archivo queda legacy/prohibido y no debe usarse como fuente vigente.
- Se ha documentado la función `_flowagent_auto_reconnect_loop()` como inactiva/legacy. Fue desactivada intencionadamente para respetar el Perfil de Control.
- Se añadieron los nuevos endpoints (como `/control/tap` y `/recordings/*`) a la tabla general.

**Estado actual:** Sistema completamente alineado entre documentación y realidad del código base. No quedan regresiones de la Etapa C activas por defecto.

## Reglas de Onboarding de Dispositivos (Refinamiento FASE 2)

Para proteger el perfil de Control, se establecen las siguientes reglas estrictas sobre FlowAgent:

1. **Arranque del Dashboard (Onboarding Automático Permitido SOLO para dispositivos NUEVOS):**
   - Al detectar un dispositivo, si `com.flowlogin.agent` NO existe, se considera dispositivo nuevo.
   - SÍ se permite instalar automáticamente el APK monolito, configurar los `adb reverse` (8766, 8765, 5000), abrir `MainActivity` para registrar el socket e intentar preparar Accesibilidad/FlowKeyboard.
   - **Regla dura:** Este onboarding NO debe iniciar `capture_screen_start`, NO debe iniciar MediaProjection, NO debe iniciar OCR/OpenCV, ni encender iconos de captura.

2. **Dispositivos con APK ya instalado:**
   - NO reinstalar, NO hacer `install -r`, NO actualizar, NO desinstalar automáticamente.
   - Solo diagnosticar estado. Si está viejo, se marca `isOutdated=true`, `needsManualUpdate=true` y se recomienda actualización manual.

3. **Preparación Manual:**
   - Incluso al pulsar explícitamente "Preparar FlowAgent", NO se debe iniciar captura/MediaProjection. Solo prepara Accesibilidad/Socket/Teclado.

4. **Control Normal:**
   - `/control/tap`, `/control/swipe`, etc., usan scrcpy-control o ADB fallback. FlowAgent NO es fallback para Control.

5. **Icono de Captura:**
   - Solo puede encenderse por demanda explícita (OCR, OpenCV, etc.), NUNCA al arrancar o instalar el APK.
## Auditoría FASE 3 (2026-06-10)

- **Dispositivo probado:** `.43`
- **Fecha:** 2026-06-10
- **Endpoints probados:** `/control/tap`, `/control/swipe`, `/control/keyevent`
- **Motor principal usado:** `scrcpy-control` (vía socket directo TCP a `scrcpy-server`)
- **Fallback probado:** `adb_input` con `preferScrcpy=false`
- **Confirmaciones clave:**
  - NO se usó FlowAgent para Control.
  - NO se requirió Accesibilidad.
  - NO se requirió MediaProjection.
  - NO se llamó a `capture_screen_start`.
- **Límites no probados:** `[!] No verificado` comportamiento en multidispositivo con carga masiva, `[!] No verificado` resiliencia ante pérdida de socket inesperada en medio de swipe.
- **Conclusión:** Android 9 NO bloquea `scrcpy-control` en `.43` bajo esta configuración (`video=false audio=false control=true`).

## Handoff / Guía de Continuidad (Si la sesión se corta)

**Estado Actual (FASE 2 Completada):**
Nota historica: esta entrada antigua incluia `DOCUMENTACION_TECNICA.md` como documento actualizado. Desde 2026-06-20, ese archivo queda fuera de la jerarquia vigente; la separacion real de perfiles vive en `AGENTS.md`, `PROJECT_CONTEXT.md` y `docs/master_technical_specification.md`.

**Próximo Paso Inmediato (FASE 3):**
Auditoría técnica profunda sobre la viabilidad de `scrcpy-control` como motor principal de touch/swipe/teclado para el perfil Control, manteniendo ADB input como fallback. 

**Hipótesis pendientes de validar en FASE 3:**
- "Android 9 podría estar bloqueando silenciosamente la inyección de eventos nativa si no hay un display activo o si el socket de control no se enlaza durante el handshake inicial de scrcpy." Esto debe probarse a fondo en el dispositivo `.43` antes de intentar reemplazar ADB input.


### Baseline Cleanup MediaProjection — 2026-06-10
- Se limpió deuda previa de MediaProjection de FlowAgent de forma individual.
- No fue purga masiva ciega.
- No se ejecutó rollout completo.
- No se instaló ni actualizó APK.
- No se ejecutó OCR ni Recording.
- Control no se modificó.
## HOTFIX UI-FOCUS-04 - Stream Recovery aplicado en codigo - 2026-06-11

**Objetivo:** recuperar el ciclo vivo de frames en Grid/Focus sin tocar backend, FlowAgent, OCR, Recording, MediaProjection, taps/control ni Discovery.

**Diagnostico:**
- La regresion venia del flujo de Focus: `_attachStreamCanvas()` dejo de adjuntar directamente el canvas al renderer H.264 y delegaba en `setFocusQuality()`.
- `_refreshFrameState()` seguia mirando la sesion `serial|preset`, por lo que cualquier retorno temprano o sesion no creada dejaba `framesDecoded=0` y el loader fijo.
- Grid podia quedar con una sesion H.264 existente pero no viva, porque `createCanvasesForVisibleDevices()` solo re-adjuntaba si la sesion faltaba o estaba `_closed`, sin comprobar WebSocket abierto ni frame stale.

**Cambios aplicados:**
- `electron-app/src/renderer/flow-touch.js`: `_attachStreamCanvas()` vuelve a llamar directamente a `h264.attachFocus(serial, canvas, focusPreset)` y guarda `_focusSession`, `_currentFocusPreset` y `_focusSerialKey` contra la sesion real.
- `electron-app/src/renderer/app.js`: `createCanvasesForVisibleDevices()` re-adjunta Grid si la sesion existe pero el WebSocket no esta abierto o el ultimo frame supera 5s.
- `setFocusQuality()` mantiene el cambio manual de calidad como ruta independiente para Focus y solo fija `_focusSerialKey` cuando el attach devuelve sesion.

**Validacion local:**
- `node --check electron-app/src/renderer/flow-touch.js` OK.
- `node --check electron-app/src/renderer/app.js` OK.
- Backend Python `127.0.0.1:8765` no estaba escuchando durante la validacion pasiva, por lo que Grid/Focus runtime, `framesDecoded > 0` y control real quedan marcados como no verificados en esta pasada.
- No se reinicio ADB, no se arranco MediaProjection, no se instalo APK, no se tocaron endpoints Python ni `scrcpy_control_channel.py`.
## ESTADO ACTUAL - HOTFIX UI-BOOT-01 (Arranque estable / licencia nula) - 2026-06-11

**Estado Oficial:** `HOTFIX UI-BOOT-01 aplicado en codigo: guard defensivo para licencia guardada nula`.

**Alcance:**
- Se corrigio exclusivamente el arranque UI en `electron-app/src/renderer/app.js`.
- La auto-validacion de licencia ahora tolera `loadSavedLicense() === null` o un objeto sin `email`/clave, registra `[License] No saved license found; skipping auto validation.` y muestra el modal sin lanzar `TypeError`.
- La clave guardada se normaliza de forma retrocompatible desde `key`, `licenseKey` o `license_key`.
- `loadDevices()` no fue condicionado a licencia ni se modifico la logica de backend, Focus, H.264, FlowAgent, OCR, Recording o MediaProjection.

**Restore Point:**
- `restore_points/2026-06-11_PRE_HOTFIX_UI_BOOT_01_LOADING_DEVICES`

## Registro de Cambios Recientes (Visi�n UI y Core)

### Fase HOTFIX-H264-RECONNECT-RACE-01 (Estabilidad H.264)
- **Fecha:** 2026-06-21
- **Problema:** Tras reiniciar un dispositivo, el stream H.264 quedaba con canvas negro a pesar de conectarse. Requer�a cambio manual de calidad para recuperar el v�deo.
- **Causa Ra�z:** Condici�n de carrera temporal. Al reconectar ('offline' -> 'device'), app.js detectaba el cambio y llamaba a createCanvasesForVisibleDevices(). Simult�neamente, el timeout de 250ms de refreshDeviceStreamAfterReconnect volv�a a forzar createCanvasesForVisibleDevices(). Como el WebSocket a�n estaba CONNECTING (scrcpy tarda ~500ms en emitir frames), se abr�a un **segundo WebSocket**. El primer socket consum�a el SPS/PPS pero los ignoraba por el cambio de puntero, y el segundo socket nunca los recib�a, atascando al VideoDecoder.
- **Soluci�n:**
  1. Se protegi� attach y attachFocus en stream-renderer-h264.js para no invocar session.open() si session.ws.readyState === WebSocket.CONNECTING.
  2. Se limpi� refreshDeviceStreamAfterReconnect en app.js para evitar que elimine destructivamente las referencias y evite dobles llamados redundantes.
- **Estado:** Implementado y verificado.


### Fase FOCUS-UI-RESTORE-TOOLS-NONCONTROL-01 (Visual)
- **Fecha:** 2026-06-13
- **Acción:** Recuperación de herramientas ocultas del modo Focus (Selector de Calidad, Panel Técnico de Agent/Frame, Barra Lateral Pro, y Consola Histórica de Logs).
- **Alcance:** Exclusivamente CSS/HTML (innerHTML en `flow-touch.js`).
- **Estado:** Implementado, pendiente de smoke test manual por el usuario.
- **Validación Estricta:** No se tocó H.264 ni la capa de control de eventos.
## H264 DIAGNOSTIC FASE 1 CANARIO (2026-06-14)

**H264-DIAG-PHASE1-CANARY-01:**
- **Estado:** IMPLEMENTADO EN CODIGO, pendiente de reinicio/validacion runtime por operador.
- **Alcance autorizado:** Fase 1 en un solo dispositivo canario para diagnostico H.264 y correccion minima no invasiva. No se toca FlowAgent, Accessibility, OCR, MediaProjection, motor de control ni politica de presets.
- **Premisa comercial corregida:** Un dispositivo usa un unico transporte activo: **USB o WiFi ADB**, no USB+WiFi simultaneo. La identidad estable debe conservar nombres/perfiles al cambiar de USB a WiFi o de WiFi a USB, pero el dashboard no debe asumir ambos transportes activos a la vez.
- **Evidencia previa usada:** Los dispositivos `192.168.1.39:5555`, `192.168.1.48:5555`, `192.168.1.147:5555` y `192.168.1.44:5555` aparecian como `device` en ADB y en `/devices`/`/api/devices`, pero sus sesiones H.264 quedaban practicamente mudas (`bytes_streamed=653`) y un cliente WS tardio recibia solo SPS/PPS (`NAL [7,8]`) sin IDR.
- **Cambios aplicados:**
  - `scrcpy_raw_streamer.py`: agrega contadores diagnosticos por sesion H.264 (`first_nal_types`, `nal_type_counts`, `sps_count`, `pps_count`, `idr_count`, `non_idr_count`, timestamps de SPS/PPS/IDR, `seconds_since_last_byte`) expuestos en `/streaming/raw/sessions`.
  - `electron-app/src/renderer/stream-renderer-h264.js`: limpia el buffer real `_residue` al desmontar el decoder, evitando que residuos de NALUs incompletos sobrevivan a cambios de preset/reconnect. Tambien expone en `getStats()` bytes, chunks, NALs, SPS/PPS/IDR, errores de decode, residuo pendiente y estado del decoder.
- **Motivo:** Separar con evidencia si el fallo es backend/scrcpy-server (no llega IDR/bytes), frontend/parser/WebCodecs (residuo/errores decode) o lifecycle de sesion.
- **Pendiente de prueba:** Reiniciar el dashboard/backend cuando el operador lo autorice, abrir un canario problematico, revisar `/streaming/raw/sessions` y `window.app.h264Renderer.getStats(serial)` en Electron. Resultado esperado: ver claramente si hay SPS/PPS pero no IDR, si bytes quedan congelados, o si WebCodecs acumula errores/residuo tras tap/swipe.

## H264 SCID FASE 2 CANARIO (2026-06-14)

**H264-SCID-PHASE2-CANARY-01:**
- **Estado:** IMPLEMENTADO EN CODIGO, pendiente de reinicio con variable de canario y validacion runtime.
- **Validacion de Fase 1 ya realizada:** Tras reinicio autorizado, `/streaming/raw/sessions` confirmo que los cuatro dispositivos problematicos reciben SPS/PPS e IDR inicial, pero se quedan congelados en `bytes_streamed=653`, `chunks_read=13`, `sps_count=1`, `pps_count=1`, `idr_count=1`, `non_idr_count=10`.
- **Nueva causa probable:** No es ausencia inicial de IDR. La evidencia apunta a ciclo de vida/sesion/socket: multiples `app_process` de scrcpy vivos por telefono y video usando `localabstract:scrcpy` sin `scid`, aunque el backend generaba un `scid` solo diagnostico.
- **Cambio aplicado:** `scrcpy_raw_streamer.py` ahora puede usar `scid` real para video: pasa `scid=<8 hex lower-case>` a `scrcpy-server` y crea el `adb forward` contra `localabstract:scrcpy_<scid hex lower-case>`.
- **Correccion durante canario:** La documentacion/codigo oficial local confirma que `Options.java` parsea `scid` en base 16 y el cliente oficial (`server.c`) envia `scid=%08x`. El canario inicial fallaba con `Server cerro la conexion sin transmitir` porque se paso `scid` decimal mientras el forward apuntaba a hex. Se corrigio para enviar `scid=<8 hex lower-case>`.
- **Alcance seguro:** El comportamiento por defecto sigue usando `localabstract:scrcpy`. El uso real de `scid` solo se activa por runtime con `FLOW_H264_SCID=1`, `FLOW_H264_SCID_SERIALS=<seriales>` o `FLOW_H264_CANARY_SERIAL=<serial>`.
- **Canario recomendado:** `FLOW_H264_CANARY_SERIAL=192.168.1.39:5555` para validar un solo dispositivo problematico antes de extender a la flota.
- **No modificado:** No se toca FlowAgent, Accessibility, OCR, MediaProjection, `scrcpy_control_channel.py`, politicas de presets, rutas comerciales ni identidad de dispositivos.
- **Criterio de exito:** En `/streaming/raw/sessions`, el canario debe mostrar `scid_enabled=true`, `socket_name=scrcpy_<scid>`, forward ADB hacia ese socket, y dejar de quedar fijo en `653` bytes tras abrir Grid/Focus o generar movimiento.
- **Resultado de validacion canario:** Con `FLOW_H264_CANARY_SERIAL=192.168.1.39:5555`, el backend mostro `scid_enabled=true`, `socket_name=scrcpy_00f4ff29` y forward ADB hacia `localabstract:scrcpy_00f4ff29`. El stream arranco y recibio SPS/PPS/IDR, pero volvio a congelarse en el mismo patron (`bytes_streamed=653`, `chunks_read=13`, `idr_count=1`, `non_idr_count=10`).
- **Conclusion Fase 2:** `scid` real corrige la contradiccion tecnica y evita colision de socket como deuda comercial, pero **no resuelve por si solo** el fallo de los 4 dispositivos problematicos. La siguiente investigacion debe enfocarse en ciclo de vida del server raw: procesos `app_process` stale con `cleanup=false`, socket que queda vivo sin emitir, recovery por dispositivo y/o condiciones del encoder tras los primeros P-frames.
- **Estado operativo tras prueba:** Se cerro la sesion canario, se verifico que no quedara el forward `scrcpy_00f4ff29`, y se reinicio el backend Python en modo normal sin `FLOW_H264_CANARY_SERIAL`. Durante el cierre forzado de Electron aparecio un dialogo de Windows `electron.exe - Application Error (0x80000003)`, clasificado como consecuencia del cierre abrupto de Electron durante reinicio, no como evidencia H.264.

## H264 RECOVERY FASE 3 CANARIO (2026-06-14)

**H264-RECOVERY-PHASE3-CANARY-01:**
- **Estado:** IMPLEMENTADO EN CODIGO, pendiente de reinicio backend y validacion canario.
- **Objetivo:** Corregir ciclo de vida de sesiones H.264 que quedan vivas pero sin emitir bytes utiles, sin reiniciar toda la flota y sin tocar FlowAgent, Accessibility, OCR, MediaProjection ni control manual.
- **Cambios aplicados:**
  - `scrcpy_raw_streamer.py`: agrega `_kill_remote_scrcpy()` para matar solo procesos remotos de scrcpy raw que coincidan con el `scid` exacto de la sesion. La limpieza de procesos legacy sin `scid` existe solo como opcion explicita `killLegacyRaw=true` para canario.
  - `scrcpy_raw_streamer.py`: agrega `is_startup_stalled()` para detectar el patron confirmado de arranque congelado: stream con pocos bytes/chunks tras el periodo de gracia.
  - `scrcpy_raw_streamer.py`: agrega `recover_session()` para recuperar un solo `serial|preset`, con `force`, `killLegacyRaw`, `graceSec`, `minBytes` y `maxChunks`.
  - `scrcpy_raw_ws_server.py`: si un WebSocket queda esperando datos y la sesion esta en `startup_stalled`, cierra ese WS para que el frontend pueda reconectar y el backend ejecute cleanup de la sesion.
  - `local_adb_server.py`: agrega endpoint POST `/streaming/raw/recover` para recovery manual por dispositivo.
- **Politica de seguridad:** No hay watchdog global automatico todavia. No mata todos los procesos scrcpy. No toca otros seriales. No depende de IP fija; el endpoint recibe cualquier serial ADB real, sea USB o WiFi.
- **Prueba canario recomendada:** Abrir stream de `192.168.1.39:5555` en `eco`, esperar que detecte `startup_stalled`, llamar `/streaming/raw/recover` con ese serial y, si se autoriza en canario, probar `killLegacyRaw=true` solo en ese dispositivo para limpiar procesos raw antiguos sin `scid`.

## H264 + SCRCPY-CONTROL GOLDEN CANARY .11 (2026-06-15)

**H264-CONTROL-GOLDEN-CANARY-11-01:**
- **Dispositivo:** `192.168.1.11:5555`.
- **Objetivo:** Validar la arquitectura uniforme recomendada para producto: video embebido por `scrcpy-server raw H.264 -> Python WS -> Electron/WebCodecs/canvas`, control manual por `scrcpy-control control-only -> /control/*`, ADB input solo fallback y FlowAgent solo bajo demanda.
- **Arranque desde cero:** Antes de probar, `.11` estaba en `adb devices` como `device`, sin sesiones H.264 activas y sin procesos remotos `scrcpy/app_process`. Se ejecuto recovery acotado a `.11`; `legacyKilled=[]`.
- **Video validado:** WS manual `ws://127.0.0.1:8768/192.168.1.11%3A5555?preset=eco` recibio video real (`~10 KB`, `25+ chunks`, SPS/PPS/IDR y P-frames), sin caer en el patron problematico de `653 bytes / 13 chunks`.
- **Control validado:** Con el video abierto, `/control/keyevent` (`home`) y `/control/tap` usaron `method=scrcpy_control`, `fallbackUsed=false`. El primer comando tardo mas por crear la sesion control-only desde cero; el tap posterior quedo en ~`103 ms`.
- **Separacion comprobada:** Video uso sesion raw con `control=false` y socket historico `localabstract:scrcpy`; control uso sesion `video=false audio=false control=true` con `scid` propio y socket `localabstract:scrcpy_<scid>`. No se uso FlowAgent, Accessibility, OCR ni MediaProjection.
- **Correccion adicional aplicada:** `scrcpy_raw_ws_server.py` ahora sale del bucle de envio si detecta que el WebSocket cliente ya cerro durante un timeout de `queue.get()`. Esto evita dejar subscribers/sesiones H.264 colgadas en pantallas estaticas o pruebas manuales.
- **Validacion de cleanup WS:** Tras abrir y cerrar un WS de `.11`, `/streaming/raw/sessions` quedo vacio. Antes podia quedar un subscriber colgado si no llegaban nuevos chunks.
- **Politica de rollout:** Los 17 dispositivos actuales deben conectarse con la misma arquitectura y el mismo flujo de limpieza/control; las IPs actuales solo son seriales runtime. Para producto comercial, el rollout debe operar sobre cualquier serial ADB real (USB o WiFi), sin asumir rango IP, modelo, cantidad fija ni red local especifica.

## H264 MOTION CORRUPTION CANARIO .11 (2026-06-15)

**H264-FRAME-META-CANARY-11-03:**
- **Estado:** IMPLEMENTADO Y VALIDADO TECNICAMENTE EN BACKEND/WS.
- **Motivo:** El usuario confirmo que Grid y Focus cargaban correctamente en `.11`, pero el video seguia distorsionandose tras taps, swipes o acciones. Se verifico que el control manual usa `scrcpy_control` (`fallbackUsed=false`) y que forzar `preferScrcpy=false` cambia correctamente a `adb_input`, por lo que el problema queda aislado al pipeline de video.
- **Cambio aplicado:** Se agrego `h264_canary_config.json` para activar `FLOW_H264_FRAME_META_SERIALS` solo en `192.168.1.11:5555` al abrir con `abrir_electron.ps1`. El launcher reinicia el backend Python si detecta configuracion canario y el backend ya estaba activo.
- **Correccion de protocolo:** En `scrcpy_raw_streamer.py`, el modo `frame_meta` ahora conserva `send_stream_meta=true`, consume el codec-id inicial de 4 bytes y luego procesa session packets y headers oficiales de 12 bytes por paquete MediaCodec. La combinacion anterior con `send_stream_meta=false` activaba `frame_meta_enabled=true`, pero el dispositivo cerraba el socket con `empty read` y `bytes_streamed=0`.
- **Validacion tecnica:** WS manual a `ws://127.0.0.1:8768/192.168.1.11%3A5555?preset=balanced` recibio paquetes `FDH1`: config (`flags=1`), keyframe (`flags=2`) y deltas (`flags=0`). `/streaming/raw/sessions` mostro `frame_meta_enabled=true`, `scid_enabled=true`, `stream_codec_id=68323634` (`h264`), `stream_width=404`, `stream_height=720`, SPS/PPS/IDR presentes y `startup_stalled=false`.
- **Control durante prueba:** `/control/keyevent` y `/control/swipe` sobre `.11` retornaron `method=scrcpy_control`, `fallbackUsed=false`.
- **Alcance:** Solo `.11` queda en canario `frame_meta`. No se modifica FlowAgent, Accessibility, OCR, MediaProjection, ADB como fallback, presets globales, ni el resto de dispositivos.
- **Pendiente:** Validacion visual del usuario en Electron: reabrir Focus de `.11`, cambiar entre Eco/Balanced/Pro si hace falta para reconectar, enviar taps/swipes/Back/Home/Recents y confirmar si la imagen deja de distorsionarse.

**H264-WEBCODECS-WAIT-IDR-AFTER-CONFIG-11-04:**
- **Estado:** IMPLEMENTADO EN RENDERER, pendiente de reapertura de Electron y validacion visual.
- **Evidencia nueva del usuario:** La consola mostro `Failed to execute 'decode' on 'VideoDecoder': A key frame is required after configure() or flush()` en `stream-renderer-h264.js`, incluyendo `.11` por la ruta `_onFramedPacket`.
- **Causa confirmada por codigo:** Al recibir SPS/PPS/config packet, el renderer marcaba `_configured=false`, pero no siempre volvia a `_waitingKeyframe=true`. Eso permitia que, despues de una reconfiguracion de WebCodecs, un delta frame llegara a `decode()` antes de un IDR/keyframe.
- **Cambio aplicado:** `stream-renderer-h264.js` ahora marca `_waitingKeyframe=true` al recibir SPS/PPS/config, no intenta configurar/decodificar deltas si el decoder no esta configurado, y cierra el decoder tras errores de decode para recrearlo solo al siguiente keyframe.
- **Validacion tecnica:** `node --check electron-app/src/renderer/stream-renderer-h264.js` OK.
- **Alcance:** Solo renderer H.264. No se modifica backend de control, scrcpy-control, FlowAgent, Accessibility, OCR, MediaProjection ni ADB fallback.
- **Prueba requerida:** Cerrar y reabrir Electron para cargar el JS actualizado; abrir Focus de `.11`, enviar taps/swipes/Back/Home/Recents y confirmar que desaparece el error de keyframe y que el video no se distorsiona.

**H264-PRESET-SWITCH-CLEAN-REOPEN-11-05:**
- **Estado:** IMPLEMENTADO EN RENDERER, pendiente de reapertura de Electron y validacion visual.
- **Evidencia nueva del usuario:** `.11` funciono limpio al inicio en Eco con taps/swipes, pero al cambiar a Balanced/Pro se distorsiono, y al volver a Eco siguio distorsionando. Esto indica contaminacion de estado entre presets, no fallo primario del control.
- **Causa probable por codigo:** `setPreset()` cambiaba `session.preset` y cerraba el WebSocket, pero conservaba el mismo objeto `StreamSession`, canvas, decoder lifecycle y posibles frames/bitmaps asincronos. Un evento `close/message` tardio de un WebSocket viejo podia afectar la sesion nueva.
- **Cambio aplicado:** `stream-renderer-h264.js` ahora trata el cambio de preset como reapertura limpia: invalida una generacion interna, cierra decoder inmediatamente, limpia canvas, suprime el reconnect del close viejo y reabre el WebSocket con el nuevo preset. Los callbacks `open/message/close` ignoran WebSockets obsoletos, y los `ImageBitmap` creados asincronicamente no pintan si pertenecen a una generacion anterior.
- **Validacion tecnica:** `node --check electron-app/src/renderer/stream-renderer-h264.js` OK.
- **Alcance:** Solo lifecycle del renderer H.264 al cambiar preset. No cambia backend, scrcpy-control, FlowAgent, Accessibility, OCR, MediaProjection ni ADB fallback.
- **Prueba requerida:** Reabrir Electron, abrir `.11` en Focus, probar Eco con acciones, cambiar a Balanced/Pro, enviar acciones, volver a Eco y verificar que ya no se contamine.

**H264-PRO-PRESET-STABLE-CAP-11-06:**
- **Estado:** IMPLEMENTADO Y VALIDADO TECNICAMENTE EN BACKEND/WS.
- **Evidencia nueva del usuario:** Eco y Balanced funcionan correctamente con acciones, pero Pro no cargaba pantalla. Volver a Eco/Balanced funcionaba.
- **Causa confirmada por prueba WS:** Pro anterior usaba `max_size=1080`, `30fps`, `5Mbps`. Una prueba directa a `ws://127.0.0.1:8768/192.168.1.11%3A5555?preset=pro` mostro `stream_codec_id=h264` pero `bytes_streamed=0`, `frame_packets=0`, `error=empty read`; el servidor del telefono cerraba el stream antes de mandar session packet/frame.
- **Cambio aplicado:** `pro` baja a `max_size=960`, `30fps`, `4Mbps` en `scrcpy_raw_streamer.py`; el renderer declara tambien `pro.quality=960` para consistencia.
- **Validacion tecnica:** Tras reiniciar un unico backend Python, prueba WS Pro recibio paquetes `FDH1`: config (`flags=1`), keyframe (`flags=2`) y deltas (`flags=0`). Ya no hubo `empty read`.
- **Alcance:** Pro sigue siendo mas alto que Balanced, pero evita exigir 1080 nativo completo en dispositivos cuyo encoder cierra el stream. No cambia control, FlowAgent, Accessibility, OCR, MediaProjection ni ADB fallback.
- **Prueba requerida:** Reabrir Electron para cargar JS actualizado; abrir Focus `.11`, probar Eco/Balanced/Pro y acciones. Resultado esperado: Pro ahora muestra pantalla y no distorsiona.

**H264-ACCESS-UNIT-CANARY-11-01:**
- **Dispositivo:** `192.168.1.11:5555`.
- **Problema observado por usuario:** Grid y Focus cargan bien, cambio de resolucion/preset recupera la imagen, pero cualquier tap/swipe/accion vuelve a distorsionar el video.
- **Base oficial local usada:** `informacion de scrcpy/doc/develop.md` confirma que `raw_stream=true` desactiva metadata/headers y entrega H.264 raw; `Streamer.java` confirma que scrcpy-server escribe paquetes de `MediaCodec.BufferInfo`; `SurfaceEncoder.java` indica que cada paquete no-config contiene un frame.
- **Causa probable corregida:** El renderer estaba decodificando cada NALU/slice VCL por separado como `EncodedVideoChunk`. En movimiento, algunos encoders pueden emitir varios slices para un mismo frame; alimentar slices sueltos puede generar corrupcion visual progresiva.
- **Cambio aplicado:** `electron-app/src/renderer/stream-renderer-h264.js` ahora reconstruye access units H.264 antes de llamar a WebCodecs, preservando Annex-B y esperando limite de picture por `first_mb_in_slice`/AUD. SPS/PPS se mantienen y se prefijan a IDR si hace falta.
- **No modificado:** Backend Python, `scrcpy_raw_streamer.py`, `scrcpy_raw_ws_server.py`, `scrcpy_control_channel.py`, FlowAgent, Accessibility, OCR, MediaProjection, presets y rutas comerciales.
- **Validacion tecnica:** `node --check electron-app/src/renderer/stream-renderer-h264.js` OK. Electron se abrio con cache HTTP desactivada. En `.11`, `/control/tap`, `/control/keyevent HOME` y `/control/swipe` usaron `method=scrcpy_control`, `fallbackUsed=false`; el stream siguio vivo y aumento a `bytes_streamed=49584`, `chunks_read=86`, `non_idr_count=83`.
- **Pendiente:** Confirmacion visual del usuario en Focus/Grid tras varias acciones, porque la distorsion ocurre en el canvas renderizado y no queda totalmente probada por contadores backend.

**H264-FRAME-META-CANARY-11-02:**
- **Motivo:** La reconstruccion de access units desde `raw_stream=true` no elimino la distorsion visual reportada por usuario en los tres presets.
- **Base oficial local:** `doc/develop.md` y `Streamer.java` documentan el header de 12 bytes por media packet cuando `send_frame_meta=true`; ese header incluye flags de config/keyframe y tamano exacto del paquete producido por `MediaCodec`.
- **Cambio aplicado:** `scrcpy_raw_streamer.py` agrega modo canario por env `FLOW_H264_FRAME_META_SERIALS`, usando `send_device_meta=false`, `send_stream_meta=false`, `send_frame_meta=true` y manteniendo el dummy byte oficial para validar `adb forward`. El backend consume el dummy byte, parsea headers de 12 bytes y envia al WS paquetes `FDH1` con flags config/keyframe.
- **Cambio frontend:** `stream-renderer-h264.js` reconoce paquetes `FDH1` y los manda a WebCodecs como paquetes completos de `MediaCodec`, sin adivinar limites por NALU. Config packets actualizan SPS/PPS; keyframes usan el flag oficial de scrcpy.
- **Canario runtime:** Backend reiniciado con `FLOW_H264_FRAME_META_SERIALS=192.168.1.11:5555`. Prueba WS manual a `.11` recibio `FDH1`: config (`flag=1`), keyframe (`flag=2`) y deltas (`flag=0`) despues de `HOME` por `scrcpy_control`, con `fallbackUsed=false`.
- **Validacion post-accion:** Con Electron abierto, `.11` quedo en `frame_meta_enabled=true`, `scid_enabled=true`, `socket_name=scrcpy_<scid>`. Tras `RECENTS` por `scrcpy_control`, el stream subio de `12` a `48` frame packets y de `6985` a `124764` bytes, sin fallback ADB.
- **No modificado:** FlowAgent, Accessibility, OCR, MediaProjection, ADB input como motor principal, rutas comerciales y otros dispositivos. El modo nuevo no depende de IP fija; el env recibe seriales ADB reales.
- **Pendiente:** Prueba visual del usuario en Electron Focus/Grid sobre `.11` con taps/swipes intensos y cambios de preset.

**FOCUS-UI-RESTORE-TOOLS-NONCONTROL-01-FIX:**
- **Estado:** IMPLEMENTADO Y VERIFICADO.
- **Problema de visualización:** La pantalla del dispositivo en modo Focus se salía del borde superior e inferior del contenedor debido a un desajuste de alturas (overflow) en pantallas de dimensiones reducidas (la altura del frame era mayor que la altura disponible en el wrapper).
- **Cambio aplicado en styles.css:**
  - Redefinido `.flowtouch-phone-frame` para usar `height: 100% !important; max-height: 100% !important; aspect-ratio: 9 / 16 !important; width: auto !important; max-width: 100% !important;`
  - Modificado `.flowtouch-phone-wrapper` para usar `height: 100% !important; max-height: 100% !important;`
  - Agregado `.flowtouch-phone-stage` para asegurar que el contenedor de la pantalla use el 100% de la altura de `.flowtouch-focus-main` de forma fluida y autocontenida.
  - Esto previene cualquier desborde vertical u horizontal del teléfono en cualquier tamaño de ventana de Electron.
- **Problema de FlowKeyboard (404 Not Found):** Al accionar herramientas del teclado, no enviaba el texto y la consola mostraba `POST http://localhost:8765/flowkeyboard/type-human 404 (Not Found)`.
- **Causa confirmada:** Existencia de múltiples procesos Python zombies/stale escuchando en el puerto 8765 (ej. PIDs 4720, 19516, 22264). Las peticiones HTTP eran interceptadas por un proceso viejo que no incluía la ruta `/flowkeyboard/type-human`, resultando en un error 404.
- **Cambio aplicado en abrir_electron.ps1:**
  - Se modificó el launcher para que siempre detenga los procesos en los puertos de la app (8765, 8766, 8767, 8768) antes de iniciar el servidor de Python, garantizando un inicio completamente limpio y la carga del backend actualizado en el puerto correcto.
- **No modificado:** Lógica de decodificación de video, stream scrcpy H.264, mapeo de coordenadas ni otros componentes de control.

**FOCUS-UI-RESTORE-TOOLS-NONCONTROL-01-KEYBOARD-HOTFIX:**
- **Estado:** IMPLEMENTADO Y VERIFICADO.
- **Problema de FlowKeyboard (404 semántico):** A pesar de resolver los puertos zombies, al usar el teclado en Modo Focus para un dispositivo con FlowKeyboard seleccionado, la petición a `/flowkeyboard/type-human` continuaba devolviendo `404 (Not Found)`.
- **Causa confirmada:** El error 404 era un error semántico devuelto directamente por la función `flow_keyboard_type_human()` en Python cuando el agente socket (puerto 8766) no está conectado (`agent_for_serial(serial)` es `None`). Esto ocurre porque al iniciar Electron en perfil `CONTROL`, no se activa automáticamente el agente socket ni se abre la `MainActivity` del APK en los dispositivos. El estado del teclado IME salía "listo" (porque está seleccionado en los Ajustes de Android), pero el socket físico estaba desconectado.
- **Cambio aplicado en local_adb_server.py:**
  - Se modificaron las funciones `prepare_flow_keyboard`, `flow_keyboard_type`, `flow_keyboard_type_human` y `flow_keyboard_command` para hacerlas auto-sanables (self-healing).
  - Si el agente no está conectado al invocar cualquiera de estas funciones, el servidor ahora realiza automáticamente un preflight: aplica `adb reverse tcp:8766 tcp:8766`, inicia la `MainActivity` del FlowAgent monolito en background y espera hasta 4.0 segundos a que el socket se enlace.
  - Esto garantiza que el canal de comunicación socket esté activo al momento de emitir la pulsación virtual o tipeo humano, resolviendo el error 404 y enviando el texto de manera automática.
- **No modificado:** Presets de calidad de video, WebCodecs, layouts CSS, ni flujos de control nativo directos.

## FOCUS-UI-VISUAL-GLOW-02 (2026-06-16)

**FOCUS-UI-VISUAL-GLOW-02-FIX:**
- **Estado:** IMPLEMENTADO Y VERIFICADO.
- **Acciones y Mejoras Aplicadas:**
  1. **Reducción de Controles de Calidad en Vista Clásica:** En vista clásica (`.flowtouch-focus-shell.is-clean-mode`), los botones de calidad (Eco, Balanced, Pro) y su contenedor `.flowtouch-quality-segments` ahora usan fuentes y paddings reducidos (`font-size: 0.65rem; padding: 3px 8px;`). Esto evita la superposición con los detalles de IP y serial (ej. "1.11") y previene truncamientos inapropiados en el encabezado.
  2. **Eliminación de Recortes en Animación y Glow:** Modificado `.flowtouch-phone-stage` para usar `padding: 36px !important;` y `overflow: visible !important;`. Esto provee suficiente holgura espacial para que la animación de escala (`animate-scale-in`) y los efectos de resplandor neón (`flow-glowing-frame`) no se recorten en los bordes.
  3. **Historial de Eventos a Altura Completa (Modo Avanzado):** Se eliminó la restricción legacy de `max-height: 140px !important;` de `.flowtouch-log-panel`. Ahora, el panel de historial se expande al 100% de la altura vertical de la pantalla del dispositivo (`height: 100% !important;`), permitiendo un flujo de scroll cómodo y adaptado al tamaño de la pantalla.
  4. **Corrección de Recorte Superior en apps-launcher (Hover):** Se añadió padding superior e inferior (`padding: 8px 6px 8px 6px;`) a `.focus-pro-panel`. Esto evita que el primer botón de la columna (Apps) sufra recortes visuales en su borde superior al activarse el efecto de traslación (`translateY(-2px)`) y sombra luminosa al pasar el cursor (hover).
- **Validación Estricta:** No se modificaron pipelines de decodificación H.264, mapeo de coordenadas, ni dependencias de socket.

## FOCUS-ACCOUNTS-SYNC-03 (2026-06-16)

**FOCUS-ACCOUNTS-SYNC-03-IMPLEMENTATION:**
- **Estado:** IMPLEMENTADO Y VERIFICADO.
- **Acciones y Mejoras Aplicadas:**
  1. **Integración de Botones de Cuentas y Opciones en Cabecera:** Añadido un nuevo renglón `.flowtouch-focus-accounts-row` dentro de la sección `.flowtouch-focus-title` de la cabecera en el Modo Focus (visible en clásico y avanzado). El botón de cuentas muestra el contador actual del dispositivo (ej. `2/10`) y abre el editor `accountEditorModal` al pulsarlo; el botón de opciones abre el menú contextual del dispositivo para ejecutar acciones remotas.
  2. **Columna de Bolitas de Cuentas en Tiempo Real:** Añadido el elemento vertical `.flowtouch-focus-dots-column` a la derecha de la pantalla del dispositivo (dentro de `.flowtouch-phone-wrapper`), visible en ambos modos. Las bolitas están vinculadas al estado de ejecución de los clones de cuentas del teléfono en tiempo real.
  3. **Estilos Premium para las Bolitas de Focus:** Rediseñado el tamaño de las bolitas a 14px, con espaciado amplio de 8px, escalado elástico `scale(1.3)` en hover y efectos de glow neón (ej. azul de respiración para `is-running` y verde luminoso para `is-success`).
  4. **Sincronización Bidireccional de DOM:** Modificada la función `updateStatusDots` en `app.js` para usar `querySelectorAll`, garantizando que el refresco del temporizador actualice las bolitas de la grilla y de Focus a la vez. Añadido un hook en `renderDevices` para actualizar el contador del botón y el listado de bolitas de Focus al guardar cambios en el editor.
  5. **Ajuste de Holgura en Vista Clásica:** Incrementado el ancho base de `.flowtouch-focus-shell` a `calc(video_width + 72px)` en vista clásica para dar espacio a la columna de bolitas sin causar barras de desplazamiento.
- **Validación Estricta:** No se modificaron flujos de video scrcpy, controles táctiles, ni pipelines de MediaCodec.

## FOCUS-UI-APPS-ENHANCEMENTS (2026-06-16)

**FOCUS-UI-APPS-ENHANCEMENTS-IMPLEMENTATION:**
- **Estado:** IMPLEMENTADO Y VERIFICADO.
- **Acciones y Mejoras Aplicadas:**
  1. **Robustez en la Desinstalación (`apps_uninstall`):** Se envolvió el flujo de desinstalación de aplicaciones en `local_adb_server.py` en un bloque `try-except` para capturar errores sin levantar un HTTP 500. Se añadió un fallback automático al comando `pm uninstall --user 0` en caso de que la desinstalación regular falle.
  2. **Robustez al Limpiar Datos (`apps_clear_cache`):** Envuelto en `try-except` para evitar caídas de backend y se ajustó la validación del comando `pm clear` para que retorne `ok: true` cuando se detecta el éxito en la salida del comando o si está vacío.
  3. **Botón de Información ("Info") de Aplicación:**
    - Creado un nuevo endpoint `/apps/details` en Python que ejecuta el intent `am start -a android.settings.APPLICATION_DETAILS_SETTINGS -d package:<package>` para abrir la página nativa de configuración de la app en la pantalla del celular.
    - Se agregó el método `appsDetails` en `app.js` (frontend) para realizar la petición POST al backend.
    - En `flow-touch.js`, se añadió el botón `Info` dentro de la lista de acciones de cada app (`_proAppsRender`) y se vinculó en `_proAppsRunAction` para ejecutar el endpoint.
  4. **Corrección de Refresco Asíncrono:** Corregida la llamada de refresco de la lista en `flow-touch.js` utilizando `await this._proAppsRefresh()` en lugar de una llamada síncrona sin await, garantizando que el listado se actualice inmediatamente después de desinstalar.
  5. **Corrección de la Ventana Emergente de Confirmación (Stacking Context & Fixed positioning):**
    - Se modificó `.fp-confirm-layer` en `styles.css` a `position: fixed` y `z-index: 99999` para garantizar que aparezca sobre cualquier otro elemento.
    - Se modificó `_confirmDangerDialog` en `flow-touch.js` para que el diálogo se añada directamente a `document.body` (en lugar de `this.overlay`), evitando que quede oculto debajo de las ventanas flotantes debido a contextos de apilamiento locales.
  6. **Reinicio del Servidor Backend:** Se detuvo el proceso de Python stale en el puerto 8765 y se relanzó con el nuevo backend para habilitar los endpoints robustos.
- **Validación Estricta:** No se modificaron flujos de video scrcpy, controles táctiles, presets de calidad de video ni pipelines de decodificación.

