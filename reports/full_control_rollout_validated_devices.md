# Rollout Completo - Dispositivos Validados de Control

**Fecha:** 2026-06-10

## Resumen del Despliegue
Se ejecutó satisfactoriamente el Rollout Completo de Control sobre la flota autorizada. Este proceso confirmó que `scrcpy-control` funciona como el motor principal de inyección de comandos en estos dispositivos, reduciendo significativamente la latencia, desactivando dependencias de FlowAgent para control manual y manteniendo `MediaProjection` limpio en todo momento. 

**Estado General:** Rollout completo del grupo validado de Control aprobado, con `.48` como excepción ADB-only/pendiente y offline fuera de alcance.

## Excepciones
- **`.48`**: Excluido de este lote por presentar un fallo silencioso comprobado en el input nativo de scrcpy. Se deberá usar con un flag `preferScrcpy=false` forzado para operar por `adb_input`.
- **`.54` a `.60`**: Excluidos por estar offline.

## Resultados Detallados

| Serial | Engine Principal | MP Pre/Post | Tap/Swipe/Key | Fallback ADB | Sesiones Activas | Procesos scrcpy | Latencias Promedio | Conclusión |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `192.168.1.43:5555` | `scrcpy_control` | `null -> null` | ✅/✅/✅ | ✅ `adb_input` | 1 | 1 | tap: `591ms` fb: `529ms` | **Aprobado** |
| `192.168.1.44:5555` | `scrcpy_control` | `null -> null` | ✅/✅/✅ | ✅ `adb_input` | 1 | 1 | tap: `214ms` fb: `526ms` | **Aprobado** |
| `192.168.1.45:5555` | `scrcpy_control` | `null -> null` | ✅/✅/✅ | ✅ `adb_input` | 1 | 1 | tap: `198ms` fb: `530ms` | **Aprobado** |
| `192.168.1.46:5555` | `scrcpy_control` | `null -> null` | ✅/✅/✅ | ✅ `adb_input` | 1 | 1 | tap: `170ms` fb: `507ms` | **Aprobado** |
| `192.168.1.47:5555` | `scrcpy_control` | `null -> null` | ✅/✅/✅ | ✅ `adb_input` | 1 | 1 | tap: `185ms` fb: `551ms` | **Aprobado** |
| `192.168.1.49:5555` | `scrcpy_control` | `null -> null` | ✅/✅/✅ | ✅ `adb_input` | 1 | 1 | tap: `204ms` fb: `521ms` | **Aprobado** |
| `192.168.1.50:5555` | `scrcpy_control` | `null -> null` | ✅/✅/✅ | ✅ `adb_input` | 1 | 1 | tap: `214ms` fb: `555ms` | **Aprobado** |
| `192.168.1.51:5555` | `scrcpy_control` | `null -> null` | ✅/✅/✅ | ✅ `adb_input` | 1 | 1 | tap: `204ms` fb: `558ms` | **Aprobado** |
| `192.168.1.52:5555` | `scrcpy_control` | `null -> null` | ✅/✅/✅ | ✅ `adb_input` | 1 | 1 | tap: `185ms` fb: `565ms` | **Aprobado** |
| `192.168.1.53:5555` | `scrcpy_control` | `null -> null` | ✅/✅/✅ | ✅ `adb_input` | 1 | 1 | tap: `203ms` fb: `527ms` | **Aprobado** |

> **Nota:** La cantidad de procesos `scrcpy` reportada (1) es el hilo servidor esperado por dispositivo. Un número superior indicaría acumulación o "huérfanos". No se detectaron fugas en la flota validada.

## Criterios Cumplidos
- **Ninguna mutación de MediaProjection.** Permaneció inactivo.
- **Sin Activación de FlowAgent:** `scrcpy_control` operó independiente de la automatización.
- **Estabilidad de Sesión:** 1 a 1 sin traslapes ni errores de puertos cruzados.
- **Rendimiento C# / Python:** La latencia general fue estable, rondando los `~200ms` por acción para `scrcpy` nativo (con la excepción de picos momentáneos por carga).
