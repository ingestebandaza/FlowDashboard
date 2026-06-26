# PHASE10_TEST_MATRIX

| ID | Precondición | Preparación | Acción | Resultado Esperado | Consulta de Verificación | Cleanup | Criterio |
|----|--------------|-------------|--------|--------------------|--------------------------|---------|----------|
| 1 | DB intacta | Leer conteos | Ejecutar PREFLIGHT | 3 licencias, 25 PCs, 5 regs, 2 conflictos | `SELECT count(*) FROM app_licenses` | N/A | Counts coinciden |
| 2 | Licencia válida | Configurar expiración | Llamar a wrapper público | JSON status='ok', device_status='approved' | `SELECT last_seen_at...` | N/A | JSON devuelto |
| 3 | Concurrencia | Setup script paralelo | Lanzar 2 peticiones RPC | 1 success, 1 limit_reached (si limit=1) | `SELECT count(*) FROM app_devices` | N/A | Lock advisory funciona |
| 4 | Email incorrecto | Ninguna | Enviar email erroneo | status='error', REASON='LICENSE_NOT_FOUND'| N/A | N/A | JSON devuelto |
| 5 | PC Bloqueado | `UPDATE app_devices SET status='blocked'` | Llamar RPC con el hash | device_status='blocked' | N/A | Rollback | JSON |
| 6 | Unlinked | `UPDATE app_devices SET status='unlinked'` | Llamar RPC | device_status='approved' y status se vuelve 'active' | `SELECT status FROM app_devices` | N/A | Estado activo |
| 7 | Vencida (Gracia) | `expires_at` hace 10h | Llamar RPC | status='ok', in_grace_period=true | N/A | N/A | JSON |
| 8 | Panel | Autenticar como Admin | REST GET `app_licenses` | Retorna data | HTTP 200 | N/A | Retorna arrays JSON |
| 9 | Panel | Autenticar no-admin | REST GET `app_licenses` | Retorna `[]` (cero filas) | HTTP 200 pero vacío por RLS | N/A | RLS funciona |
