# Reporte de Diagnóstico - H.264 Recovery en .48

**Fecha:** 2026-06-10
**Dispositivo:** `192.168.1.48:5555`
**Objetivo:** Recuperar o diagnosticar el historial de falla del códec H.264 (especialmente en `balanced`) para determinar su aptitud en el Rollout visual.

---

### Diagnóstico de Pre-condiciones
* **ADB:** Conectado y estable.
* **`wm size`:** `1080x1920`
* **`wm density`:** `480` (Override: 420)
* **MediaProjection:** `null`
* **Sesiones `scrcpy-sessions`:** Limpio (1 sola sesión principal).

---

### Prueba de Presets (WebSocket `ws://127.0.0.1:8768/<serial>?preset=...`)

Se ejecutó un cliente WebSocket puro para solicitar la instanciación de los 4 perfiles y recibir los primeros chunks binarios directos desde `scrcpy-server`.

| Preset | Estado de Conexión | Primer Chunk (SPS/PPS) | Segundo Chunk (I-Frame) | Resultado Backend |
| :--- | :--- | :--- | :--- | :--- |
| `thumbnail` | OK | 28 bytes | 1410 bytes | Funciona |
| `eco` | OK | 28 bytes | 3232 bytes | Funciona |
| **`balanced`** | OK | 29 bytes | 5074 bytes | Funciona |
| `pro` | OK | 29 bytes | 8299 bytes | Funciona |

*Nota: Todos los perfiles entregaron correctamente el header SPS/PPS (28-29 bytes) seguido de un frame inicial proporcional a la calidad solicitada.*

---

### Análisis y Conclusión

**Causa probable del historial de falla:**
Históricamente, `.48` fallaba en `balanced`. Dado que el servidor backend actualmente sí está extrayendo y sirviendo los frames H.264 Annex-B sin colgarse, la causa probable anterior era:
1. Un remanente de MediaProjection interfiriendo con el encoder de hardware.
2. Un problema en el path de decodificación de `WebCodecs` en el cliente si la resolución enviada no estaba bien alineada (aunque los chunks ahora fluyen sanamente).

**Estado de Recuperación Visual:**
* **Preset que funciona:** Todos fluyen a nivel de backend (incluido `balanced`).
* **Preset que falla:** Ninguno falla a nivel de extracción y transmisión TCP/WS.
* **Focus/Grid recuperaron imagen:** `[!] Pendiente de validación humana en UI`.
* **Coordenadas visuales:** `[!] Pendiente de validación humana en UI`.

**Conclusión final:**
Desde la perspectiva de la arquitectura de Control y Backend, `.48` está extrayendo video H.264 con éxito total. **ES APTO para Rollout completo** siempre y cuando el usuario confirme que Electron dibuja correctamente estos chunks sanos en la pantalla de Focus/Grid sin artefactos visuales.
