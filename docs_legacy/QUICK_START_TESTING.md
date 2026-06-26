# 🚀 Quick Start - Testing WebP Canvas Streaming

**Tiempo estimado:** 15-20 minutos  
**Requisitos:** Windows 10+, Android device, Node.js, .NET 8

---

## 1️⃣ Verificar Compilación (2 min)

### Backend C#
```powershell
cd "c:\DASHBOARD\FlowDashboard\FlowDashboard.Core"
dotnet build
```
✅ Esperado: "Compilación correcta"

### Electron JavaScript
```powershell
node --check "c:\DASHBOARD\FlowDashboard\electron-app\src\renderer\stream-renderer.js"
node --check "c:\DASHBOARD\FlowDashboard\electron-app\src\renderer\app.js"
```
✅ Esperado: Sin errores

---

## 2️⃣ Iniciar Backend (3 min)

```powershell
cd "c:\DASHBOARD\FlowDashboard\FlowDashboard.Core"
dotnet run
```

**Esperado en console:**
```
🚀 FlowDashboard Core Engine iniciado
📡 API REST: http://localhost:5000
🔌 WebSocket Streaming: puerto 5001
```

**Verificar health:**
```powershell
# En otra terminal
Invoke-RestMethod -Uri http://127.0.0.1:5000/health -TimeoutSec 5 | ConvertTo-Json
```

---

## 3️⃣ Iniciar Electron App (3 min)

```powershell
# En otra terminal
cd "c:\DASHBOARD\FlowDashboard\electron-app"
npm start
```

**Esperado:**
- Ventana Electron abre
- Console (F12) muestra: `✅ WebSocket streaming conectado`

---

## 4️⃣ Conectar Dispositivo Android (3 min)

```powershell
# En otra terminal
adb connect 192.168.1.X:5555
```

**Esperado en Electron:**
- Dispositivo aparece en grid
- Console muestra: `📡 Suscrito a frames de <serial>`

---

## 5️⃣ Instalar FlowAgent APK (3 min)

```powershell
adb install -r "c:\DASHBOARD\FlowDashboard\flow_agent_apk\build\flowagent-debug.apk"
```

**En el dispositivo:**
- Abrir app "FlowAgent"
- Permitir permisos de accesibilidad

---

## 6️⃣ Habilitar Live Preview (2 min)

**En Electron:**
1. Sidebar → "Live" (debe estar habilitado)
2. Dispositivo debe mostrar canvas con pantalla en vivo

**Esperado:**
- Canvas muestra pantalla del dispositivo
- Se actualiza cada 100ms (~10 fps)
- Imagen fluida y clara

---

## 7️⃣ Verificar Z-Index (2 min)

**En Electron:**
1. Click en dispositivo → "Editar Cuentas"
2. Modal debe aparecer encima del canvas
3. Canvas no debe verse detrás

---

## ✅ Checklist de Éxito

- [ ] Backend compila sin errores
- [ ] Electron compila sin errores
- [ ] Backend inicia correctamente
- [ ] Electron conecta a WebSocket
- [ ] Dispositivo aparece en grid
- [ ] Canvas muestra pantalla en vivo
- [ ] Frames se actualizan fluidamente
- [ ] Modales aparecen encima del canvas
- [ ] Sin errores en console

---

## 🐛 Si Algo Falla

### WebSocket no conecta
```powershell
# Verificar backend está corriendo
Invoke-RestMethod -Uri http://127.0.0.1:5000/health

# Verificar puerto 5001
netstat -ano | findstr :5001

# Reiniciar backend
# Ctrl+C en terminal del backend, luego: dotnet run
```

### Canvas no muestra frames
```powershell
# Verificar FlowAgent está instalado
adb shell pm list packages | findstr flowlogin

# Verificar FlowAgent está corriendo
adb shell ps | findstr flowlogin

# Revisar console de Electron (F12)
# Buscar errores de decodificación
```

### Alto uso de CPU
- Reducir FPS: Cambiar `CAPTURE_INTERVAL_MS` en `ScreenCaptureThread.java` a 200ms
- Reducir calidad: Cambiar `WEBP_QUALITY` a 50
- Reducir resolución: Cambiar `screenWidth/screenHeight`

---

## 📊 Métricas Esperadas

| Métrica | Esperado |
|---------|----------|
| WebSocket conecta | < 1s |
| Primer frame | < 2s |
| FPS | 10 fps |
| CPU Backend | < 10% |
| CPU Electron | < 15% |
| Bandwidth | < 1 Mbps |
| Latencia | < 300ms |

---

## 📝 Notas

- WebSocket solo escucha en localhost (seguro)
- Frames se envían en base64 (compatible con JSON)
- Funciona con Android 4.2.1+ (WebP nativo)
- Fallback a PNG en Android < 4.2.1

---

## 📞 Documentación Completa

Para más detalles, ver:
- `STREAMING_WEBP_CANVAS_VERIFICATION.md` - Plan de pruebas completo
- `PROJECT_CONTEXT.md` - Contexto del proyecto
- `AGENTS.md` - Reglas de UI

---

**¡Listo para probar!** 🎉
