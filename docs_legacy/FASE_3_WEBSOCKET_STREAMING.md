# Fase 3: WebSocket Streaming - Plan de Implementación

**Fecha:** 2026-05-21  
**Estado:** 🚀 EN PROGRESO  
**Versión:** 1.0

---

## 📋 Resumen

La **Fase 3** implementa el streaming real de video H.264 desde dispositivos Android usando WebSocket y MediaSource API. Esto permite ver la pantalla de los dispositivos en tiempo real en el dashboard.

---

## 🎯 Objetivos

1. ✅ **Integración completada:** wsapi_demo.html ya tiene los scripts de streaming UI
2. 🔄 **Implementar WebSocket en backend** para streaming de video H.264
3. 🔄 **Implementar MediaSource API en frontend** para decodificar video
4. 🔄 **Probar con dispositivos reales** y optimizar latencia
5. 🔄 **Documentar** todo el proceso

---

## 🏗️ Arquitectura Fase 3

### **Backend (Python):**
```
local_adb_server.py
  ├─ Endpoint WebSocket: /ws/screen-stream/{serial}
  ├─ Lectura de H.264 desde scrcpy-server
  ├─ Envío de frames por WebSocket
  └─ Gestión de conexiones múltiples

scrcpy_manager.py
  ├─ ScrcpyStream.add_client(websocket)
  ├─ ScrcpyStream._read_data() → envía a clientes
  └─ Gestión de buffer de video
```

### **Frontend (JavaScript):**
```
streaming_ui_implementation.js
  ├─ connectScreenStream(serial)
  ├─ Crear WebSocket a /ws/screen-stream/{serial}
  ├─ Recibir frames H.264
  └─ Enviar a MediaSource API

MediaSource API
  ├─ SourceBuffer para video/mp4
  ├─ Decodificar H.264
  ├─ Renderizar en <video>
  └─ Mostrar en tarjeta de dispositivo
```

---

## 📝 Tareas Detalladas

### **Tarea 1: Implementar WebSocket en Backend**

**Archivo:** `local_adb_server.py`

**Cambios:**
1. Agregar endpoint WebSocket: `/ws/screen-stream/{serial}`
2. Usar `websockets` library para manejar conexiones
3. Integrar con `scrcpy_manager.py`:
   - Cuando cliente se conecta → `scrcpy_manager.add_client(serial, websocket)`
   - Cuando cliente se desconecta → `scrcpy_manager.remove_client(serial, websocket)`
4. Enviar frames H.264 a todos los clientes conectados

**Pseudocódigo:**
```python
@app.websocket("/ws/screen-stream/{serial}")
async def websocket_screen_stream(websocket, serial):
    try:
        stream = scrcpy_manager.get_stream(serial)
        if not stream:
            await websocket.close(code=1008, reason="Stream not found")
            return
        
        stream.add_client(websocket)
        
        # Mantener conexión abierta
        async for message in websocket:
            # Procesar mensajes del cliente (ej: control remoto)
            pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        stream.remove_client(websocket)
```

**Dependencias:**
- `websockets` (ya debería estar instalado)
- `asyncio` (built-in)

---

### **Tarea 2: Modificar ScrcpyStream para WebSocket**

**Archivo:** `scrcpy_manager.py`

**Cambios:**
1. Agregar lista de clientes WebSocket: `self.clients = []`
2. Método `add_client(websocket)` → agregar a lista
3. Método `remove_client(websocket)` → remover de lista
4. En `_read_data()`:
   - Leer frames H.264 del socket
   - Enviar a todos los clientes: `await websocket.send(frame_data)`
5. Manejar excepciones de desconexión

**Pseudocódigo:**
```python
class ScrcpyStream:
    def __init__(self, ...):
        self.clients = []  # Lista de WebSockets
    
    def add_client(self, websocket):
        self.clients.append(websocket)
    
    def remove_client(self, websocket):
        if websocket in self.clients:
            self.clients.remove(websocket)
    
    async def _read_data(self):
        while self.is_running:
            try:
                frame = self.socket.recv(65536)
                if frame:
                    # Enviar a todos los clientes
                    for client in self.clients:
                        try:
                            await client.send(frame)
                        except:
                            self.remove_client(client)
            except:
                break
```

---

### **Tarea 3: Implementar MediaSource API en Frontend**

**Archivo:** `streaming_ui_implementation.js`

**Cambios:**
1. Función `connectScreenStream(serial)`:
   - Crear WebSocket a `/ws/screen-stream/{serial}`
   - Crear `<video>` element
   - Crear `MediaSource` object
   - Crear `SourceBuffer` para video/mp4

2. Función `handleScreenStreamFrame(frame)`:
   - Recibir frame H.264 del WebSocket
   - Agregar a `SourceBuffer`
   - Reproducir video

3. Función `disconnectScreenStream(serial)`:
   - Cerrar WebSocket
   - Limpiar `MediaSource`
   - Detener video

**Pseudocódigo:**
```javascript
function connectScreenStream(serial) {
  const video = document.createElement('video');
  const mediaSource = new MediaSource();
  
  video.src = URL.createObjectURL(mediaSource);
  
  mediaSource.addEventListener('sourceopen', () => {
    const sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
    
    const ws = new WebSocket(`ws://localhost:8765/ws/screen-stream/${serial}`);
    
    ws.onmessage = (event) => {
      const frame = event.data;
      sourceBuffer.appendBuffer(frame);
    };
    
    ws.onerror = () => {
      mediaSource.endOfStream();
    };
  });
  
  return video;
}
```

---

### **Tarea 4: Integrar Video en Tarjetas**

**Archivo:** `streaming_ui_implementation.js`

**Cambios:**
1. En `createStreamingDeviceCard(device)`:
   - Crear contenedor para video
   - Llamar a `connectScreenStream(device.serial)`
   - Insertar `<video>` en tarjeta

2. En `selectStreamingDevice(deviceId)`:
   - Conectar stream del dispositivo seleccionado
   - Mostrar video en tiempo real

3. En `showStreamingDeviceMenu(deviceId)`:
   - Agregar opción "Detener streaming"
   - Llamar a `disconnectScreenStream(deviceId)`

---

### **Tarea 5: Optimización y Pruebas**

**Optimizaciones:**
1. Buffer management: Evitar acumulación de frames
2. Latencia: Medir y optimizar
3. Recursos: Monitorear CPU/memoria
4. Reconexión automática si se cae

**Pruebas:**
1. Conectar 1 dispositivo → verificar video
2. Conectar 5 dispositivos → verificar múltiples streams
3. Medir latencia con cronómetro
4. Probar desconexión/reconexión
5. Probar en diferentes resoluciones

---

## 📊 Especificaciones Técnicas

### **WebSocket:**
- **Protocolo:** WebSocket (ws://)
- **Endpoint:** `/ws/screen-stream/{serial}`
- **Formato:** Binary (H.264 frames)
- **Tamaño frame:** ~65KB (configurable)
- **Latencia esperada:** 100-200ms

### **MediaSource API:**
- **Codec:** H.264 (AVC)
- **Container:** MP4
- **Resolución:** 720p, 1080p, 4K
- **FPS:** 30-60 fps
- **Bitrate:** 2-8 Mbps

### **Rendimiento:**
- **CPU (servidor):** < 10% por stream
- **CPU (cliente):** < 15% por stream
- **Memoria (servidor):** ~50MB por stream
- **Memoria (cliente):** ~100MB por stream
- **Ancho de banda:** 2-8 Mbps por stream

---

## 🔧 Implementación Paso a Paso

### **Paso 1: Preparar Backend**
- [ ] Revisar `scrcpy_manager.py`
- [ ] Agregar soporte para WebSocket
- [ ] Agregar métodos `add_client()` y `remove_client()`
- [ ] Modificar `_read_data()` para enviar a clientes

### **Paso 2: Preparar Endpoint WebSocket**
- [ ] Agregar endpoint en `local_adb_server.py`
- [ ] Integrar con `scrcpy_manager`
- [ ] Manejar conexiones/desconexiones
- [ ] Probar con cliente WebSocket simple

### **Paso 3: Implementar Frontend**
- [ ] Agregar función `connectScreenStream()`
- [ ] Agregar función `handleScreenStreamFrame()`
- [ ] Agregar función `disconnectScreenStream()`
- [ ] Integrar MediaSource API

### **Paso 4: Integrar en UI**
- [ ] Modificar `createStreamingDeviceCard()`
- [ ] Agregar video a tarjetas
- [ ] Conectar streams automáticamente
- [ ] Agregar controles de reproducción

### **Paso 5: Pruebas**
- [ ] Prueba unitaria: WebSocket conecta
- [ ] Prueba unitaria: Frames se reciben
- [ ] Prueba integración: Video se muestra
- [ ] Prueba rendimiento: Múltiples streams
- [ ] Prueba real: Con dispositivos Android

### **Paso 6: Documentación**
- [ ] Actualizar `PROJECT_CONTEXT.md`
- [ ] Crear guía de troubleshooting
- [ ] Documentar API WebSocket
- [ ] Crear ejemplos de uso

---

## 🧪 Plan de Pruebas

### **Prueba 1: Conexión WebSocket**
```javascript
const ws = new WebSocket('ws://localhost:8765/ws/screen-stream/emulator-5554');
ws.onopen = () => console.log('Conectado');
ws.onmessage = (e) => console.log('Frame recibido:', e.data.length);
```

### **Prueba 2: MediaSource API**
```javascript
const video = document.createElement('video');
const ms = new MediaSource();
video.src = URL.createObjectURL(ms);
ms.addEventListener('sourceopen', () => {
  const sb = ms.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
  // Agregar frames
});
```

### **Prueba 3: Integración Completa**
1. Abrir dashboard
2. Activar modo streaming
3. Hacer clic en dispositivo
4. Verificar que video aparece
5. Medir latencia

---

## 📈 Métricas de Éxito

- ✅ WebSocket conecta correctamente
- ✅ Frames se reciben sin errores
- ✅ Video se muestra en tiempo real
- ✅ Latencia < 200ms
- ✅ Múltiples streams funcionan simultáneamente
- ✅ Reconexión automática funciona
- ✅ No rompe funcionalidad existente

---

## 🚀 Próximos Pasos (Fase 4)

Después de completar Fase 3:

1. **Control Táctil Remoto**
   - Capturar clicks en video
   - Enviar coordenadas al dispositivo
   - Ejecutar acciones (tap, swipe, etc.)

2. **Audio Streaming**
   - Capturar audio del dispositivo
   - Enviar por WebSocket
   - Reproducir en cliente

3. **Grabación de Pantalla**
   - Grabar video en servidor
   - Descargar desde cliente
   - Reproducir localmente

4. **Transmisión a Servicios Externos**
   - RTMP a Twitch/YouTube
   - HLS a servidores
   - WebRTC a otros clientes

---

## 📞 Soporte

Para preguntas o problemas durante la implementación:

1. Revisar documentación de WebSocket
2. Revisar documentación de MediaSource API
3. Revisar ejemplos en `test_scrcpy_integration.py`
4. Ejecutar pruebas paso a paso

---

**Implementado por:** Kiro AI  
**Fecha:** 2026-05-21  
**Versión:** 1.0  
**Estado:** 🚀 EN PROGRESO

¡Vamos a implementar el streaming real! 🎬
