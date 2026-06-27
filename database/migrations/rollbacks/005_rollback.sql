-- ROLLBACK 005: revertir RLS/grants al estado previo (RLS off, politicas permisivas, anon/authenticated)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['app_licenses','app_devices','app_device_registrations','app_access_logs','app_admins'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'admin_all', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['plans','plan_versions','features','plan_feature_entitlements','license_plan_assignments','license_overrides','license_installations','payments','audit_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'admin_all', t);
  END LOOP;
END $$;

-- Restaurar politicas permisivas originales en tablas legacy
CREATE POLICY "allow_all_authenticated_logs" ON public.app_access_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Anyone can insert logs" ON public.app_access_logs FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "app_admins_read_self" ON public.app_admins FOR SELECT TO authenticated USING (is_app_admin());
CREATE POLICY "Anyone can read registrations" ON public.app_device_registrations FOR SELECT TO public USING (true);
CREATE POLICY "allow_authenticated_device_registrations" ON public.app_device_registrations FOR ALL TO authenticated USING (true);
CREATE POLICY "allow_all_authenticated_devices" ON public.app_devices FOR ALL TO authenticated USING (true);
CREATE POLICY "Anyone can read licenses" ON public.app_licenses FOR SELECT TO public USING (true);
CREATE POLICY "allow_all_authenticated_licenses" ON public.app_licenses FOR ALL TO authenticated USING (true);

-- Restaurar EXECUTE de check_app_license
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='check_app_license') THEN
    GRANT EXECUTE ON FUNCTION public.check_app_license(text,text,text,text,text,text,text) TO anon, authenticated;
  END IF;
END $$;
