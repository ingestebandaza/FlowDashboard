# Evidencia de Aceptación (Fase 8)

* Instalador `FlowDashboard-Setup-2.0.0.exe`: **No existe**.
* SHA-256: **No existe**.
* Latest build unpacked: Existe carpeta local (`win-unpacked`), sin evidencia formal.
* Instalación en Windows limpio: **No verificado**.
* Arranque sin Python: **No**. Todavía se está utilizando el `python.exe` nativo de desarrollo del usuario.
* Arranque sin .NET: El binario de C# está construido, pero no se ha probado en un sistema virgen sin dependencias instaladas localmente en el SO.
* Arranque sin Node: La app está en `.exe` de Electron, pero el launcher usa `npm.cmd` si falla la resolución.
* Accesos directos: **No generados**.
* Sidecars: Implementados, pero el test falló (bug de Node.js y muerte por Electron).
* Health: Fallido.
* Grid / Focus / Control: **Sin pruebas post-fase 8**.
* Secret scan: **Sin evidencia**.

**Estado Final de Fase 8**: PARTIAL / ACCEPTANCE_NOT_VERIFIED
