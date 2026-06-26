# Screen Streaming con scrcpy - Especificación Técnica

## Visión General

Implementar streaming de pantalla Android en tiempo real usando scrcpy como base técnica para FlowDashboard.

**Estado actual:** El dashboard muestra dispositivos conectados por ADB pero no tiene visualización de pantalla en vivo.

**Objetivo:** Agregar capacidad de ver y controlar pantallas Android en tiempo real desde el dashboard web, manteniendo la arquitectura actual y usando scrcpy como motor de streaming.

---

## Arquitectura Propuesta

### Flujo de Datos

```
wsapi_demo.html (Dashboard)
  ↓ HTTP/WebSocket
local_adb_server.py
  ↓ ADB shell command
scrcpy-server (en dispositivo Android)
  ↓ ADB tunnel (H.264 video + TCP audio)
Cliente WebSocket en navegador
  ↓ MediaSource API
<video> element en tarjeta de dispositivo
```

### Componentes Clave

1. **local_adb_server.py** - Servidor HTTP con endpoints para scrcpy
2. **wsapi.js** - Cliente JavaScript para interactuar con endpoints de scrcpy
3. **wsapi_demo.html** - Dashboard UI con visualización de pantalla
4. **scrcpy-server** - Servidor binario que se ejecuta en dispositivo Android

---

## Fase 1: Backend - local_adb_server.py

### Nuevos Endpoints

```python
# Lista dispositivos con streaming activo
GET /screen-streams

# Iniciar streaming en dispositivo específico
POST /screen-stream/start
Body: {"serial": "device_serial", "max_width": 1920, "bit_rate": 8000000, "max_fps": 30}

# Detener streaming en dispositivo específico
POST /screen-stream/stop
Body: {"serial": "device_serial"}

# Stream H.264 raw data (WebSocket o HTTP chunked)
GET /screen-stream/h264/{serial}

# Obtener estado del streaming
GET /screen-stream/status/{serial}
```

### Implementación de scrcpy-server

```python
# Descargar scrcpy-server desde GitHub releases
SCRCPY_SERVER_URL = "https://github.com/Genymobile/scrcpy/releases/download/v2.7/scrcpy-server.jar"
SCRCPY_SERVER_PATH = BASE_DIR / "scrcpy-server.jar"

# Instalar scrcpy-server en dispositivo
def install_scrcpy_server(serial):
    # Adb install o push al dispositivo
    pass

# Iniciar scrcpy-server con ADB shell
def start_scrcpy_server(serial, max_width=1920, bit_rate=8000000, max_fps=30):
    # Adb shell command para ejecutar scrcpy-server
    # Return: process object y puerto local asignado
    pass

# Detener scrcpy-server
def stop_scrcpy_server(serial):
    # Adb shell am force-stop o kill process
    pass
```

### Streaming H.264

```python
# Opción 1: HTTP chunked streaming (más simple)
# Opción 2: WebSocket para mejor control (recomendado)

class ScrcpyStreamHandler:
    def __init__(self, serial, process, port):
        self.serial = serial
        self.process = process
        self.port = port
        self.clients = []  # Lista de clientes conectados
    
    def read_video_data(self):
        # Leer datos H.264 del socket ADB
        while not self.process.poll():
            data = self.socket.recv(4096)
            for client in self.clients:
                client.send(data)
    
    def add_client(self, websocket):
        self.clients.append(websocket)
    
    def remove_client(self, websocket):
        self.clients.remove(websocket)
```

---

## Fase 2: Frontend - wsapi.js

### Nuevos Métodos

```javascript
class Wsapi {
  // Lista dispositivos con streaming activo
  async getScreenStreams() {
    const data = await this._request('/screen-streams');
    return Array.isArray(data.streams) ? data.streams : [];
  }

  // Iniciar streaming
  async startScreenStream(options = {}) {
    const { serial, maxWidth = 1920, bitRate = 8000000, maxFps = 30 } = options;
    const data = await this._post('/screen-stream/start', {
      serial,
      maxWidth,
      bitRate,
      maxFps
    });
    return data || {};
  }

  // Detener streaming
  async stopScreenStream(options = {}) {
    const { serial } = options;
    const data = await this._post('/screen-stream/stop', { serial });
    return data || {};
  }

  // Obtener estado del streaming
  async getScreenStreamStatus(options = {}) {
    const { serial } = options;
    const data = await this._request(`/screen-stream/status/${serial}`);
    return data || {};
  }

  // Conectar a stream WebSocket
  connectScreenStream(options = {}) {
    const { serial, onMessage, onClose, onError } = options;
    const ws = new WebSocket(`ws://${this.CONNECT_IP}/screen-stream/h264/${serial}`);
    
    ws.onmessage = (event) => {
      if (onMessage) onMessage(event.data);
    };
    
    ws.onclose = () => {
      if (onClose) onClose();
    };
    
    ws.onerror = (error) => {
      if (onError) onError(error);
    };
    
    return ws;
  }
}
```

---

## Fase 3: Frontend - wsapi_demo.html

### UI Changes

#### 1. Botón de Streaming en Tarjeta de Dispositivo

```html
<div class="device-card">
  <!-- ... existing device card content ... -->
  
  <div class="device-streaming-controls">
    <button class="stream-toggle-btn" onclick="toggleStream(device.serial)">
      <svg>...</svg>
      <span>Streaming</span>
    </button>
    
    <div class="stream-quality-controls">
      <select class="quality-select" onchange="changeQuality(device.serial, this.value)">
        <option value="720p">720p (HD)</option>
        <option value="1080p" selected>1080p (Full HD)</option>
        <option value="4k">4K (Ultra HD)</option>
        <option value="custom">Personalizado</option>
      </select>
    </div>
  </div>
  
  <video class="device-screen" muted autoplay playsinline>
    <!-- MediaSource API will append H.264 data here -->
  </video>
</div>
```

#### 2. MediaSource API para H.264

```javascript
class ScreenStreamPlayer {
  constructor(videoElement) {
    this.video = videoElement;
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.ws = null;
    this.isRunning = false;
  }

  async start(serial, quality = '1080p') {
    // Configurar calidad
    const config = this.getQualityConfig(quality);
    
    // Iniciar streaming en servidor
    await wsapi.startScreenStream({
      serial,
      maxWidth: config.maxWidth,
      bitRate: config.bitRate,
      maxFps: config.maxFps
    });
    
    // Crear MediaSource
    this.mediaSource = new MediaSource();
    this.video.src = URL.createObjectURL(this.mediaSource);
    
    this.mediaSource.addEventListener('sourceopen', () => {
      this.sourceBuffer = this.mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01F"');
      this.connectWebSocket(serial);
    });
  }

  stop() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.mediaSource) {
      this.mediaSource.endOfStream();
      this.mediaSource = null;
    }
    
    this.video.src = '';
    URL.revokeObjectURL(this.video.src);
    
    // Detener streaming en servidor
    wsapi.stopScreenStream({ serial: this.serial });
  }

  connectWebSocket(serial) {
    this.ws = wsapi.connectScreenStream({
      serial,
      onMessage: (data) => this.appendData(data),
      onClose: () => this.stop(),
      onError: (error) => console.error('Stream error:', error)
    });
  }

  appendData(arrayBuffer) {
    if (this.sourceBuffer && !this.sourceBuffer.updating) {
      this.sourceBuffer.appendBuffer(arrayBuffer);
    }
  }

  getQualityConfig(quality) {
    const configs = {
      '720p': { maxWidth: 1280, bitRate: 4000000, maxFps: 30 },
      '1080p': { maxWidth: 1920, bitRate: 8000000, maxFps: 30 },
      '4k': { maxWidth: 3840, bitRate: 16000000, maxFps: 30 },
      'custom': { maxWidth: 1920, bitRate: 8000000, maxFps: 30 }
    };
    return configs[quality] || configs['1080p'];
  }
}
```

#### 3. Estilos CSS para Video

```css
.device-screen {
  width: 100%;
  height: auto;
  aspect-ratio: 9/16;
  background: #000;
  border-radius: 12px;
  margin-top: 12px;
  object-fit: contain;
}

.device-streaming-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
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
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.stream-toggle-btn.is-streaming {
  background: linear-gradient(135deg, #d45862, #f43f5e);
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
}
```

---

## Fase 4: Implementación Progresiva

### Sprint 1: MVP (Semana 1-2)

**Objetivo:** Streaming básico de pantalla en 720p

**Tareas:**
1. [ ] Descargar y empaquetar scrcpy-server.jar con el proyecto
2. [ ] Implementar endpoints `/screen-stream/start` y `/screen-stream/stop` en local_adb_server.py
3. [ ] Implementar streaming H.264 usando HTTP chunked (más simple que WebSocket)
4. [ ] Agregar botón "Ver Pantalla" en tarjeta de dispositivo
5. [ ] Implementar MediaSource API en wsapi_demo.html
6. [ ] Probar con 1-2 dispositivos

**Entregables:**
- Streaming de pantalla en tiempo real
- Latencia < 200ms
- Resolución 720p

### Sprint 2: Mejoras (Semana 3-4)

**Objetivo:** Calidad variable y control de streaming

**Tareas:**
1. [ ] Implementar WebSocket para streaming (mejor control que HTTP chunked)
2. [ ] Agregar selector de calidad (720p, 1080p, 4k)
3. [ ] Implementar controles: Play/Pause/Zoom
4. [ ] Agregar indicador de estado (streaming, pausado, error)
5. [ ] Optimizar latencia y consumo de ancho de banda

**Entregables:**
- Streaming con calidad configurable
- Controles de reproducción
- Latencia < 100ms en 720p

### Sprint 3: Pro (Semana 5-6)

**Objetivo:** Escalabilidad y funcionalidades avanzadas

**Tareas:**
1. [ ] Implementar streaming múltiple simultáneo
2. [ ] Agregar audio streaming (opcional)
3. [ ] Implementar control táctil remoto
4. [ ] Optimizar para dispositivos lentos
5. [ ] Implementar cache y retransmisión automática

**Entregables:**
- Streaming múltiple simultáneo
- Control remoto básico
- Estabilidad para producción

---

## Consideraciones Técnicas

### Latencia

- **scrcpy:** ~35ms (muy bajo)
- **minicap:** ~20ms (requiere root para algunas funciones)
- **WebRTC:** ~50-100ms (más complejo pero escalable)

**Elección:** scrcpy por mejor balance entre latencia y complejidad.

### Ancho de Banda

| Resolución | FPS | Bitrate | Devices simultáneos (100Mbps) |
|------------|-----|---------|-------------------------------|
| 720p       | 30  | 4 Mbps  | ~25                           |
| 1080p      | 30  | 8 Mbps  | ~12                           |
| 4k         | 30  | 16 Mbps | ~6                            |

### Recursos del Dispositivo

- scrcpy-server usa ~5-15% CPU en dispositivo
- Memoria: ~50-100MB adicionales
- Red: depende del bitrate configurado

### Seguridad

- scrcpy-server se ejecuta en dispositivo Android
- Datos H.264 se transmiten por ADB tunnel (cifrado)
- No se exponen credenciales ni datos sensibles

---

## Archivos a Modificar

### Nuevos Archivos
1. `scrcpy-server.jar` - Servidor binario de scrcpy
2. `scrcpy_client.py` - Cliente Python para scrcpy-server
3. `screen_stream_manager.py` - Gestor de streaming en local_adb_server.py

### Modificaciones
1. `local_adb_server.py` - Agregar endpoints de scrcpy
2. `wsapi.js` - Agregar métodos para streaming
3. `wsapi_demo.html` - Agregar UI de streaming
4. `AGENTS.md` - Actualizar reglas visuales
5. `PROJECT_CONTEXT.md` - Actualizar arquitectura

---

## Pruebas

### Unit Tests
- [ ] Iniciar/stop streaming en dispositivo
- [ ] Cambiar calidad de streaming
- [ ] Múltiples streams simultáneos
- [ ] Manejo de errores (dispositivo desconectado)

### Integration Tests
- [ ] Streaming en wsapi_demo.html
- [ ] Latencia medida
- [ ] Consumo de recursos
- [ ] Estabilidad a largo plazo

### Manual Tests
- [ ] Probar con dispositivos reales
- [ ] Verificar calidad visual
- [ ] Probar en diferentes redes
- [ ] Verificar compatibilidad con Android 8-14

---

## Roadmap Futuro

### Fase 5: Control Remoto
- Implementar control táctil remoto
- Soporte para teclado virtual
- Control de volumen y botones físicos

### Fase 6: WebRTC (FlowDashboard Pro v2.0)
- Reemplazar scrcpy por WebRTC para mejor escalabilidad
- Soporte para múltiples usuarios por dispositivo
- Transmisión a servicios externos (YouTube, Twitch)

### Fase 7: IA y Análisis
- Detección de cambios de pantalla
- Análisis de contenido visual
- Automatización basada en visión por computadora

---

## Notas Finales

1. **No romper la arquitectura actual:** scrcpy se ejecuta en dispositivo Android, no en el servidor
2. **Mantener compatibilidad:** wsapi.js debe seguir funcionando sin streaming activo
3. **Optimizar recursos:** Limitar streaming a dispositivos seleccionados
4. **Feedback visual:** Indicar claramente cuándo un dispositivo está en streaming
5. **Error handling:** Mostrar mensajes claros cuando el streaming falle
