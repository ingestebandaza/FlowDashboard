-- ============================================================================
-- SCRIPT LIMPIO PARA SUPABASE - VALIDACIÓN DE LICENCIAS
-- ============================================================================
-- IMPORTANTE: Ejecutar en Supabase SQL Editor como propietario del proyecto
-- Este script limpia las funciones duplicadas y crea la función correctamente
-- ============================================================================

-- PASO 1: Verificar que pgcrypto está habilitada
-- Si ves un error aquí, significa que pgcrypto no está disponible
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- PASO 2: Eliminar las funciones duplicadas (si existen)
-- Esto evita conflictos con versiones anteriores
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text, text, text);

-- PASO 3: Agregar columnas a app_devices (si no existen)
ALTER TABLE public.app_devices
  ADD COLUMN IF NOT EXISTS license_id uuid,
  ADD COLUMN IF NOT EXISTS pc_name text,
  ADD COLUMN IF NOT EXISTS windows_user text,
  ADD COLUMN IF NOT EXISTS device_hash text,
  ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS local_ip text,
  ADD COLUMN IF NOT EXISTS mac_address text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS country_name text,
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();

-- PASO 4: Agregar columnas a app_access_logs (si no existen)
ALTER TABLE public.app_access_logs
  ADD COLUMN IF NOT EXISTS license_key text,
  ADD COLUMN IF NOT EXISTS device_email text,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS "timestamp" timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS decision text,
  ADD COLUMN IF NOT EXISTS pc_name text,
  ADD COLUMN IF NOT EXISTS device_hash text,
  ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS local_ip text,
  ADD COLUMN IF NOT EXISTS mac_address text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS country_name text,
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS message text;

-- PASO 5: Agregar columnas a app_device_registrations (si no existen)
ALTER TABLE public.app_device_registrations
  ADD COLUMN IF NOT EXISTS license_key text,
  ADD COLUMN IF NOT EXISTS device_email text,
  ADD COLUMN IF NOT EXISTS device_hostname text,
  ADD COLUMN IF NOT EXISTS device_serial text,
  ADD COLUMN IF NOT EXISTS device_os text,
  ADD COLUMN IF NOT EXISTS ip_public text,
  ADD COLUMN IF NOT EXISTS local_ip text,
  ADD COLUMN IF NOT EXISTS mac_address text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS country_name text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();

-- PASO 6: Crear la función validate_flowdashboard_license
-- Esta es la versión correcta con pgcrypto habilitada
CREATE OR REPLACE FUNCTION public.validate_flowdashboard_license(
  p_device_email text,
  p_license_key text,
  p_device_hostname text DEFAULT '',
  p_device_serial text DEFAULT '',
  p_device_os text DEFAULT '',
  p_ip_public text DEFAULT '',
  p_country_code text DEFAULT '',
  p_device_hash text DEFAULT '',
  p_windows_user text DEFAULT '',
  p_app_version text DEFAULT '',
  p_local_ip text DEFAULT '',
  p_mac_address text DEFAULT '',
  p_country_name text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_license public.app_licenses%rowtype;
  v_device public.app_devices%rowtype;
  v_registration public.app_device_registrations%rowtype;
  v_now timestamptz := now();
  v_message text := '';
  v_device_count integer := 0;
  v_max_devices integer := 1;
BEGIN
  -- Normalizar inputs
  p_device_email := lower(trim(coalesce(p_device_email, '')));
  p_license_key := trim(coalesce(p_license_key, ''));
  p_device_hostname := trim(coalesce(p_device_hostname, ''));
  p_windows_user := trim(coalesce(p_windows_user, ''));
  p_device_hash := trim(coalesce(p_device_hash, ''));
  p_app_version := trim(coalesce(p_app_version, ''));
  p_local_ip := trim(coalesce(p_local_ip, ''));
  p_mac_address := trim(coalesce(p_mac_address, ''));
  p_country_name := trim(coalesce(p_country_name, ''));

  -- Generar device_hash si no se proporciona
  IF p_device_hash = '' THEN
    p_device_hash := encode(digest(p_device_email || '|' || p_device_hostname || '|' || p_windows_user, 'sha256'), 'hex');
  END IF;

  -- Validar inputs requeridos
  IF p_device_email = '' OR p_license_key = '' THEN
    RETURN jsonb_build_object('status', 'error', 'device_status', 'missing', 'message', 'Email y licencia requeridos');
  END IF;

  -- Buscar licencia
  SELECT *
    INTO v_license
    FROM public.app_licenses
   WHERE license_key = p_license_key
   LIMIT 1;

  IF NOT FOUND THEN
    v_message := 'Licencia invalida';
    INSERT INTO public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
    VALUES (v_now, v_now, p_license_key, p_device_email, 'license_not_found', v_message, 'denied', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);
    RETURN jsonb_build_object('status', 'error', 'device_status', 'missing', 'message', v_message);
  END IF;

  -- Validar estado de licencia
  IF lower(coalesce(v_license.status, '')) NOT IN ('active', 'approved') THEN
    v_message := 'Licencia ' || coalesce(v_license.status, 'inactiva');
    INSERT INTO public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
    VALUES (v_now, v_now, p_license_key, p_device_email, 'license_inactive', v_message, 'denied', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);
    RETURN jsonb_build_object('status', 'error', 'device_status', lower(coalesce(v_license.status, 'inactive')), 'message', v_message);
  END IF;

  -- Validar expiración de licencia
  IF v_license.expires_at IS NOT NULL AND v_license.expires_at < v_now THEN
    v_message := 'Licencia expirada';
    INSERT INTO public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
    VALUES (v_now, v_now, p_license_key, p_device_email, 'license_expired', v_message, 'denied', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);
    RETURN jsonb_build_object('status', 'error', 'device_status', 'expired', 'message', v_message);
  END IF;

  -- Obtener máximo de dispositivos
  v_max_devices := greatest(coalesce(v_license.max_devices, 1), 1);

  -- Buscar dispositivo existente
  SELECT *
    INTO v_device
    FROM public.app_devices
   WHERE license_id = v_license.id
     AND device_hash = p_device_hash
   LIMIT 1;

  IF FOUND THEN
    -- Dispositivo ya existe
    IF lower(coalesce(v_device.status, '')) IN ('blocked', 'revoked') THEN
      v_message := 'PC bloqueada';
      INSERT INTO public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
      VALUES (v_now, v_now, p_license_key, p_device_email, 'device_blocked', v_message, 'blocked', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);
      RETURN jsonb_build_object('status', 'error', 'device_status', 'blocked', 'message', v_message);
    END IF;

    -- Actualizar dispositivo existente
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

    v_message := 'Dispositivo aprobado';
    INSERT INTO public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
    VALUES (v_now, v_now, p_license_key, p_device_email, 'device_seen', NULL, 'approved', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);

    RETURN jsonb_build_object('status', 'success', 'device_status', coalesce(v_device.status, 'approved'), 'message', v_message);
  END IF;

  -- Contar dispositivos existentes
  SELECT count(*)
    INTO v_device_count
    FROM public.app_devices
   WHERE license_id = v_license.id
     AND lower(coalesce(status, 'approved')) NOT IN ('blocked', 'revoked');

  -- Validar límite de dispositivos
  IF v_device_count >= v_max_devices THEN
    v_message := 'Limite de PCs alcanzado';
    INSERT INTO public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
    VALUES (v_now, v_now, p_license_key, p_device_email, 'device_limit_reached', v_message, 'denied', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);
    RETURN jsonb_build_object('status', 'error', 'device_status', 'limit_reached', 'message', v_message);
  END IF;

  -- Registrar nuevo dispositivo
  INSERT INTO public.app_devices (
    license_id,
    pc_name,
    windows_user,
    device_hash,
    ip,
    local_ip,
    mac_address,
    country,
    country_name,
    app_version,
    status,
    created_at,
    last_seen_at
  )
  VALUES (
    v_license.id,
    p_device_hostname,
    p_windows_user,
    p_device_hash,
    p_ip_public,
    p_local_ip,
    p_mac_address,
    p_country_code,
    p_country_name,
    p_app_version,
    'approved',
    v_now,
    v_now
  );

  -- Buscar registro de dispositivo
  SELECT *
    INTO v_registration
    FROM public.app_device_registrations
   WHERE device_email = p_device_email
     AND license_key = p_license_key
   LIMIT 1;

  IF FOUND THEN
    -- Actualizar registro existente
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
    -- Crear nuevo registro
    INSERT INTO public.app_device_registrations (
      license_key,
      device_email,
      device_hostname,
      device_serial,
      device_os,
      ip_public,
      local_ip,
      mac_address,
      country_code,
      country_name,
      status,
      created_at,
      last_seen_at
    )
    VALUES (
      p_license_key,
      p_device_email,
      p_device_hostname,
      p_device_serial,
      p_device_os,
      p_ip_public,
      p_local_ip,
      p_mac_address,
      p_country_code,
      p_country_name,
      'approved',
      v_now,
      v_now
    );
  END IF;

  -- Registrar acceso exitoso
  v_message := 'Dispositivo aprobado';
  INSERT INTO public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
  VALUES (v_now, v_now, p_license_key, p_device_email, 'device_registered', NULL, 'approved', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);

  RETURN jsonb_build_object('status', 'success', 'device_status', 'approved', 'message', v_message);
END;
$$;

-- PASO 7: Configurar permisos
-- Revocar todos los permisos
REVOKE ALL ON FUNCTION public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text, text, text) FROM public;

-- Otorgar permisos a usuarios anónimos y autenticados
GRANT EXECUTE ON FUNCTION public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;

-- PASO 8: Notificar a PostgREST que recargue el esquema
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
-- Si ves este mensaje sin errores, el script se ejecutó correctamente:
-- ✅ pgcrypto está habilitada
-- ✅ Funciones duplicadas eliminadas
-- ✅ Columnas agregadas a las tablas
-- ✅ Función validate_flowdashboard_license creada
-- ✅ Permisos configurados
-- ✅ PostgREST notificado
--
-- PRÓXIMOS PASOS:
-- 1. Recarga el dashboard
-- 2. Intenta iniciar sesión nuevamente
-- 3. La validación debería funcionar correctamente
-- ============================================================================
