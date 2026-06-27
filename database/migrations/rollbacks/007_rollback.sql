-- ============================================================================
-- FlowDashboard 2.0.0 - FASE 12 - Rollback Migracion 007
-- Revierte el seed de entitlements de la matriz FASE 12 y elimina el registro.
-- NO toca la firma de validate_flowdashboard_license (re-aplicar 006 si se requiere
-- la version sin 'features' en la respuesta). Idempotente.
-- ============================================================================

-- Quitar entitlements de los feature codes FASE 12 en cualquier plan_version.
DELETE FROM public.plan_feature_entitlements e
USING public.features f
WHERE e.feature_id = f.id
  AND f.code IN (
    'core.dashboard','devices.grid','devices.focus','control.touch','control.keyboard',
    'flowlogin.execute','flowregister.execute','adb.presets','adb.shell','adb.bulk',
    'files.push','apps.manage','flowagent.install','autojs.execute','flowkeyboard.use',
    'inspector.tree','inspector.native','inspector.accessibility','inspector.web',
    'inspector.ocr','inspector.hybrid','recording.video','actions.replicate',
    'power.reboot','power.shutdown'
  );

-- Quitar los feature codes FASE 12 del catalogo.
DELETE FROM public.features
WHERE code IN (
  'core.dashboard','devices.grid','devices.focus','control.touch','control.keyboard',
  'flowlogin.execute','flowregister.execute','adb.presets','adb.shell','adb.bulk',
  'files.push','apps.manage','flowagent.install','autojs.execute','flowkeyboard.use',
  'inspector.tree','inspector.native','inspector.accessibility','inspector.web',
  'inspector.ocr','inspector.hybrid','recording.video','actions.replicate',
  'power.reboot','power.shutdown'
);

DELETE FROM flow_backup_v2.migration_meta WHERE step = '007_entitlements_features';
