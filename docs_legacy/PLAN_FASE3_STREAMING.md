# Plan FASE 3 - Streaming Embebido

## 🎯 Objetivo

Integrar las ventanas de scrcpy dentro de Electron para ver las pantallas de los dispositivos directamente en el dashboard, sin ventanas separadas.

## 🏗️ Arquitectura Actual vs Nueva

### Actual (FASE 1-2)
```
Usuario click "Iniciar Streaming"
    ↓
Electron → C# API → ScrcpyService
    ↓
Scrcpy abre ventanas SEPARADAS de Windows
    ↓
Usuario ve ventanas flotantes fuera del dashboard
```

### Nueva (FASE 3)
```
Usuario click "Iniciar Streaming"
    ↓
Electron → C# API → ScrcpyService
    ↓
Scrcpy abre ventanas sin borde
    ↓
Electron captura window handles
    ↓
Electron embebe ventanas dentro del dashboard
    ↓
Usuario ve pantallas DENTRO del dashboard
```

## 🔧 Tecnologías a Usar

### Opción A: Electron BrowserView (Recomendado) ⭐
**Ventajas:**
- ✅ Nativo de Electron
- ✅ Mejor rendimiento
- ✅ Más control sobre posicionamiento
- ✅ Fácil de implementar

**Desventajas:**
- ⚠️ Requiere window handles de scrcpy
- ⚠️ Solo funciona en Windows (pero ya estamos en Windows)

### Opción B: WebRTC + FFmpeg
**Ventajas:**
- ✅ Multiplataforma
- ✅ Streaming real en canvas

**Desventajas:**
- ❌ Muy complejo
- ❌ Requiere recodificar video
- ❌ Mayor latencia
- ❌ Más recursos

### Opción C: Electron + Native Modules
**Ventajas:**
- ✅ Control total

**Desventajas:**
- ❌ Requiere compilar módulos nativos
- ❌ Muy complejo

## 📋 Plan de Implementación

### Paso 1: Preparar ScrcpyService (C#) ✅
**Ya está listo:**
- ✅ Método `StartStream()` con configuración
- ✅ Ventanas sin borde (`--window-borderless`)
- ✅ Posicionamiento (`--window-x`, `--window-y`)
- ✅ Tamaño (`--window-width`, `--window-height`)
- ✅ Window handles disponibles

### Paso 2: Crear Streaming Controller (C#)
**Nuevo endpoint:**
- `POST /api/streaming/start-embedded`
- Parámetros: serials[], layout config
- Respuesta: window handles + posiciones

**Funcionalidad:**
- Calcular layout automático (grid)
- Iniciar scrcpy con ventanas sin borde
- Retornar window handles para Electron

### Paso 3: Actualizar Electron Main Process
**Agregar:**
- IPC handler para embeber ventanas
- Método para capturar window handles
- Método para posicionar ventanas dentro de Electron

**Usar:**
- `electron-window-manager` o similar
- Win32 API via `ffi-napi`

### Paso 4: Actualizar Electron Renderer
**Modificar `app.js`:**
- Método `startStreamingEmbedded()`
- Crear contenedores para cada stream
- Comunicar con main process via IPC
- Actualizar UI con streams embebidos

**Modificar `styles.css`:**
- Estilos para contenedores de streams
- Grid responsive
- Controles de calidad

### Paso 5: Agregar Controles
**Implementar:**
- Selector de calidad (720p, 1080p, 4k)
- Botón detener stream individual
- Botón detener todos
- Indicador de FPS/latencia

## 🎨 Diseño UI

### Layout de Streams

```
┌──────────────────────────────────────────────────────────┐
│ 🎬 Streaming                                             │
│ [Calidad: 720p ▼] [⏹ Detener Todos]                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │                 │  │                 │              │
│  │  Device 1       │  │  Device 2       │              │
│  │  192.168.1.11   │  │  192.168.1.12   │              │
│  │                 │  │                 │              │
│  │  [Stream aquí]  │  │  [Stream aquí]  │              │
│  │                 │  │                 │              │
│  │                 │  │                 │              │
│  └─────────────────┘  └─────────────────┘              │
│  [⏹ Detener]          [⏹ Detener]                      │
│                                                          │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │                 │  │                 │              │
│  │  Device 3       │  │  Device 4       │              │
│  │  192.168.1.13   │  │  192.168.1.14   │              │
│  │                 │  │                 │              │
│  │  [Stream aquí]  │  │  [Stream aquí]  │              │
│  │                 │  │                 │              │
│  │                 │  │                 │              │
│  └─────────────────┘  └─────────────────┘              │
│  [⏹ Detener]          [⏹ Detener]                      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Calidades Disponibles

```javascript
const QUALITIES = [
  { label: '480p', maxSize: 480, bitRate: '2M', fps: 30 },
  { label: '720p', maxSize: 720, bitRate: '4M', fps: 30 },
  { label: '1080p', maxSize: 1080, bitRate: '8M', fps: 30 },
  { label: '4K', maxSize: 2160, bitRate: '16M', fps: 30 }
];
```

## 🔌 APIs Necesarias

### C# API

#### POST /api/streaming/start-embedded
```json
Request:
{
  "serials": ["192.168.1.11:5555", "192.168.1.12:5555"],
  "quality": "720p",
  "layout": {
    "columns": 2,
    "containerWidth": 1200,
    "containerHeight": 800
  }
}

Response:
{
  "streams": [
    {
      "serial": "192.168.1.11:5555",
      "processId": 12345,
      "windowHandle": "0x00012345",
      "x": 0,
      "y": 0,
      "width": 360,
      "height": 720
    },
    {
      "serial": "192.168.1.12:5555",
      "processId": 12346,
      "windowHandle": "0x00012346",
      "x": 372,
      "y": 0,
      "width": 360,
      "height": 720
    }
  ]
}
```

#### POST /api/streaming/stop
```json
Request:
{
  "serial": "192.168.1.11:5555"
}

Response:
{
  "success": true,
  "message": "Stream detenido"
}
```

#### POST /api/streaming/stop-all
```json
Response:
{
  "success": true,
  "stopped": 4
}
```

### Electron IPC

#### embed-window
```javascript
// Renderer → Main
ipcRenderer.invoke('embed-window', {
  windowHandle: '0x00012345',
  containerId: 'stream-container-1',
  width: 360,
  height: 720
});
```

#### detach-window
```javascript
// Renderer → Main
ipcRenderer.invoke('detach-window', {
  windowHandle: '0x00012345'
});
```

## 📝 Archivos a Modificar/Crear

### C# Backend
1. ✅ `ScrcpyService.cs` - Ya existe, solo ajustar
2. 🆕 `Controllers/StreamingController.cs` - Crear nuevo
3. 🆕 `Models/StreamConfig.cs` - Crear modelo
4. 🆕 `Models/StreamInfo.cs` - Crear modelo

### Electron Main
1. ✏️ `src/main/index.js` - Agregar IPC handlers
2. 🆕 `src/main/windowManager.js` - Crear gestor de ventanas

### Electron Renderer
1. ✏️ `src/renderer/app.js` - Agregar métodos de streaming
2. ✏️ `src/renderer/styles.css` - Agregar estilos de streams
3. ✏️ `src/renderer/index.html` - Ya tiene contenedor

### Electron Preload
1. ✏️ `preload/preload.js` - Exponer APIs de streaming

## ⚠️ Desafíos Técnicos

### 1. Window Embedding en Electron
**Problema:** Electron no soporta nativamente embeber ventanas externas

**Solución:**
- Usar `ffi-napi` para llamar Win32 API
- `SetParent()` para cambiar padre de ventana
- `MoveWindow()` para posicionar

### 2. Sincronización de Posiciones
**Problema:** Ventanas pueden desincronizarse al resize

**Solución:**
- Listener de resize en Electron
- Recalcular posiciones
- Actualizar con `MoveWindow()`

### 3. Z-Order (Orden de Capas)
**Problema:** Ventanas pueden quedar detrás

**Solución:**
- `SetWindowPos()` con `HWND_TOP`
- Mantener siempre al frente

### 4. Cleanup al Cerrar
**Problema:** Ventanas pueden quedar huérfanas

**Solución:**
- Hook `before-quit` en Electron
- Detener todos los streams
- Matar procesos de scrcpy

## 🧪 Plan de Pruebas

### Prueba 1: Stream Individual
```
1. Seleccionar 1 dispositivo
2. Click "Iniciar Streaming"
3. Ver stream embebido en dashboard
4. Verificar que no hay ventana separada
5. Click "Detener"
6. Verificar que stream se cierra
```

### Prueba 2: Múltiples Streams
```
1. Seleccionar 4 dispositivos
2. Click "Iniciar Streaming"
3. Ver 4 streams en grid 2x2
4. Verificar posicionamiento correcto
5. Resize ventana de Electron
6. Verificar que streams se reposicionan
```

### Prueba 3: Cambio de Calidad
```
1. Iniciar stream en 720p
2. Cambiar a 1080p
3. Verificar que stream se reinicia
4. Verificar mejor calidad
```

### Prueba 4: Cleanup
```
1. Iniciar 4 streams
2. Cerrar Electron (X)
3. Verificar que no quedan procesos scrcpy
4. Verificar que no quedan ventanas huérfanas
```

## 📊 Estimación de Tiempo

### Implementación Base (2-3 horas)
- ✅ C# Controller: 30 min
- ✅ Electron IPC: 30 min
- ✅ Window Embedding: 1 hora
- ✅ UI Básica: 30 min

### Features Adicionales (1-2 horas)
- ⏳ Selector de calidad: 30 min
- ⏳ Controles individuales: 30 min
- ⏳ Resize handling: 30 min
- ⏳ Cleanup robusto: 30 min

### Testing y Debugging (1 hora)
- ⏳ Pruebas básicas: 30 min
- ⏳ Edge cases: 30 min

**Total: 4-6 horas**

## 🎯 Criterios de Éxito

### Funcionalidad
- [ ] Streams se muestran dentro de Electron
- [ ] No hay ventanas separadas
- [ ] Grid responsive funciona
- [ ] Selector de calidad funciona
- [ ] Detener individual funciona
- [ ] Detener todos funciona
- [ ] Resize mantiene posiciones
- [ ] Cleanup al cerrar funciona

### Performance
- [ ] Latencia < 100ms
- [ ] FPS estable (30 fps)
- [ ] CPU < 50% con 4 streams
- [ ] Memoria < 500MB con 4 streams

### UX
- [ ] Interfaz intuitiva
- [ ] Feedback visual claro
- [ ] Sin glitches visuales
- [ ] Controles accesibles

## 🚀 Orden de Implementación

1. **Crear C# Controller** (30 min)
2. **Agregar IPC Handlers** (30 min)
3. **Implementar Window Embedding** (1 hora)
4. **Actualizar UI** (30 min)
5. **Agregar Controles** (1 hora)
6. **Testing** (1 hora)

---

**Tiempo total estimado:** 4-6 horas
**Complejidad:** Alta
**Prioridad:** Alta (feature principal)
