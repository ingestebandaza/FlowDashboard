# 🎨 Guía Visual - Dashboard Actualizado

## Estructura del Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│ ☰  FlowDashboard                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │                  │  │                                  │ │
│  │  MENÚ LATERAL    │  │  PANEL PRINCIPAL                 │ │
│  │  (Ocultable)     │  │                                  │ │
│  │                  │  │  ┌────────────────────────────┐  │ │
│  │  - Dispositivos  │  │  │ Selección │ Vista │ Datos │  │ │
│  │  - Cuentas       │  │  │ Streaming │ ☰ Menu│        │  │ │
│  │  - Configuración │  │  └────────────────────────────┘  │ │
│  │                  │  │  (Barra STICKY - fija)          │ │
│  │                  │  │                                  │ │
│  │                  │  │  [Contenido Principal]           │ │
│  │                  │  │                                  │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Elementos Principales

### 1. Botón ☰ (Toggle Menú)
```
┌─────────────────────────────────────────────────────────────┐
│ ☰                                                           │
│ ↑                                                           │
│ Esquina superior izquierda (FIJO)                           │
│ Permanece visible incluso cuando menú está oculto           │
└─────────────────────────────────────────────────────────────┘
```

**Características**:
- Posición: Esquina superior izquierda
- Tipo: FIJO (position: fixed)
- Siempre visible: Sí
- Función: Oculta/muestra menú lateral
- Icono: 3 líneas horizontales (hamburguesa)

**Interacción**:
```
Click en ☰ → Menú se oculta
Click en ☰ nuevamente → Menú se muestra
```

### 2. Barra de Controles (STICKY)
```
┌─────────────────────────────────────────────────────────────┐
│ Selección │ Vista │ Datos │ Streaming │ ☰ Menu             │
├─────────────────────────────────────────────────────────────┤
│ ↑                                                           │
│ Barra STICKY (fija al desplazar)                            │
│ Permanece en la parte superior                              │
└─────────────────────────────────────────────────────────────┘
```

**Características**:
- Posición: Parte superior del panel principal
- Tipo: STICKY (position: sticky)
- Comportamiento: Se fija al desplazar hacia abajo
- Botones: Selección, Vista, Datos, Streaming, ☰ Menu

**Botones**:
- **Selección**: Seleccionar dispositivos
- **Vista**: Cambiar vista de dispositivos
- **Datos**: Mostrar datos de dispositivos
- **Streaming**: Activar modo streaming (NUEVO)
- **☰ Menu**: Ocultar/mostrar menú (NUEVO)

### 3. Botón "Streaming"
```
┌─────────────────────────────────────────────────────────────┐
│ Selección │ Vista │ Datos │ [Streaming] │ ☰ Menu           │
│                           ↑                                 │
│                    Botón con icono de pantalla              │
│                    Click activa modo streaming              │
└─────────────────────────────────────────────────────────────┘
```

**Características**:
- Ubicación: Barra de controles
- Icono: Pantalla/monitor
- Función: Activar/desactivar modo streaming
- Estado: Activo (azul) / Inactivo (gris)

**Interacción**:
```
Click en Streaming → Modo streaming activado
                  → Dispositivos en grilla
                  → Botón se pone azul

Click nuevamente → Modo streaming desactivado
                → Vista normal
                → Botón se pone gris
```

### 4. Menú Lateral (Ocultable)
```
MENÚ VISIBLE                    MENÚ OCULTO
┌──────────────────┐           ┌─────────────────────────────┐
│ Dispositivos     │           │ (Espacio vacío)             │
│ Cuentas          │           │                             │
│ Configuración    │           │ Panel principal ocupa       │
│                  │           │ todo el ancho               │
└──────────────────┘           └─────────────────────────────┘
```

**Características**:
- Ancho: ~250px (aproximado)
- Ocultable: Sí
- Animación: Suave (0.2s)
- Permanece: Oculto hasta que se haga click en ☰

**Contenido**:
- Dispositivos conectados
- Gestión de cuentas
- Configuración

## Modo Streaming

### Activación
```
1. Click en botón "Streaming" en barra de controles
2. Botón se pone azul (activo)
3. Dispositivos se muestran en grilla
```

### Vista de Grilla
```
┌─────────────────────────────────────────────────────────────┐
│ Selección │ Vista │ Datos │ [Streaming] │ ☰ Menu           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Device 1 │  │ Device 2 │  │ Device 3 │  │ Device 4 │   │
│  │          │  │          │  │          │  │          │   │
│  │ [Stream] │  │ [Stream] │  │ [Stream] │  │ [Stream] │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Device 5 │  │ Device 6 │  │ Device 7 │  │ Device 8 │   │
│  │          │  │          │  │          │  │          │   │
│  │ [Stream] │  │ [Stream] │  │ [Stream] │  │ [Stream] │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Características**:
- Dispositivos en cuadros
- Cuadros seleccionables
- Botón de streaming en cada cuadro
- Responsive (se ajusta al tamaño de pantalla)

## Flujo de Interacción

### Escenario 1: Ocultar Menú
```
1. Usuario ve dashboard con menú lateral visible
2. Click en botón ☰
3. Menú se oculta suavemente
4. Panel principal se expande
5. Botón ☰ permanece visible en esquina
6. Click en ☰ nuevamente → Menú reaparece
```

### Escenario 2: Activar Modo Streaming
```
1. Usuario ve dashboard en vista normal
2. Click en botón "Streaming"
3. Botón se pone azul
4. Dispositivos se muestran en grilla
5. Cada dispositivo tiene botón de streaming
6. Click en "Streaming" nuevamente → Vuelve a vista normal
```

### Escenario 3: Desplazar con Barra Sticky
```
1. Usuario ve barra de controles en la parte superior
2. Usuario desplaza hacia abajo
3. Barra de controles permanece visible (STICKY)
4. Contenido se desplaza debajo de la barra
5. Usuario desplaza hacia arriba
6. Barra permanece en su posición
```

## Colores y Estilos

### Botón ☰ (Toggle)
```
ESTADO NORMAL:
- Fondo: Azul semi-transparente (rgba(79, 141, 255, 0.15))
- Borde: Azul claro (rgba(79, 141, 255, 0.25))
- Color: Gris claro (#9fb0cc)

HOVER:
- Fondo: Azul más opaco (rgba(79, 141, 255, 0.25))
- Borde: Azul más claro (rgba(79, 141, 255, 0.4))
- Color: Azul (#4f8dff)
- Efecto: Escala 1.05

ACTIVO (Menú Oculto):
- Fondo: Rojo semi-transparente (rgba(212, 88, 98, 0.15))
- Borde: Rojo claro (rgba(212, 88, 98, 0.3))
- Color: Rojo (#d45862)
```

### Botón "Streaming"
```
ESTADO NORMAL:
- Fondo: Azul semi-transparente
- Borde: Azul claro
- Color: Gris claro

HOVER:
- Fondo: Azul más opaco
- Borde: Azul más claro
- Color: Azul
- Efecto: Traslación hacia arriba (-1px)

ACTIVO (Streaming Activado):
- Fondo: Gradiente azul-púrpura
- Borde: Azul
- Color: Blanco
- Efecto: Sombra azul
```

### Barra de Controles
```
FONDO:
- Gradiente: rgba(24, 38, 68, 0.98) a rgba(11, 20, 39, 0.96)
- Sombra: 0 2px 12px rgba(0, 0, 0, 0.4)
- Blur: 8px (backdrop-filter)

BORDES:
- Separador entre grupos: 1px solid rgba(79, 141, 255, 0.15)
```

## Responsive Design

### Desktop (>768px)
```
┌─────────────────────────────────────────────────────────────┐
│ ☰  [Menú Lateral] │ [Panel Principal]                      │
│                   │ [Barra Sticky]                          │
│                   │ [Contenido]                             │
└─────────────────────────────────────────────────────────────┘
```

### Tablet/Mobile (<768px)
```
┌──────────────────────────────────────┐
│ ☰  [Panel Principal]                 │
│     [Barra Sticky]                   │
│     [Contenido]                      │
│                                      │
│ (Menú lateral oculto por defecto)    │
└──────────────────────────────────────┘
```

## Animaciones

### Toggle Menú
```
Duración: 0.2s
Easing: ease
Propiedades: opacity, transform
```

### Botón Hover
```
Duración: 0.2s
Easing: ease
Propiedades: background, color, border, transform
```

### Barra Sticky
```
Transición: Suave (sin animación explícita)
Efecto: Se fija cuando se desplaza
```

## Accesibilidad

### Atributos ARIA
```html
<button aria-label="Mostrar/Ocultar menú lateral">☰</button>
<button aria-label="Activar modo streaming">Streaming</button>
```

### Navegación por Teclado
```
Tab: Navega entre botones
Enter/Space: Activa botón
```

### Preferencias de Movimiento
```
@media (prefers-reduced-motion: reduce) {
  /* Animaciones deshabilitadas */
}
```

## Verificación Visual

### Checklist de Elementos
- [ ] Botón ☰ visible en esquina superior izquierda
- [ ] Botón ☰ tiene icono de 3 líneas
- [ ] Botón "Streaming" visible en barra de controles
- [ ] Botón "Streaming" tiene icono de pantalla
- [ ] Barra de controles tiene fondo semi-transparente
- [ ] Barra de controles tiene sombra sutil
- [ ] Menú lateral se oculta al click en ☰
- [ ] Menú lateral se muestra al click nuevamente en ☰
- [ ] Dispositivos se muestran en grilla en modo streaming
- [ ] Barra permanece fija al desplazar

---

**Última actualización**: 2026-05-21
**Estado**: ✅ Guía visual completa
