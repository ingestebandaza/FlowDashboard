# Pre-Check de Hotfix (Runtime Manager)

## Evidencia de Fallo (Stdio en Spawn)

**Línea exacta de fallo:** `electron-app/src/main/runtime-manager.js:348`

**Fragmento de código:**
```javascript
325: const stdout = fs.createWriteStream(`${logPrefix}.out.log`, { flags: 'a' });
326: const stderr = fs.createWriteStream(`${logPrefix}.err.log`, { flags: 'a' });
...
343: child = spawn(command.command, command.args, {
344:   cwd: command.cwd,
345:   env,
346:   detached: false,
347:   windowsHide: true,
348:   stdio: ['ignore', stdout, stderr]
349: });
```

**Estado del WriteStream y su FD:**
El error síncrono arrojado es: `The argument 'stdio' is invalid. Received WriteStream { fd: null... }`. 
Esto ocurre porque `fs.createWriteStream` en Node.js es asíncrono en su apertura a nivel del SO. Al pasarlo directamente a `stdio` antes de que emita el evento `'open'`, su `fd` es `null`, lo que viola el requerimiento estricto de `child_process.spawn`.

## Estado de Auto-Arranque

**Valor de FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART:**
El launcher `abrir_electron.ps1` inyecta `$env:FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART = "1"`.
Sin embargo, en `runtime-manager.js:151`, se sobrescribe ciegamente:
```javascript
env.FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART = '1';
```
Pero este flag solo se le pasa al proceso hijo. El propio `RuntimeManager` no respeta la variable para abortar su propia fase de `start()`. 
En `start()` llama incondicionalmente a:
```javascript
await this.ensureSidecar('csharp', env);
await this.ensureSidecar('python', env);
```
En `ensureSidecar` llama a `requestJson(sidecar.healthUrl)`. Como `abrir_electron.ps1` acababa de lanzar los procesos en background y tardan 1-2 segundos en responder a HTTP, `health.ok` da falso. Acto seguido, en vez de reintentar si el flag está activo, llama a `this.spawnSidecar(...)`, provocando el crash de Node.js.

## Propiedad de Procesos (PIDs y Shutdown)

**PIDs creados por abrir_electron.ps1:**
Se instancian en background (Process ID de SO), no atados a Node.js.

**PIDs creados por RuntimeManager:**
`sidecar.pid = null` porque el spawn falla. Sin embargo, el estado queda marcado como `failed`.

**Mecanismo de terminación:**
En `runtime-manager.js:464` (función `shutdown()`):
```javascript
try {
  if (sidecar.port) {
    killProcessByPort(sidecar.port);
  }
} catch (error) { ... }
```
El `RuntimeManager` mata a **cualquier dueño** del puerto 5000 y 8765.

**Prueba de qué proceso mata a cuál:**
1. `abrir_electron.ps1` crea PID A (C# en puerto 5000) y PID B (Python en puerto 8765).
2. Electron inicia. `RuntimeManager` intenta crear PID C y PID D pero crashea por `stdio`.
3. Electron muestra diálogo de error y, al cerrarse (por usuario o auto-exit), llama a `shutdown()`.
4. `shutdown()` ignora si él mismo creó a PID A y B, solo busca quién usa los puertos.
5. `RuntimeManager` (Node.js) asesina a PID A y PID B.
Resultado: Todo muere por un falso sentido de propiedad.
