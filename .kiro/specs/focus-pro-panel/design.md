# Focus PRO Panel - Design

Fecha: 2026-05-26

## Arquitectura general

```
[Focus Mode Overlay]
  └── flowtouch-focus-shell
       ├── header (titulo, status pills, prev/next/close)
       └── main
            ├── focus-pro-panel  (NUEVO, columna izquierda PRO)
            │    ├── Control (switch ON/OFF + auto-arm policy)
            │    ├── Navegacion (Back, Home, Recents con icono)
            │    ├── Apps (colapsable)
            │    ├── Archivos (colapsable)
            │    ├── ADB Shell (colapsable)
            │    ├── Auto.js (colapsable)
            │    ├── Sistema (colapsable)
            │    ├── Energia (colapsable, criticos)
            │    └── FlowKeyboard (colapsable)
            ├── flowtouch-phone-stage (canvas Android sin cambios)
            └── flowtouch-log-panel (historial)
```

El panel sale ligeramente del shell por la izquierda para sentirse columna PRO sin invadir el canvas. Usa un offset negativo en CSS (`margin-left: -16px`).

## Estado runtime (Electron)

```js
class FlowTouchController {
  // ... estado existente ...
  // Fase Panel PRO:
  proPanelExpanded = {};   // { apps: bool, archivos: bool, ... }
  appsList = [];           // resultado de /apps/list
  appsFilter = '';
  appsShowAll = false;
  shellHistory = [];       // ultimos comandos ADB ejecutados
  autoJsScriptHash = null; // hash del ultimo .js subido para cache
}
```

Persistencia: `localStorage.flowdashboard.focusPanel.expanded` con array de IDs de secciones abiertas.

## Estructura HTML del panel (resumen)

```html
<aside class="focus-pro-panel" aria-label="Acciones del dispositivo enfocado">
  <section class="fp-block fp-control" data-block="control">
    <header class="fp-header"><span>Control</span></header>
    <div class="fp-content fp-control-row">
      <label class="fp-switch">
        <input type="checkbox" id="flowTouchControlSwitch" />
        <span class="fp-switch-slider"></span>
        <strong id="flowTouchControlLabel">Control ON</strong>
      </label>
    </div>
  </section>

  <section class="fp-block fp-nav" data-block="nav">
    <header class="fp-header"><span>Navegacion</span></header>
    <div class="fp-content fp-nav-row">
      <button id="flowTouchBackBtn" class="fp-btn"><svg/>Back</button>
      <button id="flowTouchHomeBtn" class="fp-btn"><svg/>Home</button>
      <button id="flowTouchRecentsBtn" class="fp-btn"><svg/>Recents</button>
    </div>
  </section>

  <section class="fp-block fp-collapsible" data-block="apps">
    <header class="fp-header"><span>Aplicaciones</span><svg class="fp-arrow"/></header>
    <div class="fp-content"> ... </div>
  </section>
  ... mismas reglas para archivos, adb, autojs, sistema, energia, flowkeyboard ...
</aside>
```

## Animaciones

- Acordeon: `max-height` de 0 a `scrollHeight` con `transition: max-height 220ms ease-in-out`.
- Flecha: `transform: rotate(0deg)` cerrado, `rotate(90deg)` abierto.
- Switch: slider animado con `transition: transform 160ms ease, background 160ms ease`.
- Hover en botones: glow suave con `box-shadow` y leve `translateY(-1px)`.
- Energia (reboot/shutdown): pulso rojo sutil al pasar el mouse para indicar accion critica.
- Si `prefers-reduced-motion`, transiciones se anulan.

## Paleta por seccion (variables CSS)

```css
.fp-control     { --fp-color: #22b86f; }
.fp-nav         { --fp-color: #45caff; }
.fp-apps        { --fp-color: #a78bfa; }
.fp-archivos    { --fp-color: #4f8dff; }
.fp-adb         { --fp-color: #f5a623; }
.fp-autojs      { --fp-color: #ff7849; }
.fp-sistema     { --fp-color: #ff5c8a; }
.fp-energia     { --fp-color: #ff5c7a; }
.fp-flowkeyboard{ --fp-color: #c4b5fd; }
```

Cada cabecera usa `border-left: 3px solid var(--fp-color);` y el icono SVG hereda el color.

## Backend nuevo (Python)

### Multipart parser

`local_adb_server.py` agrega un helper `parse_multipart(handler)` que usa `cgi.FieldStorage` de stdlib para leer `multipart/form-data` y guardar archivos en `BASE_DIR / ".upload_tmp" / <uuid>`. Limite 500 MB.

### Endpoints

- `/apps/list`: por serial, ejecuta `pm list packages -3` o `pm list packages` segun flag, luego paraleliza `dumpsys package <pkg> | grep versionName/applicationLabel` para enriquecer (con timeout corto). Devuelve `[{ packageName, label, versionName }]`.
- `/apps/launch`: usa `agent_result launchPackage` cuando hay agente; fallback `monkey -p <pkg> -c android.intent.category.LAUNCHER 1`.
- `/apps/force-stop`: `am force-stop <pkg>`.
- `/apps/clear-cache`: `pm clear <pkg>`.
- `/apps/uninstall`: `pm uninstall <pkg>`.
- `/apps/install`: multipart con campo `apk`. Guarda a temp, `adb install -r <temp>`. Borra temp.
- `/file-push`: multipart `file` + `path`. Guarda a temp, `adb push <temp> <path>`. Borra temp.
- `/system/open-settings`: payload `{ shortcut: "main"|"wifi"|"apps"|"idioma"|"accesibilidad" }`. Mapea a accion.
- `/power/reboot`: `adb reboot`.
- `/power/shutdown`: `adb reboot -p` y si falla `adb shell svc power shutdown`.
- `/autojs/prepare-overlay`: `appops set <pkg_autojs> SYSTEM_ALERT_WINDOW allow` y, si falla, retorna instruccion + intent para abrir Settings.
- `/autojs/push`: multipart con `script`. Guarda a temp, calcula sha1, hace `adb push` a `/sdcard/Download/flowdashboard_autojs/<nombre>.js` solo si el hash cambio o `force=true`.

### Helpers

- `flow_dashboard_autojs_dir(serial)` -> `/sdcard/Download/flowdashboard_autojs/`.
- `autojs_target_pkg(serial)` -> intenta detectar el paquete activo de Auto.js consultando `pm path org.autojs.autojs*`.

## UI helpers en `app.js`

Nuevos metodos en `App` (con nombres tipo helpers ya existentes de FlowKeyboard):

- `appsList(serial, opts)` POST `/apps/list`.
- `appsLaunch(serial, pkg)`, `appsForceStop`, `appsClearCache`, `appsUninstall`.
- `appsInstall(serial, file)` con FormData.
- `pushFile(serial, file, path)` con FormData.
- `runAdbFreeCommand(serial, command)` envuelve el `/adb` existente.
- `autoJsRunWithFile(serial, file, opts)` que llama `/autojs/push` y luego `/autojs/run`.
- `autoJsPrepareOverlay(serial)`.
- `systemOpenSettings(serial, shortcut)`.
- `powerReboot(serial)`, `powerShutdown(serial)`.

Todos los helpers se exponen en `window.flow.device` para reutilizar desde otras partes si hace falta despues.

## Logica de auto-arm con debounce

```js
async openFocus(serial) {
  // ... codigo existente ...
  // ON automatico con debounce
  const armed = await this._autoArmControlSafely(serial);
  if (!armed) this._appendLog('Control no se armo automatico, agente sin accesibilidad');
}

async _autoArmControlSafely(serial) {
  try {
    await this.commandRouter.resolveAgent(serial);
  } catch {
    return false;
  }
  this.armDebounceUntil = performance.now() + 350;
  this.enableControl(serial);
  return true;
}

_isWithinArmDebounce() {
  return performance.now() < (this.armDebounceUntil || 0);
}

// En _handleTapGesture: si _isWithinArmDebounce() === true, ignora.
```

## Pruebas planeadas

- Headless: el switch arranca ON cuando agente ok; OFF cuando agente no ok. Debounce ignora primer tap.
- Backend: probar cada endpoint en un dispositivo real (pm list, force-stop, clear-cache, push de archivo pequeño).
- No probar reboot/shutdown automatico durante validacion. Solo confirmar que el endpoint responde con error si falta serial.

## Compatibilidad

- Sin cambios en `flow_agent_apk` (no hace falta).
- Sin cambios en backend C# de streaming.
- Sin cambios en FlowLogin / FlowRegister / Inspector existente.
- Sin cambios en `abrir_electron.bat`.
