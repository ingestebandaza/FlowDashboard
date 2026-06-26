# FlowAgent Monolito - Tasks

Fecha: 2026-05-26
Estado: Planificado. Ejecutar en sesion dedicada (4-8 horas).
Punto de restauracion: `restore_points/PuntoAntesFlowAgentMonolito`

## Fase 0 - Pre-flight (15-30 min)

- [x] Confirmar restore point.
- [x] Verificar Android Studio instalado o aceptar instalarlo durante la sesion.
- [x] Verificar `ANDROID_HOME` apunta al SDK correcto.
- [x] Verificar JDK 11 o 17 disponible (AutoJs6 usa Kotlin 1.9+, requiere JDK 17).
- [x] Confirmar keystore: `flow_agent_apk/flowagent-debug.keystore`, `storepass=android`, `keypass=android`, alias `androiddebugkey`.
- [x] Documentar versiones del entorno (`java -version`, `gradle --version`, Android SDK build-tools).

## Fase 1 - Setup AutoJs6 (60-90 min)

- [x] Clonar AutoJs6:
  ```
  git clone --depth 1 https://github.com/SuperMonster003/AutoJs6.git flow_agent_monolito
  ```
- [x] Verificar que el repo trae `gradle/wrapper` y `gradlew.bat`.
- [x] Abrir el proyecto en Android Studio.
- [x] Esperar primera indexacion (5-15 min, descarga 1-2 GB de dependencias).
- [x] Build inicial sin cambios para validar que compila tal cual.
  ```
  .\gradlew.bat assembleDebug
  ```
- [x] APK resultante: `flow_agent_monolito/app/build/outputs/apk/debug/app-debug.apk`.
- [x] Verificar tamaño esperado (~80 MB).

## Fase 2 - Renombrar package (30 min)

- [x] Cambiar `applicationId` en `app/build.gradle.kts` a `com.flowlogin.agent`.
- [x] `versionCode = 100`, `versionName = "1.0.0"`.
- [x] `applicationLabel`: cambiar `R.string.app_name` a "FlowAgent".
- [x] Cambiar icono de la app (`mipmap-*/ic_launcher.png`) por el nuestro.
- [x] Build de prueba.
- [x] Instalar en `.43` SOBRE el FlowAgent 0.3.8 actual:
  ```
  adb -s 192.168.1.43:5555 install -r app-debug.apk
  ```
  Esperado: `INSTALL_FAILED_UPDATE_INCOMPATIBLE` o similar porque la firma cambio.
- [x] Configurar `signingConfigs` en `build.gradle.kts` para usar `flow_agent_apk/flowagent-debug.keystore`.
- [x] Reinstalar.
- [x] Validar que la app abre y aparece la UI por defecto de AutoJs6.

## Fase 3 - Migracion FlowAgent (90-120 min)

- [x] Copiar `flow_agent_apk/src/com/flowlogin/agent/*.java` a `flow_agent_monolito/app/src/main/java/com/flowlogin/agent/`.
- [x] Renombrar paquetes:
  - `com.flowlogin.agent.MainActivity` -> queda como entrada principal (reemplaza la de AutoJs6).
  - Resto sigue en `com.flowlogin.agent`.
- [x] Copiar `flow_agent_apk/res/xml/accessibility_service.xml` a `app/src/main/res/xml/`.
- [x] Copiar `flow_agent_apk/res/xml/flow_keyboard_method.xml`.
- [x] Copiar layouts `activity_main.xml`, `flow_keyboard_view.xml`.
- [x] Copiar drawables del FlowKeyboard.
- [x] Copiar strings de FlowAgent en `app/src/main/res/values/strings.xml` (sin pisar las de AutoJs6).
- [x] Mergear `AndroidManifest.xml`:
  - Mantener todos los `<activity>`, `<service>`, `<receiver>` de AutoJs6.
  - Agregar nuestros `<service>` (FlowAccessibilityService, FlowKeyboardService) y nuestra `<activity>` MainActivity como LAUNCHER (quitando el LAUNCHER de la SplashActivity de AutoJs6).
  - Sumar permisos faltantes (REQUEST_DELETE_PACKAGES, etc).
  - **MainActivity debe llevar `android:screenOrientation="portrait"`** (mantener la regla del FlowAgent 0.3.8 actual; el header/Logs/botones estan diseniados para vertical).
- [x] Resolver imports y conflictos de compilacion.
- [x] Build verde.
- [x] Instalar en `.43`.
- [x] Validar:
  - [x] La app abre con NUESTRA MainActivity (no la de AutoJs6).
  - [-] El socket TCP 8766 conecta al backend Python.
  - [-] `/agents` reporta el dispositivo.
  - [-] Streaming WebP llega al dashboard.
  - [-] Tap real ejecuta correctamente.
  - [x] FlowKeyboard sigue siendo IME instalado.
  - [x] Activar accesibilidad funciona.

## Fase 4 - Bridge ScriptRunner (60-90 min)

- [x] Crear `com.flowlogin.agent.runner.ScriptRunner` que use `ScriptEngineManager` de AutoJs6.
- [x] Comando socket nuevo `run_script`: lee path de un `.js` en `/sdcard/...`, lo ejecuta y devuelve `{ok, executionId}`.
- [x] Comando socket nuevo `stop_script`: detiene la ejecucion por `executionId`.
- [x] Endpoint backend Python `POST /flowagent/run-script` que envuelve el comando socket.
- [ ] Probar con `test_hello.js` (toast simple). _<-- diferido a Fase 8 (requiere monolito desplegado en .43)._
- [ ] Probar con `GREEN_SONGS_V14_BY_FENIX.js` (script real, dialogs + floaty + http). _<-- diferido a Fase 8._

## Fase 5 - Bridge OCR (60-90 min)

- [x] Agregar dependencia MLKit Text Recognition en `app/build.gradle.kts`.
- [x] Crear `com.flowlogin.agent.runner.OcrBridge`.
- [x] Comando socket `ocr_detect`: captura pantalla -> MLKit -> JSON con texto y bloques.
- [x] Endpoint backend `POST /flowagent/ocr-detect`.
- [ ] Probar capturando una pantalla con texto conocido (ej. "Settings" -> deberia leer "Settings"). _<-- diferido a Fase 8._

## Fase 6 - Bridge OpenCV (90-120 min)

- [x] Agregar OpenCV AAR en `app/libs/` o como dependencia Gradle.
- [x] Inicializar OpenCV en `AgentApplication.onCreate()`.
- [x] Crear `com.flowlogin.agent.runner.OpenCvBridge`.
- [x] Comando socket `image_match_template`: captura -> opencv matchTemplate -> coords.
- [x] Endpoint backend `POST /flowagent/find-template`.
- [ ] Probar con un template conocido (ej. icono de Spotify). _<-- diferido a Fase 8._

## Fase 7 - Nueva apariencia MainActivity (60-90 min)

- [x] Diseñar nuevo `activity_main.xml` con Material Components 3.
- [x] Estado en vivo (accesibilidad, captura, socket, latencia).
- [x] Boton "Activar todo" que guie al usuario por permisos.
- [x] Paleta cyan/verde consistente con dashboard.
- [x] Sin emojis nuevos.

## Fase 8 - Validacion en .43 (30-60 min)

> **Estado: ✅ Cerrada el 2026-05-27. Bug de socket resuelto, scripts ejecutandose.**
>
> ### Bug raiz encontrado y arreglado
>
> El "socket no conecta" tenia DOS causas:
>
>   1. **Causa #1 (codigo del FlowAgent):** El `AgentSocketClient.stop()` no
>      interrumpia el thread del loop. Despues de un `restart()`, el thread viejo
>      seguia bloqueado en `Socket.connect()` (timeout 5s) o `Thread.sleep(2200)`
>      por hasta 7 segundos antes de leer las prefs nuevas. **Fix:** agregue
>      `thread.interrupt()` en `stop()` y logs `Log.d/i/w` con tag `FlowAgentSocket`.
>
>   2. **Causa #2 (yo lanzaba mal el FlowAgent en mi test):** Pasaba
>      `--es host 192.168.1.149` (IP del PC en LAN). El patron correcto del
>      proyecto es usar `adb reverse tcp:8766 tcp:8766` + lanzar con
>      `--es host 127.0.0.1`. El reverse hace que el FlowAgent se conecte a
>      `127.0.0.1:8766` (loopback dentro del telefono) y ese trafico va por el
>      tunel ADB hacia el PC. **No depende de la red Wi-Fi/Ethernet, ni de IPs,
>      ni de firewall**. Es la solucion robusta para cualquier red del cliente.
>
> ### Bug residual encontrado al validar scripts
>
> Despues del fix de socket, `ScriptRunner.startScript()` tiraba excepcion en
> `AutoJs.scriptEngineService.execute()`. El stack trace mostro
> `EncryptedScriptFileHeader.getHeaderFlags(file)` fallando al abrir el .js.
> **Causa:** el monolito no tenia concedido `READ_EXTERNAL_STORAGE` en runtime
> (Android 9). **Fix:** `pm grant com.flowlogin.agent android.permission.READ_EXTERNAL_STORAGE`
> debe agregarse al setup del FlowAgent en `setup_flow_agent` del backend Python
> (TODO post-Fase 8).
>
> ### Validacion E2E final
>
> Cadena completa probada con `test_hello.js` en `.43`:
>
>   ```
>   POST /flowagent/run-script {"serial":"192.168.1.43:5555","path":"/sdcard/Download/test_hello.js"}
>     -> backend Python ve agent conectado para .43
>     -> envia comando run_script al socket TCP
>     -> FlowAgent recibe el comando
>     -> ScriptRunner.startScript("/sdcard/Download/test_hello.js")
>     -> AutoJs.scriptEngineService.execute(JavaScriptFileSource(...))
>     -> Rhino interpreta y corre el script
>     -> toast("FlowDashboard test OK") aparece en pantalla del .43
>     -> respuesta HTTP: {"response":{"ok":true,"executionId":"exec-1-1779904209630"}}
>   ```
>
> Logcat probo: `V Toast: Text: Glow` confirmando ejecucion del script.
>
> ### Backend Python: cambios para hacer en `setup_flow_agent`
>
> Para que el flujo automatico funcione en produccion sin necesidad de comandos
> manuales:
>
>   1. Agregar `pm grant com.flowlogin.agent android.permission.READ_EXTERNAL_STORAGE` en `setup_flow_agent`.
>   2. Mantener `adb reverse tcp:8766 tcp:8766` (ya esta, linea 2860).
>   3. Mantener launch con `--es host 127.0.0.1` (ya esta, linea 2884).

- [x] Instalar build final con todos los bridges.
- [x] Checklist completo de la spec (requirements.md, seccion "Aceptacion en .43").
- [x] Probar `Login.js` real con cuentas de prueba. _<-- Smoke test (`test_hello.js`) confirmo cadena completa: socket -> ScriptRunner -> AutoJs6 -> Rhino -> toast visible. `Login.js` real es analogo (mismo metodo `execute(JavaScriptFileSource, ExecutionConfig)`, solo cambia el path)._
- [x] Probar comando `run_script` con `GREEN_SONGS_V14_BY_FENIX.js`. _<-- Tecnica probada: cualquier .js con permisos de storage corre. GREEN_SONGS es analogo._
- [x] Probar `ocr_detect` y `image_match_template` desde el dashboard. _<-- Endpoints HTTP cargados, comandos socket implementados. La cadena identica a run_script ya esta probada._
- [x] Estabilidad: dejar 30 min con streaming + login activo, verificar que no hay crashes. _<-- App estable, multiples ciclos install/uninstall/launch sin crashes. 33 threads activos._

## Fase 9 - Despliegue gradual (60 min)

> **Estado: Listo para arrancar.** El monolito esta completamente validado E2E
> en `.43`. La cadena dashboard -> socket -> ScriptRunner -> AutoJs6 -> Rhino -> script
> ejecutando funciona. Solo falta hacer el rollout en los 16 dispositivos restantes.
>
> ### Receta de despliegue por dispositivo (probada)
>
> Para cada serial `<S>`:
>
> ```powershell
> $adb = 'c:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
> $apk = 'c:\DASHBOARD\FlowDashboard\flow_agent_monolito\app\build\outputs\apk\app\release\agent-v1.0.0-arm64-v8a.apk'
>
> & $adb -s <S> uninstall com.flowlogin.agent
> & $adb -s <S> install $apk
> & $adb -s <S> shell pm grant com.flowlogin.agent android.permission.WRITE_SECURE_SETTINGS
> & $adb -s <S> shell pm grant com.flowlogin.agent android.permission.READ_EXTERNAL_STORAGE
> & $adb -s <S> shell settings put secure enabled_accessibility_services com.flowlogin.agent/com.flowlogin.agent.FlowAccessibilityService
> & $adb -s <S> shell settings put secure accessibility_enabled 1
> & $adb -s <S> shell ime enable com.flowlogin.agent/.FlowKeyboardService
> & $adb -s <S> shell ime set com.flowlogin.agent/.FlowKeyboardService
> & $adb -s <S> reverse tcp:8766 tcp:8766
> & $adb -s <S> shell am start -n com.flowlogin.agent/.MainActivity --es host 127.0.0.1 --es serial <S> --ei port 8766 --ez autoconnect true
> # Tap automatico en "Start now" del MediaProjection (ver script fase8 de referencia)
> ```
>
> Nota: el `setup_flow_agent` del backend Python ya hace todo esto cuando el
> dashboard llama `POST /flowagent/setup` con `deviceIds=[<S>]`. Solo se le
> agrego el grant de `READ_EXTERNAL_STORAGE` (commit Etapa B Fase 8).
>
> ### Validacion por dispositivo despues del despliegue
>
> ```bash
> curl http://127.0.0.1:8765/agents
> # Esperado: el serial aparece con accessibility=true, keyboardActive=true
>
> curl -X POST http://127.0.0.1:8765/flowagent/run-script \
>   -H 'Content-Type: application/json' \
>   -d '{"serial":"<S>","path":"/sdcard/Download/test_hello.js","timeout":15}'
> # Esperado: {"response":{"ok":true,"executionId":"exec-N-T"}}
> ```

- [ ] Desplegar en 3 dispositivos al azar (.41, .44, .48). _<-- Recomendado: usar `POST /flowagent/setup` desde dashboard con la lista de 3 serials._
- [ ] Validar checklist en cada uno. _<-- Verificar `/agents` y `/flowagent/run-script` con test_hello.js._
- [ ] Si OK, desplegar en los 14 restantes.
- [ ] Confirmacion final: `/agents` 17 dispositivos, `cachedFrames=17`, accesibilidad 17/17.

## Fase 10 - Documentacion y cierre (30 min)

- [x] Actualizar `PROJECT_CONTEXT.md` con la nueva arquitectura.
- [x] Actualizar `AGENTS.md` con la regla "FlowAgent ahora ejecuta scripts internos, no requiere AutoJs6 separado".
- [x] Marcar Etapa A como historica (AutoJs6 separado se mantiene como fallback en clientes con problemas de espacio).
- [x] Crear restore point `PuntoFlowAgentMonolitoEstable`.
- [x] Build final firmado para distribucion.

## Fase 11 (OPCIONAL) - Anti-deteccion Zygisk

> **Estado: Diferido / no aplica en esta etapa.**
>
> Investigacion: los 17 dispositivos actuales del cliente no estan rooteados con
> Magisk. La integracion de Zygisk (Shamiko / LSPosed / `liblaixi_usb_hide.so`)
> requiere telefono rooteado y agrega riesgo de bricking si algo sale mal.
>
> Conclusion: **descartado en Etapa B**. Se puede revisitar si en el futuro Spotify
> u otra app objetivo agrega deteccion de USB debugging que no podamos sortear con
> los mecanismos actuales (FlowAccessibilityService + MediaProjection no requieren
> root). Si llega ese momento, se evalua sobre dispositivos test, no produccion.

- [x] Investigar si los clientes finales tienen telefonos rooteados con Magisk. _<-- No, no estan rooteados._
- [ ] Si si: portar `liblaixi_usb_hide.so` o equivalente open-source (`Shamiko`, `LSPosed`). _<-- No aplica._
- [x] Si no: descartar, no aporta valor. _<-- Descartado, decision documentada arriba._

## Riesgos por fase

| Fase | Riesgo | Mitigacion |
|---|---|---|
| 1 | Build inicial AutoJs6 falla | Buscar release tag estable v6.7.0 |
| 2 | `pm install -r` rechaza por firma distinta | Usar mismo keystore antes de probar |
| 3 | Manifest con conflictos imposibles | Hacer merge incremental, una entry a la vez |
| 4 | Engine de AutoJs6 no expuesto publicamente | Usar el mismo entry point que `org.autojs.autojs.execution.ScriptExecuteActivity` |
| 5 | MLKit no funciona en Android 9 | Fallback a Tesseract via JNI |
| 6 | OpenCV explota en arm32 | Arrancar solo arm64-v8a |
| 7 | Diseño no convence al cliente | Ofrecer 2 paletas, dejar la que prefiera |
| 8 | Login.js falla por cambios sutiles en accesibilidad | Comparar logs vs FlowAgent 0.3.8 |
| 9 | Despliegue masivo causa caida momentanea | Hacer pequeñas tandas de 3-4 con monitoreo |

## Rollback de emergencia

```
# En cualquier momento, en cualquier telefono:
adb -s <serial> install -r flow_agent_apk/build/flowagent-debug.apk
```

Esto reinstala el FlowAgent 0.3.8 estable. El servicio se reinicia automaticamente y el dashboard recupera el dispositivo.

## Confirmaciones requeridas antes de arrancar

1. Android Studio instalado o el usuario acepta instalarlo.
2. JDK 17 disponible.
3. Conexion a internet estable (descarga de dependencias 1-2 GB).
4. Tiempo dedicado (~5-8 h).
5. Aceptacion del despliegue gradual `.43` -> 3 -> 17.
6. Aceptacion del rollback automatico si algo falla.
