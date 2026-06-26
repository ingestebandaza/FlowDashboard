# Fix: Scroll y Z-Index en Electron Dashboard - 2026-05-23

## Problemas Identificados

### 1. **Z-Index: Pantallas de dispositivos aparecen encima de modales**
- Las ventanas de streaming (scrcpy) aparecían por encima de las ventanas modales (configuración, editor de cuentas, etc.)
- Las modales deberían estar siempre visibles encima de todo

### 2. **Scroll: Dispositivos no se actualizan al hacer scroll**
- Los dispositivos cargaban inicialmente en el contenedor
- Al hacer scroll dentro de `.device-list`, los dispositivos no se reposicionaban
- El contenedor se movía pero los streams de video no se actualizaban

## Soluciones Implementadas

### Fix 1: Z-Index en `styles.css`

**Archivo**: `electron-app/src/renderer/styles.css`

**Cambio**:
```css
.device-live-screen {
  position: absolute;
  top: 44px;
  bottom: 44px;
  left: 0;
  right: 0;
  border-radius: 0;
  overflow: hidden;
  background: #0b1220;
  z-index: -1;  /* ← AGREGADO: Asegurar que las pantallas estén detrás de modales */
}
```

**Explicación**:
- `.device-live-screen` es el contenedor donde se renderiza el video de scrcpy
- Agregué `z-index: -1` para que siempre esté detrás de otros elementos
- Las modales HTML tienen `z-index: 10000 !important` en `#overlay-layer`
- Esto asegura que las modales siempre aparezcan encima de las pantallas de dispositivos

### Fix 2: Scroll Listener en `app.js`

**Archivo**: `electron-app/src/renderer/app.js`

**Cambio**:
```javascript
setupGlobalListeners() {
  // ... código existente ...
  
  const mainArea = document.querySelector('.main-area');
  if (mainArea) {
    mainArea.addEventListener('scroll', () => this.scheduleLivePreviewSyncFast(), { passive: true });
  }
  
  // AGREGADO: Listener de scroll en .device-list
  const deviceList = document.getElementById('deviceList');
  if (deviceList) {
    deviceList.addEventListener('scroll', () => this.scheduleLivePreviewSyncFast(), { passive: true });
  }
  
  window.addEventListener('resize', () => this.scheduleLivePreviewSync(true));
  window.addEventListener('beforeunload', () => this.stopLivePreviewStreams());
}
```

**Explicación**:
- El contenedor `.device-list` tiene `max-height: 600px` y `overflow-y: auto`
- El scroll real ocurre dentro de `.device-list`, no en `.main-area`
- Agregué un listener de scroll en `#deviceList` que llama a `scheduleLivePreviewSyncFast()`
- Esta función oculta los streams durante el scroll y los reposiciona al terminar
- Evita el parpadeo y mejora el rendimiento durante el scroll

## Cómo Funciona

### Flujo de Scroll:
1. Usuario hace scroll en `.device-list`
2. Se dispara el evento `scroll` en `#deviceList`
3. Se llama a `scheduleLivePreviewSyncFast()`
4. Los streams se ocultan (`setStreamsVisibility(false)`)
5. Se inicia un timer de 80ms
6. Al terminar el scroll, se llama a `repositionLivePreview()`
7. Los streams se reposicionan en sus nuevas ubicaciones
8. Se muestran nuevamente (`setStreamsVisibility(true)`)

### Flujo de Z-Index:
1. Las pantallas de dispositivos tienen `z-index: -1`
2. Los modales están en `#overlay-layer` con `z-index: 9999`
3. Los elementos dentro de `#overlay-layer` tienen `z-index: 10000 !important`
4. Resultado: Modales siempre aparecen encima de las pantallas

## Validación

✅ **Cambios aplicados correctamente**:
- `styles.css`: Z-index agregado a `.device-live-screen`
- `app.js`: Listener de scroll agregado en `setupGlobalListeners()`

✅ **Comportamiento esperado**:
- Al hacer scroll en la grilla de dispositivos, los streams se reposicionan correctamente
- Las modales (configuración, editor de cuentas, etc.) aparecen siempre encima de los streams
- No hay parpadeo durante el scroll

## Próximos Pasos

1. **Prueba en máquina real**: Verificar que el scroll funciona correctamente con 17+ dispositivos
2. **Optimización**: Si hay lag durante el scroll, considerar aumentar el timeout de 80ms
3. **Performance**: Monitorear el uso de CPU durante scroll con muchos dispositivos

## Archivos Modificados

- `electron-app/src/renderer/styles.css` (1 línea agregada)
- `electron-app/src/renderer/app.js` (5 líneas agregadas)

## Notas

- Los cambios son mínimos y no afectan otras funcionalidades
- El fix de z-index es compatible con el reparenting Win32 de scrcpy
- El listener de scroll es pasivo (`{ passive: true }`) para mejor rendimiento
