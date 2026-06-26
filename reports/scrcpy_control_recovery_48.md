# Recuperación de `scrcpy-control` en `192.168.1.48:5555`

**Fecha:** 2026-06-10
**Dispositivo:** `192.168.1.48:5555`

## 1. Estado Inicial (Antes de la recuperación)
- **MediaProjection:** `null` (Limpio)
- **Procesos en dispositivo:** `app_process` (PID 4841) corriendo, inyectado por scrcpy.
- **Sesión backend:** Sesión activa con `scid: "4c1db539"`, `pid: 28712`.
- **Prueba `scrcpy_control` (`preferScrcpy=true`):** Retornó `ok: true`, pero **sin efecto visual** (el dispositivo se quedó en `Ajustes`).
- **Prueba `adb_input` (`preferScrcpy=false`):** Retornó `ok: true`, y **con efecto visual exitoso** (volvió a `LauncherActivity`).

## 2. Procedimiento de Reinicio Controlado
Para evitar tocar toda la flota y aislar el problema en `.48`, se ejecutó lo siguiente:
1. `Stop-Process -Id 28712` (Se mató el proceso local de scrcpy que mantenía el socket de `.48`).
2. `adb -s 192.168.1.48:5555 shell killall app_process`
3. `adb -s 192.168.1.48:5555 shell kill -9 4841` (Asegurando la destrucción del demonio interno).
4. Verificación de limpieza: `ps -A | grep app_process` no retornó nada.

## 3. Estado Post-Recuperación (Nueva Sesión)
Al enviar el siguiente comando, el backend Python automáticamente levantó una nueva sesión scrcpy para `.48`.
- **MediaProjection:** Sigue `null`.
- **Nueva Sesión:** `scid: "3197549a"`, `pid: 2008`.

## 4. Resultados de Inyección Post-Recuperación
Se colocó el teléfono nuevamente en la app `Ajustes` (`com.android.settings`).

- **Prueba `/control/keyevent` (home) con `preferScrcpy=true`:**
  - JSON devuelto: `ok: true`, `method: "scrcpy_control"`.
  - **Efecto visual:** NINGUNO. `mCurrentFocus` se mantuvo en `com.android.settings`.

- **Prueba `/control/keyevent` (home) con `preferScrcpy=false` (Fallback ADB):**
  - JSON devuelto: `ok: true`, `method: "adb_input"`.
  - **Efecto visual:** ÉXITO. `mCurrentFocus` cambió inmediatamente a `com.sec.android.app.launcher.activities.LauncherActivity`.

## 5. Conclusión
El proceso de reinicio limpio del demonio interno de `scrcpy` **no resolvió** el fallo silencioso. 

El servidor `scrcpy` en el dispositivo `.48` es capaz de iniciar correctamente, enlazar el socket, transmitir H.264, y aceptar comandos de control (devolviendo OK al backend local), pero **el sistema operativo de `.48` bloquea silenciosamente la inyección de eventos por `app_process`**. Esto probablemente se debe a una configuración de seguridad de fábrica del fabricante (ej. "Desactivar monitorización de permisos" u opciones avanzadas de depuración USB requeridas para inyectar toques), o una restricción de políticas de seguridad.

### Acción recomendada (Resultado B)
- Marcar `.48` como: `[!] scrcpy_control socket OK pero inyección real fallida; usar adb_input por defecto`.
- **Excluir `.48`** del Rollout completo de `scrcpy-control`, a menos que se fuerce el flag de `adb_input` por perfil para este dispositivo.
