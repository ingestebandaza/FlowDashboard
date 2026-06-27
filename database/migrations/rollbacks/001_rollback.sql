-- ============================================================================
-- FlowDashboard 2.0.0 - FASE 10 - Rollback de la migracion 001 (preflight backup)
-- ATENCION: elimina el esquema de respaldo flow_backup_v2 y TODOS los
-- snapshots de seguridad creados antes de la migracion. Ejecutar solo si se
-- desea descartar por completo los respaldos. Idempotente.
-- ============================================================================

DROP SCHEMA IF EXISTS flow_backup_v2 CASCADE;
