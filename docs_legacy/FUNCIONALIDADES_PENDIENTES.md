# Funcionalidades Pendientes del Dashboard Antiguo

## 1. FlowRegister (Crear Cuentas) - INCOMPLETO

### Estado Actual:
- ✅ Sección agregada al sidebar
- ❌ Contenido incorrecto (solo tiene Cantidad y Dominio)

### Contenido Correcto (del dashboard antiguo):
```
FlowRegister debe tener:
- 3 Pestañas (igual que FlowLogin):
  * Total: Cuentas para crear
  * Válidos: Cuentas creadas exitosamente
  * No válidos: Fallos al crear
- Textarea para cada pestaña
- Contador de cuentas por pestaña
- Botón "Limpiar No válidos"
- Campo "Cantidad por dispositivo" (cuántas cuentas crear por dispositivo)
- Botón "Iniciar Creación"
- Persistencia en localStorage
```

### Funcionalidad:
- Lee cuentas de la pestaña "Total"
- Divide las cuentas entre dispositivos seleccionados
- Ejecuta `/sdcard/Download/Register.js` en cada dispositivo
- Mueve cuentas creadas a "Válidos"
- Mueve fallos a "No válidos"

---

## 2. Menú Contextual de Dispositivos - NO IMPLEMENTADO

### Opciones del menú (clic derecho en dispositivo):

1. **▶ Ejecutar pendientes**
   - Ejecuta FlowLogin solo en cuentas pendientes
   - Deshabilitado si no hay cuentas pendientes o si está ocupado

2. **⏹ Detener FlowLogin**
   - Detiene la ejecución de FlowLogin
   - Deshabilitado si no está ejecutándose

3. **🔄 Reintentar cuentas**
   - Reintenta todas las cuentas del dispositivo
   - Deshabilitado si está ocupado o no tiene cuentas

4. **🔁 Reemplazar cuentas rojas/moradas**
   - Reemplaza cuentas con estado "error" o "review"
   - Toma cuentas nuevas de la pestaña "Total" de FlowLogin
   - Deshabilitado si no hay cuentas para reemplazar

5. **➕ Añadir cuentas**
   - Abre un sub-panel para elegir cantidad
   - Añade cuentas adicionales (máx 10 total por dispositivo)
   - Toma cuentas de la pestaña "Total" de FlowLogin

6. **🗑️ Eliminar cuentas**
   - Elimina todas las cuentas del dispositivo
   - Pide confirmación
   - Deshabilitado si está ocupado

### Comportamiento:
- Si hay múltiples dispositivos seleccionados, aplica la acción a todos
- Muestra contador de dispositivos afectados
- Deshabilita opciones según el estado de los dispositivos

---

## 3. Otras Funcionalidades del Dashboard Antiguo

### Gestión de Cuentas:
- ✅ Pestañas Total/Válidos/No válidos
- ✅ Contador de cuentas
- ✅ Delimitador y Dividir
- ❌ Botón "Limpiar No válidos"
- ❌ Persistencia completa en localStorage

### Dispositivos:
- ✅ Selección múltiple
- ✅ Botones Actualizar/Todos/Ninguno
- ✅ Bolitas de estado (7 estados)
- ❌ Menú contextual (clic derecho)
- ❌ Drag & drop para reordenar
- ❌ Categorías de dispositivos
- ❌ Vista lista vs grid

### FlowLogin:
- ✅ Ejecutar en dispositivos seleccionados
- ✅ Botón Play/Stop
- ✅ Polling de estados
- ❌ Ejecutar solo pendientes
- ❌ Reintentar cuentas
- ❌ Reemplazar cuentas

---

## 4. Prioridades de Implementación

### Alta Prioridad:
1. **FlowRegister completo** - Funcionalidad crítica para crear cuentas
2. **Menú contextual básico** - Ejecutar pendientes, Detener, Eliminar cuentas

### Media Prioridad:
3. **Reintentar y Reemplazar cuentas** - Funcionalidades avanzadas de FlowLogin
4. **Añadir cuentas** - Gestión dinámica de cuentas

### Baja Prioridad:
5. **Drag & drop** - Reordenar dispositivos
6. **Categorías de dispositivos** - Organización avanzada
7. **Vista lista** - Alternativa a la vista grid

---

## 5. Archivos a Modificar

### Para FlowRegister:
- `electron-app/src/renderer/app.js`:
  * Actualizar `renderOtherFlowCategories()` para FlowRegister
  * Agregar estado para cuentas de registro (total, valid, invalid)
  * Agregar funciones de persistencia
  * Agregar función `startRegister()` correcta

### Para Menú Contextual:
- `electron-app/src/renderer/app.js`:
  * Agregar event listener `contextmenu` en device cards
  * Crear función `openDeviceContextMenu()`
  * Crear funciones para cada opción del menú
  * Agregar HTML del menú contextual

- `electron-app/src/renderer/styles.css`:
  * Estilos para el menú contextual
  * Animaciones de apertura/cierre

---

## 6. Endpoints del Backend Python Necesarios

Ya existen en `local_adb_server.py`:
- ✅ `/autojs/run` - Ejecutar scripts
- ✅ `/autojs/stop` - Detener scripts
- ✅ `/device-person` - Guardar/leer cuentas del dispositivo
- ✅ `/login-status` - Estado de login

---

¿Quieres que implemente primero FlowRegister completo o el menú contextual?
