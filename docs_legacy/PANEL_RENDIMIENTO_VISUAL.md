# Panel de Rendimiento - Guía Visual

## Ubicación en el Sidebar

```
┌─────────────────────────────────────┐
│ FlowDashboard Pro                   │
├─────────────────────────────────────┤
│ Menú                                │
├─────────────────────────────────────┤
│ 📱 Dispositivos                  [0]│
│ ├─ [0 seleccionados]                │
│ ├─ [🔄] [Live] [Grid] [✓] [✗]      │
│ └─ Zoom [━━━━━━━━━━━━━━━━━━]        │
├─────────────────────────────────────┤
│ FlowCategory                     [+]│
│ ├─ Todos                            │
│ └─ ...                              │
├─────────────────────────────────────┤
│ FlowLogin                        [▶]│
│ ├─ [Total] [✓ Válidos] [✗ No válidos]
│ ├─ [Textarea de cuentas...]         │
│ └─ [Delim: :] [Dividir: 10] [Div]  │
├─────────────────────────────────────┤
│ 🎬 Streaming                    [▶]│
│ └─ [▶ Iniciar Streaming]            │
├─────────────────────────────────────┤
│ ⚙️ Rendimiento                      │
│ ├─ 480p @ 24fps / 2M                │
│ └─ [⚙️ Configurar]                  │
└─────────────────────────────────────┘
```

## Modal de Performance

Cuando haces clic en "⚙️ Configurar":

```
┌──────────────────────────────────────────────────────┐
│ ⚙️ Panel de Rendimiento                          [×] │
│ Optimiza la fluidez y calidad de video               │
├──────────────────────────────────────────────────────┤
│                                                      │
│ ┌────────────────────────────────────────────────┐  │
│ │ 480p @ 24fps / 2M                              │  │
│ │ Bajo: buen rendimiento, calidad aceptable.     │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ ☐ ⚡ Modo Ultra-Light (sin video)                   │
│   Desactiva video en vivo. Solo muestra estado.     │
│                                                      │
│ Resolución máxima                                   │
│ 360p ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 720p    │
│ Resolución máxima de video. Menor = más fluido.    │
│                                                      │
│ Fotogramas por segundo                              │
│ 12 fps ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 60 fps  │
│ Fotogramas por segundo. Menor = menos CPU.         │
│                                                      │
│ Velocidad de bits                                   │
│ ┌────┬────┬────┬────┐                               │
│ │ 1M │ 2M │ 4M │ 8M │                               │
│ └────┴────┴────┴────┘                               │
│ Velocidad de compresión. Menor = menos ancho.      │
│                                                      │
│ Presets rápidos                                     │
│ ┌──────────────────┬──────────────────┐             │
│ │ ⚡ Ultra-Light   │ 🐢 Bajo          │             │
│ ├──────────────────┼──────────────────┤             │
│ │ ⚖️ Medio         │ 🚀 Alto          │             │
│ └──────────────────┴──────────────────┘             │
│                                                      │
├──────────────────────────────────────────────────────┤
│                    [Cancelar] [Aplicar]              │
└──────────────────────────────────────────────────────┘
```

## Presets Disponibles

### ⚡ Ultra-Light
- **Resolución**: 360p
- **FPS**: 12
- **Bitrate**: 1M
- **Modo Ultra-Light**: ✓ Activado
- **Uso**: Máximo rendimiento, sin video. Ideal cuando hay muchos dispositivos.

### 🐢 Bajo
- **Resolución**: 360p
- **FPS**: 12
- **Bitrate**: 1M
- **Modo Ultra-Light**: ✗ Desactivado
- **Uso**: Buen rendimiento, calidad mínima. Para CPU limitado.

### ⚖️ Medio (Predeterminado)
- **Resolución**: 480p
- **FPS**: 24
- **Bitrate**: 2M
- **Modo Ultra-Light**: ✗ Desactivado
- **Uso**: Balance entre rendimiento y calidad. Recomendado.

### 🚀 Alto
- **Resolución**: 720p
- **FPS**: 60
- **Bitrate**: 8M
- **Modo Ultra-Light**: ✗ Desactivado
- **Uso**: Máxima calidad. Para pocos dispositivos con CPU potente.

## Flujo de Uso

### Cambiar Perfil Rápidamente

1. Haz clic en "⚙️ Configurar" en el sidebar
2. Haz clic en un preset (ej: "🐢 Bajo")
3. Haz clic en "Aplicar"
4. El perfil se guarda y los streams se relanzarán automáticamente

### Ajuste Manual

1. Haz clic en "⚙️ Configurar"
2. Ajusta los sliders:
   - Resolución: arrastra hacia la izquierda para menos calidad/más fluidez
   - FPS: arrastra hacia la izquierda para menos fotogramas/menos CPU
   - Bitrate: haz clic en un botón (1M, 2M, 4M, 8M)
3. Observa la vista previa actualizar en tiempo real
4. Haz clic en "Aplicar"

### Modo Ultra-Light

1. Haz clic en "⚙️ Configurar"
2. Marca la casilla "⚡ Modo Ultra-Light (sin video)"
3. Haz clic en "Aplicar"
4. Los dispositivos mostrarán solo estado, sin video en vivo

## Indicadores de Rendimiento

La descripción bajo la vista previa te dice qué esperar:

- **Muy bajo**: Máximo rendimiento, mínima calidad
- **Bajo**: Buen rendimiento, calidad aceptable
- **Medio**: Balance rendimiento/calidad
- **Alto**: Mejor calidad, más recursos

## Persistencia

Los cambios se guardan automáticamente en `localStorage`. Si cierras y abres Electron, el perfil se mantiene.

## Relanzamiento Automático

Si tienes streams vivos activos (botón "Live" activado), cambiar el perfil relanzará automáticamente los streams con la nueva configuración. Esto puede tomar unos segundos.

## Consejos

- **Muchos dispositivos**: Usa "🐢 Bajo" o "⚡ Ultra-Light"
- **Pocos dispositivos**: Usa "⚖️ Medio" o "🚀 Alto"
- **CPU saturado**: Reduce FPS o usa Ultra-Light
- **Conexión lenta**: Reduce Bitrate
- **Necesitas fluidez**: Reduce Resolución o FPS
