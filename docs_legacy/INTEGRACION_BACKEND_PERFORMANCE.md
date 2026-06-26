# Integración del Panel de Rendimiento con Backend C#

## Objetivo

Pasar el `performanceProfile` desde Electron al backend C# para que scrcpy reciba los parámetros de resolución, FPS y bitrate correctamente.

## Estado Actual

### Frontend (Electron)
- ✅ Panel de Performance implementado
- ✅ Sliders y presets funcionando
- ✅ Persistencia en localStorage
- ✅ Relanzamiento de streams al cambiar perfil
- ⏳ **Pendiente**: Pasar performanceProfile al backend

### Backend (C#)
- ✅ Endpoint `/api/streaming/start-embedded` existe
- ✅ Acepta `StreamConfig` con parámetros
- ⏳ **Pendiente**: Recibir y usar performanceProfile

## Cambios Necesarios

### 1. En `app.js` (Electron)

Modificar el método `syncLivePreviewStreams()` para pasar el perfil de rendimiento:

```javascript
// Buscar esta sección en syncLivePreviewStreams():
const response = await fetch(`${CSHARP_API}/streaming/start-embedded`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serials: Array.from(newSerials),
    positions: positions,
    parentHwnd: this.mainWindowHandle,
    // AGREGAR ESTO:
    performanceProfile: this.performanceProfile
  })
});
```

### 2. En `StreamingController.cs` (Backend C#)

Modificar la clase `EmbeddedStreamRequest` para recibir el perfil:

```csharp
public class EmbeddedStreamRequest
{
    public List<string> Serials { get; set; }
    public List<StreamPosition> Positions { get; set; }
    public long ParentHwnd { get; set; }
    
    // AGREGAR ESTO:
    public PerformanceProfile PerformanceProfile { get; set; }
}

public class PerformanceProfile
{
    public int MaxSize { get; set; }      // 360, 420, 480, 540, 600, 720
    public int MaxFps { get; set; }       // 12-60
    public string BitRate { get; set; }   // "1M", "2M", "4M", "8M"
    public bool UltraLight { get; set; }  // true/false
}
```

### 3. En `StreamingController.cs` - Método POST

Modificar el endpoint para usar el perfil:

```csharp
[HttpPost("start-embedded")]
public async Task<IActionResult> StartEmbeddedStreams([FromBody] EmbeddedStreamRequest request)
{
    if (request?.Serials == null || request.Serials.Count == 0)
        return BadRequest("No serials provided");

    var results = new List<object>();

    foreach (var serial in request.Serials)
    {
        var position = request.Positions?.FirstOrDefault(p => p.Serial == serial);
        
        // AGREGAR ESTO:
        var streamConfig = new StreamConfig
        {
            Serial = serial,
            ParentHwnd = request.ParentHwnd,
            X = position?.X ?? 0,
            Y = position?.Y ?? 0,
            Width = position?.Width ?? 480,
            Height = position?.Height ?? 270,
            // PASAR EL PERFIL:
            MaxSize = request.PerformanceProfile?.MaxSize ?? 480,
            MaxFps = request.PerformanceProfile?.MaxFps ?? 24,
            BitRate = request.PerformanceProfile?.BitRate ?? "2M",
            UltraLight = request.PerformanceProfile?.UltraLight ?? false
        };

        var info = await _scrcpyService.StartStream(streamConfig);
        results.Add(info);
    }

    return Ok(results);
}
```

### 4. En `StreamConfig.cs` (Backend C#)

Agregar propiedades para el perfil:

```csharp
public class StreamConfig
{
    public string Serial { get; set; }
    public long ParentHwnd { get; set; }
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    
    // AGREGAR ESTO:
    public int MaxSize { get; set; }      // Resolución máxima
    public int MaxFps { get; set; }       // Fotogramas por segundo
    public string BitRate { get; set; }   // Velocidad de bits
    public bool UltraLight { get; set; }  // Modo sin video
}
```

### 5. En `ScrcpyService.cs` - Método StartStream

Modificar para usar los parámetros del perfil:

```csharp
public async Task<StreamInfo> StartStream(StreamConfig config)
{
    // ... código existente ...

    // Construir argumentos de scrcpy con el perfil
    var args = new List<string>
    {
        "-s", config.Serial,
        "--no-control",
        "--stay-awake",
        "--window-title", $"FlowDashboard Pro - {config.Serial}"
    };

    // AGREGAR ESTO:
    if (config.UltraLight)
    {
        // Modo ultra-light: sin video
        args.Add("--no-video");
    }
    else
    {
        // Agregar parámetros de calidad
        args.Add("--max-size");
        args.Add(config.MaxSize.ToString());
        
        args.Add("--max-fps");
        args.Add(config.MaxFps.ToString());
        
        args.Add("--bit-rate");
        args.Add(config.BitRate);
    }

    // ... resto del código ...
}
```

## Mapeo de Parámetros

### Resolución (MaxSize)
- 360 → `--max-size 360`
- 480 → `--max-size 480` (predeterminado)
- 600 → `--max-size 600`
- 720 → `--max-size 720`

### FPS (MaxFps)
- 12 → `--max-fps 12`
- 24 → `--max-fps 24` (predeterminado)
- 30 → `--max-fps 30`
- 60 → `--max-fps 60`

### Bitrate (BitRate)
- "1M" → `--bit-rate 1M`
- "2M" → `--bit-rate 2M` (predeterminado)
- "4M" → `--bit-rate 4M`
- "8M" → `--bit-rate 8M`

### Ultra-Light (UltraLight)
- true → `--no-video` (sin video)
- false → incluir parámetros de video

## Validación

### En Frontend (app.js)

Verificar que el perfil se envía correctamente:

```javascript
// En syncLivePreviewStreams(), antes de fetch:
console.log('📊 Enviando perfil de rendimiento:', this.performanceProfile);

// Después de fetch:
console.log('✅ Respuesta del backend:', response);
```

### En Backend (C#)

Verificar que el perfil se recibe correctamente:

```csharp
// En StartEmbeddedStreams():
_logger.LogInformation($"Performance Profile: MaxSize={request.PerformanceProfile?.MaxSize}, " +
    $"MaxFps={request.PerformanceProfile?.MaxFps}, " +
    $"BitRate={request.PerformanceProfile?.BitRate}, " +
    $"UltraLight={request.PerformanceProfile?.UltraLight}");

// En StartStream():
_logger.LogInformation($"Starting stream with config: MaxSize={config.MaxSize}, " +
    $"MaxFps={config.MaxFps}, BitRate={config.BitRate}, UltraLight={config.UltraLight}");
```

## Testing

### 1. Verificar que el perfil se envía

1. Abrir Electron
2. Abrir consola (F12)
3. Cambiar el perfil a "🐢 Bajo"
4. Activar "Live"
5. En consola, deberías ver:
   ```
   📊 Enviando perfil de rendimiento: {maxSize: 360, maxFps: 12, bitRate: "1M", ultraLight: false}
   ```

### 2. Verificar que el backend lo recibe

1. Abrir Visual Studio
2. Agregar breakpoint en `StartEmbeddedStreams()`
3. Ejecutar Electron
4. Activar "Live"
5. El breakpoint debería parar y mostrar `request.PerformanceProfile` con los valores correctos

### 3. Verificar que scrcpy recibe los parámetros

1. Abrir Task Manager
2. Buscar `scrcpy.exe`
3. Ver la línea de comandos (propiedades del proceso)
4. Deberías ver algo como:
   ```
   scrcpy.exe -s <serial> --no-control --stay-awake --max-size 360 --max-fps 12 --bit-rate 1M
   ```

## Checklist de Implementación

- [ ] Modificar `EmbeddedStreamRequest` en `StreamingController.cs`
- [ ] Crear clase `PerformanceProfile` en `StreamingController.cs`
- [ ] Modificar `StreamConfig` en `StreamConfig.cs`
- [ ] Modificar método `StartEmbeddedStreams()` en `StreamingController.cs`
- [ ] Modificar método `StartStream()` en `ScrcpyService.cs`
- [ ] Agregar logging para debugging
- [ ] Compilar y probar en máquina real
- [ ] Verificar que scrcpy recibe los parámetros correctamente
- [ ] Verificar que la fluidez mejora con los nuevos parámetros

## Notas Importantes

1. **Compatibilidad con scrcpy 4.0**: Verificar que los parámetros `--max-size`, `--max-fps`, `--bit-rate` y `--no-video` son soportados en la versión 4.0 de scrcpy.

2. **Fallback**: Si el backend no recibe `performanceProfile`, usar valores por defecto:
   ```csharp
   var profile = request.PerformanceProfile ?? new PerformanceProfile 
   { 
       MaxSize = 480, 
       MaxFps = 24, 
       BitRate = "2M", 
       UltraLight = false 
   };
   ```

3. **Validación**: Validar que los valores estén en rangos válidos:
   ```csharp
   if (config.MaxSize < 360 || config.MaxSize > 720)
       config.MaxSize = 480;
   if (config.MaxFps < 12 || config.MaxFps > 60)
       config.MaxFps = 24;
   ```

4. **Relanzamiento**: Cuando el usuario cambia el perfil, Electron relanza automáticamente los streams. El backend debe cerrar los streams antiguos y abrir nuevos con la nueva configuración.

## Próximos Pasos Después de Integración

1. Validar en máquina real que la fluidez mejora
2. Agregar monitoreo de CPU/memoria
3. Implementar presets adaptativos basados en rendimiento
4. Agregar métricas de rendimiento en tiempo real
