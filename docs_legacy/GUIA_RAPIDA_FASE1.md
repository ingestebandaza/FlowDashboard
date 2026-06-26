# Guía Rápida - FASE 1

## 🚀 Inicio Rápido (3 Pasos)

### 1. Iniciar Servidores
```bash
# Opción A: Script automático (recomendado)
test_fase1.bat

# Opción B: Manual (3 terminales)
# Terminal 1:
cd FlowDashboard.Core
dotnet run

# Terminal 2:
python local_adb_server.py

# Terminal 3:
cd electron-app
npm start
```

### 2. Verificar Conexión
- ✅ Status pill verde = Todo OK
- ⚠️ "ADB OK, FlowLogin offline" = Solo C# conectado
- ❌ "Desconectado" = Ningún servidor conectado

### 3. Usar Dashboard
1. Dispositivos aparecen automáticamente
2. Click para seleccionar/deseleccionar
3. Bolitas muestran estado de cuentas
4. "▶ Iniciar Streaming" para ver pantallas

## 📱 Dispositivos

### Selección
- **Click**: Seleccionar/deseleccionar
- **✓ Todos**: Seleccionar todos
- **✗ Ninguno**: Deseleccionar todos
- **🔄 Actualizar**: Recargar lista

### Información Mostrada
- **Nombre**: Personalizado o modelo
- **Serial**: Últimos 8 chars o IP
- **Estado**: device, offline, etc.
- **Bolitas**: Estados de cuentas (derecha)

## 🔵 Bolitas de Estado

### Colores
- ⚫ **Gris**: Pendiente
- 🔵 **Azul** (animado): Ejecutando
- 🟡 **Amarillo** (animado): Reintentando
- 🟢 **Verde**: Success
- 🔴 **Rojo**: Error
- 🟠 **Naranja**: Ya logueado
- 🟣 **Morado**: Revisión

### Ver Estados
1. Asignar cuentas desde `wsapi_demo.html`
2. Ejecutar FlowLogin
3. Ver bolitas cambiar en tiempo real

## 🎬 Streaming

### Iniciar
1. Seleccionar dispositivos
2. Click "▶ Iniciar Streaming"
3. Ventanas de scrcpy se abren

**Nota:** FASE 1 usa ventanas separadas. FASE 3 las embebe.

## 🔧 Solución de Problemas

### "Desconectado"
- Verificar que C# server esté corriendo (puerto 5000)
- Verificar que Python server esté corriendo (puerto 8765)
- Esperar 3 segundos para reconexión automática

### "No hay dispositivos"
- Conectar dispositivo por USB o WiFi
- Verificar con `adb devices`
- Esperar 5 segundos (polling automático)

### Bolitas no aparecen
- Asignar cuentas desde `wsapi_demo.html`
- Verificar que Python server esté conectado
- Esperar 2 segundos (polling de estados)

### Streaming no funciona
- Verificar que scrcpy esté instalado
- Verificar que dispositivos estén autorizados (USB debugging)
- Ver logs en terminal de C# server

## 📊 Atajos de Teclado

- **F12**: Abrir DevTools (ver logs)
- **Ctrl+R**: Recargar aplicación
- **Ctrl+Shift+I**: Abrir DevTools
- **Alt+F4**: Cerrar aplicación

## 📁 Archivos Importantes

### Configuración
- `device_names.json`: Nombres personalizados
- `.flowlogin_payloads/`: Cuentas por dispositivo
- `flowlogin_status.json`: Estados de login

### Logs
- **C# Server**: Terminal 1
- **Python Server**: Terminal 2
- **Electron**: DevTools (F12)

## 🔄 Polling

### Automático
- **Dispositivos**: Cada 5 segundos
- **Estados**: Cada 2 segundos
- **Reconexión**: Cada 3 segundos (si falla)

### Manual
- Click "🔄 Actualizar" para forzar actualización

## 💡 Tips

### Rendimiento
- Cerrar DevTools si no los usas
- Máximo 50 dispositivos recomendado
- Reducir polling si tienes lag

### Desarrollo
- Usar `npm run dev` para abrir con DevTools
- Ver logs en consola para debugging
- Modificar `app.js` y recargar (Ctrl+R)

### Producción
- Usar `test_fase1.bat` para inicio rápido
- Cerrar terminales para detener todo
- Verificar que puertos 5000 y 8765 estén libres

## 📚 Documentación Completa

- `FASE1_COMPLETADA.md`: Detalles técnicos
- `RESUMEN_MIGRACION_FASE1.md`: Resumen ejecutivo
- `ARQUITECTURA_FASE1.txt`: Diagramas visuales
- `CHECKLIST_PRUEBAS_FASE1.md`: Pruebas completas

## 🆘 Soporte

### Logs Útiles
```javascript
// En DevTools (F12)
console.log(app.devices);           // Ver dispositivos
console.log(app.selectedDeviceIds); // Ver seleccionados
console.log(app.loginStatuses);     // Ver estados
console.log(app.connected);         // Ver conexión C#
console.log(app.pythonConnected);   // Ver conexión Python
```

### Comandos Útiles
```bash
# Ver dispositivos ADB
adb devices

# Ver procesos C#
tasklist | findstr dotnet

# Ver procesos Python
tasklist | findstr python

# Ver procesos Electron
tasklist | findstr electron

# Matar todo
taskkill /F /IM dotnet.exe
taskkill /F /IM python.exe
taskkill /F /IM electron.exe
```

## ✅ Checklist Rápido

Antes de usar:
- [ ] .NET 8.0 SDK instalado
- [ ] Node.js v24+ instalado
- [ ] Python 3.8+ instalado
- [ ] ADB instalado
- [ ] Dispositivo conectado

Al iniciar:
- [ ] C# server corriendo (puerto 5000)
- [ ] Python server corriendo (puerto 8765)
- [ ] Electron app abierta
- [ ] Status pill verde

Durante uso:
- [ ] Dispositivos aparecen
- [ ] Selección funciona
- [ ] Bolitas se actualizan
- [ ] Streaming funciona

---

**¿Listo para FASE 2?**

Cuando FASE 1 funcione perfectamente, continuar con:
- Categorías de acción (FlowLogin, FlowTrack, etc.)
- Panel de cuentas con pestañas
- Comandos ADB personalizados
- Streaming embebido

**Última actualización:** 2026-05-21
