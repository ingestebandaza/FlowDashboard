-- ============================================================================
-- FlowDashboard 2.0.0 - FASE 10 - Migracion 005: RLS, grants y retiro de legacy
-- Activa RLS en tablas legacy y comerciales. Politicas admin-only via is_app_admin().
-- El RPC (SECURITY DEFINER, owner postgres) ignora RLS y sigue operando.
-- anon: sin acceso directo a tablas; solo ejecuta el RPC de validacion.
-- Retira check_app_license (sin consumidores reales).
-- ============================================================================

-- ---------- Helper: politica admin_all reutilizable por tabla ----------
DO $$
DECLARE
  t text;
  legacy_tables text[] := ARRAY[
    'app_licenses','app_devices','app_device_registrations','app_access_logs','app_admins'];
  comm_tables text[] := ARRAY[
    'plans','plan_versions','features','plan_feature_entitlements',
    'license_plan_assignments','license_overrides','license_installations',
    'payments','audit_events'];
  all_tables text[];
BEGIN
  all_tables := legacy_tables || comm_tables;
  FOREACH t IN ARRAY all_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    -- Eliminar politicas permisivas previas si existen
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'admin_all', t);
    -- Politica unica admin-only (CRUD completo solo para admins autenticados)
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());',
      'admin_all', t);
  END LOOP;

  -- Quitar politicas permisivas heredadas (anon/public/authenticated abiertas)
  FOREACH t IN ARRAY legacy_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'allow_all_authenticated_logs', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'allow_all_authenticated_devices', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'allow_all_authenticated_licenses', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'allow_authenticated_device_registrations', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'Anyone can read licenses', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'Anyone can read registrations', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'Anyone can insert logs', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'app_admins_read_self', t);
  END LOOP;
END $$;

-- ---------- Revocar acceso directo de anon/authenticated a tablas ----------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'app_licenses','app_devices','app_device_registrations','app_access_logs','app_admins',
    'plans','plan_versions','features','plan_feature_entitlements',
    'license_plan_assignments','license_overrides','license_installations',
    'payments','audit_events'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon;', t);
    -- authenticated mantiene CRUD a nivel grant; RLS lo restringe a admins
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
  END LOOP;
END $$;

GRANT USAGE, SELECT ON SEQUENCE public.audit_events_id_seq TO authenticated;
REVOKE ALL ON SEQUENCE public.audit_events_id_seq FROM anon;

-- ---------- Retirar check_app_license (sin consumidores) ----------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'check_app_license'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.check_app_license(text,text,text,text,text,text,text) FROM anon, authenticated, PUBLIC;
  END IF;
END $$;

INSERT INTO flow_backup_v2.migration_meta (step, notes)
VALUES ('005_rls_grants_cutover', 'Enabled RLS, admin-only policies, revoked anon, retired check_app_license');
