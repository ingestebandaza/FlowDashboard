# Instalación de FlowAgent APK - 2026-05-23

**Estado:** ✅ APK CONSTRUIDO Y LISTO PARA INSTALAR

## APK Construido

**Archivo:** `flow_agent_apk/build/flowagent-debug.apk`  
**Tamaño:** ~500 KB  
**Versión:** 0.2.4  
**Cambios:** Captura de pantalla WebP + Solicitud de permisos

## Instrucciones de Instalación

### ⚠️ IMPORTANTE: NO GIRAR LA PANTALLA

La orientación está bloqueada en **PORTRAIT** (vertical). El APK NO girará la pantalla bajo ninguna circunstancia.

### Paso 1: Conectar Dispositivo

```bash
adb devices
```

Verifica que el dispositivo aparece en la lista.

### Paso 2: Instalar APK

```bash
adb install -r c:\DASHBOARD\FlowDashboard\flow_agent_apk\build\flowagent-debug.apk
```

**Opciones:**
- `-r`: Reinstalar si ya existe
- `-g`: Otorgar permisos automáticamente (opcional)

### Paso 3: Abrir App en Dispositivo

1. Busca "FlowAgent" en el menú de apps
2. Abre la app
3. **Verás un diálogo:** "¿Permitir que FlowAgent capture la pantalla?"
4. **Toca "Permitir"** (o "Allow")
5. **Verás logs en la app:**
   - ✓ Información del dispositivo cargada
   - ✓ Monitoreo iniciado
   - ✓ Permisos de captura de pantalla otorgados

### Paso 4: Habilitar Accesibilidad

1. En la app, toca el botón "Habilitar Accesibilidad"
2. Se abrirá Configuración → Accesibilidad
3. Busca "FlowAgent" en la lista
4. Activa el toggle
5. Vuelve a la app
6. Verás: "✓ Habilitado" en verde

### Paso 5: Verificar Conexión

En la app deberías ver:
- ✓ Accesibilidad: Habilitado (verde)
- ✓ Socket: Conectado (verde)
- ✓ Captura: Activa (verde)
- ✓ Estado: "Conectado"

## Características del APK

### Pantalla Principal

- **Estado:** Indicador visual del estado de conexión
- **Información del dispositivo:** Modelo, Android, Serial
- **Logs en vivo:** Todos los eventos registrados
- **Botones:**
  - Habilitar Accesibilidad
  - Limpiar Logs

### Permisos Solicitados

1. **Accesibilidad:** Para interactuar con la UI
2. **Captura de pantalla:** Para enviar frames WebP
3. **Internet:** Para conectar al backend

### Orientación

- **Bloqueada en PORTRAIT (vertical)**
- **NO girará bajo ninguna circunstancia**
- **Ideal para dispositivos en soporte**

## Verificación en Electron

Una vez instalado y conectado:

1. Abre Electron: `abrir_electron.bat`
2. Verifica que el dispositivo aparece en la lista
3. Habilita "Live" para ver streaming
4. Canvas debería mostrar pantalla en tiempo real

## Troubleshooting

### "Instalación fallida"
```bash
adb uninstall com.flowlogin.agent
adb install c:\DASHBOARD\FlowDashboard\flow_agent_apk\build\flowagent-debug.apk
```

### "Permisos no se solicitan"
- Reinstala el APK
- Limpia datos: `adb shell pm clear com.flowlogin.agent`
- Vuelve a instalar

### "Socket no conecta"
- Verifica que el backend Python está corriendo
- Verifica que el dispositivo está en la misma red
- Verifica que el puerto 8766 está abierto

### "Captura no funciona"
- Verifica que aceptaste el diálogo de permisos
- Verifica que la accesibilidad está habilitada
- Reinicia la app

## Comandos Útiles

```bash
# Ver logs en tiempo real
adb logcat | grep FlowAgent

# Instalar sin reinstalar
adb install c:\DASHBOARD\FlowDashboard\flow_agent_apk\build\flowagent-debug.apk

# Desinstalar
adb uninstall com.flowlogin.agent

# Limpiar datos
adb shell pm clear com.flowlogin.agent

# Ver información del dispositivo
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
adb shell getprop ro.serialno
```

## Notas Importantes

✅ **Orientación bloqueada:** No girará la pantalla  
✅ **Captura de pantalla:** WebP 70% quality, 10 fps  
✅ **Permisos:** Se solicitan automáticamente  
✅ **Accesibilidad:** Necesaria para interactuar  
✅ **Internet:** Necesaria para conectar al backend  

## Próximos Pasos

1. Instala el APK en todos los dispositivos
2. Abre cada app y acepta permisos
3. Habilita accesibilidad en cada dispositivo
4. Conecta en Electron
5. Habilita Live Preview
6. ¡Disfruta del streaming WebP! 🎉
