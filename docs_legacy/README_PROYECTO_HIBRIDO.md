# 🚀 FlowDashboard Pro - Proyecto Híbrido

## 📦 Estructura del Proyecto

```
FlowDashboard/
├── FlowDashboard.Core/          ✅ CREADO - C# Engine
│   ├── Program.cs
│   ├── Services/
│   ├── Controllers/
│   ├── Models/
│   └── Hubs/
│
├── electron-app/                ✅ CREADO - Electron UI
│   ├── package.json
│   ├── src/
│   └── preload/
│
├── local_adb_server.py          ✅ EXISTENTE - Python Backend
└── wsapi_demo.html              ✅ EXISTENTE - Referencia UI
```

## 🎯 INSTALACIÓN Y EJECUCIÓN

### PASO 1: Instalar Prerequisitos

#### 1.1 .NET 8.0 SDK
```bash
# Descargar e instalar desde:
https://dotnet.microsoft.com/download/dotnet/8.0

# Verificar instalación:
dotnet --version
# Debe mostrar: 8.0.x
```

#### 1.2 Node.js 18+
```bash
# Descargar e instalar desde:
https://nodejs.org/

# Verificar instalación:
node --version
npm --version
```

#### 1.3 Python 3.8+ (Ya lo tienes)
```bash
python --version
```

---

### PASO 2: Compilar C# Core Engine

```bash
cd C:\DASHBOARD\FlowDashboard\FlowDashboard.Core

# Restaurar dependencias
dotnet restore

# Compilar proyecto
dotnet build

# Ejecutar servidor (para testing)
dotnet run
```

**Resultado esperado:**
```
🚀 FlowDashboard Core Engine iniciado
📡 API REST: http://localhost:5000
🔌 SignalR Hub: http://localhost:5000/hubs/devices
📖 Swagger: http://localhost:5000/swagger
✅ ADB encontrado: C:\DASHBOARD\FlowDashboard\platform-tools\adb.exe
✅ Servidor ADB ya está corriendo
👀 Iniciando monitoreo de dispositivos...
```

---

### PASO 3: Instalar Electron App

```bash
cd C:\DASHBOARD\FlowDashboard\electron-app

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm start
```

**Resultado esperado:**
- Se abre ventana de Electron
- Se conecta al servidor C# automáticamente
- Muestra dispositivos Android conectados

---

### PASO 4: Ejecutar Python Backend (Opcional)

Tu servidor Python actual (`local_adb_server.py`) sigue funcionando igual.
El servidor C# intentará iniciarlo automáticamente, pero puedes ejecutarlo manualmente:

```bash
cd C:\DASHBOARD\FlowDashboard
python local_adb_server.py
```

---

## 🔧 ARQUITECTURA

```
┌─────────────────────────────────────┐
│   Electron UI (Puerto: App)         │
│   - Dashboard moderno               │
│   - Grid de dispositivos            │
│   - Streaming embebido              │
└─────────────────────────────────────┘
            ↓ HTTP/SignalR
┌─────────────────────────────────────┐
│   C# Core Engine (Puerto: 5000)     │
│   - ADB Manager                     │
│   - Scrcpy Manager                  │
│   - REST API                        │
│   - SignalR Hub                     │
└─────────────────────────────────────┘
            ↓ HTTP
┌─────────────────────────────────────┐
│   Python Backend (Puerto: 8765)     │
│   - FlowLogin logic                 │
│   - Account management              │
│   - Supabase integration            │
└─────────────────────────────────────┘
            ↓ ADB
┌─────────────────────────────────────┐
│   Dispositivos Android              │
└─────────────────────────────────────┘
```

---

## 📡 ENDPOINTS API C#

### Dispositivos
- `GET /api/devices` - Listar dispositivos
- `POST /api/devices/execute` - Ejecutar comando ADB
- `POST /api/devices/install-apk` - Instalar APK
- `POST /api/devices/flowlogin/start` - Iniciar FlowLogin
- `GET /api/devices/flowlogin/status` - Estado FlowLogin

### Streaming
- `POST /api/streaming/start` - Iniciar stream
- `POST /api/streaming/stop` - Detener stream
- `GET /api/streaming/active` - Streams activos
- `POST /api/streaming/layout` - Calcular layout

### SignalR Hub
- `ws://localhost:5000/hubs/devices`
- Eventos: `DeviceUpdated`, `AccountStatusUpdated`, `StreamUpdated`

---

## 🧪 TESTING

### Test 1: Verificar C# API
```bash
# En navegador o Postman:
http://localhost:5000/api/devices
```

### Test 2: Verificar Swagger
```bash
# En navegador:
http://localhost:5000/swagger
```

### Test 3: Verificar Electron
```bash
cd electron-app
npm start
```

---

## 🐛 TROUBLESHOOTING

### Error: "No se encontró adb.exe"
**Solución:** Asegúrate de tener ADB en:
- `C:\DASHBOARD\FlowDashboard\platform-tools\adb.exe`
- O en `C:\adb\adb.exe`

### Error: "No se encontró scrcpy.exe"
**Solución:** Descarga scrcpy desde:
https://github.com/Genymobile/scrcpy/releases
Y colócalo en: `C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\`

### Error: "Puerto 5000 en uso"
**Solución:** Detén otros procesos usando el puerto:
```bash
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### Error: "dotnet no reconocido"
**Solución:** Reinicia la terminal después de instalar .NET SDK

---

## 📝 PRÓXIMOS PASOS

### ETAPA 1: ✅ COMPLETADA
- [x] Estructura C# Core Engine
- [x] Estructura Electron App
- [x] Servicios ADB y Scrcpy
- [x] API REST y SignalR

### ETAPA 2: Migrar UI Actual
- [ ] Migrar componentes de `wsapi_demo.html`
- [ ] Sistema de bolitas de estado
- [ ] Gestión de cuentas
- [ ] Categorías de dispositivos

### ETAPA 3: Integración Final
- [ ] Conectar FlowLogin con C#
- [ ] Streaming embebido en Electron
- [ ] Sistema de layouts
- [ ] Instalador profesional

---

## 🎨 CARACTERÍSTICAS NUEVAS

### vs Versión Actual (HTML)
| Característica | Actual | Híbrido |
|----------------|--------|---------|
| UI | HTML estático | Electron moderno |
| Streaming | Ventanas separadas | Embebido en dashboard |
| Rendimiento | Medio | Alto (C# nativo) |
| Instalador | Manual | .exe profesional |
| Updates | Manual | Auto-update |
| Multi-ventana | No | Sí |

---

## 💡 COMANDOS RÁPIDOS

```bash
# Compilar y ejecutar C#
cd FlowDashboard.Core && dotnet run

# Ejecutar Electron
cd electron-app && npm start

# Ejecutar Python
python local_adb_server.py

# Build Electron para distribución
cd electron-app && npm run build:win
```

---

## 📞 SOPORTE

Si encuentras problemas:
1. Verifica que .NET 8.0 esté instalado: `dotnet --version`
2. Verifica que Node.js esté instalado: `node --version`
3. Verifica que ADB esté en la ruta correcta
4. Revisa los logs en la consola de cada componente

---

**Estado:** ✅ Estructura completa creada
**Próximo paso:** Instalar .NET 8.0 SDK y ejecutar ETAPA 1
