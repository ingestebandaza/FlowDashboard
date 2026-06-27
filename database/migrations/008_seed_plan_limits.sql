-- ============================================================================
-- FlowDashboard 2.0.0 - Migracion 008: Limites recomendados de planes comerciales
-- Aditiva e idempotente. NO cambia firma de validate_flowdashboard_license.
-- 1) Activa STARTER / GROWTH / ENTERPRISE (status 'draft' -> 'active').
-- 2) Fija limites recomendados en la version vigente (is_current) de cada plan.
--    Limites NULL = ilimitado. Todo esto es ajustable luego desde el panel admin.
-- 3) Habilita TODAS las features en la version vigente de cada plan (igual que
--    LEGACY_FULL). La diferenciacion comercial se hace por limites de dispositivos
--    e instalaciones; las features se afinan despues desde el panel.
-- Recomendacion de limites (ajustable desde el panel de administracion):
--    STARTER     -> 1 PC,  5 Android,  5 concurrentes
--    GROWTH      -> 2 PC, 20 Android, 20 concurrentes
--    ENTERPRISE  -> ilimitado (NULL en todos)
-- ============================================================================

-- ---------- 1) Activar planes comerciales ----------
UPDATE public.plans
SET status = 'active', updated_at = now()
WHERE code IN ('STARTER', 'GROWTH', 'ENTERPRISE')
  AND status <> 'active';

-- ---------- 2) Limites en la version vigente de cada plan ----------
UPDATE public.plan_versions v
SET max_pc_installations           = 1,
    max_android_devices            = 5,
    max_concurrent_android_devices = 5
FROM public.plans p
WHERE v.plan_id = p.id AND p.code = 'STARTER' AND v.is_current = true;

UPDATE public.plan_versions v
SET max_pc_installations           = 2,
    max_android_devices            = 20,
    max_concurrent_android_devices = 20
FROM public.plans p
WHERE v.plan_id = p.id AND p.code = 'GROWTH' AND v.is_current = true;

UPDATE public.plan_versions v
SET max_pc_installations           = NULL,
    max_android_devices            = NULL,
    max_concurrent_android_devices = NULL
FROM public.plans p
WHERE v.plan_id = p.id AND p.code = 'ENTERPRISE' AND v.is_current = true;

-- ---------- 3) Habilitar TODAS las features en cada plan vigente ----------
INSERT INTO public.plan_feature_entitlements (plan_version_id, feature_id, enabled, limit_value)
SELECT v.id, f.id, true, NULL
FROM public.plan_versions v
JOIN public.plans p ON p.id = v.plan_id
  AND p.code IN ('STARTER', 'GROWTH', 'ENTERPRISE')
  AND v.is_current = true
CROSS JOIN public.features f
WHERE NOT EXISTS (
  SELECT 1 FROM public.plan_feature_entitlements e
  WHERE e.plan_version_id = v.id AND e.feature_id = f.id
);

INSERT INTO flow_backup_v2.migration_meta (step, notes)
VALUES ('008_seed_plan_limits', 'Activated STARTER/GROWTH/ENTERPRISE with recommended limits and full feature entitlements');
