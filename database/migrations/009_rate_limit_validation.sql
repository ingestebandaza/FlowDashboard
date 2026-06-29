-- ============================================================================
-- FlowDashboard 2.0.0 - Migracion 009: Anti-abuso (rate-limit) en validate_flowdashboard_license
-- Aditiva e idempotente. NO cambia la firma del RPC (13 params) ni el contrato de
-- respuesta (status/device_status/reason_code/message/schema_version).
-- Objetivo: frenar fuerza bruta de claves de licencia desde el rol anon (unica
-- superficie expuesta). Se limita SOLO la rafaga de intentos 'license_not_found'
-- por device_hash e ip en una ventana corta; un usuario con licencia valida
-- (approved) o con licencia expirada/bloqueada NUNCA se ve afectado.
-- El conteo se hace sobre app_access_logs (ya existente). El evento de bloqueo se
-- registra con decision='throttled' para no realimentar el contador. Self-healing:
-- al envejecer los registros fuera de la ventana, el acceso se restablece solo.
-- ============================================================================

-- ---------- Indices parciales para el conteo (pequenos y selectivos) ----------
CREATE INDEX IF NOT EXISTS idx_app_access_logs_nf_device
  ON public.app_access_logs (device_hash, created_at)
  WHERE event_type = 'license_not_found';

CREATE INDEX IF NOT EXISTS idx_app_access_logs_nf_ip
  ON public.app_access_logs (ip, created_at)
  WHERE event_type = 'license_not_found';

-- ---------- CREATE OR REPLACE del RPC con bloque anti-abuso ----------
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
  v_max_pc        integer := NULL;
  v_max_android   integer := NULL;
  v_max_concurrent integer := NULL;
  v_offline_grace integer := 72;
  v_exp_grace     integer := 48;
  v_extra         jsonb;
  v_grace_flag    boolean := false;
  v_eff_status    text;
  v_recent_nf     integer := 0;
  v_rl_window_min integer := 10;
  v_rl_max_device integer := 8;
  v_rl_max_ip     integer := 25;
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

  -- Anti-abuso: frena rafagas de claves inexistentes (fuerza bruta) por dispositivo e IP.
  -- Solo cuenta 'license_not_found' recientes; no afecta a usuarios legitimos.
  IF p_device_hash <> '' THEN
    SELECT count(*) INTO v_recent_nf
      FROM public.app_access_logs
     WHERE device_hash = p_device_hash
       AND event_type = 'license_not_found'
       AND created_at > v_now - make_interval(mins => v_rl_window_min);
    IF v_recent_nf >= v_rl_max_device THEN
      INSERT INTO public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
      VALUES (v_now, v_now, p_license_key, p_device_email, 'rate_limited', 'device throttled', 'throttled', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, 'Demasiados intentos');
      RETURN jsonb_build_object('status', 'error', 'device_status', 'rate_limited',
        'reason_code', 'rate_limited', 'schema_version', 2,
        'message', 'Demasiados intentos fallidos. Espere unos minutos e intente de nuevo.');
    END IF;
  END IF;

  IF coalesce(p_ip_public, '') <> '' THEN
    SELECT count(*) INTO v_recent_nf
      FROM public.app_access_logs
     WHERE ip = p_ip_public
       AND event_type = 'license_not_found'
       AND created_at > v_now - make_interval(mins => v_rl_window_min);
    IF v_recent_nf >= v_rl_max_ip THEN
      INSERT INTO public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
      VALUES (v_now, v_now, p_license_key, p_device_email, 'rate_limited', 'ip throttled', 'throttled', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, 'Demasiados intentos');
      RETURN jsonb_build_object('status', 'error', 'device_status', 'rate_limited',
        'reason_code', 'rate_limited', 'schema_version', 2,
        'message', 'Demasiados intentos fallidos. Espere unos minutos e intente de nuevo.');
    END IF;
  END IF;

  SELECT * INTO v_license FROM public.app_licenses WHERE license_key = p_license_key LIMIT 1;

  IF NOT FOUND THEN
    v_message := 'Licencia invalida';
    INSERT INTO public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
    VALUES (v_now, v_now, p_license_key, p_device_email, 'license_not_found', v_message, 'denied', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);
    RETURN jsonb_build_object('status', 'error', 'device_status', 'missing',
      'reason_code', 'license_not_found', 'schema_version', 2, 'message', v_message);
  END IF;

  -- Cargar plan/limites/gracia (best-effort; si no hay asignacion, defaults legacy)
  SELECT p.code, p.name, v.max_pc_installations, v.max_android_devices,
         v.max_concurrent_android_devices, v.offline_grace_hours, v.expiration_grace_hours
    INTO v_plan_code, v_plan_name, v_max_pc, v_max_android, v_max_concurrent, v_offline_grace, v_exp_grace
    FROM public.license_plan_assignments a
    JOIN public.plans p ON p.id = a.plan_id
    JOIN public.plan_versions v ON v.id = a.plan_version_id
   WHERE a.license_id = v_license.id
   LIMIT 1;

  v_offline_grace := coalesce(v_offline_grace, 72);
  v_exp_grace := coalesce(v_exp_grace, 48);

  v_extra := jsonb_build_object(
    'schema_version', 2,
    'plan', jsonb_build_object('code', v_plan_code, 'name', v_plan_name),
    'limits', jsonb_build_object(
      'max_pc_installations', v_max_pc,
      'max_android_devices', v_max_android,
      'max_concurrent_android_devices', v_max_concurrent),
    'grace', jsonb_build_object(
      'offline_hours', v_offline_grace,
      'expiration_hours', v_exp_grace)
  );

  -- Estado de licencia
  IF lower(coalesce(v_license.status, '')) NOT IN ('active', 'approved') THEN
    v_message := 'Licencia ' || coalesce(v_license.status, 'inactiva');
    INSERT INTO public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
    VALUES (v_now, v_now, p_license_key, p_device_email, 'license_inactive', v_message, 'denied', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);
    RETURN jsonb_build_object('status', 'error', 'device_status', lower(coalesce(v_license.status, 'inactive')),
      'reason_code', 'license_inactive', 'message', v_message) || v_extra;
  END IF;

  -- Expiracion con gracia (server time)
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

  -- Limite efectivo de PCs: plan (si definido) o app_licenses.max_devices (legacy)
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
VALUES ('009_rate_limit_validation', 'Added anti-abuse rate limit (license_not_found bursts) by device/ip with partial indexes; signature and response contract unchanged');
