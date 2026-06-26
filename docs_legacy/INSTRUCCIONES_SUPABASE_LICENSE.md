# 🔐 Instrucciones - Validación de Licencias en Supabase

## ❌ Problema

```
Error: HTTP Error 404: Not Found
Detalle: function digest(text, unknown) does not exist
```

**Causa**: La función `digest()` no está disponible en Supabase. Necesita ejecutar el archivo SQL `supabase_license_rpc.sql` para crear la función de validación.

## ✅ Solución

### Paso 1: Acceder a Supabase
1. Abre https://supabase.com
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto

### Paso 2: Abrir SQL Editor
1. En el panel izquierdo, haz clic en **SQL Editor**
2. Haz clic en **New Query**

### Paso 3: Copiar el SQL
1. Abre el archivo: `supabase_license_rpc.sql`
2. Copia TODO el contenido
3. Pégalo en el SQL Editor de Supabase

### Paso 4: Ejecutar el SQL
1. Haz clic en el botón **Run** (o presiona Ctrl+Enter)
2. Espera a que se complete la ejecución
3. Deberías ver un mensaje de éxito

### Paso 5: Verificar
1. En el panel izquierdo, ve a **Database** → **Functions**
2. Busca `validate_flowdashboard_license`
3. Deberías verla en la lista

## 📋 Qué Hace el SQL

El archivo `supabase_license_rpc.sql` hace lo siguiente:

1. **Crea la extensión pgcrypto**
   - Necesaria para la función `digest()`

2. **Agrega columnas a tablas**
   - `app_devices`: license_id, pc_name, device_hash, etc.
   - `app_access_logs`: license_key, device_email, event_type, etc.
   - `app_device_registrations`: license_key, device_email, etc.

3. **Crea la función `validate_flowdashboard_license()`**
   - Valida licencias
   - Registra dispositivos
   - Registra accesos en logs
   - Retorna estado de validación

4. **Configura permisos**
   - Permite que usuarios anónimos ejecuten la función
   - Permite que usuarios autenticados ejecuten la función

## 🔍 Verificación

### Después de Ejecutar el SQL

1. **Verifica que la extensión pgcrypto existe**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
   ```

2. **Verifica que la función existe**
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'validate_flowdashboard_license';
   ```

3. **Verifica que las columnas existen**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'app_devices' AND column_name = 'device_hash';
   ```

## 🚀 Después de Ejecutar

1. Recarga el dashboard
2. Intenta iniciar sesión nuevamente
3. Deberías ver el mensaje de validación correctamente

## ⚠️ Problemas Comunes

### Problema: "Permission denied"
**Solución**: Asegúrate de estar usando una cuenta con permisos de propietario del proyecto.

### Problema: "Extension pgcrypto already exists"
**Solución**: Esto es normal. El SQL usa `create extension if not exists`, así que no hay problema.

### Problema: "Function already exists"
**Solución**: El SQL usa `drop function if exists` antes de crear, así que se reemplazará la función antigua.

### Problema: "Column already exists"
**Solución**: El SQL usa `add column if not exists`, así que no hay problema.

## 📝 Archivo SQL

El archivo `supabase_license_rpc.sql` contiene:

```sql
-- Validacion de licencias sin Edge Function.
-- Ejecutar en Supabase SQL Editor con un usuario propietario del proyecto.
-- El EXE usa anon key publica y llama /rest/v1/rpc/validate_flowdashboard_license.

create extension if not exists pgcrypto;

-- Agregar columnas a tablas...
-- Crear función validate_flowdashboard_license()...
-- Configurar permisos...
```

## 🔐 Seguridad

- La función usa `security definer` para ejecutarse con permisos del propietario
- Los usuarios anónimos pueden ejecutar la función
- La función valida licencias y registra accesos
- Los datos sensibles se protegen en la base de datos

## 📞 Soporte

Si tienes problemas:

1. Verifica que estás usando una cuenta con permisos de propietario
2. Verifica que el proyecto Supabase está activo
3. Verifica que tienes acceso a la base de datos
4. Intenta ejecutar el SQL nuevamente
5. Revisa los logs de Supabase para errores

## ✅ Checklist

- [ ] Accediste a Supabase
- [ ] Abriste SQL Editor
- [ ] Copiaste el contenido de `supabase_license_rpc.sql`
- [ ] Pegaste el SQL en el editor
- [ ] Ejecutaste el SQL
- [ ] Viste un mensaje de éxito
- [ ] Verificaste que la función existe
- [ ] Recargaste el dashboard
- [ ] Intentaste iniciar sesión nuevamente
- [ ] La validación funciona correctamente

---

**Versión**: 1.0.0  
**Fecha**: 2026-05-21  
**Estado**: ✅ Listo para Usar
