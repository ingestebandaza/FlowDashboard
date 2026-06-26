// Canvas Streaming Module
// Maneja conexión SignalR y renderizado de video en canvas

class CanvasStreamingManager {
  constructor() {
    this.connection = null;
    this.streams = new Map(); // serial -> { canvas, ctx, lastFrame }
    this.connected = false;
  }

  async connect() {
    if (this.connected) {
      console.log('✅ Ya conectado a SignalR Streaming');
      return;
    }

    try {
      // Cargar SignalR desde CDN
      if (typeof signalR === 'undefined') {
        await this.loadSignalR();
      }

      this.connection = new signalR.HubConnectionBuilder()
        .withUrl('http://localhost:5000/hubs/streaming')
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Information)
        .build();

      // Manejar frames recibidos
      this.connection.on('ReceiveFrame', (serial, frameBase64) => {
        this.renderFrame(serial, frameBase64);
      });

      // Manejar reconexión
      this.connection.onreconnecting(() => {
        console.log('🔄 Reconectando SignalR Streaming...');
        this.connected = false;
      });

      this.connection.onreconnected(() => {
        console.log('✅ SignalR Streaming reconectado');
        this.connected = true;
        // Reiniciar streams activos
        this.restartActiveStreams();
      });

      this.connection.onclose(() => {
        console.log('❌ SignalR Streaming desconectado');
        this.connected = false;
      });

      await this.connection.start();
      this.connected = true;
      console.log('✅ Conectado a SignalR Streaming');
    } catch (error) {
      console.error('❌ Error conectando SignalR Streaming:', error);
      throw error;
    }
  }

  async loadSignalR() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@microsoft/signalr@7.0.0/dist/browser/signalr.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async startStream(serial, quality = '720p') {
    if (!this.connected) {
      await this.connect();
    }

    try {
      console.log(`📹 Iniciando stream canvas para ${serial} (${quality})`);
      
      const result = await this.connection.invoke('StartStream', serial, quality);
      
      if (result === 'success') {
        console.log(`✅ Stream iniciado para ${serial}`);
        return { success: true, serial };
      } else {
        throw new Error(result);
      }
    } catch (error) {
      console.error(`❌ Error iniciando stream ${serial}:`, error);
      throw error;
    }
  }

  async stopStream(serial) {
    if (!this.connected) {
      return;
    }

    try {
      console.log(`⏹ Deteniendo stream para ${serial}`);
      
      await this.connection.invoke('StopStream', serial);
      
      // Limpiar canvas
      if (this.streams.has(serial)) {
        const stream = this.streams.get(serial);
        if (stream.ctx) {
          stream.ctx.clearRect(0, 0, stream.canvas.width, stream.canvas.height);
        }
        this.streams.delete(serial);
      }
      
      console.log(`✅ Stream detenido para ${serial}`);
    } catch (error) {
      console.error(`❌ Error deteniendo stream ${serial}:`, error);
    }
  }

  registerCanvas(serial, canvas) {
    const ctx = canvas.getContext('2d');
    
    this.streams.set(serial, {
      canvas,
      ctx,
      lastFrame: null,
      frameCount: 0,
      lastFpsUpdate: Date.now()
    });

    // Agregar eventos de touch
    this.setupTouchEvents(serial, canvas);

    console.log(`📺 Canvas registrado para ${serial}`);
  }

  unregisterCanvas(serial) {
    if (this.streams.has(serial)) {
      this.streams.delete(serial);
      console.log(`📺 Canvas desregistrado para ${serial}`);
    }
  }

  renderFrame(serial, frameBase64) {
    const stream = this.streams.get(serial);
    if (!stream) {
      return;
    }

    const img = new Image();
    img.onload = () => {
      // Limpiar canvas
      stream.ctx.clearRect(0, 0, stream.canvas.width, stream.canvas.height);
      
      // Calcular dimensiones manteniendo aspect ratio
      const canvasRatio = stream.canvas.width / stream.canvas.height;
      const imgRatio = img.width / img.height;
      
      let drawWidth, drawHeight, offsetX, offsetY;
      
      if (imgRatio > canvasRatio) {
        // Imagen más ancha
        drawWidth = stream.canvas.width;
        drawHeight = drawWidth / imgRatio;
        offsetX = 0;
        offsetY = (stream.canvas.height - drawHeight) / 2;
      } else {
        // Imagen más alta
        drawHeight = stream.canvas.height;
        drawWidth = drawHeight * imgRatio;
        offsetX = (stream.canvas.width - drawWidth) / 2;
        offsetY = 0;
      }
      
      // Dibujar imagen
      stream.ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      
      // Actualizar stats
      stream.frameCount++;
      stream.lastFrame = Date.now();
      
      // Calcular FPS cada segundo
      const now = Date.now();
      if (now - stream.lastFpsUpdate >= 1000) {
        const fps = stream.frameCount;
        stream.frameCount = 0;
        stream.lastFpsUpdate = now;
        
        // Actualizar UI con FPS
        this.updateStreamStats(serial, fps);
      }
    };
    
    img.src = 'data:image/png;base64,' + frameBase64;
  }

  setupTouchEvents(serial, canvas) {
    let isDown = false;
    let startX = 0;
    let startY = 0;

    canvas.addEventListener('mousedown', (e) => {
      isDown = true;
      const rect = canvas.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
    });

    canvas.addEventListener('mouseup', async (e) => {
      if (!isDown) return;
      isDown = false;

      const rect = canvas.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endY = e.clientY - rect.top;

      // Convertir coordenadas de canvas a coordenadas de dispositivo
      const deviceX = Math.round((endX / canvas.width) * 1080); // Asumiendo 1080p
      const deviceY = Math.round((endY / canvas.height) * 1920);

      // Determinar si es tap o swipe
      const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
      const eventType = distance < 10 ? 'tap' : 'swipe';

      try {
        await this.connection.invoke('SendTouchEvent', serial, eventType, deviceX, deviceY);
      } catch (error) {
        console.error('Error enviando touch event:', error);
      }
    });

    canvas.addEventListener('mouseleave', () => {
      isDown = false;
    });
  }

  updateStreamStats(serial, fps) {
    const statsElement = document.getElementById(`stream-stats-${serial}`);
    if (statsElement) {
      statsElement.textContent = `${fps} FPS`;
    }
  }

  async restartActiveStreams() {
    // Reiniciar streams que estaban activos antes de desconectar
    for (const [serial, stream] of this.streams) {
      try {
        await this.startStream(serial, '720p');
      } catch (error) {
        console.error(`Error reiniciando stream ${serial}:`, error);
      }
    }
  }

  async disconnect() {
    if (this.connection) {
      // Detener todos los streams
      for (const serial of this.streams.keys()) {
        await this.stopStream(serial);
      }

      await this.connection.stop();
      this.connected = false;
      console.log('👋 Desconectado de SignalR Streaming');
    }
  }
}

// Exportar instancia global
window.canvasStreaming = new CanvasStreamingManager();
