-- ============================================================================
-- FlowDashboard 2.0.0 - FASE 10 - Rollback de la migracion 003 (seed + legacy)
-- Elimina los datos sembrados/migrados sin tocar la estructura (002) ni los
-- datos legacy originales (app_licenses / app_devices permanecen intactos).
-- Idempotente.
-- ============================================================================

DELETE FROM public.license_installations
WHERE license_id IN (SELECT license_id FROM public.license_plan_assignments);

DELETE FROM public.license_plan_assignments;

DELETE FROM public.plan_feature_entitlements;

DELETE FROM public.features
WHERE code IN ('grid_view', 'focus_view', 'live_control', 'presets', 'multi_device');

DELETE FROM public.plan_versions
WHERE plan_id IN (SELECT id FROM public.plans
                  WHERE code IN ('LEGACY_FULL', 'STARTER', 'GROWTH', 'ENTERPRISE'));

DELETE FROM public.plans
WHERE code IN ('LEGACY_FULL', 'STARTER', 'GROWTH', 'ENTERPRISE');

DELETE FROM flow_backup_v2.migration_meta WHERE step = '003_seed_migrate_legacy';
