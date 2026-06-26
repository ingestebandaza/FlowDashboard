# Inicio Rápido: Electron como Dashboard Principal

**Objetivo:** Usar Electron en lugar del HTML

---

## 1. Iniciar Electron

```bash
# En la carpeta del proyecto
npm install
npm run electron:dev

# O si prefieres PowerShell
.\abrir_electron.ps1
```

---

## 2. Verificar Conexiones

Abre DevTools (F12) y ejecuta en la consola:

```javascript
// Verificar C# API
await csharpAPI.healthCheck()
// Debe retornar: true

// Verificar Python API
await pythonAPI.healthCheck()
// Debe retornar: true

// Cargar dispositivos
const devices = await csharpAPI.get('/devices');
console.log(devices);
// Debe mostrar lista de dispositivos
```

---

## 3. Verificar Streaming

```javascript
// Verificar WebSocket
app.streamRenderer.connection.state
// Debe retornar: "Connected"

// Ver dispositivos suscritos
app.streamRenderer.subscribedSerials
// Debe mostrar Set con serials
```

---

## 4. Probar Reconexión

```javascript
// 1. Detener backend C# (Ctrl+C en terminal)
// 2. Ver en consola: "⚠️ Reintentando C# API (intento 1/3)"
// 3. Reiniciar backend C#
// 4. Ver en consola: "✅ Conectado al servidor C# (ADB)"
```

---

## 5. Probar con Dispositivos

```javascript
// Conectar dispositivo por WiFi
// Ejecutar FlowLogin
// Ver bolitas de cuentas cambiar de color en tiempo real
```

---

## Estructura de Archivos

```
electron-app/
├── src/
│   ├── main/
│   │   └── index.js          # Proceso principal
│   ├── preload/
│   │   └── preload.js        # Preload script
│   └── renderer/
│       ├── index.html        # HTML principal
│       ├── styles.css        # Estilos
│       ├── api-client.js     # ✅ NUEVO - Cliente HTTP
│       ├── stream-renderer.js # ✅ MEJORADO - Streaming
│       └── app.js            # Aplicación principal
├── package.json
└── ...
```

---

## Archivos de Referencia

| Archivo | Propósito |
|---------|-----------|
| `PLAN_MIGRACION_ELECTRON_COMPLETO.md` | Plan general de migración |
| `MIGRACION_ELECTRON_FASE1_COMPLETADA.md` | Detalles de FASE 1 |
| `PROXIMO_PASO_FASE2.md` | Guía para FASE 2 |
| `PROJECT_CONTEXT.md` | Contexto del proyecto |
| `AGENTS.md` | Reglas del proyecto |

---

## Troubleshooting

### Error: "Cannot find module 'api-client.js'"
```bash
# Verificar que el archivo existe
ls electron-app/src/renderer/api-client.js

# Verificar que está en index.html
grep "api-client.js" electron-app/src/renderer/index.html
```

### Error: "WebSocket connection failed"
```javascript
// Verificar que C# backend está corriendo
await csharpAPI.healthCheck()

// Verificar puerto 5000
netstat -ano | findstr :5000
```

### Error: "Dispositivos no se cargan"
```javascript
// Verificar conexión a C#
await csharpAPI.get('/devices')

// Ver error en consola
// Verificar que backend C# está corriendo
```

---

## Próximos Pasos

1. **Probar Electron** con dispositivos conectados
2. **Leer** `PROXIMO_PASO_FASE2.md` para optimización
3. **Implementar** FASE 2 (Throttling, caché, etc.)
4. **Continuar** con FASE 3 (Seguridad) y FASE 4 (Migración completa)

---

## Comandos Útiles

```bash
# Iniciar Electron en desarrollo
npm run electron:dev

# Compilar Electron para producción
npm run electron:build

# Limpiar caché
npm run electron:clean

# Ver logs
npm run electron:dev 2>&1 | tee electron.log
```

---

## Notas

- ✅ Electron es el objetivo principal
- ✅ HTML es solo referencia
- ✅ No modificar HTML
- ✅ Todos los cambios van en Electron
- ✅ Mantener compatibilidad con backends

---

**¿Listo para comenzar? ¡Abre Electron y prueba!**

