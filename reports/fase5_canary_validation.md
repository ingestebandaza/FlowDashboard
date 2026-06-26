# Validación Canario `.43` (FASE 5)

Esta validación se realizó estrictamente bajo las 11 condiciones de aislamiento, probando el dashboard y backend sobre el dispositivo `192.168.1.43:5555`.

### 1. Arranque y Baseline
Se inició `abrir_electron.bat`, lo que levantó ADB (usando estrictamente `scrcpy-win64-v4.0\adb.exe`) y los servidores C# / Python.
El servidor detectó e instaló correctamente el monolito `agent-v1.0.0-universal.apk`:
```text
package:/data/app/com.flowlogin.agent-WcYI5NzCn1dTRdqnyk64bw==/base.apk
versionCode=105 minSdk=24 targetSdk=36
versionName=1.0.0
```

Se verificó el estado de captura inicial:
`MEDIA PROJECTION MANAGER (dumpsys media_projection) Media Projection: null`

### 2. Validaciones Funcionales UI (Control Puro)
Ejecución sobre `/control/tap`:
```json
{ "ok": True, "profile": "control", "method": "scrcpy_control", "fallbackUsed": False, "serial": "192.168.1.43:5555", "latencyMs": 311 }
```

Ejecución sobre `/control/swipe`:
```json
{ "ok": True, "profile": "control", "method": "scrcpy_control", "fallbackUsed": False, "serial": "192.168.1.43:5555", "latencyMs": 560 }
```

Ejecución sobre `/control/keyevent` (home):
```json
{ "ok": True, "profile": "control", "method": "scrcpy_control", "fallbackUsed": False, "serial": "192.168.1.43:5555", "latencyMs": 208 }
```

**Resultado**: Todas inyectan mediante inyección binaria veloz en el proceso local del servidor Python, el daemon ADB y scrcpy no sufren caídas. `dumpsys media_projection` siempre reportó `null`.

### 3. Validación de Fallback Explícito (preferScrcpy=false)
Ejecutando tap explícitamente forzando fallback a Input de ADB normal:
```json
{ "ok": True, "profile": "control", "method": "adb_input", "fallbackUsed": True, "serial": "192.168.1.43:5555", "latencyMs": 525 }
```
**Resultado**: Funciona perfectamente y sin iniciar captura.

### 4. Automatización vs Control
Se invocó `/flowagent/setup-smart` explícitamente y comprobamos `AccessibilityServiceUsher`:
```text
5 : com.flowlogin.agent/org.autojs.autojs.core.accessibility.AccessibilityServiceUsher
```
Y el estado del socket `/agents`:
```text
@{agentId=95fd186385d0d5a4; address=127.0.0.1:3228; ... }
```
**Resultado**: Automation mantiene un socket UDP/TCP conectado permanentemente y la Accesibilidad prendida. A pesar de esto, Control Manual siguió ruteando fielmente por `scrcpy-control`, sin usar FlowAgent como motor falso.

### 5. Inspector Normal
La llamada a `/inspector/dump` devolvió `{ ok: True }` y revalidamos `dumpsys media_projection`: seguía en `null`. No levantó OCR por error en Grid.

### 6. Pruebas Condicionadas (No Verificadas o Pendientes)
* **OCR Explícito**: Llamar a `/flowagent/ocr-detect` respondió `Solicitando permiso de captura. Acepta el dialogo en el telefono.` Esto verifica que está cableado, pero al no haber operario haciendo click en "Start Now", se marcó como abortado seguro, sin dejar fugas.
* **Grabación**: Como lo previmos, la grabación con `scrcpy --record` falla ocasionalmente en terminal puro, así que queda con el estado `[!] Recording pendiente / no operativo real` sin bloquear Control.

### 7. Sesiones Limpias
Antes y después, la lista de `/control/scrcpy-sessions` arrojó una única sesión activa para `.43`.
```text
available sessions
--------- --------
True {@{serial=192.168.1.43:5555; scid=646c395f; localPort=3139; pid=31624; screenSize=; startedAt=1781059150,6...
```
**Resultado**: No hay fugas de procesos ni scids huérfanos.

### Conclusión Final
El canario `.43` acepta exitosamente la dualidad de FlowAgent (Automation) y scrcpy-control (Control manual) demostrando la factibilidad total del modelo híbrido sin contaminar los permisos.
