# Reporte de Recuperación de Enrutamiento de Control (2026-06-10)

## Incidente: Control UI Roto (Fallo Crítico Global)

Tras la implementación del "Modo Seguro" para forzar el uso de `adb_input` de forma temporal, se reportó que **ningún dispositivo respondía a taps, swipes ni botones (Back/Home/Recents)** desde el dashboard de Electron. Las pulsaciones en pantalla no tenían ningún efecto real.

## Causa del Fallo

El fallo **no provino de scrcpy ni de adb**, sino de un error de sintaxis en el backend HTTP de Python (`local_adb_server.py`) que resultó en un fallo silencioso:
- Se implementó la verificación de una constante global mediante `getattr(sys.modules.get(__name__, sys.modules["__main__"]), "CONTROL_SAFE_MODE_ADB", True)`.
- El módulo `sys` no estaba importado en el scope global del archivo, lo cual generaba una excepción `NameError: name 'sys' is not defined`.
- El backend capturaba esta excepción y devolvía un HTTP `500 Internal Server Error`.
- El cliente (Electron) recibía el error 500 pero no lo exponía adecuadamente como una alerta crítica, simplemente fallando silenciosamente. Ningún comando de control alcanzaba los dispositivos.

## Solución y Nueva Arquitectura de Enrutamiento

Se solucionó el `NameError` eliminando el uso de `sys` e implementando una función de enrutamiento unificada `should_force_adb(serial, prefer_scrcpy)`.

**Estado actual del routing en `/control/*`:**
- **Motor por Defecto:** `scrcpy_control`
- **Fallback Programado:** `adb_input`
- **Excepciones Permanentes:** `.48` (`192.168.1.48:5555`) usa exclusicamente `adb_input` mediante un registro estático en `CONTROL_ADB_ONLY_SERIALS`, debido a su diagnóstico de fallo silencioso en la inyección de scrcpy nativa.
- **Modo Seguro Global:** `CONTROL_SAFE_MODE_ADB` está establecido en `False` (inactivo), permitiendo que el motor predeterminado (`scrcpy`) opere los dispositivos compatibles.

## Validaciones Esperadas (Prueba Real UI)

Para declarar este incidente cerrado y la arquitectura final consolidada, se requiere validación **visual y funcional desde el cliente Electron**:

### Dispositivos Normales (`.44`, `.45`, `.53`, etc.)
- Ejecución: scrcpy-control.
- Payload JSON esperado:
  - `ok: true`
  - `method: "scrcpy_control"`
  - `fallbackUsed: false`
- Visualmente: El dispositivo debe reaccionar de manera casi inmediata.

### Dispositivo Excepción (`.48`)
- Ejecución: adb_input.
- Payload JSON esperado:
  - `ok: true`
  - `method: "adb_input"`
  - `fallbackUsed: true`
  - `routingReason: "serial_adb_only"`
- Visualmente: El dispositivo debe reaccionar (con latencia típica de ADB ~500ms).

## Decisión Final
- El backend está verificado a nivel código (scripts locales).
- **Pendiente:** La aprobación final por parte del usuario tras probar visualmente y certificar que Electron reacciona a todos los controles manuales utilizando el esquema propuesto.
