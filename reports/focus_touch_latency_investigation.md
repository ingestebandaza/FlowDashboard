# Focus Touch Latency Investigation

## 1. Hallazgos del Diagnóstico (Frontend)
He analizado el código fuente de `flow-touch.js` y el protocolo de comunicación con el backend (`local_adb_server.py`). 

La causa de la "latencia" o "sensación no-Live" al usar el Control en el modo Focus ha sido localizada:
**El frontend actual amortigua todo el gesto de drag de forma local y sólo envía un comando al backend cuando se suelta el clic.**

### Flujo actual de un Swipe:
1. `pointerdown`: El frontend registra el punto de inicio de manera local. **No envía nada a Android.**
2. `pointermove`: El frontend dibuja la flecha azul (trail) localmente en el canvas. **No envía nada a Android.**
3. `pointerup`: El frontend calcula la distancia y la duración total del gesto que el usuario acaba de hacer localmente. 
4. Envía la petición `POST /control/swipe` con `startX`, `startY`, `endX`, `endY` y `durationMs`.
5. El backend delega a `scrcpy_control_channel.py`, el cual envía eventos sintéticos progresivos a Android a través del socket.

**Conclusión del problema:** El teléfono empieza a ejecutar el swipe *solo después* de que el usuario haya terminado de mover el ratón y lo haya soltado. Esto genera un efecto de "rubber-banding" o retraso masivo percibido, desconectando la respuesta física de la mano del usuario.

## 2. Viabilidad de "LIVE TOUCH MODE"
Implementar un "Live Touch Mode" real (donde la pantalla responda en tiempo real al arrastrar el ratón) **es completamente viable y muy rápido de implementar**, dado que la nueva arquitectura nativa de `scrcpy-control` lo soporta perfectamente.

Scrcpy nativo recibe eventos de inyección de toque con las acciones:
- `ACTION_DOWN` (0)
- `ACTION_UP` (1)
- `ACTION_MOVE` (2)

### Restricción Importante (El caso de `.48`):
El modo seguro (ADB Fallback) **no soporta touch en tiempo real**. El comando `adb shell input` requiere el inicio y el fin del swipe antes de ejecutarlo.
Por lo tanto, la implementación del "Live Touch" debe ser inteligente:
- Si el dispositivo soporta `scrcpy_control` (la mayoría), usar streaming de eventos `touch`.
- Si el dispositivo es una excepción forzada a ADB (como el `.48`), debe usar el comportamiento actual heredado (calcular todo al soltar el clic y enviar el comando consolidado `swipe`).

## 3. Plan de Solución Recomendado
Propongo el siguiente parche en el código para activar `LIVE_TOUCH_MODE` manteniendo la estabilidad:

### Backend (`scrcpy_control_channel.py` y `local_adb_server.py`)
1. Añadir el método `touch(serial, action, x, y)` a `ScrcpyControlManager` en Python.
2. Exponer el endpoint `POST /control/touch`.
3. Si el dispositivo (como `.48`) está en la lista de forzado a ADB (`CONTROL_ADB_ONLY_SERIALS`), este endpoint devolverá un código de estado específico (por ejemplo, `fallback_required: true`).

### Frontend (`flow-touch.js`)
1. Al detectar el `pointerdown`, enviar `touch(ACTION_DOWN)`.
2. Al detectar el `pointermove` (con un `throttle` de ~25ms para evitar saturación HTTP), enviar `touch(ACTION_MOVE)`.
3. Al detectar el `pointerup`, enviar `touch(ACTION_UP)`.
4. Si durante `pointerdown` el backend responde que Live Touch no está disponible (caso `.48`), el frontend automáticamente desactiva el streaming en vivo para esa sesión y usa la lógica de swipe empaquetada (como está hoy).

Esto eliminará la capa visual retrasada de las flechas azules y hará que interactuar con el Dashboard en Focus Mode se sienta exactamente igual a tener el teléfono en la mano o usar la ventana nativa de scrcpy.
