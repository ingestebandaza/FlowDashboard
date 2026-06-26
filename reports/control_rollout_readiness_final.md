# Control Rollout - Readiness Final

**Fecha:** 2026-06-10

## 1. Dispositivos Aprobados (`scrcpy_control`)
Los siguientes 10 dispositivos han pasado pruebas exitosas (aisladas y recurrentes) validando el uso de `scrcpy_control` como motor principal de inyección de toques y teclas, sin dependencias de APK, FlowAgent, Accesibilidad o MediaProjection:
- `192.168.1.43:5555`
- `192.168.1.44:5555`
- `192.168.1.45:5555`
- `192.168.1.46:5555`
- `192.168.1.47:5555`
- `192.168.1.49:5555`
- `192.168.1.50:5555`
- `192.168.1.51:5555`
- `192.168.1.52:5555`
- `192.168.1.53:5555`

## 2. Dispositivos ADB-Only (Excepciones)
- `192.168.1.48:5555`: **scrcpy_control silent failure**. El socket y el video funcionan (retorna `ok: true`), pero la inyección real es bloqueada por el sistema. Require `adb_input` por defecto de manera forzada. Queda excluido del alcance del rollout normal.

## 3. Dispositivos Offline / No Validados
- `.54` a `.60`: Offline o inalcanzables actualmente. Quedan excluidos del rollout.

## 4. Estado Global de MediaProjection
Previo al rollout completo, se garantiza que `dumpsys media_projection` retornará `null` en todos los dispositivos aptos, debido a la purga y diagnósticos anteriores. Ninguna acción del Rollout encenderá este permiso, ya que se evitan flujos de OCR o MediaProjection.

## 5. Riesgos Pendientes
El riesgo primario es la saturación del servidor `local_adb_server.py` al levantar simultáneamente múltiples sesiones de `scrcpy-control`. La validación concurrente (Fase 3) demostró estabilidad, pero el volumen duplicará esa prueba (10 dispositivos simultáneos).
Además, se debe vigilar que ningún dispositivo presente el síndrome de fallo silencioso de `.48` durante la prueba.

## 6. Decisión Final de Alcance
**Rollout Completo Autorizado**. Se ejecutará la batería de validación de control puro, fallback ADB y revisión de sesiones estrictamente sobre los 10 dispositivos aprobados listados en la Sección 1.
Cualquier desviación (sesiones múltiples, procesos huérfanos, MediaProjection activa) abortará la prueba inmediatamente.
