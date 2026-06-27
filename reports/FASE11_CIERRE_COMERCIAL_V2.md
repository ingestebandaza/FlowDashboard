# FASE 11 - Cierre comercial v2.0.0: Panel completo (Plan Studio + ciclo de vida + auditoria)

Rama: commercial/v2.0.0
Base: HEAD 90980000 (cierre FASE 10)
Fecha: 2026-06-27

## 1. Objetivo
Convertir el panel de administracion (`license_admin.html`) en un panel comercial
completo: Plan Studio (gestion de planes, versiones, limites y features),
operaciones de ciclo de vida de licencias (cambio de plan, override de gracia y
limites por licencia, registro de pagos, historial), gestion avanzada de PCs
(desvincular/revocar/renombrar) y una pestana de Auditoria de solo lectura. Todas
las acciones criticas se ejecutan mediante RPCs transaccionales SECURITY DEFINER
que validan el rol admin y registran trazas en `audit_events`.

## 2. Alcance
- Base de datos: migracion `006_admin_rpcs.sql` (10 RPCs admin + helpers + lectura
  de `license_overrides` en el RPC de validacion) y su rollback.
- Frontend: `license_admin.html` (Plan Studio, modales de ciclo de vida e historial,
  pestana Auditoria, reescritura de acciones a RPC).
- Sin cambios en el cliente (`local_adb_server.py`): el contrato del RPC de
  validacion es aditivo y retrocompatible.

## 3. Estado inicial
- Panel con pestanas Licencias / Dispositivos / Intentos; alta/edicion de licencias,
  aprobar/bloquear, baja suave (cancelacion) y renombrar PC, todo via PATCH directo
  a tablas REST.
- Modelo comercial (planes, versiones, features, entitlements, overrides, pagos,
  auditoria) ya existente en Supabase (FASE 10) pero sin interfaz de gestion.
- Sin RPCs administrativos ni trazabilidad de acciones del panel.

## 4. Cambios realizados
### Base de datos (006_admin_rpcs.sql)
- Helpers `_fd_actor()` (email del JWT o 'panel') y `_fd_require_admin()` (exige
  `is_app_admin()`), ambos SECURITY DEFINER, `search_path=public`, sin permiso anon.
- 10 RPCs admin SECURITY DEFINER que validan admin y registran auditoria:
  `admin_set_device_status`, `admin_rename_device`, `admin_unlink_device`,
  `admin_set_license_status`, `admin_cancel_license`, `admin_change_license_plan`,
  `admin_set_license_override`, `admin_record_payment`, `admin_publish_plan_version`,
  `admin_set_plan_status`. EXECUTE concedido a `authenticated`, revocado a `anon`.
- `validate_flowdashboard_license(...)` recreado: identico a 004 mas lectura de
  `license_overrides` (max_pc_installations, offline_grace_hours,
  expiration_grace_hours) con prioridad sobre los limites del plan.
- Firmas con tipo `uuid` para identificadores de plan/version/pago (coherentes con
  el esquema 002, donde `plans.id` y `plan_versions.id` son uuid).

### Frontend (license_admin.html)
- Pestanas nuevas: Planes (Plan Studio) y Auditoria; boton "Nuevo plan".
- Plan Studio: tarjetas por plan con sus versiones (limites, gracia, features y
  marca de version vigente); acciones editar plan, nueva/editar version, publicar
  version, activar/retirar plan.
- Modales: plan, version (con gestion de features/entitlements por checkbox y
  limite), ciclo de vida (cambio de plan / override de gracia / registro de pago) e
  historial (pagos y eventos de la licencia).
- Columna Plan en la tabla de licencias y botones Plan / Gracia / Pago / Historial.
- Boton Desvincular en dispositivos.
- Acciones criticas reescritas para usar RPC (helper `rpc()`): estado de licencia,
  baja, estado/renombrado/desvinculacion de PC, cambio de plan, override, pago,
  publicacion de version y estado de plan.
- Carga de datos ampliada (`loadAll`) a 11 conjuntos (incluye planes, versiones,
  features, entitlements, asignaciones, overrides, pagos y auditoria).

## 5. Verificacion en runtime (base de datos)
- Aplicacion de 006 sobre Supabase en vivo: OK. Conteos estables (licencias 3,
  dispositivos 28, planes 4, versiones 4, features 5, entitlements 5, asignaciones 3,
  instalaciones 28, tablas con RLS 14).
- Firmas confirmadas via `pg_proc`: las 10 funciones admin con argumentos `uuid`
  (sin sobrecargas `bigint` residuales).
- Ejecucion real (transaccion revertida) simulando JWT de admin:
  `is_app_admin()=true`; `admin_change_license_plan`, `admin_set_license_override`,
  `admin_record_payment`, `admin_publish_plan_version` y `admin_set_plan_status`
  devuelven `ok=true` y generan 5 filas en `audit_events`; tras ROLLBACK la tabla
  vuelve a 0 (sin efectos colaterales en la verificacion).
- Override de gracia leido por el RPC de validacion (verificado en FASE 11.2).

## 6. Pruebas en dispositivos
- No aplica cambio de cliente en esta fase (contrato del RPC aditivo). El flujo de
  validacion del cliente sigue operando con el RPC v2; los overrides por licencia se
  aplican del lado servidor sin requerir actualizacion del ejecutable.
- La verificacion funcional del panel (login admin, alta de plan/version, publicar,
  cambio de plan, override, pago, historial, desvincular PC) se realiza en el
  navegador con la sesion de Supabase del administrador.

## 7. Hallazgos y correcciones
- Hallazgo: la migracion 006 declaraba los identificadores de plan/version/pago como
  `bigint`, pero el esquema 002 los define como `uuid`. Se corrigieron todas las
  firmas y variables a `uuid`, se anadieron `DROP FUNCTION IF EXISTS` de las
  sobrecargas `bigint` previas y se re-aplico la migracion. Verificado por `pg_proc`.
- Hallazgo: el modal de plan incluia campos precio/periodicidad/enlace de pago sin
  columnas en `plans`. Se eliminaron para mantener coherencia con el esquema.

## 8. Componentes protegidos
- No se modifico ningun componente protegido (stream-renderer-h264.js, flow-touch.js,
  pipelines scrcpy/H.264, sesiones Grid/Focus, CoordinateMapper, presets, control
  scrcpy, fallback ADB, etc.). Los cambios se limitan al panel web y a funciones SQL.

## 9. Coherencia codigo-runtime-documentacion
- El panel consume exclusivamente el modelo comercial real (tablas y RPCs de las
  migraciones 002-006). Las acciones criticas pasan por RPC con auditoria.
- El RPC de validacion documentado (schema_version 2, reason_code, plan/limites/
  gracia) ahora incluye la prioridad de `license_overrides`, reflejado en este
  reporte y en los comentarios de la migracion.

## 10. Riesgos
- Las acciones admin dependen de que el usuario este en `app_admins`; un email no
  admin recibe "forbidden: admin required" (control correcto, no es un fallo).
- La gestion de features hace upsert masivo de entitlements por version; si se
  amplian features, el modal los toma dinamicamente de `state.features`.

## 11. Rollback
- Frontend: restaurar `license_admin.html` desde
  `restore_points/2026-06-27_PRE_FASE11_PANEL/`.
- Base de datos: `apply_migrations.py --rollback --only 006` (elimina RPCs admin y
  helpers; re-aplicar 004 si se desea el RPC de validacion sin overrides).

## 12. Evidencias
- `scripts/db/apply_migrations.py --only 006` -> OK, conteos estables.
- `pg_proc`: 10 funciones admin_* con firmas uuid, sin sobrecargas bigint.
- Ejecucion transaccional revertida: 5 RPCs ok + 5 filas de auditoria, ROLLBACK
  deja auditoria en 0.
- `get_diagnostics(license_admin.html)` -> 0 incidencias.

## 13. Configuracion y secretos
- Sin secretos nuevos. El panel usa la anon key publica (cliente) y la sesion del
  administrador (token Bearer) para autorizarse ante PostgREST/RPC.
- Scripts de verificacion temporales (`scripts/db/_*.py`) estan gitignorados y no
  contienen secretos embebidos (leen `.supabase_db_url`).

## 14. Checklist de aceptacion
- [x] Plan Studio: CRUD de planes y versiones, features/entitlements, publicar,
      activar/retirar.
- [x] Licencias: cambio de plan, override de gracia/limite, registro de pago e
      historial via RPC.
- [x] PCs: aprobar/bloquear/revocar/renombrar/desvincular via RPC con auditoria.
- [x] Pestana Auditoria (solo lectura de audit_events).
- [x] Migracion 006 aplicada y verificada (firmas uuid, ejecucion real).
- [x] Sin componentes protegidos modificados.
- [x] Punto de restauracion y rollback de BD disponibles.
- [x] Diagnosticos del panel sin incidencias.

## 15. Conclusion y siguiente fase
La FASE 11 deja el panel comercial completo y trazable, con todas las operaciones
criticas mediadas por RPCs administrativos auditados y el modelo de planes/versiones
gestionable desde la interfaz. Siguiente: FASE 12 (Entitlements en FlowDashboard),
que aplicara/observara los limites y la gracia del plan en el cliente a partir del
contrato del RPC de validacion v2.
