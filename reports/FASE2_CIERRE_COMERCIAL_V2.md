# Informe de cierre - FASE 2 (Versionado unico 2.0.0)

Proyecto: FlowDashboard 2.0.0 (producto comercial)
Rama: commercial/v2.0.0
Fecha: 2026-06-27
Documento gobernante: PLAN_MAESTRO (Fase 2, linea 390) + ANEXO (formato seccion 14)

---

## 1. Objetivo de la fase

Garantizar que TODOS los componentes del producto (Electron, Python, C#, manifiestos, instalador y notas de version) reporten exactamente la misma version 2.0.0, con una unica fuente de verdad (version.json) y un script de sincronizacion reproducible (scripts/release/sync-version.ps1).

## 2. Alcance

Incluye: verificacion de la fuente unica de version, del script de sincronizacion y de cada destino (codigo, metadatos y artefactos de release) contra el valor canonico, mas la comprobacion en runtime de los servicios vivos. Excluye: cambios funcionales y re-empaquetado (las fases de empaquetado/instalador se tratan en FASES 5-9).

## 3. Estado inicial encontrado

El versionado 2.0.0 YA estaba aplicado por una ejecucion previa. Conforme al mandato, NO se confio en reportes anteriores: cada valor se verifico de forma independiente contra el archivo real y, cuando aplica, contra el runtime.

## 4. Cambios realizados

Ninguno. La verificacion no encontro discrepancias; no fue necesario modificar codigo, metadatos ni manifiestos. No se creo punto de restauracion porque no hubo cambios en codigo.

## 5. Verificacion en runtime

- C# /api/health (puerto 5000): reporta v2.0.0.
- Python /health (puerto 8765): appVersion = 2.0.0, productMode=false, isFrozen=false.
- /devices: 17 dispositivos.
Nota: Python expone ademas un campo interno `version` = "2026-05-12-device-public-ip-refresh", que es una etiqueta de feature/refresh, NO la version del producto. La version del producto es appVersion = 2.0.0.

## 6. Pruebas con dispositivos

No se ejecutaron acciones de control sobre dispositivos en esta fase (es de metadatos). Se confirmo unicamente que el inventario sigue activo (17 dispositivos) y que los servicios responden, para no afectar al producto en uso.

## 7. Hallazgos y correcciones

- version.json es la fuente unica: {version: 2.0.0, channel: stable, publisher: FlowDashboard, productName: FlowDashboard}.
- scripts/release/sync-version.ps1 lee version.json, valida formato MAJOR.MINOR.PATCH (linea 19), y sincroniza: electron-app/package.json (version + build.artifactName), electron-app/package-lock.json, package.json raiz, app_meta.py, FlowDashboard.Core.csproj (Version, AssemblyVersion=$Version.0, FileVersion, InformationalVersion, Product, Company) y crea RELEASE_NOTES si falta. No muta update.json legacy (lineas 113-114), coherente con el cambio a electron-updater de FASE 9.
- Destinos verificados, todos en 2.0.0: version.json; electron-app/package.json:3; package.json raiz:3; electron-app/package-lock.json:3; app_meta.py:2 (APP_VERSION); FlowDashboard.Core.csproj:6-9 (Version/AssemblyVersion 2.0.0.0/FileVersion 2.0.0.0/InformationalVersion); RELEASE_NOTES_2.0.0.md.
- electron-app/src/main/update-manager.js:63,204 usa app.getVersion() (dinamico, sin hardcode).
- FlowDashboard.Core/Program.cs:11 usa InformationalVersion del ensamblado con fallback "2.0.0" (dinamico).
- Artefactos de release en 2.0.0: release_packages/latest.yml (version: 2.0.0, url FlowDashboard-Setup-2.0.0.exe); release_packages/PHASE9_UPDATER_INSTALLER_MANIFEST.json (installer FlowDashboard-Setup-2.0.0.exe); instalador fisico FlowDashboard-Setup-2.0.0.exe presente (~260 MB).
- Busqueda de versiones obsoletas (1.0.55-1.0.60) en archivos canonicos: sin coincidencias. Las unicas apariciones estan en reports/ y restore_points/ (respaldos historicos), que son intencionalmente inmutables.

## 8. Componentes protegidos

No se toco ningun componente protegido (stream-renderer-h264.js, flow-touch.js, scrcpy_raw_streamer.py, scrcpy_raw_ws_server.py, scrcpy_control_channel.py, protocolo FDH1, parser H.264, WebCodecs, sesiones Grid/Focus, CoordinateMapper, taps/swipes/drag/touch en vivo, Back/Home/Recents, presets, scrcpy-control, fallback ADB, pipeline de video, scrcpy-win64-v4.0/). Esta fase es solo de metadatos de version.

## 9. Coherencia codigo / runtime / documentacion

Coherente. La version declarada en el codigo (2.0.0) coincide con la reportada en runtime por C# y Python (appVersion), y con los artefactos de release. La documentacion (BUILD_AND_RELEASE.md) describe correctamente version.json + sync-version.ps1 como mecanismo de versionado unico.

## 10. Riesgos

- Bajo: si en el futuro se edita una version manualmente sin ejecutar sync-version.ps1, podrian aparecer discrepancias. Mitigacion: usar siempre el script y la verificacion verify-documentation-consistency.ps1.
- El campo interno `version` de Python (feature-tag) podria confundirse con la version del producto; queda documentado aqui que el valor de producto es appVersion.

## 11. Rollback

No aplica (sin cambios). Si se requiriera revertir cualquier futura modificacion de version, restaurar version.json y re-ejecutar scripts/release/sync-version.ps1. Existen respaldos historicos en restore_points/2026-06-23_081609_PRE_COMMERCIAL_PHASE2_VERSION_UNIFICATION/.

## 12. Evidencias

- Lectura completa de scripts/release/sync-version.ps1 (158 lineas).
- findstr/Invoke-RestMethod sobre los destinos de version (todos 2.0.0).
- Lectura de release_packages/latest.yml y PHASE9_UPDATER_INSTALLER_MANIFEST.json.
- dir release_packages (instalador 2.0.0 presente, 259.716.918 bytes).
- Health C#/Python y /devices=17 confirmados en runtime.

## 13. Configuracion y secretos

No se modificaron secretos. version.json no contiene secretos (solo metadatos de marca/version). Los secretos (.supabase_config.json, mail_config.json, device_names.json, h264_canary_config.json) siguen gitignored y sin tocar.

## 14. Checklist de aceptacion

- [x] Existe fuente unica de version (version.json).
- [x] Existe script de sincronizacion reproducible (sync-version.ps1) que lee de version.json.
- [x] Electron (package.json + lock) = 2.0.0.
- [x] package.json raiz = 2.0.0.
- [x] Python app_meta.py = 2.0.0 y runtime appVersion = 2.0.0.
- [x] C# csproj (Version/AssemblyVersion/FileVersion/InformationalVersion) = 2.0.0 y runtime = v2.0.0.
- [x] Manifiestos de release (latest.yml, PHASE9 manifest) = 2.0.0.
- [x] Instalador nombrado FlowDashboard-Setup-2.0.0.exe presente.
- [x] Sin versiones obsoletas en archivos canonicos.
- [x] Producto sigue operativo (17 dispositivos).

## 15. Conclusion y siguiente fase

FASE 2 CERRADA. El versionado unico 2.0.0 esta correctamente aplicado y es coherente entre codigo, runtime y artefactos; no se requirieron cambios. Siguiente: FASE 3 (rutas y datos: path-resolver.js, AppPaths.cs, migracion de datos y uso de DATA_DIR), PLAN_MAESTRO linea 439.
