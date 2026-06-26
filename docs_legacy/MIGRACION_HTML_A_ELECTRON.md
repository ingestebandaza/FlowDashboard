# Migración HTML legado → Electron

> Fecha de análisis: 2026-05-29
> Propósito: inventario de qué falta migrar de `wsapi_demo.html` (legado) al producto Electron para poder eliminar el HTML legado y dejar **solo Electron** como producto único.

Este documento se basa en lectura directa de:
- `wsapi_demo.html` (7390 líneas, ~283 KB)
- `wsapi.js`, `streaming_ui_clean.js`, `pro_panel.js`, `debug_validar.js`, `license_persistence.js`
- `license_admin.html` (panel admin Supabase separado)
- `electron-app/src/renderer/` completo (`app.js`, `flow-touch.js`, `inspector.js`, `stream-renderer.js`, `stream-renderer-h264.js`, `index.html`, `api-client.js`)
- `AGENTS.md` y `PROJECT_CONTEXT.md`

---

## Resumen ejecutivo

| Estado | Cantidad |
|--------|----------|
| ✅ Ya migrado y funcionando en Electron | 14 áreas mayores |
| ⚠️ Migrado parcialmente, faltan refinamientos | 6 áreas |
| ❌ NO migrado, falta hacerlo | 5 áreas |
| 🗑️ NO necesita migrarse (legacy obsoleto o herramienta separada) | 4 áreas |

**Veredicto:** El Electron ya tiene el grueso del producto. Las brechas son **completables en 1-2 sesiones de trabajo**. Después de cerrar las 5 áreas pendientes y los 6 refinamientos, `wsapi_demo.html` se puede eliminar de los lanzadores y dejar solo Electron.

### ✅ SESIÓN 1 COMPLETADA (2026-05-29)

Cerrada en `app.js`:
- ✅ **Login inicial con MAC del device** — nueva función `waitForFirstDeviceMac()` + `validateLicense` ahora envía `device_serial` y MAC del device Android al backend. La IIFE de auto-validación espera al primer device antes de validar silenciosamente.
- ✅ **Modal de licencia con MAC del device** — incluye `device_serial` y `mac_address` (del Android, no del PC) en el payload. Mensajes diferenciados para `pending` / `blocked` / `revoked`.
- ✅ **Help modal con contenido real** — 8 secciones útiles (conexión WiFi, FlowAgent, FlowLogin, Focus, Inspector, calidad streaming, troubleshooting, soporte).
- ✅ **Plans modal** — botones reemplazados por links `mailto:` con asunto/cuerpo prellenados.

Restore point: `restore_points/PuntoAntesMigracionLegacy/`.

---

## ✅ Lo que YA está migrado a Electron

Estas funciones existen en `electron-app/src/renderer/app.js` y trabajan contra el backend Python en `:8765`:

1. **Sidebar completo** — Dispositivos, FlowCategory (FlowLogin + FlowRegister + 7 placeholders), Planes, Configuración (FlowVideo + FlowKeyboard), Help, toggle Dev Mode.
2. **Grid de dispositivos** — tarjetas con canvas (live preview), nombre editable por popover, botón perfil de cuentas, drag & drop entre categorías, rubber-band, slider de zoom (60–500), slider de gap, vista live/grid.
3. **Conexión a backend** — `checkConnections()` verifica Python (`:8765`) y C# (`:5000`) con status pill animado.
4. **Streaming H.264 (Etapa C)** — `H264StreamRenderer` con WebSockets a `:8768`, multi-canvas, presets thumbnail/eco/balanced/pro, autoreconnect con backoff. Producción.
5. **Streaming WebP fallback** — `StreamRenderer` con WebSocket a `:5000/ws/streaming`, ImageBitmap render sin parpadeo, mantiene `frameSize` real para mapeo de coords.
6. **Focus Mode con FlowTouch** — overlay con canvas grande, tap/swipe/longpress/doubletap/wheel, control armado, FlowKeyboard panel, ADB shell, Auto.js, Sistema, Energía, Apps, FlowDev Inspector embebido.
7. **FlowDev Inspector** — `class DevInspector` con 14 métodos de detección (8 nativos + 6 web), árbol UI, búsqueda, panel de propiedades, Action Console, persistencia localStorage.
8. **Cuentas FlowLogin** — pestañas Total/Válidos/Inválidos, delimitador, divideCount con max 10 por device, persistencia en localStorage, botón "Dividir y Asignar".
9. **Cuentas FlowRegister** — sección sidebar completa con sus propias pestañas y countPerDevice.
10. **Licencia (modal)** — `showLicenseModal()` + `validateLicense()` + `loadSavedLicense()` + `saveLicense()` + `clearLicense()`. Auto-validación silenciosa al arrancar. POST a `/validate-license` con `client-info`.
11. **Persistencia de licencia** — `localStorage` + `electronAPI.readJsonFile/writeJsonFile` (file `license.json`).
12. **Autoupdater** — `checkForUpdates()` + `showUpdateModal()` con barra de progreso. `GET /update-status` y `POST /update-check`.
13. **Network Scanner** — `renderNetworkScannerSection()` + `toggleNetworkScanner()` + `startNetworkScan()` con rangos editables y barra de progreso.
14. **FlowAgent setup** — `setupFlowAgentAll()` global que envía `POST /flowagent/setup` con `deviceIds` seleccionados, `install:"auto"`, `launch:true`. Botón visible en `Configuración → FlowVideo → Preparar FlowAgent`.

---

## ⚠️ Migrado parcialmente — faltan refinamientos

### 1. Modal de licencia — falta el campo MAC del dispositivo

**Estado actual:** `validateLicense()` envía `mac_address: clientInfo.macAddress || ''` pero `clientInfo` viene de `/client-info` (PC), NO del dispositivo Android conectado. La regla del proyecto (`AGENTS.md`) dice: "El sistema usa email como identificador principal con detección automática de MAC desde dispositivos Android".

**Lo que tiene el HTML legado:** llama `wsapi.getDeviceMac({serial})` que hace `POST /device-mac` con el primer device conectado, y manda esa MAC en el payload de `validate-license`.

**Falta en Electron:**
- Antes de `validate-license`, hacer `POST /device-mac` con el primer serial conectado (de `app.devices[0]`).
- Inyectar esa MAC en el payload como `device_mac` (el backend Python ya lo soporta vía `body.get('mac_address') or body.get('device_mac')`).
- Si no hay dispositivos conectados, mostrar un aviso amable: "Conecta al menos un dispositivo Android antes de validar licencia".

**Ubicación del fix:** `app.js` línea ~4796 (`validateLicense`).

### 2. FlowRegister — botón Play envía a un endpoint que NO existe

**Estado actual:** `app.js` línea ~4036 hace `POST /autojs/run` con `filePath: '/sdcard/Download/Register.js'` y `countPerDevice`. El endpoint `/autojs/run` SÍ existe pero el script `Register.js` no se ha pusheado al device automáticamente como sí pasa con `Login.js` (que el backend pushea desde `BASE_DIR/Login.js`).

**Falta:**
- Validar que existe `Register.js` en raíz del proyecto. Si no, crear placeholder mínimo que reporte `error: "no implementado"` para no romper.
- En `local_adb_server.py`, `execute_autojs` necesita aceptar `Register.js` como path válido y push al device. Hoy solo prioriza `Login.js`.

**Alternativa rápida:** marcar `enabled: false` el botón Play de FlowRegister hasta que `Register.js` esté listo (consistente con la regla `AGENTS.md`: "solo FlowLogin ejecuta `Login.js` hoy").

### 3. Country flag y refresh de IP pública

**Estado actual:** `getFlagEmoji(countryCode)` y `refreshDevicePublicIp(serial)` existen como funciones globales pero **no están integradas en `renderDeviceTile`**. La tarjeta del dispositivo no muestra la bandera ni la IP pública.

**Falta en `renderDeviceTile()` (app.js línea ~1620):**
- Agregar badge con `${getFlagEmoji(device.countryCode)} ${device.publicIp || ''}` cuando exista.
- Botón opcional para refrescar la IP pública (icono globo) que llame `refreshDevicePublicIp(serial)`.
- En `loadDevices()`, llamar `refreshDevicePublicIp` para los seleccionados al arrancar (con throttle 300ms).

### 4. Trazabilidad de cuentas en panel izquierdo

**Estado actual:** `AGENTS.md` dice: "El dashboard debe mantener trazabilidad visual de cuentas en la sección izquierda: número de cuenta, asignación a dispositivo/clon y estado". El HTML legado tiene un panel `Mapa de cuentas` con filtros `Todas / Disponibles / Asignadas`, contador "X/Y visibles, A disponibles, B asignadas", botón reset.

**En Electron:** existe la persistencia de `flowdashboard.accounts.{total,valid,invalid}` y los textareas, pero **no hay vista de mapa de asignaciones**. Las bolitas de estado por clone existen sobre la tarjeta del device, pero no hay tabla/listado lineal "cuenta #5 → device 192.168.1.40 clone 3 → success".

**Falta:**
- Renderizar `accountTrace` debajo del textarea de FlowLogin con las primeras 80 cuentas y su estado.
- Botón colapsar/expandir.
- Filtros chip (`all / free / used`).
- Botón "Reset" para limpiar `accountAssignments` recordados.
- Función `assignAccountRecord(record, deviceId, clone, status)` para sincronizar.

### 5. Botón "Limpiar cuentas de seleccionados"

**Estado actual:** existe `clearDeviceAccounts()` pero no se ve como botón principal accesible. `AGENTS.md` dice: "Debajo de la grilla de dispositivos debe existir un botón pequeño para limpiar cuentas de dispositivos; debe pedir confirmación y, sin selección, limpiar todos los dispositivos conectados".

**Falta:** asegurar que el botón esté visible debajo del grid (en el panel "Comandos y paquetes / Dispositivos Conectados") con texto claro y confirmación.

### 6. APK Clones de Spotify — UI de gestión

**Estado actual:** `local_adb_server.py` tiene endpoints `/clone-apks`, `/clone-apks/install`, `/clone-apks/uninstall`, `/clone-apks/status` para los 10 paquetes `com.spotify.musid` → `com.spotify.musim`. **No hay UI en Electron** que los exponga.

**Falta:** un panel (puede ir en `Configuración → FlowVideo` o en una nueva sección) con:
- Estado de los 10 paquetes en los devices seleccionados.
- Botón "Instalar todos" (con confirmación).
- Botón "Desinstalar todos" (con confirmación danger).

---

## ❌ NO migrado — pendiente

### 1. Login inicial con detección automática de serial/MAC del dispositivo

**Lo que pides explícitamente.** El flujo debería ser:

1. Al abrir Electron, `loadSavedLicense()` lee `license.json`.
2. Si hay licencia guardada, `validateLicense` silenciosa con **MAC del primer device conectado** + email + key.
3. Si NO hay device conectado todavía → esperar a `loadDevices()` y luego validar.
4. Si la validación falla → mostrar `licenseModal` con email y key precargados.
5. Si NO hay licencia guardada → mostrar `licenseModal` desde el primer arranque.

**Lo que tiene Electron hoy:** la auto-validación al arrancar usa solo email+key sin MAC del device (commit en `app.js:4840`):
```js
body: JSON.stringify({ device_email: saved.email, license_key: saved.key })
```

**El backend (`local_adb_server.py:validate_device_license`) ESPERA recibir MAC**, y si no la recibe en este flow inicial, va a fallar la validación contra Supabase RPC, porque la tabla `app_device_registrations` la usa como identidad estable.

**Falta:**
- Esperar a que haya al menos 1 device antes de auto-validar (timeout 5s y luego mostrar modal con aviso).
- Ejecutar `POST /device-mac` con `app.devices[0].serial`.
- Incluir esa MAC en el payload junto con `client-info` del PC.
- Si la validación responde `device_status === 'pending'` o `'blocked'`, mostrar mensaje específico.

**Ubicación:** `app.js` línea ~4836 (la IIFE `(async () => { const saved = await loadSavedLicense(); ... })`).

### 2. JS scripts del usuario — UI de gestión

`local_adb_server.py` expone:
- `POST /autojs/push` (multipart): sube un .js a `/sdcard/Download/`.
- `POST /autojs/run` con `filePath`.
- `POST /autojs/stop`.
- `POST /autojs/prepare-overlay`.
- `POST /autojs/install-bundled` (instala AutoJs6 standalone).
- Y desde Etapa B: `POST /flowagent/run-script` (Rhino dentro del APK monolito), `/stop-script`, `/ocr-detect`, `/find-template`.

**Lo que existe en Electron:** dentro del Focus Mode, hay un panel "Auto.js" con todos esos handlers (`flow-touch.js` `_bindProPanelAutojs`). **PERO** está limitado al device en focus.

**Falta:** un panel **fuera del Focus Mode** para subir un .js y ejecutarlo en los **dispositivos seleccionados** del grid. Algo como:
- Sección en Configuración o FlowCategory llamada "Scripts".
- Botón "Subir .js" → push a todos los seleccionados.
- Botón "Ejecutar" → `POST /autojs/run` con `deviceIds: selectedSerials`.
- Botón "Detener" → `POST /autojs/stop`.
- Lista de scripts pusheados recientemente (con localStorage `flowdashboard.recentScripts`).

### 3. Conexión a base de datos / Supabase desde el frontend

**Estado actual:** TODO el contacto con Supabase pasa por `local_adb_server.py` (que usa `service_role` key). El frontend solo llama HTTP local. Esto es **correcto y seguro**: el `service_role` NO debe exponerse al cliente.

**Lo que probablemente preguntabas:** si el dashboard puede mostrar datos de Supabase (registros de licencias, logs de acceso, dispositivos aprobados). Hoy NO los muestra.

**Lo que existe:** `license_admin.html` es un panel **separado** que consume Supabase con la **anon key** y un login normal de usuario admin (con JWT). Es una herramienta para el administrador del producto, NO para el usuario final del dashboard. Decisión a tomar:

- **Opción A (recomendada):** dejar `license_admin.html` como herramienta separada del admin (dueño del software) y NO migrarla a Electron. Puede llamarse desde un botón "Panel Admin" oculto solo en modo desarrollador.
- **Opción B:** migrar `license_admin.html` como ventana Electron secundaria que se abre con un atajo o desde un menú "Admin → Licencias".

Mi recomendación: **Opción A**. El `license_admin.html` no debe ir en el bundle final que reciben los usuarios.

### 4. Help modal con contenido real

**Estado actual:** `openHelpModal()` y `closeHelpModal()` existen pero el contenido del modal (`#helpModal`) está como placeholder o vacío.

**Falta:** rellenar con secciones útiles:
- Cómo conectar dispositivos por WiFi (`adb tcpip 5555` + `adb connect`).
- Cómo preparar FlowAgent (botón en Configuración → FlowVideo).
- Cómo dividir cuentas (max 10 por device).
- Cómo usar Focus Mode (doble click).
- Cómo usar FlowDev Inspector (toggle pill-slider).
- Atajos de teclado (Esc, Ctrl+click, Shift+drag, etc.).
- Resolución de problemas comunes.

### 5. Modal de Planes con contenido real

**Estado actual:** `openPlansModal()` muestra un modal con "Hasta 10 dispositivos conectados / Panel FlowLogin y FlowRegister..." pero el botón "Comprar" probablemente no hace nada. `AGENTS.md` dice: "Planes ya no muestra la etiqueta lateral USD".

**Falta:** decidir si el modal redirige a una página externa (Stripe checkout, formulario de contacto, etc.) o solo muestra info estática.

---

## 🗑️ Lo que NO necesita migrarse

### 1. `wsapi_demo.html` — el HTML legado completo

Una vez completados los 5 pendientes y los 6 refinamientos, este archivo se puede:
- **Mover** a `legacy/wsapi_demo.html` (si quieres conservarlo como referencia de implementación).
- **Eliminar** del repo si ya no aporta nada.

`local_adb_server.py` lo sirve hoy en `STATIC_FILES`. Quitar las entradas de `STATIC_FILES`:
```python
STATIC_FILES = {
    "/wsapi_demo.html": "wsapi_demo.html",   # ← borrar
    "/wsapi.js": "wsapi.js",                  # ← borrar
    ...
}
```

### 2. `wsapi.js` — wrapper HTTP del legado

Reemplazado por `electron-app/src/renderer/api-client.js` (si existe) y por `fetch()` directo en `app.js`. Eliminar.

### 3. `streaming_ui_clean.js` — UI antigua de streaming

Hoy reemplazada por `stream-renderer.js` (WebP) y `stream-renderer-h264.js` (H.264). Eliminar.

### 4. `pro_panel.js` — toggle de vistas legado

`pro_panel.js` cambiaba entre vistas `pro-view-control / pro-view-streaming / pro-view-accounts` que ya no existen como concepto en Electron (la UI es continua, no hay toggle de vistas). Eliminar.

### 5. `debug_validar.js` — script de debugging temporal

Era un override de `validateLicense` con logging extra. La función ya está en `app.js` con manejo de errores propio. Eliminar.

### 6. `license_admin.html` — panel admin Supabase

Como expliqué arriba, es una herramienta separada del admin del producto. No va en el bundle del dashboard. Se mantiene como archivo independiente y se accede directamente desde el navegador con su URL.

### 7. `license_persistence.js` — gestor de persistencia de licencia

Reemplazado por las funciones `loadSavedLicense / saveLicense / clearLicense` ya integradas en `app.js`. Eliminar.

---

## Plan de migración propuesto (orden recomendado)

### Sesión 1 — Fixes críticos del flujo de arranque (1-2 h)

1. **Login inicial con MAC del device** (5.1 ❌) — ajustar `validateLicense` y la IIFE de auto-validación para esperar a tener al menos 1 device, ejecutar `POST /device-mac` y enviar la MAC al backend.
2. **Modal de licencia con campo MAC** (5.⚠.1) — incluir la MAC del primer device en el payload.
3. **Help modal con contenido real** (5.❌.4) — escribir contenido HTML útil dentro del modal.
4. **Modal de Planes** (5.❌.5) — decidir si abre Stripe / formulario externo o queda como info estática.

### Sesión 2 — UI de scripts y APK clones (1-2 h)

5. **Panel de Scripts JS** (5.❌.2) — agregar sección en Configuración con upload + run + stop sobre los seleccionados.
6. **Gestión de APK Clones de Spotify** (5.⚠.6) — agregar UI para los endpoints `/clone-apks/*`.
7. **Trazabilidad de cuentas** (5.⚠.4) — renderizar el mapa con filtros y reset.

### Sesión 3 — Detalles de UX (1 h)

8. **Country flag + IP pública en tarjetas** (5.⚠.3) — integrar en `renderDeviceTile`.
9. **Botón "Limpiar cuentas seleccionados"** (5.⚠.5) — asegurar visibilidad y confirmación.
10. **FlowRegister** (5.⚠.2) — decidir si lo dejamos disabled hasta tener `Register.js` o creamos un placeholder.

### Sesión 4 — Limpieza (30 min)

11. Mover archivos legados a `legacy/` o eliminarlos:
    - `wsapi_demo.html`, `wsapi.js`, `streaming_ui_clean.js`, `pro_panel.js`, `debug_validar.js`, `license_persistence.js`.
12. Quitar las entradas de `STATIC_FILES` en `local_adb_server.py`.
13. Actualizar `abrir_dashboard.bat` y similares para que NO inicien el demo HTML, o eliminar esos lanzadores y dejar solo `abrir_electron.bat` / `abrir_electron.ps1`.
14. Actualizar `PROJECT_CONTEXT.md` con el cierre de la migración.

---

## Cómo arrancar la migración

**Antes de tocar código:**

1. Crear restore point: `restore_points/PuntoAntesMigracionLegacy/` con copia de `electron-app/src/renderer/`, `wsapi_demo.html` y `local_adb_server.py`.
2. Confirmar que la rama git está limpia (`git status`).

**Para cada sesión:**

1. Leer la sección correspondiente en este documento.
2. Implementar el fix en `electron-app/src/renderer/app.js` (o el archivo que corresponda).
3. Probar manualmente: arrancar `abrir_electron.ps1`, verificar que el flujo funciona.
4. Actualizar `PROJECT_CONTEXT.md` con un bloque "Cambios MIGRACION_LEGACY (fecha)" describiendo qué se hizo.
5. Commit incremental con mensaje claro (ej. `migracion: login inicial con MAC del device`).

---

## Notas de compatibilidad

- **NO eliminar `local_adb_server.py:STATIC_FILES`** hasta confirmar que ningún script o batch externo necesita servir el HTML legado en `localhost:8765/wsapi_demo.html`.
- **`license_admin.html` se queda independiente.** No migrarlo dentro del Electron.
- **El backend Python NO cambia** durante la migración. Todos los endpoints siguen funcionando igual.
- **El backend C# NO cambia.** Sigue sirviendo el WebSocket WebP en `:5000/ws/streaming` para fallback de streaming.

---

**Final:** Después de cerrar las áreas pendientes, el producto Electron es completo y `wsapi_demo.html` se puede archivar. El proyecto queda con un solo punto de entrada (`abrir_electron.bat`) y una sola UI (`electron-app/`).
