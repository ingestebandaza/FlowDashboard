# Prueba del Panel de Rendimiento

## Requisitos Previos

- Electron app compilada y funcionando
- Al menos un dispositivo Android conectado por ADB
- Backend C# ejecutándose en `http://localhost:5000`

## Pasos de Prueba

### 1. Iniciar la Aplicación

```powershell
cd c:\DASHBOARD\FlowDashboard
.\abrir_electron.bat
```

Espera a que Electron se abra y cargue los dispositivos.

### 2. Verificar que el Panel Aparece

En el sidebar izquierdo, busca la sección "⚙️ Rendimiento":

```
⚙️ Rendimiento
├─ 480p @ 24fps / 2M
└─ [⚙️ Configurar]
```

**Resultado esperado**: El label muestra "480p @ 24fps / 2M" (valores por defecto).

### 3. Abrir el Modal

Haz clic en el botón "⚙️ Configurar".

**Resultado esperado**: Se abre un modal con:
- Vista previa: "480p @ 24fps / 2M"
- Descripción: "Bajo: buen rendimiento, calidad aceptable."
- Sliders y botones de configuración

### 4. Probar Sliders

#### Slider de Resolución

1. Arrastra el slider de resolución hacia la izquierda (360p)
2. Observa que la vista previa cambia a "360p @ 24fps / 2M"
3. Arrastra hacia la derecha (720p)
4. Observa que la vista previa cambia a "720p @ 24fps / 2M"

**Resultado esperado**: La vista previa se actualiza en tiempo real.

#### Slider de FPS

1. Arrastra el slider de FPS hacia la izquierda (12 fps)
2. Observa que la vista previa cambia a "480p @ 12fps / 2M"
3. Arrastra hacia la derecha (60 fps)
4. Observa que la vista previa cambia a "480p @ 60fps / 2M"

**Resultado esperado**: La vista previa se actualiza en tiempo real.

### 5. Probar Botones de Bitrate

1. Haz clic en el botón "1M"
2. Observa que la vista previa cambia a "480p @ 24fps / 1M"
3. Haz clic en el botón "8M"
4. Observa que la vista previa cambia a "480p @ 24fps / 8M"

**Resultado esperado**: La vista previa se actualiza al hacer clic.

### 6. Probar Toggle Ultra-Light

1. Marca la casilla "⚡ Modo Ultra-Light (sin video)"
2. Observa que la vista previa cambia a "⚡ Ultra-Light (sin video)"
3. Observa que la descripción cambia a "Solo estado, sin video. Máximo rendimiento."
4. Desmarca la casilla
5. Observa que vuelve al perfil anterior

**Resultado esperado**: La vista previa se actualiza correctamente.

### 7. Probar Presets Rápidos

#### Preset "🐢 Bajo"

1. Haz clic en el botón "🐢 Bajo"
2. Observa que:
   - Resolución: 360p
   - FPS: 12
   - Bitrate: 1M
   - Ultra-Light: desactivado
   - Vista previa: "360p @ 12fps / 1M"

**Resultado esperado**: Todos los valores se actualizan correctamente.

#### Preset "⚖️ Medio"

1. Haz clic en el botón "⚖️ Medio"
2. Observa que:
   - Resolución: 480p
   - FPS: 24
   - Bitrate: 2M
   - Ultra-Light: desactivado
   - Vista previa: "480p @ 24fps / 2M"

**Resultado esperado**: Todos los valores se actualizan correctamente.

#### Preset "🚀 Alto"

1. Haz clic en el botón "🚀 Alto"
2. Observa que:
   - Resolución: 720p
   - FPS: 60
   - Bitrate: 8M
   - Ultra-Light: desactivado
   - Vista previa: "720p @ 60fps / 8M"

**Resultado esperado**: Todos los valores se actualizan correctamente.

#### Preset "⚡ Ultra-Light"

1. Haz clic en el botón "⚡ Ultra-Light"
2. Observa que:
   - Resolución: 360p
   - FPS: 12
   - Bitrate: 1M
   - Ultra-Light: activado
   - Vista previa: "⚡ Ultra-Light (sin video)"

**Resultado esperado**: Todos los valores se actualizan correctamente.

### 8. Aplicar Cambios

1. Ajusta los sliders a valores diferentes (ej: 600p, 30fps, 4M)
2. Haz clic en "Aplicar"
3. El modal se cierra
4. Observa que el label en el sidebar se actualiza a "600p @ 30fps / 4M"

**Resultado esperado**: 
- El modal se cierra
- El label en el sidebar se actualiza
- Los cambios se guardan en `localStorage`

### 9. Verificar Persistencia

1. Cierra Electron completamente
2. Abre Electron nuevamente con `abrir_electron.bat`
3. Haz clic en "⚙️ Configurar"
4. Observa que los valores son los mismos que guardaste (600p, 30fps, 4M)

**Resultado esperado**: Los valores se mantienen después de cerrar y abrir.

### 10. Probar Relanzamiento de Streams (Opcional)

Si tienes dispositivos conectados:

1. Activa "Live" en el sidebar para ver streams en vivo
2. Abre el panel de Performance
3. Cambia el preset a "🐢 Bajo"
4. Haz clic en "Aplicar"
5. Observa que los streams se relanzarán con la nueva configuración

**Resultado esperado**: Los streams se relanzarán automáticamente.

### 11. Cancelar Cambios

1. Abre el panel de Performance
2. Ajusta los sliders a valores diferentes
3. Haz clic en "Cancelar"
4. El modal se cierra sin aplicar cambios
5. Verifica que el label en el sidebar no cambió

**Resultado esperado**: Los cambios se descartan.

## Verificación en Consola

Abre la consola de desarrollador (F12) y verifica:

1. Cuando aplicas cambios, deberías ver:
   ```
   ✅ Perfil de rendimiento aplicado: {maxSize: 600, maxFps: 30, bitRate: "4M", ultraLight: false}
   ```

2. Verifica que `localStorage` contiene:
   ```javascript
   localStorage.getItem('flowdashboard.perf.maxSize')  // "600"
   localStorage.getItem('flowdashboard.perf.maxFps')   // "30"
   localStorage.getItem('flowdashboard.perf.bitRate')  // "4M"
   localStorage.getItem('flowdashboard.perf.ultraLight') // "false"
   ```

## Casos de Prueba Adicionales

### Caso 1: Cambios Rápidos

1. Abre el panel
2. Cambia rápidamente entre presets (Bajo → Medio → Alto → Ultra-Light)
3. Verifica que la vista previa se actualiza correctamente cada vez

**Resultado esperado**: No hay errores, la UI responde correctamente.

### Caso 2: Valores Extremos

1. Abre el panel
2. Ajusta la resolución al mínimo (360p)
3. Ajusta los FPS al mínimo (12)
4. Selecciona el bitrate mínimo (1M)
5. Haz clic en "Aplicar"
6. Verifica que el label muestra "360p @ 12fps / 1M"

**Resultado esperado**: Los valores extremos se aplican correctamente.

### Caso 3: Modo Ultra-Light

1. Abre el panel
2. Marca "⚡ Modo Ultra-Light"
3. Intenta ajustar los sliders (deberían seguir funcionando)
4. Haz clic en "Aplicar"
5. Verifica que el label muestra "⚡ Ultra-Light (sin video)"

**Resultado esperado**: El modo ultra-light se aplica correctamente.

## Problemas Comunes

### El panel no aparece en el sidebar

- Verifica que `renderUI()` se ejecutó correctamente
- Abre la consola (F12) y busca errores
- Recarga la página (Ctrl+R)

### Los sliders no se mueven

- Verifica que los elementos HTML existen (F12 → Inspector)
- Verifica que no hay errores en la consola
- Intenta hacer clic en el slider en lugar de arrastrarlo

### Los cambios no se guardan

- Verifica que `localStorage` está habilitado
- Abre la consola y ejecuta:
  ```javascript
  localStorage.setItem('test', 'value');
  localStorage.getItem('test'); // debería devolver 'value'
  ```

### El label no se actualiza

- Verifica que `updateAccountCounts()` se ejecutó
- Abre la consola y ejecuta:
  ```javascript
  app.updateAccountCounts();
  ```

## Éxito

Si todos los pasos se ejecutan correctamente, el panel de rendimiento está funcionando correctamente. 

**Próximos pasos**:
1. Integrar con el backend C# para pasar `performanceProfile` al endpoint `/streaming/start-embedded`
2. Validar en máquina real que los cambios mejoren la fluidez
3. Agregar monitoreo de rendimiento (CPU, memoria)
