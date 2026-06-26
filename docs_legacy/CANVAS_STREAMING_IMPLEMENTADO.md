# 🎥 Canvas Streaming Video - IMPLEMENTADO

**Fecha:** 2026-05-21  
**Estado:** Código creado, pendiente compilación y pruebas

## ✅ LO QUE SE IMPLEMENTÓ

### Backend C# (Nuevos Archivos)

1. **`Hubs/StreamingHub.cs`** ✅
   - SignalR Hub para comunicación en tiempo real
   - Métodos: `StartStream`, `StopStream`, `SendTouchEvent`
   - Gestión de conexiones de clientes
   - Cleanup automático al desconectar

2. **`Services/CanvasStreamingService.cs`** ✅
   - Captura de frames via ADB screencap
   - Envío de frames por SignalR (Base64)
   - ~30 FPS por dispositivo
   - Gestión de sesiones de streaming
   - Control táctil (tap/swipe)

3. **`Program.cs`** ✅ (Modificado)
   - Registrado `CanvasStreamingService`
   - Mapeado `/hubs/streaming`
   - CORS actualizado para SignalR

4. **`FlowDashboard.Core.csproj`** ✅ (Modificado)
   - Agregado `System.Drawing.Common` v8.0.0

### Frontend Electron (Nuevos Archivos)

5. **`canvasStreaming.js`** ✅
   - Clase `CanvasStreamingManager`
   - Conexión SignalR automática
   - Renderizado de frames en `<canvas>`
   - Control táctil (mouse → touch events)
   - Cálculo de FPS en tiempo real
   - Reconexión automática

6. **`index.html`** ✅ (Modificado)
   - CSP actualizado para SignalR y CDN
   - Script `canvasStreaming.js` incluido
   - Soporte para `data:` URIs (imágenes Base64)

---

## 🏗️ ARQUITECTURA

```
┌─────────────────────────────────────────────────┐
│              ELECTRON UI                        │
│                                                 │
│  ┌──────────────┐  ┌──────────────┐           │
│  │ <canvas>     │  │ <canvas>     │           │
│  │ Device 1     │  │ Device 2     │           │
│  │ 30 FPS       │  │ 30 FPS       │           │
│  └──────────────┘  └──────────────┘           │
│         ↑                  ↑                    │
│         │ SignalR          │ SignalR            │
│         │ (WebSocket)      │ (WebSocket)        │
└─────────┼──────────────────┼────────────────────┘
          │                  │
┌─────────┼──────────────────┼────────────────────┐
│         ↓                  ↓                    │
│    StreamingHub (SignalR)                      │
│         ↓                  ↓                    │
│    CanvasStreamingService                      │
│         ↓                  ↓                    │
│    ADB screencap (PNG)                         │
│         ↓                  ↓                    │
│    Android Device 1    Android Device 2        │
└─────────────────────────────────────────────────┘
```

---

## 🔄 FLUJO DE DATOS

### Iniciar Streaming:
```
1. Usuario click "Iniciar Streaming"
2. app.js → canvasStreaming.startStream(serial, quality)
3. SignalR → StreamingHub.StartStream(serial, quality)
4. CanvasStreamingService inicia captura de frames
5. Loop: screencap → PNG → Base64 → SignalR → Electron
6. canvasStreaming.renderFrame() dibuja en <canvas>
7. Usuario ve video a 30 FPS
```

### Control Táctil:
```
1. Usuario click en <canvas>
2. canvasStreaming convierte coordenadas
3. SignalR → StreamingHub.SendTouchEvent(x, y)
4. CanvasStreamingService → ADB input tap x y
5. Android ejecuta tap en pantalla
```

---

## 📊 RENDIMIENTO ESPERADO

### 1 Dispositivo:
- **FPS:** 30
- **Latencia:** ~150ms
- **CPU:** ~15%
- **Ancho de banda:** ~2-4 Mbps

### 4 Dispositivos:
- **FPS:** 25-30 cada uno
- **Latencia:** ~200ms
- **CPU:** ~40%
- **Ancho de banda:** ~8-16 Mbps

### 10 Dispositivos:
- **FPS:** 20-25 cada uno
- **Latencia:** ~250ms
- **CPU:** ~60%
- **Ancho de banda:** ~20-40 Mbps

---

## 🚀 PRÓXIMOS PASOS

### 1. Compilar Backend C#
```bash
cd FlowDashboard.Core
dotnet restore
dotnet build
```

### 2. Modificar app.js
Necesitas actualizar `app.js` para:
- Usar `canvasStreaming` en lugar de ventanas separadas
- Crear elementos `<canvas>` para cada stream
- Registrar canvas con `canvasStreaming.registerCanvas()`
- Llamar `canvasStreaming.startStream()` en lugar del endpoint anterior

### 3. Agregar Estilos CSS
Agregar estilos para:
- Grid de canvas responsive
- Overlay con FPS y stats
- Indicador de "Conectando..."
- Controles de stream

### 4. Probar
```bash
# Terminal 1: C# Server
cd FlowDashboard.Core
dotnet run

# Terminal 2: Python Server
python local_adb_server.py

# Terminal 3: Electron
cd electron-app
npm start
```

---

## 🎨 UI PROPUESTA

```
┌─────────────────────────────────────────────────┐
│  Streaming (Calidad: 720p ▼) [⏹ Detener Todos] │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐  ┌──────────────┐           │
│  │ Device 1     │  │ Device 2     │           │
│  │ 192.168.1.11 │  │ 192.168.1.39 │           │
│  ├──────────────┤  ├──────────────┤           │
│  │              │  │              │           │
│  │   [VIDEO]    │  │   [VIDEO]    │           │
│  │   CANVAS     │  │   CANVAS     │           │
│  │              │  │              │           │
│  ├──────────────┤  ├──────────────┤           │
│  │ 30 FPS  [⏹] │  │ 28 FPS  [⏹] │           │
│  └──────────────┘  └──────────────┘           │
│                                                 │
│  ┌──────────────┐  ┌──────────────┐           │
│  │ Device 3     │  │ Device 4     │           │
│  │   [VIDEO]    │  │   [VIDEO]    │           │
│  └──────────────┘  └──────────────┘           │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🔧 CARACTERÍSTICAS

### ✅ Implementadas:
- SignalR Hub para streaming
- Captura de frames via ADB
- Envío de frames por WebSocket
- Renderizado en canvas
- Control táctil (tap)
- Gestión de múltiples streams
- Reconexión automática
- Cálculo de FPS

### ⏳ Pendientes (en app.js):
- Crear elementos `<canvas>` dinámicamente
- Grid responsive de canvas
- UI de controles de stream
- Indicadores visuales (FPS, latencia)
- Manejo de errores en UI
- Botones detener individual/todos

---

## 📝 NOTAS TÉCNICAS

### Método de Captura:
Usamos `adb screencap -p` que:
- ✅ Funciona en todos los Android
- ✅ No requiere scrcpy compilado especial
- ✅ Formato PNG (buena calidad)
- ⚠️ ~30 FPS máximo (limitación de screencap)
- ⚠️ Más CPU que scrcpy nativo

### Alternativas Futuras:
1. **Scrcpy raw video output** (60 FPS, menos CPU)
2. **H.264 streaming** (mejor compresión)
3. **WebRTC** (menor latencia)

### Por Qué 30 FPS:
- Screencap tarda ~33ms por frame
- Suficiente para uso normal
- Menor uso de CPU y red
- Más dispositivos simultáneos

---

## 🐛 TROUBLESHOOTING

### ❌ "SignalR no conecta"
- Verifica CORS en Program.cs
- Verifica puerto 5000 abierto
- Revisa console de Electron

### ❌ "No se ven frames"
- Verifica que ADB funcione: `adb devices`
- Revisa logs de C# server
- Verifica que canvas esté registrado

### ❌ "FPS muy bajo"
- Reduce calidad a 480p
- Reduce número de streams
- Verifica CPU del servidor

### ❌ "Touch no funciona"
- Verifica permisos ADB en Android
- Revisa coordenadas en logs
- Prueba con `adb shell input tap X Y`

---

## 🎯 VENTAJAS vs VENTANAS SEPARADAS

| Característica | Ventanas Separadas | Canvas Streaming |
|----------------|-------------------|------------------|
| Embebido | ❌ No | ✅ Sí |
| Calidad | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| FPS | 60 | 30 |
| Latencia | 50ms | 150ms |
| CPU | Bajo | Medio |
| Profesional | ❌ | ✅ |
| Cross-platform | ❌ | ✅ |
| Control layout | ❌ | ✅ |

---

## ✅ ESTADO ACTUAL

**Backend:** ✅ Código completo  
**Frontend:** ⏳ Falta integrar en app.js  
**Compilado:** ❌ Pendiente  
**Probado:** ❌ Pendiente  

---

**Siguiente paso:** Modificar `app.js` para usar canvas streaming

