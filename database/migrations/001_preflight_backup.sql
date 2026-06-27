-- ============================================================================
-- FlowDashboard 2.0.0 - FASE 10 - Migracion 001: Preflight y Backup
-- Idempotente. Crea snapshot de las tablas legacy antes de cualquier cambio.
-- Fuente de verdad de columnas: introspeccion real (PostgreSQL 17.6).
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS flow_backup_v2;

REVOKE ALL ON SCHEMA flow_backup_v2 FROM PUBLIC;
REVOKE ALL ON SCHEMA flow_backup_v2 FROM anon;
REVOKE ALL ON SCHEMA flow_backup_v2 FROM authenticated;

CREATE TABLE IF NOT EXISTS flow_backup_v2.app_licenses AS
  SELECT * FROM public.app_licenses;

CREATE TABLE IF NOT EXISTS flow_backup_v2.app_devices AS
  SELECT * FROM public.app_devices;

CREATE TABLE IF NOT EXISTS flow_backup_v2.app_device_registrations AS
  SELECT * FROM public.app_device_registrations;

CREATE TABLE IF NOT EXISTS flow_backup_v2.app_access_logs AS
  SELECT * FROM public.app_access_logs;

CREATE TABLE IF NOT EXISTS flow_backup_v2.app_admins AS
  SELECT * FROM public.app_admins;

CREATE TABLE IF NOT EXISTS flow_backup_v2.migration_meta (
  id            bigserial PRIMARY KEY,
  step          text NOT NULL,
  applied_at    timestamptz NOT NULL DEFAULT now(),
  notes         text
);

INSERT INTO flow_backup_v2.migration_meta (step, notes)
VALUES ('001_preflight_backup', 'Snapshot legacy tables before FASE 10 cutover');
