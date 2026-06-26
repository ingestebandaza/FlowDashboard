# Reporte de Ejecución - Rollout 2 (Bloque de 3 Canarios)

**Fecha:** 2026-06-10
**Alcance:** Validación secuencial sobre 3 dispositivos adicionales (`192.168.1.45`, `192.168.1.46`, `192.168.1.47`).
**Condición Previa Excepcional:** La flota no se encontraba en estado limpio. Los tres dispositivos presentaban el token de MediaProjection enganchado (`TYPE_SCREEN_CAPTURE`) por una sesión pasada huérfana de FlowAgent. Se aplicó una purga selectiva (`am force-stop com.flowlogin.agent`) estrictamente sobre estos 3 canarios para habilitarlos para la prueba de Control Puro.

---

### Resultados por Dispositivo

| Métrica | 192.168.1.45:5555 | 192.168.1.46:5555 | 192.168.1.47:5555 |
| :--- | :--- | :--- | :--- |
| **MediaProjection pre/post** | Activo (sucio) -> Limpiado a `null` -> `null` | Activo (sucio) -> Limpiado a `null` -> `null` | Activo (sucio) -> Limpiado a `null` -> `null` |
| **Estado APK** | `1.0.0` instalado (no mutado) | `1.0.0` instalado (no mutado) | `1.0.0` instalado (no mutado) |
| **`wm size` / `density` / `orient`** | `1080x1920` / `480` / Estándar | `1080x1920` / `420` / Estándar | `1080x1920` / `420` / Estándar |
| **`/control/tap`** | `scrcpy_control` (lat: 227ms) | `scrcpy_control` (lat: 249ms) | `scrcpy_control` (lat: 236ms) |
| **`/control/swipe`** | `scrcpy_control` (lat: 415ms) | `scrcpy_control` (lat: 416ms) | `scrcpy_control` (lat: 416ms) |
| **`/control/keyevent`** | `scrcpy_control` (lat: 29ms) | `scrcpy_control` (lat: 29ms) | `scrcpy_control` (lat: 28ms) |
| **Fallback (`preferScrcpy=false`)** | `adb_input` (lat: 503ms) | `adb_input` (lat: 520ms) | `adb_input` (lat: 472ms) |
| **`fallbackUsed`** | `False` en principal, `True` en fallback | `False` en principal, `True` en fallback | `False` en principal, `True` en fallback |
| **Sesiones `scrcpy-sessions`** | 1 (`scid: 2f10e941`) | 1 (`scid: 31d2b6b8`) | 1 (`scid: 41cd1dd0`) |
| **Procesos huérfanos** | 0 zombies/huérfanos acumulados | 0 zombies/huérfanos acumulados | 0 zombies/huérfanos acumulados |

---

### Notas de Baseline No Limpio
Para cada uno de los tres dispositivos se cumple que:
- **MediaProjection inicial estaba activo** por sesión previa de FlowAgent.
- **Se limpió** con `am force-stop com.flowlogin.agent` solo en este dispositivo.
- Después de limpieza quedó `MediaProjection=null`.
- Control puro se probó sin relanzar FlowAgent.

### Conclusión Individual
- **.45**: Perfecto. Asimiló control puro y no activó FlowAgent ni captura.
- **.46**: Perfecto. Asimiló control puro y no activó FlowAgent ni captura.
- **.47**: Perfecto. Asimiló control puro y no activó FlowAgent ni captura.

### Decisión Global
**PASA a Rollout 3.** 
El comportamiento es determinista y exacto en todos los teléfonos. No hay fugas de procesos ni cruces de puertos, confirmando la solidez de `scrcpy-control` como motor aislado.
