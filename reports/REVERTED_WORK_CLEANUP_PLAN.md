# Plan de Limpieza de Residuos (Fase 10)

## A. Borrado seguro
Los siguientes archivos y carpetas serán eliminados permanentemente (previo backup en `restore_points`), dado que se generaron durante los intentos fallidos de la Fase 10, no tienen referencias en el código activo, no participan en runtime y no son canónicos:
- `database/migrations/`
- `database/design/`
- `database/reviews/`
- `database/runbooks/`
- `database/verification/`
- `database/staging/`
- `reports/PHASE10_DATABASE_REVIEW.zip`
- `reports/PHASE10_DATABASE_REVIEW_V2.zip`
- `reports/PHASE10_DATABASE_REVIEW_V3.zip`
- `reports/PHASE10_DESIGN_REVIEW.zip`
- `reports/PHASE10_DESIGN_REVIEW_V2.zip`
- `database_v2_generator/`
- `database_v3_generator/`

## B. Archivar, no borrar
- Por ahora, no hay elementos propuestos para archivar en `archive/reverted-phase10/` ya que todos los residuos son pruebas de bases de datos de una versión cancelada y existen en el `restore_point`.

## C. Conservar
- Todos los archivos bajo control de versiones (Git) previos al intento de Fase 10.
- `PLAN_MAESTRO_IMPLEMENTACION_COMERCIAL_FLOWDASHBOARD_2.0.0.md`
- `ANEXO_CONTROL_COHERENCIA_CODIGO_RUNTIME_DOCUMENTACION.md`
- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- `docs/master_technical_specification.md`
- Copias de seguridad antiguas y restore points existentes.

## D. Revisión manual
- Se recomienda revisar manualmente si existiese algún generador como `generate_design_v2.py` abierto en el editor, aunque no esté listado como modificado permanentemente en Git, para que el usuario pueda descartar sus cambios o eliminarlo.
