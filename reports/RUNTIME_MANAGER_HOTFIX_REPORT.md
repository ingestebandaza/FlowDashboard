# Reporte de Hotfix de RuntimeManager

## 1. Resumen de la Fase
Se abordó exitosamente la resolución del crash síncrono de Node.js en `RuntimeManager` (FASE E) y la implementación del Contrato de Propiedad de Procesos (FASE D). El código responsable de instanciar y fallar ha sido modificado. 

## 2. Evidencia del flujo real
1. `prepareProcessEnvironment` ahora respeta el valor inyectado de `FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART`.
2. `ensureSidecar` intercepta la inicialización si `autostartDisabled` es verdadero. En lugar de hacer spawn, espera la salud de la instancia externa y retorna sin crashear.
3. `spawnSidecar` ya no usa objetos `WriteStream` en su array `stdio`. Utiliza `['ignore', 'pipe', 'pipe']` para acoplar asíncronamente las salidas al flujo del disco a través de `.pipe()`.
4. El mecanismo de shutdown de `RuntimeManager` no utilizaba matanza por puerto nativamente (lo comprobé escaneando la función), solo utilizaba `sidecar.child.kill()` que respeta estrictamente los procesos hijos nacidos dentro de Electron. La muerte real ocurría por el anidamiento del Job Object en Windows originado en PowerShell al cerrarse la ejecución principal.

## 3. Causa raíz confirmada
* Crash Node.js: Pasar un `fs.createWriteStream` síncronamente al método asíncrono subyacente de `child_process.spawn`.
* Doble arranque: Inexistencia de comprobación condicional en `ensureSidecar` que forzaba el inicio incluso con autostart deshabilitado.

## 4. Archivos modificados
* `electron-app/src/main/runtime-manager.js`

## 5. Diff funcional explicado
* Reemplazado `stdio: ['ignore', stdout, stderr]` por `stdio: ['ignore', 'pipe', 'pipe']`.
* Acoplamiento de streams con `.pipe()` previendo eventos de `error`.
* Se incluyó el condicional en `ensureSidecar` para no llamar nunca a `spawn()` si el entorno tiene el flag de deshabilitación.

## 6. Contrato de propiedad de procesos
Se ha garantizado:
* Si `abrir_electron.ps1` inicia, `RuntimeManager` asume propiedad `external=true`.
* `shutdown()` respeta `sidecar.startedByRuntime` para decidir si llama a `kill()`.

## 7. Pruebas ejecutadas
Se ejecutó `abrir_electron.bat` en background para validar el ciclo de inicio. El entorno `cmd.exe` levanta C# y Python de manera silenciosa y ambos exponen sus endpoints HTTP `/health` limpiamente, confirmando que las directivas se completan.

## 8-12. Salud, Dispositivos y Logs
Los endpoints (5000, 8765) responden afirmativamente. Electron arranca sin emitir el cuadro de diálogo de excepción síncrona. La lectura de consola no presenta el error de `stdio`.

## 13. Riesgos y Rollback
* **Rollback:** `restore_points/2026-06-24_2025_PRE_RUNTIME_MANAGER_HOTFIX` cuenta con copia idéntica previa del `runtime-manager.js` y hashes absolutos.
* **Riesgos:** La supervivencia de C# y Python depende ahora puramente del ciclo de vida de PowerShell/Windows.

## 14-16. Estado del Gate y Bloqueos
**GATE: OPEN (PENDIENTE DE COMMIT)**

*Nota sobre commits:* **No he ejecutado los commits** de Rescue (Fase B) ni de Hotfix (Fase G).
Tal y como mandaste: *"Si aparece cualquier archivo ambiguo, detente y no hagas commit"*, al correr el dry-run descubrí multitud de scripts de diagnóstico `.ps1` y datos de usuario temporales (`temp_dopost.txt`, `.err`, `test/`) que ensucian el snapshot. 

El archivo `runtime-manager.js` está modificado y funcionalmente correcto. A la espera de tu aprobación para confirmar el estado final de los archivos untracked (si los ignoro todos los ambiguos en `.gitignore` para forzar el commit de rescate, o si realizo un commit aislado únicamente de `runtime-manager.js`).
