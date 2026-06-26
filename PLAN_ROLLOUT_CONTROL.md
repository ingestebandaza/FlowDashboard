# Plan de Rollout Gradual - Perfil Control (scrcpy-control)

## 1. Restore Point Previo al Rollout
Antes de tocar cualquier dispositivo adicional, se ha creado el siguiente restore point real:
* **Ruta:** `C:\DASHBOARD\FlowDashboard\restore_points\2026-06-10_PRE_ROLLOUT_CONTROL`
* **Archivos Incluidos:** `local_adb_server.py`, `scrcpy_control_channel.py`, `flow-touch.js`, `app.js`, `PROJECT_CONTEXT.md`, `TASKS_MONOLITO_PRO.md`, `DOCUMENTACION_TECNICA.md`, `AGENTS.md`, `PLAN_ROLLOUT_CONTROL.md`.

## 2. Estado Actual (Baseline Aprobado en `.43`)
El dispositivo `192.168.1.43:5555` funciona como estándar de oro para el despliegue:
* **Motor Control**: `scrcpy_control` (Tap, Swipe, KeyEvent).
* **Fallback**: `adb_input` funciona correctamente.
* **Automation**: FlowAgent convive aisladamente, no contamina Control.
* **Permisos**: MediaProjection apagado para Focus/Grid/Control.
* **Estabilidad**: 1 sola sesión de scrcpy, sin processos huérfanos.

## 3. Criterios para Elegir el Siguiente Dispositivo Canario
El primer dispositivo adicional (Rollout 1) debe ser:
* Un dispositivo con la pantalla encendida y accesible.
* De preferencia un modelo, resolución o versión de Android distinto al `.43` para validar consistencia de coordenadas y rotación.
* Que no tenga sesiones críticas o cuentas en estado delicado actualmente ejecutándose.

## 4. Fase Rollout 1: 1 Dispositivo Adicional
* Seleccionar 1 solo dispositivo de la flota.
* Aplicar Comandos de Limpieza Previa y Diagnóstico APK (Sección 9.A y 9.B).
* Ejecutar Validación de Coordenadas y Rotación (Sección 9.C).
* Ejecutar Validación de Control Puro (Sección 9.D).
* Confirmar resultados según tabla esperada (Sección 10).
* (Opcional) Ejecutar Validación de Onboarding / Automation (Sección 9.E).
* Si falla cualquier criterio de parada, detener inmediatamente.

## 5. Fase Rollout 2: 3 Dispositivos Adicionales
* Si Rollout 1 es exitoso, seleccionar un bloque de 3 dispositivos.
* Repetir la batería de validación para cada uno secuencialmente.
* Verificar carga concurrente y no interferencias cruzadas en `/control/scrcpy-sessions`.

## 6. Fase Rollout 3: 5 Dispositivos Adicionales
* Si Rollout 2 es exitoso, seleccionar 5 dispositivos y validarlos de forma secuencial.
* Luego, si todo pasa, realizar una prueba concurrente controlada.
* Durante la prueba concurrente, vigilar de cerca CPU/RAM, sesiones, puertos activos y estabilidad general de Electron.

## 7. Flota Completa y Escalabilidad Comercial
* Solo si las Fases 1, 2 y 3 pasan limpiamente y sin excepciones, se procederá a abarcar la flota entera disponible.
* **Escalabilidad comercial y descubrimiento dinámico de dispositivos:**
  * `.43-.60` es solo el rack local de pruebas de Esteban.
  * El producto final debe funcionar con cualquier cantidad de teléfonos.
  * Los dispositivos pueden conectarse por USB o WiFi.
  * Los rangos de red deben ser configurables.
  * Los dispositivos offline son estados temporales, no fallos.
  * Los perfiles deben asignarse dinámicamente por serial detectado.
  * No debe haber lógica comercial hardcodeada a `192.168.1.x`.
  * No debe decirse que `.54-.60` están fuera del producto, solo fuera de esta sesión de validación local.
* **Nota Histórica sobre `.48`:**
  * Inicialmente, `.48` devolvía `ok:true` con `scrcpy_control` pero no tenía efecto real, por lo que fue marcado temporalmente como ADB-only.
  * Tras implementar el fix del *Dummy Byte* para el socket handshake de scrcpy, `.48` fue reprobado y validado exitosamente. Ahora funciona con `scrcpy_control` y Live Touch sin restricciones. Ya no forma parte de ninguna excepción.

---

## 8. Criterios de Parada Inmediata
Cualquiera de los siguientes eventos obliga a detener el rollout y revertir/investigar:
> [!CAUTION]
> 1. Aparece icono de `MediaProjection` en Control/Grid/Focus.
> 2. El Control cae o muta a inyección vía `FlowAgent`.
> 3. Se crean sesiones duplicadas o `scid` huérfanos en `/control/scrcpy-sessions`.
> 4. Se detectan procesos huérfanos o zombies de `scrcpy-server` / `app_process` en el dispositivo.
> 5. Tap/swipe se descalibra (coordenadas erróneas, inversión X/Y).
> 6. Problemas de rotación/orientación (clics desplazados tras voltear el dispositivo).
> 7. El Onboarding instala o actualiza el APK en un dispositivo donde no debe (ya lo tenía).
> 8. ADB fallback (`preferScrcpy=false`) falla.
> 9. Electron se vuelve inestable, lento o se cuelga.

---

## 9. Comandos Exactos de Validación para cada Dispositivo

### A. Limpieza Previa y Post
Ejecutar antes y después de interactuar con cada `<SERIAL>`:
```powershell
$adb = "c:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe"
Invoke-RestMethod -Uri http://127.0.0.1:8765/control/scrcpy-sessions -Method Get
& $adb -s <SERIAL> shell dumpsys media_projection
& $adb -s <SERIAL> forward --list
& $adb -s <SERIAL> shell ps -A | Select-String "app_process|scrcpy"
```

### B. Diagnóstico APK (Sin Mutación)
Antes de llamar a cualquier setup, reportar el estado actual del dispositivo:
```powershell
& $adb -s <SERIAL> shell pm path com.flowlogin.agent
& $adb -s <SERIAL> shell dumpsys package com.flowlogin.agent | Select-String "version"
& $adb -s <SERIAL> shell dumpsys accessibility | Select-String "com.flowlogin.agent"
& $adb -s <SERIAL> shell ime list -a | Select-String "flow"
```

### C. Validación de Coordenadas y Rotación
Verificar el canvas dinámico antes de los taps:
```powershell
& $adb -s <SERIAL> shell wm size
& $adb -s <SERIAL> shell wm density
& $adb -s <SERIAL> shell dumpsys input | Select-String "SurfaceOrientation"
```
Hacer 3 taps manuales a través de `scrcpy_control` en zonas seguras (Centro, Superior, Inferior) y observar si el tap ocurre en el sitio exacto sin inversión.

### D. Validación de Control Puro y Fallback (Scrcpy)
Se ejecutan SIN preparar FlowAgent previamente:
```powershell
$tap = @{ serial = "<SERIAL>"; x = 500; y = 500; preferScrcpy = $true } | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:8765/control/tap -Method Post -Body $tap -ContentType "application/json"

$swipe = @{ serial = "<SERIAL>"; startX = 500; startY = 1500; endX = 500; endY = 500; preferScrcpy = $true } | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:8765/control/swipe -Method Post -Body $swipe -ContentType "application/json"

$home = @{ serial = "<SERIAL>"; name = "home"; preferScrcpy = $true } | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:8765/control/keyevent -Method Post -Body $home -ContentType "application/json"

$tap_fb = @{ serial = "<SERIAL>"; x = 500; y = 500; preferScrcpy = $false } | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:8765/control/tap -Method Post -Body $tap_fb -ContentType "application/json"
```

### E. Validación Opcional de Onboarding / Automation
Solo si el dispositivo está autorizado, no tiene tarea crítica y se comprobó que el motor Control ya funciona aislado:
```powershell
$setup = @{ deviceIds = @("<SERIAL>"); requestCapture = $false } | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:8765/flowagent/setup-smart -Method Post -Body $setup -ContentType "application/json"
# Si APK faltaba: instala y levanta socket.
# Si APK ya existía: NO reinstala, NO desinstala, solo diagnostica y conecta.
```

---

## 10. Tabla Esperada de Resultados por Dispositivo

| Métrica / Prueba | Valor Esperado Obligatorio | Comportamiento si falla |
| :--- | :--- | :--- |
| `dumpsys media_projection` (Pre/Post) | `null` | **PARADA INMEDIATA** |
| `/control/scrcpy-sessions` | 1 sola sesión activa por dispositivo | **PARADA INMEDIATA** |
| `ps -A \| Select-String "app_process"` | No procesos huérfanos acumulados por tap | **PARADA INMEDIATA** |
| `wm size` y Coordenadas Visuales | Tap coincide en UI, sin inversión | **PARADA INMEDIATA** |
| `/control/tap` (`preferScrcpy=true`) | `method: scrcpy_control`, `fallbackUsed: False` | **PARADA INMEDIATA** |
| `/control/tap` (`preferScrcpy=false`) | `method: adb_input`, `fallbackUsed: True`, `routingReason: preferScrcpy_false` | **PARADA INMEDIATA** |
| `/flowagent/setup-smart` (Opcional) | No muta `scrcpy_control`, no activa captura | **PARADA INMEDIATA** |
| Diagnóstico APK | Instalación solo si NO existía previamente | **PARADA INMEDIATA** |
