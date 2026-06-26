# Integración de UI Streaming - Guía Completa

**Fecha:** 2026-05-20  
**Versión:** 1.0  
**Estado:** Listo para integración

---

## 📋 Resumen

Se han creado dos archivos para implementar la nueva UI de streaming:

1. **`streaming_ui_implementation.js`** - Lógica JavaScript
2. **`streaming_ui_styles.css`** - Estilos CSS

Estos archivos implementan:
- ✅ Menú izquierdo desplegable (slide in/out)
- ✅ Modo vista streaming optimizado
- ✅ Toolbar superior anclado
- ✅ Tarjetas compactas de dispositivos
- ✅ Acciones por dispositivo
- ✅ Controles de zoom
- ✅ Vistas grid y lista
- ✅ Responsive design

---

## 🔧 Pasos de Integración

### **Paso 1: Agregar archivos al HTML**

En `wsapi_demo.html`, agregar en la sección `<head>` (después de los estilos existentes):

```html
<!-- Estilos para Streaming UI -->
<link rel="stylesheet" href="./streaming_ui_styles.css">
```

Y antes del cierre de `</body>`, agregar:

```html
<!-- Script para Streaming UI -->
<script src="./streaming_ui_implementation.js"></script>
```

### **Paso 2: Inicializar en el HTML**

En la sección JavaScript de `wsapi_demo.html`, después de que se carga el DOM, agregar:

```javascript
// Inicializar UI de streaming cuando el documento esté listo
document.addEventListener('DOMContentLoaded', () => {
  // ... código existente ...
  
  // Inicializar streaming UI
  setTimeout(() => {
    if (typeof initStreamingUI === 'function') {
      initStreamingUI();
      console.log('[Dashboard] Streaming UI inicializado');
    }
  }, 500);
});
```

### **Paso 3: Agregar clase al shell en modo streaming**

Modificar la función `toggleStreamingMode()` en `streaming_ui_implementation.js` para agregar clase al shell:

```javascript
function toggleStreamingMode() {
  streamingUIState.isStreamingMode = !streamingUIState.isStreamingMode;
  
  const shell = document.querySelector('.shell');
  const grid = document.querySelector('.grid');
  const streamingContainer = document.querySelector('.js-streaming-view-container');
  const streamingBtn = document.querySelector('.js-streaming-mode-btn');
  
  if (streamingUIState.isStreamingMode) {
    // Activar modo streaming
    console.log('[StreamingUI] Activando modo streaming');
    
    // Agregar clase al shell
    shell.classList.add('streaming-mode');
    
    if (grid) grid.style.display = 'none';
    if (streamingContainer) streamingContainer.style.display = 'flex';
    if (streamingBtn) streamingBtn.classList.add('active');
    
    // ... resto del código ...
    
  } else {
    // Desactivar modo streaming
    console.log('[StreamingUI] Desactivando modo streaming');
    
    // Remover clase del shell
    shell.classList.remove('streaming-mode');
    shell.classList.remove('streaming-menu-open');
    
    if (grid) grid.style.display = 'grid';
    if (streamingContainer) streamingContainer.style.display = 'none';
    if (streamingBtn) streamingBtn.classList.remove('active');
    
    // ... resto del código ...
  }
}
```

---

## 🎯 Características Implementadas

### **1. Menú Izquierdo Desplegable**

- **Botón toggle** en esquina superior izquierda
- **Slide in/out** suave desde la izquierda
- **Overlay** semi-transparente cuando está abierto
- **Ancho:** 320px (configurable)
- **Transición:** 0.3s cubic-bezier

```javascript
// Usar:
toggleLeftMenu()  // Alternar menú
```

### **2. Modo Vista Streaming**

- **Botón "Streaming"** en toolbar general
- **Activación/desactivación** con un clic
- **Transición suave** entre vistas
- **Preserva estado** de dispositivos

```javascript
// Usar:
toggleStreamingMode()  // Alternar modo streaming
```

### **3. Toolbar Superior Anclado**

- **Posición:** Sticky (se queda arriba al scroll)
- **Altura:** 56px (responsive)
- **Controles:**
  - Vista (Grid/Lista)
  - Zoom (50% - 200%)
  - Contador de dispositivos
  - Botón salir

### **4. Tarjetas de Dispositivos**

**Información mostrada:**
- Video en vivo (placeholder por ahora)
- Nombre del dispositivo
- Tipo de conexión (ADB/Socket)
- Bolitas de estado de cuentas
- Botones de acción

**Acciones disponibles:**
- Play (ejecutar FlowLogin)
- Retry (reintentar)
- Menú (más opciones)

### **5. Controles de Zoom**

- **Rango:** 50% - 200%
- **Incremento:** 10%
- **Display:** Muestra porcentaje actual
- **Afecta:** Tamaño de tarjetas

```javascript
// Usar:
increaseStreamingZoom()   // Aumentar zoom
decreaseStreamingZoom()   // Reducir zoom
```

### **6. Vistas**

**Grid View (por defecto):**
- Grilla responsiva
- Auto-fill con min-width
- Mejor para muchos dispositivos

**List View:**
- Una columna
- Video + información lado a lado
- Mejor para detalles

```javascript
// Usar:
changeStreamingView('grid')  // Vista grilla
changeStreamingView('list')  // Vista lista
```

---

## 🎨 Personalización

### **Cambiar ancho del menú:**

En `streaming_ui_styles.css`:
```css
:root {
  --streaming-menu-width: 320px;  /* Cambiar aquí */
}
```

### **Cambiar altura del toolbar:**

```css
:root {
  --streaming-toolbar-height: 56px;  /* Cambiar aquí */
}
```

### **Cambiar gap entre tarjetas:**

```css
:root {
  --streaming-card-gap: 8px;  /* Cambiar aquí */
}
```

### **Cambiar velocidad de transición:**

```css
:root {
  --streaming-menu-transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);  /* Cambiar aquí */
}
```

---

## 🔌 Integración con Funcionalidades Existentes

### **Ejecutar FlowLogin desde streaming:**

```javascript
// En streaming_ui_implementation.js, función playStreamingDevice()
function playStreamingDevice(deviceId) {
  const device = streamingUIState.streamDevices.get(deviceId)?.device;
  if (!device) return;
  
  // Llamar a función existente de FlowLogin
  if (typeof executeFlowLogin === 'function') {
    executeFlowLogin([device.serial]);
  }
}
```

### **Reintentar desde streaming:**

```javascript
// En streaming_ui_implementation.js, función retryStreamingDevice()
function retryStreamingDevice(deviceId) {
  const device = streamingUIState.streamDevices.get(deviceId)?.device;
  if (!device) return;
  
  // Llamar a función existente de retry
  if (typeof retryFlowLogin === 'function') {
    retryFlowLogin([device.serial]);
  }
}
```

### **Mostrar menú contextual:**

```javascript
// En streaming_ui_implementation.js, función showStreamingDeviceMenu()
function showStreamingDeviceMenu(deviceId) {
  const device = streamingUIState.streamDevices.get(deviceId)?.device;
  if (!device) return;
  
  // Mostrar menú con opciones:
  // - Reemplazar cuenta
  // - Limpiar cuentas
  // - Editar nombre
  // - Ver detalles
  // - etc.
}
```

---

## 📱 Responsive Design

### **Desktop (> 1024px):**
- Menú ancho: 320px
- Tarjetas: 280-400px
- Toolbar: 56px
- Todos los controles visibles

### **Tablet (768px - 1024px):**
- Menú ancho: 280px
- Tarjetas: 240px
- Toolbar: 48px
- Algunos controles ocultos

### **Mobile (< 768px):**
- Menú ancho: 100%
- Tarjetas: 200px
- Toolbar: 48px
- Controles minimizados

---

## 🧪 Pruebas

### **Prueba 1: Activar modo streaming**
1. Abrir dashboard
2. Hacer clic en botón "Streaming" en toolbar
3. Verificar que:
   - Menú izquierdo se oculta
   - Vista cambia a grilla de dispositivos
   - Toolbar aparece arriba
   - Botón toggle aparece en esquina

### **Prueba 2: Menú desplegable**
1. En modo streaming, hacer clic en botón toggle (esquina superior izquierda)
2. Verificar que:
   - Menú se desliza desde la izquierda
   - Overlay semi-transparente aparece
   - Menú se puede cerrar haciendo clic en overlay

### **Prueba 3: Zoom**
1. En modo streaming, usar botones de zoom
2. Verificar que:
   - Tarjetas se hacen más grandes/pequeñas
   - Porcentaje se actualiza
   - Rango es 50% - 200%

### **Prueba 4: Vistas**
1. En modo streaming, cambiar entre Grid y List
2. Verificar que:
   - Layout cambia correctamente
   - Información se muestra bien en ambas vistas

### **Prueba 5: Acciones**
1. En modo streaming, hacer clic en botones de acción
2. Verificar que:
   - Play ejecuta FlowLogin
   - Retry reintenta
   - Menú muestra opciones

---

## 🐛 Troubleshooting

### **Problema: Botón "Streaming" no aparece**
- Verificar que `createStreamingModeButton()` se ejecuta
- Verificar que `.toolbar` existe en el DOM
- Revisar consola para errores

### **Problema: Menú no se desliza**
- Verificar que `streaming_ui_styles.css` está cargado
- Verificar que clase `streaming-mode` se agrega al shell
- Revisar transiciones en CSS

### **Problema: Tarjetas no se muestran**
- Verificar que `populateStreamingDevices()` se ejecuta
- Verificar que `state.devices` tiene datos
- Revisar consola para errores

### **Problema: Zoom no funciona**
- Verificar que `updateStreamingZoom()` se ejecuta
- Verificar que `.js-streaming-devices-grid` existe
- Revisar valores de zoom (0.5 - 2)

---

## 📊 Estructura de Datos

### **streamingUIState:**
```javascript
{
  isStreamingMode: boolean,      // ¿Está activo modo streaming?
  isLeftMenuOpen: boolean,       // ¿Menú izquierdo abierto?
  selectedStreamDevice: string,  // ID del dispositivo seleccionado
  streamDevices: Map,            // Mapa de dispositivos en streaming
  zoomLevel: number,             // Nivel de zoom (0.5 - 2)
  viewMode: string               // 'grid' o 'list'
}
```

### **streamDevices Map:**
```javascript
{
  deviceId: {
    element: HTMLElement,        // Elemento DOM de la tarjeta
    device: Object               // Datos del dispositivo
  }
}
```

---

## 🚀 Próximos Pasos

1. **Implementar WebSocket** para streaming real de video
2. **Agregar MediaSource API** para decodificar H.264
3. **Implementar menú contextual** con más opciones
4. **Agregar animaciones** de carga
5. **Optimizar rendimiento** para muchos dispositivos

---

## 📝 Notas Importantes

1. **No rompe funcionalidad existente** - Modo streaming es opcional
2. **Compatible con todas las vistas** - Grid, lista, categorías
3. **Responsive** - Funciona en desktop, tablet y mobile
4. **Accesible** - Soporta navegación por teclado
5. **Performante** - Usa CSS transforms para animaciones suaves

---

## 🎓 Ejemplo de Uso Completo

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Estilos existentes -->
  <link rel="stylesheet" href="./wsapi_demo.html">
  
  <!-- Nuevo: Estilos de streaming -->
  <link rel="stylesheet" href="./streaming_ui_styles.css">
</head>
<body>
  <!-- HTML existente -->
  
  <!-- Scripts existentes -->
  <script src="./wsapi.js"></script>
  
  <!-- Nuevo: Script de streaming -->
  <script src="./streaming_ui_implementation.js"></script>
  
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      // Código existente...
      
      // Nuevo: Inicializar streaming UI
      setTimeout(() => {
        if (typeof initStreamingUI === 'function') {
          initStreamingUI();
        }
      }, 500);
    });
  </script>
</body>
</html>
```

---

## ✅ Checklist de Integración

- [ ] Copiar `streaming_ui_implementation.js` al proyecto
- [ ] Copiar `streaming_ui_styles.css` al proyecto
- [ ] Agregar `<link>` a CSS en `wsapi_demo.html`
- [ ] Agregar `<script>` a JS en `wsapi_demo.html`
- [ ] Agregar inicialización en DOMContentLoaded
- [ ] Probar botón "Streaming"
- [ ] Probar menú desplegable
- [ ] Probar zoom
- [ ] Probar vistas (grid/list)
- [ ] Probar acciones (play, retry)
- [ ] Probar responsive en mobile
- [ ] Verificar que no rompe funcionalidad existente

---

**¡Listo para integrar!** 🎉

Si tienes preguntas o necesitas ajustes, revisa los archivos:
- `streaming_ui_implementation.js` - Lógica
- `streaming_ui_styles.css` - Estilos
- Este documento - Guía de integración