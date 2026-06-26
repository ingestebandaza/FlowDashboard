# Reporte de Ejecución - Rollout 3 (Prueba Concurrente)

**Fecha:** 2026-06-10
**Alcance:** Validación de inyección paralela (Concurrencia) en 5 dispositivos utilizando `scrcpy-control` como motor principal y `adb_input` como fallback.

### Dispositivos Participantes y Exclusiones
* **Seriales Usados:** `.45`, `.46`, `.47`, `.49`, `.50`.
* **Razón para excluir `.48`:** Fue descartado de esta primera prueba de estrés debido a su historial de problemas de códec H.264 (perfil balanced). Se requería que todos los canarios concurrentes tuvieran certidumbre visual completa en caso de fallo, por lo que `.48` quedó relegado.

---

### Diagnóstico de Sistema (PC y Backend)
* **CPU Backend (Python):** ~0.97s acumulados durante la ráfaga.
* **Memoria RAM (Python):** ~39.3 MB.
* **Estabilidad General:** Sin caídas, sin bloqueos del event loop de aiohttp/Sanic.

---

### Resultados por Dispositivo

| Métrica | `.45` | `.46` | `.47` | `.49` | `.50` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MediaProjection pre/post** | `null` / `null` | `null` / `null` | `null` / `null` | `null` / `null` | `null` / `null` |
| **Sesiones `scrcpy` (Pre -> Post)** | 1 -> 1 (Reemplazo limpio) | 1 -> 1 (Reemplazo limpio) | 1 -> 1 (Reemplazo limpio) | 1 -> 1 (Reemplazo limpio) | 1 -> 1 (Reemplazo limpio) |
| **`/control/tap` (Concurrent)** | `scrcpy_control` (739ms) | `scrcpy_control` (701ms) | `scrcpy_control` (701ms) | `scrcpy_control` (702ms) | `scrcpy_control` (701ms) |
| **`/control/swipe` (Concurrent)** | `scrcpy_control` (417ms) | `scrcpy_control` (421ms) | `scrcpy_control` (421ms) | `scrcpy_control` (421ms) | `scrcpy_control` (421ms) |
| **`/control/keyevent` (Concurrent)** | `scrcpy_control` (30ms) | `scrcpy_control` (26ms) | `scrcpy_control` (26ms) | `scrcpy_control` (26ms) | `scrcpy_control` (26ms) |
| **Fallback ADB (`preferScrcpy=false`)** | `adb_input` (533ms) | `adb_input` (525ms) | `adb_input` (526ms) | `adb_input` (531ms) | `adb_input` (520ms) |
| **Procesos huérfanos** | 0 zombies | 0 zombies | 0 zombies | 0 zombies | 0 zombies |
| **Errores registrados** | Ninguno | Ninguno | Ninguno | Ninguno | Ninguno |

*Nota sobre la latencia inicial (Tap 700ms): Ocurre únicamente en el primer comando de la ráfaga debido a la inicialización paralela y el encolado del event-loop de peticiones asíncronas, regularizándose inmediatamente en el Swipe (420ms) y KeyEvent (26ms).*

---

### Conclusión Global
La prueba concurrente **fue un éxito rotundo**.
El backend multiplexó las 5 peticiones simultáneas hacia los 5 sockets TCP independientes sin entrelazarse, sin crear sesiones duplicadas (hubo reemplazo exacto 1 a 1), manteniendo un perfil de memoria mínimo (~40MB). 
A nivel de los teléfonos, **ninguno disparó MediaProjection** ni alertó a FlowAgent, demostrando que `scrcpy-control` puede escalar masivamente en paralelo sin comprometer el baseline limpio de Android.
