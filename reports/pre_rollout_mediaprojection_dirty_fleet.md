# Diagnóstico Pre-Rollout: Flota con MediaProjection Sucio

**Fecha:** 2026-06-10
**Objetivo:** Diagnosticar por qué la flota no era apta para iniciar Rollout 2 en estado limpio.

### 1. Lista de Seriales Revisados
Se revisaron 10 dispositivos del pool disponible, excluyendo a los canarios ya aprobados (`.43` y `.53`):
* `192.168.1.44:5555`
* `192.168.1.45:5555`
* `192.168.1.46:5555`
* `192.168.1.47:5555`
* `192.168.1.48:5555`
* `192.168.1.49:5555`
* `192.168.1.50:5555`
* `192.168.1.51:5555`
* `192.168.1.52:5555`
* `192.168.1.54:5555` (Desconectado/Offline)

### 2. Estado MediaProjection
* **Dispositivos con `MediaProjection` = `null`:** Ninguno de la lista viva.
* **Dispositivos con `MediaProjection` Activo:** `.44`, `.45`, `.46`, `.47`, `.48`, `.49`, `.50`, `.51`, `.52`.
* **Package dueño:** `com.flowlogin.agent` (e.g. `uid=10328` en `.45`, `uid=10298` en `.46`, etc.).

### 3. Estado de FlowAgent
* **¿FlowAgent está vivo?** El comando `pidof com.flowlogin.agent` no arrojó respuesta contundente, pero la inspección del backend indica que el agente está desconectado.
* **¿Hay socket `/agents` activo?** **NO**. El endpoint `/agents` solo reporta activo al `.43:5555`. Los dispositivos del `.44` al `.52` NO tienen conexión viva con el backend.
* **¿Hay icono visible de captura?** Dada la falta de conexión y que el proceso está "zombie", es probable que el icono de captura de Android siga permanentemente encendido en la barra de notificaciones del teléfono sin enviar frames reales.

### 4. Conclusión Probable
Los dispositivos formaron parte de una prueba masiva previa (posiblemente la validación del "OCR o Captura constante en el viejo FlowAgent" o la "Fase 7 Monolito PRO"). Durante esa prueba, se solicitó MediaProjection.
Posteriormente, el servidor se reinició o los sockets murieron, pero a nivel Android, `com.flowlogin.agent` nunca ejecutó un `capture_screen_stop()` ni un teardown limpio (`stopService` o `onDestroy` del `MediaProjection`).
Como resultado, el sistema operativo (Android 9) sigue manteniendo vivo el UID del agente creyendo que está capturando, bloqueando cualquier estado limpio futuro.
**Solución requerida:** Se necesita purgar el proceso manualmente (`am force-stop`) para liberar el token de MediaProjection a nivel del OS.
