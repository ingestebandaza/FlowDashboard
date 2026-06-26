# Plan de Migración Completo a Electron

**Objetivo:** Hacer de Electron el dashboard principal, eliminando dependencia del HTML.

**Fecha:** 2026-05-23

---

## FASE 1: Validación y Robustez (CRÍTICO)

### 1.1 Validación de Entrada en Endpoints C#

**Archivos a modificar:**
- `FlowDashboard.Core/Controllers/DevicesController.cs`
- `FlowDashboard.Core/Controllers/StreamingController.cs`
- `FlowDashboard.Core/Services/AdbService.cs`

**Cambios:**
- ✅ Validar comando en `POST /api/devices/execute`
- ✅ Validar tamaño de frame en `POST /api/streaming/frames`
- ✅ Validar formato de cuentas en `POST /api/devices/flowlogin/start`
- ✅ Validar serial en todos los endpoints
- ✅ Limitar longitud de strings
- ✅ Whitelist de comandos permitidos

### 1.2 Manejo de Errores en Electron

**Archivos a modificar:**
- `electron-app/src/renderer/app.js`

**Cambios:**
- ✅ Agregar `fetchWithTimeout()` para todas las requests
- ✅ Implementar reintentos con exponential backoff
- ✅ Agregar try-catch en todas las funciones async
- ✅ Mostrar errores al usuario en UI
- ✅ Logging centralizado de errores

### 1.3 Reconexión Automática

**Archivos a modificar:**
- `electron-app/src/renderer/stream-renderer.js`
- `electron-app/src/renderer/app.js`

**Cambios:**
- ✅ Implementar reconexión de WebSocket con backoff
- ✅ Resubscribirse a dispositivos tras reconexión
- ✅ Sincronizar estado tras reconexión
- ✅ Notificar usuario de desconexiones

---

## FASE 2: Optimización de Performance

### 2.1 Throttling de Polling

**Archivos a modificar:**
- `electron-app/src/renderer/app.js`

**Cambios:**
- ✅ Agregar flag `isLoading` para evitar requests concurrentes
- ✅ Implementar throttling en `loadLoginStatuses()`
- ✅ Caché de dispositivos con detección de cambios
- ✅ Notificar solo cambios (dispositivos conectados/desconectados)

### 2.2 Optimización de Renderizado

**Archivos a modificar:**
- `electron-app/src/renderer/app.js`
- `electron-app/src/renderer/styles.css`

**Cambios:**
- ✅ Usar `requestAnimationFrame` para actualizaciones visuales
- ✅ Virtualización de lista de dispositivos (si hay >100)
- ✅ Lazy loading de imágenes/canvas
- ✅ Debouncing de eventos de resize/scroll

---

## FASE 3: Seguridad

### 3.1 Autenticación

**Archivos a modificar:**
- `FlowDashboard.Core/Program.cs`
- `FlowDashboard.Core/Controllers/*.cs`

**Cambios:**
- ✅ Agregar autenticación en endpoints críticos
- ✅ Validar origen (CORS)
- ✅ Usar HTTPS en producción

### 3.2 Encriptación

**Archivos a modificar:**
- `FlowDashboard.Core/Models/Device.cs`
- `FlowDashboard.Core/Services/EncryptionService.cs`

**Cambios:**
- ✅ Encriptar MAC Address en respuestas
- ✅ Encriptar cuentas en tránsito
- ✅ Usar HTTPS para todas las comunicaciones

---

## FASE 4: Migración Completa

### 4.1 Eliminar Dependencia del HTML

**Archivos a modificar:**
- `electron-app/src/renderer/app.js`

**Cambios:**
- ✅ Mover toda la lógica del HTML a Electron
- ✅ Replicar todas las features del HTML
- ✅ Probar todas las funcionalidades

### 4.2 Actualizar Lanzador

**Archivos a modificar:**
- `abrir_electron.ps1`
- `abrir_electron.bat`

**Cambios:**
- ✅ Lanzar solo Electron (no HTML)
- ✅ Iniciar backend C# automáticamente
- ✅ Verificar conexión antes de abrir UI

### 4.3 Documentación

**Archivos a crear:**
- `MIGRACION_ELECTRON_COMPLETADA.md`
- `GUIA_USUARIO_ELECTRON.md`

---

## PRIORIDAD DE IMPLEMENTACIÓN

1. **CRÍTICO (Hoy):**
   - Validación de entrada en C#
   - Manejo de errores en Electron
   - Reconexión automática de WebSocket

2. **IMPORTANTE (Esta semana):**
   - Throttling de polling
   - Optimización de renderizado
   - Autenticación básica

3. **MEJORA (Próximas semanas):**
   - Encriptación
   - Migración completa
   - Documentación

---

## CHECKLIST DE VALIDACIÓN

- [ ] Todos los endpoints C# validan entrada
- [ ] Electron maneja errores de conexión
- [ ] WebSocket se reconecta automáticamente
- [ ] Polling no genera requests concurrentes
- [ ] UI responde rápido con 50+ dispositivos
- [ ] Autenticación funciona
- [ ] Encriptación funciona
- [ ] Todas las features del HTML funcionan en Electron
- [ ] Documentación actualizada
- [ ] Pruebas en máquina real exitosas

---

## NOTAS

- No modificar HTML (`wsapi_demo.html`) - solo referencia
- Electron es el objetivo principal
- Mantener compatibilidad con Python backend (8765)
- Mantener compatibilidad con C# backend (5000)
- Probar con 10+ dispositivos conectados
- Probar reconexión de WebSocket
- Probar cambios de red (WiFi → Ethernet)

