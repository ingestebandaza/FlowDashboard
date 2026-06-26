# Reauditoría de Fases Comerciales (V2)

## FASE 0: Base
* Requisito: Congelación y línea base.
* Archivo esperado: Tag Git.
* Existente: Sí (`pre-commercial-v2` = `d4ae086`).
* Tracked: Sí.
* Prueba estática/runtime: N/A (Punto de inicio).
* Estado final: **VERIFIED_COMPLETE**

## FASE 1: Clasificación
* Requisito: Clasificar en `docs/` y `archive/`.
* Archivo existente: `archive/LEGACY_INDEX.md`.
* Tracked/Untracked: **Untracked**.
* Estado final: **PARTIAL**

## FASE 2: Versionado
* Requisito: Version 2.0.0 y sincronización.
* Archivo existente: `version.json`.
* Tracked/Untracked: **Untracked**.
* Estado final: **PARTIAL**

## FASE 3: Paths y datos
* Requisito: Data en UserData.
* Archivo existente: `path-resolver.js`.
* Tracked/Untracked: **Untracked**.
* Estado final: **PARTIAL**

## FASE 4: RuntimeManager
* Requisito: Manejo de ciclo de vida C#/Python.
* Archivo existente: `runtime-manager.js`.
* Tracked/Untracked: **Untracked**.
* Prueba runtime: **Fallida (bug de Node.js spawn en stdio)**.
* Estado final: **PARTIAL**

## FASE 5: Backend Python
* Requisito: Standalone de Python.
* Archivo existente: `FlowDashboard.Backend.spec`.
* Tracked/Untracked: **Untracked**.
* Prueba runtime: El exe no se construyó/no está trackeado de forma final.
* Estado final: **PARTIAL**

## FASE 6: Backend C#
* Requisito: Build Self-Contained.
* Archivo existente: `FlowDashboard.Core/` (Release/Debug).
* Tracked/Untracked: **Untracked**.
* Estado final: **PARTIAL**

## FASE 7: Recursos
* Requisito: FlowAgent Monolito y scrcpy local.
* Archivo existente: `flow_agent_monolito/`.
* Tracked/Untracked: **Tracked parcialmente / Untracked parcialmente**.
* Estado final: **PARTIAL**

## FASE 8: Empaquetado y Aceptación
* Requisito: NSIS Installer y Acceptance Test.
* Archivo esperado: `FlowDashboard-Setup-2.0.0.exe`.
* Archivo existente: Sólo `win-unpacked/`, sin Setup.
* Tracked/Untracked: **Untracked**.
* Prueba aceptación: **Ninguna**.
* Estado final: **PARTIAL**

## FASE 9: Auto-Updater
* Requisito: `electron-updater` e IPC.
* Archivo existente: `update-manager.js`.
* Tracked/Untracked: **Untracked**.
* Prueba runtime: **Ninguna (fallo previo en runtime)**.
* Estado final: **PARTIAL**
