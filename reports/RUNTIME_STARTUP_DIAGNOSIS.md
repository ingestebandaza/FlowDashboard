# Diagnóstico del Arranque del Runtime

## Launcher
* Cadena real: `abrir_electron.bat` invoca `abrir_electron.ps1`.
* Directorio de trabajo: `C:\DASHBOARD\FlowDashboard`
* Variables de entorno: `FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART = 1`.
* Comandos ejecutados: Invoca a PowerShell. PowerShell ejecuta procesos hijos para C#, Python y Electron usando `Start-Process -WindowStyle Hidden` y `-WindowStyle Normal`.
* Códigos de salida: Termina limpiamente (exit 0) pero no mantiene el estado.

## Python
* Comando exacto: `Start-Process -FilePath python.exe -ArgumentList "-u local_adb_server.py"`
* Ejecutable utilizado: `C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe`
* Ruta: `local_adb_server.py`
* Stdout/Stderr: Inicializa correctamente.
* PID: Aislable si se ejecuta manualmente.
* Código de salida / Excepción: Ninguna en ejecución independiente.
* Puertos: 8765 y 8768 listos (en modo diagnóstico puro).
* `/health`: Retorna OK.
* **Clasificación**: Proceso inicia y termina. Mueren por arrastre tras finalizar la consola del launcher o por limpieza en Electron.

## C#
* Comando exacto: `Start-Process -FilePath FlowDashboard.Core.exe`
* Ejecutable utilizado: `FlowDashboard.Core\bin\Release\net8.0\FlowDashboard.Core.exe`
* Stdout/Stderr: Inicializa correctamente.
* PID: Aislable si se ejecuta manualmente.
* Código de salida / Excepción: Ninguna.
* Puertos: 5000 listo.
* `/api/health`: Retorna OK.
* **Clasificación**: Proceso inicia y termina.

## Electron
* Comando exacto: `electron.exe . --disable-http-cache --user-data-dir=...`
* PID: Terminado.
* Stdout/Stderr: Falla interna por Node.js child_process.
* BrowserWindow: Abre, pero muestra diálogo de error del `RuntimeManager`.
* Motivo de terminación: Error síncrono `The argument 'stdio' is invalid. Received WriteStream { fd: null }` arrojado por `spawn` de Node.js al intentar crear los procesos hijos y usar un descriptor `fs.createWriteStream` aún no abierto.
* Cierre provocado por Electron: Sí. Al fallar el arranque interno, y luego cerrarse Electron o su ventana de advertencia, `RuntimeManager.shutdown` entra y asesina por puerto a los backends que el script `.ps1` había arrancado previamente de forma externa.

## Sistema
* Clasificación de cada fallo:
  - Error de Node.js (Configuración inválida de streams en `spawn`) => Falla Electron.
  - Cierre provocado por Electron => Destruye los sidecars válidos levantados por `abrir_electron.ps1`.
  - Proceso inicia y termina => Comportamiento final de C# y Python que nacen sanos pero mueren asesinados.
