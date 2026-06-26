-- ============================================================================
-- SCRIPT PARA ELIMINAR TODAS LAS FIRMAS DE LA FUNCIÓN
-- ============================================================================
-- Este script elimina CADA FIRMA específicamente
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- PASO 1: Habilitar pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- PASO 2: Eliminar TODAS las firmas posibles de la función
-- Especificar cada firma exactamente

-- Firma con 10 parámetros
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text) CASCADE;

-- Firma con 11 parámetros
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text) CASCADE;

-- Firma con 12 parámetros
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text, text) CASCADE;

-- Firma con 13 parámetros (la correcta)
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text, text, text) CASCADE;

-- Firma con 9 parámetros (por si acaso)
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text) CASCADE;

-- Firma con 8 parámetros (por si acaso)
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text, text) CASCADE;

-- Firma con 7 parámetros (por si acaso)
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text) CASCADE;

-- Firma con 6 parámetros (por si acaso)
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text) CASCADE;

-- Firma con 5 parámetros (por si acaso)
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text) CASCADE;

-- Firma con 4 parámetros (por si acaso)
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text) CASCADE;

-- Firma con 3 parámetros (por si acaso)
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text) CASCADE;

-- Firma con 2 parámetros (por si acaso)
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text) CASCADE;

-- PASO 3: Notificar a PostgREST
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
-- Si ves este mensaje sin errores:
-- ✅ Todas las firmas fueron eliminadas
-- ✅ pgcrypto está habilitada
-- ✅ PostgREST fue notificado
--
-- PRÓXIMOS PASOS:
-- 1. Verifica en Database → Functions que NO hay validate_flowdashboard_license
-- 2. Ejecuta supabase_license_rpc_LIMPIO.sql
-- 3. Verifica que ahora hay SOLO 1 función
-- 4. Recarga el dashboard
-- ============================================================================
