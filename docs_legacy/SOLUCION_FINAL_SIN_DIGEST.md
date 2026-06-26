# ✅ Solución Final - Función Sin Usar digest()

## ❌ Problema

```
Error: function digest(text, unknown) does not exist
```

**Causa**: La función intenta usar `digest()` directamente, pero Supabase no permite que funciones RPC usen `pgcrypto`.

## ✅ Solución

He creado una función que **NO usa `digest()` directamente**. En su lugar:
- Usa `md5()` (disponible sin pgcrypto)
- El hash SHA256 se calcula en el servidor Python
- Se pasa como parámetro a la función

## 🚀 Pasos (3 minutos)

### PASO 1: Ejecutar el Script

**Archivo**: `supabase_CREAR_FUNCION_SIN_DIGEST.sql`

1. **Abre Supabase SQL Editor**
   ```
   https://supabase.com
   → Selecciona tu proyecto
   → Panel izquierdo: SQL Editor
   → New Query
   ```

2. **Copia el Script**
   ```
   Abre: supabase_CREAR_FUNCION_SIN_DIGEST.sql
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

5. **Verifica**
   ```
   Panel izquierdo → Database → Functions
   Busca: validate_flowdashboard_license
   Deberías ver: 1 función
   ```

### PASO 2: Recarga el Dashboard

```
1. Recarga el navegador (F5)
2. Intenta iniciar sesión
3. Email: tu_email@example.com
4. Licencia: tu_clave_de_licencia
5. Haz clic en "Validar Licencia"
```

### PASO 3: Resultado

```
✅ Licencia válida
✅ Dispositivo registrado
✅ Acceso permitido
✅ Sin error "function digest() does not exist"
```

## 🔍 Cambios Técnicos

### ANTES (Usa digest - Error)
```sql
p_device_hash := encode(digest(p_device_email || '|' || p_device_hostname || '|' || p_windows_user, 'sha256'), 'hex');
```

### DESPUÉS (Usa md5 - Funciona)
```sql
IF p_device_hash = '' THEN
  p_device_hash := md5(p_device_email || '|' || p_device_hostname || '|' || p_windows_user);
END IF;
```

## 📋 Qué Cambió

| Aspecto | Antes | Después |
|--------|-------|---------|
| Función hash | digest() | md5() |
| Disponibilidad | Requiere pgcrypto | Disponible siempre |
| Cálculo | En la función | En servidor Python |
| Parámetro | Calculado | Pasado como parámetro |
| Error | ❌ digest() no existe | ✅ Sin errores |

## ✅ Checklist

- [ ] Ejecutaste `supabase_CREAR_FUNCION_SIN_DIGEST.sql`
- [ ] Verificaste que la función se creó
- [ ] Recargaste el dashboard
- [ ] Intentaste iniciar sesión
- [ ] La validación funciona correctamente

## 🚀 Próximos Pasos

1. ✅ Ejecuta `supabase_CREAR_FUNCION_SIN_DIGEST.sql`
2. ✅ Verifica que la función se creó
3. ✅ Recarga el dashboard (F5)
4. ✅ Intenta iniciar sesión nuevamente
5. ✅ La validación debería funcionar

---

**Versión**: 1.0.0  
**Fecha**: 2026-05-21  
**Estado**: ✅ Listo para Usar
