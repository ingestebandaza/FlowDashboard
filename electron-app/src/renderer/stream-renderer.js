/**
 * StreamRenderer - Maneja la recepcion y renderizado de frames WebP en canvas
 * para dispositivos Android via SignalR desde el backend.
 * 
 * Características:
 * - Reconexión automática con exponential backoff
 * - Resubscripción automática tras reconexión
 * - Sincronización de estado
 * - Manejo robusto de errores
 */
class StreamRenderer {
  constructor(app) {
    this.app = app;
    this.canvases = new Map(); // serial -> canvas element
    this.contexts = new Map(); // serial -> canvas 2D context
    this.extraCanvases = new Map(); // serial -> Map(key -> { canvas, ctx })
    this.latestFrameBlobs = new Map(); // serial -> { blob, format } — usado para hidratar canvases nuevos sin esperar al siguiente frame
    this.frameSizes = new Map(); // serial -> { width, height } — tamaño real (en px) del ultimo frame decodificado
    this.connection = null;
    this.subscribedSerials = new Set();
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 5;
    this.isConnecting = false;
    this.reconnectTimer = null;
    this.frameStats = new Map(); // serial -> { count, fps, lastFrameAt, lastFrameTimestamp }
  }

  /**
   * Conecta al WebSocket del backend para recibir frames
   * Con reintentos automáticos y exponential backoff
   */
  async connectToStreamSocket() {
    console.log('🔌 StreamRenderer.connectToStreamSocket() llamado');
    
    // Evitar múltiples intentos concurrentes
    if (this.isConnecting) {
      console.warn('⚠️ Conexión ya en progreso');
      return;
    }

    // Si ya está conectado, no reconectar
    if (this.connection && this.connection.readyState === WebSocket.OPEN) {
      console.log('✅ WebSocket ya está conectado');
      return;
    }

    this.isConnecting = true;

    try {
      // Crear conexión WebSocket en puerto 5000 (backend C#)
      const wsUrl = 'ws://localhost:5000/ws/streaming';
      console.log(`🔌 Intentando conectar a ${wsUrl}`);
      
      this.connection = new WebSocket(wsUrl);

      this.connection.onopen = () => {
        console.log('✅ WebSocket streaming conectado');
        this.connectionAttempts = 0;
        this.isConnecting = false;
        this.notifyUI('streaming-connected');
        
        // Re-suscribirse a todos los dispositivos
        this.resubscribeAll();
      };

      this.connection.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'frame') {
            this.handleFrameMessage(message);
          } else if (message.type === 'pong') {
            console.log('✅ Pong recibido');
          }
        } catch (error) {
          console.error('❌ Error procesando mensaje:', error);
        }
      };

      this.connection.onerror = (error) => {
        console.error('❌ Error WebSocket:', error);
        this.notifyUI('streaming-error', { error });
      };

      this.connection.onclose = (event) => {
        console.warn(`⚠️ WebSocket cerrado: ${event.code} ${event.reason}`);
        this.isConnecting = false;
        this.notifyUI('streaming-closed', { code: event.code });
        
        // Intentar reconectar
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('❌ Error conectando WebSocket:', error);
      this.isConnecting = false;
      this.connectionAttempts++;
      
      if (this.connectionAttempts < this.maxConnectionAttempts) {
        this.scheduleReconnect();
      } else {
        console.error('❌ Máximo de intentos de conexión alcanzado');
        this.notifyUI('streaming-failed', { error, attempts: this.connectionAttempts });
      }
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Programa un reintento de conexión con exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.pow(2, Math.min(this.connectionAttempts, 4)) * 1000;
    console.log(`⏱️ Reintentando conexión en ${delay}ms (intento ${this.connectionAttempts}/${this.maxConnectionAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connectToStreamSocket().catch(error => {
        console.error('❌ Error en reintento de conexión:', error);
      });
    }, delay);
  }

  /**
   * Re-suscribe a todos los dispositivos después de reconectar
   */
  resubscribeAll() {
    console.log(`🔄 Re-suscribiendo a ${this.subscribedSerials.size} dispositivos`);
    for (const serial of this.subscribedSerials) {
      this.subscribeToDevice(serial);
    }
  }

  /**
   * Notifica a la UI sobre cambios en el estado de streaming
   */
  notifyUI(event, data = {}) {
    const customEvent = new CustomEvent('streaming-event', {
      detail: { event, ...data }
    });
    document.dispatchEvent(customEvent);
  }

  /**
   * Maneja un mensaje de frame WebP
   */
  handleFrameMessage(frame) {
    const { serial, data, format, timestamp } = frame;
    
    if (!serial || !data) {
      console.warn('⚠️ Frame incompleto recibido');
      return;
    }

    // Buscar canvas por serial directo o por androidId (el frame puede llegar con cualquiera)
    let targetSerial = serial;
    if (!this._hasCanvasForSerial(serial)) {
      // El frame llegó con androidId, buscar el serial IP en el mapping inverso
      for (const [canvasSerial] of this.canvases) {
        // Si el canvas fue suscrito con este androidId, usar ese serial
        if (this.subscribedSerials.has(serial)) {
          // Buscar qué serial IP corresponde a este androidId
          // El app.js suscribe tanto con IP como con androidId
          // Si el canvas existe con la IP, usarla
          break;
        }
      }
      // Fallback: intentar encontrar el canvas cuyo androidId coincide
      // buscando en el mapa de androidId->serial que el app mantiene
      if (this.app && this.app.deviceMappings) {
        const ipSerial = this.app.deviceMappings[serial];
        if (ipSerial && this._hasCanvasForSerial(ipSerial)) {
          targetSerial = ipSerial;
        }
      }
    }

    this.renderFrame(targetSerial, { data, format, timestamp })
      .catch((error) => {
        if (!error.message.includes('Canvas no encontrado')) {
          console.error(`❌ Error renderizando frame para ${targetSerial}:`, error);
        }
      });
  }

  /**
   * Renderiza un frame WebP en el canvas del dispositivo
   * Usa ImageBitmap para decodificación en background sin parpadeo
   */
  async renderFrame(serial, frame) {
    const canvas = this.canvases.get(serial);
    const ctx = this.contexts.get(serial);
    const extras = this.extraCanvases.get(serial);
    if ((!canvas || !ctx) && (!extras || extras.size === 0)) return;

    try {
      if (!frame.data || typeof frame.data !== 'string') return;

      const binaryString = atob(frame.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const mimeType = frame.format === 'webp' ? 'image/webp' : 'image/png';
      const blob = new Blob([bytes], { type: mimeType });

      // Guardar ultimo frame por serial para hidratar canvases nuevos sin esperar al siguiente frame
      this.latestFrameBlobs.set(serial, { blob, format: frame.format || 'webp' });

      // ImageBitmap decodifica en background y dibuja atómicamente — sin parpadeo
      const bitmap = await createImageBitmap(blob);
      // Guardar tamaño real del frame para mapeo correcto de coordenadas (FlowTouch)
      if (bitmap.width > 0 && bitmap.height > 0) {
        this.frameSizes.set(serial, { width: bitmap.width, height: bitmap.height });
      }

      // Si el H.264 renderer ya esta pintando en este canvas, NO pintar el WebP encima.
      // Ambos pintando en el mismo canvas causan parpadeo (se alternan a ~8fps cada uno).
      // El WebP sigue suscrito solo para mantener frameSize actualizado (mapeo de coords).
      const h264Session = window.app.h264Renderer.sessions.get(serial);
      const h264Stats = window.app.h264Renderer.getStats?.(serial);
      const h264FrameAge = h264Stats?.lastFrameAt ? performance.now() - h264Stats.lastFrameAt : Infinity;
      const h264Active = h264Session &&
        h264Session.ws &&
        h264Session.ws.readyState === WebSocket.OPEN &&
        h264Stats &&
        h264Stats.framesDecoded > 0 &&
        h264FrameAge < 2500;

      if (!h264Active) {
        if (canvas && ctx) {
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        }
        if (extras) {
          for (const item of extras.values()) {
            if (item.canvas && item.ctx) {
              item.ctx.drawImage(bitmap, 0, 0, item.canvas.width, item.canvas.height);
            }
          }
        }
      }
      this._recordFrameStats(serial, frame.timestamp);
      bitmap.close();
    } catch (error) {
      // Silencioso — frame descartado
    }
  }

  _hasCanvasForSerial(serial) {
    const extras = this.extraCanvases.get(serial);
    return this.canvases.has(serial) || !!(extras && extras.size > 0);
  }

  /**
   * Hidrata un canvas extra recien adjuntado con el ultimo frame conocido del serial.
   * Primero intenta decodificar el ultimo blob WebP cacheado; si no hay,
   * copia desde el canvas principal del grid si esta disponible.
   * Asi un canvas nuevo (FlowTouch Focus / Inspector) no se queda en negro
   * esperando el siguiente frame del stream para dispositivos lentos.
   */
  async _hydrateExtraCanvasFromLatest(serial, targetCanvas) {
    if (!targetCanvas) return;
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    // 1) Decodificar el ultimo blob conocido si existe
    const cached = this.latestFrameBlobs.get(serial);
    if (cached && cached.blob) {
      try {
        const bitmap = await createImageBitmap(cached.blob);
        if (bitmap.width > 0 && bitmap.height > 0 && !this.frameSizes.has(serial)) {
          this.frameSizes.set(serial, { width: bitmap.width, height: bitmap.height });
        }
        ctx.drawImage(bitmap, 0, 0, targetCanvas.width, targetCanvas.height);
        bitmap.close();
        return;
      } catch (err) {
        // si falla decode, caer al fallback
      }
    }

    // 2) Fallback: copiar del canvas principal del grid si esta pintado
    const sourceCanvas = this.canvases.get(serial);
    if (sourceCanvas && sourceCanvas.width > 0 && sourceCanvas.height > 0) {
      try {
        ctx.drawImage(sourceCanvas, 0, 0, targetCanvas.width, targetCanvas.height);
      } catch (err) {
        // ignorar — el siguiente frame del stream lo pintara
      }
    }
  }

  _recordFrameStats(serial, frameTimestamp) {
    const now = Date.now();
    const previous = this.frameStats.get(serial) || {
      count: 0,
      fps: 0,
      lastFrameAt: 0,
      lastFrameTimestamp: null,
    };
    const instantFps = previous.lastFrameAt > 0 ? 1000 / Math.max(1, now - previous.lastFrameAt) : 0;
    const fps = previous.fps > 0 && instantFps > 0
      ? (previous.fps * 0.75) + (instantFps * 0.25)
      : instantFps;
    this.frameStats.set(serial, {
      count: previous.count + 1,
      fps,
      lastFrameAt: now,
      lastFrameTimestamp: frameTimestamp || null,
    });
  }

  getFrameStats(serial) {
    const stats = this.frameStats.get(serial);
    if (!stats) {
      return {
        count: 0,
        fps: 0,
        lastFrameAt: 0,
        ageMs: null,
      };
    }
    return {
      ...stats,
      ageMs: stats.lastFrameAt ? Date.now() - stats.lastFrameAt : null,
    };
  }

  /**
   * Devuelve { width, height } del ultimo frame real recibido para el serial,
   * o null si aun no hay frame. Lo usa FlowTouch para mapear coordenadas del
   * canvas visual a coordenadas reales del display Android.
   */
  getFrameSize(serial) {
    const size = this.frameSizes.get(serial);
    if (!size || !size.width || !size.height) return null;
    return { width: size.width, height: size.height };
  }

  /**
   * Crea un canvas para un dispositivo.
   * Si se pasa `existingCanvas`, lo usa directamente en lugar de buscar un contenedor.
   */
  createCanvas(serial, width = 360, height = 720, existingCanvas = null) {
    // Modo inspector / FlowTouch Focus: usar canvas existente pasado como parámetro
    if (existingCanvas) {
      existingCanvas.width  = width;
      existingCanvas.height = height;
      existingCanvas.style.width  = '100%';
      existingCanvas.style.height = 'auto';
      existingCanvas.style.display = 'block';
      const key = existingCanvas.id || `extra-${Date.now()}`;
      if (!this.extraCanvases.has(serial)) {
        this.extraCanvases.set(serial, new Map());
      }
      this.extraCanvases.get(serial).set(key, {
        canvas: existingCanvas,
        ctx: existingCanvas.getContext('2d'),
      });
      if (!this.subscribedSerials.has(serial)) {
        this.subscribeToDevice(serial);
      }
      // Hidratar canvas extra con el ultimo frame conocido para no esperar al siguiente del stream
      this._hydrateExtraCanvasFromLatest(serial, existingCanvas);
      return existingCanvas;
    }

    // Modo normal: buscar contenedor por data-live-serial
    let container = document.querySelector(`[data-live-serial="${serial}"]`);
    if (!container) {
      console.warn(`⚠️ Contenedor no encontrado para ${serial}`);
      return null;
    }

    container.innerHTML = '';

    const canvas = document.createElement('canvas');
    canvas.className = 'device-stream-canvas';
    canvas.width = 360;
    canvas.height = 640;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';

    container.appendChild(canvas);

    this.canvases.set(serial, canvas);
    this.contexts.set(serial, canvas.getContext('2d'));

    return canvas;
  }

  detachCanvas(serial, existingCanvas = null) {
    const extras = this.extraCanvases.get(serial);
    if (!extras) return;
    const key = existingCanvas.id;
    if (key) {
      extras.delete(key);
    } else {
      extras.clear();
    }
    if (extras.size === 0) {
      this.extraCanvases.delete(serial);
    }
  }

  /**
   * Destruye el canvas de un dispositivo
   */
  destroyCanvas(serial) {
    const canvas = this.canvases.get(serial);
    if (canvas) {
      canvas.remove();
    }

    this.canvases.delete(serial);
    this.contexts.delete(serial);
    this.extraCanvases.delete(serial);
    this.latestFrameBlobs.delete(serial);
    this.frameSizes.delete(serial);
  }

  /**
   * Destruye todos los canvas
   */
  destroyAllCanvases() {
    for (const serial of this.canvases.keys()) {
      this.destroyCanvas(serial);
    }
  }

  /**
   * Cierra la conexión SignalR
   */
  disconnect() {
    if (this.connection) {
      this.connection.stop();
      this.connection = null;
    }
  }

  /**
   * Se suscribe a frames de un dispositivo
   */
  subscribeToDevice(serial) {
    if (!this.connection || this.connection.readyState !== WebSocket.OPEN) {
      console.warn(`⚠️ WebSocket no conectado, no se puede suscribir a ${serial}. Reintentando...`);
      // Reintentar después de 500ms
      setTimeout(() => this.subscribeToDevice(serial), 500);
      return;
    }

    this.subscribedSerials.add(serial);
    const message = JSON.stringify({ type: 'subscribe', serial });
    this.connection.send(message);
    console.log(`📡 Suscrito a ${serial}`);
  }

  /**
   * Se desuscribe de frames de un dispositivo
   */
  unsubscribeFromDevice(serial) {
    if (!this.connection || this.connection.readyState !== WebSocket.OPEN) {
      return;
    }

    this.subscribedSerials.delete(serial);
    const message = JSON.stringify({ type: 'unsubscribe', serial });
    this.connection.send(message);
    console.log(`📡 Desuscrito de ${serial}`);
  }
}

// Exportar para uso en app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StreamRenderer;
}
