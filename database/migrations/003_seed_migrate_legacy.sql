-- ============================================================================
-- FlowDashboard 2.0.0 - FASE 10 - Migracion 003: Seed de planes/features + migracion legacy
-- Idempotente. Crea catalogo base y asigna las licencias existentes al plan interno
-- "Legacy Full Access". Limites NULL = ilimitado / defiere a app_licenses.max_devices.
-- ============================================================================

-- ---------- Planes ----------
INSERT INTO public.plans (code, name, description, is_internal, status)
VALUES
  ('LEGACY_FULL', 'Legacy Full Access', 'Plan interno para licencias previas a la migracion comercial. Sin restricciones nuevas.', true, 'active'),
  ('STARTER',    'Starter',    'Plan comercial inicial. Limites por definir en 10B.', false, 'draft'),
  ('GROWTH',     'Growth',     'Plan comercial intermedio. Limites por definir en 10B.', false, 'draft'),
  ('ENTERPRISE', 'Enterprise', 'Plan comercial avanzado. Limites por definir en 10B.', false, 'draft')
ON CONFLICT (code) DO NOTHING;

-- ---------- Versiones de plan (v1) ----------
-- LEGACY_FULL: limites NULL = ilimitado; PC se rige por app_licenses.max_devices.
INSERT INTO public.plan_versions
  (plan_id, version, max_pc_installations, max_android_devices, max_concurrent_android_devices, offline_grace_hours, expiration_grace_hours, is_current)
SELECT p.id, 1, NULL, NULL, NULL, 72, 48, true
FROM public.plans p
WHERE p.code = 'LEGACY_FULL'
  AND NOT EXISTS (SELECT 1 FROM public.plan_versions v WHERE v.plan_id = p.id AND v.version = 1);

INSERT INTO public.plan_versions
  (plan_id, version, max_pc_installations, max_android_devices, max_concurrent_android_devices, offline_grace_hours, expiration_grace_hours, is_current)
SELECT p.id, 1, NULL, NULL, NULL, 72, 48, true
FROM public.plans p
WHERE p.code IN ('STARTER', 'GROWTH', 'ENTERPRISE')
  AND NOT EXISTS (SELECT 1 FROM public.plan_versions v WHERE v.plan_id = p.id AND v.version = 1);

-- ---------- Catalogo de features ----------
INSERT INTO public.features (code, name, description)
VALUES
  ('grid_view',       'Vista Grid',            'Visualizacion simultanea de multiples dispositivos.'),
  ('focus_view',      'Vista Focus',           'Control individual a pantalla completa.'),
  ('live_control',    'Control en vivo',       'Taps, swipes, drag y teclas en tiempo real.'),
  ('presets',         'Presets',               'Automatizaciones y secuencias guardadas.'),
  ('multi_device',    'Multi-dispositivo',     'Gestion de varios dispositivos Android.')
ON CONFLICT (code) DO NOTHING;

-- ---------- Entitlements: LEGACY_FULL habilita todo ----------
INSERT INTO public.plan_feature_entitlements (plan_version_id, feature_id, enabled, limit_value)
SELECT v.id, f.id, true, NULL
FROM public.plan_versions v
JOIN public.plans p ON p.id = v.plan_id AND p.code = 'LEGACY_FULL'
CROSS JOIN public.features f
WHERE NOT EXISTS (
  SELECT 1 FROM public.plan_feature_entitlements e
  WHERE e.plan_version_id = v.id AND e.feature_id = f.id
);

-- ---------- Migracion de licencias existentes -> assignments ----------
INSERT INTO public.license_plan_assignments (license_id, plan_id, plan_version_id, status, assigned_by, notes)
SELECT l.id, p.id, v.id, 'active', 'migration_003', 'Migracion automatica de licencia legacy'
FROM public.app_licenses l
JOIN public.plans p ON p.code = 'LEGACY_FULL'
JOIN public.plan_versions v ON v.plan_id = p.id AND v.version = 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.license_plan_assignments a WHERE a.license_id = l.id
);

-- ---------- Migracion de dispositivos existentes -> installations ----------
INSERT INTO public.license_installations
  (license_id, device_hash, hostname, windows_user, mac_address, app_version, ip_public, status, first_seen_at, last_seen_at)
SELECT
  d.license_id,
  d.device_hash,
  d.pc_name,
  d.windows_user,
  d.mac_address,
  d.app_version,
  d.ip,
  CASE
    WHEN lower(coalesce(d.status, 'active')) IN ('blocked') THEN 'blocked'
    WHEN lower(coalesce(d.status, 'active')) IN ('revoked') THEN 'revoked'
    ELSE 'active'
  END,
  coalesce(d.first_seen_at, d.created_at, now()),
  coalesce(d.last_seen_at, now())
FROM public.app_devices d
WHERE d.license_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.license_installations i
    WHERE i.license_id = d.license_id AND i.device_hash = d.device_hash
  );

INSERT INTO flow_backup_v2.migration_meta (step, notes)
VALUES ('003_seed_migrate_legacy', 'Seeded plans/features and migrated legacy licenses/devices');
