# Informe de cierre FASE 6 — Backend C# self-contained

## 1. Objetivo
Verificar que el backend C# (`FlowDashboard.Core`) se publica self-contained
(win-x64) sin requerir .NET instalado en la maquina cliente, preservando MailKit,
SignalR, DPAPI, controladores, servicios y el helper FlowMail, escuchando solo en
loopback y reportando la version unificada 2.0.0.

## 2. Alcance
- `scripts/build/build-dotnet.ps1`
- `FlowDashboard.Core/FlowDashboard.Core.csproj`
- `FlowDashboard.Core/Program.cs` (CORS, bind, health)
- `FlowDashboard.Core/Services/MailService.cs` (DPAPI, mail_config, FlowMail helper)
- `FlowDashboard.Core/Services/AppPaths.cs` (DATA_DIR)
- salida publicada en `build/runtime/dotnet/`

## 3. Estado inicial
Publicacion self-contained ya existente (build del 23/06). Codigo ya cumplia el
contrato. No se detectaron inconsistencias que requirieran cambios.

## 4. Cambios realizados
Ninguno. Verificacion sin modificaciones de codigo. No se crea restore point
(no se altero codigo).

## 5. Verificacion runtime
- `build/runtime/dotnet/` contiene runtime self-contained completo: `coreclr.dll`,
  `hostfxr.dll`, `hostpolicy.dll`, `System.Private.CoreLib.dll`, `FlowDashboard.Core.exe`
  + `.dll` (342 archivos, ~115 MB). No requiere .NET del sistema.
- `/api/health` en ejecucion devuelve: `status:ok`, `version:2.0.0`,
  `service:FlowDashboard.Core`, `productMode:false` (dev), `baseDir` repo,
  `dataDir:scratch\flowdashboard-data-runtime`, `adb.path` = `scrcpy-win64-v4.0\adb.exe`.

## 6. Pruebas en dispositivos
ADB disponible (`adb.available:true`, ruta empaquetada). Endpoints de dispositivos
operativos vias backend en ejecucion (features adb_devices, adb_wifi_scan,
scrcpy_native_streaming, live_device_grid). Componentes de control/streaming intactos.

## 7. Hallazgos y correcciones
Sin hallazgos que requieran correccion. La publicacion y el codigo cumplen el
contrato de FASE 6.

## 8. Componentes protegidos
Intactos. No se modifico ScrcpyService, VideoStreamingService,
StreamingWebSocketService, hubs SignalR ni el pipeline de video. No se toco
`scrcpy-win64-v4.0/`.

## 9. Coherencia codigo / runtime / documentacion
- Publicacion: `build-dotnet.ps1:51-59` usa `--self-contained true -r win-x64` con
  `PublishSingleFile=false`, `PublishTrimmed=false`, `PublishReadyToRun=false`,
  `PublishAot=false` (coincide con "no activar inicialmente").
- El script valida markers self-contained (`:69-81`) y que `mail_config.json` NO
  quede junto al exe (`:83-85`).
- Version unificada: csproj `Version/AssemblyVersion/FileVersion/InformationalVersion`
  = 2.0.0 (`csproj:6-9`); health lee `AssemblyInformationalVersion` con fallback
  2.0.0 (`Program.cs:9-11,201`).
- CORS limitado a la app local: `WithOrigins("http://localhost:*","file://")`
  (`Program.cs:18`).
- Escucha solo loopback: `app.Run("http://localhost:5000")` (`Program.cs:250`).
- DPAPI preservado: `ProtectedData.Protect/Unprotect` con `DataProtectionScope.CurrentUser`
  (`MailService.cs:498,505`).
- `mail_config.json` en DataDir, no junto al exe: `_configPath = AppPaths.DataFile(...)`
  con migracion idempotente del legacy (`MailService.cs:28-30`).
- DATA_DIR via env: `AppPaths.ResolveDataDir()` env>ProductMode(LocalAppData)>BaseDir
  (`AppPaths.cs:44-62`).
- MailKit 4.17.0, SignalR, ProtectedData 8.0.0 presentes (`csproj:16,17,20`).

## 10. Riesgos
- Bajo: la salida self-contained pesa ~115 MB; aceptable para instalador comercial.
- CORS permite cualquier puerto localhost con credenciales; adecuado para app local
  Electron, sin exposicion a interfaces publicas (solo loopback).

## 11. Rollback
No aplica (sin cambios). Para regenerar la publicacion:
`scripts/build/build-dotnet.ps1 -Clean`.

## 12. Evidencias
- Inventario de `build/runtime/dotnet/` (coreclr/hostfxr/FlowDashboard.Core.exe).
- Salida JSON de `/api/health` (version 2.0.0, adb empaquetado, dataDir separado).
- `build-dotnet.ps1` con flags self-contained y validaciones.
- `csproj` versionado 2.0.0.

## 13. Configuracion y secretos
`mail_config.json` no se publica junto al exe (validado por el script y por el
codigo que usa DataDir). Secretos cifrados con DPAPI por usuario. No hay
credenciales en la salida self-contained.

## 14. Checklist de aceptacion
- [x] Publicacion self-contained win-x64 (sin .NET del sistema).
- [x] Sin trimming/AOT/single-file/ReadyToRun.
- [x] MailKit, SignalR, DPAPI, controladores y servicios preservados.
- [x] FlowMail helper invocado como exe (verificado en FASE 5 / MailService).
- [x] DATA_DIR via env; mail_config.json fuera del exe.
- [x] DPAPI mantenido (CurrentUser).
- [x] Health reporta version unificada 2.0.0.
- [x] CORS limitado a la app local; escucha solo loopback.
- [ ] Prueba en VM Windows limpia sin .NET (diferida a validacion de instalador, FASE 8).

## 15. Conclusion y siguiente fase
FASE 6 verificada y cerrada sin cambios de codigo. El backend C# se publica
self-contained, escucha solo en loopback, reporta version 2.0.0, mantiene DPAPI y
no guarda secretos junto al ejecutable. La prueba en VM limpia se consolidara al
validar el instalador. Siguiente: FASE 7 — Recursos comerciales (staging).
