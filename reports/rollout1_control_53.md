# Reporte de Ejecución - Rollout 1 (Control Puro)

* **Serial probado:** `192.168.1.53:5555`
* **Razón de elección:** Se eligió tras verificar que conectaba de forma transparente y poseía el estado base exigido por la Fase de Rollout 1.
* **Razón de descarte de `.44`:** Se descartó momentáneamente porque en la pre-verificación (`dumpsys media_projection`) reportó una sesión viva de captura de pantalla remanente, violando la regla del "estado limpio de origen". Quedó en espera de limpieza y diagnóstico futuro.
* **Estado inicial MediaProjection:** `null`
* **Estado inicial APK:** Instalado versión `1.0.0` (versionCode 105), con `AccessibilityServiceUsher` conectado por Android, y `FlowKeyboardService` persistido.
* **`wm size`:** `1080x1920`
* **`wm density`:** `480`
* **Orientación:** Normal (`SurfaceOrientation` no desviada).
* **Resultados Tap/Swipe/Keyevent:**
  * `/control/tap`: `ok: true`, `method: scrcpy_control`, `fallbackUsed: false`, `latencyMs: 208`
  * `/control/swipe`: `ok: true`, `method: scrcpy_control`, `fallbackUsed: false`, `latencyMs: 417`
  * `/control/keyevent`: `ok: true`, `method: scrcpy_control`, `fallbackUsed: false`, `latencyMs: 28`
  * Coordenadas físicas coincidieron correctamente con la inyección dinámica de la pantalla sin estar invertidas.
* **Resultado Fallback ADB (`preferScrcpy=false`):**
  * `/control/tap`: `ok: true`, `method: adb_input`, `fallbackUsed: true`, `latencyMs: 527`
* **Sesión `scrcpy-control`:** Activa exactamente 1 sesión por dispositivo (`scid 1d0300fa`, `port 9890`). Cero duplicados en el reporte local.
* **Procesos huérfanos:** `ps -A` no detectó zombies de scrcpy o `app_process` acumulándose en el sistema de Android 9.
* **Conclusión:** El dispositivo absorbió íntegramente las instrucciones de inyección directa binaria bajo `scrcpy-control` en latencias ultra-bajas; FlowAgent actuó como espectador inactivo, confirmando la convivencia de perfiles. MediaProjection nunca fue solicitado.
* **Decisión:** **Pasa a Rollout 2.**
