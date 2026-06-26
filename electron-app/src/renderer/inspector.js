// FlowDashboard Pro — Dev Mode Inspector
// Tarea 1-3: Toggle + Estructura + Clase DevInspector
// Métodos de detección: Nativa (8) + Web (6)

const INSPECTOR_API = 'http://localhost:8765';

const DETECTION_METHODS = {
  native: [
    { key: 'uiautomator',   label: 'UIAutomator Dump',      desc: 'Android 4.3+. Más compatible.' },
    { key: 'accessibility', label: 'Accessibility Service', desc: 'Via APK FlowAgent. Funciona cuando uiautomator falla.' },
    { key: 'dumpsys',       label: 'Dumpsys Window',         desc: 'Paquete y actividad en foco.' },
    { key: 'viewserver',    label: 'View Server (DDMS)',      desc: 'Requiere app debuggable.' },
    { key: 'screencap_ocr', label: 'Screencap + OCR',        desc: 'Requiere Tesseract en el PC.' },
    { key: 'wm',            label: 'ADB Shell WM',           desc: 'Resolución y densidad del dispositivo.' },
    { key: 'pm_dump',       label: 'Package Manager',        desc: 'Metadatos del paquete activo.' },
    { key: 'logcat',        label: 'Logcat Filter',          desc: 'Últimos 100 logs de la app.' },
  ],
  web: [
    { key: 'cdp',              label: 'Chrome DevTools (CDP)', desc: 'WebView con debugging habilitado.' },
    { key: 'js_inject',        label: 'JS Injection',          desc: 'DOM via CDP Runtime.evaluate.' },
    { key: 'react_native',     label: 'React Native',          desc: 'Árbol de componentes RN.' },
    { key: 'ionic',            label: 'Ionic / Cordova',       desc: 'WebView de apps Ionic.' },
    { key: 'flutter',          label: 'Flutter Inspector',     desc: 'Widgets via Dart VM Service.' },
    { key: 'network_intercept',label: 'Network Intercept',     desc: 'Requiere mitmproxy en el PC.' },
  ],
};

const AUTO_DETECT_PRIORITY = ['uiautomator', 'accessibility', 'cdp', 'dumpsys', 'screencap_ocr'];

class DevInspector {
  constructor(app) {
    this.app = app;
    this._storageKeys = {
      devMode: 'flowdashboard.devMode',
      detectionMode: 'flowdashboard.inspector.detectionMode',
      selectedSerial: 'flowdashboard.inspector.selectedSerial',
      legacySerial: 'flowdashboard.inspector.serial',
      expansionState: 'flowdashboard.inspector.expansionState',
      autoDetectTimings: 'flowdashboard.inspector.autoDetectTimings',
    };
    this.selectedSerial = null;
    this.detectionGroup = 'native';
    this.detectionMode  = 'uiautomator';
    this.currentNodes   = [];   // array plano de nodos normalizados
    this.selectedNodeId = null;
    this.expansionState = new Map(); // nodeId → boolean
    this.searchResults  = [];
    this.searchIndex    = 0;
    this.fallbackActive = false;
    this._searchTimer   = null;
    this._hoverTimer    = null;
    this.isDryRunEnabled = localStorage.getItem('flowdashboard.inspector.dryRun') === '1';
    this.consoleBusy     = false;
    this.consoleLogs     = [];
    this._lastSelectedFingerprint = null;
    this.lastDetectionInfo = null;
    this.lastAutoDetectTimings = null;
    // Resolución nativa de referencia (Samsung Galaxy S8/S8+)
    this.DEVICE_W = 1080;
    this.DEVICE_H = 1920;
    // Canvas overlay
    this.overlayCtx = null;
  }

  // ─── Ciclo de vida ────────────────────────────────────────────────────────

  onActivate() {
    this.restoreState();
    this._initOverlay();
    this._populateDeviceDropdown();
    this.setDetectionGroup(this.detectionGroup); // inicializa el select de métodos
    this._updateMethodLabel();

    // Arrancar preview si ya hay serial guardado
    if (this.selectedSerial) {
      this._startPreview(this.selectedSerial);
    }

    // Avisar si Python no está disponible
    if (!this.app.pythonConnected) {
      this._showError('Servidor ADB no disponible. Inicia local_adb_server.py para usar el inspector.');
    }

    // Actualizar resolución real del dispositivo si está disponible
    if (this.selectedSerial) this._fetchDeviceResolution(this.selectedSerial);

    this._ensureActionConsole();
    this._setActionConsoleVisible(true);
    this._setActionConsoleStatus('Action Console lista');
    this._setActionConsoleBusy(false);
    this._updateActionConsoleTarget(this.currentNodes.find(n => n.id === this.selectedNodeId) || null);
    this._updateBaseDiagnostic();
  }

  onDeactivate() {
    this._stopPreview();
    this.clearHighlight();
    this._setActionConsoleVisible(false);
    this._setActionConsoleBusy(false);
  }

  // Llamado desde app.js cuando la lista de dispositivos cambia
  onDevicesUpdated() {
    if (this._isFlowDevEnabled()) this._populateDeviceDropdown();
  }

  async _fetchDeviceResolution(serial) {
    // Obtener resolución real via wm size para escalar correctamente el overlay
    try {
      const res = await fetch(`${INSPECTOR_API}/inspector/native-detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, method: 'wm' }),
      });
      const data = await res.json();
      if (data.ok && data.meta.size) {
        const m = data.meta.size.match(/(\d+)x(\d+)/);
        if (m) {
          this.DEVICE_W = parseInt(m[1], 10);
          this.DEVICE_H = parseInt(m[2], 10);
        }
      }
    } catch (_) { /* silencioso — usar valores por defecto */ }
  }

  // ─── Dispositivos ─────────────────────────────────────────────────────────

  _populateDeviceDropdown() {
    const sel = document.getElementById('inspectorDeviceSelect');
    if (!sel) return;
    const devices = this.app.devices || [];
    if (!devices.length) {
      sel.innerHTML = '<option value="" disabled selected>No hay dispositivos conectados</option>';
      this.selectedSerial = null;
      this._setInspectorControlsEnabled(false);
      this._stopPreview();
      this.clearTree();
      this.clearProps();
      return;
    }
    this._setInspectorControlsEnabled(true);
    sel.innerHTML = devices.map(d => {
      const stableId = this.app.getDeviceStableId ? this.app.getDeviceStableId(d) : d.serial;
      const name = this.app.deviceNames[stableId] || this.app.deviceNames[d.serial] || d.model || d.serial;
      return `<option value="${this._esc(d.serial)}">${this._esc(name)} — ${this._esc(this.app.shortSerial ? this.app.shortSerial(d.serial) : d.serial)}</option>`;
    }).join('');

    const hasSelected = this.selectedSerial && devices.find(d => d.serial === this.selectedSerial);
    const nextSerial = hasSelected ? this.selectedSerial : devices[0].serial;
    sel.value = nextSerial;
    if (this.selectedSerial !== nextSerial) this.selectedSerial = nextSerial;
    this.saveState();
    sel.onchange = () => this.selectDevice(sel.value);
  }

  _setInspectorControlsEnabled(enabled) {
    [
      'btnCaptureUI',
      'btnAutoDetect',
      'btnFallback',
      'btnMethodNative',
      'btnMethodWeb',
      'inspectorMethodSelect',
      'inspectorSearchInput',
      'inspectorSearchField',
      'blindSearchInput',
      'blindSearchField',
      'btnBlindSearch',
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });
  }

  selectDevice(serial) {
    if (!serial) return;
    if (this.selectedSerial === serial) return; // sin cambio
    this.selectedSerial = serial;
    this.saveState();
    this._stopPreview();
    this._startPreview(serial);
    this.clearTree();
    this.clearProps();
    this._fetchDeviceResolution(serial);
  }

  // ─── Preview canvas ───────────────────────────────────────────────────────

  _startPreview(serial) {
    const canvas = document.getElementById('inspectorPreviewCanvas');
    const empty  = document.getElementById('inspectorPreviewEmpty');
    if (!canvas || !this.app.streamRenderer) return;

    // Registrar canvas en el StreamRenderer usando el serial como clave
    // Si ya existe un canvas para este serial (del modo normal), lo reemplazamos
    // temporalmente con el canvas del inspector
    this._inspectorCanvasSerial = serial;
    this.app.streamRenderer.createCanvas(serial, 360, 640, canvas);

    if (empty) empty.style.display = 'none';
    canvas.style.display = 'block';
    canvas.onclick = (e) => this._onPreviewClick(e);

    // Sincronizar overlay después de que el canvas tenga dimensiones reales
    requestAnimationFrame(() => this._syncOverlay());
  }

  _stopPreview() {
    const canvas = document.getElementById('inspectorPreviewCanvas');
    if (this._inspectorCanvasSerial && this.app.streamRenderer.detachCanvas) {
      this.app.streamRenderer.detachCanvas(this._inspectorCanvasSerial, canvas);
    }
    if (canvas) {
      canvas.onclick = null;
      canvas.style.display = 'none';
    }
    // No destruimos el canvas del StreamRenderer — solo dejamos de usarlo
    // El modo normal seguirá recibiendo frames en su propio canvas
    this._inspectorCanvasSerial = null;
  }

  _syncOverlay() {
    const overlay = document.getElementById('inspectorOverlayCanvas');
    const preview = document.getElementById('inspectorPreviewCanvas');
    if (!overlay || !preview) return;
    const w = preview.clientWidth  || preview.width  || 360;
    const h = preview.clientHeight || preview.height || 640;
    overlay.width  = w;
    overlay.height = h;
    overlay.style.width  = w + 'px';
    overlay.style.height = h + 'px';
    // Redibujar highlight activo si existe
    if (this.selectedNodeId) {
      const node = this.currentNodes.find(n => n.id === this.selectedNodeId);
      if (node && node.bounds) this.drawHighlight(node, false);
    }
  }

  _initOverlay() {
    const overlay = document.getElementById('inspectorOverlayCanvas');
    if (!overlay) return;
    this.overlayCtx = overlay.getContext('2d');
    const preview = document.getElementById('inspectorPreviewCanvas');
    if (preview) {
      new ResizeObserver(() => this._syncOverlay()).observe(preview);
    }
  }

  // ─── Captura de UI ────────────────────────────────────────────────────────

  async captureUI(options = {}) {
    if (!this.selectedSerial) { this._showError('Selecciona un dispositivo primero.'); return; }
    const allowFallback = options.allowFallback !== false;
    const source = String(options.source || 'capture');
    const successToast = options.successToast !== false;
    const skipLoading = !!options.skipLoading;
    if (!skipLoading) this._setTreeLoading(true);
    try {
      const attempts = this._buildCaptureAttemptOrder(this.detectionMode, allowFallback);
      let lastError = null;
      for (let i = 0; i < attempts.length; i += 1) {
        const method = attempts[i];
        if (this.detectionMode !== method) this.setDetectionMode(method, { clearTree: false, notifyChange: false });
        try {
          const data = await this._requestCaptureByMethod(method);
          const applied = this._applyCaptureResult(data, source);
          if (successToast) this.showToast(`${this.currentNodes.length} nodos capturados`, '#00F5D4', 1500);
          return applied;
        } catch (err) {
          lastError = err;
          const nextMethod = attempts[i + 1];
          if (nextMethod) {
            this.showToast(`Método ${this._getMethodLabel(method)} falló — usando ${this._getMethodLabel(nextMethod)} como alternativa.`, '#f59e0b', 2600);
            continue;
          }
          throw err;
        }
      }
      if (lastError) throw lastError;
      throw new Error('No se pudo capturar el árbol UI.');
    } catch (err) {
      this._showTreeError(err.message);
    } finally {
      if (!skipLoading) this._setTreeLoading(false);
    }
  }

  async autoDetect() {
    if (!this.selectedSerial) { this._showError('Selecciona un dispositivo primero.'); return; }
    this._setTreeLoading(true);
    try {
      const res = await fetch(`${INSPECTOR_API}/inspector/auto-detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial: this.selectedSerial }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Auto-detección fallida');
      const methodUsed = String(data.method_used || '').trim() || 'uiautomator';
      this.lastAutoDetectTimings = (data.timings && typeof data.timings === 'object') ? data.timings : null;
      this.setDetectionMode(methodUsed, { clearTree: false, notifyChange: false });
      this.lastDetectionInfo = {
        source: 'auto-detect',
        methodUsed,
        timings: this.lastAutoDetectTimings,
        meta: data.meta || null,
        cached: !!data.cached,
      };
      this._applyMethodTimingsTooltip(this.lastAutoDetectTimings);
      this._updateBaseDiagnostic();
      const captured = await this.captureUI({
        allowFallback: true,
        source: 'auto-detect',
        successToast: false,
        skipLoading: true,
      });
      if (captured) {
        this.showToast(`Auto-detectado: ${this._getMethodLabel(captured)} (${this.currentNodes.length} nodos)`, '#00F5D4', 2000);
      }
    } catch (err) {
      this._showTreeError(err.message);
    } finally {
      this._setTreeLoading(false);
    }
  }

  _methodExistsInGroup(group, method) {
    const methods = DETECTION_METHODS[group] || [];
    return !!methods.find(m => m.key === method);
  }

  _resolveGroupForMethod(method) {
    if (this._methodExistsInGroup('web', method)) return 'web';
    return 'native';
  }

  _getMethodLabel(method) {
    const all = [...DETECTION_METHODS.native, ...DETECTION_METHODS.web];
    const found = all.find(m => m.key === method);
    return found ? found.label : String(method || 'n/d');
  }

  _buildCaptureAttemptOrder(activeMethod, allowFallback) {
    const mode = String(activeMethod || '').trim();
    if (!allowFallback) return mode ? [mode] : [];
    const seen = new Set();
    const order = [];
    const push = (method) => {
      const key = String(method || '').trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      order.push(key);
    };
    if (!mode) {
      AUTO_DETECT_PRIORITY.forEach(push);
      return order;
    }
    const idx = AUTO_DETECT_PRIORITY.indexOf(mode);
    if (idx >= 0) {
      push(mode);
      AUTO_DETECT_PRIORITY.slice(idx + 1).forEach(push);
      AUTO_DETECT_PRIORITY.slice(0, idx).forEach(push);
      return order;
    }
    push(mode);
    AUTO_DETECT_PRIORITY.forEach(push);
    return order;
  }

  async _requestCaptureByMethod(method) {
    const group = this._resolveGroupForMethod(method);
    const endpoint = group === 'web'
      ? `${INSPECTOR_API}/inspector/web-detect`
      : `${INSPECTOR_API}/inspector/native-detect`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serial: this.selectedSerial, method }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `Captura fallida con ${this._getMethodLabel(method)}`);
    return data;
  }

  _applyCaptureResult(data, source) {
    const methodUsed = String(data.method_used || this.detectionMode || '').trim() || this.detectionMode;
    this.setDetectionMode(methodUsed, { clearTree: false, notifyChange: false });
    this.lastDetectionInfo = {
      source: String(source || 'capture'),
      methodUsed: methodUsed || '',
      timings: data.timings || this.lastAutoDetectTimings || null,
      meta: data.meta || null,
      cached: !!data.cached,
    };
    this.currentNodes = data.nodes || [];
    this._renderTree(this.currentNodes);
    this._updateMethodLabel();
    this._applyMethodTimingsTooltip(this.lastDetectionInfo.timings);
    this._updateBaseDiagnostic();
    return methodUsed;
  }

  _applyMethodTimingsTooltip(timings) {
    const label = document.getElementById('inspectorMethodLabel');
    if (!label) return;
    const text = this._formatDetectionTimings(timings);
    if (!text || text === 'n/d') {
      label.removeAttribute('title');
      return;
    }
    label.title = `Tiempos auto-detect: ${text}`;
  }

  setDetectionMode(mode, options = {}) {
    const value = String(mode || '').trim();
    if (!value) return this.detectionMode;
    const group = this._resolveGroupForMethod(value);
    const clearTree = options.clearTree !== false;
    const notifyChange = options.notifyChange !== false;
    this.detectionGroup = group;
    this.detectionMode = value;
    const sel = document.getElementById('inspectorMethodSelect');
    if (sel) {
      const methods = DETECTION_METHODS[group] || [];
      sel.innerHTML = methods.map(m => `<option value="${m.key}" title="${m.desc}">${m.label}</option>`).join('');
      sel.value = value;
    }
    document.getElementById('btnMethodNative').classList.toggle('is-active', group === 'native');
    document.getElementById('btnMethodWeb').classList.toggle('is-active', group === 'web');
    this.saveState();
    this._updateMethodLabel();
    if (clearTree) this.clearTree();
    if (notifyChange) this.showToast(`Modo de detección cambiado a ${this._getMethodLabel(value)}. Captura el árbol UI para continuar.`, '#a0a0a0', 2200);
    return this.detectionMode;
  }

  // ─── Árbol UI ─────────────────────────────────────────────────────────────

  _renderTree(nodes) {
    const container = document.getElementById('inspectorTreeContainer');
    const empty     = document.getElementById('inspectorTreeEmpty');
    if (!container) return;
    if (!nodes || !nodes.length) {
      if (empty) empty.style.display = 'flex';
      return;
    }
    if (empty) empty.style.display = 'none';

    // Construir mapa id → nodo
    const map = new Map(nodes.map(n => [n.id, n]));
    // Encontrar raíces (sin padre o padre no en el mapa)
    const roots = nodes.filter(n => !n.parent || !map.has(n.parent));

    const buildEl = (node, depth) => {
      const li = document.createElement('li');
      li.className = 'inspector-tree-node';
      li.dataset.nodeId = node.id;

      const hasChildren = node.children && node.children.length > 0;
      const isExpanded  = depth < 3 ? (this.expansionState.get(node.id) !== false) : (this.expansionState.get(node.id) === true);
      const shortClass  = (node.class || node.tagName || '').split('.').pop();
      const label       = node.text || node.contentDesc || '';

      li.innerHTML = `
        <div class="inspector-node-row" data-node-id="${this._esc(node.id)}">
          <span class="inspector-node-toggle ${hasChildren ? '' : 'is-leaf'}">${hasChildren ? (isExpanded ? '▾' : '▸') : '·'}</span>
          <span class="inspector-node-class">${this._esc(shortClass)}</span>
          ${label ? `<span class="inspector-node-label">${this._esc(label.substring(0, 40))}</span>` : ''}
          ${(node.centerX == null || node.centerY == null) ? '<span class="inspector-node-warn" title="Sin coordenadas">⚠</span>' : ''}
        </div>`;

      if (hasChildren) {
        const ul = document.createElement('ul');
        ul.className = 'inspector-tree-children';
        ul.style.display = isExpanded ? '' : 'none';
        node.children.forEach(childId => {
          const child = map.get(childId);
          if (child) ul.appendChild(buildEl(child, depth + 1));
        });
        li.appendChild(ul);
      }

      // Eventos
      const row = li.querySelector('.inspector-node-row');
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (hasChildren) this._toggleNodeExpand(node.id, li);
        this.selectNode(node.id);
      });
      row.addEventListener('mouseenter', () => {
        clearTimeout(this._hoverTimer);
        this._hoverTimer = setTimeout(() => {
          if (node.bounds) this.drawHighlight(node, true);
        }, 50);
      });
      row.addEventListener('mouseleave', () => {
        clearTimeout(this._hoverTimer);
        if (this.selectedNodeId && this.selectedNodeId !== node.id) {
          const sel = this.currentNodes.find(n => n.id === this.selectedNodeId);
          if (sel && sel.bounds) this.drawHighlight(sel, false);
          else this.clearHighlight();
        } else if (!this.selectedNodeId) {
          this.clearHighlight();
        }
      });
      return li;
    };

    const ul = document.createElement('ul');
    ul.className = 'inspector-tree-root';
    roots.forEach(r => ul.appendChild(buildEl(r, 0)));
    container.innerHTML = '';
    container.appendChild(ul);
  }

  _toggleNodeExpand(nodeId, liEl) {
    const ul = liEl.querySelector('.inspector-tree-children');
    const toggle = liEl.querySelector('.inspector-node-toggle');
    if (!ul) return;
    const expanded = ul.style.display !== 'none';
    ul.style.display = expanded ? 'none' : '';
    if (toggle) toggle.textContent = expanded ? '▸' : '▾';
    this.expansionState.set(nodeId, !expanded);
    this.saveState();
  }

  clearTree() {
    const container = document.getElementById('inspectorTreeContainer');
    const empty     = document.getElementById('inspectorTreeEmpty');
    if (container) container.innerHTML = '';
    if (empty) { empty.style.display = 'flex'; container && container.appendChild(empty); }
    this.currentNodes   = [];
    this.selectedNodeId = null;
    this.searchResults  = [];
    this.lastDetectionInfo = null;
    this.clearHighlight();
    this._updateActionConsoleTarget(null);
    this._updateBaseDiagnostic();
  }

  _setTreeLoading(loading) {
    const spinner = document.getElementById('inspectorTreeSpinner');
    const empty   = document.getElementById('inspectorTreeEmpty');
    if (spinner) spinner.style.display = loading ? 'block' : 'none';
    if (empty && loading) empty.style.display = 'none';
  }

  _showTreeError(msg) {
    const container = document.getElementById('inspectorTreeContainer');
    if (!container) return;
    container.innerHTML = `
      <div class="inspector-error-state">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="#ff4466" fill="none" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>${this._esc(msg)}</span>
        <button class="inspector-btn inspector-btn--secondary" onclick="app.devInspector.captureUI()">Reintentar</button>
      </div>`;
  }

  // ─── Selección de nodo ────────────────────────────────────────────────────

  selectNode(nodeId) {
    this.selectedNodeId = nodeId;
    // Resaltar en árbol
    document.querySelectorAll('.inspector-node-row').forEach(r => r.classList.remove('is-selected'));
    const row = document.querySelector(`.inspector-node-row[data-node-id="${CSS.escape(nodeId)}"]`);
    if (row) {
      row.classList.add('is-selected');
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    const node = this.currentNodes.find(n => n.id === nodeId);
    if (node) {
      if (node.bounds) this.drawHighlight(node, false);
      else this.clearHighlight();
      this._renderProps(node);
      this._updateActionConsoleTarget(node);
    } else {
      this.clearHighlight();
      this._updateActionConsoleTarget(null);
    }
  }

  _onPreviewClick(event) {
    if (!this.currentNodes.length) {
      this.showToast('Captura el árbol UI primero para habilitar la selección por clic', '#a0a0a0', 2000);
      return;
    }
    const canvas = event.currentTarget;
    const rect   = canvas.getBoundingClientRect();
    const nativeX = (event.clientX - rect.left) / rect.width  * this.DEVICE_W;
    const nativeY = (event.clientY - rect.top)  / rect.height * this.DEVICE_H;

    let best = null, bestArea = Infinity;
    for (const node of this.currentNodes) {
      const b = node.bounds;
      if (!b) continue;
      if (nativeX >= b.left && nativeX <= b.right && nativeY >= b.top && nativeY <= b.bottom) {
        const area = b.width * b.height;
        if (area < bestArea) { bestArea = area; best = node; }
      }
    }
    if (best) this.selectNode(best.id);
  }

  // ─── Highlight overlay ────────────────────────────────────────────────────

  drawHighlight(node, provisional) {
    if (!node.bounds) return;
    const overlay = document.getElementById('inspectorOverlayCanvas');
    if (!overlay) return;
    if (!this.overlayCtx) this.overlayCtx = overlay.getContext('2d');

    // Sincronizar tamaño con el preview en cada dibujado
    const preview = document.getElementById('inspectorPreviewCanvas');
    if (preview && (overlay.width !== preview.clientWidth || overlay.height !== preview.clientHeight)) {
      overlay.width  = preview.clientWidth  || 360;
      overlay.height = preview.clientHeight || 640;
    }

    const b = node.bounds;
    const scaleX = overlay.width  / this.DEVICE_W;
    const scaleY = overlay.height / this.DEVICE_H;
    const x = b.left  * scaleX;
    const y = b.top   * scaleY;
    const w = b.width * scaleX;
    const h = b.height * scaleY;

    this.overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    this.overlayCtx.globalAlpha = provisional ? 0.5 : 1.0;
    this.overlayCtx.fillStyle   = 'rgba(0,245,212,0.15)';
    this.overlayCtx.fillRect(x, y, w, h);
    this.overlayCtx.strokeStyle = '#00F5D4';
    this.overlayCtx.lineWidth   = 2;
    this.overlayCtx.strokeRect(x, y, w, h);
    // Etiqueta con el nombre de la clase
    const shortClass = (node.class || node.tagName || '').split('.').pop();
    if (shortClass && !provisional) {
      this.overlayCtx.font      = '11px Courier New, monospace';
      this.overlayCtx.fillStyle = '#00F5D4';
      this.overlayCtx.globalAlpha = 0.9;
      this.overlayCtx.fillRect(x, y - 16, Math.min(shortClass.length * 7 + 6, w), 16);
      this.overlayCtx.fillStyle = '#000';
      this.overlayCtx.fillText(shortClass, x + 3, y - 4);
    }
    this.overlayCtx.globalAlpha = 1.0;
  }

  clearHighlight() {
    const overlay = document.getElementById('inspectorOverlayCanvas');
    if (!overlay) return;
    if (!this.overlayCtx) this.overlayCtx = overlay.getContext('2d');
    this.overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  }

  // ─── Panel de propiedades ─────────────────────────────────────────────────

  _renderProps(node) {
    const empty  = document.getElementById('inspectorPropsEmpty');
    const table  = document.getElementById('inspectorPropsTable');
    const actions = document.getElementById('inspectorActions');
    if (!table) return;
    if (empty) empty.style.display = 'none';
    table.style.display = 'block';

    const boolAttrs = ['clickable','enabled','focusable','scrollable','longClickable','checkable','checked','selected','focused','password'];
    const matchPos = this.searchResults.findIndex(n => n.id === node.id);
    const extraAttrs = {
      nodeId: node.id,
      method: node.method || node.detectionSource || '',
      index: node.index,
      parent: node.parent || '(root)',
      childrenCount: Array.isArray(node.children) ? node.children.length : 0,
      searchMatch: matchPos >= 0 ? `${matchPos + 1}/${this.searchResults.length}` : '',
    };
    const valueMap = { ...node, ...extraAttrs };
    const mainAttrs = ['nodeId','method','detectionSource','index','parent','childrenCount','searchMatch','class','tagName','text','resourceId','domId','contentDesc','package'];
    const rows = [...mainAttrs, ...boolAttrs, 'bounds','centerX','centerY','depth'].map(key => {
      let val = valueMap[key];
      if (val === undefined || val === null || val === '') return '';
      if (key === 'bounds' && typeof val === 'object') val = `[${val.left},${val.top}][${val.right},${val.bottom}]`;
      const isBool = boolAttrs.includes(key);
      const cls    = isBool ? (val === true ? 'prop-true' : 'prop-false') : '';
      return `<div class="inspector-prop-row">
        <span class="inspector-prop-key">${this._esc(key)}</span>
        <span class="inspector-prop-val ${cls}" onclick="app.devInspector._copyProp(this, '${this._esc(String(val))}')"
              title="Clic para copiar">${this._esc(String(val))}</span>
      </div>`;
    }).join('');
    table.innerHTML = `<div class="inspector-props-list">${rows}</div>`;
    this._renderActions(node, actions);
  }

  async _copyProp(el, value) {
    try {
      await navigator.clipboard.writeText(value);
      const orig = el.textContent;
      el.textContent = 'Copiado';
      el.classList.add('prop-copied');
      setTimeout(() => { el.textContent = orig; el.classList.remove('prop-copied'); }, 1500);
    } catch (_) {}
  }

  clearProps() {
    const empty  = document.getElementById('inspectorPropsEmpty');
    const table  = document.getElementById('inspectorPropsTable');
    const actions = document.getElementById('inspectorActions');
    if (empty)  empty.style.display = 'flex';
    if (table)  { table.style.display = 'none'; table.innerHTML = ''; }
    if (actions) actions.innerHTML = '';
  }

  // ─── Acciones sobre el nodo ───────────────────────────────────────────────

  _renderActions(node, container) {
    if (!container) return;
    const btns = [];
    if (node.clickable && node.centerX != null && node.centerY != null)     btns.push(`<button class="inspector-action-btn" onclick="app.devInspector.execAction('tap','${node.id}')">Tap</button>`);
    if (node.longClickable && node.centerX != null && node.centerY != null) btns.push(`<button class="inspector-action-btn" onclick="app.devInspector.execAction('long-press','${node.id}')">Long Press</button>`);
    if (node.scrollable && node.bounds && node.centerX != null && node.centerY != null) {
      btns.push(`<button class="inspector-action-btn" onclick="app.devInspector.execAction('scroll-up','${node.id}')">Scroll ↑</button>`);
      btns.push(`<button class="inspector-action-btn" onclick="app.devInspector.execAction('scroll-down','${node.id}')">Scroll ↓</button>`);
    }
    if ((node.class || '').includes('EditText')) {
      btns.push(`<div class="inspector-input-row">
        <input type="text" id="inspectorInputText" class="inspector-search-input" placeholder="Texto a ingresar...">
        <button class="inspector-action-btn" onclick="app.devInspector.execAction('input-text','${node.id}')">Ingresar</button>
      </div>`);
    }
    container.innerHTML = btns.length
      ? `<div class="inspector-actions-wrap">${btns.join('')}</div>`
      : '';
  }

  async execAction(action, nodeId) {
    const node = this.currentNodes.find(n => n.id === nodeId);
    if (!node || !this.selectedSerial) return;
    const serial = this.selectedSerial;
    const x = node.centerX, y = node.centerY;
    if ((action === 'tap' || action === 'long-press' || action === 'input-text') && (x == null || y == null)) {
      this.showToast('El elemento seleccionado no tiene coordenadas válidas.', '#ff4466', 2400);
      return;
    }
    if ((action === 'scroll-up' || action === 'scroll-down') && (!node.bounds || x == null || y == null)) {
      this.showToast('El elemento seleccionado no tiene bounds/coordenadas válidas para scroll.', '#ff4466', 2400);
      return;
    }
    let endpoint, body;
    switch (action) {
      case 'tap':
        endpoint = '/inspector/tap'; body = { serial, x, y }; break;
      case 'long-press':
        endpoint = '/inspector/long-press'; body = { serial, x, y, duration: 800 }; break;
      case 'scroll-up':
        endpoint = '/inspector/scroll';
        body = { serial, x, y1: node.bounds.top, y2: node.bounds.bottom, direction: 'up' }; break;
      case 'scroll-down':
        endpoint = '/inspector/scroll';
        body = { serial, x, y1: node.bounds.top, y2: node.bounds.bottom, direction: 'down' }; break;
      case 'input-text': {
        const text = document.getElementById('inspectorInputText').value || '';
        endpoint = '/inspector/input-text'; body = { serial, x, y, text }; break;
      }
      default: return;
    }

    // Deshabilitar botones durante la acción
    const actionsEl = document.getElementById('inspectorActions');
    const btns = actionsEl.querySelectorAll('button');
    btns.forEach(b => b.disabled = true);

    try {
      const res  = await fetch(`${INSPECTOR_API}${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Error en acción');
      this.showToast('Acción ejecutada', '#00F5D4', 1500);
      // Ofrecer refrescar el árbol
      if (actionsEl) {
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'inspector-action-btn';
        refreshBtn.style.marginTop = '6px';
        refreshBtn.textContent = 'Refrescar UI';
        refreshBtn.onclick = () => { refreshBtn.remove(); this.captureUI(); };
        actionsEl.appendChild(refreshBtn);
      }
    } catch (err) {
      this.showToast(err.message, '#ff4466', 3000);
    } finally {
      btns.forEach(b => b.disabled = false);
    }
  }

  // ─── Búsqueda en árbol ────────────────────────────────────────────────────

  onSearchInput(query) {
    clearTimeout(this._searchTimer);
    if (query.length < 2) { this._clearSearch(); return; }
    this._searchTimer = setTimeout(() => this._applySearch(query), 300);
  }

  _applySearch(query) {
    const field = document.getElementById('inspectorSearchField').value || 'any';
    const count = document.getElementById('inspectorSearchCount');
    const nav   = document.getElementById('inspectorSearchNav');
    const q = query.toLowerCase();
    this.searchResults = this.currentNodes.filter(n => {
      if (field === 'any' || field === 'text')       if ((n.text || '').toLowerCase().includes(q)) return true;
      if (field === 'any' || field === 'resourceId') if ((n.resourceId || '').toLowerCase().includes(q)) return true;
      if (field === 'any' || field === 'class')      if ((n.class || '').toLowerCase().includes(q)) return true;
      return false;
    });
    this.searchIndex = 0;
    document.querySelectorAll('.inspector-node-row').forEach(r => r.classList.remove('is-match'));
    this.searchResults.forEach(n => {
      const row = document.querySelector(`.inspector-node-row[data-node-id="${CSS.escape(n.id)}"]`);
      if (row) row.classList.add('is-match');
    });

    if (!this.searchResults.length) {
      if (nav) nav.style.display = 'none';
      if (count) count.textContent = `Sin resultados para "${query}"`;
      this._updateBaseDiagnostic();
      return;
    }

    if (nav) nav.style.display = 'flex';
    if (count) count.textContent = `1/${this.searchResults.length}`;
    this.selectNode(this.searchResults[0].id);
  }

  navigateSearch(dir) {
    if (!this.searchResults.length) return;
    this.searchIndex = (this.searchIndex + dir + this.searchResults.length) % this.searchResults.length;
    this.selectNode(this.searchResults[this.searchIndex].id);
    const count = document.getElementById('inspectorSearchCount');
    if (count) count.textContent = `${this.searchIndex + 1}/${this.searchResults.length}`;
  }

  _clearSearch() {
    document.querySelectorAll('.inspector-node-row').forEach(r => r.classList.remove('is-match'));
    const nav = document.getElementById('inspectorSearchNav');
    const count = document.getElementById('inspectorSearchCount');
    if (nav) nav.style.display = 'none';
    if (count) count.textContent = '0 resultados';
    this.searchResults = [];
    this.searchIndex   = 0;
    this._updateBaseDiagnostic();
  }

  // ─── Modo Fallback ────────────────────────────────────────────────────────

  toggleFallback() {
    this.fallbackActive = !this.fallbackActive;
    const preview  = document.getElementById('inspectorPreviewWrap');
    const fallback = document.getElementById('inspectorFallbackPanel');
    const btn      = document.getElementById('btnFallback');
    if (preview) preview.style.display  = this.fallbackActive ? 'none' : 'flex';
    if (fallback) fallback.style.display = this.fallbackActive ? 'flex' : 'none';
    if (btn)      btn.classList.toggle('is-active', this.fallbackActive);
  }

  async blindSearch() {
    if (!this.selectedSerial) { this._showError('Selecciona un dispositivo primero.'); return; }
    const input   = document.getElementById('blindSearchInput');
    const field   = document.getElementById('blindSearchField').value || 'any';
    const results = document.getElementById('blindSearchResults');
    const btn     = document.getElementById('btnBlindSearch');
    const query   = input.value.trim();
    if (!query) return;
    if (btn) btn.disabled = true;
    if (results) results.innerHTML = '<div class="inspector-spinner" style="margin:16px auto;"></div>';
    try {
      const res  = await fetch(`${INSPECTOR_API}/inspector/blind-search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial: this.selectedSerial, query, field }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Error en búsqueda');
      if (!results) return;
      if (!data.results.length) {
        results.innerHTML = `<div class="inspector-empty-state"><span>Sin resultados para "${this._esc(query)}"</span></div>`;
        return;
      }
      results.innerHTML = data.results.map((r, i) => `
        <div class="blind-result-card">
          <div class="blind-result-class">${this._esc((r.class || '').split('.').pop())}</div>
          ${r.text ? `<div class="blind-result-text">${this._esc(r.text)}</div>` : ''}
          ${r.resourceId ? `<div class="blind-result-id">${this._esc(r.resourceId)}</div>` : ''}
          <div class="blind-result-coords">cx:${r.centerX ?? ''} cy:${r.centerY ?? ''}</div>
          <div class="blind-result-badges">
            ${r.clickable ? '<span class="blind-badge badge-ok">clickable</span>' : ''}
            ${r.enabled ? '<span class="blind-badge badge-ok">enabled</span>' : '<span class="blind-badge badge-off">disabled</span>'}
          </div>
          ${r.centerX != null ? `<button class="inspector-action-btn" onclick="app.devInspector._blindTap(${r.centerX},${r.centerY})">Tap</button>` : ''}
        </div>`).join('');
    } catch (err) {
      if (results) results.innerHTML = `<div class="inspector-error-state"><span>${this._esc(err.message)}</span></div>`;
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async _blindTap(x, y) {
    if (!this.selectedSerial) return;
    try {
      const res  = await fetch(`${INSPECTOR_API}/inspector/tap`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial: this.selectedSerial, x, y }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      this.showToast('Tap ejecutado', '#00F5D4', 1500);
    } catch (err) {
      this.showToast(err.message, '#ff4466', 3000);
    }
  }

  // ─── Selector de modo de detección ───────────────────────────────────────

  setDetectionGroup(group) {
    this.detectionGroup = group;
    const sel = document.getElementById('inspectorMethodSelect');
    if (!sel) return;
    const methods = DETECTION_METHODS[group] || [];
    sel.innerHTML = methods.map(m => `<option value="${m.key}" title="${m.desc}">${m.label}</option>`).join('');
    const current = String(this.detectionMode || '').trim();
    const nextMode = (current && methods.find(m => m.key === current)) ? current : (methods[0].key || '');
    if (nextMode) this.setDetectionMode(nextMode, { clearTree: true, notifyChange: false });
    else {
      document.getElementById('btnMethodNative').classList.toggle('is-active', group === 'native');
      document.getElementById('btnMethodWeb').classList.toggle('is-active', group === 'web');
      this._updateMethodLabel();
      this.saveState();
      this.clearTree();
    }
    sel.onchange = () => { this.setDetectionMode(sel.value); };
  }

  _updateMethodLabel() {
    const label = document.getElementById('inspectorMethodLabel');
    if (!label) return;
    label.textContent = this._getMethodLabel(this.detectionMode);
    const timings = this.lastDetectionInfo.timings || this.lastAutoDetectTimings || null;
    this._applyMethodTimingsTooltip(timings);
  }

  _isFlowDevEnabled() {
    return !!(this.app && (this.app.isFlowDevEnabled || this.app.devMode));
  }

  _ensureActionConsole() {
    const panel = document.getElementById('inspectorPanelProps');
    if (!panel) return;

    let consoleEl = document.getElementById('flowDevActionConsole');
    if (!consoleEl) {
      consoleEl = document.createElement('div');
      consoleEl.id = 'flowDevActionConsole';
      consoleEl.className = 'flowdev-action-console';
      consoleEl.innerHTML = `
        <div class="flowdev-action-console-header">
          <span class="flowdev-action-console-title">Action Console</span>
          <label class="flowdev-dry-run-toggle">
            <input type="checkbox" id="flowDevDryRunToggle" onchange="app.devInspector.toggleActionConsoleDryRun(this.checked)">
            <span>Dry Run</span>
          </label>
        </div>
        <div id="flowDevActionTarget" class="flowdev-action-target">Sin elemento seleccionado</div>
        <div class="flowdev-selector-box">
          <div class="flowdev-selector-head">
            <span class="flowdev-selector-title">Selector recomendado</span>
            <span id="flowDevSelectorConfidence" class="flowdev-selector-confidence">--</span>
          </div>
          <div class="flowdev-selector-meter">
            <span id="flowDevSelectorMeterFill" class="flowdev-selector-meter-fill"></span>
          </div>
          <div id="flowDevSelectorValue" class="flowdev-selector-value">Selecciona un elemento para calcular selector.</div>
          <div id="flowDevSelectorMeta" class="flowdev-selector-meta">Sin datos</div>
        </div>
        <button id="flowDevCopyPromptBtn" class="inspector-action-btn flowdev-copy-prompt-btn" onclick="app.devInspector.copyRecommendedPrompt()">Copiar prompt para IA</button>
        <div class="flowdev-action-console-buttons">
          <button class="inspector-action-btn flowdev-action-btn" data-console-action="tap" onclick="app.devInspector.runConsoleAction('tap')">Tap</button>
          <button class="inspector-action-btn flowdev-action-btn" data-console-action="back" onclick="app.devInspector.runConsoleAction('back')">Back</button>
          <button class="inspector-action-btn flowdev-action-btn" data-console-action="home" onclick="app.devInspector.runConsoleAction('home')">Home</button>
          <button class="inspector-action-btn flowdev-action-btn" data-console-action="refresh-hierarchy" onclick="app.devInspector.runConsoleAction('refresh-hierarchy')">Refresh Hierarchy</button>
        </div>
        <div class="flowdev-keyboard-box">
          <div class="flowdev-keyboard-head">
            <span>FlowKeyboard</span>
            <button class="inspector-action-btn flowdev-action-btn" data-console-action="keyboard-status" onclick="app.devInspector.runConsoleAction('keyboard-status')">Status</button>
          </div>
          <input id="flowDevKeyboardInput" class="flowdev-keyboard-input" type="text" placeholder="Texto para el campo enfocado">
          <div class="flowdev-action-console-buttons flowdev-keyboard-actions">
            <button class="inspector-action-btn flowdev-action-btn" data-console-action="keyboard-type" onclick="app.devInspector.runConsoleAction('keyboard-type')">Type</button>
            <button class="inspector-action-btn flowdev-action-btn" data-console-action="keyboard-clear" onclick="app.devInspector.runConsoleAction('keyboard-clear')">Clear</button>
            <button class="inspector-action-btn flowdev-action-btn" data-console-action="keyboard-backspace" onclick="app.devInspector.runConsoleAction('keyboard-backspace')">Backspace</button>
            <button class="inspector-action-btn flowdev-action-btn" data-console-action="keyboard-enter" onclick="app.devInspector.runConsoleAction('keyboard-enter')">Enter</button>
            <button class="inspector-action-btn flowdev-action-btn" data-console-action="keyboard-next" onclick="app.devInspector.runConsoleAction('keyboard-next')">Next</button>
            <button class="inspector-action-btn flowdev-action-btn" data-console-action="keyboard-done" onclick="app.devInspector.runConsoleAction('keyboard-done')">Done</button>
          </div>
        </div>
        <div id="flowDevActionStatus" class="flowdev-action-status">Listo</div>
        <div class="flowdev-diagnostic-box">
          <div class="flowdev-diagnostic-title">Diagnóstico base</div>
          <div id="flowDevDiagnosticValue" class="flowdev-diagnostic-value">Sin captura de UI.</div>
        </div>
        <div id="flowDevActionLogs" class="flowdev-action-logs"></div>
      `;
      panel.appendChild(consoleEl);
    }

    const dryRunToggle = document.getElementById('flowDevDryRunToggle');
    if (dryRunToggle) dryRunToggle.checked = this.isDryRunEnabled;
    this._renderActionConsoleLogs();
  }

  _setActionConsoleVisible(visible) {
    const el = document.getElementById('flowDevActionConsole');
    if (el) el.style.display = visible ? 'flex' : 'none';
  }

  toggleActionConsoleDryRun(enabled) {
    this.isDryRunEnabled = !!enabled;
    localStorage.setItem('flowdashboard.inspector.dryRun', this.isDryRunEnabled ? '1' : '0');
    this._setActionConsoleStatus(this.isDryRunEnabled ? 'Dry Run activado: acciones simuladas (sin envío real).' : 'Dry Run desactivado: acciones reales habilitadas.', this.isDryRunEnabled ? 'is-dry' : '');
  }

  _setActionConsoleStatus(message, tone = '') {
    const status = document.getElementById('flowDevActionStatus');
    if (!status) return;
    status.className = `flowdev-action-status${tone ? ` ${tone}` : ''}`;
    status.textContent = message;
  }

  _escapeSelectorValue(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  _isLikelyDynamicValue(value) {
    const v = String(value || '').trim().toLowerCase();
    if (!v) return false;
    if (/\d{5,}/.test(v)) return true;
    if (/(timestamp|session|token|nonce|uuid|temp|tmp|random|generated|dynamic)/.test(v)) return true;
    if (/[a-f]/.test(v) && /\d/.test(v) && /[a-f0-9]{8,}/.test(v)) return true;
    return false;
  }

  _selectorTone(confidence) {
    if (confidence >= 0.85) return 'is-high';
    if (confidence >= 0.65) return 'is-medium';
    return 'is-low';
  }

  _estimateNodeFingerprint(node) {
    if (!node) return '';
    const cls = String(node.class || node.tagName || '').split('.').pop();
    const rid = String(node.resourceId || '').trim();
    const text = String(node.text || '').trim();
    const desc = String(node.contentDesc || '').trim();
    return [cls, rid, text, desc].filter(Boolean).join('|').toLowerCase();
  }

  _computeUiTreeDensity() {
    if (!this.currentNodes.length) return 0;
    const withBounds = this.currentNodes.filter(n => n.bounds).length;
    return withBounds / this.currentNodes.length;
  }

  _computeTreeSelectorHealth() {
    if (!this.currentNodes.length) return 0;
    let stable = 0;
    for (const node of this.currentNodes) {
      const rid = String(node.resourceId || '').trim();
      const text = String(node.text || '').trim();
      const desc = String(node.contentDesc || '').trim();
      const hasStable = (rid && !this._isLikelyDynamicValue(rid)) || (text && text.length >= 3 && !this._isLikelyDynamicValue(text)) || (desc && desc.length >= 3 && !this._isLikelyDynamicValue(desc));
      if (hasStable) stable += 1;
    }
    return stable / this.currentNodes.length;
  }

  _formatDetectionTimings(timings) {
    if (!timings || typeof timings !== 'object') return 'n/d';
    const pairs = Object.entries(timings);
    if (!pairs.length) return 'n/d';
    return pairs.map(([method, ms]) => {
      if (typeof ms !== 'number') return `${method}:n/d`;
      if (ms < 0) return `${method}:err`;
      return `${method}:${Math.round(ms)}ms`;
    }).join(', ');
  }

  _formatDetectionMeta(methodUsed, meta) {
    if (!meta || typeof meta !== 'object') return 'sin meta';
    if (methodUsed === 'wm') {
      const size = String(meta.size || '').trim();
      const density = String(meta.density || '').trim();
      const parts = [];
      if (size) parts.push(`size=${size}`);
      if (density) parts.push(`density=${density}`);
      return parts.join(' · ') || 'sin meta';
    }
    if (methodUsed === 'pm_dump') {
      const pkg = String(meta.package || '').trim();
      const dump = String(meta.dump || '');
      const parts = [];
      if (pkg) parts.push(`package=${pkg}`);
      if (dump) parts.push(`dump=${dump.length} chars`);
      return parts.join(' · ') || 'sin meta';
    }
    if (methodUsed === 'logcat') {
      const lines = Array.isArray(meta.lines) ? meta.lines.length : 0;
      return `líneas=${lines}`;
    }
    const keys = Object.keys(meta);
    if (!keys.length) return 'sin meta';
    return keys.slice(0, 4).map(k => {
      const v = meta[k];
      if (Array.isArray(v)) return `${k}[${v.length}]`;
      if (typeof v === 'string') return `${k}=${v.length > 30 ? `${v.slice(0, 30)}…` : v}`;
      if (typeof v === 'number' || typeof v === 'boolean') return `${k}=${v}`;
      if (v && typeof v === 'object') return `${k}{...}`;
      return `${k}=n/d`;
    }).join(' · ');
  }

  _buildAdvancedDiagnosticText() {
    if (!this.lastDetectionInfo) return '';
    const methodUsed = String(this.lastDetectionInfo.methodUsed || this.detectionMode || '').trim();
    const source = String(this.lastDetectionInfo.source || 'capture').trim();
    const cacheText = this.lastDetectionInfo.cached ? 'sí' : 'no';
    const timingsText = this._formatDetectionTimings(this.lastDetectionInfo.timings);
    const metaText = this._formatDetectionMeta(methodUsed, this.lastDetectionInfo.meta);
    const methodLabel = methodUsed || 'n/d';
    return `Método:${methodLabel} · origen:${source} · cache:${cacheText} · timings:${timingsText} · meta:${metaText}`;
  }

  _formatMethodTimingForSelection(methodUsed) {
    const timings = this.lastDetectionInfo.timings;
    if (!timings || typeof timings !== 'object' || !methodUsed) return 'n/d';
    const ms = timings[methodUsed];
    if (typeof ms !== 'number') return 'n/d';
    if (ms < 0) return 'err';
    return `${Math.round(ms)}ms`;
  }

  _buildSelectionDiagnosticText() {
    const selected = this.currentNodes.find(n => n.id === this.selectedNodeId) || null;
    if (!selected) return '';
    const recommended = this._computeRecommendedSelector(selected);
    const confidence = Math.round(recommended.confidence * 100);
    const shortClass = String(selected.class || selected.tagName || 'Node').split('.').pop();
    const coords = (selected.centerX != null && selected.centerY != null) ? `${selected.centerX},${selected.centerY}` : 'n/d';
    const methodUsed = String(this.lastDetectionInfo.methodUsed || this.detectionMode || '').trim() || 'n/d';
    const methodTiming = this._formatMethodTimingForSelection(methodUsed);
    const searchPos = this.searchResults.findIndex(n => n.id === selected.id);
    const searchText = searchPos >= 0 ? `${searchPos + 1}/${this.searchResults.length}` : 'n/d';
    const warnings = [];
    if (selected.resourceId && this._isLikelyDynamicValue(selected.resourceId)) warnings.push('resourceId dinámico');
    if (selected.text && this._isLikelyDynamicValue(selected.text)) warnings.push('text dinámico');
    if (selected.contentDesc && this._isLikelyDynamicValue(selected.contentDesc)) warnings.push('contentDesc dinámico');
    const warningText = warnings.length ? warnings.join(', ') : 'sin alertas';
    return `Selección:${shortClass} · clickable:${selected.clickable ? 'sí' : 'no'} · coords:${coords} · confSelector:${confidence}% · método:${methodUsed}(${methodTiming}) · búsqueda:${searchText} · alertas:${warningText}`;
  }

  _updateBaseDiagnostic() {
    const el = document.getElementById('flowDevDiagnosticValue');
    if (!el) return;
    if (!this.currentNodes.length) {
      const advancedText = this._buildAdvancedDiagnosticText();
      el.textContent = advancedText ? `Sin captura de UI.\n${advancedText}` : 'Sin captura de UI.';
      return;
    }


    const boundsCount = this.currentNodes.filter(n => n.bounds).length;
    const clickableCount = this.currentNodes.filter(n => n.clickable).length;
    const avgDepth = this.currentNodes.reduce((acc, n) => acc + (Number(n.depth) || 0), 0) / this.currentNodes.length;
    const density = Math.round(this._computeUiTreeDensity() * 100);
    const selectorHealth = Math.round(this._computeTreeSelectorHealth() * 100);
    const selected = this.currentNodes.find(n => n.id === this.selectedNodeId) || null;
    const fingerprint = this._estimateNodeFingerprint(selected);
    this._lastSelectedFingerprint = fingerprint || null;

    const baseText = `Nodos:${this.currentNodes.length} · con bounds:${boundsCount} · clickables:${clickableCount} · profundidad:${avgDepth.toFixed(1)} · densidad:${density}% · salud selector:${selectorHealth}%`;
    const advancedText = this._buildAdvancedDiagnosticText();
    const selectionText = this._buildSelectionDiagnosticText();
    const lines = [baseText, advancedText, selectionText].filter(Boolean);
    el.textContent = lines.join('\n');
  }

  _updateRecommendedSelector(node) {
    const valueEl = document.getElementById('flowDevSelectorValue');
    const metaEl = document.getElementById('flowDevSelectorMeta');
    const confidenceEl = document.getElementById('flowDevSelectorConfidence');
    const meterFillEl = document.getElementById('flowDevSelectorMeterFill');
    if (!valueEl || !metaEl || !confidenceEl || !meterFillEl) return;

    if (!node) {
      valueEl.textContent = 'Selecciona un elemento para calcular selector.';
      metaEl.textContent = 'Sin datos';
      confidenceEl.textContent = '--';
      confidenceEl.className = 'flowdev-selector-confidence';
      meterFillEl.className = 'flowdev-selector-meter-fill';
      meterFillEl.style.width = '0%';
      return;
    }

    const recommended = this._computeRecommendedSelector(node);
    const pct = Math.round(recommended.confidence * 100);
    const tone = this._selectorTone(recommended.confidence);

    valueEl.textContent = recommended.selector;
    metaEl.textContent = `${recommended.meta} · muestra ${this.currentNodes.length} nodos`;
    confidenceEl.textContent = `${pct}%`;
    confidenceEl.className = `flowdev-selector-confidence ${tone}`;
    meterFillEl.className = `flowdev-selector-meter-fill ${tone}`;
    meterFillEl.style.width = `${pct}%`;
  }

  _isNodeActionable(node) {
    return !!(node && node.centerX != null && node.centerY != null);
  }

  _canTapSelectedNode() {
    const node = this.currentNodes.find(n => n.id === this.selectedNodeId);
    return this._isNodeActionable(node);
  }

  _setActionConsoleBusy(busy) {
    this.consoleBusy = !!busy;
    const buttons = document.querySelectorAll('#flowDevActionConsole .flowdev-action-btn');
    buttons.forEach(btn => {
      const action = btn.dataset.consoleAction || '';
      const needsNode = action === 'tap';
      const canRun = this.selectedSerial && (!needsNode || this._canTapSelectedNode());
      btn.disabled = this.consoleBusy || !canRun;
    });
  }

  _updateActionConsoleTarget(node) {
    const target = document.getElementById('flowDevActionTarget');
    if (!target) return;
    if (!node) {
      target.textContent = 'Sin elemento seleccionado';
      this._lastSelectedFingerprint = null;
      this._updateRecommendedSelector(null);
      this._updateBaseDiagnostic();
      this._setActionConsoleBusy(false);
      return;
    }
    const shortClass = (node.class || node.tagName || 'Node').split('.').pop();
    const label = (node.text || node.contentDesc || node.resourceId || '').trim();
    const pos = (node.centerX != null && node.centerY != null) ? `@ ${node.centerX},${node.centerY}` : '@ sin coordenadas';
    target.textContent = label ? `${shortClass} · ${label} · ${pos}` : `${shortClass} · ${pos}`;
    this._lastSelectedFingerprint = this._estimateNodeFingerprint(node) || null;
    this._updateRecommendedSelector(node);
    this._updateBaseDiagnostic();
    this._setActionConsoleBusy(false);
  }

  _computeRecommendedSelector(node) {
    const className = String(node.class || node.tagName || '').trim();
    const shortClass = className.split('.').pop() || 'Node';
    const rid = String(node.resourceId || '').trim();
    const text = String(node.text || '').trim();
    const desc = String(node.contentDesc || '').trim();
    const byFingerprint = this.currentNodes.filter(n => this._estimateNodeFingerprint(n) === this._estimateNodeFingerprint(node)).length;
    const candidates = [];

    if (rid) {
      const exact = this.currentNodes.filter(n => String(n.resourceId || '') === rid).length;
      let confidence = exact === 1 ? 0.98 : 0.84 - Math.min(0.24, (exact - 2) * 0.06);
      if (this._isLikelyDynamicValue(rid)) confidence -= 0.12;
      candidates.push({
        selector: `resourceId=\"${this._escapeSelectorValue(rid)}\"`,
        confidence: Math.max(0.1, Math.min(0.99, confidence)),
        meta: exact === 1 ? 'resourceId único' : `resourceId repetido (${exact})`,
      });
    }

    if (text) {
      const exact = this.currentNodes.filter(n => String(n.text || '') === text).length;
      let confidence = exact === 1 ? 0.9 : 0.74 - Math.min(0.26, (exact - 2) * 0.07);
      if (text.length < 3) confidence -= 0.12;
      if (this._isLikelyDynamicValue(text)) confidence -= 0.2;
      candidates.push({
        selector: `text=\"${this._escapeSelectorValue(text)}\"`,
        confidence: Math.max(0.1, Math.min(0.95, confidence)),
        meta: exact === 1 ? 'text único' : `text repetido (${exact})`,
      });
    }

    if (desc) {
      const exact = this.currentNodes.filter(n => String(n.contentDesc || '') === desc).length;
      let confidence = exact === 1 ? 0.88 : 0.72 - Math.min(0.24, (exact - 2) * 0.07);
      if (desc.length < 3) confidence -= 0.12;
      if (this._isLikelyDynamicValue(desc)) confidence -= 0.2;
      candidates.push({
        selector: `contentDesc=\"${this._escapeSelectorValue(desc)}\"`,
        confidence: Math.max(0.1, Math.min(0.94, confidence)),
        meta: exact === 1 ? 'contentDesc único' : `contentDesc repetido (${exact})`,
      });
    }

    const classCount = this.currentNodes.filter(n => {
      const nClass = String(n.class || n.tagName || '').trim().split('.').pop();
      return nClass === shortClass;
    }).length;
    let classConfidence = classCount <= 2 ? 0.62 : 0.48;
    const idx = Number.isFinite(node.index) ? Number(node.index) : null;
    let classSelector = `class=\"${this._escapeSelectorValue(className || shortClass)}\"`;
    if (idx != null) {
      classSelector += ` index=${idx}`;
      classConfidence += 0.06;
    }
    candidates.push({
      selector: classSelector,
      confidence: Math.max(0.1, Math.min(0.75, classConfidence)),
      meta: classCount <= 2 ? 'class poco repetida' : `class repetida (${classCount})`,
    });

    candidates.sort((a, b) => b.confidence - a.confidence);
    const best = candidates[0] || { selector: `class=\"${this._escapeSelectorValue(shortClass)}\"`, confidence: 0.35, meta: 'fallback por clase' };
    if (byFingerprint > 1) {
      best.confidence = Math.max(0.12, best.confidence - 0.08);
      best.meta = `${best.meta} · fingerprint repetido (${byFingerprint})`;
    }
    return best;
  }

  _buildPromptForCurrentSelection() {
    const node = this.currentNodes.find(n => n.id === this.selectedNodeId);
    if (!node) return '';
    const recommended = this._computeRecommendedSelector(node);
    const shortClass = String(node.class || node.tagName || 'Node').split('.').pop();
    const descriptor = String(node.text || node.contentDesc || node.resourceId || '').trim() || '(sin texto)';
    const pos = (node.centerX != null && node.centerY != null) ? `${node.centerX},${node.centerY}` : 'sin coordenadas';
    const density = Math.round(this._computeUiTreeDensity() * 100);
    const selectorHealth = Math.round(this._computeTreeSelectorHealth() * 100);
    const lines = [
      `Dispositivo: ${this.selectedSerial || 'N/A'}`,
      `Método detección: ${this.detectionMode}`,
      `Nodo objetivo: ${shortClass} | ${descriptor} | ${pos}`,
      `Selector recomendado: ${recommended.selector}`,
      `Confianza selector: ${Math.round(recommended.confidence * 100)}% (${recommended.meta})`,
      `Diagnóstico base: nodos=${this.currentNodes.length}, densidad=${density}%, saludSelector=${selectorHealth}%`,
      'Devuélveme una estrategia robusta con selector primario y fallback, lista para ejecutar con los canales existentes del inspector.',
    ];
    return lines.join('\n');
  }

  async copyRecommendedPrompt() {
    const node = this.currentNodes.find(n => n.id === this.selectedNodeId);
    if (!node) {
      this.showToast('Selecciona un elemento antes de copiar el prompt.', '#ff4466', 2400);
      return;
    }
    const prompt = this._buildPromptForCurrentSelection();
    if (!prompt) {
      this.showToast('No se pudo construir el prompt para IA.', '#ff4466', 2400);
      return;
    }
    try {
      await navigator.clipboard.writeText(prompt);
      this._setActionConsoleStatus('Prompt para IA copiado al portapapeles.', 'is-ok');
      this._appendActionConsoleLog({ action: 'Copiar prompt para IA', status: 'ok', detail: 'Prompt copiado', command: prompt });
      this.showToast('Prompt para IA copiado', '#00F5D4', 1800);
    } catch (err) {
      const msg = err.message || 'No se pudo copiar el prompt para IA';
      this._setActionConsoleStatus(msg, 'is-error');
      this.showToast(msg, '#ff4466', 2600);
    }
  }

  _appendActionConsoleLog(entry) {
    const item = {
      ts: new Date().toLocaleTimeString(),
      action: entry.action || '-',
      status: entry.status || 'info',
      detail: entry.detail || '',
      command: entry.command || '',
    };
    this.consoleLogs.unshift(item);
    if (this.consoleLogs.length > 20) this.consoleLogs.length = 20;
    this._renderActionConsoleLogs();
  }

  _renderActionConsoleLogs() {
    const logs = document.getElementById('flowDevActionLogs');
    if (!logs) return;
    if (!this.consoleLogs.length) {
      logs.innerHTML = '<div class="flowdev-action-log-empty">Sin acciones todavía.</div>';
      return;
    }
    logs.innerHTML = this.consoleLogs.map(l => `
      <div class="flowdev-action-log-item is-${this._esc(l.status)}">
        <div class="flowdev-action-log-row">
          <span class="flowdev-action-log-name">${this._esc(l.action)}</span>
          <span class="flowdev-action-log-time">${this._esc(l.ts)}</span>
        </div>
        ${l.detail ? `<div class="flowdev-action-log-detail">${this._esc(l.detail)}</div>` : ''}
        ${l.command ? `<div class="flowdev-action-log-cmd">${this._esc(l.command)}</div>` : ''}
      </div>
    `).join('');
  }

  _normalizeConsoleAction(actionType) {
    const raw = String(actionType || '').trim().toLowerCase();
    if (raw === 'refresh' || raw === 'refreshhierarchy') return 'refresh-hierarchy';
    if (raw === 'type') return 'keyboard-type';
    if (raw === 'clear') return 'keyboard-clear';
    return raw;
  }

  async runConsoleAction(actionType) {
    if (!this._isFlowDevEnabled()) return;
    if (!this.selectedSerial) {
      this._showError('Selecciona un dispositivo primero.');
      return;
    }

    const normalized = this._normalizeConsoleAction(actionType);
    this._setActionConsoleBusy(true);

    try {
      const prepared = await this._prepareConsoleAction(normalized);

      if (this.isDryRunEnabled) {
        this._setActionConsoleStatus(`Dry Run: ${prepared.label} (${prepared.channel})`, 'is-dry');
        this._appendActionConsoleLog({
          action: `${prepared.label} (Dry Run)`,
          status: 'dry',
          detail: `Canal previsto: ${prepared.channel}`,
          command: prepared.commandPreview,
        });
        this.showToast(`Dry Run: ${prepared.label}`, '#f59e0b', 1800);
        return;
      }

      await this._executeConsoleAction(prepared);

      this._setActionConsoleStatus(`${prepared.label} ejecutado (${prepared.channel})`, 'is-ok');
      this._appendActionConsoleLog({
        action: prepared.label,
        status: 'ok',
        detail: `Canal: ${prepared.channel}`,
        command: prepared.commandPreview,
      });
      this.showToast(`${prepared.label} ejecutado`, '#00F5D4', 1500);

      if (normalized === 'tap') {
        const selected = this.currentNodes.find(n => n.id === this.selectedNodeId);
        if (selected && selected.bounds) this.drawHighlight(selected, false);
      }
    } catch (err) {
      const msg = err.message || 'Error ejecutando acción';
      this._setActionConsoleStatus(msg, 'is-error');
      this._appendActionConsoleLog({ action: normalized, status: 'error', detail: msg });
      this.showToast(msg, '#ff4466', 3000);
    } finally {
      this._setActionConsoleBusy(false);
    }
  }

  async _prepareConsoleAction(actionType) {
    const serial = this.selectedSerial;
    switch (actionType) {
      case 'tap': {
        const node = this.currentNodes.find(n => n.id === this.selectedNodeId);
        if (!node) throw new Error('Selecciona un elemento para Tap.');
        if (node.centerX == null || node.centerY == null) throw new Error('El elemento no tiene bounds/coordenadas.');
        return {
          actionType,
          label: 'Tap',
          channel: 'inspector',
          endpoint: '/inspector/tap',
          body: { serial, x: node.centerX, y: node.centerY },
          commandPreview: `adb -s ${serial} shell input tap ${node.centerX} ${node.centerY}`,
        };
      }
      case 'back':
      case 'home': {
        const agent = await this._getAgentForSerial(serial);
        if (agent.agentId) {
          return {
            actionType,
            label: actionType === 'back' ? 'Back' : 'Home',
            channel: 'flowagent',
            endpoint: '/agent/command',
            body: { agentId: agent.agentId, command: { name: actionType } },
            commandPreview: `POST /agent/command {"agentId":"${agent.agentId}","command":{"name":"${actionType}"}}`,
          };
        }
        const key = actionType === 'back' ? 'KEYCODE_BACK' : 'KEYCODE_HOME';
        return {
          actionType,
          label: actionType === 'back' ? 'Back' : 'Home',
          channel: 'adb',
          endpoint: '/adb',
          body: { command: `adb shell input keyevent ${key}`, deviceIds: [serial] },
          commandPreview: `adb -s ${serial} shell input keyevent ${key}`,
        };
      }
      case 'refresh-hierarchy':
        return {
          actionType,
          label: 'Refresh Hierarchy',
          channel: 'inspector',
          endpoint: null,
          body: null,
          commandPreview: 'captureUI()',
        };
      case 'keyboard-status':
        return {
          actionType,
          label: 'FlowKeyboard Status',
          channel: 'flowkeyboard',
          endpoint: '/flowkeyboard/status',
          body: { serial },
          commandPreview: `flow.keyboard.status({ serial: "${serial}" })`,
        };
      case 'keyboard-type': {
        const input = document.getElementById('flowDevKeyboardInput');
        const text = input ? input.value : '';
        if (!text) throw new Error('Escribe texto para FlowKeyboard.');
        return {
          actionType,
          label: 'FlowKeyboard Type',
          channel: 'flowkeyboard',
          endpoint: '/flowkeyboard/type',
          body: { serial, text, delayMs: 35 },
          commandPreview: `flow.keyboard.type("[${text.length} chars]", { serial: "${serial}", delayMs: 35 })`,
        };
      }
      case 'keyboard-clear':
      case 'keyboard-backspace':
      case 'keyboard-enter':
      case 'keyboard-next':
      case 'keyboard-done': {
        const action = actionType.replace('keyboard-', '');
        const labels = {
          clear: 'FlowKeyboard Clear',
          backspace: 'FlowKeyboard Backspace',
          enter: 'FlowKeyboard Enter',
          next: 'FlowKeyboard Next',
          done: 'FlowKeyboard Done',
        };
        const body = { serial, action };
        if (action === 'backspace') body.count = 1;
        return {
          actionType,
          label: labels[action] || `FlowKeyboard ${action}`,
          channel: 'flowkeyboard',
          endpoint: '/flowkeyboard/command',
          body,
          commandPreview: action === 'backspace'
            ? `flow.keyboard.backspace(1, { serial: "${serial}" })`
            : `flow.keyboard.${action}({ serial: "${serial}" })`,
        };
      }
      default:
        throw new Error(`Acción no soportada: ${actionType}`);
    }
  }

  async _executeConsoleAction(prepared) {
    if (prepared.actionType === 'refresh-hierarchy') {
      await this.captureUI();
      return;
    }

    const res = await fetch(`${INSPECTOR_API}${prepared.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prepared.body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    if (prepared.endpoint === '/agent/command') {
      const result = data.response.result ?? data.response ?? {};
      if (result && result.ok === false) throw new Error(result.error || 'FlowAgent devolvió error');
      return;
    }

    if (prepared.endpoint.startsWith('/inspector/')) {
      if (data && data.ok === false) throw new Error(data.error || 'Acción inspector falló');
      return;
    }

    if (prepared.endpoint.startsWith('/flowkeyboard/')) {
      if (data && data.ok === false) throw new Error(data.error || 'FlowKeyboard devolvio error');
      return;
    }

    if (data && data.error) throw new Error(data.error);
  }

  async _getAgentForSerial(serial) {
    try {
      const res = await fetch(`${INSPECTOR_API}/agents`);
      if (!res.ok) return null;
      const data = await res.json();
      const agents = Array.isArray(data.agents) ? data.agents : [];
      return agents.find(a => {
        const aSerial = String(a.serial || a.meta.serial || '').trim();
        return aSerial === String(serial || '').trim();
      }) || null;
    } catch (_) {
      return null;
    }
  }

  saveState() {
    try {
      localStorage.setItem(this._storageKeys.devMode, this.app.isFlowDevEnabled ? '1' : '0');
      const mode = String(this.detectionMode || '').trim();
      if (mode) localStorage.setItem(this._storageKeys.detectionMode, mode);

      const serial = String(this.selectedSerial || '').trim();
      if (serial) {
        localStorage.setItem(this._storageKeys.selectedSerial, serial);
        localStorage.setItem(this._storageKeys.legacySerial, serial);
      } else {
        localStorage.removeItem(this._storageKeys.selectedSerial);
        localStorage.removeItem(this._storageKeys.legacySerial);
      }

      if (this.lastAutoDetectTimings && typeof this.lastAutoDetectTimings === 'object') {
        localStorage.setItem(this._storageKeys.autoDetectTimings, JSON.stringify(this.lastAutoDetectTimings));
      } else {
        localStorage.removeItem(this._storageKeys.autoDetectTimings);
      }

      const expansionEntries = Array.from(this.expansionState.entries()).map(([nodeId, expanded]) => [String(nodeId), !!expanded]);
      localStorage.setItem(this._storageKeys.expansionState, JSON.stringify(expansionEntries));
    } catch (_) {}
  }

  restoreState() {
    try {
      const savedMode = localStorage.getItem(this._storageKeys.detectionMode);
      if (savedMode) this.detectionMode = savedMode;

      const storedTimings = localStorage.getItem(this._storageKeys.autoDetectTimings);
      if (storedTimings) {
        const parsedTimings = JSON.parse(storedTimings);
        if (parsedTimings && typeof parsedTimings === 'object' && !Array.isArray(parsedTimings)) {
          this.lastAutoDetectTimings = parsedTimings;
        }
      }

      const savedSerial = localStorage.getItem(this._storageKeys.selectedSerial) || localStorage.getItem(this._storageKeys.legacySerial);
      this.selectedSerial = savedSerial ? String(savedSerial) : null;

      const rawExpansion = localStorage.getItem(this._storageKeys.expansionState);
      if (rawExpansion) {
        const parsed = JSON.parse(rawExpansion);
        if (Array.isArray(parsed)) {
          this.expansionState = new Map(parsed.filter(item => Array.isArray(item) && item.length === 2).map(([nodeId, expanded]) => [String(nodeId), !!expanded]));
        } else if (parsed && typeof parsed === 'object') {
          this.expansionState = new Map(Object.entries(parsed).map(([nodeId, expanded]) => [String(nodeId), !!expanded]));
        }
      }
    } catch (_) {
      this.expansionState = new Map();
    }

    const isWebMethod = (DETECTION_METHODS.web || []).some(m => m.key === this.detectionMode);
    this.detectionGroup = isWebMethod ? 'web' : 'native';
    this.saveState();
  }

  // ─── Utilidades ───────────────────────────────────────────────────────────

  showToast(msg, color, duration) {
    const text = String(msg ?? '').trim() || 'Error';
    const tone = String(color || '#a0a0a0').trim() || '#a0a0a0';
    const wait = Number.isFinite(Number(duration)) ? Math.max(600, Number(duration)) : 2500;
    const isErrorTone = tone.toLowerCase() === '#ff4444' || tone.toLowerCase() === '#ff4466';
    try {
      if (!document || !document.body) throw new Error('dom-unavailable');
      const existing = document.getElementById('inspectorToast');
      if (existing) existing.remove();
      const toast = document.createElement('div');
      toast.id = 'inspectorToast';
      toast.className = 'inspector-toast';
      toast.style.background = tone;
      toast.style.color = '#ffffff';
      toast.textContent = text;
      document.body.appendChild(toast);
      setTimeout(() => {
        if (toast && toast.parentNode) toast.remove();
      }, wait);
    } catch (_) {
      if (!isErrorTone) return;
      try {
        const table = document.getElementById('inspectorPropsTable');
        if (!table) return;
        table.style.display = 'block';
        table.innerHTML = `<div style="color:#FF4444;font-family:'Courier New', monospace;">${this._esc(text)}</div>`;
      } catch (_) {}
    }
  }

  _showError(msg) {
    this.showToast(msg, '#FF4444', 3000);
  }

  _esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
}
