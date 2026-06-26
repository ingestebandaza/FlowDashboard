-- ============================================================================
-- HABILITAR PGCRYPTO EN SUPABASE
-- ============================================================================
-- IMPORTANTE: Ejecutar PRIMERO este script
-- Luego ejecutar supabase_CREAR_FUNCION.sql
-- ============================================================================

-- PASO 1: Habilitar la extensión pgcrypto
-- Esta extensión proporciona la función digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- PASO 2: Verificar que pgcrypto está habilitada
-- Si ves un resultado, pgcrypto está habilitada
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';

-- PASO 3: Verificar que digest() funciona
-- Si ves un hash, digest() está disponible
SELECT encode(digest('test', 'sha256'), 'hex') as test_hash;

-- PASO 4: Notificar a PostgREST
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
-- Si ves resultados sin errores:
-- ✅ pgcrypto está habilitada
-- ✅ digest() funciona correctamente
-- ✅ PostgREST fue notificado
--
-- PRÓXIMOS PASOS:
-- 1. Ejecuta supabase_CREAR_FUNCION.sql
-- 2. Verifica que la función se creó
-- 3. Recarga el dashboard
-- 4. Intenta iniciar sesión
-- ============================================================================
