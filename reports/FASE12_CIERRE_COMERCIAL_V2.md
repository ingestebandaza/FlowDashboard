# FASE 12 — Cierre comercial v2.0.0 — Entitlements (control de funciones por plan)

## 1. Objetivo
Implementar el sistema de entitlements (funciones habilitadas por plan) en las cinco capas del producto (observacion, UI, IPC Electron, backend Python y backend C#), con aplicacion (enforcement) desactivable por configuracion y comportamiento fail-open por defecto, mas cache offline firmada y pantalla de bloqueo controlado por vencimiento. El objetivo es que la manipulacion de la interfaz no permita ejecutar funciones no autorizadas, sin romper el funcionamiento actual del producto.

## 2. Alcance
- Base de datos: migracion 007 (siembra de 25 codigos de feature, habilitacion total en el plan vigente LEGACY_FULL, y RPC validate_flowdashboard_license devolviendo el arreglo features).
- Backend Python: modulo entitlements.py + gates en local_adb_server.py (POST sensibles + endpoint de estado + carga tras validate-license).
- Backend C#: EntitlementsService + middleware de bloqueo + endpoints GET/POST /api/entitlements.
- Electron main: cache offline firmada (DPAPI + HMAC) + handlers IPC.
- Renderer: EntitlementsManager (observe-only, gating UI por data-feature, mensajes comerciales, push a cache y a C#, carga offline, pantalla de bloqueo por vencimiento).
- Empaquetado: inclusion de entitlements.py en el spec de PyInstaller.

Fuera de alcance (no modificado): pipeline de video, control scrcpy, touch, H.264, Grid/Focus, presets, y demas componentes protegidos.

## 3. Estado inicial
- RPC validate_flowdashboard_license (migracion 006) no devolvia features.
- No existia ningun control de funciones por plan en backend, IPC, ni UI.
- No existia cache offline de licencia con firma.
- El producto operaba como acceso total una vez validada la licencia.

## 4. Cambios realizados
Nuevos archivos:
- database/migrations/007_entitlements_features.sql
- database/migrations/rollbacks/007_rollback.sql
- entitlements.py
- FlowDashboard.Core/Services/EntitlementsService.cs
- electron-app/src/main/entitlements-cache.js

Archivos modificados:
- scripts/db/apply_migrations.py: STEPS incluye 007_entitlements_features.
- local_adb_server.py: import opcional de entitlements; gate en do_POST (feature_not_entitled 403); carga de entitlements tras /validate-license; endpoint GET /entitlements.
- FlowDashboard.Core/Program.cs: registro singleton EntitlementsService; middleware de bloqueo en POST; endpoints GET/POST /api/entitlements; using System.Text.Json.
- electron-app/src/main/index.js: require de entitlements-cache; handlers IPC entitlements-cache-save/load/clear.
- electron-app/preload/preload.js: exposicion saveEntitlementsCache/loadEntitlementsCache/clearEntitlementsCache.
- electron-app/src/renderer/app.js: EntitlementsManager (capas A/B), conexion en los dos flujos de validacion, carga offline en fallo de red, pantalla de bloqueo por vencimiento.
- build_specs/FlowDashboard.Backend.spec: hiddenimports incluye "entitlements".

## 5. Verificacion runtime
- py_compile de entitlements.py y local_adb_server.py: COMPILE_OK.
- Prueba funcional de entitlements.py: fail-open con enforcement off; bloqueo correcto con enforcement on y feature ausente (ej. /power/reboot -> (False, power.reboot)); permitido cuando feature presente o features vacias.
- dotnet build FlowDashboard.Core: Compilacion correcta, 0 errores (solo advertencias preexistentes ajenas a este cambio).
- node --check sobre index.js, entitlements-cache.js, preload.js y app.js: sin errores de sintaxis.
- RPC en Supabase live: features_count=30, has_devices_grid=true, plan LEGACY_FULL; las licencias sin plan devuelven features vacio (fail-open en cliente).

## 6. Pruebas con dispositivos
Pendiente de ejecucion por el usuario (modo ahorro). El enforcement esta desactivado por defecto, por lo que el producto opera igual que antes hasta activar FLOWDASHBOARD_ENFORCE_ENTITLEMENTS. La activacion y prueba con dispositivos reales se realizara tras el despliegue, sin cambios de codigo adicionales.

## 7. Hallazgos y correcciones
- PythonBridgeService.cs si usa HttpClient hacia http://localhost:8765 (el grep inicial fallo por codificacion); se confirmo leyendo el archivo. C# puede recibir push y/o consultar a Python.
- entitlements.py debia incluirse explicitamente como hiddenimport en el spec por ser import dinamico en local_adb_server.py; corregido para que el ejecutable empaquetado lo incluya (de lo contrario el frozen quedaria en fail-open permanente).

## 8. Componentes protegidos
No se modificaron: stream-renderer-h264.js, flow-touch.js, scrcpy_raw_streamer.py, scrcpy_raw_ws_server.py, scrcpy_control_channel.py, protocolo FDH1, parser H.264, WebCodecs, sesiones Grid/Focus, CoordinateMapper, taps/swipes/drag/live touch, Back/Home/Recents, presets, scrcpy-control, fallback ADB, pipeline de video, scrcpy-win64-v4.0/. Los endpoints de streaming no se mapearon a features deliberadamente (UI-gated + protegidos).

## 9. Coherencia codigo-runtime-documentacion
El contrato real de la RPC (schema_version 2: status/reason_code/plan/limits/grace/features[]/license_overrides) es la fuente de verdad. El cliente usa el arreglo features tal cual lo devuelve la RPC. El estado de entitlements expuesto por Python (GET /entitlements) y C# (GET /api/entitlements) refleja la variable de entorno de enforcement y los features cargados.

## 10. Riesgos
- Si el ejecutable empaquetado no incluyera entitlements.py, el backend quedaria en fail-open (mitigado con hiddenimport).
- safeStorage (DPAPI) puede no estar disponible en algunos entornos; la cache cae a texto plano con firma HMAC (integridad preservada, confidencialidad reducida).
- El gating de UI por data-feature solo actua cuando enforcement esta activo; la proteccion efectiva reside en backend (Python/C#).
- La activacion del enforcement debe validarse con dispositivos antes de su uso comercial.

## 11. Rollback
- Codigo: restore_points/2026-06-27_PRE_FASE12_ENTITLEMENTS contiene las versiones previas de los archivos modificados. Los archivos nuevos se eliminan.
- Base de datos: database/migrations/rollbacks/007_rollback.sql.
- Desactivacion inmediata sin rollback: dejar FLOWDASHBOARD_ENFORCE_ENTITLEMENTS sin definir (fail-open).

## 12. Evidencias
- COMPILE_OK (py_compile), dotnet build 0 errores, node --check sin errores.
- RPC live: features_count=30.
- restore_points/2026-06-27_PRE_FASE12_ENTITLEMENTS poblado (tamanos verificados).

## 13. Configuracion y secretos
- Variable de activacion: FLOWDASHBOARD_ENFORCE_ENTITLEMENTS (1/true/yes/on). Default ausente = fail-open.
- No se hardcodean IPs, conteos de dispositivos, seriales, rutas ni secretos.
- La clave HMAC de la cache se deriva del installation id y datos de la maquina (no se almacena en el repositorio).
- Secretos siguen gitignored.

## 14. Checklist
- [x] Migracion 007 aplicada y verificada.
- [x] Backend Python con gates y endpoint de estado.
- [x] Backend C# con middleware y endpoints.
- [x] Electron main con cache offline firmada e IPC.
- [x] Renderer con observe-only, gating UI, mensajes, push y bloqueo por vencimiento.
- [x] Spec de PyInstaller incluye entitlements.
- [x] Restore point creado.
- [x] Compilaciones y checks de sintaxis correctos.
- [ ] Prueba con dispositivos y activacion de enforcement (usuario).

## 15. Conclusion y siguiente fase
FASE 12 implementa las cinco capas de entitlements con enforcement desactivable y fail-open por defecto, mas cache offline firmada y bloqueo controlado por vencimiento, sin afectar el funcionamiento actual del producto ni los componentes protegidos. Verificacion estatica y de compilacion completa; queda pendiente la prueba con dispositivos y la activacion del enforcement por parte del usuario. Siguiente fase: FASE 13 (GESTOR_FLOWDASHBOARD.bat).
