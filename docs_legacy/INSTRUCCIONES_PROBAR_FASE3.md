# 🧪 Instrucciones para Probar FASE 3 - Streaming

## ✅ Estado Actual

- ✅ Servidor C# corriendo (puerto 5000) - Con StreamingController
- ✅ Servidor Python corriendo (puerto 8765)
- ✅ Electron iniciándose
- ✅ 17 dispositivos Samsung conectados

## 🔄 Paso 1: Verificar que Electron Esté Abierto

La ventana **"FlowDashboard Pro"** debería estar abierta.

Si no está abierta, espera 10-15 segundos para que inicie.

## 👀 Paso 2: Verificar Nuevos Componentes

### Panel de Streaming (Derecho, Abajo)

Deberías ver:

```
🎬 Streaming
[Calidad: 720p ▼] [⏹ Detener Todos]

Selecciona dispositivos y presiona "Iniciar Streaming"
```

**Verificar:**
- [ ] Selector de calidad visible
- [ ] Botón "Detener Todos" visible (deshabilitado por ahora)
- [ ] Mensaje de placeholder

## 🧪 Paso 3: Prueba Básica - Stream Individual

### Test 1: Iniciar 1 Stream

**Pasos:**
```
1. Seleccionar 1 dispositivo (click en tarjeta)
2. Verificar que tenga borde verde (seleccionado)
3. Scroll hacia abajo al panel "🎬 Streaming"
4. Click en "▶ Iniciar Streaming"
5. Ver mensaje: "Streaming iniciado. Las ventanas de scrcpy..."
6. Esperar 2-3 segundos
```

**Resultado esperado:**
- ✅ Mensaje de éxito aparece
- ✅ Ventana de scrcpy se abre (ventana separada de Windows)
- ✅ Ventana sin borde (borderless)
- ✅ Muestra pantalla del dispositivo
- ✅ Tarjeta de stream aparece en dashboard:
  ```
  ┌─────────────────────────────┐
  │ Device Name          [⏹]    │
  │ 192.168.1.11                │
  ├─────────────────────────────┤
  │ ● Activo                    │
  │ PID: 12345                  │
  │ Ventana externa de scrcpy   │
  └─────────────────────────────┘
  ```

**Si no funciona:**
- Abrir DevTools (F12)
- Ver errores en Console
- Copiar y reportar

### Test 2: Detener Stream

**Pasos:**
```
1. Con el stream activo del Test 1
2. Click en botón [⏹] de la tarjeta
3. Ver ventana de scrcpy cerrarse
4. Ver tarjeta desaparecer del dashboard
```

**Resultado esperado:**
- ✅ Ventana de scrcpy se cierra inmediatamente
- ✅ Tarjeta desaparece
- ✅ Vuelve a mostrar mensaje de placeholder

## 🧪 Paso 4: Prueba Avanzada - Múltiples Streams

### Test 3: Iniciar 4 Streams

**Pasos:**
```
1. Seleccionar 4 dispositivos
2. Verificar que todos tengan borde verde
3. Click "▶ Iniciar Streaming"
4. Esperar 3-5 segundos
```

**Resultado esperado:**
- ✅ 4 ventanas de scrcpy se abren
- ✅ Ventanas posicionadas automáticamente (grid 2x2)
- ✅ Cada ventana sin borde
- ✅ 4 tarjetas aparecen en dashboard (grid 2x2)
- ✅ Cada tarjeta muestra:
  - Nombre del dispositivo
  - Serial acortado
  - ● Activo (punto verde)
  - PID del proceso
  - Botón [⏹]

**Layout esperado de ventanas:**
```
┌──────────┐  ┌──────────┐
│ Device 1 │  │ Device 2 │
│          │  │          │
└──────────┘  └──────────┘

┌──────────┐  ┌──────────┐
│ Device 3 │  │ Device 4 │
│          │  │          │
└──────────┘  └──────────┘
```

### Test 4: Detener Todos

**Pasos:**
```
1. Con 4 streams activos
2. Click en "⏹ Detener Todos"
3. Ver todas las ventanas cerrarse
```

**Resultado esperado:**
- ✅ Las 4 ventanas se cierran
- ✅ Todas las tarjetas desaparecen
- ✅ Vuelve a mostrar placeholder

### Test 5: Detener Individual

**Pasos:**
```
1. Iniciar 3 streams
2. Click en [⏹] del segundo stream
3. Verificar que solo ese se cierra
4. Los otros 2 siguen activos
```

**Resultado esperado:**
- ✅ Solo la ventana del segundo dispositivo se cierra
- ✅ Solo esa tarjeta desaparece
- ✅ Las otras 2 ventanas siguen abiertas
- ✅ Las otras 2 tarjetas siguen visibles

## 🧪 Paso 5: Prueba de Calidad

### Test 6: Cambiar Calidad

**Pasos:**
```
1. Iniciar 1 stream en 720p (default)
2. Cambiar selector a "1080p"
3. Ver confirmación: "¿Reiniciar streams con calidad 1080p?"
4. Click "Aceptar"
5. Esperar 2-3 segundos
```

**Resultado esperado:**
- ✅ Ventana actual se cierra
- ✅ Nueva ventana se abre
- ✅ Calidad visiblemente mejor (más nítida)
- ✅ Selector muestra "1080p"

**Calidades disponibles:**
- 480p - Baja calidad, bajo uso de CPU
- 720p - Calidad media (recomendado)
- 1080p - Alta calidad, más CPU
- 4K - Muy alta calidad, mucho CPU

### Test 7: Calidad sin Streams

**Pasos:**
```
1. Sin streams activos
2. Cambiar selector a "4K"
3. No debe pedir confirmación
4. Iniciar nuevo stream
5. Debe iniciar en 4K
```

**Resultado esperado:**
- ✅ Cambio sin confirmación
- ✅ Nuevo stream en calidad seleccionada

## 📊 Paso 6: Verificar en DevTools

### Abrir DevTools
```
1. Presionar F12
2. Ir a pestaña "Console"
```

### Logs Esperados

**Al iniciar streaming:**
```javascript
🎬 Iniciando streaming embebido para: ["192.168.1.11:5555"]
✅ 1 streams iniciados
```

**Al detener stream:**
```javascript
✅ Stream detenido: 192.168.1.11:5555
```

**Al detener todos:**
```javascript
✅ 4 streams detenidos
```

**Al cambiar calidad:**
```javascript
📊 Calidad cambiada a: 1080p
```

### Verificar No Hay Errores

**NO deberías ver:**
- ❌ Errores rojos
- ❌ "Cannot read property..."
- ❌ "Failed to fetch"
- ❌ "Error iniciando streaming"

**Si ves errores:**
- Copiar el error completo
- Reportar

## 🐛 Solución de Problemas

### Problema 1: No se abren ventanas de scrcpy

**Síntomas:**
- Click en "Iniciar Streaming"
- Mensaje de éxito aparece
- Pero no se abren ventanas

**Solución:**
```
1. Verificar que scrcpy esté instalado
2. Abrir terminal y ejecutar: scrcpy --version
3. Si no está instalado:
   - Descargar de: https://github.com/Genymobile/scrcpy/releases
   - Extraer en C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\
4. Reiniciar servidor C#
```

### Problema 2: Ventanas se abren pero no se ven

**Síntomas:**
- Tarjetas aparecen en dashboard
- Pero no ves ventanas de scrcpy

**Solución:**
```
1. Ventanas pueden estar detrás de Electron
2. Alt+Tab para cambiar entre ventanas
3. Buscar ventanas con título "FlowDashboard Pro - 192.168.1.11:5555"
4. Mover ventanas al frente
```

### Problema 3: Error "Failed to fetch"

**Síntomas:**
- Click en "Iniciar Streaming"
- Error: "Error iniciando streaming: Failed to fetch"

**Solución:**
```
1. Verificar que servidor C# esté corriendo
2. Abrir http://localhost:5000/swagger en navegador
3. Verificar que endpoint /api/streaming/start-embedded exista
4. Si no existe, reiniciar servidor C#
```

### Problema 4: Ventanas con borde

**Síntomas:**
- Ventanas se abren pero tienen borde de Windows

**Solución:**
```
1. Esto es normal si scrcpy es versión antigua
2. Actualizar scrcpy a v4.0+
3. Reiniciar streaming
```

### Problema 5: Selector de calidad no funciona

**Síntomas:**
- Cambiar calidad no hace nada

**Solución:**
```
1. Abrir DevTools (F12)
2. Ver si hay errores
3. Verificar que método changeQuality() exista
4. Recargar Electron (Ctrl+R)
```

## ✅ Checklist de Verificación

Después de todas las pruebas:

### Funcionalidad Básica
- [ ] Iniciar 1 stream funciona
- [ ] Ventana de scrcpy se abre
- [ ] Ventana sin borde
- [ ] Tarjeta aparece en dashboard
- [ ] Detener stream funciona
- [ ] Ventana se cierra

### Múltiples Streams
- [ ] Iniciar 4 streams funciona
- [ ] 4 ventanas se abren
- [ ] Ventanas posicionadas automáticamente
- [ ] 4 tarjetas en grid 2x2
- [ ] Detener todos funciona
- [ ] Detener individual funciona

### Calidad
- [ ] Selector de calidad visible
- [ ] Cambiar calidad funciona
- [ ] Confirmación aparece si hay streams
- [ ] Streams se reinician con nueva calidad
- [ ] Calidad se guarda en localStorage

### UI/UX
- [ ] Mensajes de feedback aparecen
- [ ] Botones responden al click
- [ ] Tarjetas muestran información correcta
- [ ] No hay glitches visuales
- [ ] Scroll funciona correctamente

### Robustez
- [ ] No hay errores en DevTools
- [ ] Cerrar Electron cierra streams
- [ ] Recargar Electron funciona
- [ ] Cambiar entre pestañas funciona

## 🎯 Resultado Esperado

Si todo funciona correctamente:

1. ✅ Puedes iniciar streams individuales
2. ✅ Puedes iniciar múltiples streams
3. ✅ Ventanas se posicionan automáticamente
4. ✅ Puedes detener streams individuales
5. ✅ Puedes detener todos los streams
6. ✅ Puedes cambiar la calidad
7. ✅ Tarjetas muestran información correcta
8. ✅ No hay errores en consola

## 📸 Capturas de Referencia

### Vista Completa con 4 Streams
```
Dashboard:
┌─────────────────────────────────────────┐
│ 🎬 Streaming                            │
│ [Calidad: 720p ▼] [⏹ Detener Todos]    │
├─────────────────────────────────────────┤
│ ┌──────────┐  ┌──────────┐             │
│ │ Device 1 │  │ Device 2 │             │
│ │ [⏹]     │  │ [⏹]     │             │
│ │ ● Activo │  │ ● Activo │             │
│ └──────────┘  └──────────┘             │
│ ┌──────────┐  ┌──────────┐             │
│ │ Device 3 │  │ Device 4 │             │
│ │ [⏹]     │  │ [⏹]     │             │
│ │ ● Activo │  │ ● Activo │             │
│ └──────────┘  └──────────┘             │
└─────────────────────────────────────────┘

Ventanas de scrcpy (separadas):
┌──────────┐  ┌──────────┐
│          │  │          │
│ Pantalla │  │ Pantalla │
│ Device 1 │  │ Device 2 │
│          │  │          │
└──────────┘  └──────────┘
┌──────────┐  ┌──────────┐
│          │  │          │
│ Pantalla │  │ Pantalla │
│ Device 3 │  │ Device 4 │
│          │  │          │
└──────────┘  └──────────┘
```

## 📞 Si Hay Problemas

1. **Captura de pantalla** del dashboard
2. **Captura de DevTools** (F12) con errores
3. **Copia logs** de la consola
4. **Describe** qué paso falló exactamente

---

**Última actualización:** 2026-05-21  
**Para recargar:** Ctrl+R en ventana Electron  
**Para DevTools:** F12  
**Para ver ventanas:** Alt+Tab
