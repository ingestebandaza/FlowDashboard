# 🔧 Solución - Funciones Duplicadas en Supabase

## ❌ Problema

```
✗ Ves 2 funciones validate_flowdashboard_license en Database → Functions
✗ Error: function digest(text, unknown) does not exist
✗ La validación de licencias no funciona
```

## ✅ Causa

Las funciones duplicadas causan conflicto. Una de ellas no tiene `pgcrypto` habilitada correctamente.

## 🔧 Solución

### Opción 1: Script Limpio (RECOMENDADO)

Este script limpia todo y crea la función correctamente:

**Archivo**: `supabase_license_rpc_LIMPIO.sql`

#### Pasos:

1. **Abre Supabase SQL Editor**
   - Abre https://supabase.com
   - Selecciona tu proyecto
   - Panel izquierdo → SQL Editor → New Query

2. **Copia el Script Limpio**
   - Abre: `supabase_license_rpc_LIMPIO.sql`
   - Copia TODO el contenido

3. **Pega en SQL Editor**
   - Pega en el editor de Supabase

4. **Ejecuta**
   - Haz clic en "Run" (o Ctrl+Enter)
   - Espera a que se complete

5. **Verifica**
   - Panel izquierdo → Database → Functions
   - Deberías ver SOLO 1 función `validate_flowdashboard_license`
   - Sin errores

6. **Recarga Dashboard**
   - Recarga el navegador (F5)
   - Intenta iniciar sesión nuevamente

### Opción 2: Limpieza Manual

Si prefieres hacerlo manualmente:

#### Paso 1: Eliminar Funciones Duplicadas

```sql
-- Eliminar todas las versiones de la función
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text, text, text);
```

#### Paso 2: Verificar pgcrypto

```sql
-- Verificar que pgcrypto está habilitada
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verificar que la extensión existe
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
```

#### Paso 3: Crear Función Correcta

Copia TODO el contenido de `supabase_license_rpc_LIMPIO.sql` y pégalo en Supabase.

## 📋 Qué Hace el Script Limpio

1. **Verifica pgcrypto**
   - Crea la extensión si no existe
   - Asegura que `digest()` está disponible

2. **Elimina Funciones Duplicadas**
   - Elimina todas las versiones anteriores
   - Evita conflictos

3. **Agrega Columnas**
   - Agrega columnas a `app_devices`
   - Agrega columnas a `app_access_logs`
   - Agrega columnas a `app_device_registrations`

4. **Crea Función Correcta**
   - Crea `validate_flowdashboard_license()` con pgcrypto habilitada
   - Usa `digest()` correctamente
   - Valida licencias y registra dispositivos

5. **Configura Permisos**
   - Permite que usuarios anónimos ejecuten la función
   - Permite que usuarios autenticados ejecuten la función

6. **Notifica PostgREST**
   - Recarga el esquema en PostgREST
   - Asegura que los cambios se aplican inmediatamente

## ✅ Verificación

### Después de Ejecutar el Script

1. **Verifica que pgcrypto está habilitada**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
   ```
   Deberías ver una fila con `pgcrypto`

2. **Verifica que la función existe**
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'validate_flowdashboard_license';
   ```
   Deberías ver SOLO 1 fila

3. **Verifica que digest() funciona**
   ```sql
   SELECT encode(digest('test', 'sha256'), 'hex');
   ```
   Deberías ver un hash SHA256

4. **Verifica que la función se puede ejecutar**
   ```sql
   SELECT public.validate_flowdashboard_license(
     'test@example.com',
     'test-license-key'
   );
   ```
   Deberías ver un resultado JSON

## 🚀 Próximos Pasos

1. ✅ Ejecuta `supabase_license_rpc_LIMPIO.sql`
2. ✅ Verifica que la función existe (solo 1)
3. ✅ Verifica que pgcrypto está habilitada
4. ✅ Recarga el dashboard
5. ✅ Intenta iniciar sesión nuevamente
6. ✅ La validación debería funcionar

## 🔍 Solución de Problemas

### Problema: "Permission denied"
**Solución**: Asegúrate de estar usando una cuenta con permisos de propietario

### Problema: "Extension pgcrypto already exists"
**Solución**: Normal, el script usa `IF NOT EXISTS`

### Problema: "Function already exists"
**Solución**: El script usa `DROP FUNCTION IF EXISTS` para eliminar primero

### Problema: Sigue habiendo 2 funciones
**Solución**: 
1. Abre Supabase SQL Editor
2. Ejecuta:
   ```sql
   DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text);
   DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text);
   DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text, text);
   DROP FUNCTION IF EXISTS public.validate_flowdashboard_license(text, text, text, text, text, text, text, text, text, text, text, text, text);
   ```
3. Luego ejecuta `supabase_license_rpc_LIMPIO.sql`

### Problema: Error "function digest(text, unknown) does not exist"
**Solución**: 
1. Verifica que pgcrypto está habilitada:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```
2. Ejecuta `supabase_license_rpc_LIMPIO.sql` nuevamente

## 📁 Archivos

- `supabase_license_rpc_LIMPIO.sql` - Script limpio (RECOMENDADO)
- `supabase_license_rpc.sql` - Script original (puede tener duplicados)

## ✨ Resultado Final

```
✅ pgcrypto habilitada
✅ Funciones duplicadas eliminadas
✅ Solo 1 función validate_flowdashboard_license
✅ digest() funciona correctamente
✅ Validación de licencias funciona
✅ Dispositivos se registran correctamente
```

---

**Versión**: 1.0.0  
**Fecha**: 2026-05-21  
**Estado**: ✅ Listo para Usar
