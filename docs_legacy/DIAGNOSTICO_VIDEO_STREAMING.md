# 🔍 Diagnóstico: Video Streaming No Funciona

## Síntomas
- Pantalla negra
- 0 FPS
- No se ve video

## Pasos de Diagnóstico

### 1. Verificar que el Dashboard se Recargó
**Acción:** Presiona **Ctrl+Shift+R** (recarga forzada) en el dashboard

### 2. Abrir DevTools
**Acción:** Presiona **F12** en el dashboard

### 3. Ver Consola
**Acción:** Ve a la pestaña **Console**

### 4. Iniciar Streaming
**Acción:** Click en "Iniciar Streaming"

### 5. Buscar Mensajes Clave

#### ✅ Mensajes Esperados (Si funciona):
```
🎬 Iniciando video streaming para: ["192.168.1.11:5555"]
🔌 Conectando WebSocket: ws://localhost:5000/api/videostream/ws/192.168.1.11%3A5555?quality=720&fps=30
✅ WebSocket conectado para 192.168.1.11:5555
✅ Broadway player inicializado para 192.168.1.11:5555
```

#### ❌ Errores Comunes:

**Error 1: "Broadway Player no está cargado"**
```
❌ Broadway Player no está cargado
```
**Solución:** Los scripts de Broadway no se cargaron
- Verificar que `index.html` tenga los scripts
- Verificar que `node_modules/broadway` exista

**Error 2: "WebSocket connection failed"**
```
WebSocket connection to 'ws://localhost:5000/...' failed
```
**Solución:** El servidor no está aceptando WebSockets
- Verificar que el servidor C# esté corriendo
- Verificar logs del servidor

**Error 3: "Canvas no encontrado"**
```
❌ Canvas no encontrado para 192.168.1.11:5555
```
**Solución:** El canvas no se renderizó
- Verificar que `renderStreamCard` use `<canvas>`
- Verificar que el ID sea correcto

**Error 4: "Player is undefined"**
```
ReferenceError: Player is not defined
```
**Solución:** Broadway no se cargó
- Verificar rutas de scripts en `index.html`
- Verificar que npm install broadway funcionó

### 6. Verificar Servidor C#

**Acción:** Ver logs del servidor C#

#### ✅ Logs Esperados:
```
🔌 WebSocket conectado para 192.168.1.11:5555
✅ Scrcpy encontrado: C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\scrcpy.exe
🎥 Video stream iniciado para 192.168.1.11:5555 (720p @ 30fps)
```

#### ❌ Si no ves estos logs:
- El WebSocket no se está conectando
- Problema en el middleware de WebSocket

### 7. Verificar Broadway

**Acción:** En la consola del dashboard, escribe:
```javascript
typeof Player
```

#### ✅ Resultado esperado:
```
"function"
```

#### ❌ Si dice "undefined":
- Broadway no se cargó
- Verificar scripts en index.html

### 8. Verificar Canvas

**Acción:** En la consola del dashboard, escribe:
```javascript
document.getElementById('stream-canvas-192_168_1_11_5555')
```
(Reemplaza con el serial correcto)

#### ✅ Resultado esperado:
```
<canvas id="stream-canvas-192_168_1_11_5555" ...>
```

#### ❌ Si dice "null":
- El canvas no se renderizó
- Problema en renderStreamCard

## Soluciones Rápidas

### Solución 1: Recargar Todo
```bash
# Cerrar dashboard
# Detener servidor C#
# Reiniciar servidor C#
cd c:\DASHBOARD\FlowDashboard\FlowDashboard.Core
dotnet run

# Abrir dashboard
cd c:\DASHBOARD\FlowDashboard\electron-app
npm start
```

### Solución 2: Verificar Broadway
```bash
cd c:\DASHBOARD\FlowDashboard\electron-app
npm list broadway
```

Debería mostrar:
```
broadway@0.9.10
```

### Solución 3: Reinstalar Broadway
```bash
cd c:\DASHBOARD\FlowDashboard\electron-app
npm uninstall broadway
npm install broadway
```

### Solución 4: Volver a Screenshots (Fallback)
Si el video H.264 no funciona, podemos optimizar los screenshots:
- Cambiar PNG → JPEG (3x más rápido)
- Usar WebSocket en lugar de HTTP
- Resultado: 30-40 FPS (mejor que los 10-20 actuales)

## Información Necesaria para Diagnosticar

Por favor proporciona:

1. **Mensajes de la consola del dashboard** (F12 → Console)
2. **Logs del servidor C#** (últimas 50 líneas)
3. **Resultado de `typeof Player`** en la consola
4. **Resultado de buscar el canvas** en la consola

Con esta información puedo identificar exactamente qué está fallando.
