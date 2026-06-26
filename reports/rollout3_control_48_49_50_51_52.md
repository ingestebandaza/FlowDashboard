# Reporte de Ejecución - Rollout 3 (Secuencial 5 Canarios)

**Fecha:** 2026-06-10
**Alcance:** Validación secuencial sobre 5 dispositivos adicionales (`.48`, `.49`, `.50`, `.51`, `.52`).
**Condiciones de entrada:** Todos presentaban estado de MediaProjection sucio por sesiones previas (`TYPE_SCREEN_CAPTURE`), por lo que se aplicó `am force-stop com.flowlogin.agent` individualmente antes de inyectar comandos de Control puro. No se relanzó FlowAgent.

---

### Tabla de Resultados por Dispositivo

| Métrica | `.48` | `.49` | `.50` | `.51` | `.52` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MediaProjection Inicial** | Activo (sucio) | Activo (sucio) | Activo (sucio) | Activo (sucio) | Activo (sucio) |
| **Limpieza aplicada** | Sí | Sí | Sí | Sí | Sí |
| **MediaProjection Post-Limpieza** | `null` | `null` | `null` | `null` | `null` |
| **APK instalada** | `1.0.0` (v105) | `1.0.0` (v105) | `1.0.0` (v105) | `1.0.0` (v105) | `1.0.0` (v105) |
| **Usher / FlowKeyboard** | Activos | Activos | Activos | Activos | Activos |
| **`wm size` / `density` / `orient`** | `1080x1920`/`480`/0 | `1080x1920`/`480`/0 | `1080x1920`/`480`/0 | `1080x1920`/`480`/0 | `1080x1920`/`480`/0 |
| **Taps Visuales** | `[!]` (Ciego / OK) | OK | OK | OK | OK |
| **`/control/tap` (ms)** | `scrcpy_control` (283) | `scrcpy_control` (250) | `scrcpy_control` (268) | `scrcpy_control` (270) | `scrcpy_control` (233) |
| **`/control/swipe` (ms)** | `scrcpy_control` (416) | `scrcpy_control` (414) | `scrcpy_control` (413) | `scrcpy_control` (417) | `scrcpy_control` (415) |
| **`/control/keyevent` (ms)**| `scrcpy_control` (28) | `scrcpy_control` (29) | `scrcpy_control` (29) | `scrcpy_control` (28) | `scrcpy_control` (40) |
| **Fallback ADB (ms)** | `adb_input` (570) | `adb_input` (528) | `adb_input` (699) | `adb_input` (616) | `adb_input` (603) |
| **Sesiones Totales** | 1 (`scid: 6110a141`) | 1 (`scid: 1c42c5cf`) | 1 (`scid: 6af0ab85`) | 1 (`scid: 15073450`) | 1 (`scid: 7285d5cb`) |
| **Procesos huérfanos** | 0 | 0 | 0 | 0 | 0 |
| **Conclusión Individual**| Pasa. Sin errores. | Pasa. Sin errores. | Pasa. Sin errores. | Pasa. Sin errores. | Pasa. Sin errores. |

**Nota sobre .48:** Según el historial de problemas H.264, los comandos fueron emitidos de forma ciega. Se confirma la inyección en backend sin errores.

---

### Decisión General
Todos los dispositivos reaccionaron positivamente y aislaron el perfil de control sin activar en ningún momento FlowAgent, OCR ni grabar pantallas. El baseline limpio forzado resultó efectivo y persistente.
**Listo para revisión del usuario antes de proceder a prueba concurrente.**
