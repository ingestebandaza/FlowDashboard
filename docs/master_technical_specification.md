# FlowDashboard - Master Technical Specification

STATUS: CURRENT
Last verified against code: 2026-06-24
Last verified against runtime: 2026-06-24
Canonical replacement: N/A
Owner: FlowDashboard

Fecha de consolidacion: 2026-06-19
Auditoria base: 2026-06-15 (consolidacion previa)
Revision actual: 2026-06-20 (FlowMail para magic links de FlowLogin)
Revision documental: 2026-06-20 (auditoria sin usar DOCUMENTACION_TECNICA.md)
Revision operativa: 2026-06-23 (Grid canvas estable durante reboot/offline y recuperacion H.264 post-reinicio)
Revision comercial: 2026-06-23 (versionado unico 2.0.0 desde version.json)
Revision rutas/datos: 2026-06-23 (path resolver y FLOWDASHBOARD_DATA_DIR compartido)
Revision runtime manager: 2026-06-23 (Electron supervisa sidecars C#/Python sin matar procesos externos)
Revision backend empaquetado: 2026-06-23 (Python PyInstaller onedir y FlowMail helper exe)
Revision C# self-contained: 2026-06-23 (FlowDashboard.Core publicado en build/runtime/dotnet)
Revision recursos comerciales: 2026-06-23 (staging comercial con runtime, scrcpy, FlowAgent, FlowTrackName y notices)
Revision instalador Electron: 2026-06-24 (NSIS interno en release_packages con recursos comerciales empaquetados)
Revision actualizador Electron: 2026-06-24 (electron-updater con GitHub Releases y updater Python archivado)

Este documento es la referencia tecnica vigente de FlowDashboard. Sustituye
las notas historicas que contradigan el estado actual. Esta escrito a partir de:

- Auditoria directa del codigo fuente del repositorio.
- Validacion empirica en runtime caliente con servicios activos.
- Pruebas reportadas por el usuario en Grid/Focus despues del ultimo LKGS H.264.
- Auditoria exhaustiva de incorporacion tecnica (2026-06-18) con verificacion de
  procesos, puertos, endpoints, flujo de arranque, arquitectura de archivos,
  persistencia, portabilidad y comparacion documentacion vs realidad.

Regla principal para cualquier IA o desarrollador: si una nota antigua dice algo
distinto a este documento, tratar la nota antigua como historica hasta volver a
probar en runtime. `DOCUMENTACION_TECNICA.md` es legacy/prohibido y no debe
usarse como fuente para esta especificacion.

---

## 1. Estado Vigente Validado

### 1.1 Resultado funcional actual

Estado reportado por el usuario y coherente con runtime caliente:

- Dashboard abre con `abrir_electron.bat`.
- Los 17 dispositivos actuales cargan en Grid.
- Focus carga imagen.
- Eco, Balanced y Pro funcionan.
- Taps, swipes, Back/Home/Recents funcionan sin volver a distorsionar el video.
- El LKGS estable fue sellado en:
  - `restore_points/LKGS_H264_GRID_FOCUS_OK_20260615_213612`
  - `restore_points/LKGS_H264_GRID_FOCUS_OK_20260615_213612.zip`

No tocar H.264, Scrcpy Video ni Control Focus salvo bug nuevo reproducible con
evidencia runtime.

### 1.2 Snapshot runtime verificado

Esta seccion contiene snapshots de entorno. Los PIDs, sesiones activas,
cantidad de FlowAgents conectados y estado de Electron pueden variar sin que
cambie la arquitectura vigente. Antes de tomar una decision operativa, volver a
consultar los endpoints.

Snapshot base del 2026-06-18. Comandos ejecutados sin modificar estado:

- `GET http://127.0.0.1:8765/health`
- `GET http://127.0.0.1:8765/devices`
- `GET http://127.0.0.1:5000/api/devices`
- `GET http://127.0.0.1:5000/api/health`
- `GET http://127.0.0.1:5000/api/streaming/stats`
- `GET http://127.0.0.1:8765/streaming/raw/sessions`
- `GET http://127.0.0.1:8765/control/scrcpy-sessions`
- `GET http://127.0.0.1:8765/recordings/active`
- `GET http://127.0.0.1:8765/agents`
- `scrcpy-win64-v4.0\adb.exe devices -l`
- `Get-Process`, `Get-NetTCPConnection` (verificacion de procesos/puertos)

Resultado:

- Backend Python HTTP `8765`: activo (PID 21676).
- Backend C# HTTP `5000`: activo (PID 23444, Release build).
- ADB empaquetado `scrcpy-win64-v4.0\adb.exe`: activo (PID 3672/27964 en :5037).
- FlowAgent socket TCP `8766`: escuchando en 0.0.0.0.
- WebSocket WebP legacy `8767`: escuchando.
- WebSocket H.264 raw `8768`: escuchando.
- `/devices`: devuelve 17 dispositivos WiFi ADB online con MAC address.
- `/api/devices`: devuelve 17 dispositivos Online.
- `/streaming/raw/sessions`: disponible, sin sesiones activas (Electron no estaba abierto).
- `/control/scrcpy-sessions`: disponible, 1 sesion control-only activa (.11, scid 6b303cf8).
- `/recordings/active`: disponible, sin grabaciones activas.
- `/agents`: 1 FlowAgent conectado (.11) con acc=true, keyboard=true, v1.0.0.
- `/api/streaming/stats` existe en C# puerto 5000; en Python puerto 8765 NO existe.

Reverificacion documental/runtime del 2026-06-23:

- `GET /health` en Python `8765`: OK, `appVersion=2.0.0`, ADB empaquetado.
- `GET /api/health` en C# `5000`: OK, `version=2.0.0`.
- `GET /streaming/raw/sessions`: disponible, sin sesiones activas en el momento de consulta.
- `GET /control/scrcpy-sessions`: disponible, sin sesiones activas en el momento de consulta.
- `/agents`: 17 FlowAgents conectados con FlowKeyboard activo en el momento de consulta. No documentar detalles sensibles de perfiles, cuentas ni payloads.

### 1.3 Dispositivos actuales verificados

Los 17 telefonos actuales son diagnostico real de este entorno, no una regla del
producto comercial. Todos aparecieron como `device` en ADB:

- `192.168.1.11:5555` (SM-G955U, dream2qltesq)
- `192.168.1.146:5555` (SM-G950U, dreamqltesq)
- `192.168.1.147:5555` (SM-G955U, dream2qltesq)
- `192.168.1.38:5555` (SM-G892A, cruiserlteatt)
- `192.168.1.39:5555` (SM-G955U, dream2qltesq)
- `192.168.1.40:5555` (SM-G955U, dream2qltesq)
- `192.168.1.41:5555` (SM-G955U, dream2qltesq)
- `192.168.1.42:5555` (SM-G955U, dream2qltesq)
- `192.168.1.44:5555` (SM-G955U, dream2qltesq)
- `192.168.1.45:5555` (SM-G950U, dreamqltesq)
- `192.168.1.46:5555` (SM-G955U, dream2qltesq)
- `192.168.1.47:5555` (SM-G955U, dream2qltesq)
- `192.168.1.48:5555` (SM-G950U, dreamqltesq)
- `192.168.1.50:5555` (SM-G950U, dreamqltesq)
- `192.168.1.51:5555` (SM-G950U, dreamqltesq)
- `192.168.1.52:5555` (SM-G950U, dreamqltesq)
- `192.168.1.53:5555` (SM-G950U, dreamqltesq)

El producto no debe depender de estas IPs, cantidad de dispositivos, subred,
router, marca, resolucion, encoder, Android version ni seriales `IP:5555`.

---

## 2. Arquitectura Operativa Vigente

### 2.1 Procesos y puertos

El arranque oficial de desarrollo es `abrir_electron.bat`, que delega en
`abrir_electron.ps1`.

Componentes:

| Componente | Puerto/Ruta | Estado | Funcion |
|---|---:|---|---|
| Electron | proceso UI | vigente | Dashboard comercial en desarrollo |
| Electron RuntimeManager | `electron-app/src/main/runtime-manager.js` | vigente | Supervision de sidecars C#/Python, health checks, logs y cierre limpio |
| Backend C# `FlowDashboard.Core` | `http://localhost:5000` | vigente | API ADB secundaria, WebSocket legacy WebP, endpoints de streaming nativo legacy |
| Backend Python `local_adb_server.py` | `http://localhost:8765` | vigente | Dispositivos, control, licencias, FlowAgent, FlowKeyboard, Inspector, grabacion, H.264 bridge |
| FlowAgent socket | `0.0.0.0:8766` | vigente para automation | Canal APK para automatizacion, OCR, scripts, FlowKeyboard |
| WebSocket APK/WebP | `8767` | legacy/complementario | Frames del APK cuando aplica |
| WebSocket H.264 raw | `ws://127.0.0.1:8768/<serial>?preset=...` | produccion visual actual | Video Grid/Focus embebido en Electron |
| ADB server | `127.0.0.1:5037` | vigente | Transporte Android |

### 2.2 Launcher oficial

`abrir_electron.ps1` hace lo siguiente:

1. Define `FLOWDASHBOARD_BASE_DIR` y `FLOWDASHBOARD_RESOURCE_DIR`.
2. Fuerza `FLOWDASHBOARD_ADB` a `scrcpy-win64-v4.0\adb.exe`.
3. Fuerza `SCRCPY_PATH` a `scrcpy-win64-v4.0\scrcpy.exe`.
4. Fuerza `SCRCPY_SERVER_JAR` a `scrcpy-win64-v4.0\scrcpy-server.jar`.
5. Lee `h264_canary_config.json` y exporta:
   - `FLOW_H264_FRAME_META_SERIALS`
   - `FLOW_H264_SCID_SERIALS`
6. Elimina variables proxy salvo `FLOWDASHBOARD_USE_SYSTEM_PROXY=1`.
7. Define `FLOWDASHBOARD_DATA_DIR` en `scratch\flowdashboard-data-runtime`
   para persistencia mutable compartida por Electron, Python y C#.
8. Define `FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART=1`; Python lo
   gobierna el launcher de desarrollo o Electron RuntimeManager, no C#.
9. Inicia ADB.
10. Inicia backend C#.
11. Inicia o reinicia backend Python si debe aplicar config H.264.
12. Abre Electron con `--disable-http-cache` y user data en
    `scratch\electron-user-data-runtime`.

Dentro de Electron, `runtime-manager.js` vuelve a comprobar C# y Python. Si ya
estan sanos, los registra como servicios externos y no los mata al salir. Si no
estan sanos y el puerto esta libre, intenta arrancarlos con los runtimes
disponibles. Si el puerto esta ocupado pero el health falla, no mata el proceso
externo y reporta el estado como puerto ocupado.

No usar `electron.exe` directamente para pruebas normales. El usuario pidio
explicitamente usar `abrir_electron.bat`.

### 2.3 Seleccion de Python en el launcher

`abrir_electron.ps1` busca Python en este orden:

1. `$env:FLOWDASHBOARD_PYTHON` (variable de entorno explicita).
2. `.venv\Scripts\python.exe` (venv del proyecto).
3. `python\python.exe` (Python portable empaquetado).
4. `C:\Users\elyup\...\Python310\python.exe` (hardcoded de desarrollo).
5. `python` del PATH del sistema.

Cada candidato se valida con `Test-PythonDeps`: solo se acepta si tiene
`websockets`, `psutil` y `websocket-client` instalados.

Estado de desarrollo verificado antes del empaquetado (2026-06-18):

- `.venv` existe con Python 3.13.7 pero SIN las dependencias requeridas.
- `python\python.exe` NO existe (no hay Python portable empaquetado).
- El runtime real usa `C:\Users\elyup\...\Python310\python.exe` (desarrollo).

Estado comercial verificado en Fase 5 (2026-06-23):

- `scripts/build/build-python.ps1 -Clean` construye `build\runtime\python\FlowDashboard.Backend.exe`.
- El backend empaquetado usa PyInstaller `onedir`.
- `FlowDashboard.Backend.exe --self-check` valida ADB, scrcpy, `scrcpy-server.jar`, modulos H.264 raw/control y APK FlowAgent.
- Prueba real de `/health`: el exe escucha en `8765`, `8766`, `8767` y `8768`, reporta `baseDir=build\runtime\python`, `resourceDir` del repositorio de prueba, `dataDir=scratch\flowdashboard-data-runtime`, `productMode=true` e `isFrozen=true`.
- En producto, si no se define `FLOWDASHBOARD_DATA_DIR`, Python usa `%LOCALAPPDATA%\FlowDashboard` para datos mutables.
- El launcher de desarrollo puede seguir usando Python del sistema; el runtime comercial ya no depende de ese Python cuando Electron/instalador colocan el sidecar.

### 2.4 Empaquetado comercial

Fase 5 deja implementado y validado el empaquetado Python:

- `build_specs/FlowDashboard.Backend.spec`
- `build_specs/FlowDashboard.MailHelper.spec`
- `scripts/build/build-python.ps1`
- salida `build\runtime\python\FlowDashboard.Backend.exe`
- salida `build\runtime\python\FlowDashboard.MailHelper.exe`

El spec incluye los modulos runtime necesarios para `local_adb_server.py`,
scrcpy raw H.264, scrcpy-control, WebSocket y dependencias Python. Excluye
datos locales, secretos, payloads, logs, recordings, SQL, admin panel y fuentes
Android completas.

El helper de FlowMail se empaqueta como exe separado de stdin/stdout para que
`FlowDashboard.Core` no tenga que invocar un Python generico en producto.

Estado Fase 8 para producto comercial:

- Electron ya se empaqueta con recursos/runtime colocados en la estructura
  final bajo `release_packages\win-unpacked\resources`.
- El instalador NSIS interno ya se genera en
  `release_packages\FlowDashboard-Setup-2.0.0.exe`.
- El instalador actual no esta firmado digitalmente; la firma queda pendiente
  antes de distribucion publica.
- El actualizador comercial usa `electron-updater`; queda pendiente validar
  update real N -> N+1 con release firmado.
- eliminacion o aislamiento final de rutas hardcoded de desarrollo en flujos
  que solo aplican al launcher dev.
- configuracion dinamica en vez de `h264_canary_config.json` fijo.

### 2.5 Version del producto

- `version.json`: `version = "2.0.0"`, `productName = "FlowDashboard"`.
- `electron-app/package.json`: `version = "2.0.0"`.
- `app_meta.py`: `APP_VERSION = "2.0.0"`.
- Backend Python: reporta `appVersion = "2.0.0"` en `/health`.
- Backend C#: reporta `version = "2.0.0"` en `/api/health`.
- La sincronizacion se realiza con `scripts/release/sync-version.ps1`.

### 2.6 Rutas y datos

Electron define `electron-app/src/main/path-resolver.js` como resolutor comun
para desarrollo y produccion. En desarrollo resuelve recursos desde el
repositorio; en build empaquetada debe resolver recursos desde
`process.resourcesPath` y datos desde Electron user data o
`FLOWDASHBOARD_DATA_DIR`.

Persistencia mutable aprobada:

- `device_names.json`
- `device_groups.json`
- `device_inventory.json`
- `device_mappings.json`
- `device_registrations.json`
- `license.json`
- `update_config.json`

Estos archivos se migran de forma idempotente desde la raiz del repositorio al
data root si el destino no existe. No se migran automaticamente secretos como
`.supabase_config.json` ni payloads completos.

`local_adb_server.py` usa `DATA_DIR` para nombres, grupos, inventario,
registros locales, payloads temporales, grabaciones, cache de iconos, uploads
temporales y logs diagnosticos.

`FlowDashboard.Core` usa `AppPaths.DataDir` para `device_mappings.json` y
`mail_config.json` cifrado por DPAPI.

### 2.7 RuntimeManager de Electron

Electron main define `electron-app/src/main/runtime-manager.js` para reducir la
dependencia de PowerShell en produccion y preparar el modelo de sidecars.

Responsabilidades implementadas:

- detectar modo desarrollo versus build empaquetada;
- preparar `FLOWDASHBOARD_BASE_DIR`, `FLOWDASHBOARD_RESOURCE_DIR`,
  `FLOWDASHBOARD_DATA_DIR`, `FLOWDASHBOARD_ADB`, `SCRCPY_PATH` y
  `SCRCPY_SERVER_JAR`;
- activar `FLOWDASHBOARD_PRODUCT_MODE=1` solo en modo producto;
- activar `FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART=1` para evitar que C#
  arranque Python en paralelo cuando Electron gobierna el runtime;
- validar ADB, scrcpy, scrcpy-server y data/log roots;
- detectar servicios externos sanos en `5000` y `8765`;
- arrancar C# y Python si faltan y existe runtime disponible;
- esperar `/api/health` y `/health`;
- no matar procesos externos en puertos ocupados;
- reiniciar solo sidecars propios con limite y backoff;
- escribir logs en `dataRoot\logs\runtime`;
- detener sidecars propios al cerrar la app o preparar una actualizacion.

No hace:

- instalar APKs;
- abrir FlowAgent;
- activar Accessibility;
- iniciar MediaProjection;
- modificar H.264, Focus/Grid o `/control/*`.

Brecha pendiente: la supervision, el sidecar Python empaquetado, el backend C#
self-contained, el staging de recursos y el instalador interno ya existen. La
build comercial todavia requiere firma digital, validacion en equipo limpio y
modelo de actualizacion antes de distribucion publica.

### 2.8 Backend C# self-contained

Fase 6 deja implementada y validada la publicacion C#:

- `scripts/build/build-dotnet.ps1`
- salida `build\runtime\dotnet\FlowDashboard.Core.exe`
- publicacion `win-x64`, `Release`, `--self-contained true`
- sin trimming, Native AOT, single-file ni ReadyToRun

RuntimeManager ya busca este ejecutable en `runtime\dotnet` antes de caer al
binario de desarrollo.

Ajustes de portabilidad aplicados:

- `AppPaths.DataDir` usa `%LOCALAPPDATA%\FlowDashboard` en producto si no se
  define `FLOWDASHBOARD_DATA_DIR`.
- `AdbService` resuelve ADB desde `FLOWDASHBOARD_ADB`,
  `AppPaths.ResourceDir\scrcpy-win64-v4.0\adb.exe` o
  `AppPaths.BaseDir\scrcpy-win64-v4.0\adb.exe`.
- `AdbService` configura `TEMP`/`TMP` para ADB en `DataDir\.adb_tmp`, con
  override `FLOWDASHBOARD_ADB_TEMP_DIR`.
- Si ADB no puede iniciar, C# no cierra el proceso: levanta `/api/health` en
  modo degradado y reporta `adb.available=false` junto al error.
- `ScrcpyService` resuelve scrcpy desde `SCRCPY_PATH` o recursos empaquetados,
  no desde rutas hardcodeadas ni PATH.

Validacion Fase 6:

- `dotnet build FlowDashboard.Core\FlowDashboard.Core.csproj -c Release --no-restore` OK.
- `scripts/build/build-dotnet.ps1 -Clean` OK.
- `build\runtime\dotnet\FlowDashboard.Core.exe` responde `/api/health` en
  `127.0.0.1:5000` con `version=2.0.0`, `productMode=true`,
  `dataDir=scratch\flowdashboard-data-runtime` y `adb.available=true`.

### 2.9 Recursos comerciales

Fase 7 deja implementado y validado el staging comercial de recursos:

- `scripts/build/prepare-commercial-resources.ps1`
- salida `build\staging\commercial-resources`
- `RESOURCE_MANIFEST.json` con inventario, tamanos y SHA-256
- `THIRD_PARTY_NOTICES.txt`

Comando verificado:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build\prepare-commercial-resources.ps1 -Clean
```

Layout staged:

```text
runtime\python\
runtime\dotnet\
scrcpy-win64-v4.0\
android\flowagent\agent-v1.0.0-arm64-v8a.apk
Herramientas\FlowTrackName.exe
scripts\Login.js
scripts\Register.js
THIRD_PARTY_NOTICES.txt
RESOURCE_MANIFEST.json
```

Validacion Fase 7:

- `fileCount=460`
- `totalBytes=304413385`
- FlowAgent `versionName=1.0.0`, `versionCode=106`, ABI incluida
  `arm64-v8a`.
- APK universal detectada en salida Gradle, pero no incluida: el paquete queda
  arm64-only hasta decision comercial explicita de multi-ABI.
- FlowTrackName `Herramientas\FlowTrackName.exe` registrado con tamano
  `32087726` bytes y SHA-256
  `fba6a00129f63726c590819c19f1c64f90a6801bbf419a17adb675409016177e`.
- El script falla si detecta secretos/datos locales conocidos en staging:
  `.supabase_config.json`, `.flowlogin_payloads`, JSON de dispositivos,
  `mail_config.json`, recordings, reports, restore points o SQL.

Electron y Python ahora prefieren el APK comercial
`android\flowagent\agent-v1.0.0-arm64-v8a.apk` cuando existe, conservando los
fallbacks de desarrollo al arbol Gradle y al APK legacy de emergencia.

### 2.10 Instalador Electron/NSIS

Fase 8 deja implementado el empaquetado Electron; Fase 9 lo deja
actualizador-aware:

- `electron-app\electron-builder.config.js`
- `scripts\build\build-electron-installer.ps1`
- salida `release_packages\FlowDashboard-Setup-2.0.0.exe`
- salida `release_packages\FlowDashboard-Setup-2.0.0.exe.blockmap`
- salida `release_packages\latest.yml`
- salida `release_packages\win-unpacked`
- salida `release_packages\PHASE9_UPDATER_INSTALLER_MANIFEST.json`

Comando verificado:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build\build-electron-installer.ps1 -Clean -SkipVersionSync
```

Validacion Fase 9:

- installer SHA-256:
  `4e5f01bf7ee32cda53021a09497bfe6939d6d83a92aa38b7c91dfa330eb38500`
- installer size: `259716917` bytes.
- `latest.yml` SHA-256:
  `963621489ef365e02e3c1944181c44f60e9aec40c7d975ff8305517d363b158d`.
- `packagedResourceMissing=null` en
  `PHASE9_UPDATER_INSTALLER_MANIFEST.json`.
- Python self-check final desde `release_packages\win-unpacked\resources`:
  `ok=true`, `productMode=true`, `isFrozen=true`, FlowAgent resuelto desde
  `android\flowagent\agent-v1.0.0-arm64-v8a.apk`.
- C# health check final desde `release_packages\win-unpacked\resources`:
  `/api/health` devuelve `status=ok`, `version=2.0.0`, `productMode=true`,
  `adb.available=true` y ADB empaquetado.
- `app.asar` contiene 936 entradas y el escaneo no encontro rutas conocidas de
  secretos/datos locales.
- `Get-AuthenticodeSignature` confirma que el instalador no esta firmado; esto
  es aceptado solo para build interna.

Reglas de distribucion:

- No publicar este instalador como release comercial final hasta configurar y
  verificar firma digital.
- Probar instalacion y arranque en un equipo limpio sin Python de desarrollo,
  .NET SDK ni Android SDK.
- Mantener `deleteAppDataOnUninstall=false` salvo decision explicita del
  producto para limpiar datos de usuario.

### 2.11 Actualizador Electron

Fase 9 reemplaza el actualizador Python legacy por Electron main:

- `electron-app\src\main\update-manager.js`
- dependencia `electron-updater`
- provider GitHub Releases `ingestebandaza/FlowDashboard`
- IPC preload:
  - `getUpdateStatus`
  - `checkForUpdates`
  - `installDownloadedUpdate`
  - `deferDownloadedUpdate`
  - `onUpdateStatus`

Flujo implementado:

1. Electron consulta updates sin bloquear la UI.
2. `electron-updater` descarga automaticamente cuando encuentra una version
   disponible.
3. El renderer muestra estado, progreso, notas y acciones `Reiniciar ahora` /
   `Mas tarde`.
4. Antes de instalar, `UpdateManager` intenta detener grabaciones activas via
   Python `/recordings/stop-all`.
5. Luego llama `RuntimeManager.prepareForUpdate()` para cerrar sidecars propios.
6. Finalmente ejecuta `quitAndInstall(false, true)`.

Estado legacy:

- `updater.py` fue archivado en `archive\legacy-updater\updater.py`.
- Python `/update-check` y `/update-status` quedan como shims deshabilitados
  que reportan `legacy_updater_disabled`.
- `update.json` queda como artefacto historico y no participa en el build ni
  en `sync-version.ps1`.

Validacion Fase 9:

- `electron-updater` instalado en `electron-app\package.json` y lockfile.
- `electron-builder.config.js` define `publish` para GitHub Releases.
- `build-electron-installer.ps1` falla si un build completo no genera
  `latest.yml`.
- Sintaxis verificada en `update-manager.js`, `index.js`, `preload.js`,
  `app.js` y `local_adb_server.py`.

Pendiente para cierre comercial de updates:

- Publicar un GitHub Release real `2.0.1` con `.exe`, `.blockmap`,
  `latest.yml`, checksums y release notes.
- Validar actualizacion `2.0.0 -> 2.0.1` conservando datos.
- Firmar ejecutable e instalador antes de clientes externos.

---

## 3. Perfiles Operativos Reales

### 3.1 Perfil `control`

Uso: Grid, Focus, taps, swipes, drag/live touch, Back, Home, Recents.

Video:

```text
scrcpy-server.jar v4.0 en Android
-> socket ADB forward
-> Python WebSocket 8768
-> Electron WebCodecs
-> canvas Grid/Focus
```

Control:

```text
scrcpy-control control-only
-> Python endpoints /control/*
-> socket binario scrcpy
```

Fallback:

```text
ADB input solo si scrcpy-control falla o si preferScrcpy=false.
```

Prohibido para control manual normal:

- FlowAgent.
- Accessibility.
- OCR.
- MediaProjection.
- OpenCV.

### 3.2 Perfil `automation`

Uso: FlowLogin, scripts JS, click_text, set_text, dump inteligente, FlowKeyboard.

Motor:

- FlowAgent APK monolito.
- Socket TCP 8766.
- AutoJs6/Rhino embebido.
- AccessibilityServiceUsher / servicios del APK.
- FlowKeyboard cuando se pide texto (con `verifyText` disponible desde vCode 106).

No debe prepararse ni actualizarse automaticamente en dispositivos que ya tienen
APK salvo accion explicita.

### 3.3 Perfil `inspector`

Uso: Tree/Nativo/Auto/Web/CDP dentro de FlowDev/Focus.

Regla:

- Primero UIAutomator por ADB y/o CDP si hay WebView.
- Accessibility solo como complemento si ya esta disponible.
- OCR/Hybrid son los unicos modos que pueden pedir captura/MediaProjection.

### 3.4 Perfil `ocr`

Uso: OCR MLKit y template matching OpenCV.

Puede llamar bajo demanda:

- `capture_screen_start(streamFrames=false)`
- `capture_screen_stop`

Nunca debe arrancar MediaProjection al abrir Dashboard, Grid o Focus.

### 3.5 Perfil `recording`

Uso: grabacion manual a disco.

Motor:

- `scrcpy.exe` desde `scrcpy-win64-v4.0`.
- Endpoints `/recordings/start`, `/recordings/stop`, `/recordings/status`,
  `/recordings/active`.
- Guarda en `recordings/`.

---

## 4. Identidad y Dispositivos

### 4.1 Identificadores

| Campo | Ejemplo | Uso |
|---|---|---|
| `serial` | `192.168.1.11:5555` | Serial ADB actual; puede ser USB o WiFi |
| `activeSerial` | `192.168.1.11:5555` | Transporte elegido para comandos ADB |
| `androidId` | `7d74bcb099002d8c` | Identidad Android y mapping con C# |
| `physicalDeviceId` | `serialno:...` | Identidad fisica cuando se puede leer |
| `macAddress` | `00:E0:99:E2:33:35` | Clave estable preferida para perfiles locales |
| `deviceId` | `mac:<MAC>` | ID estable usado por `/devices` |
| `transports` | lista USB/WiFi | Transportes conocidos/activos |
| `preferredTransport` | `auto`, `usb`, `wifi` | Preferencia guardada por usuario |

### 4.2 Regla comercial de transporte

El producto debe soportar:

- 1 dispositivo.
- Pocos dispositivos.
- Muchos dispositivos.
- USB.
- WiFi ADB.
- Cambio entre USB o WiFi.
- Estados `device`, `offline`, `unauthorized`, `reconnecting`.

Nota empirica del usuario: en su prueba fisica no es viable usar el mismo
telefono simultaneamente por USB y WiFi. El producto debe soportar elegir uno u
otro transporte y no duplicar el telefono si cambia de transporte.

### 4.3 Endpoints de dispositivos

Python:

- `GET /devices`
- `GET /devices/subnets`
- `GET /devices/scan/status`
- `POST /devices/scan`
- `POST /devices/scan/cancel`
- `POST /devices/reconnect-known`
- `POST /device/transport-preference`
- `POST /device/forget`
- `GET/POST /device-mac`
- `GET /device/screen-size?serial=...`

C#:

- `GET /api/devices`
- `POST /api/devices/register`
- `GET /api/devices/mapping/{adbSerial}`
- `GET /api/devices/mappings`
- `POST /api/devices/execute`
- `POST /api/devices/adb/connect`

---

## 5. H.264 Grid/Focus Vigente

### 5.1 Archivos

- Backend: `scrcpy_raw_streamer.py`
- WS bridge: `scrcpy_raw_ws_server.py`
- Frontend renderer: `electron-app/src/renderer/stream-renderer-h264.js`
- Orquestacion Grid: `electron-app/src/renderer/app.js`
- Orquestacion Focus: `electron-app/src/renderer/flow-touch.js`
- Config canario/all devices: `h264_canary_config.json`

### 5.2 Presets actuales

Backend `scrcpy_raw_streamer.py`:

| Preset | max_size | max_fps | bit_rate |
|---|---:|---:|---:|
| `thumbnail` | 240 | 8 | 300000 |
| `eco` | 480 | 24 | 1000000 |
| `balanced` | 720 | 30 | 2500000 |
| `pro` | 960 | 30 | 4000000 |

Frontend `stream-renderer-h264.js` usa los mismos tamanos logicos:

- `thumbnail`: 240 / 8 fps.
- `eco`: 480 / 24 fps.
- `balanced`: 720 / 30 fps.
- `pro`: 960 / 30 fps.

No volver a 1080p como default Pro sin nueva validacion: se observo que algunos
encoders cerraban stream o quedaban en negro.

### 5.3 Protocolo actual

El modo estable usa `frame_meta` oficial de scrcpy para los 17 seriales actuales
por `h264_canary_config.json`.

En backend:

- `send_device_meta=false`
- `send_stream_meta=true`
- `send_dummy_byte=true`
- `send_frame_meta=true`
- `control=false`
- `audio=false`
- `cleanup=false`
- `tunnel_forward=true`
- `scid=<hex>` cuando esta habilitado por env/config

El backend consume:

- dummy byte.
- codec id de stream.
- session packets.
- headers de frame oficiales de 12 bytes.

Luego envia al WebSocket paquetes `FDH1`:

- `flags & 1`: config/SPS/PPS.
- `flags & 2`: keyframe/IDR.
- payload: paquete MediaCodec completo.

En frontend:

- `stream-renderer-h264.js` detecta `FDH1`.
- Actualiza SPS/PPS con paquetes config.
- Espera keyframe antes de decodificar deltas.
- Marca `EncodedVideoChunk` como `key` o `delta`.
- Cachea el ultimo `ImageBitmap` para pintar de inmediato canvases nuevos de
  Focus aunque la pantalla este estatica.

### 5.4 Grid y Focus

Comportamiento vigente:

- El Grid crea canvas por dispositivo visible.
- Si `H264StreamRenderer` existe, se usa H.264 y se evita suscripcion legacy
  WebP por `androidId`.
- El orden visual del Grid debe permanecer estable durante
  `device -> offline/rebooting/reconnecting -> device`. `loadDevices()` preserva
  el orden previo por identidad fisica (`deviceId`, `deviceKey`, MAC,
  `physicalDeviceId`, `androidId`) y usa `serial`/`activeSerial` solo como
  fallback. Los dispositivos realmente nuevos se agregan al final.
- Al volver un dispositivo a `device`, el Grid no reinicia H.264 por un umbral
  absoluto de `framesDecoded`. Resincroniza canvas y deja que
  `H264StreamRenderer.attach()` valide si hay una sesion viva con frame real.
- Si el retorno a `device` viene de un estado real `offline/rebooting/reconnecting`,
  el ultimo `ImageBitmap` anterior al reinicio se considera obsoleto aunque la
  sesion tenga `framesDecoded > 0`. En esa transicion se debe reabrir la sesion
  scrcpy/H.264 con `forceRestart(serial, null, gridCanvas)`, conservando canvas y
  preset actual, para evitar que Grid o Focus muestren la ultima imagen previa al
  reboot hasta que el usuario cambie resolucion.
- Despues de esa reapertura, el Grid debe asegurar el canvas varias veces durante
  una ventana corta. Algunos telefonos vuelven a emitir frames antes de que el
  canvas visible quede reanclado al DOM; otros lo hacen despues. La recuperacion
  post-reconnect debe cubrir esa carrera de tiempos sin tocar Focus ni cambiar
  preset.
- Durante `offline`, `rebooting` o `reconnecting`, el Grid NO debe cerrar la
  sesion H.264 ni borrar/remover el canvas fisico. El estado rojo de
  desconexion es solo overlay visual. Si `renderDevices()` reconstruye el DOM,
  `createCanvasesForVisibleDevices()` debe reanclar el canvas existente al
  contenedor para que la misma superficie pueda repintarse al volver el
  telefono.
- `attach()` de Grid poda canvases que ya no estan en el DOM y usa recovery
  acotado por serial: si tras la ventana de gracia no hay frame valido, recrea
  solo esa sesion, sin abrir Focus ni cambiar Eco/Balanced/Pro.
- En cada sincronizacion de canvas, el Grid debe asegurar de forma idempotente
  que el canvas visible este registrado en `session.canvases`. Una sesion puede
  estar viva y decodificando frames, pero dejar el Grid negro si el canvas DOM
  visible no quedo agregado como subscriber; Focus suele recuperarlo porque
  `attachFocus()` agrega un canvas nuevo a esa misma sesion viva.
- Ademas, el canvas puede seguir registrado pero quedar limpio/negro tras la
  tarjeta roja de desconexion. Por eso `ensureCanvas()` vuelve a llamar
  `addCanvas()` aunque el canvas ya exista en el Set: esto repinta el ultimo
  `ImageBitmap` cacheado sin reiniciar la sesion ni cambiar preset.
- Focus llama `h264.attachFocus(serial, canvas, preset)`.
- `attachFocus` busca una sesion fisica base por `serial`.
- Si existe, agrega el canvas de Focus a la misma sesion y puede cambiar preset.
- Se registra alias visual `serial|preset` para stats/Focus.
- `serial|preset` NO debe enviarse a ADB ni a `/control/*`; control siempre usa
  `activeSerial`/serial fisico.

Advertencia: hay comentarios historicos en codigo/documentacion que hablan de
sesiones independientes Focus/Grid. El runtime estable actual se debe entender
como sesion fisica base por serial con alias visual `serial|preset`, y el backend
limpia sesiones stale del mismo serial cuando corresponde.

### 5.5 Wake preflight

Problema confirmado:

- `.39`, `.44`, `.48`, `.147` podian entregar frames validos pero negros porque
  el dispositivo estaba `Dozing` y `Display Power: OFF`.

Solucion vigente:

- `scrcpy_raw_streamer.py` ejecuta `adb shell input keyevent WAKEUP` antes de
  abrir una sesion video-only.

Motivo:

- El video H.264 corre con `control=false`, por tanto no puede depender de la
  opcion `power_on` de control de scrcpy.

### 5.6 Diagnostico H.264 disponible

Endpoint:

- `GET http://127.0.0.1:8765/streaming/raw/sessions`

Campos importantes:

- `serial`, `preset`, `max_size`, `max_fps`, `bit_rate`, `local_port`, `scid`,
  `socket_name`, `scid_enabled`, `frame_meta_enabled`, `subscribers`,
  `bytes_streamed`, `chunks_read`, `frame_packets`, `stream_codec_id`,
  `stream_width`, `stream_height`, `config_packets`, `key_packets`,
  `has_sps_pps`, `has_idr`, `startup_stalled`, `alive`, `error`.

Recovery por dispositivo:

- `POST /streaming/raw/recover`
- `POST /streaming/raw/stop`

No reiniciar toda la flota si falla un dispositivo.

---

## 6. Control Manual Vigente

### 6.1 Archivos

- `scrcpy_control_channel.py`
- `local_adb_server.py`
- `electron-app/src/renderer/flow-touch.js`

### 6.2 Endpoints

- `POST /control/tap`
- `POST /control/touch`
- `POST /control/swipe`
- `POST /control/keyevent`
- `GET /control/scrcpy-sessions`

### 6.3 Ruta principal

`flow-touch.js` usa `FlowTouchCommandRouter`, que llama a `/control/*`.

`local_adb_server.py` intenta primero `SCRCPY_CONTROL_MANAGER` salvo:

- `preferScrcpy=false`.
- `CONTROL_SAFE_MODE_ADB=true`.
- serial en `CONTROL_ADB_ONLY_SERIALS`.
- excepcion en scrcpy-control.

Si scrcpy-control falla, cae a ADB input donde aplica.

### 6.4 scrcpy-control

`scrcpy_control_channel.py` abre una sesion control-only:

- `video=false`
- `audio=false`
- `control=true`
- `cleanup=false`
- `power_on=false`
- `clipboard_autosync=false`
- `send_dummy_byte=true`
- `send_device_meta=false`
- `scid=<hex>`
- socket `localabstract:scrcpy_<scid>`

El runtime caliente mostro sesiones control-only activas en
`/control/scrcpy-sessions`, incluyendo pantalla `1080x1920`.

### 6.5 Regla critica

Control manual NO usa FlowAgent ni Accessibility. Si una documentacion antigua
dice lo contrario, esta obsoleta.

---

## 7. FlowTouch / Focus UI

### 7.1 Estado actual

Focus funciona para video y control. La interfaz visual recibio multiples
mejoras recientes (2026-06-16):

- Calidad segmentada por pildoras en cabecera.
- Glow dinamico de presets.
- Botones de herramientas compactos y horizontales.
- Popover minimalista de bolitas de cuentas.
- Editor de cuentas flotante translucido.
- Arrastre por deltas para ventanas flotantes.
- Correccion de estado OFFLINE, animacion recortada, solapamiento en modo clasico.

### 7.2 Herramientas Focus existentes

En `flow-touch.js` existe `FLOW_TOUCH_SECTION_WINDOWS` con:

- `archivos`
- `adb`
- `autojs`
- `sistema`
- `energia`
- `flowkeyboard`
- `inspector`

El backend tiene endpoints correspondientes, por ejemplo:

- `/apps/list`, `/apps/launch`, `/apps/force-stop`, `/apps/clear-cache`,
  `/apps/uninstall`, `/apps/icon`, `/apps/install`
- `/file-push`
- `/autojs/push`, `/autojs/prepare-overlay`, `/autojs/install-bundled`
- `/system/open-settings`
- `/power/reboot`, `/power/shutdown`
- `/flowkeyboard/*`
- `/inspector/*` y `/flowagent/ocr-detect` para modos OCR bajo demanda

Si una herramienta no funciona en UI, diagnosticar primero bindings JS, IDs,
ventanas flotantes y estados de backend antes de tocar video.

---

## 8. Backend C# Vigente

Proyecto: `FlowDashboard.Core`.

Puerto: `5000`.

Runtime: .NET 8.0. En desarrollo puede ejecutarse con el SDK/runtime local; en
producto Fase 6 publica `build\runtime\dotnet\FlowDashboard.Core.exe`
self-contained para no requerir .NET instalado en el cliente.

Ejecutable de desarrollo verificado:
`FlowDashboard.Core\bin\Release\net8.0\FlowDashboard.Core.exe`.

Dependencias NuGet: `AdvancedSharpAdbClient 3.3.7`, `MailKit 4.17.0`,
`SignalR 1.1.0`, `Swashbuckle.AspNetCore 6.5.0`,
`System.Drawing.Common 8.0.0`.

Endpoints verificados:

- `GET /api/health`
- `GET /api/devices`
- `GET /api/streaming/stats`
- `GET /api/streaming/active`
- `GET /api/mail/status`
- `POST /api/mail/connect`
- `POST /api/mail/search-spotify-link`

Funciones actuales:

- Lista dispositivos por `AdbService`.
- Mantiene mapping Android ID <-> ADB serial.
- Recibe/broadcastea frames legacy WebP por `/api/streaming/frames` y
  `/ws/streaming`.
- Tiene endpoints legacy de `scrcpy.exe` nativo/embebido:
  - `/api/streaming/start-embedded`
  - `/api/streaming/stop`
  - `/api/streaming/reposition`
  - `/api/streaming/set-visibility`
  - `/api/streaming/stop-all`
  - `/api/streaming/active`
- Gestiona FlowMail con `MailService`:
  - `POST /api/mail/connect` conecta Gmail por IMAP usando app password.
    Usa `imap.gmail.com:993` con TLS on-connect. Si Windows/.NET falla en el
    handshake por comprobacion de revocacion, reintenta solo con
    `CheckCertificateRevocation=false`; no desactiva la validacion general del
    certificado.
    Si Schannel sigue fallando, usa el helper local
    `FlowDashboard.Core/Services/flowmail_imap_helper.py` con Python/OpenSSL.
  - La app password se persiste cifrada con DPAPI de Windows en
    `FlowDashboard.Core/mail_config.json`.
  - `POST /api/mail/search-spotify-link` busca magic links de Spotify para un
    destinatario concreto sin exponer credenciales.

Estado runtime:

- `/api/streaming/stats` devolvio `connectedClients=0`, `cachedFrames=0`.
- `/api/streaming/active` devolvio lista vacia.

Por tanto, el video vigente de Grid/Focus NO depende de C# WebP cuando H.264 esta
disponible.

---

## 9. Backend Python Vigente

Archivo principal: `local_adb_server.py` (371 KB, archivo monolitico).

Responsabilidades:

- Descubrimiento/listado de dispositivos.
- Licencias Supabase/local.
- Persistencia de nombres/grupos/cuentas.
- FlowLogin/FlowRegister.
- FlowMail bridge para magic links de FlowLogin.
- FlowAgent socket.
- FlowKeyboard.
- Inspector.
- OCR/template matching bajo demanda.
- Grabacion manual.
- Control manual `/control/*`.
- H.264 raw WS y diagnostico.

### 9.1 Health vigente

`GET /health` devuelve:

- `ok`
- `adb`
- `version`
- `appVersion`
- `features`
- `flowAgentApk`
- `flowAgentApkExists`

Runtime actual:

- `appVersion`: `2.0.0` (definido en `app_meta.py` y sincronizado desde `version.json`).
- ADB: `C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe`.
- FlowAgent APK: `flow_agent_monolito\app\build\outputs\apk\app\release\agent-v1.0.0-arm64-v8a.apk`.

### 9.2 Features vigentes

El `/health` reporta 39 features. Las mas relevantes:

- `device_mac_identity`
- `flowagent_auto_socket_watchdog`
- `screen_streaming_scrcpy`
- `pro_native_scrcpy_streams`
- `etapa_c_h264_websocket`
- `flowdev_inspector_focus`
- `scrcpy_raw_h264_ws`
- `operation_profiles`
- `scrcpy_manual_recording`
- `scrcpy_control_first_adb_fallback`

### 9.3 Constantes de version FlowAgent

En `local_adb_server.py` linea 242-243:

- `FLOW_AGENT_EXPECTED_VERSION = "1.0.0"`
- `FLOW_AGENT_EXPECTED_VERSION_CODE = 106`

El setup-smart compara la version/versionCode instalada contra estos valores
para decidir si actualizar.

---

## 10. Persistencia y Rutas

### 10.1 Archivos principales

- `device_names.json`: nombres, persona/perfil, estados de cuentas, preferencia de transporte.
  Clave principal: MAC address (ej: `mac:00:E0:99:E2:33:35`).
- `device_groups.json`: grupos/categorias y asignaciones.
- `device_inventory.json`: inventario fisico/transporte (~10 KB).
- `device_mappings.json`: mapping `androidId -> adbSerial` (~3 KB).
- `.flowlogin_payloads/`: payloads por dispositivo para FlowLogin.
- `.app_icon_cache/`: cache local de iconos de apps.
- `.supabase_config.json`: configuracion local de Supabase/Captcha.
- `FlowDashboard.Core/mail_config.json`: configuracion local de FlowMail con
  email y app password cifrada por DPAPI de Windows. Debe permanecer ignorado
  por git y no debe copiarse a documentacion.
- `h264_canary_config.json`: seriales con `frame_meta`/`scid` H.264.
- `recordings/`: grabaciones manuales.

No documentar passwords, tokens, anon keys, service role keys ni payloads de
cuentas reales.

### 10.2 Locks y deuda tecnica

Codigo actual:

- `DEVICE_NAMES_LOCK` existe.
- `set_device_account_status()` usa `DEVICE_NAMES_LOCK`.
- `save_device_names()` escribe archivo directamente.
- `save_device_groups()` escribe archivo directamente.

Por tanto, no afirmar que todos los JSON estan plenamente protegidos por locks.
Hay deuda comercial: consolidar escrituras atomicas/locks para JSON compartidos.

### 10.3 Rutas comerciales

El codigo ya usa:

- `FLOWDASHBOARD_BASE_DIR`
- `FLOWDASHBOARD_RESOURCE_DIR`
- `FLOWDASHBOARD_ADB`
- `SCRCPY_PATH`
- `SCRCPY_SERVER_JAR`
- `FLOWDASHBOARD_ELECTRON_USER_DATA`
- `FLOWDASHBOARD_DATA_DIR`
- `FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART`

Pero el empaquetado comercial debe probar que no depende de
`C:\DASHBOARD\FlowDashboard` ni de `C:\Users\elyup`.

### 10.4 Frontend localStorage

El frontend Electron persiste en localStorage (dentro de
`scratch\electron-user-data-runtime`):

- Cuentas (Total, Validos, No validos).
- Delimitador y cantidad de Dividir.
- Preset del grid y Focus.
- Zoom de dispositivos.
- Geometria de ventanas flotantes Focus.
- Estado de paneles/secciones colapsadas.
- Licencia guardada.
- Estado de FlowCategory fijado.
- Estado de seccion Tools.

---

## 11. FlowAgent / Automation

### 11.1 Estado

FlowAgent monolito vive en `flow_agent_monolito/`.

APK esperado:

- package: `com.flowlogin.agent`
- versionName: `1.0.0`
- versionCode: `106`
- release actual: `agent-v1.0.0-arm64-v8a.apk`

APK legacy de rollback: `flow_agent_apk/backup_0_3_8/flowagent-0.3.8-from-41.apk`.

### 11.2 Uso permitido

FlowAgent se usa para:

- FlowLogin.
- FlowRegister.
- Scripts JS via Rhino/AutoJs6.
- OCR.
- Template matching.
- FlowKeyboard (con `verifyText` para validar texto emitido).
- Dumps inteligentes.
- Automatizacion bajo demanda.

No se usa para control manual normal.

### 11.3 Onboarding

Regla vigente:

- Si el APK no existe en un dispositivo nuevo, el onboarding puede instalarlo.
- Si ya existe, no reinstalar ni actualizar automaticamente.
- Si ya existe y esta en version vigente, el backend puede recomponer el canal
  de automatizacion automaticamente aplicando `adb reverse` y relanzando
  `com.flowlogin.agent/.MainActivity` con `autoconnect=true`. Esto no es
  instalacion ni fallback de control manual.
- No iniciar MediaProjection ni icono de captura al abrir Dashboard/Grid/Focus.

### 11.4 Accesibilidad

Unico servicio visible en Android:

- `com.flowlogin.agent/org.autojs.autojs.core.accessibility.AccessibilityServiceUsher`

`FlowAccessibilityService` esta deshabilitado en AndroidManifest (`enabled=false`)
pero el codigo se conserva como helper/rollback interno.

---

## 12. FlowLogin y FlowMail

### 12.1 Flujo base FlowLogin

FlowLogin se inicia desde Electron y ejecuta `Login.js` mediante el canal
obligatorio FlowAgent socket/Rhino. No debe caer silenciosamente a ADB como
motor de automatizacion.

Contratos principales:

- `Login.js` lee `/sdcard/Download/flowlogin_accounts.json`.
- `Login.js` escribe progreso en `/sdcard/Download/flowlogin_status.json`.
- `local_adb_server.py` lee el status remoto desde `/login-status` y persiste
  estados por dispositivo/cuenta/clon en `device_names.json`.
- Electron pinta los estados por cuenta/clon desde el progreso devuelto por el
  backend.

Estados vigentes de cuenta:

- `pending`: aun no procesada.
- `running`: intento en curso.
- `retrying`: cuenta programada o ejecutando segundo intento.
- `waiting_mail`: FlowMail espera o procesa magic link.
- `success`: login confirmado.
- `already`: sesion ya estaba iniciada.
- `error`: fallo final.
- `review`: requiere revision manual o no hubo confirmacion segura.

### 12.2 FlowMail para bloqueo abroad 14 dias

FlowMail se usa solo dentro de FlowLogin cuando Spotify muestra el mensaje:
`You can only use Spotify abroad for 14 days. Update your location at Spotify.com to continue using it.`

Flujo vigente:

1. `Login.js` valida que el mensaje pertenece al `packageName` del clon activo,
   priorizando `TextView` con `<packageName>:id/body`.
2. Pulsa `OK` en `<packageName>:id/button_positive`.
3. Pulsa `Log in without password` en
   `<packageName>:id/request_magiclink_lower_button`.
4. Intenta leer `<packageName>:id/request_sent_message` y confirmar que el email
   del mensaje coincide con la cuenta que se estaba intentando iniciar. Esta
   confirmacion visual es diagnostica, no bloqueante: si Auto.js no encuentra o
   no parsea el texto, el flujo continua igualmente.
5. Escribe estado `waiting_mail` con metadata `flowMail`:
   - `email`
   - `requestedAt`
   - `package`
6. `local_adb_server.py` conserva esa metadata al leer `/login-status`.
7. Python llama a `POST /api/mail/search-spotify-link` en C#.
8. `MailService` busca en Gmail por IMAP, priorizando INBOX y revisando carpetas
   utiles como spam/junk/all mail/promotions cuando existen.
9. La busqueda por IMAP es la validacion autoritativa: prioriza que el
   destinatario sea el email de la cuenta y que el remitente/asunto/contenido
   correspondan a Spotify. No debe documentar ni loguear tokens.
10. Cuando encuentra un enlace `https://accounts.spotify.com/login/ott/music...`,
    Python lo abre con el ADB empaquetado:
    `am start -a android.intent.action.VIEW -d '<url>' -p '<packageName>'`.
    La URL y el paquete deben citarse con `shlex.quote` porque el magic link
    contiene `#` y `&`; sin quoting Android recibe una URL truncada y puede
    mostrar el selector `Open with` entre varios clones.
11. Si el clon muestra `<packageName>:id/body` con `This link has expired.`,
    `Login.js` pulsa `<packageName>:id/button_positive` (`Send new link`) y
    vuelve a publicar `waiting_mail` con un `requestedAt` nuevo y
    `flowMail.requireRecent=true`. En ese modo, C#/Python IMAP solo aceptan
    correos con `Date >= requestedAfterUtc - 5 minutos`, para no reabrir el
    link viejo aunque coincida el destinatario.
12. `Login.js` espera confirmacion estable de sesion. Si confirma, marca
    `success` con mensaje `Login con FlowMail`; si no, marca `review`.

### 12.3 Persistencia FlowMail

La configuracion vive en C#:

- UI Electron: `configuracion de mail app:` debajo de `Historial de Cuentas`.
- Campo email: se puede recordar en `localStorage` solo como conveniencia visual.
- Campo app password: `type=password`, no se guarda en `localStorage`.
- Backend C#: guarda la app password cifrada con DPAPI Windows CurrentUser en
  `FlowDashboard.Core/mail_config.json`.
- Si la configuracion ya existe, el usuario puede reconectar sin volver a
  escribir la app password.

Reglas:

- No copiar app passwords, enlaces magic link completos ni tokens a logs,
  documentacion o informes.
- No intentar saltar captcha, 2FA, verificaciones ni bloqueos no confirmados.
- La prueba real debe hacerse primero con un dispositivo/clon canario.

---

## 13. Electron Frontend Vigente

### 13.1 Estructura de archivos

```
electron-app/
  package.json            (v2.0.0, Electron ^28.0.0)
  src/main/index.js       (proceso main, IPC handlers)
  src/main/path-resolver.js (rutas dev/prod y dataRoot)
  src/main/runtime-manager.js (supervision C#/Python)
  preload/preload.js      (bridge contextIsolation)
  src/renderer/
    index.html            (entry point)
    styles.css            (239 KB)
    app.js                (356 KB - orquestacion principal)
    flow-touch.js         (148 KB - Focus mode)
    stream-renderer-h264.js (36 KB - WebCodecs H.264)
    stream-renderer.js    (16 KB - WebP legacy)
    inspector.js          (76 KB - Inspector UI)
    api-client.js         (4 KB - cliente HTTP)
    test-connections.js   (4 KB)
    canvasStreaming.js     (8 KB)
  node_modules/
    electron/dist/electron.exe (v28.3.3, 169 MB)
    @microsoft/signalr/
    axios/
```

### 13.2 IPC registrados

Main process (index.js):

| Canal IPC | Funcion |
|-----------|---------|
| `get-app-version` | Version de la app |
| `minimize-window` | Minimizar |
| `maximize-window` | Maximizar/restaurar |
| `close-window` | Cerrar |
| `embed-window` | Registrar ventana embebida |
| `detach-window` | Desembeber ventana |
| `get-window-handle` | Handle por PID |
| `get-main-window-handle` | HWND de mainWindow |
| `read-json-file` | Leer JSON desde DATA_DIR |
| `write-json-file` | Escribir JSON en DATA_DIR |
| `get-data-dir` | Obtener DATA_DIR |
| `get-path-info` | Obtener rutas resueltas y migraciones aprobadas |
| `runtime-status` | Consultar estado de RuntimeManager, sidecars y recursos |
| `runtime-prepare-for-update` | Detener sidecars propios antes de actualizar |
| `launch-flowtrackname` | Lanzar FlowTrackName.exe |
| `flowtrackname-status` | Estado de FlowTrackName |
| `stop-flowtrackname` | Detener FlowTrackName |
| `shell-open-path` | Abrir path con shell |
| `shell-show-item-in-folder` | Mostrar en explorador |

### 13.3 CSP

Content-Security-Policy permite:

- `connect-src`: localhost/127.0.0.1 HTTP y WS.
- `script-src`: self, unsafe-inline, unsafe-eval, cdn.jsdelivr.net.
- `img-src`: self, data:, blob:.
- `worker-src`: self, blob:.

### 13.4 Electron console log

`electron-console.log` (112 MB) se escribe continuamente. Riesgo de disco lleno
en uso prolongado.

---

## 14. Documentacion Oficial Local de scrcpy

Para afirmar algo sobre scrcpy, usar:

- `informacion de scrcpy` (22 documentos en `doc/`)
- `scrcpy-win64-v4.0`
- codigo local real

No inventar flags.

Opciones usadas actualmente por codigo:

- `scid`
- `tunnel_forward=true`
- `audio=false`
- `video=false` en control-only
- `control=false` en video-only
- `control=true` en control-only
- `cleanup=false`
- `power_on=false` en control-only
- `clipboard_autosync=false` en control-only
- `send_dummy_byte=true`
- `send_device_meta=false`
- `send_stream_meta=true` en frame_meta H.264
- `send_frame_meta=true` en frame_meta H.264
- `raw_stream=true` solo para modo raw historico/no-frame_meta
- `max_size`
- `max_fps`
- `video_bit_rate`

Jar oficial usado por runtime:

- `scrcpy-win64-v4.0\scrcpy-server.jar`

Remote path:

- `/data/local/tmp/scrcpy-server-manual.jar`

---

## 15. Fallos Historicos y Estado Actual

### 15.1 Distorsion H.264 tras taps/swipes

Causa confirmada en la investigacion:

- Parser raw Annex-B y limites de paquetes no eran suficientemente robustos para
  movimiento intenso/P-frames grandes.
- Reconstruir access units desde `raw_stream=true` no resolvio del todo.
- La solucion estable fue usar `send_frame_meta=true` y enviar paquetes `FDH1`
  con flags oficiales de config/keyframe.

Estado:

- Usuario valido que Eco/Balanced/Pro funcionan sin distorsion tras acciones.

### 15.2 Pantalla negra en `.39`, `.44`, `.48`, `.147`

Causa confirmada:

- Dispositivos en Dozing/OFF.

Solucion:

- Wake preflight antes del video-only H.264.

Estado:

- Usuario reporto que todos cargan en Grid y Focus.

### 15.3 Electron breakpoint dialog

Observado varias veces al abrir/probar `electron.exe` directo.

Regla operativa:

- No usar `electron.exe` directo.
- Usar `abrir_electron.bat`.

### 15.4 Supabase error local

El error `WinError 10061` se debio a conexion local/backend/proxy/config en el
momento de prueba, no a cambio del motor H.264. El launcher limpia proxies salvo
override.

### 15.5 Grabacion scrcpy 48 bytes

Observado en `.43`: grabaciones generadas con `--record` producian MP4 de 48 bytes
y scrcpy terminaba con codigo `-1073741819`. Esto ocurrio tanto desde endpoint
como desde CLI directo. Queda pendiente investigar; no es fallo del endpoint
sino del encoder/scrcpy en ese entorno/dispositivo.

---

## 16. Herramientas Adicionales

### 16.1 FlowTrackName

- Ubicacion: `Herramientas/FlowTrackName.exe` (32 MB).
- Lanzamiento: desde menu Tools del dashboard, via IPC `launch-flowtrackname`.
- El dashboard puede abrir, consultar estado y detener el proceso.
- Fase 7 lo incluye en
  `build\staging\commercial-resources\Herramientas\FlowTrackName.exe`.
- SHA-256 verificado:
  `fba6a00129f63726c590819c19f1c64f90a6801bbf419a17adb675409016177e`.

### 16.2 Tools de diagnostico

Directorio `tools/` contiene scripts de diagnostico y medicion:

- `check_mojibake.py`: auditor de encoding.
- `measure_tap_jitter.py`: medicion de precision de taps.
- `install_monolito_device.ps1`: instalacion controlada en 1 dispositivo.
- `recording_spike*.py`: pruebas de grabacion.
- `test_http_*.py`: pruebas de endpoints.

---

## 17. Portabilidad y Dependencias

### 17.1 Incluido en el proyecto

| Componente | Ruta | Tamaño aprox |
|------------|------|-------------|
| ADB | `scrcpy-win64-v4.0/adb.exe` | 8.5 MB |
| scrcpy.exe | `scrcpy-win64-v4.0/scrcpy.exe` | 716 KB |
| scrcpy-server.jar | `scrcpy-win64-v4.0/scrcpy-server.jar` | 732 KB |
| DLLs scrcpy | `scrcpy-win64-v4.0/*.dll` | ~32 MB total |
| Electron | `electron-app/node_modules/electron/dist/` | 169 MB |
| node_modules | `electron-app/node_modules/` | — |
| FlowAgent APK | `flow_agent_monolito/.../agent-v1.0.0-arm64-v8a.apk` | — |
| FlowTrackName | `Herramientas/FlowTrackName.exe` | 32 MB |
| C# Release build | `FlowDashboard.Core/bin/Release/net8.0/` | — |
| Commercial resources staging | `build/staging/commercial-resources/` | 304 MB |

### 17.2 Dependencias externas (riesgo comercial)

| Dependencia | Estado | Solucion requerida |
|-------------|--------|-------------------|
| Python 3.10+ con websockets/psutil/websocket-client | Fase 5 produce PyInstaller onedir | Phase 8 consume runtime empaquetado desde instalador; validar en equipo limpio |
| .NET 8 Runtime | Fase 6 produce self-contained win-x64 | Phase 8 consume runtime empaquetado desde instalador; validar en equipo limpio |
| Ruta hardcoded `C:\Users\elyup\...` en launcher | Solo desarrollo | Eliminar del launcher |

### 17.3 Copias redundantes

- `scrcpy-server.jar` y `scrcpy-server` existen en la raiz Y en `scrcpy-win64-v4.0/`.
  El backend usa la de `scrcpy-win64-v4.0/`. Las copias de la raiz son redundantes.

---

## 18. Reglas Para Futuras Modificaciones

1. Leer primero `AGENTS.md`, `PROJECT_CONTEXT.md` y este documento.
2. No modificar Scrcpy Video/H.264/Control si la tarea es visual.
3. Usar `abrir_electron.bat` para pruebas.
4. No usar `electron.exe` directo.
5. No activar MediaProjection por abrir Dashboard/Grid/Focus.
6. No usar FlowAgent como fallback de control manual.
7. No convertir ADB input en motor principal si scrcpy-control funciona.
8. No hardcodear IPs ni cantidad de dispositivos.
9. No depender de rutas absolutas del PC del desarrollador.
10. No exponer secretos de `.supabase_config.json`, `device_names.json` ni
    `.flowlogin_payloads`.
11. Si se cambia una funcion real, actualizar `PROJECT_CONTEXT.md`.
12. Para cambios UI Focus, trabajar en fase visual separada y probar overflow en
    varias resoluciones.
13. Crear restore point antes de cualquier modificacion.
14. No leer ni basarse en `DOCUMENTACION_TECNICA.md` (archivo prohibido/legacy).

---

## 19. Archivos en Raiz del Proyecto

La raiz contiene ~213 archivos y 28 subdirectorios. Muchos son temporales,
diagnosticos o de sesiones pasadas.

### 19.1 Archivos activos criticos

- `local_adb_server.py`, `scrcpy_raw_streamer.py`, `scrcpy_raw_ws_server.py`,
  `scrcpy_control_channel.py` (backend Python).
- `Login.js`, `Register.js`, `test.js`, `clear-cache-data.js` (scripts AutoJs6).
- `app_meta.py` (version del producto).
- `abrir_electron.bat`, `abrir_electron.ps1` (launcher).
- `requirements.txt` (dependencias Python).
- `h264_canary_config.json` (config H.264).
- `device_names.json`, `device_groups.json`, `device_inventory.json`,
  `device_mappings.json` (persistencia).
- `.supabase_config.json` (licencias).
- `AGENTS.md`, `PROJECT_CONTEXT.md` (documentacion viva).

### 19.2 Archivos posiblemente obsoletos

Instrucciones/notas txt (~20), build logs (~14), scripts diagnosticos ps1 (~25),
fix scripts py/js (~8), SQL Supabase (~7), spike archivos (~8), launcher scripts
legacy (~5).

Carpeta `Eliminar/` contiene archivos ya marcados para borrado (incluye
`laixi.apk` de 63 MB y `DOCUMENTACION_TECNICA.md` de 110 KB).

No se ha borrado nada — se documentan para decision futura del usuario.

---

## 20. Proxima Fase Recomendada

### 20.1 Validacion de instalador en equipo limpio

Instalar y arrancar `release_packages\FlowDashboard-Setup-2.0.0.exe` en un
equipo limpio sin Python, .NET SDK, Android SDK ni variables de desarrollo.
Verificar arranque de Electron, C# `/api/health`, Python `/health`, ADB
empaquetado, scrcpy empaquetado y data root de usuario.

### 20.2 Fase visual Focus

- `FOCUS-UI-RESTORE-TOOLS-NONCONTROL-01` (pendientes menores).
- Auditar herramientas una por una.

### 20.3 Limpieza de raiz

Mover archivos temporales/one-off a `docs_legacy/` o `Eliminar/`.
Reducir ruido visual del proyecto.

### 20.4 Firma y actualizacion comercial

Configurar firma digital del instalador y definir el flujo de actualizaciones
comerciales antes de distribucion publica. El codigo de `electron-updater` ya
existe; falta la prueba real N -> N+1 con release firmado.

---

Fin de la especificacion vigente.
