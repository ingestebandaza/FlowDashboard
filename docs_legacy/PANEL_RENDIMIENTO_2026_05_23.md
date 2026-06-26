# Panel de Rendimiento - Implementación 2026-05-23

## Resumen

Se implementó un **panel visual de configuración de rendimiento** en el sidebar de Electron que permite al usuario ajustar la resolución, FPS, bitrate y modo ultra-light sin tocar código. El objetivo es mejorar la fluidez y rendimiento del streaming de video en vivo.

## Cambios Realizados

### 1. Métodos en `app.js`

#### `setPerformanceProfile(profile)`
- Guarda el perfil de rendimiento en `localStorage` con claves:
  - `flowdashboard.perf.maxSize`
  - `flowdashboard.perf.maxFps`
  - `flowdashboard.perf.bitRate`
  - `flowdashboard.perf.ultraLight`
- Si hay streams vivos activos, relanza automáticamente los streams con la nueva configuración.

#### `getPerformanceLabel()`
- Devuelve una etiqueta legible del perfil actual.
- Ejemplos:
  - "480p @ 24fps / 2M" (modo normal)
  - "⚡ Ultra-Light (sin video)" (modo ultra-light)

#### `openPerformancePanel()`
- Abre el modal del panel de Performance.
- Carga los valores actuales en los controles.
- Actualiza la vista previa.

#### `closePerformancePanel()`
- Cierra el modal sin aplicar cambios.

#### `updatePerformancePreview()`
- Actualiza la vista previa en tiempo real mientras el usuario ajusta sliders.
- Muestra:
  - Etiqueta del perfil (ej: "480p @ 24fps / 2M")
  - Descripción del rendimiento esperado

#### `applyPerformanceProfile()`
- Aplica los cambios del perfil.
- Cierra el modal.
- Registra en consola el perfil aplicado.

#### `applyPerformancePreset(preset)`
- Aplica presets rápidos sin ajustar cada slider manualmente.
- Presets disponibles:
  - `ultralight`: 360p, 12fps, 1M, Ultra-Light ON
  - `low`: 360p, 12fps, 1M, Ultra-Light OFF
  - `medium`: 480p, 24fps, 2M, Ultra-Light OFF
  - `high`: 720p, 60fps, 8M, Ultra-Light OFF

### 2. UI en el Sidebar

Nueva sección "⚙️ Rendimiento" con:
- Caja de estado que muestra el perfil actual (ej: "480p @ 24fps / 2M")
- Botón "Configurar" que abre el modal

### 3. Modal de Performance

El modal incluye:

#### Vista Previa
- Etiqueta del perfil actual
- Descripción del rendimiento esperado

#### Controles

**Toggle Ultra-Light**
- Desactiva video en vivo
- Solo muestra estado de dispositivos
- Máximo rendimiento

**Slider de Resolución Máxima**
- Rango: 360p - 720p
- Paso: 60p
- Menor = más fluido

**Slider de FPS**
- Rango: 12 - 60 fps
- Paso: 6 fps
- Menor = menos CPU

**Botones de Velocidad de Bits**
- Opciones: 1M, 2M, 4M, 8M
- Menor = menos ancho de banda

**Botones de Presets Rápidos**
- ⚡ Ultra-Light
- 🐢 Bajo
- ⚖️ Medio
- 🚀 Alto

### 4. Estilos CSS

Nuevas clases CSS agregadas a `styles.css`:

- `.performance-panel-modal`: contenedor del modal
- `.performance-panel-card`: tarjeta del modal
- `.performance-panel-content`: contenedor de controles
- `.perf-preview-box`: caja de vista previa
- `.perf-control-group`: grupo de controles
- `.perf-label`, `.perf-hint`: etiquetas e indicaciones
- `.perf-slider`: slider personalizado
- `.perf-slider::-webkit-slider-thumb`: thumb del slider
- `.perf-bitrate-buttons`, `.perf-bitrate-btn`: botones de velocidad de bits
- `.perf-preset-buttons`, `.perf-preset-btn`: botones de presets
- `.perf-status-box`, `.perf-status-label`: caja de estado en sidebar

### 5. Integración con Cuenta

El método `updateAccountCounts()` ahora también actualiza el label de Performance en el sidebar cuando se cargan los datos.

## Comportamiento

1. **Persistencia**: Los cambios se guardan en `localStorage` automáticamente.
2. **Relanzamiento automático**: Si hay streams vivos, cambiar el perfil relanza los streams con la nueva configuración.
3. **Sin reinicio**: El panel es visual y no requiere reiniciar la app.
4. **Presets rápidos**: Permite cambios rápidos sin ajustar cada slider manualmente.

## Valores por Defecto

```javascript
{
  maxSize: 480,      // píxeles
  maxFps: 24,        // fotogramas por segundo
  bitRate: '2M',     // velocidad de bits
  ultraLight: false  // modo ultra-light desactivado
}
```

## Próximos Pasos

1. **Integración con Backend C#**: Pasar `performanceProfile` al endpoint `/streaming/start-embedded`.
2. **Validación en máquina real**: Verificar que los cambios de perfil realmente mejoren la fluidez.
3. **Monitoreo de rendimiento**: Agregar métricas de CPU/memoria para mostrar impacto real.
4. **Presets adaptativos**: Detectar automáticamente el mejor preset según el hardware.

## Archivos Modificados

- `electron-app/src/renderer/app.js`: Métodos y UI
- `electron-app/src/renderer/styles.css`: Estilos
- `PROJECT_CONTEXT.md`: Documentación

## Testing

Para probar:

1. Abrir Electron con `abrir_electron.bat`
2. En el sidebar, buscar la sección "⚙️ Rendimiento"
3. Hacer clic en "Configurar"
4. Ajustar los sliders y ver la vista previa actualizar en tiempo real
5. Hacer clic en un preset rápido para cambiar todos los valores
6. Hacer clic en "Aplicar" para guardar los cambios
7. Verificar que el label en el sidebar se actualice
8. Activar "Live" para ver si los streams se relanzaron con la nueva configuración

## Notas

- El modo Ultra-Light es útil cuando hay muchos dispositivos y el CPU está saturado.
- Los presets están diseñados para casos comunes:
  - **Ultra-Light**: Máximo rendimiento, sin video
  - **Bajo**: Muchos dispositivos, CPU limitado
  - **Medio**: Balance entre rendimiento y calidad
  - **Alto**: Pocos dispositivos, máxima calidad
- Los cambios se aplican inmediatamente sin necesidad de reiniciar.
