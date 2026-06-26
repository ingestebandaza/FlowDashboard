// @Added by FlowDashboard Etapa B on 2026-05-27.
//   Configuracion de las ventanas flotantes para cada bloque del sidebar de
//   Focus Mode. El cuerpo HTML reutiliza los mismos IDs que tenia el contenido
//   inline original, para que los handlers _bind*Events sigan funcionando.
//   La idea: UI uniforme, sin secciones que se desplieguen, todo en ventanas
//   flotantes draggables y redimensionables como la de Aplicaciones.
const FLOW_ADB_COMMAND_PRESETS = [
  { label: 'Ver resolucion', command: 'shell wm size' },
  { label: 'Ver DPI', command: 'shell wm density' },
  { label: 'Eco 720p', command: 'shell wm size 720x1280' },
  { label: 'HD+ 900p', command: 'shell wm size 900x1600' },
  { label: 'Full 1080p', command: 'shell wm size 1080x1920' },
  { label: 'Reset resolucion', command: 'shell wm size reset' },
  { label: 'DPI 320', command: 'shell wm density 320' },
  { label: 'DPI 420', command: 'shell wm density 420' },
  { label: 'Reset DPI', command: 'shell wm density reset' },
  { label: 'Wake', command: 'shell input keyevent WAKEUP' },
  { label: 'Home', command: 'shell input keyevent HOME' },
];

if (typeof window !== 'undefined') {
  window.FLOW_ADB_COMMAND_PRESETS = FLOW_ADB_COMMAND_PRESETS;
}

function flowAdbPresetButtonsHtml(attrName) {
  return FLOW_ADB_COMMAND_PRESETS.map(item => (
    `<button class="adb-preset-btn" type="button" ${attrName}="${item.command}" title="${item.command}">${item.label}</button>`
  )).join('');
}

const FLOW_TOUCH_SECTION_WINDOWS = {
  archivos: {
    title: 'Archivos',
    defaultSize: { width: 360, height: 240 },
    body: `
      <div class="fp-section-stack fp-archivos">
        <input id="fpFilePath" class="fp-input" type="text" value="/sdcard/Download/" placeholder="Ruta destino"/>
        <label class="fp-btn fp-file-label">
          Elegir archivo
          <input id="fpFileInput" type="file" hidden/>
        </label>
        <div id="fpFileResult" class="fp-result">Hasta 500 MB. Drop sobre esta ventana tambien funciona.</div>
      </div>`,
    onOpen() { this._bindProPanelArchivos(); },
  },
  adb: {
    title: 'ADB Shell',
    defaultSize: { width: 460, height: 320 },
    body: `
      <div class="fp-section-stack">
        <div class="adb-preset-strip" aria-label="Comandos ADB preestablecidos">
          ${flowAdbPresetButtonsHtml('data-fp-adb-preset')}
        </div>
        <input id="fpAdbCmd" class="fp-input" type="text" placeholder="adb shell ..."/>
        <button class="fp-btn" id="fpAdbRunBtn">Ejecutar</button>
        <pre id="fpAdbOut" class="fp-pre">$ esperando comando</pre>
      </div>`,
    onOpen() { this._bindProPanelAdb(); },
  },
  autojs: {
    title: 'Auto.js',
    defaultSize: { width: 320, height: 190 },
    body: `
      <div class="fp-section-stack">
        <label class="fp-btn fp-file-label">
          Elegir .js
          <input id="fpAutoJsInput" type="file" accept=".js" hidden/>
        </label>
        <div class="fp-row">
          <button class="fp-btn fp-btn-mini" id="fpAutoJsStopBtn">Detener</button>
          <button class="fp-btn fp-btn-mini" id="fpAutoJsInstallBtn" title="Verificar, instalar y conectar FlowAgent">Instalar FlowAgent</button>
        </div>
        <div id="fpAutoJsResult" class="fp-result">Selecciona un .js para subir y ejecutar.</div>
      </div>`,
    onOpen() { this._bindProPanelAutojs(); },
  },
  sistema: {
    title: 'Sistema',
    defaultSize: { width: 320, height: 220 },
    body: `
      <div class="fp-section-stack">
        <button class="fp-btn" id="fpSysSettingsMain">Abrir Configuraciones</button>
        <div class="fp-row">
          <button class="fp-btn fp-btn-mini" data-fp-shortcut="wifi">Wi-Fi</button>
          <button class="fp-btn fp-btn-mini" data-fp-shortcut="apps">Apps</button>
        </div>
        <div class="fp-row">
          <button class="fp-btn fp-btn-mini" data-fp-shortcut="idioma">Idioma</button>
          <button class="fp-btn fp-btn-mini" data-fp-shortcut="accesibilidad">Accesibilidad</button>
        </div>
      </div>`,
    onOpen() { this._bindProPanelSistema(); },
  },
  energia: {
    title: 'Energia',
    defaultSize: { width: 320, height: 200 },
    body: `
      <div class="fp-section-stack">
        <button class="fp-btn fp-btn-danger" id="fpPowerRebootBtn">Reiniciar dispositivo</button>
        <button class="fp-btn fp-btn-danger" id="fpPowerShutdownBtn">Apagar dispositivo</button>
        <small class="fp-hint">Doble click sobre el boton para confirmar.</small>
      </div>`,
    onOpen() { this._bindProPanelEnergia(); },
  },
  flowkeyboard: {
    title: 'FlowKeyboard',
    defaultSize: { width: 360, height: 320 },
    body: `
      <div class="fp-section-stack" id="flowTouchKeyboardBlock">
        <div class="flowtouch-keyboard-status-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:0.75rem; color:#aaa;">
          <span>Estado IME:</span>
          <span class="flowtouch-status-pill is-warn" id="flowTouchKeyboardState">Revisando</span>
        </div>
        <textarea id="flowTouchKeyboardInput" class="flowtouch-keyboard-input" rows="3" placeholder="Texto manual (se enviara letra por letra anti-deteccion)"></textarea>
        <div class="flowtouch-keyboard-row">
          <button class="flowtouch-control-btn" id="flowTouchKeyboardSendBtn" title="Enviar texto al telefono enfocado">Enviar</button>
          <button class="flowtouch-control-btn" id="flowTouchKeyboardClearBtn" title="Limpiar campo enfocado en Android">Clear</button>
          <button class="flowtouch-control-btn" id="flowTouchKeyboardBackspaceBtn" title="Borrar 1 caracter">Bksp</button>
        </div>
        <div class="flowtouch-keyboard-row">
          <button class="flowtouch-control-btn" id="flowTouchKeyboardEnterBtn" title="Enter">Enter</button>
          <button class="flowtouch-control-btn" id="flowTouchKeyboardNextBtn" title="Next">Next</button>
          <button class="flowtouch-control-btn" id="flowTouchKeyboardDoneBtn" title="Done">Done</button>
        </div>
        <button class="flowtouch-control-btn flowtouch-keyboard-prepare" id="flowTouchKeyboardPrepareBtn" hidden>
          Preparar FlowKeyboard
        </button>
      </div>`,
    onOpen() {
      // Re-bind los eventos del FlowKeyboard que apuntan a los IDs recien creados,
      // y refresca el estado del IME para habilitar/deshabilitar inputs.
      this._bindFlowKeyboardEvents();
      this._refreshFlowKeyboardStatus(this.activeSerial).catch(() => null);
    },
  },
  inspector: {
    title: 'FlowDev Inspector',
    defaultSize: { width: 520, height: 580 },
    body: `
      <div class="fp-section-stack fp-inspector-stack">
        <div class="fp-inspector-modes">
          <button class="fp-inspector-mode-btn is-active" data-fp-inspector-mode="tree" title="Accessibility / UIAutomator dump">Tree</button>
          <button class="fp-inspector-mode-btn" data-fp-inspector-mode="native" title="Deteccion nativa Android">Nativo</button>
          <button class="fp-inspector-mode-btn" data-fp-inspector-mode="web" title="WebView / CDP si esta disponible">Web</button>
          <button class="fp-inspector-mode-btn" data-fp-inspector-mode="auto" title="Prueba automatica de metodos disponibles">Auto</button>
          <button class="fp-inspector-mode-btn" data-fp-inspector-mode="ocr" title="MLKit OCR sobre el frame actual">OCR</button>
          <button class="fp-inspector-mode-btn" data-fp-inspector-mode="hybrid" title="Tree + OCR combinados">Hybrid</button>
          <button class="fp-inspector-mode-btn fp-inspector-refresh" data-fp-inspector-action="refresh" title="Capturar UI">Capturar UI</button>
        </div>
        <div class="fp-inspector-search">
          <input class="fp-input" id="fpInspSearch" type="text" placeholder="Buscar texto / resourceId / clase..."/>
        </div>
        <div class="fp-inspector-results" id="fpInspResults">Pulsa "Capturar UI" para escanear elementos.</div>
        <div class="fp-inspector-detail" id="fpInspDetail" hidden></div>
      </div>`,
    onOpen() {
      this._bindFpInspectorEvents();
    },
  },
};

const LIVE_TOUCH_MODE = true;
const FLOWTOUCH_GESTURE_VISUALS = false;

class CoordinateMapper {
  static fromPointerEvent(event, canvas, frameSize = null) {
    if (!event || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || !canvas.width || !canvas.height) {
      return null;
    }

    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;

    // Coordenadas dentro del canvas visual (sirven para dibujar marker local)
    const canvasX = CoordinateMapper._clamp(Math.round(relativeX * canvas.width / rect.width), 0, canvas.width - 1);
    const canvasY = CoordinateMapper._clamp(Math.round(relativeY * canvas.height / rect.height), 0, canvas.height - 1);

    // Coordenadas reales del display Android para enviar a FlowAgent.
    // Si conocemos el tamaño del frame real (e.g. 1080x1920), proyectamos.
    // Si no, asumimos canvas == display (no es lo deseable, pero evita romper el flujo legado).
    const frameWidthRaw = frameSize ? Number(frameSize.width) : NaN;
    const frameHeightRaw = frameSize ? Number(frameSize.height) : NaN;
    const hasValidFrameSize = Number.isFinite(frameWidthRaw) && Number.isFinite(frameHeightRaw)
      && frameWidthRaw > 0 && frameHeightRaw > 0;
    const targetWidth  = hasValidFrameSize ? frameWidthRaw  : canvas.width;
    const targetHeight = hasValidFrameSize ? frameHeightRaw : canvas.height;
    const x = CoordinateMapper._clamp(Math.round(relativeX * targetWidth / rect.width), 0, targetWidth - 1);
    const y = CoordinateMapper._clamp(Math.round(relativeY * targetHeight / rect.height), 0, targetHeight - 1);

    return {
      x,
      y,
      canvasX,
      canvasY,
      relativeX,
      relativeY,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      rectWidth: rect.width,
      rectHeight: rect.height,
      frameWidth: targetWidth,
      frameHeight: targetHeight,
    };
  }

  static _clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}

class FlowTouchCommandRouter {
  constructor(apiBase = null) {
    this.apiBase = apiBase;
  }

  getApiBase() {
    return this.apiBase || (typeof PYTHON_API !== 'undefined' ? PYTHON_API : 'http://localhost:8765');
  }

  async resolveAgent(serial) {
    const response = await fetch(`${this.getApiBase()}/agents`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`No se pudo consultar FlowAgent (${response.status})`);
    }
    const data = await response.json();
    const agents = Array.isArray(data.agents) ? data.agents : [];
    const agent = agents.find(item => item.serial === serial || item.agentId === serial);
    if (!agent) {
      throw new Error('FlowAgent no conectado para este dispositivo.');
    }
    if (!agent.accessibility) {
      try {
        const probe = await this.sendCommand(agent.agentId, { name: 'engine_probe' }, 10);
        const result = probe.result || probe;
        if (result && result.ok && result.serviceReady !== false) {
          agent.accessibility = true;
          return agent;
        }
      } catch (_) {
        // Si el probe tampoco responde, se conserva el error claro abajo.
      }
      throw new Error('FlowAgent conectado, pero accesibilidad no esta activa.');
    }
    return agent;
  }

  async sendCommand(agentId, command, timeout = 8) {
    const response = await fetch(`${this.getApiBase()}/agent/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, command, timeout }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Comando rechazado (${response.status})`);
    }
    return data.response || data;
  }

  async tap(serial, x, y) {
    const response = await this.controlRequest('/control/tap', { serial, x, y });
    return { response };
  }

  async touch(serial, action, x, y) {
    const response = await this.controlRequest('/control/touch', { serial, action, x, y });
    return { response };
  }

  async swipe(serial, startX, startY, endX, endY, durationMs = 350) {
    const safeDuration = Math.max(120, Math.min(Number(durationMs) || 350, 1800));
    const response = await this.controlRequest('/control/swipe', {
      serial,
      startX,
      startY,
      endX,
      endY,
      duration: safeDuration,
    });
    return { response };
  }

  /**
   * Long press: se construye sobre `swipe` (FlowAccessibilityService.swipe acepta
   * mismo origen y destino con duracion mayor). Asi no requiere comandos nuevos
   * en el APK ni cambios en backend.
   */
  async longPress(serial, x, y, durationMs = 700) {
    return this.swipe(serial, x, y, x, y, durationMs);
  }

  /**
   * Doble tap real: dos `tap` con el mismo punto separados ~120ms.
   * El APK responde por separado a cada tap; el debounce del controlador
   * decide si se acepta el segundo tap.
   */
  async doubleTap(serial, x, y) {
    const first = await this.controlRequest('/control/tap', { serial, x, y });
    await new Promise(resolve => setTimeout(resolve, 120));
    const second = await this.controlRequest('/control/tap', { serial, x, y });
    return { response: { first, second } };
  }

  async back(serial) {
    const response = await this.controlRequest('/control/keyevent', { serial, name: 'back' });
    return { response };
  }

  async home(serial) {
    const response = await this.controlRequest('/control/keyevent', { serial, name: 'home' });
    return { response };
  }

  async recents(serial) {
    const response = await this.controlRequest('/control/keyevent', { serial, name: 'recents' });
    return { response };
  }

  async keyevent(serial, name) {
    const response = await this.controlRequest('/control/keyevent', { serial, name });
    return { response };
  }

  async typeText(serial, text) {
    const response = await this.controlRequest('/control/type-text', { serial, text });
    return { response };
  }

  async pasteText(serial, text) {
    const response = await this.controlRequest('/control/paste-text', { serial, text, paste: true });
    return { response };
  }

  async controlRequest(path, payload) {
    const response = await fetch(`${this.getApiBase()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `Control rechazado (${response.status})`);
    }
    return data;
  }
}

class FlowTouchController {
  constructor(app) {
    this.app = app;
    this.commandRouter = new FlowTouchCommandRouter();
    this.activeSerial = null;
    this.overlay = null;
    this.focusCanvas = null;
    this.keyHandler = null;
    this.agentStatusTimer = null;
    this.frameStatusTimer = null;
    this.pointerMoveHandler = null;
    this.pointerLeaveHandler = null;
    this.pointerClickHandler = null;
    this.controlEnabled = false;
    this.commandInFlight = false;
    this.lastCommandAt = 0;
    // Estado de gesto activo (Fase 5: swipe). null cuando no hay drag en curso.
    this.activeGesture = null;
    this.pointerDownHandler = null;
    this.pointerUpHandler = null;
    this.pointerCancelHandler = null;
    this.gestureTrailEl = null;

    this.liveTouchActive = false;
    this.liveTouchFallback = false;
    this.liveTouchPendingDown = false;
    this.liveTouchLastMove = 0;

    // Umbrales: si el desplazamiento entre down y up es menor a este valor en
    // pixeles del canvas visual, se trata como tap; si es mayor, como swipe.
    this.gestureTapThresholdPx = 6;
    // Fase 6: doble tap, long press, wheel como scroll.
    this.lastTapInfo = null; // { x, y, t }
    this.doubleTapWindowMs = 280;
    this.doubleTapThresholdPx = 22; // distancia maxima entre los dos taps
    this.longPressDelayMs = 520;    // tiempo sin mover para long press
    this.longPressDurationMs = 700; // duracion del press en Android
    this.shiftSlowDurationMs = 900; // Shift+drag => swipe lento mas humano
    this.activeLongPressTimer = null;
    this.wheelHandler = null;
    this.wheelAccumDeltaY = 0;
    this.wheelLastSentAt = 0;
    this.wheelEmitMinIntervalMs = 240; // anti-spam: no mas de un swipe ~cada 240ms
    this.wheelStepFactor = 1.4;        // amplifica el delta del wheel
    // Fase 8: integracion con FlowKeyboard. Estado del IME para el serial activo,
    // refrescado bajo demanda. Nada se activa automaticamente.
    this.flowKeyboardStatus = null;     // { installed, available, enabled, selected, ... }
    this.flowKeyboardBusy = false;
    this.recordingState = {};
    this.recordingBusy = false;
    // Focus PRO Panel - Fase 1: debounce de auto-arm para ignorar el primer
    // click apenas se abre Focus Mode y se enciende el control automaticamente.
    this.armDebounceUntil = 0;
    // Focus PRO Panel - Fase posterior: counters para auto-disarm tolerante.
    // Solo desarma cuando hay strikes consecutivos confirmando el problema,
    // evitando parpadeos por una sola lectura mala.
    this.disarmStrikes = { agent: 0, frame: 0 };
    this.disarmAgentThreshold = 3;  // 3 ciclos seguidos sin agente -> desarma
    this.disarmFrameThreshold = 4;  // 4 ciclos seguidos sin frame    -> desarma
    this._fpInspectorBusy = false;
    this._lastAgentProbeOkAt = 0;
    this._focusWindowCleanup = null;
    this._focusResizeObserver = null;
    this._focusWindowDragging = false;
    this._focusWindowResizing = false;
    this.runtimeStatusTimer = null;
    this._runtimeStopSuppressedUntil = new Map();
    this._runtimeStateChangeHandler = () => this._syncRuntimeStateNow();
    window.addEventListener('flowdashboard:runtime-state-changed', this._runtimeStateChangeHandler);
    this.focusKeyboardTargetActive = false;
    this.replicateSelected = localStorage.getItem('flowdashboard.focus.replicateSelected') === 'true';
  }

  isFocusOpen() {
    return !!this.overlay;
  }

  getActiveSerial() {
    return this.activeSerial;
  }

  enableControl(serial = this.activeSerial) {
    this.controlEnabled = !!serial && this.activeSerial === serial && this.isFocusOpen();
    if (this.controlEnabled) {
      // Reset strikes al armar para que un parpadeo previo no afecte
      this.disarmStrikes.agent = 0;
      this.disarmStrikes.frame = 0;
    }
    this._syncControlUi();
    return this.controlEnabled;
  }

  disableControl() {
    this.controlEnabled = false;
    this._syncControlUi();
  }

  /**
   * Fase 9 (resiliencia): desarma el control automaticamente y muestra el
   * motivo en el log + en el pill de modo. No tira excepciones; solo deja
   * el Focus Mode en Off seguro.
   */
  _autoDisarm(reason) {
    if (!this.controlEnabled) return;
    this.disableControl();
    this._setModeState('Control off seguro', 'is-warn');
    this._appendLog(reason || 'Control desactivado por seguridad');
  }

  /**
   * Detecta si un mensaje de error indica que el FlowAgent quedo inestable
   * (no conectado, sin accesibilidad, sin respuesta) para auto-desarmar.
   */
  _shouldAutoDisarmFromError(error) {
    const msg = String(error.message || error || '').toLowerCase();
    return [
      'no conectado',
      'no esta',
      'accesibilidad',
      'no respondio',
      'timeout',
      'sin respuesta',
      '404',
    ].some(needle => msg.includes(needle));
  }

  async openFocus(serial) {
    const targetSerial = String(serial || '').trim();
    if (!targetSerial) return;

    // Cancelar el escalonado de reconexion del grid si esta en curso.
    // Asi el WS del focus entra al servidor sin competencia con los 17 del grid.
    // Los dispositivos del grid que aun no habian reconectado lo haran despues
    // con su propio backoff normal (no se pierden, solo se retrasan un poco).
    if (this.app._gridQualityTimers && this.app._gridQualityTimers.length) {
      this.app._gridQualityTimers.forEach(t => clearTimeout(t));
      this.app._gridQualityTimers = [];
    }

    if (this.overlay) {
      this.closeFocus();
    }
    const device = this._findDevice(targetSerial);
    const title = this._deviceName(device, targetSerial);
    const shortSerial = this.app?.shortSerial ? this.app.shortSerial(targetSerial) : targetSerial;
    const safeSerial = this._safeId(targetSerial);
    const meta = this.app?.deviceMeta?.[targetSerial] || {};
    const publicIp = meta.publicIp || device?.publicIp || '';
    const countryCode = (meta.countryCode || device?.countryCode || '').toUpperCase();
    const countryName = meta.countryName || device?.countryName || '';
    const flagHtml = this.app?.renderCountryFlag
      ? this.app.renderCountryFlag(countryCode, countryName)
      : '<span class="device-flag is-empty">--</span>';
    const deviceNumber = this.app?.getDeviceNumber
      ? this.app.getDeviceNumber(device || { serial: targetSerial })
      : '';

    const stableId = this.app?.getDeviceStableId ? this.app.getDeviceStableId(targetSerial) : targetSerial;
    const accountRecord = this.app?.deviceAccounts?.[stableId] || this.app?.deviceAccounts?.[targetSerial] || {};
    const accounts = accountRecord.accounts || [];
    const accountCount = accounts.length;

    const statuses = this.app?.getDeviceStatuses ? this.app.getDeviceStatuses(targetSerial) : [];
    const dotsHtml = this.app?.renderAccountDots ? this.app.renderAccountDots(statuses) : '';

    this.activeSerial = targetSerial;
    this.overlay = document.createElement('div');
    this.overlay.className = 'flowtouch-focus-overlay';
    this.overlay.id = 'flowTouchFocusOverlay';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-label', 'FlowTouch Focus Mode');
    const transportsArray = Array.isArray(device?.transports) ? device.transports : [];
    let types = transportsArray.map(t => typeof t === 'string' ? t : t?.type).filter(Boolean);
    if (types.length === 0) {
      const isIp = targetSerial.includes('.') || targetSerial.includes(':');
      types = [isIp ? 'wifi' : (device?.connectionType || 'usb')];
    }
    const transportsText = types.join(' + ').toUpperCase();
    const badgeClass = types[0] || 'usb';
    const preferred = device?.preferredTransport || 'auto';
    const prefText = 'Pref: ' + preferred.charAt(0).toUpperCase() + preferred.slice(1);

    const showAdvanced = localStorage.getItem('flowdashboard.focus.showAdvanced') === 'true';
    const advancedClass = showAdvanced ? 'show-advanced-panels' : '';
    const cleanClass = showAdvanced ? '' : 'is-clean-mode';
    
    const storedFocusQuality = localStorage.getItem('flowdashboard.focus.preset');
    const currentQuality = ['eco', 'balanced', 'pro'].includes(storedFocusQuality) ? storedFocusQuality : 'balanced';
    const presetClass = `preset-${currentQuality}`;

    this.overlay.innerHTML = `
      <div class="flowtouch-focus-shell is-floating focus-v2 focus-window ${cleanClass} ${advancedClass} ${presetClass} animate-focus-in" data-serial="${this._escape(targetSerial)}">
        <span class="flowtouch-focus-number-badge" title="Numero en Grid">${this._escape(deviceNumber || '?')}</span>
        <header class="flowtouch-focus-header focus-glass-panel">
          <div class="flowtouch-window-drag-strip" data-flowtouch-window-drag title="Mover Focus">
            <button class="flowtouch-window-title-btn" id="flowTouchDeviceNameBtn" title="Editar nombre">
              <span class="flowtouch-window-title-text">${this._escape(title)}</span>
            </button>
            <span class="flowtouch-window-subtitle-text">${this._escape(shortSerial)}</span>
          </div>
          <div class="flowtouch-focus-ip flowtouch-header-ip device-public-ip" id="flowTouchFocusIp" title="${this._escape(countryName || countryCode || 'IP publica')}">
            ${flagHtml}
            <span>${this._escape(publicIp || 'IP publica...')}</span>
          </div>
          <div class="flowtouch-focus-title">
            <button class="flowtouch-focus-device-name device-name hover-lift" id="flowTouchDeviceNameBtnLegacy" title="Editar nombre">
              <span>${this._escape(title)}</span>
              <svg class="fq-edit-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; margin-left: 6px; opacity: 0; transition: all 0.2s;"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <div class="flowtouch-focus-connection" style="display:flex;gap:6px;align-items:center;">
              <span class="device-connection-badge is-${this._escape(badgeClass)} pulse-status">${this._escape(transportsText)}</span>
              <small title="${this._escape(targetSerial)}" style="margin-left:4px; opacity:0.8;">${this._escape(shortSerial)}</small>
            </div>
            <div class="flowtouch-focus-ip device-public-ip flowtouch-focus-ip-legacy" title="${this._escape(countryName || countryCode || 'IP publica')}">
              ${flagHtml}
              <span>${this._escape(publicIp || 'IP publica...')}</span>
            </div>
          </div>
          <div class="flowtouch-focus-technical-header" id="flowTouchTechHeader" style="display: flex; gap: 4px; align-items: center; margin-left: 12px; margin-right: auto;">
             <span class="flowtouch-status-pill" id="flowTouchAgentState">Revisando</span>
             <span class="flowtouch-status-pill" id="flowTouchFrameState">Frame</span>
          </div>
          <div class="flowtouch-focus-actions">
            <div class="flowtouch-quality-segments" id="flowTouchQualitySegments">
              <button class="fq-segment-btn" data-preset="eco" title="Eco (Bajo ancho de banda)" aria-label="Eco">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20c8-1 13-7 14-16-8 1-14 6-16 14"/><path d="M5 20c2-5 6-9 11-12"/></svg>
              </button>
              <button class="fq-segment-btn" data-preset="balanced" title="Balanced (Equilibrado)" aria-label="Balanced">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16"/><path d="M6 14a6 6 0 0 1 12 0"/><path d="m12 14 4-5"/><path d="M8 14h.01M16 14h.01"/></svg>
              </button>
              <button class="fq-segment-btn" data-preset="pro" title="Pro (Alta definición)" aria-label="Pro">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.3 5.4 5.7.5-4.3 3.8 1.3 5.6-5-3-5 3 1.3-5.6L4 8.9l5.7-.5z"/><path d="M19 3v4M21 5h-4"/></svg>
              </button>
              <div class="fq-segment-slider"></div>
            </div>
            
            <button class="flowtouch-icon-btn flowtouch-replicate-btn hover-lift ${this.replicateSelected ? 'is-active' : ''}" id="flowTouchReplicateBtn" title="Replicar acciones al Grid seleccionado" aria-label="Replicar acciones" aria-pressed="${this.replicateSelected ? 'true' : 'false'}">
              <svg viewBox="0 0 24 24" style="stroke:currentColor; fill:none; stroke-width:2;"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/><path d="M11 7h4a2 2 0 0 1 2 2v4"/><path d="M13 17H9a2 2 0 0 1-2-2v-4"/></svg>
            </button>
            <button class="flowtouch-icon-btn hover-lift" id="flowTouchAdvancedToggleBtn" title="Más herramientas" aria-label="Más herramientas" style="margin-right: 8px;">
              <svg viewBox="0 0 24 24" style="stroke:currentColor; fill:none; stroke-width:2;"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="2" y1="14" x2="6" y2="14"/><line x1="10" y1="8" x2="14" y2="8"/><line x1="18" y1="16" x2="22" y2="16"/></svg>
            </button>
            <button class="flowtouch-icon-btn is-close hover-lift" id="flowTouchCloseBtn" title="Cerrar FlowTouch">
              <svg viewBox="0 0 24 24" style="stroke:currentColor; fill:none; stroke-width:2;"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </header>
        
        <main class="flowtouch-focus-main">
          <section class="flowtouch-phone-stage animate-scale-in">
            <div class="flowtouch-phone-wrapper">
              
              <!-- Left Wing: Más herramientas toolbar -->
              <aside class="focus-pro-panel" id="flowTouchAdvancedPanel">
                <button class="fp-launcher-btn" data-fp-launcher="apps" title="Aplicaciones">
                  <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                  <span>Apps</span>
                </button>
                <button class="fp-launcher-btn" data-fp-launcher="archivos" title="Archivos">
                  <svg viewBox="0 0 24 24"><path d="M3 7l3-4h12l3 4"/><path d="M3 7v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7"/><path d="M12 11v6"/><path d="M9 14l3-3 3 3"/></svg>
                  <span>Archivos</span>
                </button>
                <button class="fp-launcher-btn" data-fp-launcher="adb" title="ADB Shell">
                  <svg viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                  <span>ADB</span>
                </button>
                <button class="fp-launcher-btn" data-fp-launcher="autojs" title="Auto.js">
                  <svg viewBox="0 0 24 24"><path d="M5 3l6 18 2-7 7-2z"/></svg>
                  <span>Auto.js</span>
                </button>
                <button class="fp-launcher-btn" data-fp-launcher="sistema" title="Sistema">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
                  <span>Sistema</span>
                </button>
                <button class="fp-launcher-btn" data-fp-launcher="energia" title="Energia">
                  <svg viewBox="0 0 24 24"><path d="M12 2v10"/><path d="M5.5 7.5a8 8 0 1 0 13 0"/></svg>
                  <span>Energia</span>
                </button>
                <button class="fp-launcher-btn" data-fp-launcher="flowkeyboard" title="FlowKeyboard">
                  <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h.01M11 9h.01M15 9h.01M19 9h.01M7 13h.01M11 13h6M7 17h10"/></svg>
                  <span>Keyboard</span>
                </button>
                <button class="fp-launcher-btn" data-fp-launcher="inspector" title="FlowDev Inspector">
                  <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>
                  <span>Inspector</span>
                </button>
                <button class="fp-launcher-btn focus-side-action-btn focus-accounts-btn" id="flowTouchAccountsBtn" title="Ver cuentas">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>
                  <span>Cuentas</span>
                  <small id="flowTouchAccountsCount">${accountCount}/10</small>
                </button>
                <button class="fp-launcher-btn focus-side-action-btn focus-options-btn" id="flowTouchOptionsBtn" title="Opciones del dispositivo">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
                  <span>Opciones</span>
                </button>
              </aside>

              <!-- Center Phone Frame -->
              <div class="flowtouch-phone-frame flow-glowing-frame">
                <canvas id="flowTouchCanvas-${safeSerial}" class="flowtouch-focus-canvas touch-none"></canvas>
                <div class="flowtouch-gesture-layer" id="flowTouchGestureLayer" style="display:none;"></div>
                
                <!-- Loader over canvas -->
                <div class="flowtouch-stream-loader" id="flowTouchStreamLoader">
                   <div class="flow-spinner"></div>
                   <span style="margin-top: 8px; font-size: 0.85rem; color: #fff; text-shadow: 0 1px 2px #000;">Conectando stream...</span>
                </div>
                <span class="flowtouch-phone-resize-handle" data-flowtouch-focus-resize aria-hidden="true"></span>
              </div>

              <button class="flowtouch-side-move-handle" type="button" data-flowtouch-window-drag title="Mover Focus" aria-label="Mover Focus">
                <span></span><span></span><span></span><span></span><span></span><span></span>
              </button>

              <!-- Accounts Dots Column next to the phone frame -->
              <div class="flowtouch-focus-dots-column account-status-column" id="flowTouchDotsColumn">
                ${dotsHtml}
              </div>

              <button class="flowtouch-runtime-stop-btn" id="flowTouchRuntimeStopBtn" type="button" title="Detener ejecucion activa" aria-label="Detener ejecucion activa">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/></svg>
              </button>

              <!-- Right Wing: Historial de Eventos -->
              <aside class="flowtouch-log-panel" id="flowTouchLogPanel">
                <div class="flowtouch-log-panel-header">
                  <span class="flowtouch-log-panel-title">Historial de Eventos</span>
                  <button class="flowtouch-log-panel-clear" id="flowTouchLogClearBtn" title="Limpiar historial">Limpiar</button>
                </div>
                <div class="flowtouch-log-list" id="flowTouchLogList"></div>
              </aside>

            </div>
          </section>
        </main>
        
        <footer class="flowtouch-focus-footer focus-glass-panel slide-up">
           <div class="fp-nav-compact-row" style="display:flex; gap:20px; justify-content:center;">
             <button class="fp-icon-btn hover-lift glow-on-hover" id="flowTouchBackBtn" title="Back en Android">
               <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/></svg>
             </button>
             <button class="fp-icon-btn hover-lift glow-on-hover" id="flowTouchHomeBtn" title="Home en Android">
               <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/></svg>
             </button>
             <button class="fp-icon-btn hover-lift glow-on-hover" id="flowTouchRecentsBtn" title="Recents en Android">
               <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>
             </button>
           </div>
        </footer>
      </div>
    `;

    document.body.appendChild(this.overlay);
    document.body.classList.add('flowtouch-is-open');
    this._markFocusedCard(targetSerial, true);
    this._applyPersistedFocusWindowGeometry();
    this._bindFocusEvents();
    this._attachStreamCanvas(targetSerial, safeSerial);
    // Obtener resolución real del device via wm size para calibrar el touch.
    this._deviceScreenSize = null;
    this._fetchDeviceScreenSize(targetSerial).catch(() => null);
    this._bindCoordinatePreview();
    this._refreshFocusPublicIp(targetSerial).catch(() => null);
    await this._refreshAgentState(targetSerial);
    this._refreshFrameState(targetSerial);
    // Fase 8: FlowKeyboard se consulta una sola vez al abrir Focus Mode.
    // No se prepara automaticamente; solo se muestra el estado actual.
    this._refreshFlowKeyboardStatus(targetSerial).catch(() => null);
    this._refreshRecordingState(targetSerial).catch(() => null);
    // Focus PRO Panel - Fase 1: ON automatico con debounce de 350 ms para
    // ignorar el primer click que viene del doble click de apertura.
    this._autoArmControlSafely(targetSerial).catch(() => null);
    this.agentStatusTimer = setInterval(() => this._refreshAgentState(targetSerial), 5000);
    this.frameStatusTimer = setInterval(() => this._refreshFrameState(targetSerial), 1000);
    this.runtimeStatusTimer = setInterval(() => this._refreshRuntimeState(), 1500);
    this._refreshRuntimeState();
  }

  closeFocus() {
    const serial = this.activeSerial;
    this.disableControl();
    // Cerrar ventanas flotantes del Focus si quedaron abiertas
    this._closeFocusFloatingPanels?.();
    if (this.agentStatusTimer) {
      clearInterval(this.agentStatusTimer);
      this.agentStatusTimer = null;
    }
    if (this.frameStatusTimer) {
      clearInterval(this.frameStatusTimer);
      this.frameStatusTimer = null;
    }
    if (this.runtimeStatusTimer) {
      clearInterval(this.runtimeStatusTimer);
      this.runtimeStatusTimer = null;
    }
    this._unbindCoordinatePreview();
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    this._unbindFocusResizeObserver();
    this._unbindFocusWindowChrome();
    if (this._focusRafId) {
      cancelAnimationFrame(this._focusRafId);
      this._focusRafId = null;
    }
    this._focusLoopActive = false;

    if (serial && this.app.h264Renderer && this.focusCanvas) {
      if (typeof this.app.h264Renderer.detachAllFocus === 'function') {
        this.app.h264Renderer.detachAllFocus(serial);
      } else if (this._currentFocusPreset && typeof this.app.h264Renderer.detachFocus === 'function') {
        this.app.h264Renderer.detachFocus(serial, this._currentFocusPreset);
      }
      try { this.app.h264Renderer.detach(serial, this.focusCanvas); } catch (_) {}
      const gridCanvas = this.app.streamRenderer?.canvases?.get(serial);
      const gridPreset = this.app.getGridPresetForZoom
        ? this.app.getGridPresetForZoom(this.app.deviceZoom)
        : (localStorage.getItem('flowdashboard.grid.preset') || 'thumbnail');
      if (gridCanvas && document.contains(gridCanvas)) {
        try {
          const stats = typeof this.app.h264Renderer.getStats === 'function'
            ? this.app.h264Renderer.getStats(serial)
            : null;
          const hasValidFrame = Number(stats?.framesDecoded || 0) > 0
            && Number(stats?.width || 0) > 0
            && Number(stats?.height || 0) > 0;
          const decoderBroken = Number(stats?.decodeErrors || 0) > 0
            && (!stats?.configured || stats?.waitingKeyframe);
          const shouldRestart = !stats || !stats.connected || !hasValidFrame || decoderBroken;
          if (shouldRestart) {
            const restarted = typeof this.app.h264Renderer.forceRestart === 'function'
              ? this.app.h264Renderer.forceRestart(serial, gridPreset)
              : false;
            if (!restarted) {
              this.app.h264Renderer.attach(serial, gridCanvas, gridPreset);
            }
          } else {
            this.app.h264Renderer.attach(serial, gridCanvas, stats.preset || this._currentFocusPreset || gridPreset);
          }
        } catch (_) {}
      }
      this._currentFocusPreset = null;
      this._focusSerialKey = null;
    }

    this._focusSession = null;
    this._focusSerialKey = null;
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (serial) {
      this._markFocusedCard(serial, false);
    }
    this.focusCanvas = null;
    this.activeSerial = null;
    this._deviceScreenSize = null;
    document.body.classList.remove('flowtouch-is-open');
    document.body.classList.remove('flowtouch-control-on');
  }

  destroy() {
    this.closeFocus();
  }

  _focusWindowStorageKey() {
    return 'flowdashboard.focus.window.geometry.transform';
  }

  _getDefaultFocusWindowGeometry() {
    const viewportW = window.innerWidth || 1280;
    const viewportH = window.innerHeight || 800;
    const advanced = localStorage.getItem('flowdashboard.focus.showAdvanced') === 'true';
    const height = Math.min(Math.max(600, viewportH - 96), 840);
    const preferredWidth = advanced
      ? this._getAdvancedFocusWindowWidth(height)
      : this._getCleanFocusWindowWidth(height);
    const width = Math.min(Math.max(360, preferredWidth), Math.max(360, viewportW - 24));
    return {
      width,
      height,
      left: Math.max(16, Math.round((viewportW - width) / 2)),
      top: Math.max(18, Math.round((viewportH - height) / 2)),
    };
  }

  _getCleanFocusWindowWidth(height) {
    const viewportW = window.innerWidth || 1280;
    const toolbarH = 44;
    const footerH = 50;
    const chromePad = 28;
    const usablePhoneH = Math.max(420, Number(height || 760) - toolbarH - footerH - chromePad);
    const phoneW = Math.round(usablePhoneH * 9 / 16);
    return Math.min(Math.max(360, phoneW + 86), Math.max(360, viewportW - 24));
  }

  _getAdvancedFocusWindowWidth(height, currentWidth = 0) {
    const viewportW = window.innerWidth || 1280;
    const cleanWidth = this._getCleanFocusWindowWidth(height);
    const advancedWidth = cleanWidth + 150 + 30;
    return Math.min(Math.max(560, currentWidth || 0, advancedWidth), Math.max(360, viewportW - 24));
  }

  _loadFocusWindowGeometry() {
    const fallback = this._getDefaultFocusWindowGeometry();
    try {
      const raw = localStorage.getItem(this._focusWindowStorageKey());
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      const width = Number(parsed.width);
      const height = Number(parsed.height);
      const left = Number(parsed.left);
      const top = Number(parsed.top);
      if (
        !Number.isFinite(left) || !Number.isFinite(top) ||
        !Number.isFinite(width) || !Number.isFinite(height) ||
        width < 320 || height < 460 ||
        (left <= 10 && top <= 36)
      ) {
        return fallback;
      }
      return {
        left,
        top,
        width,
        height,
      };
    } catch {
      return fallback;
    }
  }

  _clampFocusWindowGeometry(geom = {}) {
    const viewportW = window.innerWidth || 1280;
    const viewportH = window.innerHeight || 800;
    const minWidth = Math.min(360, Math.max(320, viewportW - 24));
    const minHeight = Math.min(480, Math.max(360, viewportH - 24));
    const maxWidth = Math.max(minWidth, viewportW - 24);
    const maxHeight = Math.max(minHeight, viewportH - 24);
    const width = Math.max(minWidth, Math.min(Number(geom.width) || 430, maxWidth));
    const height = Math.max(minHeight, Math.min(Number(geom.height) || 760, maxHeight));
    const visibleX = Math.min(180, width);
    const visibleY = Math.min(132, height);
    const minLeft = Math.min(8, -(width - visibleX));
    const minTop = Math.min(8, -(height - visibleY));
    const maxLeft = Math.max(8, viewportW - visibleX);
    const maxTop = Math.max(8, viewportH - visibleY);
    const rawLeft = Number.isFinite(Number(geom.left)) ? Number(geom.left) : 32;
    const rawTop = Number.isFinite(Number(geom.top)) ? Number(geom.top) : 32;
    const left = Math.max(minLeft, Math.min(rawLeft, maxLeft));
    const top = Math.max(minTop, Math.min(rawTop, maxTop));
    return { left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) };
  }

  _applyFocusWindowGeometry(shell, geom) {
    if (!shell) return;
    const safe = this._clampFocusWindowGeometry(geom);
    shell.style.left = '0px';
    shell.style.top = '0px';
    shell.style.transform = `translate3d(${safe.left}px, ${safe.top}px, 0)`;
    shell.style.setProperty('--flowtouch-focus-window-x', `${safe.left}px`);
    shell.style.setProperty('--flowtouch-focus-window-y', `${safe.top}px`);
    shell.style.setProperty('--flowtouch-focus-window-width', `${safe.width}px`);
    shell.style.setProperty('--flowtouch-focus-window-height', `${safe.height}px`);
    this._updateFocusSizeClass(shell);
  }

  _applyPersistedFocusWindowGeometry() {
    const shell = this.overlay?.querySelector('.flowtouch-focus-shell');
    const geom = this._loadFocusWindowGeometry();
    const advanced = localStorage.getItem('flowdashboard.focus.showAdvanced') === 'true';
    const normalized = {
      ...geom,
      width: advanced
        ? this._getAdvancedFocusWindowWidth(geom.height, geom.width)
        : this._getCleanFocusWindowWidth(geom.height),
    };
    this._applyFocusWindowGeometry(shell, normalized);
  }

  _persistFocusWindowGeometry(shell) {
    if (!shell) return;
    try {
      const width = shell.getBoundingClientRect().width;
      const height = shell.getBoundingClientRect().height;
      const geom = this._clampFocusWindowGeometry({
        left: Number.parseFloat(shell.style.getPropertyValue('--flowtouch-focus-window-x')) || 0,
        top: Number.parseFloat(shell.style.getPropertyValue('--flowtouch-focus-window-y')) || 0,
        width,
        height,
      });
      localStorage.setItem(this._focusWindowStorageKey(), JSON.stringify(geom));
      this._applyFocusWindowGeometry(shell, geom);
    } catch {
      // no-op
    }
  }

  _ensureFocusWindowAdvancedGeometry(shell, advanced) {
    if (!shell) return;
    const rect = shell.getBoundingClientRect();
    const viewportW = window.innerWidth || 1280;
    const targetWidth = advanced
      ? this._getAdvancedFocusWindowWidth(rect.height, rect.width)
      : Math.min(this._getCleanFocusWindowWidth(rect.height), Math.max(360, viewportW - 24));
    if (advanced && rect.width >= targetWidth - 12) return;
    if (!advanced && Math.abs(rect.width - targetWidth) < 12) return;
    this._applyFocusWindowGeometry(shell, {
      left: (Number.parseFloat(shell.style.getPropertyValue('--flowtouch-focus-window-x')) || rect.left) - ((targetWidth - rect.width) / 2),
      top: Number.parseFloat(shell.style.getPropertyValue('--flowtouch-focus-window-y')) || rect.top,
      width: targetWidth,
      height: rect.height,
    });
    this._persistFocusWindowGeometry(shell);
  }

  _isFocusWindowBlockedTarget(target) {
    if (target?.closest?.('.flowtouch-window-title-btn')) return true;
    if (target?.closest?.('[data-flowtouch-window-drag]')) return false;
    return !!target?.closest?.('button, input, textarea, select, canvas, [contenteditable], .fp-window, .fp-confirm-layer');
  }

  _updateFocusSizeClass(shell) {
    if (!shell) return;
    const rect = shell.getBoundingClientRect();
    const width = rect.width || Number.parseFloat(getComputedStyle(shell).width) || 0;
    const height = rect.height || Number.parseFloat(getComputedStyle(shell).height) || 0;
    shell.classList.remove('focus-size-sm', 'focus-size-md', 'focus-size-lg', 'focus-height-short');
    if (width < 560) {
      shell.classList.add('focus-size-sm');
    } else if (width < 820) {
      shell.classList.add('focus-size-md');
    } else {
      shell.classList.add('focus-size-lg');
    }
    if (height < 620) {
      shell.classList.add('focus-height-short');
    }
  }

  _bindFocusResizeObserver(shell) {
    this._unbindFocusResizeObserver();
    if (!shell) return;
    this._updateFocusSizeClass(shell);
    if (typeof ResizeObserver === 'undefined') return;
    this._focusResizeObserver = new ResizeObserver(() => this._updateFocusSizeClass(shell));
    this._focusResizeObserver.observe(shell);
  }

  _unbindFocusResizeObserver() {
    if (this._focusResizeObserver) {
      this._focusResizeObserver.disconnect();
      this._focusResizeObserver = null;
    }
  }

  _bindFocusWindowChrome(shell) {
    if (!shell || this._focusWindowCleanup) return;
    const header = shell.querySelector('.flowtouch-focus-header');
    const dragHandles = Array.from(shell.querySelectorAll('[data-flowtouch-window-drag]'));
    const resizeHandle = shell.querySelector('[data-flowtouch-focus-resize]');
    let dragStart = null;
    let resizeStart = null;

    const readPoint = (event, fallback = { x: 0, y: 0 }) => ({
      x: Number.isFinite(event.clientX) ? event.clientX : fallback.x,
      y: Number.isFinite(event.clientY) ? event.clientY : fallback.y,
    });

    const applyDragPosition = (left, top, width, height) => {
      const safe = this._clampFocusWindowGeometry({ left, top, width, height });
      shell.style.transform = `translate3d(${safe.left}px, ${safe.top}px, 0)`;
      shell.style.setProperty('--flowtouch-focus-window-x', `${safe.left}px`);
      shell.style.setProperty('--flowtouch-focus-window-y', `${safe.top}px`);
      return safe;
    };

    const onDragDown = (event) => {
      if (dragStart) return;
      if (event.type === 'mousedown' && event.detail === 0) return;
      if (event.button != null && event.button !== 0) return;
      if (event.target?.closest?.('.flowtouch-window-title-btn')) return;
      const explicitHandle = event.target?.closest?.('[data-flowtouch-window-drag]');
      const headerDrag = event.currentTarget === header && !this._isFocusWindowBlockedTarget(event.target);
      if (!explicitHandle && !headerDrag) return;
      const rect = shell.getBoundingClientRect();
      const point = readPoint(event);
      const currentLeft = Number.parseFloat(shell.style.getPropertyValue('--flowtouch-focus-window-x'));
      const currentTop = Number.parseFloat(shell.style.getPropertyValue('--flowtouch-focus-window-y'));
      dragStart = {
        pointerId: event.pointerId,
        x: point.x,
        y: point.y,
        left: Number.isFinite(currentLeft) ? currentLeft : rect.left,
        top: Number.isFinite(currentTop) ? currentTop : rect.top,
        width: rect.width,
        height: rect.height,
      };
      this._focusWindowDragging = true;
      shell.classList.add('is-moving');
      document.body.classList.add('flowtouch-focus-is-moving');
      try { event.currentTarget?.setPointerCapture?.(event.pointerId); } catch (_) {}
      window.addEventListener('pointermove', onDragMove, true);
      window.addEventListener('pointerup', onDragUp, true);
      window.addEventListener('pointercancel', onDragUp, true);
      window.addEventListener('mousemove', onDragMove, true);
      window.addEventListener('mouseup', onDragUp, true);
      document.addEventListener('pointermove', onDragMove, true);
      document.addEventListener('pointerup', onDragUp, true);
      document.addEventListener('mousemove', onDragMove, true);
      document.addEventListener('mouseup', onDragUp, true);
      event.preventDefault();
      event.stopPropagation();
    };

    const onDragMove = (event) => {
      if (!dragStart) return;
      const point = readPoint(event, dragStart);
      applyDragPosition(
        dragStart.left + (point.x - dragStart.x),
        dragStart.top + (point.y - dragStart.y),
        dragStart.width,
        dragStart.height,
      );
      event.preventDefault?.();
      event.stopPropagation?.();
    };

    const onDragUp = () => {
      dragStart = null;
      this._focusWindowDragging = false;
      shell.classList.remove('is-moving');
      document.body.classList.remove('flowtouch-focus-is-moving');
      window.removeEventListener('pointermove', onDragMove, true);
      window.removeEventListener('pointerup', onDragUp, true);
      window.removeEventListener('pointercancel', onDragUp, true);
      window.removeEventListener('mousemove', onDragMove, true);
      window.removeEventListener('mouseup', onDragUp, true);
      document.removeEventListener('pointermove', onDragMove, true);
      document.removeEventListener('pointerup', onDragUp, true);
      document.removeEventListener('mousemove', onDragMove, true);
      document.removeEventListener('mouseup', onDragUp, true);
      this._persistFocusWindowGeometry(shell);
    };

    const onResizeDown = (event) => {
      if (resizeStart) return;
      if (event.button != null && event.button !== 0) return;
      const rect = shell.getBoundingClientRect();
      const currentLeft = Number.parseFloat(shell.style.getPropertyValue('--flowtouch-focus-window-x'));
      const currentTop = Number.parseFloat(shell.style.getPropertyValue('--flowtouch-focus-window-y'));
      resizeStart = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: Number.isFinite(currentLeft) ? currentLeft : rect.left,
        top: Number.isFinite(currentTop) ? currentTop : rect.top,
        width: rect.width,
        height: rect.height,
      };
      this._focusWindowResizing = true;
      shell.classList.add('is-resizing');
      document.body.classList.add('flowtouch-focus-is-resizing');
      try { resizeHandle?.setPointerCapture?.(event.pointerId); } catch (_) {}
      window.addEventListener('pointermove', onResizeMove, true);
      window.addEventListener('pointerup', onResizeUp, true);
      window.addEventListener('pointercancel', onResizeUp, true);
      window.addEventListener('mousemove', onResizeMove, true);
      window.addEventListener('mouseup', onResizeUp, true);
      event.preventDefault();
      event.stopPropagation();
    };

    const onResizeMove = (event) => {
      if (!resizeStart) return;
      this._applyFocusWindowGeometry(shell, {
        left: resizeStart.left,
        top: resizeStart.top,
        width: resizeStart.width + (event.clientX - resizeStart.x),
        height: resizeStart.height + (event.clientY - resizeStart.y),
      });
    };

    const onResizeUp = () => {
      resizeStart = null;
      this._focusWindowResizing = false;
      shell.classList.remove('is-resizing');
      document.body.classList.remove('flowtouch-focus-is-resizing');
      window.removeEventListener('pointermove', onResizeMove, true);
      window.removeEventListener('pointerup', onResizeUp, true);
      window.removeEventListener('pointercancel', onResizeUp, true);
      window.removeEventListener('mousemove', onResizeMove, true);
      window.removeEventListener('mouseup', onResizeUp, true);
      this._persistFocusWindowGeometry(shell);
    };

    const onViewportResize = () => {
      this._persistFocusWindowGeometry(shell);
    };

    dragHandles.forEach(handle => {
      handle.addEventListener('pointerdown', onDragDown);
      handle.addEventListener('mousedown', onDragDown);
    });
    header?.addEventListener('pointerdown', onDragDown);
    header?.addEventListener('mousedown', onDragDown);
    resizeHandle?.addEventListener('pointerdown', onResizeDown);
    resizeHandle?.addEventListener('mousedown', onResizeDown);
    window.addEventListener('resize', onViewportResize);

    this._focusWindowCleanup = () => {
      dragHandles.forEach(handle => {
        handle.removeEventListener('pointerdown', onDragDown);
        handle.removeEventListener('mousedown', onDragDown);
      });
      header?.removeEventListener('pointerdown', onDragDown);
      header?.removeEventListener('mousedown', onDragDown);
      resizeHandle?.removeEventListener('pointerdown', onResizeDown);
      resizeHandle?.removeEventListener('mousedown', onResizeDown);
      window.removeEventListener('resize', onViewportResize);
      window.removeEventListener('pointermove', onDragMove, true);
      window.removeEventListener('pointermove', onResizeMove, true);
      window.removeEventListener('pointerup', onDragUp, true);
      window.removeEventListener('pointerup', onResizeUp, true);
      window.removeEventListener('pointercancel', onDragUp, true);
      window.removeEventListener('pointercancel', onResizeUp, true);
      window.removeEventListener('mousemove', onDragMove, true);
      window.removeEventListener('mousemove', onResizeMove, true);
      window.removeEventListener('mouseup', onDragUp, true);
      window.removeEventListener('mouseup', onResizeUp, true);
      document.removeEventListener('pointermove', onDragMove, true);
      document.removeEventListener('pointerup', onDragUp, true);
      document.removeEventListener('mousemove', onDragMove, true);
      document.removeEventListener('mouseup', onDragUp, true);
      dragStart = null;
      resizeStart = null;
      this._focusWindowDragging = false;
      this._focusWindowResizing = false;
      shell.classList.remove('is-moving', 'is-resizing');
      document.body.classList.remove('flowtouch-focus-is-moving', 'flowtouch-focus-is-resizing');
    };
  }

  _unbindFocusWindowChrome() {
    if (typeof this._focusWindowCleanup === 'function') {
      this._focusWindowCleanup();
      this._focusWindowCleanup = null;
    }
  }

  _bindFocusEvents() {
    const closeBtn = this.overlay.querySelector('#flowTouchCloseBtn');
    const recordBtn = this.overlay.querySelector('#flowTouchRecordBtn');
    const backBtn = this.overlay.querySelector('#flowTouchBackBtn');
    const homeBtn = this.overlay.querySelector('#flowTouchHomeBtn');
    const recentsBtn = this.overlay.querySelector('#flowTouchRecentsBtn');
    const replicateBtn = this.overlay.querySelector('#flowTouchReplicateBtn');
    const nameBtn = this.overlay.querySelector('#flowTouchDeviceNameBtn');
    const techModeSwitch = this.overlay.querySelector('#flowTouchTechModeSwitch');
    const techHeader = this.overlay.querySelector('#flowTouchTechHeader');
    const logPanelParent = this.overlay.querySelector('#flowTouchLogPanelParent');
    const shellEl = this.overlay.querySelector('.flowtouch-focus-shell');
    this._bindFocusWindowChrome(shellEl);
    this._bindFocusResizeObserver(shellEl);
    
    closeBtn?.addEventListener('click', () => this.closeFocus());
    const advBtn = this.overlay.querySelector('#flowTouchAdvancedToggleBtn');
    if (advBtn && localStorage.getItem('flowdashboard.focus.showAdvanced') === 'true') {
      advBtn.classList.add('is-active');
    }
    advBtn?.addEventListener('click', () => {
      const shell = this.overlay.querySelector('.flowtouch-focus-shell');
      if (shell) {
        shell.classList.toggle('show-advanced-panels');
        const active = shell.classList.contains('show-advanced-panels');
        localStorage.setItem('flowdashboard.focus.showAdvanced', active ? 'true' : 'false');
        advBtn.classList.toggle('is-active', active);
        
        if (active) {
          shell.classList.remove('is-clean-mode');
        } else {
          shell.classList.add('is-clean-mode');
        }
        this._ensureFocusWindowAdvancedGeometry(shell, active);
        this._updateFocusSizeClass(shell);
        requestAnimationFrame(() => this._syncRuntimeStateNow());
      }
    });

    const clearLogBtn = this.overlay.querySelector('#flowTouchLogClearBtn');
    clearLogBtn?.addEventListener('click', () => {
      const logList = this.overlay.querySelector('#flowTouchLogList');
      if (logList) logList.innerHTML = '';
    });
    this._bindProPanelApps(); // Rebind launcher events

    const accountsBtn = this.overlay.querySelector('#flowTouchAccountsBtn');
    const optionsBtn = this.overlay.querySelector('#flowTouchOptionsBtn');
    const runtimeStopBtn = this.overlay.querySelector('#flowTouchRuntimeStopBtn');

    accountsBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      this._closeFocusFloatingPanels();
      this.app.openDeviceAccountEditor(this.activeSerial);
    });

    optionsBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      this._closeFocusFloatingPanels();
      this.app.openContextMenu(event, this.activeSerial);
    });

    runtimeStopBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      this._stopActiveRuntime();
    });

    recordBtn?.addEventListener('click', () => this._toggleRecording());
    
    techModeSwitch?.addEventListener('change', () => {
      if (techModeSwitch.checked) {
        shellEl.classList.remove('is-clean-mode');
        if(techHeader) techHeader.style.display = 'flex';
        if(logPanelParent) logPanelParent.style.display = 'flex';
      } else {
        shellEl.classList.add('is-clean-mode');
        if(techHeader) techHeader.style.display = 'none';
        if(logPanelParent) logPanelParent.style.display = 'none';
      }
    });

    const qualitySegments = this.overlay.querySelector('#flowTouchQualitySegments');
    if (qualitySegments) {
      const storedFocusQuality = localStorage.getItem('flowdashboard.focus.preset');
      const currentQuality = ['eco', 'balanced', 'pro'].includes(storedFocusQuality) ? storedFocusQuality : 'balanced';
      
      const btns = qualitySegments.querySelectorAll('.fq-segment-btn');
      
      const updateSegments = (selectedPreset) => {
        btns.forEach(btn => {
          if (btn.dataset.preset === selectedPreset) {
            btn.classList.add('is-active');
          } else {
            btn.classList.remove('is-active');
          }
        });
        
        const shell = this.overlay.querySelector('.flowtouch-focus-shell');
        if (shell) {
          shell.classList.remove('preset-eco', 'preset-balanced', 'preset-pro');
          shell.classList.add(`preset-${selectedPreset}`);
        }
      };
      
      // Init
      updateSegments(currentQuality);
      
      btns.forEach(btn => {
        btn.addEventListener('click', () => {
          const newPreset = btn.dataset.preset;
          updateSegments(newPreset);
          this._currentFocusPreset = newPreset;
          localStorage.setItem('flowdashboard.focus.preset', newPreset);
          if (this.app && typeof this.app.setFocusQuality === 'function') {
            this.app.setFocusQuality(newPreset);
          }
        });
      });
    }

    backBtn?.addEventListener('click', () => this._sendNavCommand('back'));
    homeBtn?.addEventListener('click', () => this._sendNavCommand('home'));
    recentsBtn?.addEventListener('click', () => this._sendNavCommand('recents'));
    replicateBtn?.addEventListener('click', () => this._toggleReplicateSelected());
    this._syncReplicateUi();
    nameBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.focusKeyboardTargetActive = false;
      if (this.focusCanvas && document.activeElement === this.focusCanvas) {
        try { this.focusCanvas.blur(); } catch {}
      }
      this.app?.openDeviceNamePopover?.(event, this.activeSerial);
    });

    this._bindProPanelApps();

    this.keyHandler = (event) => this._handleFocusPhysicalKeyboard(event);
    document.addEventListener('keydown', this.keyHandler);
  }

  _bindProPanelToggles() {
    if (!this.overlay) return;
    // Persistencia abierto/cerrado en localStorage
    let expanded = [];
    try {
      const raw = localStorage.getItem('flowdashboard.focusPanel.expanded');
      if (raw) expanded = JSON.parse(raw) || [];
    } catch { expanded = []; }
    if (!Array.isArray(expanded)) expanded = [];
    const persist = () => {
      try {
        const open = Array.from(this.overlay.querySelectorAll('.fp-block.fp-collapsible:not(.is-collapsed)'))
          .map(el => el.dataset.block);
        localStorage.setItem('flowdashboard.focusPanel.expanded', JSON.stringify(open));
      } catch { /* no-op */ }
    };
    const toggles = this.overlay.querySelectorAll('[data-fp-toggle]');
    toggles.forEach(toggle => {
      const blockId = toggle.dataset.fpToggle;
      const block = this.overlay.querySelector(`.fp-block[data-block="${blockId}"]`);
      if (!block) return;
      const wasOpen = expanded.includes(blockId);
      block.classList.toggle('is-collapsed', !wasOpen);
      toggle.addEventListener('click', () => {
        block.classList.toggle('is-collapsed');
        persist();
      });
    });
  }

  _attachStreamCanvas(serial, safeSerial) {
    const canvas = this.overlay.querySelector(`#flowTouchCanvas-${safeSerial}`);
    if (!canvas || !this.app.streamRenderer) return;
    this.focusCanvas = canvas;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';

    const storedFocusPreset = localStorage.getItem('flowdashboard.focus.preset');
    const focusPreset = ['eco', 'balanced', 'pro'].includes(storedFocusPreset)
      ? storedFocusPreset
      : 'balanced';
    localStorage.setItem('flowdashboard.focus.preset', focusPreset);

    this._h264Active = false;
    this._currentFocusPreset = focusPreset;
    this._focusSerialKey = `${serial}|${focusPreset}`;

    const h264 = this.app.h264Renderer;
    const isH264Supported = h264 && h264.isSupported();
    if (isH264Supported && typeof h264.attachFocus === 'function') {
      this._focusSession = h264.attachFocus(serial, canvas, focusPreset);
      this._h264Active = !!this._focusSession;
    } else {
      this._focusSession = null;
      console.warn('[H264-focus] WebCodecs no disponible o attachFocus no existe; Focus requiere scrcpy H.264.');
    }

    // El loader se oculta dinamicamente en _refreshFrameState cuando rinde el primer frame real.
    this._loaderStartT = performance.now();
    console.log(`[H264-focus] Canvas agregado a sesion focus: ${this._focusSerialKey}`);
  }

  _getFrameSize() {
    const serial = this.activeSerial;
    if (!serial) return null;

    // Prioridad 1: resolución real cacheada via wm size (obtenida al abrir focus).
    if (this._deviceScreenSize && this._deviceScreenSize.serial === serial) {
      return { width: this._deviceScreenSize.width, height: this._deviceScreenSize.height };
    }

    // Prioridad 2: WebP renderer (refleja la resolución real del device).
    const webpSize = this.app?.streamRenderer?.getFrameSize?.(serial);
    if (webpSize && webpSize.width > 0 && webpSize.height > 0) {
      return webpSize;
    }

    // Prioridad 3: H.264 renderer — pero su tamaño es el del stream (240p),
    // NO la resolución del device. Solo usarlo como último recurso.
    const h264 = this.app.h264Renderer;
    if (h264) {
      const stats = h264.getStats(serial);
      if (stats && stats.width > 0 && stats.height > 0) {
        return { width: stats.width, height: stats.height };
      }
    }
    return null;
  }

  // Obtiene la resolución real del device via ADB (wm size) y la cachea.
  // Se llama al abrir el focus mode para calibrar el mapeo de coordenadas.
  async _fetchDeviceScreenSize(serial) {
    try {
      const apiBase = this.app.apiBase || 'http://127.0.0.1:8765';
      const r = await fetch(`${apiBase}/device/screen-size?serial=${encodeURIComponent(serial)}`);
      if (!r.ok) return;
      const data = await r.json();
      if (data.width > 0 && data.height > 0) {
        this._deviceScreenSize = { serial, width: data.width, height: data.height };
      }
    } catch (_) {
      // silencioso — el fallback al WebP/H264 size seguirá funcionando
    }
  }

  _bindCoordinatePreview() {
    const canvas = this.focusCanvas;
    if (!canvas) return;

    // pointermove: solo diagnostico local de coordenadas. Si hay gesto en curso,
    // tambien dibuja la cola del trazo. Nunca envia comandos a Android.
    this.pointerMoveHandler = (event) => {
      const tMove = performance.now();
      const point = CoordinateMapper.fromPointerEvent(event, canvas, this._getFrameSize());
      if (!point) return;
      this._updateCoordinateState(point);
      if (this.activeGesture) {
        this.activeGesture.lastPoint = point;
        this.activeGesture.movedPx = Math.max(
          this.activeGesture.movedPx,
          Math.hypot(
            point.canvasX - this.activeGesture.startPoint.canvasX,
            point.canvasY - this.activeGesture.startPoint.canvasY,
          ),
        );
        this._updateGestureTrail();

        // Live Touch Mode - MOVE
        if (this.controlEnabled && LIVE_TOUCH_MODE) {
          if (this.liveTouchPendingDown && this.activeGesture.movedPx > this.gestureTapThresholdPx) {
             this.liveTouchPendingDown = false;
             this.liveTouchActive = true;
             this.liveTouchFallback = false;
             const t0 = performance.now();
             this._appendLog(`[LIVE] DOWN (Move > threshold) a las ${Math.round(t0)}`);
             this.commandRouter.touch(this.activeSerial, 0, this.activeGesture.startPoint.x, this.activeGesture.startPoint.y).then((res) => {
                if (res && res.response && res.response.liveTouch === false) {
                    this.liveTouchFallback = true;
                }
             }).catch(() => { this.liveTouchFallback = true; });
             this._replicateControl('touch', { action: 0, x: this.activeGesture.startPoint.x, y: this.activeGesture.startPoint.y }, { silent: true }).catch(() => {});
             this.liveTouchLastMove = t0; // Reset timer para garantizar orden de llegada
          }

          if (this.liveTouchActive && !this.liveTouchFallback) {
            const now = performance.now();
            if (now - this.liveTouchLastMove > 25) { // 25ms throttle ~ 40fps
              this.liveTouchLastMove = now;
              this._appendLog(`pointermove recibido a las ${Math.round(tMove)}, MOVE enviado a las ${Math.round(now)}`);
              this.commandRouter.touch(this.activeSerial, 2, point.x, point.y).catch(() => {});
              this._replicateControl('touch', { action: 2, x: point.x, y: point.y }, { silent: true }).catch(() => {});
            }
          }
        }
      }
    };
    this.pointerLeaveHandler = () => {
      const stateEl = this.overlay.querySelector('#flowTouchCoordinateState');
      if (stateEl) stateEl.textContent = 'Coordenadas listas';

      // Live Touch Mode - Emergency UP si salimos del canvas (proteccion dedo pegado)
      if (this.activeGesture && this.controlEnabled && LIVE_TOUCH_MODE) {
        if (this.liveTouchActive && !this.liveTouchFallback) {
            const point = this.activeGesture.lastPoint || this.activeGesture.startPoint;
            if (point) this.commandRouter.touch(this.activeSerial, 1, point.x, point.y).catch(() => {});
            if (point) this._replicateControl('touch', { action: 1, x: point.x, y: point.y }, { silent: true }).catch(() => {});
            this.liveTouchActive = false;
        }
        this.liveTouchPendingDown = false;
        this._cancelLongPressTimer();
      }
    };
    // pointerdown abre un gesto local (Fase 5). No envia comandos.
    this.pointerDownHandler = (event) => {
      this.focusKeyboardTargetActive = true;
      try { canvas.focus({ preventScroll: true }); } catch (_) { try { canvas.focus(); } catch { /* no-op */ } }
      const tDown = performance.now();
      this._appendLog(`pointerdown recibido a las ${Math.round(tDown)}`);

      const point = CoordinateMapper.fromPointerEvent(event, canvas, this._getFrameSize());
      if (!point) return;
      // Solo boton primario para evitar interferir con click derecho del menu nativo.
      if (event.button !== 0 && event.button !== undefined) return;
      this.activeGesture = {
        startPoint: point,
        lastPoint: point,
        startedAt: performance.now(),
        movedPx: 0,
        pointerId: event.pointerId,
        modifiers: { shift: !!event.shiftKey, ctrl: !!event.ctrlKey, meta: !!event.metaKey },
        // Si Ctrl ya esta presionado al hacer pointerdown, queremos que pointerup
        // siempre emita long press, sin importar si el usuario movio un poco el puntero.
        forceLongPress: !!(event.ctrlKey || event.metaKey),
        longPressFired: false,
      };

      const tAnim = performance.now();
      this._resetGestureTrail(point);
      if (FLOWTOUCH_GESTURE_VISUALS) {
          this._appendLog(`animacion azul creada en ${Math.round(performance.now() - tAnim)}ms`);
      }

      // Live Touch Mode - DOWN
      if (this.controlEnabled && LIVE_TOUCH_MODE) {
          this.liveTouchPendingDown = true;
          this.liveTouchActive = false;
          this.liveTouchFallback = false;
      }

      try { canvas.setPointerCapture?.(event.pointerId); } catch { /* no-op */ }
      // Programar long press automatico cuando el puntero queda quieto.
      this._cancelLongPressTimer();
      const gestureRef = this.activeGesture;
      this.activeLongPressTimer = setTimeout(() => {
        const g = this.activeGesture;
        if (!g || g !== gestureRef) return;
        if (g.movedPx > this.gestureTapThresholdPx) return;
        
        // Live Touch Mode - Evitar inyeccion de swipe sintetico para long press
        if (this.controlEnabled && LIVE_TOUCH_MODE && this.liveTouchPendingDown) {
           this.liveTouchPendingDown = false;
           this.liveTouchActive = true;
           this.liveTouchFallback = false;
           const t0 = performance.now();
           this._appendLog(`[LIVE] DOWN (Long Press > 500ms) a las ${Math.round(t0)}`);
           this.commandRouter.touch(this.activeSerial, 0, g.startPoint.x, g.startPoint.y).then((res) => {
              if (res && res.response && res.response.liveTouch === false) {
                  this.liveTouchFallback = true;
              }
           }).catch(() => { this.liveTouchFallback = true; });
           this._replicateControl('touch', { action: 0, x: g.startPoint.x, y: g.startPoint.y }, { silent: true }).catch(() => {});
           g.longPressFired = true;
           this._appendLog(`LONG_PRESS_DRAG_MODE activado`);
           return;
        }

        // Marcar para que pointerup no emita un tap adicional.
        g.longPressFired = true;
        this._handleLongPressGesture(g.lastPoint || g.startPoint);
      }, this.longPressDelayMs);
    };
    // pointerup cierra el gesto y decide tap, swipe, doble tap o long press.
    this.pointerUpHandler = (event) => {
      const tUp = performance.now();
      this._appendLog(`pointerup recibido a las ${Math.round(tUp)}`);

      const gesture = this.activeGesture;
      this.activeGesture = null;
      this._cancelLongPressTimer();
      try { canvas.releasePointerCapture?.(event.pointerId); } catch { /* no-op */ }
      if (!gesture) return;
      const endPoint = CoordinateMapper.fromPointerEvent(event, canvas, this._getFrameSize()) || gesture.lastPoint;
      if (!endPoint) {
        const tAnim = performance.now();
        this._clearGestureTrail();
        if (FLOWTOUCH_GESTURE_VISUALS) this._appendLog(`animacion azul terminada en ${Math.round(performance.now() - tAnim)}ms`);
        return;
      }

      // Live Touch Mode - UP
      if (this.controlEnabled && LIVE_TOUCH_MODE) {
          if (this.liveTouchPendingDown) {
             // Es un Tap corto! No enviamos DOWN y lo dejamos caer al flujo original.
             this.liveTouchPendingDown = false;
             const duration = performance.now() - gesture.startedAt;
             this._appendLog(`[LIVE] Tap Corto detectado (${Math.round(duration)}ms)`);
             // Sigue la ejecucion hacia abajo donde se llamara a _handleTapGesture
          } else if (this.liveTouchActive && !this.liveTouchFallback) {
              const t0 = performance.now();
              this._appendLog(`UP enviado a las ${Math.round(t0)}`);
              this.commandRouter.touch(this.activeSerial, 1, endPoint.x, endPoint.y).then(() => {
                  const dt = performance.now() - t0;
                  this._appendLog(`[LIVE] UP response en ${Math.round(dt)}ms`);
              }).catch(() => {});
              this._replicateControl('touch', { action: 1, x: endPoint.x, y: endPoint.y }, { silent: true }).catch(() => {});
              this.liveTouchActive = false;
              
              const tAnim = performance.now();
              this._clearGestureTrail();
              if (FLOWTOUCH_GESTURE_VISUALS) this._appendLog(`animacion azul terminada en ${Math.round(performance.now() - tAnim)}ms`);
              // Skip legacy swipe/tap fallback because we already streamed live touch
              return;
          }
      }

      const movedPx = Math.max(
        gesture.movedPx,
        Math.hypot(
          endPoint.canvasX - gesture.startPoint.canvasX,
          endPoint.canvasY - gesture.startPoint.canvasY,
        ),
      );
      // Long press ya emitido por timer: no enviar tap adicional.
      if (gesture.longPressFired) {
        this._clearGestureTrail();
        return;
      }
      // Ctrl o meta forzan long press si el usuario solto rapido.
      if (gesture.forceLongPress && movedPx <= this.gestureTapThresholdPx) {
        this._clearGestureTrail();
        this._handleLongPressGesture(endPoint);
        return;
      }
      if (movedPx <= this.gestureTapThresholdPx) {
        this._clearGestureTrail();
        // Doble tap: dos taps cercanos en menos de doubleTapWindowMs.
        const last = this.lastTapInfo;
        const now = performance.now();
        const isDouble = last
          && (now - last.t) <= this.doubleTapWindowMs
          && Math.hypot(endPoint.canvasX - last.x, endPoint.canvasY - last.y) <= this.doubleTapThresholdPx;
        if (isDouble) {
          this.lastTapInfo = null;
          this._handleDoubleTapGesture(endPoint);
        } else {
          this.lastTapInfo = { x: endPoint.canvasX, y: endPoint.canvasY, t: now };
          this._handleTapGesture(endPoint);
        }
      } else {
        // Shift+drag => swipe deliberadamente mas largo, mas humano.
        const naturalDuration = Math.max(120, Math.round(performance.now() - gesture.startedAt));
        const finalDuration = gesture.modifiers.shift
          ? Math.max(naturalDuration, this.shiftSlowDurationMs)
          : naturalDuration;
        this._handleSwipeGesture(gesture.startPoint, endPoint, finalDuration);
      }
    };
    this.pointerCancelHandler = (event) => {
      // Live Touch Mode - Emergency UP
      if (this.activeGesture && this.controlEnabled && LIVE_TOUCH_MODE && this.liveTouchActive && !this.liveTouchFallback) {
        const point = this.activeGesture.lastPoint || this.activeGesture.startPoint;
        if (point) this.commandRouter.touch(this.activeSerial, 1, point.x, point.y).catch(() => {});
        if (point) this._replicateControl('touch', { action: 1, x: point.x, y: point.y }, { silent: true }).catch(() => {});
        this.liveTouchActive = false;
      }
      this.activeGesture = null;
      this._cancelLongPressTimer();
      try { canvas.releasePointerCapture?.(event.pointerId); } catch { /* no-op */ }
      this._clearGestureTrail();
    };
    // Fase 6: rueda del mouse como scroll vertical en Android.
    // pointermove no emite nada; el wheel acumula delta y emite swipes vertical
    // cuando hay control armado. Sin control, solo registra en historial.
    this.wheelHandler = (event) => {
      // Evita el scroll del overlay/quickbar y deja el gesto solo dentro del canvas.
      event.preventDefault();
      const point = CoordinateMapper.fromPointerEvent(event, canvas, this._getFrameSize());
      if (!point) return;
      const deltaY = Number.isFinite(event.deltaY) ? event.deltaY : 0;
      this.wheelAccumDeltaY += deltaY;
      // Empacar deltas para no spamear FlowAgent.
      const now = performance.now();
      if (now - this.wheelLastSentAt < this.wheelEmitMinIntervalMs) return;
      const accum = this.wheelAccumDeltaY;
      if (Math.abs(accum) < 32) return;
      this.wheelAccumDeltaY = 0;
      this.wheelLastSentAt = now;
      this._handleWheelGesture(point, accum);
    };

    canvas.tabIndex = 0;
    canvas.addEventListener('pointermove', this.pointerMoveHandler);
    canvas.addEventListener('pointerleave', this.pointerLeaveHandler);
    canvas.addEventListener('pointerdown', this.pointerDownHandler);
    canvas.addEventListener('pointerup', this.pointerUpHandler);
    canvas.addEventListener('pointercancel', this.pointerCancelHandler);
    canvas.addEventListener('wheel', this.wheelHandler, { passive: false });
  }

  _handleTapGesture(point) {
    this._updateCoordinateState(point, 'Tap mapeado');
    this._showLocalTapMarker(point);
    if (this.controlEnabled) {
      // Focus PRO Panel - Fase 1: ignora el primer tap que ocurre durante el
      // breve debounce despues del auto-arm (evita taps por el doble click de
      // apertura del Focus Mode).
      if (this._isWithinArmDebounce()) {
        this._appendLog(`Tap ignorado por debounce de apertura (${point.x},${point.y})`);
        return;
      }
      this._sendTap(point);
    } else {
      this._appendLog(`Mapa local ${point.x},${point.y} sin enviar tap`);
    }
  }

  _handleSwipeGesture(startPoint, endPoint, durationMs) {
    this._updateCoordinateState(endPoint, 'Swipe mapeado');
    if (this.controlEnabled) {
      this._sendSwipe(startPoint, endPoint, durationMs);
    } else {
      this._appendLog(
        `Swipe local ${startPoint.x},${startPoint.y} -> ${endPoint.x},${endPoint.y} (${durationMs}ms) sin enviar`
      );
      // Mantener el trail visible un instante extra cuando no se envia comando
      setTimeout(() => this._clearGestureTrail(), 320);
    }
  }

  _handleDoubleTapGesture(point) {
    this._updateCoordinateState(point, 'Doble tap');
    this._showLocalTapMarker(point);
    this._showLocalTapMarker(point); // doble pulso visual
    if (this.controlEnabled) {
      this._sendDoubleTap(point);
    } else {
      this._appendLog(`Mapa local doble tap ${point.x},${point.y} sin enviar`);
    }
  }

  _handleLongPressGesture(point) {
    this._updateCoordinateState(point, 'Long press');
    this._showLocalTapMarker(point);
    this._clearGestureTrail();
    if (this.controlEnabled) {
      this._sendLongPress(point);
    } else {
      this._appendLog(`Mapa local long press ${point.x},${point.y} sin enviar`);
    }
  }

  _handleWheelGesture(point, accumDelta) {
    if (!point) return;
    const frameH = point.frameHeight || 1920;
    // Convertimos el delta del wheel a un swipe vertical centrado en el punto.
    // Direccion: scroll hacia abajo del mouse (deltaY > 0) => contenido sube,
    // por lo que en Android hacemos swipe de abajo hacia arriba.
    const magnitude = Math.min(Math.abs(accumDelta) * this.wheelStepFactor, frameH * 0.45);
    if (magnitude < 24) return;
    const startY = Math.round(point.y + (accumDelta > 0 ? magnitude / 2 : -magnitude / 2));
    const endY   = Math.round(point.y + (accumDelta > 0 ? -magnitude / 2 : magnitude / 2));
    const startPoint = { ...point, y: Math.max(0, Math.min(frameH - 1, startY)) };
    const endPoint   = { ...point, y: Math.max(0, Math.min(frameH - 1, endY)) };
    if (this.controlEnabled) {
      this._sendSwipe(startPoint, endPoint, 220);
    } else {
      this._appendLog(`Wheel local ${accumDelta > 0 ? 'down' : 'up'} sin enviar`);
    }
  }

  _cancelLongPressTimer() {
    if (this.activeLongPressTimer) {
      clearTimeout(this.activeLongPressTimer);
      this.activeLongPressTimer = null;
    }
  }

  _resetGestureTrail(point) {
    if (!FLOWTOUCH_GESTURE_VISUALS) return;
    const layer = this.overlay.querySelector('#flowTouchGestureLayer');
    if (!layer || !point || !point.canvasWidth || !point.canvasHeight) return;
    this._clearGestureTrail();
    const trail = document.createElement('div');
    trail.className = 'flowtouch-gesture-trail';
    layer.appendChild(trail);
    this.gestureTrailEl = trail;
  }

  _updateGestureTrail() {
    if (!FLOWTOUCH_GESTURE_VISUALS) return;
    const trail = this.gestureTrailEl;
    const gesture = this.activeGesture;
    if (!trail || !gesture) return;
    const start = gesture.startPoint;
    const end = gesture.lastPoint;
    const widthRef = start.canvasWidth || 1;
    const heightRef = start.canvasHeight || 1;
    const ax = (start.canvasX / widthRef) * 100;
    const ay = (start.canvasY / heightRef) * 100;
    const bx = (end.canvasX / widthRef) * 100;
    const by = (end.canvasY / heightRef) * 100;
    // Linea desde A hasta B usando un pseudo-elemento simple via background
    trail.style.setProperty('--ax', `${ax}%`);
    trail.style.setProperty('--ay', `${ay}%`);
    trail.style.setProperty('--bx', `${bx}%`);
    trail.style.setProperty('--by', `${by}%`);
    // Calculamos posicion central, longitud y rotacion para evitar SVG.
    const dxPct = bx - ax;
    const dyPct = by - ay;
    const lengthPct = Math.hypot(dxPct, dyPct);
    const angleDeg = Math.atan2(dyPct, dxPct) * (180 / Math.PI);
    trail.style.left = `${ax}%`;
    trail.style.top = `${ay}%`;
    trail.style.width = `${lengthPct}%`;
    trail.style.transform = `rotate(${angleDeg}deg)`;
  }

  _clearGestureTrail() {
    if (!FLOWTOUCH_GESTURE_VISUALS) return;
    if (this.gestureTrailEl) {
      this.gestureTrailEl.remove();
      this.gestureTrailEl = null;
    }
  }

  _unbindCoordinatePreview() {
    const canvas = this.focusCanvas;
    if (!canvas) return;
    if (this.pointerMoveHandler) {
      canvas.removeEventListener('pointermove', this.pointerMoveHandler);
      this.pointerMoveHandler = null;
    }
    if (this.pointerLeaveHandler) {
      canvas.removeEventListener('pointerleave', this.pointerLeaveHandler);
      this.pointerLeaveHandler = null;
    }
    if (this.pointerDownHandler) {
      canvas.removeEventListener('pointerdown', this.pointerDownHandler);
      this.pointerDownHandler = null;
    }
    if (this.pointerUpHandler) {
      canvas.removeEventListener('pointerup', this.pointerUpHandler);
      this.pointerUpHandler = null;
    }
    if (this.pointerCancelHandler) {
      canvas.removeEventListener('pointercancel', this.pointerCancelHandler);
      this.pointerCancelHandler = null;
    }
    if (this.wheelHandler) {
      canvas.removeEventListener('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
    this._cancelLongPressTimer();
    this.activeGesture = null;
    this.lastTapInfo = null;
    this.wheelAccumDeltaY = 0;
    this.wheelLastSentAt = 0;
    this._clearGestureTrail();
  }

  _updateCoordinateState(point, prefix = 'Coord') {
    const stateEl = this.overlay.querySelector('#flowTouchCoordinateState');
    if (!stateEl || !point) return;
    stateEl.textContent = `${prefix}: ${point.x}, ${point.y}`;
  }

  _showLocalTapMarker(point) {
    if (!FLOWTOUCH_GESTURE_VISUALS) return;
    const layer = this.overlay.querySelector('#flowTouchGestureLayer');
    const canvas = this.focusCanvas;
    if (!layer || !canvas) return;
    // Para el marker visual usamos coordenadas dentro del canvas (no del frame real)
    const markerX = typeof point.canvasX === 'number' ? point.canvasX : point.x;
    const markerY = typeof point.canvasY === 'number' ? point.canvasY : point.y;
    const widthRef = point.canvasWidth || canvas.width;
    const heightRef = point.canvasHeight || canvas.height;
    if (!widthRef || !heightRef) return;
    const marker = document.createElement('i');
    marker.className = 'flowtouch-local-marker';
    marker.style.left = `${(markerX / widthRef) * 100}%`;
    marker.style.top = `${(markerY / heightRef) * 100}%`;
    layer.appendChild(marker);
    setTimeout(() => marker.remove(), 650);
  }

  _appendLog(message) {
    if (!this.overlay) return;
    const list = this.overlay.querySelector('#flowTouchLogList');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'flowtouch-log-row animate-log-entry';
    
    let category = 'info';
    let badgeText = 'INFO';
    const msgLower = message.toLowerCase();
    
    if (msgLower.includes('tap') || msgLower.includes('click') || msgLower.includes('presion') || msgLower.includes('tocando')) {
      category = 'tap';
      badgeText = 'TAP';
    } else if (msgLower.includes('swipe') || msgLower.includes('drag') || msgLower.includes('deslizar') || msgLower.includes('movimiento')) {
      category = 'swipe';
      badgeText = 'SWIPE';
    } else if (msgLower.includes('keyboard') || msgLower.includes('key') || msgLower.includes('escribir') || msgLower.includes('type')) {
      category = 'keyboard';
      badgeText = 'KEY';
    } else if (msgLower.includes('error') || msgLower.includes('404') || msgLower.includes('fallo') || msgLower.includes('fail')) {
      category = 'error';
      badgeText = 'ERR';
    }
    
    row.innerHTML = `<span class="flowtouch-log-badge log-badge-${category}">${badgeText}</span> <span class="flowtouch-log-text">${this._escape(message)}</span>`;
    
    list.prepend(row);
    while (list.children.length > 12) {
      list.lastElementChild.remove();
    }
  }

  _syncRecordingUi(serial = this.activeSerial) {
    if (!this.overlay) return;
    const btn = this.overlay.querySelector('#flowTouchRecordBtn');
    const lbl = this.overlay.querySelector('#flowTouchRecordLabel');
    const statusContainer = this.overlay.querySelector('#flowTouchRecordStatus');
    const msgEl = this.overlay.querySelector('#flowTouchRecordMessage');
    const actionsEl = this.overlay.querySelector('#flowTouchRecordActions');
    
    if (!btn || !statusContainer) return;
    
    const state = serial ? this.recordingState[serial] : null;
    const running = !!state?.running;
    
    btn.classList.toggle('is-recording', running);
    btn.disabled = this.recordingBusy;
    btn.title = running ? 'Detener grabacion manual' : 'Iniciar grabacion manual';
    if(lbl) lbl.textContent = running ? 'Detener' : 'Grabar';
    btn.innerHTML = running
      ? '<svg viewBox="0 0 24 24" style="fill:none;stroke:currentColor;stroke-width:2;"><rect x="8" y="8" width="8" height="8" rx="1"/></svg><span>Detener</span>'
      : '<svg viewBox="0 0 24 24" style="fill:none;stroke:currentColor;stroke-width:2;"><circle cx="12" cy="12" r="6"/></svg><span>Grabar</span>';
      
    if (this.recordingBusy) {
       statusContainer.style.display = 'block';
       msgEl.textContent = running ? 'Finalizando MP4...' : 'Iniciando grabacion...';
       actionsEl.style.display = 'none';
       msgEl.style.color = '#a1a1aa';
    } else if (running) {
       statusContainer.style.display = 'block';
       msgEl.style.color = '#ef4444'; // red when recording
       if (!this._recordingInterval) {
         this._recordingInterval = setInterval(() => this._syncRecordingUi(serial), 1000);
       }
       const elapsedSecs = Math.floor((Date.now() - (state.startedAt || Date.now())) / 1000);
       const mm = String(Math.floor(elapsedSecs / 60)).padStart(2, '0');
       const ss = String(elapsedSecs % 60).padStart(2, '0');
       msgEl.textContent = 'Grabando... ' + mm + ':' + ss;
       actionsEl.style.display = 'none';
    } else if (state && state.stopped) {
       if (this._recordingInterval) {
         clearInterval(this._recordingInterval);
         this._recordingInterval = null;
       }
       statusContainer.style.display = 'block';
       msgEl.textContent = state.message || (state.valid ? 'Grabacion guardada.' : 'Posible MP4 corrupto.');
       msgEl.style.color = state.valid ? '#10b981' : '#f59e0b';
       actionsEl.style.display = 'flex';
       
       const openFileBtn = this.overlay.querySelector('#flowTouchRecordOpenFile');
       const openFolderBtn = this.overlay.querySelector('#flowTouchRecordOpenFolder');
       if (openFileBtn && openFolderBtn) {
         // Limpiar listeners antiguos clonando nodos
         const cloneFile = openFileBtn.cloneNode(true);
         const cloneFolder = openFolderBtn.cloneNode(true);
         openFileBtn.replaceWith(cloneFile);
         openFolderBtn.replaceWith(cloneFolder);
         
         if (state.path && window.electronAPI) {
            cloneFile.onclick = () => window.electronAPI.openPath(state.path);
            cloneFolder.onclick = () => window.electronAPI.showItemInFolder(state.path);
         }
       }
    } else {
       if (this._recordingInterval) {
         clearInterval(this._recordingInterval);
         this._recordingInterval = null;
       }
       statusContainer.style.display = 'none';
    }
  }

  async _recordingRequest(path, payload) {
    const apiBase = this.commandRouter?.getApiBase?.()
      || (typeof PYTHON_API !== 'undefined' ? PYTHON_API : 'http://localhost:8765');
    const response = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Grabacion rechazada (${response.status})`);
    }
    return data;
  }

  async _refreshRecordingState(serial = this.activeSerial) {
    serial = String(serial || '').trim();
    if (!serial) return null;
    try {
      const data = await this._recordingRequest('/recordings/status', { serial });
      this.recordingState[serial] = data.recording || { serial, running: false };
      this._syncRecordingUi(serial);
      return this.recordingState[serial];
    } catch (error) {
      this.recordingState[serial] = { serial, running: false };
      this._syncRecordingUi(serial);
      return null;
    }
  }

  async _toggleRecording() {
    const serial = String(this.activeSerial || '').trim();
    if (!serial || this.recordingBusy) return;
    const current = this.recordingState[serial];
    const path = current?.running ? '/recordings/stop' : '/recordings/start';
    this.recordingBusy = true;
    this._syncRecordingUi(serial);
    try {
      const data = await this._recordingRequest(path, { serial, maxSize: 1080, maxFps: 30, bitRate: '4M' });
      const recording = data.recording || { serial, running: false };
      this.recordingState[serial] = recording;
      if (path.endsWith('/start')) {
        this._appendLog(`Grabacion iniciada: ${recording.fileName || recording.path || serial}`);
      } else {
        const size = Number(recording.size || 0);
        const sizeMb = size ? ` (${(size / 1024 / 1024).toFixed(1)} MB)` : '';
        this._appendLog(`Grabacion detenida: ${recording.fileName || recording.path || serial}${sizeMb}`);
      }
    } catch (error) {
      this._appendLog(error.message || 'No se pudo alternar grabacion');
    } finally {
      this.recordingBusy = false;
      this._syncRecordingUi(serial);
    }
  }

  _refreshFrameState(serial) {
    const stateEl = this.overlay.querySelector('#flowTouchFrameState');
    if (!stateEl) return;
    // Fase 9: si la tarjeta padre / canvas del overlay fue removido por algun
    // rerender externo, cerrar Focus Mode limpiamente.
    if (this.focusCanvas && !this.focusCanvas.isConnected) {
      this._appendLog('Canvas perdido, cerrando Focus Mode');
      this.closeFocus();
      return;
    }

    // @Modified Etapa C v2 (2026-05-28): preferir stats del H.264 (scrcpy raw)
    // sobre WebP cuando el renderer H.264 tenga sesion viva.
    let stats = null;
    let source = '';
    const h264 = this.app.h264Renderer;
    if (h264 && typeof h264.getStats === 'function') {
      const focusKey = this._focusSerialKey || (this._currentFocusPreset ? `${serial}|${this._currentFocusPreset}` : '');
      const h264Stats = focusKey ? h264.getStats(focusKey) : null;
      // Comprobar si el stream ha avanzado desde que se abrio el loader
        const hasH264ValidFrame = h264Stats && Number(h264Stats.framesDecoded || 0) > 0 && Number(h264Stats.width || 0) > 0 && Number(h264Stats.height || 0) > 0;
        const isStreamAdvancing = hasH264ValidFrame && h264Stats.lastFrameAt > (this._lastKnownFrameAt || 0);

        if (hasH264ValidFrame) {
          if (isStreamAdvancing) {
            this._lastKnownFrameAt = h264Stats.lastFrameAt;
          }

          // HOTFIX UI-FOCUS-02A: Ocultar loader al recibir frames reales
          const loader = this.overlay.querySelector('#flowTouchStreamLoader');
          if (loader && loader.style.display !== 'none') {
            loader.style.opacity = '0';
            loader.style.display = 'none';
          }

          // Sintetizar shape compatible con getFrameStats del WebP.
          const lastFrameAt = h264Stats.lastFrameAt || performance.now();
          const ageMs = Math.max(0, performance.now() - lastFrameAt);
          const fps = h264Stats.fps || 0;
          
          stats = {
            count: h264Stats.framesDecoded,
            framesDecoded: h264Stats.framesDecoded,
            width: h264Stats.width,
            height: h264Stats.height,
            fps,
            ageMs,
          };
        source = 'h264';
      }
    }
    if (!stats) {
      const webpStats = this.app?.streamRenderer?.getFrameStats
        ? this.app.streamRenderer.getFrameStats(serial)
        : null;
      if (webpStats && webpStats.count) {
        stats = webpStats;
        source = 'webp';
      }
    }

    if (!stats || !stats.count) {
      stateEl.textContent = 'Sin frame aun';
      stateEl.title = 'No hay frames del telefono. El stream H.264 puede tardar unos segundos en arrancar tras conectar.';
      stateEl.className = 'flowtouch-status-pill is-warn';
      if (this._fpInspectorBusy) return;
      // Tolerancia: contar strikes consecutivos antes de desarmar.
      if (this.controlEnabled) {
        this.disarmStrikes.frame += 1;
        if (this.disarmStrikes.frame >= this.disarmFrameThreshold) {
          this._autoDisarm('Control desactivado: sin captura del telefono');
          this.disarmStrikes.frame = 0;
        }
      }
      return;
    }
    // Hubo frame -> resetear strikes
    this.disarmStrikes.frame = 0;
    const age = typeof stats.ageMs === 'number' ? `${Math.round(stats.ageMs / 100) / 10}s` : '--';
    stateEl.textContent = `${Math.max(0, stats.fps || 0).toFixed(1)} FPS · ${age}`;
    stateEl.title = '';
    const fresh = stats.ageMs !== null && stats.ageMs < 2500;
    stateEl.className = fresh
      ? 'flowtouch-status-pill is-ready'
      : 'flowtouch-status-pill is-warn';
    // Si los frames quedan detenidos por mas de 8s con control armado,
    // tambien usamos strikes para no desarmar por un hipo de 1 lectura.
    const decodedCount = Number(stats?.framesDecoded ?? stats?.count ?? 0);

      const hasValidFrame =
        decodedCount > 0 &&
        Number(stats?.width || 0) > 0 &&
        Number(stats?.height || 0) > 0;

      const isActuallyFrameDead =
        !hasValidFrame &&
        stats.ageMs !== null &&
        stats.ageMs > 8000;

      if (this.controlEnabled && !this._fpInspectorBusy && isActuallyFrameDead) {
        this.disarmStrikes.frame += 1;
        if (this.disarmStrikes.frame >= this.disarmFrameThreshold) {
          this._autoDisarm('Control desactivado: no hay frame valido');
          this.disarmStrikes.frame = 0;
        }
      } else {
        this.disarmStrikes.frame = 0;
      }
  }

  async _toggleControl(forceOn = null) {
    const want = forceOn === null ? !this.controlEnabled : !!forceOn;
    if (!want) {
      this.disableControl();
      this._appendLog('Control tactil Off');
      return;
    }
    try {
      this._setModeState('Control listo', 'is-ready');
      this.armDebounceUntil = performance.now() + 350;
      this.enableControl(this.activeSerial);
      this._appendLog('Control tactil On: scrcpy primero, ADB fallback');
    } catch (error) {
      this.disableControl();
      this._setModeState('Control no disponible', 'is-error');
      this._appendLog(error.message || 'No se pudo activar control');
    }
  }

  /**
   * Focus PRO Panel - Fase 1: arma el control de manera segura al abrir el
   * Focus Mode sin preparar FlowAgent. El control manual intenta scrcpy nativo
   * primero y conserva ADB input como fallback.
   */
  async _autoArmControlSafely(serial) {
    this.armDebounceUntil = performance.now() + 350;
    this.enableControl(serial);
    this._appendLog('Control armado: scrcpy primero, ADB fallback');
    return true;
  }

  _isWithinArmDebounce() {
    return performance.now() < (this.armDebounceUntil || 0);
  }

  _isEditableTarget(target) {
    const el = target instanceof Element ? target : null;
    if (!el) return false;
    return !!el.closest('input, textarea, select, [contenteditable="true"], [data-flowtouch-ui="true"], .fp-window, .account-editor-modal, .device-context-menu, .popover, .device-name-popover, .device-name-popover-input');
  }

  _isFocusCanvasKeyboardTarget(event) {
    if (!this.overlay || !this.focusCanvas || !this.controlEnabled || !this.activeSerial) return false;
    if (this._isEditableTarget(event.target) || this._isEditableTarget(document.activeElement)) return false;
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    if (path.some(node => this._isEditableTarget(node))) return false;
    if (this._focusWindowDragging || this._focusWindowResizing) return false;
    return document.activeElement === this.focusCanvas;
  }

  async _readClipboardTextSafe() {
    try {
      if (navigator.clipboard?.readText) {
        return await navigator.clipboard.readText();
      }
    } catch (_) {
      return '';
    }
    return '';
  }

  async _handleFocusPhysicalKeyboard(event) {
    if (!this._isFocusCanvasKeyboardTarget(event)) return;
    if (event.defaultPrevented) return;

    const key = event.key || '';
    if ((event.ctrlKey || event.metaKey) && !event.altKey && key.toLowerCase() === 'v') {
      event.preventDefault();
      const text = await this._readClipboardTextSafe();
      if (!text) {
        this._appendLog('Clipboard vacio o sin permiso');
        return;
      }
      try {
        await this.commandRouter.pasteText(this.activeSerial, text);
        this._appendLog(`Paste enviado: ${text.length} caracteres`);
        this._replicateControl('pasteText', { text }, { label: 'Paste' }).catch(() => {});
      } catch (error) {
        this._appendLog(`Paste fallo: ${error.message || error}`);
      }
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const keyMap = {
      Enter: 'enter',
      Backspace: 'backspace',
      Tab: 'tab',
      ArrowUp: 'arrowup',
      ArrowDown: 'arrowdown',
      ArrowLeft: 'arrowleft',
      ArrowRight: 'arrowright',
      Escape: 'back',
    };
    const mapped = keyMap[key];
    if (mapped) {
      event.preventDefault();
      try {
        await this.commandRouter.keyevent(this.activeSerial, mapped);
        this._appendLog(`Tecla ${key} enviada`);
        this._replicateControl('nav', { name: mapped }, { label: `Tecla ${key}` }).catch(() => {});
      } catch (error) {
        this._appendLog(`Tecla ${key} fallo: ${error.message || error}`);
      }
      return;
    }

    if (key.length === 1) {
      event.preventDefault();
      try {
        await this.commandRouter.typeText(this.activeSerial, key);
        this._replicateControl('typeText', { text: key }, { label: 'Texto', silent: true }).catch(() => {});
      } catch (error) {
        this._appendLog(`Texto fallo: ${error.message || error}`);
      }
    }
  }

  _getReplicaSerials() {
    if (!this.replicateSelected || !this.app?.selectedDeviceIds || !this.activeSerial) return [];
    const selected = Array.from(this.app.selectedDeviceIds);
    const devicesBySerial = new Map((this.app.devices || []).map(device => [device.serial, device]));
    return selected.filter(serial => {
      if (!serial || serial === this.activeSerial) return false;
      const device = devicesBySerial.get(serial);
      if (!device) return false;
      return !(device.offline || device.disconnected || device.adbState === 'offline' || device.state === 'offline');
    });
  }

  _syncReplicateUi() {
    const btn = this.overlay?.querySelector('#flowTouchReplicateBtn');
    if (!btn) return;
    const count = this._getReplicaSerials().length;
    btn.classList.toggle('is-active', !!this.replicateSelected);
    btn.setAttribute('aria-pressed', this.replicateSelected ? 'true' : 'false');
    btn.title = this.replicateSelected
      ? `Replicando a ${count} dispositivo(s) seleccionado(s)`
      : 'Replicar acciones al Grid seleccionado';
  }

  _toggleReplicateSelected() {
    this.replicateSelected = !this.replicateSelected;
    localStorage.setItem('flowdashboard.focus.replicateSelected', this.replicateSelected ? 'true' : 'false');
    this._syncReplicateUi();
    const count = this._getReplicaSerials().length;
    this._appendLog(this.replicateSelected ? `Replicar ON (${count} replicas)` : 'Replicar OFF');
  }

  _getBulkActionSerials() {
    if (!this.activeSerial) return [];
    const serials = [this.activeSerial, ...this._getReplicaSerials()];
    return Array.from(new Set(serials.filter(Boolean)));
  }

  _bulkTargetsSummary(targets) {
    const suffix = targets.length === 1 ? 'dispositivo' : 'dispositivos';
    const preview = targets.slice(0, 5).map(serial => this._escape(serial)).join('<br>');
    const more = targets.length > 5 ? `<br>+${targets.length - 5} mas` : '';
    return `<p>Se ejecutara sobre <b>${targets.length}</b> ${suffix}:</p><p class="fp-confirm-targets">${preview}${more}</p>`;
  }

  async _confirmBulkAction(title, detailsHtml, targets, confirmText = 'Confirmar') {
    return this._confirmDangerDialog(
      title,
      `${detailsHtml}${this._bulkTargetsSummary(targets)}`,
      confirmText,
    );
  }

  async _runSerialBatch(targets, fn, concurrency = 2) {
    let ok = 0;
    const errors = [];
    let index = 0;
    const worker = async () => {
      while (index < targets.length) {
        const serial = targets[index++];
        try {
          await fn(serial);
          ok += 1;
        } catch (error) {
          errors.push({ serial, error });
        }
      }
    };
    const workers = Array.from({ length: Math.min(concurrency, targets.length) }, worker);
    await Promise.all(workers);
    return { ok, total: targets.length, errors };
  }

  async _runReplicaBatch(targets, fn) {
    let ok = 0;
    let index = 0;
    const worker = async () => {
      while (index < targets.length) {
        const serial = targets[index++];
        try {
          await fn(serial);
          ok += 1;
        } catch (_) {
          // Fallos aislados: el maestro no se bloquea por replicas.
        }
      }
    };
    const workers = Array.from({ length: Math.min(4, targets.length) }, worker);
    await Promise.all(workers);
    return { ok, total: targets.length };
  }

  async _replicateControl(kind, payload = {}, options = {}) {
    const targets = this._getReplicaSerials();
    this._syncReplicateUi();
    if (!targets.length) return { ok: 0, total: 0 };
    const result = await this._runReplicaBatch(targets, serial => {
      if (kind === 'tap') return this.commandRouter.tap(serial, payload.x, payload.y);
      if (kind === 'touch') return this.commandRouter.touch(serial, payload.action, payload.x, payload.y);
      if (kind === 'swipe') return this.commandRouter.swipe(serial, payload.startX, payload.startY, payload.endX, payload.endY, payload.duration);
      if (kind === 'doubleTap') return this.commandRouter.doubleTap(serial, payload.x, payload.y);
      if (kind === 'longPress') return this.commandRouter.longPress(serial, payload.x, payload.y, payload.duration);
      if (kind === 'nav') return this.commandRouter.keyevent(serial, payload.name);
      if (kind === 'typeText') return this.commandRouter.typeText(serial, payload.text);
      if (kind === 'pasteText') return this.commandRouter.pasteText(serial, payload.text);
      return Promise.resolve();
    });
    if (!options.silent) {
      this._appendLog(`${options.label || kind} replicas ${result.ok}/${result.total}`);
    }
    return result;
  }

  async _sendTap(point) {
    if (!this.activeSerial || !point) return;
    const now = Date.now();
    if (this.commandInFlight || now - this.lastCommandAt < 180) {
      return;
    }
    this.commandInFlight = true;
    this.lastCommandAt = now;
    this._setModeState('Enviando tap', 'is-warn');
    this._appendLog(`Tap ${point.x},${point.y} enviando`);
    try {
      const result = await this.commandRouter.tap(this.activeSerial, point.x, point.y);
      const channel = result?.response?.channel || result?.response?.method || 'control';
      this._setModeState('Control activo', 'is-ready');
      this._appendLog(`Tap ${point.x},${point.y} OK (${channel})`);
      this._replicateControl('tap', { x: point.x, y: point.y }, { label: 'Tap' }).catch(() => {});
    } catch (error) {
      this._setModeState('Error de tap', 'is-error');
      this._appendLog(error.message || 'No se pudo enviar tap');
      if (this._shouldAutoDisarmFromError(error)) {
        this._autoDisarm('Control desactivado por error de entrada manual');
      }
    } finally {
      this.commandInFlight = false;
    }
  }

  async _sendSwipe(startPoint, endPoint, durationMs) {
    if (!this.activeSerial || !startPoint || !endPoint) return;
    const now = Date.now();
    if (this.commandInFlight || now - this.lastCommandAt < 180) {
      this._appendLog('Swipe omitido por debounce');
      this._clearGestureTrail();
      return;
    }
    this.commandInFlight = true;
    this.lastCommandAt = now;
    this._setModeState('Enviando swipe', 'is-warn');
    this._appendLog(`Swipe ${startPoint.x},${startPoint.y} -> ${endPoint.x},${endPoint.y} (${durationMs}ms)`);
    try {
      const result = await this.commandRouter.swipe(
        this.activeSerial,
        startPoint.x,
        startPoint.y,
        endPoint.x,
        endPoint.y,
        durationMs,
      );
      const channel = result?.response?.channel || result?.response?.method || 'control';
      this._setModeState('Control activo', 'is-ready');
      this._appendLog(`Swipe ${startPoint.x},${startPoint.y} -> ${endPoint.x},${endPoint.y} OK (${channel})`);
      this._replicateControl('swipe', {
        startX: startPoint.x,
        startY: startPoint.y,
        endX: endPoint.x,
        endY: endPoint.y,
        duration: durationMs,
      }, { label: 'Swipe' }).catch(() => {});
    } catch (error) {
      this._setModeState('Error de swipe', 'is-error');
      this._appendLog(error.message || 'No se pudo enviar swipe');
      if (this._shouldAutoDisarmFromError(error)) {
        this._autoDisarm('Control desactivado por error de entrada manual');
      }
    } finally {
      this.commandInFlight = false;
      // Mantener el trail un instante para feedback y luego limpiar
      setTimeout(() => this._clearGestureTrail(), 320);
    }
  }

  async _sendDoubleTap(point) {
    if (!this.activeSerial || !point) return;
    const now = Date.now();
    if (this.commandInFlight || now - this.lastCommandAt < 220) {
      this._appendLog('Doble tap omitido por debounce');
      return;
    }
    this.commandInFlight = true;
    this.lastCommandAt = now;
    this._setModeState('Enviando doble tap', 'is-warn');
    this._appendLog(`Doble tap ${point.x},${point.y} enviando`);
    try {
      const result = await this.commandRouter.doubleTap(this.activeSerial, point.x, point.y);
      const firstChannel = result?.response?.first?.channel || result?.response?.first?.method || 'control';
      const secondChannel = result?.response?.second?.channel || result?.response?.second?.method || firstChannel;
      this._setModeState('Control activo', 'is-ready');
      this._appendLog(`Doble tap ${point.x},${point.y} OK (${firstChannel}/${secondChannel})`);
      this._replicateControl('doubleTap', { x: point.x, y: point.y }, { label: 'Doble tap' }).catch(() => {});
    } catch (error) {
      this._setModeState('Error de doble tap', 'is-error');
      this._appendLog(error.message || 'No se pudo enviar doble tap');
      if (this._shouldAutoDisarmFromError(error)) {
        this._autoDisarm('Control desactivado por error de entrada manual');
      }
    } finally {
      this.commandInFlight = false;
    }
  }

  async _sendLongPress(point) {
    if (!this.activeSerial || !point) return;
    const now = Date.now();
    if (this.commandInFlight || now - this.lastCommandAt < 220) {
      this._appendLog('Long press omitido por debounce');
      return;
    }
    this.commandInFlight = true;
    this.lastCommandAt = now;
    this._setModeState('Enviando long press', 'is-warn');
    this._appendLog(`Long press ${point.x},${point.y} enviando`);
    try {
      const result = await this.commandRouter.longPress(this.activeSerial, point.x, point.y, this.longPressDurationMs);
      const channel = result?.response?.channel || result?.response?.method || 'control';
      this._setModeState('Control activo', 'is-ready');
      this._appendLog(`Long press ${point.x},${point.y} OK (${channel})`);
      this._replicateControl('longPress', { x: point.x, y: point.y, duration: this.longPressDurationMs }, { label: 'Long press' }).catch(() => {});
    } catch (error) {
      this._setModeState('Error de long press', 'is-error');
      this._appendLog(error.message || 'No se pudo enviar long press');
      if (this._shouldAutoDisarmFromError(error)) {
        this._autoDisarm('Control desactivado por error de entrada manual');
      }
    } finally {
      this.commandInFlight = false;
    }
  }

  async _sendNavCommand(name) {
    if (!this.activeSerial) return;
    if (!this.controlEnabled) {
      this._appendLog(`${name} requiere control armado`);
      this._setModeState('Activa control para navegacion', 'is-warn');
      return;
    }
    const now = Date.now();
    if (this.commandInFlight || now - this.lastCommandAt < 200) {
      this._appendLog(`${name} omitido por debounce`);
      return;
    }
    this.commandInFlight = true;
    this.lastCommandAt = now;
    const label = name === 'back' ? 'Back' : name === 'home' ? 'Home' : 'Recents';
    this._setModeState(`Enviando ${label}`, 'is-warn');
    this._appendLog(`${label} enviando`);
    try {
      let result = null;
      if (name === 'back') result = await this.commandRouter.back(this.activeSerial);
      else if (name === 'home') result = await this.commandRouter.home(this.activeSerial);
      else if (name === 'recents') result = await this.commandRouter.recents(this.activeSerial);
      const channel = result?.response?.channel || result?.response?.method || 'control';
      this._setModeState('Control activo', 'is-ready');
      this._appendLog(`${label} OK (${channel})`);
      this._replicateControl('nav', { name }, { label }).catch(() => {});
    } catch (error) {
      this._setModeState(`Error de ${label}`, 'is-error');
      this._appendLog(error.message || `No se pudo enviar ${label}`);
      if (this._shouldAutoDisarmFromError(error)) {
        this._autoDisarm('Control desactivado por error de entrada manual');
      }
    } finally {
      this.commandInFlight = false;
    }
  }

  _syncControlUi() {
    // Compatibilidad con UI nueva (switch) y con cualquier llamada legacy.
    const switchEl = this.overlay.querySelector('#flowTouchControlSwitch');
    const labelEl  = this.overlay.querySelector('#flowTouchControlLabel');
    const statePill = this.overlay.querySelector('#flowTouchControlStatePill');
    if (switchEl) switchEl.checked = !!this.controlEnabled;
    if (labelEl) labelEl.textContent = this.controlEnabled ? 'Control ON' : 'Control OFF';
    if (statePill) {
      statePill.textContent = this.controlEnabled ? 'ON' : 'OFF';
      statePill.classList.toggle('is-on', !!this.controlEnabled);
    }
    // Sincroniza una clase en <body> para que CSS pueda mostrar cursor y
    // anillo distintos cuando hay control armado, sin tocar el resto de la UI.
    document.body.classList.toggle('flowtouch-control-on', !!this.controlEnabled);
    this._setModeState(this.controlEnabled ? 'Control activo' : 'Focus activo', this.controlEnabled ? 'is-ready' : 'is-ready');
  }

  _setModeState(text, stateClass = 'is-ready') {
    const stateEl = this.overlay.querySelector('#flowTouchModeState');
    if (!stateEl) return;
    stateEl.textContent = text;
    stateEl.className = `flowtouch-status-pill ${stateClass}`;
  }

  async _refreshAgentState(serial) {
    const stateEl = this.overlay.querySelector('#flowTouchAgentState');
    if (!stateEl) return;
    let agentOk = false;
    let accessibilityOk = false;
    let fetchFailed = false;
    try {
      const apiBase = typeof PYTHON_API !== 'undefined' ? PYTHON_API : 'http://localhost:8765';
      const response = await fetch(`${apiBase}/agents`, { cache: 'no-store' });
      const data = await response.json();
      const agents = Array.isArray(data.agents) ? data.agents : [];
      const agent = agents.find(item => item.serial === serial || item.agentId === serial);
      if (agent && !agent.accessibility) {
        try {
          const probe = await this.commandRouter.sendCommand(agent.agentId, { name: 'engine_probe' }, 10);
          const result = probe.result || probe;
          if (result && result.ok && result.serviceReady !== false) {
            agent.accessibility = true;
            this._lastAgentProbeOkAt = performance.now();
          }
        } catch (_) {}
      }
      if (agent && agent.accessibility) {
        agentOk = true;
        accessibilityOk = true;
        stateEl.textContent = 'FlowAgent listo';
        stateEl.className = 'flowtouch-status-pill is-ready';
      } else if (agent) {
        agentOk = true;
        stateEl.textContent = 'FlowAgent sin accesibilidad';
        stateEl.className = 'flowtouch-status-pill is-warn';
      } else {
        stateEl.textContent = 'FlowAgent no conectado';
        stateEl.className = 'flowtouch-status-pill is-error';
      }
    } catch {
      fetchFailed = true;
      stateEl.textContent = 'FlowAgent sin respuesta';
      stateEl.className = 'flowtouch-status-pill is-error';
    }
    // Perfil CONTROL: FlowAgent es diagnostico, no requisito para taps/swipes.
    // Automatizacion/FlowKeyboard/Inspector Accessibility siguen usando agente,
    // pero el control manual se mantiene por ADB input aunque el socket no este.
    if (fetchFailed || this._fpInspectorBusy) return;
    if (agentOk && accessibilityOk) {
      this.disarmStrikes.agent = 0;
      this._lastAgentProbeOkAt = performance.now();
      return;
    }
    this.disarmStrikes.agent = 0;
  }

  _openSibling(direction) {
    const devices = this.app.getVisibleOrderedDevices ? this.app.getVisibleOrderedDevices() : (this.app.devices || []);
    if (!devices.length || !this.activeSerial) return;
    const index = devices.findIndex(device => device.serial === this.activeSerial);
    if (index < 0) return;
    const nextIndex = (index + direction + devices.length) % devices.length;
    const nextSerial = devices[nextIndex].serial;
    if (nextSerial) this.openFocus(nextSerial);
  }

  /* ---------------- Focus PRO Panel - Apps (Fase 2/3, ventana flotante) ---------------- */

  _closeFocusFloatingPanels(exceptId = '') {
    if (!this.overlay) return;
    this.overlay.querySelectorAll('.fp-window').forEach(win => {
      if (exceptId && win.id === exceptId) return;
      win.remove();
    });
    const accountModal = document.getElementById('accountEditorModal');
    if (accountModal?.classList.contains('is-focus-floating')) {
      this.app?.closeDeviceAccountEditor?.();
    }
  }

  _refreshRuntimeState() {
    const btn = this.overlay?.querySelector('#flowTouchRuntimeStopBtn');
    const serial = this.activeSerial;
    if (!btn || !serial) return false;
    const now = Date.now();
    const suppressedUntil = this._runtimeStopSuppressedUntil?.get(serial) || 0;
    const isTemporarilySuppressed = suppressedUntil > now;
    const deviceRunning = !!this.app?.isDeviceRunning?.(serial);
    const flowRunning = !!this.app?.runningFlow;
    if (!isTemporarilySuppressed && suppressedUntil) {
      this._runtimeStopSuppressedUntil.delete(serial);
    }
    const running = deviceRunning || (flowRunning && !isTemporarilySuppressed);
    btn.classList.toggle('is-running', running);
    btn.hidden = !running;
    const runtimeName = this.app?.runningFlow || 'ejecucion activa';
    btn.title = running ? `Detener ${runtimeName}` : 'Sin ejecucion activa';
    btn.setAttribute('aria-label', running ? `Detener ${runtimeName}` : 'Sin ejecucion activa');
    return running;
  }

  _syncRuntimeStateNow() {
    if (!this.overlay) return false;
    return this._refreshRuntimeState();
  }

  async _stopActiveRuntime() {
    const serial = this.activeSerial;
    if (!serial) return;
    const btn = this.overlay?.querySelector('#flowTouchRuntimeStopBtn');
    btn?.classList.add('is-stopping');
    this._appendLog('Deteniendo ejecucion activa...');
    try {
      if (this.app?.autoJsStopForSerial) {
        await this.app.autoJsStopForSerial(serial);
      } else if (this.app?.contextStopLogin) {
        this.app.contextMenuDevices = [serial];
        await this.app.contextStopLogin();
      }
      await this.app?.loadLoginStatuses?.();
      await this.app?.loadDevices?.();
      this.app?.renderDevices?.();
      this._runtimeStopSuppressedUntil?.set(serial, Date.now() + 5000);
      this._refreshRuntimeState();
      this._appendLog('Ejecucion detenida.');
    } catch (error) {
      this._appendLog(`No se pudo detener: ${error.message || error}`);
    } finally {
      btn?.classList.remove('is-stopping');
    }
  }

  _bindProPanelApps() {
    const blockHeader = this.overlay.querySelector('#fpAppsBlockHeader');
    if (blockHeader) {
      blockHeader.addEventListener('click', () => this._openAppsWindow());
    }
    const launchers = this.overlay.querySelectorAll('[data-fp-launcher]') || [];
    launchers.forEach(header => {
      const blockId = header.dataset.fpLauncher;
      header.addEventListener('click', () => {
         if (blockId === 'apps') this._openAppsWindow();
         else this._openSectionWindow(blockId);
      });
    });
  }

  /**
   * Abre una ventana flotante para un bloque (archivos, adb, autojs, sistema, energia, flowkeyboard).
   * Reutiliza los mismos IDs internos del HTML original para que los _bind*Events existentes funcionen.
   */
  _openSectionWindow(blockId) {
    if (!this.overlay) return;
    const winId = `fpWindow_${blockId}`;
    this._closeFocusFloatingPanels(winId);
    let win = this.overlay.querySelector(`#${winId}`);
    if (win) {
      win.classList.remove('is-hidden');
      win.style.zIndex = '10030';
      this._normalizeFloatingWindowGeometry(win);
      return;
    }
    const cfg = FLOW_TOUCH_SECTION_WINDOWS[blockId];
    if (!cfg) return;
    win = document.createElement('div');
    win.id = winId;
    win.className = `fp-window fp-window-section fp-window-${blockId}`;
    const saved = this._loadSectionWindowGeometry(blockId, cfg.defaultSize);
    win.style.left = saved.left + 'px';
    win.style.top = saved.top + 'px';
    win.style.width = saved.width + 'px';
    win.style.height = saved.height + 'px';
    win.innerHTML = `
      <div class="fp-window-header" data-fp-window-drag>
        <span class="fp-window-title">${cfg.title}</span>
        <div class="fp-window-actions">
          <button class="fp-window-btn" data-fp-section-close title="Cerrar">
            <svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="fp-window-body">
        ${cfg.body}
      </div>
      <span class="fp-window-resize" data-fp-window-resize aria-hidden="true"></span>
    `;
    this.overlay.appendChild(win);
    this._normalizeFloatingWindowGeometry(win);
    win.querySelector('[data-fp-section-close]').addEventListener('click', () => {
      if (blockId === 'inspector') this._fpInspectorClearHighlight();
      win.remove();
    });
    this._enableWindowDragResize(win);
    win.addEventListener('mousedown', () => { win.style.zIndex = '10030'; });
    if (typeof cfg.onOpen === 'function') {
      try { cfg.onOpen.call(this); } catch (_) { /* no-op */ }
    }
  }

  _loadSectionWindowGeometry(blockId, defaultSize) {
    const fallback = {
      width: defaultSize.width || 320,
      height: defaultSize.height || 360,
      left: 80,
      top: 96,
    };
    try {
      const raw = localStorage.getItem(`flowdashboard.fpWindow.${blockId}`);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return { ...fallback, ...parsed };
    } catch {
      return fallback;
    }
  }

  _openAppsWindow() {
    // Si ya esta abierta, traerla al frente.
    this._closeFocusFloatingPanels('fpAppsWindow');
    let win = this.overlay.querySelector('#fpAppsWindow');
    if (win) {
      win.classList.remove('is-hidden');
      win.style.zIndex = '10030';
      this._normalizeFloatingWindowGeometry(win);
      return;
    }
    win = document.createElement('div');
    win.id = 'fpAppsWindow';
    win.className = 'fp-window fp-window-apps';
    // Posicion y tamaño persistidos en localStorage
    const saved = this._loadAppsWindowGeometry();
    win.style.left = saved.left + 'px';
    win.style.top = saved.top + 'px';
    win.style.width = saved.width + 'px';
    win.style.height = saved.height + 'px';
    win.innerHTML = `
      <div class="fp-window-header" data-fp-window-drag>
        <span class="fp-window-title">Aplicaciones</span>
        <div class="fp-window-actions">
          <button class="fp-window-btn" id="fpAppsWinClose" title="Cerrar">
            <svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="fp-window-body">
        <div class="fp-apps-toolbar">
          <input id="fpAppsSearch" class="fp-input" type="text" placeholder="Buscar paquete..." autocomplete="off"/>
          <label class="fp-checkbox" title="Mostrar tambien apps del sistema">
            <input id="fpAppsShowAll" type="checkbox"/>
            <span>Sistema</span>
          </label>
        </div>
        <div class="fp-apps-actions">
          <button class="fp-btn fp-btn-mini" id="fpAppsRefreshBtn">Refrescar</button>
          <label class="fp-btn fp-btn-mini fp-file-label">
            Instalar APK
            <input id="fpAppsInstallInput" type="file" accept=".apk" hidden/>
          </label>
        </div>
        <div class="fp-apps-list" id="fpAppsList">Pulsa Refrescar para listar apps</div>
      </div>
      <span class="fp-window-resize" data-fp-window-resize aria-hidden="true"></span>
    `;
    // Insertar en el overlay completo para que pueda moverse por todo el viewport.
    (this.overlay || document.body).appendChild(win);
    this._normalizeFloatingWindowGeometry(win);
    // Eventos internos
    win.querySelector('#fpAppsWinClose').addEventListener('click', () => this._closeAppsWindow());
    win.querySelector('#fpAppsRefreshBtn').addEventListener('click', () => this._proAppsRefresh());
    win.querySelector('#fpAppsSearch').addEventListener('input', () => this._proAppsRender());
    win.querySelector('#fpAppsShowAll').addEventListener('change', () => this._proAppsRefresh());
    win.querySelector('#fpAppsInstallInput').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this._proAppsInstallApk(file);
      e.target.value = '';
    });
    this._enableWindowDragResize(win);
    // Traer al frente al click
    win.addEventListener('mousedown', () => { win.style.zIndex = '10030'; });
    // Refrescar al abrir para evitar que el usuario tenga que pulsar Refrescar
    this._proAppsRefresh().catch(() => null);
  }

  _closeAppsWindow() {
    const win = this.overlay.querySelector('#fpAppsWindow');
    if (win) win.remove();
  }

  _loadAppsWindowGeometry() {
    const def = { left: 80, top: 80, width: 480, height: 460 };
    try {
      const raw = localStorage.getItem('flowdashboard.focusPanel.appsWindow');
      if (!raw) return def;
      const parsed = JSON.parse(raw);
      return {
        left:   Math.max(8, Math.min(parsed.left ?? def.left, window.innerWidth - 120)),
        top:    Math.max(8, Math.min(parsed.top ?? def.top, window.innerHeight - 120)),
        width:  Math.max(320, Math.min(parsed.width ?? def.width, window.innerWidth - 24)),
        height: Math.max(260, Math.min(parsed.height ?? def.height, window.innerHeight - 24)),
      };
    } catch { return def; }
  }

  _persistWindowGeometry(win) {
    try {
      const r = win.getBoundingClientRect();
      const geom = {
        left: Math.round(win.offsetLeft || 0), top: Math.round(win.offsetTop || 0),
        width: Math.round(r.width), height: Math.round(r.height),
      };
      if (win.id === 'fpAppsWindow') {
        localStorage.setItem('flowdashboard.focusPanel.appsWindow', JSON.stringify(geom));
      } else if (win.id.startsWith('fpWindow_')) {
        const blockId = win.id.replace('fpWindow_', '');
        localStorage.setItem(`flowdashboard.fpWindow.${blockId}`, JSON.stringify(geom));
      }
    } catch { /* no-op */ }
  }

  _normalizeFloatingWindowGeometry(win) {
    if (!win) return;
    try {
      const parent = win.offsetParent || win.parentElement || document.body;
      const parentW = parent.clientWidth || window.innerWidth || 800;
      const parentH = parent.clientHeight || window.innerHeight || 600;
      const maxW = Math.max(320, parentW - 24);
      const maxH = Math.max(220, parentH - 24);
      const width = Math.min(Math.max(win.offsetWidth || parseInt(win.style.width, 10) || 320, 320), maxW);
      const height = Math.min(Math.max(win.offsetHeight || parseInt(win.style.height, 10) || 260, 220), maxH);
      const leftRaw = parseInt(win.style.left, 10);
      const topRaw = parseInt(win.style.top, 10);
      const left = Number.isFinite(leftRaw) ? leftRaw : 80;
      const top = Number.isFinite(topRaw) ? topRaw : 96;
      const maxLeft = Math.max(0, parentW - width - 8);
      const maxTop = Math.max(0, parentH - height - 8);
      win.style.width = width + 'px';
      win.style.height = height + 'px';
      win.style.left = Math.max(0, Math.min(left, maxLeft)) + 'px';
      win.style.top = Math.max(0, Math.min(top, maxTop)) + 'px';
    } catch { /* no-op */ }
  }

  _enableWindowDragResize(win) {
    // Drag por header
    const dragHandle = win.querySelector('[data-fp-window-drag]');
    if (dragHandle) {
      let dragging = false; let startX = 0; let startY = 0; let startLeft = 0; let startTop = 0; let winWidth = 320; let winHeight = 260;
      const onDown = (e) => {
        // Solo boton primario, no sobre botones
        if (e.button !== 0) return;
        if (e.target.closest('button')) return;
        startX = e.clientX;
        startY = e.clientY;
        const rect = win.getBoundingClientRect();
        const left = Number.parseFloat(win.style.left);
        const top = Number.parseFloat(win.style.top);
        startLeft = Number.isFinite(left) ? left : rect.left;
        startTop = Number.isFinite(top) ? top : rect.top;
        winWidth = rect.width || win.offsetWidth || 320;
        winHeight = rect.height || win.offsetHeight || 260;
        dragging = true;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp, { once: true });
        e.preventDefault();
      };
      const onMove = (e) => {
        if (!dragging) return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        const viewportW = window.innerWidth || 1280;
        const viewportH = window.innerHeight || 800;
        const visibleX = Math.min(160, winWidth);
        const visibleY = Math.min(96, winHeight);
        const minLeft = Math.min(8, -(winWidth - visibleX));
        const minTop = Math.min(8, -(winHeight - visibleY));
        const maxLeft = Math.max(8, viewportW - visibleX);
        const maxTop = Math.max(8, viewportH - visibleY);
        const left = Math.max(minLeft, Math.min(startLeft + deltaX, maxLeft));
        const top  = Math.max(minTop, Math.min(startTop + deltaY, maxTop));
        win.style.left = left + 'px';
        win.style.top = top + 'px';
      };
      const onUp = () => {
        dragging = false;
        document.removeEventListener('mousemove', onMove);
        this._persistWindowGeometry(win);
      };
      dragHandle.addEventListener('mousedown', onDown);
    }
    // Resize por esquina inferior derecha
    const grip = win.querySelector('[data-fp-window-resize]');
    if (grip) {
      let resizing = false; let startX = 0; let startY = 0; let startW = 0; let startH = 0;
      const onDown = (e) => {
        if (e.button !== 0) return;
        const r = win.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY;
        startW = r.width; startH = r.height;
        resizing = true;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp, { once: true });
        e.preventDefault();
        e.stopPropagation();
      };
      const onMove = (e) => {
        if (!resizing) return;
        const w = Math.max(320, Math.min(startW + (e.clientX - startX), window.innerWidth - 24));
        const h = Math.max(260, Math.min(startH + (e.clientY - startY), window.innerHeight - 24));
        win.style.width = w + 'px';
        win.style.height = h + 'px';
      };
      const onUp = () => {
        resizing = false;
        document.removeEventListener('mousemove', onMove);
        this._persistWindowGeometry(win);
      };
      grip.addEventListener('mousedown', onDown);
    }
  }

  async _proAppsRefresh() {
    const list = this.overlay.querySelector('#fpAppsList');
    if (!list) return;
    const showAll = !!this.overlay.querySelector('#fpAppsShowAll').checked;
    list.textContent = 'Cargando...';
    try {
      const data = await this.app.appsList(this.activeSerial, { thirdPartyOnly: !showAll });
      this._proAppsCache = Array.isArray(data.items) ? data.items : [];
      this._proAppsRender();
    } catch (error) {
      list.textContent = `Error: ${error.message || error}`;
    }
  }

  _proAppsRender() {
    const list = this.overlay.querySelector('#fpAppsList');
    if (!list) return;
    const filter = (this.overlay.querySelector('#fpAppsSearch').value || '').toLowerCase().trim();
    const items = (this._proAppsCache || []).filter(it => !filter || it.packageName.toLowerCase().includes(filter));
    if (!items.length) {
      list.textContent = filter ? 'Sin coincidencias' : 'No hay apps';
      return;
    }
    list.innerHTML = items.map(it => `
      <div class="fp-app-row" data-pkg="${this._escape(it.packageName)}">
        <span class="fp-app-icon ${this._appIconClassFor(it.packageName)}" aria-hidden="true">
          ${this._appIconSvgFor(it.packageName)}
        </span>
        <span class="fp-app-name" title="${this._escape(it.packageName)}">${this._escape(it.packageName)}</span>
        <span class="fp-app-actions">
          <button class="fp-app-btn" data-action="copy" title="Copiar paquete">Copy</button>
          <button class="fp-app-btn" data-action="open" title="Abrir">Open</button>
          <button class="fp-app-btn" data-action="stop" title="Force-stop">Stop</button>
          <button class="fp-app-btn" data-action="info" title="Información de App">Info</button>
          <button class="fp-app-btn is-warn" data-action="clear" title="Clear cache">Clr</button>
          <button class="fp-app-btn is-danger" data-action="uninstall" title="Desinstalar">Uni</button>
        </span>
      </div>
    `).join('');
    list.querySelectorAll('.fp-app-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pkg = btn.closest('.fp-app-row').dataset.pkg;
        const action = btn.dataset.action;
        if (!pkg || !action) return;
        this._proAppsRunAction(action, pkg, btn);
      });
    });
  }

  _appIconClassFor(packageName) {
    return /^com\.spotify\./i.test(packageName || '') ? 'is-spotify' : 'is-default';
  }

  _appIconSvgFor(packageName) {
    if (/^com\.spotify\./i.test(packageName || '')) {
      // Logo Spotify simplificado: circulo + tres ondas blancas
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10" class="fp-spotify-bg"/>
          <path d="M7 9.5c3.5-1 7.5-.5 10.5 1.2" class="fp-spotify-stroke"/>
          <path d="M7.5 12.5c3-1 6.4-.5 9 1" class="fp-spotify-stroke"/>
          <path d="M8 15c2.4-.7 5-.4 7.2.8" class="fp-spotify-stroke"/>
        </svg>`;
    }
    // Icono default: cuadricula simple
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="3"/>
        <path d="M9 9h6v6H9z"/>
      </svg>`;
  }

  async _proAppsRunAction(action, pkg, btn) {
    if (!this.activeSerial) return;
    if (action === 'copy') {
      await navigator.clipboard.writeText(pkg);
      this._appendLog(`Paquete copiado: ${pkg}`);
      return;
    }
    const targets = action === 'info' ? [this.activeSerial] : this._getBulkActionSerials();
    if (!targets.length) return;
    if (action === 'uninstall') {
      const confirmed = await this._confirmBulkAction(
        'Desinstalar aplicacion',
        `<p>Esta accion eliminara <b>${this._escape(pkg)}</b>.</p>`,
        targets,
        'Desinstalar',
      );
      if (!confirmed) return;
    }
    if (action === 'clear') {
      const confirmed = await this._confirmBulkAction(
        'Borrar datos y cache',
        `<p>Esta accion ejecuta <b>pm clear ${this._escape(pkg)}</b>. Se perdera la sesion y los datos de la app.</p>`,
        targets,
        'Borrar datos',
      );
      if (!confirmed) return;
    }
    const originalDisabled = btn?.disabled;
    if (btn) btn.disabled = true;
    try {
      const result = await this._runSerialBatch(targets, async (serial) => {
        if (action === 'open')        return this.app.appsLaunch(serial, pkg);
        if (action === 'stop')        return this.app.appsForceStop(serial, pkg);
        if (action === 'info')        return this.app.appsDetails(serial, pkg);
        if (action === 'clear')       return this.app.appsClearCache(serial, pkg);
        if (action === 'uninstall')   return this.app.appsUninstall(serial, pkg);
        return null;
      });
      if (action === 'uninstall') {
        await this._proAppsRefresh();
      }
      this._appendLog(`apps:${action} OK ${result.ok}/${result.total} ${pkg}`);
      if (result.errors.length) {
        this._appendLog(`apps:${action} errores ${result.errors.length}`);
      }
    } catch (error) {
      this._appendLog(`apps:${action} FAIL ${pkg}: ${error.message || error}`);
    } finally {
      if (btn) btn.disabled = !!originalDisabled;
    }
  }

  /**
   * Modal de confirmacion para acciones destructivas. Devuelve Promise<boolean>.
   * Se inserta dentro del overlay del Focus Mode con foco en "Cancelar".
   */
  _confirmDangerDialog(title, htmlBody, confirmText = 'Confirmar') {
    return new Promise(resolve => {
      const layer = document.createElement('div');
      layer.className = 'fp-confirm-layer';
      layer.innerHTML = `
        <div class="fp-confirm-card" role="dialog" aria-modal="true">
          <h3 class="fp-confirm-title">${this._escape(title)}</h3>
          <div class="fp-confirm-body">${htmlBody}</div>
          <div class="fp-confirm-actions">
            <button class="fp-btn fp-btn-mini" data-fp-confirm="cancel">Cancelar</button>
            <button class="fp-btn fp-btn-mini fp-btn-danger" data-fp-confirm="ok">${this._escape(confirmText)}</button>
          </div>
        </div>
      `;
      const overlay = document.body;
      overlay.appendChild(layer);
      const close = (value) => {
        layer.remove();
        resolve(value);
      };
      layer.querySelector('[data-fp-confirm="cancel"]').addEventListener('click', () => close(false));
      layer.querySelector('[data-fp-confirm="ok"]').addEventListener('click', () => close(true));
      layer.addEventListener('click', (e) => { if (e.target === layer) close(false); });
      // Focus inicial en Cancelar (mas seguro)
      setTimeout(() => layer.querySelector('[data-fp-confirm="cancel"]').focus(), 0);
    });
  }

  async _proAppsInstallApk(file) {
    const targets = this._getBulkActionSerials();
    if (!targets.length || !file) return;
    const confirmed = await this._confirmBulkAction(
      'Instalar APK',
      `<p>Se instalara <b>${this._escape(file.name)}</b> (${file.size} bytes). Esta accion puede reemplazar apps existentes.</p>`,
      targets,
      'Instalar APK',
    );
    if (!confirmed) return;
    this._appendLog(`apps:install ${file.name} (${file.size} bytes)`);
    try {
      const result = await this._runSerialBatch(targets, serial => this.app.appsInstall(serial, file), 2);
      this._appendLog(`apps:install OK ${result.ok}/${result.total}`);
      if (result.errors.length) this._appendLog(`apps:install errores ${result.errors.length}`);
      this._proAppsRefresh();
    } catch (error) {
      this._appendLog(`apps:install FAIL: ${error.message || error}`);
    }
  }

  /* ---------------- Focus PRO Panel - Archivos (Fase 4) ---------------- */

  _bindProPanelArchivos() {
    const block  = this.overlay?.querySelector('.fp-archivos');
    const input  = this.overlay?.querySelector('#fpFileInput');
    const path   = this.overlay?.querySelector('#fpFilePath');
    const result = this.overlay?.querySelector('#fpFileResult');
    if (input) {
      input.addEventListener('change', (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const targetPath = path ? (path.value || '/sdcard/Download/') : '/sdcard/Download/';
        this._proPushFile(f, targetPath);
        e.target.value = '';
      });
    }
    if (block) {
      block.addEventListener('dragover', (e) => { e.preventDefault(); block.classList.add('is-dragging'); });
      block.addEventListener('dragleave', () => block.classList.remove('is-dragging'));
      block.addEventListener('drop', (e) => {
        e.preventDefault();
        block.classList.remove('is-dragging');
        const f = e.dataTransfer.files?.[0];
        const targetPath = path ? (path.value || '/sdcard/Download/') : '/sdcard/Download/';
        if (f) this._proPushFile(f, targetPath);
      });
    }
    if (result) result.textContent = 'Hasta 500 MB. Drop sobre este bloque tambien funciona.';
  }

  async _proPushFile(file, destPath) {
    const serial = this.activeSerial;
    const result = this.overlay.querySelector('#fpFileResult');
    if (!serial || !file) return;
    if (result) result.textContent = `Subiendo ${file.name} (${file.size} bytes)...`;
    try {
      const data = await this.app.pushFile(serial, file, destPath);
      const dest = data.remotePath || destPath;
      if (result) result.textContent = `OK -> ${dest}`;
      this._appendLog(`file-push OK ${file.name} -> ${dest}`);
    } catch (error) {
      if (result) result.textContent = `Error: ${error.message || error}`;
      this._appendLog(`file-push FAIL: ${error.message || error}`);
    }
  }

  /* ---------------- Focus PRO Panel - ADB Shell (Fase 5) ---------------- */

  _bindProPanelAdb() {
    const cmd = this.overlay?.querySelector('#fpAdbCmd');
    const run = this.overlay?.querySelector('#fpAdbRunBtn');
    const out = this.overlay?.querySelector('#fpAdbOut');
    if (!run || !cmd) return;
    this.overlay?.querySelectorAll('[data-fp-adb-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        cmd.value = btn.getAttribute('data-fp-adb-preset') || '';
        cmd.focus();
      });
    });
    const handler = async () => {
      const command = (cmd.value || '').trim();
      if (!command || !this.activeSerial) return;
      const targets = this._getBulkActionSerials();
      const confirmed = await this._confirmBulkAction(
        'Ejecutar ADB Shell',
        `<p>Se ejecutara el comando:</p><pre>${this._escape(command)}</pre><p>ADB Shell puede modificar el sistema y datos de apps.</p>`,
        targets,
        'Ejecutar ADB',
      );
      if (!confirmed) return;
      if (out) out.textContent = '$ ' + command + `\n(ejecutando en ${targets.length} dispositivo(s))`;
      try {
        const outputs = [];
        const batch = await this._runSerialBatch(targets, async (serial) => {
          const data = await this.app.runAdbFreeCommand(serial, command);
          outputs.push(`${serial}\n${data.result || JSON.stringify(data)}`);
        }, 2);
        if (out) out.textContent = '$ ' + command + '\n' + outputs.join('\n\n');
        this._appendLog(`adb run OK ${batch.ok}/${batch.total}: ${command}`);
        if (batch.errors.length) this._appendLog(`adb run errores ${batch.errors.length}`);
      } catch (error) {
        if (out) out.textContent = '$ ' + command + '\nERR: ' + (error.message || error);
      }
    };
    run.addEventListener('click', handler);
    cmd.addEventListener('keydown', (e) => { if (e.key === 'Enter') handler(); });
  }

  /* ---------------- Focus PRO Panel - Auto.js (Fase 6) ---------------- */

  _bindProPanelAutojs() {
    const input = this.overlay?.querySelector('#fpAutoJsInput');
    const stop  = this.overlay?.querySelector('#fpAutoJsStopBtn');
    const result = this.overlay?.querySelector('#fpAutoJsResult');
    const installBtn = this.overlay?.querySelector('#fpAutoJsInstallBtn');

    if (input) {
      input.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !this.activeSerial) return;
        const targets = this._getBulkActionSerials();
        const confirmed = await this._confirmBulkAction(
          'Ejecutar script',
          `<p>Se subira y ejecutara <b>${this._escape(file.name)}</b>. Un script puede tocar apps, datos y permisos del dispositivo.</p>`,
          targets,
          'Ejecutar',
        );
        if (!confirmed) return;
        if (result) result.textContent = `Subiendo ${file.name} a ${targets.length} dispositivo(s)...`;
        try {
          const summaries = [];
          const batch = await this._runSerialBatch(targets, async (serial) => {
            const pushed = await this.app.autoJsPushScript(serial, file, { force: false });
            const data = await this.app.autoJsRunRemote(serial, pushed.remotePath, { delimiter: this.app.delimiter });
            const resultText = typeof data.result === 'string'
              ? data.result
              : JSON.stringify(data.result || data, null, 2);
            const ok = /Ejecutado via FlowAgent|Script enviado y ejecutando|FlowLogin FlowAgent iniciado/i.test(resultText);
            const summary = resultText.split('\n').filter(Boolean).slice(0, 2).join(' | ');
            summaries.push(`${serial}: ${ok ? 'OK' : 'RESP'} ${summary || pushed.remotePath}`);
            this._runtimeStopSuppressedUntil?.delete(serial);
          }, 2);
          if (result) result.textContent = summaries.slice(0, 4).join('\n') || `Auto.js enviado ${batch.ok}/${batch.total}`;
          this._appendLog(`autojs OK ${batch.ok}/${batch.total}: ${file.name}`);
          if (batch.errors.length) this._appendLog(`autojs errores ${batch.errors.length}`);
          this._syncRuntimeStateNow();
        } catch (error) {
          if (result) result.textContent = `Error: ${error.message || error}`;
          this._appendLog(`autojs FAIL: ${error.message || error}`);
        }
      });
    }
    if (stop) {
      stop.addEventListener('click', async () => {
        if (!this.activeSerial) return;
        const targets = this._getBulkActionSerials();
        try {
          const batch = await this._runSerialBatch(targets, serial => this.app.autoJsStopForSerial(serial), 3);
          if (result) result.textContent = 'Auto.js detenido.';
          targets.forEach(serial => this._runtimeStopSuppressedUntil?.set(serial, Date.now() + 5000));
          this._syncRuntimeStateNow();
          this._appendLog(`autojs stop OK ${batch.ok}/${batch.total}`);
        } catch (error) {
          this._appendLog(`autojs stop FAIL: ${error.message || error}`);
        }
      });
    }
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (!this.activeSerial) return;
        const targets = this._getBulkActionSerials();
        const confirmed = targets.length > 1
          ? await this._confirmBulkAction(
              'Instalar FlowAgent',
              '<p>Se verificara o instalara FlowAgent en los dispositivos seleccionados.</p>',
              targets,
              'Instalar FlowAgent',
            )
          : true;
        if (!confirmed) return;
        if (result) result.textContent = 'Verificando e instalando FlowAgent si hace falta...';
        installBtn.disabled = true;
        const previousTargets = Array.isArray(this.app.contextMenuDevices)
          ? [...this.app.contextMenuDevices]
          : [];
        try {
          this.app.contextMenuDevices = targets;
          if (this.app.contextInstallFlowAgent) {
            await this.app.contextInstallFlowAgent();
          } else {
            throw new Error('Instalador FlowAgent no disponible');
          }
          this.app.contextMenuDevices = previousTargets;
          if (result) result.textContent = 'FlowAgent verificado/instalado. Si Android lo pide, revisa accesibilidad.';
          this._appendLog('flowagent install/check OK');
        } catch (error) {
          if (result) result.textContent = `Error: ${error.message || error}`;
          this._appendLog(`flowagent install/check FAIL: ${error.message || error}`);
        } finally {
          this.app.contextMenuDevices = previousTargets;
          installBtn.disabled = false;
        }
      });
    }
  }

  /* ---------------- Focus PRO Panel - Sistema (Fase 7) ---------------- */

  _bindProPanelSistema() {
    const run = async (shortcut) => {
      if (!this.activeSerial) return;
      try {
        await this.app.systemOpenSettings(this.activeSerial, shortcut);
        this._appendLog(`settings:${shortcut} OK`);
      } catch (error) {
        this._appendLog(`settings:${shortcut} FAIL: ${error.message || error}`);
      }
    };
    const mainBtn = this.overlay?.querySelector('#fpSysSettingsMain');
    if (mainBtn) mainBtn.addEventListener('click', () => run('main'));
    this.overlay?.querySelectorAll('[data-fp-shortcut]').forEach(btn => {
      btn.addEventListener('click', () => run(btn.dataset.fpShortcut));
    });
  }

  /* ---------------- Focus PRO Panel - Energia (Fase 7) ---------------- */

  _bindProPanelEnergia() {
    const reboot = this.overlay?.querySelector('#fpPowerRebootBtn');
    const shutdown = this.overlay?.querySelector('#fpPowerShutdownBtn');
    const arm = (btn, action, label) => {
      if (!btn) return;
      btn.addEventListener('click', async () => {
        if (!this.activeSerial) return;
        if (!btn.classList.contains('is-confirming')) {
          btn.classList.add('is-confirming');
          const original = btn.textContent;
          btn.dataset.originalText = original;
          btn.textContent = `Confirmar ${label}`;
          setTimeout(() => {
            if (!btn.classList.contains('is-confirming')) return;
            btn.classList.remove('is-confirming');
            btn.textContent = btn.dataset.originalText || label;
          }, 3000);
          return;
        }
        btn.classList.remove('is-confirming');
        btn.textContent = btn.dataset.originalText || label;
        const targets = this._getBulkActionSerials();
        const confirmed = await this._confirmBulkAction(
          action === 'reboot' ? 'Reiniciar dispositivo' : 'Apagar dispositivo',
          `<p>Esta accion ${action === 'reboot' ? 'reiniciara' : 'apagara'} los dispositivos indicados.</p>`,
          targets,
          label,
        );
        if (!confirmed) return;
        try {
          const batch = await this._runSerialBatch(targets, serial => (
            action === 'reboot' ? this.app.powerReboot(serial) : this.app.powerShutdown(serial)
          ), 2);
          this._appendLog(`power:${action} OK ${batch.ok}/${batch.total}`);
          if (batch.errors.length) this._appendLog(`power:${action} errores ${batch.errors.length}`);
        } catch (error) {
          this._appendLog(`power:${action} FAIL: ${error.message || error}`);
        }
      });
    };
    if (reboot) arm(reboot, 'reboot', 'Reiniciar');
    if (shutdown) arm(shutdown, 'shutdown', 'Apagar');
  }

  /* --------------------- FlowDev Inspector dentro de Focus (Etapa C) --------------------- */
  // Mini-inspector embebido en el modal de Focus. Reusa los endpoints de
  // local_adb_server.py:
  //   POST /inspector/dump            -> uiautomator dump
  //   POST /inspector/accessibility-dump -> via socket FlowAgent (funciona con FLAG_SECURE=true)
  //   POST /flowagent/ocr-detect      -> MLKit OCR sobre la pantalla
  //   POST /inspector/tap             -> tap por coordenada
  //   POST /agent/command (clickText) -> click por texto via accessibility
  // Modos: 'tree' (accessibility), 'ocr' (MLKit), 'hybrid' (accessibility + ocr).

  _bindFpInspectorEvents() {
    const root = this.overlay.querySelector('.fp-inspector-stack');
    if (!root) return;
    this._fpInspectorMode = 'tree';
    this._fpInspectorNodes = [];

    const modeBtns = root.querySelectorAll('[data-fp-inspector-mode]');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this._fpInspectorMode = btn.dataset.fpInspectorMode;
        this._fpInspectorRender();
      });
    });

    root.querySelector('[data-fp-inspector-action="refresh"]').addEventListener('click', () => {
      this._fpInspectorCapture().catch(err => {
        const r = this.overlay.querySelector('#fpInspResults');
        if (r) r.textContent = `Error: ${err.message || err}`;
      });
    });

    root.querySelector('#fpInspSearch').addEventListener('input', () => this._fpInspectorRender());
  }

  async _fpInspectorCapture() {
    const serial = this.activeSerial;
    if (!serial) return;
    const resultsEl = this.overlay.querySelector('#fpInspResults');
    const detailEl = this.overlay.querySelector('#fpInspDetail');
    if (resultsEl) resultsEl.textContent = 'Capturando...';
    if (detailEl) detailEl.hidden = true;
    this._fpInspectorClearHighlight();
    this._fpInspectorBusy = true;
    const apiBase = typeof PYTHON_API !== 'undefined' ? PYTHON_API : 'http://localhost:8765';

    const out = { tree: [], ocr: [], sources: [] };

    try {
    if (this._fpInspectorMode === 'tree' || this._fpInspectorMode === 'hybrid') {
      // Perfil INSPECCION: primero UIAutomator por ADB, sin captura ni FlowAgent.
      try {
        const r = await fetch(`${apiBase}/inspector/dump`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serial, refresh: true }),
        });
        const d = await r.json();
        if (Array.isArray(d.nodes) && d.nodes.length) {
          out.sources.push(`UIAutomator ${d.nodes.length}`);
          out.tree.push(...d.nodes.map(n => ({ ...n, _fpSource: d.method_used || 'uiautomator' })));
        }
      } catch { out.sources.push('UIAutomator error'); }

      // Accessibility se consulta solo como complemento si el agente ya esta
      // disponible; este endpoint no instala ni relanza FlowAgent.
      try {
        const r = await fetch(`${apiBase}/inspector/accessibility-dump`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serial }),
        });
        const d = await r.json();
        if (Array.isArray(d.nodes) && d.nodes.length) {
          out.sources.push(`Accessibility ${d.nodes.length}`);
          out.tree.push(...d.nodes.map(n => ({ ...n, _fpSource: d.method_used || 'accessibility' })));
        }
      } catch { out.sources.push('Accessibility no disponible'); }
    }

    if (this._fpInspectorMode === 'native') {
      try {
        const r = await fetch(`${apiBase}/inspector/native-detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serial, method: 'uiautomator', refresh: true }),
        });
        const d = await r.json();
        if (Array.isArray(d.nodes) && d.nodes.length) {
          out.sources.push(`Nativo ${d.method_used || 'native'} ${d.nodes.length}`);
          out.tree.push(...d.nodes.map(n => ({ ...n, _fpSource: d.method_used || 'native' })));
        } else if (d.error) {
          out.sources.push(`Nativo: ${d.error}`);
        }
      } catch (err) { out.sources.push(`Nativo error: ${err.message || err}`); }
      try {
        const r = await fetch(`${apiBase}/inspector/native-detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serial, method: 'dumpsys' }),
        });
        const d = await r.json();
        if (Array.isArray(d.nodes) && d.nodes.length) {
          out.sources.push(`Dumpsys ${d.nodes.length}`);
          out.tree.push(...d.nodes.map(n => ({ ...n, _fpSource: d.method_used || 'dumpsys' })));
        }
      } catch (_) {}
    }

    if (this._fpInspectorMode === 'web') {
      for (const method of ['cdp', 'js_inject']) {
        try {
          const r = await fetch(`${apiBase}/inspector/web-detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serial, method }),
          });
          const d = await r.json();
          if (Array.isArray(d.nodes) && d.nodes.length) {
            out.sources.push(`Web ${d.method_used || method} ${d.nodes.length}`);
            out.tree.push(...d.nodes.map(n => ({ ...n, _fpSource: d.method_used || method })));
            break;
          }
          if (d.error) out.sources.push(`Web ${method}: ${d.error}`);
        } catch (err) { out.sources.push(`Web ${method} error: ${err.message || err}`); }
      }
      if (!out.tree.length) {
        try {
          const r = await fetch(`${apiBase}/inspector/dump`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serial, refresh: true }),
          });
          const d = await r.json();
          if (Array.isArray(d.nodes) && d.nodes.length) {
            out.sources.push(`Web fallback UIAutomator ${d.nodes.length}`);
            out.tree.push(...d.nodes.map(n => ({ ...n, _fpSource: 'web_fallback_uiautomator' })));
          } else if (d.error) {
            out.sources.push(`Web fallback: ${d.error}`);
          }
        } catch (err) { out.sources.push(`Web fallback error: ${err.message || err}`); }
      }
    }

    if (this._fpInspectorMode === 'auto') {
      try {
        const r = await fetch(`${apiBase}/inspector/auto-detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serial, refresh: true }),
        });
        const d = await r.json();
        if (Array.isArray(d.nodes) && d.nodes.length) {
          out.sources.push(`Auto ${d.method_used || d.method || 'auto'} ${d.nodes.length}`);
          out.tree.push(...d.nodes.map(n => ({ ...n, _fpSource: d.method_used || d.method || 'auto' })));
        } else if (d.error) {
          out.sources.push(`Auto: ${d.error}`);
        }
      } catch (err) { out.sources.push(`Auto error: ${err.message || err}`); }
    }

    if (this._fpInspectorMode === 'ocr' || this._fpInspectorMode === 'hybrid') {
      try {
        const r = await fetch(`${apiBase}/flowagent/ocr-detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serial, timeout: 8000 }),
        });
        const d = await r.json();
        const response = d.response || {};
        if (response.error || d.error) {
          out.sources.push(`OCR: ${response.error || d.error}`);
        }
        const blocks = response.blocks || response.result?.blocks || [];
        out.ocr = Array.isArray(blocks) ? blocks : [];
        if (out.ocr.length) out.sources.push(`OCR ${out.ocr.length}`);
      } catch (err) { out.sources.push(`OCR error: ${err.message || err}`); }
    }

    this._fpInspectorNodes = this._fpInspectorMerge(out);
    this._fpInspectorCaptureSummary = out.sources.join(' · ') || 'Sin fuentes con nodos';
    this._fpInspectorRender();
    } finally {
      this._fpInspectorBusy = false;
      this._lastAgentProbeOkAt = performance.now();
    }
  }

  _fpInspectorMerge({ tree = [], ocr = [] }) {
    const out = [];
    const seen = new Set();
    for (const n of tree) {
      const source = String(n._fpSource || n.method || n.detectionSource || 'tree');
      const kind = source.includes('cdp') || source.includes('inject') || source.includes('web') || source.includes('react') || source.includes('ionic') || source.includes('flutter')
        ? 'web'
        : (source.includes('uiautomator') || source.includes('accessibility') || source.includes('native') || source.includes('dumpsys') || source.includes('viewserver') ? 'native' : 'tree');
      const node = {
        kind,
        source,
        text: String(n.text || n.desc || n.contentDesc || '').trim(),
        klass: String(n.class || n.className || n.tagName || ''),
        resourceId: String(n.resourceId || n['resource-id'] || ''),
        sourceId: String(n.sourceId || n.resourceId || n['resource-id'] || n.domId || n.id || n.tagName || ''),
        contentDesc: String(n.contentDesc || n.desc || ''),
        bounds: n.bounds,
        clickable: !!n.clickable,
        cx: n.centerX ?? (n.bounds ? this._fpCenterFromBounds(n.bounds, 0) : null),
        cy: n.centerY ?? (n.bounds ? this._fpCenterFromBounds(n.bounds, 1) : null),
        raw: n,
      };
      const key = `${node.sourceId}|${node.text}|${node.klass}|${this._fpBoundsLabel(node.bounds)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(node);
    }
    for (const b of ocr) {
      out.push({
        kind: 'ocr',
        source: 'ocr',
        text: String(b.text || '').trim(),
        klass: 'OCR',
        resourceId: '',
        sourceId: '',
        contentDesc: '',
        bounds: `[${b.x || 0},${b.y || 0}][${(b.x || 0) + (b.w || 0)},${(b.y || 0) + (b.h || 0)}]`,
        clickable: true,
        cx: (b.x || 0) + (b.w || 0) / 2,
        cy: (b.y || 0) + (b.h || 0) / 2,
        raw: b,
      });
    }
    return out;
  }

  _fpCenterFromBounds(bounds, axis) {
    if (typeof bounds === 'string') {
      const m = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
      if (m) {
        const a = parseInt(m[1 + axis * 2], 10);
        const b = parseInt(m[3 + axis * 2], 10);
        return Math.round((a + b) / 2);
      }
    } else if (Array.isArray(bounds) && bounds.length === 4) {
      return Math.round((bounds[axis] + bounds[axis + 2]) / 2);
    } else if (bounds && typeof bounds === 'object') {
      const start = axis === 0 ? bounds.left : bounds.top;
      const end = axis === 0 ? bounds.right : bounds.bottom;
      if (Number.isFinite(Number(start)) && Number.isFinite(Number(end))) {
        return Math.round((Number(start) + Number(end)) / 2);
      }
    }
    if (typeof bounds === 'string' && bounds.includes(',')) {
      const parts = bounds.split(',').map(s => parseInt(s, 10));
      if (parts.length === 4) return Math.round((parts[axis] + parts[axis + 2]) / 2);
    }
    return null;
  }

  _fpBoundsLabel(bounds) {
    if (!bounds) return '';
    if (typeof bounds === 'string') return bounds;
    if (Array.isArray(bounds) && bounds.length === 4) return `[${bounds[0]},${bounds[1]}][${bounds[2]},${bounds[3]}]`;
    if (typeof bounds === 'object') {
      const { left, top, right, bottom } = bounds;
      if ([left, top, right, bottom].every(v => Number.isFinite(Number(v)))) {
        return `[${left},${top}][${right},${bottom}]`;
      }
    }
    return String(bounds);
  }

  _fpBoundsRect(bounds) {
    if (!bounds) return null;
    if (typeof bounds === 'string') {
      const m = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
      if (m) {
        return {
          left: parseInt(m[1], 10),
          top: parseInt(m[2], 10),
          right: parseInt(m[3], 10),
          bottom: parseInt(m[4], 10),
        };
      }
      if (bounds.includes(',')) {
        const parts = bounds.split(',').map(s => parseInt(s, 10));
        if (parts.length === 4 && parts.every(v => Number.isFinite(v))) {
          return { left: parts[0], top: parts[1], right: parts[2], bottom: parts[3] };
        }
      }
    }
    if (Array.isArray(bounds) && bounds.length === 4) {
      return { left: Number(bounds[0]), top: Number(bounds[1]), right: Number(bounds[2]), bottom: Number(bounds[3]) };
    }
    if (typeof bounds === 'object') {
      const rect = {
        left: Number(bounds.left),
        top: Number(bounds.top),
        right: Number(bounds.right),
        bottom: Number(bounds.bottom),
      };
      if (Object.values(rect).every(v => Number.isFinite(v))) return rect;
    }
    return null;
  }

  _fpInspectorClearHighlight() {
    const box = this.overlay?.querySelector('#fpInspectorHighlight');
    if (box) box.remove();
    const layer = this.overlay?.querySelector('#flowTouchGestureLayer');
    if (layer) {
      layer.classList.remove('has-inspector-highlight');
      if (!layer.querySelector('.flowtouch-local-marker, .flowtouch-gesture-trail')) {
        layer.style.display = 'none';
      }
    }
  }

  _fpInspectorHighlightNode(node) {
    const layer = this.overlay?.querySelector('#flowTouchGestureLayer');
    if (!layer || !node) return;
    let rect = this._fpBoundsRect(node.bounds);
    if (!rect && node.cx != null && node.cy != null) {
      rect = { left: Number(node.cx) - 18, top: Number(node.cy) - 18, right: Number(node.cx) + 18, bottom: Number(node.cy) + 18 };
    }
    if (!rect) {
      this._fpInspectorClearHighlight();
      return;
    }
    const frame = this._getFrameSize();
    const width = Math.max(1, Number(frame?.width || 1080));
    const height = Math.max(1, Number(frame?.height || 1920));
    const left = Math.max(0, Math.min(100, (rect.left / width) * 100));
    const top = Math.max(0, Math.min(100, (rect.top / height) * 100));
    const right = Math.max(0, Math.min(100, (rect.right / width) * 100));
    const bottom = Math.max(0, Math.min(100, (rect.bottom / height) * 100));
    let box = this.overlay.querySelector('#fpInspectorHighlight');
    if (!box) {
      box = document.createElement('i');
      box.id = 'fpInspectorHighlight';
      box.className = 'fp-inspector-highlight-box';
      layer.appendChild(box);
    }
    const label = String(node.text || node.sourceId || node.klass || node.kind || 'Nodo').trim();
    box.textContent = label ? label.substring(0, 48) : 'Nodo';
    box.style.left = `${Math.min(left, right)}%`;
    box.style.top = `${Math.min(top, bottom)}%`;
    box.style.width = `${Math.max(0.8, Math.abs(right - left))}%`;
    box.style.height = `${Math.max(0.8, Math.abs(bottom - top))}%`;
    layer.style.display = 'grid';
    layer.classList.add('has-inspector-highlight');
  }

  async _fpInspectorCopy(value, label = 'valor') {
    const text = String(value || '');
    if (!text) {
      this._appendLog(`${label} vacio`);
      return false;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('clipboard API unavailable');
      }
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } finally { ta.remove(); }
    }
    this._appendLog(`${label} copiado`);
    return true;
  }

  _fpInspectorRender() {
    const resultsEl = this.overlay.querySelector('#fpInspResults');
    const searchEl = this.overlay.querySelector('#fpInspSearch');
    if (!resultsEl) return;
    const q = String(searchEl.value || '').trim().toLowerCase();
    const list = this._fpInspectorNodes.filter(n => {
      if (!q) return n.text || n.resourceId || n.sourceId || n.contentDesc;
      return (n.text || '').toLowerCase().includes(q)
        || (n.resourceId || '').toLowerCase().includes(q)
        || (n.sourceId || '').toLowerCase().includes(q)
        || (n.contentDesc || '').toLowerCase().includes(q)
        || (n.source || '').toLowerCase().includes(q)
        || (n.klass || '').toLowerCase().includes(q);
    });
    if (!list.length) {
      resultsEl.textContent = q
        ? 'Sin coincidencias.'
        : 'Sin elementos. Pulsa "Capturar UI" para escanear.';
      return;
    }
    resultsEl.innerHTML = list.slice(0, 200).map((n, i) => {
      const tag = n.kind === 'ocr' ? 'OCR' : (n.kind === 'web' ? 'WEB' : (n.kind === 'native' ? 'NATIVE' : (n.klass.split('.').pop() || 'Node')));
      const text = this._escape(n.text || n.contentDesc || '');
      const metaText = n.resourceId || n.sourceId || n.source || '';
      const meta = metaText ? `<span class="fp-insp-rid">${this._escape(metaText)}</span>` : '';
      return `
        <div class="fp-insp-row" data-fp-insp-i="${i}">
          <span class="fp-insp-tag fp-insp-tag-${n.kind}">${this._escape(tag)}</span>
          <span class="fp-insp-text">${text || '(sin texto)'}</span>
          ${meta}
        </div>`;
    }).join('');
    if (this._fpInspectorCaptureSummary) {
      resultsEl.insertAdjacentHTML(
        'afterbegin',
        `<div class="fp-insp-row fp-insp-summary"><span class="fp-insp-text">${this._escape(this._fpInspectorCaptureSummary)}</span></div>`
      );
    }
    resultsEl.querySelectorAll('.fp-insp-row[data-fp-insp-i]').forEach(row => {
      row.addEventListener('click', () => {
        const i = parseInt(row.dataset.fpInspI, 10);
        resultsEl.querySelectorAll('.fp-insp-row.is-selected').forEach(item => item.classList.remove('is-selected'));
        row.classList.add('is-selected');
        this._fpInspectorShowDetail(list[i]);
      });
    });
  }

  _fpInspectorShowDetail(node) {
    const detailEl = this.overlay.querySelector('#fpInspDetail');
    if (!detailEl || !node) return;
    detailEl.hidden = false;
    this._fpInspectorHighlightNode(node);
    const text = node.text || '';
    const sourceId = node.sourceId || node.resourceId || '';
    const bounds = this._fpBoundsLabel(node.bounds);
    const klass = (node.klass || 'Node').split('.').pop();
    const json = JSON.stringify(node.raw || node, null, 2);
    detailEl.innerHTML = `
      <div class="fp-insp-detail-head">
        <strong>${this._escape(klass)}</strong>
        ${sourceId ? `<code>${this._escape(sourceId)}</code>` : ''}
      </div>
      <div class="fp-insp-detail-row"><b>Fuente</b><span>${this._escape(node.source || node.kind || '-')}</span></div>
      <div class="fp-insp-detail-row"><b>Texto</b><span>${this._escape(text) || '-'}</span></div>
      <div class="fp-insp-detail-row"><b>Source ID</b><span>${this._escape(sourceId) || '-'}</span></div>
      <div class="fp-insp-detail-row"><b>Bounds</b><span>${this._escape(bounds) || '-'}</span></div>
      <div class="fp-insp-detail-row"><b>Centro</b><span>${node.cx ?? '-'}, ${node.cy ?? '-'}</span></div>
      <div class="fp-insp-detail-row"><b>Clickable</b><span>${node.clickable ? 'si' : 'no'}</span></div>
      <div class="fp-insp-detail-actions">
        <button class="fp-btn fp-btn-mini" data-fp-insp-act="copy" title="Copiar texto">Texto</button>
        <button class="fp-btn fp-btn-mini" data-fp-insp-act="copyId" title="Copiar Source ID">Source</button>
        <button class="fp-btn fp-btn-mini" data-fp-insp-act="copyJson" title="Copiar JSON">JSON</button>
        <button class="fp-btn fp-btn-mini" data-fp-insp-act="tap" title="Tap aqui">Tap</button>
        ${node.kind !== 'ocr' && node.text ? `<button class="fp-btn fp-btn-mini" data-fp-insp-act="clickText" title="Click por texto">Click</button>` : ''}
      </div>`;
    detailEl.querySelector('[data-fp-insp-act="copy"]').addEventListener('click', () => {
      this._fpInspectorCopy(text, 'Texto');
    });
    detailEl.querySelector('[data-fp-insp-act="copyId"]').addEventListener('click', () => {
      this._fpInspectorCopy(sourceId, 'Source ID');
    });
    detailEl.querySelector('[data-fp-insp-act="copyJson"]').addEventListener('click', () => {
      this._fpInspectorCopy(json, 'JSON');
    });
    detailEl.querySelector('[data-fp-insp-act="tap"]').addEventListener('click', async () => {
      if (node.cx == null || node.cy == null) {
        this._appendLog('Sin coordenadas para tap');
        return;
      }
      const apiBase = typeof PYTHON_API !== 'undefined' ? PYTHON_API : 'http://localhost:8765';
      try {
        await fetch(`${apiBase}/inspector/tap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serial: this.activeSerial, x: node.cx, y: node.cy }),
        });
        this._appendLog(`Tap en (${node.cx}, ${node.cy})`);
      } catch (err) {
        this._appendLog(`Tap fallo: ${err.message}`);
      }
    });
    const clickTextBtn = detailEl.querySelector('[data-fp-insp-act="clickText"]');
    if (clickTextBtn) clickTextBtn.addEventListener('click', async () => {
      const apiBase = typeof PYTHON_API !== 'undefined' ? PYTHON_API : 'http://localhost:8765';
      const agentId = (this.app.devices || [])
        .find(d => d.serial === this.activeSerial)?.agentId;
      try {
        await fetch(`${apiBase}/agent/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: agentId || this.activeSerial,
            command: { name: 'click_text', text: node.text, contains: true },
          }),
        });
        this._appendLog(`click_text "${node.text}" enviado`);
      } catch (err) {
        this._appendLog(`click_text fallo: ${err.message}`);
      }
    });
  }

  /* --------------------- FlowKeyboard (Fase 8) --------------------- */

  _bindFlowKeyboardEvents() {
    const sendBtn      = this.overlay.querySelector('#flowTouchKeyboardSendBtn');
    const clearBtn     = this.overlay.querySelector('#flowTouchKeyboardClearBtn');
    const backspaceBtn = this.overlay.querySelector('#flowTouchKeyboardBackspaceBtn');
    const enterBtn     = this.overlay.querySelector('#flowTouchKeyboardEnterBtn');
    const nextBtn      = this.overlay.querySelector('#flowTouchKeyboardNextBtn');
    const doneBtn      = this.overlay.querySelector('#flowTouchKeyboardDoneBtn');
    const prepareBtn   = this.overlay.querySelector('#flowTouchKeyboardPrepareBtn');
    sendBtn.addEventListener('click', () => this._sendFlowKeyboardText());
    clearBtn.addEventListener('click', () => this._runFlowKeyboardAction('clear'));
    backspaceBtn.addEventListener('click', () => this._runFlowKeyboardAction('backspace'));
    enterBtn.addEventListener('click', () => this._runFlowKeyboardAction('enter'));
    nextBtn.addEventListener('click', () => this._runFlowKeyboardAction('next'));
    doneBtn.addEventListener('click', () => this._runFlowKeyboardAction('done'));
    prepareBtn.addEventListener('click', () => this._prepareFlowKeyboardForActiveSerial());
  }

  async _refreshFlowKeyboardStatus(serial = this.activeSerial) {
    if (!serial) return null;
    if (!this.app.requestFlowKeyboardStatus) {
      this._renderFlowKeyboardBlock(null);
      return null;
    }
    try {
      const data = await this.app.requestFlowKeyboardStatus({ serial });
      // El endpoint devuelve un objeto plano cuando se pasa serial, o { result: [..] }
      const status = data.serial ? data : (Array.isArray(data.result) ? data.result[0] : null);
      this.flowKeyboardStatus = status || null;
      this._renderFlowKeyboardBlock(this.flowKeyboardStatus);
      return this.flowKeyboardStatus;
    } catch (error) {
      this.flowKeyboardStatus = null;
      this._renderFlowKeyboardBlock(null, error.message || 'sin estado');
      return null;
    }
  }

  _renderFlowKeyboardBlock(status, errorMessage = null) {
    status = status || {};
    if (!this.overlay) return;
    const block = this.overlay.querySelector('#flowTouchKeyboardBlock');
    const stateEl = this.overlay.querySelector('#flowTouchKeyboardState');
    const prepareBtn = this.overlay.querySelector('#flowTouchKeyboardPrepareBtn');
    if (!block || !stateEl) return;
    const installed = !!status.installed;
    const selected = !!status.selected;
    const enabled = !!status.enabled;
    block.hidden = false;
    if (errorMessage) {
      stateEl.textContent = 'sin estado';
      stateEl.title = errorMessage || 'Sin estado FlowKeyboard';
      stateEl.className = 'flowtouch-status-pill is-warn';
    } else if (selected) {
      stateEl.textContent = 'listo';
      stateEl.title = 'FlowKeyboard listo (instalado, habilitado y seleccionado)';
      stateEl.className = 'flowtouch-status-pill is-ready';
    } else if (installed) {
      const txt = enabled ? 'no seleccionado' : 'no habilitado';
      stateEl.textContent = txt;
      stateEl.title = enabled
        ? 'FlowKeyboard instalado y habilitado, pero no esta como teclado activo. Usa Preparar FlowKeyboard.'
        : 'FlowKeyboard instalado pero no habilitado. Usa Preparar FlowKeyboard.';
      stateEl.className = 'flowtouch-status-pill is-warn';
    } else {
      stateEl.textContent = 'no instalado';
      stateEl.title = 'FlowKeyboard no esta instalado en este dispositivo';
      stateEl.className = 'flowtouch-status-pill is-error';
    }
    // Habilitar inputs solo cuando esta listo
    const inputs = block.querySelectorAll('input, textarea, button:not(#flowTouchKeyboardPrepareBtn)');
    inputs.forEach(el => {
      if (selected) el.removeAttribute('disabled');
      else el.setAttribute('disabled', 'disabled');
    });
    if (prepareBtn) {
      // Mostrar boton preparar solo si esta instalado pero no seleccionado
      prepareBtn.hidden = !(installed && !selected);
    }
  }

  async _prepareFlowKeyboardForActiveSerial() {
    const serial = this.activeSerial;
    if (!serial || this.flowKeyboardBusy) return;
    this.flowKeyboardBusy = true;
    this._appendLog('FlowKeyboard preparando...');
    try {
      const apiBase = typeof PYTHON_API !== 'undefined' ? PYTHON_API : 'http://localhost:8765';
      const response = await fetch(`${apiBase}/flowkeyboard/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceIds: [serial] }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      this._appendLog('FlowKeyboard preparado');
    } catch (error) {
      this._appendLog(`FlowKeyboard preparar fallo: ${error.message || error}`);
    } finally {
      this.flowKeyboardBusy = false;
      // Refrescar estado tras preparar
      this._refreshFlowKeyboardStatus(serial).catch(() => null);
    }
  }

  async _sendFlowKeyboardText() {
    const serial = this.activeSerial;
    if (!serial || this.flowKeyboardBusy) return;
    if (!this.flowKeyboardStatus.selected) {
      this._appendLog('FlowKeyboard no esta seleccionado');
      return;
    }
    const input = this.overlay.querySelector('#flowTouchKeyboardInput');
    const text = String(input.value ?? '');
    if (!text.length) {
      this._appendLog('FlowKeyboard sin texto para enviar');
      return;
    }
    if (!this.app.sendFlowKeyboardType) {
      this._appendLog('FlowKeyboard helper no disponible en app');
      return;
    }
    this.flowKeyboardBusy = true;
    // Solo registramos longitud para no exponer el texto en historial.
    this._appendLog(`FlowKeyboard type: ${text.length} caracteres`);
    try {
      await this.app.sendFlowKeyboardType(serial, text);
      this._appendLog('FlowKeyboard type OK');
      if (input) input.value = '';
    } catch (error) {
      this._appendLog(`FlowKeyboard type fallo: ${error.message || error}`);
    } finally {
      this.flowKeyboardBusy = false;
    }
  }

  async _runFlowKeyboardAction(action) {
    const serial = this.activeSerial;
    if (!serial || this.flowKeyboardBusy) return;
    if (!this.flowKeyboardStatus.selected) {
      this._appendLog(`FlowKeyboard ${action} requiere IME seleccionado`);
      return;
    }
    if (!this.app.sendFlowKeyboardCommand) {
      this._appendLog('FlowKeyboard helper no disponible en app');
      return;
    }
    this.flowKeyboardBusy = true;
    this._appendLog(`FlowKeyboard ${action} enviando`);
    try {
      const options = action === 'backspace' ? { count: 1 } : {};
      await this.app.sendFlowKeyboardCommand(serial, action, options);
      this._appendLog(`FlowKeyboard ${action} OK`);
    } catch (error) {
      this._appendLog(`FlowKeyboard ${action} fallo: ${error.message || error}`);
    } finally {
      this.flowKeyboardBusy = false;
    }
  }

  async _refreshFocusPublicIp(serial) {
    if (!serial || !this.app.refreshDevicePublicIp) return;
    const info = await this.app.refreshDevicePublicIp(serial);
    if (!info || this.activeSerial !== serial || !this.overlay) return;
    const badge = this.overlay.querySelector('#flowTouchFocusIp');
    if (!badge) return;
    const code = String(info.countryCode || '').toUpperCase();
    const name = info.countryName || '';
    const flag = this.app?.renderCountryFlag
      ? this.app.renderCountryFlag(code, name)
      : '<span class="device-flag is-empty">--</span>';
    badge.innerHTML = `${flag}<span>${this._escape(info.publicIp || 'IP publica...')}</span>`;
    badge.title = name || code || 'IP publica';
  }

  _findDevice(serial) {
    return (this.app?.devices || []).find(device => device.serial === serial) || null;
  }

  _deviceName(device, serial) {
    const stableId = device && this.app.getDeviceStableId ? this.app.getDeviceStableId(device) : serial;
    return this.app?.deviceNames?.[stableId]
      || this.app?.deviceNames?.[serial]
      || device.model
      || 'Dispositivo';
  }

  _markFocusedCard(serial, active) {
    try {
      const card = document.querySelector(`[data-serial="${CSS.escape(serial)}"]`);
      card.classList.toggle('is-flowtouch-focused', active);
    } catch {
      // CSS.escape puede fallar en entornos antiguos; no bloquea Focus Mode.
    }
  }

  _safeId(value) {
    return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
  }

  _escape(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }
}

const FlowTouchFocus = {
  open(controller, serial) {
    return controller.openFocus(serial);
  },
  close(controller) {
    return controller.closeFocus();
  }
};

window.FlowTouchFocus = FlowTouchFocus;
window.CoordinateMapper = CoordinateMapper;
window.FlowTouchCommandRouter = FlowTouchCommandRouter;
window.FlowTouchController = FlowTouchController;

