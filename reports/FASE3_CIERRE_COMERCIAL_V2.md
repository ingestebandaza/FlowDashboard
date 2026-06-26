# Informe de cierre - FASE 3 (Rutas, recursos y datos)

Proyecto: FlowDashboard 2.0.0 (producto comercial)
Rama: commercial/v2.0.0
Fecha: 2026-06-27
Documento gobernante: PLAN_MAESTRO (Fase 3, linea 439) + ANEXO (formato seccion 14)

---

## 1. Objetivo de la fase

Lograr que el mismo codigo funcione en desarrollo y produccion mediante un resolvedor de rutas compartido, migracion idempotente de datos a una carpeta de usuario persistente, y escritura segura de archivos de datos (allowlist + escrituras atomicas), sin migrar secretos en texto plano.

## 2. Alcance

Incluye: verificacion del modulo electron-app/src/main/path-resolver.js (propiedades y reglas dev/prod), su uso real en index.js (IPC seguro), el equivalente C# FlowDashboard.Core/Services/AppPaths.cs y el equivalente Python en local_adb_server.py, mas la comprobacion en runtime de las rutas resueltas y de la migracion. Excluye: empaquetado (FASES 5-9) y cambios funcionales de control de dispositivos.

## 3. Estado inicial encontrado

La implementacion de rutas/datos YA existia por una ejecucion previa en los tres runtimes. Conforme al mandato, NO se confio en reportes anteriores: se verifico cada pieza contra el codigo real y el runtime vivo.

## 4. Cambios realizados

Ninguno. La verificacion no encontro discrepancias funcionales ni de seguridad; no fue necesario modificar codigo. No se creo punto de restauracion porque no hubo cambios de codigo.

## 5. Verificacion en runtime

Python /health (puerto 8765) reporta:
- appVersion = 2.0.0, productMode = false, isFrozen = false.
- baseDir = C:\DASHBOARD\FlowDashboard (modo dev, resuelto desde repo).
- resourceDir = C:\DASHBOARD\FlowDashboard.
- dataDir = C:\DASHBOARD\FlowDashboard\scratch\flowdashboard-data-runtime (separado del baseDir, fijado por el launcher).
El dataDir contiene los JSON de datos migrados (device_names.json, device_groups.json, device_inventory.json, device_mappings.json, update_config.json), lo que confirma que la separacion datos/codigo y la migracion funcionan.

## 6. Pruebas con dispositivos

No se ejecutaron acciones de control en esta fase (es de rutas/datos). Se confirmo que el inventario persistente (device_inventory.json, 17 entradas) reside en el dataDir y que los servicios siguen operativos.

## 7. Hallazgos y correcciones

Modulo Electron (path-resolver.js):
- Expone todas las propiedades requeridas: isPackaged, projectRoot, resourceRoot, runtimeRoot, userDataRoot, logsRoot, recordingsRoot, scriptsRoot, scrcpyRoot, flowAgentApk, flowTrackNameExe (mas dataRoot y electronRoot como extras utiles).
- Dev resuelve desde el repositorio (findProjectRoot), produccion desde process.resourcesPath y app.getPath('userData') (lineas 76-85).
- migrateApprovedDataFiles (121-133): idempotente (solo copia si origen existe y destino no existe) y solo si dataRoot != projectRoot.
- Seguridad (normalizeApprovedJsonFilename, 106-115): rechaza nombre vacio, rutas absolutas, '..', separadores, extensiones distintas de .json y nombres fuera de la allowlist.
- Escritura atomica (atomicWriteApprovedJson, 141-159): archivo temporal, fsync, backup .bak del anterior y rename.
- Uso real en index.js: createPathResolver (24), propagacion de env (25-30), migracion al arranque (32-35), e IPC read-json-file/write-json-file usan exclusivamente readApprovedJson/atomicWriteApprovedJson (296,304), de modo que el renderer NO puede pasar rutas arbitrarias.

Equivalente C# (AppPaths.cs):
- DataDir por env FLOWDASHBOARD_DATA_DIR; en ProductMode usa LocalApplicationData\FlowDashboard; en dev usa BaseDir (44-63).
- DataFile valida nombre (rooted, '..', separadores) (65-73).
- MigrateFileIfMissing idempotente (75-81). AtomicWriteText con temp+flush(flushToDisk)+backup+move (83-100).

Equivalente Python (local_adb_server.py):
- _resolve_data_dir (67-75): env > ProductMode (LOCALAPPDATA\FlowDashboard) > base_dir. BASE_DIR/RESOURCE_DIR/DATA_DIR fijados en 116-119.
- APPROVED_DATA_FILES (140-148) y migrate_approved_data_files (151-170) idempotente; todos los JSON de datos anclados a DATA_DIR (DEVICE_NAMES_FILE 275, DEVICE_INVENTORY_FILE 276, DEVICE_GROUPS_FILE 282, RECORDINGS_DIR 436). /health expone baseDir/resourceDir/dataDir (9425-9427).

No migracion de secretos: ni .supabase_config.json ni mail_config.json estan en ninguna de las tres allowlists. mail_config.json existe en el dataDir pero NO fue colocado por el mecanismo de migracion (no esta en APPROVED_DATA_FILES), por lo que se cumple "no migrar secretos a texto plano".

## 8. Componentes protegidos

No se toco ningun componente protegido. La fase solo verifica resolvedores de ruta y persistencia de datos; el pipeline de video, control de dispositivos y scrcpy permanecen intactos.

## 9. Coherencia codigo / runtime / documentacion

Coherente. Las tres implementaciones (Electron/C#/Python) comparten exactamente la misma allowlist de archivos de datos y la misma politica dev/prod de DATA_DIR. El runtime confirma la separacion datos/codigo. CURRENT_ARCHITECTURE.md y DEVELOPMENT_START.md (actualizados en FASE 1) describen el uso de DATA_DIR de forma consistente.

## 10. Riesgos

- Bajo: si las tres allowlists se editaran por separado podrian divergir. Mitigacion: mantenerlas sincronizadas (son listas cortas y explicitas).
- Bajo: update_config.json esta en la allowlist de migracion pero ya no existe en la raiz del repo; al no existir origen, la migracion simplemente lo omite (sin error). No afecta funcionalidad.

## 11. Rollback

No aplica (sin cambios de codigo). Los datos viven en una carpeta separada (dataDir/LocalAppData), por lo que cualquier reinstalacion conserva los datos. Punto de restauracion historico relacionado: restore_points/2026-06-23_101500_PRE_COMMERCIAL_PHASE6_DOTNET_SELF_CONTAINED/ contiene una copia de AppPaths.cs.

## 12. Evidencias

- Lectura completa de path-resolver.js (168 lineas) y AppPaths.cs (101 lineas).
- Lectura del cableado en index.js (1-60, 285-312).
- Lectura de local_adb_server.py (40-75 resolvedores, 140-173 migracion).
- findstr de usos de path-resolver en electron-app (index.js).
- /health en runtime: baseDir/resourceDir/dataDir.
- dir del dataDir runtime: JSON de datos presentes.

## 13. Configuracion y secretos

No se modificaron secretos. Las allowlists excluyen explicitamente secretos. Los secretos (.supabase_config.json, mail_config.json, device_names.json contiene solo nombres, h264_canary_config.json) siguen gitignored. La migracion solo copia archivos de datos no sensibles.

## 14. Checklist de aceptacion

- [x] path-resolver.js expone todas las propiedades requeridas.
- [x] Reglas dev (repo) y prod (resourcesPath + userData) implementadas.
- [x] Migracion de datos idempotente desde ubicaciones antiguas (Electron/C#/Python).
- [x] Allowlist de nombres + rechazo de rutas absolutas/../separadores/extensiones no permitidas.
- [x] Escrituras atomicas (temp + flush + backup + replace).
- [x] No se migran secretos en texto plano.
- [x] Runtime confirma separacion datos/codigo (dataDir distinto del baseDir).
- [x] Criterio: la build instalada puede actualizarse sin perder datos (datos en carpeta de usuario persistente).
- [x] Producto sigue operativo (17 dispositivos).

## 15. Conclusion y siguiente fase

FASE 3 CERRADA. La resolucion de rutas, la migracion idempotente de datos y la escritura segura estan correctamente implementadas y son coherentes entre Electron, C# y Python; el runtime confirma la separacion datos/codigo. No se requirieron cambios. Siguiente: FASE 4 (RuntimeManager de Electron: eliminar dependencia de PowerShell en produccion), PLAN_MAESTRO linea 509.
