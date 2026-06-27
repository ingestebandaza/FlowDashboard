-- ============================================================================
-- FlowDashboard 2.0.0 - Rollback Migracion 008
-- Revierte limites y entitlements de STARTER/GROWTH/ENTERPRISE y vuelve a 'draft'.
-- Idempotente. Devuelve los planes comerciales al estado previo (limites NULL).
-- ============================================================================

-- Quitar entitlements sembrados en la version vigente de los planes comerciales.
DELETE FROM public.plan_feature_entitlements e
USING public.plan_versions v, public.plans p
WHERE e.plan_version_id = v.id
  AND v.plan_id = p.id
  AND p.code IN ('STARTER', 'GROWTH', 'ENTERPRISE')
  AND v.is_current = true;

-- Restaurar limites a NULL (ilimitado) en la version vigente.
UPDATE public.plan_versions v
SET max_pc_installations           = NULL,
    max_android_devices            = NULL,
    max_concurrent_android_devices = NULL
FROM public.plans p
WHERE v.plan_id = p.id
  AND p.code IN ('STARTER', 'GROWTH', 'ENTERPRISE')
  AND v.is_current = true;

-- Devolver los planes comerciales a 'draft'.
UPDATE public.plans
SET status = 'draft', updated_at = now()
WHERE code IN ('STARTER', 'GROWTH', 'ENTERPRISE');

DELETE FROM flow_backup_v2.migration_meta WHERE step = '008_seed_plan_limits';
