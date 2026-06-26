# HOTFIX UI-FOCUS-04 - Stream Recovery Validation

Fecha: 2026-06-11

## Estado

HOTFIX UI-FOCUS-04 aplicado en codigo: Si.

Validacion runtime completa: No verificada en esta pasada porque el backend Python local no estaba escuchando en `127.0.0.1:8765` al consultar endpoints pasivos.

## Restore Point

Creado:

`restore_points/2026-06-11_PRE_HOTFIX_UI_FOCUS_04_STREAM_RECOVERY`

Incluye:

- `electron-app/src/renderer/flow-touch.js`
- `electron-app/src/renderer/app.js`
- `electron-app/src/renderer/styles.css`
- `local_adb_server.py`
- `PROJECT_CONTEXT.md`
- `TASKS_MONOLITO_PRO.md`
- `PLAN_ROLLOUT_CONTROL.md`

## Causa Raiz Real

El ciclo de frames se rompio por una regresion en la ruta de Focus: `_attachStreamCanvas()` dejo de adjuntar directamente el canvas al renderer H.264 con `attachFocus(serial, canvas, preset)` y paso a depender de `setFocusQuality(focusPreset)`.

Como `_refreshFrameState()` valida exclusivamente la sesion `serial|preset` y oculta el loader solo cuando `framesDecoded > 0`, cualquier sesion Focus no creada o no viva dejaba el overlay en `Conectando stream...`.

En paralelo, Grid podia quedar sin pantalla aunque existiera una entrada en `h264Renderer.sessions`, porque la re-sincronizacion solo comprobaba ausencia de sesion o `_closed`, no WebSocket abierto ni frame stale.

## Archivos Modificados

- `electron-app/src/renderer/flow-touch.js`
- `electron-app/src/renderer/app.js`
- `PROJECT_CONTEXT.md`
- `reports/hotfix_ui_focus_04_stream_recovery_validation.md`

No se modificaron:

- `local_adb_server.py`
- `scrcpy_control_channel.py`
- `electron-app/src/renderer/styles.css`
- FlowAgent/APK/OCR/Recording/MediaProjection

## Cambios Aplicados

### Focus

`_attachStreamCanvas()` vuelve a:

- leer el preset Focus persistido,
- fijar `_focusSerialKey = serial|preset`,
- llamar directamente a `h264.attachFocus(serial, canvas, focusPreset)`,
- guardar `_focusSession` solo contra la sesion real,
- dejar el loader dependiente de frames reales.

### Grid

`createCanvasesForVisibleDevices()` ahora re-adjunta el canvas de Grid si:

- la sesion no existe,
- la sesion esta `_closed`,
- el WebSocket no esta abierto,
- el ultimo frame tiene mas de 5 segundos.

### Calidad Focus

`setFocusQuality()` sigue siendo la ruta para cambios manuales de calidad y solo actualiza `_focusSerialKey` cuando el attach devuelve una sesion.

## Evidencia

### Sintaxis

- `node --check electron-app/src/renderer/flow-touch.js`: OK
- `node --check electron-app/src/renderer/app.js`: OK

### Grid funcionando

No verificado en runtime. El backend local `http://127.0.0.1:8765/health` rechazo conexion durante la validacion pasiva.

Evidencia en codigo: Grid vuelve a llamar `h264Renderer.attach(serial, canvas, gridPreset)` cuando la sesion esta muerta, cerrada o stale.

### Focus cargando stream

No verificado en runtime por backend offline.

Evidencia en codigo: Focus vuelve a adjuntar el canvas directamente con `h264.attachFocus(serial, canvas, focusPreset)` en `_attachStreamCanvas()`.

### `framesDecoded > 0`

No verificado en runtime por backend offline.

Evidencia en codigo: el loader sigue dependiendo de `h264Stats.connected && h264Stats.framesDecoded > 0`; no se agrego timeout falso ni ocultamiento artificial.

### Loader

El loader solo se oculta en `_refreshFrameState()` cuando llega un frame real H.264 (`framesDecoded > 0`). No se implemento ocultamiento por timeout ni frame congelado.

### Control

No se modifico control. Las rutas de tap/swipe/Home/Back/Recents permanecen intactas en `flow-touch.js` y siguen usando `FlowTouchCommandRouter` contra `/control/*`.

No se ejecuto validacion real de control porque el backend local no estaba disponible.

## No Regresion

- No se toco backend.
- No se toco FlowAgent.
- No se toco OCR.
- No se toco Recording.
- No se activo MediaProjection.
- No se instalo APK.
- No se reinicio ni mato ADB globalmente.
- No se modifico Discovery 8.1B ni `scrcpy_control_channel.py`.
