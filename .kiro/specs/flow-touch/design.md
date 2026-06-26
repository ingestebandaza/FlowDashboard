# FlowTouch Design

Fecha: 2026-05-26
Estado: Planificacion

## Resumen

FlowTouch sera una capa de control manual dentro de una vista enfocada del preview vivo existente. No sera una fuente nueva de video ni una automatizacion de login. Su trabajo sera abrir un dispositivo en Focus Mode, capturar eventos del mouse solo en ese modal/panel, convertirlos a coordenadas Android y enviarlos por los canales ya existentes.

La primera version no controlara desde la grilla directamente. La grilla solo sirve para seleccionar y abrir el dispositivo con doble click.

## Arquitectura Propuesta

```
Electron device card double click
  -> FlowTouchFocus.open(serial)
  -> Focus canvas
  -> FlowTouchController (solo serial enfocado)
  -> CoordinateMapper
  -> CommandRouter
  -> Python /agent/command
  -> FlowAgent AccessibilityService
  -> Android gesture
```

## Modulos

### FlowTouchController
Ubicacion propuesta: `electron-app/src/renderer/flow-touch.js`

Responsabilidades:
- Mantener estado `off`, `focus-open`, `ready`, `sending`, `error`.
- Mantener un solo `activeSerial`.
- Adjuntar y retirar listeners de mouse/pointer solo sobre el canvas enfocado.
- Detectar tap, double tap, long press, drag/swipe y wheel.
- Emitir feedback visual dentro de Focus Mode sin re-renderizar la grilla.
- Desactivar todo al cerrar Focus Mode.

### FlowTouchFocus
Ubicacion propuesta: mismo archivo `flow-touch.js` o helper interno.

Responsabilidades:
- Abrir modal/panel enfocado desde doble click en tarjeta.
- Crear una superficie grande para el canvas del dispositivo.
- Mostrar barra superior con nombre, serial, FlowAgent, FPS/frames y estado FlowTouch.
- Mostrar controles rapidos: Back, Home, Recents, cerrar, siguiente y anterior.
- Cerrar con boton o `Esc`.
- Devolver el dashboard a la grilla normal sin side effects.

### CoordinateMapper
Responsabilidades:
- Leer `canvas.getBoundingClientRect()`.
- Usar `canvas.width` y `canvas.height` como referencia interna.
- Calcular escala X/Y.
- Clamp de coordenadas a limites validos.
- Preparar diagnostico cuando el canvas no tenga dimensiones.

Formula inicial:

```text
relativeX = clientX - rect.left
relativeY = clientY - rect.top
x = round(relativeX * canvas.width / rect.width)
y = round(relativeY * canvas.height / rect.height)
```

### CommandRouter
Responsabilidades:
- Resolver serial del dispositivo.
- Buscar agente conectado con `/agents`.
- Enviar comandos por `POST /agent/command`.
- Fallback ADB opcional solo si se habilita explicitamente.
- Normalizar errores para UI.

Comandos iniciales por FlowAgent:

```json
{ "name": "tap", "x": 100, "y": 200 }
{ "name": "swipe", "startX": 100, "startY": 800, "endX": 100, "endY": 300, "duration": 420 }
{ "name": "back" }
{ "name": "home" }
{ "name": "recents" }
```

## UI Propuesta

### Ubicacion
- Doble click sobre tarjeta/dispositivo abre Focus Mode.
- Subcategoria `FlowVideo` o `FlowTouch` muestra solo estado/ayuda breve y opcion de modo seguro.
- Indicador por tarjeta cuando existe un dispositivo enfocado.

### Focus Mode PRO
- Modal grande o vista overlay centrada.
- Fondo del dashboard atenuado.
- Canvas del telefono grande, con aspect ratio estable.
- Header compacto:
  - nombre del dispositivo
  - serial/IP
  - FlowAgent conectado/desconectado
  - estado FlowTouch
  - FPS o ultimo frame si esta disponible
- Barra de acciones:
  - Back
  - Home
  - Recents
  - rotar si se habilita en futuro
  - anterior/siguiente dispositivo
  - cerrar
- Overlay de gesto:
  - punto para tap
  - linea para swipe
  - pulso para long press
- Historial corto:
  - `tap x,y`
  - `swipe up`
  - `back`
  - sin texto sensible

### Estados
- `Off`: sin listeners activos.
- `FocusOpen`: modal abierto, aun sin control si modo seguro esta activo.
- `Ready`: listeners activos en el canvas enfocado, FlowAgent detectado.
- `Sending`: comando en vuelo.
- `Error`: fallo de agente, coordenadas o backend.

### Interacciones
- Doble click en tarjeta: abrir Focus Mode; no envia tap.
- Click dentro del Focus canvas: tap.
- Doble click dentro del Focus canvas: double tap.
- Drag dentro del Focus canvas: swipe.
- Shift + drag dentro del Focus canvas: swipe lento.
- Ctrl + click dentro del Focus canvas: long press.
- Wheel dentro del Focus canvas: scroll vertical.
- `Esc`: cerrar Focus Mode y apagar FlowTouch.
- Botones compactos: Back, Home, Recents.

## Seguridad

- FlowTouch no se activa al iniciar.
- FlowTouch no prepara FlowAgent por su cuenta.
- FlowTouch no instala APKs.
- FlowTouch no activa accesibilidad.
- FlowTouch no modifica FlowLogin/FlowRegister.
- FlowTouch no envia taps desde la grilla.
- FlowTouch controla un solo dispositivo en la primera version.
- Cerrar Focus Mode apaga FlowTouch y desmonta listeners.
- No registrar texto completo enviado por teclado.

## Estrategia de Implementacion Segura

1. Crear modulo aislado sin conectar listeners.
2. Agregar Focus Mode sin comandos Android.
3. Conectar doble click de tarjeta para abrir Focus Mode.
4. Montar canvas enfocado usando el stream existente.
5. Agregar calculo de coordenadas con tests manuales en Electron.
6. Activar tap solo dentro del Focus canvas.
7. Agregar swipe despues de validar taps.
8. Agregar gestos avanzados y controles rapidos.
9. Integrar FlowKeyboard solo cuando FlowTouch este estable.

## Modo Seguro Opcional

Para reducir accidentes, Focus Mode puede abrirse en estado `FocusOpen` y mostrar un boton `Activar control`.

Variante recomendada:
- Doble click abre Focus Mode.
- Si FlowAgent esta OK, FlowTouch queda `Ready` directamente.
- Si el usuario activa `Modo seguro`, Focus Mode abre sin listeners de gestos hasta tocar `Activar control`.

## Rollback

Punto de restauracion previo:

`restore_points/PuntoAntesdeltouch`

Contiene:
- `git-status-short.txt`
- `tracked-changes.diff`
- `tracked-files-changed.txt`
- copia de archivos runtime criticos actuales

Si una fase falla, revertir primero los archivos tocados por FlowTouch desde ese snapshot o usando el diff correspondiente de la fase.
