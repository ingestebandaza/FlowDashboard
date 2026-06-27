-- ROLLBACK 004: restaurar el RPC v1 original (sin enriquecimiento) y eliminar helper.
CREATE OR REPLACE FUNCTION public.validate_flowdashboard_license(
  p_device_email text, p_license_key text, p_device_hostname text DEFAULT ''::text,
  p_device_serial text DEFAULT ''::text, p_device_os text DEFAULT ''::text,
  p_ip_public text DEFAULT ''::text, p_country_code text DEFAULT ''::text,
  p_device_hash text DEFAULT ''::text, p_windows_user text DEFAULT ''::text,
  p_app_version text DEFAULT ''::text, p_local_ip text DEFAULT ''::text,
  p_mac_address text DEFAULT ''::text, p_country_name text DEFAULT ''::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_license public.app_licenses%rowtype;
  v_device public.app_devices%rowtype;
  v_registration public.app_device_registrations%rowtype;
  v_now timestamptz := now();
  v_message text := '';
  v_device_count integer := 0;
  v_max_devices integer := 1;
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
    RETURN jsonb_build_object('status','error','device_status','missing','message','Email y licencia requeridos');
  END IF;
  SELECT * INTO v_license FROM public.app_licenses WHERE license_key = p_license_key LIMIT 1;
  IF NOT FOUND THEN
    v_message := 'Licencia invalida';
    INSERT INTO public.app_access_logs (created_at,"timestamp",license_key,device_email,event_type,error_message,decision,pc_name,device_hash,ip,local_ip,mac_address,country,country_name,app_version,message)
    VALUES (v_now,v_now,p_license_key,p_device_email,'license_not_found',v_message,'denied',p_device_hostname,p_device_hash,p_ip_public,p_local_ip,p_mac_address,p_country_code,p_country_name,p_app_version,v_message);
    RETURN jsonb_build_object('status','error','device_status','missing','message',v_message);
  END IF;
  IF lower(coalesce(v_license.status,'')) NOT IN ('active','approved') THEN
    v_message := 'Licencia ' || coalesce(v_license.status,'inactiva');
    INSERT INTO public.app_access_logs (created_at,"timestamp",license_key,device_email,event_type,error_message,decision,pc_name,device_hash,ip,local_ip,mac_address,country,country_name,app_version,message)
    VALUES (v_now,v_now,p_license_key,p_device_email,'license_inactive',v_message,'denied',p_device_hostname,p_device_hash,p_ip_public,p_local_ip,p_mac_address,p_country_code,p_country_name,p_app_version,v_message);
    RETURN jsonb_build_object('status','error','device_status',lower(coalesce(v_license.status,'inactive')),'message',v_message);
  END IF;
  IF v_license.expires_at IS NOT NULL AND v_license.expires_at < v_now THEN
    v_message := 'Licencia expirada';
    INSERT INTO public.app_access_logs (created_at,"timestamp",license_key,device_email,event_type,error_message,decision,pc_name,device_hash,ip,local_ip,mac_address,country,country_name,app_version,message)
    VALUES (v_now,v_now,p_license_key,p_device_email,'license_expired',v_message,'denied',p_device_hostname,p_device_hash,p_ip_public,p_local_ip,p_mac_address,p_country_code,p_country_name,p_app_version,v_message);
    RETURN jsonb_build_object('status','error','device_status','expired','message',v_message);
  END IF;
  v_max_devices := greatest(coalesce(v_license.max_devices,1),1);
  SELECT * INTO v_device FROM public.app_devices WHERE license_id = v_license.id AND device_hash = p_device_hash LIMIT 1;
  IF FOUND THEN
    IF lower(coalesce(v_device.status,'')) IN ('blocked','revoked') THEN
      v_message := 'PC bloqueada';
      INSERT INTO public.app_access_logs (created_at,"timestamp",license_key,device_email,event_type,error_message,decision,pc_name,device_hash,ip,local_ip,mac_address,country,country_name,app_version,message)
      VALUES (v_now,v_now,p_license_key,p_device_email,'device_blocked',v_message,'blocked',p_device_hostname,p_device_hash,p_ip_public,p_local_ip,p_mac_address,p_country_code,p_country_name,p_app_version,v_message);
      RETURN jsonb_build_object('status','error','device_status','blocked','message',v_message);
    END IF;
    UPDATE public.app_devices SET pc_name=coalesce(nullif(p_device_hostname,''),pc_name),windows_user=coalesce(nullif(p_windows_user,''),windows_user),ip=coalesce(nullif(p_ip_public,''),ip),local_ip=coalesce(nullif(p_local_ip,''),local_ip),mac_address=coalesce(nullif(p_mac_address,''),mac_address),country=coalesce(nullif(p_country_code,''),country),country_name=coalesce(nullif(p_country_name,''),country_name),app_version=coalesce(nullif(p_app_version,''),app_version),last_seen_at=v_now WHERE id=v_device.id;
    v_message := 'Dispositivo aprobado';
    INSERT INTO public.app_access_logs (created_at,"timestamp",license_key,device_email,event_type,error_message,decision,pc_name,device_hash,ip,local_ip,mac_address,country,country_name,app_version,message)
    VALUES (v_now,v_now,p_license_key,p_device_email,'device_seen',NULL,'approved',p_device_hostname,p_device_hash,p_ip_public,p_local_ip,p_mac_address,p_country_code,p_country_name,p_app_version,v_message);
    RETURN jsonb_build_object('status','success','device_status',coalesce(v_device.status,'approved'),'message',v_message);
  END IF;
  SELECT count(*) INTO v_device_count FROM public.app_devices WHERE license_id=v_license.id AND lower(coalesce(status,'approved')) NOT IN ('blocked','revoked');
  IF v_device_count >= v_max_devices THEN
    v_message := 'Limite de PCs alcanzado';
    INSERT INTO public.app_access_logs (created_at,"timestamp",license_key,device_email,event_type,error_message,decision,pc_name,device_hash,ip,local_ip,mac_address,country,country_name,app_version,message)
    VALUES (v_now,v_now,p_license_key,p_device_email,'device_limit_reached',v_message,'denied',p_device_hostname,p_device_hash,p_ip_public,p_local_ip,p_mac_address,p_country_code,p_country_name,p_app_version,v_message);
    RETURN jsonb_build_object('status','error','device_status','limit_reached','message',v_message);
  END IF;
  INSERT INTO public.app_devices (license_id,pc_name,windows_user,device_hash,ip,local_ip,mac_address,country,country_name,app_version,status,created_at,last_seen_at)
  VALUES (v_license.id,p_device_hostname,p_windows_user,p_device_hash,p_ip_public,p_local_ip,p_mac_address,p_country_code,p_country_name,p_app_version,'approved',v_now,v_now);
  SELECT * INTO v_registration FROM public.app_device_registrations WHERE device_email=p_device_email AND license_key=p_license_key LIMIT 1;
  IF FOUND THEN
    UPDATE public.app_device_registrations SET last_seen_at=v_now,device_hostname=coalesce(nullif(p_device_hostname,''),device_hostname),device_serial=coalesce(nullif(p_device_serial,''),device_serial),device_os=coalesce(nullif(p_device_os,''),device_os),ip_public=coalesce(nullif(p_ip_public,''),ip_public),local_ip=coalesce(nullif(p_local_ip,''),local_ip),mac_address=coalesce(nullif(p_mac_address,''),mac_address),country_code=coalesce(nullif(p_country_code,''),country_code),country_name=coalesce(nullif(p_country_name,''),country_name),status='approved' WHERE id=v_registration.id;
  ELSE
    INSERT INTO public.app_device_registrations (license_key,device_email,device_hostname,device_serial,device_os,ip_public,local_ip,mac_address,country_code,country_name,status,created_at,last_seen_at)
    VALUES (p_license_key,p_device_email,p_device_hostname,p_device_serial,p_device_os,p_ip_public,p_local_ip,p_mac_address,p_country_code,p_country_name,'approved',v_now,v_now);
  END IF;
  v_message := 'Dispositivo aprobado';
  INSERT INTO public.app_access_logs (created_at,"timestamp",license_key,device_email,event_type,error_message,decision,pc_name,device_hash,ip,local_ip,mac_address,country,country_name,app_version,message)
  VALUES (v_now,v_now,p_license_key,p_device_email,'device_registered',NULL,'approved',p_device_hostname,p_device_hash,p_ip_public,p_local_ip,p_mac_address,p_country_code,p_country_name,p_app_version,v_message);
  RETURN jsonb_build_object('status','success','device_status','approved','message',v_message);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.validate_flowdashboard_license(text,text,text,text,text,text,text,text,text,text,text,text,text) TO anon, authenticated;
DROP FUNCTION IF EXISTS public._fd_sync_installation(uuid,text,text,text,text,text,text,text,timestamptz);
