# FlowTouch Requirements

Fecha: 2026-05-26
Estado: Planificacion, sin implementacion
Punto de restauracion previo: `restore_points/PuntoAntesdeltouch`

## Objetivo

FlowTouch permitira controlar un dispositivo Android desde una vista enfocada del dashboard Electron con mouse y teclado del PC, sin dañar FlowVideo, FlowAgent, FlowLogin, FlowRegister ni FlowKeyboard.

La recomendacion aprobada es **Focus Mode + FlowTouch PRO**:
- FlowTouch empieza siempre apagado.
- Doble click sobre una tarjeta/dispositivo abre una vista grande enfocada.
- FlowTouch se activa solo dentro de esa vista enfocada y solo para ese dispositivo.
- Al cerrar la vista enfocada, FlowTouch vuelve a apagarse y el dashboard regresa a la grilla normal.

## Requisitos Funcionales

### R1. Control manual explicito
- FlowTouch debe estar desactivado por defecto.
- El usuario activa FlowTouch abriendo Focus Mode con doble click sobre un dispositivo.
- FlowTouch solo debe estar activo para el dispositivo enfocado.
- Cerrar Focus Mode debe desactivar FlowTouch automaticamente.
- Al arrancar Electron no se deben enviar taps, swipes, comandos ADB, comandos FlowAgent ni cambios de permisos.

### R2. Focus Mode
- Doble click sobre una tarjeta debe abrir una vista enfocada del dispositivo.
- El primer doble click no debe enviar tap a Android; solo abre Focus Mode.
- Focus Mode debe mostrar una pantalla grande, nombre, serial, estado FlowAgent/FlowTouch y controles rapidos.
- Focus Mode debe cerrarse con boton visible y con tecla `Esc`.
- Al cerrar, debe desmontar listeners y limpiar estado activo.

### R3. Tap desde canvas enfocado
- Al hacer click dentro del canvas enfocado, FlowTouch debe convertir la posicion visual a coordenadas Android reales.
- El tap debe enviarse preferentemente por FlowAgent socket.
- Si se permite fallback ADB, debe ser explicito y visible.

### R4. Swipe desde drag
- Al mantener presionado y arrastrar dentro del canvas enfocado, FlowTouch debe generar un swipe con inicio, fin y duracion.
- El comando debe enviarse solo al soltar el mouse, para evitar saturar el backend.
- Debe existir feedback visual local durante el drag.

### R5. Gestos avanzados
- Debe soportar doble tap.
- Debe soportar long press.
- Debe soportar scroll por rueda como swipe vertical controlado.
- Debe ofrecer botones compactos para Back, Home y Recents.
- Debe soportar siguiente/anterior dispositivo sin activar multi-control.
- Debe ofrecer modo seguro opcional: abrir Focus Mode primero y requerir boton `Activar control`.

### R6. Coordenadas confiables
- La conversion debe considerar `canvas.getBoundingClientRect()`, dimensiones internas del canvas y posible escalado CSS.
- Debe funcionar con zoom de dispositivos y grid responsive.
- Debe registrar diagnostico cuando las dimensiones sean invalidas.

### R7. Integracion con FlowKeyboard
- FlowTouch no debe activar FlowKeyboard automaticamente.
- Cuando FlowKeyboard este preparado y seleccionado, se podra usar para texto manual posterior a un tap.
- Los logs no deben exponer texto sensible; registrar longitud y destino, no contenido completo.

### R8. No romper flujos existentes
- No modificar el contrato de frames WebP.
- No reemplazar `stream-renderer.js` ni destruir canvases durante polling.
- No modificar FlowLogin/FlowRegister en las primeras fases.
- No instalar APKs ni activar accesibilidad desde FlowTouch.
- No cambiar seleccion de tarjetas cuando Focus Mode no este activo.

### R9. Observabilidad y rollback
- Cada fase debe actualizar `tasks.md`.
- Cada cambio funcional o visual debe actualizar `PROJECT_CONTEXT.md`.
- Antes de implementar debe existir punto de restauracion documentado.
- La UI debe mostrar estado de control: Off, Ready, Sending, Error.
- Focus Mode debe mostrar historial corto de gestos sin datos sensibles.

## Requisitos No Funcionales

- Latencia objetivo tap: menor a 250 ms desde click hasta envio local.
- Mantener compatibilidad con Android 9 API 28.
- Evitar comandos por movimiento continuo del mouse.
- No introducir dependencias externas nuevas en fase inicial.
- Mantener codigo aislado en un modulo nuevo cuando sea posible.
- No permitir control multi-dispositivo en la primera version.

## Criterios de Aceptacion Inicial

- Con FlowTouch apagado, el dashboard se comporta igual que antes.
- Doble click en tarjeta abre Focus Mode sin enviar tap.
- Con Focus Mode activo, click en canvas enfocado ejecuta tap en coordenadas correctas.
- Drag en Focus Mode ejecuta swipe sin bloquear la UI.
- Cerrar Focus Mode apaga FlowTouch y no deja listeners activos.
- Si FlowAgent no esta conectado, se muestra error claro y no se cae Electron.
- `cachedFrames` y render de dispositivos no se degradan.
