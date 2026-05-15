-- Validacion de licencias sin Edge Function.
-- Ejecutar en Supabase SQL Editor con un usuario propietario del proyecto.
-- El EXE debe usar la anon key publica y llamar /rest/v1/rpc/validate_flowdashboard_license.

alter table public.app_access_logs
  add column if not exists license_key text,
  add column if not exists device_email text,
  add column if not exists event_type text,
  add column if not exists error_message text,
  add column if not exists "timestamp" timestamptz default now(),
  add column if not exists created_at timestamptz default now();

alter table public.app_device_registrations
  add column if not exists license_key text,
  add column if not exists device_email text,
  add column if not exists device_hostname text,
  add column if not exists device_serial text,
  add column if not exists device_os text,
  add column if not exists ip_public text,
  add column if not exists country_code text,
  add column if not exists status text default 'approved',
  add column if not exists created_at timestamptz default now(),
  add column if not exists last_seen_at timestamptz default now();

create or replace function public.validate_flowdashboard_license(
  p_device_email text,
  p_license_key text,
  p_device_hostname text default '',
  p_device_serial text default '',
  p_device_os text default '',
  p_ip_public text default '',
  p_country_code text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_license public.app_licenses%rowtype;
  v_registration public.app_device_registrations%rowtype;
  v_now timestamptz := now();
begin
  p_device_email := lower(trim(coalesce(p_device_email, '')));
  p_license_key := trim(coalesce(p_license_key, ''));

  if p_device_email = '' or p_license_key = '' then
    return jsonb_build_object(
      'status', 'error',
      'device_status', 'missing',
      'message', 'Email y licencia requeridos'
    );
  end if;

  select *
    into v_license
    from public.app_licenses
   where license_key = p_license_key
   limit 1;

  if not found then
    insert into public.app_access_logs (license_key, device_email, event_type, error_message, "timestamp")
    values (p_license_key, p_device_email, 'license_not_found', 'Licencia no encontrada', v_now);

    return jsonb_build_object(
      'status', 'error',
      'device_status', 'missing',
      'message', 'Licencia invalida'
    );
  end if;

  if lower(coalesce(v_license.status, '')) not in ('active', 'approved') then
    insert into public.app_access_logs (license_key, device_email, event_type, error_message, "timestamp")
    values (p_license_key, p_device_email, 'license_inactive', 'Licencia ' || coalesce(v_license.status, ''), v_now);

    return jsonb_build_object(
      'status', 'error',
      'device_status', lower(coalesce(v_license.status, 'inactive')),
      'message', 'Licencia ' || coalesce(v_license.status, 'inactiva')
    );
  end if;

  if v_license.expires_at is not null and v_license.expires_at < v_now then
    insert into public.app_access_logs (license_key, device_email, event_type, error_message, "timestamp")
    values (p_license_key, p_device_email, 'license_expired', 'Licencia expirada', v_now);

    return jsonb_build_object(
      'status', 'error',
      'device_status', 'expired',
      'message', 'Licencia expirada'
    );
  end if;

  select *
    into v_registration
    from public.app_device_registrations
   where device_email = p_device_email
     and license_key = p_license_key
   order by created_at asc nulls last
   limit 1;

  if found then
    if lower(coalesce(v_registration.status, '')) = 'blocked' then
      insert into public.app_access_logs (license_key, device_email, event_type, error_message, "timestamp")
      values (p_license_key, p_device_email, 'device_blocked', 'Dispositivo bloqueado', v_now);

      return jsonb_build_object(
        'status', 'error',
        'device_status', 'blocked',
        'message', 'Dispositivo bloqueado'
      );
    end if;

    update public.app_device_registrations
       set last_seen_at = v_now,
           device_hostname = coalesce(nullif(p_device_hostname, ''), device_hostname),
           device_serial = coalesce(nullif(p_device_serial, ''), device_serial),
           device_os = coalesce(nullif(p_device_os, ''), device_os),
           ip_public = coalesce(nullif(p_ip_public, ''), ip_public),
           country_code = coalesce(nullif(p_country_code, ''), country_code)
     where id = v_registration.id;

    insert into public.app_access_logs (license_key, device_email, event_type, error_message, "timestamp")
    values (p_license_key, p_device_email, 'device_seen', null, v_now);

    return jsonb_build_object(
      'status', 'success',
      'device_status', coalesce(v_registration.status, 'approved'),
      'message', 'Dispositivo aprobado'
    );
  end if;

  insert into public.app_device_registrations (
    license_key,
    device_email,
    device_hostname,
    device_serial,
    device_os,
    ip_public,
    country_code,
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
    p_country_code,
    'approved',
    v_now,
    v_now
  );

  insert into public.app_access_logs (license_key, device_email, event_type, error_message, "timestamp")
  values (p_license_key, p_device_email, 'device_registered', null, v_now);

  return jsonb_build_object(
    'status', 'success',
    'device_status', 'approved',
    'message', 'Dispositivo aprobado'
  );
end;
$$;

revoke all on function public.validate_flowdashboard_license(text, text, text, text, text, text, text) from public;
grant execute on function public.validate_flowdashboard_license(text, text, text, text, text, text, text) to anon;
grant execute on function public.validate_flowdashboard_license(text, text, text, text, text, text, text) to authenticated;
