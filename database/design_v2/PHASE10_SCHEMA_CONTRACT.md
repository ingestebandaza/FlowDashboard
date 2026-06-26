# PHASE10_SCHEMA_CONTRACT (Fase 10A y 10B)

## 1. División de Fases

### Fase 10A (Actual): Seguridad y Compatibilidad
* `app_licenses` es la única fuente de verdad para `status`, `expires_at` y `max_devices`.
* `app_devices` es la única fuente de verdad para PCs.
* `license_plan_assignments` solo enlaza `app_licenses.id` con un `plan_version_id`.
* NO se duplican instalaciones en `license_installations` ni se usan triggers bidireccionales.
* Los límites se leen directamente de `app_licenses.max_devices`.

### Fase 10B (Futura): Modelo Comercial Avanzado
* `license_installations` se convierte en fuente definitiva.
* `license_overrides` será la fuente definitiva de límites.
* Se implementarán límites Android y concurrencia.
* Panel completamente migrado y retirada de tablas legacy.

## 2. Definición de Tablas (Fase 10A)

### `admin_profiles`
* **Propósito:** Almacenar roles administrativos vinculados a auth.users.
* **Columnas:** 
  * `id` (UUID, PK, gen_random_uuid())
  * `user_id` (UUID, UNIQUE, NOT NULL, REFERENCES auth.users(id) ON DELETE RESTRICT)
  * `email` (TEXT, UNIQUE, NOT NULL)
  * `role` (TEXT, NOT NULL, DEFAULT 'admin')
  * `created_at`, `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
* **Constraints:** `CHECK (role IN ('admin', 'superadmin'))`
* **Política de eliminación:** Soft-delete no implementado. RESTRICT en cascadas.
* **Fuente de verdad:** Administradores.
* **Rollback:** `DROP TABLE public.admin_profiles`.

### `plans`
* **Columnas:** `id`, `name`, `code` (UNIQUE), `description`, `is_active`, `created_at`.
* **Fuente de Verdad:** Catálogo comercial estático.

### `plan_versions`
* **Columnas:** `id`, `plan_id` (REFERENCES plans ON DELETE RESTRICT), `version` (INT).
* *Nota:* En 10A los límites de PC vienen de `app_licenses`. Límites definidos aquí aplican en 10B.

### `features` y `plan_feature_entitlements`
* **Propósito:** Matriz de capacidades autorizadas por versión de plan.

### `license_plan_assignments`
* **Propósito:** Enlace unidireccional entre la licencia y un plan.
* **Columnas:** `id`, `license_id` (UNIQUE, REFERENCES app_licenses ON DELETE RESTRICT), `plan_version_id` (REFERENCES plan_versions ON DELETE RESTRICT).
* **Migración:** Para Fase 10A, las 3 licencias actuales se enlazan aquí al plan LEGACY_FULL.

### `app_licenses` (Legacy Modificada en 10A)
* **Propósito:** Fuente de verdad absoluta de las licencias.
* Se mantienen columnas exactas, constraints, y datos.
* Se adopta un soft delete de estado (`status = 'archived'`) u acciones (`status = 'revoked'`) vía panel en lugar de HARD DELETE.

### `app_devices` (Legacy Modificada en 10A)
* **Propósito:** Fuente de verdad absoluta de los dispositivos.
* Se adopta un soft delete de estado (`status = 'unlinked'`, `'blocked'`, `'revoked'`) en vez de HARD DELETE a nivel de aplicación (panel).
