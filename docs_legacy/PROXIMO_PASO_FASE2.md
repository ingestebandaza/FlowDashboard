# Próximo Paso: FASE 2 - Optimización de Performance

**Fecha:** 2026-05-23  
**Estado:** LISTO PARA COMENZAR  
**Duración estimada:** 2-3 horas

---

## Resumen de FASE 1 ✅

Ya completamos:
- ✅ Cliente API robusto con reintentos
- ✅ Reconexión automática de WebSocket
- ✅ Manejo robusto de errores
- ✅ Eventos personalizados

---

## FASE 2: Optimización de Performance

### Objetivo
Optimizar el polling y renderizado para que Electron funcione fluidamente con 50+ dispositivos sin saturar CPU/red.

### Cambios a realizar

#### 1. Throttling de Polling (CRÍTICO)

**Archivo:** `electron-app/src/renderer/app.js`

**Problema actual:**
```javascript
// Cada 5s se llama loadDevices() sin verificar si ya hay request en progreso
setInterval(() => this.loadDevices(), 5000);
```

**Solución:**
```javascript
startPolling() {
  let isLoadingDevices = false;
  let isLoadingStatuses = false;
  
  // Polling de dispositivos (cada 5s)
  setInterval(async () => {
    if (isLoadingDevices) return; // Skip si ya hay request
    
    isLoadingDevices = true;
    try {
      await this.loadDevices();
    } finally {
      isLoadingDevices = false;
    }
  }, 5000);
  
  // Polling de estados (cada 2s)
  setInterval(async () => {
    if (isLoadingStatuses) return; // Skip si ya hay request
    
    isLoadingStatuses = true;
    try {
      await this.loadLoginStatuses();
      this.updateAccountDots(); // Solo actualizar bolitas, no re-renderizar
    } finally {
      isLoadingStatuses = false;
    }
  }, 2000);
}
```

#### 2. Caché de Dispositivos

**Archivo:** `electron-app/src/renderer/app.js`

**Problema actual:**
```javascript
// Cada polling recarga todos los dispositivos
this.devices = await csharpAPI.get('/devices');
this.renderDevices(); // Re-renderiza todo
```

**Solución:**
```javascript
async loadDevices() {
  const newDevices = await csharpAPI.get('/devices');
  
  // Detectar cambios
  const oldSerials = new Set(this.devices.map(d => d.serial));
  const newSerials = new Set(newDevices.map(d => d.serial));
  
  const connected = newDevices.filter(d => !oldSerials.has(d.serial));
  const disconnected = this.devices.filter(d => !newSerials.has(d.serial));
  
  // Notificar cambios
  if (connected.length > 0) {
    console.log(`📱 ${connected.length} dispositivos conectados`);
    this.notifyUI('devices-connected', { devices: connected });
  }
  
  if (disconnected.length > 0) {
    console.log(`📴 ${disconnected.length} dispositivos desconectados`);
    this.notifyUI('devices-disconnected', { devices: disconnected });
    
    // Detener streams de dispositivos desconectados
    for (const device of disconnected) {
      await this.stopStream(device.serial);
    }
  }
  
  this.devices = newDevices;
  
  // Solo re-renderizar si hay cambios
  if (connected.length > 0 || disconnected.length > 0) {
    this.renderDevices();
  }
}
```

#### 3. Actualización Incremental de Bolitas

**Archivo:** `electron-app/src/renderer/app.js`

**Problema actual:**
```javascript
// Cada 2s se re-renderiza TODO
async loadLoginStatuses() {
  this.loginStatuses = await pythonAPI.post('/login-status', {...});
  this.renderDevices(); // Re-renderiza todo
}
```

**Solución:**
```javascript
async loadLoginStatuses() {
  const statuses = await pythonAPI.post('/login-status', {...});
  
  // Actualizar solo estados que cambiaron
  for (const [serial, status] of Object.entries(statuses)) {
    const oldStatus = this.loginStatuses[serial];
    
    if (JSON.stringify(oldStatus) !== JSON.stringify(status)) {
      this.loginStatuses[serial] = status;
      
      // Actualizar solo las bolitas de este dispositivo
      this.updateAccountDotsForDevice(serial);
    }
  }
}

updateAccountDotsForDevice(serial) {
  const tile = document.querySelector(`[data-device-serial="${serial}"]`);
  if (!tile) return;
  
  const dotsContainer = tile.querySelector('.account-status-column');
  if (!dotsContainer) return;
  
  const statuses = this.getDeviceStatuses(serial);
  dotsContainer.innerHTML = this.renderAccountDots(statuses);
}
```

#### 4. Virtualización de Lista (Si hay >100 dispositivos)

**Archivo:** `electron-app/src/renderer/app.js`

**Problema actual:**
```javascript
// Renderiza todos los dispositivos, incluso los no visibles
renderDevices() {
  const html = this.devices.map(device => this.renderDeviceTile(device)).join('');
  document.getElementById('deviceList').innerHTML = html;
}
```

**Solución (opcional, solo si hay >100 dispositivos):**
```javascript
renderDevices() {
  const container = document.getElementById('deviceList');
  const visibleHeight = container.clientHeight;
  const tileHeight = 150; // Altura aproximada de cada tile
  const visibleCount = Math.ceil(visibleHeight / tileHeight) + 2; // +2 buffer
  
  // Renderizar solo tiles visibles + buffer
  const startIndex = Math.max(0, Math.floor(container.scrollTop / tileHeight) - 1);
  const endIndex = Math.min(this.devices.length, startIndex + visibleCount);
  
  const visibleDevices = this.devices.slice(startIndex, endIndex);
  const html = visibleDevices.map(device => this.renderDeviceTile(device)).join('');
  
  container.innerHTML = html;
}

// Agregar listener de scroll
document.getElementById('deviceList').addEventListener('scroll', () => {
  this.renderDevices();
});
```

#### 5. Debouncing de Eventos

**Archivo:** `electron-app/src/renderer/app.js`

**Problema actual:**
```javascript
// Cada resize/scroll dispara renderizado
window.addEventListener('resize', () => this.renderDevices());
```

**Solución:**
```javascript
setupGlobalListeners() {
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      this.renderDevices();
    }, 300); // Esperar 300ms después de que termine el resize
  });
}
```

---

## Checklist de Implementación

- [ ] Agregar flag `isLoadingDevices` y `isLoadingStatuses`
- [ ] Modificar `startPolling()` para usar flags
- [ ] Agregar detección de cambios en `loadDevices()`
- [ ] Crear `updateAccountDotsForDevice()` para actualización incremental
- [ ] Modificar `loadLoginStatuses()` para usar actualización incremental
- [ ] Agregar debouncing a eventos de resize/scroll
- [ ] Probar con 10 dispositivos
- [ ] Probar con 50 dispositivos
- [ ] Probar con 100+ dispositivos
- [ ] Verificar CPU/memoria en DevTools
- [ ] Verificar red en DevTools

---

## Cómo Probar

### 1. Verificar que no hay requests concurrentes

```javascript
// En consola de Electron
// Abrir DevTools (F12)
// Ir a Network tab
// Hacer scroll en la lista de dispositivos
// Verificar que no hay múltiples requests a /devices simultáneamente
```

### 2. Verificar que solo se actualizan bolitas

```javascript
// En consola de Electron
// Ejecutar FlowLogin en un dispositivo
// Verificar que solo se actualiza la bolita de ese dispositivo
// No debe re-renderizar toda la grilla
```

### 3. Verificar performance

```javascript
// En consola de Electron
// Abrir DevTools (F12)
// Ir a Performance tab
// Grabar durante 10 segundos
// Verificar que CPU no sube más del 20%
// Verificar que no hay jank (frames dropped)
```

### 4. Verificar con muchos dispositivos

```javascript
// Conectar 50+ dispositivos
// Verificar que la UI sigue siendo fluida
// Verificar que no hay lag al scroll
// Verificar que no hay lag al ejecutar FlowLogin
```

---

## Métricas de Éxito

| Métrica | Antes | Después | Meta |
|---------|-------|---------|------|
| CPU (idle) | 15-20% | 5-10% | <10% |
| CPU (polling) | 25-30% | 10-15% | <15% |
| Memoria | 200-250MB | 150-180MB | <200MB |
| Requests/min | 60 | 30 | <30 |
| Latencia UI | 200-300ms | 50-100ms | <100ms |
| FPS (scroll) | 30-40 | 55-60 | >50 |

---

## Notas

1. **No modificar HTML:** Solo trabajar en Electron
2. **Mantener compatibilidad:** No romper features existentes
3. **Logging:** Agregar logs para debugging
4. **Testing:** Probar con diferentes cantidades de dispositivos
5. **Performance:** Usar DevTools para medir

---

## Próximos Pasos Después de FASE 2

1. **FASE 3:** Seguridad (autenticación, validación, encriptación)
2. **FASE 4:** Migración completa (mover toda lógica del HTML)
3. **FASE 5:** Documentación y release

---

## Recursos

- `MIGRACION_ELECTRON_FASE1_COMPLETADA.md` - Detalles de FASE 1
- `PLAN_MIGRACION_ELECTRON_COMPLETO.md` - Plan general
- `PROJECT_CONTEXT.md` - Contexto del proyecto
- `AGENTS.md` - Reglas del proyecto

