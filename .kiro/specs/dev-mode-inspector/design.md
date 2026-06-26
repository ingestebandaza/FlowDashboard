# Diseño Técnico — Dev Mode Inspector

**Feature:** Inspector de UI Android para FlowDashboard Pro  
**Versión:** 1.0  
**Fecha:** 2026-05-24  
**Basado en:** requirements.md (Req 1–15) + PROJECT_CONTEXT.md

---

## Overview

El Dev Mode Inspector agrega al FlowDashboard Pro un modo desarrollador accesible desde el sidebar mediante un toggle animado. Cuando está activo, reemplaza la grilla de dispositivos por un inspector de UI Android de nivel profesional (similar a Appium Inspector) que permite explorar, interactuar y depurar la jerarquía de vistas de cualquier dispositivo conectado via ADB WiFi.

El inspector se integra sobre la infraestructura existente (`dump_ui()`, `adb_tap()`, `stream-renderer.js`) sin romper el streaming WebP activo. Incluye 14 métodos de detección organizados en dos categorías (Nativa y Web), un motor de fallback automático, y un modo de búsqueda ciega para apps con FLAG_SECURE.

---

## Architecture

### 1.1 Diagrama de Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────────┐
│  ELECTRON RENDERER (electron-app/src/renderer/)                     │
│                                                                     │
│  app.js ──────── DevModeToggle                                      │
│      │               │ toggle devMode                               │
│      │           inspector.js ──── DevInspector                    │
│      │               │    │            │                            │
│      │    UITreePanel │    │ PreviewOverlay (canvas 2D overlay)     │
│      │               │    │            │                            │
│      │  PropertiesPanel   │     stream-renderer.js (WebP, sin tocar)│
│      │               │    │            │                            │
│      │  BlindSearchPanel  │     DetectionModeSelector               │
│      │                    │                                         │
│      └────────────────────┴──── fetch() → http://localhost:8765     │
└─────────────────────────────────────────────────────────────────────┘
                              │  HTTP REST (puerto 8765)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PYTHON SERVER (local_adb_server.py)                                │
│                                                                     │
│  InspectorHandler (/inspector/*)                                    │
│      │                                                              │
│      ├── DetectionEngine                                            │
│      │       ├── NativeDetector  (uiautomator, accessibility, ...)  │
│      │       └── WebDetector     (CDP, JS inject, Flutter, ...)     │
│      │                                                              │
│      ├── NodeNormalizer  → Nodo unificado JSON                      │
│      └── UITreeCache     (TTL 5s por serial)                        │
│                                                                     │
│  AgentSocketHandler (puerto 8766) ← ya existente                   │
│      └── get_accessibility_tree  ← nuevo comando al APK             │
└─────────────────────────────────────────────────────────────────────┘
                              │  ADB WiFi (192.168.1.XX:5555)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  DISPOSITIVO ANDROID (Samsung Galaxy S8/S8+, Android 9)             │
│                                                                     │
│  uiautomator dump  ──→ /sdcard/window.xml                           │
│  FlowAccessibilityService ──→ socket tcp:8766 (ADB reverse)         │
│  Chrome DevTools Remote ──→ tcp:9222 (adb forward)                  │
│  ViewServer ──→ tcp:4939 (adb forward)                              │
│  Dart VM Service ──→ tcp:8181 (adb forward)                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

Ver sección 2 para la descripción detallada de cada componente y sus interfaces públicas.

---

## Data Models

Ver sección 3 para el schema JSON completo del Nodo normalizado.

---

## 1. Arquitectura General

### 1.1 Diagrama de Flujo de Datos

(Ver diagrama ASCII en la sección Architecture arriba)

### 1.2 Integración sin romper el streaming WebP

El streaming WebP corre en `stream-renderer.js` sobre WebSocket `ws://localhost:5000/ws/streaming`.  
El Inspector **nunca toca** esa conexión. La integración es:

- `DevInspector` crea su propio `<canvas id="inspector-preview-canvas">` **separado** del canvas de la grilla.
- Llama a `streamRenderer.createCanvas(serial, 360, 640)` apuntando al contenedor del Inspector.
- El `StreamRenderer` existente ya soporta múltiples canvas por serial (Map keyed by serial).
- Al salir del modo Dev, `DevInspector` llama a `streamRenderer.destroyCanvas('inspector-preview')` y el canvas de la grilla sigue intacto porque nunca fue destruido (solo ocultado con CSS `display:none`).
- Los dumps de UI se ejecutan en el servidor Python en un hilo separado (`threading.Thread`) para no bloquear el loop HTTP que sirve los frames.

---

## 2. Componentes Nuevos

### 2.1 Frontend — `DevModeToggle` (en `app.js`)

```javascript
// Clase añadida al final de app.js, instanciada en DOMContentLoaded
class DevModeToggle {
  constructor(app) {
    this.app = app;                          // referencia a la instancia FlowDashboardApp
    this.active = false;
    this.STORAGE_KEY = 'flowdashboard.devMode';
    this.el = null;                          // elemento DOM del toggle
  }

  // Renderiza el pill-slider en el sidebar, justo debajo del logo
  render(sidebarEl) {
    this.el = document.createElement('div');
    this.el.id = 'dev-mode-toggle';
    this.el.className = 'dev-mode-toggle';
    this.el.setAttribute('role', 'switch');
    this.el.setAttribute('aria-checked', 'false');
    this.el.innerHTML = `
      <span class="toggle-label toggle-label--normal" aria-hidden="true">
        <svg><!-- icono grilla --></svg> Normal
      </span>
      <span class="toggle-pill"></span>
      <span class="toggle-label toggle-label--dev" aria-hidden="true">
        <svg><!-- icono código --></svg> Dev
      </span>`;
    this.el.addEventListener('click', () => this.toggle());
    // Insertar como primer hijo del sidebar, después del logo
    const logo = sidebarEl.querySelector('.sidebar-logo');
    logo ? logo.insertAdjacentElement('afterend', this.el)
          : sidebarEl.prepend(this.el);
    this._restore();
  }

  toggle() {
    this.active = !this.active;
    this._apply();
    localStorage.setItem(this.STORAGE_KEY, this.active ? '1' : '0');
  }

  _restore() {
    this.active = localStorage.getItem(this.STORAGE_KEY) === '1';
    this._apply();
  }

  _apply() {
    this.el.setAttribute('aria-checked', String(this.active));
    this.el.classList.toggle('is-active', this.active);
    // Cross-fade < 300ms via CSS transition
    document.getElementById('main-grid-view').classList.toggle('hidden', this.active);
    document.getElementById('inspector-view').classList.toggle('hidden', !this.active);
    if (this.active) {
      this.app.devInspector.activate();
    } else {
      this.app.devInspector.deactivate();
    }
  }
}
```

**CSS relevante** (en `styles.css`):
```css
.dev-mode-toggle { display:flex; align-items:center; gap:6px; cursor:pointer;
  background:#000; border:1px solid #006F4F; border-radius:20px; padding:4px 10px; }
.toggle-pill { width:18px; height:18px; border-radius:50%; background:#006F4F;
  transition: transform 250ms ease-in-out, background 250ms ease-in-out; }
.dev-mode-toggle.is-active .toggle-pill { background:#00F5D4; transform:translateX(24px); }
#main-grid-view, #inspector-view { transition: opacity 250ms ease-in-out; }
#main-grid-view.hidden, #inspector-view.hidden { opacity:0; pointer-events:none;
  position:absolute; visibility:hidden; }
@media (prefers-reduced-motion: reduce) {
  .toggle-pill, #main-grid-view, #inspector-view { transition: none; }
}
```

---

### 2.2 Frontend — `DevInspector` (nuevo archivo `inspector.js`)

Archivo: `electron-app/src/renderer/inspector.js`

```javascript
class DevInspector {
  constructor(app, streamRenderer) {
    this.app = app;
    this.streamRenderer = streamRenderer;
    this.selectedSerial = null;
    this.uiTree = null;           // array plano de nodos normalizados
    this.selectedNodeId = null;
    this.detectionMode = localStorage.getItem('flowdashboard.inspector.detectionMode') || 'uiautomator';
    this.fallbackActive = false;
    this.treeExpandState = new Map(); // resourceId|path → boolean
    this.uiTreeCache = null;          // { nodes, timestamp }
    this.UI_CACHE_TTL = 5000;         // 5 segundos
    this._searchDebounceTimer = null;
    this._hoverNodeId = null;
    this.overlayCanvas = null;        // canvas 2D para highlights
    this.overlayCtx = null;
    this.DEVICE_NATIVE_W = 1080;
    this.DEVICE_NATIVE_H = 1920;
  }

  // Llamado por DevModeToggle al activar Dev Mode
  activate() { /* poblar dropdown, iniciar preview, verificar servidor */ }

  // Llamado por DevModeToggle al desactivar Dev Mode
  deactivate() { /* limpiar canvas overlay, detener preview inspector */ }

  // Inicializa el canvas overlay sobre el preview
  _initOverlayCanvas(previewCanvas) { /* ... */ }

  // Dibuja highlight en coordenadas nativas escaladas
  drawHighlight(node, provisional = false) { /* ... */ }

  // Limpia el overlay
  clearHighlight() { /* ... */ }

  // Escala coordenadas nativas → píxeles del canvas
  _scaleCoords(left, top, right, bottom) { /* ... */ }

  // Captura el árbol UI via POST /inspector/dump
  async captureUI() { /* ... */ }

  // Selecciona un nodo por id
  selectNode(nodeId) { /* ... */ }

  // Maneja clic en el preview canvas
  _onPreviewClick(event) { /* ... */ }
}
```

---

### 2.3 Frontend — `DetectionModeSelector` (en `inspector.js`)

```javascript
class DetectionModeSelector {
  constructor(inspector) {
    this.inspector = inspector;
    this.STORAGE_KEY = 'flowdashboard.inspector.detectionMode';
    this.currentMode = localStorage.getItem(this.STORAGE_KEY) || 'uiautomator';
  }

  // Renderiza los dos grupos de chips (Nativa / Web) en la toolbar
  render(toolbarEl) { /* ... */ }

  // Selecciona un modo y persiste en localStorage
  selectMode(modeKey) {
    this.currentMode = modeKey;
    localStorage.setItem(this.STORAGE_KEY, modeKey);
    this.inspector.uiTree = null;
    this._updateActiveChip();
    this.inspector.uiTreePanel.showMessage(
      `Modo de detección cambiado a ${this._label(modeKey)}. Captura el árbol UI para continuar.`
    );
  }

  // Consulta disponibilidad de cada método via GET /inspector/method-status?serial=...
  async refreshAvailability(serial) { /* ... */ }

  // Devuelve el label legible de un modeKey
  _label(modeKey) { /* ... */ }
}
```

**Métodos disponibles y sus claves:**

| Grupo   | Clave              | Label UI                  |
|---------|--------------------|---------------------------|
| Nativa  | `uiautomator`      | UIAutomator Dump          |
| Nativa  | `accessibility`    | Accessibility Service     |
| Nativa  | `dumpsys`          | Dumpsys Window            |
| Nativa  | `viewserver`       | View Server (DDMS)        |
| Nativa  | `screencap_ocr`    | Screencap + OCR           |
| Nativa  | `wm`               | ADB Shell WM              |
| Nativa  | `pm_dump`          | Package Manager Inspect   |
| Nativa  | `logcat`           | Logcat Filter             |
| Web     | `cdp`              | Chrome DevTools (CDP)     |
| Web     | `js_inject`        | JS Injection              |
| Web     | `react_native`     | React Native Inspector    |
| Web     | `ionic`            | Ionic/Cordova WebView     |
| Web     | `flutter`          | Flutter Inspector         |
| Web     | `network_intercept`| Network Intercept         |

---

### 2.4 Frontend — `UITreePanel` (en `inspector.js`)

```javascript
class UITreePanel {
  constructor(inspector) {
    this.inspector = inspector;
    this.containerEl = null;   // div#ui-tree-panel
    this.searchQuery = '';
    this.searchField = 'any';  // 'text' | 'resourceId' | 'class' | 'any'
    this.searchResults = [];
    this.searchIndex = 0;
  }

  // Renderiza el panel completo (barra de búsqueda + árbol)
  render(parentEl) { /* ... */ }

  // Construye el árbol colapsable a partir de this.inspector.uiTree
  // Nodos con depth > 3 se renderizan colapsados por defecto
  buildTree(nodes) { /* ... */ }

  // Preserva el estado expand/collapse entre capturas
  // Identifica nodos por resourceId o por ruta de índices
  _preserveExpandState(oldNodes, newNodes) { /* ... */ }

  // Filtra el árbol con debounce de 300ms
  // Resalta coincidencias con fondo rgba(0,245,212,0.2)
  onSearchInput(query, field) {
    clearTimeout(this._searchDebounceTimer);
    this._searchDebounceTimer = setTimeout(() => this._applySearch(query, field), 300);
  }

  _applySearch(query, field) { /* ... */ }

  // Navega al resultado anterior/siguiente
  navigateSearch(direction) { /* ... */ }

  // Muestra un mensaje de estado en el panel
  showMessage(msg) { /* ... */ }

  // Muestra/oculta el spinner de carga
  setLoading(loading) { /* ... */ }
}
```

---

### 2.5 Frontend — `PreviewOverlay` (en `inspector.js`)

```javascript
class PreviewOverlay {
  constructor(previewCanvas) {
    // Canvas 2D superpuesto sobre el preview WebP
    // position:absolute, pointer-events:none, mismo tamaño que previewCanvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
    this.ctx = this.canvas.getContext('2d');
    this.previewCanvas = previewCanvas;
    this._syncSize();
    previewCanvas.parentElement.style.position = 'relative';
    previewCanvas.parentElement.appendChild(this.canvas);
  }

  // Sincroniza tamaño con el canvas de preview
  _syncSize() {
    this.canvas.width = this.previewCanvas.clientWidth;
    this.canvas.height = this.previewCanvas.clientHeight;
    this.canvas.style.width = this.previewCanvas.clientWidth + 'px';
    this.canvas.style.height = this.previewCanvas.clientHeight + 'px';
  }

  // Dibuja un rectángulo highlight escalado desde coordenadas nativas
  // provisional=true → opacidad 0.5 (hover), false → opacidad 1.0 (selección)
  draw(bounds, deviceW, deviceH, provisional = false) {
    this._syncSize();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!bounds) return;
    const scaleX = this.canvas.width / deviceW;
    const scaleY = this.canvas.height / deviceH;
    const x = bounds.left * scaleX;
    const y = bounds.top * scaleY;
    const w = (bounds.right - bounds.left) * scaleX;
    const h = (bounds.bottom - bounds.top) * scaleY;
    this.ctx.globalAlpha = provisional ? 0.5 : 1.0;
    this.ctx.fillStyle = 'rgba(0,245,212,0.15)';
    this.ctx.fillRect(x, y, w, h);
    this.ctx.strokeStyle = '#00F5D4';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, w, h);
    this.ctx.globalAlpha = 1.0;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy() {
    this.canvas.remove();
  }
}
```

---

### 2.6 Frontend — `PropertiesPanel` (en `inspector.js`)

```javascript
class PropertiesPanel {
  constructor(inspector) {
    this.inspector = inspector;
    this.containerEl = null;   // div#properties-panel
    this.actionsEl = null;     // div#node-actions
  }

  // Renderiza el panel con todos los atributos del nodo seleccionado
  // Atributos true → color #00F5D4, false → color #555555
  // Muestra centerX, centerY calculados desde bounds
  render(node) { /* ... */ }

  // Muestra el estado vacío
  renderEmpty() { /* ... */ }

  // Copia valor al portapapeles; muestra "Copiado" 1500ms solo si exitoso
  async _copyValue(value) { /* ... */ }

  // Renderiza los botones de acción según atributos del nodo
  // Tap (clickable), Long Press (long-clickable), Input Text (EditText), Scroll (scrollable)
  renderActions(node) { /* ... */ }

  // Muestra toast de éxito (#00F5D4, 1500ms) o error (#FF4444, 3000ms)
  showToast(message, type = 'success') { /* ... */ }
}
```

---

### 2.7 Frontend — `BlindSearchPanel` (en `inspector.js`)

```javascript
class BlindSearchPanel {
  constructor(inspector) {
    this.inspector = inspector;
    this.containerEl = null;   // div#blind-search-panel
    this.results = [];
  }

  // Renderiza el panel de búsqueda ciega
  render(parentEl) { /* ... */ }

  // Invoca POST /inspector/blind-search y muestra resultados como tarjetas
  async search(serial, query) { /* ... */ }

  // Renderiza una tarjeta de resultado con botón Tap
  _renderResultCard(node) { /* ... */ }

  // Muestra el aviso "Modo Fallback activo"
  showFallbackBanner() { /* ... */ }
}
```

---

### 2.8 Layout HTML del Inspector

Añadir en `index.html` dentro del `<body>`, después del `#main-grid-view`:

```html
<div id="inspector-view" class="inspector-view hidden">
  <!-- Toolbar -->
  <div class="inspector-toolbar">
    <select id="inspector-device-select" class="inspector-device-select"></select>
    <div id="detection-mode-selector"></div>
    <button id="btn-capture-ui" class="btn-neon">Capturar UI</button>
    <button id="btn-auto-detect" class="btn-neon btn-secondary">Auto-detectar</button>
    <button id="btn-fallback-mode" class="btn-neon btn-warning">Modo Fallback</button>
  </div>

  <!-- Tres paneles horizontales: 30% / 40% / 30% -->
  <div class="inspector-panels">
    <div id="ui-tree-panel" class="inspector-panel inspector-panel--left">
      <!-- UITreePanel se monta aquí -->
    </div>
    <div class="inspector-panel-separator"></div>
    <div id="preview-panel" class="inspector-panel inspector-panel--center">
      <div id="inspector-preview-container" style="position:relative;">
        <!-- canvas WebP + canvas overlay se montan aquí -->
      </div>
      <div id="blind-search-panel" class="hidden"></div>
    </div>
    <div class="inspector-panel-separator"></div>
    <div id="properties-panel" class="inspector-panel inspector-panel--right">
      <!-- PropertiesPanel se monta aquí -->
    </div>
  </div>
</div>
```

---

## 3. Formato de Datos Unificado — Nodo Normalizado

Todos los métodos de detección devuelven nodos en este schema JSON. El `NodeNormalizer` en Python es responsable de la conversión.

```json
{
  "id": "node_0042",
  "type": "native",
  "method": "uiautomator",
  "detectionSource": "uiautomator",
  "depth": 3,
  "index": 2,

  "class": "android.widget.TextView",
  "tagName": null,

  "text": "Iniciar sesión",
  "resourceId": "com.spotify.music:id/login_button",
  "domId": null,
  "className": null,
  "contentDesc": "",
  "package": "com.spotify.music",

  "bounds": {
    "left": 120,
    "top": 840,
    "right": 960,
    "bottom": 920,
    "width": 840,
    "height": 80
  },
  "centerX": 540,
  "centerY": 880,

  "clickable": true,
  "enabled": true,
  "focusable": true,
  "focused": false,
  "scrollable": false,
  "longClickable": false,
  "checkable": false,
  "checked": false,
  "selected": false,
  "password": false,

  "children": ["node_0043", "node_0044"],
  "parent": "node_0041",

  "attributes": {
    "naf": "false",
    "drawingOrder": "0"
  }
}
```

**Reglas de normalización:**

- `id`: generado como `node_{índice_plano_en_captura}` (ej. `node_0000` para la raíz).
- `type`: `"native"` para métodos ADB directos, `"web"` para métodos CDP/JS/Flutter.
- `bounds`: siempre en coordenadas nativas del dispositivo (1080×1920 para S8/S8+). Para métodos Web, el `NodeNormalizer` suma el offset del WebView obtenido via `uiautomator dump` o `DOM.getBoxModel`.
- Si `bounds` no está disponible (elemento oculto): `bounds: null`, `centerX: null`, `centerY: null`.
- `children` y `parent`: listas de `id` para reconstruir el árbol desde la lista plana.
- `attributes`: mapa de atributos adicionales específicos del método (ej. `href`, `src` para CDP; `widgetType` para Flutter).

**Función Python de normalización:**

```python
def normalize_node(raw_node, method: str, node_type: str, node_id: str,
                   depth: int, parent_id: str | None) -> dict:
    """Convierte un nodo crudo (XML attrib dict o dict CDP) al formato unificado."""
    bounds = _parse_bounds(raw_node)
    return {
        "id": node_id,
        "type": node_type,
        "method": method,
        "detectionSource": method,
        "depth": depth,
        "index": int(raw_node.get("index", 0)),
        "class": raw_node.get("class", raw_node.get("tagName", "")),
        "tagName": raw_node.get("tagName"),
        "text": raw_node.get("text", raw_node.get("textContent", "")),
        "resourceId": raw_node.get("resource-id", raw_node.get("domId", "")),
        "domId": raw_node.get("domId"),
        "className": raw_node.get("className"),
        "contentDesc": raw_node.get("content-desc", ""),
        "package": raw_node.get("package", ""),
        "bounds": bounds,
        "centerX": bounds["centerX"] if bounds else None,
        "centerY": bounds["centerY"] if bounds else None,
        "clickable": _bool_attr(raw_node, "clickable"),
        "enabled": _bool_attr(raw_node, "enabled"),
        "focusable": _bool_attr(raw_node, "focusable"),
        "focused": _bool_attr(raw_node, "focused"),
        "scrollable": _bool_attr(raw_node, "scrollable"),
        "longClickable": _bool_attr(raw_node, "long-clickable"),
        "checkable": _bool_attr(raw_node, "checkable"),
        "checked": _bool_attr(raw_node, "checked"),
        "selected": _bool_attr(raw_node, "selected"),
        "password": _bool_attr(raw_node, "password"),
        "children": [],   # se rellena en el paso de construcción del árbol
        "parent": parent_id,
        "attributes": _extra_attributes(raw_node, method),
    }
```

---

## 4. Motor de Detección — Orden de Prioridad y Fallback

### 4.1 Tabla de Métodos

| # | Clave              | Categoría | Prioridad | Requisitos                                  | Casos de uso principales                          | Timeout |
|---|--------------------|-----------|-----------|---------------------------------------------|---------------------------------------------------|---------|
| 1 | `uiautomator`      | Nativa    | 1 (default)| Android 4.3+, ADB conectado               | Apps nativas, cualquier app sin FLAG_SECURE       | 10s     |
| 2 | `accessibility`    | Nativa    | 2         | FlowAccessibilityService activo en APK      | Apps que bloquean uiautomator, apps del sistema   | 8s      |
| 3 | `cdp`              | Web       | 3         | App con WebView debuggable, adb forward     | Apps híbridas, WebViews, Chrome                   | 12s     |
| 4 | `dumpsys`          | Nativa    | 4         | ADB conectado                               | Pantalla en negro, transición de actividad        | 5s      |
| 5 | `js_inject`        | Web       | 5         | CDP activo, WebView con JS habilitado       | DOM completo con posiciones via getBoundingClientRect | 15s |
| 6 | `react_native`     | Web       | 6         | CDP activo, bundle RN presente              | Apps React Native                                 | 15s     |
| 7 | `ionic`            | Web       | 7         | CDP activo, paquete io.ionic.*              | Apps Ionic/Cordova                                | 15s     |
| 8 | `flutter`          | Web       | 8         | libflutter.so presente, adb forward 8181   | Apps Flutter                                      | 20s     |
| 9 | `viewserver`       | Nativa    | 9         | App con debuggable:true, adb forward 4939  | Apps debug, coordenadas exactas                   | 10s     |
| 10| `screencap_ocr`    | Nativa    | 10        | Tesseract instalado en PC                   | Último recurso, texto visible en pantalla         | 30s     |
| 11| `wm`               | Nativa    | util      | ADB conectado                               | Calibración de resolución y densidad              | 3s      |
| 12| `pm_dump`          | Nativa    | util      | ADB conectado                               | Metadatos del paquete activo                      | 5s      |
| 13| `logcat`           | Nativa    | util      | ADB conectado                               | Correlación de eventos UI con logs                | 5s      |
| 14| `network_intercept`| Web       | util      | mitmproxy instalado en PC                   | APIs dinámicas, tráfico HTTP/HTTPS                | N/A     |

### 4.2 Lógica de Fallback en `DetectionEngine`

```python
class DetectionEngine:
    PRIORITY_ORDER = [
        'uiautomator', 'accessibility', 'cdp', 'dumpsys',
        'js_inject', 'react_native', 'ionic', 'flutter',
        'viewserver', 'screencap_ocr'
    ]

    def __init__(self, serial: str):
        self.serial = serial
        self._cache = {}          # method → (nodes, timestamp)
        self.CACHE_TTL = 5.0      # segundos

    def detect(self, method: str, options: dict = None) -> dict:
        """Intenta el método solicitado; si falla, prueba el siguiente en prioridad."""
        methods_to_try = [method] + [m for m in self.PRIORITY_ORDER if m != method]
        last_error = None
        for m in methods_to_try:
            try:
                nodes = self._run_method(m, options or {})
                if nodes:
                    return {"ok": True, "nodes": nodes, "method_used": m,
                            "fallback_used": m != method}
            except Exception as exc:
                last_error = exc
                # Notificar al frontend via campo en respuesta
                continue
        return {"ok": False, "error": str(last_error), "method_used": None}

    def _run_method(self, method: str, options: dict) -> list:
        """Despacha al detector correspondiente."""
        # Verificar caché
        cached = self._cache.get(method)
        if cached and (time.time() - cached[1]) < self.CACHE_TTL:
            return cached[0]
        detector = {
            'uiautomator':   NativeDetector.uiautomator_dump,
            'accessibility': NativeDetector.accessibility_dump,
            'dumpsys':       NativeDetector.dumpsys_window,
            'viewserver':    NativeDetector.view_server,
            'screencap_ocr': NativeDetector.screencap_ocr,
            'wm':            NativeDetector.wm_info,
            'pm_dump':       NativeDetector.pm_dump,
            'logcat':        NativeDetector.logcat_filter,
            'cdp':           WebDetector.cdp_dump,
            'js_inject':     WebDetector.js_inject,
            'react_native':  WebDetector.react_native,
            'ionic':         WebDetector.ionic_cordova,
            'flutter':       WebDetector.flutter_inspector,
            'network_intercept': WebDetector.network_intercept,
        }.get(method)
        if not detector:
            raise ValueError(f"Método desconocido: {method}")
        nodes = detector(self.serial, options)
        self._cache[method] = (nodes, time.time())
        return nodes
```

---

## 5. Integración con FlowAgent APK

### 5.1 Nuevo comando `get_accessibility_tree`

El APK ya tiene `FlowAccessibilityService` activo y un socket TCP en puerto 8766 (via ADB reverse). Se extiende el protocolo de mensajes JSON existente con un nuevo comando.

**Mensaje del servidor Python → APK:**
```json
{ "type": "get_accessibility_tree" }
```

**Respuesta del APK → servidor Python:**
```json
{
  "type": "accessibility_tree",
  "nodes": [
    {
      "class": "android.widget.FrameLayout",
      "text": "",
      "contentDesc": "",
      "resourceId": "com.spotify.music:id/root",
      "bounds": "[0,0][1080,1920]",
      "clickable": false,
      "enabled": true,
      "focusable": false,
      "scrollable": false,
      "children": [...]
    }
  ]
}
```

### 5.2 Cambios en `FlowAccessibilityService.java`

```java
// En el método que procesa comandos del socket (ya existente)
case "get_accessibility_tree":
    AccessibilityNodeInfo root = getRootInActiveWindow();
    if (root != null) {
        JSONObject response = new JSONObject();
        response.put("type", "accessibility_tree");
        response.put("nodes", serializeNodeTree(root));
        sendToServer(response.toString());
        root.recycle();
    }
    break;

// Nuevo método de serialización
private JSONArray serializeNodeTree(AccessibilityNodeInfo node) throws JSONException {
    JSONArray result = new JSONArray();
    serializeNode(node, result, 0);
    return result;
}

private void serializeNode(AccessibilityNodeInfo node, JSONArray result, int depth)
        throws JSONException {
    if (node == null) return;
    JSONObject obj = new JSONObject();
    obj.put("class", node.getClassName() != null ? node.getClassName().toString() : "");
    obj.put("text", node.getText() != null ? node.getText().toString() : "");
    obj.put("contentDesc", node.getContentDescription() != null
            ? node.getContentDescription().toString() : "");
    obj.put("resourceId", node.getViewIdResourceName() != null
            ? node.getViewIdResourceName() : "");
    Rect bounds = new Rect();
    node.getBoundsInScreen(bounds);
    obj.put("bounds", "[" + bounds.left + "," + bounds.top + "]["
            + bounds.right + "," + bounds.bottom + "]");
    obj.put("clickable", node.isClickable());
    obj.put("enabled", node.isEnabled());
    obj.put("focusable", node.isFocusable());
    obj.put("scrollable", node.isScrollable());
    obj.put("longClickable", node.isLongClickable());
    obj.put("checkable", node.isCheckable());
    obj.put("checked", node.isChecked());
    obj.put("selected", node.isSelected());
    obj.put("depth", depth);
    JSONArray children = new JSONArray();
    for (int i = 0; i < node.getChildCount(); i++) {
        AccessibilityNodeInfo child = node.getChild(i);
        if (child != null) {
            serializeNode(child, result, depth + 1);
            children.put(result.length() - 1);  // índice del hijo en result
            child.recycle();
        }
    }
    obj.put("childIndices", children);
    result.put(obj);
}
```

### 5.3 Endpoint Python `/inspector/accessibility-dump`

```python
def handle_accessibility_dump(serial: str) -> dict:
    """Envía get_accessibility_tree al APK via socket y espera respuesta."""
    agent = _find_agent_by_serial(serial)
    if not agent:
        raise RuntimeError(f"Agente no conectado para {serial}")
    
    response_event = threading.Event()
    response_data = {}
    
    def on_accessibility_tree(data):
        response_data.update(data)
        response_event.set()
    
    # Registrar callback temporal
    agent.pending_callbacks['accessibility_tree'] = on_accessibility_tree
    agent.send(json.dumps({"type": "get_accessibility_tree"}))
    
    if not response_event.wait(timeout=8.0):
        raise TimeoutError("Timeout esperando árbol de accesibilidad del APK")
    
    nodes = _normalize_accessibility_nodes(response_data.get("nodes", []), serial)
    return {"ok": True, "nodes": nodes, "method_used": "accessibility"}
```

---

## 6. Endpoints del Servidor Python — Implementación Detallada

Todos los endpoints se añaden en `local_adb_server.py` dentro del método `do_POST` del `RequestHandler`, en el bloque de routing existente.

### 6.1 Validación común (decorador/helper)

```python
def _validate_inspector_request(body: dict) -> tuple[str, dict | None]:
    """Valida serial y devuelve (serial, error_response_or_None)."""
    serial = str(body.get("serial", "")).strip()
    if not serial:
        return "", {"error": "El campo serial es requerido"}
    devices = list_devices()
    online = [d["serial"] for d in devices if d.get("status") == "online"]
    if serial not in online:
        return serial, {"error": f"Dispositivo no encontrado o no conectado: {serial}"}
    return serial, None
```

### 6.2 Tabla de Endpoints

| Método | Ruta                          | Body JSON                                                    | Respuesta exitosa                                      | HTTP error |
|--------|-------------------------------|--------------------------------------------------------------|--------------------------------------------------------|------------|
| POST   | `/inspector/dump`             | `{"serial":"..."}`                                           | `{"ok":true,"nodes":[...],"xml":"..."}`                | 408 timeout, 404 serial |
| POST   | `/inspector/accessibility-dump`| `{"serial":"..."}`                                          | `{"ok":true,"nodes":[...],"method_used":"accessibility"}` | 404, 408 |
| POST   | `/inspector/native-detect`    | `{"serial":"...","method":"uiautomator\|...","options":{}}`  | `{"ok":true,"nodes":[...],"method_used":"..."}`        | 404, 400 |
| POST   | `/inspector/web-detect`       | `{"serial":"...","method":"cdp\|...","options":{}}`          | `{"ok":true,"nodes":[...],"method_used":"..."}`        | 404, 400 |
| POST   | `/inspector/auto-detect`      | `{"serial":"..."}`                                           | `{"ok":true,"nodes":[...],"method_used":"...","timings":{}}` | 404 |
| POST   | `/inspector/tap`              | `{"serial":"...","x":N,"y":N}`                               | `{"ok":true}`                                          | 404, 400 |
| POST   | `/inspector/long-press`       | `{"serial":"...","x":N,"y":N,"duration":800}`                | `{"ok":true}`                                          | 404, 400 |
| POST   | `/inspector/input-text`       | `{"serial":"...","x":N,"y":N,"text":"..."}`                  | `{"ok":true}`                                          | 404, 400 |
| POST   | `/inspector/scroll`           | `{"serial":"...","x":N,"y1":N,"y2":N,"direction":"up\|down"}`| `{"ok":true}`                                          | 404, 400 |
| POST   | `/inspector/blind-search`     | `{"serial":"...","query":"...","field":"any\|text\|resourceId\|class"}` | `{"ok":true,"results":[...]}` | 404, 400 |
| POST   | `/inspector/cdp-connect`      | `{"serial":"..."}`                                           | `{"ok":true,"targets":[...]}`                          | 404 |
| POST   | `/inspector/cdp-dump`         | `{"serial":"...","target_id":"..."}`                         | `{"ok":true,"nodes":[...]}`                            | 404, 400 |

### 6.3 Implementación de `/inspector/dump`

```python
def handle_inspector_dump(body: dict) -> tuple[dict, int]:
    serial, err = _validate_inspector_request(body)
    if err:
        code = 400 if "requerido" in err["error"] else 404
        return err, code
    try:
        # dump_ui ya existente, timeout 10s
        root = dump_ui(serial, timeout=10)
        nodes = []
        counter = [0]
        id_map = {}  # ET.Element → node_id

        def build_nodes(elem, parent_id, depth):
            node_id = f"node_{counter[0]:04d}"
            counter[0] += 1
            id_map[id(elem)] = node_id
            raw = dict(elem.attrib)
            node = normalize_node(raw, "uiautomator", "native", node_id, depth, parent_id)
            nodes.append(node)
            for child in list(elem):
                child_id = build_nodes(child, node_id, depth + 1)
                node["children"].append(child_id)
            return node_id

        build_nodes(root, None, 0)
        xml_str = ET.tostring(root, encoding="unicode")
        return {"ok": True, "nodes": nodes, "xml": xml_str}, 200
    except Exception as exc:
        msg = str(exc)
        if "timeout" in msg.lower() or "No se pudo leer" in msg:
            return {"error": "Timeout al capturar UI del dispositivo"}, 408
        return {"ok": False, "error": msg}, 500
```

### 6.4 Implementación de `/inspector/tap`

```python
def handle_inspector_tap(body: dict) -> tuple[dict, int]:
    serial, err = _validate_inspector_request(body)
    if err:
        return err, 400 if "requerido" in err["error"] else 404
    x = body.get("x")
    y = body.get("y")
    if x is None or y is None:
        return {"error": "Los campos x e y son requeridos"}, 400
    try:
        adb_tap(serial, int(x), int(y))
        return {"ok": True}, 200
    except Exception as exc:
        return {"ok": False, "error": str(exc)}, 500
```

### 6.5 Implementación de `/inspector/scroll`

```python
def handle_inspector_scroll(body: dict) -> tuple[dict, int]:
    serial, err = _validate_inspector_request(body)
    if err:
        return err, 400 if "requerido" in err["error"] else 404
    x = int(body.get("x", 540))
    y1 = int(body.get("y1", 960))
    y2 = int(body.get("y2", 960))
    direction = body.get("direction", "up")
    # scroll arriba: swipe de abajo hacia arriba (y2 → y1)
    # scroll abajo: swipe de arriba hacia abajo (y1 → y2)
    if direction == "up":
        cmd = f"input swipe {x} {y2} {x} {y1} 400"
    else:
        cmd = f"input swipe {x} {y1} {x} {y2} 400"
    try:
        adb_shell(serial, cmd, timeout=10)
        return {"ok": True}, 200
    except Exception as exc:
        return {"ok": False, "error": str(exc)}, 500
```

### 6.6 Implementación de `/inspector/blind-search`

```python
def handle_inspector_blind_search(body: dict) -> tuple[dict, int]:
    serial, err = _validate_inspector_request(body)
    if err:
        return err, 400 if "requerido" in err["error"] else 404
    query = str(body.get("query", "")).strip().lower()
    field = body.get("field", "any")
    if not query:
        return {"error": "El campo query es requerido"}, 400
    try:
        root = dump_ui(serial, timeout=10)
        results = []
        for elem in iter_ui_nodes(root):
            attrib = elem.attrib
            match = False
            if field in ("any", "text") and query in attrib.get("text", "").lower():
                match = True
            if field in ("any", "resourceId") and query in attrib.get("resource-id", "").lower():
                match = True
            if field in ("any", "class") and query in attrib.get("class", "").lower():
                match = True
            if match:
                bounds = node_bounds(elem)
                short_class = attrib.get("class", "").split(".")[-1]
                results.append({
                    "class": short_class,
                    "text": attrib.get("text", ""),
                    "resourceId": attrib.get("resource-id", ""),
                    "centerX": bounds["centerX"] if bounds else None,
                    "centerY": bounds["centerY"] if bounds else None,
                    "clickable": attrib.get("clickable") == "true",
                    "enabled": attrib.get("enabled") == "true",
                    "bounds": bounds,
                })
        return {"ok": True, "results": results}, 200
    except Exception as exc:
        return {"ok": False, "error": str(exc)}, 500
```

---

## 7. Archivos a Crear / Modificar

### 7.1 Archivos nuevos

| Archivo | Descripción |
|---------|-------------|
| `electron-app/src/renderer/inspector.js` | Clases `DevInspector`, `UITreePanel`, `PreviewOverlay`, `PropertiesPanel`, `BlindSearchPanel`, `DetectionModeSelector`. Punto de entrada: `window.devInspector = new DevInspector(app, streamRenderer)` |
| `electron-app/src/renderer/inspector.css` | Estilos del inspector: layout 30/40/30, paleta neon, pill-slider, chips de detección, árbol colapsable, panel de propiedades, toasts |

### 7.2 Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `electron-app/src/renderer/index.html` | Añadir `<div id="inspector-view" class="hidden">` con la estructura de tres paneles. Añadir `<script src="inspector.js">` después de `stream-renderer.js`. Añadir `<link rel="stylesheet" href="inspector.css">` |
| `electron-app/src/renderer/app.js` | Añadir clase `DevModeToggle` al final. En `DOMContentLoaded`: instanciar `DevModeToggle` y `DevInspector`, llamar `toggle.render(sidebarEl)`. Exponer `this.devInspector` en la instancia de app |
| `local_adb_server.py` | Añadir en `do_POST`: routing para todas las rutas `/inspector/*`. Añadir funciones: `handle_inspector_dump`, `handle_inspector_tap`, `handle_inspector_long_press`, `handle_inspector_input_text`, `handle_inspector_scroll`, `handle_inspector_blind_search`, `handle_inspector_accessibility_dump`, `handle_inspector_native_detect`, `handle_inspector_web_detect`, `handle_inspector_auto_detect`, `handle_inspector_cdp_connect`, `handle_inspector_cdp_dump`. Añadir clases: `DetectionEngine`, `NativeDetector`, `WebDetector`, `NodeNormalizer`, `UITreeCache` |
| `flow_agent_apk/app/src/main/java/com/flowlogin/agent/FlowAccessibilityService.java` | Añadir case `"get_accessibility_tree"` en el switch de comandos. Añadir métodos `serializeNodeTree()` y `serializeNode()` |
| `electron-app/src/renderer/styles.css` | Añadir variables CSS del inspector: `--inspector-accent`, `--inspector-accent-web`, `--inspector-bg`, `--inspector-border`. Añadir estilos del toggle pill-slider |

### 7.3 Archivos que NO se modifican

| Archivo | Razón |
|---------|-------|
| `electron-app/src/renderer/stream-renderer.js` | El `StreamRenderer` ya soporta múltiples canvas. El inspector solo llama `createCanvas()` y `destroyCanvas()` |
| `FlowDashboard.Core/` (C#) | El backend C# no necesita cambios; el inspector usa el servidor Python directamente |
| `electron-app/src/renderer/api-client.js` | El inspector hace `fetch()` directo a `localhost:8765`; no necesita el api-client existente |

---

## 8. Consideraciones de Rendimiento

### 8.1 El dump de UI no bloquea el streaming WebP

El streaming WebP corre en el WebSocket `ws://localhost:5000/ws/streaming` (backend C#), completamente independiente del servidor Python en puerto 8765. Los endpoints `/inspector/*` son HTTP REST síncronos en el servidor Python, pero:

- El servidor Python usa `ThreadingHTTPServer`, por lo que cada request HTTP se maneja en un hilo separado.
- `dump_ui()` bloquea su propio hilo (hasta 10s), pero no bloquea el loop de recepción de frames del socket APK (puerto 8766) ni el WebSocket del backend C#.
- El `PreviewOverlay` es un canvas 2D separado del canvas WebP; dibujar el highlight no interfiere con `renderFrame()` que usa `createImageBitmap()`.

### 8.2 Caché del árbol UI con TTL de 5 segundos

```python
# En local_adb_server.py — caché global por serial
UI_TREE_CACHE: dict[str, dict] = {}
UI_TREE_CACHE_LOCK = threading.Lock()
UI_TREE_CACHE_TTL = 5.0  # segundos

def get_cached_ui_tree(serial: str) -> list | None:
    with UI_TREE_CACHE_LOCK:
        entry = UI_TREE_CACHE.get(serial)
        if entry and (time.time() - entry["ts"]) < UI_TREE_CACHE_TTL:
            return entry["nodes"]
    return None

def set_cached_ui_tree(serial: str, nodes: list):
    with UI_TREE_CACHE_LOCK:
        UI_TREE_CACHE[serial] = {"nodes": nodes, "ts": time.time()}

def invalidate_ui_tree_cache(serial: str):
    with UI_TREE_CACHE_LOCK:
        UI_TREE_CACHE.pop(serial, None)
```

`handle_inspector_dump` consulta la caché antes de ejecutar `dump_ui()`. Las acciones (tap, scroll, input-text) llaman a `invalidate_ui_tree_cache(serial)` tras ejecutarse con éxito, forzando una nueva captura en el siguiente dump.

### 8.3 Debounce en búsqueda y hover

**Búsqueda en árbol (frontend):**
```javascript
// En UITreePanel.onSearchInput()
onSearchInput(query, field) {
  clearTimeout(this._searchDebounceTimer);
  if (query.length < 2) {
    this._clearSearch();
    return;
  }
  this._searchDebounceTimer = setTimeout(() => {
    this._applySearch(query, field);
  }, 300);  // 300ms debounce
}
```

**Hover sobre nodos (frontend):**
```javascript
// En UITreePanel — mouseenter sobre un nodo del árbol
_onNodeMouseEnter(nodeId) {
  clearTimeout(this._hoverTimer);
  this._hoverTimer = setTimeout(() => {
    const node = this._findNodeById(nodeId);
    if (node && node.bounds) {
      this.inspector.previewOverlay.draw(
        node.bounds,
        this.inspector.DEVICE_NATIVE_W,
        this.inspector.DEVICE_NATIVE_H,
        true  // provisional=true → opacidad 0.5
      );
    }
  }, 50);  // 50ms debounce para hover
}

_onNodeMouseLeave() {
  clearTimeout(this._hoverTimer);
  // Solo limpiar si no hay nodo seleccionado activo
  if (!this.inspector.selectedNodeId) {
    this.inspector.previewOverlay.clear();
  } else {
    // Restaurar highlight del nodo seleccionado
    const selected = this.inspector._findNodeById(this.inspector.selectedNodeId);
    if (selected && selected.bounds) {
      this.inspector.previewOverlay.draw(
        selected.bounds,
        this.inspector.DEVICE_NATIVE_W,
        this.inspector.DEVICE_NATIVE_H,
        false  // provisional=false → opacidad 1.0
      );
    }
  }
}
```

**Búsqueda ciega (frontend):**
```javascript
// En BlindSearchPanel — el campo de búsqueda no tiene debounce automático
// El usuario pulsa el botón "Buscar en UI" explícitamente
// Para evitar doble-click, deshabilitar el botón mientras la petición está en vuelo
async search(serial, query) {
  this.searchBtn.disabled = true;
  try {
    const res = await fetch('http://localhost:8765/inspector/blind-search', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ serial, query, field: this.fieldSelect.value })
    });
    const data = await res.json();
    this._renderResults(data.results || []);
  } finally {
    this.searchBtn.disabled = false;
  }
}
```

### 8.4 Escalado del Highlight Overlay

El escalado se recalcula en cada `draw()` usando el tamaño actual del canvas (que puede cambiar si el usuario redimensiona la ventana):

```javascript
// En PreviewOverlay.draw()
_syncSize() {
  const rect = this.previewCanvas.getBoundingClientRect();
  this.canvas.width = rect.width;
  this.canvas.height = rect.height;
}
```

Para los Samsung Galaxy S8/S8+ (1080×1920), el factor de escala típico con un canvas de 360×640 es:
- `scaleX = 360 / 1080 = 0.333`
- `scaleY = 640 / 1920 = 0.333`

Si el canvas se redimensiona a otro tamaño, el factor se recalcula automáticamente en cada llamada a `draw()`.

### 8.5 Selección del nodo más pequeño en clic sobre el preview

```javascript
// En DevInspector._onPreviewClick()
_onPreviewClick(event) {
  if (!this.uiTree || !this.uiTree.length) {
    this.propertiesPanel.showToast(
      'Captura el árbol UI primero para habilitar la selección por clic', 'info'
    );
    return;
  }
  const rect = this.previewCanvas.getBoundingClientRect();
  const clickX = (event.clientX - rect.left) / rect.width * this.DEVICE_NATIVE_W;
  const clickY = (event.clientY - rect.top) / rect.height * this.DEVICE_NATIVE_H;

  // Buscar el nodo más pequeño que contenga las coordenadas
  let best = null;
  let bestArea = Infinity;
  for (const node of this.uiTree) {
    const b = node.bounds;
    if (!b) continue;
    if (clickX >= b.left && clickX <= b.right && clickY >= b.top && clickY <= b.bottom) {
      const area = b.width * b.height;
      if (area < bestArea) {
        bestArea = area;
        best = node;
      }
    }
  }
  if (best) this.selectNode(best.id);
}
```

---

## 9. Routing en `local_adb_server.py`

Añadir en el método `do_POST` del `RequestHandler`, dentro del bloque de routing existente:

```python
# --- Inspector endpoints ---
elif path == "/inspector/dump":
    result, status = handle_inspector_dump(body)
    self._send_json(result, status)

elif path == "/inspector/accessibility-dump":
    result, status = handle_inspector_accessibility_dump(body)
    self._send_json(result, status)

elif path == "/inspector/native-detect":
    result, status = handle_inspector_native_detect(body)
    self._send_json(result, status)

elif path == "/inspector/web-detect":
    result, status = handle_inspector_web_detect(body)
    self._send_json(result, status)

elif path == "/inspector/auto-detect":
    result, status = handle_inspector_auto_detect(body)
    self._send_json(result, status)

elif path == "/inspector/tap":
    result, status = handle_inspector_tap(body)
    self._send_json(result, status)

elif path == "/inspector/long-press":
    result, status = handle_inspector_long_press(body)
    self._send_json(result, status)

elif path == "/inspector/input-text":
    result, status = handle_inspector_input_text(body)
    self._send_json(result, status)

elif path == "/inspector/scroll":
    result, status = handle_inspector_scroll(body)
    self._send_json(result, status)

elif path == "/inspector/blind-search":
    result, status = handle_inspector_blind_search(body)
    self._send_json(result, status)

elif path == "/inspector/cdp-connect":
    result, status = handle_inspector_cdp_connect(body)
    self._send_json(result, status)

elif path == "/inspector/cdp-dump":
    result, status = handle_inspector_cdp_dump(body)
    self._send_json(result, status)
```

---

## 10. Variables CSS del Inspector

Añadir en `styles.css` (o en `inspector.css`):

```css
:root {
  --inspector-bg:           #000000;
  --inspector-accent:       #00F5D4;
  --inspector-accent-web:   #a78bfa;
  --inspector-accent-sec:   #006F4F;
  --inspector-text:         #E0E0E0;
  --inspector-text-sec:     #888888;
  --inspector-border:       rgba(0, 245, 212, 0.2);
  --inspector-border-sec:   rgba(0, 111, 79, 0.6);
  --inspector-hover-bg:     rgba(0, 111, 79, 0.3);
  --inspector-match-bg:     rgba(0, 245, 212, 0.2);
  --inspector-error:        #FF4444;
  --inspector-font-mono:    'Courier New', monospace;
  --inspector-separator:    1px solid rgba(0, 111, 79, 0.6);
  --inspector-panel-left:   30%;
  --inspector-panel-center: 40%;
  --inspector-panel-right:  30%;
}

.inspector-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--inspector-bg);
  color: var(--inspector-text);
}

.inspector-panels {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.inspector-panel--left   { width: var(--inspector-panel-left);   overflow-y: auto; }
.inspector-panel--center { width: var(--inspector-panel-center); display: flex; flex-direction: column; align-items: center; }
.inspector-panel--right  { width: var(--inspector-panel-right);  overflow-y: auto; }

.inspector-panel-separator {
  width: var(--inspector-separator);
  background: rgba(0, 111, 79, 0.6);
  flex-shrink: 0;
}

/* Árbol colapsable */
.ui-tree-node { font-family: var(--inspector-font-mono); font-size: 12px; padding: 2px 4px; cursor: pointer; }
.ui-tree-node:hover { background: var(--inspector-hover-bg); }
.ui-tree-node.is-selected { background: rgba(0, 245, 212, 0.15); border-left: 2px solid var(--inspector-accent); }
.ui-tree-node.is-match { background: var(--inspector-match-bg); }

/* Panel de propiedades */
.prop-row { display: flex; justify-content: space-between; padding: 3px 8px; font-family: var(--inspector-font-mono); font-size: 11px; }
.prop-value--true  { color: var(--inspector-accent); }
.prop-value--false { color: #555555; }
.prop-value { cursor: pointer; }
.prop-value:hover { text-decoration: underline; }

/* Toast */
.inspector-toast {
  position: fixed; bottom: 24px; right: 24px; z-index: 9999;
  padding: 8px 16px; border-radius: 6px; font-size: 13px;
  animation: toast-in 0.2s ease-out;
}
.inspector-toast--success { background: rgba(0,245,212,0.15); border: 1px solid var(--inspector-accent); color: var(--inspector-accent); }
.inspector-toast--error   { background: rgba(255,68,68,0.15);  border: 1px solid var(--inspector-error);  color: var(--inspector-error); }

@keyframes toast-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
@media (prefers-reduced-motion: reduce) {
  .inspector-toast, .ui-tree-node, .toggle-pill { animation: none; transition: none; }
}

/* Spinner */
.inspector-spinner {
  width: 24px; height: 24px;
  border: 2px solid rgba(0,245,212,0.2);
  border-top-color: var(--inspector-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
/* El spinner NO respeta prefers-reduced-motion (por diseño, Req 10.6) */
```

---

## 11. Secuencia de Inicialización

```
DOMContentLoaded
  │
  ├── new FlowDashboardApp()          ← ya existente
  │     └── this.streamRenderer = new StreamRenderer(this)
  │
  ├── this.devInspector = new DevInspector(this, this.streamRenderer)
  │
  ├── this.devModeToggle = new DevModeToggle(this)
  │     └── toggle.render(document.querySelector('.sidebar'))
  │           └── _restore() → lee localStorage → aplica estado inicial
  │
  └── Si devMode estaba activo en localStorage:
        └── devInspector.activate()
              ├── fetch GET /devices → poblar dropdown
              ├── verificar GET /health → mostrar error si Python no disponible
              └── si había serial guardado → iniciar preview
```

---

## 12. Notas de Implementación

1. **Orden de scripts en `index.html`:** `stream-renderer.js` → `inspector.js` → `app.js`. El inspector necesita `StreamRenderer` disponible en el scope global.

2. **Compatibilidad con `prefers-reduced-motion`:** Todas las transiciones CSS del inspector usan la media query. Los spinners son la única excepción (Req 10.6).

3. **El APK FlowAgent** necesita ser recompilado con los cambios en `FlowAccessibilityService.java` para que el endpoint `/inspector/accessibility-dump` funcione. La versión actual es 0.3.3; la nueva versión con soporte de inspector debe ser 0.4.0.

4. **CDP en Android 9:** Los Samsung Galaxy S8/S8+ con Android 9 soportan CDP via `chrome_devtools_remote` si la app tiene `android:debuggable="true"`. Para apps de producción (Spotify), CDP no estará disponible y el motor de detección hará fallback a `uiautomator`.

5. **Tesseract OCR:** El método `screencap_ocr` requiere `pytesseract` y Tesseract instalado en el PC. Si no está disponible, el método devuelve un error descriptivo y el motor de detección lo salta en el fallback automático.

6. **Thread safety en caché:** `UI_TREE_CACHE` usa `UI_TREE_CACHE_LOCK` (threading.Lock) para acceso concurrente seguro desde múltiples requests HTTP simultáneos.

7. **Preservación del estado de streams WebP:** Al activar/desactivar el modo Dev, los canvas de la grilla se ocultan con `visibility:hidden` (no `display:none`) para que el `StreamRenderer` siga recibiendo y procesando frames sin interrupciones. El canvas del inspector se crea/destruye independientemente.

---

## Error Handling

| Escenario | Comportamiento |
|-----------|---------------|
| Servidor Python no disponible al activar Dev Mode | Inspector muestra "Servidor ADB no disponible" con instrucciones. No bloquea la UI. |
| `dump_ui()` timeout (>10s) | HTTP 408 desde Python. Inspector muestra error con botón de reintento. |
| Serial no encontrado o offline | HTTP 404 desde Python. Inspector muestra "Dispositivo no encontrado o no conectado". |
| Acción ADB falla (tap, scroll, etc.) | Toast rojo `#FF4444` durante 3000ms. Si toast no disponible, error en PropertiesPanel. |
| Método de detección falla | Motor intenta siguiente método en orden de prioridad. Notifica al usuario con "Método X falló — usando Y como alternativa". |
| APK no responde a `get_accessibility_tree` | Timeout de 8s en Python. HTTP 408. Inspector sugiere verificar que FlowAccessibilityService esté activo. |
| CDP: WebView sin debugging habilitado | Inspector muestra mensaje con botón "Intentar habilitar via ADB". |
| `dump_ui()` en app con FLAG_SECURE | Error descriptivo. Inspector muestra "La app puede estar bloqueando uiautomator" con sugerencias. |
| Campo `serial` vacío en cualquier endpoint | HTTP 400 con `{"error": "El campo serial es requerido"}`. |
| Árbol UI no capturado al hacer clic en preview | Mensaje informativo. No ejecuta ninguna acción ADB. |

---

## Correctness Properties

### Property 1: Preservación de streams WebP
Al activar/desactivar Dev Mode, los canvas de la grilla nunca se destruyen; solo se ocultan. El `StreamRenderer` sigue recibiendo frames sin interrupción.

**Validates: Requirements 1.5, 1.6**

### Property 2: Escalado de coordenadas
`centerX` y `centerY` en el Nodo normalizado siempre están en coordenadas nativas del dispositivo (1080×1920 para S8/S8+), independientemente del tamaño del canvas de preview.

**Validates: Requirements 4.4, 15.2**

### Property 3: Caché con TTL
El árbol UI cacheado nunca se sirve si han pasado más de 5 segundos desde la última captura. Las acciones ADB invalidan la caché inmediatamente tras ejecutarse con éxito.

**Validates: Requirements 3.1, 6.10**

### Property 4: Unicidad de IDs de nodo
Dentro de una misma captura, cada nodo tiene un `id` único (`node_XXXX`). Los IDs se regeneran en cada nueva captura; no se reutilizan entre capturas distintas.

**Validates: Requirements 15.1**

### Property 5: Debounce de búsqueda
La búsqueda en el árbol nunca dispara más de una evaluación por cada 300ms de inactividad del usuario. Con menos de 2 caracteres, no se ejecuta ninguna búsqueda.

**Validates: Requirements 7.2**

### Property 6: Highlight en menos de 50ms
El cambio de highlight al seleccionar un nodo diferente ocurre en menos de 50ms (operación síncrona en canvas 2D, sin peticiones de red).

**Validates: Requirements 4.3**

### Property 7: Persistencia de modo
El modo Dev (`flowdashboard.devMode`) y el método de detección (`flowdashboard.inspector.detectionMode`) se restauran correctamente desde `localStorage` al recargar la aplicación.

**Validates: Requirements 1.4, 11.2**

### Property 8: Thread safety en caché Python
El acceso a `UI_TREE_CACHE` y `AGENT_CONNECTIONS` en Python siempre usa los locks correspondientes (`UI_TREE_CACHE_LOCK`, `AGENT_CONNECTIONS_LOCK`), garantizando consistencia bajo requests HTTP concurrentes.

**Validates: Requirements 9.1, 9.7**

---

## Testing Strategy

### Tests unitarios (Python)
- `test_normalize_node()`: verifica que `normalize_node()` produce el schema correcto para nodos XML de uiautomator y nodos CDP.
- `test_validate_inspector_request()`: verifica validación de serial vacío (400) y serial offline (404).
- `test_ui_tree_cache()`: verifica TTL de 5s, invalidación tras acción ADB, y thread safety.
- `test_blind_search()`: verifica búsqueda case-insensitive por text, resourceId y class.
- `test_scroll_direction()`: verifica que el swipe ADB se genera correctamente para "up" y "down".

### Tests de integración (manual)
- Activar Dev Mode → verificar que la grilla de dispositivos se oculta y el streaming WebP continúa.
- Capturar UI en dispositivo real → verificar árbol colapsable con nodos correctos.
- Seleccionar nodo → verificar highlight en coordenadas correctas sobre el preview.
- Clic en preview → verificar que selecciona el nodo más pequeño que contiene las coordenadas.
- Tap sobre nodo clickable → verificar que el dispositivo responde al tap.
- Búsqueda ciega en app con FLAG_SECURE → verificar mensaje de error apropiado.
- Cambiar método de detección → verificar que el árbol se limpia y el mensaje de cambio aparece.
- Desactivar Dev Mode → verificar que la grilla se restaura con el mismo estado de selección.

### Tests de rendimiento
- Dump UI no debe bloquear el streaming: verificar que los frames WebP siguen llegando durante un dump de 10s.
- Highlight debe actualizarse en <50ms: medir con `performance.now()` en el frontend.
- Búsqueda con debounce: verificar que no se disparan peticiones con menos de 300ms entre keystrokes.
