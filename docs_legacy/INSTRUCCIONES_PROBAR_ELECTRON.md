# Instrucciones para Probar Electron con Dispositivos

**Objetivo:** Iniciar Electron y verificar que se conecta correctamente a los backends y dispositivos

---

## PASO 1: Verificar Requisitos

### 1.1 Verificar que Node.js está instalado
```powershell
node --version
npm --version
# Debe mostrar versiones (ej: v18.0.0, 9.0.0)
```

### 1.2 Verificar que los backends están corriendo

**Backend C# (puerto 5000):**
```powershell
# En otra terminal
cd c:\DASHBOARD\FlowDashboard\FlowDashboard.Core
dotnet run
# Debe mostrar: "Now listening on: http://localhost:5000"
```

**Backend Python (puerto 8765):**
```powershell
# En otra terminal
cd c:\DASHBOARD\FlowDashboard
python local_adb_server.py
# Debe mostrar: "Servidor escuchando en puerto 8765"
```

### 1.3 Verificar que hay dispositivos conectados
```powershell
adb devices
# Debe mostrar al menos un dispositivo
```

---

## PASO 2: Instalar Dependencias de Electron

```powershell
cd c:\DASHBOARD\FlowDashboard

# Instalar dependencias npm
npm install

# Verificar que se instaló correctamente
npm list electron
# Debe mostrar versión de electron
```

---

## PASO 3: Iniciar Electron

### Opción A: Usando npm (Recomendado)
```powershell
cd c:\DASHBOARD\FlowDashboard

# Iniciar en modo desarrollo
npm run electron:dev

# Debe abrir ventana de Electron con el dashboard
```

### Opción B: Usando PowerShell
```powershell
cd c:\DASHBOARD\FlowDashboard

# Ejecutar el script de inicio
.\abrir_electron.ps1

# Debe abrir ventana de Electron con el dashboard
```

### Opción C: Usando batch
```cmd
cd c:\DASHBOARD\FlowDashboard

# Ejecutar el script de inicio
abrir_electron.bat

# Debe abrir ventana de Electron con el dashboard
```

---

## PASO 4: Verificar Conexiones en Electron

Una vez que Electron está abierto:

### 4.1 Abrir DevTools
```
Presiona: F12 o Ctrl+Shift+I
```

### 4.2 Ir a la pestaña Console
```
Click en "Console" tab
```

### 4.3 Verificar conexión a C# API
```javascript
await csharpAPI.healthCheck()
```
**Resultado esperado:** `true`

### 4.4 Verificar conexión a Python API
```javascript
await pythonAPI.healthCheck()
```
**Resultado esperado:** `true`

### 4.5 Cargar dispositivos
```javascript
const devices = await csharpAPI.get('/devices');
console.log(devices);
```
**Resultado esperado:** Array con dispositivos conectados

### 4.6 Verificar WebSocket de streaming
```javascript
app.streamRenderer.connection.state
```
**Resultado esperado:** `"Connected"`

### 4.7 Ver dispositivos suscritos
```javascript
app.streamRenderer.subscribedSerials
```
**Resultado esperado:** Set con serials de dispositivos

---

## PASO 5: Probar Funcionalidades

### 5.1 Ver dispositivos en la grilla
- Los dispositivos deben aparecer en la grilla principal
- Cada dispositivo debe mostrar: nombre, serial, estado, bolitas de cuentas

### 5.2 Seleccionar dispositivos
- Click en un dispositivo para seleccionarlo
- Debe cambiar de color/estilo
- Contador de seleccionados debe actualizar

### 5.3 Ver categorías
- Las categorías (FlowLogin, FlowRegister, etc.) deben aparecer en el sidebar
- Deben tener colores diferentes

### 5.4 Probar streaming (si está habilitado)
- Click en botón "Streaming" o "Live Preview"
- Debe abrir ventanas de scrcpy para dispositivos seleccionados
- Debe mostrar pantalla en vivo del dispositivo

### 5.5 Probar FlowLogin
- Agregar cuentas en el panel de Cuentas
- Seleccionar dispositivos
- Click en "Ejecutar FlowLogin"
- Las bolitas deben cambiar de color según el estado

---

## PASO 6: Probar Reconexión

### 6.1 Probar reconexión a C#
```
1. En terminal de C#, presiona Ctrl+C para detener
2. En Electron console, ver: "⚠️ Reintentando C# API (intento 1/3)"
3. Reiniciar C# backend
4. En Electron console, ver: "✅ Conectado al servidor C# (ADB)"
```

### 6.2 Probar reconexión a Python
```
1. En terminal de Python, presiona Ctrl+C para detener
2. En Electron console, ver: "⚠️ Reintentando Python API (intento 1/2)"
3. Reiniciar Python backend
4. En Electron console, ver: "✅ Conectado al servidor Python (FlowLogin)"
```

### 6.3 Probar reconexión de WebSocket
```
1. Desconectar dispositivo de red
2. En Electron console, ver: "⚠️ SignalR reconectando"
3. Reconectar dispositivo
4. En Electron console, ver: "✅ SignalR reconectado"
```

---

## PASO 7: Verificar Performance

### 7.1 Abrir DevTools Performance
```
F12 → Performance tab
```

### 7.2 Grabar durante 10 segundos
```
1. Click en botón "Record"
2. Esperar 10 segundos
3. Click en botón "Stop"
```

### 7.3 Verificar métricas
- CPU: Debe estar entre 5-15% (idle)
- Memoria: Debe estar entre 150-200MB
- FPS: Debe estar entre 50-60 (sin jank)

---

## TROUBLESHOOTING

### Error: "Cannot find module 'electron'"
```powershell
# Reinstalar dependencias
npm install
npm install electron --save-dev
```

### Error: "Port 5000 already in use"
```powershell
# Encontrar proceso usando puerto 5000
netstat -ano | findstr :5000

# Matar proceso (reemplazar PID)
taskkill /PID <PID> /F

# O cambiar puerto en C# backend
```

### Error: "Port 8765 already in use"
```powershell
# Encontrar proceso usando puerto 8765
netstat -ano | findstr :8765

# Matar proceso (reemplazar PID)
taskkill /PID <PID> /F

# O cambiar puerto en Python backend
```

### Error: "WebSocket connection failed"
```javascript
// Verificar que C# backend está corriendo
await csharpAPI.healthCheck()

// Verificar puerto 5000
netstat -ano | findstr :5000

// Reiniciar C# backend
```

### Error: "Dispositivos no se cargan"
```javascript
// Verificar conexión a C#
await csharpAPI.get('/devices')

// Ver error en consola
// Verificar que backend C# está corriendo
// Verificar que hay dispositivos conectados: adb devices
```

### Error: "Streaming no funciona"
```javascript
// Verificar que scrcpy está instalado
scrcpy --version

// Verificar que hay dispositivos conectados
adb devices

// Verificar que FlowAgent APK está instalado
adb shell pm list packages | findstr flowagent
```

---

## CHECKLIST DE VALIDACIÓN

- [ ] Node.js está instalado
- [ ] Backend C# está corriendo (puerto 5000)
- [ ] Backend Python está corriendo (puerto 8765)
- [ ] Hay dispositivos conectados (adb devices)
- [ ] Electron inicia sin errores
- [ ] DevTools se abre (F12)
- [ ] C# API responde (await csharpAPI.healthCheck())
- [ ] Python API responde (await pythonAPI.healthCheck())
- [ ] Dispositivos se cargan (await csharpAPI.get('/devices'))
- [ ] WebSocket está conectado (app.streamRenderer.connection.state)
- [ ] Dispositivos aparecen en la grilla
- [ ] Se pueden seleccionar dispositivos
- [ ] Categorías aparecen en el sidebar
- [ ] Streaming funciona (si está habilitado)
- [ ] FlowLogin funciona (si hay cuentas)
- [ ] Reconexión funciona (detener/reiniciar backends)
- [ ] Performance es buena (CPU <15%, Memoria <200MB)

---

## PRÓXIMOS PASOS

Si todo funciona correctamente:

1. **Probar con múltiples dispositivos** (10+)
2. **Probar con muchas cuentas** (100+)
3. **Probar reconexión** (desconectar/reconectar)
4. **Probar performance** (DevTools)
5. **Continuar con FASE 2** (Optimización)

Si hay problemas:

1. **Revisar logs** en DevTools Console
2. **Verificar backends** están corriendo
3. **Verificar dispositivos** están conectados
4. **Leer troubleshooting** arriba
5. **Contactar soporte** si persiste

---

## REFERENCIAS

- `INICIO_RAPIDO_ELECTRON.md` - Guía rápida
- `MIGRACION_ELECTRON_FASE1_COMPLETADA.md` - Detalles técnicos
- `PROJECT_CONTEXT.md` - Contexto del proyecto
- `AGENTS.md` - Reglas del proyecto

---

**¿Listo para probar? ¡Comienza con PASO 1!**

