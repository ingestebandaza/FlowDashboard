# Handoff Monolito PRO

Ultima actualizacion: 2026-05-31

## Actualizacion 2026-06-09 - Separacion de perfiles + scrcpy docs

El dashboard queda dividido en perfiles:

- `control`: ADB + scrcpy raw H.264. Focus/Grid, taps/swipes y Back/Home/Recents no deben preparar FlowAgent, Accesibilidad ni MediaProjection.
- `automation`: FlowLogin, scripts JS, FlowKeyboard y comandos inteligentes usan FlowAgent/AutoJs6/AccessibilityServiceUsher solo por accion explicita.
- `inspector`: Tree/Nativo/Auto usan UIAutomator/CDP/Accessibility disponible; OCR solo en modo OCR/Hybrid.
- `ocr`: puede llamar `capture_screen_start(streamFrames=false)` bajo demanda y debe permitir `capture_screen_stop`.
- `recording`: implementado como accion manual. Usa scrcpy local con `--record`, `--no-window`, `--no-playback`, `--no-control`, guarda MP4 en `recordings/` y no usa MediaProjection.

Relectura scrcpy:
- Ya existe `informacion de scrcpy/doc/`.
- Se leyeron `develop.md`, `control.md`, `recording.md`, `video.md`, `connection.md` y `tunnels.md`.
- Siguiente prioridad de control manual: investigar e implementar primero control nativo scrcpy con documentacion/codigo real, pruebas minuciosas y canario `.43`.
- ADB input `/control/*` debe quedar como fallback seguro para taps/swipes/navegacion si scrcpy control falla o no esta disponible.
- No activar control nativo scrcpy a ciegas: el protocolo es interno y el stream raw actual usa `control=false`; proteger Grid/Focus, coordenadas, rotacion, multidispositivo y rollback.

Archivos clave modificados en esta fase:
- `local_adb_server.py`
- `electron-app/src/renderer/flow-touch.js`
- `electron-app/src/renderer/styles.css`
- `electron-app/src/renderer/app.js`
- `abrir_electron.ps1`
- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- `DOCUMENTACION_TECNICA.md`
- `TASKS_MONOLITO_PRO.md`
- `HANDOFF_MONOLITO_PRO.md`

Restore point:
- `restore_points/2026-06-09_OPERATION_PROFILES_CONTROL_AUTOMATION_INSPECTION`
- `restore_points/2026-06-09_SCRCPY_DOCS_RECORDING_REDO`

No se hizo despliegue masivo ni instalacion de APKs. Falta prueba real en `.43`, incluido Grabar/Detener.

## Lee Primero

1. `AGENTS.md`
2. `PROJECT_CONTEXT.md`
3. `PLAN_MONOLITO_PRO.md`
4. `TASKS_MONOLITO_PRO.md`
5. `DISPOSITIVOS_PRUEBA_MONOLITO.md`
6. Este archivo

## Objetivo Activo

Implementar una arquitectura PRO:

- Un solo APK monolito.
- Una sola Accesibilidad visible basada en AutoJs6.
- FlowAgent socket integrado como capa encima.
- FlowKeyboard como IME humano.
- scrcpy solo para video H.264, Focus y diagnostico.
- Auditoria global de mojibake en APK, dashboard, servidores y docs.

## Estado Actual Importante

- `flow_agent_monolito` es el APK principal.
- `local_adb_server.py` prioriza el APK release del monolito antes que `flow_agent_apk` legacy.
- Monolito esperado: `com.flowlogin.agent`, `versionName=1.0.0`, `versionCode=103`.
- El monolito todavia tiene dos servicios de Accesibilidad visibles si ambos estan declarados:
  - AutoJs6: `org.autojs.autojs.core.accessibility.AccessibilityServiceUsher`.
  - FlowAgent: `com.flowlogin.agent.FlowAccessibilityService`.
- La meta es llegar a una sola opcion visible, pero no se debe quitar `FlowAccessibilityService` hasta migrar comandos y validar.
- `FlowKeyboardService` + `HumanInputBridge` del monolito ya tienen ruta `keyboard_type_human` con QWERTY visible.
- `.43` tiene monolito reinstalado tras prueba, pero Accesibilidad e IME quedaron OFF por el uninstall/install.
- `.48` se uso para pruebas de scrcpy externo, no integrado en Electron.

## No Hacer

- No desplegar en toda la flota sin aprobacion explicita.
- No borrar `FlowAccessibilityService` todavia.
- No hacer reemplazos globales de mojibake.
- No modificar `device_names.json` ni `.flowlogin_payloads` para documentacion.
- No tocar secretos.
- No depender de ADB del PATH.
- No convertir `wsapi_demo.html` en producto nuevo; Electron es el producto final.

## Siguiente Paso Recomendado

Continuar desde `TASKS_MONOLITO_PRO.md`:

1. Completar Fase 0: restore point.
2. Completar Fase 1: crear script de auditoria mojibake solo reporte.
3. Ejecutar reporte y corregir primero textos visibles, en lotes pequenos.
4. Solo despues avanzar a FlowKeyboard Humano V2.

## Comandos Utiles

```powershell
git status --short
node --check electron-app/src/renderer/app.js
node --check electron-app/src/renderer/flow-touch.js
python -m py_compile local_adb_server.py
.\scrcpy-win64-v4.0\adb.exe devices
```

Build monolito:

```powershell
cd flow_agent_monolito
.\gradlew.bat :app:assembleAppRelease
cd ..
```

Ver APK:

```powershell
$sdk=$env:ANDROID_HOME
$bt=Get-ChildItem -Path (Join-Path $sdk 'build-tools') -Directory | Sort-Object Name -Descending | Select-Object -First 1
$aapt=Join-Path $bt.FullName 'aapt.exe'
& $aapt dump badging flow_agent_monolito\app\build\outputs\apk\app\release\agent-v1.0.0-arm64-v8a.apk
```

## Criterio Para Avanzar A Una Sola Accesibilidad

No avanzar hasta que:

- tap funcione con engine AutoJs6.
- swipe funcione con engine AutoJs6.
- lectura/estado funcione con engine AutoJs6.
- scripts AutoJs6 funcionen.
- FlowKeyboard humano funcione.
- endpoints existentes del dashboard sigan respondiendo.
- prueba en 1 dispositivo sea estable.

## Actualización 2026-06-10 (Auditoría de Perfiles Operativos)

Se ha completado la auditoría para verificar la separación formal de perfiles (Control, Automatización, Inspección).
- **Código:** Verificado como correcto y seguro. brir_electron.ps1 arranca en modo limpio (Perfil Control).
- **Documentación:** Se han corregido las inconsistencias históricas en DOCUMENTACION_TECNICA.md que decían que FlowAgent se instalaba automáticamente. También se actualizó el rol de la función _flowagent_auto_reconnect_loop() dejándola como una herramienta manual/legacy inactiva.

Todo está listo para continuar de forma segura y consistente.

## Actualización 2026-06-10 (Auditoría de Perfiles Operativos)

Se ha completado la auditoría para verificar la separación formal de perfiles (Control, Automatización, Inspección).
- **Código:** Verificado como correcto y seguro. `abrir_electron.ps1` arranca en modo limpio (Perfil Control).
- **Documentación:** Se han corregido las inconsistencias históricas en `DOCUMENTACION_TECNICA.md` que decían que FlowAgent se instalaba automáticamente. También se actualizó el rol de la función `_flowagent_auto_reconnect_loop()` dejándola como una herramienta manual/legacy inactiva.

Todo está listo para continuar de forma segura y consistente.
