# Focus Floating Master Control Action Plan

Documento de traspaso para implementar, con el menor riesgo posible, cuatro mejoras relacionadas con Focus:

1. Focus flotante movible y redimensionable sobre el Grid.
2. Texto y pegado desde PC hacia el dispositivo enfocado usando `scrcpy-control`.
3. Teclado fisico del PC hacia el dispositivo en Focus.
4. Control multiple opcional: acciones hechas en Focus maestro replicadas a dispositivos seleccionados en Grid.

Este documento no es una orden para cambiar todo de golpe. Es una guia por fases pequenas, verificables y reversibles.

## 0. Reglas Duras

Antes de editar cualquier archivo, leer:

1. `AGENTS.md`
2. `PROJECT_CONTEXT.md`
3. `docs/master_technical_specification.md`
4. `informacion de scrcpy/doc/control.md`
5. `informacion de scrcpy/doc/keyboard.md`
6. `informacion de scrcpy/app/tests/test_control_msg_serialize.c`
7. `informacion de scrcpy/server/src/main/java/com/genymobile/scrcpy/control/ControlMessage.java`

Reglas que no se pueden romper:

- No usar MediaProjection al abrir Grid o Focus.
- No encender icono de captura Android por abrir Focus, Grid o control manual.
- No usar FlowAgent ni Accessibility como fallback automatico de control manual.
- No tocar FlowLogin, FlowMail, `Login.js`, APK, OCR, template matching ni instalacion de FlowAgent para esta tarea.
- No modificar el pipeline H.264/WebCodecs salvo que una prueba tecnica lo haga indispensable.
- No lanzar una ventana nativa de `scrcpy.exe`; Focus debe seguir dentro de Electron.
- Control manual debe seguir usando `scrcpy-control` y endpoints `/control/*`.
- ADB input queda solo como fallback existente.
- No hardcodear IPs ni cantidad de dispositivos.
- No copiar cuentas, passwords, tokens ni secretos a logs ni documentacion.
- Cada fase funcional debe ser pequena, validada y reversible.

## 1. Archivos A Revisar Antes De Implementar

Revisar estos archivos antes de editar:

- `electron-app/src/renderer/flow-touch.js`
- `electron-app/src/renderer/app.js`
- `electron-app/src/renderer/styles.css`
- `electron-app/src/renderer/stream-renderer-h264.js`
- `local_adb_server.py`
- `scrcpy_control_channel.py`

Contexto esperado:

- `flow-touch.js` crea el Focus actual, maneja el canvas, coordenadas, gestos y acciones Back/Home/Recents.
- `app.js` maneja el Grid, seleccion de dispositivos y acciones sobre seleccionados.
- `styles.css` contiene muchas reglas acumuladas para Focus y Grid; cambiar lo minimo y probar overflow.
- `stream-renderer-h264.js` maneja WebCodecs y multi-canvas. No tocar salvo que sea imprescindible.
- `local_adb_server.py` expone `/control/tap`, `/control/touch`, `/control/swipe`, `/control/keyevent`.
- `scrcpy_control_channel.py` abre sesiones `scrcpy-control` control-only y serializa mensajes binarios.

## 2. Preparacion Y Restore Point

Antes de editar:

```powershell
git status --short
node --check electron-app/src/renderer/flow-touch.js
node --check electron-app/src/renderer/app.js
node --check electron-app/src/renderer/stream-renderer-h264.js
python -m py_compile local_adb_server.py scrcpy_control_channel.py
```

Crear restore point:

```powershell
$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$dir = "restore_points/${stamp}_PRE_FLOATING_FOCUS_MASTER_CONTROL"
New-Item -ItemType Directory -Path $dir | Out-Null
Copy-Item electron-app/src/renderer/flow-touch.js $dir/
Copy-Item electron-app/src/renderer/app.js $dir/
Copy-Item electron-app/src/renderer/styles.css $dir/
Copy-Item local_adb_server.py $dir/
Copy-Item scrcpy_control_channel.py $dir/
Copy-Item PROJECT_CONTEXT.md $dir/
```

No revertir cambios existentes del usuario. Si el arbol Git esta sucio, tocar solo los archivos necesarios.

## 3. Fase A: Focus Flotante Sin Tocar Streaming Ni Control

Objetivo: que Focus deje de ser pantalla completa bloqueante y pase a ser una ventana movible y redimensionable, dejando el Grid visible y usable atras.

No cambiar:

- `activeSerial`
- `_attachStreamCanvas(...)`
- `CoordinateMapper.fromPointerEvent(...)`
- `h264.attachFocus(...)`
- `scrcpy_raw_streamer.py`
- `scrcpy_raw_ws_server.py`
- `stream-renderer-h264.js`

Implementacion:

- Mantener `openFocus(serial)` y `closeFocus()` como API publica.
- Mantener una sola ventana Focus activa en v1.
- Si el usuario abre Focus en otro dispositivo, reutilizar la ventana existente y cambiar el `activeSerial`.
- Hacer que el overlay sea transparente a eventos fuera de la ventana:
  - overlay: `pointer-events: none`
  - shell Focus: `pointer-events: auto`
- Convertir `.flowtouch-focus-shell` a ventana:
  - `position: fixed`
  - `left`, `top`, `width`, `height` desde estado persistido
  - clamp contra viewport en apertura y resize de ventana
- Persistir geometria en `localStorage`:
  - `flowdashboard.focus.window.geometry`
- Geometria inicial recomendada:
  - `width: 520`
  - `height: min(window.innerHeight - 72, 820)`
  - `left: window.innerWidth - width - 32`
  - `top: 32`
- Usar `.flowtouch-focus-header` como asa de drag.
- No iniciar drag si el target es `button`, `input`, `textarea`, `select`, `canvas`, `[contenteditable]` o vive dentro de `.fp-floating-window`.
- Agregar handle de resize en esquina inferior derecha.
- Mantener el telefono interno en aspect ratio 9:16.
- No permitir que la ventana quede fuera de pantalla.

Validaciones:

- Abrir Focus y confirmar que el Grid queda visible atras.
- Click fuera del Focus debe poder seleccionar/deseleccionar tarjetas del Grid.
- Mover Focus, redimensionar, cerrar y reabrir: geometria persistida y visible.
- Tap, swipe, live touch, Back, Home y Recents siguen funcionando en el enfocado.
- Eco/Balanced/Pro siguen funcionando.
- Cerrar Focus limpia listeners, timers y clases de body.
- No aparece icono de captura/MediaProjection en Android.

## 4. Fase B: Texto Y Clipboard Por scrcpy-control

Objetivo: permitir enviar texto y pegar desde PC al dispositivo enfocado usando el canal oficial de control de scrcpy.

No usar FlowAgent ni FlowKeyboard como motor principal de esta fase.

### Backend: `scrcpy_control_channel.py`

Agregar constantes oficiales:

- `TYPE_INJECT_TEXT = 1`
- `TYPE_SET_CLIPBOARD = 9`

Implementar:

- `_text_msg(text)`
- `_set_clipboard_msg(sequence, text, paste=True)`
- `type_text(serial, text)`
- `paste_text(serial, text, paste=True)`

Serializacion oficial:

- Inject text:
  - 1 byte tipo
  - 4 bytes big-endian longitud UTF-8
  - bytes UTF-8
- Set clipboard:
  - 1 byte tipo
  - 8 bytes sequence big-endian
  - 1 byte paste
  - 4 bytes big-endian longitud UTF-8
  - bytes UTF-8

Limites v1:

- `type_text`: maximo 300 caracteres por llamada.
- `paste_text`: maximo 4096 caracteres por llamada.
- No loguear texto completo.

### Backend: `local_adb_server.py`

Agregar funciones:

- `control_type_text(body)`
- `control_paste_text(body)`

Agregar rutas:

- `POST /control/type-text`
- `POST /control/paste-text`

Respuesta esperada:

```json
{
  "ok": true,
  "profile": "control",
  "method": "scrcpy_control",
  "serial": "...",
  "latencyMs": 12
}
```

Reglas:

- Si `SCRCPY_CONTROL_MANAGER` no existe, devolver error claro.
- Para `type-text`, si scrcpy-control falla, se permite fallback a `adb input text` solo como fallback legacy marcado con `fallbackUsed: true`.
- Para `paste-text`, no hacer fallback a ADB.
- Nunca usar FlowAgent como fallback.

### Frontend: `flow-touch.js`

Agregar UI compacta en Focus:

- Boton `Pegar`
- Boton o mini entrada `Escribir`

Comportamiento:

- `Pegar` toma texto del clipboard de Electron/navegador si esta disponible.
- Si no hay acceso al clipboard, abrir campo manual.
- Antes del primer paste de la sesion mostrar aviso:
  - El texto se copiara al portapapeles Android.
  - Otras apps Android podrian leerlo.
  - Evitar passwords/tokens.
- Registrar en historial solo longitud:
  - `Paste enviado: 24 caracteres`
  - Nunca registrar contenido.

Validaciones:

- Campo Android enfocado recibe texto simple.
- Texto con espacios funciona.
- Paste corto funciona.
- El contenido no aparece en logs.
- FlowKeyboard existente sigue funcionando igual desde su herramienta.

## 5. Fase C: Teclado Fisico En Focus

Objetivo: escribir con el teclado fisico del PC al dispositivo en Focus.

Implementacion:

- Capturar `keydown` solo si:
  - Focus esta abierto.
  - Control esta habilitado.
  - El evento no viene de `input`, `textarea`, `select`, `[contenteditable]` ni herramientas flotantes.
  - No hay drag/resize activo.
- Caracteres imprimibles: enviar por `/control/type-text`.
- Teclas v1:
  - Enter
  - Backspace
  - Tab
  - ArrowUp
  - ArrowDown
  - ArrowLeft
  - ArrowRight
  - Escape como Back solo cuando no haya modal/ventana flotante activa.
- Para teclas no imprimibles, extender `/control/keyevent` con nombres permitidos o crear helper dedicado.
- No capturar `Ctrl+C` ni `Ctrl+V` global en v1; usar boton explicito de Pegar.
- No implementar UHID en v1.

Nota sobre UHID:

- Es viable segun scrcpy.
- Es mejor para caracteres complejos e IME.
- Requiere configurar layout fisico Android.
- Puede fallar en Android antiguos.
- Debe quedar para fase experimental posterior.

Validaciones:

- Escribir letras/numeros en campo Android.
- Enter funciona.
- Backspace borra.
- Flechas mueven cursor si la app lo soporta.
- Escribir en inputs del dashboard no envia nada al telefono.
- Cerrar Focus remueve listeners.

## 6. Fase D: Control Multiple Desde Focus Maestro

Objetivo: con una ventana Focus activa, poder seleccionar dispositivos en Grid y replicar acciones del Focus maestro a esos seleccionados.

Reglas:

- Toggle apagado por defecto.
- El dispositivo Focus maestro siempre recibe la accion.
- Las replicas reciben acciones solo si el toggle esta activo.
- Si el Focus maestro tambien esta seleccionado en Grid, excluirlo de replicas.
- Solo replicar acciones seguras en v1:
  - tap
  - live touch
  - swipe
  - Back
  - Home
  - Recents
  - wheel/scroll si ya se convierte en swipe en Focus actual
  - long press/double tap como secuencia equivalente
- No replicar en v1:
  - uninstall app
  - clear data/cache
  - reboot/shutdown
  - run script
  - FlowLogin
  - FlowKeyboard manual
  - Inspector clickText
  - texto/clipboard, salvo fase futura con confirmacion separada

UI:

- Agregar toggle en Focus:
  - Texto: `Replicar`
  - Badge: cantidad de replicas actuales
  - Tooltip: `Replica taps, swipes y navegacion al Grid seleccionado`
- Persistir:
  - `flowdashboard.focus.replicateSelected = false`
- Si no hay seleccionados, badge `0` y log `Sin replicas seleccionadas`.

Targets:

```js
const master = this.activeSerial;
const selected = Array.from(this.app.selectedDeviceIds || []);
const replicas = selected
  .filter(serial => serial !== master)
  .filter(serial => isDeviceOnline(serial));
```

No hardcodear IPs. Usar el estado real de `this.app.devices`.

Backend:

- No crear endpoint bulk en v1.
- Enviar llamadas individuales a `/control/*` desde frontend.
- Motivo: menor riesgo y errores aislados por dispositivo.
- Si en el futuro se necesita performance, planear endpoint bulk separado.

Ejecucion:

- Maestro primero o en paralelo inmediato, pero nunca bloquear visualmente el maestro por replicas.
- Replicas con limite de concurrencia 4.
- Si falla una replica en `touch down`, no seguir mandando `move` a esa replica durante el gesto actual.
- Fallo de replica no cierra Focus ni desactiva control maestro.
- Log resumido:
  - `Tap master OK, replicas 4/5`
  - `Swipe master OK, replicas 3/5`

Coordenadas:

- Usar las coordenadas absolutas Android ya calculadas para el maestro.
- Esto funciona mejor con dispositivos de resolucion y orientacion similares.
- No intentar reescalar por modelo en v1; documentar esta limitacion en tooltip o log.

Validaciones:

- Seleccionar 2 dispositivos en Grid.
- Abrir Focus en otro.
- Activar Replicar.
- Tap: maestro y replicas reaccionan.
- Swipe: maestro y replicas reaccionan.
- Back/Home/Recents: maestro y replicas reaccionan.
- Deseleccionar una replica mientras Focus sigue abierto: badge cambia y deja de recibir acciones.
- Apagar toggle: solo actua el maestro.
- Un dispositivo desconectado no rompe el maestro.
- Revisar `/control/scrcpy-sessions` para confirmar uso de sesiones control-only.
- Confirmar que no se usa FlowAgent ni MediaProjection.

## 7. Fase E: Documentacion Y Cierre

Actualizar `PROJECT_CONTEXT.md` al terminar cambios funcionales.

Debe incluir:

- Restore point creado.
- Archivos modificados.
- Resumen de Focus flotante.
- Resumen de texto/clipboard por scrcpy-control.
- Resumen de teclado fisico, si se implemento.
- Resumen de replicacion a seleccionados, si se implemento.
- Validaciones realizadas.
- Alcance explicitamente no tocado:
  - FlowLogin
  - FlowMail
  - `Login.js`
  - APK
  - MediaProjection
  - OCR/template matching
  - backend H.264
  - FlowAgent como fallback de control

Validacion final:

```powershell
node --check electron-app/src/renderer/flow-touch.js
node --check electron-app/src/renderer/app.js
node --check electron-app/src/renderer/stream-renderer-h264.js
python -m py_compile local_adb_server.py scrcpy_control_channel.py
```

Prueba runtime recomendada:

- Abrir con `abrir_electron.bat`.
- Confirmar Grid con dispositivos reales.
- Abrir Focus flotante.
- Mover/redimensionar Focus.
- Probar tap/swipe/live touch/Back/Home/Recents.
- Probar texto/pegado.
- Probar replicacion a seleccionados.
- Confirmar que Android no muestra icono de captura.
- Revisar logs de Electron/Python por errores.

## 8. Rollback

Si algo falla en Fase A:

- Restaurar `flow-touch.js` y `styles.css` desde restore point.
- No tocar backend.

Si algo falla en Fase B o C:

- Desactivar UI de texto/teclado.
- Restaurar `local_adb_server.py` y `scrcpy_control_channel.py` si el canal de control se ve afectado.
- Confirmar que `/control/tap`, `/control/swipe`, `/control/keyevent` vuelven a funcionar.

Si algo falla en Fase D:

- Apagar toggle por defecto.
- Dejar control maestro single-device intacto.
- Restaurar solo los helpers de replicacion si interfieren con Focus.

## 9. Mensaje Recomendado Para Otra IA

Usar este mensaje para traspasar la tarea:

```text
Antes de tocar nada, lee AGENTS.md y PROJECT_CONTEXT.md. Despues lee completo FOCUS_FLOATING_MASTER_CONTROL_ACTION_PLAN.md. Ese documento es el plan de accion y contiene las fases, reglas duras, archivos, validaciones y limites.

Tambien lee docs/master_technical_specification.md, especialmente perfil control, Grid/Focus, H.264/WebCodecs y scrcpy-control. Despues lee la documentacion local de scrcpy indicada en el plan.

No improvises ni hagas cambios grandes. Crea restore point antes de editar. Implementa por fases pequenas: primero Focus flotante sin tocar streaming/control; despues texto/clipboard por scrcpy-control; despues teclado fisico; por ultimo replicacion opcional a seleccionados.

No toques FlowLogin, FlowMail, Login.js, APK, OCR, MediaProjection, FlowAgent ni el pipeline H.264/WebCodecs salvo que el plan lo indique explicitamente y una prueba lo justifique. El control manual debe seguir usando scrcpy-control y endpoints /control/*. FlowAgent no debe usarse como fallback de control manual.

Antes de implementar, inspecciona flow-touch.js, app.js, styles.css, stream-renderer-h264.js, local_adb_server.py y scrcpy_control_channel.py. Valida cada fase con node --check, python -m py_compile y pruebas runtime en Electron. Al final actualiza PROJECT_CONTEXT.md documentando lo cambiado, lo validado y lo que NO se toco.
```

