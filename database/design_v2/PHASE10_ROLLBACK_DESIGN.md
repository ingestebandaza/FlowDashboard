# PHASE10_ROLLBACK_DESIGN

## Matriz por Objeto (Sin CASCADE)

| Objeto | Metadata Capturada | Catálogo de Origen | Consulta de Captura | Orden de Restauración | Prueba |
|--------|--------------------|--------------------|---------------------|-----------------------|--------|
| Function | def, proconfig, owner, acl | `pg_proc`, `pg_authid` | `SELECT pg_get_functiondef(oid) ...` | 1 | `has_function_privilege()` |
| RLS y Policies | enabled/forced, policy defs | `pg_class`, `pg_policies` | `SELECT policyname, roles, cmd, qual ...` | 2 | `SELECT * FROM pg_policies` |
| Table Grants | grants | `information_schema.role_table_grants` | `SELECT grantee, privilege_type ...` | 3 | `has_table_privilege()` |
| Secuencias/Indices | N/A (no se tocan los legacy) | N/A | N/A | N/A | N/A |
| Datos y Conteos | Filas exactas migradas | Tablas legacy directas | `CREATE TABLE backup_X AS SELECT *` | 4 (Si aplica borrado en 10A, que no es el caso) | `count(*)` exacto |

No se utilizará DROP ... CASCADE. Los rollbacks borrarán los objetos creados por la migración específica. 
La afirmación "al byte" se elimina. Se garantiza restauración exacta funcional según los metadatos registrados.
