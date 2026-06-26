# Checklist de Prueba: Electron con Dispositivos

**Objetivo:** Verificar que Electron funciona correctamente con dispositivos

**Fecha:** 2026-05-23

---

## ANTES DE INICIAR

### Requisitos
- [ ] Node.js instalado (`node --version`)
- [ ] npm instalado (`npm --version`)
- [ ] Backend C# corriendo (puerto 5000)
- [ ] Backend Python corriendo (puerto 8765)
- [ ] Dispositivos conectados (`adb devices`)
- [ ] Carpeta correcta: `c:\DASHBOARD\FlowDashboard`

### Preparación
- [ ] Abrir 3 terminales (una para cada backend + Electron)
- [ ] Terminal 1: Backend C# (`cd FlowDashboard.Core; dotnet run`)
- [ ] Terminal 2: Backend Python (`python local_adb_server.py`)
- [ ] Terminal 3: Electron (`npm run electron:dev`)

---

## FASE 1: INICIAR ELECTRON

### Paso 1: Ejecutar script de inicio
```powershell
cd c:\DASHBOARD\FlowDashboard
.\iniciar_electron_prueba.ps1
```

**Verificar:**
- [ ] Script verifica Node.js ✅
- [ ] Script verifica npm ✅
- [ ] Script verifica carpeta ✅
- [ ] Script verifica dependencias ✅
- [ ] Script verifica Electron ✅
- [ ] Script verifica backends ✅
- [ ] Script verifica ADB ✅
- [ ] Electron inicia sin errores ✅

### Paso 2: Ventana de Electron abre
**Verificar:**
- [ ] Ventana se abre correctamente
- [ ] Título es "FlowDashboard Pro"
- [ ] UI se carga sin errores
- [ ] No hay errores en consola

---

## FASE 2: VERIFICAR CONEXIONES

### Paso 1: Abrir DevTools
```
Presiona: F12 o Ctrl+Shift+I
```

**Verificar:**
- [ ] DevTools se abre
- [ ] Pestaña "Console" está visible
- [ ] No hay errores rojos

### Paso 2: Verificar C# API
```javascript
await csharpAPI.healthCheck()
```

**Resultado esperado:** `true`

**Verificar:**
- [ ] Retorna `true`
- [ ] No hay errores
- [ ] Consola muestra: "✅ Conectado al servidor C# (ADB)"

### Paso 3: Verificar Python API
```javascript
await pythonAPI.healthCheck()
```

**Resultado esperado:** `true`

**Verificar:**
- [ ] Retorna `true`
- [ ] No hay errores
- [ ] Consola muestra: "✅ Conectado al servidor Python (FlowLogin)"

### Paso 4: Cargar dispositivos
```javascript
const devices = await csharpAPI.get('/devices');
console.log(devices);
```

**Resultado esperado:** Array con dispositivos

**Verificar:**
- [ ] Retorna array
- [ ] Array tiene al menos 1 dispositivo
- [ ] Cada dispositivo tiene: serial, model, state, name
- [ ] No hay errores

### Paso 5: Verificar WebSocket
```javascript
app.streamRenderer.connection.state
```

**Resultado esperado:** `"Connected"`

**Verificar:**
- [ ] Retorna "Connected"
- [ ] No hay errores
- [ ] Consola muestra: "✅ SignalR streaming conectado"

### Paso 6: Ver dispositivos suscritos
```javascript
app.streamRenderer.subscribedSerials
```

**Resultado esperado:** Set con serials

**Verificar:**
- [ ] Retorna Set
- [ ] Set tiene serials de dispositivos
- [ ] No hay errores

---

## FASE 3: VERIFICAR UI

### Paso 1: Dispositivos en la grilla
**Verificar:**
- [ ] Dispositivos aparecen en la grilla
- [ ] Cada dispositivo muestra: nombre, serial, estado
- [ ] Dispositivos tienen bolitas de cuentas (si hay cuentas)
- [ ] Colores son correctos

### Paso 2: Contador de dispositivos
**Verificar:**
- [ ] Contador muestra número correcto de dispositivos
- [ ] Contador se actualiza si conectas/desconectas dispositivo

### Paso 3: Categorías en sidebar
**Verificar:**
- [ ] Categorías aparecen: FlowLogin, FlowRegister, FlowTrack, etc.
- [ ] Cada categoría tiene color diferente
- [ ] Categorías tienen iconos

### Paso 4: Botones de control
**Verificar:**
- [ ] Botón "Conectar" está visible
- [ ] Botón "Actualizar" está visible
- [ ] Botón "Streaming" está visible (si está habilitado)
- [ ] Botones responden a clicks

### Paso 5: Panel de cuentas
**Verificar:**
- [ ] Panel de cuentas está visible
- [ ] Pestañas: Total, Válidas, No válidas
- [ ] Campos: Delimitador, Dividir
- [ ] Botones: Limpiar, Dividir

---

## FASE 4: PROBAR INTERACCIÓN

### Paso 1: Seleccionar dispositivo
**Acción:** Click en un dispositivo

**Verificar:**
- [ ] Dispositivo cambia de color/estilo
- [ ] Contador de seleccionados aumenta
- [ ] Dispositivo tiene checkmark o indicador

### Paso 2: Seleccionar múltiples dispositivos
**Acción:** Click en varios dispositivos

**Verificar:**
- [ ] Múltiples dispositivos se seleccionan
- [ ] Contador muestra número correcto
- [ ] Botones de acción se habilitan

### Paso 3: Deseleccionar todos
**Acción:** Click en botón "Deseleccionar todo"

**Verificar:**
- [ ] Todos los dispositivos se deseleccionan
- [ ] Contador vuelve a 0
- [ ] Botones de acción se deshabilitan

### Paso 4: Agregar cuentas
**Acción:** Pegar cuentas en panel de cuentas

**Verificar:**
- [ ] Cuentas se pegan correctamente
- [ ] Contador de cuentas se actualiza
- [ ] Cuentas se guardan en localStorage

### Paso 5: Dividir cuentas
**Acción:** Seleccionar dispositivos, agregar cuentas, click "Dividir"

**Verificar:**
- [ ] Cuentas se dividen entre dispositivos
- [ ] Cada dispositivo recibe su parte
- [ ] Bolitas de cuentas aparecen en dispositivos

---

## FASE 5: PROBAR RECONEXIÓN

### Paso 1: Desconectar C# backend
**Acción:** En terminal de C#, presiona Ctrl+C

**Verificar en Electron console:**
- [ ] Aparece: "⚠️ Reintentando C# API (intento 1/3)"
- [ ] Aparece: "⚠️ Reintentando C# API (intento 2/3)"
- [ ] Aparece: "⚠️ Reintentando C# API (intento 3/3)"

### Paso 2: Reconectar C# backend
**Acción:** En terminal de C#, ejecuta `dotnet run`

**Verificar en Electron console:**
- [ ] Aparece: "✅ Conectado al servidor C# (ADB)"
- [ ] Dispositivos se recargan
- [ ] UI vuelve a funcionar

### Paso 3: Desconectar Python backend
**Acción:** En terminal de Python, presiona Ctrl+C

**Verificar en Electron console:**
- [ ] Aparece: "⚠️ Reintentando Python API (intento 1/2)"
- [ ] Aparece: "⚠️ Reintentando Python API (intento 2/2)"

### Paso 4: Reconectar Python backend
**Acción:** En terminal de Python, ejecuta `python local_adb_server.py`

**Verificar en Electron console:**
- [ ] Aparece: "✅ Conectado al servidor Python (FlowLogin)"
- [ ] UI vuelve a funcionar

### Paso 5: Desconectar dispositivo
**Acción:** Desconecta dispositivo de USB o WiFi

**Verificar:**
- [ ] Dispositivo desaparece de la grilla
- [ ] Contador de dispositivos disminuye
- [ ] Consola muestra: "📴 1 dispositivo(s) desconectado(s)"

### Paso 6: Reconectar dispositivo
**Acción:** Reconecta dispositivo

**Verificar:**
- [ ] Dispositivo reaparece en la grilla
- [ ] Contador de dispositivos aumenta
- [ ] Consola muestra: "📱 1 dispositivo(s) conectado(s)"

---

## FASE 6: PROBAR PERFORMANCE

### Paso 1: Abrir DevTools Performance
```
F12 → Performance tab
```

### Paso 2: Grabar durante 10 segundos
**Acción:**
1. Click en botón "Record"
2. Esperar 10 segundos
3. Click en botón "Stop"

### Paso 3: Verificar métricas
**Verificar:**
- [ ] CPU: 5-15% (idle)
- [ ] CPU: 15-25% (con polling)
- [ ] Memoria: 150-200MB
- [ ] FPS: 50-60 (sin jank)
- [ ] No hay frames dropped

### Paso 4: Probar con scroll
**Acción:** Scroll en la grilla de dispositivos

**Verificar:**
- [ ] Scroll es fluido
- [ ] No hay lag
- [ ] FPS se mantiene >50

### Paso 5: Probar con muchos dispositivos
**Acción:** Conectar 50+ dispositivos

**Verificar:**
- [ ] UI sigue siendo fluida
- [ ] Scroll sigue siendo fluido
- [ ] CPU no sube más del 30%
- [ ] Memoria no sube más del 300MB

---

## FASE 7: PROBAR STREAMING (Opcional)

### Paso 1: Habilitar Live Preview
**Acción:** Click en botón "Live" o "Streaming"

**Verificar:**
- [ ] Botón cambia de estado
- [ ] Consola muestra: "🔌 Iniciando conexión WebSocket de streaming"

### Paso 2: Abrir streams
**Acción:** Seleccionar dispositivos, click "Streaming"

**Verificar:**
- [ ] Ventanas de scrcpy se abren
- [ ] Pantalla en vivo se muestra
- [ ] Ventanas se posicionan correctamente

### Paso 3: Cerrar streams
**Acción:** Click en botón "Detener" o cerrar ventanas

**Verificar:**
- [ ] Ventanas se cierran
- [ ] Consola muestra: "✅ Stream detenido"

---

## FASE 8: PROBAR FLOWLOGIN (Opcional)

### Paso 1: Agregar cuentas
**Acción:** Pegar cuentas en panel de cuentas

**Verificar:**
- [ ] Cuentas se pegan correctamente
- [ ] Contador se actualiza

### Paso 2: Seleccionar dispositivos
**Acción:** Click en dispositivos para seleccionar

**Verificar:**
- [ ] Dispositivos se seleccionan
- [ ] Contador de seleccionados se actualiza

### Paso 3: Ejecutar FlowLogin
**Acción:** Click en botón "Ejecutar FlowLogin"

**Verificar:**
- [ ] Botón se deshabilita
- [ ] Consola muestra: "🚀 Iniciando FlowLogin"
- [ ] Bolitas de cuentas cambian a azul (running)

### Paso 4: Monitorear progreso
**Acción:** Esperar a que FlowLogin termine

**Verificar:**
- [ ] Bolitas cambian de color según estado
- [ ] Verde = success
- [ ] Rojo = error
- [ ] Naranja = already
- [ ] Morado = review

### Paso 5: Detener FlowLogin
**Acción:** Click en botón "Detener"

**Verificar:**
- [ ] FlowLogin se detiene
- [ ] Bolitas vuelven a gris
- [ ] Consola muestra: "⏹️ FlowLogin detenido"

---

## RESUMEN FINAL

### Checklist General
- [ ] Electron inicia sin errores
- [ ] Conexiones a backends funcionan
- [ ] Dispositivos se cargan correctamente
- [ ] UI es responsiva
- [ ] Interacción funciona
- [ ] Reconexión funciona
- [ ] Performance es buena
- [ ] Streaming funciona (opcional)
- [ ] FlowLogin funciona (opcional)

### Métricas de Éxito
- [ ] CPU < 15% (idle)
- [ ] Memoria < 200MB
- [ ] FPS > 50
- [ ] Latencia < 100ms
- [ ] Reconexión < 5s
- [ ] Carga de dispositivos < 2s

### Próximos Pasos
- [ ] Documentar resultados
- [ ] Reportar problemas
- [ ] Continuar con FASE 2 (Optimización)
- [ ] Probar con más dispositivos
- [ ] Probar en máquina real

---

## NOTAS

- Guardar logs de consola para debugging
- Tomar screenshots de errores
- Anotar tiempos de respuesta
- Reportar cualquier anomalía

---

**¡Buena suerte con las pruebas! 🚀**

