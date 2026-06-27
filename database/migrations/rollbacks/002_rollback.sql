-- ============================================================================
-- FlowDashboard 2.0.0 - FASE 10 - Rollback de la migracion 002 (modelo comercial)
-- Elimina las tablas del modelo comercial. NO toca las tablas legacy
-- (app_licenses, app_devices, app_device_registrations, app_access_logs,
-- app_admins). Idempotente. CASCADE para resolver dependencias internas.
-- ============================================================================

DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.audit_events CASCADE;
DROP TABLE IF EXISTS public.license_installations CASCADE;
DROP TABLE IF EXISTS public.license_overrides CASCADE;
DROP TABLE IF EXISTS public.license_plan_assignments CASCADE;
DROP TABLE IF EXISTS public.plan_feature_entitlements CASCADE;
DROP TABLE IF EXISTS public.features CASCADE;
DROP TABLE IF EXISTS public.plan_versions CASCADE;
DROP TABLE IF EXISTS public.plans CASCADE;

DELETE FROM flow_backup_v2.migration_meta WHERE step = '002_commercial_model';
