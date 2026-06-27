# Informe de cierre — FASE 7: Recursos comerciales (staging)

FlowDashboard 2.0.0 — rama `commercial/v2.0.0`

## 1. Objetivo
Verificar y dejar correcto el empaquetado de recursos comerciales (staging): scrcpy, ADB, FlowAgent APK, FlowTrackName.exe, avisos de terceros y manifiesto, conforme al PLAN_MAESTRO lineas 715-792.

## 2. Alcance
- `scripts/build/prepare-commercial-resources.ps1` (logica de staging).
- Resolucion del APK del FlowAgent en `local_adb_server.py`.
- Inventario de avisos de terceros `docs/commercial/THIRD_PARTY_NOTICES.txt`.
- Coherencia del manifiesto generado en `build/staging/commercial-resources`.
- Coherencia de `.gitignore` para versionar el tooling de build.

## 3. Estado inicial
- Staging generaba/instalaba el APK arm64-v8a (89.872.194 bytes), no universal.
- `find_flow_agent_apk()` en `local_adb_server.py:285-323` instalaba un unico APK por dispositivo via `adb install -r`, sin auto-seleccion de ABI; preferia arm64.
- `.gitignore:14` con regla `build/` (sin anclar) ignoraba ademas `scripts/build/`, dejando TODO el tooling de build comercial sin versionar (`git ls-files scripts/build` vacio).

## 4. Cambios realizados
- `local_adb_server.py`: `find_flow_agent_apk()` ahora prioriza el APK universal. Nueva lista `commercial_universal` (`android/flowagent/agent-v1.0.0-universal.apk` y `flow_agent/agent-v1.0.0-universal.apk`); orden de candidatos: commercial_universal > commercial_arm64 > monolito_release_universal > monolito_release_arm64 > monolito_debug_arm64 > fallbacks debug; fallback final = universal. Commit `dd01140`.
- `scripts/build/prepare-commercial-resources.ps1`: valida y copia el universal como `android/flowagent/agent-v1.0.0-universal.apk`; manifiesto con `includedAbi="universal"`, `arm64ApkAvailable=true`, `arm64ApkIncluded=false`, `abiDecision`.
- `.gitignore:14`: `build/` -> `/build/` (anclado a raiz) para versionar `scripts/build/` sin desproteger los artefactos de `build/` de raiz.

## 5. Verificacion en runtime
- Sintaxis Python validada con `ast.parse` sobre `local_adb_server.py`: OK.
- Re-ejecucion de `prepare-commercial-resources.ps1 -Clean`: OK, 460 archivos, ~398 MB, `flowAgentAbi=universal`, versionName 1.0.0 / versionCode 106.
- APK universal staged confirmado: 183.871.298 bytes.
- `.gitignore` verificado con `git check-ignore`: `build/runtime/python/FlowDashboard.Backend.exe` sigue ignorado; `scripts/build/prepare-commercial-resources.ps1` ya NO esta ignorado.

## 6. Pruebas con dispositivos
- No se ejecuto instalacion E2E en dispositivo en esta sesion (opcional). El APK universal es el MISMO build monolito (mismo applicationId `com.flowlogin.agent`, mismo versionCode 106) con librerias nativas de todas las ABI, por lo que mantiene compatibilidad con Android 9 arm64 del usuario. Pendiente opcional: instalar via grid > Install FlowAgent y confirmar socket 8766.

## 7. Hallazgos y correcciones
- HALLAZGO: APK instalado era arm64-only. CORREGIDO: priorizacion universal en codigo y staging.
- HALLAZGO: `.gitignore` dejaba sin versionar `scripts/build/` (build-python.ps1, build-dotnet.ps1, build-electron-installer.ps1, prepare-commercial-resources.ps1). CORREGIDO: regla anclada `/build/`.
- HALLAZGO: el bundle scrcpy no incluye LICENSE/NOTICE en origen (componente protegido, no modificado). Cubierto por THIRD_PARTY_NOTICES.txt como inventario de ingenieria.

## 8. Componentes protegidos
No se modificaron componentes protegidos (scrcpy-win64-v4.0/, pipeline de video, control, protocolo FDH1, etc.). El cambio en `local_adb_server.py` afecta solo a la seleccion del APK a instalar, no al pipeline de streaming ni control.

## 9. Coherencia codigo/runtime/documentacion
- Resolucion del APK en codigo (`local_adb_server.py`) coherente con el artefacto generado por el staging (universal).
- Manifiesto del staging refleja la decision de ABI (universal incluido, arm64 disponible no incluido).
- THIRD_PARTY_NOTICES.txt cubre Electron/Chromium/Node, scrcpy, ADB, FFmpeg, SDL3, libusb, Python/PyInstaller, .NET, MailKit/MimeKit.

## 10. Riesgos
- Tamano del paquete mayor por el APK universal (~184 MB vs ~90 MB arm64). Aceptado a cambio de compatibilidad total.
- El backend en ejecucion resolvera el universal solo tras reinicio del servicio Python.

## 11. Rollback
- Punto de restauracion codigo: `restore_points/2026-06-27_0200_PRE_FASE7_UNIVERSAL_APK/` (originales de `local_adb_server.py` y `prepare-commercial-resources.ps1`).
- Punto de restauracion gitignore: `restore_points/2026-06-27_0300_PRE_FASE7_GITIGNORE/.gitignore`.
- Revertir commits `dd01140` (codigo) y el commit de tooling/gitignore de esta fase.

## 12. Evidencias
- `output-metadata.json` del monolito: 6 variantes ABI, todas versionName 1.0.0 / versionCode 106.
- FlowTrackName.exe: 32.087.726 bytes, SHA-256 `fba6a00129f63726c590819c19f1c64f90a6801bbf419a17adb675409016177e` (coincide con manifiesto).
- Staging: 460 archivos, ~398 MB.

## 13. Configuracion y secretos
- Sin secretos en el staging. Configs sensibles permanecen gitignoradas (.supabase_config.json, mail_config.json, device_names.json, h264_canary_config.json).

## 14. Checklist de aceptacion
- [x] Staging genera recursos completos (scrcpy, ADB, APK, FlowTrackName.exe, notices, manifiesto).
- [x] APK universal priorizado en codigo y staging.
- [x] Manifiesto coherente con la decision de ABI.
- [x] Tooling de build versionado (.gitignore corregido).
- [x] Sintaxis y re-ejecucion del script validadas.
- [ ] Prueba E2E de instalacion en dispositivo (opcional, pendiente).

## 15. Conclusion y siguiente fase
FASE 7 cerrada. El paquete comercial usa el APK universal del FlowAgent para compatibilidad total y el tooling de build queda versionado. Siguiente: FASE 8 (instalador NSIS / electron-builder, PLAN_MAESTRO linea 793), verificando que `build/staging/commercial-resources` se empaqueta y arranca en una maquina limpia sin .NET.
