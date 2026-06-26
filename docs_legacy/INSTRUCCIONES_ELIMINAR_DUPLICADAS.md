# 🔧 Instrucciones - Eliminar Funciones Duplicadas

## ❌ Problema

```
✗ Ves 2 funciones validate_flowdashboard_license en Database → Functions
✗ El script anterior no las eliminó
✗ Las funciones tienen diferentes firmas (parámetros)
```

## ✅ Solución en 2 Pasos

### PASO 1: Eliminar TODAS las Funciones Duplicadas

**Archivo**: `supabase_ELIMINAR_TODO.sql`

Este script elimina TODAS las versiones de la función sin importar los parámetros.

#### Instrucciones:

1. **Abre Supabase SQL Editor**
   ```
   https://supabase.com
   → Selecciona tu proyecto
   → Panel izquierdo: SQL Editor
   → New Query
   ```

2. **Copia el Script de Eliminación**
   ```
   Abre: supabase_ELIMINAR_TODO.sql
   Copia TODO el contenido
   ```

3. **Pega en Supabase**
   ```
   Pega en el SQL Editor
   ```

4. **Ejecuta**
   ```
   Haz clic en "Run" (o Ctrl+Enter)
   Espera a que se complete
   ```

5. **Verifica que se Eliminaron**
   ```
   Panel izquierdo → Database → Functions
   Busca: validate_flowdashboard_license
   Deberías ver: NADA (0 funciones)
   ```

### PASO 2: Crear la Función Correcta

**Archivo**: `supabase_license_rpc_LIMPIO.sql`

Después de eliminar, crea la función correctamente.

#### Instrucciones:

1. **Abre Supabase SQL Editor**
   ```
   https://supabase.com
   → Selecciona tu proyecto
   → Panel izquierdo: SQL Editor
   → New Query
   ```

2. **Copia el Script Limpio**
   ```
   Abre: supabase_license_rpc_LIMPIO.sql
   Copia TODO el contenido
   ```

3. **Pega en Supabase**
   ```
   Pega en el SQL Editor
   ```

4. **Ejecuta**
   ```
   Haz clic en "Run" (o Ctrl+Enter)
   Espera a que se complete
   ```

5. **Verifica que se Creó**
   ```
   Panel izquierdo → Database → Functions
   Busca: validate_flowdashboard_license
   Deberías ver: 1 función (SOLO 1)
   ```

## 📋 Resumen de Pasos

```
PASO 1: Ejecutar supabase_ELIMINAR_TODO.sql
        ↓
        Verifica que NO hay funciones
        ↓
PASO 2: Ejecutar supabase_license_rpc_LIMPIO.sql
        ↓
        Verifica que hay SOLO 1 función
        ↓
PASO 3: Recarga el dashboard
        ↓
        Intenta iniciar sesión
        ↓
✅ FUNCIONA CORRECTAMENTE
```

## 🔍 Verificación Detallada

### Después de PASO 1 (Eliminación)

Ejecuta esta query en Supabase para verificar:

```sql
SELECT * FROM pg_proc WHERE proname = 'validate_flowdashboard_license';
```

**Resultado esperado**: 0 filas (sin funciones)

### Después de PASO 2 (Creación)

Ejecuta esta query en Supabase para verificar:

```sql
SELECT * FROM pg_proc WHERE proname = 'validate_flowdashboard_license';
```

**Resultado esperado**: 1 fila (SOLO 1 función)

### Verificar que pgcrypto Funciona

```sql
SELECT encode(digest('test', 'sha256'), 'hex');
```

**Resultado esperado**: Un hash SHA256 (algo como `9f86d081884c7d6d9ffd60014fc7ee77e42eaf2287f4d6e4efb2b5c3f1dd8b68`)

## ⚠️ Importante

- **NO** ejecutes ambos scripts al mismo tiempo
- **PRIMERO** ejecuta `supabase_ELIMINAR_TODO.sql`
- **LUEGO** ejecuta `supabase_license_rpc_LIMPIO.sql`
- **ESPERA** a que cada uno se complete antes de ejecutar el siguiente

## 🚀 Próximos Pasos

1. ✅ Ejecuta `supabase_ELIMINAR_TODO.sql`
2. ✅ Verifica que NO hay funciones
3. ✅ Ejecuta `supabase_license_rpc_LIMPIO.sql`
4. ✅ Verifica que hay SOLO 1 función
5. ✅ Recarga el dashboard (F5)
6. ✅ Intenta iniciar sesión nuevamente
7. ✅ La validación debería funcionar

## 🔧 Si Sigue Sin Funcionar

### Opción 1: Verificar Manualmente

En Supabase SQL Editor, ejecuta:

```sql
-- Ver todas las funciones con ese nombre
SELECT proname, pronargs, proargtypes 
FROM pg_proc 
WHERE proname = 'validate_flowdashboard_license';

-- Eliminar manualmente (si ves más de 1)
DROP FUNCTION IF EXISTS public.validate_flowdashboard_license CASCADE;

-- Verificar que se eliminó
SELECT * FROM pg_proc WHERE proname = 'validate_flowdashboard_license';
```

### Opción 2: Contactar Soporte Supabase

Si sigue sin funcionar:
1. Abre un ticket en Supabase Support
2. Menciona que hay funciones duplicadas que no se pueden eliminar
3. Pide que eliminen manualmente `validate_flowdashboard_license`

## 📁 Archivos

- `supabase_ELIMINAR_TODO.sql` - Elimina TODAS las funciones
- `supabase_license_rpc_LIMPIO.sql` - Crea la función correcta

## ✅ Checklist

- [ ] Ejecutaste `supabase_ELIMINAR_TODO.sql`
- [ ] Verificaste que NO hay funciones
- [ ] Ejecutaste `supabase_license_rpc_LIMPIO.sql`
- [ ] Verificaste que hay SOLO 1 función
- [ ] Recargaste el dashboard
- [ ] Intentaste iniciar sesión
- [ ] La validación funciona correctamente

---

**Versión**: 1.0.0  
**Fecha**: 2026-05-21  
**Estado**: ✅ Listo para Usar
