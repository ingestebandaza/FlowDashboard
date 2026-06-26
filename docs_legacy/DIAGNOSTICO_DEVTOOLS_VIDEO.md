# 🔍 Diagnóstico DevTools - Video Streaming

## ✅ DevTools Habilitado

He modificado `electron-app/src/main/index.js` para que DevTools se abra automáticamente al iniciar el dashboard.

**Atajos de teclado:**
- **F12**: Abrir/cerrar DevTools
- DevTools se abre automáticamente al iniciar

---

## 🎯 Qué Buscar en la Consola de DevTools

### 1️⃣ Verificar que Broadway.js se cargó correctamente

En la consola de DevTools, escribe:
```javascript
typeof Player
```

**Resultado esperado:** `"function"`
**Si sale:** `"undefined"` → Broadway NO se cargó, los scripts están mal referenciados

---

### 2️⃣ Verificar errores de carga de scripts

Busca en la pestaña **Console** mensajes como:
- ❌ `Failed to load resource: net::ERR_FILE_NOT_FOUND`
- ❌ `Uncaught ReferenceError: Player is not defined`
- ❌ `Failed to construct 'WebSocket'`

---

### 3️⃣ Verificar conexión WebSocket

Cuando hagas click en "Iniciar Streaming", busca en la consola:
- ✅ `Iniciando video stream para {serial}`
- ✅ `WebSocket conectado para {serial}`
- ❌ `WebSocket error:` → Problema de conexión
- ❌ `WebSocket closed:` → El servidor rechazó la conexión

---

### 4️⃣ Verificar que startVideoStream() se llama

Busca en la consola:
```
Iniciando video stream para 192.168.1.XX
```

Si NO aparece este mensaje, significa que `startVideoStream()` no se está llamando.

---

### 5️⃣ Verificar errores de Canvas

Busca mensajes relacionados con:
- ❌ `Canvas context is null`
- ❌ `Failed to get canvas context`
- ❌ `Cannot read property 'drawImage' of null`

---

## 🔧 Posibles Problemas y Soluciones

### Problema 1: Broadway no se carga
**Síntoma:** `typeof Player === "undefined"`

**Causa:** Los scripts de Broadway no están en la ruta correcta

**Solución:** Verificar que existan:
- `electron-app/node_modules/broadway/Player/Player.js`
- `electron-app/node_modules/broadway/Decoder.js`

---

### Problema 2: WebSocket no conecta
**Síntoma:** No hay logs de WebSocket en el servidor C#

**Causa:** URL incorrecta o servidor no escucha WebSocket

**Solución:** Verificar que:
- Servidor C# esté corriendo en puerto 5000
- URL sea: `ws://localhost:5000/api/videostream/ws/{serial}?quality=720&fps=30`
- Middleware WebSocket esté configurado en `Program.cs`

---

### Problema 3: Canvas no renderiza
**Síntoma:** Pantalla negra, 0 FPS

**Causa:** Canvas no se encuentra o Player no se inicializa

**Solución:** Verificar que:
- `<canvas id="stream-canvas-{serial}">` exista en el DOM
- `Player` se inicialice correctamente con el canvas

---

## 📋 Checklist de Diagnóstico

Cuando abras el dashboard y hagas click en "Iniciar Streaming", verifica:

- [ ] DevTools se abre automáticamente
- [ ] En consola: `typeof Player` retorna `"function"`
- [ ] No hay errores de carga de scripts (Player.js, Decoder.js)
- [ ] Al hacer click en "Iniciar Streaming" aparece: `Iniciando video stream para...`
- [ ] Aparece: `WebSocket conectado para...`
- [ ] En el servidor C# (Terminal 9) aparecen logs de WebSocket
- [ ] El canvas existe en el DOM (inspeccionar elemento)
- [ ] No hay errores en la consola

---

## 🚨 Si Broadway NO Funciona - Plan B

Si después de diagnosticar descubres que Broadway no se carga o no funciona, tenemos **Plan B**:

**Optimizar Screenshots con JPEG + WebSocket:**
- Cambiar PNG → JPEG (menor tamaño)
- Usar WebSocket en lugar de HTTP polling
- Comprimir imágenes al 70-80%
- Objetivo: 30-40 FPS con menor latencia

---

## 📞 Qué Reportar

Después de revisar DevTools, reporta:

1. **¿Qué dice `typeof Player`?**
2. **¿Hay errores en la consola? (copia el mensaje completo)**
3. **¿Aparece "WebSocket conectado"?**
4. **¿Hay logs en el servidor C# cuando inicias streaming?**
5. **¿El canvas existe en el DOM? (inspeccionar elemento)**

Con esta información podré diagnosticar exactamente qué está fallando.

---

## 🎬 Próximos Pasos

1. ✅ Abre el dashboard (ya está iniciando)
2. ✅ DevTools se abre automáticamente
3. 🔍 Selecciona un dispositivo
4. 🔍 Click en "Iniciar Streaming"
5. 🔍 Revisa la consola de DevTools
6. 📝 Reporta los hallazgos

---

**Última actualización:** 2026-05-22
**Estado:** DevTools habilitado, listo para diagnóstico
