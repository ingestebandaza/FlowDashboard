# Focus PRO Panel - Requirements

Fecha: 2026-05-26
Punto de restauracion previo: `restore_points/PuntoAntesPanelPro`

## Objetivo

Reorganizar el panel lateral izquierdo del FlowTouch Focus Mode en una columna PRO desplegable que permita ejecutar acciones por dispositivo enfocado, sin afectar el resto del programa.

## Reglas que respetamos (no negociables)

- No tocamos FlowLogin / FlowRegister / Inspector / streaming / FlowAgent fuera de lo estrictamente nuevo.
- FlowTouch sigue Off por defecto fuera de Focus Mode. La grilla principal jamas envia taps.
- FlowAgent sigue siendo canal obligatorio para gestos. No se introduce fallback ADB silencioso para tap/swipe.
- No se activa nada peligroso automaticamente (uninstall, clear cache, install, comandos ADB libres, reboot, power off, transferencia de archivos pesados).
- No emojis nuevos en HTML, todo SVG inline.
- Respetar `prefers-reduced-motion`.

## Funcionalidad requerida

### Switch de Control
- Switch ON/OFF animado en lugar del boton actual `Activar control`.
- ON automatico al abrir Focus Mode.
- Antes de armar valida `accessibility=true`. Si no, queda en OFF y avisa.
- Debounce inicial de 350 ms tras abrir para ignorar el primer click accidental.
- Auto-disarm sigue activo (Fase 9 FlowTouch).

### Navegacion
- Botones `Back`, `Home`, `Recents` con icono SVG inline antes del nombre.
- Glow en hover, color por estado.

### Apps instaladas
- Lista por defecto solo apps de terceros (`pm list packages -3`), con toggle para ver todas.
- Busqueda inline por nombre de paquete o etiqueta.
- Por item: `Abrir`, `Cerrar (force-stop)`, `Clear cache`, `Desinstalar`, `Copiar nombre de paquete`.
- Boton `Instalar APK desde PC` que sube el archivo via multipart y ejecuta `adb install -r`.

### Archivos
- Drag and drop o picker para enviar archivos desde el PC.
- Ruta destino editable (default `/sdcard/Download`).
- Limite 500 MB por archivo.
- Backend nuevo: `POST /file-push` (multipart).

### ADB Shell
- Campo de texto libre.
- Sin filtros, cualquier comando.
- Confirmacion visible y log con resultado.
- Reusa endpoint existente `POST /adb`.

### Auto.js
- Picker libre del filesystem del PC.
- Solo enviar `.js` desde el PC; nunca lee desde el telefono.
- Push automatico con cache por hash a `/sdcard/Download/flowdashboard_autojs/<nombre>.js`.
- Toggle "forzar reenviar" para saltarse la cache.
- Boton `Preparar Auto.js` que concede permiso `SYSTEM_ALERT_WINDOW` por `appops` (Opcion A). Si falla, fallback abre la pantalla de overlay (Opcion B). Solo bajo click del usuario.
- Reusa endpoints existentes `POST /autojs/run` y `POST /autojs/stop`.

### Sistema
- `Abrir Configuraciones`: `am start -a android.settings.SETTINGS`.
- Atajos: Wi-Fi, Apps, Idioma, Accesibilidad.

### Energia (criticos)
- `Reiniciar dispositivo` (`adb reboot`).
- `Apagar dispositivo` (`adb reboot -p` con fallback `adb shell svc power shutdown`).
- Doble confirmacion obligatoria.
- Color rojo / icono distinto para evitar accidentes.

### FlowKeyboard
- Convertir el bloque actual en acordeon con animacion.
- Mostrar/ocultar entero conserva el flujo: estado, Preparar, Type, Clear, Bksp, Enter, Next, Done.

### Persistencia
- Estado abierto/cerrado de cada seccion en `localStorage` con clave `flowdashboard.focusPanel.expanded`.
- Orden fijo (no se permite reordenar en esta version).

## Endpoints nuevos en `local_adb_server.py`

| Endpoint | Metodo | Accion | Notas |
|---|---|---|---|
| `/apps/list` | POST | `pm list packages [-3]` + label opcional via `dumpsys package` | Por dispositivo |
| `/apps/launch` | POST | `monkey -p <pkg> 1` o `agent_result launchPackage` | Reusa launch existente |
| `/apps/force-stop` | POST | `am force-stop <pkg>` | |
| `/apps/clear-cache` | POST | `pm clear <pkg>` | Confirmacion en UI |
| `/apps/uninstall` | POST | `pm uninstall <pkg>` | Confirmacion en UI |
| `/apps/install` | POST multipart | sube apk a temp y `adb install -r` | NUEVO multipart |
| `/file-push` | POST multipart | `adb push <archivo> <ruta>` | NUEVO multipart |
| `/system/open-settings` | POST | `am start -a <action>` | Acepta atajo Wi-Fi/Apps/Idioma/Accesibilidad |
| `/power/reboot` | POST | `adb reboot` | Doble confirmacion en UI |
| `/power/shutdown` | POST | `adb reboot -p` con fallback `svc power shutdown` | Doble confirmacion en UI |
| `/autojs/prepare-overlay` | POST | `appops set <pkg_autojs> SYSTEM_ALERT_WINDOW allow` con fallback abrir Settings | Manual |
| `/autojs/push` | POST multipart | sube `.js` a `/sdcard/Download/flowdashboard_autojs/` | Cache por hash |

## No-Goals

- No reordenar secciones por drag and drop.
- No filtrar comandos ADB.
- No introducir fallback ADB para gestos en FlowTouch.
- No tocar APK FlowAgent.

## Riesgos y mitigaciones

| Riesgo | Mitigacion |
|---|---|
| Multipart en HTTP server stdlib | Usar `cgi.FieldStorage` o parser propio con disco temp |
| Push de APK grande | Stream a disco antes de `adb install`, limite 500 MB |
| Comando ADB destructivo accidental | Confirmacion explicita en UI antes de enviar |
| Reboot/shutdown accidental | Doble confirmacion + boton rojo separado |
| Auto.js sin overlay | Boton manual `Preparar Auto.js` con appops + fallback Settings |
| Ruptura de FlowLogin/FlowRegister | No tocar `start_flowlogin_agent_jobs` ni handlers existentes |
