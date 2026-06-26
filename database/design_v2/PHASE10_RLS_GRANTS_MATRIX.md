# PHASE10_RLS_GRANTS_MATRIX

## 1. Políticas Legacy a Eliminar
Se ejecutarán `DROP POLICY` explícitos.
* `app_licenses`: `Enable read access for all users`, `Enable insert for authenticated`, etc.
* `app_devices`: (Todas las previas).

## 2. Matriz de Operaciones

| Objeto | Operación | anon | authenticated (no admin) | admin | service_role / postgres |
|--------|-----------|------|---------------------------|-------|-------------------------|
| `app_licenses` | SELECT, INSERT, UPDATE, DELETE | Ninguno | Restringido (0 filas) | TODO | TODO |
| | RLS USING | `false` | `flow_internal.is_admin()` | `flow_internal.is_admin()` | `true` |
| `app_devices` | SELECT, INSERT, UPDATE, DELETE | Ninguno | Restringido (0 filas) | TODO | TODO |
| | RLS USING | `false` | `flow_internal.is_admin()` | `flow_internal.is_admin()` | `true` |
| `app_access_logs` | SELECT | Ninguno | Restringido (0 filas) | TODO | TODO |
| `audit_events` | SELECT | Ninguno | Restringido (0 filas) | TODO | TODO |
| | UPDATE/DELETE | Ninguno | Ninguno | Ninguno | TODO |
| `admin_profiles` | SELECT | Ninguno | Restringido | TODO | TODO |
| Nuevas tablas (plans, etc) | SELECT, UPDATE... | Ninguno | Ninguno | TODO | TODO |
| `flow_internal.*` | EXECUTE | Ninguno | Ninguno | Vía interna (SECURITY DEFINER) | TODO |
| Secuencias / Esquemas | USAGE | Ninguno | PUBLIC (sólo esquemas) | TODO | TODO |
| `public.validate...` | EXECUTE | SÍ (Firma exacta) | SÍ (Firma exacta) | SÍ | SÍ |
