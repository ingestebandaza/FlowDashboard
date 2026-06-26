/**
 * UI de Streaming - Versión Limpia y Funcional
 * 
 * Características:
 * - Botón "Streaming" en la barra de controles (donde están "Selección", "Vista", "Datos")
 * - Barra de controles STICKY (fija al desplazar)
 * - Botón toggle (☰) FIJO en esquina superior izquierda
 * - Menú lateral completamente ocultable
 * - Modo streaming muestra dispositivos en grilla
 * - POR DEFECTO: Menú lateral OCULTO para ampliar zona de dispositivos
 */

console.log('[StreamingUI] Cargando versión limpia...');

const STREAMING_PREF_KEY = 'flowdashboard.proStreaming';
const STREAMING_SIZE_PRESETS = {
  compact: { width: 260, height: 520, maxSize: 720, bitRate: '2M', maxFps: 24 },
  medium: { width: 340, height: 680, maxSize: 1080, bitRate: '4M', maxFps: 30 },
  large: { width: 430, height: 860, maxSize: 1440, bitRate: '6M', maxFps: 30 }
};

// Estado global
const streamingState = {
  isStreamingMode: false,
  isLeftMenuOpen: false,  // CAMBIO: Por defecto OCULTO
  frameTimers: new Map(),
  frameUrls: new Map(),
  proStreams: new Map(),
  preferences: loadStreamingPreferences(),
  observer: null,
  reattachTimer: null,
  suppressObserver: false
};

function loadStreamingPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(STREAMING_PREF_KEY) || '{}');
    return {
      target: saved.target || 'selected',
      size: saved.size || 'medium',
      columns: saved.columns || 'auto',
      alwaysOnTop: Boolean(saved.alwaysOnTop)
    };
  } catch (error) {
    return { target: 'selected', size: 'medium', columns: 'auto', alwaysOnTop: false };
  }
}

function saveStreamingPreferences() {
  localStorage.setItem(STREAMING_PREF_KEY, JSON.stringify(streamingState.preferences));
}

// Inicializar cuando el DOM esté listo
function initStreamingUI() {
  console.log('[StreamingUI] Inicializando...');
  
  // Agregar estilos CSS primero
  addStreamingStyles();
  
  // Esperar a que el DOM esté completamente listo
  if (document.readyState === 'loading') {
    console.log('[StreamingUI] DOM aún cargando, esperando...');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[StreamingUI] DOM listo, inicializando componentes...');
      setupStreamingComponents();
    });
  } else {
    console.log('[StreamingUI] DOM ya listo, inicializando componentes...');
    setupStreamingComponents();
  }
}

/**
 * Configurar todos los componentes de streaming
 */
function setupStreamingComponents() {
  // 1. Agregar botón de streaming a la barra de controles
  addStreamingButton();
  
  // 2. Hacer la barra de controles sticky
  makeToolbarSticky();
  
  // 3. Agregar botón toggle (☰) FIJO en esquina superior izquierda
  addMenuToggleButton();
  
  // 4. OCULTAR MENÚ LATERAL POR DEFECTO
  hideLeftMenuByDefault();
  setupStreamingReattachObserver();
  
  console.log('[StreamingUI] Inicialización completada');
}

/**
 * Ocultar menú lateral por defecto
 */
function setupStreamingReattachObserver() {
  if (streamingState.observer) return;
  const root = document.querySelector('.device-list');
  if (!root) {
    setTimeout(setupStreamingReattachObserver, 500);
    return;
  }
  streamingState.observer = new MutationObserver(() => {
    if (!streamingState.isStreamingMode || streamingState.suppressObserver) return;
    scheduleStreamingReattach();
  });
  streamingState.observer.observe(root, { childList: true, subtree: true });
}

function scheduleStreamingReattach() {
  if (streamingState.reattachTimer) window.clearTimeout(streamingState.reattachTimer);
  streamingState.reattachTimer = window.setTimeout(() => {
    if (!streamingState.isStreamingMode) return;
    applyStreamingLayout();
    markProStreamCards(Array.from(streamingState.proStreams.keys()), true);
  }, 220);
}

function hideLeftMenuByDefault() {
  const leftColumn = document.querySelector('.left-column');
  const grid = document.querySelector('.grid');
  const toggleBtn = document.querySelector('.js-menu-toggle-btn');
  
  if (!leftColumn) {
    console.warn('[StreamingUI] .left-column no encontrado, reintentando...');
    setTimeout(hideLeftMenuByDefault, 500);
    return;
  }
  
  console.log('[StreamingUI] Ocultando menú lateral por defecto');
  leftColumn.classList.add('streaming-menu-hidden');
  if (grid) {
    grid.classList.add('streaming-menu-hidden');
  }
  if (toggleBtn) {
    toggleBtn.classList.add('active');
  }
}

/**
 * Agregar botón "Streaming" a la barra de controles
 * Se inserta en .device-toolbar junto a "Selección", "Vista", "Datos"
 */
function addStreamingButton() {
  // Intentar encontrar la barra de herramientas
  let deviceToolbar = document.querySelector('.device-toolbar');
  
  if (!deviceToolbar) {
    console.warn('[StreamingUI] .device-toolbar no encontrado, esperando...');
    // Reintentar después de un tiempo
    setTimeout(addStreamingButton, 500);
    return;
  }
  
  // Verificar que no existe ya el botón
  if (document.querySelector('.js-streaming-toggle-btn')) {
    console.log('[StreamingUI] Botón de streaming ya existe');
    return;
  }
  
  // Crear grupo de botones para streaming
  const streamingGroup = document.createElement('div');
  streamingGroup.className = 'device-tool-group streaming';
  streamingGroup.innerHTML = `
    <span class="device-tool-group-label">Streaming</span>
    <div class="device-selection-controls pro-stream-controls">
      <select class="pro-stream-select js-streaming-target" title="Cantidad de streams" aria-label="Cantidad de streams">
        <option value="selected">Seleccionados</option>
        <option value="one">1</option>
        <option value="four">4</option>
        <option value="eight">8</option>
        <option value="all">Todos</option>
      </select>
      <select class="pro-stream-select js-streaming-size" title="Tamano de ventanas" aria-label="Tamano de ventanas">
        <option value="compact">Compacto</option>
        <option value="medium">Medio</option>
        <option value="large">Grande</option>
      </select>
      <button class="device-select-btn streaming-pin js-streaming-pin-btn"
              type="button"
              title="Siempre encima"
              aria-label="Siempre encima">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 3l7 7-3 1-4 4v5l-2 2-2-7-7-2 2-2h5l4-4 1-4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        </svg>
      </button>
      <button class="device-select-btn streaming-toggle js-streaming-toggle-btn" 
              type="button" 
              title="Abrir Stream Pro" 
              aria-label="Abrir Stream Pro">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="2" fill="none"/>
        </svg>
      </button>
      <button class="device-select-btn streaming-stop js-streaming-stop-btn"
              type="button"
              title="Cerrar streams"
              aria-label="Cerrar streams">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor"/>
        </svg>
      </button>
    </div>
  `;
  
  // Agregar al final de la barra (después de "Vista")
  deviceToolbar.appendChild(streamingGroup);
  
  // Agregar event listener
  const btn = streamingGroup.querySelector('.js-streaming-toggle-btn');
  btn.addEventListener('click', toggleStreamingMode);
  const stopBtn = streamingGroup.querySelector('.js-streaming-stop-btn');
  stopBtn.addEventListener('click', stopProStreams);
  hydrateStreamingControls(streamingGroup);
  
  console.log('[StreamingUI] Botón de streaming agregado a la barra de controles');
}

function hydrateStreamingControls(root) {
  const target = root.querySelector('.js-streaming-target');
  const size = root.querySelector('.js-streaming-size');
  const pin = root.querySelector('.js-streaming-pin-btn');
  if (target) target.value = streamingState.preferences.target;
  if (size) size.value = streamingState.preferences.size;
  if (pin) {
    pin.classList.toggle('active', streamingState.preferences.alwaysOnTop);
    pin.setAttribute('aria-pressed', streamingState.preferences.alwaysOnTop ? 'true' : 'false');
  }

  const relaunch = async () => {
    saveStreamingPreferences();
    if (!streamingState.isStreamingMode) return;
    await restartProStreams();
  };

  if (target) {
    target.addEventListener('change', async () => {
      streamingState.preferences.target = target.value;
      await relaunch();
    });
  }
  if (size) {
    size.addEventListener('change', async () => {
      streamingState.preferences.size = size.value;
      await relaunch();
    });
  }
  if (pin) {
    pin.addEventListener('click', async () => {
      streamingState.preferences.alwaysOnTop = !streamingState.preferences.alwaysOnTop;
      pin.classList.toggle('active', streamingState.preferences.alwaysOnTop);
      pin.setAttribute('aria-pressed', streamingState.preferences.alwaysOnTop ? 'true' : 'false');
      await relaunch();
    });
  }
}

/**
 * Hacer la barra de controles sticky (fija al desplazar)
 */
function makeToolbarSticky() {
  const panelHeader = document.querySelector('.panel-header');
  if (!panelHeader) {
    console.warn('[StreamingUI] .panel-header no encontrado, esperando...');
    // Reintentar después de un tiempo
    setTimeout(makeToolbarSticky, 500);
    return;
  }
  
  // Verificar que no tiene ya la clase
  if (panelHeader.classList.contains('streaming-sticky-header')) {
    console.log('[StreamingUI] Barra ya es sticky');
    return;
  }
  
  // Agregar clase sticky
  panelHeader.classList.add('streaming-sticky-header');
  
  console.log('[StreamingUI] Barra de controles hecha sticky');
}

/**
 * Agregar botón toggle (☰) FIJO en esquina superior izquierda
 * Este botón permanece visible incluso cuando el menú está oculto
 */
function addMenuToggleButton() {
  // Verificar que no existe ya el botón
  if (document.querySelector('.js-menu-toggle-btn')) {
    console.log('[StreamingUI] Botón toggle ya existe');
    return;
  }
  
  // Crear contenedor para el botón toggle (FIJO en la esquina)
  const toggleContainer = document.createElement('div');
  toggleContainer.className = 'menu-toggle-container js-menu-toggle-container';
  
  // Crear botón toggle
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'menu-toggle-btn js-menu-toggle-btn';
  toggleBtn.type = 'button';
  toggleBtn.title = 'Mostrar/Ocultar menú lateral';
  toggleBtn.setAttribute('aria-label', 'Mostrar/Ocultar menú lateral');
  toggleBtn.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" fill="currentColor"/>
    </svg>
  `;
  
  toggleContainer.appendChild(toggleBtn);
  document.body.insertBefore(toggleContainer, document.body.firstChild);
  
  // Agregar event listener
  toggleBtn.addEventListener('click', toggleLeftMenu);
  
  console.log('[StreamingUI] Botón toggle (☰) agregado en esquina superior izquierda');
}

/**
 * Toggle modo streaming
 * Muestra dispositivos en grilla cuando está activo
 */
async function toggleStreamingMode() {
  streamingState.isStreamingMode = !streamingState.isStreamingMode;
  
  const btn = document.querySelector('.js-streaming-toggle-btn');
  const deviceWorkspace = document.querySelector('.devices-workspace');
  const deviceList = document.querySelector('.device-list');
  const deviceGridActions = document.querySelector('.device-grid-actions');
  
  if (!deviceWorkspace || !deviceList) {
    console.warn('[StreamingUI] Contenedores de dispositivos no encontrados');
    return;
  }
  
  if (streamingState.isStreamingMode) {
    console.log('[StreamingUI] Activando modo streaming');
    btn.classList.add('active');
    
    applyStreamingLayout();
    await startProStreams();
    
  } else {
    console.log('[StreamingUI] Desactivando modo streaming');
    btn.classList.remove('active');
    await stopProStreams();
    
    // Restaurar estilos normales
    deviceWorkspace.classList.remove('streaming-mode');
    deviceList.classList.remove('streaming-grid');
    
    // Mostrar acciones de grilla
    if (deviceGridActions) {
      deviceGridActions.style.display = 'flex';
    }
  }
}

function applyStreamingLayout() {
  const deviceWorkspace = document.querySelector('.devices-workspace');
  const deviceList = document.querySelector('.device-list');
  const deviceGridActions = document.querySelector('.device-grid-actions');
  if (deviceWorkspace) deviceWorkspace.classList.add('streaming-mode');
  if (deviceList) deviceList.classList.add('streaming-grid');
  if (deviceGridActions) deviceGridActions.style.display = 'none';
}

function streamTargetCards() {
  const cards = Array.from(document.querySelectorAll('.device-card[data-device-serial]'));
  const selected = cards.filter(card => card.classList.contains('is-selected'));
  const base = selected.length ? selected : cards;
  const target = streamingState.preferences.target;
  if (target === 'one') return base.slice(0, 1);
  if (target === 'four') return base.slice(0, 4);
  if (target === 'eight') return base.slice(0, 8);
  if (target === 'all') return cards;
  return base;
}

function streamTargetSerials() {
  return streamTargetCards()
    .map(card => card.dataset.deviceSerial)
    .filter(Boolean);
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

function markProStreamCards(serials, running) {
  const serialSet = new Set(serials);
  document.querySelectorAll('.device-card[data-device-serial]').forEach(card => {
    const active = serialSet.has(card.dataset.deviceSerial) && running;
    card.classList.toggle('has-pro-stream', active);
    let badge = card.querySelector('.pro-stream-badge');
    if (active && !badge) {
      badge = document.createElement('span');
      badge.className = 'pro-stream-badge';
      badge.textContent = 'Stream Pro';
      card.appendChild(badge);
    } else if (!active && badge) {
      badge.remove();
    }
  });
}

async function startProStreams() {
  const serials = streamTargetSerials();
  if (!serials.length) return;

  const btn = document.querySelector('.js-streaming-toggle-btn');
  const preset = STREAMING_SIZE_PRESETS[streamingState.preferences.size] || STREAMING_SIZE_PRESETS.medium;
  const columns = streamingState.preferences.columns === 'auto'
    ? Math.min(4, Math.max(1, Math.ceil(Math.sqrt(serials.length))))
    : Number(streamingState.preferences.columns) || undefined;
  if (btn) btn.classList.add('is-busy');
  try {
    const response = await postJson('http://127.0.0.1:8765/pro-stream/start-selected', {
      serials,
      columns,
      width: preset.width,
      height: preset.height,
      gap: 12,
      startX: 60,
      startY: 70,
      borderless: true,
      alwaysOnTop: streamingState.preferences.alwaysOnTop,
      maxSize: preset.maxSize,
      maxFps: preset.maxFps,
      bitRate: preset.bitRate,
      restart: true
    });
    streamingState.proStreams.clear();
    (response.streams || []).forEach(stream => {
      if (stream.serial) streamingState.proStreams.set(stream.serial, stream);
    });
    markProStreamCards(serials, true);
  } catch (error) {
    console.error('[StreamingUI] No se pudo iniciar Stream Pro:', error);
    streamingState.isStreamingMode = false;
    if (btn) btn.classList.remove('active');
    alert(`No se pudo iniciar Stream Pro: ${error.message}`);
  } finally {
    if (btn) btn.classList.remove('is-busy');
  }
}

async function restartProStreams() {
  await stopProStreams({ keepMode: true });
  streamingState.isStreamingMode = true;
  const btn = document.querySelector('.js-streaming-toggle-btn');
  if (btn) btn.classList.add('active');
  applyStreamingLayout();
  await startProStreams();
}

async function stopProStreams(options = {}) {
  stopDashboardLiveSnapshots();
  try {
    await postJson('http://127.0.0.1:8765/pro-stream/stop-all', {});
  } catch (error) {
    console.warn('[StreamingUI] No se pudieron cerrar todos los streams:', error);
  }
  streamingState.proStreams.clear();
  markProStreamCards([], false);
  const btn = document.querySelector('.js-streaming-toggle-btn');
  if (btn) {
    btn.classList.remove('active');
    btn.classList.remove('is-busy');
  }
  if (!options.keepMode) {
    streamingState.isStreamingMode = false;
  }
}

function startDashboardLiveSnapshots() {
  streamingState.suppressObserver = true;
  stopDashboardLiveSnapshots();
  const cards = streamTargetCards();
  cards.forEach(card => startCardLiveSnapshot(card));
  window.setTimeout(() => {
    streamingState.suppressObserver = false;
  }, 50);
}

function stopDashboardLiveSnapshots() {
  streamingState.frameTimers.forEach(timer => window.clearInterval(timer));
  streamingState.frameTimers.clear();
  streamingState.frameUrls.forEach(url => URL.revokeObjectURL(url));
  streamingState.frameUrls.clear();
  if (streamingState.reattachTimer) {
    window.clearTimeout(streamingState.reattachTimer);
    streamingState.reattachTimer = null;
  }
  document.querySelectorAll('.streaming-live-frame').forEach(node => node.remove());
}

function startCardLiveSnapshot(card) {
  const serial = card.dataset.deviceSerial;
  if (!serial) return;

  const existing = card.querySelector('.streaming-live-frame');
  if (existing) existing.remove();

  const frame = document.createElement('div');
  frame.className = 'streaming-live-frame';
  frame.innerHTML = `
    <img alt="Pantalla en vivo" />
    <span class="streaming-live-status">Conectando...</span>
  `;
  card.appendChild(frame);

  const img = frame.querySelector('img');
  const status = frame.querySelector('.streaming-live-status');
  const key = card.dataset.deviceId || serial;

  const updateFrame = async () => {
    if (!streamingState.isStreamingMode || !document.body.contains(card)) return;
    try {
      const response = await fetch(`http://127.0.0.1:8765/screen-snapshot/${encodeURIComponent(serial)}?t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const nextUrl = URL.createObjectURL(blob);
      const previousUrl = streamingState.frameUrls.get(key);
      img.src = nextUrl;
      streamingState.frameUrls.set(key, nextUrl);
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      status.textContent = '';
      frame.classList.add('has-frame');
    } catch (error) {
      status.textContent = 'Sin imagen';
      frame.classList.remove('has-frame');
    }
  };

  updateFrame();
  const timer = window.setInterval(updateFrame, 950);
  streamingState.frameTimers.set(key, timer);
}

/**
 * Toggle menú lateral izquierdo
 * Oculta/muestra completamente el menú lateral
 */
function toggleLeftMenu() {
  streamingState.isLeftMenuOpen = !streamingState.isLeftMenuOpen;
  
  const leftColumn = document.querySelector('.left-column');
  const grid = document.querySelector('.grid');
  const toggleBtn = document.querySelector('.js-menu-toggle-btn');
  
  if (!leftColumn) {
    console.warn('[StreamingUI] .left-column no encontrado');
    return;
  }
  
  if (streamingState.isLeftMenuOpen) {
    console.log('[StreamingUI] Mostrando menú lateral');
    leftColumn.classList.remove('streaming-menu-hidden');
    if (grid) {
      grid.classList.remove('streaming-menu-hidden');
    }
    if (toggleBtn) toggleBtn.classList.remove('active');
  } else {
    console.log('[StreamingUI] Ocultando menú lateral');
    leftColumn.classList.add('streaming-menu-hidden');
    if (grid) {
      grid.classList.add('streaming-menu-hidden');
    }
    if (toggleBtn) toggleBtn.classList.add('active');
  }
}

/**
 * Agregar estilos CSS para streaming UI
 */
function addStreamingStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* ===== BOTÓN TOGGLE (☰) FIJO ===== */
    .menu-toggle-container {
      position: fixed;
      top: 16px;
      left: 16px;
      z-index: 1001;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .menu-toggle-btn {
      background: linear-gradient(135deg, rgba(79, 141, 255, 0.15), rgba(139, 92, 246, 0.12));
      border: 1px solid rgba(79, 141, 255, 0.25);
      color: #9fb0cc;
      padding: 10px 12px;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
      width: 44px;
      height: 44px;
    }
    
    .menu-toggle-btn:hover {
      background: linear-gradient(135deg, rgba(79, 141, 255, 0.25), rgba(139, 92, 246, 0.2));
      color: #4f8dff;
      border-color: rgba(79, 141, 255, 0.4);
      transform: scale(1.05);
    }
    
    .menu-toggle-btn.active {
      background: linear-gradient(135deg, rgba(212, 88, 98, 0.15), rgba(212, 88, 98, 0.12));
      color: #d45862;
      border-color: rgba(212, 88, 98, 0.3);
    }
    
    .menu-toggle-btn svg {
      width: 20px;
      height: 20px;
    }
    
    /* ===== BARRA DE CONTROLES STICKY ===== */
    .streaming-sticky-header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: linear-gradient(145deg, rgba(24, 38, 68, 0.98), rgba(11, 20, 39, 0.96));
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(8px);
    }
    
    /* ===== GRUPO DE STREAMING EN BARRA ===== */
    .device-tool-group.streaming {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-left: 12px;
      border-left: 1px solid rgba(79, 141, 255, 0.15);
    }

    .pro-stream-controls {
      align-items: center;
      gap: 6px;
      flex-wrap: nowrap;
    }

    .pro-stream-select {
      height: 32px;
      max-width: 118px;
      border: 1px solid rgba(79, 141, 255, 0.24);
      border-radius: 8px;
      background: rgba(9, 18, 34, 0.86);
      color: #d8e7fb;
      padding: 0 8px;
      font-size: 0.7rem;
      font-weight: 800;
      outline: none;
    }

    .pro-stream-select:focus {
      border-color: rgba(79, 141, 255, 0.58);
      box-shadow: 0 0 0 2px rgba(79, 141, 255, 0.12);
    }
    
    .device-tool-group.streaming .device-tool-group-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: rgba(159, 176, 204, 0.7);
    }
    
    /* ===== BOTÓN STREAMING ===== */
    .streaming-toggle {
      background: linear-gradient(135deg, rgba(79, 141, 255, 0.2), rgba(139, 92, 246, 0.15));
      color: #9fb0cc;
      border: 1px solid rgba(79, 141, 255, 0.3);
      padding: 8px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
    }
    
    .streaming-toggle:hover {
      background: linear-gradient(135deg, rgba(79, 141, 255, 0.3), rgba(139, 92, 246, 0.25));
      color: #4f8dff;
      border-color: rgba(79, 141, 255, 0.5);
      transform: translateY(-1px);
    }
    
    .streaming-toggle.active {
      background: linear-gradient(135deg, #4f8dff, #8b5cf6);
      color: white;
      border-color: rgba(79, 141, 255, 0.6);
      box-shadow: 0 4px 12px rgba(79, 141, 255, 0.3);
    }

    .streaming-toggle.is-busy {
      opacity: 0.72;
      pointer-events: none;
    }

    .streaming-stop,
    .streaming-pin {
      background: rgba(212, 88, 98, 0.14);
      color: #ff7a86;
      border: 1px solid rgba(212, 88, 98, 0.3);
      padding: 8px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
    }

    .streaming-pin {
      background: rgba(61, 220, 151, 0.12);
      color: #7dffc5;
      border-color: rgba(61, 220, 151, 0.28);
      width: 34px;
      height: 34px;
    }

    .streaming-stop:hover,
    .streaming-pin:hover {
      background: rgba(212, 88, 98, 0.24);
      border-color: rgba(212, 88, 98, 0.5);
      transform: translateY(-1px);
    }

    .streaming-pin:hover,
    .streaming-pin.active {
      background: rgba(61, 220, 151, 0.2);
      border-color: rgba(61, 220, 151, 0.56);
      box-shadow: 0 0 0 2px rgba(61, 220, 151, 0.08);
    }
    
    .streaming-toggle svg,
    .streaming-stop svg,
    .streaming-pin svg {
      width: 18px;
      height: 18px;
    }

    .device-card.has-pro-stream {
      box-shadow: 0 0 0 1px rgba(61, 220, 151, 0.28), 0 14px 35px rgba(61, 220, 151, 0.1);
    }

    .pro-stream-badge {
      position: absolute;
      right: 10px;
      bottom: 10px;
      z-index: 12;
      border-radius: 999px;
      padding: 4px 8px;
      background: rgba(61, 220, 151, 0.15);
      border: 1px solid rgba(61, 220, 151, 0.38);
      color: #7dffc5;
      font-size: 0.66rem;
      font-weight: 800;
      letter-spacing: 0;
      pointer-events: none;
    }
    
    /* ===== MENÚ LATERAL OCULTO ===== */
    .left-column.streaming-menu-hidden {
      display: none !important;
      width: 0 !important;
      min-width: 0 !important;
      flex: 0 !important;
    }
    
    /* Ajustar grid cuando menú está oculto - Solución robusta */
    .grid.streaming-menu-hidden {
      grid-template-columns: 1fr !important;
    }
    
    /* ===== MODO STREAMING ===== */
    .devices-workspace.streaming-mode {
      display: grid !important;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
      padding: 16px;
      background: transparent;
    }
    
    .device-list.streaming-grid {
      display: grid !important;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
      padding: 0;
      background: transparent;
    }
    
    .device-list.streaming-grid .device-item {
      border: 2px solid rgba(79, 141, 255, 0.2);
      border-radius: 12px;
      padding: 12px;
      background: rgba(24, 38, 68, 0.5);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .device-list.streaming-grid .device-item:hover {
      border-color: rgba(79, 141, 255, 0.5);
      background: rgba(24, 38, 68, 0.8);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(79, 141, 255, 0.2);
    }
    
    .device-list.streaming-grid .device-item.selected {
      border-color: rgba(79, 141, 255, 0.8);
      background: rgba(79, 141, 255, 0.1);
      box-shadow: 0 0 16px rgba(79, 141, 255, 0.2);
    }

    .device-card .streaming-live-frame {
      position: absolute;
      inset: 8px;
      z-index: 8;
      overflow: hidden;
      border-radius: 8px;
      border: 1px solid rgba(79, 141, 255, 0.35);
      background: #050b14;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .device-card .streaming-live-frame img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      background: #050b14;
    }

    .device-card .streaming-live-frame:not(.has-frame) img {
      display: none;
    }

    .streaming-live-status {
      color: #9fb0cc;
      font-size: 0.72rem;
      font-weight: 700;
    }
    
    /* ===== RESPONSIVE ===== */
    @media (max-width: 768px) {
      .menu-toggle-container {
        top: 12px;
        left: 12px;
      }
      
      .menu-toggle-btn {
        width: 40px;
        height: 40px;
        padding: 8px 10px;
      }
      
      .device-tool-group.streaming {
        padding-left: 8px;
      }
      
      .devices-workspace.streaming-mode {
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 12px;
        padding: 12px;
      }
      
      .device-list.streaming-grid {
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 12px;
      }
    }
  `;
  
  document.head.appendChild(style);
  console.log('[StreamingUI] Estilos CSS agregados');
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStreamingUI);
} else {
  initStreamingUI();
}

console.log('[StreamingUI] Módulo cargado correctamente');
