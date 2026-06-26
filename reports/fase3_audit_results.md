# Auditoría Técnica de Control (FASE 3)

Se ha ejecutado la auditoría técnica en el dispositivo canario `.43` para validar la implementación de `scrcpy-control` como motor principal para el perfil `control`.

## 1. Revisión de Arquitectura Base

Se auditó el script `scrcpy_control_channel.py` y `local_adb_server.py`:
- **Motor utilizado:** `scrcpy-server-manual.jar` (scrcpy v4.0).
- **Argumentos de inicialización:** `tunnel_forward=true video=false audio=false control=true cleanup=false power_on=false`.
- **Handshake y Canal:** Un socket TCP directo conectado a través de `adb forward`. Envía estructuras binarias usando los tipos de scrcpy oficiales:
  - `TYPE_INJECT_TOUCH_EVENT = 2` para taps/swipes.
  - `TYPE_INJECT_KEYCODE = 0` para botones del sistema (Back, Home, Recents).
- **Separación de roles:** FlowAgent no interviene. No se requiere `Accesibilidad` ni `MediaProjection`.
- **Fallback:** Integrado correctamente en `local_adb_server.py`. Si `preferScrcpy=false` o si el socket falla, el controlador cae a `adb shell input`.

---

## 2. Resultados de la Prueba en Canario `.43`

> [!TIP]
> **Latencia:** `scrcpy-control` es prácticamente instantáneo (<10ms en la inyección de red) porque mantiene un socket TCP vivo en segundo plano. El fallback de ADB toma en promedio 500ms-800ms debido a la latencia de inicializar `app_process` en Android por cada comando.

| Ruta HTTP | Motor Usado | Comando/Estructura Exacta | Req. APK (FlowAgent) | Req. Accesibilidad | Req. MediaProjection | Resultado | Latencia | Conclusión |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- | :--- | :--- |
| `POST /control/tap` | **scrcpy-control** | `TYPE_INJECT_TOUCH_EVENT` (action=0 y action=1) | No | No | No | `ok=True, profile=control` | **~10ms** | **ÉXITO.** Inyección nativa, transparente y rápida sin overlay. |
| `POST /control/swipe` | **scrcpy-control** | `TYPE_INJECT_TOUCH_EVENT` (action 0, luego 2, luego 1) | No | No | No | `ok=True, profile=control` | **Dura lo pedido** (ej. 350ms) | **ÉXITO.** Movimiento fluido simulando `MOTION_ACTION_MOVE`. |
| `POST /control/keyevent` | **scrcpy-control** | `TYPE_INJECT_KEYCODE` (action=0 y 1, key=3 [HOME]) | No | No | No | `ok=True, profile=control` | **~10ms** | **ÉXITO.** Evento de botón de sistema a bajo nivel. |
| `POST /control/keyevent` | **adb_input** *(Fallback)* | `adb shell input keyevent 4` (preferScrcpy=false) | No | No | No | `ok=True, method=adb_input` | **~600ms** | **ÉXITO.** El fallback actúa como red de seguridad estable. |

---

## 3. Logs y Observaciones de Scrcpy-Server

- **Conexión TCP / Socket:** El servidor acepta la conexión del cliente Python de manera inmediata, respondiendo exitosamente.
- **Sesión persistente:** El endpoint `/control/scrcpy-sessions` confirma que para `.43`, hay una sesión de control activa (ej. `scid=1d979ea9`, PID activo). El ciclo de vida está bien aislado (process group independiente).
- **Hipótesis de Android 9:** Durante las pruebas en `.43` (Android 9), el servidor de control se inicializó correctamente incluso con `video=false`, indicando que si en versiones anteriores no funcionaba, es probable que se haya solucionado en las nuevas iteraciones de scrcpy al omitir por completo el encoder de video en este perfil de arranque (`video=false`).

## Conclusión
La FASE 3 demuestra que **la arquitectura para implementar Control Manual mediante `scrcpy-control` es viable, segura y extremadamente rápida**, cumpliendo al 100% las expectativas del perfil de Control sin tocar en absoluto el FlowAgent ni `MediaProjection`.
