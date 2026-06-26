// FlowDashboard - Electron App
// PHASE 1: Connection, Device Grid, Account Status Dots
// PHASE 2: Categories, Accounts Panel, ADB Commands

const CSHARP_API = 'http://localhost:5000/api';
const PYTHON_API = 'http://localhost:8765';

const CATEGORIES = [
  { id: 'FlowLogin', color: '#14b8a6', label: 'FlowLogin', enabled: true, icon: '<svg viewBox="0 0 24 24"><path d="M5 19V9" /><path d="M12 19V5" /><path d="M19 19v-7" /><path d="M3 19h18" /></svg>' },
  { id: 'FlowRegister', color: '#10b981', label: 'FlowRegister', enabled: true, icon: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>' },
  { id: 'FlowTrack', color: '#22b86f', label: 'FlowTrack', enabled: false, icon: '<svg viewBox="0 0 24 24"><path d="M12 12 4 20" /><path d="M12 12l8-8" /><circle cx="12" cy="12" r="3" /><path d="M7 17c3 3 7 3 10 0" /></svg>' },
  { id: 'FlowCache', color: '#f59e0b', label: 'FlowCache', enabled: false, icon: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="5" rx="1.5" /><rect x="4" y="14" width="16" height="5" rx="1.5" /><path d="M8 10v4" /><path d="M16 10v4" /></svg>' },
  { id: 'FlowCast', color: '#a78bfa', label: 'FlowCast', enabled: false, icon: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /><path d="M8 21h8" /></svg>' },
  { id: 'FlowApple', color: '#fa2d75', label: 'FlowApple', enabled: false, icon: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="4" /><path d="M14 8v7.2a2.8 2.8 0 1 1-1.7-2.6" /><path d="M14 8h4" /></svg>' },
  { id: 'Flowamazon', color: '#ff9900', label: 'Flowamazon', enabled: false, icon: '<svg viewBox="0 0 24 24"><path d="M4 7h6l2 2h8v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M8 15c2.5 2 5.5 2 8 0" /></svg>' },
  { id: 'FlowGram', color: '#e1306c', label: 'FlowGram', enabled: false, icon: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="12" cy="12" r="4" /><circle cx="17" cy="7" r="1" /></svg>' },
  { id: 'FlowTikTok', color: '#000000', label: 'FlowTikTok', enabled: false, icon: '<svg viewBox="0 0 24 24"><path d="M9 12a4 4 0 1 0 4 4V6a5 5 0 0 0 5 5" /></svg>' }
];

class FlowDashboardApp {
  constructor() {
    this.devices = [];
    this.selectedDeviceIds = new Set();
    this.deviceNames = {};
    this.deviceMeta = {};
    this.deviceNumbers = JSON.parse(localStorage.getItem('flowdashboard.deviceNumbers') || '{}');
    this.deviceAccounts = {}; // { serial: { person: string, accounts: [] } }
    this.loginStatuses = {}; // { serial: { clone1: {status, line, ...}, clone2: ... } }
    this.deviceGroups = { groups: [], assignments: {}, order: [], active: 'all' };
    this.deviceViewMode = localStorage.getItem('flowdashboard.electron.deviceViewMode') || 'live';
    this.livePreviewEnabled = localStorage.getItem('flowdashboard.livePreviewEnabled') !== 'false';
    this.deviceZoom = parseInt(localStorage.getItem('flowdashboard.electron.deviceZoom') || '178', 10);
    this.deviceGap = parseInt(localStorage.getItem('flowdashboard.electron.deviceGap') || '16', 10);
    this.streams = [];
    this.connected = false;
    this.pythonConnected = false;
    this.pollingInterval = null;
    this.statusPollingInterval = null;
    this.actionsPinned = localStorage.getItem('flowdashboard.actionsPinned') === 'true';
    this.flowCategoryPinned = localStorage.getItem('flowdashboard.flowCategoryPinned') === 'true';
    this.toolsOpen = localStorage.getItem('flowdashboard.toolsOpen') === 'true';
    this.flowTrackNameStatus = 'Listo';
    this.flowTrackNameTone = '';
    this.flowTrackNameLastLaunch = '';
    this.flowMailStatus = {
      configured: false,
      connected: false,
      status: 'not_configured',
      email: localStorage.getItem('flowdashboard.flowmail.email') || '',
      message: 'Mail no configurado.'
    };
    this._publicIpRefreshInFlight = new Set();
    this.deviceRuntimeState = {};
    
    // Performance profile (canvas WebP)
    this.performanceProfile = {
      maxSize: parseInt(localStorage.getItem('flowdashboard.perf.maxSize') || '480', 10),
      maxFps: parseInt(localStorage.getItem('flowdashboard.perf.maxFps') || '24', 10),
      bitRate: localStorage.getItem('flowdashboard.perf.bitRate') || '2M',
      ultraLight: localStorage.getItem('flowdashboard.perf.ultraLight') === 'true'
    };
    
    // Context menu state
    this.contextMenuDevice = null;
    this.contextMenuDevices = [];
    
    // Account editor state
    this.accountEditorSerial = null;
    
    // Account management state
    this.accounts = {
      total: localStorage.getItem('flowdashboard.accounts.total') || '',
      valid: localStorage.getItem('flowdashboard.accounts.valid') || '',
      invalid: localStorage.getItem('flowdashboard.accounts.invalid') || ''
    };
    this.activeAccountTab = 'total';
    this.delimiter = localStorage.getItem('flowdashboard.delimiter') || ':';
    this.divideCount = parseInt(localStorage.getItem('flowdashboard.divideCount') || '10', 10);
    
    // Register accounts state
    this.registerAccounts = {
      total: localStorage.getItem('flowdashboard.register.total') || '',
      valid: localStorage.getItem('flowdashboard.register.valid') || '',
      invalid: localStorage.getItem('flowdashboard.register.invalid') || ''
    };
    this.activeRegisterTab = 'total';
    this.registerCountPerDevice = parseInt(localStorage.getItem('flowdashboard.register.countPerDevice') || '5', 10);
    
    // Inicializar StreamRenderer para canvas WebP
    this.streamRenderer = new StreamRenderer(this);

    // @Added Etapa C (Streaming Pro) - H.264 / WebCodecs.
    //   Reemplaza la captura WebP+MediaProjection del FlowAgent (rota por
    //   FLAG_SECURE) por sockets H.264 RAW directos al scrcpy-server.jar v4.0.
    //   Backend: scrcpy_raw_ws_server.py en puerto 8768.
    //   Esto bypasea FLAG_SECURE para apps protegidas como Spotify.
    const initialGridPreset = this.getGridPresetForZoom(this.deviceZoom);
    localStorage.setItem('flowdashboard.grid.preset', initialGridPreset);
    this.h264Renderer = (typeof H264StreamRenderer !== 'undefined')
      ? new H264StreamRenderer({
          wsUrl: 'ws://127.0.0.1:8768',
          defaultPreset: initialGridPreset,
          onError: (err, serial) => console.warn(`[H264] ${serial}:`, err.message || err),
          onFps: (info) => {
            // console.debug(`[H264] ${info.serial}: ${info.fps.toFixed(1)} fps`);
          },
        })
      : null;
    console.log('[H264] h264Renderer:', this.h264Renderer ? 'OK wsUrl=ws://127.0.0.1:8768' : 'NULL (H264StreamRenderer no definido)');
    
    // Mapa androidId -> serialIP para resolver frames
    this.deviceMappings = {}; // { androidId: serialIP }
    this.appVersion = '2.0.0';
    this.flowKeyboardStatuses = [];
    
    // Modo desarrollador
    this.isFlowDevEnabled = localStorage.getItem('flowdashboard.devMode') === '1';
    this.devMode = this.isFlowDevEnabled;
    this.devInspector = null; // se inicializa en init() después de renderUI
    
    this.init();
  }

  async init() {
    console.log('🚀 Iniciando FlowDashboard...');
    await this.loadAppVersion();
    this.updateRegisterAccountCounts();
    
    // Renderizar UI PRIMERO (todos los elementos del DOM deben existir)
    this.renderUI();
    
    // Inicializar DevInspector después de que el DOM exista
    this.devInspector = new DevInspector(this);
    this.flowTouch = window.FlowTouchController ? new FlowTouchController(this) : null;
    this.initFlowScriptApi();
    this.loadFlowMailStatus();
    this._applyDevMode(false); // aplicar estado inicial sin animación
    
    // Conectar StreamRenderer ANTES de cargar dispositivos
    console.log('📡 Iniciando conexión WebSocket de streaming...');
    await this.streamRenderer.connectToStreamSocket();
    
    await this.checkConnections();
    await this.loadDevices();
    
    // Crear canvas DESPUÉS de que WebSocket esté conectado y dispositivos cargados
    if (this.livePreviewEnabled) {
      this.createCanvasesForVisibleDevices();
    }
    
    this.startPolling();
    this.setupGlobalListeners();
  }

  async loadAppVersion() {
    if (window.electronAPI.getAppVersion) {
      try {
        const version = await window.electronAPI.getAppVersion();
        if (version) this.appVersion = version;
      } catch (error) {
        console.warn('No se pudo obtener versión desde Electron:', error);
      }
    }
  }

  renderUI() {
    const app = document.getElementById('app');
    
    // Crear capa de overlay global si no existe
    let overlayLayer = document.getElementById('overlay-layer');
    if (!overlayLayer) {
      overlayLayer = document.createElement('div');
      overlayLayer.id = 'overlay-layer';
      document.body.appendChild(overlayLayer);
    }
    
    app.innerHTML = `
      <div class="app-container">
        <!-- Titlebar -->
        <div class="titlebar">
          <div class="titlebar-title">
            <img src="../../assets/icon.png" class="titlebar-icon" alt="">
            <span>FlowDashboard</span>
            <span class="titlebar-version">v${this.appVersion}</span>
          </div>
          <div class="titlebar-status">
            <div class="status-pill" id="statusPill" onclick="app.toggleStatusPanel()" title="Ver estado de conexión">
              <span class="status-dot"></span>
              <span id="statusText">Desconectado</span>
            </div>
            <!-- Status dropdown panel -->
            <div class="status-panel" id="statusPanel" style="display:none;">
              <div class="status-panel-row">
                <span class="status-panel-label">ADB / C#</span>
                <span class="status-panel-val" id="spAdb">—</span>
              </div>
              <div class="status-panel-row">
                <span class="status-panel-label">Python</span>
                <span class="status-panel-val" id="spPython">—</span>
              </div>
              <div class="status-panel-row">
                <span class="status-panel-label">WebSocket</span>
                <span class="status-panel-val" id="spWs">—</span>
              </div>
              <div class="status-panel-row">
                <span class="status-panel-label">Dispositivos</span>
                <span class="status-panel-val" id="spDevices">0</span>
              </div>
              <div class="status-panel-row">
                <span class="status-panel-label">Seleccionados</span>
                <span class="status-panel-val" id="spSelected">0</span>
              </div>
              <div class="status-panel-row">
                <span class="status-panel-label">Frames/s</span>
                <span class="status-panel-val" id="spFps">—</span>
              </div>
              <div class="status-panel-divider"></div>
              <button class="status-panel-btn" onclick="app.checkConnections(); app.closeStatusPanel()">
                <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" fill="none" stroke-width="2">
                  <path d="M3 12a9 9 0 0 1 15-6.7"/><path d="M18 3v6h-6"/>
                  <path d="M21 12a9 9 0 0 1-15 6.7"/><path d="M6 21v-6h6"/>
                </svg>
                Reconectar
              </button>
            </div>
          </div>
          <div class="titlebar-controls">
            <button class="titlebar-btn" onclick="app.minimize()" title="Minimizar" aria-label="Minimizar">
              <svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>
            </button>
            <button class="titlebar-btn" onclick="app.maximize()" title="Maximizar" aria-label="Maximizar">
              <svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>
            </button>
            <button class="titlebar-btn close" onclick="app.close()" title="Cerrar" aria-label="Cerrar">
              <svg viewBox="0 0 24 24"><path d="m7 7 10 10"/><path d="m17 7-10 10"/></svg>
            </button>
          </div>
        </div>

        <!-- Main Layout: Sidebar + Content -->
        <div class="main-layout">
          <!-- Left Sidebar -->
          <div class="sidebar" id="sidebar">
            <!-- Sidebar Header -->
            <div class="sidebar-header">
              <img src="../../assets/logo.png" class="sidebar-logo" alt="FlowDashboard">
              <div class="sidebar-version">v${this.appVersion}</div>
              <!-- Toggle Modo Normal / Dev -->
              <div class="dev-mode-toggle" id="devModeToggle"
                   role="switch" aria-checked="false"
                   onclick="app.toggleDevMode()"
                   title="Cambiar entre Modo Normal y Modo Desarrollador">
                <span class="dev-toggle-option" id="devToggleNormal">
                  <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2">
                    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                  </svg>
                </span>
                <span class="dev-toggle-pill" id="devTogglePill"></span>
                <span class="dev-toggle-option" id="devToggleDev">
                  <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2">
                    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                  </svg>
                </span>
              </div>
            </div>

            <!-- Dispositivos Section (Collapsible) -->
            <div class="sidebar-section" id="dispositivosSection">
              <div class="sidebar-section-header-static dispositivos-header"
                   style="cursor:pointer; user-select:none;"
                   onclick="app.toggleDispositivosSection()">
                <span class="sidebar-category-icon" style="color:#4f8dff;">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2"/>
                    <line x1="12" y1="18" x2="12.01" y2="18"/>
                  </svg>
                </span>
                <span class="sidebar-section-title">Dispositivos</span>
                <span class="counter" id="deviceCount">0</span>
                <svg class="sidebar-collapse-arrow" id="dispositivosArrow" viewBox="0 0 24 24">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>
              <div class="sidebar-section-content-static" id="dispositivosSectionContent" style="padding: 8px 12px; display: none;">
                <div id="selectedCount" style="font-size: 0.75rem; color: var(--muted); text-align: center; margin-bottom: 8px;">
                  0 seleccionados
                </div>
                <div class="device-actions-row">
                  <button class="btn-icon-small" onclick="app.refreshDevices()" title="Actualizar">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 12a9 9 0 0 1 15-6.7"/><path d="M18 3v6h-6"/>
                      <path d="M21 12a9 9 0 0 1-15 6.7"/><path d="M6 21v-6h6"/>
                    </svg>
                  </button>
                  <button class="btn-icon-small live-preview-toggle ${this.livePreviewEnabled ? 'is-active' : ''}" onclick="app.toggleLivePreview()" title="Vista viva">
                    Live
                  </button>
                  <button class="btn-icon-small ${this.deviceViewMode === 'grid' ? 'is-active' : ''}" onclick="app.setDeviceViewMode('grid')" title="Vista tarjetas">
                    Grid
                  </button>
                  <button class="btn-icon-small" onclick="app.selectAll()" title="Seleccionar todos">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="4" y="4" width="16" height="16" rx="2"/>
                      <path d="M8 12.5 10.8 15 16 9"/>
                    </svg>
                  </button>
                  <button class="btn-icon-small" onclick="app.deselectAll()" title="Deseleccionar todos">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="4" y="4" width="16" height="16" rx="2"/>
                      <path d="m9 9 6 6"/><path d="m15 9-6 6"/>
                    </svg>
                  </button>
                </div>
                <div class="device-zoom-row">
                  <span>Zoom</span>
                  <input id="deviceZoomSlider" type="range" min="60" max="500" value="${this.deviceZoom}" oninput="app.setDeviceZoom(this.value)">
                </div>
                <div class="device-zoom-row">
                  <span>Gap</span>
                  <input id="deviceGapSlider" type="range" min="0" max="60" value="${this.deviceGap || 16}" oninput="app.setDeviceGap(this.value)">
                </div>
                
                <!-- FlowCategory chips (categorías de dispositivos) -->
                <div style="margin-top: 10px; border-top: 1px solid rgba(0,245,212,0.08); padding-top: 10px;">
                  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; padding: 0 2px;">
                    <span style="font-size:0.68rem; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Categorías</span>
                    <button class="btn-icon-small" onclick="event.stopPropagation(); app.openCategoryPopover(event)" title="Nueva categoría" style="width:18px;height:18px;font-size:0.8rem;">+</button>
                  </div>
                  <div class="device-category-filter-list" id="deviceCategoryFilters" style="padding:0 !important;">
                    ${this.renderDeviceCategoryFilters()}
                  </div>
                </div>

              </div>
            </div>

            ${this.renderNetworkScannerSection()}

            ${this.renderActionsSection()}

            <div class="sidebar-section" id="flowCategorySection">
              <div class="sidebar-section-header-static" 
                   style="cursor:pointer; user-select:none;"
                   onclick="app.toggleFlowCategorySection()">
                <span class="sidebar-category-icon" style="color:#00F5D4;">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                  </svg>
                </span>
                <span class="sidebar-section-title">FlowCategory</span>
                <svg class="sidebar-collapse-arrow" id="flowCategoryArrow" viewBox="0 0 24 24">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>
              <div class="sidebar-section-content-static" id="flowCategorySectionContent" style="display: none; padding: 0;">
                <div class="flowcategory-pin-wrap">
                  <label class="actions-pin-toggle flowcategory-pin-toggle">
                    <input type="checkbox" ${this.flowCategoryPinned ? 'checked' : ''} onchange="app.toggleFlowCategoryPinned(this.checked)">
                    <span class="actions-pin-check" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
                    </span>
                    <span>Fijar en Main Screen</span>
                  </label>
                </div>

                <!-- FlowLogin (dentro de FlowCategory) -->
                <div class="sidebar-section flow-section" style="--flow-color: #14b8a6; border-bottom: 1px solid rgba(0,245,212,0.06);">
                  <div class="sidebar-section-header" onclick="app.toggleSection('flowlogin')">
                    <span class="sidebar-category-icon" style="color: #14b8a6;">
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 19V9" /><path d="M12 19V5" /><path d="M19 19v-7" /><path d="M3 19h18" />
                      </svg>
                    </span>
                    <span class="sidebar-section-title" style="flex:1;">FlowLogin</span>
                    <button class="sidebar-section-play ${this.runningFlow === 'FlowLogin' ? 'is-running' : ''}"
                            onclick="event.stopPropagation(); app.toggleFlow('FlowLogin')"
                            title="${this.runningFlow === 'FlowLogin' ? 'Detener' : 'Ejecutar'} FlowLogin">
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        ${this.runningFlow === 'FlowLogin' ? '<path d="M7 7h10v10H7z" />' : '<path d="m8 5 11 7-11 7V5Z" />'}
                      </svg>
                    </button>
                    <svg class="sidebar-collapse-arrow" id="flowlogin-icon" viewBox="0 0 24 24">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </div>
                  <div class="sidebar-section-content is-collapsed" id="flowlogin-content">
                    <div class="account-tabs-sidebar">
                      <button class="account-tab-sidebar ${this.activeAccountTab === 'total' ? 'is-active' : ''}" onclick="app.switchAccountTab('total')" data-tab="total">
                        <span>Total</span><span class="tab-counter" id="totalCount">0</span>
                      </button>
                      <button class="account-tab-sidebar ${this.activeAccountTab === 'valid' ? 'is-active' : ''}" onclick="app.switchAccountTab('valid')" data-tab="valid">
                        <span>Validos</span><span class="tab-counter" id="validCount">0</span>
                      </button>
                      <button class="account-tab-sidebar ${this.activeAccountTab === 'invalid' ? 'is-active' : ''}" onclick="app.switchAccountTab('invalid')" data-tab="invalid">
                        <span>No validos</span><span class="tab-counter" id="invalidCount">0</span>
                      </button>
                    </div>
                    <div class="accounts-textareas-wrapper">
                      <textarea id="accountsTextareaTotal" class="accounts-textarea-sidebar ${this.activeAccountTab === 'total' ? '' : 'is-tab-hidden'}" placeholder="email:password (Total)" oninput="app.onAccountsChange('total')">${this.accounts.total}</textarea>
                      <textarea id="accountsTextareaValid" class="accounts-textarea-sidebar ${this.activeAccountTab === 'valid' ? '' : 'is-tab-hidden'}" placeholder="email:password (Validos)" oninput="app.onAccountsChange('valid')">${this.accounts.valid}</textarea>
                      <textarea id="accountsTextareaInvalid" class="accounts-textarea-sidebar ${this.activeAccountTab === 'invalid' ? '' : 'is-tab-hidden'}" placeholder="email:password (No validos)" oninput="app.onAccountsChange('invalid')">${this.accounts.invalid}</textarea>
                    </div>
                    <div class="divide-controls-sidebar">
                      <div style="display:flex; gap:6px; align-items:center; margin-bottom:8px;">
                        <label style="font-size:0.75rem;">Delim:</label>
                        <input type="text" id="delimiter" value="${this.delimiter}" maxlength="1" style="width:30px;text-align:center;font-size:0.8rem;" oninput="app.onDelimiterChange(this.value)">
                        <label style="font-size:0.75rem;">Dividir:</label>
                        <input type="number" id="divideCount" value="${this.divideCount}" min="1" max="10" style="width:45px;font-size:0.8rem;" oninput="app.onDivideCountChange(this.value)">
                      </div>
                      <button class="btn-sidebar" onclick="app.divideAccounts()" style="background:var(--accent);width:100%;">Dividir y Asignar</button>
                      <button class="btn-sidebar" onclick="app.openAccountsHistoryModal()" style="margin-top:6px;width:100%;background:rgba(20,184,166,0.1);color:var(--accent);border:1px solid rgba(20,184,166,0.3);">Historial de Cuentas</button>

                      <div class="flowmail-config">
                        <div class="flowmail-title">configuracion de mail app:</div>
                        <input type="email" id="flowMailEmail" class="flowmail-input" placeholder="Email" value="${this.escapeHtml(this.flowMailStatus.email || '')}" autocomplete="username">
                        <input type="password" id="flowMailPassword" class="flowmail-input" placeholder="Contraseña app" autocomplete="new-password">
                        <button class="btn-sidebar flowmail-connect-btn" id="flowMailConnectBtn" onclick="app.connectFlowMail()">Conectar</button>
                        <div class="flowmail-status" id="flowMailStatus">${this.escapeHtml(this.flowMailStatus.message || 'Mail no configurado.')}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Resto de flows (FlowRegister, FlowTrack, etc.) -->
                ${this.renderOtherFlowCategories()}

              </div>
            </div>

            <div class="sidebar-section tools-sidebar-section" id="toolsSection">

              <div class="sidebar-section-header-static tools-section-header"
                   onclick="app.toggleToolsSection()">
                <span class="sidebar-category-icon" style="color:#22c55e;">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.8 17.2a2 2 0 0 0 2.8 2.8l5.5-5.5a4 4 0 0 0 5.4-5.4l-2.8 2.8-2.1-2.1 2.8-2.8Z"/>
                    <path d="M16 19h5"/>
                    <path d="M18.5 16.5v5"/>
                  </svg>
                </span>
                <span class="sidebar-section-title">Tools</span>
                <svg class="sidebar-collapse-arrow" id="toolsArrow" viewBox="0 0 24 24" style="transform:${this.toolsOpen ? 'rotate(0deg)' : 'rotate(-90deg)'}">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>

              <div class="sidebar-section-content-static tools-section-content" id="toolsSectionContent" style="display:${this.toolsOpen ? 'block' : 'none'};">
                <button class="tool-menu-item flowtrackname-tool" onclick="app.openFlowTrackNamePanel()" title="Abrir FlowTrackName">
                  <span class="tool-menu-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M9 18V5l12-2v13"/>
                      <circle cx="6" cy="18" r="3"/>
                      <circle cx="18" cy="16" r="3"/>
                      <path d="M12 8h5"/>
                    </svg>
                  </span>
                  <span>FlowTrackName</span>
                  <span class="tool-menu-status ${this.flowTrackNameTone ? `is-${this.flowTrackNameTone}` : ''}"></span>
                </button>
              </div>

            </div>

            <div class="sidebar-section">
              <div class="sidebar-section-header sidebar-link-header" onclick="app.openPlansModal()">
                <span class="sidebar-category-icon" style="color:#6ee7ff;">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="14" rx="2"/>
                    <path d="M3 10h18"/>
                    <path d="M7 15h2"/>
                    <path d="M11 15h3"/>
                  </svg>
                </span>
                <span class="sidebar-section-title">Planes</span>
                <svg class="sidebar-link-arrow" viewBox="0 0 24 24">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
            </div>

            <div class="sidebar-section">
              <div class="sidebar-section-header" onclick="app.toggleSection('settings')">
                <span class="sidebar-category-icon" style="color:#34d399;">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2v3"/><path d="M12 19v3"/><path d="M4.93 4.93l2.12 2.12"/><path d="M16.95 16.95l2.12 2.12"/><path d="M2 12h3"/><path d="M19 12h3"/><path d="M4.93 19.07l2.12-2.12"/><path d="M16.95 7.05l2.12-2.12"/><circle cx="12" cy="12" r="4"/>
                  </svg>
                </span>
                <span class="sidebar-section-title">Configuración</span>
                <svg class="sidebar-collapse-arrow" id="settings-icon" viewBox="0 0 24 24">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>
              <div class="sidebar-section-content is-collapsed" id="settings-content">
                <div class="sidebar-section flow-section settings-subsection" style="--flow-color:#4f8dff;">
                  <div class="sidebar-section-header" onclick="app.toggleSection('flowvideo')">
                    <span class="sidebar-category-icon" style="color:#4f8dff;">
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="5" width="18" height="12" rx="2"/>
                        <path d="m10 9 5 3-5 3z"/>
                      </svg>
                    </span>
                    <span class="sidebar-section-title" style="flex:1;">FlowVideo</span>
                    <svg class="sidebar-collapse-arrow" id="flowvideo-icon" viewBox="0 0 24 24">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </div>
                  <div class="sidebar-section-content is-collapsed" id="flowvideo-content">
                    <button class="btn-sidebar settings-action-btn" onclick="app.openPerformancePanel()" style="width:100%;">
                      <span class="settings-action-icon">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M4 19h16"/><path d="M6 16V9"/><path d="M12 16V5"/><path d="M18 16v-3"/>
                        </svg>
                      </span>
                      <span>Abrir panel FlowVideo</span>
                    </button>
                    <button class="btn-sidebar settings-action-btn" onclick="setupFlowAgentAll()" id="setupFlowAgentBtn" style="width:100%; margin-top:8px;">
                      <span class="settings-action-icon">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="5" y="2" width="14" height="20" rx="2"/>
                          <path d="M12 18h.01"/>
                          <path d="M8 6h8"/>
                        </svg>
                      </span>
                      <span>Preparar FlowAgent</span>
                    </button>
                    <button class="btn-sidebar settings-action-btn" onclick="app.startStreaming()" id="startStreamBtn" style="width:100%; margin-top:8px;">
                      <span class="settings-action-icon">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="3" y="5" width="18" height="12" rx="2"/>
                          <path d="m10 9 5 3-5 3z"/>
                        </svg>
                      </span>
                      <span>Iniciar Streaming</span>
                    </button>
                    <div id="streamControlsSidebar" class="flowvideo-stream-status">Selecciona dispositivos</div>
                  </div>
                </div>
                <div class="sidebar-section flow-section settings-subsection" style="--flow-color:#a78bfa;">
                  <div class="sidebar-section-header" onclick="app.toggleSection('flowkeyboard')">
                    <span class="sidebar-category-icon" style="color:#a78bfa;">
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="5" width="18" height="14" rx="2"/>
                        <path d="M7 9h.01M11 9h.01M15 9h.01M19 9h.01M7 13h.01M11 13h6M7 17h10"/>
                      </svg>
                    </span>
                    <span class="sidebar-section-title" style="flex:1;">FlowKeyboard</span>
                    <svg class="sidebar-collapse-arrow" id="flowkeyboard-icon" viewBox="0 0 24 24">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </div>
                  <div class="sidebar-section-content is-collapsed" id="flowkeyboard-content">
                    <div class="flowkeyboard-panel">
                      <div class="flowkeyboard-head">
                        <span>FlowKeyboard</span>
                        <button class="flowkeyboard-mini-btn" onclick="app.refreshFlowKeyboardStatus()" title="Verificar estado">
                          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2">
                            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                            <path d="M3 21v-5h5"/>
                            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                            <path d="M21 3v5h-5"/>
                          </svg>
                        </button>
                      </div>
                      <div id="flowKeyboardStatusText" class="flowkeyboard-status">Sin verificar</div>
                      <div class="flowkeyboard-actions">
                        <button class="btn-sidebar flowkeyboard-action-btn" onclick="app.prepareFlowKeyboardSelected()">Preparar seleccionados</button>
                      </div>
                      <div class="flowkeyboard-test-row">
                        <input id="flowKeyboardTestInput" class="flowkeyboard-test-input" type="text" placeholder="Texto de prueba">
                        <button class="flowkeyboard-mini-btn" onclick="app.testFlowKeyboardType()" title="Enviar texto de prueba">
                          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2">
                            <path d="m22 2-7 20-4-9-9-4Z"/>
                            <path d="M22 2 11 13"/>
                          </svg>
                        </button>
                      </div>
                      <div id="flowKeyboardLastResult" class="flowkeyboard-result">Accion manual, nunca automatica.</div>
                    </div>
                  </div>
                </div>
                <div class="sidebar-section flow-section settings-subsection" style="--flow-color:#45caff;">
                  <div class="sidebar-section-header" onclick="app.toggleSection('flowtouch')">
                    <span class="sidebar-category-icon" style="color:#45caff;">
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 11V6a3 3 0 0 1 6 0v6"/>
                        <path d="M9 11H7a4 4 0 0 0-4 4v3a4 4 0 0 0 4 4h6.5a3.5 3.5 0 0 0 3.5-3.5V13a2 2 0 0 0-2-2"/>
                        <path d="M12 13v3"/>
                      </svg>
                    </span>
                    <span class="sidebar-section-title" style="flex:1;">FlowTouch</span>
                    <svg class="sidebar-collapse-arrow" id="flowtouch-icon" viewBox="0 0 24 24">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </div>
                  <div class="sidebar-section-content is-collapsed" id="flowtouch-content">
                    <div class="flowtouch-info-panel">
                      <div class="flowtouch-info-head">FlowTouch</div>
                      <div class="flowtouch-info-text">
                        Doble click sobre una tarjeta abre Focus Mode. El control queda Off por defecto;
                        usa el boton <b>Activar control</b> dentro de la vista para enviar gestos al telefono enfocado.
                      </div>
                      <ul class="flowtouch-info-list">
                        <li><b>Click</b> = tap</li>
                        <li><b>Drag</b> = swipe (Shift+drag = mas lento)</li>
                        <li><b>Mantener click</b> o <b>Ctrl+click</b> = long press</li>
                        <li><b>Doble click</b> = doble tap</li>
                        <li><b>Rueda</b> = scroll vertical</li>
                        <li><b>Back / Home / Recents</b> = botones del quickbar</li>
                        <li><b>Esc</b> = cerrar Focus Mode</li>
                      </ul>
                      <div class="flowtouch-info-foot">Sin control armado todo es diagnostico local: nada se envia a Android.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="sidebar-section">
              <div class="sidebar-section-header sidebar-link-header" onclick="app.openHelpModal()">
                <span class="sidebar-category-icon" style="color:#a78bfa;">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3"/>
                    <path d="M12 17h.01"/>
                  </svg>
                </span>
                <span class="sidebar-section-title">Help</span>
                <svg class="sidebar-link-arrow" viewBox="0 0 24 24">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
            </div>

            <div class="sidebar-section" style="display:none;">
              <div class="sidebar-section-header" onclick="app.toggleSection('streaming')">
                <span class="sidebar-section-icon" id="streaming-icon-hidden">▶</span>
                <span class="sidebar-category-icon" style="color:#4f8dff;">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="4" width="20" height="14" rx="2"/>
                    <path d="m10 9 5 3-5 3z"/>
                    <path d="M8 21h8"/>
                  </svg>
                </span>
                <span class="sidebar-section-title">Streaming</span>
              </div>
              <div class="sidebar-section-content is-collapsed" id="streaming-content-hidden">
                <button class="btn-sidebar" onclick="app.startStreaming()" id="startStreamBtnHidden" style="width: 100%; margin-bottom: 8px;">
                  Iniciar Streaming
                </button>
                <div id="streamControlsSidebarHidden" style="font-size: 0.75rem; color: var(--muted);">
                  Selecciona dispositivos
                </div>
              </div>
            </div>

            <div class="sidebar-footer-info">
              <div class="sidebar-footer-email">ing.estebandaza@gmai.com</div>
              <div class="sidebar-footer-icons">
                <button class="sidebar-footer-icon-btn" title="Login">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </button>
                <button class="sidebar-footer-icon-btn" title="Licencia" onclick="app.openLicensePanel()">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m21 2-2 2m-7.61 7.61a2 2 0 1 1-2.83-2.83l6.8-6.8a2 2 0 1 1 2.83 2.83z"/>
                    <path d="m7.5 12.5-5 5a2.12 2.12 0 0 0 3 3l5-5"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Main Content Area -->
          <div class="main-area">
            <!-- Modo Normal: Device Grid -->
            <div id="normalView">
              <div class="main-pinned-stack ${this.actionsPinned || this.flowCategoryPinned ? 'is-visible' : ''}" id="mainPinnedStack">
                <div class="main-flowcategory-pinned ${this.flowCategoryPinned ? 'is-visible' : ''}" id="mainFlowCategoryPinned">
                  ${this.renderPinnedFlowCategoryBar()}
                </div>
                <div class="main-actions-pinned ${this.actionsPinned ? 'is-visible' : ''}" id="mainActionsPinned">
                  ${this.renderPinnedActionsBar()}
                </div>
              </div>
              <div class="device-grid-container">
                <div class="device-list" id="deviceList" onmousedown="app.deviceGridRubberBandStart(event)">
                  <div class="loading">Cargando dispositivos...</div>
                </div>
              </div>
              <div id="streamGrid" style="display: none; margin-top: 16px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px;"></div>
            </div>

            <!-- Modo Desarrollador: Inspector View -->
            <div id="inspectorView" style="display:none; height:100%; flex-direction:column;">
              <!-- Toolbar del inspector -->
              <div class="inspector-toolbar" id="inspectorToolbar">
                <select id="inspectorDeviceSelect" class="inspector-device-select">
                  <option value="" disabled selected>Selecciona un dispositivo...</option>
                </select>
                <div class="inspector-detection-group" id="inspectorDetectionGroup">
                  <button class="inspector-method-btn is-active" id="btnMethodNative"
                          onclick="app.devInspector.setDetectionGroup('native')"
                          title="Métodos de detección nativos (ADB)">
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2">
                      <rect x="4" y="4" width="16" height="16" rx="2"/>
                      <path d="M9 9h6M9 12h6M9 15h4"/>
                    </svg>
                    Nativa
                  </button>
                  <button class="inspector-method-btn" id="btnMethodWeb"
                          onclick="app.devInspector.setDetectionGroup('web')"
                          title="Métodos de detección web (CDP, WebView)">
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                    Web
                  </button>
                  <select id="inspectorMethodSelect" class="inspector-method-select">
                    <option value="uiautomator">UIAutomator Dump</option>
                    <option value="accessibility">Accessibility Service</option>
                    <option value="dumpsys">Dumpsys Window</option>
                    <option value="viewserver">View Server</option>
                    <option value="screencap_ocr">Screencap + OCR</option>
                    <option value="pm_dump">Package Manager</option>
                    <option value="logcat">Logcat Filter</option>
                  </select>
                </div>
                <button class="inspector-btn inspector-btn--primary" onclick="app.devInspector.captureUI()" id="btnCaptureUI">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  Capturar UI
                </button>
                <button class="inspector-btn inspector-btn--secondary" onclick="app.devInspector.autoDetect()" id="btnAutoDetect">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  Auto-detectar
                </button>
                <button class="inspector-btn inspector-btn--warning" id="btnFallback"
                        onclick="app.devInspector.toggleFallback()">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  Fallback
                </button>
                <span class="inspector-method-label" id="inspectorMethodLabel">UIAutomator Dump</span>
              </div>

              <!-- Tres paneles: Arbol | Preview | Propiedades -->
              <div class="inspector-panels" id="inspectorPanels">

                <!-- Panel izquierdo: Arbol UI -->
                <div class="inspector-panel inspector-panel--left" id="inspectorPanelTree">
                  <div class="inspector-panel-header">
                    <span class="inspector-panel-title">Arbol UI</span>
                    <div class="inspector-search-row">
                      <input type="text" id="inspectorSearchInput"
                             class="inspector-search-input"
                             placeholder="Buscar elemento..."
                             oninput="app.devInspector.onSearchInput(this.value)">
                      <select id="inspectorSearchField" class="inspector-search-field"
                              onchange="app.devInspector.onSearchInput(document.getElementById('inspectorSearchInput').value)">
                        <option value="any">Todo</option>
                        <option value="text">Texto</option>
                        <option value="resourceId">ResourceId</option>
                        <option value="class">Clase</option>
                      </select>
                    </div>
                    <div class="inspector-search-nav" id="inspectorSearchNav" style="display:none;">
                      <span id="inspectorSearchCount" class="inspector-search-count">0 resultados</span>
                      <button class="inspector-nav-btn" onclick="app.devInspector.navigateSearch(-1)">&#8593;</button>
                      <button class="inspector-nav-btn" onclick="app.devInspector.navigateSearch(1)">&#8595;</button>
                    </div>
                  </div>
                  <div class="inspector-tree-container" id="inspectorTreeContainer">
                    <div class="inspector-empty-state" id="inspectorTreeEmpty">
                      <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" fill="none" stroke-width="1.5" opacity="0.3">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      </svg>
                      <span>Selecciona un dispositivo<br>y captura el árbol UI</span>
                    </div>
                    <div class="inspector-spinner" id="inspectorTreeSpinner" style="display:none;"></div>
                  </div>
                </div>

                <div class="inspector-panel-separator"></div>

                <!-- Panel central: Preview + Fallback -->
                <div class="inspector-panel inspector-panel--center" id="inspectorPanelCenter">
                  <!-- Preview normal -->
                  <div id="inspectorPreviewWrap" style="position:relative; width:100%; display:flex; align-items:center; justify-content:center; flex:1;">
                    <canvas id="inspectorPreviewCanvas" class="inspector-preview-canvas"></canvas>
                    <canvas id="inspectorOverlayCanvas" class="inspector-overlay-canvas"></canvas>
                    <div class="inspector-empty-state" id="inspectorPreviewEmpty">
                      <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" fill="none" stroke-width="1.5" opacity="0.3">
                        <rect x="5" y="2" width="14" height="20" rx="2"/>
                        <line x1="12" y1="18" x2="12.01" y2="18"/>
                      </svg>
                      <span>Sin preview</span>
                    </div>
                  </div>
                  <!-- Panel fallback (búsqueda ciega) -->
                  <div id="inspectorFallbackPanel" style="display:none; flex-direction:column; flex:1; padding:16px; gap:12px;">
                    <div class="inspector-fallback-banner">
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      Modo Fallback activo — sin preview de pantalla
                    </div>
                    <div style="display:flex; gap:8px;">
                      <input type="text" id="blindSearchInput" class="inspector-search-input"
                             placeholder="Buscar por texto, resourceId o clase..."
                             style="flex:1;"
                             onkeydown="if(event.key==='Enter') app.devInspector.blindSearch()">
                      <select id="blindSearchField" class="inspector-search-field">
                        <option value="any">Todo</option>
                        <option value="text">Texto</option>
                        <option value="resourceId">ResourceId</option>
                        <option value="class">Clase</option>
                      </select>
                      <button class="inspector-btn inspector-btn--primary" onclick="app.devInspector.blindSearch()" id="btnBlindSearch">
                        Buscar en UI
                      </button>
                    </div>
                    <div id="blindSearchResults" class="blind-search-results"></div>
                  </div>
                </div>

                <div class="inspector-panel-separator"></div>

                <!-- Panel derecho: Propiedades + Acciones -->
                <div class="inspector-panel inspector-panel--right" id="inspectorPanelProps">
                  <div class="inspector-panel-header">
                    <span class="inspector-panel-title">Propiedades</span>
                  </div>
                  <div id="inspectorPropsEmpty" class="inspector-empty-state" style="padding:24px 16px;">
                    <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" fill="none" stroke-width="1.5" opacity="0.3">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span>Selecciona un elemento<br>del árbol o haz clic<br>en el preview</span>
                  </div>
                  <div id="inspectorPropsTable" style="display:none;"></div>
                  <div id="inspectorActions" class="inspector-actions"></div>
                </div>

              </div>
            </div>
          </div>
        </div>
    `;
    
    // Renderizar modales en la capa de overlay global
    this.renderModalsToOverlay();
    
    this.updateAccountCounts();
    this.sanitizeVisibleText();
  }

  renderModalsToOverlay() {
    const overlayLayer = document.getElementById('overlay-layer');
    if (!overlayLayer) return;
    
    overlayLayer.innerHTML = `
      <!-- Context Menu for Devices -->
      <div class="device-context-menu" id="deviceContextMenu" role="menu" aria-label="Opciones de dispositivo">
        <button class="device-context-menu-btn" id="contextExecutePending" style="--menu-color: #14b8a6;">
          <svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5Z" /></svg>
          <span>Ejecutar pendientes</span>
        </button>
        <button class="device-context-menu-btn" id="contextStopLogin" style="--menu-color: #f43f5e;">
          <svg viewBox="0 0 24 24"><path d="M7 7h10v10H7z" /></svg>
          <span>Detener FlowLogin</span>
        </button>
        <button class="device-context-menu-btn" id="contextInstallFlowAgent" style="--menu-color: #4f8dff;">
          <svg viewBox="0 0 24 24"><path d="M21 16v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
          <span>Instalar FlowAgent APK</span>
        </button>
        <button class="device-context-menu-btn" id="contextRetryAccounts" style="--menu-color: #ffd166;">
          <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15-6.7" /><path d="M18 3v6h-6" /><path d="M21 12a9 9 0 0 1-15 6.7" /><path d="M6 21v-6h6" /></svg>
          <span>Reintentar cuentas</span>
        </button>
        <button class="device-context-menu-btn" id="contextReplaceAccounts" style="--menu-color: #a78bfa;">
          <svg viewBox="0 0 24 24"><path d="M7 7h11" /><path d="m15 4 3 3-3 3" /><path d="M17 17H6" /><path d="m9 14-3 3 3 3" /></svg>
          <span>Reemplazar rojas/moradas</span>
        </button>
        <button class="device-context-menu-btn" id="contextAddAccounts" style="--menu-color: #22b86f;">
          <svg viewBox="0 0 24 24"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
          <span>Anadir cuentas</span>
        </button>
        <div class="device-context-add-panel" id="contextAddPanel">
          <label style="font-size: 0.75rem; color: var(--muted); margin-bottom: 4px;">Cantidad a anadir:</label>
          <input type="number" id="contextAddCount" min="1" max="10" value="1" 
                 style="width: 100%; padding: 6px; background: rgba(11, 18, 32, 0.6); 
                 border: 1px solid rgba(79, 141, 255, 0.15); border-radius: 4px; 
                 color: var(--ink); font-size: 0.85rem; margin-bottom: 6px;">
          <div style="display: flex; gap: 6px;">
            <button class="btn-sidebar" onclick="app.confirmAddAccounts()" 
                    style="flex: 1; background: var(--accent); font-size: 0.75rem; padding: 6px;">
              Confirmar
            </button>
            <button class="btn-sidebar" onclick="app.cancelAddAccounts()" 
                    style="flex: 1; background: var(--danger); font-size: 0.75rem; padding: 6px;">
              Cancelar
            </button>
          </div>
        </div>
        <button class="device-context-menu-btn" id="contextClearAccounts" style="--menu-color: #ff5c7a;">
          <svg viewBox="0 0 24 24"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 15h10l1-15" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
          <span>Eliminar cuentas</span>
        </button>
      </div>

      <!-- Account Editor Modal -->
      <div class="account-editor-modal" id="accountEditorModal" aria-hidden="true">
        <div class="account-editor-card">
          <div class="account-editor-header">
            <div>
              <p class="account-editor-title">Cuentas del dispositivo</p>
              <p class="account-editor-subtitle" id="accountEditorDevice">Sin dispositivo</p>
            </div>
            <button class="account-editor-close" onclick="app.closeDeviceAccountEditor()" title="Cerrar">
              <svg viewBox="0 0 24 24"><path d="m18 6-12 12" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>
          <textarea id="accountEditorTextarea" class="account-editor-textarea" rows="10" placeholder="email:password"></textarea>
          <div class="account-editor-footer">
            <span id="accountEditorCounter">0/10 lineas</span>
            <div class="account-editor-actions">
              <button class="btn-sidebar" onclick="app.clearDeviceAccountEditor()" style="background: var(--danger);">Limpiar</button>
              <button class="btn-sidebar" onclick="app.closeDeviceAccountEditor()">Cancelar</button>
              <button class="btn-sidebar" onclick="app.saveDeviceAccountEditor()" style="background: var(--accent);">Guardar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Category Editor Modal -->
      <div class="account-editor-modal category-editor-modal" id="categoryEditorModal" aria-hidden="true">
        <div class="account-editor-card category-editor-card">
          <div class="account-editor-header">
            <div>
              <p class="account-editor-title">Nueva categoria</p>
              <p class="account-editor-subtitle">FlowCategory</p>
            </div>
            <button class="account-editor-close" onclick="app.closeCategoryEditor()" title="Cerrar">
              <svg viewBox="0 0 24 24"><path d="m18 6-12 12" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>
          <input id="categoryEditorInput" class="category-editor-input" type="text" maxlength="80" placeholder="Nombre de la categoria">
          <div class="account-editor-footer">
            <span id="categoryEditorHint">Se guardara para mover dispositivos por MAC.</span>
            <div class="account-editor-actions">
              <button class="btn-sidebar" onclick="app.closeCategoryEditor()">Cancelar</button>
              <button class="btn-sidebar" onclick="app.saveCategoryEditor()" style="background: var(--accent);">Crear</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Performance Panel Modal -->
      <div class="account-editor-modal performance-panel-modal" id="performancePanelModal" aria-hidden="true">
        <div class="account-editor-card performance-panel-card">
          <div class="account-editor-header">
            <div>
              <p class="account-editor-title">Panel de Rendimiento</p>
              <p class="account-editor-subtitle">Optimiza la fluidez y calidad de video</p>
            </div>
            <button class="account-editor-close" onclick="app.closePerformancePanel()" title="Cerrar">
              <svg viewBox="0 0 24 24"><path d="m18 6-12 12" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>
          <div class="performance-panel-content">
            <!-- Preview -->
            <div class="perf-preview-box">
              <div class="perf-preview-label" id="perfPreviewLabel">480p @ 24fps / 2M</div>
              <div class="perf-preview-desc" id="perfDescription">Bajo: buen rendimiento, calidad aceptable.</div>
            </div>

            <!-- Ultra-Light Toggle -->
            <div class="perf-control-group">
              <label class="perf-label">
                <input type="checkbox" id="perfUltraLight" onchange="app.updatePerformancePreview()">
                <span>Modo Ultra-Light (sin video)</span>
              </label>
              <p class="perf-hint">Desactiva video en vivo. Solo muestra estado de dispositivos.</p>
            </div>

            <!-- Max Size Slider -->
            <div class="perf-control-group">
              <label class="perf-label">Resolución máxima</label>
              <div class="perf-slider-row">
                <span class="perf-value-label">360p</span>
                <input type="range" id="perfMaxSize" min="360" max="720" step="60" value="480" 
                       class="perf-slider" onchange="app.updatePerformancePreview()">
                <span class="perf-value-label">720p</span>
              </div>
              <p class="perf-hint">Resolución máxima de video. Menor = más fluido.</p>
            </div>

            <!-- Max FPS Slider -->
            <div class="perf-control-group">
              <label class="perf-label">Fotogramas por segundo</label>
              <div class="perf-slider-row">
                <span class="perf-value-label">12 fps</span>
                <input type="range" id="perfMaxFps" min="12" max="60" step="6" value="24" 
                       class="perf-slider" onchange="app.updatePerformancePreview()">
                <span class="perf-value-label">60 fps</span>
              </div>
              <p class="perf-hint">Fotogramas por segundo. Menor = menos CPU.</p>
            </div>

            <!-- Bit Rate Selector -->
            <div class="perf-control-group">
              <label class="perf-label">Velocidad de bits</label>
              <div class="perf-bitrate-buttons">
                <button class="perf-bitrate-btn" data-bitrate="1M" onclick="document.getElementById('perfBitRate').value='1M'; app.updatePerformancePreview()">1M</button>
                <button class="perf-bitrate-btn" data-bitrate="2M" onclick="document.getElementById('perfBitRate').value='2M'; app.updatePerformancePreview()">2M</button>
                <button class="perf-bitrate-btn" data-bitrate="4M" onclick="document.getElementById('perfBitRate').value='4M'; app.updatePerformancePreview()">4M</button>
                <button class="perf-bitrate-btn" data-bitrate="8M" onclick="document.getElementById('perfBitRate').value='8M'; app.updatePerformancePreview()">8M</button>
              </div>
              <input type="hidden" id="perfBitRate" value="2M">
              <p class="perf-hint">Velocidad de compresión. Menor = menos ancho de banda.</p>
            </div>

            <!-- Presets -->
            <div class="perf-control-group">
              <label class="perf-label">Presets rápidos</label>
              <div class="perf-preset-buttons">
                <button class="perf-preset-btn" onclick="app.applyPerformancePreset('ultralight')">Ultra-Light</button>
                <button class="perf-preset-btn" onclick="app.applyPerformancePreset('low')">Bajo</button>
                <button class="perf-preset-btn" onclick="app.applyPerformancePreset('medium')">Medio</button>
                <button class="perf-preset-btn" onclick="app.applyPerformancePreset('high')">Alto</button>
              </div>
            </div>
          </div>
          <div class="account-editor-footer">
            <span id="perfWarning" style="font-size: 0.75rem; color: var(--muted);"></span>
            <div class="account-editor-actions">
              <button class="btn-sidebar" onclick="app.closePerformancePanel()">Cancelar</button>
              <button class="btn-sidebar" onclick="app.applyPerformanceProfile()" style="background: var(--accent);">Aplicar</button>
            </div>
          </div>
        </div>
      </div>

      <div class="account-editor-modal plans-modal" id="plansModal" aria-hidden="true">
        <div class="account-editor-card plans-modal-card">
          <div class="account-editor-header plans-modal-header">
            <div>
              <p class="account-editor-title">Planes FlowDashboard</p>
              <p class="account-editor-subtitle">Contacta para activar o cambiar tu plan</p>
            </div>
            <button class="account-editor-close" onclick="app.closePlansModal()" title="Cerrar">
              <svg viewBox="0 0 24 24"><path d="m18 6-12 12" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>
          <div class="plans-modal-content">
            <div class="plans-hero-card">
              <div class="plans-hero-kicker">Catálogo 2026</div>
              <h3>Escala tu operación Android con planes listos para producción</h3>
              <p>Elige el plan que mejor se ajuste a tu volumen y contacta al soporte para activarlo.</p>
            </div>
            <div class="plans-grid">
              <article class="plan-card" style="--plan-accent:#45caff;">
                <header>
                  <h4>Starter</h4>
                  <div class="plan-price">$49 <span>/ mes</span></div>
                </header>
                <ul>
                  <li>Hasta 10 dispositivos conectados</li>
                  <li>Panel FlowLogin y FlowRegister</li>
                  <li>Monitoreo en tiempo real básico</li>
                  <li>Soporte por email 24/5</li>
                </ul>
                <a class="btn-sidebar" style="width:100%; text-align:center; display:block; text-decoration:none;" href="mailto:ing.estebandaza@gmail.comsubject=FlowDashboard%20Starter&body=Hola%2C%20quiero%20activar%20el%20plan%20Starter.">Solicitar Starter</a>
              </article>
              <article class="plan-card is-featured" style="--plan-accent:#00f5d4;">
                <header>
                  <span class="plan-badge">Más elegido</span>
                  <h4>Growth</h4>
                  <div class="plan-price">$129 <span>/ mes</span></div>
                </header>
                <ul>
                  <li>Hasta 40 dispositivos simultáneos</li>
                  <li>Automatización por lotes avanzada</li>
                  <li>Panel de rendimiento con presets</li>
                  <li>Alertas de estado y reportes semanales</li>
                  <li>Soporte prioritario</li>
                </ul>
                <a class="btn-sidebar" style="width:100%; text-align:center; display:block; text-decoration:none;" href="mailto:ing.estebandaza@gmail.comsubject=FlowDashboard%20Growth&body=Hola%2C%20quiero%20activar%20el%20plan%20Growth.">Solicitar Growth</a>
              </article>
              <article class="plan-card" style="--plan-accent:#a78bfa;">
                <header>
                  <h4>Enterprise</h4>
                  <div class="plan-price">$299 <span>/ mes</span></div>
                </header>
                <ul>
                  <li>Hasta 120 dispositivos + multi-sede</li>
                  <li>Integraciones API dedicadas</li>
                  <li>Auditoría operativa y métricas SLA</li>
                  <li>Gestor técnico asignado</li>
                  <li>Capacitación para equipo completo</li>
                </ul>
                <a class="btn-sidebar" style="width:100%; text-align:center; display:block; text-decoration:none;" href="mailto:ing.estebandaza@gmail.comsubject=FlowDashboard%20Enterprise&body=Hola%2C%20quiero%20cotizar%20el%20plan%20Enterprise.">Cotizar Enterprise</a>
              </article>
            </div>
            <div class="plans-footnote">¿Dudas o casos especiales Escríbenos a <a href="mailto:ing.estebandaza@gmail.com" style="color:#45caff;">ing.estebandaza@gmail.com</a></div>
          </div>
        </div>
      </div>

      <div class="account-editor-modal help-modal" id="helpModal" aria-hidden="true">
        <div class="account-editor-card help-modal-card">
          <div class="account-editor-header">
            <div>
              <p class="account-editor-title">Centro de Ayuda</p>
              <p class="account-editor-subtitle">Guía rápida de operación</p>
            </div>
            <button class="account-editor-close" onclick="app.closeHelpModal()" title="Cerrar">
              <svg viewBox="0 0 24 24"><path d="m18 6-12 12" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>
          <div class="help-modal-content">
            <div class="help-item">
              <h4>Conectar dispositivos por WiFi</h4>
              <p>1. En el teléfono Android: Ajustes → Opciones de desarrollador → Activar depuración USB y depuración inalámbrica.</p>
              <p>2. Conecta el teléfono por USB y ejecuta <code>adb tcpip 5555</code> en una terminal del PC.</p>
              <p>3. Desconecta el USB y usa <strong>Escanear Red</strong> en el sidebar para que el dashboard detecte el teléfono por su IP local.</p>
            </div>
            <div class="help-item">
              <h4>Preparar FlowAgent</h4>
              <p>Ve a <strong>Configuración -> FlowVideo -> Preparar FlowAgent</strong>. Esto instala el APK monolito en los dispositivos seleccionados, configura los reverses ADB y abre la app.</p>
              <p>Esta accion prepara automatizacion, Accesibilidad y FlowKeyboard. No pide MediaProjection; OCR/OpenCV solicitan captura solo cuando se usan.</p>
            </div>
            <div class="help-item">
              <h4>Repartir cuentas (FlowLogin)</h4>
              <p>Pega tus cuentas <code>email:password</code> en la pestaña <strong>Total</strong> de FlowLogin. Selecciona los teléfonos en la grilla y pulsa <strong>Dividir y Asignar</strong>.</p>
              <p>Máximo 10 cuentas por teléfono. El reparto se persiste en el perfil del dispositivo.</p>
            </div>
            <div class="help-item">
              <h4>Focus Mode (control táctil)</h4>
              <p><strong>Doble click</strong> sobre la tarjeta de un dispositivo abre el modo focus con canvas grande.</p>
              <p>Click = tap, drag = swipe, Shift+drag = swipe lento, Ctrl+click = long press, doble click = doble tap, rueda = scroll.</p>
              <p><strong>Esc</strong> cierra el focus.</p>
            </div>
            <div class="help-item">
              <h4>Inspector de UI (FlowDev)</h4>
              <p>Activa el toggle <strong>Dev</strong> en el sidebar (debajo del logo). Selecciona un dispositivo y pulsa <strong>Capturar UI</strong>. Tree/Nativo/Auto usan UIAutomator, Accessibility o CDP; OCR solo se usa en modo OCR/Hybrid.</p>
              <p>El selector recomendado y el botón <strong>Copiar prompt para IA</strong> ayudan a extraer selectores estables para automatización.</p>
            </div>
            <div class="help-item">
              <h4>Calidad del streaming</h4>
              <p>El zoom de los dispositivos controla automáticamente la calidad del stream H.264. Más zoom = más resolución.</p>
              <p>El focus mode tiene su propio selector de calidad en el header (240p / 480p / 720p / 1080p).</p>
            </div>
            <div class="help-item">
              <h4>Solución de problemas</h4>
              <p><strong>Pantalla negra en focus:</strong> revisa el stream H.264/scrcpy y la conexion ADB. Preparar FlowAgent no es requisito para ver Focus/Grid.</p>
              <p><strong>Dispositivo no aparece:</strong> verifica que esté en la misma red WiFi y que la depuración ADB inalámbrica esté activa. Usa Escanear Red para detectarlo.</p>
              <p><strong>Login.js falla:</strong> revisa que FlowAgent tenga accesibilidad activa. Tarjeta del dispositivo → menú de tres puntos → Verificar permisos.</p>
            </div>
            <div class="help-item">
              <h4>Soporte</h4>
              <p>Email: <a href="mailto:ing.estebandaza@gmail.com" style="color:#45caff;">ing.estebandaza@gmail.com</a></p>
              <p>Versión: <span id="helpAppVersion">v${this.appVersion}</span></p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Re-attach event listeners para los modales
    this.setupModalListeners();
    this.sanitizeVisibleText(overlayLayer);
  }

  async checkConnections() {
    const statusPill = document.getElementById('statusPill');
    const statusText = document.getElementById('statusText');

    // Check C# API
    try {
      const response = await fetch(`${CSHARP_API}/health`);
      if (response.ok) {
        this.connected = true;
        console.log('✅ Conectado al servidor C# (ADB)');
      }
    } catch (error) {
      this.connected = false;
      console.error('[ERROR] Error conectando al servidor C#:', error);
    }

    // Check Python API
    try {
      const response = await fetch(`${PYTHON_API}/health`);
      if (response.ok) {
        this.pythonConnected = true;
        console.log('✅ Conectado al servidor Python (FlowLogin)');
      }
    } catch (error) {
      this.pythonConnected = false;
      console.error('[ERROR] Error conectando al servidor Python:', error);
    }

    // Update UI
    if (this.connected && this.pythonConnected) {
      statusPill.classList.add('is-online');
      statusPill.classList.remove('is-partial', 'is-offline');
      statusText.textContent = 'Conectado';
    } else if (this.connected) {
      statusPill.classList.remove('is-online', 'is-offline');
      statusPill.classList.add('is-partial');
      statusText.textContent = 'Parcial';
    } else {
      statusPill.classList.remove('is-online', 'is-partial');
      statusPill.classList.add('is-offline');
      statusText.textContent = 'Desconectado';
      setTimeout(() => this.checkConnections(), 3000);
    }

    // Actualizar panel si está abierto y badge de dispositivos
    this.updateStatusPanel();
  }

  getFlowKeyboardTargets(requireSelection = false) {
    const selected = Array.from(this.selectedDeviceIds);
    if (selected.length) return selected;
    if (requireSelection) return [];
    return this.devices.map(d => d.serial).filter(Boolean);
  }

  resolveFlowKeyboardTargets(options = {}, requireSelection = true) {
    const opts = options && typeof options === 'object' ? options : {};
    if (opts.serial) return [String(opts.serial)];
    if (Array.isArray(opts.deviceIds) && opts.deviceIds.length) {
      return opts.deviceIds.map(String).filter(Boolean);
    }
    if (Array.isArray(opts.serials) && opts.serials.length) {
      return opts.serials.map(String).filter(Boolean);
    }
    return this.getFlowKeyboardTargets(requireSelection);
  }

  async requestFlowKeyboardStatus(options = {}) {
    const targets = this.resolveFlowKeyboardTargets(options, false);
    const body = options.serial ? { serial: String(options.serial) } : { deviceIds: targets.length ? targets : 'all' };
    const response = await fetch(`${PYTHON_API}/flowkeyboard/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  async sendFlowKeyboardType(serial, text, options = {}) {
    // @Modified by FlowDashboard Etapa B (Nivel 3 anti-deteccion) on 2026-05-27.
    //   Por defecto usa el endpoint /flowkeyboard/type-human, que tipea desde
    //   el IME FlowKeyboard caracter por caracter con jitter aleatorio y
    //   feedback visual sobre el QWERTY visible del telefono.
    //   Para forzar el modo legacy rapido,
    //   pasar { mode: "fast" } u { human: false } en options.
    const useHuman = !(options.mode === 'fast' || options.human === false);
    if (useHuman) {
      const payload = {
        serial,
        text: String(text ?? ''),
        minDelayMs: Number(options.minDelayMs || 80),
        maxDelayMs: Number(options.maxDelayMs || 220),
        fieldType: String(options.fieldType || 'generic'),
        allowFallback: options.allowFallback !== false,
      };
      if (Object.prototype.hasOwnProperty.call(options, 'mistakesEnabled')) {
        payload.mistakesEnabled = options.mistakesEnabled === true;
      }
      if (Object.prototype.hasOwnProperty.call(options, 'mistakeRate')) {
        payload.mistakeRate = Number(options.mistakeRate || 0);
      }
      if (Object.prototype.hasOwnProperty.call(options, 'maxMistakes')) {
        payload.maxMistakes = Number(options.maxMistakes || 0);
      }
      const response = await fetch(`${PYTHON_API}/flowkeyboard/type-human`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
      return data;
    }
    const response = await fetch(`${PYTHON_API}/flowkeyboard/type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serial,
        text: String(text ?? ''),
        delayMs: Number(options.delayMs || options.delay || 0),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  async sendFlowKeyboardCommand(serial, action, options = {}) {
    const response = await fetch(`${PYTHON_API}/flowkeyboard/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serial,
        action,
        count: Number(options.count || 1),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  async runFlowKeyboardForTargets(action, payload = {}, options = {}) {
    const targets = this.resolveFlowKeyboardTargets(options, true);
    if (!targets.length) throw new Error('Selecciona al menos un dispositivo.');
    const results = [];
    for (const serial of targets) {
      try {
        const result = action === 'type'
          ? await this.sendFlowKeyboardType(serial, payload.text || '', options)
          : await this.sendFlowKeyboardCommand(serial, action, options);
        results.push({ serial, ok: true, result });
      } catch (error) {
        results.push({ serial, ok: false, error: error.message || String(error) });
      }
    }
    return {
      ok: results.every(r => r.ok),
      total: results.length,
      okCount: results.filter(r => r.ok).length,
      results,
    };
  }

  setRunningFlow(flowId) {
    this.runningFlow = flowId || null;
    const flowRunGrid = document.getElementById('flowRunGrid');
    if (flowRunGrid) flowRunGrid.innerHTML = this.renderPlayButtons();
    const pinned = document.getElementById('mainFlowCategoryPinned');
    if (pinned) pinned.innerHTML = this.renderPinnedFlowCategoryBar();
    window.dispatchEvent(new CustomEvent('flowdashboard:runtime-state-changed', {
      detail: { runningFlow: this.runningFlow }
    }));
  }

  // ============================================================================
  // Focus PRO Panel - helpers (Fases 2-7)
  // ============================================================================

  async _proPanelPostJSON(path, payload) {
    const response = await fetch(`${PYTHON_API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
  }

  async _proPanelPostMultipart(path, fields) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields || {})) {
      if (v === undefined || v === null) continue;
      fd.append(k, v);
    }
    const response = await fetch(`${PYTHON_API}${path}`, {
      method: 'POST',
      body: fd,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
  }

  appsList(serial, opts = {}) {
    return this._proPanelPostJSON('/apps/list', {
      serial,
      thirdPartyOnly: opts.thirdPartyOnly !== false,
    });
  }
  appsLaunch(serial, packageName)     { return this._proPanelPostJSON('/apps/launch', { serial, packageName }); }
  appsForceStop(serial, packageName)  { return this._proPanelPostJSON('/apps/force-stop', { serial, packageName }); }
  appsClearCache(serial, packageName) { return this._proPanelPostJSON('/apps/clear-cache', { serial, packageName }); }
  appsUninstall(serial, packageName)  { return this._proPanelPostJSON('/apps/uninstall', { serial, packageName }); }

  appsDetails(serial, packageName)    { return this._proPanelPostJSON('/apps/details', { serial, packageName }); }
  appsInstall(serial, file)           { return this._proPanelPostMultipart('/apps/install', { serial, apk: file }); }
  pushFile(serial, file, path)        { return this._proPanelPostMultipart('/file-push', { serial, path, file }); }
  autoJsPushScript(serial, file, opts = {}) {
    return this._proPanelPostMultipart('/autojs/push', { serial, force: opts.force ? '1' : '', script: file });
  }
  autoJsRunRemote(serial, remotePath, opts = {}) {
    return fetch(`${PYTHON_API}/autojs/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: remotePath, deviceIds: [serial], delimiter: opts.delimiter || this.delimiter || ':' }),
    }).then(r => r.json());
  }
  autoJsStopForSerial(serial) {
    return fetch(`${PYTHON_API}/autojs/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceIds: [serial] }),
    }).then(r => r.json());
  }
  autoJsPrepareOverlay(serial)         { return this._proPanelPostJSON('/autojs/prepare-overlay', { serial }); }
  autoJsInstallBundled(serial)         { return this._proPanelPostJSON('/autojs/install-bundled', { serial }); }
  systemOpenSettings(serial, shortcut) { return this._proPanelPostJSON('/system/open-settings', { serial, shortcut }); }
  powerReboot(serial)                  { return this._proPanelPostJSON('/power/reboot', { serial }); }
  powerShutdown(serial)                { return this._proPanelPostJSON('/power/shutdown', { serial }); }
  runAdbFreeCommand(serial, command) {
    return fetch(`${PYTHON_API}/adb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, deviceIds: [serial] }),
    }).then(r => r.json());
  }

  getAdbCommandPresets() {
    if (Array.isArray(window.FLOW_ADB_COMMAND_PRESETS) && window.FLOW_ADB_COMMAND_PRESETS.length) {
      return window.FLOW_ADB_COMMAND_PRESETS;
    }
    return [
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
  }

  renderAdbPresetStrip(attrName = 'data-actions-adb-preset') {
    return `
      <div class="adb-preset-strip" aria-label="Comandos ADB preestablecidos">
        ${this.getAdbCommandPresets().map(item => `
          <button class="adb-preset-btn" type="button" ${attrName}="${this.escapeHtml(item.command)}" title="${this.escapeHtml(item.command)}">${this.escapeHtml(item.label)}</button>
        `).join('')}
      </div>`;
  }

  bindAdbPresetStrip(root, input, attrName = 'data-actions-adb-preset') {
    if (!root || !input) return;
    root.querySelectorAll(`[${attrName}]`).forEach(btn => {
      btn.addEventListener('click', () => {
        input.value = btn.getAttribute(attrName) || '';
        input.focus();
      });
    });
  }

  initFlowScriptApi() {
    const app = this;
    window.flow = window.flow || {};
    window.flow.keyboard = {
      status(options = {}) {
        return app.requestFlowKeyboardStatus(options);
      },
      type(text, options = {}) {
        return app.runFlowKeyboardForTargets('type', { text }, options);
      },
      clear(options = {}) {
        return app.runFlowKeyboardForTargets('clear', {}, options);
      },
      backspace(count = 1, options = {}) {
        return app.runFlowKeyboardForTargets('backspace', {}, { ...options, count });
      },
      enter(options = {}) {
        return app.runFlowKeyboardForTargets('enter', {}, options);
      },
      next(options = {}) {
        return app.runFlowKeyboardForTargets('next', {}, options);
      },
      done(options = {}) {
        return app.runFlowKeyboardForTargets('done', {}, options);
      },
    };
  }

  setFlowKeyboardResult(message, tone = '') {
    const el = document.getElementById('flowKeyboardLastResult');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('is-ok', tone === 'ok');
    el.classList.toggle('is-error', tone === 'error');
  }

  renderFlowKeyboardStatus() {
    const el = document.getElementById('flowKeyboardStatusText');
    if (!el) return;
    const statuses = Array.isArray(this.flowKeyboardStatuses) ? this.flowKeyboardStatuses : [];
    if (!statuses.length) {
      el.textContent = 'Sin verificar';
      el.className = 'flowkeyboard-status';
      return;
    }
    const ready = statuses.filter(s => s.installed && s.enabled && s.selected).length;
    const installed = statuses.filter(s => s.installed).length;
    el.textContent = `${ready}/${statuses.length} listos | ${installed} instalados`;
    el.className = `flowkeyboard-status ${ready === statuses.length ? 'is-ok' : 'is-warn'}`;
  }

  async refreshFlowKeyboardStatus() {
    const targets = this.getFlowKeyboardTargets(false);
    if (!targets.length) {
      this.setFlowKeyboardResult('No hay dispositivos para verificar.', 'error');
      return;
    }
    this.setFlowKeyboardResult('Verificando FlowKeyboard...');
    try {
      const response = await fetch(`${PYTHON_API}/flowkeyboard/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceIds: targets }),
      });
      const data = await response.json();
      this.flowKeyboardStatuses = data.result || (data.serial ? [data] : []);
      this.renderFlowKeyboardStatus();
      this.setFlowKeyboardResult('Estado actualizado.', 'ok');
    } catch (error) {
      this.setFlowKeyboardResult(`Error verificando: ${error.message}`, 'error');
    }
  }

  async prepareFlowKeyboardSelected() {
    const targets = this.getFlowKeyboardTargets(true);
    if (!targets.length) {
      this.setFlowKeyboardResult('Selecciona al menos un dispositivo.', 'error');
      return;
    }
    this.setFlowKeyboardResult(`Preparando ${targets.length} dispositivo(s)...`);
    try {
      const response = await fetch(`${PYTHON_API}/flowkeyboard/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceIds: targets }),
      });
      const data = await response.json();
      this.flowKeyboardStatuses = data.result || [];
      this.renderFlowKeyboardStatus();
      const ready = this.flowKeyboardStatuses.filter(s => s.prepared).length;
      this.setFlowKeyboardResult(`${ready}/${targets.length} preparados.`, ready === targets.length ? 'ok' : 'error');
    } catch (error) {
      this.setFlowKeyboardResult(`Error preparando: ${error.message}`, 'error');
    }
  }

  async testFlowKeyboardType() {
    const targets = this.getFlowKeyboardTargets(true);
    const input = document.getElementById('flowKeyboardTestInput');
    const text = input ? input.value : '';
    if (!targets.length) {
      this.setFlowKeyboardResult('Selecciona un dispositivo para probar.', 'error');
      return;
    }
    if (!text) {
      this.setFlowKeyboardResult('Escribe un texto de prueba.', 'error');
      return;
    }
    this.setFlowKeyboardResult(`Enviando texto a ${targets.length} dispositivo(s)...`);
    let ok = 0;
    for (const serial of targets) {
      try {
        // @Modified Etapa B: el default es modo humano (anti-deteccion).
        // Para una prueba masiva no se requiere realismo extremo.
        await this.sendFlowKeyboardType(serial, text);
        ok += 1;
      } catch (_) {
        // El resumen final evita exponer texto o detalles sensibles.
      }
    }
    this.setFlowKeyboardResult(`${ok}/${targets.length} recibieron texto de prueba.`, ok === targets.length ? 'ok' : 'error');
  }

  async loadDevices() {
    if (!this.connected) return;
    try {
      let newDevices = null;
      if (this.pythonConnected) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 4000);
          const response = await fetch(`${PYTHON_API}/devices`, { signal: ctrl.signal });
          clearTimeout(timer);
          if (response.ok) {
            const data = await response.json();
            newDevices = (data.devices || []).map(d => ({
              serial: d.serial,
              model: d.model || d.name || d.serial,
              state: (() => {
                const adbState = d.adbState || d.state || 'device';
                const status = d.status || d.connectionStatus || '';
                const backendState = this.normalizeDeviceState({ ...d, state: d.state || adbState, adbState, status });
                if (backendState === 'device') {
                  delete this.deviceRuntimeState[d.serial];
                  return 'device';
                }
                return this.deviceRuntimeState[d.serial]?.state || backendState;
              })(),

              adbState: d.adbState || d.state || 'device',

              status: d.status || d.connectionStatus || '',
              name: d.name || d.customName || d.serial,
              androidId: d.androidId || '',
              macAddress: d.macAddress || '',
              deviceId: d.deviceId || d.deviceKey || d.serial,
              activeSerial: d.activeSerial || d.serial,
              isSelected: false,
              accounts: d.accountStatuses || [],
              deviceKey: d.deviceKey || d.serial,
              preferredTransport: d.preferredTransport || 'auto',
              transports: d.transports || [{ type: d.connectionType || 'usb', adbState: d.adbState || d.state || 'device', serial: d.serial }],
              connectionType: d.connectionType || 'usb',
            }));
          }
        } catch (e) {
          if (e && e.name === 'AbortError') console.info('Devices Python no respondio antes del timeout; usando fallback C# si esta disponible.');
          else console.warn('Error cargando devices de Python:', e);
        }
      }

      if (!newDevices) {
         // Fallback a C# solo si Python falla o no está
         const response = await fetchWithTimeout(`${CSHARP_API}/devices`, {}, 4000);
         if (response.ok) {
           newDevices = await response.json();
           newDevices = newDevices.map(d => ({...d, state: 'device'}));
         }
      }

      if (!newDevices) throw new Error('No se pudo cargar dispositivos de ningún servidor');
      
      const previousDevices = this.devices || [];
      const previousStateBySerial = new Map(previousDevices.map(d => [d.serial, this.normalizeDeviceState(d)]));
      const previousStateByIdentity = new Map();
      for (const previousDevice of previousDevices) {
        const previousState = this.normalizeDeviceState(previousDevice);
        for (const key of this.getDeviceIdentityCandidates(previousDevice)) {
          if (!previousStateByIdentity.has(key)) previousStateByIdentity.set(key, previousState);
        }
      }

      const newDeviceEntries = newDevices.map((device, index) => ({
        device,
        index,
        keys: this.getDeviceIdentityCandidates(device)
      }));
      const newDeviceByIdentity = new Map();
      for (const entry of newDeviceEntries) {
        for (const key of entry.keys) {
          if (!newDeviceByIdentity.has(key)) newDeviceByIdentity.set(key, entry);
        }
      }
      const consumedNewDeviceIndexes = new Set();
      const normalizeCurrentDevice = (device) => {
        const state = this.normalizeDeviceState(device);
        const unavailable = state === 'offline' || state === 'rebooting' || state === 'reconnecting' || state === 'unauthorized';
        if (state === 'device') delete this.deviceRuntimeState[device.serial];
        return { ...device, state, offline: unavailable && state !== 'unauthorized', disconnected: unavailable && state !== 'unauthorized', lastSeenAt: Date.now() };
      };
      const mergedDevices = [];

      for (const previousDevice of previousDevices) {
        let matchedEntry = null;
        for (const key of this.getDeviceIdentityCandidates(previousDevice)) {
          const entry = newDeviceByIdentity.get(key);
          if (entry && !consumedNewDeviceIndexes.has(entry.index)) {
            matchedEntry = entry;
            break;
          }
        }

        if (matchedEntry) {
          mergedDevices.push(normalizeCurrentDevice(matchedEntry.device));
          consumedNewDeviceIndexes.add(matchedEntry.index);
        } else if (previousDevice.serial) {
          const state = this.deviceRuntimeState[previousDevice.serial]?.state || 'offline';
          mergedDevices.push({ ...previousDevice, offline: true, disconnected: true, state, status: state });
        }
      }

      for (const entry of newDeviceEntries) {
        if (!consumedNewDeviceIndexes.has(entry.index)) {
          mergedDevices.push(normalizeCurrentDevice(entry.device));
        }
      }

      for (const device of mergedDevices) {
        const state = this.normalizeDeviceState(device);
        const previousState = previousStateBySerial.get(device.serial);
        const previousIdentityState = this.getDeviceIdentityCandidates(device)
          .map(key => previousStateByIdentity.get(key))
          .find(Boolean);
        const effectivePreviousState = previousState || previousIdentityState;
        if (this.isDeviceStreamUnavailable(device)) {
          this.markDeviceStreamUnavailable(device.serial);
        } else if (effectivePreviousState && effectivePreviousState !== 'device' && state === 'device') {
          this.refreshDeviceStreamAfterReconnect(device.serial);
        }
      }

      const newSerials = mergedDevices.map(d => `${d.serial}:${this.normalizeDeviceState(d)}`).sort().join(',');
      const oldSerials = previousDevices.map(d => `${d.serial}:${this.normalizeDeviceState(d)}`).sort().join(',');
      const devicesChanged = newSerials !== oldSerials;
      
      this.devices = mergedDevices;
      
      if (devicesChanged) {
        // Primer render inmediato: muestra offline/reconnecting sin esperar metadata.
        this.renderDevices();
      } else {
        // Lista igual: solo actualizar canvas sin destruir DOM.
        if (this.livePreviewEnabled) {
          this.createCanvasesForVisibleDevices();
        }
      }

      await this.loadDeviceNames();
      await this.loadDeviceAccounts();
      await this.loadDeviceGroups();
      await this.loadLoginStatuses();
      
      this.updateStatusDots();
      
      if (devicesChanged) this.renderDevices();
      
      this.scheduleLivePreviewSync();
      document.getElementById('deviceCount').textContent = this.devices.length;
      this.updateStatusPanel();
      // Notificar al inspector si está activo
      if (this.devInspector && this.isFlowDevEnabled) this.devInspector.onDevicesUpdated();
      console.log(`📱 ${this.devices.length} dispositivos encontrados`);
    } catch (error) {
      console.error('[ERROR] Error cargando dispositivos:', error);
      document.getElementById('deviceList').innerHTML = 
        '<div class="loading">Error cargando dispositivos</div>';
    }
  }

  async loadDeviceNames() {
    // Load from Python backend (device_names.json)
    if (!this.pythonConnected) return;
    
    try {
      const response = await fetchWithTimeout(`${PYTHON_API}/devices`, {}, 4000);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.devices)) {
          data.devices.forEach(device => {
            const serial = device.legacyDeviceId || device.serial;
            if (serial) {
              this.deviceMeta[serial] = {
                ...device,
                serial,
                stableId: device.deviceKey || (device.macAddress ? `mac:${device.macAddress}` : `serial:${serial}`)
              };
            }
            if (device.name) {
              this.deviceNames[serial] = device.name;
              if (device.deviceKey) this.deviceNames[device.deviceKey] = device.name;
            }
          });
        }
      }
    } catch (error) {
      console.warn('[WARN] No se pudieron cargar nombres de dispositivos:', error);
    }
  }

  async loadDeviceAccounts() {
    // Load device accounts (person field) from Python backend
    if (!this.pythonConnected) return;
    
    try {
      const response = await fetchWithTimeout(`${PYTHON_API}/devices`, {}, 4000);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.devices)) {
          data.devices.forEach(device => {
            const serial = device.legacyDeviceId || device.serial;
            if (device.person) {
              const lines = device.person.split('\n').map(l => l.trim()).filter(Boolean);
              this.deviceAccounts[serial] = {
                person: device.person,
                accounts: lines.slice(0, 10) // Max 10 accounts per device
              };
              if (device.deviceKey) this.deviceAccounts[device.deviceKey] = this.deviceAccounts[serial];
            } else {
              delete this.deviceAccounts[serial];
              if (device.deviceKey) delete this.deviceAccounts[device.deviceKey];
            }
          });
        }
      }
    } catch (error) {
      console.warn('[WARN] No se pudieron cargar cuentas de dispositivos:', error);
    }
  }

  async loadDeviceGroups() {
    if (!this.pythonConnected) return;

    try {
      const response = await fetchWithTimeout(`${PYTHON_API}/device-groups`, {}, 4000);
      if (!response.ok) return;
      const data = await response.json();
      this.deviceGroups = {
        groups: Array.isArray(data.groups) ? data.groups : [],
        assignments: data.assignments && typeof data.assignments === 'object' ? data.assignments : {},
        order: Array.isArray(data.order) ? data.order : [],
        active: this.deviceGroups.active || 'all'
      };
      this.refreshCategoryFilters();
    } catch (error) {
      console.warn('No se pudieron cargar categorias:', error);
    }
  }

  async loadLoginStatuses() {
    // Load FlowLogin status from Python backend
    if (!this.pythonConnected) return;
    
    try {
      const response = await fetchWithTimeout(`${PYTHON_API}/login-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceIds: 'all' })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.progress && typeof data.progress === 'object') {
          this.loginStatuses = data.progress;
        }
      }
    } catch (error) {
      console.warn('[WARN] No se pudieron cargar estados de login:', error);
    }
  }

  renderDevices() {
    try {
      const container = document.getElementById('deviceList');
      
      if (this.devices.length === 0) {
        container.innerHTML = '<div class="loading">No hay dispositivos conectados</div>';
        return;
      }

      container.style.setProperty('--device-live-size', `${this.deviceZoom}px`);
      container.style.setProperty('--device-gap', `${this.deviceGap || 16}px`);
      container.classList.toggle('is-live-preview', this.livePreviewEnabled);
      container.classList.toggle('is-card-grid', this.deviceViewMode === 'grid' || !this.livePreviewEnabled);
      const visibleDevices = this.getVisibleOrderedDevices();
      const sections = this.buildDeviceSections(visibleDevices);

      container.innerHTML = sections.map(section => `
        <section class="device-category-section" style="--category-color: ${section.color};" data-category-id="${section.id}">
          <div class="device-category-dropzone"
               ondragover="app.onCategoryDragOver(event)"
               ondragleave="app.onCategoryDragLeave(event)"
               ondrop="app.onCategoryDrop(event, '${section.id}')">
            ${section.devices.length ? section.devices.map(device => this.renderDeviceTile(device)).join('') : '<div class="device-category-empty">Arrastra dispositivos aqui</div>'}
          </div>
        </section>
      `).join('');

      this.updateSelectedCount();
      
      // Crear canvas para dispositivos con live preview habilitado
      if (this.livePreviewEnabled) {
        setTimeout(() => {
          this.createCanvasesForVisibleDevices();
        }, 150);
      }
      setTimeout(() => this.refreshVisiblePublicIps(), 600);
      
      // Update Focus Mode header count and dots column if active
      if (this.flowTouch && this.flowTouch.activeSerial) {
        const serial = this.flowTouch.activeSerial;
        const statuses = this.getDeviceStatuses(serial);
        
        const countSpan = document.getElementById('flowTouchAccountsCount');
        if (countSpan) {
          countSpan.textContent = `${statuses.length}/10`;
        }
        
        const dotsColumn = document.getElementById('flowTouchDotsColumn');
        if (dotsColumn) {
          dotsColumn.innerHTML = this.renderAccountDots(statuses);
        }
      }

      console.log(`✅ ${this.devices.length} dispositivos renderizados`);
    } catch (error) {
      console.error('[ERROR] Error renderizando dispositivos:', error);
      const container = document.getElementById('deviceList');
      if (container) {
        container.innerHTML = `<div class="loading">Error: ${error.message}</div>`;
      }
    }
  }

  renderDeviceTile(device) {
      const serial = device.serial;
      const stableId = this.getDeviceStableId(device);
      const isSelected = this.selectedDeviceIds.has(serial);
      const normalizedState = this.normalizeDeviceState(device);

      const isOffline = normalizedState === 'offline' || normalizedState === 'rebooting' || normalizedState === 'reconnecting';
      const isUnauthorized = normalizedState === 'unauthorized';

      const offlineTitle = normalizedState === 'rebooting'
        ? 'Reiniciando dispositivo'
        : (normalizedState === 'reconnecting' ? 'Reconectando dispositivo' : 'Dispositivo desconectado');

      const offlineSubtitle = normalizedState === 'rebooting'
        ? 'esperando que Android termine de iniciar'
        : (normalizedState === 'reconnecting' ? 'preparando ADB y video' : 'esperando reconexion');
      const deviceName = this.deviceNames[stableId] || this.deviceNames[serial] || device.model || 'Dispositivo';
      const meta = this.deviceMeta[serial] || {};
      const publicIp = meta.publicIp || device.publicIp || '';
      const countryCode = (meta.countryCode || device.countryCode || '').toUpperCase();
      const countryName = meta.countryName || device.countryName || '';
      const accountRecord = this.deviceAccounts[stableId] || this.deviceAccounts[serial] || {};
      const accounts = accountRecord.accounts || [];
      const statuses = this.getDeviceStatuses(serial);
      const accountCount = accounts.length;
      
      const preferredTransport = device.preferredTransport || 'auto';
      const transports = device.transports || [{ type: device.connectionType || 'usb', adbState: device.state, serial: serial }];
      const transportTexts = transports.map(t => String(t?.type || t?.connectionType || t?.serial || t || '').toLowerCase());
      const serialLooksWifi = String(serial || device.activeSerial || '').includes(':5555');
      const statusLooksWifi = `${device.connectionType || ''} ${device.status || ''} ${device.adbState || ''}`.toLowerCase().includes('wifi');
      const hasUsb = transports.some(t => String(t?.type || t?.connectionType || '').toLowerCase() === 'usb');
      const hasWifi = transportTexts.some(text => text.includes('wifi') || text.includes(':5555')) || serialLooksWifi || statusLooksWifi;
      
      const transportBadge = hasWifi ? 'WIFI' : 'USB';
      const transportBadgeClass = hasWifi ? 'wifi' : 'usb';
      
      const diagTooltip = `[Diag] ID: ${stableId} | SerialActivo: ${serial} | Pref: ${preferredTransport} | Vías: ${transports.map(t => t.type).join(',')}`;
      
      return `
        <div class="device-card live-device-card ${isSelected ? 'is-selected' : ''} ${isOffline ? 'is-disconnected' : ''} ${isUnauthorized ? 'is-unauthorized' : ''}"
             onclick="app.toggleDevice('${serial}')"
             ondblclick="event.stopPropagation(); app.openFlowTouchFocus('${serial}')"
             oncontextmenu="app.openContextMenu(event, '${serial}')"
             draggable="true"
             ondragstart="app.onDeviceDragStart(event, '${serial}')"
             ondragover="app.onDeviceDragOver(event)"
             ondragleave="app.onDeviceDragLeave(event)"
             ondrop="app.onDeviceDrop(event, '${serial}')"
             data-serial="${this.escapeHtml(serial)}"
             data-device-id="${this.escapeHtml(stableId)}">
          <div class="device-live-screen ${isOffline ? 'is-disconnected' : ''} ${isUnauthorized ? 'is-unauthorized' : ''}" data-live-serial="${this.escapeHtml(serial)}">
            <!-- Canvas se renderiza aqui via StreamRenderer -->
            <div class="device-live-offline">
              ${isOffline ? '<svg class="device-disconnect-icon" viewBox="0 0 24 24"><path d="M7 2v6"/><path d="M17 2v6"/><path d="M7 8h10v4a5 5 0 0 1-10 0V8Z"/><path d="M12 17v5"/><path d="m4 20 16-16"/></svg>' : ''}
              ${isUnauthorized ? '<svg class="device-disconnect-icon" viewBox="0 0 24 24" stroke="var(--danger-color)" fill="none" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' : ''}
              <span>${isOffline ? offlineTitle : (isUnauthorized ? 'No Autorizado' : (this.livePreviewEnabled ? 'Live Pro' : 'Vista info'))}</span>
              <small>${isOffline ? offlineSubtitle : (isUnauthorized ? 'Acepta el prompt USB' : (this.livePreviewEnabled ? 'preparando video' : 'stream pausado'))}</small>
            </div>
          </div>
          <div class="device-live-topbar">
            <div class="device-info">
              <div class="device-name-row">
                <span class="device-name device-name-static" title="${this.escapeHtml(deviceName)}">${this.escapeHtml(deviceName)}</span>
                <button class="device-name-edit-btn"
                        onclick="event.stopPropagation(); app.openDeviceNamePopover(event, '${this.escapeHtml(serial)}')"
                        ondblclick="event.stopPropagation()"
                        aria-label="Editar nombre de ${this.escapeHtml(deviceName)}"
                        title="Editar nombre">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
              </div>
              <div class="device-serial" title="${this.escapeHtml(serial)}">${this.escapeHtml(this.shortSerial(serial))}</div>
              <div class="device-public-ip" title="${this.escapeHtml(countryName || countryCode || 'IP publica')}">
                ${this.renderCountryFlag(countryCode, countryName)}
                <span>${this.escapeHtml(publicIp || 'IP publica...')}</span>
              </div>
            </div>
            <div class="device-meta-stack">
              <span class="device-number-badge">${this.getDeviceNumber(device)}</span>
              <button class="device-connection-badge is-${this.escapeHtml(transportBadgeClass)}"
                      title="${this.escapeHtml(diagTooltip)}"
                      onclick="event.stopPropagation(); app.openTransportPreferencePopover(event, '${this.escapeHtml(stableId)}', '${this.escapeHtml(preferredTransport)}')"
                      ondblclick="event.stopPropagation()">${this.escapeHtml(transportBadge)}</button>
            </div>
          </div>
          <div class="device-live-bottom">
            <button class="device-live-action" onclick="event.stopPropagation(); app.openDeviceAccountEditor('${serial}')" ondblclick="event.stopPropagation()" title="Editar cuentas">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg>
              <span>${accountCount}/10</span>
            </button>
            <button class="device-live-action" onclick="event.stopPropagation(); app.openContextMenu(event, '${serial}')" ondblclick="event.stopPropagation()" title="Opciones">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
            </button>
          </div>
          <div class="account-status-column">
            ${this.renderAccountDots(statuses)}
          </div>
        </div>
      `;
  }

  openFlowTouchFocus(serial) {
    if (!this.flowTouch) {
      console.warn('FlowTouch no esta disponible.');
      return;
    }
    this.flowTouch.openFocus(serial);
  }

  /**
   * Crea canvas para todos los dispositivos visibles
   */
  /**
   * Actualiza solo los puntos de estado de cuentas sin rerenderizar el DOM
   */
  updateStatusDots() {
    for (const device of this.devices) {
      const serial = device.serial;
      const statuses = this.getDeviceStatuses(serial);
      
      // Update dots on any matching containers (Grid tiles and Focus Mode shell)
      const containers = document.querySelectorAll(`[data-serial="${CSS.escape(serial)}"] .account-status-column`);
      containers.forEach(container => {
        container.innerHTML = this.renderAccountDots(statuses);
      });
      
      // Update Focus Mode header count and dots column if this device is the active Focus Mode serial
      if (this.flowTouch && this.flowTouch.activeSerial === serial) {
        const countSpan = document.getElementById('flowTouchAccountsCount');
        if (countSpan) {
          countSpan.textContent = `${statuses.length}/10`;
        }
        
        const dotsColumn = document.getElementById('flowTouchDotsColumn');
        if (dotsColumn) {
          dotsColumn.innerHTML = this.renderAccountDots(statuses);
        }
      }
    }
  }

  async refreshVisiblePublicIps() {
    if (!this.pythonConnected) return;
    const visibleDevices = this.getVisibleOrderedDevices();
    for (const device of visibleDevices) {
      const serial = device.serial;
      const meta = this.deviceMeta[serial] || {};
      if (meta.publicIp || this._publicIpRefreshInFlight.has(serial)) continue;
      if (device.offline || device.disconnected) continue;
      await this.refreshDevicePublicIp(serial);
      await new Promise(resolve => setTimeout(resolve, 260));
    }
  }

  async refreshDevicePublicIp(serial) {
    if (!this.pythonConnected || !serial) return null;
    if (this._publicIpRefreshInFlight.has(serial)) return this.deviceMeta[serial] || null;
    this._publicIpRefreshInFlight.add(serial);
    try {
      const response = await fetch(`${PYTHON_API}/device-public-ip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial })
      });
      const data = await response.json();
      const info = data.info || {};
      if (info.publicIp || info.countryCode) {
        this.deviceMeta[serial] = {
          ...(this.deviceMeta[serial] || {}),
          publicIp: info.publicIp || '',
          countryCode: info.countryCode || '',
          countryName: info.countryName || '',
        };
        this.updateDevicePublicIpBadge(serial);
      }
      return this.deviceMeta[serial] || null;
    } catch (e) {
      console.warn('No se pudo refrescar IP publica:', serial, e);
      return null;
    } finally {
      this._publicIpRefreshInFlight.delete(serial);
    }
  }

  updateDevicePublicIpBadge(serial) {
    const meta = this.deviceMeta[serial] || {};
    document.querySelectorAll(`[data-serial="${CSS.escape(serial)}"] .device-public-ip`).forEach(el => {
      const code = String(meta.countryCode || '').toUpperCase();
      const flagNode = el.querySelector('.device-flag, .device-flag-img');
      const text = el.querySelector('span:last-child');
      if (flagNode) {
        const wrapper = document.createElement('span');
        wrapper.innerHTML = this.renderCountryFlag(code, meta.countryName || '');
        flagNode.replaceWith(wrapper.firstElementChild);
      }
      if (text) text.textContent = meta.publicIp || 'IP publica...';
      el.title = meta.countryName || code || 'IP publica';
    });
  }

  normalizeDeviceState(device) {

    const rawState = String(device?.adbState || device?.state || '').toLowerCase();

    const rawStatus = String(device?.status || device?.connectionStatus || '').toLowerCase();

    if (rawState === 'unauthorized' || rawStatus === 'unauthorized') return 'unauthorized';

    if (rawState === 'offline' || rawStatus === 'offline') return 'offline';

    if (rawState === 'rebooting' || rawStatus === 'rebooting') return 'rebooting';

    if (rawState === 'reconnecting' || rawStatus === 'reconnecting') return 'reconnecting';

    if (device?.offline || device?.disconnected) return 'offline';

    return 'device';

  }


  getDeviceIdentityCandidates(deviceOrSerial) {

    const device = typeof deviceOrSerial === 'string'
      ? { serial: deviceOrSerial }
      : (deviceOrSerial || {});
    const keys = [];
    const addRaw = (value) => {
      const text = String(value || '').trim();
      if (!text) return;
      const key = text.toLowerCase();
      if (!keys.includes(key)) keys.push(key);
    };
    const addPrefixed = (prefix, value) => {
      const text = String(value || '').trim();
      if (!text) return;
      const key = `${prefix}:${text.toLowerCase()}`;
      if (!keys.includes(key)) keys.push(key);
    };

    addRaw(device.deviceId);
    addRaw(device.deviceKey);
    addPrefixed('mac', device.macAddress);
    addPrefixed('physical', device.physicalDeviceId);
    addPrefixed('android', device.androidId);
    addPrefixed('serial', device.serial);
    addPrefixed('serial', device.activeSerial);

    return keys;

  }


  isDeviceStreamUnavailable(device) {

    const state = this.normalizeDeviceState(device);

    return state === 'offline' || state === 'rebooting' || state === 'reconnecting' || state === 'unauthorized';

  }


  markDeviceStreamUnavailable(serial) {

    if (!serial) return;

    // Un estado offline/rebooting/reconnecting es transitorio: no cerrar la
    // sesion H.264 ni borrar el canvas del Grid. El overlay rojo comunica el
    // estado sin destruir la superficie que debe repintarse al reconectar.
    if (!this._temporarilyUnavailableStreams) this._temporarilyUnavailableStreams = new Set();
    this._temporarilyUnavailableStreams.add(serial);

  }


  refreshDeviceStreamAfterReconnect(serial) {
    if (!serial) return;
    if (this._reconnectStreamRefreshTimers?.[serial]) {
      clearTimeout(this._reconnectStreamRefreshTimers[serial]);
    } else if (!this._reconnectStreamRefreshTimers) {
      this._reconnectStreamRefreshTimers = {};
    }

    // Tras un reboot/offline real, cualquier bitmap previo queda obsoleto aunque
    // la sesion conserve frames validos. Reabrimos scrcpy/H.264 solo por esta
    // transicion de estado, no por umbrales de FPS ni pantallas estaticas.
    if (!this._gridReconnectRepaintUntil) this._gridReconnectRepaintUntil = {};
    this._gridReconnectRepaintUntil[serial] = Date.now() + 30000;
    this._reconnectStreamRefreshTimers[serial] = setTimeout(() => {
      delete this._reconnectStreamRefreshTimers[serial];
      try {
        const gridCanvas = this.streamRenderer?.canvases?.get(serial) || null;
        const restarted = !!(this.h264Renderer && typeof this.h264Renderer.forceRestart === 'function'
          && this.h264Renderer.forceRestart(serial, null, gridCanvas));
        if (restarted) {
          console.log(`[H264] Reabriendo sesion scrcpy post-reconexion para ${serial}`);
          this._gridReconnectRepaintUntil[serial] = Date.now() + 30000;
          this.scheduleGridPostReconnectCanvasSync(serial);
        } else {
          console.log(`[H264] Re-sincronizando canvas post-reconexion para ${serial}`);
        }
        if (this.livePreviewEnabled) this.createCanvasesForVisibleDevices();
      } catch (error) {
        console.warn('[H264] No se pudo resincronizar stream tras reconexion:', serial, error);
      }
    }, 1200);
  }


  scheduleGridPostReconnectCanvasSync(serial) {
    if (!serial) return;
    if (!this._gridPostReconnectSyncTimers) this._gridPostReconnectSyncTimers = {};
    if (this._gridPostReconnectSyncTimers[serial]) {
      for (const timer of this._gridPostReconnectSyncTimers[serial]) clearTimeout(timer);
    }

    const delays = [0, 350, 900, 1800, 3500, 6500, 10000];
    this._gridPostReconnectSyncTimers[serial] = delays.map(delay => setTimeout(() => {
      try {
        if (!this.livePreviewEnabled) return;
        this.createCanvasesForVisibleDevices();
        const canvas = this.streamRenderer?.canvases?.get(serial);
        if (canvas && this.h264Renderer && typeof this.h264Renderer.ensureCanvas === 'function') {
          this.h264Renderer.ensureCanvas(serial, canvas);
        }
      } catch (error) {
        console.warn('[H264-grid] No se pudo asegurar canvas post-reconexion:', serial, error);
      }
    }, delay));

    const cleanupTimer = setTimeout(() => {
      delete this._gridPostReconnectSyncTimers[serial];
    }, delays[delays.length - 1] + 500);
    this._gridPostReconnectSyncTimers[serial].push(cleanupTimer);
  }


  markDeviceRuntimeState(serial, state) {

    if (!serial) return;

    if (state && state !== 'device') this.deviceRuntimeState[serial] = { state, at: Date.now() };

    else delete this.deviceRuntimeState[serial];

    if (state && state !== 'device') this.markDeviceStreamUnavailable(serial);

  }


  createCanvasesForVisibleDevices() {
    const visibleDevices = this.getVisibleOrderedDevices();
    const visibleSerials = new Set(visibleDevices.map(d => d.serial));
    
    // FASE 1: Limpiar canvas de dispositivos que ya no son visibles en pantalla
    for (const [serial, canvas] of this.streamRenderer.canvases) {
      if (!visibleSerials.has(serial)) {
        this.streamRenderer.canvases.delete(serial);
        this.streamRenderer.contexts.delete(serial);
      }
    }

    // FASE 2: Lista de devices visibles para detach de sesiones de grid.
    if (this.h264Renderer) {
      for (const [key] of this.h264Renderer.sessions) {
        if (key.includes('|')) continue;
        const serial = key;
        if (!visibleSerials.has(serial)) {
          try { this.h264Renderer.detach(serial); } catch {}
        }
      }
    }
    
    // FASE 3: Reasignar los canvas a los nuevos contenedores o crearlos si no existen
    for (const device of visibleDevices) {
      const serial = device.serial;
      
      if (this.isDeviceStreamUnavailable(device)) {
        const container = document.querySelector(`[data-live-serial="${this.escapeHtml(serial)}"]`);
        const existingCanvas = this.streamRenderer?.canvases?.get(serial);
        if (container && existingCanvas && !container.contains(existingCanvas)) {
          try {
            container.insertBefore(existingCanvas, container.firstChild || null);
          } catch {
            try { container.appendChild(existingCanvas); } catch {}
          }
        }
        try { this.markDeviceStreamUnavailable(serial); } catch {}
        continue;
      }
      
      if (this._temporarilyUnavailableStreams) this._temporarilyUnavailableStreams.delete(serial);

      const container = document.querySelector(`[data-live-serial="${this.escapeHtml(serial)}"]`);
      let canvas = this.streamRenderer.canvases.get(serial);
      
      if (!canvas) {
        // Crear canvas si es nuevo
        canvas = this.streamRenderer.createCanvas(serial, 360, 720);
        if (!this.h264Renderer && !this.streamRenderer.subscribedSerials.has(serial)) {
          this.getAndroidIdAndSubscribe(serial);
        }
        if (this.h264Renderer && canvas) {
          try {
            const gridPreset = this.getGridPresetForZoom(this.deviceZoom);
            localStorage.setItem('flowdashboard.grid.preset', gridPreset);
            this.h264Renderer.attach(serial, canvas, gridPreset);
          } catch (err) {}
        }
      } else {
        // El canvas ya existe, pero puede que su contenedor padre (creado en renderDevices) sea nuevo.
        // Lo movemos fisicamente en el DOM sin perder su contexto de render.
        if (container && !container.contains(canvas)) {
          container.innerHTML = '';
          container.appendChild(canvas);
        }
        
        // Asegurar que H.264 del grid siga conectado y que el canvas visible
        // este registrado como subscriber aunque la sesion ya tenga frames.
        if (this.h264Renderer) {
          const session = this.h264Renderer.sessions.get(serial);
          const stats = this.h264Renderer.getStats?.(serial);
          const wsOpen = !!(session?.ws && session.ws.readyState === WebSocket.OPEN);
          const hasValidFrame = stats?.framesDecoded > 0;
          const isBootTimeout = !hasValidFrame && (stats?.lastFrameAt ? performance.now() - stats.lastFrameAt > 10000 : false);
          const canvasAttachedToSession = !!(session?.canvases && session.canvases.has(canvas));
          const needsReconnect = !session || session._closed || !wsOpen || isBootTimeout;
          if (needsReconnect) {
            try {
              const gridPreset = this.getGridPresetForZoom(this.deviceZoom);
              localStorage.setItem('flowdashboard.grid.preset', gridPreset);
              this.h264Renderer.attach(serial, canvas, gridPreset);
            } catch {}
          } else {
            try {
              const repainted = typeof this.h264Renderer.ensureCanvas === 'function'
                ? this.h264Renderer.ensureCanvas(serial, canvas)
                : false;
              const shouldLogRepaint = !!(this._gridReconnectRepaintUntil?.[serial] && Date.now() < this._gridReconnectRepaintUntil[serial]);
              if (repainted && hasValidFrame && shouldLogRepaint) {
                console.log(`[H264-grid] Canvas Grid asegurado/repaint desde sesion viva: ${serial} attached=${canvasAttachedToSession}`);
                delete this._gridReconnectRepaintUntil[serial];
              } else if (!canvasAttachedToSession) {
                const gridPreset = this.getGridPresetForZoom(this.deviceZoom);
                localStorage.setItem('flowdashboard.grid.preset', gridPreset);
                this.h264Renderer.attach(serial, canvas, gridPreset);
              }
            } catch {}
          }
        }
      }
    }
  }

  /**
   * Obtiene el ANDROID_ID del dispositivo y se suscribe al streaming
   */
  async getAndroidIdAndSubscribe(serial) {
    if (this.h264Renderer) {
      return;
    }
    // Suscribirse inmediatamente con el serial IP (siempre funciona)
    this.streamRenderer.subscribeToDevice(serial);
    console.log(`📡 Suscrito a ${serial} (serial directo)`);
    
    // También intentar suscribirse con androidId si hay mapping
    try {
      const response = await fetch(`${CSHARP_API}/devices/mapping/${encodeURIComponent(serial)}`);
      if (response.ok) {
        const data = await response.json();
        const androidId = data.androidId;
        if (androidId && androidId !== serial) {
          console.log(`📱 También suscribiendo a ${serial} con ANDROID_ID: ${androidId}`);
          this.streamRenderer.subscribeToDevice(androidId);
          // Guardar mapping inverso: androidId -> serialIP
          this.deviceMappings[androidId] = serial;
        }
      }
    } catch (error) {
      // Silencioso - ya estamos suscritos con el serial
    }
  }

  renderDeviceCategoryFilters(scope = 'sidebar') {
    const active = this.deviceGroups.active || 'all';
    const groups = this.deviceGroups.groups || [];
    const idSuffix = scope === 'main' ? '-main' : '';

    // Contar dispositivos por categoría
    const countByGroup = {};
    this.devices.forEach(device => {
      const sid = this.getDeviceStableId(device);
      const gid = this.deviceGroups.assignments[sid] || '__todos__';
      countByGroup[gid] = (countByGroup[gid] || 0) + 1;
    });

    const renderChips = (deviceList) => {
      return deviceList.map((device, i) => {
        const sid = this.getDeviceStableId(device);
        const num = this.getDeviceNumber(device);
        const isSelected = this.selectedDeviceIds.has(device.serial);
        return `<div class="cat-chip ${isSelected ? 'is-selected' : ''}"
                     data-serial="${this.escapeHtml(device.serial)}"
                     data-stable="${this.escapeHtml(sid)}"
                     draggable="true"
                     title="${this.escapeHtml(this.deviceNames[sid] || device.serial)}"
                     onclick="event.stopPropagation(); app.catChipClick(event, '${this.escapeHtml(device.serial)}')"
                     ondragstart="app.catChipDragStart(event, '${this.escapeHtml(device.serial)}')"
                     ondragover="app.catChipDragOver(event)"
                     ondragleave="app.catChipDragLeave(event)"
                     ondrop="app.catChipDrop(event, '${this.escapeHtml(device.serial)}')"
                     ondragend="app.catChipDragEnd(event)">${num}</div>`;
      }).join('');
    };

    // Sección Todos
    const todosDevices = this.applyManualOrder(this.devices);
    const todosCollapsed = this._catCollapsed?.['all'] || false;
    const todosGridId = `cat-grid-all${idSuffix}`;
    const todosSection = `
      <div class="cat-section ${active === 'all' ? 'is-active' : ''} ${todosCollapsed ? 'is-collapsed' : ''}" data-cat-id="all">
        <div class="cat-section-header" onclick="app.toggleCatCollapse('all')">
          <span class="cat-section-name" onclick="event.stopPropagation(); app.setActiveDeviceCategory('all')">Todos</span>
          <span class="cat-section-count">${this.devices.length}</span>
          <span class="cat-collapse-icon">${todosCollapsed ? '▸' : '▾'}</span>
        </div>
        <div class="cat-chips-grid" id="${todosGridId}"
             ondragover="app.catDragOver(event)" ondragleave="app.catDragLeave(event)"
             ondrop="app.catDrop(event, 'all')"
             onmousedown="app.catRubberBandStart(event, '${todosGridId}')">${renderChips(todosDevices)}</div>
      </div>`;

    // Secciones de grupos
    const groupSections = groups.map((group, index) => {
      const color = this.categoryColor(index);
      const groupDevices = this.applyManualOrder(
        this.devices.filter(d => this.deviceGroups.assignments[this.getDeviceStableId(d)] === group.id)
      );
      const collapsed = this._catCollapsed?.[group.id] || false;
      const gridId = `cat-grid-${group.id}${idSuffix}`;
      return `
        <div class="cat-section ${active === group.id ? 'is-active' : ''} ${collapsed ? 'is-collapsed' : ''}" data-cat-id="${group.id}" style="--cat-color: ${color}">
          <div class="cat-section-header" onclick="app.toggleCatCollapse('${group.id}')">
            <span class="cat-dot" style="background:${color}"></span>
            <span class="cat-section-name" onclick="event.stopPropagation(); app.setActiveDeviceCategory('${group.id}')">${this.escapeHtml(group.name)}</span>
            <span class="cat-section-count">${groupDevices.length}</span>
            <span class="cat-collapse-icon">${collapsed ? '▸' : '▾'}</span>
            <button class="cat-delete-btn" onclick="event.stopPropagation(); app.deleteCategory('${group.id}')" title="Eliminar">x</button>
          </div>
          <div class="cat-chips-grid" id="${gridId}"
               ondragover="app.catDragOver(event)" ondragleave="app.catDragLeave(event)"
               ondrop="app.catDrop(event, '${group.id}')"
               onmousedown="app.catRubberBandStart(event, '${gridId}')">${renderChips(groupDevices)}</div>
        </div>`;
    }).join('');

    // Botón añadir categoría
    const addBtn = `
      <div style="display:flex; justify-content:space-between; margin-top:8px; gap:4px; padding:0 8px;">
        <button class="cat-add-btn" style="flex:1; border-radius:4px;" onclick="app.openCategoryPopover(event)" title="Nueva categoría">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg> Nueva Cat
        </button>
        <button class="cat-add-btn" style="flex:1; border-radius:4px;" onclick="app.reorganizeDeviceNumbers()" title="Reorganizar Numeración de 1 a N">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
            <path d="M3 6h18M3 12h18M3 18h18"/>
          </svg> Reorg #
        </button>
      </div>`;

    return todosSection + groupSections + addBtn;
  }

  getDeviceNumber(device) {
    const stableId = this.getDeviceStableId(device);
    if (this.deviceNumbers[stableId]) return this.deviceNumbers[stableId];
    
    // Asignar el siguiente número
    const vals = Object.values(this.deviceNumbers);
    const nextNum = vals.length > 0 ? Math.max(...vals) + 1 : 1;
    this.deviceNumbers[stableId] = nextNum;
    localStorage.setItem('flowdashboard.deviceNumbers', JSON.stringify(this.deviceNumbers));
    return nextNum;
  }

  reorganizeDeviceNumbers() {
    if (!confirm('¿Reorganizar numeración de los dispositivos conectados actualmente del 1 al ' + this.devices.length + '?')) return;
    const ordered = this.applyManualOrder(this.devices);
    const newNumbers = {};
    ordered.forEach((d, idx) => {
      newNumbers[this.getDeviceStableId(d)] = idx + 1;
    });
    this.deviceNumbers = { ...this.deviceNumbers, ...newNumbers };
    localStorage.setItem('flowdashboard.deviceNumbers', JSON.stringify(this.deviceNumbers));
    this.renderDevices();
    this.refreshCategoryFilters();
  }

  toggleCatCollapse(catId) {
    if (!this._catCollapsed) this._catCollapsed = {};
    this._catCollapsed[catId] = !this._catCollapsed[catId];
    this.refreshCategoryFilters();
  }

  catRubberBandStart(event, gridId) {
    if (event.button !== 0) return;
    const isEmptyArea = !event.target.classList.contains('cat-chip');
    const isCtrl = event.ctrlKey || event.metaKey;
    // Solo activar si: área vacía O Ctrl presionado
    if (!isEmptyArea && !isCtrl) return;
    const grid = document.getElementById(gridId);
    if (!grid) return;
    event.preventDefault();
    const gridRect = grid.getBoundingClientRect();
    const startX = event.clientX - gridRect.left;
    const startY = event.clientY - gridRect.top;
    const band = document.createElement('div');
    band.className = 'cat-rubber-band';
    band.style.cssText = `left:${startX}px;top:${startY}px;width:0;height:0`;
    grid.appendChild(band);
    // Sin Ctrl: limpiar selección previa
    if (!isCtrl) this.selectedDeviceIds.clear();
    let moved = false;
    const onMove = (e) => {
      moved = true;
      const curX = e.clientX - gridRect.left;
      const curY = e.clientY - gridRect.top;
      const x = Math.min(startX, curX), y = Math.min(startY, curY);
      const w = Math.abs(curX - startX), h = Math.abs(curY - startY);
      band.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
      const selL = x + gridRect.left, selT = y + gridRect.top;
      const selR = selL + w, selB = selT + h;
      grid.querySelectorAll('.cat-chip').forEach(chip => {
        const cr = chip.getBoundingClientRect();
        const hit = cr.left < selR && cr.right > selL && cr.top < selB && cr.bottom > selT;
        const serial = chip.dataset.serial;
        if (hit) { this.selectedDeviceIds.add(serial); chip.classList.add('is-selected'); }
        else if (!isCtrl) { this.selectedDeviceIds.delete(serial); chip.classList.remove('is-selected'); }
      });
      this.updateSelectedCount();
    };
    const onUp = () => {
      band.remove();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.querySelectorAll('[data-serial]').forEach(card => {
        card.classList.toggle('is-selected', this.selectedDeviceIds.has(card.dataset.serial));
      });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  deviceGridRubberBandStart(event) {
    if (event.button !== 0) return;
    if (event.target.closest('button, input, textarea, select, a')) return;
    const cardTarget = event.target.closest('.live-device-card');
    const isCtrl = event.ctrlKey || event.metaKey;
    if (cardTarget && !isCtrl) return;
    const grid = document.getElementById('deviceList');
    if (!grid) return;
    event.preventDefault();
    const gridRect = grid.getBoundingClientRect();
    const startX = event.clientX - gridRect.left + grid.scrollLeft;
    const startY = event.clientY - gridRect.top + grid.scrollTop;
    const band = document.createElement('div');
    band.className = 'device-rubber-band';
    band.style.cssText = `left:${startX}px;top:${startY}px;width:0;height:0`;
    grid.appendChild(band);
    if (!isCtrl) this.selectedDeviceIds.clear();
    const onMove = (e) => {
      const curX = e.clientX - gridRect.left + grid.scrollLeft;
      const curY = e.clientY - gridRect.top + grid.scrollTop;
      const x = Math.min(startX, curX), y = Math.min(startY, curY);
      const w = Math.abs(curX - startX), h = Math.abs(curY - startY);
      band.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
      const selL = Math.min(event.clientX, e.clientX);
      const selR = Math.max(event.clientX, e.clientX);
      const selT = Math.min(event.clientY, e.clientY);
      const selB = Math.max(event.clientY, e.clientY);
      grid.querySelectorAll('.live-device-card').forEach(card => {
        const cr = card.getBoundingClientRect();
        const hit = cr.left < selR && cr.right > selL && cr.top < selB && cr.bottom > selT;
        const serial = card.dataset.serial;
        if (hit) {
          this.selectedDeviceIds.add(serial);
          card.classList.add('is-selected');
        } else if (!isCtrl) {
          this.selectedDeviceIds.delete(serial);
          card.classList.remove('is-selected');
        }
      });
      document.querySelectorAll('.cat-chip').forEach(chip => {
        chip.classList.toggle('is-selected', this.selectedDeviceIds.has(chip.dataset.serial));
      });
      this.updateSelectedCount();
    };
    const onUp = () => {
      band.remove();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      this.refreshActionsTargetBadge();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  catChipClick(event, serial) {
    if (event.defaultPrevented) return;
    // Siempre toggle — sin limpiar otros seleccionados
    if (this.selectedDeviceIds.has(serial)) {
      this.selectedDeviceIds.delete(serial);
    } else {
      this.selectedDeviceIds.add(serial);
    }
    // Actualizar visual del chip
    const chip = event.currentTarget;
    chip.classList.toggle('is-selected', this.selectedDeviceIds.has(serial));
    this.updateSelectedCount();
    // Actualizar grilla principal
    document.querySelectorAll('[data-serial]').forEach(card => {
      card.classList.toggle('is-selected', this.selectedDeviceIds.has(card.dataset.serial));
    });
  }

  catChipDragStart(event, serial) {
    // Si el chip no está seleccionado, seleccionarlo solo
    if (!this.selectedDeviceIds.has(serial)) {
      this.selectedDeviceIds.clear();
      this.selectedDeviceIds.add(serial);
      this.refreshCategoryFilters();
    }
    const ids = this.getDragDeviceIds(serial);
    event.dataTransfer.setData('application/json', JSON.stringify(ids));
    event.dataTransfer.effectAllowed = 'move';
    // Marcar chips como dragging
    document.querySelectorAll('.cat-chip.is-selected').forEach(c => c.classList.add('is-dragging'));
  }

  catChipDragEnd(event) {
    document.querySelectorAll('.cat-chip.is-dragging').forEach(c => c.classList.remove('is-dragging'));
  }

  catChipDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('is-drag-over');
    event.stopPropagation();
  }

  catChipDragLeave(event) {
    event.currentTarget.classList.remove('is-drag-over');
  }

  async catChipDrop(event, targetSerial) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('is-drag-over');
    const movingIds = this.readDragIds(event);
    const targetId = this.getDeviceStableId(targetSerial);
    if (!movingIds.length || movingIds.includes(targetId)) return;
    this.reorderDevices(movingIds, targetId);
    await this.saveDeviceGroups();
    this.refreshCategoryFilters();
    this.renderDevices();
    this.scheduleLivePreviewSync(true);
  }

  catDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('is-drag-over');
  }

  catDragLeave(event) {
    event.currentTarget.classList.remove('is-drag-over');
  }

  async catDrop(event, categoryId) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('is-drag-over');
    const ids = this.readDragIds(event);
    if (!ids.length) return;
    ids.forEach(id => {
      if (categoryId && categoryId !== 'all') {
        this.deviceGroups.assignments[id] = categoryId;
      } else if (categoryId === 'all') {
        delete this.deviceGroups.assignments[id];
      }
    });
    await this.saveDeviceGroups();
    this.refreshCategoryFilters();
    this.renderDevices();
  }

  openCategoryPopover(event) {
    // Cerrar si ya está abierto
    const existing = document.getElementById('catCreatePopover');
    if (existing) { existing.remove(); return; }

    const popover = document.createElement('div');
    popover.id = 'catCreatePopover';
    popover.className = 'cat-create-popover';
    popover.innerHTML = `
      <input id="catCreateInput" class="cat-create-input" type="text" 
             placeholder="Nombre de la categoría..." maxlength="40"
             onkeydown="if(event.key==='Enter') app.saveCategoryPopover(); if(event.key==='Escape') document.getElementById('catCreatePopover').remove()">
      <div class="cat-create-actions">
        <button class="cat-create-cancel" onclick="document.getElementById('catCreatePopover').remove()">Cancelar</button>
        <button class="cat-create-save" onclick="app.saveCategoryPopover()">Crear</button>
      </div>`;

    document.body.appendChild(popover);

    // Posicionar cerca del botón
    const btn = event.currentTarget;
    const rect = btn.getBoundingClientRect();
    popover.style.top = `${rect.bottom + 6}px`;
    popover.style.left = `${rect.left}px`;

    const input = document.getElementById('catCreateInput');
    input.focus();

    // Cerrar al hacer clic fuera
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!popover.contains(e.target) && e.target !== btn) {
          popover.remove();
          document.removeEventListener('click', handler);
        }
      });
    }, 100);
  }

  async saveCategoryPopover() {
    const input = document.getElementById('catCreateInput');
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    const id = `cat_${Date.now().toString(36)}`;
    this.deviceGroups.groups.push({ id, name: name.slice(0, 80) });
    document.getElementById('catCreatePopover').remove();
    await this.saveDeviceGroups();
    this.refreshCategoryFilters();
  }

  async deleteCategory(groupId) {
    if (!confirm('Eliminar esta categoria? Los dispositivos quedaran sin categoria.')) return;
    this.deviceGroups.groups = this.deviceGroups.groups.filter(g => g.id !== groupId);
    Object.keys(this.deviceGroups.assignments).forEach(sid => {
      if (this.deviceGroups.assignments[sid] === groupId) delete this.deviceGroups.assignments[sid];
    });
    if (this.deviceGroups.active === groupId) this.deviceGroups.active = 'all';
    await this.saveDeviceGroups();
    this.refreshCategoryFilters();
    this.renderDevices();
  }

  setDeviceViewMode(mode) {
    this.deviceViewMode = mode === 'grid' ? 'grid' : 'live';
    this.livePreviewEnabled = this.deviceViewMode !== 'grid';
    localStorage.setItem('flowdashboard.electron.deviceViewMode', this.deviceViewMode);
    localStorage.setItem('flowdashboard.livePreviewEnabled', this.livePreviewEnabled ? 'true' : 'false');
    this.renderDevices();
    this.refreshCategoryFilters();
    if (this.livePreviewEnabled) this.scheduleLivePreviewSync(true);
    else this.stopLivePreviewStreams();
  }

  setDeviceZoom(value) {
    const zoom = Math.max(60, Math.min(500, parseInt(value, 10) || 178));
    this.deviceZoom = zoom;
    localStorage.setItem('flowdashboard.electron.deviceZoom', String(zoom));
    const list = document.getElementById('deviceList');
    if (list) list.style.setProperty('--device-live-size', `${zoom}px`);

    // FASE 1: El zoom SOLO cambia el tamaño visual CSS de las tarjetas.
    // El cambio de calidad del grid se hace de forma explícita desde setGridQuality().

    // 2026-05-30: las dos notas antiguas de FASE 1 quedan obsoletas; el bloque activo
    // cambia la calidad automaticamente por zoom.
    const newPreset = this.getGridPresetForZoom(zoom);
    const currentPreset = localStorage.getItem('flowdashboard.grid.preset') || 'thumbnail';
    if (newPreset !== currentPreset) {
      this.setGridQuality(newPreset);
    } else {
      localStorage.setItem('flowdashboard.grid.preset', newPreset);
    }

    if (this.livePreviewEnabled) {
      this.scheduleLivePreviewSync(true);
    }
  }

  getGridPresetForZoom(value) {
    const zoom = Math.max(60, Math.min(500, parseInt(value, 10) || 178));
    if (zoom < 120) return 'thumbnail';
    if (zoom <= 220) return 'eco';
    return 'balanced';
  }

  setDeviceGap(value) {
    const gap = Math.max(0, Math.min(60, parseInt(value, 10) || 16));
    this.deviceGap = gap;
    localStorage.setItem('flowdashboard.deviceGap', String(gap));
    const list = document.getElementById('deviceList');
    if (list) list.style.setProperty('--device-gap', `${gap}px`);
  }

  setFocusQuality(newPreset) {
    const focusPreset = ['eco', 'balanced', 'pro'].includes(newPreset) ? newPreset : 'balanced';
    localStorage.setItem('flowdashboard.focus.preset', focusPreset);

    if (!this.h264Renderer || !this.flowTouch) return;
    const serial = this.flowTouch.activeSerial;
    const focusCanvas = this.flowTouch.focusCanvas;
    if (!serial || !focusCanvas) return;

    // Focus usa una sesion H.264 independiente (`serial|preset`) para no
    // interferir con el thumbnail de grilla. Cambiar calidad reinicia solo
    // la sesion Focus y deja la grilla con su preset propio.
    if (typeof this.h264Renderer.detachAllFocus === 'function') {
      this.h264Renderer.detachAllFocus(serial);
    }
    if (typeof this.h264Renderer.attachFocus === 'function') {
      this.flowTouch._focusSession = this.h264Renderer.attachFocus(serial, focusCanvas, focusPreset);
      if (this.flowTouch._focusSession) {
        this.flowTouch._focusSerialKey = `${serial}|${focusPreset}`;
      }
    } else {
      this.flowTouch._focusSession = this.h264Renderer.attach(serial, focusCanvas, focusPreset);
      if (this.flowTouch._focusSession) {
        this.flowTouch._focusSerialKey = serial;
      }
    }
    this.flowTouch._currentFocusPreset = focusPreset;

    console.log(`[Focus] Calidad independiente: ${serial} -> ${focusPreset}`);
  }

  setGridQuality(preset) {
    // Guarda el preset del grid y reabre todas las sesiones H264 con la nueva calidad.
    localStorage.setItem('flowdashboard.grid.preset', preset);
    if (!this.h264Renderer) return;

    // Cancelar cualquier reconexion escalonada pendiente del cambio anterior.
    if (this._gridQualityTimers) {
      this._gridQualityTimers.forEach(t => clearTimeout(t));
    }
    this._gridQualityTimers = [];

    // Recopilar sesiones del grid (excluir focus) antes de cerrarlas.
    const toReopen = [];
    for (const [key, session] of this.h264Renderer.sessions) {
      if (key.includes('|')) continue;
      const serial = session.serial;
      const canvas = this.streamRenderer.canvases.get(serial);
      try {
        this.h264Renderer.detach(serial); // cierra sesion y WS
      } catch (_) {}
      if (canvas && document.contains(canvas)) {
        toReopen.push({ serial, canvas });
      }
    }

    // Reabrir escalonado: 1 dispositivo cada 200 ms
    const STAGGER_MS = 200;
    const focusSerial = this.flowTouch?.activeSerial || this.flowTouch?.getActiveSerial?.();
    const focusCanvas = this.flowTouch?.focusCanvas;
    toReopen.forEach(({ serial, canvas }, idx) => {
      const t = setTimeout(() => {

        if (canvas && document.contains(canvas)) {
          try {
            this.h264Renderer.attach(serial, canvas, preset);
            if (focusSerial && serial === focusSerial && focusCanvas && document.contains(focusCanvas)) {
              this.h264Renderer.attach(serial, focusCanvas, preset);
              this.flowTouch._currentFocusPreset = preset;
            }
          } catch (_) {}
        }
      }, idx * STAGGER_MS);
      this._gridQualityTimers.push(t);
    });
  }

  setPerformanceProfile(profile) {
    this.performanceProfile = { ...this.performanceProfile, ...profile };
    localStorage.setItem('flowdashboard.perf.maxSize', String(this.performanceProfile.maxSize));
    localStorage.setItem('flowdashboard.perf.maxFps', String(this.performanceProfile.maxFps));
    localStorage.setItem('flowdashboard.perf.bitRate', this.performanceProfile.bitRate);
    localStorage.setItem('flowdashboard.perf.ultraLight', String(this.performanceProfile.ultraLight));
    
    // Con canvas WebP, relanzar streams con la nueva config
    if (this.livePreviewEnabled) {
      this.stopLivePreviewStreams().then(() => this.scheduleLivePreviewSync(true));
    }
  }

  getPerformanceLabel() {
    const { maxSize, maxFps, bitRate, ultraLight } = this.performanceProfile;
    if (ultraLight) return '⚡ Ultra-Light (sin video)';
    return `${maxSize}p @ ${maxFps}fps / ${bitRate}`;
  }

  openAccountsHistoryModal() {
    let modal = document.getElementById('accountsHistoryModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'account-editor-modal';
      modal.id = 'accountsHistoryModal';
      modal.innerHTML = `
        <div class="account-editor-backdrop" onclick="app.closeAccountsHistoryModal()"></div>
        <div class="account-editor-card" style="max-width: 600px; width: 90%;">
          <div class="account-editor-header">
            <h2 class="account-editor-title">Historial de Cuentas</h2>
            <button class="account-editor-close" onclick="app.closeAccountsHistoryModal()">✕</button>
          </div>
          <div class="account-editor-content">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <input type="text" id="accountsHistorySearch" placeholder="Buscar por correo, dispositivo, fecha..." style="flex:1; padding:8px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3); color:white; font-size:14px; margin-right:12px;" oninput="app.renderAccountsHistory()">
              <button class="btn-danger" onclick="app.clearAccountsHistory()" style="padding:8px 14px;">Limpiar</button>
            </div>
            <div id="accountsHistoryContainer" style="max-height: 400px; overflow-y:auto; border:1px solid rgba(255,255,255,0.05); border-radius:6px; background:rgba(0,0,0,0.2); padding:8px;">
              <!-- Lista dinámica -->
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    modal.classList.add('is-open');
    this.renderAccountsHistory();
  }

  closeAccountsHistoryModal() {
    const modal = document.getElementById('accountsHistoryModal');
    if (modal) modal.classList.remove('is-open');
  }

  renderAccountsHistory() {
    const container = document.getElementById('accountsHistoryContainer');
    const searchInput = document.getElementById('accountsHistorySearch');
    if (!container) return;

    let history = [];
    try { history = JSON.parse(localStorage.getItem('flowdashboard.accountsHistory') || '[]'); } catch(e){}

    const term = searchInput ? searchInput.value.toLowerCase() : '';
    if (term) {
      history = history.filter(h => 
        (h.accounts && h.accounts.some(a => a.toLowerCase().includes(term))) ||
        (h.account && h.account.toLowerCase().includes(term)) || 
        (h.deviceName && h.deviceName.toLowerCase().includes(term)) ||
        (h.deviceIp && h.deviceIp.toLowerCase().includes(term)) ||
        h.date.includes(term)
      );
    }

    if (history.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:rgba(255,255,255,0.5); font-size:13px;">No hay registros de asignación.</div>';
      return;
    }

    const html = history.map(h => {
      const d = new Date(h.date);
      const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
      const ip = h.deviceIp && h.deviceIp !== 'N/A' ? h.deviceIp : 'IP Local / ADB';
      const num = h.deviceNumber || '?';
      const accList = h.accounts ? h.accounts.map(a => `<li style="padding:2px 0;">${a.split(this.accountsDelimiter||':')[0]}</li>`).join('') : `<li style="padding:2px 0;">${h.account}</li>`; // Backward compatible
      
      return `
        <div style="background: rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap: 10px;">
              <div style="background: var(--accent); color:#000; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:14px;">
                ${num}
              </div>
              <div>
                <div style="font-weight:600; font-size:14px; color:white;">${h.deviceName}</div>
                <div style="font-size:11px; color:rgba(255,255,255,0.4);"><span style="color:var(--accent)">IP:</span> ${ip} &nbsp;|&nbsp; <span style="color:var(--accent)">Serial:</span> ${h.deviceSerial}</div>
              </div>
            </div>
            <div style="color:rgba(255,255,255,0.4); font-size:11px; text-align:right;">
              ${dateStr}
            </div>
          </div>
          <div style="padding-left: 38px;">
            <ul style="margin:0; padding:0; list-style:none; color:rgba(255,255,255,0.7); font-size:13px; max-height:80px; overflow-y:auto;">
              ${accList}
            </ul>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  clearAccountsHistory() {
    if (confirm('¿Estás seguro de limpiar todo el historial de cuentas asignadas?')) {
      localStorage.removeItem('flowdashboard.accountsHistory');
      this.renderAccountsHistory();
    }
  }

  openPlansModal() {
    const modal = document.getElementById('plansModal');
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  closePlansModal() {
    const modal = document.getElementById('plansModal');
    if (modal) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  toggleToolsSection() {
    this.toolsOpen = !this.toolsOpen;
    localStorage.setItem('flowdashboard.toolsOpen', this.toolsOpen ? 'true' : 'false');
    const content = document.getElementById('toolsSectionContent');
    const arrow = document.getElementById('toolsArrow');
    if (content) content.style.display = this.toolsOpen ? 'block' : 'none';
    if (arrow) arrow.style.transform = this.toolsOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
  }

  async openFlowTrackNamePanel() {
    await this.launchFlowTrackNameDirect();
  }

  async launchFlowTrackNameDirect() {
    this._setFlowTrackNameState('Abriendo...', 'running');
    try {
      if (!window.electronAPI?.launchFlowTrackName) throw new Error('IPC Electron no disponible.');
      const result = await window.electronAPI.launchFlowTrackName();
      if (!result?.ok) throw new Error(result?.error || 'No se pudo abrir FlowTrackName.');
      const meta = result.pid ? `PID ${result.pid}` : (result.path || 'Herramientas/FlowTrackName.exe');
      this._setFlowTrackNameState(result.alreadyRunning ? 'Ya estaba abierto' : 'Abierto', 'ok', meta);
    } catch (error) {
      this._setFlowTrackNameState(`Error: ${error.message || error}`, 'error');
    }
  }

  closeFlowTrackNamePanel() {
    const panel = document.getElementById('flowTrackNamePanel');
    if (panel) panel.remove();
  }

  _ensureFlowTrackNamePanel() {
    let panel = document.getElementById('flowTrackNamePanel');
    if (panel) {
      panel.classList.remove('is-hidden');
      this._normalizeFlowTrackNamePanel(panel);
      return panel;
    }

    panel = document.createElement('div');
    panel.id = 'flowTrackNamePanel';
    panel.className = 'flowtrackname-panel';
    panel.style.left = localStorage.getItem('flowdashboard.flowTrackNamePanel.left') || '326px';
    panel.style.top = localStorage.getItem('flowdashboard.flowTrackNamePanel.top') || '96px';
    panel.innerHTML = `
      <div class="flowtrackname-panel-header" data-flowtrackname-drag>
        <div class="flowtrackname-title">
          <span class="flowtrackname-mark">
            <svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M12 8h5"/></svg>
          </span>
          <div>
            <strong>FlowTrackName</strong>
            <small id="flowTrackNamePanelStatus">${this.escapeHtml(this.flowTrackNameStatus || 'Listo')}</small>
          </div>
        </div>
        <button class="flowtrackname-icon-btn" onclick="app.closeFlowTrackNamePanel()" title="Cerrar">
          <svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div class="flowtrackname-panel-body">
        <div class="flowtrackname-state-row">
          <span class="flowtrackname-state-dot ${this.flowTrackNameTone ? `is-${this.flowTrackNameTone}` : ''}" id="flowTrackNamePanelDot"></span>
          <span id="flowTrackNamePanelMeta">${this.escapeHtml(this.flowTrackNameLastLaunch || 'Herramientas/FlowTrackName.exe')}</span>
        </div>
        <div class="flowtrackname-actions">
          <button class="flowtrackname-action-btn is-primary" onclick="app.launchFlowTrackNameFromPanel()">
            <svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5Z"/></svg>
            Abrir
          </button>
          <button class="flowtrackname-action-btn" onclick="app.refreshFlowTrackNamePanel()">
            <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15-6.7"/><path d="M18 3v6h-6"/><path d="M21 12a9 9 0 0 1-15 6.7"/><path d="M6 21v-6h6"/></svg>
            Estado
          </button>
          <button class="flowtrackname-action-btn is-danger" onclick="app.stopFlowTrackNameFromPanel()">
            <svg viewBox="0 0 24 24"><path d="M7 7h10v10H7z"/></svg>
            Detener
          </button>
        </div>
      </div>`;
    document.body.appendChild(panel);
    this._bindFlowTrackNamePanelDrag(panel);
    this._normalizeFlowTrackNamePanel(panel);
    return panel;
  }

  _setFlowTrackNameState(message, tone = '', meta = '') {
    this.flowTrackNameStatus = message || 'Listo';
    this.flowTrackNameTone = tone || '';
    if (meta) this.flowTrackNameLastLaunch = meta;

    const menuDot = document.querySelector('.tool-menu-status');
    if (menuDot) {
      menuDot.className = `tool-menu-status ${tone ? `is-${tone}` : ''}`;
    }
    const status = document.getElementById('flowTrackNamePanelStatus');
    if (status) status.textContent = this.flowTrackNameStatus;
    const dot = document.getElementById('flowTrackNamePanelDot');
    if (dot) dot.className = `flowtrackname-state-dot ${tone ? `is-${tone}` : ''}`;
    const metaEl = document.getElementById('flowTrackNamePanelMeta');
    if (metaEl) metaEl.textContent = this.flowTrackNameLastLaunch || 'Herramientas/FlowTrackName.exe';
  }

  async launchFlowTrackNameFromPanel() {
    this._ensureFlowTrackNamePanel();
    this._setFlowTrackNameState('Abriendo...', 'running');
    try {
      if (!window.electronAPI?.launchFlowTrackName) throw new Error('IPC Electron no disponible.');
      const result = await window.electronAPI.launchFlowTrackName();
      if (!result?.ok) throw new Error(result?.error || 'No se pudo abrir FlowTrackName.');
      const meta = result.pid ? `PID ${result.pid}` : (result.path || 'Herramientas/FlowTrackName.exe');
      this._setFlowTrackNameState(result.alreadyRunning ? 'Ya estaba abierto' : 'Abierto', 'ok', meta);
    } catch (error) {
      this._setFlowTrackNameState(`Error: ${error.message || error}`, 'error');
    }
  }

  async refreshFlowTrackNamePanel() {
    this._ensureFlowTrackNamePanel();
    try {
      if (!window.electronAPI?.getFlowTrackNameStatus) throw new Error('IPC Electron no disponible.');
      const status = await window.electronAPI.getFlowTrackNameStatus();
      if (!status?.ok) throw new Error(status?.error || 'No se pudo consultar.');
      if (!status.exists) {
        this._setFlowTrackNameState('No encontrado', 'error', status.path || 'Herramientas/FlowTrackName.exe');
      } else if (status.running) {
        this._setFlowTrackNameState('Ejecutandose', 'ok', status.pid ? `PID ${status.pid}` : status.path);
      } else {
        this._setFlowTrackNameState('Listo', '', status.path || 'Herramientas/FlowTrackName.exe');
      }
    } catch (error) {
      this._setFlowTrackNameState(`Error: ${error.message || error}`, 'error');
    }
  }

  async stopFlowTrackNameFromPanel() {
    this._ensureFlowTrackNamePanel();
    try {
      if (!window.electronAPI?.stopFlowTrackName) throw new Error('IPC Electron no disponible.');
      const result = await window.electronAPI.stopFlowTrackName();
      if (!result?.ok) throw new Error(result?.error || 'No se pudo detener.');
      this._setFlowTrackNameState('Detenido', '', result.pid ? `PID ${result.pid}` : '');
    } catch (error) {
      this._setFlowTrackNameState(`Error: ${error.message || error}`, 'error');
    }
  }

  _normalizeFlowTrackNamePanel(panel) {
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const margin = 12;
    let left = parseInt(panel.style.left, 10);
    let top = parseInt(panel.style.top, 10);
    if (!Number.isFinite(left)) left = 326;
    if (!Number.isFinite(top)) top = 96;
    left = Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - rect.height - margin));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  _bindFlowTrackNamePanelDrag(panel) {
    const handle = panel.querySelector('[data-flowtrackname-drag]');
    if (!handle) return;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    const onMove = (event) => {
      if (!dragging) return;
      const rect = panel.getBoundingClientRect();
      const margin = 12;
      const left = Math.max(margin, Math.min(startLeft + event.clientX - startX, window.innerWidth - rect.width - margin));
      const top = Math.max(margin, Math.min(startTop + event.clientY - startY, window.innerHeight - rect.height - margin));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    };
    const onUp = () => {
      dragging = false;
      document.removeEventListener('mousemove', onMove);
      localStorage.setItem('flowdashboard.flowTrackNamePanel.left', panel.style.left);
      localStorage.setItem('flowdashboard.flowTrackNamePanel.top', panel.style.top);
    };
    handle.addEventListener('mousedown', (event) => {
      if (event.button !== 0 || event.target.closest('button')) return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = parseInt(panel.style.left, 10) || panel.offsetLeft || 326;
      startTop = parseInt(panel.style.top, 10) || panel.offsetTop || 96;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp, { once: true });
      event.preventDefault();
    });
  }

  openHelpModal() {
    const modal = document.getElementById('helpModal');
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  closeHelpModal() {
    const modal = document.getElementById('helpModal');
    if (modal) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  openLicensePanel() {
    showLicenseModal();
  }

  openPerformancePanel() {
    const modal = document.getElementById('performancePanelModal');
    if (!modal) return;

    document.getElementById('perfMaxSize').value = this.performanceProfile.maxSize;
    document.getElementById('perfMaxFps').value = this.performanceProfile.maxFps;
    document.getElementById('perfBitRate').value = this.performanceProfile.bitRate;
    document.getElementById('perfUltraLight').checked = this.performanceProfile.ultraLight;

    this.updatePerformancePreview();

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  closePerformancePanel() {
    const modal = document.getElementById('performancePanelModal');
    if (modal) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  updatePerformancePreview() {
    const maxSize = parseInt(document.getElementById('perfMaxSize').value, 10);
    const maxFps = parseInt(document.getElementById('perfMaxFps').value, 10);
    const bitRate = document.getElementById('perfBitRate').value;
    const ultraLight = document.getElementById('perfUltraLight').checked;
    
    const label = ultraLight ? '⚡ Ultra-Light (sin video)' : `${maxSize}p @ ${maxFps}fps / ${bitRate}`;
    document.getElementById('perfPreviewLabel').textContent = label;
    
    // Mostrar descripción
    let desc = '';
    if (ultraLight) {
      desc = 'Solo estado, sin video. Máximo rendimiento.';
    } else {
      if (maxSize <= 360) desc = 'Muy bajo: máximo rendimiento, mínima calidad.';
      else if (maxSize <= 480) desc = 'Bajo: buen rendimiento, calidad aceptable.';
      else if (maxSize <= 600) desc = 'Medio: balance rendimiento/calidad.';
      else desc = 'Alto: mejor calidad, más recursos.';
    }
    document.getElementById('perfDescription').textContent = desc;
  }

  applyPerformanceProfile() {
    const maxSize = parseInt(document.getElementById('perfMaxSize').value, 10);
    const maxFps = parseInt(document.getElementById('perfMaxFps').value, 10);
    const bitRate = document.getElementById('perfBitRate').value;
    const ultraLight = document.getElementById('perfUltraLight').checked;
    
    this.setPerformanceProfile({ maxSize, maxFps, bitRate, ultraLight });
    this.closePerformancePanel();
    console.log('✅ Perfil de rendimiento aplicado:', this.performanceProfile);
  }

  applyPerformancePreset(preset) {
    const presets = {
      ultralight: { maxSize: 360, maxFps: 12, bitRate: '1M', ultraLight: true },
      low: { maxSize: 360, maxFps: 12, bitRate: '1M', ultraLight: false },
      medium: { maxSize: 480, maxFps: 24, bitRate: '2M', ultraLight: false },
      high: { maxSize: 720, maxFps: 60, bitRate: '8M', ultraLight: false }
    };
    
    const config = presets[preset];
    if (!config) return;
    
    document.getElementById('perfMaxSize').value = config.maxSize;
    document.getElementById('perfMaxFps').value = config.maxFps;
    document.getElementById('perfBitRate').value = config.bitRate;
    document.getElementById('perfUltraLight').checked = config.ultraLight;
    
    this.updatePerformancePreview();
  }

  toggleFlowCategorySection() {
    const content = document.getElementById('flowCategorySectionContent');
    const arrow = document.getElementById('flowCategoryArrow');
    if (!content) return;
    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? '' : 'none';
    if (arrow) arrow.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
  }

  toggleDevMode() {
    this.isFlowDevEnabled = !this.isFlowDevEnabled;
    this.devMode = this.isFlowDevEnabled;
    localStorage.setItem('flowdashboard.devMode', this.isFlowDevEnabled ? '1' : '0');
    if (this.devInspector && typeof this.devInspector.saveState === 'function') this.devInspector.saveState();
    this._applyDevMode(true);
  }

  _applyDevMode(animate) {
    const toggle = document.getElementById('devModeToggle');
    const normalView = document.getElementById('normalView');
    const inspectorView = document.getElementById('inspectorView');
    if (!toggle || !normalView || !inspectorView) return;

    toggle.setAttribute('aria-checked', String(this.isFlowDevEnabled));
    toggle.classList.toggle('is-active', this.isFlowDevEnabled);

    if (this.isFlowDevEnabled) {
      normalView.style.display = 'none';
      inspectorView.style.display = 'flex';
      if (this.devInspector) this.devInspector.onActivate();
    } else {
      normalView.style.display = '';
      inspectorView.style.display = 'none';
      if (this.devInspector) this.devInspector.onDeactivate();
    }
  }

  toggleDispositivosSection() {
    const content = document.getElementById('dispositivosSectionContent');
    const arrow = document.getElementById('dispositivosArrow');
    if (!content) return;
    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? '' : 'none';
    if (arrow) arrow.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
  }

  toggleStatusPanel() {
    const panel = document.getElementById('statusPanel');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    if (isOpen) {
      this.closeStatusPanel();
    } else {
      panel.style.display = 'block';
      this.updateStatusPanel();
      // Cerrar al hacer clic fuera
      setTimeout(() => {
        document.addEventListener('click', this._statusPanelOutside = (e) => {
          const pill = document.getElementById('statusPill');
          if (!panel.contains(e.target) && !pill.contains(e.target)) {
            this.closeStatusPanel();
          }
        });
      }, 50);
    }
  }

  closeStatusPanel() {
    const panel = document.getElementById('statusPanel');
    if (panel) panel.style.display = 'none';
    if (this._statusPanelOutside) {
      document.removeEventListener('click', this._statusPanelOutside);
      this._statusPanelOutside = null;
    }
  }

  updateStatusPanel() {
    const set = (id, val, ok) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = val;
      el.className = 'status-panel-val ' + (ok === true ? 'is-ok' : ok === false ? 'is-err' : '');
    };
    set('spAdb', this.connected ? 'Online' : 'Offline', this.connected);
    set('spPython', this.pythonConnected ? 'Online' : 'Offline', this.pythonConnected);
    const wsState = this.streamRenderer.connection ? this.streamRenderer.connection.readyState : 3;
    const wsLabels = { 0: 'Conectando…', 1: 'Online', 2: 'Cerrando…', 3: 'Offline' };
    set('spWs', wsLabels[wsState] ?? '-', wsState === 1);
    set('spDevices', String(this.devices.length), null);
    set('spSelected', String(this.selectedDeviceIds.size), null);
    // FPS promedio del stream renderer
    const fps = this.streamRenderer.getAverageFps?.() ?? null;
    set('spFps', fps !== null ? `${fps.toFixed(1)}` : '-', null);
    // Actualizar mini-badge en el pill
    const badge = document.getElementById('statusPillDevices');
    if (badge) {
      if (this.devices.length > 0) {
        badge.textContent = `${this.devices.length} disp.`;
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  refreshCategoryFilters() {
    const container = document.getElementById('deviceCategoryFilters');
    if (container) container.innerHTML = this.renderDeviceCategoryFilters();
    const pinned = document.getElementById('mainFlowCategoryPinned');
    if (pinned) pinned.innerHTML = this.renderPinnedFlowCategoryBar();
  }

  setActiveDeviceCategory(categoryId) {
    this.deviceGroups.active = categoryId;
    this.refreshCategoryFilters();
    this.renderDevices();
    this.scheduleLivePreviewSync(true);
  }

  async createDeviceCategory() {
    this.openCategoryEditor();
  }

  openCategoryEditor() {
    const modal = document.getElementById('categoryEditorModal');
    const input = document.getElementById('categoryEditorInput');
    if (!modal || !input) return;
    input.value = '';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => input.focus(), 40);
  }

  closeCategoryEditor() {
    const modal = document.getElementById('categoryEditorModal');
    if (modal) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  async saveCategoryEditor() {
    const input = document.getElementById('categoryEditorInput');
    const name = input.value || '';
    if (!name.trim()) {
      input.focus();
      return;
    }
    const id = `cat_${Date.now().toString(36)}`;
    this.deviceGroups.groups.push({ id, name: name.trim().slice(0, 80) });
    this.deviceGroups.active = id;
    await this.saveDeviceGroups();
    this.closeCategoryEditor();
    this.renderDevices();
  }

  async saveDeviceGroups() {
    if (!this.pythonConnected) return;
    const payload = {
      groups: this.deviceGroups.groups,
      assignments: this.deviceGroups.assignments,
      order: this.deviceGroups.order
    };
    const response = await fetch(`${PYTHON_API}/device-groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('No se pudieron guardar las categorias');
    const data = await response.json();
    this.deviceGroups.groups = Array.isArray(data.groups) ? data.groups : this.deviceGroups.groups;
    this.deviceGroups.assignments = data.assignments || this.deviceGroups.assignments;
    this.deviceGroups.order = Array.isArray(data.order) ? data.order : this.deviceGroups.order;
    this.refreshCategoryFilters();
  }

  getDragDeviceIds(serial) {
    const selectedStableIds = Array.from(this.selectedDeviceIds).map(id => this.getDeviceStableId(id));
    const stableId = this.getDeviceStableId(serial);
    return this.selectedDeviceIds.has(serial) && selectedStableIds.length > 1 ? selectedStableIds : [stableId];
  }

  onStreamCardCtrlSelect(event, serial) {
    if (!this.selectedDeviceIds.has(serial)) {
      this.selectedDeviceIds.add(serial);
      // Actualizar clases en todo el DOM
      document.querySelectorAll(`[data-serial="${serial}"]`).forEach(el => el.classList.add('is-selected'));
      this.updateSelectedCount();
    }
  }

  onDeviceDragStart(event, serial) {
    const ids = this.getDragDeviceIds(serial);
    event.dataTransfer.setData('application/json', JSON.stringify(ids));
    event.dataTransfer.effectAllowed = 'move';
  }

  readDragIds(event) {
    try {
      const ids = JSON.parse(event.dataTransfer.getData('application/json') || '[]');
      return Array.isArray(ids) ? ids.filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  onDeviceDragOver(event) {
    event.preventDefault();
    if (event.ctrlKey) {
      const serial = event.currentTarget.dataset.serial;
      if (serial && !this.selectedDeviceIds.has(serial)) {
        this.selectedDeviceIds.add(serial);
        event.currentTarget.classList.add('is-selected');
        this.updateStatusPanel();
      }
    } else {
      event.currentTarget.classList.add('is-drag-over');
    }
  }

  onDeviceDragLeave(event) {
    if (!event.ctrlKey) {
      event.currentTarget.classList.remove('is-drag-over');
    }
  }

  async onDeviceDrop(event, targetSerial) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('is-drag-over');
    const movingIds = this.readDragIds(event);
    const targetId = this.getDeviceStableId(targetSerial);
    if (!movingIds.length || movingIds.includes(targetId)) return;
    this.reorderDevices(movingIds, targetId);
    await this.saveDeviceGroups();
    this.renderDevices();
    this.scheduleLivePreviewSync(true);
  }

  onCategoryDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('is-drag-over');
  }

  onCategoryDragLeave(event) {
    event.currentTarget.classList.remove('is-drag-over');
  }

  async onCategoryDrop(event, categoryId) {
    event.preventDefault();
    event.currentTarget.classList.remove('is-drag-over');
    const ids = this.readDragIds(event);
    if (!ids.length) return;
    ids.forEach(id => {
      if (categoryId) this.deviceGroups.assignments[id] = categoryId;
      else delete this.deviceGroups.assignments[id];
    });
    this.deviceGroups.order = [...(this.deviceGroups.order || []).filter(id => !ids.includes(id)), ...ids];
    await this.saveDeviceGroups();
    this.renderDevices();
    this.scheduleLivePreviewSync(true);
  }

  reorderDevices(movingIds, targetId) {
    const moving = new Set(movingIds);
    const allIds = [];
    const seen = new Set();
    (this.deviceGroups.order || []).forEach(id => {
      if (id && !seen.has(id)) { seen.add(id); allIds.push(id); }
    });
    this.devices.forEach(device => {
      const id = this.getDeviceStableId(device);
      if (id && !seen.has(id)) { seen.add(id); allIds.push(id); }
    });
    const remaining = allIds.filter(id => !moving.has(id));
    const index = remaining.indexOf(targetId);
    remaining.splice(index >= 0 ? index : remaining.length, 0, ...movingIds);
    this.deviceGroups.order = remaining;
  }

  getDeviceStableId(deviceOrSerial) {
    const serial = typeof deviceOrSerial === 'string' ? deviceOrSerial : deviceOrSerial.serial;
    const meta = this.deviceMeta[serial] || {};
    return meta.stableId || meta.deviceKey || `serial:${serial}`;
  }

  getVisibleOrderedDevices() {
    const ordered = this.applyManualOrder(this.devices);
    const active = this.deviceGroups.active || 'all';
    if (active === 'all') return ordered;
    if (active === '') {
      return ordered.filter(device => !this.deviceGroups.assignments[this.getDeviceStableId(device)]);
    }
    return ordered.filter(device => this.deviceGroups.assignments[this.getDeviceStableId(device)] === active);
  }

  applyManualOrder(devices) {
    const order = this.deviceGroups.order || [];
    if (!order.length) {
      return [...devices].sort((a, b) => {
        const serialA = a.serial || '';
        const serialB = b.serial || '';
        return serialA.localeCompare(serialB, undefined, { numeric: true });
      });
    }
    const indexById = new Map(order.map((id, index) => [id, index]));
    return [...devices].sort((a, b) => {
      const ai = indexById.has(this.getDeviceStableId(a)) ? indexById.get(this.getDeviceStableId(a)) : Number.MAX_SAFE_INTEGER;
      const bi = indexById.has(this.getDeviceStableId(b)) ? indexById.get(this.getDeviceStableId(b)) : Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }

  categoryColor(index) {
    return ['#45caff', '#22b86f', '#ffd166', '#a78bfa', '#ff7aa2', '#14b8a6'][index % 6];
  }

  buildDeviceSections(devices) {
    if (this.deviceGroups.active !== 'all') {
      const group = this.deviceGroups.groups.find(item => item.id === this.deviceGroups.active);
      return [{
        id: this.deviceGroups.active === 'all' ? 'all' : this.deviceGroups.active,
        name: group.name || (this.deviceGroups.active === '' ? 'Sin categoria' : 'Dispositivos'),
        color: group ? this.categoryColor(this.deviceGroups.groups.indexOf(group)) : '#607086',
        devices
      }];
    }

    const sections = [];
    const grouped = new Set();
    this.deviceGroups.groups.forEach((group, index) => {
      const groupDevices = devices.filter(device => this.deviceGroups.assignments[this.getDeviceStableId(device)] === group.id);
      groupDevices.forEach(device => grouped.add(this.getDeviceStableId(device)));
      sections.push({ id: group.id, name: group.name, color: this.categoryColor(index), devices: groupDevices });
    });
    const ungrouped = devices.filter(device => !grouped.has(this.getDeviceStableId(device)));
    sections.push({ id: '', name: 'Sin categoria', color: '#607086', devices: ungrouped });
    return sections.filter(section => section.devices.length || section.id !== '' || this.deviceGroups.groups.length);
  }

  toggleLivePreview() {
    this.livePreviewEnabled = !this.livePreviewEnabled;
    this.deviceViewMode = this.livePreviewEnabled ? 'live' : 'grid';
    localStorage.setItem('flowdashboard.livePreviewEnabled', this.livePreviewEnabled ? 'true' : 'false');
    localStorage.setItem('flowdashboard.electron.deviceViewMode', this.deviceViewMode);
    const toggle = document.querySelector('.live-preview-toggle');
    if (toggle) toggle.classList.toggle('is-active', this.livePreviewEnabled);
    this.renderDevices();
    if (this.livePreviewEnabled) {
      this.scheduleLivePreviewSync(true);
    } else {
      this.stopLivePreviewStreams();
    }
  }

  scheduleLivePreviewSync(force = false) {
    if (!this.livePreviewEnabled || !this.devices.length) return;
    // Con canvas WebP, los canvas se crean inmediatamente
    // No necesitamos timer ni sincronización de posiciones
    this.createCanvasesForVisibleDevices();
  }



  async stopLivePreviewStreams() {
    // Con canvas WebP, solo necesitamos desuscribir de los dispositivos
    if (this.streamRenderer) {
      for (const serial of this.streamRenderer.subscribedSerials) {
        this.streamRenderer.unsubscribeFromDevice(serial);
      }
    }
  }

  openAccountPopover(event, serial) {
    // Cerrar cualquier popover abierto
    this.closeAccountPopover();

    const stableId = this.getDeviceStableId(serial);
    const accountRecord = this.deviceAccounts[stableId] || this.deviceAccounts[serial] || {};
    const accounts = accountRecord.accounts || [];
    const deviceName = this.deviceNames[stableId] || this.deviceNames[serial] || serial;

    // Crear popover
    const popover = document.createElement('div');
    popover.id = 'accountPopover';
    popover.className = 'account-popover';
    popover.setAttribute('data-serial', serial);
    popover.setAttribute('data-flowtouch-ui', 'true');

    popover.innerHTML = `
      <div class="account-popover-header">
        <span class="account-popover-title">${this.escapeHtml(deviceName)}</span>
        <span class="account-popover-count">${accounts.length}/10</span>
        <button class="account-popover-close" onclick="app.closeAccountPopover()">x</button>
      </div>
      <textarea id="accountPopoverTextarea" class="account-popover-textarea" 
                placeholder="email:password&#10;una por línea (máx 10)"
                rows="6">${this.escapeHtml(accounts.join('\n'))}</textarea>
      <div class="account-popover-footer">
        <span id="accountPopoverCounter" class="account-popover-counter">${accounts.length}/10</span>
        <div class="account-popover-actions">
          <button class="account-popover-btn cancel" onclick="app.closeAccountPopover()">Cancelar</button>
          <button class="account-popover-btn save" onclick="app.saveAccountPopover('${serial}')">Guardar</button>
        </div>
      </div>`;

    document.body.appendChild(popover);
    ['pointerdown', 'mousedown'].forEach(type => {
      popover.addEventListener(type, e => e.stopPropagation(), true);
    });
    popover.addEventListener('click', e => e.stopPropagation());

    // Posicionar cerca del dispositivo
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    const popoverW = 240;
    const popoverH = 220;
    const margin = 8;

    let left = rect.right + margin;
    let top = rect.top;

    // Si se sale por la derecha, poner a la izquierda
    if (left + popoverW > window.innerWidth - margin) {
      left = rect.left - popoverW - margin;
    }
    // Si se sale por abajo, ajustar
    if (top + popoverH > window.innerHeight - margin) {
      top = window.innerHeight - popoverH - margin;
    }
    // Si se sale por arriba
    if (top < margin) top = margin;

    popover.style.left = `${Math.max(margin, left)}px`;
    popover.style.top = `${top}px`;

    // Contador en tiempo real
    const textarea = document.getElementById('accountPopoverTextarea');
    const counter = document.getElementById('accountPopoverCounter');
    textarea.addEventListener('input', () => {
      const lines = textarea.value.split('\n').filter(l => l.trim()).length;
      counter.textContent = `${lines}/10`;
      counter.style.color = lines > 10 ? '#d45862' : '#9fb0cc';
    });

    textarea.focus();

    // Cerrar al hacer clic fuera
    setTimeout(() => {
      document.addEventListener('click', this._popoverOutsideClick = (e) => {
        if (!popover.contains(e.target)) this.closeAccountPopover();
      });
    }, 100);
  }

  closeAccountPopover() {
    const popover = document.getElementById('accountPopover');
    if (popover) popover.remove();
    if (this._popoverOutsideClick) {
      document.removeEventListener('click', this._popoverOutsideClick);
      this._popoverOutsideClick = null;
    }
  }

  async saveAccountPopover(serial) {
    const textarea = document.getElementById('accountPopoverTextarea');
    if (!textarea) return;

    const lines = textarea.value.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 10) {
      alert('Máximo 10 cuentas por dispositivo');
      return;
    }

    try {
      const response = await fetch(`${PYTHON_API}/device-person`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, person: lines.join('\n') })
      });
      if (!response.ok) throw new Error('Error guardando');
      this.closeAccountPopover();
      await this.loadDeviceAccounts();
      this.updateStatusDots();
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  }

  openDeviceNamePopover(event, serial) {
    this.closeDeviceNamePopover();
    const device = this.devices.find(item => item.serial === serial);
    const stableId = this.getDeviceStableId(serial);
    const currentName = this.deviceNames[stableId] || this.deviceNames[serial] || device.model || serial;
    const popover = document.createElement('div');
    popover.id = 'deviceNamePopover';
    popover.className = 'device-name-popover';
    popover.setAttribute('data-serial', serial);
    popover.setAttribute('data-flowtouch-ui', 'true');
    popover.innerHTML = `
      <div class="device-name-popover-title">Nombre del dispositivo</div>
      <input id="deviceNamePopoverInput" class="device-name-popover-input" type="text" maxlength="48" value="${this.escapeHtml(currentName)}">
      <div class="device-name-popover-actions">
        <button class="device-name-popover-btn" onclick="app.closeDeviceNamePopover()">Cancelar</button>
        <button class="device-name-popover-btn is-save" onclick="app.saveDeviceNamePopover('${this.escapeHtml(serial)}')">Guardar</button>
      </div>
      <div class="device-name-popover-actions" style="margin-top: 8px;">
        <button class="device-name-popover-btn is-danger" onclick="app.forgetDevice('${this.escapeHtml(serial)}')" style="width: 100%; color: var(--danger-color); border-color: var(--danger-color);">Olvidar dispositivo</button>
      </div>`;
    document.body.appendChild(popover);
    ['pointerdown', 'mousedown'].forEach(type => {
      popover.addEventListener(type, e => e.stopPropagation(), true);
    });
    popover.addEventListener('click', e => e.stopPropagation());
    const rect = event.currentTarget.getBoundingClientRect();
    const margin = 8;
    const popRect = popover.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + margin;
    if (left + popRect.width > window.innerWidth - margin) left = window.innerWidth - popRect.width - margin;
    if (top + popRect.height > window.innerHeight - margin) top = rect.top - popRect.height - margin;
    popover.style.left = `${Math.max(margin, left)}px`;
    popover.style.top = `${Math.max(margin, top)}px`;
    const input = document.getElementById('deviceNamePopoverInput');
    const focusInput = (selectText = false) => {
      try { input.focus({ preventScroll: true }); } catch { input.focus(); }
      if (selectText) input.select();
    };

    focusInput(true);
    requestAnimationFrame(() => focusInput(true));
    setTimeout(() => focusInput(true), 60);
    ['keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'compositionstart', 'compositionupdate', 'compositionend'].forEach(type => {
      input.addEventListener(type, e => e.stopPropagation());
    });
    input.addEventListener('mousedown', e => e.stopPropagation());
    input.addEventListener('click', e => {
      e.stopPropagation();
      focusInput(false);
    });
    input.focus();
    input.select();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.saveDeviceNamePopover(serial);
      if (e.key === 'Escape') this.closeDeviceNamePopover();
    });
    requestAnimationFrame(() => {
      document.addEventListener('mousedown', this._deviceNameOutsideClick = (e) => {
        if (!popover.contains(e.target)) this.closeDeviceNamePopover();
      }, true);
    });
  }

  closeDeviceNamePopover() {
    const popover = document.getElementById('deviceNamePopover');
    if (popover) popover.remove();
    if (this._deviceNameOutsideClick) {
      document.removeEventListener('mousedown', this._deviceNameOutsideClick, true);
      this._deviceNameOutsideClick = null;
    }
  }

  openTransportPreferencePopover(event, stableId, currentPref) {
    this.closeDeviceNamePopover();
    const popover = document.createElement('div');
    popover.id = 'deviceNamePopover';
    popover.className = 'device-name-popover';
    popover.innerHTML = `
      <div class="device-name-popover-title">Preferencia de Transporte</div>
      <div class="device-name-popover-actions" style="flex-direction: column; gap: 4px; margin-top: 8px;">
        <button class="device-name-popover-btn ${currentPref === 'auto' ? 'is-save' : ''}" onclick="app.setTransportPreference('${stableId}', 'auto')">Auto</button>
        <button class="device-name-popover-btn ${currentPref === 'usb' ? 'is-save' : ''}" onclick="app.setTransportPreference('${stableId}', 'usb')">Solo USB</button>
        <button class="device-name-popover-btn ${currentPref === 'wifi' ? 'is-save' : ''}" onclick="app.setTransportPreference('${stableId}', 'wifi')">Solo WiFi</button>
      </div>
      <div class="device-name-popover-actions" style="margin-top: 8px;">
        <button class="device-name-popover-btn" onclick="app.closeDeviceNamePopover()">Cancelar</button>
      </div>`;
    document.body.appendChild(popover);
    
    const rect = event.currentTarget.getBoundingClientRect();
    const margin = 8;
    const popRect = popover.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + margin;
    if (left + popRect.width > window.innerWidth - margin) left = window.innerWidth - popRect.width - margin;
    if (top + popRect.height > window.innerHeight - margin) top = rect.top - popRect.height - margin;
    popover.style.left = `${Math.max(margin, left)}px`;
    popover.style.top = `${Math.max(margin, top)}px`;

    requestAnimationFrame(() => {
      document.addEventListener('mousedown', this._deviceNameOutsideClick = (e) => {
        if (!popover.contains(e.target)) this.closeDeviceNamePopover();
      }, true);
    });
  }

  async setTransportPreference(deviceId, pref) {
    this.closeDeviceNamePopover();
    try {
      const response = await fetch(`${PYTHON_API}/device/transport-preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, preferredTransport: pref })
      });
      if (response.ok) {
        this.loadDevices();
      }
    } catch(e) {
      console.error("Error setting transport preference", e);
    }
  }

  async forgetDevice(serial) {
    if (!confirm('¿Seguro que deseas olvidar este dispositivo? Se borraran sus cuentas y perfil local.')) return;
    this.closeDeviceNamePopover();
    try {
      const stableId = this.getDeviceStableId(serial);
      const response = await fetch(`${PYTHON_API}/device/forget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceKey: stableId })
      });
      if (!response.ok) throw new Error('Error al olvidar dispositivo');
      
      delete this.deviceNames[stableId];
      delete this.deviceNames[serial];
      delete this.deviceAccounts[stableId];
      delete this.deviceAccounts[serial];
      this.devices = this.devices.filter(d => d.serial !== serial);
      this.renderDevices();
    } catch (err) {
      console.error('Error forgetDevice:', err);
      alert('Error al olvidar dispositivo: ' + err.message);
    }
  }

  async saveDeviceNamePopover(serial) {
    const input = document.getElementById('deviceNamePopoverInput');
    const name = (input.value || '').trim();
    if (!name) return;
    try {
      const response = await fetch(`${PYTHON_API}/device-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, name })
      });
      if (!response.ok) throw new Error('Error guardando nombre');
      const stableId = this.getDeviceStableId(serial);
      this.deviceNames[serial] = name;
      this.deviceNames[stableId] = name;
      document.querySelectorAll(`[data-serial="${CSS.escape(serial)}"] .device-name`).forEach(el => {
        el.textContent = name;
        el.setAttribute('title', `Editar nombre: ${name}`);
      });
      this.closeDeviceNamePopover();
      this._flashActionsNote(`Nombre actualizado: ${name}`, 'success');
    } catch (e) {
      this._flashActionsNote(`No se pudo guardar nombre: ${e.message}`, 'error');
    }
  }

  openDeviceAccountEditor(serial) {
    const modal = document.getElementById('accountEditorModal');
    const textarea = document.getElementById('accountEditorTextarea');
    const deviceLabel = document.getElementById('accountEditorDevice');
    if (!modal || !textarea || !deviceLabel) return;

    this.accountEditorSerial = serial;
    const device = this.devices.find(item => item.serial === serial);
    const stableId = this.getDeviceStableId(serial);
    const deviceName = this.deviceNames[serial] || device.model || 'Dispositivo';
    textarea.value = ((this.deviceAccounts[stableId] || this.deviceAccounts[serial]) || {}).person || '';
    deviceLabel.textContent = `${deviceName} / ${this.shortSerial(serial)}`;
    
    // Add floating class if we are in Focus Mode
    if (document.querySelector('.flowtouch-focus-shell')) {
      modal.classList.add('is-focus-floating');
    } else {
      modal.classList.remove('is-focus-floating');
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    this.updateAccountEditorCounter();
    textarea.oninput = () => this.updateAccountEditorCounter();
    textarea.focus();
  }

  updateAccountEditorCounter() {
    const textarea = document.getElementById('accountEditorTextarea');
    const counter = document.getElementById('accountEditorCounter');
    if (!textarea || !counter) return;
    const lines = textarea.value.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length > 10) {
      textarea.value = lines.slice(0, 10).join('\n');
    }
    const count = Math.min(lines.length, 10);
    counter.textContent = `${count}/10 lineas`;
    counter.classList.toggle('is-full', count >= 10);
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  cleanMojibakeText(value) {
    let text = String(value ?? '');
    const pairs = [
      ['\u00c3\u00a1', '\u00e1'], ['\u00c3\u00a9', '\u00e9'], ['\u00c3\u00ad', '\u00ed'], ['\u00c3\u00b3', '\u00f3'], ['\u00c3\u00ba', '\u00fa'], ['\u00c3\u00b1', '\u00f1'],
      ['\u00c3\u0081', '\u00c1'], ['\u00c3\u0089', '\u00c9'], ['\u00c3\u008d', '\u00cd'], ['\u00c3\u0093', '\u00d3'], ['\u00c3\u009a', '\u00da'], ['\u00c3\u0091', '\u00d1'],
      ['\u00c2\u00bf', '\u00bf'], ['\u00c2\u00a1', '\u00a1'], ['\u00c2\u00b7', '\u00b7'],
      ['\u00e2\u20ac\u201d', '-'], ['\u00e2\u20ac\u201c', '-'], ['\u00e2\u20ac\u00a6', '...'], ['\u00e2\u2020\u2019', '->'],
      ['\u00e2\u0153\u201c', '\u2713'], ['\u00e2\u0153\u2014', 'x'], ['\u00e2\u2013\u00b6', '\u25b6'], ['\u00e2\u2013\u00b8', '\u25b8'], ['\u00e2\u2013\u00be', '\u25be'],
      ['\u00e2\u0161\u00a1', ''], ['\u00e2\u0161\u2013\u00ef\u00b8\u008f', ''], ['\u00e2\u0161\u2122\u00ef\u00b8\u008f', ''],
      ['\u00c2', '']
    ];
    for (const [bad, good] of pairs) text = text.split(bad).join(good);
    return text;
  }

  sanitizeVisibleText(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(node => {
      const next = this.cleanMojibakeText(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    });
    root.querySelectorAll?.('*').forEach(el => {
      ['title', 'placeholder', 'aria-label'].forEach(attr => {
        if (!el.hasAttribute(attr)) return;
        const current = el.getAttribute(attr);
        const next = this.cleanMojibakeText(current);
        if (next !== current) el.setAttribute(attr, next);
      });
    });
  }

  closeDeviceAccountEditor() {
    const modal = document.getElementById('accountEditorModal');
    if (modal) {
      modal.classList.remove('is-open');
      modal.classList.remove('is-focus-floating');
      modal.setAttribute('aria-hidden', 'true');
    }
    this.accountEditorSerial = null;
  }

  clearDeviceAccountEditor() {
    const textarea = document.getElementById('accountEditorTextarea');
    if (textarea) {
      textarea.value = '';
      this.updateAccountEditorCounter();
    }
  }

  async saveDeviceAccountEditor() {
    if (!this.accountEditorSerial) return;
    const textarea = document.getElementById('accountEditorTextarea');
    if (!textarea) return;
    const person = textarea.value
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 10)
      .join('\n');

    try {
      const response = await fetch(`${PYTHON_API}/device-person`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serial: this.accountEditorSerial,
          person
        })
      });
      if (!response.ok) throw new Error('No se pudieron guardar las cuentas');
      this.closeDeviceAccountEditor();
      await this.loadDevices();
    } catch (error) {
      console.error('Error guardando cuentas del dispositivo:', error);
      alert(`Error: ${error.message}`);
    }
  }

  getDeviceStatuses(serial) {
    // Get account statuses for this device (up to 10 clones)
    const stableId = this.getDeviceStableId(serial);
    const accounts = ((this.deviceAccounts[stableId] || this.deviceAccounts[serial]) || {}).accounts || [];
    const deviceStatus = this.loginStatuses[stableId] || this.loginStatuses[serial] || {};
    
    return accounts.map((account, index) => {
      const clone = index + 1;
      const cloneKey = `clone${clone}`;
      const cloneStatus = deviceStatus[cloneKey] || {};
      
      return {
        clone,
        account,
        serial,
        status: cloneStatus.status || 'pending',
        line: cloneStatus.line || account,
        message: cloneStatus.message || ''
      };
    });
  }

  renderAccountDots(statuses) {
    if (statuses.length === 0) return '';

    return statuses.map((item) => {
      const status = item.status || 'pending';
      const label = this.statusLabel(status);
      const account = item.account || '';
      const serial = item.serial || '';
      const titleText = `C${item.clone}: ${label}${item.message ? ' - ' + item.message : ''}`;

      if (status === 'waiting_mail') {
        return `<button type="button" class="account-dot is-waiting-mail"
                   data-clone="${item.clone}"
                   data-serial="${this.escapeHtml(serial)}"
                   data-account="${this.escapeHtml(account)}"
                   title="${this.escapeHtml(titleText)}"
                   aria-label="${this.escapeHtml(titleText)}"
                   onclick="event.stopPropagation(); app.toggleDotPopover(event, '${this.escapeHtml(serial)}', ${item.clone})">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>
        </button>`;
      }

      // Bolita con halo interno + dot central. Usa clase .is-<status> para
      // que el CSS aplique animacion especifica por estado.
      return `<button type="button" class="account-dot is-${status}"
                   data-clone="${item.clone}"
                   data-serial="${this.escapeHtml(serial)}"
                   data-account="${this.escapeHtml(account)}"
                   title="${this.escapeHtml(titleText)}"
                   aria-label="${this.escapeHtml(titleText)}"
                   onclick="event.stopPropagation(); app.toggleDotPopover(event, '${this.escapeHtml(serial)}', ${item.clone})">
        <span class="account-dot-halo" aria-hidden="true"></span>
        <span class="account-dot-core" aria-hidden="true"></span>
      </button>`;
    }).join('');
  }

  statusLabel(status) {
    const labels = {
      pending: 'Pendiente',
      running: 'Ejecutando',
      retrying: 'Reintentando',

      waiting_mail: 'Esperando mail',
      success: 'Success',
      already: 'Ya logueado',
      error: 'Error',
      review: 'Revisión',
      notice14: 'Aviso 14 días'
    };
    return labels[status] || 'Pendiente';
  }

  flagSvgForCountry(countryCode) {
    const code = String(countryCode || '').trim().toLowerCase();
    const svg = {
      us: '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#b22234"/><path d="M0 4h60M0 12h60M0 20h60M0 28h60M0 36h60" stroke="#fff" stroke-width="4"/><rect width="26" height="22" fill="#3c3b6e"/><g fill="#fff"><circle cx="5" cy="5" r="1"/><circle cx="11" cy="5" r="1"/><circle cx="17" cy="5" r="1"/><circle cx="23" cy="5" r="1"/><circle cx="8" cy="11" r="1"/><circle cx="14" cy="11" r="1"/><circle cx="20" cy="11" r="1"/><circle cx="5" cy="17" r="1"/><circle cx="11" cy="17" r="1"/><circle cx="17" cy="17" r="1"/><circle cx="23" cy="17" r="1"/></g></svg>',
      co: '<svg viewBox="0 0 60 40"><rect width="60" height="20" fill="#fcd116"/><rect y="20" width="60" height="10" fill="#003893"/><rect y="30" width="60" height="10" fill="#ce1126"/></svg>',
      es: '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#aa151b"/><rect y="10" width="60" height="20" fill="#f1bf00"/></svg>',
      mx: '<svg viewBox="0 0 60 40"><rect width="20" height="40" fill="#006847"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#ce1126"/><circle cx="30" cy="20" r="4" fill="#9c6b30"/></svg>',
      br: '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#009b3a"/><path d="M30 5 55 20 30 35 5 20Z" fill="#ffdf00"/><circle cx="30" cy="20" r="8" fill="#002776"/></svg>',
      ar: '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#74acdf"/><rect y="13.33" width="60" height="13.34" fill="#fff"/><circle cx="30" cy="20" r="4" fill="#f6b40e"/></svg>',
      cl: '<svg viewBox="0 0 60 40"><rect width="60" height="20" fill="#fff"/><rect y="20" width="60" height="20" fill="#d52b1e"/><rect width="22" height="20" fill="#0039a6"/><path d="M11 4 13 9h5l-4 3 2 5-5-3-5 3 2-5-4-3h5z" fill="#fff"/></svg>',
      pe: '<svg viewBox="0 0 60 40"><rect width="20" height="40" fill="#d91023"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#d91023"/></svg>',
      ve: '<svg viewBox="0 0 60 40"><rect width="60" height="13.33" fill="#f4d900"/><rect y="13.33" width="60" height="13.34" fill="#0033a0"/><rect y="26.67" width="60" height="13.33" fill="#ef3340"/></svg>',
      ec: '<svg viewBox="0 0 60 40"><rect width="60" height="20" fill="#ffdd00"/><rect y="20" width="60" height="10" fill="#034ea2"/><rect y="30" width="60" height="10" fill="#ed1c24"/></svg>',
      do: '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#fff"/><rect width="26" height="17" fill="#002d62"/><rect x="34" width="26" height="17" fill="#ce1126"/><rect y="23" width="26" height="17" fill="#ce1126"/><rect x="34" y="23" width="26" height="17" fill="#002d62"/></svg>',
      pa: '<svg viewBox="0 0 60 40"><rect width="30" height="20" fill="#fff"/><rect x="30" width="30" height="20" fill="#d21034"/><rect y="20" width="30" height="20" fill="#005293"/><rect x="30" y="20" width="30" height="20" fill="#fff"/></svg>',
      ca: '<svg viewBox="0 0 60 40"><rect width="15" height="40" fill="#d52b1e"/><rect x="15" width="30" height="40" fill="#fff"/><rect x="45" width="15" height="40" fill="#d52b1e"/><path d="M30 8 34 18h7l-6 5 3 9-8-5-8 5 3-9-6-5h7z" fill="#d52b1e"/></svg>',
      gb: '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#012169"/><path d="M0 0 60 40M60 0 0 40" stroke="#fff" stroke-width="8"/><path d="M0 0 60 40M60 0 0 40" stroke="#c8102e" stroke-width="4"/><path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="12"/><path d="M30 0v40M0 20h60" stroke="#c8102e" stroke-width="7"/></svg>',
      fr: '<svg viewBox="0 0 60 40"><rect width="20" height="40" fill="#0055a4"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#ef4135"/></svg>',
      de: '<svg viewBox="0 0 60 40"><rect width="60" height="13.33" fill="#000"/><rect y="13.33" width="60" height="13.34" fill="#dd0000"/><rect y="26.67" width="60" height="13.33" fill="#ffce00"/></svg>',
      it: '<svg viewBox="0 0 60 40"><rect width="20" height="40" fill="#009246"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#ce2b37"/></svg>',
      nl: '<svg viewBox="0 0 60 40"><rect width="60" height="13.33" fill="#ae1c28"/><rect y="13.33" width="60" height="13.34" fill="#fff"/><rect y="26.67" width="60" height="13.33" fill="#21468b"/></svg>',
      pt: '<svg viewBox="0 0 60 40"><rect width="24" height="40" fill="#006600"/><rect x="24" width="36" height="40" fill="#ff0000"/><circle cx="24" cy="20" r="6" fill="#ffcc00"/></svg>',
      jp: '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#fff"/><circle cx="30" cy="20" r="10" fill="#bc002d"/></svg>',
      cn: '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#de2910"/><path d="M10 6 12 12h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" fill="#ffde00"/></svg>',
      in: '<svg viewBox="0 0 60 40"><rect width="60" height="13.33" fill="#ff9933"/><rect y="13.33" width="60" height="13.34" fill="#fff"/><rect y="26.67" width="60" height="13.33" fill="#138808"/><circle cx="30" cy="20" r="5" fill="none" stroke="#000080" stroke-width="1.4"/></svg>',
      au: '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#00008b"/><path d="M8 8h16v12H8z" fill="#012169"/><path d="M8 8l16 12M24 8 8 20" stroke="#fff" stroke-width="3"/><path d="M16 8v12M8 14h16" stroke="#fff" stroke-width="5"/><circle cx="44" cy="24" r="3" fill="#fff"/></svg>',
    };
    return svg[code] || '';
  }

  renderCountryFlag(countryCode, countryName = '') {
    const code = String(countryCode || '').trim().toLowerCase();
    if (!/^[a-z]{2}$/.test(code)) {
      return '<span class="device-flag is-empty">--</span>';
    }
    const safeName = this.escapeHtml(countryName || code.toUpperCase());
    const inlineFlag = this.flagSvgForCountry(code);
    if (inlineFlag) {
      return `<span class="device-flag-img device-flag-svg" role="img" aria-label="${safeName}" title="${safeName}">${inlineFlag}</span>`;
    }
    return `<span class="device-flag" title="${safeName}">${code.toUpperCase()}</span>`;
  }

  appIconMarkup(packageName) {
    const pkg = String(packageName || '');
    if (pkg.startsWith('com.spotify.')) {
      return `<span class="actions-app-icon is-spotify" aria-hidden="true">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M7.8 10.2c3.4-1 6.4-.7 8.8.7"/><path d="M8.4 13c2.7-.8 5.2-.5 7.1.6"/><path d="M9 15.6c2-.5 3.8-.3 5.4.5"/></svg>
      </span>`;
    }
    return `<span class="actions-app-icon is-default" aria-hidden="true">
      <svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>
    </span>`;
  }

  // Toggle del popover de acciones de la bolita.
  // Click en la bolita abre el popover; click fuera lo cierra.
  // Solo iconos, sin texto. Tooltip nativo en cada boton.
  toggleDotPopover(event, serial, clone) {
    const dot = event.currentTarget;
    const existing = document.getElementById('dotTooltipFixed');
    // Si ya existe y apunta al mismo dot, cerrar.
    if (existing && existing.dataset.serial === serial && Number(existing.dataset.clone) === clone) {
      existing.remove();
      return;
    }
    if (existing) existing.remove();

    const status = [...dot.classList].find(c => c.startsWith('is-')).replace('is-', '') || 'pending';
    const label = this.statusLabel(status);

    const popover = document.createElement('div');
    popover.id = 'dotTooltipFixed';
    popover.className = 'dot-popover';
    popover.dataset.serial = serial;
    popover.dataset.clone = String(clone);
    popover.innerHTML = `
      <div class="dot-popover-arrow" aria-hidden="true"></div>
      <div class="dot-popover-actions">
        <button class="dot-icon-btn is-retry"
                onclick="event.stopPropagation(); app.retryAccount('${this.escapeHtml(serial)}', ${clone}); app.closeDotPopover();"
                aria-label="Reintentar" title="Reintentar">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 0 1 15-6.7"/><path d="M18 3v6h-6"/>
            <path d="M21 12a9 9 0 0 1-15 6.7"/><path d="M6 21v-6h6"/>
          </svg>
        </button>
        <button class="dot-icon-btn is-replace"
                onclick="event.stopPropagation(); app.replaceAccount('${this.escapeHtml(serial)}', ${clone}); app.closeDotPopover();"
                aria-label="Reemplazar" title="Reemplazar">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 7h11"/><path d="m15 4 3 3-3 3"/>
            <path d="M17 17H6"/><path d="m9 14-3 3 3 3"/>
          </svg>
        </button>
      </div>
    `;
    document.body.appendChild(popover);

    // Posicionar pegado al dot, anclado a su lado derecho por defecto
    const rect = dot.getBoundingClientRect();
    const margin = 8;
    const ttRect = popover.getBoundingClientRect();
    
    // Default: a la derecha del dot
    let left = rect.right + margin;
    let top  = rect.top + (rect.height - ttRect.height) / 2;
    let placement = 'right';

    if (left + ttRect.width > window.innerWidth - margin) {
      // No cabe a la derecha → ponerlo a la izquierda
      left = rect.left - ttRect.width - margin;
      placement = 'left';
    }
    if (top < margin) top = margin;
    if (top + ttRect.height > window.innerHeight - margin) {
      top = window.innerHeight - ttRect.height - margin;
    }

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popover.dataset.placement = placement;

    // Cerrar al click fuera o al scroll.
    requestAnimationFrame(() => {
      const onOutside = (e) => {
        if (!popover.contains(e.target) && e.target !== dot) {
          this.closeDotPopover();
          document.removeEventListener('mousedown', onOutside, true);
          window.removeEventListener('scroll', onScroll, true);
        }
      };
      const onScroll = () => {
        this.closeDotPopover();
        document.removeEventListener('mousedown', onOutside, true);
        window.removeEventListener('scroll', onScroll, true);
      };
      document.addEventListener('mousedown', onOutside, true);
      window.addEventListener('scroll', onScroll, true);
    });
  }

  closeDotPopover() {
    const tt = document.getElementById('dotTooltipFixed');
    if (tt) tt.remove();
  }

  // Compat: viejos handlers podian seguir usando estos nombres. Redirigimos.
  showDotTooltip(event, serial, clone) { this.toggleDotPopover(event, serial, clone); }
  hideDotTooltip() { /* no-op: popover ahora se cierra con click fuera */ }

  shortSerial(serial) {
    if (!serial) return '';
    if (serial.includes(':')) {
      // IP:PORT format
      return serial.split(':')[0].split('.').slice(-2).join('.');
    }
    // Regular serial - show last 8 chars
    return serial.length > 8 ? '...' + serial.slice(-8) : serial;
  }

  toggleDevice(serial) {
    if (this.selectedDeviceIds.has(serial)) {
      this.selectedDeviceIds.delete(serial);
    } else {
      this.selectedDeviceIds.add(serial);
    }
    // Actualizar solo la clase CSS sin destruir el DOM.
    // Importante: hay que tocar TANTO la tarjeta del grid como el chip de la
    // categoria, porque ambos usan data-serial. Si solo se actualiza el primer
    // match (querySelector), el otro queda desincronizado y el usuario "ve"
    // que el contenedor no se selecciona aunque internamente si cambia.
    const isSelected = this.selectedDeviceIds.has(serial);
    document.querySelectorAll(`[data-serial="${CSS.escape(serial)}"]`).forEach(el => {
      if (el.classList.contains('live-device-card') || el.classList.contains('cat-chip')) {
        el.classList.toggle('is-selected', isSelected);
      }
    });
    this.updateSelectedCount();
    console.log('📱 Dispositivos seleccionados:', Array.from(this.selectedDeviceIds));
  }

  selectAll() {
    this.devices.forEach(device => {
      const isStreaming = this.streams && this.streams.some(s => s.serial === device.serial);
      if (!device.offline && !device.disconnected || isStreaming) {
        this.selectedDeviceIds.add(device.serial);
      }
    });
    // Actualizar clases sin rerenderizar
    document.querySelectorAll('[data-serial]').forEach(card => {
      const serial = card.dataset.serial;
      if (this.selectedDeviceIds.has(serial)) {
        card.classList.add('is-selected');
      }
    });
    this.updateSelectedCount();
  }

  deselectAll() {
    this.selectedDeviceIds.clear();
    // Actualizar clases sin rerenderizar
    document.querySelectorAll('[data-serial]').forEach(card => {
      card.classList.remove('is-selected');
    });
    this.updateSelectedCount();
  }

  updateSelectedCount() {
    const count = this.selectedDeviceIds.size;
    const countEl = document.getElementById('selectedCount');
    if (countEl) {
      countEl.textContent = `${count} seleccionado${count !== 1 ? 's' : ''}`;
    }
    this.refreshActionsTargetBadge();
  }

  async refreshDevices() {
    console.log('🔄 Actualizando dispositivos...');
    await this.loadDevices();
    
    // Refrescar las imagenes de los dispositivos activos en el grid
    if (this.streams && this.streams.length > 0) {
      console.log('🔄 Refrescando imágenes de streams activos...');
      const activeSerials = [...this.streams.map(s => s.serial)];
      
      // Detener temporalmente los streams para forzar la reconexión
      activeSerials.forEach(serial => this.stopStream(serial));
      
      // Reiniciarlos después de un breve delay
      setTimeout(() => {
        activeSerials.forEach(serial => {
          // Obtener el estado real si es "native" o no (para scrcpy)
          const isNative = document.getElementById(`nativeToggle-${this._safeId(serial)}`)?.checked ?? true;
          this.startStreaming(serial, isNative);
        });
      }, 500);
    }
  }

  toggleNetworkScanner() {
    const panel = document.getElementById('scannerPanel');
    const arrow = document.getElementById('scannerArrow');
    
    if (panel.style.display === 'none') {
      panel.style.display = 'block';
      if (arrow) arrow.style.transform = 'rotate(0deg)';
    } else {
      panel.style.display = 'none';
      if (arrow) arrow.style.transform = 'rotate(-90deg)';
    }
  }

  async autoDetectNetworkRange() {
    try {
      const res = await fetch(`${PYTHON_API}/devices/subnets`);
      const data = await res.json();
      if (data.subnets && data.subnets.length > 0) {
        document.getElementById('networkRanges').value = data.subnets.join('\n');
      } else {
        document.getElementById('networkRanges').value = "192.168.1.1-254";
      }
    } catch (err) {
      console.warn("Failed to auto-detect", err);
      document.getElementById('networkRanges').value = "192.168.1.1-254";
    }
  }

  async reconnectKnownDevices() {
    try {
      await fetch(`${PYTHON_API}/devices/reconnect-known`, { method: 'POST' });
      console.log("Reconnecting known devices...");
      setTimeout(() => this.refreshDevices(), 2000);
    } catch (err) {
      console.error(err);
    }
  }

  async startNetworkScan() {
    const button = document.getElementById('scanButton');
    const rangesText = document.getElementById('networkRanges').value.trim();
    const ranges = rangesText ? rangesText.split('\n').map(r => r.trim()).filter(r => r) : ["auto"];
    const port = parseInt(document.getElementById('adbPort').value, 10) || 5555;
    
    try {
      const res = await fetch(`${PYTHON_API}/devices/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ranges, port, timeoutMs: 250, concurrency: 48, connectAdb: true })
      });
      const data = await res.json();
      if (data.ok) {
        this.scanning = true;
        button.classList.add('is-scanning');
        button.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
            <rect x="6" y="6" width="12" height="12" rx="2" ry="2"/>
          </svg>
          <span>Detener Escaneo</span>
        `;
        button.onclick = () => this.stopNetworkScan();
        document.getElementById('scannerProgress').style.display = 'block';
        this.pollNetworkScanStatus();
      }
    } catch (error) {
      console.error("Error starting scan:", error);
    }
  }

  async stopNetworkScan() {
    try {
      await fetch(`${PYTHON_API}/devices/scan/cancel`, { method: 'POST' });
    } catch (err) {}
  }

  async pollNetworkScanStatus() {
    if (!this.scanning) return;
    try {
      const res = await fetch(`${PYTHON_API}/devices/scan/status`);
      const state = await res.json();
      
      if (!state.active && state.status !== "scanning") {
        this.scanning = false;
        document.getElementById('progressText').textContent = 'Escaneo completado';
        const button = document.getElementById('scanButton');
        button.classList.remove('is-scanning');
        button.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          <span>Iniciar Escaneo</span>
        `;
        button.onclick = () => this.startNetworkScan();
        this.refreshDevices();
      } else {
        const pct = state.total ? (state.progress / state.total * 100) : 0;
        document.getElementById('progressBar').style.width = `${pct}%`;
        document.getElementById('progressCount').textContent = `${state.progress}/${state.total}`;
        document.getElementById('devicesFound').textContent = `${state.found.length} dispositivos encontrados`;
        document.getElementById('progressText').textContent = `Escaneando... ${state.current_ip}`;
        
        setTimeout(() => this.pollNetworkScanStatus(), 500);
      }
    } catch (err) {
      console.error("Error polling scan status:", err);
      setTimeout(() => this.pollNetworkScanStatus(), 1000);
    }
  }

  

  buildScanTargets(ranges, port) {
    const targets = [];
    ranges.forEach(range => {
      for (let i = range.ipStart; i <= range.ipEnd; i++) {
        targets.push(`${range.ipBase}.${i}:${port}`);
      }
    });
    return targets;
  }

  addNetworkRange() {
    const container = document.getElementById('networkRanges');
    const rangeCount = container.querySelectorAll('.network-range-row').length + 1;
    
    const newRange = document.createElement('div');
    newRange.className = 'network-range-row';
    newRange.setAttribute('data-range', rangeCount);
    newRange.innerHTML = `
      <input type="text" class="ip-base-input" value="192.168.${rangeCount}" placeholder="192.168.${rangeCount}" maxlength="15">
      <span class="ip-dot">.</span>
      <input type="number" class="ip-start-input" value="1" min="1" max="254" placeholder="1">
      <span class="ip-dash">-</span>
      <input type="number" class="ip-end-input" value="255" min="1" max="255" placeholder="255">
      <button class="btn-remove-range" onclick="app.removeNetworkRange(this)" title="Eliminar rango">
        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" fill="none" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    
    container.appendChild(newRange);
  }

  removeNetworkRange(button) {
    const row = button.closest('.network-range-row');
    const container = document.getElementById('networkRanges');
    
    // No permitir eliminar si solo hay un rango
    if (container.querySelectorAll('.network-range-row').length > 1) {
      row.remove();
    } else {
      alert('Debe haber al menos un rango de red.');
    }
  }

  // ============================================================
  // ACCIONES - handlers
  // ============================================================

  toggleActionsSection() {
    const panel = document.getElementById('actionsPanel');
    const arrow = document.getElementById('actionsArrow');
    if (!panel) return;
    const open = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : 'block';
    if (arrow) arrow.style.transform = open ? '' : 'rotate(180deg)';
    if (!open) this.refreshActionsTargetBadge();
  }

  toggleActionsPinned(checked) {
    this.actionsPinned = Boolean(checked);
    localStorage.setItem('flowdashboard.actionsPinned', this.actionsPinned ? 'true' : 'false');
    document.getElementById('mainPinnedStack').classList.toggle('is-visible', this.actionsPinned || this.flowCategoryPinned);
    const bar = document.getElementById('mainActionsPinned');
    if (bar) {
      bar.classList.toggle('is-visible', this.actionsPinned);
      if (!bar.innerHTML.trim()) bar.innerHTML = this.renderPinnedActionsBar();
    }
  }

  toggleFlowCategoryPinned(checked) {
    this.flowCategoryPinned = Boolean(checked);
    localStorage.setItem('flowdashboard.flowCategoryPinned', this.flowCategoryPinned ? 'true' : 'false');
    document.getElementById('mainPinnedStack').classList.toggle('is-visible', this.actionsPinned || this.flowCategoryPinned);
    const bar = document.getElementById('mainFlowCategoryPinned');
    if (bar) {
      bar.classList.toggle('is-visible', this.flowCategoryPinned);
      bar.innerHTML = this.renderPinnedFlowCategoryBar();
    }
  }

  // Devuelve la lista de seriales objetivo. Acciones del sidebar exigen
  // seleccion explicita: sin seleccion se muestran, pero no ejecutan.
  getActionsTargets({ requireSelection = true, fallbackAll = false } = {}) {
    const selected = Array.from(this.selectedDeviceIds || []);
    if (selected.length) return selected;
    if (requireSelection) return [];
    if (fallbackAll) {
      return (this.devices || []).map(d => d.serial).filter(Boolean);
    }
    return [];
  }

  refreshActionsTargetBadge() {
    const badge = document.getElementById('actionsTargetBadge');
    if (!badge) return;
    const selected = (this.selectedDeviceIds || new Set()).size;
    const total = 0;
    badge.textContent = selected ? String(selected) : '0';
    badge.classList.toggle('is-selection', selected > 0);
    badge.classList.toggle('is-all', false);
    badge.title = selected
      ? `${selected} dispositivo${selected === 1 ? '' : 's'} seleccionado${selected === 1 ? '' : 's'}`
      : 'Selecciona dispositivos para ejecutar acciones';
    const note = document.getElementById('actionsScopeNote');
    if (note) {
      note.textContent = selected
        ? `Aplicar a ${selected} dispositivo${selected === 1 ? '' : 's'} seleccionado${selected === 1 ? '' : 's'}.`
        : 'Selecciona uno o varios dispositivos para activar estas acciones.';
      note.classList.toggle('is-locked', selected === 0);
    }
  }

  // Pequeno toast no bloqueante (reusa #actionsScopeNote para feedback breve).
  _flashActionsNote(text, tone = 'info', durationMs = 2200) {
    const note = document.getElementById('actionsScopeNote');
    if (!note) return;
    const prev = note.textContent;
    note.textContent = text;
    note.classList.add(`is-${tone}`);
    clearTimeout(this._actionsNoteTimer);
    this._actionsNoteTimer = setTimeout(() => {
      note.classList.remove(`is-${tone}`);
      this.refreshActionsTargetBadge();
    }, durationMs);
  }

  // Resuelve agentId del FlowAgent para un serial dado.
  // Devuelve null si no esta conectado/sin accessibility.
  async _resolveAgentForSerial(serial) {
    try {
      const r = await fetch(`${PYTHON_API}/agents`);
      const data = await r.json();
      const agents = Array.isArray(data.agents) ? data.agents : [];
      const agent = agents.find(a => a.serial === serial || a.agentId === serial);
      if (!agent) return { ok: false, reason: 'no conectado' };
      if (!agent.accessibility) return { ok: false, reason: 'sin accesibilidad' };
      return { ok: true, agentId: agent.agentId };
    } catch (e) {
      return { ok: false, reason: e.message || 'error consultando agentes' };
    }
  }

  // Ejecuta back/home/recents en TODOS los seleccionados (o todos los devices).
  async runActionOnSelected(name) {
    const targets = this.getActionsTargets();
    if (!targets.length) {
      this._flashActionsNote('Selecciona al menos 1 dispositivo.', 'warn');
      return;
    }
    const label = name === 'back' ? 'Back' : name === 'home' ? 'Home' : 'Recents';
    this._flashActionsNote(`${label} → ${targets.length} dispositivo${targets.length === 1 ? '' : 's'}...`, 'info', 1500);
    let ok = 0; let fail = 0;
    await Promise.all(targets.map(async serial => {
      const resolved = await this._resolveAgentForSerial(serial);
      if (!resolved.ok) { fail++; return; }
      try {
        const r = await fetch(`${PYTHON_API}/agent/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: resolved.agentId, command: { name }, timeout: 6 })
        });
        if (r.ok) {

          ok++;

          this.markDeviceRuntimeState(serial, action === 'reboot' ? 'rebooting' : 'offline');

        } else fail++;
      } catch { fail++; }
    }));
    const tone = fail === 0 ? 'success' : (ok === 0 ? 'error' : 'warn');
    this._flashActionsNote(`${label}: ${ok} OK${fail ? `, ${fail} fallaron` : ''}`, tone);
  }

  // ── Apps comunes en los seleccionados ────────────────────────────────
  async openCommonAppsModal() {
    const targets = this.getActionsTargets();
    if (!targets.length) {
      this._flashActionsNote('Selecciona al menos 1 dispositivo.', 'warn');
      return;
    }
    this._showActionsModal({
      title: 'Aplicaciones',
      subtitle: targets.length === 1
        ? `Apps de terceros instaladas en ${this.shortSerial(targets[0])}`
        : `Apps de terceros comunes a ${targets.length} dispositivos`,
      bodyHtml: '<div class="actions-modal-loading">Consultando dispositivos...</div>',
    });

    // Obtener apps de cada device, calcular interseccion.
    let common = null;
    for (const serial of targets) {
      try {
        const r = await fetch(`${PYTHON_API}/apps/list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serial, thirdPartyOnly: true })
        });
        const data = await r.json();
        const items = Array.isArray(data.items) ? data.items : [];
        const set = new Set(items.map(it => it.packageName));
        this._actionsAppLabels = this._actionsAppLabels || {};
        items.forEach(it => {
          if (it.packageName) this._actionsAppLabels[it.packageName] = it.label || it.name || it.packageName;
        });
        common = common ? new Set([...common].filter(p => set.has(p))) : set;
      } catch { /* device sin respuesta: ignorar */ }
    }
    const list = common ? [...common].sort() : [];
    const body = list.length
      ? `<div class="actions-modal-applist">
           ${list.map(pkg => `
             <div class="actions-app-row">
               ${this.appIconMarkup(pkg)}
               <span class="actions-app-name" title="${this.escapeHtml(pkg)}">
                 <b>${this.escapeHtml(this._actionsAppLabels?.[pkg] || pkg)}</b>
                 <small>${this.escapeHtml(pkg)}</small>
               </span>
               <span class="actions-app-buttons">
                 <button class="actions-app-btn" onclick="app.runAppsActionOnAll('launch','${this.escapeHtml(pkg)}')" title="Abrir"><svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5Z"/></svg></button>
                 <button class="actions-app-btn" onclick="app.runAppsActionOnAll('force-stop','${this.escapeHtml(pkg)}')" title="Detener"><svg viewBox="0 0 24 24"><path d="M7 7h10v10H7z"/></svg></button>
                 <button class="actions-app-btn is-warn" onclick="app.runAppsActionOnAll('clear','${this.escapeHtml(pkg)}')" title="Borrar datos"><svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M8 7V5h8v2"/><path d="M7 7l1 12h8l1-12"/></svg></button>
                 <button class="actions-app-btn is-danger" onclick="app.runAppsActionOnAll('uninstall','${this.escapeHtml(pkg)}')" title="Desinstalar"><svg viewBox="0 0 24 24"><path d="m18 6-12 12"/><path d="m6 6 12 12"/></svg></button>
               </span>
             </div>`).join('')}
         </div>`
      : '<div class="actions-modal-empty">No hay apps de terceros comunes a los dispositivos seleccionados.</div>';
    this._setActionsModalBody(body);
  }

  async runAppsActionOnAll(action, pkg) {
    const targets = this.getActionsTargets();
    if (!targets.length) {
      this._flashActionsNote('Selecciona al menos 1 dispositivo.', 'warn');
      return;
    }
    if (action === 'uninstall' || action === 'clear') {
      const verb = action === 'uninstall' ? 'desinstalar' : 'borrar datos de';
      if (!confirm(`Seguro que quieres ${verb} "${pkg}" en ${targets.length} dispositivo${targets.length === 1 ? '' : 's'}?`)) return;
    }
    let ok = 0; let fail = 0;
    const endpointMap = {
      'launch': '/apps/launch',
      'force-stop': '/apps/force-stop',
      'clear': '/apps/clear-cache',
      'uninstall': '/apps/uninstall',
    };
    const endpoint = endpointMap[action];
    if (!endpoint) return;
    await Promise.all(targets.map(async serial => {
      try {
        const r = await fetch(`${PYTHON_API}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serial, packageName: pkg })
        });
        if (r.ok) ok++; else fail++;
      } catch { fail++; }
    }));
    this._flashActionsNote(`${action} ${pkg}: ${ok} OK${fail ? `, ${fail} fallaron` : ''}`, fail ? 'warn' : 'success');
    if (action === 'uninstall' && ok > 0) this.openCommonAppsModal();
  }

  // ── Archivos: subir un archivo a /sdcard/Download/ en los seleccionados ─
  openActionsArchivosModal() {
    const targets = this.getActionsTargets();
    if (!targets.length) { this._flashActionsNote('Selecciona al menos 1 dispositivo.', 'warn'); return; }
    this._showActionsModal({
      title: 'Subir archivo',
      subtitle: `Push a /sdcard/Download/ en ${targets.length} dispositivo${targets.length === 1 ? '' : 's'}`,
      bodyHtml: `
        <div class="actions-modal-stack">
          <label class="actions-modal-label">Ruta destino</label>
          <input class="actions-modal-input" id="actionsFilePath" type="text" value="/sdcard/Download/" placeholder="/sdcard/Download/">
          <label class="actions-modal-btn-file">
            <span>Seleccionar archivo y enviar</span>
            <input id="actionsFileInput" type="file" hidden>
          </label>
          <div class="actions-modal-result" id="actionsFileResult">Hasta 500 MB por archivo.</div>
        </div>`
    });
    setTimeout(() => {
      const inp = document.getElementById('actionsFileInput');
      const path = document.getElementById('actionsFilePath');
      const out = document.getElementById('actionsFileResult');
      inp.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (out) out.textContent = `Subiendo ${file.name} (${file.size} bytes) a ${targets.length} dispositivo${targets.length === 1 ? '' : 's'}...`;
        let ok = 0, fail = 0;
        await Promise.all(targets.map(async serial => {
          try {
            const fd = new FormData();
            fd.append('serial', serial);
            fd.append('path', path.value || '/sdcard/Download/');
            fd.append('file', file);
            const r = await fetch(`${PYTHON_API}/file-push`, { method: 'POST', body: fd });
            if (r.ok) ok++; else fail++;
          } catch { fail++; }
        }));
        if (out) out.textContent = `${ok} OK${fail ? `, ${fail} fallaron` : ''}`;
        this._flashActionsNote(`Archivo: ${ok} OK${fail ? `, ${fail} fallaron` : ''}`, fail ? 'warn' : 'success');
      });
    }, 50);
  }

  // ── ADB shell: ejecuta el mismo comando en TODOS los seleccionados ───
  openActionsAdbModal() {
    const targets = this.getActionsTargets();
    if (!targets.length) { this._flashActionsNote('Selecciona al menos 1 dispositivo.', 'warn'); return; }
    this._showActionsModal({
      title: 'ADB Shell',
      subtitle: `Ejecutar en ${targets.length} dispositivo${targets.length === 1 ? '' : 's'}`,
      bodyHtml: `
        <div class="actions-modal-stack">
          <label class="actions-modal-label">Comando (sin "adb shell")</label>
          ${this.renderAdbPresetStrip('data-actions-adb-preset')}
          <input class="actions-modal-input" id="actionsAdbCmd" type="text" placeholder="dumpsys window | grep -E 'mCurrentFocus'">
          <button class="actions-modal-btn" id="actionsAdbRun">Ejecutar</button>
          <pre class="actions-modal-pre" id="actionsAdbOut">$ esperando comando</pre>
        </div>`
    });
    setTimeout(() => {
      const cmd = document.getElementById('actionsAdbCmd');
      const btn = document.getElementById('actionsAdbRun');
      const out = document.getElementById('actionsAdbOut');
      const modal = document.getElementById('actionsModal');
      this.bindAdbPresetStrip(modal, cmd, 'data-actions-adb-preset');
      const run = async () => {
        const command = (cmd.value || '').trim();
        if (!command) return;
        if (out) out.textContent = `$ ${command}\n(ejecutando en ${targets.length} dispositivo${targets.length === 1 ? '' : 's'}...)`;
        try {
          const r = await fetch(`${PYTHON_API}/adb`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, deviceIds: targets.join(',') })
          });
          const data = await r.json();
          if (out) out.textContent = `$ ${command}\n${data.result || JSON.stringify(data)}`;
        } catch (e) {
          if (out) out.textContent = `$ ${command}\nERR: ${e.message}`;
        }
      };
      btn.addEventListener('click', run);
      cmd.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
      cmd.focus();
    }, 50);
  }

  // ── Auto.js: subir un .js y ejecutar en los seleccionados ─────────────
  openActionsAutoJsModal() {
    const targets = this.getActionsTargets();
    if (!targets.length) { this._flashActionsNote('Selecciona al menos 1 dispositivo.', 'warn'); return; }
    this._showActionsModal({
      title: 'Auto.js',
      subtitle: `Subir y ejecutar en ${targets.length} dispositivo${targets.length === 1 ? '' : 's'}`,
      bodyHtml: `
        <div class="actions-modal-stack">
          <label class="actions-modal-btn-file">
            <span>Elegir .js y ejecutar</span>
            <input id="actionsJsInput" type="file" accept=".js" hidden>
          </label>
          <button class="actions-modal-btn is-warn" id="actionsJsStop">Detener Auto.js</button>
          <div class="actions-modal-result" id="actionsJsResult">Selecciona un .js para subir y ejecutar.</div>
        </div>`
    });
    setTimeout(() => {
      const inp = document.getElementById('actionsJsInput');
      const stopBtn = document.getElementById('actionsJsStop');
      const out = document.getElementById('actionsJsResult');
      inp.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (out) out.textContent = `Subiendo ${file.name}...`;
        let pushOk = 0, pushFail = 0;
        let remotePath = '';
        await Promise.all(targets.map(async serial => {
          try {
            const fd = new FormData();
            fd.append('serial', serial);
            fd.append('script', file);
            const r = await fetch(`${PYTHON_API}/autojs/push`, { method: 'POST', body: fd });
            const data = await r.json();
            if (r.ok && data.remotePath) { pushOk++; remotePath = data.remotePath; }
            else pushFail++;
          } catch { pushFail++; }
        }));
        if (!remotePath) {
          if (out) out.textContent = `Push fallo en todos los dispositivos.`;
          return;
        }
        if (out) out.textContent = `Push: ${pushOk} OK. Ejecutando ${remotePath}...`;
        try {
          const r = await fetch(`${PYTHON_API}/autojs/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceIds: targets.join(','), filePath: remotePath })
          });
          const data = await r.json();
          if (out) out.textContent = `Ejecutado en ${pushOk} dispositivo${pushOk === 1 ? '' : 's'}.\n${data.result || ''}`;
          this._flashActionsNote(`Auto.js: ${pushOk} OK`, pushFail ? 'warn' : 'success');
        } catch (e) {
          if (out) out.textContent = `Error ejecutando: ${e.message}`;
        }
      });
      stopBtn.addEventListener('click', async () => {
        try {
          await fetch(`${PYTHON_API}/autojs/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceIds: targets.join(','), filePath: '/sdcard/Download/' })
          });
          if (out) out.textContent = 'Auto.js detenido en los seleccionados.';
        } catch (e) {
          if (out) out.textContent = `Error detener: ${e.message}`;
        }
      });
    }, 50);
  }


  // ── Helpers de modales y context menu ────────────────────────────────
  async runSystemShortcut(shortcut) {
    const targets = this.getActionsTargets();
    if (!targets.length) { this._flashActionsNote('Selecciona al menos 1 dispositivo.', 'warn'); return; }
    let ok = 0, fail = 0;
    await Promise.all(targets.map(async serial => {
      try {
        const r = await fetch(`${PYTHON_API}/system/open-settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serial, shortcut })
        });
        if (r.ok) ok++; else fail++;
      } catch { fail++; }
    }));
    this._flashActionsNote(`Sistema ${shortcut}: ${ok} OK${fail ? `, ${fail} fallaron` : ''}`, fail ? 'warn' : 'success');
  }

  async selectKeyboardOnSelected() {
    const targets = this.getActionsTargets({ requireSelection: true });
    if (!targets.length) { this._flashActionsNote('Selecciona al menos 1 dispositivo.', 'warn'); return; }
    let ok = 0, fail = 0;
    await Promise.all(targets.map(async serial => {
      try {
        const r = await fetch(`${PYTHON_API}/flowkeyboard/select-via-settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serial })
        });
        if (r.ok) ok++; else fail++;
      } catch { fail++; }
    }));
    this._flashActionsNote(`Teclado: ${ok} OK${fail ? `, ${fail} fallaron` : ''}`, fail ? 'warn' : 'success');
  }

  openActionsInstallApkModal() {
    const targets = this.getActionsTargets();
    if (!targets.length) { this._flashActionsNote('Selecciona al menos 1 dispositivo.', 'warn'); return; }
    this._showActionsModal({
      title: 'APKS',
      subtitle: `Instalar en ${targets.length} dispositivo${targets.length === 1 ? '' : 's'} seleccionado${targets.length === 1 ? '' : 's'}`,
      bodyHtml: `
        <div class="actions-modal-stack">
          <label class="actions-modal-btn-file">
            <span>Elegir APK e instalar</span>
            <input id="actionsApkInput" type="file" accept=".apk,application/vnd.android.package-archive" hidden>
          </label>
          <div class="actions-modal-result" id="actionsApkResult">APK hasta 500 MB.</div>
        </div>`
    });
    setTimeout(() => {
      const inp = document.getElementById('actionsApkInput');
      const out = document.getElementById('actionsApkResult');
      inp.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (out) out.textContent = `Instalando ${file.name} en ${targets.length} dispositivo${targets.length === 1 ? '' : 's'}...`;
        let ok = 0, fail = 0;
        await Promise.all(targets.map(async serial => {
          try {
            const fd = new FormData();
            fd.append('serial', serial);
            fd.append('apk', file);
            const r = await fetch(`${PYTHON_API}/apps/install`, { method: 'POST', body: fd });
            if (r.ok) ok++; else fail++;
          } catch { fail++; }
        }));
        if (out) out.textContent = `${ok} OK${fail ? `, ${fail} fallaron` : ''}`;
        this._flashActionsNote(`Instalar APK: ${ok} OK${fail ? `, ${fail} fallaron` : ''}`, fail ? 'warn' : 'success');
      });
    }, 50);
  }

  async openSpotifyApksModal() {
    const targets = this.getActionsTargets();
    if (!targets.length) { this._flashActionsNote('Selecciona al menos 1 dispositivo.', 'warn'); return; }
    this._showActionsModal({
      title: 'Spotify APKS',
      subtitle: `Clones disponibles para ${targets.length} dispositivo${targets.length === 1 ? '' : 's'} seleccionado${targets.length === 1 ? '' : 's'}`,
      bodyHtml: '<div class="actions-modal-loading">Leyendo carpeta APK...</div>',
    });
    try {
      const r = await fetch(`${PYTHON_API}/clone-apks`);
      const inventory = await r.json();
      const items = Array.isArray(inventory.items) ? inventory.items : [];
      const body = `
        <div class="actions-modal-stack">
          <div class="spotify-apk-head">
            <div class="spotify-apk-mark">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M7.8 10.2c3.4-1 6.4-.7 8.8.7"/><path d="M8.4 13c2.7-.8 5.2-.5 7.1.6"/><path d="M9 15.6c2-.5 3.8-.3 5.4.5"/></svg>
            </div>
            <div>
              <div class="spotify-apk-title">Carpeta APK</div>
              <div class="spotify-apk-path">${this.escapeHtml(inventory.root || 'APK')}</div>
            </div>
          </div>
          <div class="spotify-apk-list">
            ${items.map(item => `
              <label class="spotify-apk-item ${item.exists ? '' : 'is-missing'}">
                <input type="checkbox" class="spotify-clone-check" value="${item.clone}" ${item.exists ? 'checked' : 'disabled'}>
                <span class="spotify-clone-number">C${item.clone}</span>
                <span class="spotify-clone-info">
                  <b>${this.escapeHtml(item.package || `Clone ${item.clone}`)}</b>
                  <small>${item.exists ? this.escapeHtml(item.apkName || 'APK encontrada') : 'APK no encontrada'}</small>
                </span>
              </label>`).join('')}
          </div>
          <div class="spotify-apk-actions">
            <button class="actions-modal-btn" onclick="app.installSpotifyCloneApks('selected')">Instalar seleccionados</button>
            <button class="actions-modal-btn" onclick="app.installSpotifyCloneApks('all')">Instalar todos</button>
          </div>
          <div class="actions-modal-result" id="spotifyApkResult">Puedes marcar 1, varios o todos los clones disponibles.</div>
        </div>`;
      this._setActionsModalBody(body);
    } catch (e) {
      this._setActionsModalBody(`<div class="actions-modal-empty">No se pudo leer la carpeta APK: ${this.escapeHtml(e.message)}</div>`);
    }
  }

  async installSpotifyCloneApks(mode = 'selected') {
    const targets = this.getActionsTargets();
    if (!targets.length) { this._flashActionsNote('Selecciona al menos 1 dispositivo.', 'warn'); return; }
    const out = document.getElementById('spotifyApkResult');
    const checked = [...document.querySelectorAll('.spotify-clone-check:checked')]
      .map(input => Number(input.value))
      .filter(Boolean);
    const clones = mode === 'all' ? 'all' : checked;
    if (mode !== 'all' && !checked.length) {
      if (out) out.textContent = 'Marca al menos un APK.';
      return;
    }
    if (out) out.textContent = `Instalando Spotify ${mode === 'all' ? 'todos' : checked.join(', ')} en ${targets.length} dispositivo${targets.length === 1 ? '' : 's'}...`;
    try {
      const r = await fetch(`${PYTHON_API}/clone-apks/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceIds: targets, clones })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      if (out) out.textContent = data.result || 'Instalacion finalizada.';
      this._flashActionsNote('Spotify APKS: instalacion finalizada.', 'success');
    } catch (e) {
      if (out) out.textContent = `Error: ${e.message}`;
      this._flashActionsNote('Spotify APKS fallo.', 'error');
    }
  }

  async runPowerAction(action) {
    const targets = this.getActionsTargets({ requireSelection: true });
    if (!targets.length) { this._flashActionsNote('Selecciona al menos 1 dispositivo.', 'warn'); return; }
    const label = action === 'reboot' ? 'Reiniciar' : 'Apagar';
    if (!confirm(`Seguro que quieres ${label.toLowerCase()} ${targets.length} dispositivo${targets.length === 1 ? '' : 's'}?`)) return;
    const endpoint = action === 'reboot' ? '/power/reboot' : '/power/shutdown';
    let ok = 0, fail = 0;
    await Promise.all(targets.map(async serial => {
      try {
        const r = await fetch(`${PYTHON_API}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serial })
        });
        if (r.ok) ok++; else fail++;
      } catch { fail++; }
    }));
    if (ok) {

      this.renderDevices();

      setTimeout(() => this.loadDevices(), 1500);

    }

    this._flashActionsNote(`${label}: ${ok} OK${fail ? `, ${fail} fallaron` : ''}`, fail ? 'warn' : 'success');
  }

  _showActionsModal({ title, subtitle, bodyHtml }) {
    this._closeActionsModal();
    const modal = document.createElement('div');
    modal.id = 'actionsModal';
    modal.className = 'actions-modal is-open';
    modal.innerHTML = `
      <div class="actions-modal-card">
        <div class="actions-modal-header">
          <div>
            <div class="actions-modal-title">${this.escapeHtml(title)}</div>
            <div class="actions-modal-subtitle">${this.escapeHtml(subtitle)}</div>
          </div>
          <button class="actions-modal-close" onclick="app._closeActionsModal()" title="Cerrar">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2.2"><path d="m18 6-12 12"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div class="actions-modal-body" id="actionsModalBody">${bodyHtml}</div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) this._closeActionsModal(); });
  }

  _setActionsModalBody(html) {
    const body = document.getElementById('actionsModalBody');
    if (body) body.innerHTML = html;
  }

  _closeActionsModal() {
    const modal = document.getElementById('actionsModal');
    if (modal) modal.remove();
  }

  _showActionsContextMenu(event, items, onPick) {
    this._closeActionsContextMenu();
    const menu = document.createElement('div');
    menu.id = 'actionsContextMenu';
    menu.className = 'actions-context-menu';
    menu.innerHTML = items.map((it, i) => `
      <button class="actions-context-item ${it.danger ? 'is-danger' : ''}" data-i="${i}">${this.escapeHtml(it.label)}</button>
    `).join('');
    document.body.appendChild(menu);
    const rect = event.currentTarget.getBoundingClientRect();
    const margin = 6;
    let left = rect.right + margin;
    let top  = rect.top;
    const mRect = menu.getBoundingClientRect();
    if (left + mRect.width > window.innerWidth - margin) left = rect.left - mRect.width - margin;
    if (top + mRect.height > window.innerHeight - margin) top = window.innerHeight - mRect.height - margin;
    menu.style.left = `${Math.max(margin, left)}px`;
    menu.style.top  = `${Math.max(margin, top)}px`;
    menu.querySelectorAll('.actions-context-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.i);
        this._closeActionsContextMenu();
        onPick?.(items[i]);
      });
    });
    requestAnimationFrame(() => {
      const onOut = (e) => {
        if (!menu.contains(e.target)) {
          this._closeActionsContextMenu();
          document.removeEventListener('mousedown', onOut, true);
        }
      };
      document.addEventListener('mousedown', onOut, true);
    });
  }

  _closeActionsContextMenu() {
    const m = document.getElementById('actionsContextMenu');
    if (m) m.remove();
  }

  async scanIP(ip, options = {}) {
    try {
      const timeoutMs = options.timeoutMs || 3500;
      const response = await fetch(`${CSHARP_API}/devices/adb/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial: ip }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log(`✓ Conectado: ${ip}`);
          return true;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  stopNetworkScan() {
    this.scanning = false;
    const progressText = document.getElementById('progressText');
    progressText.textContent = 'Deteniendo...';
  }

  async startStreaming() {
    if (this.selectedDeviceIds.size === 0) {
      alert('Selecciona al menos un dispositivo');
      return;
    }

    const selectedSerials = Array.from(this.selectedDeviceIds);
    console.log('🎬 Iniciando video streaming para:', selectedSerials);

    // Inicializar streams con estado
    this.streams = selectedSerials.map(serial => ({
      serial,
      running: true,
      fps: 0,
      lastFrameTime: null,
      ws: null,
      player: null,
      frameCount: 0
    }));

    // Mostrar grid de streaming
    const streamGrid = document.getElementById('streamGrid');
    streamGrid.style.display = 'grid';
    
    this.renderStreams();
    
    // Esperar a que el DOM se actualice
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await this.startNativeStreams(selectedSerials);

    console.log(`✅ Video streaming iniciado para ${selectedSerials.length} dispositivo(s)`);
  }

  async startNativeStreams(serials) {
    const layoutWidth = Math.max(900, window.screen.availWidth || window.innerWidth || 1200);
    const layoutHeight = Math.max(640, window.screen.availHeight || window.innerHeight || 800);
    const columns = Math.max(1, Math.ceil(Math.sqrt(serials.length)));

    const response = await fetch(`${CSHARP_API}/streaming/start-embedded`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serials,
        quality: this.streamQuality,
        layout: {
          columns,
          containerWidth: layoutWidth,
          containerHeight: layoutHeight
        }
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Error HTTP ${response.status}`);
    }

    const data = await response.json();
    const streamBySerial = new Map((data.streams || []).map(item => [item.serial, item]));
    this.streams = this.streams.map(stream => ({
      ...stream,
      native: true,
      processId: streamBySerial.get(stream.serial).processId || null
    }));
    this.renderStreams();
  }

  async startVideoStream(serial) {
    try {
      const quality = this.streamQuality === '4k' ? 2160 :
                      this.streamQuality === '1080p' ? 1080 :
                      this.streamQuality === '720p' ? 720 : 480;
      
      console.log(`🎬 Iniciando video streaming para: ▶ ['${serial}']`);
      
      const stream = this.streams.find(s => s.serial === serial);
      if (!stream) return;
      
      // Usar screenshots optimizados con JPEG
      this.startScreenCapture(serial, quality);
      
    } catch (error) {
      console.error(`[ERROR] Error iniciando video stream para ${serial}:`, error);
    }
  }

  async startScreenCapture(serial, quality) {
    const stream = this.streams.find(s => s.serial === serial);
    if (!stream || !stream.running) return;
    
    const canvas = document.getElementById(`stream-canvas-${serial.replace(/[:.]/g, '_')}`);
    if (!canvas) {
      console.error(`[ERROR] Canvas no encontrado para ${serial}`);
      return;
    }
    
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    const captureFrame = async () => {
      if (!stream.running) return;
      
      try {
        const response = await fetch(`http://localhost:5000/api/devices/${encodeURIComponent(serial)}/screenshotquality=${quality}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const dataUrl = `data:image/png;base64,${base64}`;
        
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Actualizar FPS
          stream.frameCount++;
          const now = Date.now();
          if (stream.lastFrameTime) {
            const delta = now - stream.lastFrameTime;
            if (delta >= 1000) {
              stream.fps = Math.round((stream.frameCount * 1000) / delta);
              stream.frameCount = 0;
              stream.lastFrameTime = now;
              
              const fpsElement = document.getElementById(`stream-fps-${serial.replace(/[:.]/g, '_')}`);
              if (fpsElement) {
                fpsElement.textContent = `${stream.fps} FPS`;
              }
            }
          } else {
            stream.lastFrameTime = now;
          }
          
          // Siguiente frame inmediatamente
          setTimeout(captureFrame, 0);
        };
        
        img.onerror = () => {
          setTimeout(captureFrame, 100);
        };
        
        img.src = dataUrl;
        
      } catch (error) {
        console.error(`[ERROR] Error capturando frame ${serial}:`, error);
        setTimeout(captureFrame, 100);
      }
    };
    
    captureFrame();
  }

  processVideoFrame(serial, data) {
    // Ya no se usa - mantenido por compatibilidad
  }

  async stopStream(serial) {
    const stream = this.streams.find(s => s.serial === serial);
    if (stream) {
      stream.running = false;
      
      // Cerrar WebSocket
      if (stream.ws && stream.ws.readyState === WebSocket.OPEN) {
        stream.ws.close();
      }
      
      // Limpiar player
      if (stream.player) {
        stream.player = null;
      }
    }

    // Remover de la lista
    this.streams = this.streams.filter(s => s.serial !== serial);
    
    // Llamar al backend para detener scrcpy
    try {
      await fetch(`${CSHARP_API}/streaming/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial })
      });
      await fetch(`${CSHARP_API}/videostream/stop/${encodeURIComponent(serial)}`, {
        method: 'POST'
      });
    } catch (error) {
      console.warn(`[WARN] Error deteniendo stream en backend: ${error.message}`);
    }
    
    if (this.streams.length === 0) {
      document.getElementById('streamGrid').style.display = 'none';
    } else {
      this.renderStreams();
    }

    console.log(`✅ Stream detenido: ${serial}`);
  }

  async stopAllStreams() {
    // Detener todos los streams
    const serials = this.streams.map(s => s.serial);
    
    for (const serial of serials) {
      const stream = this.streams.find(s => s.serial === serial);
      if (stream) {
        stream.running = false;
        
        // Cerrar WebSocket
        if (stream.ws && stream.ws.readyState === WebSocket.OPEN) {
          stream.ws.close();
        }
        
        // Limpiar player
        if (stream.player) {
          stream.player = null;
        }
        
        // Llamar al backend
        try {
          await fetch(`${CSHARP_API}/streaming/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serial })
          });
          await fetch(`${CSHARP_API}/videostream/stop/${encodeURIComponent(serial)}`, {
            method: 'POST'
          });
        } catch (error) {
          console.warn(`[WARN] Error deteniendo stream ${serial}: ${error.message}`);
        }
      }
    }

    this.streams = [];
    document.getElementById('streamGrid').style.display = 'none';

    console.log(`✅ Todos los streams detenidos`);
  }

  showStreamingMessage(message) {
    const streamGrid = document.getElementById('streamGrid');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'streaming-message';
    messageDiv.textContent = message;
    streamGrid.insertBefore(messageDiv, streamGrid.firstChild);

    setTimeout(() => {
      messageDiv.remove();
    }, 5000);
  }

  renderStreams() {
    const container = document.getElementById('streamGrid');
    
    if (this.streams.length === 0) {
      container.innerHTML = '<div class="loading">Selecciona dispositivos y presiona "Iniciar Streaming"</div>';
      return;
    }

    container.innerHTML = `
      <div class="stream-controls">
        <div class="stream-quality">
          <label for="qualitySelect">Calidad:</label>
          <select id="qualitySelect" onchange="app.changeQuality(this.value)">
            <option value="480p" ${this.streamQuality === '480p' ? 'selected' : ''}>480p</option>
            <option value="720p" ${this.streamQuality === '720p' ? 'selected' : ''}>720p (Recomendado)</option>
            <option value="1080p" ${this.streamQuality === '1080p' ? 'selected' : ''}>1080p</option>
            <option value="4k" ${this.streamQuality === '4k' ? 'selected' : ''}>4K</option>
          </select>
        </div>
        <button class="btn btn-danger" onclick="app.stopAllStreams()">
          Detener Todos
        </button>
      </div>
      <div class="stream-grid-container">
        ${this.streams.map(stream => this.renderStreamCard(stream)).join('')}
      </div>
    `;
  }

  renderStreamCard(stream) {
    const deviceName = this.deviceNames[stream.serial] || stream.serial;
    const safeSerial = stream.serial.replace(/[:.]/g, '_');
    const videoBody = stream.native
      ? `<div class="stream-native-placeholder">
          <span>Stream Pro activo</span>
          <small>Video en vivo por scrcpy</small>
        </div>`
      : `<canvas id="stream-canvas-${safeSerial}" 
                  class="stream-video"
                  width="1080"
                  height="1920"></canvas>`;
    
    return `
      <div class="stream-card" data-serial="${stream.serial}"
           ondblclick="app.openFlowTouchFocus('${stream.serial}')"
           onmousedown="if(event.ctrlKey) app.onStreamCardCtrlSelect(event, '${stream.serial}')"
           onmouseenter="if(event.buttons === 1 && event.ctrlKey) app.onStreamCardCtrlSelect(event, '${stream.serial}')">
        <div class="stream-header">
          <div class="stream-title">
            <span class="stream-device-name">${deviceName}</span>
            <span class="stream-serial">${this.shortSerial(stream.serial)}</span>
          </div>
          <div class="stream-fps" id="stream-fps-${safeSerial}">${stream.native ? 'scrcpy' : '0 FPS'}</div>
          <button class="stream-stop-btn" onclick="app.stopStream('${stream.serial}')" title="Detener stream">
            Stop
          </button>
        </div>
        <div class="stream-video-container">
          ${videoBody}
        </div>
      </div>
    `;
  }

  changeQuality(quality) {
    this.streamQuality = quality;
    console.log(`📊 Calidad cambiada a: ${quality}`);
    
    if (this.streams.length > 0) {
      const restart = confirm(`Reiniciar streams con calidad ${quality}?`);
      if (restart) {
        this.stopAllStreams().then(() => {
          setTimeout(() => this.startStreaming(), 1000);
        });
      }
    }
  }

  renderCategories() {
    return CATEGORIES.map(cat => `
      <button class="category-btn ${this.selectedCategory === cat.id ? 'is-selected' : ''} ${!cat.enabled ? 'is-disabled' : ''}"
              onclick="app.selectCategory('${cat.id}')"
              style="--action-color: ${cat.color};"
              ${!cat.enabled ? 'disabled' : ''}
              aria-pressed="${this.selectedCategory === cat.id}">
        <span class="category-icon">${cat.icon}</span>
        <span class="category-label">${cat.label}</span>
      </button>
    `).join('');
  }

  renderPlayButtons() {
    return CATEGORIES.map(cat => {
      const isRunning = this.runningFlow === cat.id;
      return `
        <button class="flow-run-btn ${isRunning ? 'is-running' : ''}"
                onclick="app.toggleFlow('${cat.id}')"
                style="--flow-color: ${cat.color};"
                ${!cat.enabled ? 'disabled' : ''}
                aria-label="${isRunning ? 'Detener' : 'Ejecutar'} ${cat.label}"
                title="${isRunning ? 'Detener' : 'Ejecutar'} ${cat.label}">
          <svg viewBox="0 0 24 24">
            ${isRunning ? '<path d="M7 7h10v10H7z" />' : '<path d="m8 5 11 7-11 7V5Z" />'}
          </svg>
        </button>
      `;
    }).join('');
  }

  selectCategory(categoryId) {
    this.selectedCategory = categoryId;
    const categoryGrid = document.getElementById('categoryGrid');
    if (categoryGrid) categoryGrid.innerHTML = this.renderCategories();
    const pinned = document.getElementById('mainFlowCategoryPinned');
    if (pinned) pinned.innerHTML = this.renderPinnedFlowCategoryBar();
    console.log('📂 Categoría seleccionada:', categoryId);
  }

  async toggleFlow(flowId) {
    const category = CATEGORIES.find(c => c.id === flowId);
    if (!category || !category.enabled) return;

    if (this.runningFlow === flowId) {
      // Stop flow
      await this.stopFlow(flowId);
    } else {
      // Start flow
      await this.startFlow(flowId);
    }
  }

  async startFlow(flowId) {
    if (this.selectedDeviceIds.size === 0) {
      alert('Selecciona al menos un dispositivo');
      return;
    }

    if (!this.pythonConnected) {
      alert('Servidor Python no conectado');
      return;
    }

    console.log(`▶ Iniciando ${flowId} en dispositivos:`, Array.from(this.selectedDeviceIds));

    try {
      const selectedSerials = Array.from(this.selectedDeviceIds);
      
      const response = await fetch(`${PYTHON_API}/autojs/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceIds: selectedSerials,
          filePath: '/sdcard/Download/Login.js',
          delimiter: this.delimiter
        })
      });

      if (!response.ok) throw new Error('Error iniciando FlowLogin');

      const data = await response.json();
      const resultText = typeof data.result === 'string'
        ? data.result
        : JSON.stringify(data.result || data, null, 2);
      console.log(`[FlowLogin] Resultado backend:\n${resultText}`);
      if (/ERROR:|no se inicio|No hay cuentas asignadas|Socket FlowAgent obligatorio/i.test(resultText)) {
        throw new Error(resultText.split('\n').filter(Boolean).slice(0, 4).join(' | '));
      }

      this.setRunningFlow(flowId);
      const flowRunGrid = document.getElementById('flowRunGrid');
      if (flowRunGrid) flowRunGrid.innerHTML = this.renderPlayButtons();
      const pinned = document.getElementById('mainFlowCategoryPinned');
      if (pinned) pinned.innerHTML = this.renderPinnedFlowCategoryBar();
      
      console.log(`✅ ${flowId} iniciado correctamente`);
    } catch (error) {
      console.error(`[ERROR] Error iniciando ${flowId}:`, error);
      alert(`Error iniciando ${flowId}: ${error.message}`);
    }
  }

  async stopFlow(flowId) {
    console.log(`[STOP] Deteniendo ${flowId}`);

    try {
      const selectedSerials = Array.from(this.selectedDeviceIds);
      
      const response = await fetch(`${PYTHON_API}/autojs/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceIds: selectedSerials,
          filePath: '/sdcard/Download/Login.js'
        })
      });

      if (!response.ok) throw new Error('Error deteniendo FlowLogin');

      this.setRunningFlow(null);
      const flowRunGrid = document.getElementById('flowRunGrid');
      if (flowRunGrid) flowRunGrid.innerHTML = this.renderPlayButtons();
      const pinned = document.getElementById('mainFlowCategoryPinned');
      if (pinned) pinned.innerHTML = this.renderPinnedFlowCategoryBar();
      
      console.log(`✅ ${flowId} detenido correctamente`);
    } catch (error) {
      console.error(`[ERROR] Error deteniendo ${flowId}:`, error);
      alert(`Error deteniendo ${flowId}: ${error.message}`);
    }
  }

  // Account Management
  switchAccountTab(tab) {
    this.activeAccountTab = tab;
    // Mostrar/ocultar los textareas individuales de cada pestaña
    ['total','valid','invalid'].forEach(t => {
      const ta = document.getElementById(`accountsTextarea${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (ta) ta.classList.toggle('is-tab-hidden', t !== tab);
    });
    // Retrocompatibilidad: si existe el textarea antiguo también actualizarlo
    const taOld = document.getElementById('accountsTextarea');
    if (taOld) taOld.value = this.accounts[tab];
    // Update tab styles (ambas clases usadas en sidebar y popover)
    document.querySelectorAll('.account-tab, .account-tab-sidebar').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.tab === tab);
    });
  }

  onAccountsChange(tab) {
    // Puede recibir tab explícito (nuevos textareas individuales) o leer el activo
    const activeTab = tab || this.activeAccountTab;
    const idMap = { total: 'accountsTextareaTotal', valid: 'accountsTextareaValid', invalid: 'accountsTextareaInvalid' };
    const textarea = document.getElementById(idMap[activeTab]) || document.getElementById('accountsTextarea');
    if (textarea) {
      this.accounts[activeTab] = textarea.value;
      localStorage.setItem(`flowdashboard.accounts.${activeTab}`, textarea.value);
      this.updateAccountCounts();
    }
  }

  onDelimiterChange(value) {
    this.delimiter = value || ':';
    localStorage.setItem('flowdashboard.delimiter', this.delimiter);
  }

  onDivideCountChange(value) {
    this.divideCount = Math.min(10, Math.max(1, parseInt(value) || 10));
    document.getElementById('divideCount').value = this.divideCount;
  }

  updateAccountCounts() {
    const totalLines = this.accounts.total.split('\n').filter(l => l.trim()).length;
    const validLines = this.accounts.valid.split('\n').filter(l => l.trim()).length;
    const invalidLines = this.accounts.invalid.split('\n').filter(l => l.trim()).length;

    const totalEl = document.getElementById('totalCount');
    const validEl = document.getElementById('validCount');
    const invalidEl = document.getElementById('invalidCount');

    if (totalEl) totalEl.textContent = totalLines;
    if (validEl) validEl.textContent = validLines;
    if (invalidEl) invalidEl.textContent = invalidLines;
  }

  async divideAccounts() {
    if (this.selectedDeviceIds.size === 0) {
      alert('Selecciona al menos un dispositivo');
      return;
    }

    const accounts = this.accounts.total
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    if (accounts.length === 0) {
      alert('No hay cuentas en Total para dividir');
      return;
    }

    const countPerDevice = this.divideCount;

    if (countPerDevice < 1) {
      alert('Dividir debe ser al menos 1');
      return;
    }
    if (countPerDevice > 10) {
      alert('No se pueden asignar mas de 10 cuentas por dispositivo');
      return;
    }

    const devicesArray = Array.from(this.selectedDeviceIds);
    const totalNeeded = countPerDevice * devicesArray.length;
    if (accounts.length < totalNeeded) {
      alert(`No hay suficientes cuentas.\nNecesitas ${totalNeeded} (${countPerDevice} x ${devicesArray.length} dispositivos) pero solo hay ${accounts.length}.`);
      return;
    }

    console.log(`Dividiendo: ${countPerDevice} cuentas x ${devicesArray.length} dispositivos`);

    try {
      let accountIndex = 0;
      const assignments = [];

      for (const serial of devicesArray) {
        const deviceAccounts = accounts.slice(accountIndex, accountIndex + countPerDevice);
        accountIndex += countPerDevice;

        const response = await fetch(`${PYTHON_API}/device-person`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serial,
            person: deviceAccounts.join('\n')
          })
        });

        if (!response.ok) throw new Error(`Error asignando cuentas a ${serial}`);
        assignments.push({ serial, count: deviceAccounts.length, assignedAccounts: deviceAccounts });
        console.log(`${deviceAccounts.length} cuentas asignadas a ${serial}`);
      }

      // Consumir las cuentas asignadas
      const remainingAccounts = accounts.slice(accountIndex);
      this.accounts.total = remainingAccounts.join('\n');
      localStorage.setItem('flowdashboard.accounts.total', this.accounts.total);
      
      const textareaTotal = document.getElementById('accountsTextareaTotal') || document.getElementById('accountsTextarea');
      if (textareaTotal) textareaTotal.value = this.accounts.total;
      
      this.updateAccountCounts();

      // Guardar en el historial
      let history = [];
      try { history = JSON.parse(localStorage.getItem('flowdashboard.accountsHistory') || '[]'); } catch(e){}
      
      assignments.forEach(a => {
        if (a.assignedAccounts && a.assignedAccounts.length > 0) {
           const stableId = this.getDeviceStableId(a.serial);
           history.unshift({
             deviceSerial: a.serial,
             deviceName: this.deviceNames[a.serial] || this.deviceNames[stableId] || a.serial,
             deviceNumber: this.deviceNumbers[stableId] || this.getDeviceNumber({serial: a.serial}),
             deviceIp: this.deviceMeta[a.serial]?.publicIp || 'N/A',
             accounts: a.assignedAccounts,
             date: new Date().toISOString()
           });
        }
      });
      if (history.length > 1000) history = history.slice(0, 1000);
      localStorage.setItem('flowdashboard.accountsHistory', JSON.stringify(history));

      // Actualizar memoria localmente para la UI sin esperar al ADB
      assignments.forEach(a => {
        const stableId = this.getDeviceStableId(a.serial);
        this.deviceAccounts[stableId] = {
           person: a.assignedAccounts.join('\\n'),
           accounts: a.assignedAccounts.map(acc => acc.trim()).filter(Boolean)
        };
        this.deviceAccounts[a.serial] = this.deviceAccounts[stableId];
      });

      this.renderDevices();
      this.loadDevices(); // Actualizar asincronamente el background

      const summary = assignments.map(a => {
        const name = this.deviceNames[a.serial] || a.serial;
        return `${name}: ${a.count}/10`;
      }).join('\n');
      alert(`Cuentas asignadas correctamente:\n\n${summary}`);
    } catch (error) {
      console.error('[ERROR] Error dividiendo cuentas:', error);
      alert(`Error dividiendo cuentas: ${error.message}`);
    }
  }

  startPolling() {
    // Poll devices every 30 seconds (devices don't change frequently)
    this.pollingInterval = setInterval(() => {
      this.loadDevices();
    }, 30000);

    // Poll login statuses every 10 seconds — reducido para no saturar ADB
    this.statusPollingInterval = setInterval(() => {
      if (this.pythonConnected) {
        this.loadLoginStatuses().then(() => {
          this.updateStatusDots();
        });
      }
    }, 10000);
  }

  // Window controls
  minimize() {
    if (window.electronAPI) {
      window.electronAPI.minimizeWindow();
    }
  }

  maximize() {
    if (window.electronAPI) {
      window.electronAPI.maximizeWindow();
    }
  }

  close() {
    if (window.electronAPI) {
      window.electronAPI.closeWindow();
    }
  }

  // Sidebar Functions
  renderNetworkScannerSection() {
    return `
      <div class="sidebar-section" id="networkScannerSection">
        <div class="sidebar-section-header" onclick="app.toggleNetworkScanner()">
          <span class="sidebar-category-icon" style="color:#4f8dff;">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="2"/>
              <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
            </svg>
          </span>
          <span class="sidebar-section-title">Escanear Red</span>
          <svg class="sidebar-collapse-arrow" id="scannerArrow" viewBox="0 0 24 24">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
        <div class="sidebar-section-content-static network-scanner-panel" id="scannerPanel" style="display:none;">
          <div class="scanner-config">
            <label class="scanner-label">Rangos de Red:</label>
            <textarea id="networkRanges" class="accounts-textarea-sidebar" style="min-height: 40px; margin-bottom: 4px;" placeholder="ej: 192.168.1.1-254&#10;10.0.0.1-254"></textarea>
            
            <div style="display:flex; gap: 4px; margin-bottom: 8px;">
              <button class="btn-sidebar" onclick="app.autoDetectNetworkRange()" style="flex:1; font-size:0.7rem; padding: 4px;" title="Autodetectar desde interfaz">Auto-detectar</button>
              <select id="networkPresets" class="inspector-device-select" style="flex:1; font-size:0.7rem; margin:0;" onchange="if(this.value) { document.getElementById('networkRanges').value = this.value; this.value=''; }">
                <option value="">Presets...</option>
                <option value="192.168.1.1-254">192.168.1.x</option>
                <option value="192.168.0.1-254">192.168.0.x</option>
                <option value="10.0.0.1-254">10.0.0.x</option>
              </select>
            </div>
            
            <label class="scanner-label">Puerto:</label>
            <input type="number" id="adbPort" value="5555" min="1" max="65535" class="port-input" placeholder="5555">
          </div>
          <div class="scanner-progress" id="scannerProgress" style="display:none;">
            <div class="progress-bar-container">
              <div class="progress-bar" id="progressBar"></div>
            </div>
            <div class="progress-text">
              <span id="progressText">Escaneando...</span>
              <span id="progressCount">0/0</span>
            </div>
            <div class="devices-found">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                <line x1="12" y1="18" x2="12.01" y2="18"/>
              </svg>
              <span id="devicesFound">0 dispositivos encontrados</span>
            </div>
          </div>
          <button class="btn-scanner" onclick="app.startNetworkScan()" id="scanButton" style="margin-bottom: 4px;">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span>Iniciar Escaneo</span>
          </button>
          <button class="btn-scanner" onclick="app.reconnectKnownDevices()" style="background:var(--bg-lighter);">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
              <path d="M3 12a9 9 0 0 1 15-6.7"/><path d="M18 3v6h-6"/>
              <path d="M21 12a9 9 0 0 1-15 6.7"/><path d="M6 21v-6h6"/>
            </svg>
            <span>Reconectar Conocidos</span>
          </button>
        </div>
      </div>
    `;
  }

  // SECCION "ACCIONES" - sidebar
  // ============================================================
  // Botones rapidos para aplicar comandos a los devices SELECCIONADOS
  // (uno, varios o todos). Reusa los mismos endpoints que FlowTouch
  // (Focus Mode) pero iterando sobre la seleccion en lugar de un solo
  // device. NO afecta al funcionamiento existente.
  renderPinnedFlowCategoryBar() {
    const flows = CATEGORIES.map(cat => {
      const isRunning = this.runningFlow === cat.id;
      const isSelected = this.selectedCategory === cat.id;
      const playIcon = isRunning ? '<path d="M7 7h10v10H7z" />' : '<path d="m8 5 11 7-11 7V5Z" />';
      return `
        <div class="main-flow-chip ${isRunning ? 'is-running' : ''} ${isSelected ? 'is-selected' : ''} ${!cat.enabled ? 'is-disabled' : ''}"
             style="--flow-color:${cat.color};">
          <button class="main-flow-select"
                  onclick="app.onPinnedCategoryClick(event, '${cat.id}')"
                  title="${cat.label}">
            <span class="main-flow-icon">${cat.icon}</span>
            <span class="main-flow-label">${cat.label}</span>
          </button>
          <button class="main-flow-play-btn"
                  onclick="app.selectCategory('${cat.id}'); app.toggleFlow('${cat.id}')"
                  title="${isRunning ? 'Detener' : 'Ejecutar'} ${cat.label}"
                  aria-label="${isRunning ? 'Detener' : 'Ejecutar'} ${cat.label}"
                  ${!cat.enabled ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24">${playIcon}</svg>
          </button>
        </div>
      `;
    }).join('');

    return `<div class="main-flowcategory-grid">${flows}</div>`;
  }

  onPinnedCategoryClick(event, categoryId) {
    this.selectCategory(categoryId);
    if (categoryId === 'FlowLogin') {
      this.openFlowLoginPopover(event);
    }
  }

  openFlowLoginPopover(event) {
    if (document.getElementById('flowLoginPopover')) {
      this.closeFlowLoginPopover();
      return;
    }
    const content = document.getElementById('flowlogin-content');
    if (!content) return;

    this._flowLoginOriginalParent = content.parentNode;
    this._flowLoginOriginalNextSibling = content.nextSibling;

    const popover = document.createElement('div');
    popover.className = 'dashboard-popover';
    popover.id = 'flowLoginPopover';
    popover.style.width = '320px';
    popover.style.padding = '0';
    popover.style.zIndex = '99999';
    popover.style.position = 'fixed'; // fixed para que no dependa del scroll
    popover.style.backgroundColor = 'rgba(11, 18, 32, 0.97)';
    popover.style.border = '1px solid rgba(20, 184, 166, 0.35)';
    popover.style.borderRadius = '10px';
    popover.style.boxShadow = '0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(20,184,166,0.1)';
    popover.style.backdropFilter = 'blur(16px)';
    popover.style.overflow = 'hidden';
    popover.style.maxHeight = '90vh';
    popover.style.overflowY = 'auto';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.padding = '10px 14px';
    header.style.borderBottom = '1px solid rgba(20,184,166,0.15)';
    header.style.backgroundColor = 'rgba(20,184,166,0.07)';
    header.style.position = 'sticky';
    header.style.top = '0';
    header.style.zIndex = '1';
    header.innerHTML = `
      <span style="font-weight:600; font-size:0.85rem; color:var(--ink); display:flex; align-items:center; gap:6px;">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="#14b8a6" fill="none" stroke-width="2"><path d="M5 19V9"/><path d="M12 19V5"/><path d="M19 19v-7"/><path d="M3 19h18"/></svg>
        FlowLogin
      </span>
      <button onclick="app.closeFlowLoginPopover()" style="background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:1.2rem;line-height:1;padding:0 6px;border-radius:4px;" title="Cerrar">&times;</button>
    `;
    popover.appendChild(header);

    content.classList.remove('is-collapsed');
    content.style.padding = '12px';
    content.style.backgroundColor = 'transparent';
    content.style.display = 'block';
    popover.appendChild(content);

    document.body.appendChild(popover);

    // Calcular posicion: debajo del boton que lo abrio, dentro de la ventana
    const triggerRect = event.currentTarget.getBoundingClientRect();
    const popoverW = 320;
    const margin = 10;

    // Posicion vertical: justo debajo del boton
    let top = triggerRect.bottom + 8;
    
    // Limitar la altura para que no desborde la ventana hacia abajo
    const maxH = window.innerHeight - top - margin;
    popover.style.maxHeight = `${Math.max(200, maxH)}px`;

    // Posicion horizontal: alineado a la izquierda del boton, pero evitando que se salga por la derecha
    let left = triggerRect.left;
    if (left + popoverW > window.innerWidth - margin) {
      left = window.innerWidth - popoverW - margin;
    }
    if (left < margin) left = margin;



    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;

    const triggerEl = event.currentTarget;
    setTimeout(() => {
      this._flowLoginPopoverClickOutside = (e) => {
        if (!popover.contains(e.target) && !triggerEl.contains(e.target)) {
          this.closeFlowLoginPopover();
        }
      };
      document.addEventListener('click', this._flowLoginPopoverClickOutside);
    }, 10);
  }

  closeFlowLoginPopover() {
    const popover = document.getElementById('flowLoginPopover');
    if (!popover) return;
    
    const content = document.getElementById('flowlogin-content');
    if (content && this._flowLoginOriginalParent) {
      content.style.padding = ''; 
      content.style.display = ''; // Reset display
      content.classList.add('is-collapsed');
      this._flowLoginOriginalParent.insertBefore(content, this._flowLoginOriginalNextSibling);
    }

    if (this._flowLoginPopoverClickOutside) {
      document.removeEventListener('click', this._flowLoginPopoverClickOutside);
      this._flowLoginPopoverClickOutside = null;
    }
    popover.remove();
  }

  renderPinnedActionsBar() {
    return `
      <div class="pinned-action-group is-selection">
        <button class="action-chip is-icon-only is-square" style="--ac-color:#14b8a6;" onclick="app.selectAll()" title="Seleccionar todo" aria-label="Seleccionar todo">
          <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12.5 10.8 15 16 9"/></svg>
        </button>
        <button class="action-chip is-icon-only is-square" style="--ac-color:#fb7185;" onclick="app.deselectAll()" title="Deseleccionar todo" aria-label="Deseleccionar todo">
          <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="m9 9 6 6"/><path d="m15 9-6 6"/></svg>
        </button>
      </div>
      <span class="pinned-action-separator" aria-hidden="true"></span>
      <div class="pinned-action-group is-nav">
        <button class="action-chip is-icon-only is-square" style="--ac-color:#34d399;" onclick="app.runActionOnSelected('back')" title="Back" aria-label="Back">
          <svg viewBox="0 0 24 24"><path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/></svg>
        </button>
        <button class="action-chip is-icon-only is-square" style="--ac-color:#22d3ee;" onclick="app.runActionOnSelected('home')" title="Home" aria-label="Home">
          <svg viewBox="0 0 24 24"><path d="M3 12 12 3l9 9"/><path d="M5 10v10h14V10"/></svg>
        </button>
        <button class="action-chip is-icon-only is-square" style="--ac-color:#a78bfa;" onclick="app.runActionOnSelected('recents')" title="Recents" aria-label="Recents">
          <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/></svg>
        </button>
      </div>
      <span class="pinned-action-separator" aria-hidden="true"></span>
      <div class="pinned-action-group is-rest">
      <button class="action-chip" style="--ac-color:#06b6d4;" onclick="app.openCommonAppsModal()" title="Apps"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg><span>Apps</span></button>
      <button class="action-chip" style="--ac-color:#facc15;" onclick="app.openActionsInstallApkModal()" title="APKS"><svg viewBox="0 0 24 24"><path d="M3 7l3-4h12l3 4"/><path d="M3 7v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7"/><path d="M12 11v6"/><path d="M9 14l3-3 3 3"/></svg><span>APKS</span></button>
      <button class="action-chip action-chip-spotify" style="--ac-color:#1DB954;" onclick="app.openSpotifyApksModal()" title="Spotify"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M7.8 10.2c3.4-1 6.4-.7 8.8.7"/><path d="M8.4 13c2.7-.8 5.2-.5 7.1.6"/><path d="M9 15.6c2-.5 3.8-.3 5.4.5"/></svg><span>Spotify</span></button>
      <button class="action-chip" style="--ac-color:#facc15;" onclick="app.openActionsArchivosModal()" title="Archivos"><svg viewBox="0 0 24 24"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/></svg><span>Archivos</span></button>
      <button class="action-chip" style="--ac-color:#94a3b8;" onclick="app.openActionsAdbModal()" title="ADB"><svg viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg><span>ADB</span></button>
      <button class="action-chip" style="--ac-color:#f97316;" onclick="app.openActionsAutoJsModal()" title="JS"><svg viewBox="0 0 24 24"><path d="M5 3l6 18 2-7 7-2z"/></svg><span>JS</span></button>
      <button class="action-chip" style="--ac-color:#38bdf8;" onclick="app.runSystemShortcut('main')" title="Config"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg><span>Config</span></button>
      <button class="action-chip" style="--ac-color:#22c55e;" onclick="app.runSystemShortcut('wifi')" title="Wi-Fi"><svg viewBox="0 0 24 24"><path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><path d="M12 20h.01"/></svg><span>Wi-Fi</span></button>
      <button class="action-chip" style="--ac-color:#a78bfa;" onclick="app.runSystemShortcut('idioma')" title="Idioma"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></svg><span>Idioma</span></button>
      <button class="action-chip" style="--ac-color:#fb7185;" onclick="app.runPowerAction('reboot')" title="Reiniciar"><svg viewBox="0 0 24 24"><path d="M12 2v10"/><path d="M5.5 7.5a8 8 0 1 0 13 0"/></svg><span>Reiniciar</span></button>
      <button class="action-chip" style="--ac-color:#f97316;" onclick="app.runSystemShortcut('accesibilidad')" title="Accesibilidad"><svg viewBox="0 0 24 24"><circle cx="12" cy="4" r="2"/><path d="M5 8h14"/><path d="M12 8v13"/><path d="M8 21l4-9 4 9"/></svg><span>Accesibilidad</span></button>
      <button class="action-chip" style="--ac-color:#c4b5fd;" onclick="app.selectKeyboardOnSelected()" title="Teclado"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M17 14H7"/></svg><span>Teclado</span></button>
      <button class="action-chip is-danger" style="--ac-color:#ef4444;" onclick="app.runPowerAction('shutdown')" title="Apagar"><svg viewBox="0 0 24 24"><path d="M12 2v9"/><path d="M7 5.8a8 8 0 1 0 10 0"/></svg><span>Apagar</span></button>
      </div>
    `;
  }

  renderActionsSection() {
    return `
      <div class="sidebar-section" id="actionsSection">
        <div class="sidebar-section-header" onclick="app.toggleActionsSection()">
          <span class="sidebar-category-icon" style="color:#f59e0b;">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M13 2 3 14h9l-1 8 10-12h-9z"/>
            </svg>
          </span>
          <span class="sidebar-section-title">Acciones</span>
          <span class="actions-target-badge" id="actionsTargetBadge" title="Dispositivos objetivo">0</span>
          <svg class="sidebar-collapse-arrow" id="actionsArrow" viewBox="0 0 24 24">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
        <div class="sidebar-section-content-static actions-panel" id="actionsPanel" style="display:none;">

          <label class="actions-pin-toggle">
            <input type="checkbox" ${this.actionsPinned ? 'checked' : ''} onchange="app.toggleActionsPinned(this.checked)">
            <span class="actions-pin-check" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
            </span>
            <span>Fijar en Main Screen</span>
          </label>

          <!-- Grupo: Navegacion -->
          <div class="actions-group">
            <div class="actions-group-title">
              <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg>
              Navegacion
            </div>
            <div class="actions-grid actions-grid-nav">
              <button class="action-chip is-icon-only" style="--ac-color:#34d399;" onclick="app.runActionOnSelected('back')" title="Back" aria-label="Back">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>
                </svg>
              </button>
              <button class="action-chip is-icon-only" style="--ac-color:#22d3ee;" onclick="app.runActionOnSelected('home')" title="Home" aria-label="Home">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12 12 3l9 9"/><path d="M5 10v10h14V10"/>
                </svg>
              </button>
              <button class="action-chip is-icon-only" style="--ac-color:#a78bfa;" onclick="app.runActionOnSelected('recents')" title="Recents" aria-label="Recents">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Grupo: Sistema y Apps -->
          <div class="actions-group">
            <div class="actions-group-title">
              <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
              Apps y sistema
            </div>
            <div class="actions-grid">
              <button class="action-chip" style="--ac-color:#06b6d4;" onclick="app.openCommonAppsModal()" title="Aplicaciones comunes en seleccionados">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
                </svg>
                <span>Apps</span>
              </button>
              <button class="action-chip" style="--ac-color:#facc15;" onclick="app.openActionsInstallApkModal()" title="APKS">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 7l3-4h12l3 4"/><path d="M3 7v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7"/><path d="M12 11v6"/><path d="M9 14l3-3 3 3"/>
                </svg>
                <span>APKS</span>
              </button>
              <button class="action-chip action-chip-spotify" style="--ac-color:#1DB954;" onclick="app.openSpotifyApksModal()" title="Instalar clones Spotify desde carpeta APK">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="9"/><path d="M7.8 10.2c3.4-1 6.4-.7 8.8.7"/><path d="M8.4 13c2.7-.8 5.2-.5 7.1.6"/><path d="M9 15.6c2-.5 3.8-.3 5.4.5"/>
                </svg>
                <span>Spotify</span>
              </button>
              <button class="action-chip" style="--ac-color:#facc15;" onclick="app.openActionsArchivosModal()" title="Enviar archivos de PC a Android">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/>
                </svg>
                <span>Archivos</span>
              </button>
              <button class="action-chip" style="--ac-color:#94a3b8;" onclick="app.openActionsAdbModal()" title="Ejecutar comandos ADB">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
                </svg>
                <span>ADB</span>
              </button>
              <button class="action-chip" style="--ac-color:#f97316;" onclick="app.openActionsAutoJsModal()" title="Elegir y ejecutar script JS">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 3l6 18 2-7 7-2z"/>
                </svg>
                <span>JS</span>
              </button>
              <button class="action-chip" style="--ac-color:#38bdf8;" onclick="app.runSystemShortcut('main')" title="Abrir Config en los seleccionados">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
                </svg>
                <span>Config</span>
              </button>
              <button class="action-chip" style="--ac-color:#22c55e;" onclick="app.runSystemShortcut('wifi')" title="Abrir Wi-Fi en los seleccionados">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><path d="M12 20h.01"/>
                </svg>
                <span>Wi-Fi</span>
              </button>
              <button class="action-chip" style="--ac-color:#a78bfa;" onclick="app.runSystemShortcut('idioma')" title="Abrir Idioma en los seleccionados">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>
                </svg>
                <span>Idioma</span>
              </button>
              <button class="action-chip" style="--ac-color:#fb7185;" onclick="app.runPowerAction('reboot')" title="Reiniciar seleccionados">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2v10"/><path d="M5.5 7.5a8 8 0 1 0 13 0"/>
                </svg>
                <span>Reiniciar</span>
              </button>
              <button class="action-chip" style="--ac-color:#06b6d4;" onclick="app.runSystemShortcut('apps')" title="Abrir ajustes de Apps">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="4" y="4" width="6" height="6" rx="1.4"/><rect x="14" y="4" width="6" height="6" rx="1.4"/><rect x="4" y="14" width="6" height="6" rx="1.4"/><rect x="14" y="14" width="6" height="6" rx="1.4"/>
                </svg>
                <span>Apps config</span>
              </button>
              <button class="action-chip" style="--ac-color:#f97316;" onclick="app.runSystemShortcut('accesibilidad')" title="Abrir Accesibilidad">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="4" r="2"/><path d="M5 8h14"/><path d="M12 8v13"/><path d="M8 21l4-9 4 9"/>
                </svg>
                <span>Accesibilidad</span>
              </button>
              <button class="action-chip" style="--ac-color:#c4b5fd;" onclick="app.selectKeyboardOnSelected()" title="Seleccionar FlowKeyboard">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M17 14H7"/>
                </svg>
                <span>Teclado</span>
              </button>
              <button class="action-chip is-danger" style="--ac-color:#ef4444;" onclick="app.runPowerAction('shutdown')" title="Apagar seleccionados">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2v9"/><path d="M7 5.8a8 8 0 1 0 10 0"/>
                </svg>
                <span>Apagar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderOtherFlowCategories() {
    // Renderizar FlowRegister y otras categorías como secciones completas con colores
    const otherCategories = CATEGORIES.filter(cat => cat.id !== 'FlowLogin');
    
    return otherCategories.map(cat => {
      const isRunning = this.runningFlow === cat.id;
      
      // FlowRegister es especial - tiene opciones de registro completas
      if (cat.id === 'FlowRegister') {
        return `
          <div class="sidebar-section flow-section" style="--flow-color: ${cat.color};">
            <div class="sidebar-section-header" onclick="app.toggleSection('flowregister')">
              <span class="sidebar-category-icon" style="color: ${cat.color};">
                ${cat.icon}
              </span>
              <span class="sidebar-section-title" style="flex: 1;">${cat.label}</span>
              <button class="sidebar-section-play ${isRunning ? 'is-running' : ''}"
                      onclick="event.stopPropagation(); app.toggleFlow('${cat.id}')"
                      title="${isRunning ? 'Detener' : 'Ejecutar'} ${cat.label}">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  ${isRunning ? '<path d="M7 7h10v10H7z" />' : '<path d="m8 5 11 7-11 7V5Z" />'}
                </svg>
              </button>
              <svg class="sidebar-collapse-arrow" id="flowregister-icon" viewBox="0 0 24 24">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </div>
            <div class="sidebar-section-content is-collapsed" id="flowregister-content">
              <!-- Register Account Tabs -->
              <div class="account-tabs-sidebar">
                <button class="account-tab-sidebar ${this.activeRegisterTab === 'total' ? 'is-active' : ''}" 
                        onclick="app.switchRegisterTab('total')" data-tab="total">
                  <span>Total</span>
                  <span class="tab-counter" id="registerTotalCount">0</span>
                </button>
                <button class="account-tab-sidebar ${this.activeRegisterTab === 'valid' ? 'is-active' : ''}" 
                        onclick="app.switchRegisterTab('valid')" data-tab="valid">
                  <span>✓ Válidos</span>
                  <span class="tab-counter" id="registerValidCount">0</span>
                </button>
                <button class="account-tab-sidebar ${this.activeRegisterTab === 'invalid' ? 'is-active' : ''}" 
                        onclick="app.switchRegisterTab('invalid')" data-tab="invalid">
                  <span>✗ No válidos</span>
                  <span class="tab-counter" id="registerInvalidCount">0</span>
                </button>
              </div>

              <!-- Register Account Textarea -->
              <textarea id="registerAccountsTextarea" 
                        class="accounts-textarea-sidebar" 
                        placeholder="Cuentas para crear"
                        oninput="app.onRegisterAccountsChange()">${this.registerAccounts[this.activeRegisterTab]}</textarea>

              <!-- Register Controls -->
              <div class="divide-controls-sidebar">
                <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 8px;">
                  <label style="font-size: 0.75rem;">Cantidad/Disp:</label>
                  <input type="number" id="registerCountPerDevice" value="${this.registerCountPerDevice}" 
                         min="1" max="10" style="width: 50px; font-size: 0.8rem; padding: 4px 6px;
                         background: rgba(11, 18, 32, 0.6); border: 1px solid rgba(79, 141, 255, 0.15); 
                         border-radius: 4px; color: var(--ink);"
                         oninput="app.onRegisterCountChange(this.value)">
                </div>
                <button class="btn-sidebar" onclick="app.startRegister()" 
                        style="background: var(--accent); width: 100%; margin-bottom: 6px;">
                  Iniciar Creacion
                </button>
                ${this.activeRegisterTab === 'invalid' ? `
                <button class="btn-sidebar" onclick="app.clearRegisterInvalid()" 
                        style="background: var(--danger); width: 100%; font-size: 0.75rem; padding: 6px;">
                  Limpiar No validos
                </button>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }
      
      // Otras categorías (normales)
      return `
        <div class="sidebar-section flow-section ${!cat.enabled ? 'is-disabled' : ''}" style="--flow-color: ${cat.color};">
          <div class="sidebar-section-header" 
               onclick="${cat.enabled ? `app.toggleSection('${cat.id.toLowerCase()}')` : 'return false;'}">
            <span class="sidebar-category-icon" style="color: ${cat.color};">
              ${cat.icon}
            </span>
            <div style="display: flex; flex-direction: column; flex: 1;">
              <span class="sidebar-section-title">${cat.label}</span>
              ${!cat.enabled ? '<span class="sidebar-category-unavailable">(No Disponible)</span>' : ''}
            </div>
            <button class="sidebar-section-play ${isRunning ? 'is-running' : ''}"
                    onclick="event.stopPropagation(); app.toggleFlow('${cat.id}')"
                    ${!cat.enabled ? 'disabled' : ''}
                    title="${isRunning ? 'Detener' : 'Ejecutar'} ${cat.label}">
              <svg viewBox="0 0 24 24" width="14" height="14">
                ${isRunning ? '<path d="M7 7h10v10H7z" />' : '<path d="m8 5 11 7-11 7V5Z" />'}
              </svg>
            </button>
            <svg class="sidebar-collapse-arrow" id="${cat.id.toLowerCase()}-icon" viewBox="0 0 24 24">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>
          <div class="sidebar-section-content is-collapsed" id="${cat.id.toLowerCase()}-content">
            <div style="padding: 12px; color: var(--muted); font-size: 0.8rem; text-align: center;">
              Contenido de ${cat.label}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async startRegister() {
    if (this.selectedDeviceIds.size === 0) {
      alert('Selecciona al menos un dispositivo');
      return;
    }

    if (!this.pythonConnected) {
      alert('Servidor Python no conectado');
      return;
    }

    const totalAccounts = this.registerAccounts.total.split('\n').filter(l => l.trim()).length;
    const countPerDevice = this.registerCountPerDevice;
    const selectedCount = this.selectedDeviceIds.size;
    const requiredAccounts = selectedCount * countPerDevice;

    if (totalAccounts < requiredAccounts) {
      alert(`Necesitas al menos ${requiredAccounts} cuentas en Total (${countPerDevice} por dispositivo x ${selectedCount} dispositivos).\nActualmente tienes ${totalAccounts} cuentas.`);
      return;
    }

    console.log(`[REGISTER] Iniciando FlowRegister: ${countPerDevice} cuentas por dispositivo en ${selectedCount} dispositivos`);

    try {
      const selectedSerials = Array.from(this.selectedDeviceIds);
      
      const response = await fetch(`${PYTHON_API}/autojs/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceIds: selectedSerials,
          filePath: '/sdcard/Download/Register.js',
          countPerDevice: countPerDevice
        })
      });

      if (!response.ok) throw new Error('Error iniciando FlowRegister');

      this.setRunningFlow('FlowRegister');
      
      console.log(`✅ FlowRegister iniciado correctamente`);
      alert(`FlowRegister iniciado: ${countPerDevice} cuentas por dispositivo en ${selectedCount} dispositivos`);
    } catch (error) {
      console.error(`[ERROR] Error iniciando FlowRegister:`, error);
      alert(`Error iniciando FlowRegister: ${error.message}`);
    }
  }

  // FlowRegister Account Management
  switchRegisterTab(tab) {
    this.activeRegisterTab = tab;
    const textarea = document.getElementById('accountsTextarea');
    if (textarea) {
      textarea.value = this.registerAccounts[tab];
    }
    
    // Update tab styles and re-render to show/hide clear button
    document.querySelectorAll('.account-tab-sidebar[data-tab]').forEach(btn => {
      if (btn.closest('#flowregister-content')) {
        btn.classList.toggle('is-active', btn.dataset.tab === tab);
      }
    });
    
    // Re-render FlowRegister section to update buttons
    this.renderUI();
  }

  onRegisterAccountsChange() {
    const textarea = document.getElementById('accountsTextarea');
    if (textarea) {
      this.registerAccounts[this.activeRegisterTab] = textarea.value;
      localStorage.setItem(`flowdashboard.register.${this.activeRegisterTab}`, textarea.value);
      this.updateRegisterAccountCounts();
    }
  }

  onRegisterCountChange(value) {
    this.registerCountPerDevice = Math.min(10, Math.max(1, parseInt(value) || 5));
    localStorage.setItem('flowdashboard.register.countPerDevice', this.registerCountPerDevice);
    document.getElementById('registerCountPerDevice').value = this.registerCountPerDevice;
  }

  updateRegisterAccountCounts() {
    const totalLines = this.registerAccounts.total.split('\n').filter(l => l.trim()).length;
    const validLines = this.registerAccounts.valid.split('\n').filter(l => l.trim()).length;
    const invalidLines = this.registerAccounts.invalid.split('\n').filter(l => l.trim()).length;

    const totalEl = document.getElementById('registerTotalCount');
    const validEl = document.getElementById('registerValidCount');
    const invalidEl = document.getElementById('registerInvalidCount');

    if (totalEl) totalEl.textContent = totalLines;
    if (validEl) validEl.textContent = validLines;
    if (invalidEl) invalidEl.textContent = invalidLines;
  }

  clearRegisterInvalid() {
    if (confirm('Eliminar todas las cuentas no validas de FlowRegister?')) {
      this.registerAccounts.invalid = '';
      localStorage.setItem('flowdashboard.register.invalid', '');
      const textarea = document.getElementById('accountsTextarea');
      if (textarea && this.activeRegisterTab === 'invalid') {
        textarea.value = '';
      }
      this.updateRegisterAccountCounts();
      console.log('[DELETE] Cuentas no validas de FlowRegister eliminadas');
    }
  }

  toggleFlowLoginSection() {
    this.toggleSection('flowlogin');
  }

  toggleSection(sectionId) {
    const content = document.getElementById(`${sectionId}-content`);
    const icon = document.getElementById(`${sectionId}-icon`);
    
    if (!content || !icon) return;
    
    const isCollapsed = content.classList.contains('is-collapsed');
    
    if (isCollapsed) {
      content.classList.remove('is-collapsed');
      icon.style.transform = 'rotate(0deg)';
    } else {
      content.classList.add('is-collapsed');
      icon.style.transform = 'rotate(-90deg)';
    }
    
    console.log(`📂 Sección ${sectionId} ${isCollapsed ? 'expandida' : 'colapsada'}`);
  }

  // Context Menu Functions
  openContextMenu(event, serial) {
    event.preventDefault();
    event.stopPropagation();
    
    const menu = document.getElementById('deviceContextMenu');
    if (!menu) return;

    // Determine target devices (selected or single)
    const targetSerials = this.selectedDeviceIds.has(serial) && this.selectedDeviceIds.size > 1
      ? Array.from(this.selectedDeviceIds)
      : [serial];

    this.contextMenuDevice = serial;
    this.contextMenuDevices = targetSerials;

    // Check device states
    const targetDevices = targetSerials.map(s => this.devices.find(d => d.serial === s)).filter(Boolean);
    const hasPending = targetDevices.some(d => this.hasPendingAccounts(d.serial));
    const hasAccounts = targetDevices.some(d => ((this.deviceAccounts[d.serial]) || {}).accounts?.length > 0);
    const anyRunning = targetSerials.some(s => this.isDeviceRunning(s));

    // Update button states
    const btnExecute = document.getElementById('contextExecutePending');
    const btnStop = document.getElementById('contextStopLogin');
    const btnInstall = document.getElementById('contextInstallFlowAgent');
    const btnRetry = document.getElementById('contextRetryAccounts');
    const btnReplace = document.getElementById('contextReplaceAccounts');
    const btnAdd = document.getElementById('contextAddAccounts');
    const btnClear = document.getElementById('contextClearAccounts');

    if (btnExecute) {
      btnExecute.disabled = !hasPending || anyRunning;
      btnExecute.title = targetSerials.length > 1 
        ? `Ejecutar pendientes en ${targetSerials.length} dispositivos` 
        : 'Ejecutar cuentas pendientes';
    }

    if (btnStop) {
      btnStop.disabled = !anyRunning;
      btnStop.title = targetSerials.length > 1 
        ? `Detener FlowLogin en ${targetSerials.length} dispositivos` 
        : 'Detener FlowLogin';
    }

    if (btnInstall) {
      btnInstall.disabled = anyRunning;
      btnInstall.title = targetSerials.length > 1
        ? `Verificar, instalar y conectar FlowAgent en ${targetSerials.length} dispositivos`
        : 'Verificar, instalar y conectar FlowAgent';
    }

    if (btnRetry) {
      btnRetry.disabled = !hasAccounts || anyRunning;
      btnRetry.title = targetSerials.length > 1 
        ? `Reintentar cuentas en ${targetSerials.length} dispositivos` 
        : 'Reintentar todas las cuentas';
    }

    if (btnReplace) {
      btnReplace.disabled = !hasAccounts || anyRunning;
      btnReplace.title = targetSerials.length > 1 
        ? `Reemplazar cuentas error/review en ${targetSerials.length} dispositivos` 
        : 'Reemplazar cuentas rojas/moradas';
    }

    if (btnAdd) {
      btnAdd.disabled = anyRunning;
      btnAdd.title = targetSerials.length > 1 
        ? `Anadir cuentas a ${targetSerials.length} dispositivos` 
        : 'Anadir cuentas (max 10 total)';
    }

    if (btnClear) {
      btnClear.disabled = !hasAccounts || anyRunning;
      btnClear.title = targetSerials.length > 1 
        ? `Eliminar cuentas de ${targetSerials.length} dispositivos` 
        : 'Eliminar todas las cuentas';
    }

    // Position menu
    menu.classList.add('is-open');
    const rect = menu.getBoundingClientRect();
    const left = Math.min(Math.max(8, event.clientX), window.innerWidth - rect.width - 8);
    const top = Math.min(Math.max(8, event.clientY), window.innerHeight - rect.height - 8);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    console.log(`📋 Context menu abierto para ${targetSerials.length} dispositivo(s)`);
  }

  closeContextMenu() {
    const menu = document.getElementById('deviceContextMenu');
    const addPanel = document.getElementById('contextAddPanel');
    
    if (menu) menu.classList.remove('is-open');
    if (addPanel) addPanel.classList.remove('is-open');
    
    this.contextMenuDevice = null;
    this.contextMenuDevices = [];
  }

  // ─── Bolitas: Reintentar y Reemplazar ────────────────────────────────────────
  async retryAccount(serial, cloneIndex) {
    try {
      const stableId = this.getDeviceStableId(serial);
      const agent = await this.getAgentForDevice(serial);
      if (!agent) { alert('Dispositivo no conectado'); return; }
      
      const response = await fetch(`${PYTHON_API}/flowlogin/retry-clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.agentId, clone: cloneIndex })
      });
      if (response.ok) {
        console.log(`Reintentando clone ${cloneIndex} en ${serial}`);
      }
    } catch (e) {
      console.error('Error reintentando cuenta:', e);
    }
  }

  async replaceAccount(serial, cloneIndex) {
    // Abrir modal para seleccionar cuenta de reemplazo
    const stableId = this.getDeviceStableId(serial);
    const accounts = ((this.deviceAccounts[stableId] || this.deviceAccounts[serial]) || {}).accounts || [];
    const currentAccount = accounts[cloneIndex - 1] || '';
    
    // Usar el editor de cuentas del dispositivo como selector
    const newAccount = prompt(`Reemplazar cuenta ${cloneIndex}:\nActual: ${currentAccount}\n\nNueva cuenta (email:password):`);
    if (!newAccount || !newAccount.trim()) return;
    
    // Actualizar la cuenta en el dispositivo
    const updatedAccounts = [...accounts];
    updatedAccounts[cloneIndex - 1] = newAccount.trim();
    
    try {
      await fetch(`${PYTHON_API}/device-accounts/${encodeURIComponent(stableId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: updatedAccounts })
      });
      
      // Actualizar localmente
      if (!this.deviceAccounts[stableId]) this.deviceAccounts[stableId] = { accounts: [] };
      this.deviceAccounts[stableId].accounts = updatedAccounts;
      this.updateStatusDots();
      console.log(`Cuenta ${cloneIndex} reemplazada en ${serial}`);
    } catch (e) {
      console.error('Error reemplazando cuenta:', e);
    }
  }

  async getAgentForDevice(serial) {
    try {
      const response = await fetch(`${PYTHON_API}/agents`);
      const data = await response.json();
      const stableId = this.getDeviceStableId(serial);
      return data.agents.find(a => 
        a.agentId === stableId || 
        a.meta.serial === serial || 
        a.meta.serial === stableId
      ) || null;
    } catch { return null; }
  }

  hasPendingAccounts(serial) {
    const statuses = this.getDeviceStatuses(serial);
    return statuses.some(s => s.status === 'pending');
  }

  isDeviceRunning(serial) {
    const statuses = this.getDeviceStatuses(serial);
    return statuses.some(s => s.status === 'running' || s.status === 'retrying' || s.status === 'waiting_mail');
  }

  async contextInstallFlowAgent() {
    const targetSerials = [...this.contextMenuDevices];
    this.closeContextMenu();

    if (!this.pythonConnected) {
      alert('Servidor Python no conectado');
      return;
    }
    if (targetSerials.length === 0) return;

    const label = targetSerials.length > 1
      ? `${targetSerials.length} dispositivos`
      : targetSerials[0];
    console.log(`[FLOWAGENT] Verificando/instalando FlowAgent APK en ${label}`);

    try {
      const response = await fetch(`${PYTHON_API}/flowagent/setup-smart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceIds: targetSerials,
          requestCapture: false,
          forceRelaunch: true
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Error HTTP ${response.status}`);
      }

      const result = data.result || {};
      const devices = Array.isArray(result.devices) ? result.devices : [];
      const installed = devices.filter(d => d.didInstall).length;
      const alreadyLatest = devices.filter(d => d.alreadyLatest && !d.didInstall).length;
      const connected = devices.filter(d => d.socketReady).length;
      const withErrors = devices.filter(d => Array.isArray(d.errors) && d.errors.length).length;
      const errorLines = devices
        .filter(d => Array.isArray(d.errors) && d.errors.length)
        .slice(0, 5)
        .map(d => `${d.serial}: ${d.errors[0]}`);

      await this.loadDevices();
      await this.checkConnections();

      const lines = [
        `FlowAgent APK verificado en ${devices.length || targetSerials.length} dispositivo(s).`,
        `Ya estaba correcto: ${alreadyLatest}`,
        `Instalado/actualizado: ${installed}`,
        `Socket conectado: ${connected}`,
        'Captura/OCR: no solicitada',
      ];
      if (withErrors) {
        lines.push(`Con avisos/errores: ${withErrors}`);
        lines.push(...errorLines);
      } else {
        lines.push('Todo quedo correctamente conectado y listo.');
      }
      alert(lines.join('\n'));
    } catch (error) {
      console.error('[ERROR] Error instalando FlowAgent APK:', error);
      alert(`Error instalando FlowAgent APK: ${error.message}`);
    }
  }

  async contextExecutePending() {
    this.closeContextMenu();
    
    if (!this.pythonConnected) {
      alert('Servidor Python no conectado');
      return;
    }

    const targetSerials = this.contextMenuDevices;
    if (targetSerials.length === 0) return;

    console.log(`▶ Ejecutando pendientes en ${targetSerials.length} dispositivo(s)`);

    try {
      const response = await fetch(`${PYTHON_API}/autojs/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceIds: targetSerials,
          filePath: '/sdcard/Download/Login.js',
          delimiter: this.delimiter,
          mode: 'pending-only'
        })
      });

      if (!response.ok) throw new Error('Error ejecutando pendientes');

      this.setRunningFlow('FlowLogin');

      console.log(`✅ Pendientes ejecutados en ${targetSerials.length} dispositivo(s)`);
    } catch (error) {
      console.error('[ERROR] Error ejecutando pendientes:', error);
      alert(`Error: ${error.message}`);
    }
  }

  async contextStopLogin() {
    this.closeContextMenu();
    
    const targetSerials = this.contextMenuDevices;
    if (targetSerials.length === 0) return;

    console.log(`[STOP] Deteniendo FlowLogin en ${targetSerials.length} dispositivo(s)`);

    try {
      const response = await fetch(`${PYTHON_API}/autojs/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceIds: targetSerials,
          filePath: '/sdcard/Download/Login.js'
        })
      });

      if (!response.ok) throw new Error('Error deteniendo FlowLogin');

      await this.loadDevices();
      await this.loadLoginStatuses();
      this.renderDevices();
      this.setRunningFlow(null);

      console.log(`✅ FlowLogin detenido en ${targetSerials.length} dispositivo(s)`);
    } catch (error) {
      console.error('[ERROR] Error deteniendo FlowLogin:', error);
      alert(`Error: ${error.message}`);
    }
  }

  async contextRetryAccounts() {
    this.closeContextMenu();
    
    if (!this.pythonConnected) {
      alert('Servidor Python no conectado');
      return;
    }

    const targetSerials = this.contextMenuDevices;
    if (targetSerials.length === 0) return;

    console.log(`🔄 Reintentando cuentas en ${targetSerials.length} dispositivo(s)`);

    try {
      const response = await fetch(`${PYTHON_API}/autojs/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceIds: targetSerials,
          filePath: '/sdcard/Download/Login.js',
          delimiter: this.delimiter,
          mode: 'retry-all'
        })
      });

      if (!response.ok) throw new Error('Error reintentando cuentas');

      console.log(`✅ Cuentas reintentadas en ${targetSerials.length} dispositivo(s)`);
    } catch (error) {
      console.error('[ERROR] Error reintentando cuentas:', error);
      alert(`Error: ${error.message}`);
    }
  }

  async contextReplaceAccounts() {
    this.closeContextMenu();
    
    if (!this.pythonConnected) {
      alert('Servidor Python no conectado');
      return;
    }

    const targetSerials = this.contextMenuDevices;
    if (targetSerials.length === 0) return;

    // Count replaceable accounts (error + review states)
    let replaceableCount = 0;
    targetSerials.forEach(serial => {
      const statuses = this.getDeviceStatuses(serial);
      replaceableCount += statuses.filter(s => s.status === 'error' || s.status === 'review').length;
    });

    if (replaceableCount === 0) {
      alert('No hay cuentas rojas/moradas para reemplazar');
      return;
    }

    // Check if we have enough accounts in FlowLogin Total
    const availableAccounts = this.accounts.total.split('\n').filter(l => l.trim()).length;
    if (availableAccounts < replaceableCount) {
      alert(`Necesitas al menos ${replaceableCount} cuentas en FlowLogin Total para reemplazar.\nActualmente tienes ${availableAccounts} cuentas.`);
      return;
    }

    if (!confirm(`Reemplazar ${replaceableCount} cuenta(s) roja(s)/morada(s) con nuevas cuentas de FlowLogin Total?`)) {
      return;
    }

    console.log(`[REPLACE] Reemplazando ${replaceableCount} cuenta(s) en ${targetSerials.length} dispositivo(s)`);

    try {
      const response = await fetch(`${PYTHON_API}/replace-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceIds: targetSerials,
          sourceAccounts: this.accounts.total
        })
      });

      if (!response.ok) throw new Error('Error reemplazando cuentas');

      console.log(`✅ ${replaceableCount} cuenta(s) reemplazada(s)`);
      alert(`✅ ${replaceableCount} cuenta(s) reemplazada(s) correctamente`);
      
      // Reload devices
      await this.loadDevices();
    } catch (error) {
      console.error('[ERROR] Error reemplazando cuentas:', error);
      alert(`Error: ${error.message}`);
    }
  }

  showAddAccountsPanel() {
    const addPanel = document.getElementById('contextAddPanel');
    const addBtn = document.getElementById('contextAddAccounts');
    
    if (addPanel && addBtn) {
      addPanel.classList.add('is-open');
      addBtn.style.display = 'none';
      
      // Set max based on current accounts
      const targetSerials = this.contextMenuDevices;
      let maxPerDevice = 10;
      targetSerials.forEach(serial => {
        const currentCount = ((this.deviceAccounts[serial]) || {}).accounts?.length || 0;
        const capacity = 10 - currentCount;
        maxPerDevice = Math.min(maxPerDevice, capacity);
      });
      
      const input = document.getElementById('contextAddCount');
      if (input) {
        input.max = Math.max(1, maxPerDevice);
        input.value = Math.min(1, maxPerDevice);
      }
    }
  }

  async confirmAddAccounts() {
    const input = document.getElementById('contextAddCount');
    const count = parseInt(input.value || '1');
    
    if (count < 1 || count > 10) {
      alert('La cantidad debe estar entre 1 y 10');
      return;
    }

    this.closeContextMenu();
    
    if (!this.pythonConnected) {
      alert('Servidor Python no conectado');
      return;
    }

    const targetSerials = this.contextMenuDevices;
    if (targetSerials.length === 0) return;

    // Check capacity
    let hasCapacity = true;
    targetSerials.forEach(serial => {
      const currentCount = ((this.deviceAccounts[serial]) || {}).accounts?.length || 0;
      if (currentCount + count > 10) {
        hasCapacity = false;
      }
    });

    if (!hasCapacity) {
      alert('Uno o mas dispositivos no tienen capacidad para anadir esas cuentas (max 10 total)');
      return;
    }

    // Check if we have enough accounts
    const requiredAccounts = targetSerials.length * count;
    const availableAccounts = this.accounts.total.split('\n').filter(l => l.trim()).length;
    
    if (availableAccounts < requiredAccounts) {
      alert(`Necesitas al menos ${requiredAccounts} cuentas en FlowLogin Total.\nActualmente tienes ${availableAccounts} cuentas.`);
      return;
    }

    console.log(`➕ Añadiendo ${count} cuenta(s) a ${targetSerials.length} dispositivo(s)`);

    try {
      const accounts = this.accounts.total.split('\n').filter(l => l.trim());
      let accountIndex = 0;

      for (const serial of targetSerials) {
        const currentAccounts = ((this.deviceAccounts[serial]) || {}).accounts || [];
        const newAccounts = accounts.slice(accountIndex, accountIndex + count);
        accountIndex += count;

        if (newAccounts.length === 0) break;

        const allAccounts = [...currentAccounts, ...newAccounts];

        const response = await fetch(`${PYTHON_API}/device-person`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serial,
            person: allAccounts.join('\n')
          })
        });

        if (!response.ok) throw new Error(`Error añadiendo cuentas a ${serial}`);
      }

      console.log(`✅ ${count} cuenta(s) añadida(s) a ${targetSerials.length} dispositivo(s)`);
      alert(`✅ ${count} cuenta(s) añadida(s) correctamente`);
      
      // Reload devices
      await this.loadDevices();
    } catch (error) {
      console.error('[ERROR] Error añadiendo cuentas:', error);
      alert(`Error: ${error.message}`);
    }
  }

  cancelAddAccounts() {
    const addPanel = document.getElementById('contextAddPanel');
    const addBtn = document.getElementById('contextAddAccounts');
    
    if (addPanel) addPanel.classList.remove('is-open');
    if (addBtn) addBtn.style.display = '';
  }

  async contextClearAccounts() {
    const targetSerials = this.contextMenuDevices;
    if (targetSerials.length === 0) return;

    const message = targetSerials.length > 1
      ? `Eliminar todas las cuentas de ${targetSerials.length} dispositivos`
      : 'Eliminar todas las cuentas de este dispositivo';

    if (!confirm(message)) {
      this.closeContextMenu();
      return;
    }

    this.closeContextMenu();

    console.log(`[DELETE] Eliminando cuentas de ${targetSerials.length} dispositivo(s)`);

    try {
      for (const serial of targetSerials) {
        const response = await fetch(`${PYTHON_API}/device-person`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serial,
            person: ''
          })
        });

        if (!response.ok) throw new Error(`Error eliminando cuentas de ${serial}`);
      }

      console.log(`✅ Cuentas eliminadas de ${targetSerials.length} dispositivo(s)`);
      alert(`✅ Cuentas eliminadas correctamente`);
      
      // Reload devices
      await this.loadDevices();
    } catch (error) {
      console.error('[ERROR] Error eliminando cuentas:', error);
      alert(`Error: ${error.message}`);
    }
  }

  setupModalListeners() {
    // Re-attach event listeners para los modales después de renderModalsToOverlay()
    
    const accountModal = document.getElementById('accountEditorModal');
    if (accountModal) {
      accountModal.addEventListener('click', event => {
        if (event.target === accountModal) {
          this.closeDeviceAccountEditor();
        }
      });
    }

    const categoryModal = document.getElementById('categoryEditorModal');
    const categoryInput = document.getElementById('categoryEditorInput');
    if (categoryModal) {
      categoryModal.addEventListener('click', event => {
        if (event.target === categoryModal) {
          this.closeCategoryEditor();
        }
      });
    }
    if (categoryInput) {
      categoryInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') this.saveCategoryEditor();
        if (event.key === 'Escape') this.closeCategoryEditor();
      });
    }

    const perfModal = document.getElementById('performancePanelModal');
    if (perfModal) {
      perfModal.addEventListener('click', event => {
        if (event.target === perfModal) {
          this.closePerformancePanel();
        }
      });
    }

    const plansModal = document.getElementById('plansModal');
    if (plansModal) {
      plansModal.addEventListener('click', event => {
        if (event.target === plansModal) {
          this.closePlansModal();
        }
      });
    }

    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
      helpModal.addEventListener('click', event => {
        if (event.target === helpModal) {
          this.closeHelpModal();
        }
      });
    }

    // Setup context menu button listeners
    const btnExecute = document.getElementById('contextExecutePending');
    const btnStop = document.getElementById('contextStopLogin');
    const btnInstall = document.getElementById('contextInstallFlowAgent');
    const btnRetry = document.getElementById('contextRetryAccounts');
    const btnReplace = document.getElementById('contextReplaceAccounts');
    const btnAdd = document.getElementById('contextAddAccounts');
    const btnClear = document.getElementById('contextClearAccounts');

    if (btnExecute) btnExecute.addEventListener('click', () => this.contextExecutePending());
    if (btnStop) btnStop.addEventListener('click', () => this.contextStopLogin());
    if (btnInstall) btnInstall.addEventListener('click', () => this.contextInstallFlowAgent());
    if (btnRetry) btnRetry.addEventListener('click', () => this.contextRetryAccounts());
    if (btnReplace) btnReplace.addEventListener('click', () => this.contextReplaceAccounts());
    if (btnAdd) btnAdd.addEventListener('click', () => this.showAddAccountsPanel());
    if (btnClear) btnClear.addEventListener('click', () => this.contextClearAccounts());
  }

  setupGlobalListeners() {
    // Close context menu on click outside
    document.addEventListener('click', (event) => {
      const menu = document.getElementById('deviceContextMenu');
      if (menu && menu.classList.contains('is-open')) {
        if (!menu.contains(event.target)) {
          this.closeContextMenu();
        }
      }
    });

    // Ctrl+Scroll para zoom de dispositivos
    document.addEventListener('wheel', (event) => {
      if (event.ctrlKey) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? -10 : 10;
        const newZoom = Math.max(60, Math.min(500, this.deviceZoom + delta));
        this.setDeviceZoom(newZoom);
        // Actualizar el slider visualmente
        const slider = document.getElementById('deviceZoomSlider');
        if (slider) slider.value = newZoom;
      }
    }, { passive: false });

    const mainArea = document.querySelector('.main-area');
    if (mainArea) {
      mainArea.addEventListener('scroll', () => {
        if (typeof this.scheduleLivePreviewSync === 'function') this.scheduleLivePreviewSync(false);
      }, { passive: true });
    }
    
    // Con canvas WebP, no necesitamos sincronizar en scroll
    // Los frames se renderizan automáticamente en el canvas
    
    window.addEventListener('resize', () => this.scheduleLivePreviewSync(true));
    window.addEventListener('beforeunload', () => this.stopLivePreviewStreams());
  }
}

FlowDashboardApp.prototype.loadFlowMailStatus = async function() {
  try {
    const response = await fetchWithTimeout(`${CSHARP_API}/mail/status`, { method: 'GET' }, 5000);
    if (!response.ok) return;
    const data = await response.json();
    this.flowMailStatus = {
      configured: !!data.configured,
      connected: !!data.connected,
      status: data.status || 'not_configured',
      email: data.email || this.flowMailStatus.email || '',
      message: data.message || ''
    };
    if (this.flowMailStatus.email) {
      localStorage.setItem('flowdashboard.flowmail.email', this.flowMailStatus.email);
    }
    this.updateFlowMailUi();
  } catch (error) {
    this.flowMailStatus = {
      ...this.flowMailStatus,
      connected: false,
      status: 'offline',
      message: 'Mail no disponible'
    };
    this.updateFlowMailUi();
  }
};

FlowDashboardApp.prototype.connectFlowMail = async function() {
  const emailInput = document.getElementById('flowMailEmail');
  const passwordInput = document.getElementById('flowMailPassword');
  const button = document.getElementById('flowMailConnectBtn');
  const email = (emailInput?.value || '').trim();
  const appPassword = (passwordInput?.value || '').trim();
  if (!email) {
    this.setFlowMailUiStatus('Email requerido', 'error');
    return;
  }
  if (!appPassword && !this.flowMailStatus.configured) {
    this.setFlowMailUiStatus('Contraseña app requerida', 'error');
    return;
  }
  try {
    if (button) button.disabled = true;
    this.setFlowMailUiStatus('Conectando...', 'running');
    const response = await fetchWithTimeout(`${CSHARP_API}/mail/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, appPassword })
    }, 20000);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status === 'error') {
      throw new Error(data.message || 'No se pudo conectar FlowMail');
    }
    this.flowMailStatus = {
      configured: !!data.configured,
      connected: !!data.connected,
      status: data.status || 'connected',
      email: data.email || email,
      message: data.message || 'Conectado'
    };
    localStorage.setItem('flowdashboard.flowmail.email', this.flowMailStatus.email);
    if (passwordInput) passwordInput.value = '';
    this.updateFlowMailUi();
  } catch (error) {
    this.setFlowMailUiStatus(error.message || 'Error FlowMail', 'error');
  } finally {
    if (button) button.disabled = false;
  }
};

FlowDashboardApp.prototype.setFlowMailUiStatus = function(message, tone = '') {
  this.flowMailStatus = { ...this.flowMailStatus, message, status: tone || this.flowMailStatus.status };
  this.updateFlowMailUi();
};

FlowDashboardApp.prototype.updateFlowMailUi = function() {
  const emailInput = document.getElementById('flowMailEmail');
  const status = document.getElementById('flowMailStatus');
  const button = document.getElementById('flowMailConnectBtn');
  if (emailInput && this.flowMailStatus.email && !emailInput.value) {
    emailInput.value = this.flowMailStatus.email;
  }
  if (status) {
    const connected = !!this.flowMailStatus.connected || this.flowMailStatus.status === 'connected';
    status.textContent = connected ? 'Conectado' : (this.flowMailStatus.message || 'Mail no configurado.');
    status.className = `flowmail-status ${connected ? 'is-connected' : (this.flowMailStatus.status === 'error' ? 'is-error' : '')}`;
  }
  if (button) {
    button.textContent = (this.flowMailStatus.connected || this.flowMailStatus.status === 'connected') ? 'Reconectar' : 'Conectar';
  }
};

// Initialize app
const app = new FlowDashboardApp();
window.app = app;

// ─── Sistema de Licencias ─────────────────────────────────────────────────────
const LICENSE_KEY = 'flowdashboard.license';

// Espera a que haya al menos 1 device conectado (con timeout) y devuelve su MAC.
// Si no hay dispositivos conectados al timeout, devuelve cadena vacía y el flujo
// sigue: el modal de licencia se mostrará con un aviso para que el usuario conecte
// un device Android antes de validar.
async function getFirstKnownAndroidIdentity() {

  const devices = (window.app && Array.isArray(window.app.devices)) ? window.app.devices : [];

  const first = devices.find(d => d && d.serial && !d.offline && d.state !== 'offline');

  if (!first) return { mac: '', serial: '' };

  const serial = first.activeSerial || first.serial || '';

  const mac = first.macAddress || first.mac || '';

  if (mac || !serial) return { mac, serial };

  try {

    const macResp = await fetch(`${PYTHON_API}/device-mac`, {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ serial }),

    });

    const macData = await macResp.json().catch(() => ({}));

    return { mac: macData.macAddress || '', serial };

  } catch {

    return { mac: '', serial };

  }

}

async function waitForFirstDeviceMac(timeoutMs = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const known = await getFirstKnownAndroidIdentity();
      if (known.serial) return known;

      const r = await fetchWithTimeout(`${PYTHON_API}/devices`, {}, 4000);
      const data = await r.json().catch(() => ({}));
      const devices = Array.isArray(data.devices) ? data.devices : [];
      const first = devices.find(d => d.serial);
      if (first) {
        // Si la lista ya trae MAC, usarla; si no, pedirla al backend.
        if (first.macAddress) return { mac: first.macAddress, serial: first.serial };
        try {
          const macResp = await fetch(`${PYTHON_API}/device-mac`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serial: first.serial }),
          });
          const macData = await macResp.json().catch(() => ({}));
          return { mac: macData.macAddress || '', serial: first.serial };
        } catch {
          return { mac: '', serial: first.serial };
        }
      }
    } catch { /* backend Python aun no responde, reintentar */ }
    await new Promise(res => setTimeout(res, 500));
  }
  return { mac: '', serial: '' };
}

async function loadSavedLicense() {
  try {
    if (window.electronAPI.readJsonFile) {
      const r = await window.electronAPI.readJsonFile('license.json');
      if (r.ok && r.data) return r.data;
    }
    return JSON.parse(localStorage.getItem(LICENSE_KEY) || 'null');
  } catch { return null; }
}

async function saveLicense(email, key) {
  const data = { email, key };
  localStorage.setItem(LICENSE_KEY, JSON.stringify(data));
  if (window.electronAPI.writeJsonFile) {
    await window.electronAPI.writeJsonFile('license.json', data);
  }
}

async function clearLicense() {
  localStorage.removeItem(LICENSE_KEY);
  if (window.electronAPI.writeJsonFile) {
    await window.electronAPI.writeJsonFile('license.json', null);
  }
}

function showLicenseModal() {
  let modal = document.getElementById('licenseModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'licenseModal';
    modal.className = 'account-editor-modal license-modal is-open';
    modal.setAttribute('aria-hidden', 'false');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="account-editor-card license-modal-card">
        <div class="account-editor-header license-modal-header">
          <div class="license-modal-brand">
            <div class="license-modal-logo" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div>
              <p class="account-editor-title">FlowDashboard</p>
              <p class="account-editor-subtitle">Activa tu licencia para empezar</p>
            </div>
          </div>
        </div>
        <div class="license-modal-content">
          <div class="license-modal-field">
            <label for="licenseEmail">Email</label>
            <input id="licenseEmail" type="email" autocomplete="email" placeholder="usuario@ejemplo.com">
          </div>
          <div class="license-modal-field">
            <label for="licenseKeyInput">Clave de licencia</label>
            <input id="licenseKeyInput" type="text" spellcheck="false" autocomplete="off" placeholder="FLOW-2026-XXXX-XXXX">
          </div>

          <div class="license-modal-device" id="licenseDevicePill" aria-live="polite">
            <span class="license-device-dot" aria-hidden="true"></span>
            <span class="license-device-text">Detectando dispositivo Android...</span>
          </div>

          <div id="licenseMsg" class="license-modal-msg" role="status" hidden></div>

          <button id="licenseSubmit" class="license-modal-submit" onclick="validateLicense()">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 12l5 5L20 7"/>
            </svg>
            <span>Validar licencia</span>
          </button>

          <div class="license-modal-foot">
            <span>¿Necesitas ayuda</span>
            <a href="mailto:ing.estebandaza@gmail.com">ing.estebandaza@gmail.com</a>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    // Submit con Enter desde cualquier input.
    const onKey = (e) => { if (e.key === 'Enter') validateLicense(); };
    modal.querySelector('#licenseEmail').addEventListener('keydown', onKey);
    modal.querySelector('#licenseKeyInput').addEventListener('keydown', onKey);

    // Refresca el pill del device cada 3s mientras el modal este visible.
    if (!window.__licenseDevicePoll) {
      window.__licenseDevicePoll = setInterval(() => {
        const m = document.getElementById('licenseModal');
        if (!m || m.style.display === 'none') return;
        refreshLicenseDevicePill();
      }, 3000);
    }
  }
  modal.style.display = 'flex';
  modal.classList.add('is-open');
  // Foco inicial en el primer campo vacio.
  setTimeout(() => {
    const emailEl = document.getElementById('licenseEmail');
    const keyEl = document.getElementById('licenseKeyInput');
    if (emailEl && !emailEl.value) emailEl.focus();
    else if (keyEl) keyEl.focus();
  }, 50);
  refreshLicenseDevicePill();
}

// Actualiza el indicador de dispositivo Android detectado en el modal.
async function refreshLicenseDevicePill() {
  const pill = document.getElementById('licenseDevicePill');
  if (!pill) return;
  const dot = pill.querySelector('.license-device-dot');
  const txt = pill.querySelector('.license-device-text');
  try {
    const r = await fetchWithTimeout(`${PYTHON_API}/devices`, {}, 4000);
    const data = await r.json().catch(() => ({}));
    const devices = Array.isArray(data.devices) ? data.devices : [];
    if (devices.length) {
      const first = devices[0];
      pill.classList.remove('is-warn');
      pill.classList.add('is-ready');
      const short = String(first.serial || '').replace(/:5555$/, '');
      txt.textContent = `Dispositivo detectado: ${short}${devices.length > 1 ? ` (+${devices.length - 1} mas)` : ''}`;
    } else {
      pill.classList.remove('is-ready');
      pill.classList.add('is-warn');
      txt.textContent = 'Conecta al menos un dispositivo Android antes de validar';
    }
  } catch {
    pill.classList.remove('is-ready');
    pill.classList.add('is-warn');
    txt.textContent = 'Servidor local desconectado. Reinicia abrir_electron.bat';
  }
}

function hideLicenseModal() {
  const modal = document.getElementById('licenseModal');
  if (modal) {
    modal.classList.remove('is-open');
    modal.style.display = 'none';
  }
}

async function validateLicense(opts = {}) {
  const emailEl = document.getElementById('licenseEmail');
  const keyEl = document.getElementById('licenseKeyInput');
  const email = (emailEl ? emailEl.value : '').trim();
  const key = (keyEl ? keyEl.value : '').trim();
  const msgEl = document.getElementById('licenseMsg');
  const btn = document.getElementById('licenseSubmit');

  const setMsg = (text, tone = 'error') => {
    if (!msgEl) return;
    msgEl.hidden = false;
    msgEl.textContent = text;
    msgEl.className = `license-modal-msg is-${tone}`;
  };

  if (!email || !key) {
    setMsg('Completa email y clave de licencia.', 'error');
    return;
  }
  if (btn) { btn.disabled = true; btn.classList.add('is-busy'); }

  try {
    // Identidad del device Android conectado: MAC + serial.
    // El backend usa la MAC como clave estable contra Supabase RPC.
    let deviceMac = String(opts.deviceMac || '').trim();
    let deviceSerial = String(opts.deviceSerial || '').trim();
    if (!deviceMac || !deviceSerial) {
      setMsg('Detectando dispositivo Android...', 'info');
      const detected = await waitForFirstDeviceMac(8000);
      deviceMac    = deviceMac    || detected.mac;
      deviceSerial = deviceSerial || detected.serial;
    }
    
    if (!deviceSerial) {
      setMsg('Sin dispositivos Android detectados. Puedes validar la licencia y continuar.', 'info');
      // NO HACE RETURN: permite continuar con la validacion de la identidad del PC.
    } else {
      setMsg('Dispositivo detectado. Validando licencia...', 'info');
    }

    const clientInfo = await fetch(`${PYTHON_API}/client-info`).then(r=>r.json()).catch(()=>({}));
    const response = await fetch(`${PYTHON_API}/validate-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_email: email,
        license_key: key,
        device_hostname: clientInfo.hostname || '',
        windows_user: clientInfo.windowsUser || '',
        device_hash: clientInfo.deviceHash || '',
        device_os: clientInfo.os || navigator.userAgent,
        ip_public: clientInfo.publicIp || '',
        local_ip: clientInfo.localIp || '',
        // MAC del device Android conectado (NO del PC). Es la clave estable.
        mac_address: deviceMac || clientInfo.macAddress || '',
        device_serial: deviceSerial,
      }),
    });
    const data = await response.json();

    if (data.device_status === 'approved' || data.status === 'ok') {
      await saveLicense(email, key);
      setMsg('✓ Licencia validada. Acceso concedido.', 'success');
      setTimeout(() => { hideLicenseModal(); checkForUpdates(); }, 900);
    } else if (data.device_status === 'pending') {
      setMsg('Pendiente de aprobación. Contacta al administrador.', 'warn');
    } else if (data.device_status === 'blocked' || data.device_status === 'revoked') {
      await clearLicense();
      setMsg(`Dispositivo bloqueado. ${data.message || ''}`, 'error');
    } else {
      await clearLicense();
      setMsg(data.message || data.error || 'Licencia inválida.', 'error');
    }
  } catch (e) {
    setMsg(`Error: ${e.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('is-busy'); }
  }
}

// Auto-validar licencia guardada al cargar.
// Espera a que haya al menos 1 device Android conectado para enviar la MAC,
// que es la clave estable que valida el backend contra Supabase.
(async () => {
  const saved = await loadSavedLicense();
  const isSavedValid = saved !== null && typeof saved === 'object';
  const savedEmail = isSavedValid ? String(saved.email || '').trim() : '';
  const savedKey = isSavedValid
    ? String(saved.key || saved.licenseKey || saved.license_key || '').trim()
    : '';
  if (!savedEmail || !savedKey) {
    console.warn('[License] No saved license found; skipping auto validation.');
    // Sin licencia guardada: mostrar el modal con la primera detección de device.
    showLicenseModal();
    // Pre-llenar el modal con la última MAC detectada cuando llegue el device.
    waitForFirstDeviceMac(15000).catch(() => null);
    return;
  }

  // Pre-llenar inputs por si el modal se abre.
  const emailEl = document.getElementById('licenseEmail');
  const keyEl = document.getElementById('licenseKeyInput');
  if (emailEl) emailEl.value = savedEmail;
  if (keyEl) keyEl.value = savedKey;

  // Esperar device + MAC como flujo preferente antes de caer a identidad del PC.
  // Si no hay, igual intenta validar silenciosamente con la MAC del PC.
  const detected = await waitForFirstDeviceMac(15000);
  if (!detected.serial) {
    console.warn('[License] No se detectó dispositivo Android, procediendo con la validación del PC.');
  }

  // Validar silenciosamente con la MAC del device detectado.
  try {
    const clientInfo = await fetch(`${PYTHON_API}/client-info`).then(r => r.json()).catch(() => ({}));
    const r = await fetch(`${PYTHON_API}/validate-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_email: savedEmail,
        license_key: savedKey,
        device_hostname: clientInfo.hostname || '',
        windows_user: clientInfo.windowsUser || '',
        device_hash: clientInfo.deviceHash || '',
        device_os: clientInfo.os || navigator.userAgent,
        ip_public: clientInfo.publicIp || '',
        local_ip: clientInfo.localIp || '',
        mac_address: detected.mac || clientInfo.macAddress || '',
        device_serial: detected.serial,
      }),
    });
    const d = await r.json();
    if (d.device_status !== 'approved' && d.status !== 'ok') {
      showLicenseModal();
    }
  } catch {
    // Sin conexion al backend: permitir uso offline (el modal sigue oculto).
  }
})();

// ─── Sistema de Actualizaciones ───────────────────────────────────────────────
function showUpdateModal(title, msg, progress = 20) {
  let modal = document.getElementById('updateModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'updateModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.75);z-index:99998;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;';
    modal.innerHTML = `
      <div style="background:#0d1117;border:1px solid rgba(69,202,255,.3);border-radius:12px;padding:28px;max-width:440px;width:90%;box-shadow:0 22px 80px rgba(0,0,0,.5);">
        <h2 id="updateTitle" style="margin:0 0 10px;color:#edf3fb;font-size:18px;"></h2>
        <p id="updateMsg" style="margin:0 0 16px;color:#9fb1c7;font-size:14px;"></p>
        <div style="height:6px;overflow:hidden;border-radius:999px;background:rgba(147,167,190,.15);">
          <div id="updateBar" style="height:100%;border-radius:inherit;background:linear-gradient(90deg,#45caff,#3ddc97);transition:width .35s ease;"></div>
        </div>
        <p style="margin:12px 0 0;color:#6f8198;font-size:12px;">No cierres el programa durante la actualización.</p>
      </div>`;
    document.body.appendChild(modal);
  }
  document.getElementById('updateTitle').textContent = title;
  document.getElementById('updateMsg').textContent = msg;
  document.getElementById('updateBar').style.width = `${Math.max(8, Math.min(100, progress))}%`;
  modal.style.display = 'flex';
}

function hideUpdateModal() {
  const m = document.getElementById('updateModal');
  if (m) m.style.display = 'none';
}

async function checkForUpdates() {
  try {
    showUpdateModal('Buscando actualizaciones', 'Revisando si hay una versión nueva disponible.', 20);
    await window.electronAPI?.checkForUpdates?.();
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const s = await window.electronAPI?.getUpdateStatus?.();
        if (!s) throw new Error('UpdateManager no disponible');
        if (s.state === 'downloading') showUpdateModal('Descargando actualización', s.message || 'Descargando...', 60);
        else if (s.state === 'installing') showUpdateModal('Instalando', s.message || 'Reiniciando...', 100);
        else if (s.state === 'no_update' || s.state === 'error' || attempts > 30) {
          clearInterval(poll);
          setTimeout(hideUpdateModal, s.state === 'error' ? 4000 : 800);
        }
      } catch { clearInterval(poll); hideUpdateModal(); }
    }, 1000);
  } catch { hideUpdateModal(); }
}

// ─── FlowAgent Setup ──────────────────────────────────────────────────────────
async function setupFlowAgentAll() {
  const devices = app.devices;
  if (!devices.length) { alert('No hay dispositivos conectados'); return; }

  const selected = app.selectedDeviceIds.size > 0
    ? [...app.selectedDeviceIds]
    : devices.map(d => d.serial);

  if (!confirm(`Preparar FlowAgent en ${selected.length} dispositivo(s)?\n\nEsto configura ADB reverse, actualiza solo si hace falta y abre FlowAgent para automatizacion. No solicita captura/OCR.`)) return;

  const btn = document.getElementById('setupFlowAgentBtn');
  const previousText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Preparando FlowAgent...</span>';
  }

  try {
    const r = await fetch(`${PYTHON_API}/flowagent/setup-smart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceIds: selected, requestCapture: false, forceRelaunch: true })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) {
      throw new Error(d.error || `Error HTTP ${r.status}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1800));
    const agents = await getConnectedAgents();
    const agentCount = agents.length;
    await app.loadDevices();
    alert(`FlowAgent preparado.\nAgentes conectados: ${agentCount}/${selected.length}\n\nCaptura/OCR no solicitada.`);
  } catch (error) {
    alert(`Error preparando FlowAgent: ${error.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = previousText;
    }
  }
}

async function getConnectedAgents() {
  try {
    const r = await fetch(`${PYTHON_API}/agents`);
    const d = await r.json();
    return d.agents || [];
  } catch { return []; }
}

// ─── IP Pública y País ────────────────────────────────────────────────────────
async function refreshDevicePublicIp(serial) {
  try {
    const r = await fetch(`${PYTHON_API}/device-public-ip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serial })
    });
    const d = await r.json();
    const info = d.info || d;
    if (info.ok || info.publicIp) {
      // Actualizar la tarjeta del dispositivo
      const card = document.querySelector(`[data-serial="${CSS.escape(serial)}"]`);
      if (card) {
        let ipBadge = card.querySelector('.device-public-ip');
        if (!ipBadge) {
          ipBadge = document.createElement('div');
          ipBadge.className = 'device-public-ip';
          ipBadge.style.cssText = 'font-size:10px;color:#8fa2b7;margin-top:2px;';
          card.querySelector('.device-info').appendChild(ipBadge);
        }
        const code = String(info.countryCode || '').toUpperCase();
        ipBadge.innerHTML = `<span class="device-flag ${code ? '' : 'is-empty'}">${code || '--'}</span> <span>${info.publicIp || ''}</span>`;
        ipBadge.title = info.countryName || code || 'IP publica';
      }
    }
  } catch (e) { console.error('Error obteniendo IP pública:', e); }
}

function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '';
  const offset = 127397;
  return String.fromCodePoint(...countryCode.toUpperCase().split('').map(c => c.charCodeAt(0) + offset));
}

async function refreshAllPublicIps() {
  const serials = app.selectedDeviceIds.size > 0
    ? [...app.selectedDeviceIds]
    : app.devices.map(d => d.serial);
  for (const serial of serials) {
    await refreshDevicePublicIp(serial);
    await new Promise(r => setTimeout(r, 300)); // throttle
  }
}

// ─── Utility functions ───────────────────────────────────────────────────────
const fetchWithTimeout = async (url, options = {}, timeoutMs = 4000) => {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
};

// ─── Persistencia local mejorada ─────────────────────────────────────────────
const LocalStorage = {
  async read(filename) {
    if (window.electronAPI.readJsonFile) {
      const r = await window.electronAPI.readJsonFile(filename);
      if (r.ok) return r.data;
    }
    try { return JSON.parse(localStorage.getItem(`file:${filename}`) || 'null'); } catch { return null; }
  },
  async write(filename, data) {
    if (window.electronAPI.writeJsonFile) {
      await window.electronAPI.writeJsonFile(filename, data);
    }
    localStorage.setItem(`file:${filename}`, JSON.stringify(data));
  }
};

// Exponer globalmente para uso desde HTML
function ensureElectronUpdateModal() {
  let modal = document.getElementById('updateModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'updateModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.75);z-index:99998;display:none;align-items:center;justify-content:center;font-family:Inter,sans-serif;';
    modal.innerHTML = `
      <div style="background:#0d1117;border:1px solid rgba(69,202,255,.3);border-radius:8px;padding:24px;max-width:480px;width:min(92vw,480px);box-shadow:0 22px 80px rgba(0,0,0,.5);">
        <h2 id="updateTitle" style="margin:0 0 8px;color:#edf3fb;font-size:18px;"></h2>
        <p id="updateMsg" style="margin:0 0 14px;color:#9fb1c7;font-size:14px;line-height:1.45;"></p>
        <div style="height:6px;overflow:hidden;border-radius:999px;background:rgba(147,167,190,.15);">
          <div id="updateBar" style="height:100%;border-radius:inherit;background:linear-gradient(90deg,#45caff,#3ddc97);transition:width .35s ease;"></div>
        </div>
        <pre id="updateNotes" style="display:none;max-height:150px;overflow:auto;margin:14px 0 0;padding:10px;border-radius:6px;background:rgba(15,23,42,.82);color:#b8c7dc;font:12px/1.4 Consolas,monospace;white-space:pre-wrap;"></pre>
        <div id="updateActions" style="display:none;gap:8px;justify-content:flex-end;margin-top:18px;">
          <button id="updateLaterBtn" type="button" style="border:1px solid rgba(148,163,184,.35);background:rgba(15,23,42,.8);color:#cbd5e1;border-radius:6px;padding:8px 12px;cursor:pointer;">Mas tarde</button>
          <button id="updateInstallBtn" type="button" style="border:0;background:#38d39f;color:#04111a;border-radius:6px;padding:8px 12px;font-weight:700;cursor:pointer;">Reiniciar ahora</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#updateLaterBtn').addEventListener('click', async () => {
      try { await window.electronAPI?.deferDownloadedUpdate?.(); } catch {}
      hideUpdateModal();
    });
    modal.querySelector('#updateInstallBtn').addEventListener('click', async () => {
      renderUpdateStatus({ state: 'installing', message: 'Preparando instalacion...', progress: 100 });
      await window.electronAPI?.installDownloadedUpdate?.();
    });
  }
  return modal;
}

function renderUpdateStatus(status = {}) {
  const state = status.state || 'idle';
  const modal = ensureElectronUpdateModal();
  const titles = {
    idle: 'FlowDashboard actualizado',
    checking: 'Buscando actualizaciones',
    available: 'Actualizacion disponible',
    downloading: 'Descargando actualizacion',
    downloaded: 'Actualizacion lista',
    deferred: 'Actualizacion pospuesta',
    installing: 'Instalando actualizacion',
    error: 'Actualizacion no disponible'
  };
  const progress = state === 'downloaded' || state === 'installing'
    ? 100
    : Math.max(8, Math.min(100, Number(status.progress || (state === 'checking' ? 20 : 0))));
  modal.querySelector('#updateTitle').textContent = titles[state] || titles.idle;
  modal.querySelector('#updateMsg').textContent = status.message || status.error || '';
  modal.querySelector('#updateBar').style.width = `${progress}%`;
  const notes = modal.querySelector('#updateNotes');
  const noteText = String(status.notes || '').trim();
  notes.textContent = noteText;
  notes.style.display = noteText ? 'block' : 'none';
  modal.querySelector('#updateActions').style.display = state === 'downloaded' ? 'flex' : 'none';
  if (state === 'idle' || state === 'deferred') {
    if (modal.style.display === 'flex') setTimeout(hideUpdateModal, 900);
    return;
  }
  modal.style.display = 'flex';
}

async function checkForUpdates() {
  try {
    if (!window.electronAPI?.checkForUpdates) return;
    renderUpdateStatus({ state: 'checking', message: 'Revisando GitHub Releases...', progress: 20 });
    const status = await window.electronAPI.checkForUpdates();
    renderUpdateStatus(status);
  } catch {
    renderUpdateStatus({ state: 'error', message: 'No se pudo consultar el actualizador Electron.', progress: 0 });
  }
}

if (window.electronAPI?.onUpdateStatus) {
  window.electronAPI.onUpdateStatus((status) => renderUpdateStatus(status));
  window.electronAPI.getUpdateStatus?.().then((status) => {
    if (status && status.state && status.state !== 'idle') renderUpdateStatus(status);
  }).catch(() => {});
}

window.validateLicense = validateLicense;
window.showLicenseModal = showLicenseModal;
window.checkForUpdates = checkForUpdates;
window.setupFlowAgentAll = setupFlowAgentAll;
window.refreshAllPublicIps = refreshAllPublicIps;
window.refreshDevicePublicIp = refreshDevicePublicIp;
window.LocalStorage = LocalStorage;


