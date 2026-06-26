# Reporte de Ejecución - Validación Final de Control en .44

**Fecha:** 2026-06-10
**Alcance:** Validación de `scrcpy-control` sobre el dispositivo `192.168.1.44:5555`, el cual había sido previamente purgado de una sesión enganchada de `MediaProjection`.

---

### Diagnóstico de Pre-Condiciones
* **MediaProjection Inicial:** `null`
* **APK Instalada:** `1.0.0` (v105) sin mutación
* **`wm size`:** `1080x1920`
* **`wm density`:** `420`
* **FlowAgent:** Inactivo (No relanzado)
* **Procesos huérfanos:** 0

---

### Resultados de Ejecución de Control

| Endpoint | Parámetro | Motor Utilizado | Latencia | Fallback Usado |
| :--- | :--- | :--- | :--- | :--- |
| `/control/tap` | `preferScrcpy=true` | `scrcpy_control` | 234 ms | `false` |
| `/control/swipe` | `preferScrcpy=true` | `scrcpy_control` | 415 ms | `false` |
| `/control/keyevent` | `preferScrcpy=true` | `scrcpy_control` | 29 ms | `false` |
| `/control/tap` | `preferScrcpy=false` | `adb_input` | 499 ms | `true` |

---

### Diagnóstico Post-Ejecución
* **MediaProjection Post:** `null` (Totalmente limpio, no se invocó captura de pantalla)
* **Sesiones `scrcpy` Activas:** 1 única sesión (`scid: 394a80a1`)
* **Procesos huérfanos:** 0 (`app_process` único ejecutándose sin colisiones)
* **Coordenadas visuales:** Correctas (Inyecciones asimiladas sin desviación)

---

### Conclusión
El dispositivo `.44` fue purgado con éxito en la fase de Baseline Cleanup y ahora ha demostrado **asimilación perfecta del perfil de Control puro**. El motor principal funciona y el fallback opera como mecanismo de seguridad redundante sin fallos. El dispositivo `.44` se une al grupo de canarios oficialmente validados para Control.
