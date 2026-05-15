-- Validacion de licencias sin Edge Function.
-- Ejecutar en Supabase SQL Editor con un usuario propietario del proyecto.
-- El EXE usa anon key publica y llama /rest/v1/rpc/validate_flowdashboard_license.

create extension if not exists pgcrypto;

alter table public.app_devices
  add column if not exists license_id uuid,
  add column if not exists pc_name text,
  add column if not exists windows_user text,
  add column if not exists device_hash text,
  add column if not exists ip text,
  add column if not exists local_ip text,
  add column if not exists mac_address text,
  add column if not exists country text,
  add column if not exists country_name text,
  add column if not exists app_version text,
  add column if not exists status text default 'approved',
  add column if not exists created_at timestamptz default now(),
  add column if not exists last_seen_at timestamptz default now();

alter table public.app_devices
  alter column ip type text using ip::text;

alter table public.app_access_logs
  add column if not exists license_key text,
  add column if not exists device_email text,
  add column if not exists event_type text,
  add column if not exists error_message text,
  add column if not exists "timestamp" timestamptz default now(),
  add column if not exists created_at timestamptz default now(),
  add column if not exists decision text,
  add column if not exists pc_name text,
  add column if not exists device_hash text,
  add column if not exists ip text,
  add column if not exists local_ip text,
  add column if not exists mac_address text,
  add column if not exists country text,
  add column if not exists country_name text,
  add column if not exists app_version text,
  add column if not exists message text;

alter table public.app_access_logs
  alter column ip type text using ip::text;

alter table public.app_device_registrations
  add column if not exists license_key text,
  add column if not exists device_email text,
  add column if not exists device_hostname text,
  add column if not exists device_serial text,
  add column if not exists device_os text,
  add column if not exists ip_public text,
  add column if not exists local_ip text,
  add column if not exists mac_address text,
  add column if not exists country_code text,
  add column if not exists country_name text,
  add column if not exists status text default 'approved',
  add column if not exists created_at timestamptz default now(),
  add column if not exists last_seen_at timestamptz default now();

drop function if exists public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text);
drop function if exists public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text, text, text);

create or replace function public.validate_flowdashboard_license(
  p_device_email text,
  p_license_key text,
  p_device_hostname text default '',
  p_device_serial text default '',
  p_device_os text default '',
  p_ip_public text default '',
  p_country_code text default '',
  p_device_hash text default '',
  p_windows_user text default '',
  p_app_version text default '',
  p_local_ip text default '',
  p_mac_address text default '',
  p_country_name text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_license public.app_licenses%rowtype;
  v_device public.app_devices%rowtype;
  v_registration public.app_device_registrations%rowtype;
  v_now timestamptz := now();
  v_message text := '';
  v_device_count integer := 0;
  v_max_devices integer := 1;
begin
  p_device_email := lower(trim(coalesce(p_device_email, '')));
  p_license_key := trim(coalesce(p_license_key, ''));
  p_device_hostname := trim(coalesce(p_device_hostname, ''));
  p_windows_user := trim(coalesce(p_windows_user, ''));
  p_device_hash := trim(coalesce(p_device_hash, ''));
  p_app_version := trim(coalesce(p_app_version, ''));
  p_local_ip := trim(coalesce(p_local_ip, ''));
  p_mac_address := trim(coalesce(p_mac_address, ''));
  p_country_name := trim(coalesce(p_country_name, ''));

  if p_device_hash = '' then
    p_device_hash := encode(digest(p_device_email || '|' || p_device_hostname || '|' || p_windows_user, 'sha256'), 'hex');
  end if;

  if p_device_email = '' or p_license_key = '' then
    return jsonb_build_object('status', 'error', 'device_status', 'missing', 'message', 'Email y licencia requeridos');
  end if;

  select *
    into v_license
    from public.app_licenses
   where license_key = p_license_key
   limit 1;

  if not found then
    v_message := 'Licencia invalida';
    insert into public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
    values (v_now, v_now, p_license_key, p_device_email, 'license_not_found', v_message, 'denied', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);
    return jsonb_build_object('status', 'error', 'device_status', 'missing', 'message', v_message);
  end if;

  if lower(coalesce(v_license.status, '')) not in ('active', 'approved') then
    v_message := 'Licencia ' || coalesce(v_license.status, 'inactiva');
    insert into public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
    values (v_now, v_now, p_license_key, p_device_email, 'license_inactive', v_message, 'denied', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);
    return jsonb_build_object('status', 'error', 'device_status', lower(coalesce(v_license.status, 'inactive')), 'message', v_message);
  end if;

  if v_license.expires_at is not null and v_license.expires_at < v_now then
    v_message := 'Licencia expirada';
    insert into public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
    values (v_now, v_now, p_license_key, p_device_email, 'license_expired', v_message, 'denied', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);
    return jsonb_build_object('status', 'error', 'device_status', 'expired', 'message', v_message);
  end if;

  v_max_devices := greatest(coalesce(v_license.max_devices, 1), 1);

  select *
    into v_device
    from public.app_devices
   where license_id = v_license.id
     and device_hash = p_device_hash
   limit 1;

  if found then
    if lower(coalesce(v_device.status, '')) in ('blocked', 'revoked') then
      v_message := 'PC bloqueada';
      insert into public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
      values (v_now, v_now, p_license_key, p_device_email, 'device_blocked', v_message, 'blocked', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);
      return jsonb_build_object('status', 'error', 'device_status', 'blocked', 'message', v_message);
    end if;

    update public.app_devices
       set pc_name = coalesce(nullif(p_device_hostname, ''), pc_name),
           windows_user = coalesce(nullif(p_windows_user, ''), windows_user),
           ip = coalesce(nullif(p_ip_public, ''), ip),
           local_ip = coalesce(nullif(p_local_ip, ''), local_ip),
           mac_address = coalesce(nullif(p_mac_address, ''), mac_address),
           country = coalesce(nullif(p_country_code, ''), country),
           country_name = coalesce(nullif(p_country_name, ''), country_name),
           app_version = coalesce(nullif(p_app_version, ''), app_version),
           last_seen_at = v_now
     where id = v_device.id;

    v_message := 'Dispositivo aprobado';
    insert into public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
    values (v_now, v_now, p_license_key, p_device_email, 'device_seen', null, 'approved', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);

    return jsonb_build_object('status', 'success', 'device_status', coalesce(v_device.status, 'approved'), 'message', v_message);
  end if;

  select count(*)
    into v_device_count
    from public.app_devices
   where license_id = v_license.id
     and lower(coalesce(status, 'approved')) not in ('blocked', 'revoked');

  if v_device_count >= v_max_devices then
    v_message := 'Limite de PCs alcanzado';
    insert into public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
    values (v_now, v_now, p_license_key, p_device_email, 'device_limit_reached', v_message, 'denied', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);
    return jsonb_build_object('status', 'error', 'device_status', 'limit_reached', 'message', v_message);
  end if;

  insert into public.app_devices (
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
  values (
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

  select *
    into v_registration
    from public.app_device_registrations
   where device_email = p_device_email
     and license_key = p_license_key
   limit 1;

  if found then
    update public.app_device_registrations
       set last_seen_at = v_now,
           device_hostname = coalesce(nullif(p_device_hostname, ''), device_hostname),
           device_serial = coalesce(nullif(p_device_serial, ''), device_serial),
           device_os = coalesce(nullif(p_device_os, ''), device_os),
           ip_public = coalesce(nullif(p_ip_public, ''), ip_public),
           local_ip = coalesce(nullif(p_local_ip, ''), local_ip),
           mac_address = coalesce(nullif(p_mac_address, ''), mac_address),
           country_code = coalesce(nullif(p_country_code, ''), country_code),
           country_name = coalesce(nullif(p_country_name, ''), country_name),
           status = 'approved'
     where id = v_registration.id;
  else
    insert into public.app_device_registrations (
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
    values (
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
  end if;

  v_message := 'Dispositivo aprobado';
  insert into public.app_access_logs (created_at, "timestamp", license_key, device_email, event_type, error_message, decision, pc_name, device_hash, ip, local_ip, mac_address, country, country_name, app_version, message)
  values (v_now, v_now, p_license_key, p_device_email, 'device_registered', null, 'approved', p_device_hostname, p_device_hash, p_ip_public, p_local_ip, p_mac_address, p_country_code, p_country_name, p_app_version, v_message);

  return jsonb_build_object('status', 'success', 'device_status', 'approved', 'message', v_message);
end;
$$;

revoke all on function public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text, text, text) to anon;
grant execute on function public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
