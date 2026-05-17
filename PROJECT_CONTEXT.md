# FlowLogin Project Context

Ultima actualizacion: 2026-05-17

Este archivo es la memoria viva del proyecto. Cualquier agente de IA debe leerlo antes de modificar el programa y debe actualizarlo al terminar cambios relevantes.

## Objetivo

Dashboard local para administrar muchos telefonos Android conectados por ADB WiFi/USB, repartir cuentas por dispositivo/clon, ejecutar FlowLogin, ver estados por cuenta y avanzar hacia automatizacion mas fluida usando FlowAgent APK por socket.

El objetivo de arquitectura actual es `socket-first hybrid`:

- ADB queda para detectar dispositivos, instalar APK, crear `adb reverse`, abrir apps, recuperar telefonos y fallback.
- FlowAgent APK queda como motor rapido por socket cuando esta conectado.
- El dashboard debe ocultar configuraciones tecnicas siempre que sea posible.

## Archivos Principales

- `wsapi_demo.html`: dashboard principal. Contiene UI, estilos y logica de dispositivos, cuentas, categorias, grilla, FlowLogin y FlowAgent.
- `wsapi.js`: cliente HTTP usado por el dashboard para hablar con `local_adb_server.py` en `http://127.0.0.1:8765`.
- `local_adb_server.py`: servidor local HTTP/ADB. Expone endpoints para dispositivos, comandos ADB, FlowLogin, nombres/cuentas persistentes, FlowAgent y socket APK.
- `abrir_dashboard.bat`: lanzador Windows. Debe usarse para abrir el dashboard; reinicia servidor viejo si faltan features requeridas.
- `Login.js`: runner AutoJS alternativo/legacy. Lee `/sdcard/Download/flowlogin_accounts.json` y escribe `/sdcard/Download/flowlogin_status.json`.
- `device_names.json`: persistencia por identidad estable del telefono. Desde 2026-05-16 usa MAC cuando Android la expone (`mac:AA:BB:...`) y solo cae a `serial:<serial>` si no se puede detectar MAC. Guarda nombre, cuentas asignadas al telefono y `accountStatuses`. Puede contener datos sensibles.
- `.flowlogin_payloads/`: payloads locales generados para FlowLogin. Puede contener datos sensibles.
- `flow_agent_apk/`: proyecto Android del APK FlowAgent.
- `flow_agent_apk/build/flowagent-debug.apk`: APK compilada actual que instala el dashboard.
- `license_admin.html`: panel local privado para administrar licencias, dispositivos aprobados/bloqueados e intentos de acceso desde Supabase.
- `supabase_admin_policies.sql`: SQL de politicas RLS y tabla `app_admins` para permitir CRUD administrativo solo a emails autorizados en Supabase Auth.
- `app_meta.py`: version comercial visible para launcher/updater (`APP_VERSION`).
- `launcher.py`: entrada empaquetable. Arranca el servidor local dentro del mismo proceso, abre `wsapi_demo.html` y comprueba actualizaciones si existe `update_config.json`.
- `updater.py`: base de actualizacion automatica por manifest JSON remoto y paquete ZIP.
- `update_config.example.json`: plantilla local para configurar URL del manifest de actualizaciones sin subir configuracion privada.
- `supabase_license_rpc.sql`: SQL para validacion comercial gratis sin Edge Function. Crea RPC `validate_flowdashboard_license` con `SECURITY DEFINER`, ejecutable con anon key.
- `Crearexe.bat`: lanzador de build para crear `dist/FlowDashboard.exe` sin comandos manuales. Cierra el EXE abierto, instala PyInstaller si falta, compila con `launcher.spec` y copia configuraciones locales necesarias a `dist`.
- `CrearActualizacion.bat`: crea un paquete ZIP versionado para GitHub Releases, calcula SHA256 y actualiza `update.json`.
- `update.json`: manifest publico de actualizaciones. Debe estar publicado en GitHub y apuntar al ZIP subido en Releases.
- `update_config.json`: configuracion local ignorada por git; en la build de cliente apunta a `https://raw.githubusercontent.com/ingestebandaza/FlowDashboard/main/update.json`.

## Servidor Local

`local_adb_server.py` escucha:

- HTTP dashboard: `127.0.0.1:8765`
- Socket FlowAgent: `0.0.0.0:8766`

Version actual esperada:

```text
2026-05-12-device-public-ip-refresh
```

Features actuales esperadas en `/health`:

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
device_mac_identity
flowagent_auto_socket_watchdog
device_visible_ip
flowagent_socket_app_info_permissions
flowagent_accessibility_diagnostics
```

Endpoints importantes:

- `GET /health`: version, features y ruta ADB.
  - Incluye `appVersion` desde `app_meta.py`.
- `GET /devices`: lista dispositivos ADB, ahora incluye `androidId` cuando se puede leer.
  - Desde 2026-05-16 incluye `deviceKey` como identidad estable para UI/persistencia: MAC si esta disponible y fallback por serial si no.
- `GET /agents`: lista FlowAgent APKs conectadas por socket.
- `POST /adb`: ejecuta comandos ADB.
- `POST /packages`: lista paquetes instalados.
- `POST /autojs/run`: ejecuta script; si el script es `Login.js`, usa runner FlowAgent socket.
- `POST /autojs/stop`: detiene FlowLogin/AutoJS.
- `POST /login-status`: refresca estados locales del runner FlowAgent.
- `POST /device-name`: guarda nombre persistente del telefono.
- `POST /device-person`: guarda cuentas/perfil persistente del telefono.
- `POST /device-public-ip`: fuerza reintento de IP publica/pais de un dispositivo y devuelve `/devices` actualizado.
- `POST /agent/command`: envia comando JSON a FlowAgent conectado.
- `POST /flowagent/setup`: prepara FlowAgent automatico por ADB.

## FlowAgent Automatico

Implementado el 2026-05-11. Mejorado el 2026-05-12 para preparacion automatica sin reinstalar siempre.

El boton visual del dashboard se llama `Instalar FlowAgent`, pero desde 2026-05-17 actua como preparacion inteligente: usa `install: "auto"` para no reinstalar si el APK ya esta en la version esperada, abre FlowAgent y puede abrir Accesibilidad cuando es una accion manual.

Cuando se pulsa el boton manual, el servidor puede instalar/actualizar y abrir FlowAgent. Antes de ejecutar FlowLogin, el dashboard usa modo automatico:

```text
adb reverse tcp:8766 tcp:8766
adb install -r flow_agent_apk/build/flowagent-debug.apk  # solo si falta o esta vieja en modo automatico
adb shell am start -n com.flowlogin.agent/.MainActivity --es host 127.0.0.1 --ei port 8766 --ez autoconnect true
```

Resultado esperado:

- Si el telefono no tiene APK, se instala.
- Si ya la tiene, se actualiza.
- En modo automatico, si ya tiene la version esperada, no se reinstala.
- La APK se abre con `host=127.0.0.1` y `port=8766`.
- Si Accesibilidad ya esta activa, reinicia el socket y conecta solo.
- Si Accesibilidad no esta activa, el usuario solo debe activar el servicio FlowAgent en Android.
- Si Android reporta FlowAgent habilitado pero lo deja en `binding/dead` y no aparece en `bound services`, el servidor lo informa como permiso atascado. La reparacion segura es apagar y prender FlowAgent una vez en Accesibilidad; reinstalar el APK no suele resolver ese estado.

Importante:

- En telefonos por WiFi, `127.0.0.1` funciona porque el dashboard crea `adb reverse`.
- No hace falta poner IP del PC manualmente si el dispositivo ya esta conectado por ADB.
- `Actualizar FlowAgent` en el dashboard no instala nada; solo consulta `/agents` y refresca contador/estado visual.
- FlowLogin intenta preparar FlowAgent automaticamente antes de ejecutar, creando `adb reverse`, abriendo la APK con `autoconnect` y reinstalando solo si falta o esta vieja.

## FlowAgent APK

Paquete Android:

```text
com.flowlogin.agent
```

Version actual:

```text
0.2.4
```

Cambios clave:

- `MainActivity` acepta extras por intent: `host`, `port`, `autoconnect`.
- El dashboard puede forzar `127.0.0.1:8766` aunque antes se hubiera guardado otra IP.
- Si `autoconnect=true` y el servicio de accesibilidad esta activo, reinicia el socket automaticamente.
- Si Android muestra el permiso habilitado pero no enlaza el `AccessibilityService`, la pantalla del APK marca Accesibilidad como `Sin enlazar` para distinguirlo de un permiso realmente pendiente.
- La interfaz visual del APK usa tarjetas oscuras, chips de estado, acciones compactas y un icono launcher propio.
- `MainActivity` tambien acepta extra `serial` desde el dashboard y lo guarda para que el socket pueda vincularse con el dispositivo ADB correcto.

Comandos soportados actualmente por `/agent/command`:

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

## Dashboard UI

Reglas visuales principales viven en `AGENTS.md`. No romperlas.

Estado actual:

- Panel izquierdo `Dispositivos` conserva solo titulo, contador y botones compactos.
- Grilla real de dispositivos vive dentro del panel `Dispositivos Conectados`.
- Grilla usa cuadros seleccionables con zoom.
- Cada tarjeta tiene botones de editar nombre y editar cuentas.
- Cada tarjeta muestra columna derecha de puntos por cuenta/clon.
- Cada tarjeta muestra `Socket` si el `androidId` del dispositivo coincide con un `agentId` conectado en `/agents`; si no, muestra `ADB`.
- Cada tarjeta puede mostrar una mini bandera junto al nombre cuando el servidor logra detectar IP publica y pais desde el propio dispositivo.
- Debajo de la grilla hay controles compactos:
  - `Agent N`
  - `Instalar FlowAgent`
  - `Actualizar FlowAgent`
  - `Limpiar cuentas`

## FlowLogin

Flujo activo actual:

1. Dashboard reparte cuentas entre telefonos y las guarda en `device_names.json`.
2. Al ejecutar FlowLogin, se selecciona `Login.js`.
3. `wsapi.js` llama `/autojs/run`.
4. Si el script se llama `Login.js`, `local_adb_server.py` usa `start_flowlogin_agent_jobs`.
5. FlowLogin usa solo FlowAgent por socket para lanzar clones, leer UI, escribir email/password y actualizar `accountStatuses`.
6. Primera pasada: prueba cada cuenta asignada una vez.
7. Si una cuenta falla y no es bloqueo/captcha/verificacion, queda en `retrying`, se abre App info del paquete del clon, se intenta limpiar cache/datos visualmente y se hace un segundo intento al final de la pasada.
   El segundo intento espera el formulario fresco despues de limpiar datos y reconoce variantes como Log in/Iniciar sesion, Continue with email/Continuar con correo y Log in with a password/Iniciar sesion con contrasena.
8. Despues del segundo intento, si vuelve a fallar, queda como `error`/`review` y se clasifica como no valida.
9. Si un telefono objetivo no tiene FlowAgent conectado, FlowLogin intenta prepararlo automaticamente; si no queda listo, se reporta que FlowAgent es requerido.
10. El dashboard hace polling con `/login-status` y pinta las bolitas desde estados locales.
11. En seleccion multiple, un dispositivo sin FlowAgent listo no debe bloquear a los demas: se omite ese telefono y FlowLogin se envia a los que si quedaron listos.
12. Cada dispositivo puede iniciar/detener FlowLogin de forma independiente desde el menu contextual de la tarjeta, sin interrumpir otros telefonos en ejecucion.
13. El menu contextual tambien permite reintentar o reemplazar todas las cuentas no protegidas de un dispositivo en una sola corrida, y anadir cuentas libres hasta completar 10 sin borrar cuentas funcionando.

ADB sigue permitido para preparar infraestructura: listar dispositivos, instalar APK, crear `adb reverse` y abrir FlowAgent. No debe usarse como motor de login.

Estados de cuenta:

```text
pending
running
retrying
success
already
error
review
replaced
```

Regla de seguridad del flujo:

- No marcar `success` sin confirmacion estable.
- No intentar saltar captchas, 2FA ni verificaciones del servicio.
- Captcha/verificacion debe terminar en `review` o `error`, no en exito falso.

## Persistencia

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

Compatibilidad:

- Si existe un perfil viejo guardado por serial/IP, `/devices` lo migra automaticamente a `mac:...` cuando detecta la MAC del dispositivo.
- Si Android no entrega MAC, se usa temporalmente `serial:<serial>` para no bloquear la operacion.
- Las categorias de `device_groups.json` y las asignaciones locales del dashboard tambien migran de serial/IP a `deviceKey` cuando el dispositivo vuelve a aparecer.

No copiar cuentas reales ni passwords en documentacion o logs largos.

Los textareas de `Cuentas`, `Delimitador` y `Dividir` persisten en `localStorage`.

Inventario de cuentas del dashboard:

- `Total` funciona como cola de cuentas nuevas/disponibles.
- Al dividir cuentas entre dispositivos, el dashboard solo usa cuentas libres no reservadas por otro dispositivo/clon.
- Dividir reserva las cuentas en `flowlogin.accountAssignments`, pero no las quita de `Total` todavia.
- Cuando `Login.js`/FlowLogin empieza a probar una cuenta, la linea se quita de `Total`.
- Estados `success` y `already` mueven la cuenta a `Validos`.
- Estados `error` y `review` mueven la cuenta a `No validos`.
- Ediciones manuales del perfil de un dispositivo bloquean cuentas que ya esten reservadas o probadas en otro lugar.
- El `Mapa de cuentas` bajo el textarea muestra trazabilidad compacta con filtros de todas/asignadas/disponibles, conteos y numeracion por referencia real de la lista; las usadas/asignadas se resaltan con color.
- La pestana `No validos` tiene un boton compacto en la fila del titulo para borrar ese textarea y guardar inmediatamente el cambio persistente.

## Comandos de Validacion

Antes de cerrar cambios de backend/frontend:

```powershell
python -m py_compile local_adb_server.py
node --check wsapi.js
```

Para revisar el script inline de `wsapi_demo.html`:

```powershell
$html=Get-Content -Raw wsapi_demo.html; $script=[regex]::Matches($html,'(?s)<script>(.*?)</script>') | Select-Object -Last 1; $script.Groups[1].Value | node --check
```

Para compilar la APK:

```powershell
cd flow_agent_apk
powershell -NoProfile -ExecutionPolicy Bypass -File .\build_apk.ps1
```

Para comprobar servidor:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8765/health -TimeoutSec 5 | ConvertTo-Json -Depth 5
```

## Registro de Cambios

### 2026-05-12

- Se agrego control de inventario de cuentas en `wsapi_demo.html`.
- El boton de dividir ya no reutiliza las primeras cuentas de `Total`; ahora toma solo cuentas libres no asignadas a otros dispositivos.
- Las cuentas asignadas quedan reservadas para evitar duplicados, pero permanecen en `Total` hasta que se ejecute FlowLogin/Login.js.
- Al ejecutar FlowLogin/Login.js, las cuentas intentadas salen de `Total`.
- Los resultados terminales se clasifican automaticamente: `success`/`already` a `Validos`, `error`/`review` a `No validos`.
- La edicion manual de cuentas por dispositivo bloquea una linea si ya esta reservada o probada en otro dispositivo.
- Se agrego la propiedad CSS estandar `line-clamp` junto a `-webkit-line-clamp` en el ID de dispositivo para compatibilidad y evitar advertencias del linter.
- Reintentar o reemplazar una cuenta de un clon usa un intento fresco: el servidor marca `freshStart`, manda el clon a inicio y hace `am force-stop` del paquete antes de relanzarlo con FlowAgent.
- El boton de reemplazar cuenta ahora toma la siguiente cuenta libre de `Total`, no de la pestana activa.
- `abrir_dashboard.bat` ahora exige feature `flowlogin_fresh_retry` para reiniciar servidores viejos automaticamente.
- Doble clic sobre una tarjeta de dispositivo abre el mismo popover visual de cuentas/perfil que el boton de persona.
- El popover de cuentas guarda el serial del dispositivo en el dialogo como respaldo, muestra mensajes internos de guardado/error y sus botones detienen propagacion para evitar cierres o clics perdidos.
- Guardar el popover de cuentas ya no bloquea una linea por estar en historial si esa misma linea sigue en el mismo dispositivo y clon; el bloqueo queda para duplicados en otro dispositivo/clon o cuentas probadas fuera de ese lugar.
- Se agrego `flowagent_auto_ensure`: antes de ejecutar FlowLogin, reintentar o reemplazar cuenta, el dashboard intenta dejar listo FlowAgent sin reinstalar cuando ya esta actualizado.
- `/flowagent/setup` acepta modo `install: "auto"` para instalar solo si el APK falta o su version es menor que la esperada.

### 2026-05-14

- Validacion de licencias cambiada de MAC a email: el dashboard ahora usa email como identificador principal, con deteccion automatica de MAC desde dispositivos Android
- `local_adb_server.py` modificado para:
  - `validate_device_license()` acepta `device_email` en lugar de `device_mac`
  - `get_device_mac_address()` obtiene MAC automaticamente desde dispositivo Android usando ADB
  - Endpoint `/device-mac` para recuperar MAC de dispositivos conectados
  - `log_device_access()` usa `device_email` para registro
  - `supabase_request()` corregido para construccion correcta de URLs
- `wsapi.js` ya tenia `getDeviceMac()` implementado para recuperar MAC desde el dashboard
- `wsapi_demo.html` modificado para mostrar campo de email y recuperar MAC automaticamente del primer dispositivo conectado
- `.supabase_config.json` creado con `SUPABASE_URL` y `SUPABASE_API_KEY` (service_role key)
- Tablas Supabase actualizadas: `app_device_registrations` y `app_access_logs` ahora usan columna `device_email` en lugar de `device_mac`
- Permisos otorgados a `service_role` en tablas Supabase
- `abrir_dashboard.bat` mantiene compatibilidad: inicia servidor si es necesario y abre dashboard
- Al cargar `wsapi_demo.html`, el dashboard intenta conectar automaticamente al servidor ADB local para mostrar dispositivos sin pulsar "Conectar"
- Flujo de validacion: usuario ingresa email y licencia, dashboard recupera MAC del primer dispositivo, servidor valida contra Supabase usando email, registra acceso con email y MAC detectado

## Licencias y Admin Supabase

Agregado el 2026-05-13 como preparacion comercial, actualizado el 2026-05-14 para validacion por email.

Supabase usado para controlar acceso a la app:

- Project URL base: `https://qcwvfeqyczkhmkhqicqi.supabase.co`
- El dashboard admin usa publishable key publica y login de Supabase Auth; no debe usar `service_role` ni secretos dentro del HTML o del futuro EXE
- Tablas esperadas: `app_licenses`, `app_devices`, `app_access_logs`, `app_device_registrations`
- Columna principal: `device_email` (renombrada de `device_mac` el 2026-05-14)
- `supabase_admin_policies.sql` agrega `app_admins`, funcion `is_app_admin()` y politicas RLS para que solo emails admin autenticados puedan ver/crear/editar licencias, dispositivos y logs
- `license_admin.html` permite iniciar sesion, crear/editar licencias, aprobar/bloquear licencias, aprobar/bloquear PCs y consultar intentos de acceso
- Antes de usar `license_admin.html`, crear un usuario en Supabase Auth y ejecutar `supabase_admin_policies.sql` reemplazando `admin@example.com` por el email real del administrador

Flujo de validacion actual (2026-05-14):

1. Usuario ingresa email y licencia en `wsapi_demo.html`
2. Dashboard llama `wsapi.getDeviceMac()` para recuperar MAC del primer dispositivo conectado
3. Servidor `local_adb_server.py` recibe `validate_device_license(device_email, license_key)`
4. Servidor consulta Supabase tabla `app_device_registrations` por `device_email`
5. Si estado es "approved", validacion exitosa; si no, rechazada
6. Servidor registra acceso en `app_access_logs` con email y MAC detectado
7. Dashboard muestra resultado al usuario

Reglas de seguridad:

- No poner `service_role`, contrasena de base de datos ni secretos en archivos del proyecto cliente
- La anon key de Supabase puede ir en el cliente, siempre que las tablas esten protegidas por RLS y la validacion se haga por RPC controlada.
- El panel admin es para uso privado del propietario; no se distribuye a clientes
- La app comercial debe validar licencia contra Supabase antes de habilitar funciones de FlowLogin
- Desde 2026-05-14, `local_adb_server.py` no permite modo local por defecto si falta Supabase. Solo se activa con `FLOWDASHBOARD_ALLOW_LOCAL_LICENSE=1`.

Flujo gratuito sin Edge Function:

1. Ejecutar `supabase_license_rpc.sql` en Supabase SQL Editor.
2. Configurar `.supabase_config.json` con `SUPABASE_URL` y la anon key publica, no service_role.
3. `validate_device_license()` llama `validate_license_with_supabase_rpc()`.
4. La RPC valida `app_licenses`, crea/actualiza `app_device_registrations` y escribe `app_access_logs`.
5. Si la RPC no existe o falla, el EXE muestra error claro y no entra en modo local salvo que `FLOWDASHBOARD_ALLOW_LOCAL_LICENSE=1`.
6. El SQL tambien agrega columnas faltantes en `app_access_logs` y `app_device_registrations` (`device_email`, `timestamp`, `last_seen_at`, etc.) para migrar proyectos que aun tengan el esquema viejo.

## Empaquetado y Actualizaciones

Agregado el 2026-05-14 como base para distribucion comercial.

Modelo recomendado:

- Distribuir una carpeta/ZIP de app con `FlowDashboard.exe` como lanzador principal, no depender de que el cliente tenga Python.
- Mantener los datos del cliente fuera del bundle temporal de PyInstaller:
  - `device_names.json`
  - `.flowlogin_payloads/`
  - `.android/`
  - `.supabase_config.json` si se usa en una instalacion privada
- Para clientes finales, no incluir `service_role` dentro del EXE ni en archivos distribuidos. La opcion gratis actual usa anon key publica + RPC `validate_flowdashboard_license`; una Edge Function/API propia sigue siendo una mejora futura si se quiere mas control.
- `launcher.py` establece:
  - `FLOWDASHBOARD_BASE_DIR`: carpeta persistente junto al EXE.
  - `FLOWDASHBOARD_RESOURCE_DIR`: carpeta temporal/bundled donde PyInstaller extrae recursos.
- `launcher.py` evita instancias duplicadas consultando primero `/health` en `127.0.0.1:8765`. Si ya hay servidor, no inicia otro; solo abre el dashboard existente. Si no hay servidor, arranca `local_adb_server.py` en el hilo principal y abre el navegador desde un hilo auxiliar.
- `local_adb_server.py` usa esas rutas para que la persistencia quede estable aunque el programa este empaquetado.
- ADB usa por defecto las claves normales del usuario de Windows. No se debe sobrescribir `USERPROFILE` ni `HOME` para ADB porque en EXE puede crear carpetas raras y perder autorizaciones ya aceptadas. Solo usar carpeta ADB portable si se define explicitamente `FLOWDASHBOARD_ADB_HOME`.
- `wsapi_demo.html` ya no debe contener rutas absolutas del equipo del desarrollador para `Login.js`; el servidor resuelve `Login.js` por nombre desde la carpeta persistente o recursos empaquetados.

Actualizacion automatica:

- `updater.py` no reemplaza directamente el EXE activo. En Windows eso falla con frecuencia porque el ejecutable esta bloqueado.
- El flujo nuevo espera un `update_config.json` local, ignorado por git, con:

```json
{
  "manifest_url": "https://tu-dominio.com/flowdashboard/update.json"
}
```

- El manifest remoto debe devolver al menos:

```json
{
  "version": "1.0.1",
  "package_url": "https://tu-dominio.com/flowdashboard/FlowDashboard-1.0.1.zip",
  "sha256": "hash-opcional-del-zip"
}
```

- Si `version` es mayor que `APP_VERSION`, descarga el ZIP, valida `sha256` si existe, extrae en staging y crea un `.bat` temporal que espera a que cierre el proceso, copia la nueva version sobre la carpeta de app con `robocopy` y relanza el EXE.
- El ZIP de actualizacion debe contener los archivos de programa, pero no debe incluir cuentas, perfiles, payloads ni secretos del cliente.
- `launcher.spec` fue ajustado para generar `FlowDashboard.exe` e incluir `wsapi_demo.html`, `wsapi.js`, `Login.js` y `logo.png`.

### 2026-05-14

- Validacion de licencias cambiada de MAC a email: el dashboard ahora usa email como identificador principal, con deteccion automatica de MAC desde dispositivos Android.
- `local_adb_server.py` modificado para:
  - `validate_device_license()` acepta `device_email` en lugar de `device_mac`
  - `get_device_mac_address()` obtiene MAC automaticamente desde dispositivo Android usando ADB
  - Endpoint `/device-mac` para recuperar MAC de dispositivos conectados
  - `log_device_access()` usa `device_email` para registro
  - `supabase_request()` corregido para construccion correcta de URLs
- `wsapi.js` ya tenia `getDeviceMac()` implementado para recuperar MAC desde el dashboard
- `wsapi_demo.html` modificado para mostrar campo de email y recuperar MAC automaticamente del primer dispositivo conectado
- `.supabase_config.json` creado con `SUPABASE_URL` y `SUPABASE_API_KEY` (service_role key)
- Tablas Supabase actualizadas: `app_device_registrations` y `app_access_logs` ahora usan columna `device_email` en lugar de `device_mac`
- Permisos otorgados a `service_role` en tablas Supabase
- `abrir_dashboard.bat` mantiene compatibilidad: inicia servidor si es necesario y abre dashboard
- Al cargar `wsapi_demo.html`, el dashboard intenta conectar automaticamente al servidor ADB local para mostrar dispositivos sin pulsar "Conectar"
- Flujo de validacion: usuario ingresa email y licencia, dashboard recupera MAC del primer dispositivo, servidor valida contra Supabase usando email, registra acceso con email y MAC detectado
- `abrir_dashboard.bat` ahora exige feature `flowagent_auto_ensure` para reiniciar servidores viejos automaticamente.
- Se agrego `flowlogin_cache_retry`: FlowLogin hace una primera pasada, limpia cache/datos del clon fallido y hace un segundo intento solo para esos clones.

### 2026-05-15

- Empaquetado comercial ajustado para `FlowDashboard.exe`.
- Se agrego `Crearexe.bat` para recompilar el EXE desde la carpeta principal con doble clic.
- Se agrego `CrearActualizacion.bat` y `update.json` para publicar actualizaciones por GitHub Releases usando el repo `ingestebandaza/FlowDashboard`.
- Licencias configuradas en modo gratis con anon key + RPC `validate_flowdashboard_license`; no usar `service_role` en builds de cliente.
- `supabase_license_rpc.sql` agrega columnas faltantes antes de crear la RPC de validacion.
- Se corrigio la UI para no mostrar errores de licencia como exito.
- Se restauro helper `account_lines()` en `local_adb_server.py`; sin este helper `/devices` fallaba con 500 al cargar perfiles guardados.
- `run_process()` ahora ejecuta subprocess/ADB con `CREATE_NO_WINDOW` en Windows para evitar muchas ventanas de consola fugaces al abrir el EXE y cargar dispositivos.
- `wsapi_demo.html` muestra la version del programa debajo del logotipo; usa `v1.0.0` como fallback y actualiza desde `/health.appVersion`.
- `launcher.py` abre el dashboard por `http://127.0.0.1:8765/wsapi_demo.html`, no por `file://.../_MEI...`; esto evita pantalla `ERR_FILE_NOT_FOUND` tras actualizaciones PyInstaller.
- `local_adb_server.py` sirve archivos estaticos empaquetados (`wsapi_demo.html`, `wsapi.js`, `logo.png`) desde `/wsapi_demo.html`, `/wsapi.js` y `/logo.png`.
- `SERVER_FEATURES` incluye `static_dashboard`.
- `launcher.py` exige `static_dashboard` al reutilizar un servidor existente. Si detecta un servidor viejo en `127.0.0.1:8765`, cierra el proceso que escucha ese puerto y arranca el servidor de la build nueva.
- `SERVER_FEATURES` incluye `client_info`, `license_remember` y `adb_path_probe`.
- Desde `1.0.5`, `launcher.py` ejecuta `run_update_check()` antes de reutilizar un servidor existente y exige todas las features `static_dashboard`, `client_info`, `license_remember` y `adb_path_probe`. Esto evita quedarse atrapado reutilizando un servidor `1.0.3` que no tiene `/client-info`.
- `/client-info` devuelve nombre de PC, usuario Windows, hash local estable, version y ruta ADB. El dashboard envia esos datos al validar licencia.
- `wsapi_demo.html` recuerda email/licencia aprobados en `localStorage` y los revalida al abrir. Si Supabase devuelve bloqueo/error, borra la licencia guardada y deja el modal.
- `supabase_license_rpc.sql` ahora registra/actualiza `app_devices` ademas de `app_device_registrations`, para que `license_admin.html` muestre PCs usadas como `1/1`, permita bloquearlas y registre logs con `decision`, `pc_name`, `device_hash`, `app_version`, etc.
- La busqueda de ADB prueba rutas habituales de Android SDK (`LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe`, etc.) porque al abrir un EXE con doble clic puede no heredar el mismo PATH que una terminal.
- Desde `1.0.6`, la busqueda de ADB tambien prueba `%USERPROFILE%\adb.exe`, porque algunas PCs tienen `adb.exe` directamente en la carpeta de usuario y `where adb` lo encuentra ahi.
- Desde `1.0.7`, la busqueda de ADB es automatica en multiples ubicaciones: `PATH`, `FLOWDASHBOARD_ADB`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, carpeta de la app, `platform-tools` junto al EXE, rutas Android SDK comunes, `%USERPROFILE%\adb.exe`, `%USERPROFILE%\Downloads\platform-tools\adb.exe`, `%USERPROFILE%\Desktop\platform-tools\adb.exe` y una busqueda limitada con `rglob` dentro de la carpeta de usuario/local app data. `/client-info` incluye `adbCandidates` para diagnostico.
- Los errores de Supabase guardan el detalle de la ultima respuesta fallida y lo muestran en la validacion para diagnosticar RPC/SQL sin consola.
- `supabase_license_rpc.sql` convierte `app_devices.ip` y `app_access_logs.ip` a `text` si existian como `inet`, porque la app envia IP como texto opcional y Supabase fallaba con `column "ip" is of type inet but expression is of type text`.
- Desde `1.0.9`, `launcher.py` exige que `/health.appVersion` coincida exactamente con `APP_VERSION`; si hay un servidor viejo escuchando en `127.0.0.1:8765`, lo cierra y arranca el servidor incluido en la build nueva.
- `/client-info` ahora incluye IP local del PC, IP publica, codigo/nombre de pais, MAC del PC, ruta ADB y candidatos ADB probados.
- `wsapi_demo.html` envia a la validacion de licencia `ip_public`, `local_ip`, `country_code`, `country_name` y `mac_address` para que el panel admin tenga datos de la PC cliente.
- `supabase_license_rpc.sql` agrega y rellena `local_ip`, `mac_address` y `country_name` en `app_devices`, `app_access_logs` y `app_device_registrations`.
- `license_admin.html` muestra IP publica, IP local, MAC, pais y version en dispositivos e intentos de acceso.
- Desde `1.0.10`, ADB se ejecuta con la carpeta donde vive `adb.exe` al inicio de `PATH` y como `cwd`, para igualar mejor el entorno de la terminal del usuario.
- Se agrego `/adb-diagnostics`, que devuelve `adb version`, `adb start-server`, salida cruda de `adb devices -l` y dispositivos parseados desde dentro del EXE.
- `/devices` se hizo mas rapido: ya no intenta consultar IP publica/MAC de cada telefono durante la carga normal, solo usa cache y deja esas consultas para acciones explicitas. Esto evita que muchos telefonos o conexiones lentas bloqueen la deteccion inicial.
- Desde `1.0.11`, `updater.py` trae como fallback interno el manifest publico `https://raw.githubusercontent.com/ingestebandaza/FlowDashboard/main/update.json`; asi el EXE puede actualizar aunque falte `update_config.json` junto al ejecutable.
- Desde `1.0.12`, la actualizacion deja de ser silenciosa al arrancar: despues de aprobar licencia, `wsapi_demo.html` muestra una ventana visual de actualizacion, llama `/update-check`, consulta `/update-status`, descarga automaticamente y reinicia el EXE cuando la descarga queda lista.
- Desde `1.0.13`, `flow_agent_apk/build/flowagent-debug.apk` queda incluido en `launcher.spec` y dentro del EXE, para que `Instalar FlowAgent` funcione en PCs de clientes sin depender de una carpeta externa.
- `local_adb_server.py` tambien busca FlowAgent APK junto al proyecto padre como fallback y expone `flowAgentApkExists` en `/health` y `/client-info` para diagnostico.
- En `Dispositivos Conectados` se agrego un boton compacto con icono de bandera para actualizar pais/IP de todos los dispositivos. Al conectar dispositivos, el dashboard intenta llenar automaticamente las banderitas faltantes en segundo plano.
- Desde `1.0.14`, `updater.py` lee `update_config.json` y `update.json` remoto con `utf-8-sig`, para tolerar BOM. `CrearActualizacion.bat` escribe `update.json` en UTF-8 sin BOM para que las versiones anteriores tambien puedan leer el manifest.
- Desde `1.0.15`, el `.bat` temporal de aplicacion de actualizacion espera a que cierre el PID actual y cualquier `FlowDashboard.exe`, copia con reintentos, registra log en `%TEMP%\FlowDashboard_apply_update.log` y espera antes de relanzar. Esto evita errores de PyInstaller `_MEI`/`python310.dll` por reiniciar demasiado pronto.
- Desde `1.0.18`, el `.bat` temporal limpia variables internas de PyInstaller (`PYINSTALLER_RESET_ENVIRONMENT=1` y `_PYI_*`) antes de relanzar el EXE actualizado, para evitar que el nuevo proceso intente cargar `python310.dll` desde la carpeta temporal `_MEI` vieja.
- Desde `1.0.19`, la grilla de dispositivos tiene modo alterno de filas, con puntos de cuentas horizontales en esa vista. Se agregan categorias visuales de dispositivos creadas desde el dashboard, con drag/drop de tarjetas entre categorias y persistencia local en `device_groups.json` mediante `/device-groups`.
- Desde `1.0.20`, el panel de dispositivos se puede agrandar verticalmente de forma manual y recuerda su altura. El zoom tambien cambia el tamano de la vista en filas, las herramientas del encabezado quedan separadas por grupos visuales y cada categoria creada puede eliminarse desde su encabezado, devolviendo sus dispositivos a `Sin categoria`.
- Desde `1.0.21`, el menu contextual de cada dispositivo permite eliminar solo las cuentas guardadas en ese telefono sin borrar las listas del panel izquierdo. La accion de anadir cuentas abre un campo numerico dentro del menu para elegir cuantas cuentas libres de `Total` se agregan, sin ejecutarlas automaticamente. La vista en filas queda compactada a una sola fila por dispositivo y, en vista de cuadros con categorias, las categorias aparecen como etiquetas laterales mientras los dispositivos mantienen una grilla de varias columnas.
- Desde `1.0.22`, `Anadir Cuentas` en el menu contextual se habilita por espacio disponible en el dispositivo, aunque sus cuentas actuales sigan pendientes/bolitas grises. Al confirmar, toma cuentas de `Total` que no esten ya presentes en dispositivos conectados, evitando duplicar las cuentas existentes del telefono.
- Desde `1.0.23`, `launcher.py` fuerza siempre `FLOWDASHBOARD_BASE_DIR` y `FLOWDASHBOARD_RESOURCE_DIR` al arrancar el servidor, en lugar de heredar rutas viejas de una actualizacion anterior. El `.bat` temporal del updater tambien limpia esas variables antes de relanzar. `CrearActualizacion.bat` incluye `wsapi_demo.html`, `wsapi.js`, `Login.js` y `logo.png` junto al EXE dentro del ZIP para que el servidor tenga fallback externo si los recursos empaquetados no se resuelven.
- `license_admin.html` permite eliminar licencias desde la tabla de licencias. La accion pide confirmacion, elimina primero PCs vinculadas en `app_devices`, borra la fila de `app_licenses` y luego intenta limpiar registros relacionados por `license_key` en `app_device_registrations` y `app_access_logs`.
- Desde `1.0.24`, el Play del menu contextual de un dispositivo ejecuta solo clones con estado `pending` (bolita gris). Las cuentas ya analizadas como `success`, `already`, `error` o `review` no se vuelven a probar con Play; para rojas/revision se mantiene la accion `Reintentar Cuentas`. Cada tarjeta de dispositivo muestra un boton Stop pequeno mientras ese dispositivo esta en ejecucion/polling de FlowLogin.
- Desde `1.0.25`, la confirmacion de login espera mas tiempo antes de marcar revision/reintento para evitar falsos amarillos cuando Spotify tarda en cargar la pantalla principal. El detector de sesion iniciada reconoce tambien marcadores en espanol (`Inicio`, `Buscar`, `Tu biblioteca`, `Biblioteca`) ademas de `Home`, `Search` y `Your Library`.
- Desde `1.0.26`, las acciones del menu contextual por dispositivo usan bloqueo por telefono y no `state.busy` global. Esto permite iniciar Play, reintentar, reemplazar, anadir o detener en un dispositivo libre mientras otros dispositivos siguen ejecutando FlowLogin. Solo se bloquea el mismo dispositivo si ya esta arrancando una accion o ya esta corriendo.

### 2026-05-16

- La identidad persistente de dispositivos cambio de serial/IP a MAC cuando esta disponible.
- `/devices` ahora calcula `deviceKey`, `legacyDeviceId` y `macAddress`; ordena la grilla por `deviceKey` para que el orden no dependa de la IP WiFi.
- `device_names.json` migra automaticamente perfiles viejos por serial/IP a claves `mac:...` al detectar la MAC, conservando nombre, perfil/cuentas y estados.
- `device_groups.json` migra asignaciones de categoria desde serial/IP a `deviceKey` junto con el perfil del telefono.
- El frontend usa `deviceKey` para seleccion, categorias, trazabilidad de cuentas y acciones visuales; el backend resuelve esa clave al serial ADB actual antes de ejecutar comandos.
- El dashboard ahora tiene watchdog Auto Socket: al conectar o actualizar dispositivos y luego cada 30 segundos intenta preparar automaticamente FlowAgent para telefonos detectados en ADB que aun no esten en Socket, usando `install: "auto"` para no reinstalar si el APK ya esta actualizado.
- `ensureFlowAgentsForDevices()` acepta modo silencioso para reparacion automatica: crea/recrea `adb reverse`, abre FlowAgent con `autoconnect=true`, refresca agentes y solo muestra aviso si la accion fue manual o no es watchdog.
- El Play del menu contextual respeta seleccion multiple: si se hace clic derecho sobre una tarjeta ya seleccionada, Play ejecuta las cuentas pendientes de todos los dispositivos seleccionados; si se hace clic derecho sobre una tarjeta no seleccionada, opera solo sobre esa tarjeta.
- Todas las acciones del menu contextual de FlowLogin respetan la misma regla de seleccion multiple: `Play`, `Stop`, `Reintentar Cuentas`, `Reemplazar Cuentas`, `Anadir Cuentas` y `Eliminar Cuentas` operan sobre todos los dispositivos seleccionados cuando el clic derecho cae sobre una tarjeta seleccionada; si cae sobre una tarjeta no seleccionada, operan solo sobre esa tarjeta.
- En multi-seleccion, `Reintentar Cuentas` y `Reemplazar Cuentas` no deben quedar silenciosamente deshabilitados por un calculo previo de cuentas editables; el click debe entrar al handler y mostrar un aviso claro si no hay cuentas editables o faltan cuentas libres.
- Version comercial preparada como `1.0.27` para publicar el ZIP de actualizacion con estos cambios.
- La grilla ahora muestra la IP local del dispositivo en la tarjeta en lugar del `mac:...`, pero la identidad interna para nombres, cuentas, categorias y estados sigue siendo `deviceKey` basado en MAC cuando esta disponible.
- `/devices` incluye `deviceIp`; para ADB WiFi se deriva del serial `IP:5555` y para USB puede consultarse desde Android como fallback.
- Se corrigio el emparejamiento visual de FlowAgent: el frontend compara agentes tambien contra `device.serial`/`legacyDeviceId`, no solo contra `deviceKey`, para que las tarjetas muestren `Socket` cuando FlowAgent ya esta conectado.
- `agent_for_serial()` acepta claves `mac:...`/`serial:...` y las resuelve al serial ADB actual antes de buscar el socket, manteniendo el runner compatible con la identidad estable por MAC.
- `launcher.py` y `abrir_dashboard.bat` exigen la feature `device_visible_ip` para no reutilizar un servidor viejo que todavia muestre MAC en tarjetas o falle al emparejar Socket con `deviceKey`.
- Version comercial preparada como `1.0.28` para publicar el ZIP de actualizacion con la IP visible en tarjetas y el arreglo de deteccion Socket.
- FlowAgent APK subio a `0.2.2`: agrega comandos socket `openAppInfo` y `swipe`, y el dump de accesibilidad ahora expone `checkable`, `checked`, `selected` y `enabled` para decidir switches/radios sin ADB.
- `FLOW_AGENT_EXPECTED_VERSION` ahora exige `0.2.4`; el dashboard y el launcher no consideran listo un agente viejo para el flujo actual, obligando a reinstalar/actualizar antes de FlowLogin.
- La limpieza visual previa al segundo intento de login ahora es socket-only: FlowAgent abre App info, entra a Storage/Almacenamiento, pulsa Clear cache, Clear data y confirma; luego vuelve a App info, entra a Permissions/Permisos, revisa Storage/Almacenamiento y activa Allow/Permitir segun flujo de switch (Android 9) o radio/Allow (Android 10+).
- `clear_clone_cache_data_visual()` ya no cae a `pm clear` ni abre App info con ADB durante este flujo; si la limpieza por socket falla, la cuenta queda con error/revision del intento de limpieza en lugar de usar ADB como motor alterno.
- `reset_flowlogin_clone_start()` ya no hace `adb shell am force-stop`; despues de restaurar permisos, el segundo intento vuelve a `home` y lanza el clon por FlowAgent.
- Se copio el proyecto fuente de `flow_agent_apk` dentro de esta carpeta para que futuras modificaciones del APK queden visibles junto al dashboard. La APK compilada incluida en `flow_agent_apk/build/flowagent-debug.apk` corresponde a FlowAgent `0.2.4`.
- Version comercial preparada como `1.0.29` para publicar una nueva actualizacion con limpieza App info y restauracion de permiso Storage por socket.
- FlowAgent `0.2.3` corrige el badge visual de la app, que seguia mostrando `0.2.1` aunque el socket ya reportara la version nueva. Se subio el `versionCode` a 9 para forzar actualizacion sobre telefonos que ya tuvieran `0.2.2`.
- Version comercial preparada como `1.0.30` para publicar el APK FlowAgent `0.2.3` y evitar confusion visual con versiones anteriores.
- FlowAgent `0.2.4` distingue visualmente `Accesibilidad Sin enlazar` cuando Android tiene el permiso en ajustes pero el `AccessibilityService` no fue enlazado. Esto evita confundir un permiso atascado con una version vieja del APK.
- `/flowagent/setup` agrega diagnostico de Accesibilidad: detecta `enabled`, `binding`, `bound` y conexiones `DEAD` en `dumpsys`, y reporta cuando Android requiere apagar/prender FlowAgent en Accesibilidad. El boton manual usa `install: "auto"` y `openAccessibility: true`, asi no reinstala sin necesidad y lleva directo al ajuste cuando hace falta.
- `launcher.py` y `abrir_dashboard.bat` exigen la feature `flowagent_accessibility_diagnostics` para reiniciar servidores viejos que no sepan diagnosticar este estado.
- Version comercial preparada como `1.0.31` para publicar FlowAgent `0.2.4` y los diagnosticos de Accesibilidad.
- Version comercial preparada como `1.0.32` para publicar la correccion del menu contextual multi-dispositivo.
- Version comercial preparada como `1.0.33` para corregir el caso donde `Reemplazar Cuentas` en multi-seleccion no hacia nada porque el boton quedaba bloqueado antes de ejecutar el handler.
