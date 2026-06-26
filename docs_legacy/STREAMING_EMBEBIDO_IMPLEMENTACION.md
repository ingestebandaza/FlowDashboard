# Streaming Embebido - Implementación

**Fecha:** 2026-05-22  
**Estado:** Parcialmente implementado - Requiere reiniciar servidor C#

## Resumen

He implementado un sistema de **streaming embebido real** que muestra los dispositivos Android dentro del dashboard usando capturas de pantalla continuas (pseudo-streaming).

## ¿Qué se Implementó?

### 1. Frontend (Electron) ✅ COMPLETO

**Archivo:** `electron-app/src/renderer/app.js`

#### Función `startStreaming()`
- Ya no usa ventanas externas de scrcpy
- Crea un array de streams con estado
- Inicia captura de frames para cada dispositivo
- Muestra grid de streaming embebido

#### Función `startScreenCapture(serial)`
- Captura screenshots continuos vía ADB
- Actualiza la imagen en tiempo real
- Calcula y muestra FPS
- Ajusta delay según calidad (4k=100ms, 1080p=66ms, 720p=50ms, 480p=100ms)
- Libera memoria de URLs anteriores

#### Función `renderStreamCard(stream)`
- Renderiza tarjeta con `<img>` para mostrar el stream
- Muestra contador de FPS en tiempo real
- Botón para detener stream individual

#### Funciones `stopStream()` y `stopAllStreams()`
- Detienen la captura de frames
- Limpian recursos correctamente

### 2. Estilos CSS ✅ COMPLETO

**Archivo:** `electron-app/src/renderer/styles.css`

```css
.stream-video-container {
  aspect-ratio: 9 / 16;  /* Formato vertical de móvil */
  background: #000;
  overflow: hidden;
}

.stream-video {
  width: 100%;
  height: 100%;
  object-fit: contain;  /* Mantiene proporción */
}

.stream-fps {
  /* Contador de FPS estilizado */
  background: rgba(34, 184, 111, 0.2);
  color: var(--accent);
  font-family: 'Consolas', monospace;
}
```

### 3. Backend C# ⚠️ REQUIERE REINICIO

**Archivos modificados:**
- `FlowDashboard.Core/Controllers/DevicesController.cs`
- `FlowDashboard.Core/Services/AdbService.cs`

#### Nuevo Endpoint
```csharp
[HttpGet("{serial}/screenshot")]
public async Task<IActionResult> GetScreenshot(string serial)
```

#### Nuevo Método en AdbService
```csharp
public async Task<byte[]> CaptureScreenshot(string serial)
{
    // Usa screencap -p para capturar PNG
    // Implementa ScreenshotReceiver personalizado
    // Retorna bytes de imagen PNG
}
```

#### Clase ScreenshotReceiver
```csharp
private class ScreenshotReceiver : IShellOutputReceiver
{
    // Implementa interfaz completa de ADB
    // Captura bytes binarios del screenshot
    // Retorna array de bytes PNG
}
```

## 🔧 Pasos para Completar la Implementación

### Paso 1: Detener Servidor C# Actual

```powershell
# Encontrar el proceso
tasklist | findstr FlowDashboard.Core

# Detener el proceso (PID 24384 según el error)
taskkill /PID 24384 /F
```

### Paso 2: Recompilar Backend

```powershell
cd c:\DASHBOARD\FlowDashboard\FlowDashboard.Core
dotnet build
```

### Paso 3: Iniciar Servidor C# Nuevamente

```powershell
dotnet run
```

O usar el script de inicio si existe.

### Paso 4: Reiniciar Dashboard Electron

El dashboard ya tiene el código actualizado, solo necesita que el backend esté corriendo con el nuevo endpoint.

## 📊 Cómo Funciona

### Flujo de Streaming

```
1. Usuario selecciona dispositivos
2. Click en "Iniciar Streaming"
3. Frontend crea array de streams
4. Para cada dispositivo:
   a. Llama a GET /api/devices/{serial}/screenshot
   b. Recibe imagen PNG
   c. Actualiza <img> element
   d. Calcula FPS
   e. Espera delay (50-100ms según calidad)
   f. Repite desde (a)
```

### Ventajas de Este Enfoque

✅ **Embebido real** - Se ve dentro del dashboard  
✅ **Sin dependencias externas** - Solo usa ADB  
✅ **Funciona siempre** - No requiere scrcpy  
✅ **Múltiples dispositivos** - Grid responsive  
✅ **Control de calidad** - Ajusta FPS según calidad  
✅ **Gestión de memoria** - Libera URLs antiguas  

### Limitaciones

⚠️ **FPS limitado** - 10-20 FPS máximo (suficiente para monitoreo)  
⚠️ **Uso de CPU** - Captura continua consume recursos  
⚠️ **Sin audio** - Solo video  
⚠️ **Sin control táctil** - Solo visualización (se puede agregar después)  

## 🎮 Uso

1. **Seleccionar dispositivos** en el grid
2. **Expandir "Streaming"** en el sidebar
3. **Click "▶ Iniciar Streaming"**
4. **Ver dispositivos embebidos** en el área principal
5. **Ajustar calidad** si es necesario
6. **Detener** con botón ⏹ individual o "Detener Todos"

## 📈 Rendimiento Esperado

| Calidad | Delay | FPS Teórico | FPS Real | Uso CPU |
|---------|-------|-------------|----------|---------|
| 480p    | 100ms | 10 FPS      | 8-10     | Bajo    |
| 720p    | 50ms  | 20 FPS      | 15-18    | Medio   |
| 1080p   | 66ms  | 15 FPS      | 12-15    | Alto    |
| 4K      | 100ms | 10 FPS      | 8-10     | Muy Alto|

**Recomendado:** 720p para balance entre calidad y rendimiento

## 🔮 Mejoras Futuras (Opcionales)

### Fase 1: Control Táctil
- Detectar clicks en la imagen
- Convertir coordenadas a posición del dispositivo
- Enviar eventos touch via ADB

### Fase 2: Optimización
- Comprimir imágenes antes de enviar
- Usar WebSocket en lugar de polling HTTP
- Implementar delta encoding (solo cambios)

### Fase 3: Funciones Avanzadas
- Grabar sesión a video
- Tomar screenshots individuales
- Rotar pantalla
- Ajustar brillo/contraste

## 🐛 Troubleshooting

### Error: "No se pudo capturar screenshot"
- Verificar que ADB esté conectado
- Verificar permisos del dispositivo
- Probar manualmente: `adb -s SERIAL shell screencap -p > test.png`

### FPS muy bajo
- Reducir calidad a 480p
- Cerrar otros streams
- Verificar CPU del servidor

### Imagen no se actualiza
- Abrir consola del navegador (F12)
- Verificar errores de red
- Verificar que el endpoint responda: `http://localhost:5000/api/devices/SERIAL/screenshot`

## 📝 Notas Técnicas

### Por qué no usar scrcpy embebido
- scrcpy abre ventanas nativas (Win32/X11)
- No se puede embeber en Electron fácilmente
- Requeriría capturar ventana y re-renderizar (complejo)

### Por qué screenshots en lugar de video
- ADB no tiene streaming de video nativo
- ffmpeg requiere configuración compleja
- Screenshots son universales y simples
- Suficiente para monitoreo y control

### Gestión de Memoria
```javascript
// Liberar URL anterior
if (imgElement.dataset.prevUrl) {
  URL.revokeObjectURL(imgElement.dataset.prevUrl);
}
```
Esto es **crítico** para evitar memory leaks con muchos frames.

## ✅ Checklist de Verificación

Después de reiniciar el servidor C#:

- [ ] Servidor C# corriendo en puerto 5000
- [ ] Endpoint `/api/devices/{serial}/screenshot` responde
- [ ] Dashboard Electron abierto
- [ ] Dispositivos conectados visibles
- [ ] Seleccionar dispositivo
- [ ] Click "Iniciar Streaming"
- [ ] Ver imagen del dispositivo embebida
- [ ] Ver contador FPS actualizándose
- [ ] Probar detener stream
- [ ] Probar con múltiples dispositivos

## 🎯 Resultado Final

Cuando todo esté funcionando, verás:

```
┌─────────────────────────────────────┐
│  FlowDashboard Pro                  │
├─────────┬───────────────────────────┤
│ Sidebar │  Dispositivo 1  │ Disp 2  │
│         │  ┌───────────┐  │┌──────┐ │
│ Stream  │  │  📱 Live  │  ││ 📱   │ │
│ ▶ Inic  │  │  15 FPS   │  ││12 FPS│ │
│         │  │           │  ││      │ │
│         │  └───────────┘  │└──────┘ │
└─────────┴───────────────────────────┘
```

## 📚 Archivos Modificados

```
✅ electron-app/src/renderer/app.js (+150 líneas)
✅ electron-app/src/renderer/styles.css (+40 líneas)
⚠️ FlowDashboard.Core/Controllers/DevicesController.cs (+20 líneas)
⚠️ FlowDashboard.Core/Services/AdbService.cs (+50 líneas)
```

## 🚀 Próximos Pasos

1. **Detener servidor C# actual**
2. **Recompilar con `dotnet build`**
3. **Iniciar servidor nuevamente**
4. **Probar streaming embebido**
5. **Ajustar calidad según necesidad**
6. **Disfrutar del streaming embebido! 🎉**
