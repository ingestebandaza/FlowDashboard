# Implementación Frontend: Screen Streaming con scrcpy

## Fase 1: MVP (Streaming Básico)

### 1. Agregar Botón de Streaming en Tarjeta de Dispositivo

**Ubicación:** En `wsapi_demo.html`, dentro de la función `renderDeviceCard()` (alrededor de línea 6178).

**Modificaciones:**

```javascript
// En renderDeviceCard(), después de los botones existentes
const streamButton = `
  <button class="device-stream-btn js-stream-btn" 
          data-serial="${id}"
          onclick="toggleScreenStream('${id}')"
          aria-label="Toggle screen streaming">
    <svg class="stream-icon" viewBox="0 0 24 24" width="16" height="16">
      <path d="M14.6 16.6L19.2 12L14.6 7.4V16.6ZM4 19H11V5H4V19Z" 
            fill="currentColor"/>
    </svg>
    <span class="stream-text">Stream</span>
  </button>
`;

// Agregar al HTML de la tarjeta, por ejemplo después de los botones de editar nombre
```

### 2. Agregar Video Element en Tarjeta

```javascript
// Video element para streaming
const videoElement = `
  <div class="device-stream-container js-stream-container" style="display: none;">
    <video class="device-screen js-device-screen" 
           data-serial="${id}"
           muted autoplay playsinline
           poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180' viewBox='0 0 320 180'%3E%3Crect width='320' height='180' fill='%23000'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23666' font-family='monospace' font-size='14'%3EScreen Streaming%3C/text%3E%3C/svg%3E">
      <!-- MediaSource API will append H.264 data here -->
    </video>
    <div class="stream-controls">
      <button class="stream-pause-btn" onclick="pauseStream('${id}')">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z" fill="currentColor"/>
        </svg>
      </button>
      <button class="stream-quality-btn" onclick="changeStreamQuality('${id}')">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path d="M12 9C10.9 9 10 9.9 10 11V13H8V11C8 9.34 9.34 8 11 8H13V6H11C9.34 6 8 7.34 8 9V11H6V9C6 6.24 8.24 4 11 4H13C15.76 4 18 6.24 18 9V11H20V9C20 6.24 17.76 4 15 4H13C12.45 4 12 4.45 12 5V9Z" fill="currentColor"/>
        </svg>
      </button>
    </div>
  </div>
`;
```

### 3. Agregar Estilos CSS

**Ubicación:** En la sección CSS de `wsapi_demo.html` (alrededor de línea 1241).

```css
/* Streaming Controls */
.device-stream-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 8px;
  background: linear-gradient(135deg, #22b86f, #12b5cb);
  color: #fff;
  font-weight: 600;
  font-size: 0.75rem;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
  border: 1px solid rgba(34, 184, 111, 0.3);
  margin-left: 4px;
}

.device-stream-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(34, 184, 111, 0.3);
}

.device-stream-btn.is-streaming {
  background: linear-gradient(135deg, #d45862, #f43f5e);
  border-color: rgba(212, 88, 98, 0.3);
}

.device-stream-btn.is-streaming:hover {
  box-shadow: 0 4px 12px rgba(212, 88, 98, 0.3);
}

.device-stream-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.stream-icon {
  width: 14px;
  height: 14px;
}

/* Video Container */
.device-stream-container {
  margin-top: 8px;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}

.device-screen {
  width: 100%;
  height: auto;
  aspect-ratio: 16/9;
  background: #000;
  display: block;
}

.stream-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px;
  background: rgba(0, 0, 0, 0.7);
}

.stream-pause-btn,
.stream-quality-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  transition: transform 0.16s ease, background 0.16s ease;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.stream-pause-btn:hover,
.stream-quality-btn:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.2);
}

/* Streaming Status Indicator */
.device-card.is-streaming {
  border-color: rgba(34, 184, 111, 0.4);
  box-shadow: 0 0 0 1px rgba(34, 184, 111, 0.2);
}

.device-card.is-streaming::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #22b86f, #12b5cb);
  border-radius: 8px 8px 0 0;
}
```

### 4. Agregar JavaScript para Streaming

**Ubicación:** En la sección JavaScript de `wsapi_demo.html` (al final del archivo).

```javascript
// ===== Screen Streaming con scrcpy =====

// Estado global de streams
const screenStreams = {};

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
    this.quality = '720p';
  }

  async start() {
    if (this.isRunning) return;

    try {
      console.log(`Iniciando streaming para dispositivo ${this.serial}`);
      
      // Configurar calidad
      const config = this.getQualityConfig(this.quality);
      
      // Iniciar streaming en servidor
      const result = await wsapi.startScreenStream({
        serial: this.serial,
        maxWidth: config.maxWidth,
        bitRate: config.bitRate,
        maxFps: config.maxFps
      });
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      console.log(`Streaming iniciado: ${JSON.stringify(result)}`);
      
      // Crear MediaSource
      this.mediaSource = new MediaSource();
      this.video.src = URL.createObjectURL(this.mediaSource);
      
      this.mediaSource.addEventListener('sourceopen', () => {
        console.log('MediaSource abierto, creando SourceBuffer');
        this.sourceBuffer = this.mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01F"');
        
        // Nota: WebSocket aún no implementado en backend
        // Por ahora mostramos mensaje de "en desarrollo"
        this.showPlaceholder();
      });
      
      this.isRunning = true;
      this.isPlaying = true;
      
      // Actualizar UI
      this.updateUI();
      
      // Mostrar contenedor de video
      const container = this.video.closest('.js-stream-container');
      if (container) {
        container.style.display = 'block';
      }
      
    } catch (error) {
      console.error('Error starting stream:', error);
      alert('Error al iniciar streaming: ' + error.message);
    }
  }

  stop() {
    if (!this.isRunning) return;

    console.log(`Deteniendo streaming para dispositivo ${this.serial}`);
    
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
      .then(result => console.log('Stream detenido:', result))
      .catch(err => console.error('Error stopping stream:', err));
    
    this.isRunning = false;
    this.isPlaying = false;
    
    // Ocultar contenedor de video
    const container = this.video.closest('.js-stream-container');
    if (container) {
      container.style.display = 'none';
    }
    
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

  showPlaceholder() {
    // Mostrar placeholder mientras implementamos WebSocket
    this.video.poster = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180' viewBox='0 0 320 180'%3E%3Crect width='320' height='180' fill='%23000'/%3E%3Ctext x='50%25' y='40%25' text-anchor='middle' fill='%234f8dff' font-family='monospace' font-size='16'%3EScreen Streaming%3C/text%3E%3Ctext x='50%25' y='60%25' text-anchor='middle' fill='%23666' font-family='monospace' font-size='12'%3EEn desarrollo%3C/text%3E%3Ctext x='50%25' y='75%25' text-anchor='middle' fill='%23999' font-family='monospace' font-size='10'%3Escrcpy v4.0%3C/text%3E%3C/svg%3E";
  }

  getQualityConfig(quality) {
    const configs = {
      '720p': { maxWidth: 1280, bitRate: 4000000, maxFps: 30 },
      '1080p': { maxWidth: 1920, bitRate: 8000000, maxFps: 30 },
      '4k': { maxWidth: 3840, bitRate: 16000000, maxFps: 30 }
    };
    return configs[quality] || configs['720p'];
  }

  updateUI() {
    const btn = document.querySelector(`.device-card[data-device-id="${this.serial}"] .js-stream-btn`);
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
        if (text) text.textContent = 'Stream';
      }
    }
    
    // Actualizar clase de la tarjeta
    const card = document.querySelector(`.device-card[data-device-id="${this.serial}"]`);
    if (card) {
      if (this.isRunning) {
        card.classList.add('is-streaming');
      } else {
        card.classList.remove('is-streaming');
      }
    }
  }
}

// Funciones globales
function toggleScreenStream(serial) {
  if (!screenStreams[serial]) {
    const video = document.querySelector(`.device-card[data-device-id="${serial}"] .js-device-screen`);
    if (!video) {
      console.error(`No se encontró video element para dispositivo ${serial}`);
      return;
    }
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

function changeStreamQuality(serial) {
  if (screenStreams[serial]) {
    // Por ahora solo cambiamos entre 720p y 1080p
    const newQuality = screenStreams[serial].quality === '720p' ? '1080p' : '720p';
    screenStreams[serial].changeQuality(newQuality);
    
    // Mostrar notificación
    alert(`Calidad cambiada a ${newQuality}`);
  }
}

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
  // Verificar si scrcpy está disponible
  setTimeout(() => {
    if (typeof wsapi !== 'undefined') {
      wsapi.getScreenStreams().then(streams => {
        console.log('Streams activos al cargar:', streams);
        streams.forEach(stream => {
          if (stream.isRunning) {
            // Restaurar estado de streams activos
            const video = document.querySelector(`.device-card[data-device-id="${stream.serial}"] .js-device-screen`);
            if (video) {
              screenStreams[stream.serial] = new ScreenStreamPlayer(stream.serial, video);
              screenStreams[stream.serial].isRunning = true;
              screenStreams[stream.serial].quality = '1080p';
              screenStreams[stream.serial].updateUI();
              
              // Mostrar contenedor
              const container = video.closest('.js-stream-container');
              if (container) {
                container.style.display = 'block';
              }
            }
          }
        });
      }).catch(err => console.error('Error loading streams:', err));
    }
  }, 2000);
});

// ===== FIN Screen Streaming =====
```

### 5. Modificar renderDeviceCard()

**Ubicación exacta:** Buscar la función `renderDeviceCard()` en `wsapi_demo.html` (alrededor de línea 6178).

**Agregar después de los botones de editar nombre:**

```javascript
// Buscar esta sección (alrededor de línea 6200):
const nameEditHtml = `
  <button class="device-name-edit-btn" onclick="editDeviceName('${id}')" aria-label="Editar nombre">
    <svg viewBox="0 0 24 24" width="14" height="14">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>
    </svg>
  </button>
`;

// Agregar después:
const streamButton = `
  <button class="device-stream-btn js-stream-btn" 
          data-serial="${id}"
          onclick="toggleScreenStream('${id}')"
          aria-label="Toggle screen streaming">
    <svg class="stream-icon" viewBox="0 0 24 24" width="14" height="14">
      <path d="M14.6 16.6L19.2 12L14.6 7.4V16.6ZM4 19H11V5H4V19Z" fill="currentColor"/>
    </svg>
    <span class="stream-text">Stream</span>
  </button>
`;

// Y agregar el video container al final del HTML de la tarjeta:
const videoContainer = `
  <div class="device-stream-container js-stream-container" style="display: none;">
    <video class="device-screen js-device-screen" 
           data-serial="${id}"
           muted autoplay playsinline
           poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180' viewBox='0 0 320 180'%3E%3Crect width='320' height='180' fill='%23000'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23666' font-family='monospace' font-size='14'%3EScreen Streaming%3C/text%3E%3C/svg%3E">
    </video>
    <div class="stream-controls">
      <button class="stream-pause-btn" onclick="pauseStream('${id}')">
        <svg viewBox="0 0 24 24" width="12" height="12">
          <path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z" fill="currentColor"/>
        </svg>
      </button>
      <button class="stream-quality-btn" onclick="changeStreamQuality('${id}')">
        <svg viewBox="0 0 24 24" width="12" height="12">
          <path d="M12 9C10.9 9 10 9.9 10 11V13H8V11C8 9.34 9.34 8 11 8H13V6H11C9.34 6 8 7.34 8 9V11H6V9C6 6.24 8.24 4 11 4H13C15.76 4 18 6.24 18 9V11H20V9C20 6.24 17.76 4 15 4H13C12.45 4 12 4.45 12 5V9Z" fill="currentColor"/>
        </svg>
      </button>
    </div>
  </div>
`;
```

### 6. Pruebas

1. **Probar backend:**
   ```bash
   python test_scrcpy_integration.py
   ```

2. **Probar frontend:**
   - Abrir `wsapi_demo.html` en navegador
   - Conectar dispositivos ADB
   - Hacer clic en botón "Stream" en una tarjeta
   - Verificar que aparece el video container
   - Verificar que el botón cambia a "Pausar"
   - Hacer clic en "Pausar" para detener streaming

### 7. Notas de Implementación

1. **Fase 1 (MVP) completa:**
   - ✅ Backend: Endpoints de scrcpy implementados
   - ✅ API: Métodos en wsapi.js agregados
   - ✅ Frontend: Botón y video container agregados
   - ✅ UI: Estilos CSS para streaming

2. **Próximas fases:**
   - **Fase 2:** Implementar WebSocket para streaming real
   - **Fase 3:** Implementar MediaSource API para H.264
   - **Fase 4:** Agregar controles avanzados y calidad variable

3. **Compatibilidad:**
   - No rompe funcionalidad existente
   - Streaming es opcional
   - Fallback a placeholder si WebSocket no está implementado

### 8. Archivos Modificados

1. `local_adb_server.py` - Endpoints de scrcpy
2. `wsapi.js` - Métodos de streaming
3. `wsapi_demo.html` - UI y JavaScript
4. `scrcpy_manager.py` - Gestión de streams
5. `test_scrcpy_integration.py` - Pruebas

### 9. Verificación

Para verificar que todo funciona:

```bash
# 1. Iniciar servidor
python local_adb_server.py

# 2. En otra terminal, probar integración
python test_scrcpy_integration.py

# 3. Abrir dashboard en navegador
#    El botón "Stream" debe aparecer en cada tarjeta de dispositivo
```

**¡Fase 1 (MVP) completada!** 🎉