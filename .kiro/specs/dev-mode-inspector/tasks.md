# Implementation Plan: Dev Mode Inspector

## Overview

Plan de implementación del Inspector de UI Android para FlowDashboard Pro. Las tareas están ordenadas de menor a mayor dependencia: primero la infraestructura base (sin dependencias externas), luego los endpoints del backend Python, después el frontend del inspector que consume esos endpoints, y finalmente el pulido y robustez transversal.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1", "2", "4", "5", "7", "9"]
    },
    {
      "wave": 2,
      "tasks": ["3", "4.1", "6", "8", "10", "11"]
    },
    {
      "wave": 3,
      "tasks": ["12", "13", "19"]
    },
    {
      "wave": 4,
      "tasks": ["14", "15", "18", "20"]
    },
    {
      "wave": 5,
      "tasks": ["16", "17"]
    },
    {
      "wave": 6,
      "tasks": ["21", "22", "23", "24", "25"]
    }
  ]
}
```

## Tasks

### FASE 1 — Infraestructura base (sin dependencias)

- [x] 1. Agregar Toggle Modo Normal/Dev al sidebar
  - Insertar el bloque HTML del Toggle_Modo en `electron-app/src/renderer/index.html`, inmediatamente debajo del logotipo de FlowDashboard Pro y antes de cualquier otro control del sidebar.
  - El toggle usa estructura "pill slider": dos etiquetas ("Normal" con icono SVG de grilla, "Dev" con icono SVG de código) y un indicador deslizante.
  - Añadir en `electron-app/src/renderer/styles.css` las reglas `.toggle-modo`, `.toggle-modo__pill`, `.toggle-modo__indicator` con paleta `#000000` / `#00F5D4` / `#006F4F`, transición `ease-in-out` 250 ms y soporte `prefers-reduced-motion`.
  - En `electron-app/src/renderer/app.js`: función `initToggleModo()` que lee `localStorage.getItem('flowdashboard.devMode')` al arrancar y aplica la clase `body.dev-mode` según el valor; listener de clic que alterna la clase, persiste en `localStorage` y dispara el evento `devModeChanged`.
  - La transición entre modos usa `opacity` + `pointer-events` con duración < 300 ms (cross-fade CSS).
  - Cuando `Modo_Desarrollador` está activo: `.device-grid` y `.accounts-panel` reciben `display:none`; `#inspector-root` recibe `display:flex`.
  - Cuando `Modo_Normal` está activo: situación inversa, sin destruir canvas WebP activos.
  - Si el Servidor_Python no responde al activar Dev, mostrar banner `#inspector-error-banner` con texto "Servidor ADB no disponible".
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 10.5_


- [x] 2. Crear estructura HTML/CSS del Inspector (tres paneles vacíos)
  - Añadir en `electron-app/src/renderer/index.html` el contenedor `<div id="inspector-root">` con tres hijos: `#inspector-panel-tree` (30%), `#inspector-panel-canvas` (40%), `#inspector-panel-props` (30%).
  - Separadores de 1 px color `#006F4F` opacidad 0.6 entre paneles, sin sombras.
  - Barra de herramientas superior `#inspector-toolbar` con: dropdown de dispositivo, botón "Capturar UI", Selector_Deteccion, botón "Modo Fallback", botón "Auto-detectar", etiqueta del método activo.
  - Panel árbol: barra de búsqueda `#inspector-search` (input + select de criterio) + contenedor `#inspector-tree-container` vacío + spinner `#inspector-tree-spinner` oculto.
  - Panel canvas: `<canvas id="inspector-canvas">` con aspect-ratio 9/16 + capa overlay `<canvas id="inspector-overlay">` superpuesta en position:absolute.
  - Panel propiedades: mensaje vacío `#inspector-props-empty` + tabla `#inspector-props-table` oculta + sección de acciones `#inspector-actions`.
  - Panel fallback `#inspector-fallback-panel` oculto: aviso de estado, campo de búsqueda, botón "Buscar en UI", lista de resultados `#inspector-blind-results`.
  - Fuente monoespaciada `'Courier New', monospace` para valores de atributos y nombres de clase.
  - Todas las reglas CSS en `electron-app/src/renderer/styles.css` bajo el selector `#inspector-root`.
  - _Requirements: 10.1, 10.2, 10.3, 10.7_


- [x] 3. Crear archivo `inspector.js` con clase `DevInspector` (esqueleto)
  - Crear `electron-app/src/renderer/inspector.js` con la clase `DevInspector`.
  - Constructor: recibe referencias a los elementos DOM del inspector (`treeContainer`, `overlayCanvas`, `propsTable`, etc.) y al objeto `streamRenderer` existente.
  - Propiedades de estado: `selectedSerial`, `currentNodes` (array plano), `selectedNodeId`, `expansionState` (Map resourceId→boolean), `detectionMode`, `isFallbackActive`, `searchDebounceTimer`.
  - Métodos vacíos (stubs) con JSDoc: `init()`, `populateDeviceDropdown(devices)`, `selectDevice(serial)`, `captureUI()`, `renderTree(nodes)`, `selectNode(nodeId)`, `drawHighlight(node, provisional)`, `clearHighlight()`, `handleCanvasClick(event)`, `renderProps(node)`, `clearProps()`, `executeAction(action, node)`, `showToast(message, color, duration)`, `startSearch(query, field)`, `clearSearch()`, `activateFallback()`, `deactivateFallback()`, `blindSearch(query)`, `setDetectionMode(mode)`, `saveState()`, `restoreState()`.
  - Exportar la clase con `module.exports = { DevInspector }`.
  - Importar y instanciar `DevInspector` en `app.js` dentro de `initToggleModo()`, pasando las referencias DOM.
  - _Requirements: 1.3, 1.4, 10.6_


---

### FASE 2 — Backend Python (endpoints del inspector)

- [x] 4. Endpoint `/inspector/dump` — UIAutomator dump
  - En `local_adb_server.py`, añadir el handler `handle_inspector_dump(data)` para `POST /inspector/dump`.
  - Validar que `serial` no esté vacío → HTTP 400 `{"error": "El campo serial es requerido"}`.
  - Verificar que el dispositivo esté `online` → HTTP 404 si no.
  - Llamar a la función existente `dump_ui(serial)` con timeout de 10 s; si supera el timeout → HTTP 408 `{"error": "Timeout al capturar UI del dispositivo"}`.
  - Parsear el XML resultante con `xml.etree.ElementTree`; extraer todos los nodos con atributos: `index`, `text`, `resource-id` (→ `resourceId`), `class`, `package`, `content-desc`, `checkable`, `checked`, `clickable`, `enabled`, `focusable`, `focused`, `scrollable`, `long-clickable`, `password`, `selected`, `bounds`.
  - Calcular `centerX` y `centerY` a partir de `bounds` `[left,top][right,bottom]`.
  - Devolver `{"ok": true, "nodes": [...], "xml": "..."}`.
  - _Requirements: 3.2, 3.5, 9.1, 9.7, 9.8, 12.1_

  - [x] 4.1 Función auxiliar `parse_ui_xml(xml_string) → list[dict]`
    - Extraer la función de parseo de XML a una función independiente reutilizable por otros métodos de detección.
    - Normalizar `bounds` de string `"[l,t][r,b]"` a dict `{left, top, right, bottom}` y calcular `centerX`, `centerY`.
    - _Requirements: 9.1, 15.1, 15.2_


- [x] 5. Endpoints de acciones ADB: tap, long-press, input-text, scroll
  - En `local_adb_server.py`, añadir los cuatro handlers con validación de `serial` (HTTP 400/404 en cada uno):

  - [x] 5.1 `POST /inspector/tap`
    - Acepta `{"serial", "x", "y"}`.
    - Llama a `adb_tap(serial, x, y)`.
    - Devuelve `{"ok": true}` o `{"ok": false, "error": "..."}`.
    - _Requirements: 6.2, 9.2_

  - [x] 5.2 `POST /inspector/long-press`
    - Acepta `{"serial", "x", "y", "duration"}` (`duration` opcional, default 800 ms).
    - Ejecuta `adb_shell(serial, f"input swipe {x} {y} {x} {y} {duration}")`.
    - Devuelve `{"ok": true}` o error.
    - _Requirements: 6.4, 9.3_

  - [x] 5.3 `POST /inspector/input-text`
    - Acepta `{"serial", "x", "y", "text"}`.
    - Llama a `adb_tap(serial, x, y)` para enfocar, luego `adb_input_text(serial, text)`.
    - Devuelve `{"ok": true}` o error.
    - _Requirements: 6.6, 9.4_

  - [x] 5.4 `POST /inspector/scroll`
    - Acepta `{"serial", "x", "y1", "y2", "direction"}`.
    - Para `direction="up"`: swipe de `(x, y2)` a `(x, y1)` en 400 ms.
    - Para `direction="down"`: swipe de `(x, y1)` a `(x, y2)` en 400 ms.
    - Devuelve `{"ok": true}` o error.
    - _Requirements: 6.8, 9.5_


- [x] 6. Endpoint `/inspector/blind-search`
  - Acepta `{"serial", "query", "field"}` donde `field` puede ser `"any"`, `"text"`, `"resourceId"` o `"class"`.
  - Ejecuta `dump_ui(serial)` y parsea el XML con `parse_ui_xml()`.
  - Filtra nodos con comparación case-insensitive según `field`.
  - Devuelve `{"ok": true, "results": [...]}` (lista vacía si no hay coincidencias).
  - Si `dump_ui` falla, devuelve error descriptivo.
  - _Requirements: 8.4, 8.7, 9.6_

- [x] 7. Endpoint `/inspector/accessibility-dump`
  - En `local_adb_server.py`, añadir `handle_inspector_accessibility_dump(data)` para `POST /inspector/accessibility-dump`.
  - Localizar el agente conectado por `serial` en el mapa de agentes activos.
  - Enviar el comando `{"type": "get_accessibility_tree"}` al socket del APK FlowAgent en puerto 8766 via el canal existente.
  - Esperar respuesta con timeout de 10 s; si supera → HTTP 408.
  - Normalizar el árbol de accesibilidad recibido al formato de Nodos del Inspector usando `normalize_node(raw, method="accessibility")`.
  - Devuelve `{"ok": true, "nodes": [...]}`.
  - _Requirements: 12.2, 12.3_


- [x] 8. Endpoint `/inspector/native-detect` (todos los métodos nativos)
  - En `local_adb_server.py`, añadir `handle_inspector_native_detect(data)` para `POST /inspector/native-detect`.
  - Acepta `{"serial", "method", "options"}`.
  - Despachar según `method`:
    - `"uiautomator"` → reutilizar lógica de tarea 4.
    - `"accessibility"` → reutilizar lógica de tarea 7.
    - `"dumpsys"` → `adb_shell(serial, "dumpsys window windows")`; parsear paquete en foco y actividad actual; devolver como nodo único de contexto.
    - `"viewserver"` → `adb_shell(serial, "service call window 1 i32 4939")` + `adb forward tcp:4939 tcp:4939`; conectar al ViewServer y leer árbol de vistas; normalizar nodos.
    - `"screencap_ocr"` → `adb exec-out screencap -p` + Tesseract OCR si disponible; devolver elementos de texto con posiciones aproximadas.
    - `"wm"` → `adb_shell(serial, "wm size")` + `adb_shell(serial, "wm density")`; devolver `{"width", "height", "density"}` como metadatos (no nodos).
    - `"pm_dump"` → `adb_shell(serial, "pm dump [package_activo]")`; parsear versión, permisos, actividades; devolver como metadatos.
    - `"logcat"` → `adb_shell(serial, "logcat -d -v brief -t 100")`; devolver últimas 100 líneas filtradas.
  - Normalizar todos los resultados con `normalize_node(raw, method=method)`.
  - Devuelve `{"ok": true, "nodes": [...], "meta": {...}}`.
  - _Requirements: 12.1, 12.2, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10_


- [x] 9. Endpoints CDP: `/inspector/cdp-connect` y `/inspector/cdp-dump`
  - En `local_adb_server.py`, añadir dos handlers:

  - [x] 9.1 `POST /inspector/cdp-connect`
    - Ejecuta `adb -s {serial} forward tcp:9222 localabstract:chrome_devtools_remote`.
    - Hace GET a `http://localhost:9222/json` para obtener la lista de targets CDP.
    - Devuelve `{"ok": true, "targets": [...]}`.
    - _Requirements: 13.2_

  - [x] 9.2 `POST /inspector/cdp-dump`
    - Acepta `{"serial", "target_id"}`.
    - Conecta al target CDP via WebSocket en `ws://localhost:9222/devtools/page/{target_id}`.
    - Envía `DOM.getDocument` y `DOM.querySelectorAll('*')` para obtener el árbol DOM.
    - Para cada nodo, obtiene `getBoundingClientRect` via `Runtime.evaluate`.
    - Normaliza al formato de Nodos con: `tagName`, `id`, `className`, `textContent`, `href`, `src`, `type`, `value`, `disabled`, `hidden`, `bounds`.
    - Devuelve `{"ok": true, "nodes": [...]}`.
    - _Requirements: 13.3, 13.4_

- [x] 10. Endpoint `/inspector/web-detect`
  - En `local_adb_server.py`, añadir `handle_inspector_web_detect(data)` para `POST /inspector/web-detect`.
  - Acepta `{"serial", "method", "options"}` donde `method` puede ser `"cdp"`, `"js_inject"`, `"react_native"`, `"ionic"`, `"flutter"`, `"network_intercept"`.
  - Despachar según `method` e implementar la lógica de detección correspondiente (CDP ya implementado en tarea 9; los demás métodos usan detección de presencia de archivos via `adb shell ls` y luego CDP o Dart VM Service).
  - Normalizar resultados con `normalize_node(raw, method=method)`.
  - Si WebView no tiene depuración habilitada, devolver error con mensaje específico.
  - Devuelve `{"ok": true, "nodes": [...]}`.
  - _Requirements: 13.1, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10_


- [x] 11. Endpoint `/inspector/auto-detect`
  - En `local_adb_server.py`, añadir `handle_inspector_auto_detect(data)` para `POST /inspector/auto-detect`.
  - Probar métodos en orden de prioridad: `uiautomator` → `accessibility` → `cdp` → `dumpsys` → `screencap_ocr`.
  - Para cada método, medir tiempo de respuesta y verificar que el resultado tenga al menos 1 nodo válido.
  - Devolver el primer método exitoso: `{"ok": true, "method": "...", "nodes": [...], "timings": {"uiautomator": 320, ...}}`.
  - _Requirements: 14.7_

---

### FASE 3 — Frontend Inspector (depende de Fase 2)

- [x] 12. Selector de dispositivo con dropdown
  - En `DevInspector.populateDeviceDropdown(devices)`: construir las `<option>` del `<select id="inspector-device-select">` con serial, nombre personalizado (de `device_names.json` via `app.js`) e indicador de estado (punto verde/rojo).
  - En `DevInspector.init()`: llamar a `populateDeviceDropdown` con los dispositivos `online` actuales al activar Modo_Desarrollador.
  - Listener `change` en el dropdown: llama a `DevInspector.selectDevice(serial)`.
  - `selectDevice(serial)`: guarda `this.selectedSerial`, inicia el Preview_Canvas reutilizando `streamRenderer.attachCanvas(serial, inspectorCanvas)` sin duplicar conexiones WebSocket.
  - Si no hay dispositivos online: mostrar opción deshabilitada "No hay dispositivos conectados" y deshabilitar controles de inspección.
  - El polling existente de `app.js` (30 s) dispara `devModeChanged` o un evento `devicesUpdated` que llama a `populateDeviceDropdown` para mantener el dropdown actualizado.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_


- [x] 13. Panel árbol UI colapsable con datos reales
  - Implementar `DevInspector.captureUI()`: hace `POST /inspector/dump` (o el endpoint del método de detección activo), muestra el spinner `#inspector-tree-spinner`, oculta el spinner al terminar.
  - Implementar `DevInspector.renderTree(nodes)`: construye el árbol colapsable en `#inspector-tree-container` usando `<ul>/<li>` recursivos.
    - Cada nodo muestra: nombre corto de `class` (sin paquete) + `text` o `content-desc` como etiqueta secundaria.
    - Niveles 1-3: expandidos por defecto. Nivel 4+: colapsados por defecto.
    - Botón de expansión `▶/▼` por nodo con listener que alterna `expansionState`.
  - Implementar `DevInspector._preserveExpansionState(oldNodes, newNodes)`: compara por `resourceId` o ruta de índices para mantener el estado de expansión al refrescar.
  - Si el dump falla con HTTP 408: mostrar mensaje de error con botón "Reintentar" que llama a `captureUI()`.
  - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 14. Preview canvas con Highlight_Overlay
  - Implementar `DevInspector.drawHighlight(node, provisional)`:
    - Calcular factor de escala: `scaleX = canvas.width / 1080`, `scaleY = canvas.height / 1920`.
    - Dibujar en `#inspector-overlay` (canvas superpuesto) el rectángulo escalado con borde `#00F5D4` 2 px y fondo `rgba(0,245,212,0.15)`.
    - Si `provisional=true` (hover): opacidad 0.5.
    - Tiempo de redibujado < 50 ms (usar `requestAnimationFrame`).
  - Implementar `DevInspector.clearHighlight()`: limpiar el canvas overlay con `ctx.clearRect`.
  - El `#inspector-canvas` mantiene aspect-ratio 9:16 via CSS `aspect-ratio: 9/16` y `object-fit: contain`.
  - El stream WebP se renderiza en `#inspector-canvas` reutilizando `stream-renderer.js` sin modificarlo.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7, 10.4_


- [x] 15. Selección bidireccional árbol ↔ canvas
  - Implementar `DevInspector.selectNode(nodeId)`:
    - Marcar el nodo con clase `inspector-node--selected` en el árbol.
    - Expandir la rama hasta el nodo seleccionado.
    - Hacer scroll del árbol para que el nodo sea visible (`scrollIntoView`).
    - Llamar a `drawHighlight(node, false)`.
    - Llamar a `renderProps(node)`.
  - Implementar `DevInspector.handleCanvasClick(event)`:
    - Calcular coordenadas nativas: `nativeX = event.offsetX / scaleX`, `nativeY = event.offsetY / scaleY`.
    - Buscar el nodo más pequeño cuyo `bounds` contenga `(nativeX, nativeY)` iterando `currentNodes`.
    - Si no hay árbol capturado: mostrar mensaje "Captura el árbol UI primero para habilitar la selección por clic".
    - Si se encuentra nodo: llamar a `selectNode(nodeId)`.
  - Listener `mousemove` en `#inspector-tree-container`: al hacer hover sobre un nodo, llamar a `drawHighlight(node, true)` (provisional).
  - Listener `mouseleave` en `#inspector-tree-container`: restaurar el highlight del nodo seleccionado activo o limpiar.
  - _Requirements: 4.5, 4.6, 10.4_

- [x] 16. Panel de propiedades del nodo seleccionado
  - Implementar `DevInspector.renderProps(node)`:
    - Ocultar `#inspector-props-empty`, mostrar `#inspector-props-table`.
    - Renderizar cada atributo como fila `<tr>`: nombre del atributo + valor.
    - Atributos `clickable`, `enabled`, `focusable`, `scrollable` con valor `true`: color `#00F5D4`. Con valor `false`: color `#555555`.
    - Mostrar `centerX` y `centerY` calculados desde `bounds`.
    - Mostrar `detectionSource` (método que generó el nodo).
    - Listener `click` en cada celda de valor: `navigator.clipboard.writeText(value)` → si exitoso, mostrar "Copiado" durante 1500 ms en la celda.
  - Implementar `DevInspector.clearProps()`: ocultar tabla, mostrar mensaje vacío.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 15.4_


- [x] 17. Acciones sobre el nodo seleccionado (tap, long press, input, scroll)
  - Implementar `DevInspector.renderActions(node)` dentro del panel derecho `#inspector-actions`:
    - Si `node.clickable === true`: mostrar botón "Tap" habilitado.
    - Si `node['long-clickable'] === true`: mostrar botón "Long Press" habilitado.
    - Si `node.class === 'android.widget.EditText'`: mostrar `<input type="text">` + botón "Ingresar Texto".
    - Si `node.scrollable === true`: mostrar botones "Scroll Arriba" y "Scroll Abajo".
  - Implementar `DevInspector.executeAction(action, node)`:
    - `tap`: `POST /inspector/tap` con `{serial, x: node.centerX, y: node.centerY}`.
    - `long-press`: `POST /inspector/long-press` con `{serial, x, y}`.
    - `input-text`: `POST /inspector/input-text` con `{serial, x, y, text}`.
    - `scroll-up`: `POST /inspector/scroll` con `{serial, x, y1: node.bounds.top, y2: node.bounds.bottom, direction: "up"}`.
    - `scroll-down`: igual con `direction: "down"`.
  - Mostrar spinner en `#inspector-actions` durante la ejecución.
  - Si éxito: `showToast("Acción ejecutada", "#00F5D4", 1500)` + botón "Refrescar UI".
  - Si error: `showToast(errorMsg, "#FF4444", 3000)`.
  - _Requirements: 6.1, 6.3, 6.5, 6.7, 6.9, 6.10_

- [x] 18. Barra de búsqueda con debounce
  - Implementar `DevInspector.startSearch(query, field)`:
    - Debounce de 300 ms usando `clearTimeout(this.searchDebounceTimer)` + `setTimeout`.
    - Si `query.length < 2`: llamar a `clearSearch()`.
    - Filtrar `currentNodes` por `field` (text/resourceId/class) con comparación case-insensitive.
    - Resaltar nodos coincidentes con clase `inspector-node--match` (fondo `rgba(0,245,212,0.2)`).
    - Mostrar contador "N resultados" en `#inspector-search-count`.
    - Habilitar botones "Anterior" / "Siguiente" si hay resultados; deshabilitar si no.
    - Si no hay resultados: mostrar "Sin resultados para '[término]'" y limpiar overlay.
  - Implementar navegación entre resultados: `this.searchResultIndex` avanza/retrocede; cada cambio llama a `selectNode(id)`.
  - Implementar `DevInspector.clearSearch()`: restaurar árbol completo, limpiar resaltados de búsqueda, mantener nodo seleccionado activo.
  - Listener `input` en `#inspector-search-input` → `startSearch(value, selectedField)`.
  - Listener `change` en `#inspector-search-field` → re-ejecutar búsqueda si hay término activo.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_


- [x] 19. Selector de modo de detección (Nativa / Web)
  - Implementar `DevInspector.renderDetectionSelector()` en `#inspector-toolbar`:
    - Dos grupos de chips: "Nativa" (acento `#00F5D4`) y "Web" (acento `#a78bfa`).
    - Cada grupo es expandible; al expandir muestra los métodos disponibles como chips con nombre corto, icono SVG representativo e indicador de disponibilidad (punto verde/amarillo/rojo).
    - Chip activo: fondo `rgba(0,245,212,0.2)` + borde `#00F5D4` (Nativa) o `rgba(167,139,250,0.2)` + borde `#a78bfa` (Web).
    - Tooltip en hover: nombre completo, descripción, requisitos, compatibilidad.
    - Etiqueta compacta del método activo junto al selector, actualizada en tiempo real.
  - Implementar `DevInspector.setDetectionMode(mode)`:
    - Guardar en `localStorage` bajo `flowdashboard.inspector.detectionMode`.
    - Limpiar `currentNodes` y mostrar mensaje "Modo de detección cambiado a [nombre]. Captura el árbol UI para continuar."
  - Botón "Auto-detectar": llama a `POST /inspector/auto-detect` y aplica el método devuelto.
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [x] 20. Modo Fallback / Búsqueda Ciega
  - Implementar `DevInspector.activateFallback()`:
    - Ocultar `#inspector-panel-canvas`, mostrar `#inspector-fallback-panel`.
    - Mostrar aviso "Modo Fallback activo — sin preview de pantalla" con fondo `#1a1a1a` y borde `#006F4F`.
    - Guardar estado previo del árbol y canvas para restauración.
  - Implementar `DevInspector.blindSearch(query)`:
    - `POST /inspector/blind-search` con `{serial, query, field: "any"}`.
    - Mostrar spinner durante la búsqueda.
    - Renderizar resultados en `#inspector-blind-results` como tarjetas: class (nombre corto), text, resourceId, centerX, centerY, clickable, enabled.
    - Cada tarjeta tiene botón "Tap" que llama a `executeAction("tap", result)`.
    - Si falla: mostrar "No se pudo capturar el árbol UI. La app puede estar bloqueando uiautomator." con sugerencias.
  - Implementar `DevInspector.deactivateFallback()`:
    - Restaurar `#inspector-panel-canvas` y el árbol al estado previo.
    - Ocultar `#inspector-fallback-panel`.
  - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6, 8.7, 8.8, 8.9_


---

### FASE 4 — Pulido y robustez

- [x] 21. Auto-detección de mejor método
  - Conectar el botón "Auto-detectar" del `Selector_Deteccion` al endpoint `POST /inspector/auto-detect` (implementado en tarea 11).
  - En `DevInspector`: al recibir la respuesta, llamar a `setDetectionMode(result.method)` y luego `captureUI()` automáticamente.
  - Mostrar en la barra de herramientas los tiempos de cada método probado como tooltip informativo.
  - Si el método seleccionado falla durante una captura posterior, intentar el siguiente en la cadena de prioridad y notificar: "Método [nombre] falló — usando [fallback] como alternativa."
  - _Requirements: 11.5, 14.6, 14.7_

- [x] 22. Normalización unificada de nodos (`normalize_node`)
  - En `local_adb_server.py`, implementar la función `normalize_node(raw, method) → dict` que produce el formato unificado:
    - Campos: `id` (hash único por captura), `type` (nativo|web), `method`, `class` o `tagName`, `text`, `resourceId` o `domId`, `bounds` (`{left, top, right, bottom, width, height}`), `centerX`, `centerY`, `clickable`, `enabled`, `focusable`, `scrollable`, `children`, `parent`, `depth`, `attributes`, `detectionSource`.
  - Para métodos Web: transformar coordenadas relativas al WebView a coordenadas absolutas del dispositivo sumando el offset del WebView (obtenido via `uiautomator dump` o CDP `DOM.getBoxModel`).
  - Si un nodo no tiene `bounds` válidos: asignar `bounds: null`, `centerX: null`, `centerY: null`.
  - Aplicar `normalize_node` en todos los endpoints de detección (tareas 4, 7, 8, 9, 10, 11).
  - En el frontend, `DevInspector` debe deshabilitar tap/scroll para nodos con `centerX: null` y mostrar icono de advertencia en el árbol.
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_


- [x] 23. Sistema de toasts y manejo de errores
  - Implementar `DevInspector.showToast(message, color, duration)`:
    - Crear elemento `<div class="inspector-toast">` con `background: color`, posicionado en la esquina inferior derecha del inspector.
    - Auto-destruir tras `duration` ms.
    - Si `color === "#FF4444"` y el mecanismo de toast falla (DOM no disponible), mostrar el error en `#inspector-props-table` como texto de color `#FF4444`.
    - Nunca bloquear la UI (no usar `alert()`).
  - Añadir en `styles.css` las reglas `.inspector-toast` con `position: fixed`, `z-index: 99999`, `border-radius: 4px`, `padding: 8px 16px`, `font-size: 13px`.
  - Todos los handlers de `executeAction` y `captureUI` deben capturar excepciones de red y llamar a `showToast` con el mensaje de error.
  - _Requirements: 6.9, 6.10, 10.8_

- [x] 24. Persistencia de estado en localStorage
  - Implementar `DevInspector.saveState()`: serializar y guardar en `localStorage`:
    - `flowdashboard.devMode` → modo activo (ya implementado en tarea 1).
    - `flowdashboard.inspector.detectionMode` → método de detección activo.
    - `flowdashboard.inspector.selectedSerial` → serial del dispositivo seleccionado.
    - `flowdashboard.inspector.expansionState` → mapa de expansión del árbol (JSON).
  - Implementar `DevInspector.restoreState()`: leer las claves anteriores al inicializar y aplicar el estado guardado.
  - Llamar a `saveState()` en cada cambio de: modo, serial, método de detección, expansión de nodo.
  - Llamar a `restoreState()` en `DevInspector.init()`.
  - _Requirements: 1.4, 11.2_


- [x] 25. Soporte `prefers-reduced-motion`
  - En `electron-app/src/renderer/styles.css`, añadir el bloque `@media (prefers-reduced-motion: reduce)` que:
    - Establece `transition: none !important` y `animation: none !important` para `.toggle-modo__indicator`, `.inspector-toast`, `.inspector-node--selected`, `.inspector-node--match`, `#inspector-root` (cross-fade).
    - Mantiene activos los spinners SVG (`#inspector-tree-spinner`, spinners de acciones) con `animation: spin 1s linear infinite` para indicar estado del sistema.
  - Verificar que el toggle pill-slider, los highlights del árbol, los toasts y la transición de cross-fade entre modos respeten la directiva.
  - Los spinners de carga deben permanecer animados independientemente de `prefers-reduced-motion`.
  - _Requirements: 10.6_


## Notes

- Los archivos principales a modificar son: `electron-app/src/renderer/index.html`, `electron-app/src/renderer/styles.css`, `electron-app/src/renderer/app.js`, `local_adb_server.py`. El nuevo archivo `electron-app/src/renderer/inspector.js` se crea desde cero.
- `stream-renderer.js` no debe modificarse; el inspector reutiliza su API pública (`attachCanvas`, `detachCanvas`).
- La resolución nativa de referencia para el escalado del overlay es 1080×1920 (Samsung Galaxy S8/S8+). Si `POST /inspector/native-detect` con `method="wm"` devuelve una resolución diferente, usar esa en su lugar.
- Los endpoints del inspector en `local_adb_server.py` deben registrarse en el mismo router HTTP existente (puerto 8765), sin crear un servidor adicional.
- Tesseract OCR (método `screencap_ocr`) es opcional: si no está instalado en el PC, el endpoint debe devolver `{"ok": false, "error": "Tesseract no disponible"}` sin lanzar excepción.
- El protocolo CDP requiere `websockets` en Python (`pip install websockets`); verificar disponibilidad antes de implementar las tareas 9 y 10.
