-- ============================================================================
-- FlowDashboard 2.0.0 - FASE 12 - Migracion 007: Entitlements (matriz de features)
-- Aditiva y idempotente. NO cambia firma de validate_flowdashboard_license (13 params).
-- 1) Siembra los feature codes de la matriz FASE 12 (ON CONFLICT DO NOTHING).
-- 2) Habilita TODAS las features en la version vigente de LEGACY_FULL (clientes
--    legacy conservan acceso total -> sin regresion comercial).
-- 3) CREATE OR REPLACE de la RPC para AÑADIR 'features' (array de codes habilitados)
--    al objeto de respuesta. Preserva plan/limits/grace/overrides/reason_code.
-- Si una licencia no tiene asignacion de plan -> features = [] (cliente fail-open).
-- ============================================================================

-- ---------- 1) Catalogo de features de la matriz FASE 12 ----------
INSERT INTO public.features (code, name, description)
VALUES
  ('core.dashboard',          'Dashboard',                 'Acceso al panel principal.'),
  ('devices.grid',            'Vista Grid',                'Visualizacion simultanea de dispositivos.'),
  ('devices.focus',           'Vista Focus',               'Control individual a pantalla completa.'),
  ('control.touch',           'Control tactil',            'Taps, swipes, drag y gestos en vivo.'),
  ('control.keyboard',        'Teclado',                   'Entrada de teclado en vivo.'),
  ('flowlogin.execute',       'FlowLogin',                 'Ejecucion de inicios de sesion automatizados.'),
  ('flowregister.execute',    'FlowRegister',              'Ejecucion de registros automatizados.'),
  ('adb.presets',             'Presets ADB',               'Automatizaciones y secuencias guardadas.'),
  ('adb.shell',               'Shell ADB',                 'Acceso a shell de dispositivos.'),
  ('adb.bulk',                'ADB en lote',               'Operaciones ADB sobre multiples dispositivos.'),
  ('files.push',              'Envio de archivos',         'Transferencia de archivos a dispositivos.'),
  ('apps.manage',             'Gestion de apps',           'Instalar, desinstalar y administrar apps.'),
  ('flowagent.install',       'Instalar FlowAgent',        'Instalacion del agente en dispositivos.'),
  ('autojs.execute',          'AutoJS',                    'Ejecucion de scripts AutoJS.'),
  ('flowkeyboard.use',        'FlowKeyboard',              'Uso del teclado FlowKeyboard.'),
  ('inspector.tree',          'Inspector arbol',           'Inspeccion de jerarquia de vistas.'),
  ('inspector.native',        'Inspector nativo',          'Inspeccion nativa.'),
  ('inspector.accessibility', 'Inspector accesibilidad',   'Inspeccion via accesibilidad.'),
  ('inspector.web',           'Inspector web',             'Inspeccion de contenido web.'),
  ('inspector.ocr',           'Inspector OCR',             'Reconocimiento optico de texto.'),
  ('inspector.hybrid',        'Inspector hibrido',         'Inspeccion combinada.'),
  ('recording.video',         'Grabacion de video',        'Grabacion de pantalla.'),
  ('actions.replicate',       'Replicar acciones',         'Replicacion de acciones entre dispositivos.'),
  ('power.reboot',            'Reiniciar',                 'Reinicio de dispositivos.'),
  ('power.shutdown',          'Apagar',                    'Apagado de dispositivos.')
ON CONFLICT (code) DO NOTHING;

-- ---------- 2) LEGACY_FULL habilita TODAS las features (incluidas las nuevas) ----------
INSERT INTO public.plan_feature_entitlements (plan_version_id, feature_id, enabled, limit_value)
SELECT v.id, f.id, true, NULL
FROM public.plan_versions v
JOIN public.plans p ON p.id = v.plan_id AND p.code = 'LEGACY_FULL'
CROSS JOIN public.features f
WHERE NOT EXISTS (
  SELECT 1 FROM public.plan_feature_entitlements e
  WHERE e.plan_version_id = v.id AND e.feature_id = f.id
);

-- ---------- 3) RPC: añadir 'features' (codes habilitados del plan asignado) ----------
CREATE OR REPLACE FUNCTION public.validate_flowdashboard_license(
  p_device_email   text,
  p_license_key    text,
  p_device_hostname text DEFAULT ''::text,
  p_device_serial  text DEFAULT ''::text,
  p_device_os      text DEFAULT ''::text,
  p_ip_public      text DEFAULT ''::text,
  p_country_code   text DEFAULT ''::text,
  p_device_hash    text DEFAULT ''::text,
  p_windows_user   text DEFAULT ''::text,
  p_app_version    text DEFAULT ''::text,
  p_local_ip       text DEFAULT ''::text,
  p_mac_address    text DEFAULT ''::text,
  p_country_name   text DEFAULT ''::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_license       public.app_licenses%rowtype;
  v_device        public.app_devices%rowtype;
  v_registration  public.app_device_registrations%rowtype;
  v_now           timestamptz := now();
  v_message       text := '';
  v_device_count  integer := 0;
  v_max_devices   integer := 1;
  v_plan_code     text := NULL;
  v_plan_name     text := NULL;
  v_plan_version_id uuid := NULL;
  v_max_pc        integer := NULL;
  v_max_android   integer := NULL;
  v_max_concurrent integer := NULL;
  v_offline_grace integer := 72;
  v_exp_grace     integer := 48;
  v_ovr_pc        integer := NULL;
  v_ovr_offline   integer := NULL;
  v_ovr_exp       integer := NULL;
  v_features      jsonb := '[]'::jsonb;
  v_extra         jsonb;
  v_grace_flag    boolean := false;
BEGIN
  p_device_email := lower(trim(coalesce(p_device_email, '')));
  p_license_key := trim(coalesce(p_license_key, ''));
  p_device_hostname := trim(coalesce(p_device_hostname, ''));
  p_windows_user := trim(coalesce(p_windows_user, ''));
  p_device_hash := trim(coalesce(p_device_hash, ''));
  p_app_version := trim(coalesce(p_app_version, ''));
  p_local_ip := trim(coalesce(p_local_ip, ''));
  p_mac_address := trim(coalesce(p_mac_address, ''));
  p_country_name := trim(coalesce(p_country_name, ''));

  IF p_device_hash = '' THEN
    p_device_hash := md5(p_device_email || '|' || p_device_hostname || '|' || p_windows_user);
  END IF;

  IF p_device_email = '' OR p_license_key = '' THEN
    RETURN jsonb_build_object('status', 'error', 'device_status', 'missing',
      'reason_code', 'missing_input', 'schema_version', 2, 'message', 'Email y licencia requeridos');
  END IF;

  SELECT * INTO v_license FROM public.app_licenses WHERE license_key = p_license_key LIMIT 1;

  IF NOT FOUND THEN
    v_message := 'Licencia invalida';
    INSERT INTO public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
    VALUES (v_now, v_now, p_license_key, p_device_email, 'license_not_found', v_message, 'denied', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);
    RETURN jsonb_build_object('status', 'error', 'device_status', 'missing',
      'reason_code', 'license_not_found', 'schema_version', 2, 'message', v_message);
  END IF;

  SELECT p.code, p.name, a.plan_version_id, v.max_pc_installations, v.max_android_devices,
         v.max_concurrent_android_devices, v.offline_grace_hours, v.expiration_grace_hours
    INTO v_plan_code, v_plan_name, v_plan_version_id, v_max_pc, v_max_android, v_max_concurrent, v_offline_grace, v_exp_grace
    FROM public.license_plan_assignments a
    JOIN public.plans p ON p.id = a.plan_id
    JOIN public.plan_versions v ON v.id = a.plan_version_id
   WHERE a.license_id = v_license.id
   LIMIT 1;

  v_offline_grace := coalesce(v_offline_grace, 72);
  v_exp_grace := coalesce(v_exp_grace, 48);

  IF v_plan_version_id IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(f.code ORDER BY f.code), '[]'::jsonb)
      INTO v_features
      FROM public.plan_feature_entitlements e
      JOIN public.features f ON f.id = e.feature_id
     WHERE e.plan_version_id = v_plan_version_id AND e.enabled = true;
  END IF;

  SELECT
    max(CASE WHEN key = 'max_pc_installations' THEN (value #>> '{}')::int END),
    max(CASE WHEN key = 'offline_grace_hours' THEN (value #>> '{}')::int END),
    max(CASE WHEN key = 'expiration_grace_hours' THEN (value #>> '{}')::int END)
    INTO v_ovr_pc, v_ovr_offline, v_ovr_exp
    FROM public.license_overrides WHERE license_id = v_license.id;

  IF v_ovr_pc IS NOT NULL THEN v_max_pc := v_ovr_pc; END IF;
  IF v_ovr_offline IS NOT NULL THEN v_offline_grace := v_ovr_offline; END IF;
  IF v_ovr_exp IS NOT NULL THEN v_exp_grace := v_ovr_exp; END IF;

  v_extra := jsonb_build_object(
    'schema_version', 2,
    'plan', jsonb_build_object('code', v_plan_code, 'name', v_plan_name),
    'features', v_features,
    'limits', jsonb_build_object(
      'max_pc_installations', v_max_pc,
      'max_android_devices', v_max_android,
      'max_concurrent_android_devices', v_max_concurrent),
    'grace', jsonb_build_object(
      'offline_hours', v_offline_grace,
      'expiration_hours', v_exp_grace)
  );

  IF lower(coalesce(v_license.status, '')) NOT IN ('active', 'approved') THEN
    v_message := 'Licencia ' || coalesce(v_license.status, 'inactiva');
    INSERT INTO public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
    VALUES (v_now, v_now, p_license_key, p_device_email, 'license_inactive', v_message, 'denied', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);
    RETURN jsonb_build_object('status', 'error', 'device_status', lower(coalesce(v_license.status, 'inactive')),
      'reason_code', 'license_inactive', 'message', v_message) || v_extra;
  END IF;

  IF v_license.expires_at IS NOT NULL THEN
    IF v_license.expires_at + make_interval(hours => v_exp_grace) < v_now THEN
      v_message := 'Licencia expirada';
      INSERT INTO public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
      VALUES (v_now, v_now, p_license_key, p_device_email, 'license_expired', v_message, 'denied', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);
      RETURN jsonb_build_object('status', 'error', 'device_status', 'expired',
        'reason_code', 'license_expired', 'message', v_message) || v_extra;
    ELSIF v_license.expires_at < v_now THEN
      v_grace_flag := true;
    END IF;
  END IF;

  v_max_devices := greatest(coalesce(v_max_pc, v_license.max_devices, 1), 1);

  SELECT * INTO v_device FROM public.app_devices
   WHERE license_id = v_license.id AND device_hash = p_device_hash LIMIT 1;

  IF FOUND THEN
    IF lower(coalesce(v_device.status, '')) IN ('blocked', 'revoked') THEN
      v_message := 'PC bloqueada';
      INSERT INTO public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
      VALUES (v_now, v_now, p_license_key, p_device_email, 'device_blocked', v_message, 'blocked', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);
      RETURN jsonb_build_object('status', 'error', 'device_status', 'blocked',
        'reason_code', 'device_blocked', 'message', v_message) || v_extra;
    END IF;

    UPDATE public.app_devices
       SET pc_name = coalesce(nullif(p_device_hostname, ''), pc_name),
           windows_user = coalesce(nullif(p_windows_user, ''), windows_user),
           ip = coalesce(nullif(p_ip_public, ''), ip),
           local_ip = coalesce(nullif(p_local_ip, ''), local_ip),
           mac_address = coalesce(nullif(p_mac_address, ''), mac_address),
           country = coalesce(nullif(p_country_code, ''), country),
           country_name = coalesce(nullif(p_country_name, ''), country_name),
           app_version = coalesce(nullif(p_app_version, ''), app_version),
           last_seen_at = v_now
     WHERE id = v_device.id;

    PERFORM public._fd_sync_installation(v_license.id, p_device_hash, p_device_hostname,
      p_windows_user, p_mac_address, p_device_os, p_app_version, p_ip_public, v_now);

    v_message := CASE WHEN v_grace_flag THEN 'Dispositivo aprobado (gracia de expiracion)' ELSE 'Dispositivo aprobado' END;
    INSERT INTO public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
    VALUES (v_now, v_now, p_license_key, p_device_email, 'device_seen', NULL, 'approved', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);

    RETURN jsonb_build_object('status', 'success', 'device_status', coalesce(v_device.status, 'approved'),
      'reason_code', CASE WHEN v_grace_flag THEN 'expiration_grace' ELSE 'device_seen' END, 'message', v_message) || v_extra;
  END IF;

  SELECT count(*) INTO v_device_count FROM public.app_devices
   WHERE license_id = v_license.id
     AND lower(coalesce(status, 'approved')) NOT IN ('blocked', 'revoked');

  IF v_device_count >= v_max_devices THEN
    v_message := 'Limite de PCs alcanzado';
    INSERT INTO public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
    VALUES (v_now, v_now, p_license_key, p_device_email, 'device_limit_reached', v_message, 'denied', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);
    RETURN jsonb_build_object('status', 'error', 'device_status', 'limit_reached',
      'reason_code', 'pc_limit_reached', 'message', v_message) || v_extra;
  END IF;

  INSERT INTO public.app_devices (license_id, pc_name, windows_user, device_hash, ip, local_ip, mac_address, country, country_name, app_version, status, created_at, last_seen_at)
  VALUES (v_license.id, p_device_hostname, p_windows_user, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, 'approved', v_now, v_now);

  PERFORM public._fd_sync_installation(v_license.id, p_device_hash, p_device_hostname,
    p_windows_user, p_mac_address, p_device_os, p_app_version, p_ip_public, v_now);

  SELECT * INTO v_registration FROM public.app_device_registrations
   WHERE device_email = p_device_email AND license_key = p_license_key LIMIT 1;

  IF FOUND THEN
    UPDATE public.app_device_registrations
       SET last_seen_at = v_now,
           device_hostname = coalesce(nullif(p_device_hostname, ''), device_hostname),
           device_serial = coalesce(nullif(p_device_serial, ''), device_serial),
           device_os = coalesce(nullif(p_device_os, ''), device_os),
           ip_public = coalesce(nullif(p_ip_public, ''), ip_public),
           local_ip = coalesce(nullif(p_local_ip, ''), local_ip),
           mac_address = coalesce(nullif(p_mac_address, ''), mac_address),
           country_code = coalesce(nullif(p_country_code, ''), country_code),
           country_name = coalesce(nullif(p_country_name, ''), country_name),
           status = 'approved'
     WHERE id = v_registration.id;
  ELSE
    INSERT INTO public.app_device_registrations (license_key, device_email, device_hostname, device_serial, device_os, ip_public, local_ip, mac_address, country_code, country_name, status, created_at, last_seen_at)
    VALUES (p_license_key, p_device_email, p_device_hostname, p_device_serial, p_device_os, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, 'approved', v_now, v_now);
  END IF;

  v_message := CASE WHEN v_grace_flag THEN 'Dispositivo aprobado (gracia de expiracion)' ELSE 'Dispositivo aprobado' END;
  INSERT INTO public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
  VALUES (v_now, v_now, p_license_key, p_device_email, 'device_registered', NULL, 'approved', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);

  INSERT INTO public.audit_events (actor, action, entity_type, entity_id, details)
  VALUES ('rpc', 'device_registered', 'license', v_license.id::text,
    jsonb_build_object('device_hash', p_device_hash, 'email', p_device_email, 'plan', v_plan_code));

  RETURN jsonb_build_object('status', 'success', 'device_status', 'approved',
    'reason_code', CASE WHEN v_grace_flag THEN 'expiration_grace' ELSE 'device_registered' END, 'message', v_message) || v_extra;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.validate_flowdashboard_license(text,text,text,text,text,text,text,text,text,text,text,text,text) TO anon, authenticated;

INSERT INTO flow_backup_v2.migration_meta (step, notes)
VALUES ('007_entitlements_features', 'Seed FASE12 feature matrix; LEGACY_FULL enables all; validate RPC returns features[]');
