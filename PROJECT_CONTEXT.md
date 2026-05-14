# FlowLogin Project Context

Ultima actualizacion: 2026-05-14

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
- `device_names.json`: persistencia por serial/IP. Guarda nombre, cuentas asignadas al telefono y `accountStatuses`. Puede contener datos sensibles.
- `.flowlogin_payloads/`: payloads locales generados para FlowLogin. Puede contener datos sensibles.
- `flow_agent_apk/`: proyecto Android del APK FlowAgent.
- `flow_agent_apk/build/flowagent-debug.apk`: APK compilada actual que instala el dashboard.
- `license_admin.html`: panel local privado para administrar licencias, dispositivos aprobados/bloqueados e intentos de acceso desde Supabase.
- `supabase_admin_policies.sql`: SQL de politicas RLS y tabla `app_admins` para permitir CRUD administrativo solo a emails autorizados en Supabase Auth.

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
```

Endpoints importantes:

- `GET /health`: version, features y ruta ADB.
- `GET /devices`: lista dispositivos ADB, ahora incluye `androidId` cuando se puede leer.
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

El boton visual del dashboard se llama `Instalar FlowAgent`.

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
0.2.1
```

Cambios clave:

- `MainActivity` acepta extras por intent: `host`, `port`, `autoconnect`.
- El dashboard puede forzar `127.0.0.1:8766` aunque antes se hubiera guardado otra IP.
- Si `autoconnect=true` y el servicio de accesibilidad esta activo, reinicia el socket automaticamente.
- La interfaz visual del APK usa tarjetas oscuras, chips de estado, acciones compactas y un icono launcher propio.
- `MainActivity` tambien acepta extra `serial` desde el dashboard y lo guarda para que el socket pueda vincularse con el dispositivo ADB correcto.

Comandos soportados actualmente por `/agent/command`:

- `ping`
- `status`
- `dump`
- `launchPackage`
- `getEditTexts`
- `clickText`
- `setText`
- `setTextIndex`
- `tap`
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

`device_names.json` guarda por serial/IP:

```json
{
  "serial": {
    "name": "nombre opcional",
    "person": "maximo 10 lineas de cuentas",
    "accountStatuses": []
  }
}
```

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
- El panel admin es para uso privado del propietario; no se distribuye a clientes
- La app comercial debe validar licencia contra Supabase antes de habilitar funciones de FlowLogin

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