const fs = require('fs');

const path = 'C:/DASHBOARD/FlowDashboard/electron-app/src/renderer/flow-touch.js';
let content = fs.readFileSync(path, 'utf8');

// Replacement 1: openFocus template
const openFocusRegex = /this\.overlay\.innerHTML = `[\s\S]*?`;\s*document\.body\.appendChild\(this\.overlay\);/;
const openFocusNew = `const transports = device?.transports || ['usb'];
    const preferred = device?.preferredTransport || 'auto';
    const transportsText = transports.join(' + ').toUpperCase();
    const prefText = 'Pref: ' + preferred.charAt(0).toUpperCase() + preferred.slice(1);

    this.overlay.innerHTML = \`
      <div class="flowtouch-focus-shell is-clean-mode" data-serial="\${this._escape(targetSerial)}">
        <header class="flowtouch-focus-header">
          <div class="flowtouch-focus-title">
            <button class="flowtouch-focus-device-name device-name" id="flowTouchDeviceNameBtn" title="Editar nombre">\${this._escape(title)}</button>
            <div class="flowtouch-focus-connection" style="display:flex;gap:6px;align-items:center;">
              <span class="device-connection-badge is-\${this._escape(transports[0])}">\${this._escape(transportsText)}</span>
              <span class="device-connection-badge is-pref" style="opacity:0.7;">\${this._escape(prefText)}</span>
              <small title="\${this._escape(targetSerial)}" style="margin-left:4px;">\${this._escape(shortSerial)}</small>
            </div>
            <div class="flowtouch-focus-ip device-public-ip" id="flowTouchFocusIp" title="\${this._escape(countryName || countryCode || 'IP publica')}">
              \${flagHtml}
              <span>\${this._escape(publicIp || 'IP publica...')}</span>
            </div>
          </div>
          <div class="flowtouch-focus-technical-header" id="flowTouchTechHeader" style="display: none;">
            <span class="flowtouch-status-pill" id="flowTouchAgentState">FlowAgent revisando</span>
            <span class="flowtouch-status-pill is-ready" id="flowTouchModeState">Focus activo</span>
            <span class="flowtouch-status-pill" id="flowTouchFrameState">Frame revisando</span>
            <span class="flowtouch-status-pill" id="flowTouchControlStatePill">OFF</span>
          </div>
          <div class="flowtouch-focus-actions">
            <label class="fp-switch fp-switch-small" title="Modo Tecnico" style="margin-right: 12px; transform: scale(0.85);">
              <input type="checkbox" id="flowTouchTechModeSwitch" />
              <span class="fp-switch-slider"></span>
              <span class="fp-switch-label">Tecnico</span>
            </label>
            <button class="flowtouch-icon-btn is-close" id="flowTouchCloseBtn" title="Cerrar FlowTouch">
              <svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </header>
        <main class="flowtouch-focus-main">
          <aside class="focus-pro-panel" aria-label="Acciones del dispositivo enfocado">
            <section class="fp-block fp-nav" data-block="nav">
              <div class="fp-content fp-nav-compact-row" style="display:flex; gap:8px; justify-content:center;">
                <button class="fp-icon-btn" id="flowTouchBackBtn" title="Back en Android">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/></svg>
                </button>
                <button class="fp-icon-btn" id="flowTouchHomeBtn" title="Home en Android">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12 12 3l9 9"/><path d="M5 10v10h14V10"/></svg>
                </button>
                <button class="fp-icon-btn" id="flowTouchRecentsBtn" title="Recents en Android">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/></svg>
                </button>
              </div>
            </section>

            <section class="fp-block fp-capture" data-block="capture">
              <header class="fp-header">
                <span class="fp-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/></svg>
                </span>
                <span class="fp-title">Captura</span>
              </header>
              <div class="fp-content fp-capture-row">
                <button class="fp-btn" id="flowTouchScreenshotBtn" title="Tomar Screenshot">
                  <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <span>Screenshot</span>
                </button>
                <button class="fp-btn fp-record-btn" id="flowTouchRecordBtn" title="Iniciar grabacion manual">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg>
                  <span id="flowTouchRecordLabel">Grabar</span>
                </button>
              </div>
              <div class="fp-record-status" id="flowTouchRecordStatus" style="display:none; margin: 8px 12px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 6px; font-size: 0.8rem;">
                <div id="flowTouchRecordMessage" style="margin-bottom: 6px; color: #a1a1aa;"></div>
                <div class="fp-record-actions" id="flowTouchRecordActions" style="display:none; gap: 6px;">
                  <button class="fp-btn fp-btn-small" id="flowTouchRecordOpenFile" style="padding: 4px 8px; font-size: 0.75rem;">Abrir archivo</button>
                  <button class="fp-btn fp-btn-small" id="flowTouchRecordOpenFolder" style="padding: 4px 8px; font-size: 0.75rem;">Abrir carpeta</button>
                </div>
              </div>
            </section>

            <section class="fp-block fp-display" data-block="display">
              <header class="fp-header">
                <span class="fp-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                </span>
                <span class="fp-title">Pantalla</span>
              </header>
              <div class="fp-content">
                <select id="flowTouchQualitySelect" class="flowtouch-quality-select" title="Calidad del stream">
                  <option value="eco">Fluida (480p · 24fps)</option>
                  <option value="balanced" selected>Balanceada (720p · 30fps)</option>
                  <option value="pro">Calidad (1080p · 30fps)</option>
                </select>
              </div>
            </section>

            <section class="fp-block fp-tools" data-block="tools">
              <header class="fp-header"><span class="fp-title">Herramientas</span></header>
              <div class="fp-content fp-tools-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; padding: 0 8px 8px 8px;">
                <button class="fp-launcher-btn" data-fp-launcher="apps" title="Aplicaciones" style="display:flex; flex-direction:column; align-items:center; background:var(--bg-card); border:1px solid var(--border-color); padding:8px; border-radius:6px; cursor:pointer; color:var(--text-secondary);">
                  <svg viewBox="0 0 24 24" style="width:20px;height:20px;margin-bottom:4px;stroke:currentColor;fill:none;stroke-width:2;"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                  <span style="font-size:0.7rem;">Apps</span>
                </button>
                <button class="fp-launcher-btn" data-fp-launcher="archivos" title="Archivos" style="display:flex; flex-direction:column; align-items:center; background:var(--bg-card); border:1px solid var(--border-color); padding:8px; border-radius:6px; cursor:pointer; color:var(--text-secondary);">
                  <svg viewBox="0 0 24 24" style="width:20px;height:20px;margin-bottom:4px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M3 7l3-4h12l3 4"/><path d="M3 7v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7"/><path d="M12 11v6"/><path d="M9 14l3-3 3 3"/></svg>
                  <span style="font-size:0.7rem;">Archivos</span>
                </button>
                <button class="fp-launcher-btn" data-fp-launcher="adb" title="ADB Shell" style="display:flex; flex-direction:column; align-items:center; background:var(--bg-card); border:1px solid var(--border-color); padding:8px; border-radius:6px; cursor:pointer; color:var(--text-secondary);">
                  <svg viewBox="0 0 24 24" style="width:20px;height:20px;margin-bottom:4px;stroke:currentColor;fill:none;stroke-width:2;"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                  <span style="font-size:0.7rem;">ADB Shell</span>
                </button>
                <button class="fp-launcher-btn" data-fp-launcher="autojs" title="Auto.js" style="display:flex; flex-direction:column; align-items:center; background:var(--bg-card); border:1px solid var(--border-color); padding:8px; border-radius:6px; cursor:pointer; color:var(--text-secondary);">
                  <svg viewBox="0 0 24 24" style="width:20px;height:20px;margin-bottom:4px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M5 3l6 18 2-7 7-2z"/></svg>
                  <span style="font-size:0.7rem;">Auto.js</span>
                </button>
                <button class="fp-launcher-btn" data-fp-launcher="sistema" title="Sistema" style="display:flex; flex-direction:column; align-items:center; background:var(--bg-card); border:1px solid var(--border-color); padding:8px; border-radius:6px; cursor:pointer; color:var(--text-secondary);">
                  <svg viewBox="0 0 24 24" style="width:20px;height:20px;margin-bottom:4px;stroke:currentColor;fill:none;stroke-width:2;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
                  <span style="font-size:0.7rem;">Sistema</span>
                </button>
                <button class="fp-launcher-btn" data-fp-launcher="energia" title="Energia" style="display:flex; flex-direction:column; align-items:center; background:var(--bg-card); border:1px solid var(--border-color); padding:8px; border-radius:6px; cursor:pointer; color:var(--text-secondary);">
                  <svg viewBox="0 0 24 24" style="width:20px;height:20px;margin-bottom:4px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M12 2v10"/><path d="M5.5 7.5a8 8 0 1 0 13 0"/></svg>
                  <span style="font-size:0.7rem;">Energia</span>
                </button>
                <button class="fp-launcher-btn" data-fp-launcher="flowkeyboard" title="FlowKeyboard" style="display:flex; flex-direction:column; align-items:center; background:var(--bg-card); border:1px solid var(--border-color); padding:8px; border-radius:6px; cursor:pointer; color:var(--text-secondary);">
                  <svg viewBox="0 0 24 24" style="width:20px;height:20px;margin-bottom:4px;stroke:currentColor;fill:none;stroke-width:2;"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h.01M11 9h.01M15 9h.01M19 9h.01M7 13h.01M11 13h6M7 17h10"/></svg>
                  <span style="font-size:0.7rem;">FlowKeyboard</span>
                </button>
                <button class="fp-launcher-btn" data-fp-launcher="inspector" title="FlowDev Inspector" style="display:flex; flex-direction:column; align-items:center; background:var(--bg-card); border:1px solid var(--border-color); padding:8px; border-radius:6px; cursor:pointer; color:var(--text-secondary);">
                  <svg viewBox="0 0 24 24" style="width:20px;height:20px;margin-bottom:4px;stroke:currentColor;fill:none;stroke-width:2;"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>
                  <span style="font-size:0.7rem;">Inspector</span>
                </button>
              </div>
            </section>
          </aside>
          
          <section class="flowtouch-phone-stage">
            <div class="flowtouch-phone-frame">
              <canvas id="flowTouchCanvas-\${safeSerial}" class="flowtouch-focus-canvas"></canvas>
              <div class="flowtouch-gesture-layer" id="flowTouchGestureLayer">
                <span id="flowTouchCoordinateState">Coordenadas listas</span>
              </div>
            </div>
          </section>
          
          <aside class="flowtouch-log-panel" id="flowTouchLogPanelParent" style="display:none;">
            <div class="flowtouch-log-title">Historial</div>
            <div class="flowtouch-log-list" id="flowTouchLogList">
              <div>Focus abierto para \${this._escape(shortSerial)}</div>
              <div>Control tactil activo.</div>
            </div>
          </aside>
          
          <!-- Píldora flotante para Última Acción (Modo Limpio) -->
          <div class="flowtouch-floating-log" id="flowTouchFloatingLog" style="position:absolute; bottom:20px; right:20px; background:rgba(0,0,0,0.7); color:#fff; padding:6px 12px; border-radius:20px; font-size:0.75rem; pointer-events:none; opacity:0; transition:opacity 0.3s; z-index:1000;">
             Focus abierto
          </div>

        </main>
      </div>
    \`;

    document.body.appendChild(this.overlay);`;

content = content.replace(openFocusRegex, openFocusNew);

// Replacement 2: _bindFocusEvents
const bindEventsRegex = /_bindFocusEvents\(\) \{[\s\S]*?this\.keyHandler = \(event\)/;
const bindEventsNew = `_bindFocusEvents() {
    const closeBtn = this.overlay.querySelector('#flowTouchCloseBtn');
    const recordBtn = this.overlay.querySelector('#flowTouchRecordBtn');
    const backBtn = this.overlay.querySelector('#flowTouchBackBtn');
    const homeBtn = this.overlay.querySelector('#flowTouchHomeBtn');
    const recentsBtn = this.overlay.querySelector('#flowTouchRecentsBtn');
    const nameBtn = this.overlay.querySelector('#flowTouchDeviceNameBtn');
    const techModeSwitch = this.overlay.querySelector('#flowTouchTechModeSwitch');
    const techHeader = this.overlay.querySelector('#flowTouchTechHeader');
    const logPanelParent = this.overlay.querySelector('#flowTouchLogPanelParent');
    const shellEl = this.overlay.querySelector('.flowtouch-focus-shell');
    
    closeBtn?.addEventListener('click', () => this.closeFocus());
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

    const qualitySelect = this.overlay.querySelector('#flowTouchQualitySelect');
    if (qualitySelect) {
      const storedFocusQuality = localStorage.getItem('flowdashboard.focus.preset');
      const currentQuality = ['eco', 'balanced', 'pro'].includes(storedFocusQuality) ? storedFocusQuality : 'balanced';
      qualitySelect.value = currentQuality;
      qualitySelect.addEventListener('change', () => {
        const newPreset = qualitySelect.value;
        if (this.app && typeof this.app.setFocusQuality === 'function') {
          this._currentFocusPreset = newPreset;
          this.app.setFocusQuality(newPreset);
        }
      });
    }

    backBtn?.addEventListener('click', () => this._sendNavCommand('back'));
    homeBtn?.addEventListener('click', () => this._sendNavCommand('home'));
    recentsBtn?.addEventListener('click', () => this._sendNavCommand('recents'));
    nameBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.app?.openDeviceNamePopover?.(event, this.activeSerial);
    });

    this._bindProPanelApps();

    this.keyHandler = (event)`;

content = content.replace(bindEventsRegex, bindEventsNew);

// Replacment 3: _syncRecordingUi
const syncRecordingRegex = /_syncRecordingUi\(serial = this\.activeSerial\) \{[\s\S]*?\}\s*async _recordingRequest/;
const syncRecordingNew = `_syncRecordingUi(serial = this.activeSerial) {
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

  async _recordingRequest`;
content = content.replace(syncRecordingRegex, syncRecordingNew);

// Replacement 4: Auto-arm by default and remove auto-disarm if there was no switch
// Let's modify _autoArmControlSafely to immediately arm without the debounce since we are implicit now.
// We also need to fix _appendLog to show the floating log.
const appendLogRegex = /_appendLog\(msg\) \{[\s\S]*?list\.lastElementChild\.remove\(\);\s*\}/;
const appendLogNew = `_appendLog(msg) {
    if (!this.overlay) return;
    const list = this.overlay.querySelector('#flowTouchLogList');
    if (list) {
      const line = document.createElement('div');
      const time = new Date().toLocaleTimeString('es-ES', { hour12: false });
      line.textContent = '[' + time + '] ' + msg;
      list.prepend(line);
      while (list.children.length > 20) {
        list.lastElementChild.remove();
      }
    }
    const floating = this.overlay.querySelector('#flowTouchFloatingLog');
    if (floating) {
      floating.textContent = msg;
      floating.style.opacity = '1';
      if (this._floatingLogTimer) clearTimeout(this._floatingLogTimer);
      this._floatingLogTimer = setTimeout(() => {
         floating.style.opacity = '0';
      }, 3000);
    }
  }`;
content = content.replace(appendLogRegex, appendLogNew);

const autoArmRegex = /async _autoArmControlSafely\(serial\) \{[\s\S]*?this\._armControlSafely\(\);\s*\}/;
const autoArmNew = `async _autoArmControlSafely(serial) {
    // Modo Limpio: siempre armamos implicitamente al entrar.
    this.enableControl(serial);
  }`;
content = content.replace(autoArmRegex, autoArmNew);

fs.writeFileSync(path, content, 'utf8');
console.log('Update successful');
