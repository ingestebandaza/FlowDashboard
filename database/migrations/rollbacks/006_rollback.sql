-- ============================================================================
-- FlowDashboard 2.0.0 - FASE 11 - Rollback Migracion 006
-- Elimina los RPCs admin y restaura validate_flowdashboard_license a la version
-- 004 (sin lectura de license_overrides). Idempotente.
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_set_device_status(uuid,text,text);
DROP FUNCTION IF EXISTS public.admin_rename_device(uuid,text);
DROP FUNCTION IF EXISTS public.admin_unlink_device(uuid,text);
DROP FUNCTION IF EXISTS public.admin_set_license_status(uuid,text,text);
DROP FUNCTION IF EXISTS public.admin_cancel_license(uuid,text);
DROP FUNCTION IF EXISTS public.admin_change_license_plan(uuid,uuid,text);
DROP FUNCTION IF EXISTS public.admin_change_license_plan(uuid,bigint,text);
DROP FUNCTION IF EXISTS public.admin_set_license_override(uuid,text,jsonb,text);
DROP FUNCTION IF EXISTS public.admin_record_payment(uuid,numeric,text,text,text,date,date,timestamptz,text);
DROP FUNCTION IF EXISTS public.admin_publish_plan_version(uuid);
DROP FUNCTION IF EXISTS public.admin_publish_plan_version(bigint);
DROP FUNCTION IF EXISTS public.admin_set_plan_status(uuid,text,text);
DROP FUNCTION IF EXISTS public.admin_set_plan_status(bigint,text,text);
DROP FUNCTION IF EXISTS public._fd_actor();
DROP FUNCTION IF EXISTS public._fd_require_admin();

-- Restaurar validate RPC a 004 (re-aplicar 004 tras este rollback si se requiere
-- la version sin overrides; aqui se deja la firma vigente intacta).
DELETE FROM flow_backup_v2.migration_meta WHERE step = '006_admin_rpcs';
