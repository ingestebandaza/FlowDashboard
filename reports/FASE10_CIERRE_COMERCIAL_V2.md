# FASE 10 - Cierre: Modelo comercial en Supabase (10A + 10B)

Proyecto: FlowDashboard 2.0.0
Rama: commercial/v2.0.0
Fecha: 2026-06-27
Base de datos: Supabase (proyecto qcwvfeqyczkhmkhqicqi, PostgreSQL 17.6)

## 1. Objetivo
Crear y APLICAR en la base de datos viva de Supabase el modelo comercial completo
(planes, versiones, features, asignaciones, instalaciones, pagos, auditoria) sin romper
el cliente comercial ni el panel de administracion, preservando el flujo legacy
(app_licenses / app_devices) como fuente de verdad y endureciendo el acceso (RLS + grants).

## 2. Alcance
- 10A: endurecimiento del modelo legacy (RLS, grants, retiro de acceso anonimo a tablas,
  retiro de check_app_license para roles publicos).
- 10B: modelo comercial completo (planes, limites, gracia, entitlements, instalaciones,
  pagos, auditoria) + RPC v2 enriquecido y migracion de datos legacy existentes.
- Adaptacion del panel `license_admin.html` a baja logica (soft-delete).
- NO se modifica codigo de runtime del cliente (RPC mantiene firma identica de 13 parametros).

## 3. Estado inicial (introspeccion real, autoritativa)
- Tablas legacy: app_licenses(3), app_devices(28), app_device_registrations(5),
  app_access_logs(687), app_admins(2). Todas con RLS DESACTIVADO.
- anon: SIN grants de tabla (REST devolvia 401). authenticated: CRUD total con politicas permisivas.
- Funciones: validate_flowdashboard_license (v1, 13 params), check_app_license (7 params, sin
  consumidores reales), is_app_admin() (reutilizable).
- auth.users: 1 (ing.estebandaza@gmail.com), presente en app_admins.
- No existian tablas del modelo comercial.

## 4. Cambios realizados
Migraciones SQL idempotentes (database/migrations/), aplicadas en orden 001->005:
- 001_preflight_backup.sql: esquema flow_backup_v2 con snapshots de las 5 tablas legacy + migration_meta.
- 002_commercial_model.sql: tablas plans, plan_versions, features, plan_feature_entitlements,
  license_plan_assignments, license_overrides, license_installations, payments, audit_events (+indices).
  Limites NULL = ilimitado.
- 003_seed_migrate_legacy.sql: planes (LEGACY_FULL interno/activo; STARTER/GROWTH/ENTERPRISE draft),
  version v1, features base, entitlements LEGACY_FULL (todo habilitado); migracion de las 3 licencias
  a LEGACY_FULL y de los 28 dispositivos a license_installations.
- 004_validate_v2.sql: helper _fd_sync_installation (SECURITY DEFINER) + CREATE OR REPLACE de
  validate_flowdashboard_license con MISMA firma; preserva flujo v1 y agrega plan/limites/gracia,
  reason_code, schema_version=2, gracia de expiracion (server time) y espejo en license_installations.
- 005_rls_grants_cutover.sql: ENABLE RLS en 14 tablas, politica admin_all (FOR ALL TO authenticated
  USING is_app_admin()), REVOKE de anon, GRANT CRUD a authenticated, retiro de EXECUTE de
  check_app_license para anon/authenticated/PUBLIC.

Panel `license_admin.html`: deleteLicense pasa de DELETE fisico a PATCH de estado
(licencia->cancelled, dispositivos->revoked, registros->blocked). Boton "Eliminar" -> "Dar de baja".

Runner: scripts/db/apply_migrations.py (pg8000.native, multi-sentencia, modos --rollback/--only/--verify).
Rollbacks: database/migrations/rollbacks/001-005_rollback.sql.

## 5. Verificacion en runtime (BD viva)
Post-apply (scripts/db/apply_migrations.py --verify):
- app_licenses=3, app_devices=28 (sin cambios), plans=4, plan_versions=4, features=5,
  plan_feature_entitlements=5, license_plan_assignments=3, license_installations=28.
- RLS activo en 14 tablas.

Verificacion de aceptacion (scripts/db/_verify_phase10.py + _probe_supabase.py):
- RLS=True en las 14 tablas.
- anon SIN grants en tablas; REST anon devuelve 401 (permission denied) en las 13 tablas probadas.
- check_app_license: EXECUTE solo para postgres; REST anon devuelve 404 (no invocable).
- RPC validate_flowdashboard_license via anon REST: 200; con licencia+device real existente
  devuelve status=success, schema_version=2, plan.code=LEGACY_FULL, limits (null=ilimitado),
  grace (72/48), reason_code=device_seen. Conteos estables (idempotente, sin filas nuevas).

## 6. Pruebas en dispositivos
No aplica a esta fase (cambios de base de datos/panel). El cliente comercial usa el RPC con
firma identica; no requiere recompilacion. La validacion con dispositivos Android se mantiene
cubierta por el flujo legacy preservado y se reconfirma en fases de empaquetado/QA.

## 7. Hallazgos y correcciones
- check_app_license SI existia (el 404 previo era por firma/cache, no por inexistencia). Se retiro su
  EXECUTE de roles publicos en vez de asumir que no estaba.
- El orden de parametros del RPC es p_device_email primero, luego p_license_key; un test inicial fallo
  por orden posicional. El cliente real usa parametros por nombre (no afectado). Test corregido.
- pg8000.native.Connection.run admite multi-sentencia y bloques $$ (protocolo simple), validado.

## 8. Componentes protegidos
No se tocaron: stream-renderer-h264.js, flow-touch.js, streamers scrcpy, protocolo FDH1, parser H.264,
WebCodecs, sesiones Grid/Focus, CoordinateMapper, control de toques/gestos, presets, scrcpy-control,
fallback ADB, pipeline de video, scrcpy-win64-v4.0/. El RPC conserva su firma de 13 parametros.

## 9. Coherencia codigo/runtime/documentacion
- El cliente (local_adb_server.py, PRODUCT_MODE) usa solo el RPC y parsea el dict de respuesta; los
  campos nuevos son aditivos (no rompen el contrato). Codigo de acceso directo a tablas es inalcanzable.
- Panel usa sesion authenticated (is_app_admin()): el propietario (ing.estebandaza) mantiene CRUD.
- Documentos de diseno en database/design_v2/ reflejan el contrato implementado (schema_version=2,
  reason_code, plan/limites/gracia). Starter/Growth/Enterprise quedan en DRAFT (10B-limits diferido).

## 10. Riesgos y mitigaciones
- Bloqueo del panel por RLS: mitigado: unico usuario auth es admin; politica admin_all verificada.
- Ruptura del cliente por revocar anon: mitigado: cliente usa solo RPC (SECURITY DEFINER) con EXECUTE a anon.
- Perdida de datos: mitigado por snapshots flow_backup_v2 + rollbacks idempotentes.
- Limites de planes comerciales aun no definidos: STARTER/GROWTH/ENTERPRISE en DRAFT, sin efecto en produccion.

## 11. Rollback
Reversion ordenada: `scripts/db/apply_migrations.py --rollback` (005->001). Snapshots adicionales en
esquema flow_backup_v2. Panel: `git checkout HEAD -- license_admin.html` o copia en restore point.
Restore point: restore_points/2026-06-27_0420_PRE_FASE10_COMMERCIAL_DB/.

## 12. Evidencias
- Salidas de apply_migrations.py (--verify pre y post), _verify_phase10.py y _probe_supabase.py
  (RLS, grants anon=401, RPC 200 con schema_version=2/plan/limits/grace, check_app_license 404).
- Conteos pre/post identicos en tablas legacy (3/28) y nuevos (assignments=3, installations=28).

## 13. Configuracion y secretos
- .supabase_db_url (gitignored): cadena del pooler de sesion (aws-1-eu-central-1, puerto 5432).
- .supabase_config.json (gitignored): solo anon key (cliente anon-safe).
- scripts/db/_*.py (gitignored): scripts de diagnostico (no contienen secretos; leen archivos locales).
- Committables: database/migrations/**, scripts/db/introspect*.py, scripts/db/apply_migrations.py,
  license_admin.html, este reporte, .gitignore.

## 14. Checklist de aceptacion
- [x] Modelo comercial completo creado en Supabase (10B).
- [x] Datos legacy migrados (licencias->LEGACY_FULL, dispositivos->license_installations).
- [x] RLS activo en 14 tablas; anon sin acceso de tabla (401).
- [x] check_app_license retirado de roles publicos (404 via REST).
- [x] RPC v2 con firma identica + schema_version=2, reason_code, plan/limites/gracia.
- [x] Idempotencia verificada (re-ejecucion sin duplicar filas).
- [x] Cliente comercial sin recompilacion (contrato aditivo).
- [x] Panel adaptado a baja logica (soft-delete).
- [x] Rollbacks y snapshots de respaldo disponibles.

## 15. Conclusion y siguiente fase
FASE 10 aplicada y verificada en la base de datos viva: modelo comercial 10A+10B operativo,
acceso endurecido y compatibilidad preservada. Siguiente: FASE 11 (segun PLAN_MAESTRO, linea 1122).
