# 🧪 Instrucciones para Probar FASE 2

## ✅ Estado Actual

- ✅ Servidor C# corriendo (puerto 5000)
- ✅ Servidor Python corriendo (puerto 8765)
- ✅ Aplicación Electron abierta
- ✅ Cambios de FASE 2 guardados

## 🔄 Paso 1: Recargar Electron

### Opción A: Atajo de Teclado (Recomendado)
1. **Ir a la ventana de Electron** (FlowDashboard Pro)
2. **Presionar Ctrl+R** (o F5)
3. La aplicación se recargará con los nuevos componentes

### Opción B: Desde DevTools
1. **Abrir DevTools**: Presionar F12
2. **Click derecho** en el botón de recargar del navegador
3. **Seleccionar "Vaciar caché y recargar"**

### Opción C: Reiniciar Electron
Si Ctrl+R no funciona:
1. **Cerrar la ventana de Electron** (botón X)
2. **Esperar 5 segundos**
3. La aplicación se reabrirá automáticamente

## 👀 Paso 2: Verificar Nuevos Componentes

Después de recargar, deberías ver:

### Panel Derecho (Arriba)
```
🎯 Categorías

┌────────┬────────┬────────┬────────┐
│ Flow   │ Flow   │ Flow   │ Flow   │
│ Login  │ Track  │ Cache  │ Cast   │
│ (teal) │ (gray) │ (gray) │ (gray) │
└────────┴────────┴────────┴────────┘

┌────────┬────────┬────────┬────────┐
│ Flow   │ Flow   │ Flow   │ Flow   │
│ Apple  │ amazon │ Gram   │ TikTok │
│ (gray) │ (gray) │ (gray) │ (gray) │
└────────┴────────┴────────┴────────┘

[▶] [▶] [▶] [▶] [▶] [▶] [▶] [▶]
 ↑   ↑   ↑   ↑   ↑   ↑   ↑   ↑
Solo el primero está habilitado
```

### Panel Izquierdo (Abajo)
```
📝 Cuentas

[Total 0] [✓ Válidos 0] [✗ No válidos 0]
    ↑          ↑              ↑
  Pestañas con contadores

┌─────────────────────────────────┐
│                                 │
│  Textarea grande                │
│  (escribe cuentas aquí)         │
│                                 │
└─────────────────────────────────┘

Delimitador: [:] Dividir: [10] [Dividir y Asignar]
```

## ✅ Paso 3: Verificar en DevTools

1. **Abrir DevTools**: Presionar F12
2. **Ir a la pestaña Console**
3. **Buscar estos mensajes**:
   ```
   🚀 Iniciando FlowDashboard Pro...
   ✅ Conectado al servidor C# (ADB)
   ✅ Conectado al servidor Python (FlowLogin)
   📱 17 dispositivos encontrados
   ```

4. **Verificar que no haya errores rojos**

## 🧪 Paso 4: Pruebas Básicas

### Prueba 1: Categorías
```
1. Ver 8 categorías en panel derecho
2. FlowLogin debe tener borde teal (verde azulado)
3. Las demás deben estar en gris (deshabilitadas)
4. Click en FlowLogin → debe tener glow adicional
5. Click en FlowTrack → no debe hacer nada (disabled)
```

### Prueba 2: Botones Play
```
1. Ver 8 botones Play debajo de categorías
2. Solo el primero debe estar habilitado
3. Los demás deben estar en gris (disabled)
4. Hover sobre el primero → debe cambiar de color
```

### Prueba 3: Panel de Cuentas
```
1. Ver panel "📝 Cuentas" en columna izquierda
2. Ver 3 pestañas: Total, ✓ Válidos, ✗ No válidos
3. Ver textarea grande
4. Ver campos: Delimitador [:] y Dividir [10]
5. Ver botón verde "Dividir y Asignar"
```

### Prueba 4: Cambiar Pestañas
```
1. Click en pestaña "Total" → debe activarse
2. Click en pestaña "✓ Válidos" → debe activarse
3. Click en pestaña "✗ No válidos" → debe activarse
4. Cada pestaña debe mostrar su propio textarea
```

## 🎯 Paso 5: Prueba Funcional Completa

### Agregar y Asignar Cuentas

**1. Agregar cuentas:**
```
1. Click en pestaña "Total"
2. Escribir en textarea:
   user1@spotify.com:password1
   user2@spotify.com:password2
   user3@spotify.com:password3
3. Ver contador cambiar: Total [3]
```

**2. Asignar a dispositivo:**
```
1. Seleccionar 1 dispositivo en el grid
2. Cambiar "Dividir" a 3
3. Click en "Dividir y Asignar"
4. Ver alerta: "✅ Cuentas divididas y asignadas correctamente"
5. Click en "OK"
6. Esperar 5 segundos
7. Ver 3 bolitas grises en el dispositivo
```

**3. Ejecutar FlowLogin:**
```
1. Verificar que dispositivo tenga bolitas grises
2. Dispositivo debe estar seleccionado (borde verde)
3. Click en botón ▶ de FlowLogin (primer botón)
4. Ver botón con animación de pulso
5. Ver en DevTools: "▶ Iniciando FlowLogin..."
6. Ver bolitas cambiar de gris → azul (running)
7. Esperar 10-30 segundos
8. Ver bolitas cambiar a verde (success) o rojo (error)
```

**4. Detener FlowLogin:**
```
1. Mientras está ejecutando (botón con pulso)
2. Click en botón ⏹ (mismo botón, ahora es Stop)
3. Ver animación detenerse
4. Ver en DevTools: "⏹ Deteniendo FlowLogin"
```

## 🐛 Solución de Problemas

### No veo las categorías
```
❌ Problema: Panel derecho solo muestra "🎬 Streaming"
✅ Solución:
   1. Abrir DevTools (F12)
   2. Ver si hay errores en Console
   3. Presionar Ctrl+Shift+R (recarga forzada)
   4. Si persiste, cerrar y reabrir Electron
```

### No veo el panel de cuentas
```
❌ Problema: Panel izquierdo solo muestra dispositivos
✅ Solución:
   1. Scroll hacia abajo en panel izquierdo
   2. Debe aparecer panel "📝 Cuentas"
   3. Si no aparece, verificar errores en DevTools
```

### Botón "Dividir y Asignar" no funciona
```
❌ Problema: Click no hace nada
✅ Solución:
   1. Verificar que haya dispositivos seleccionados
   2. Verificar que haya cuentas en textarea
   3. Ver errores en DevTools (F12)
   4. Verificar que Python server esté conectado (status pill verde)
```

### FlowLogin no ejecuta
```
❌ Problema: Click en ▶ no hace nada
✅ Solución:
   1. Verificar dispositivos seleccionados
   2. Verificar que tengan cuentas asignadas (bolitas grises)
   3. Verificar Python conectado (status pill verde)
   4. Ver errores en DevTools
   5. Verificar logs de Python server
```

## 📊 Logs Esperados

### DevTools Console (F12)
```javascript
🚀 Iniciando FlowDashboard Pro...
✅ Conectado al servidor C# (ADB)
✅ Conectado al servidor Python (FlowLogin)
📱 17 dispositivos encontrados
📂 Categoría seleccionada: FlowLogin
📊 Dividiendo 3 cuentas entre 1 dispositivos (3 por dispositivo)
✅ 3 cuentas asignadas a 192.168.1.11:5555
▶ Iniciando FlowLogin en dispositivos: ["192.168.1.11:5555"]
✅ FlowLogin iniciado correctamente
```

### Python Server
```
POST /device-person - 200 OK
POST /autojs/run - 200 OK
POST /login-status - 200 OK
```

## ✅ Checklist de Verificación

Después de recargar, verifica:

- [ ] Ver 8 categorías en panel derecho
- [ ] FlowLogin con borde teal, demás en gris
- [ ] 8 botones Play debajo de categorías
- [ ] Solo primer botón habilitado
- [ ] Panel "📝 Cuentas" en panel izquierdo
- [ ] 3 pestañas con contadores
- [ ] Textarea grande visible
- [ ] Campos Delimitador y Dividir visibles
- [ ] Botón "Dividir y Asignar" visible
- [ ] Layout de 2 columnas funciona
- [ ] Scroll independiente en cada columna
- [ ] No hay errores en DevTools

## 🎉 Si Todo Funciona

Deberías poder:
1. ✅ Ver 8 categorías con iconos
2. ✅ Seleccionar FlowLogin (glow teal)
3. ✅ Ver panel de cuentas con 3 pestañas
4. ✅ Agregar cuentas en textarea
5. ✅ Dividir y asignar a dispositivos
6. ✅ Ver bolitas grises aparecer
7. ✅ Ejecutar FlowLogin con botón ▶
8. ✅ Ver bolitas cambiar de color en tiempo real

## 📞 Si Hay Problemas

1. **Captura de pantalla** de la ventana Electron
2. **Captura de DevTools** (F12) mostrando errores
3. **Copia los logs** de la consola
4. **Dime qué paso falló** exactamente

---

**Última actualización:** 2026-05-21  
**Para recargar:** Ctrl+R en ventana Electron  
**Para DevTools:** F12
