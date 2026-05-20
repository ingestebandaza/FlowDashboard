# FlowDashboard Project Context

Ultima actualizacion: 2026-05-20 (1.0.46 - Drag & drop entre dispositivos, numero visual, boton reordenar)

Este archivo es la memoria viva del proyecto. Cualquier persona o IA que vaya a modificar esta carpeta debe leer primero `AGENTS.md` y despues este archivo.

Estado actual documentado: version `1.0.46` con flujo FlowRegister completo + drag & drop manual entre dispositivos con orden persistente y numerito visual.

## Resumen Ejecutivo

FlowDashboard es un dashboard local para administrar muchos telefonos Android conectados por ADB WiFi/USB, repartir cuentas por dispositivo/clon, ejecutar FlowLogin, ver estados por cuenta y usar FlowAgent APK por socket como motor rapido.

Arquitectura actual: `socket-first hybrid`.

- ADB se usa para detectar telefonos, resolver identidades, instalar/abrir FlowAgent, crear `adb reverse`, abrir ajustes y recuperar dispositivos.
- FlowAgent APK se usa como motor de UI por socket cuando esta conectado y con Accesibilidad activa.
- FlowLogin no debe caer silenciosamente a ADB como motor de login. Si FlowAgent no esta listo, se omite el telefono o se avisa.
- El estado actual `1.0.45` incorpora la seccion visual `Crear Cuentas` totalmente funcional y aislada, conectada a un motor nativo en Python (`FlowRegister`) con todos los pasos del registro de Spotify automatizados y captcha resuelto via CapSolver.

## Version y Actualizacion

Version actual del proyecto:

```text
APP_VERSION = 1.0.46
```

Archivos relacionados:

- `app_meta.py`: define `APP_NAME` y `APP_VERSION`.
- `update.json`: manifest publico que el updater consulta.
- `release_packages/FlowDashboard-1.0.46.zip`: paquete de actualizacion mas reciente (generado por `CrearActualizacion.bat`).
- `dist/FlowDashboard.exe`: EXE compilado de la version `1.0.46`.

`update.json` actual debe apuntar a:

```text
version: 1.0.46
package_url: https://github.com/ingestebandaza/FlowDashboard/releases/download/v1.0.46/FlowDashboard-1.0.46.zip
sha256: <calculado por CrearActualizacion.bat al empaquetar>
```

Para crear una actualizacion nueva se usa:

```powershell
CrearActualizacion.bat
```

Ese `.bat` compila `launcher.py` con PyInstaller, crea el ZIP en `release_packages/`, calcula SHA256 y actualiza `update.json`.

Importante: si se quiere que clientes que ya tienen una version mayor vuelvan a un estado viejo, el updater normal puede no instalar una version menor. En ese caso se debe publicar una version nueva mayor con contenido rollback, por ejemplo `2.0.1` con contenido de `1.0.42`.

## Archivos Principales

- `wsapi_demo.html`: dashboard principal. Contiene UI, CSS y la mayor parte de la logica frontend.
- `wsapi.js`: cliente HTTP para hablar con `local_adb_server.py` en `http://127.0.0.1:8765`.
- `local_adb_server.py`: servidor local HTTP/ADB y servidor socket FlowAgent.
- `abrir_dashboard.bat`: lanzador para desarrollo/uso local en Windows. Inicia servidor si hace falta y abre `wsapi_demo.html`.
- `launcher.py`: entrada para EXE. Arranca servidor local, sirve dashboard estatico y revisa actualizaciones.
- `launcher.spec`: configuracion PyInstaller.
- `Login.js`: runner AutoJS legacy/alternativo. En el flujo actual, `local_adb_server.py` intercepta `Login.js` y usa runner FlowAgent socket.
- `device_names.json`: persistencia local de nombres, perfiles/cuentas y estados por identidad estable del telefono. Puede contener datos sensibles.
- `device_groups.json`: categorias visuales de dispositivos y asignaciones. Puede no existir hasta que el usuario cree categorias.
- `.flowlogin_payloads/`: payloads locales para FlowLogin. Puede contener datos sensibles.
- `flow_agent_apk/`: proyecto Android de FlowAgent.
- `flow_agent_apk/build/flowagent-debug.apk`: APK incluida/instalada por el dashboard.
- `license_admin.html`: panel admin local privado para licencias en Supabase.
- `supabase_license_rpc.sql`: SQL de validacion comercial por RPC Supabase.
- `supabase_admin_policies.sql`: politicas RLS/admin para panel de licencias.
- `update_config.json`: configuracion local ignorada por git.
- `update_config.example.json`: plantilla publica.
- `Crearexe.bat`: build manual de EXE.
- `CrearActualizacion.bat`: build de paquete ZIP versionado.

No copiar cuentas, passwords, `.supabase_config.json`, payloads ni contenido sensible de `device_names.json` en documentacion, commits o respuestas.

## Servidor Local

`local_adb_server.py` escucha:

```text
HTTP dashboard/API: 127.0.0.1:8765
Socket FlowAgent:  0.0.0.0:8766
```

Version interna actual del servidor:

```text
2026-05-12-device-public-ip-refresh
```

Features esperadas en `/health` para el estado actual:

```text
flowlogin_payload
flowlogin_status
account_statuses
flowlogin_agent_runner
flowlogin_stop
apk_agent_socket
flowagent_setup
flowlogin_fresh_retry
flowagent_auto_ensure
flowlogin_cache_retry
flowlogin_visual_cache_clear
flowlogin_retry_form_fix
flowlogin_clone_list
device_public_ip_flags
device_public_ip_refresh
static_dashboard
client_info
license_remember
adb_path_probe
adb_deep_probe
client_network_info
adb_env_path
adb_diagnostics
visual_update_check
bundled_flowagent_apk
device_categories
device_mac_identity
flowagent_auto_socket_watchdog
device_visible_ip
flowagent_socket_app_info_permissions
flowagent_accessibility_diagnostics
```

No debe aparecer `flowagent_uninstall` en este estado `1.0.42`.

Endpoints importantes:

- `GET /health`: estado del servidor, version, appVersion, features, ruta APK y existencia de APK.
- `GET /client-info`: nombre PC, usuario Windows, hash local estable, version, ruta ADB, IP local/publica, pais y MAC del PC cuando se detecta.
- `GET /adb-diagnostics`: diagnostico ADB desde el EXE/servidor.
- `GET /update-status`: estado de actualizacion en curso.
- `GET /devices`: lista dispositivos ADB, con identidad estable `deviceKey`, `legacyDeviceId`, `androidId`, IP visible, nombre, perfil y estados de cuentas.
- `GET /device-names`: carga persistencia local de perfiles.
- `GET /device-groups`: carga categorias visuales.
- `GET /agents`: lista FlowAgent conectados por socket.
- `GET /device-mac`: recupera MAC del primer dispositivo conectado cuando es posible.
- `POST /adb`: ejecuta comandos ADB.
- `POST /packages`: lista paquetes instalados.
- `POST /autojs/run`: ejecuta script. Si el script es `Login.js`, usa runner FlowAgent socket.
- `POST /autojs/stop`: detiene FlowLogin/AutoJS.
- `POST /login-status`: refresca estados locales de FlowLogin.
- `POST /flowagent/setup`: prepara FlowAgent por ADB.
- `POST /device-public-ip`: fuerza refresco de IP publica/pais del dispositivo.
- `POST /device-name`: guarda nombre persistente del telefono.
- `POST /device-person`: guarda perfil/cuentas del telefono.
- `POST /device-groups`: guarda categorias y asignaciones.
- `POST /agent/command`: envia comando JSON a FlowAgent.
- `POST /validate-license`: valida licencia contra Supabase/RPC o modo local si aplica.
- `POST /update-check`: inicia revision/descarga de actualizacion.

## ADB

El servidor intenta encontrar ADB automaticamente. Fuentes conocidas:

- `PATH`
- `FLOWDASHBOARD_ADB`
- `ANDROID_HOME`
- `ANDROID_SDK_ROOT`
- carpeta de la app/EXE
- `platform-tools` junto al EXE
- rutas comunes del SDK Android
- `%USERPROFILE%\adb.exe`
- `%USERPROFILE%\Downloads\platform-tools\adb.exe`
- `%USERPROFILE%\Desktop\platform-tools\adb.exe`
- busqueda limitada dentro de la carpeta de usuario y LocalAppData

`/client-info` y `/adb-diagnostics` existen para diagnosticar clientes donde el EXE con doble clic no hereda el mismo PATH que la terminal.

## FlowAgent APK

Paquete Android:

```text
com.flowlogin.agent
```

Version esperada por backend:

```text
0.2.4
```

Ruta APK esperada:

```text
flow_agent_apk/build/flowagent-debug.apk
```

El EXE incluye la APK empaquetada; el servidor tambien busca fallback junto al proyecto cuando corresponde.

Preparacion manual/automatica:

```text
adb reverse tcp:8766 tcp:8766
adb install -r flow_agent_apk/build/flowagent-debug.apk  # solo si falta o esta vieja en modo auto
adb shell am start -n com.flowlogin.agent/.MainActivity --es host 127.0.0.1 --es serial <serial> --ei port 8766 --ez autoconnect true
```

Botones del estado actual `1.0.42`:

- `Instalar FlowAgent`: preparacion inteligente. Usa `install: "auto"`, abre FlowAgent y puede abrir Accesibilidad si es accion manual.
- `Actualizar FlowAgent`: en `1.0.42` solo consulta `/agents` y refresca contador/estado visual. No reinstala ni abre la app.

No existe en `1.0.42` boton `Desinstalar FlowAgent`.

Diagnostico de Accesibilidad:

- `flow_agent_accessibility_state()` revisa si el servicio esta habilitado, enlazado o atascado.
- Si Android marca FlowAgent habilitado pero no enlaza el `AccessibilityService`, el dashboard/servidor indica que hay que apagar/prender FlowAgent una vez en Accesibilidad.
- Reinstalar APK no suele resolver un estado `binding/dead`; normalmente se resuelve desde ajustes de Accesibilidad del telefono.

Comandos socket soportados actualmente por FlowAgent:

- `ping`
- `status`
- `dump`
- `launchPackage`
- `openAppInfo`
- `getEditTexts`
- `clickText`
- `setText`
- `setTextIndex`
- `tap`
- `swipe`
- `home`
- `back`
- `recents`

## Dashboard UI Actual

Reglas visuales obligatorias viven en `AGENTS.md`.

Estado actual del layout:

- Panel izquierdo `Dispositivos`: solo titulo, contador, botones `Conectar` y `Actualizar`.
- La lista/grilla real de dispositivos vive en el panel derecho `Dispositivos Conectados`.
- El panel `Dispositivos Conectados` tiene herramientas superiores para seleccion, limpieza de seleccionados, deseleccion, refresco de pais/IP, cambio de vista y zoom.
- Los dispositivos se ven como cuadros seleccionables o filas segun modo.
- Cada tarjeta muestra nombre, IP local visible, estado de cuentas y badge `Socket`/`ADB`/`Actualizar`.
- Cada tarjeta conserva boton de editar nombre y boton de persona/cuentas.
- Las categorias de dispositivos pueden crearse desde el dashboard y usan `device_groups.json`.
- Debajo de la grilla estan los controles de FlowAgent y `Limpiar cuentas`.

Categorias de flujos visibles:

- `FlowLogin`
- `FlowTrack`
- `FlowCache`
- `FlowCast`
- `FlowApple`
- `Flowamazon`
- `FlowGram`
- `FlowTikTok`

Solo `FlowLogin` ejecuta actualmente. Los demas quedan como pendientes/desactivados.

Estado actual de `Cuentas`:

- Tiene pestanas con iconos y contador: `Total`, `Validos`, `No validos`.
- Cada pestana tiene su propio textarea.
- `No validos` tiene boton compacto para limpiar esa lista.
- `Delimitador` y `Dividir` estan lado a lado.
- El boton verde de dividir reparte cuentas de la pestana activa entre dispositivos seleccionados.
- `Dividir` no puede pasar de 10 cuentas por dispositivo.
- Debajo del textarea esta `Mapa de cuentas`, con filtros, conteos y boton para limpiar lo recordado.
- `Mapa de cuentas` puede contraerse/desplegarse.

Importante: en el estado actual `1.0.42`, la seccion `Cuentas` completa no tiene boton propio para contraer/desplegar. Tampoco existe la seccion `Crear Cuentas`.

## Persistencia Local

`device_names.json` guarda por identidad estable del telefono:

```json
{
  "mac:AA:BB:CC:DD:EE:FF": {
    "name": "nombre opcional",
    "person": "maximo 10 lineas de cuentas",
    "accountStatuses": []
  }
}
```

Reglas:

- Usar MAC como clave estable cuando Android la entrega.
- Usar `serial:<serial>` solo como fallback temporal.
- Si existe perfil viejo por serial/IP, `/devices` lo migra automaticamente a `mac:...` cuando detecta MAC.
- `device_groups.json` tambien migra asignaciones desde serial/IP a `deviceKey`.
- No exponer cuentas reales ni passwords de estos archivos.

Persistencia frontend:

- `flowlogin.accounts`: textareas de `Cuentas`, delimitador, dividir y pestana activa.
- `flowlogin.accountAssignments`: mapa de asignaciones/intentos.
- `flowlogin.accountTraceMemoryReset`: evita rehidratar asignaciones viejas despues de limpiar el mapa.
- `flowdashboard.deviceViewMode`: modo grilla/filas.
- Altura manual del panel de dispositivos y otros detalles visuales tambien pueden guardarse en `localStorage`.
- `flowdashboard.license`: email/licencia guardados para revalidacion automatica.

## Inventario de Cuentas

La pestana `Total` funciona como cola de cuentas nuevas/disponibles.

Reglas actuales:

- Al dividir cuentas entre dispositivos, solo se usan cuentas libres no reservadas.
- Dividir reserva cuentas en `flowlogin.accountAssignments`.
- Las cuentas asignadas permanecen visibles en `Total` hasta resultado terminal.
- Estados `success` y `already` mueven la cuenta a `Validos`.
- Estados `error` y `review` mueven la cuenta a `No validos`.
- Ediciones manuales del perfil de un telefono bloquean duplicados si esa cuenta ya esta reservada o probada en otro lugar.
- `Mapa de cuentas` muestra trazabilidad: numero de cuenta, asignacion a dispositivo/clon y estado.
- El boton de limpiar mapa borra asignaciones/intentos recordados, pero no borra los textareas `Total`, `Validos` ni `No validos`.

## FlowLogin

Flujo activo:

1. El usuario pega cuentas en `Cuentas`.
2. El usuario selecciona dispositivos y reparte cuentas.
3. Las cuentas se guardan en `device_names.json` por `deviceKey`.
4. Al ejecutar FlowLogin, el dashboard selecciona `Login.js`.
5. `wsapi.js` llama `/autojs/run`.
6. Si el script es `Login.js`, `local_adb_server.py` usa `start_flowlogin_agent_jobs`.
7. El motor de login usa solo FlowAgent por socket para lanzar clones, leer UI, escribir email/password y reportar estados.
8. El dashboard hace polling con `/login-status` y pinta bolitas por clon/cuenta.

Asignacion clon/cuenta:

```text
cuenta 1 -> clon 1 -> com.spotify.musid
cuenta 2 -> clon 2 -> com.spotify.musie
...
cuenta 10 -> clon 10
```

El backend recalcula paquete desde el numero de clon antes de lanzar, limpiar o reintentar.

Estados de cuenta:

```text
pending
running
retrying
success
already
error
review
notice14
replaced
```

Reglas de seguridad:

- No marcar `success` sin confirmacion estable.
- No intentar saltar captchas, 2FA ni verificaciones del servicio.
- Captcha/verificacion debe terminar en `review` o `error`, no en exito falso.
- En seleccion multiple, un telefono sin FlowAgent listo no debe bloquear a los demas.
- El Play del menu contextual ejecuta solo cuentas `pending` (bolitas grises).
- Cuentas finales como `success`, `already`, `error`, `review` no se vuelven a probar con Play normal.

Reintentos:

- Fallos no protegidos pueden pasar a `retrying`.
- El flujo conservador puede abrir App info por socket, entrar a Storage/Permisos, limpiar datos/cache visualmente y restaurar permisos antes del segundo intento.
- `notice14` representa aviso de Spotify de 14 dias en el extranjero.

## FlowRegister (Crear Cuentas)

Flujo nativo por socket dedicado a creacion de cuentas en Spotify, separado de FlowLogin.

### Arquitectura

- Endpoint: el dashboard lanza `Register.js` via `/autojs/run`. `local_adb_server.py` intercepta el nombre y reusa `start_flowlogin_agent_jobs(..., is_register=True, register_lines=...)`.
- Motor: `perform_flowregister_agent(serial, item, account, stop_event)` en `local_adb_server.py`.
- Cuerpo real: `_perform_flowregister_body(...)` que recibe `agent`, `serial`, etc. y usa una funcion helper `ga()` que devuelve siempre el agente mas reciente (`agent_for_serial(serial)` ordenado por `last_seen` desc).
- Progreso: `FLOWREGISTER_PROGRESS[serial] = {"text", "progress"}` se publica en `/login-status` como `progress`.
- Resultados: `FLOWREGISTER_RESULTS[serial][line] = status`. Se publican en `/login-status` como `registerResults`. NO se mezclan con `accountStatuses` de FlowLogin.
- Cancelacion: `stop_event` por serial. Los waits largos respetan cancelacion en bloques cortos (<= 2.5s).
- UI: panel izquierdo, pestana `Crear Cuentas`, tarjeta `.device-card.is-creating` muestra barra de progreso violeta durante la creacion.

### Origen de las cuentas (importante)

- Las cuentas vienen del textarea `Total` de la seccion `Crear Cuentas` (no de la seccion `Cuentas` de FlowLogin).
- El frontend construye `plannedChunks = { serial: [lines...] }` en orden, y reparte segun `Cant. a crear por equipo`.
- `prepare_flowlogin_payload` con `is_register=True` NO toca `profile["person"]` ni `profile["accountStatuses"]` para no contaminar FlowLogin. El payload se construye SOLO desde `register_lines`.
- `start_flowlogin_agent_jobs` normaliza las claves de `register_lines` para que siempre coincidan con el serial ADB real (mapea desde `deviceKey`/`legacyDeviceId`/`deviceId` al serial real).
- El frontend NO borra el textarea `Total` al iniciar el proceso. Las cuentas se mueven a `Validos` o `No validos` automaticamente segun el resultado en `registerResults`.
- El delimitador del textarea `Cuentas` (FlowLogin) se reusa para parsear las lineas de Crear Cuentas (`getAccountDelimiter()`).
- Asignacion clon-cuenta: linea 0 -> clon 1 (`com.spotify.musid`), linea 1 -> clon 2 (`com.spotify.musie`), etc.

### Pasos del flujo

1. **Cerrar clon** (`am force-stop` por ADB).
2. **Limpieza visual** del clon via `clear_clone_cache_data_visual` (FlowAgent abre App Info, Storage, Clear Cache + Clear Data + dialogo de confirmacion, restaura permiso Storage, vuelve a Home). Si falla, fallback a `pm clear` por ADB.
3. **Abrir Spotify** (`agent_launch_package_and_wait` con timeout de 25s).
4. **Esperar pantalla inicial** y tocar `Sign up free`/`Registrarte`.
5. Tocar `Continue with email` si aparece.
6. **Pantalla de email**: esperar marker, escribir email, tocar `Next`. Verificar que avanzo (no sigue en pantalla de email).
7. **Pantalla de password**: esperar marker, escribir password, tocar `Next`.
8. **Pantalla de fecha de nacimiento**:
   - Random mayor de edad: año entre `1975` y `2026 - 18`, dia 1-28, mes aleatorio.
   - Picker de Spotify: 3 columnas con `EditText` en el medio (seleccionado) y `Button` arriba/abajo.
   - **Geometria observada (1080x1794)**: mes cx≈320, dia cx≈530, año cx≈740. EditText centrado en y≈866. Swipe de 230px mueve exactamente 1 item.
   - **Direccion confirmada por prueba**: swipe ARRIBA (start_y > end_y) AUMENTA el valor; swipe ABAJO DISMINUYE el valor.
   - **Importante**: Spotify muestra dias < 10 con cero a la izquierda (`01`, `02`, ..., `09`). `day_list` debe usar el formato `"01"` para esos dias y `target_day_str` se formatea igual antes de buscarlo en la lista. Sin esto, el bot oscila infinitamente entre `09` y `10`.
   - El centro X de cada columna se lee dinamicamente del dump (EditText ordenados por X), con fallback a `[320, 530, 740]`.
   - Tras ajustar las 3 columnas, esperar 1.2s para que el picker termine la animacion antes de tocar `Next`.
9. **Pantalla de genero**: random entre `Female` y `Male` solamente. El clic avanza automaticamente sin Next.
10. **Pantalla de nombre**: nombre completo random segun genero (listas `_MALE_FIRST`/`_FEMALE_FIRST` + `_LAST_NAMES` con nombres reales latinoamericanos). `agent_set_text_index(0, ...)` reemplaza el nombre pre-llenado por Spotify.
11. **Boton `Create account`**: hay dos elementos con ese texto (el titulo `TextView` y el boton real `Button`). Se busca el `Button` clickeable por scoring (Button=2, clickable=1, otro=0). Scroll suave hacia abajo antes para asegurar visibilidad. Si el primer tap no avanza, segundo intento.
12. **Captcha de Spotify**: se detecta porque el paquete activo cambia a `com.sec.android.app.sbrowser` o `chrome`. Llama a `solve_recaptcha_capsolver` con sitekey `6LeO36obAAAAALSBZrY6RYM1hcAY7RLvpDDcJLy3` y URL `https://challenge.spotify.com`. Tras obtener token, tap en checkbox (x=200, y=690) y boton Continue (x=515, y=1005). Si el captcha muestra challenge de imagenes, marca `review` para completar manualmente.

### Captcha y CapSolver

- `CAPSOLVER_API_KEY` se lee de `.supabase_config.json` (no hardcodeado en codigo, no commitear con valor real).
- Funcion `solve_recaptcha_capsolver(website_url, website_key, max_wait=120)` hace `createTask` + polling `getTaskResult` cada 4s.
- Sitekey actual de Spotify: `6LeO36obAAAAALSBZrY6RYM1hcAY7RLvpDDcJLy3` (extraido del JSON `__NEXT_DATA__` de `https://challenge.spotify.com/c/.../recaptcha`).
- Si CapSolver falla o no hay API key, fallback a tap directo en checkbox (puede no ser suficiente sin token valido).
- Coordenadas del captcha confirmadas en pantalla 1080x1794: checkbox `[200, 690]`, boton Continue `[515, 1005]`.

### Reglas y restricciones

- Cada paso espera un **marker real** de la pantalla siguiente antes de tocar nada. NO usar `time.sleep` ciego.
- Antes de tipear password, verificar que la pantalla del email ya no esta visible.
- Buscar `Next/Siguiente` primero como match exacto; `contains` solo como fallback.
- Si un marker no aparece en su timeout, devolver `review` con mensaje claro.
- NO intentar saltar challenge de imagenes del captcha. Eso va a `review`.
- El reverse `adb reverse tcp:8766` se mantiene activo durante todo el registro (no es necesario quitarlo; Spotify solo detecta proxy si hay VPN real o WiFi proxy configurado en el sistema).
- Error visible en pantalla tipo "Your account wasn't created. Looks like your device is connected to a proxy or VPN service" -> revisar VPN del sistema operativo y configuracion proxy de la red WiFi del telefono.

### Endpoint de diagnostico

- `POST /debug/dump` con `{"serial": "..."}` devuelve los nodos visibles en pantalla con texto, clase, bounds, clickable, editable y centro. Usado para inspeccionar pantallas con `FLAG_SECURE` activo (donde Appium Inspector no funciona).

### Frontend (Crear Cuentas)

- Pestanas `Total` / `Validos` / `No validos` con icono y contador, cada una con su textarea propio.
- Estado `flowdashboard.createAccountsCollapsed` y `flowdashboard.accountsCollapsed` en `localStorage` para colapsar/desplegar las dos secciones al hacer clic en su header.
- Boton play violeta-rosa `js-start-creation-btn` en la seccion. Al tocarlo, lee del textarea `Total`, valida cantidad minima (`deviceIds.length * count`), construye `plannedChunks` y envia a `/autojs/run` con `filePath: 'Register.js'`.
- Las cuentas se mueven automaticamente entre pestanas via `moveCreateAccountLineToResultTab` cuando `registerResults` reporta status terminal: `success`/`already` -> `valid`, `error`/`review`/`notice14` -> `invalid`.
- `loginStatusesAreTerminal` ignora dispositivos en `state.creatingDevices` para que el polling no termine prematuramente. Solo terminan cuando `registerResults` llega o el timeout de 240s sin progreso.

## Licencias

Estado actual:

- Identificador principal: email (`device_email`).
- El dashboard puede detectar MAC automaticamente del dispositivo/PC y enviarla como dato adicional.
- Validacion comercial recomendada: Supabase anon key + RPC `validate_flowdashboard_license`.
- No incluir `service_role` en HTML, EXE distribuido ni archivos de cliente.

Flujo:

1. Usuario ingresa email y licencia.
2. Dashboard llama `/client-info`.
3. Dashboard intenta obtener MAC cuando hay dispositivo conectado.
4. Dashboard llama `POST /validate-license`.
5. Backend llama RPC o modo local segun configuracion.
6. Si queda aprobado, guarda licencia en `localStorage`, cierra modal, carga dispositivos y revisa actualizaciones.

Archivos:

- `license_admin.html`: panel admin local.
- `supabase_license_rpc.sql`: RPC para validacion comercial sin Edge Function.
- `supabase_admin_policies.sql`: politicas/admin para gestion.
- `.supabase_config.json`: configuracion local sensible. No documentar contenido ni subir claves privadas.

## Actualizador

`launcher.py` revisa actualizaciones y sirve archivos estaticos cuando se ejecuta como EXE.

Recursos estaticos servidos:

- `/wsapi_demo.html`
- `/wsapi.js`
- `/logo.png`

Endpoints:

- `POST /update-check`: inicia revision/descarga.
- `GET /update-status`: consulta estado.

`updater.py` usa `update_config.json` si existe y fallback interno al manifest publico de GitHub.

El dashboard muestra modal visual de actualizacion despues de aprobar licencia.

## Reglas para Futuras Modificaciones

- Leer siempre `AGENTS.md` y este archivo antes de tocar.
- No hacer cambios visuales grandes sin revisar desktop/mobile.
- Si se modifica comportamiento, UI, backend, version o updater, actualizar este archivo en la misma tarea.
- Mantener `wsapi_demo.html` compacto y respetando reglas visuales.
- No agregar emojis nuevos al HTML.
- No volver a depender de Laixi como backend principal.
- No usar ADB como motor de login cuando el flujo es FlowLogin; ADB solo prepara infraestructura.
- No copiar secretos ni cuentas reales en documentacion.
- No borrar ni resetear cambios del usuario sin permiso explicito.

## Comandos de Validacion

Backend:

```powershell
python -m py_compile local_adb_server.py
```

Cliente JS:

```powershell
node --check wsapi.js
```

Script inline de `wsapi_demo.html`:

```powershell
$html=Get-Content -Raw wsapi_demo.html; $script=[regex]::Matches($html,'(?s)<script>(.*?)</script>') | Select-Object -Last 1; $script.Groups[1].Value | node --check
```

APK FlowAgent:

```powershell
cd flow_agent_apk
powershell -NoProfile -ExecutionPolicy Bypass -File .\build_apk.ps1
```

Servidor:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8765/health -TimeoutSec 5 | ConvertTo-Json -Depth 5
```

## Changelog reciente

### 1.0.46 (2026-05-20)

- **Drag & drop entre dispositivos**: arrastrar tarjetas para reordenar dentro de la misma categoria o entre categorias. Indicador visual (linea azul-verde) muestra si el drop sera antes o despues del target.
- **Orden persistente**: nuevo campo `order` en `device_groups.json`, lista de deviceIds en orden manual. Persiste al desconectar/reconectar.
- **Numerito visual**: cada tarjeta muestra su posicion global (1, 2, 3, ...) arriba a la izquierda, calculada desde el orden actual de las secciones.
- **Boton Reordenar** (`js-device-reorder-btn`) en el toolbar `Vista`: renumera respetando primero categorias y luego el orden actual de cada seccion. Util cuando los numeros quedan dispersos entre categorias.
- Backend: `normalize_device_groups` y `load_device_groups` ahora incluyen `order: []`.
- Frontend: `applyManualOrder`, `reorderDevices`, `resetDeviceOrder` en `wsapi_demo.html`. `buildDeviceCategorySections` aplica el orden manual antes de filtrar por categoria.

### 1.0.45 (2026-05-19)

- **FlowRegister flujo completo de Spotify**: limpieza visual del clon (cache + datos + permiso Storage), apertura, Sign up, email, password, fecha de nacimiento aleatoria mayor de edad, genero (Female/Male), nombre real random segun genero, Create account.
- **Picker de fecha** corregido: dias < 10 con cero a la izquierda (`01`-`09`) para evitar loop infinito que oscilaba entre `09` y `10`.
- **Captcha resuelto via CapSolver**: integracion API REST con createTask + polling, sitekey de Spotify Android `6LeO36obAAAAALSBZrY6RYM1hcAY7RLvpDDcJLy3`. Tap en checkbox y Continue tras obtener token. Si aparece challenge de imagenes -> review.
- **CAPSOLVER_API_KEY** se carga desde `.supabase_config.json`, no hardcodeado.
- **Nombres reales** generados desde listas estaticas (50 masculinos + 50 femeninos + 50 apellidos hispanos). Funcion `generate_register_name(gender)`.
- **Endpoint `/debug/dump`** (POST con `{serial}`) para inspeccionar pantallas con `FLAG_SECURE` desde terminal sin Appium.
- **Bug critico corregido**: `agent_for_serial` devuelve la conexion mas reciente por `last_seen` desc, no la primera que itera. Antes podia devolver una conexion zombi muerta.
- **`prepare_flowlogin_payload` con `is_register=True` no toca el perfil del telefono**. Las cuentas de Crear Cuentas son efimeras y no contaminan FlowLogin.
- **Normalizacion de claves de `register_lines`**: el frontend puede mandar `deviceKey`/`legacyDeviceId` y Python las convierte al serial ADB real.
- **Frontend**: paneles `Cuentas` y `Crear Cuentas` colapsables al hacer clic en el header (estado en `localStorage`). El textarea `Total` ya no se borra al iniciar.
- **`loginStatusesAreTerminal`** ignora dispositivos en `creatingDevices` para que el polling no termine prematuramente.
- **`execute_autojs`**: dedup de la firma duplicada que rompia el compile y causaba `unexpected keyword argument 'register_lines'`.

### 1.0.44 (estado anterior)

- Logica nativa por socket para Crear Cuentas (FlowRegister) inicial: pasos basicos sin limpieza visual ni captcha.

## Estado Actual

Version activa: `1.0.46`. El flujo completo de FlowRegister esta operativo y probado en Samsung SM-G955U con Spotify. La unica parte que requiere intervencion humana es el challenge de imagenes de reCAPTCHA cuando aparece (raro segun la sesion); en esos casos la cuenta queda en `review` para completarla manualmente.

Para publicar una nueva version, ejecutar `CrearActualizacion.bat` que:
1. Compila `launcher.py` con PyInstaller.
2. Empaqueta `FlowDashboard.exe`, `wsapi_demo.html`, `wsapi.js`, `Login.js`, `Register.js`, `logo.png`, `.supabase_config.json` y `update_config.json` en un ZIP versionado.
3. Calcula SHA256 y actualiza `update.json`.
4. Imprime la URL de GitHub Release esperada (tag `v<version>`).
