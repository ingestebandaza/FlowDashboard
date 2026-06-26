# Plan FASE 2 - FlowDashboard Pro

## 🎯 Objetivo

Migrar los componentes de acción y gestión de cuentas del dashboard original a la nueva interfaz Electron.

## 📋 Componentes a Implementar

### 1. Categorías de Acción ✅ (Prioridad Alta)
**Ubicación:** Panel derecho, arriba del streaming

**Componentes:**
- 8 tarjetas de categorías:
  - FlowLogin (teal) - ACTIVO
  - FlowTrack (green) - Deshabilitado
  - FlowCache (amber) - Deshabilitado
  - FlowCast (purple) - Deshabilitado
  - FlowApple (pink) - Deshabilitado
  - Flowamazon (orange) - Deshabilitado
  - FlowGram (gradient) - Deshabilitado
  - FlowTikTok (black/cyan) - Deshabilitado

**Funcionalidad:**
- Selección exclusiva (solo una activa a la vez)
- Iconos SVG inline (no emoji)
- Borde de color siempre visible
- Estado seleccionado con glow adicional
- Botones Play debajo de cada categoría
- Solo FlowLogin ejecuta (los demás disabled)
- Animación cuando está ejecutando

### 2. Panel de Cuentas ⏳ (Prioridad Alta)
**Ubicación:** Panel izquierdo, debajo de dispositivos

**Componentes:**
- 3 pestañas con iconos y contadores:
  - Total (todas las cuentas)
  - Válidos (cuentas válidas)
  - No válidos (cuentas inválidas)
- Textarea grande para cada pestaña
- Persistencia en localStorage
- Campos de control:
  - Delimitador (input, default ":")
  - Dividir (number input, max 10)
  - Botón verde "Dividir y Asignar"

**Funcionalidad:**
- Cambiar entre pestañas
- Editar cuentas en textarea
- Guardar en localStorage automáticamente
- Dividir cuentas entre dispositivos seleccionados
- Validación: máximo 10 cuentas por dispositivo
- Actualizar contadores en tiempo real

### 3. Comandos ADB ⏳ (Prioridad Media)
**Ubicación:** Panel derecho, debajo de streaming

**Componentes:**
- Input de comando ADB
- Botón "Ejecutar"
- Área de output/consola
- Indicador de ejecución

**Funcionalidad:**
- Ejecutar comando en dispositivos seleccionados
- Mostrar output en tiempo real
- Historial de comandos
- Comandos predefinidos (dropdown)

## 🔄 Orden de Implementación

### Paso 1: Categorías de Acción (30 min)
1. Crear componente de categorías en `app.js`
2. Agregar estilos en `styles.css`
3. Implementar selección exclusiva
4. Agregar botones Play
5. Conectar FlowLogin con Python API

### Paso 2: Panel de Cuentas (45 min)
1. Crear componente de pestañas
2. Agregar textareas con persistencia
3. Implementar campos Delimitador y Dividir
4. Conectar con Python API para asignar cuentas
5. Validación de máximo 10 cuentas

### Paso 3: Comandos ADB (30 min)
1. Crear input y botón
2. Conectar con C# API
3. Mostrar output
4. Agregar comandos predefinidos

## 📐 Layout Actualizado

```
┌──────────────────────────────────────────────────────────────┐
│ Titlebar: FlowDashboard Pro                      [−] [□] [×] │
├────────────────────────┬─────────────────────────────────────┤
│ Panel Izquierdo        │ Panel Derecho                       │
│                        │                                     │
│ 📱 Dispositivos [17]   │ 🎯 Categorías                       │
│ ● Conectado            │ ┌────┬────┬────┬────┐              │
│ [🔄][✓][✗]            │ │Flow│Flow│Flow│Flow│              │
│ 17 seleccionados       │ │Logi│Trac│Cach│Cast│              │
│                        │ └────┴────┴────┴────┘              │
│ ┌────┐ ┌────┐ ┌────┐  │ ┌────┬────┬────┬────┐              │
│ │Dev1│ │Dev2│ │Dev3│  │ │Flow│Flow│Flow│Flow│              │
│ │🟢🟢│ │🔵🟡│ │⚫⚫│  │ │Appl│amaz│Gram│TikT│              │
│ └────┘ └────┘ └────┘  │ └────┴────┴────┴────┘              │
│                        │ [▶][▶][▶][▶][▶][▶][▶][▶]           │
│ ───────────────────    │                                     │
│                        │ 🎬 Streaming                        │
│ 📝 Cuentas             │ ┌──────────┐  ┌──────────┐         │
│ [Total][✓][✗]         │ │ Stream 1 │  │ Stream 2 │         │
│                        │ │ Device A │  │ Device B │         │
│ ┌──────────────────┐   │ └──────────┘  └──────────┘         │
│ │ Textarea         │   │                                     │
│ │ user@mail.com:pw │   │ ───────────────────────────────    │
│ │ user2@mail:pw2   │   │                                     │
│ └──────────────────┘   │ 💻 Comandos ADB                     │
│                        │ ┌──────────────────────────────┐    │
│ Delimitador: [:]       │ │ adb shell input text "test"  │    │
│ Dividir: [10] [Dividir]│ └──────────────────────────────┘    │
│                        │ [Ejecutar]                          │
└────────────────────────┴─────────────────────────────────────┘
```

## 🎨 Colores de Categorías

```javascript
const CATEGORIES = [
  { id: 'FlowLogin', color: '#14b8a6', label: 'FlowLogin', enabled: true },
  { id: 'FlowTrack', color: '#22b86f', label: 'FlowTrack', enabled: false },
  { id: 'FlowCache', color: '#f59e0b', label: 'FlowCache', enabled: false },
  { id: 'FlowCast', color: '#a78bfa', label: 'FlowCast', enabled: false },
  { id: 'FlowApple', color: '#fa2d75', label: 'FlowApple', enabled: false },
  { id: 'Flowamazon', color: '#ff9900', label: 'Flowamazon', enabled: false },
  { id: 'FlowGram', color: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', label: 'FlowGram', enabled: false },
  { id: 'FlowTikTok', color: '#000000', label: 'FlowTikTok', enabled: false }
];
```

## 📝 Notas de Implementación

### Respeto a AGENTS.md
- ✅ Mantener iconos SVG (no emoji)
- ✅ Borde de color siempre visible
- ✅ Selección exclusiva
- ✅ Máximo 10 cuentas por dispositivo
- ✅ Persistencia en localStorage
- ✅ No modificar lógica de Python

### Integración con Python API
- Endpoint `/autojs/run` para ejecutar FlowLogin
- Endpoint `/autojs/stop` para detener FlowLogin
- Endpoint `/device-person` para asignar cuentas
- Polling de `/login-status` para estados (ya implementado)

### Integración con C# API
- Endpoint `/api/adb/command` para comandos ADB
- Respuesta con output del comando

## ✅ Criterios de Éxito

### Categorías
- [ ] 8 categorías visibles con iconos SVG
- [ ] Solo una seleccionada a la vez
- [ ] Borde de color siempre visible
- [ ] FlowLogin ejecuta correctamente
- [ ] Animación cuando está ejecutando
- [ ] Botones Play alineados debajo

### Panel de Cuentas
- [ ] 3 pestañas funcionando
- [ ] Textareas con persistencia
- [ ] Delimitador y Dividir funcionando
- [ ] Validación de máximo 10 cuentas
- [ ] Asignación a dispositivos seleccionados
- [ ] Contadores actualizados

### Comandos ADB
- [ ] Input de comando funciona
- [ ] Ejecución en dispositivos seleccionados
- [ ] Output visible en tiempo real
- [ ] Comandos predefinidos disponibles

---

**Tiempo estimado:** 2-3 horas
**Prioridad:** Alta
**Dependencias:** FASE 1 completada ✅
