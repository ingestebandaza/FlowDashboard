# PHASE10_RPC_CONTRACT

## 1. Firma Exacta
```sql
CREATE OR REPLACE FUNCTION public.validate_flowdashboard_license(
    p_device_email TEXT,
    p_license_key TEXT,
    p_device_hostname TEXT,
    p_device_serial TEXT,
    p_device_os TEXT,
    p_ip_public TEXT,
    p_country_code TEXT,
    p_device_hash TEXT,
    p_windows_user TEXT,
    p_app_version TEXT,
    p_local_ip TEXT,
    p_mac_address TEXT,
    p_country_name TEXT
) RETURNS JSONB
```

## 2. Matriz de Estados de Licencia y Dispositivo

| app_licenses.status | device_hash existía | Cupo disponible | Acción RPC en 10A | device_status Resultante | reason_code | Libera Cupo | Permite Re-registro | Permite Gracia |
|---------------------|---------------------|-----------------|-------------------|--------------------------|-------------|-------------|---------------------|----------------|
| active / approved   | Sí (active)         | N/A             | Actualiza seen    | approved                 | SUCCESS     | NO          | N/A                 | N/A            |
| active / approved   | Sí (blocked)        | N/A             | Rechaza           | blocked                  | BLOCKED_DEV | NO          | NO                  | NO             |
| active / approved   | Sí (unlinked)       | SÍ              | Reactiva          | approved                 | SUCCESS     | SÍ (previo) | SÍ                  | N/A            |
| active / approved   | No                  | SÍ              | Registra nuevo    | approved                 | SUCCESS     | N/A         | N/A                 | N/A            |
| active / approved   | No                  | NO              | Rechaza           | limit_reached            | LIMIT_REACHED| N/A        | N/A                 | N/A            |
| suspended           | Irrelevante         | Irrelevante     | Rechaza           | suspended                | LIC_SUSPEND | NO          | NO                  | SÍ             |
| revoked             | Irrelevante         | Irrelevante     | Rechaza           | revoked                  | LIC_REVOKED | NO          | NO                  | NO             |
| expired             | Irrelevante         | Irrelevante     | Gracia o Rechaza  | expired (o approved)     | EXPIRED     | NO          | NO                  | SÍ (48h)       |

## 3. Algoritmo y Flujo (Sin SKIP LOCKED)

1. Normalizar `v_email = lower(trim(p_device_email))`, clave y device_hash. Abortar si vacíos (invalid).
2. Localizar `app_licenses.id` donde `license_key = p_license_key` y correo coincida. (Si no, `LICENSE_NOT_FOUND`).
3. Obtener `license_id`.
4. Adquirir lock transaccional: `PERFORM pg_advisory_xact_lock(hashtextextended(license_id::text, 0));`
5. Re-leer estado, vencimiento y `max_devices` de `app_licenses` dentro del lock. Revisar gracia de 48h.
6. Buscar dispositivo en `app_devices` filtrando por `license_id` + `device_hash`.
7. Si status es bloqueado/revocado, retornar `blocked`/`revoked`.
8. Si no existe o está `unlinked`, contar `app_devices` con `status = 'active'` para esa licencia (dentro del lock).
9. Si cuenta >= `max_devices`, retornar `limit_reached`.
10. Registrar / actualizar dispositivo en `app_devices` y retornar JSON de éxito.

## 4. Contratos JSON (Ejemplos)

### Éxito
```json
{
  "schema_version": "2.0",
  "status": "ok",
  "device_status": "approved",
  "message": "Validación exitosa",
  "reason_code": "SUCCESS",
  "server_time": "2026-06-24T...Z",
  "license_id": "uuid",
  "license_status": "approved",
  "plan": {"key": "LEGACY_FULL", "version": 1},
  "features": ["FLOWLOGIN_BASIC"],
  "limits": {
    "max_pc_installations": 10,
    "max_android_devices": null,
    "max_concurrent_android_devices": null
  },
  "expires_at": "...",
  "expiration_grace_until": "...",
  "offline_grace_hours": 72,
  "in_grace_period": false
}
```
