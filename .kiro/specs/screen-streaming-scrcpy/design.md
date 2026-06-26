# Diseño Técnico: Screen Streaming con scrcpy

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                        wsapi_demo.html                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Tarjeta de Dispositivo                                  │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  <video> element con MediaSource API              │  │   │
│  │  │  - H.264 decoder                                   │  │   │
│  │  │  - Controles (Play/Pause/Zoom)                     │  │   │
│  │  │  - Indicadores de estado                           │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  Botones de control                                 │  │   │
│  │  │  - Streaming (toggle)                              │  │   │
│  │  │  - Calidad (720p/1080p/4k)                         │  │   │
│  │  │  - Controles de reproducción                       │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            │ HTTP/WebSocket                      │
│                            ▼                                     │
┌─────────────────────────────────────────────────────────────────┐
│                      local_adb_server.py                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Endpoints HTTP                                         │   │
│  │  - GET /screen-streams                                  │   │
│  │  - POST /screen-stream/start                            │   │
│  │  - POST /screen-stream/stop                             │   │
│  │  - GET /screen-stream/status/{serial}                   │   │
│  │  - GET /screen-stream/h264/{serial} (WebSocket)         │   │
│  │  - GET /screen-stream/h264/{serial} (HTTP chunked)      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            │ ADB shell command                   │
│                            ▼                                     │
┌─────────────────────────────────────────────────────────────────┐
│                   Dispositivo Android                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  scrcpy-server (Java)                                   │   │
│  │  - Captura de pantalla (SurfaceControl)                │   │   │
│  │  - Codificación H.264 (MediaCodec)                     │   │   │
│  │  - Transmisión por socket                              │   │   │
│  │  - Control de calidad y FPS                            │   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            │ ADB tunnel                          │
│                            ▼                                     │
│                    Socket local (TCP)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Componentes Detallados

### 1. local_adb_server.py

#### Nuevas Clases

```python
class ScrcpyStream:
    """Gestiona un stream de scrcpy para un dispositivo"""
    
    def __init__(self, serial, max_width=1920, bit_rate=8000000, max_fps=30):
        self.serial = serial
        self.max_width = max_width
        self.bit_rate = bit_rate
        self.max_fps = max_fps
        self.process = None
        self.socket = None
        self.port = None
        self.clients = []  # WebSocket clients
        self.is_running = False
    
    def start(self):
        """Iniciar scrcpy-server en el dispositivo"""
        # 1. Instalar scrcpy-server si no está presente
        self._install_server()
        
        # 2. Iniciar scrcpy-server con ADB shell
        self.port = self._start_server()
        
        # 3. Crear socket para recibir datos
        self.socket = self._create_socket()
        
        # 4. Iniciar thread de lectura
        self.read_thread = threading.Thread(target=self._read_data, daemon=True)
        self.read_thread.start()
        
        self.is_running = True
    
    def stop(self):
        """Detener scrcpy-server"""
        self.is_running = False
        
        # 1. Cerrar socket
        if self.socket:
            self.socket.close()
        
        # 2. Detener scrcpy-server
        if self.process:
            self.process.terminate()
            self.process.wait()
        
        # 3. Notificar clientes
        for client in self.clients:
            try:
                client.close()
            except:
                pass
        self.clients = []
    
    def add_client(self, websocket):
        """Agregar cliente WebSocket"""
        self.clients.append(websocket)
    
    def remove_client(self, websocket):
        """Eliminar cliente WebSocket"""
        if websocket in self.clients:
            self.clients.remove(websocket)
    
    def _read_data(self):
        """Leer datos H.264 del socket y enviar a clientes"""
        while self.is_running and self.socket:
            try:
                data = self.socket.recv(4096)
                if not data:
                    break
                
                # Enviar a todos los clientes
                for client in list(self.clients):
                    try:
                        client.send(data)
                    except:
                        self.remove_client(client)
            except Exception as e:
                if self.is_running:
                    print(f"Error reading scrcpy data: {e}")
                break
```

#### Nuevos Endpoints

```python
# Lista de streams activos
active_streams = {}
active_streams_lock = threading.Lock()

def handle_screen_streams_get():
    """GET /screen-streams"""
    with active_streams_lock:
        streams = []
        for serial, stream in active_streams.items():
            if stream.is_running:
                streams.append({
                    "serial": serial,
                    "maxWidth": stream.max_width,
                    "bitRate": stream.bit_rate,
                    "maxFps": stream.max_fps,
                    "clientCount": len(stream.clients)
                })
        return {"streams": streams}

def handle_screen_stream_start():
    """POST /screen-stream/start"""
    data = get_json_body()
    serial = data.get("serial")
    max_width = data.get("maxWidth", 1920)
    bit_rate = data.get("bitRate", 8000000)
    max_fps = data.get("maxFps", 30)
    
    if not serial:
        return {"error": "serial es requerido"}
    
    with active_streams_lock:
        if serial in active_streams:
            stream = active_streams[serial]
            if stream.is_running:
                return {"error": "Streaming ya activo para este dispositivo"}
        
        stream = ScrcpyStream(serial, max_width, bit_rate, max_fps)
        stream.start()
        active_streams[serial] = stream
    
    return {"success": True, "serial": serial}

def handle_screen_stream_stop():
    """POST /screen-stream/stop"""
    data = get_json_body()
    serial = data.get("serial")
    
    if not serial:
        return {"error": "serial es requerido"}
    
    with active_streams_lock:
        if serial in active_streams:
            stream = active_streams[serial]
            stream.stop()
            del active_streams[serial]
    
    return {"success": True, "serial": serial}

def handle_screen_stream_status(serial):
    """GET /screen-stream/status/{serial}"""
    with active_streams_lock:
        if serial in active_streams:
            stream = active_streams[serial]
            return {
                "serial": serial,
                "isRunning": stream.is_running,
                "clientCount": len(stream.clients),
                "maxWidth": stream.max_width,
                "bitRate": stream.bit_rate,
                "maxFps": stream.max_fps
            }
        return {"serial": serial, "isRunning": False}

def handle_screen_stream_h264(serial):
    """GET /screen-stream/h264/{serial} - WebSocket o HTTP chunked"""
    # Implementar WebSocket handler o HTTP chunked
    pass
```

#### Funciones Auxiliares

```python
def install_scrcpy_server(serial):
    """Instalar scrcpy-server en dispositivo"""
    # 1. Verificar si ya está instalado
    result = adb_shell(serial, "ls /data/local/tmp/scrcpy-server.jar")
    if result.returncode == 0:
        return True
    
    # 2. Push scrcpy-server al dispositivo
    result = adb_push(serial, "scrcpy-server.jar", "/data/local/tmp/scrcpy-server.jar")
    return result.returncode == 0

def start_scrcpy_server(serial, max_width=1920, bit_rate=8000000, max_fps=30):
    """Iniciar scrcpy-server en dispositivo"""
    # Comando scrcpy-server
    cmd = (
        f"CLASSPATH=/data/local/tmp/scrcpy-server.jar "
        f"app_process / "
        f"com.genymobile.scrcpy.Server 2.7 "
        f"{max_width} "
        f"{bit_rate} "
        f"{max_fps} "
        f"true - - - - -1 true - - -"
    )
    
    # Ejecutar con ADB shell
    process = adb_shell_async(serial, cmd)
    return process

def get_scrcpy_socket(serial):
    """Obtener socket ADB para streaming"""
    # Forward local port to device socket
    local_port = find_free_port()
    adb_forward(serial, f"tcp:{local_port}", "localabstract:scrcpy")
    return local_port
```

---

### 2. wsapi.js

#### Nuevos Métodos

```javascript
class Wsapi {
  // ... existing methods ...

  async getScreenStreams() {
    const data = await this._request('/screen-streams');
    return Array.isArray(data.streams) ? data.streams : [];
  }

  async startScreenStream(options = {}) {
    const { serial, maxWidth = 1920, bitRate = 8000000, maxFps = 30 } = options;
    
    if (!serial) {
      throw new Error('serial es requerido');
    }

    const data = await this._post('/screen-stream/start', {
      serial,
      maxWidth,
      bitRate,
      maxFps
    });
    
    return data || {};
  }

  async stopScreenStream(options = {}) {
    const { serial } = options;
    
    if (!serial) {
      throw new Error('serial es requerido');
    }

    const data = await this._post('/screen-stream/stop', { serial });
    return data || {};
  }

  async getScreenStreamStatus(options = {}) {
    const { serial } = options;
    
    if (!serial) {
      throw new Error('serial es requerido');
    }

    const data = await this._request(`/screen-stream/status/${serial}`);
    return data || {};
  }

  connectScreenStream(options = {}) {
    const { serial, onMessage, onClose, onError } = options;
    
    if (!serial) {
      throw new Error('serial es requerido');
    }

    const ws = new WebSocket(`ws://${this.CONNECT_IP}/screen-stream/h264/${serial}`);
    
    ws.onmessage = (event) => {
      if (onMessage && typeof onMessage === 'function') {
        onMessage(event.data);
      }
    };
    
    ws.onclose = (event) => {
      if (onClose && typeof onClose === 'function') {
        onClose(event);
      }
    };
    
    ws.onerror = (error) => {
      if (onError && typeof onError === 'function') {
        onError(error);
      }
    };
    
    return ws;
  }
}
```

---

### 3. wsapi_demo.html

#### UI Changes

```html
<!-- En cada tarjeta de dispositivo -->
<div class="device-card" data-serial="{serial}">
  <!-- ... existing device card content ... -->
  
  <!-- Botón de Streaming -->
  <button class="stream-toggle-btn" 
          onclick="toggleStream('{serial}')"
          aria-label="Toggle streaming">
    <svg class="stream-icon" viewBox="0 0 24 24">
      <path d="M14.6 16.6L19.2 12L14.6 7.4V16.6ZM4 19H11V5H4V19Z" />
    </svg>
    <span class="stream-text">Streaming</span>
  </button>
  
  <!-- Selector de Calidad -->
  <div class="stream-quality-controls">
    <select class="quality-select" 
            onchange="changeQuality('{serial}', this.value)"
            aria-label="Select quality">
      <option value="720p">720p (HD)</option>
      <option value="1080p" selected>1080p (Full HD)</option>
      <option value="4k">4K (Ultra HD)</option>
    </select>
  </div>
  
  <!-- Video Element -->
  <video class="device-screen" 
         muted autoplay playsinline
         poster="./placeholder-screen.png">
    <!-- MediaSource API will append H.264 data here -->
  </video>
  
  <!-- Controles de Reproducción -->
  <div class="stream-controls">
    <button class="stream-pause-btn" onclick="pauseStream('{serial}')">
      <svg viewBox="0 0 24 24">
        <path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z" />
      </svg>
    </button>
    <button class="stream-zoom-btn" onclick="zoomStream('{serial}', -1)">
      <svg viewBox="0 0 24 24">
        <path d="M12 9C10.9 9 10 9.9 10 11V13H8V11C8 9.34 9.34 8 11 8H13V6H11C9.34 6 8 7.34 8 9V11H6V9C6 6.24 8.24 4 11 4H13C15.76 4 18 6.24 18 9V11H20V9C20 6.24 17.76 4 15 4H13C12.45 4 12 4.45 12 5V9ZM11 15H13V17H11V15ZM11 19H13V21H11V19Z" />
      </svg>
    </button>
    <button class="stream-fullscreen-btn" onclick="fullscreenStream('{serial}')">
      <svg viewBox="0 0 24 24">
        <path d="M7 14H5V19H10V17H7V14ZM5 5H10V7H7V10H5V5ZM17 7V5H19V10H14V7H17ZM14 17H17V14H20V19H14V17Z" />
      </svg>
    </button>
  </div>
</div>
```

#### JavaScript para Streaming

```javascript
// Clase para manejar el streaming de un dispositivo
class ScreenStreamPlayer {
  constructor(serial, videoElement) {
    this.serial = serial;
    this.video = videoElement;
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.ws = null;
    this.isRunning = false;
    this.isPlaying = false;
    this.quality = '1080p';
    this.zoomLevel = 1;
  }

  async start() {
    if (this.isRunning) return;

    try {
      // Configurar calidad
      const config = this.getQualityConfig(this.quality);
      
      // Iniciar streaming en servidor
      await wsapi.startScreenStream({
        serial: this.serial,
        maxWidth: config.maxWidth,
        bitRate: config.bitRate,
        maxFps: config.maxFps
      });
      
      // Crear MediaSource
      this.mediaSource = new MediaSource();
      this.video.src = URL.createObjectURL(this.mediaSource);
      
      this.mediaSource.addEventListener('sourceopen', () => {
        this.sourceBuffer = this.mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01F"');
        this.connectWebSocket();
      });
      
      this.isRunning = true;
      this.isPlaying = true;
      
      // Actualizar UI
      this.updateUI();
      
    } catch (error) {
      console.error('Error starting stream:', error);
      alert('Error al iniciar streaming: ' + error.message);
    }
  }

  stop() {
    if (!this.isRunning) return;

    // Detener WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Detener MediaSource
    if (this.mediaSource) {
      this.mediaSource.endOfStream();
      this.mediaSource = null;
    }
    
    // Limpiar URL
    if (this.video.src) {
      URL.revokeObjectURL(this.video.src);
      this.video.src = '';
    }
    
    // Detener streaming en servidor
    wsapi.stopScreenStream({ serial: this.serial })
      .catch(err => console.error('Error stopping stream:', err));
    
    this.isRunning = false;
    this.isPlaying = false;
    
    // Actualizar UI
    this.updateUI();
  }

  togglePlay() {
    if (!this.isRunning) return;
    
    if (this.isPlaying) {
      this.video.pause();
      this.isPlaying = false;
    } else {
      this.video.play();
      this.isPlaying = true;
    }
    
    this.updateUI();
  }

  changeQuality(newQuality) {
    this.quality = newQuality;
    
    if (this.isRunning) {
      this.stop();
      setTimeout(() => this.start(), 100);
    }
  }

  zoom(factor) {
    this.zoomLevel = Math.max(0.5, Math.min(3, this.zoomLevel + factor));
    this.video.style.transform = `scale(${this.zoomLevel})`;
  }

  toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      this.video.requestFullscreen();
    }
  }

  connectWebSocket() {
    this.ws = wsapi.connectScreenStream({
      serial: this.serial,
      onMessage: (data) => this.appendData(data),
      onClose: () => this.stop(),
      onError: (error) => console.error('Stream error:', error)
    });
  }

  appendData(arrayBuffer) {
    if (this.sourceBuffer && !this.sourceBuffer.updating) {
      try {
        this.sourceBuffer.appendBuffer(arrayBuffer);
      } catch (e) {
        console.error('Error appending buffer:', e);
      }
    }
  }

  getQualityConfig(quality) {
    const configs = {
      '720p': { maxWidth: 1280, bitRate: 4000000, maxFps: 30 },
      '1080p': { maxWidth: 1920, bitRate: 8000000, maxFps: 30 },
      '4k': { maxWidth: 3840, bitRate: 16000000, maxFps: 30 }
    };
    return configs[quality] || configs['1080p'];
  }

  updateUI() {
    const btn = document.querySelector(`.device-card[data-serial="${this.serial}"] .stream-toggle-btn`);
    const icon = btn?.querySelector('.stream-icon');
    const text = btn?.querySelector('.stream-text');
    
    if (btn) {
      if (this.isRunning) {
        btn.classList.add('is-streaming');
        if (icon) icon.innerHTML = this.isPlaying 
          ? '<path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z"/>' // Pause icon
          : '<path d="M8 5V19L19 12L8 5Z"/>'; // Play icon
        if (text) text.textContent = this.isPlaying ? 'Pausar' : 'Reproducir';
      } else {
        btn.classList.remove('is-streaming');
        if (icon) icon.innerHTML = '<path d="M14.6 16.6L19.2 12L14.6 7.4V16.6ZM4 19H11V5H4V19Z"/>';
        if (text) text.textContent = 'Streaming';
      }
    }
  }
}

// Instancia global de streams
const screenStreams = {};

// Funciones globales
function toggleStream(serial) {
  if (!screenStreams[serial]) {
    const video = document.querySelector(`.device-card[data-serial="${serial}"] .device-screen`);
    screenStreams[serial] = new ScreenStreamPlayer(serial, video);
  }
  
  if (screenStreams[serial].isRunning) {
    screenStreams[serial].stop();
  } else {
    screenStreams[serial].start();
  }
}

function pauseStream(serial) {
  if (screenStreams[serial]) {
    screenStreams[serial].togglePlay();
  }
}

function changeQuality(serial, quality) {
  if (screenStreams[serial]) {
    screenStreams[serial].changeQuality(quality);
  }
}

function zoomStream(serial, factor) {
  if (screenStreams[serial]) {
    screenStreams[serial].zoom(factor);
  }
}

function fullscreenStream(serial) {
  if (screenStreams[serial]) {
    screenStreams[serial].toggleFullscreen();
  }
}

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
  // Verificar streams activos al conectar
  wsapi.getScreenStreams().then(streams => {
    streams.forEach(stream => {
      const video = document.querySelector(`.device-card[data-serial="${stream.serial}"] .device-screen`);
      if (video) {
        screenStreams[stream.serial] = new ScreenStreamPlayer(stream.serial, video);
        // Restaurar estado
        screenStreams[stream.serial].isRunning = true;
        screenStreams[stream.serial].quality = '1080p'; // Default
        screenStreams[stream.serial].updateUI();
      }
    });
  }).catch(err => console.error('Error loading streams:', err));
});
```

#### Estilos CSS

```css
/* Streaming Controls */
.device-streaming-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding: 8px;
  background: rgba(15, 26, 48, 0.5);
  border-radius: 12px;
}

.stream-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 10px;
  background: linear-gradient(135deg, #22b86f, #12b5cb);
  color: #fff;
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
  border: 1px solid rgba(34, 184, 111, 0.3);
}

.stream-toggle-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 16px rgba(34, 184, 111, 0.3);
}

.stream-toggle-btn.is-streaming {
  background: linear-gradient(135deg, #d45862, #f43f5e);
  border-color: rgba(212, 88, 98, 0.3);
}

.stream-toggle-btn.is-streaming:hover {
  box-shadow: 0 8px 16px rgba(212, 88, 98, 0.3);
}

.stream-quality-controls {
  flex: 1;
  min-width: 0;
}

.quality-select {
  width: 100%;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(15, 26, 48, 0.9);
  color: #e7eefc;
  border: 1px solid rgba(79, 141, 255, 0.2);
  font-size: 0.82rem;
  cursor: pointer;
}

.quality-select:hover {
  border-color: rgba(79, 141, 255, 0.4);
}

/* Video Element */
.device-screen {
  width: 100%;
  height: auto;
  aspect-ratio: 9/16;
  background: #000;
  border-radius: 12px;
  margin-top: 12px;
  object-fit: contain;
  transition: transform 0.2s ease;
}

/* Stream Controls */
.stream-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
}

.stream-pause-btn,
.stream-zoom-btn,
.stream-fullscreen-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(15, 26, 48, 0.8);
  color: #e7eefc;
  cursor: pointer;
  transition: transform 0.16s ease, background 0.16s ease;
  border: 1px solid rgba(79, 141, 255, 0.2);
}

.stream-pause-btn:hover,
.stream-zoom-btn:hover,
.stream-fullscreen-btn:hover {
  transform: translateY(-1px);
  background: rgba(79, 141, 255, 0.1);
  border-color: rgba(79, 141, 255, 0.4);
}

.stream-pause-btn svg,
.stream-zoom-btn svg,
.stream-fullscreen-btn svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Streaming Status Indicator */
.device-card.is-streaming {
  border-color: rgba(34, 184, 111, 0.4);
  box-shadow: 0 0 0 1px rgba(34, 184, 111, 0.2), var(--shadow);
}

.device-card.is-streaming::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #22b86f, #12b5cb);
  border-radius: 18px 18px 0 0;
}

/* Responsive */
@media (max-width: 768px) {
  .device-streaming-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .stream-toggle-btn {
    width: 100%;
  }
  
  .quality-select {
    width: 100%;
  }
}
```

---

## Implementación Progresiva

### Sprint 1: MVP (Semana 1-2)

#### Día 1-2: Backend Básico
- [ ] Descargar scrcpy-server.jar
- [ ] Implementar `install_scrcpy_server()`
- [ ] Implementar `start_scrcpy_server()`
- [ ] Implementar `stop_scrcpy_server()`
- [ ] Implementar endpoint `/screen-stream/start`
- [ ] Implementar endpoint `/screen-stream/stop`

#### Día 3-4: Streaming HTTP
- [ ] Implementar endpoint `/screen-stream/h264/{serial}` (HTTP chunked)
- [ ] Implementar clase `ScrcpyStream`
- [ ] Implementar thread de lectura de datos
- [ ] Probar streaming con 1 dispositivo

#### Día 5-7: Frontend Básico
- [ ] Agregar botón de streaming en tarjeta
- [ ] Implementar MediaSource API
- [ ] Implementar reproducción de H.264
- [ ] Probar con 1-2 dispositivos

### Sprint 2: Mejoras (Semana 3-4)

#### Día 8-9: WebSocket
- [ ] Implementar WebSocket para streaming
- [ ] Mejorar control de errores
- [ ] Implementar retransmisión automática

#### Día 10-11: Calidad Variable
- [ ] Implementar selector de calidad
- [ ] Implementar cambio de calidad dinámico
- [ ] Optimizar bitrate según red

#### Día 12-14: Controles UI
- [ ] Implementar Play/Pause
- [ ] Implementar Zoom
- [ ] Implementar Fullscreen
- [ ] Mejorar feedback visual

### Sprint 3: Pro (Semana 5-6)

#### Día 15-17: Múltiples Streams
- [ ] Optimizar para múltiples streams
- [ ] Implementar gestión de recursos
- [ ] Probar con 10+ dispositivos

#### Día 18-20: Estabilidad
- [ ] Implementar recuperación de errores
- [ ] Optimizar consumo de recursos
- [ ] Probar 24/7 sin reinicios

---

## Pruebas

### Unit Tests
```python
# test_scrcpy_server.py
def test_install_scrcpy_server():
    # Test install scrcpy-server
    pass

def test_start_stop_scrcpy_server():
    # Test start and stop scrcpy-server
    pass

def test_scrcpy_stream():
    # Test ScrcpyStream class
    pass
```

### Integration Tests
```javascript
// test_screen_stream.js
describe('Screen Stream', () => {
  it('should start stream', async () => {
    await wsapi.startScreenStream({ serial: 'test', maxWidth: 1280, bitRate: 4000000 });
    // Verify stream is running
  });
  
  it('should stop stream', async () => {
    await wsapi.stopScreenStream({ serial: 'test' });
    // Verify stream is stopped
  });
  
  it('should play video', () => {
    // Verify video plays
  });
});
```

### Manual Tests
- [ ] Streaming en wsapi_demo.html
- [ ] Latencia medida
- [ ] Calidad visual
- [ ] Múltiples dispositivos
- [ ] Cambio de calidad
- [ ] Controles de reproducción

---

## Notas Finales

1. **No romper la arquitectura actual:** scrcpy se ejecuta en dispositivo Android, no en el servidor
2. **Mantener compatibilidad:** wsapi.js debe seguir funcionando sin streaming activo
3. **Optimizar recursos:** Limitar streaming a dispositivos seleccionados
4. **Feedback visual:** Indicar claramente cuándo un dispositivo está en streaming
5. **Error handling:** Mostrar mensajes claros cuando el streaming falle