# PHASE10_LEGACY_COMPATIBILITY_PLAN

## Estrategia para Fase 10A

Se descarta la Opción B (Triggers bidireccionales y excepciones en borrados). 

### Acción Pre-Cutover
Antes de ejecutar el cutover (Migraciones 008, 009, 010), el panel `license_admin.html` DEBE adaptarse:
1. **Quitar el fallback 401->anon**: Si falla un request administrativo por token vencido, debe redirigir a login, NO borrar la sesión y reintentar.
2. **Soft Deletes**: Sustituir las peticiones `DELETE /rest/v1/app_devices` por `PATCH /rest/v1/app_devices` haciendo `{"status": "unlinked"}` o `"blocked"`.

### Acceso a Datos
* `app_licenses` y `app_devices` seguirán siendo las tablas principales durante la Fase 10A.
* Como RLS usa `is_admin()`, el usuario `authenticated` validado como admin mantendrá acceso REST directo a estas tablas.

### Flujos
* **Renovar/Suspender/Revocar:** El panel hace `PATCH /rest/v1/app_licenses` con status = `approved/suspended/revoked` y el nuevo `expires_at`.
* **Cambiar límite:** `PATCH /rest/v1/app_licenses` actualizando `max_devices`.
* **Desvincular/Bloquear PC:** `PATCH /rest/v1/app_devices` actualizando `status` = `unlinked` o `blocked`.
