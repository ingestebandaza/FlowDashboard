# Reporte de Ejecución - Baseline Cleanup MediaProjection Fleet

**Fecha:** 2026-06-10
**Alcance:** Limpieza controlada individual de la deuda de MediaProjection heredada por cierres incompletos de FlowAgent. No se instalaron APKs, no se actualizó nada y no se relanzó ningún agente de captura. Se excluyeron los dispositivos ya integrados al baseline o en Rollout.

| Serial | MediaProjection Pre | Package/UID | APK Version | PID Pre | Comando | MediaProjection Post | Resultado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `192.168.1.44:5555` | Activo | com.flowlogin.agent (uid=10305) | 1.0.0 (v105) | 29780 | `am force-stop com.flowlogin.agent` | `null` | ÉXITO |
| `192.168.1.51:5555` | `null` | N/A | N/A | N/A | Ninguno | `null` | Ignorado (Ya estaba limpio) |
| `192.168.1.52:5555` | `null` | N/A | N/A | N/A | Ninguno | `null` | Ignorado (Ya estaba limpio) |
| `192.168.1.54:5555` | Offline | N/A | N/A | N/A | Ninguno | Offline | Ignorado (Offline) |
| `192.168.1.55:5555` | Offline | N/A | N/A | N/A | Ninguno | Offline | Ignorado (Offline) |
| `192.168.1.56:5555` | Offline | N/A | N/A | N/A | Ninguno | Offline | Ignorado (Offline) |
| `192.168.1.57:5555` | Offline | N/A | N/A | N/A | Ninguno | Offline | Ignorado (Offline) |
| `192.168.1.58:5555` | Offline | N/A | N/A | N/A | Ninguno | Offline | Ignorado (Offline) |
| `192.168.1.59:5555` | Offline | N/A | N/A | N/A | Ninguno | Offline | Ignorado (Offline) |
| `192.168.1.60:5555` | Offline | N/A | N/A | N/A | Ninguno | Offline | Ignorado (Offline) |

**Observaciones:**
* El dispositivo `.44`, que había sido apartado en Rollouts anteriores por presentar `MediaProjection` enganchado, fue purgado de manera exitosa y ahora cuenta con el baseline a `null`.
* Los dispositivos `.51` y `.52` confirmaron que preservan el baseline a `null` de las purgas previas de su respectivo Rollout.
* Los dispositivos `.54` al `.60` se encuentran desconectados/offline por el momento.
* **Toda la flota disponible y conectada tiene ahora un baseline limpio y verificado de MediaProjection.**
