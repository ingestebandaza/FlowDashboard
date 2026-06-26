# Guía Rápida - FASE 2

## 🎉 ¡FASE 2 Completada!

Ahora tienes categorías de acción y panel de cuentas funcionando.

## 🔄 Recargar Aplicación

La aplicación Electron ya está corriendo. Para ver los cambios:

1. **Ir a la ventana de Electron** (FlowDashboard Pro)
2. **Presionar Ctrl+R** para recargar
3. **Ver los nuevos componentes**

## 🆕 Nuevas Características

### 1. Categorías de Acción (Panel Derecho)
```
┌────┬────┬────┬────┐
│Flow│Flow│Flow│Flow│
│Logi│Trac│Cach│Cast│
└────┴────┴────┴────┘
┌────┬────┬────┬────┐
│Flow│Flow│Flow│Flow│
│Appl│amaz│Gram│TikT│
└────┴────┴────┴────┘
[▶][▶][▶][▶][▶][▶][▶][▶]
```

**Cómo usar:**
- Click en categoría para seleccionarla
- Solo FlowLogin está habilitado (verde teal)
- Los demás están deshabilitados (gris)
- Click en botón ▶ para ejecutar FlowLogin

### 2. Panel de Cuentas (Panel Izquierdo)
```
📝 Cuentas
[Total][✓ Válidos][✗ No válidos]

┌──────────────────────┐
│ user@mail.com:pass   │
│ user2@mail.com:pass2 │
│ ...                  │
└──────────────────────┘

Delimitador: [:] Dividir: [10] [Dividir y Asignar]
```

**Cómo usar:**
- Click en pestañas para cambiar
- Escribir cuentas (una por línea)
- Formato: `email:password`
- Click en "Dividir y Asignar" para distribuir

## 📝 Tutorial Rápido

### Paso 1: Agregar Cuentas
```
1. Ir a panel "📝 Cuentas"
2. Pestaña "Total"
3. Escribir:
   user1@spotify.com:password1
   user2@spotify.com:password2
   user3@spotify.com:password3
4. Ver contador: Total [3]
```

### Paso 2: Asignar a Dispositivos
```
1. Seleccionar 1 dispositivo en el grid
2. Cambiar "Dividir" a 3
3. Click en "Dividir y Asignar"
4. Ver alerta: "✅ Cuentas divididas..."
5. Ver 3 bolitas grises en el dispositivo
```

### Paso 3: Ejecutar FlowLogin
```
1. Verificar que dispositivo tenga cuentas (bolitas grises)
2. Dispositivo debe estar seleccionado
3. Click en botón ▶ de FlowLogin
4. Ver botón con animación de pulso
5. Ver bolitas cambiar de gris → azul → verde
```

### Paso 4: Detener FlowLogin
```
1. Click en botón ⏹ de FlowLogin
2. Ver animación detenerse
3. Bolitas mantienen su último estado
```

## 🎯 Casos de Uso

### Caso 1: Un Dispositivo, Varias Cuentas
```
Cuentas: 10
Dispositivos: 1
Dividir: 10
Resultado: 10 cuentas en 1 dispositivo
```

### Caso 2: Varios Dispositivos, Misma Cantidad
```
Cuentas: 20
Dispositivos: 2
Dividir: 10
Resultado: 10 cuentas en cada dispositivo
```

### Caso 3: Distribución Automática
```
Cuentas: 30
Dispositivos: 3
Dividir: 10
Resultado: 10 cuentas en cada dispositivo
```

## ⚠️ Validaciones

### Máximo 10 Cuentas
```
❌ Dividir: 15
✅ Dividir: 10 (máximo)
```

### Dispositivos Seleccionados
```
❌ Sin selección → "Selecciona al menos un dispositivo"
✅ Con selección → Divide y asigna
```

### Cuentas Disponibles
```
❌ Textarea vacío → "No hay cuentas para dividir"
✅ Con cuentas → Divide y asigna
```

## 🎨 Colores de Categorías

- **FlowLogin** (teal): #14b8a6 ✅ Habilitado
- **FlowTrack** (green): #22b86f ⏸ Deshabilitado
- **FlowCache** (amber): #f59e0b ⏸ Deshabilitado
- **FlowCast** (purple): #a78bfa ⏸ Deshabilitado
- **FlowApple** (pink): #fa2d75 ⏸ Deshabilitado
- **Flowamazon** (orange): #ff9900 ⏸ Deshabilitado
- **FlowGram** (instagram): #e1306c ⏸ Deshabilitado
- **FlowTikTok** (black): #000000 ⏸ Deshabilitado

## 💾 Persistencia

### localStorage
Tus cuentas se guardan automáticamente:
- `flowdashboard.accounts.total`
- `flowdashboard.accounts.valid`
- `flowdashboard.accounts.invalid`
- `flowdashboard.delimiter`

### Python Backend
Las cuentas asignadas se guardan en:
- `device_names.json` (campo `person`)

## 🔍 Verificar en DevTools

Abre DevTools (F12) y verifica:

```javascript
// Ver cuentas en memoria
console.log(app.accounts);

// Ver categoría seleccionada
console.log(app.selectedCategory);

// Ver flujo ejecutándose
console.log(app.runningFlow);

// Ver delimitador
console.log(app.delimiter);
```

## 🐛 Solución de Problemas

### "Servidor Python no conectado"
```
1. Verificar que Python server esté corriendo
2. Ver status pill: debe estar verde
3. Esperar 3 segundos para reconexión
```

### Bolitas no aparecen
```
1. Verificar que cuentas se asignaron
2. Esperar 5 segundos (polling)
3. Recargar con Ctrl+R
```

### FlowLogin no ejecuta
```
1. Verificar dispositivos seleccionados
2. Verificar que tengan cuentas asignadas
3. Ver logs en DevTools (F12)
```

### Cuentas no se guardan
```
1. Verificar que escribiste en textarea
2. Cambiar de pestaña para forzar guardado
3. Verificar localStorage en DevTools
```

## 📊 Logs Útiles

### Consola Electron (F12)
```
📂 Categoría seleccionada: FlowLogin
▶ Iniciando FlowLogin en dispositivos: ["192.168.1.11:5555"]
✅ FlowLogin iniciado correctamente
📊 Dividiendo 10 cuentas entre 1 dispositivos (10 por dispositivo)
✅ 10 cuentas asignadas a 192.168.1.11:5555
```

### Consola Python
```
POST /autojs/run
POST /device-person
POST /login-status
```

## ✅ Checklist de Verificación

Después de recargar (Ctrl+R):

- [ ] Ver 8 categorías en panel derecho
- [ ] Ver 8 botones Play debajo
- [ ] Solo FlowLogin habilitado (color teal)
- [ ] Ver panel "📝 Cuentas" en panel izquierdo
- [ ] Ver 3 pestañas: Total, ✓ Válidos, ✗ No válidos
- [ ] Ver textarea grande
- [ ] Ver campos Delimitador y Dividir
- [ ] Ver botón "Dividir y Asignar"
- [ ] Layout de 2 columnas funciona
- [ ] Scroll independiente en cada columna

## 🎉 ¡Listo!

**FASE 2 está funcionando.**

Ahora puedes:
1. ✅ Seleccionar categorías (solo FlowLogin activo)
2. ✅ Agregar cuentas en el panel
3. ✅ Dividir y asignar automáticamente
4. ✅ Ejecutar FlowLogin con botón Play
5. ✅ Ver bolitas cambiar en tiempo real

**¿Qué sigue?**
- **FASE 3**: Comandos ADB y Streaming Embebido
- **FASE 4**: Features avanzadas y distribución

---

**Última actualización:** 2026-05-21  
**Versión:** 2.0.0  
**Para recargar:** Ctrl+R en ventana Electron
