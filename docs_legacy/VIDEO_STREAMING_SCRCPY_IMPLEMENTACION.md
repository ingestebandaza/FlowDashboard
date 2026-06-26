# 🎥 Video Streaming con scrcpy - Implementación

**Fecha:** 2026-05-22  
**Estado:** En Progreso - Backend Completado

## 🎯 Objetivo

Reemplazar el sistema de screenshots (10-20 FPS) con **video streaming real** usando scrcpy para lograr 30-60 FPS fluidos.

## 📊 Comparación: Antes vs Después

| Aspecto | Screenshots (Actual) | Video scrcpy (Nuevo) |
|---------|---------------------|----------------------|
| **FPS** | 10-20 FPS | 30-60 FPS |
| **Latencia** | ~500ms | ~100ms |
| **Uso CPU** | Alto (captura continua) | Medio (streaming H.264) |
| **Calidad** | PNG estático | Video H.264 fluido |
| **Ancho de banda** | ~80KB por frame | ~2-8Mbps stream |

## 🏗️ Arquitectura

```
┌─────────────────┐
│   Dashboard     │
│   (Electron)    │
│                 │
│  WebSocket ←────┼──→ WebSocket Server (C#)
│  Client         │         ↓
│                 │    VideoStreamingService
│  <canvas>       │         ↓
│  Decoder        │    scrcpy Process
└─────────────────┘         ↓
                      ┌─────────────┐
                      │   Android   │
                      │   Device    │
                      │  (H.264)    │
                      └─────────────┘
```

## ✅ Backend Implementado

### 1. VideoStreamingService.cs

**Ubicación:** `FlowDashboard.Core/Services/VideoStreamingService.cs`

**Funcionalidades:**
- ✅ Iniciar proceso scrcpy con output a stdout
- ✅ Capturar stream H.264 desde stdout
- ✅ Enviar frames por WebSocket
- ✅ Gestionar múltiples streams simultáneos
- ✅ Limpieza automática de recursos

**Comando scrcpy usado:**
```bash
scrcpy -s {serial} \
  --video-codec=h264 \
  --max-size={quality} \
  --max-fps={fps} \
  --video-bit-rate={bitRate} \
  --no-audio \
  --no-control \
  --no-window \
  --video-source=display \
  --record=-  # Output a stdout
```

**Calidades soportadas:**
- 480p: 1Mbps
- 720p: 2Mbps (Recomendado)
- 1080p: 4Mbps
- 4K: 8Mbps

### 2. VideoStreamController.cs

**Ubicación:** `FlowDashboard.Core/Controllers/VideoStreamController.cs`

**Endpoints:**

#### GET `/api/videostream/ws/{serial}?quality=720&fps=30`
- Establece conexión WebSocket
- Inicia streaming de video
- Parámetros:
  - `serial`: Serial del dispositivo
  - `quality`: 480, 720, 1080, 2160 (opcional, default: 720)
  - `fps`: 15, 30, 60 (opcional, default: 30)

#### POST `/api/videostream/stop/{serial}`
- Detiene el streaming de un dispositivo

#### GET `/api/videostream/active`
- Lista dispositivos con streaming activo

### 3. Program.cs Actualizado

**Cambios:**
```csharp
// Registrar servicio
builder.Services.AddSingleton<VideoStreamingService>();

// Habilitar WebSockets
app.UseWebSockets();
```

## 🔄 Frontend - Por Implementar

### Paso 1: Conectar WebSocket

```javascript
async startVideoStream(serial) {
  const quality = this.streamQuality === '4k' ? 2160 :
                  this.streamQuality === '1080p' ? 1080 :
                  this.streamQuality === '720p' ? 720 : 480;
  
  const fps = 30;
  
  const ws = new WebSocket(
    `ws://localhost:5000/api/videostream/ws/${encodeURIComponent(serial)}?quality=${quality}&fps=${fps}`
  );
  
  ws.binaryType = 'arraybuffer';
  
  ws.onopen = () => {
    console.log(`🔌 WebSocket conectado para ${serial}`);
  };
  
  ws.onmessage = (event) => {
    // Recibir frames H.264
    this.processVideoFrame(serial, event.data);
  };
  
  ws.onerror = (error) => {
    console.error(`❌ Error WebSocket ${serial}:`, error);
  };
  
  ws.onclose = () => {
    console.log(`🔌 WebSocket cerrado para ${serial}`);
  };
  
  this.streams.find(s => s.serial === serial).ws = ws;
}
```

### Paso 2: Decodificar y Mostrar Video

**Opción A: Usar Broadway.js (Decoder H.264 en JavaScript)**

```javascript
// Instalar: npm install broadway
import Player from 'broadway';

processVideoFrame(serial, data) {
  const stream = this.streams.find(s => s.serial === serial);
  if (!stream.player) {
    const canvas = document.getElementById(`stream-canvas-${serial.replace(/[:.]/g, '_')}`);
    stream.player = new Player({
      canvas: canvas,
      webgl: true
    });
  }
  
  stream.player.decode(new Uint8Array(data));
}
```

**Opción B: Usar Media Source Extensions (MSE)**

```javascript
processVideoFrame(serial, data) {
  const stream = this.streams.find(s => s.serial === serial);
  
  if (!stream.mediaSource) {
    const video = document.getElementById(`stream-video-${serial.replace(/[:.]/g, '_')}`);
    stream.mediaSource = new MediaSource();
    video.src = URL.createObjectURL(stream.mediaSource);
    
    stream.mediaSource.addEventListener('sourceopen', () => {
      stream.sourceBuffer = stream.mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
    });
  }
  
  if (stream.sourceBuffer && !stream.sourceBuffer.updating) {
    stream.sourceBuffer.appendBuffer(data);
  }
}
```

### Paso 3: Actualizar renderStreamCard

```javascript
renderStreamCard(stream) {
  const deviceName = this.deviceNames[stream.serial] || stream.serial;
  const safeSerial = stream.serial.replace(/[:.]/g, '_');
  
  return `
    <div class="stream-card" data-serial="${stream.serial}">
      <div class="stream-header">
        <div class="stream-title">
          <span class="stream-device-name">${deviceName}</span>
          <span class="stream-serial">${this.shortSerial(stream.serial)}</span>
        </div>
        <div class="stream-fps" id="stream-fps-${safeSerial}">0 FPS</div>
        <button class="stream-stop-btn" onclick="app.stopStream('${stream.serial}')" title="Detener stream">
          ⏹
        </button>
      </div>
      <div class="stream-video-container">
        <!-- Opción A: Canvas para Broadway.js -->
        <canvas id="stream-canvas-${safeSerial}" class="stream-video"></canvas>
        
        <!-- Opción B: Video para MSE -->
        <!-- <video id="stream-video-${safeSerial}" class="stream-video" autoplay muted></video> -->
      </div>
    </div>
  `;
}
```

## 📦 Dependencias Necesarias

### Backend (Ya incluidas)
- ✅ ASP.NET Core WebSockets
- ✅ scrcpy.exe (ya instalado en `scrcpy-win64-v4.0/`)

### Frontend (Por instalar)
```bash
cd electron-app
npm install broadway  # Para decodificar H.264
```

O alternativamente, usar MSE nativo del navegador (sin dependencias).

## 🚀 Próximos Pasos

### Fase 1: ✅ Backend Completado
- [x] Crear VideoStreamingService
- [x] Crear VideoStreamController
- [x] Habilitar WebSockets
- [x] Compilar backend

### Fase 2: 🔄 Frontend (En Progreso)
- [ ] Instalar broadway o configurar MSE
- [ ] Conectar WebSocket desde dashboard
- [ ] Decodificar y mostrar video
- [ ] Actualizar UI para video

### Fase 3: ⏳ Optimizaciones
- [ ] Calcular FPS real del video
- [ ] Agregar buffer para suavizar playback
- [ ] Implementar reconexión automática
- [ ] Agregar controles de calidad en vivo

### Fase 4: ⏳ Control Táctil (Opcional)
- [ ] Detectar clicks en canvas/video
- [ ] Convertir coordenadas
- [ ] Enviar eventos touch por WebSocket
- [ ] Implementar gestos (swipe, pinch)

## 🎯 Resultado Esperado

Una vez completado, el usuario verá:

```
┌────────────────────────────────────────────┐
│  FlowDashboard Pro      ● Conectado        │
├──────────┬─────────────────────────────────┤
│ Sidebar  │  ┌──────────┐  ┌──────────┐     │
│          │  │ Disp 1   │  │ Disp 2   │     │
│ 🎬 Stream│  │ 🎥 VIDEO │  │ 🎥 VIDEO │     │
│ ▶ Iniciar│  │ 30 FPS ⏹ │  │ 30 FPS ⏹ │     │
│          │  │ [Video   │  │ [Video   │     │
│ Calidad: │  │  fluido] │  │  fluido] │     │
│ 720p ▼   │  └──────────┘  └──────────┘     │
└──────────┴─────────────────────────────────┘
```

**Ventajas sobre screenshots:**
- ✅ 3x más FPS (30 vs 10)
- ✅ 5x menos latencia (100ms vs 500ms)
- ✅ Video fluido sin saltos
- ✅ Menor uso de CPU
- ✅ Mejor experiencia de usuario

## 📝 Notas Técnicas

### ¿Por qué scrcpy?
- Optimizado para Android
- Bajo latency (~100ms)
- H.264 hardware encoding
- Open source y activamente mantenido
- Ya lo tienes instalado

### ¿Por qué WebSocket?
- Bidireccional (para control táctil futuro)
- Baja latencia
- Soporte nativo en navegadores
- Fácil de implementar

### ¿Por qué H.264?
- Soporte universal en navegadores
- Hardware decoding disponible
- Excelente compresión
- Balance perfecto calidad/tamaño

## 🐛 Troubleshooting

### Error: "scrcpy not found"
- Verificar que `scrcpy.exe` esté en `scrcpy-win64-v4.0/`
- O instalar desde: https://github.com/Genymobile/scrcpy/releases

### Error: "WebSocket connection failed"
- Verificar que el servidor C# esté corriendo
- Verificar puerto 5000 disponible
- Verificar firewall

### Video no se muestra
- Verificar que el decoder esté inicializado
- Verificar logs de consola del navegador
- Probar con calidad más baja (480p)

### FPS bajo
- Reducir calidad (720p → 480p)
- Reducir FPS (30 → 15)
- Verificar red WiFi del dispositivo
- Cerrar otros streams

---

**Estado Actual:** Backend completado y compilado. Listo para implementar frontend.
