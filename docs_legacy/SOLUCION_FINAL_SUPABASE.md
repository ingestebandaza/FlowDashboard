# 🔧 Solución Final - Eliminar Funciones Duplicadas

## ❌ Error Actual

```
ERROR: 42725: function name "public.validate_flowdashboard_license" is not unique
HINT: Specify the argument list to select the function unambiguously.
```

**Causa**: Hay múltiples versiones de la función con diferentes firmas (parámetros).

## ✅ Solución Definitiva

He creado un script que elimina **TODAS las firmas posibles**:

**Archivo**: `supabase_ELIMINAR_TODAS_FIRMAS.sql`

Este script elimina cada firma específicamente:
- 10 parámetros
- 11 parámetros
- 12 parámetros
- 13 parámetros (la correcta)
- 9, 8, 7, 6, 5, 4, 3, 2 parámetros (por si acaso)

## 🚀 Pasos Rápidos

### PASO 1: Eliminar TODAS las Firmas

1. **Abre Supabase SQL Editor**
   ```
   https://supabase.com
   → Selecciona tu proyecto
   → Panel izquierdo: SQL Editor
   → New Query
   ```

2. **Copia el Script**
   ```
   Abre: supabase_ELIMINAR_TODAS_FIRMAS.sql
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

### PASO 3: Recarga Dashboard

1. **Recarga el navegador**
   ```
   F5 o Ctrl+R
   ```

2. **Intenta iniciar sesión**
   ```
   Email: tu_email@example.com
   Licencia: tu_clave_de_licencia
   Haz clic en "Validar Licencia"
   ```

3. **Resultado esperado**
   ```
   ✅ Licencia válida
   ✅ Dispositivo registrado
   ✅ Acceso permitido
   ```

## 📋 Resumen de Pasos

```
PASO 1: Ejecutar supabase_ELIMINAR_TODAS_FIRMAS.sql
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

## 🔍 Verificación

### Después de PASO 1 (Eliminación)

En Supabase SQL Editor, ejecuta:

```sql
SELECT proname, pronargs, proargtypes 
FROM pg_proc 
WHERE proname = 'validate_flowdashboard_license';
```

**Resultado esperado**: 0 filas (sin funciones)

### Después de PASO 2 (Creación)

En Supabase SQL Editor, ejecuta:

```sql
SELECT proname, pronargs, proargtypes 
FROM pg_proc 
WHERE proname = 'validate_flowdashboard_license';
```

**Resultado esperado**: 1 fila (SOLO 1 función con 13 parámetros)

### Verificar que pgcrypto Funciona

```sql
SELECT encode(digest('test', 'sha256'), 'hex');
```

**Resultado esperado**: Un hash SHA256

## ⚠️ Importante

- **NO** ejecutes ambos scripts al mismo tiempo
- **PRIMERO** ejecuta `supabase_ELIMINAR_TODAS_FIRMAS.sql`
- **LUEGO** ejecuta `supabase_license_rpc_LIMPIO.sql`
- **ESPERA** a que cada uno se complete antes de ejecutar el siguiente

## 🚀 Próximos Pasos

1. ✅ Ejecuta `supabase_ELIMINAR_TODAS_FIRMAS.sql`
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
```

Si ves más de 1 fila, significa que hay más firmas. Ejecuta nuevamente `supabase_ELIMINAR_TODAS_FIRMAS.sql`.

### Opción 2: Contactar Soporte Supabase

Si sigue sin funcionar:
1. Abre un ticket en Supabase Support
2. Menciona que hay funciones duplicadas que no se pueden eliminar
3. Pide que eliminen manualmente `validate_flowdashboard_license`

## 📁 Archivos

- `supabase_ELIMINAR_TODAS_FIRMAS.sql` - Elimina TODAS las firmas
- `supabase_license_rpc_LIMPIO.sql` - Crea la función correcta
- `SOLUCION_FINAL_SUPABASE.md` - Esta guía

## ✅ Checklist

- [ ] Ejecutaste `supabase_ELIMINAR_TODAS_FIRMAS.sql`
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
