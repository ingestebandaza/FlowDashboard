# Checklist de Pruebas - FASE 1

## 📋 Preparación

### Requisitos Previos
- [ ] .NET 8.0 SDK instalado
- [ ] Node.js v24+ instalado
- [ ] Python 3.8+ instalado
- [ ] ADB instalado y en PATH
- [ ] Al menos 1 dispositivo Android conectado por USB o WiFi

### Instalación de Dependencias
```bash
# C# Dependencies (ya instaladas)
cd FlowDashboard.Core
dotnet restore

# Electron Dependencies (ya instaladas)
cd electron-app
npm install
```

## 🚀 Inicio de Servidores

### Método 1: Script Automático (Recomendado)
- [ ] Ejecutar `test_fase1.bat`
- [ ] Verificar que se abren 3 ventanas:
  - [ ] Ventana "C# Server" con logs de ASP.NET
  - [ ] Ventana "Python Server" con logs de Flask
  - [ ] Ventana de Electron con la UI

### Método 2: Manual (3 Terminales)
- [ ] **Terminal 1:** `cd FlowDashboard.Core && dotnet run`
  - [ ] Ver mensaje: "Now listening on: http://localhost:5000"
  - [ ] Ver mensaje: "ADB Service initialized"
  
- [ ] **Terminal 2:** `python local_adb_server.py`
  - [ ] Ver mensaje: "Running on http://127.0.0.1:8765"
  - [ ] Ver mensaje: "FlowLogin status tracking enabled"
  
- [ ] **Terminal 3:** `cd electron-app && npm start`
  - [ ] Ver ventana de Electron abrirse

## ✅ Pruebas de Conexión

### Status Pill (Indicador de Conexión)
- [ ] Status pill muestra "Conectado" con punto verde
- [ ] Punto verde tiene animación de pulso suave
- [ ] Si detienes Python server, muestra "ADB OK, FlowLogin offline"
- [ ] Si detienes C# server, muestra "Desconectado"
- [ ] Reconexión automática al reiniciar servidores (esperar 3 segundos)

### Logs de Consola
Abrir DevTools (F12 o Ctrl+Shift+I):
- [ ] Ver mensaje: "🚀 Iniciando FlowDashboard Pro..."
- [ ] Ver mensaje: "✅ Conectado al servidor C# (ADB)"
- [ ] Ver mensaje: "✅ Conectado al servidor Python (FlowLogin)"
- [ ] Ver mensaje: "📱 X dispositivos encontrados"

## 📱 Pruebas de Dispositivos

### Grid de Dispositivos
- [ ] Dispositivos aparecen como tarjetas en el grid
- [ ] Cada tarjeta muestra:
  - [ ] Nombre del dispositivo (personalizado o modelo)
  - [ ] Serial acortado (últimos 8 chars o IP)
  - [ ] Estado ("device", "offline", etc.)
- [ ] Contador de dispositivos muestra número correcto
- [ ] Grid es responsive (redimensionar ventana)

### Selección de Dispositivos
- [ ] Click en dispositivo lo selecciona (borde verde)
- [ ] Click nuevamente lo deselecciona
- [ ] Botón "✓ Todos" selecciona todos los dispositivos
- [ ] Botón "✗ Ninguno" deselecciona todos
- [ ] Contador "X seleccionados" se actualiza correctamente
- [ ] Logs en consola: "📱 Dispositivos seleccionados: [...]"

### Actualización de Dispositivos
- [ ] Botón "🔄 Actualizar" recarga la lista
- [ ] Conectar nuevo dispositivo → aparece en 5 segundos (polling)
- [ ] Desconectar dispositivo → desaparece en 5 segundos

### Nombres Personalizados
Si tienes nombres en `device_names.json`:
- [ ] Nombres personalizados se muestran en lugar del modelo
- [ ] Si no hay nombre, muestra el modelo del dispositivo

## 🔵 Pruebas de Bolitas de Estado

### Sin Cuentas Asignadas
- [ ] Dispositivos sin cuentas NO muestran bolitas
- [ ] Solo se ve el nombre, serial y estado

### Con Cuentas Asignadas
Para probar esto, necesitas asignar cuentas desde `wsapi_demo.html`:
1. Abrir `wsapi_demo.html` en navegador
2. Conectar dispositivos
3. Click en botón de persona (👤) de un dispositivo
4. Pegar cuentas (formato: `email:password`)
5. Guardar

Luego en Electron:
- [ ] Bolitas aparecen en columna derecha de la tarjeta
- [ ] Máximo 10 bolitas por dispositivo
- [ ] Bolitas grises (pending) si no se ha ejecutado FlowLogin

### Estados de Bolitas (Ejecutar FlowLogin)
Desde `wsapi_demo.html`, ejecutar FlowLogin en un dispositivo con cuentas:

- [ ] **Pending (⚫ Gris)**: Cuenta asignada pero no ejecutada
- [ ] **Running (🔵 Azul)**: Durante ejecución, con animación de pulso
- [ ] **Retrying (🟡 Amarillo)**: Si reintenta, con animación de pulso
- [ ] **Success (🟢 Verde)**: Login exitoso, con glow verde
- [ ] **Error (🔴 Rojo)**: Si falla el login
- [ ] **Already (🟠 Naranja)**: Si cuenta ya estaba logueada
- [ ] **Review (🟣 Morado)**: Si requiere revisión manual

### Tooltips de Bolitas
- [ ] Hover sobre bolita muestra tooltip
- [ ] Tooltip formato: "C1: Success", "C2: Error - mensaje"
- [ ] Tooltip desaparece al quitar mouse

### Actualización en Tiempo Real
Con FlowLogin ejecutándose:
- [ ] Bolitas cambian de color automáticamente cada 2 segundos
- [ ] No se re-renderiza todo el grid, solo las bolitas
- [ ] Animaciones de pulso funcionan suavemente

## 🎬 Pruebas de Streaming (Básico)

### Iniciar Streaming
- [ ] Seleccionar 1-2 dispositivos
- [ ] Click en "▶ Iniciar Streaming"
- [ ] Ver placeholders con información de streams
- [ ] Logs en consola: "🎬 Iniciando streaming para: [...]"
- [ ] Logs en consola: "✅ Stream iniciado para X"

### Ventanas de Scrcpy
- [ ] Se abren ventanas separadas de scrcpy (Windows nativas)
- [ ] Una ventana por dispositivo seleccionado
- [ ] Ventanas muestran pantalla del dispositivo en tiempo real

**Nota:** En FASE 1, streaming es en ventanas separadas. FASE 3 las embebe en Electron.

## 🎨 Pruebas de UI

### Titlebar Personalizado
- [ ] Titlebar muestra "FlowDashboard Pro"
- [ ] Botón "−" minimiza la ventana
- [ ] Botón "□" maximiza/restaura la ventana
- [ ] Botón "×" cierra la aplicación
- [ ] Titlebar es draggable (mover ventana)

### Animaciones
- [ ] Status pill: Glow pulsante cuando está online
- [ ] Bolitas running/retrying: Pulso suave
- [ ] Device cards: Hover con elevación y cambio de borde
- [ ] Transiciones suaves (0.2s)

### Responsive
- [ ] Redimensionar ventana: grid se adapta
- [ ] Ventana mínima (1200x700): todo visible
- [ ] Ventana maximizada: aprovecha espacio

### Accesibilidad
- [ ] Reducir movimiento en sistema → animaciones se desactivan
- [ ] Scrollbar personalizado en lista de dispositivos
- [ ] Colores con suficiente contraste

## 🔧 Pruebas de Rendimiento

### Carga Inicial
- [ ] Aplicación carga en < 2 segundos
- [ ] UI responde inmediatamente

### Polling
- [ ] CPU < 5% en idle
- [ ] CPU < 15% durante polling
- [ ] Memoria < 200MB

### Con Muchos Dispositivos
Si tienes 10+ dispositivos:
- [ ] Grid renderiza en < 200ms
- [ ] Selección es instantánea
- [ ] Polling no causa lag

## 🐛 Pruebas de Errores

### Servidor C# Offline
- [ ] Detener servidor C#
- [ ] Status pill muestra "Desconectado"
- [ ] Grid muestra "Error cargando dispositivos"
- [ ] Reiniciar servidor → reconexión automática en 3 segundos

### Servidor Python Offline
- [ ] Detener servidor Python
- [ ] Status pill muestra "ADB OK, FlowLogin offline"
- [ ] Dispositivos siguen mostrándose
- [ ] Bolitas no se actualizan
- [ ] Reiniciar servidor → bolitas vuelven a actualizarse

### Sin Dispositivos Conectados
- [ ] Grid muestra "No hay dispositivos conectados"
- [ ] Botones de selección deshabilitados
- [ ] Conectar dispositivo → aparece automáticamente

### Errores de Red
- [ ] Simular error de red (desconectar WiFi)
- [ ] Aplicación no crashea
- [ ] Muestra mensajes de error en consola
- [ ] Reconecta al restaurar red

## 📊 Pruebas de Datos

### Device Names
- [ ] Nombres se cargan desde `device_names.json`
- [ ] Si no existe el archivo, usa modelo del dispositivo
- [ ] Nombres persisten entre reinicios

### Device Accounts
- [ ] Cuentas se cargan desde Python API (person field)
- [ ] Máximo 10 cuentas por dispositivo
- [ ] Formato: líneas separadas por `\n`

### Login Status
- [ ] Estados se cargan desde `/login-status`
- [ ] Formato: `{ serial: { clone1: {status, line, message}, ... } }`
- [ ] Se actualiza cada 2 segundos

## 🔍 Pruebas de Consola

### Logs Esperados (Electron DevTools)
```
🚀 Iniciando FlowDashboard Pro...
✅ Conectado al servidor C# (ADB)
✅ Conectado al servidor Python (FlowLogin)
📱 3 dispositivos encontrados
📱 Dispositivos seleccionados: ["192.168.1.11:5555"]
🎬 Iniciando streaming para: ["192.168.1.11:5555"]
✅ Stream iniciado para 192.168.1.11:5555
```

### Logs Esperados (C# Server)
```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5000
info: FlowDashboard.Core.Services.AdbService[0]
      ADB Service initialized. Found 3 devices.
```

### Logs Esperados (Python Server)
```
 * Running on http://127.0.0.1:8765
 * FlowLogin status tracking enabled
 * Device names loaded from device_names.json
```

## ✅ Checklist Final

### Funcionalidad Core
- [ ] Conexión dual (C# + Python) funciona
- [ ] Dispositivos se cargan y muestran correctamente
- [ ] Selección múltiple funciona
- [ ] Bolitas de estado se muestran y actualizan
- [ ] Polling automático funciona
- [ ] Streaming básico funciona (ventanas separadas)

### UI/UX
- [ ] Titlebar personalizado funciona
- [ ] Animaciones son suaves
- [ ] Colores y estilos son profesionales
- [ ] Responsive funciona correctamente

### Robustez
- [ ] Manejo de errores funciona
- [ ] Reconexión automática funciona
- [ ] No hay memory leaks (verificar en Task Manager)
- [ ] No hay crashes durante uso normal

### Documentación
- [ ] `FASE1_COMPLETADA.md` está actualizado
- [ ] `RESUMEN_MIGRACION_FASE1.md` está completo
- [ ] `ARQUITECTURA_FASE1.txt` es preciso
- [ ] Este checklist está completo

## 🎉 Resultado Esperado

Si todas las pruebas pasan:
✅ **FASE 1 está 100% funcional y lista para producción**

Si hay fallos:
❌ Documentar en issues y corregir antes de continuar a FASE 2

---

**Última actualización:** 2026-05-21  
**Versión:** 2.0.0  
**Estado:** Lista para pruebas
