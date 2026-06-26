# 🔐 Solución - Habilitar pgcrypto en Supabase

## ❌ Problema

```
Error: function digest(text, unknown) does not exist
```

**Causa**: La extensión `pgcrypto` no está habilitada en Supabase.

## ✅ Solución

Necesitas habilitar `pgcrypto` PRIMERO, antes de crear la función.

## 🚀 Pasos (5 minutos)

### PASO 1: Habilitar pgcrypto

**Archivo**: `supabase_HABILITAR_PGCRYPTO.sql`

1. **Abre Supabase SQL Editor**
   ```
   https://supabase.com
   → Selecciona tu proyecto
   → Panel izquierdo: SQL Editor
   → New Query
   ```

2. **Copia el Script**
   ```
   Abre: supabase_HABILITAR_PGCRYPTO.sql
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

5. **Verifica que pgcrypto está habilitada**
   ```
   Deberías ver 2 resultados:
   
   1. Una fila con pgcrypto (de SELECT * FROM pg_extension)
   2. Un hash SHA256 (de SELECT encode(digest(...)))
   
   Si ves ambos, pgcrypto está habilitada correctamente
   ```

### PASO 2: Crear la Función

**Archivo**: `supabase_CREAR_FUNCION.sql`

1. **Abre Supabase SQL Editor**
   ```
   https://supabase.com
   → Selecciona tu proyecto
   → Panel izquierdo: SQL Editor
   → New Query
   ```

2. **Copia el Script**
   ```
   Abre: supabase_CREAR_FUNCION.sql
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

5. **Verifica que la función se creó**
   ```
   Panel izquierdo → Database → Functions
   Busca: validate_flowdashboard_license
   Deberías ver: 1 función
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
PASO 1: Ejecutar supabase_HABILITAR_PGCRYPTO.sql
        ↓
        Verifica que pgcrypto está habilitada
        ↓
PASO 2: Ejecutar supabase_CREAR_FUNCION.sql
        ↓
        Verifica que la función se creó
        ↓
PASO 3: Recarga el dashboard
        ↓
        Intenta iniciar sesión
        ↓
✅ FUNCIONA CORRECTAMENTE
```

## 🔍 Verificación Detallada

### Después de PASO 1 (Habilitar pgcrypto)

Deberías ver 2 resultados en Supabase:

**Resultado 1**: Extensión pgcrypto
```
extname: pgcrypto
extversion: 1.3
```

**Resultado 2**: Hash SHA256
```
test_hash: 9f86d081884c7d6d9ffd60014fc7ee77e42eaf2287f4d6e4efb2b5c3f1dd8b68
```

Si ves ambos, pgcrypto está habilitada correctamente.

### Después de PASO 2 (Crear función)

En Supabase SQL Editor, ejecuta:

```sql
SELECT proname, pronargs, proargtypes 
FROM pg_proc 
WHERE proname = 'validate_flowdashboard_license';
```

**Resultado esperado**: 1 fila con 13 parámetros

## ⚠️ Importante

- **NO** ejecutes ambos scripts al mismo tiempo
- **PRIMERO** ejecuta `supabase_HABILITAR_PGCRYPTO.sql`
- **LUEGO** ejecuta `supabase_CREAR_FUNCION.sql`
- **ESPERA** a que cada uno se complete antes de ejecutar el siguiente

## 🚀 Próximos Pasos

1. ✅ Ejecuta `supabase_HABILITAR_PGCRYPTO.sql`
2. ✅ Verifica que pgcrypto está habilitada
3. ✅ Ejecuta `supabase_CREAR_FUNCION.sql`
4. ✅ Verifica que la función se creó
5. ✅ Recarga el dashboard (F5)
6. ✅ Intenta iniciar sesión nuevamente
7. ✅ La validación debería funcionar

## 🔧 Si Sigue Sin Funcionar

### Opción 1: Verificar Manualmente

En Supabase SQL Editor, ejecuta:

```sql
-- Ver si pgcrypto está habilitada
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';

-- Probar digest()
SELECT encode(digest('test', 'sha256'), 'hex');

-- Ver la función
SELECT proname FROM pg_proc WHERE proname = 'validate_flowdashboard_license';
```

### Opción 2: Contactar Soporte Supabase

Si sigue sin funcionar:
1. Abre un ticket en Supabase Support
2. Menciona que pgcrypto no se puede habilitar
3. Pide que habiliten manualmente la extensión

## 📁 Archivos

- `supabase_HABILITAR_PGCRYPTO.sql` - Habilita pgcrypto
- `supabase_CREAR_FUNCION.sql` - Crea la función

## ✅ Checklist

- [ ] Ejecutaste `supabase_HABILITAR_PGCRYPTO.sql`
- [ ] Verificaste que pgcrypto está habilitada
- [ ] Viste el hash SHA256
- [ ] Ejecutaste `supabase_CREAR_FUNCION.sql`
- [ ] Verificaste que la función se creó
- [ ] Recargaste el dashboard
- [ ] Intentaste iniciar sesión
- [ ] La validación funciona correctamente

---

**Versión**: 1.0.0  
**Fecha**: 2026-05-21  
**Estado**: ✅ Listo para Usar
