-- ============================================================================
-- FlowDashboard 2.0.0 - FASE 10 - Migracion 002: Modelo comercial + seed + legacy
-- Idempotente. Crea el modelo comercial (10B) y migra los datos legacy existentes.
-- app_licenses / app_devices siguen siendo la fuente de verdad (10A).
-- Limites NULL = ilimitado.
-- ============================================================================

-- ---------- Tablas del modelo comercial ----------

CREATE TABLE IF NOT EXISTS public.plans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,
  name         text NOT NULL,
  description  text,
  is_internal  boolean NOT NULL DEFAULT false,
  status       text NOT NULL DEFAULT 'draft',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plans_status_check CHECK (status IN ('active', 'draft', 'retired'))
);

CREATE TABLE IF NOT EXISTS public.plan_versions (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id                       uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  version                       integer NOT NULL,
  max_pc_installations          integer,
  max_android_devices           integer,
  max_concurrent_android_devices integer,
  offline_grace_hours           integer NOT NULL DEFAULT 72,
  expiration_grace_hours        integer NOT NULL DEFAULT 48,
  is_current                    boolean NOT NULL DEFAULT false,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_versions_unique UNIQUE (plan_id, version)
);

CREATE TABLE IF NOT EXISTS public.features (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,
  name         text NOT NULL,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plan_feature_entitlements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id  uuid NOT NULL REFERENCES public.plan_versions(id) ON DELETE CASCADE,
  feature_id       uuid NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  enabled          boolean NOT NULL DEFAULT true,
  limit_value      integer,
  CONSTRAINT plan_feature_entitlements_unique UNIQUE (plan_version_id, feature_id)
);

CREATE TABLE IF NOT EXISTS public.license_plan_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id       uuid NOT NULL UNIQUE REFERENCES public.app_licenses(id) ON DELETE CASCADE,
  plan_id          uuid NOT NULL REFERENCES public.plans(id),
  plan_version_id  uuid NOT NULL REFERENCES public.plan_versions(id),
  status           text NOT NULL DEFAULT 'active',
  assigned_at      timestamptz NOT NULL DEFAULT now(),
  assigned_by      text,
  notes            text,
  CONSTRAINT license_plan_assignments_status_check CHECK (status IN ('active', 'suspended', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.license_overrides (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id   uuid NOT NULL REFERENCES public.app_licenses(id) ON DELETE CASCADE,
  key          text NOT NULL,
  value        jsonb NOT NULL,
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   text,
  CONSTRAINT license_overrides_unique UNIQUE (license_id, key)
);

CREATE TABLE IF NOT EXISTS public.license_installations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id     uuid NOT NULL REFERENCES public.app_licenses(id) ON DELETE CASCADE,
  device_hash    text NOT NULL,
  hostname       text,
  windows_user   text,
  mac_address    text,
  os_version     text,
  app_version    text,
  ip_public      text,
  status         text NOT NULL DEFAULT 'active',
  blocked_reason text,
  first_seen_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  unlinked_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT license_installations_unique UNIQUE (license_id, device_hash),
  CONSTRAINT license_installations_status_check CHECK (status IN ('active', 'unlinked', 'blocked', 'revoked'))
);

CREATE TABLE IF NOT EXISTS public.payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id    uuid NOT NULL REFERENCES public.app_licenses(id) ON DELETE CASCADE,
  amount        numeric(12,2),
  currency      text DEFAULT 'USD',
  method        text,
  reference     text,
  period_start  timestamptz,
  period_end    timestamptz,
  paid_at       timestamptz,
  notes         text,
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id            bigserial PRIMARY KEY,
  actor         text,
  action        text NOT NULL,
  entity_type   text,
  entity_id     text,
  details       jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_versions_plan ON public.plan_versions(plan_id);
CREATE INDEX IF NOT EXISTS idx_lpa_plan ON public.license_plan_assignments(plan_id);
CREATE INDEX IF NOT EXISTS idx_lic_installations_license ON public.license_installations(license_id);
CREATE INDEX IF NOT EXISTS idx_payments_license ON public.payments(license_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON public.audit_events(entity_type, entity_id);
