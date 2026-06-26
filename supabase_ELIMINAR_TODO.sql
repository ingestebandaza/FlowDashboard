-- ============================================================================
-- SCRIPT PARA ELIMINAR TODAS LAS FUNCIONES DUPLICADAS
-- ============================================================================
-- IMPORTANTE: Ejecutar PRIMERO este script para limpiar todo
-- Luego ejecutar supabase_license_rpc_LIMPIO.sql
-- ============================================================================

-- PASO 1: Habilitar pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- PASO 2: Eliminar TODAS las versiones de la función
-- Usar CASCADE para eliminar dependencias
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license CASCADE;

-- PASO 3: Verificar que la función fue eliminada
-- Ejecuta esto para verificar:
-- SELECT * FROM pg_proc WHERE proname = 'validate_flowdashboard_license';
-- Deberías ver 0 resultados

-- PASO 4: Notificar a PostgREST
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- FIN DEL SCRIPT DE ELIMINACIÓN
-- ============================================================================
-- Si ves este mensaje sin errores:
-- ✅ Todas las funciones duplicadas fueron eliminadas
-- ✅ pgcrypto está habilitada
-- ✅ PostgREST fue notificado
--
-- PRÓXIMOS PASOS:
-- 1. Verifica en Database → Functions que NO hay validate_flowdashboard_license
-- 2. Ejecuta supabase_license_rpc_LIMPIO.sql
-- 3. Verifica que ahora hay SOLO 1 función
-- 4. Recarga el dashboard
-- ============================================================================
