# ✅ abrir_electron.bat - Configurado y Listo

## 🎯 Lo que hace

`abrir_electron.bat` es el launcher completo para FlowDashboard Electron que:

1. **Escanea y conecta TODOS los dispositivos WiFi ADB**
2. **Inicia el servidor C# (puerto 5000)** - ADB + Video Streaming
3. **Inicia el servidor Python (puerto 8765)** - FlowLogin/FlowRegister
4. **Abre el dashboard Electron** con DevTools habilitado

---

## 📋 Proceso Completo

### [1/6] Limpieza de sesiones anteriores
- Cierra procesos previos de Python (local_adb_server.py, websocket_server.py)
- Libera puertos 5000, 8765, 8766, 8767
- Cierra procesos de scrcpy y Electron

### [2/6] Escaneo y conexión de dispositivos WiFi ADB
- Usa ADB de: `scrcpy-win64-v4.0\adb.exe`
- Reinicia servidor ADB
- Lee dispositivos conocidos de:
  - `.flowlogin_payloads\*_accounts.json`
  - `device_names.json`
  - `device_groups.json`
- Escanea puertos TCP para ver cuáles están alcanzables
- Conecta automáticamente todos los dispositivos alcanzables
- Configura túneles reverse para FlowAgent (puerto 8766)

**Resultado:** `Dispositivos WiFi conocidos: 24. Alcanzables ahora: 8`

### [3/6] Servidor C# (ADB + Video Streaming)
- Compila automáticamente con `dotnet run`
- Puerto: 5000
- Endpoints:
  - `/api/health` - Health check
  - `/api/devices` - Lista de dispositivos ADB
  - `/api/videostream/ws/{serial}` - WebSocket para video H.264
- Variables de entorno:
  - `FLOWDASHBOARD_ADB` - Ruta a adb.exe
  - `SCRCPY_PATH` - Ruta a scrcpy.exe

### [4/6] Servidor Python (FlowLogin/FlowRegister)
- Ejecuta: `python -u local_adb_server.py`
- Puerto HTTP: 8765
- Socket FlowAgent: 8766
- WebSocket streaming: 8767
- Endpoints:
  - `/health` - Health check
  - `/flowagent/setup` - Preparar FlowAgent en dispositivos

### [5/6] Dashboard Electron
- Ejecuta: `npm start` en `electron-app/`
- DevTools habilitado automáticamente (F12 para abrir/cerrar)
- Scripts de Broadway H.264 decoder cargados correctamente

### [6/6] Listo
Todos los servicios corriendo y dashboard abierto

---

## 🚀 Cómo Usar

### Opción 1: Doble click
```
Doble click en: abrir_electron.bat
```

### Opción 2: Desde terminal
```cmd
cd C:\DASHBOARD\FlowDashboard
abrir_electron.bat
```

---

## 📊 Salida Esperada

```
============================================================
  FLOWDASHBOARD ELECTRON - INICIANDO
============================================================

[1/6] Cerrando sesiones anteriores...
   Limpieza completada.

[2/6] Reiniciando ADB y escaneando dispositivos WiFi...
   Usando ADB: C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe
   Dispositivos WiFi conocidos: 24. Alcanzables ahora: 8
   ADB reiniciado. Dispositivos conectados: 8

[3/6] Iniciando servidor C# (ADB + Video Streaming)...
   Servidor C# usara ADB: C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe
   Servidor C# usara scrcpy: C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\scrcpy.exe
   Iniciando servidor C# (ADB + Video Streaming)...
   Servidor C# listo en 127.0.0.1:5000

[4/6] Iniciando servidor Python (FlowLogin/FlowRegister)...
   Usando Python: C:\Users\...\Python310\python.exe
   Iniciando servidor Python (FlowLogin/FlowRegister)...
   Servidor Python listo en 127.0.0.1:8765
   Socket FlowAgent listo en 0.0.0.0:8766

[5/6] Abriendo FlowDashboard Electron...
   Iniciando FlowDashboard Electron...
   Dashboard Electron iniciado

[6/6] Listo.

============================================================
  SERVIDOR C#: http://127.0.0.1:5000
  SERVIDOR PYTHON: http://127.0.0.1:8765
  DASHBOARD: Electron App
============================================================
```

---

## 🔧 Archivos Creados/Modificados

### Nuevos archivos:
- `abrir_electron.bat` - Launcher principal
- `abrir_electron.ps1` - Script PowerShell con toda la lógica

### Modificados:
- `electron-app/src/main/index.js` - DevTools habilitado automáticamente
- `electron-app/src/renderer/index.html` - Scripts de Broadway con rutas correctas
- `electron-app/src/renderer/Player.js` - Descargado desde GitHub
- `electron-app/src/renderer/Decoder.js` - Descargado desde GitHub

---

## 🎬 Próximos Pasos

Ahora que el dashboard está abierto con DevTools:

1. **Verifica que Broadway se cargó:**
   ```javascript
   typeof Player  // Debe decir "function"
   ```

2. **Selecciona un dispositivo** (click en tarjeta)

3. **Inicia streaming** (click en "Iniciar Streaming")

4. **Revisa la consola de DevTools** para ver:
   - ✅ `WebSocket conectado para {serial}`
   - ✅ Frames recibidos y renderizados
   - ❌ Errores (si los hay)

---

## 📝 Notas Importantes

- **DevTools:** Presiona F12 para abrir/cerrar en cualquier momento
- **Dispositivos:** El escaneo WiFi ADB es automático, no necesitas hacer nada
- **Servidores:** Si un servidor falla, el launcher continúa con los demás
- **Puertos:** 5000 (C#), 8765 (Python HTTP), 8766 (FlowAgent Socket)

---

**Última actualización:** 2026-05-22
**Estado:** ✅ Funcionando - Listo para diagnosticar video streaming
