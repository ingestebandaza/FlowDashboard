# ✅ Crear la Función Correctamente

## 📋 Pasos Simples

### PASO 1: Abre Supabase SQL Editor

```
1. Abre https://supabase.com
2. Inicia sesión
3. Selecciona tu proyecto
4. Panel izquierdo → SQL Editor
5. Haz clic en "New Query"
```

### PASO 2: Copia el Script

```
1. Abre el archivo: supabase_CREAR_FUNCION.sql
2. Copia TODO el contenido (Ctrl+A, Ctrl+C)
```

### PASO 3: Pega en Supabase

```
1. En el SQL Editor de Supabase
2. Pega el contenido (Ctrl+V)
```

### PASO 4: Ejecuta

```
1. Haz clic en el botón "Run"
2. O presiona Ctrl+Enter
3. Espera a que se complete
```

### PASO 5: Verifica que se Creó

```
1. Panel izquierdo → Database → Functions
2. Busca: validate_flowdashboard_license
3. Deberías ver: 1 función (SOLO 1)
```

### PASO 6: Recarga el Dashboard

```
1. Recarga el navegador (F5)
2. Intenta iniciar sesión
3. Email: tu_email@example.com
4. Licencia: tu_clave_de_licencia
5. Haz clic en "Validar Licencia"
```

### PASO 7: Resultado

```
✅ Licencia válida
✅ Dispositivo registrado
✅ Acceso permitido
```

## 🔍 Verificación

### En Supabase SQL Editor

Ejecuta esta query para verificar:

```sql
SELECT proname, pronargs, proargtypes 
FROM pg_proc 
WHERE proname = 'validate_flowdashboard_license';
```

**Resultado esperado**: 1 fila con 13 parámetros

### Verificar que pgcrypto Funciona

```sql
SELECT encode(digest('test', 'sha256'), 'hex');
```

**Resultado esperado**: Un hash SHA256

## 📁 Archivo

- `supabase_CREAR_FUNCION.sql` - Script para crear la función

## ✅ Checklist

- [ ] Abriste Supabase SQL Editor
- [ ] Copiaste supabase_CREAR_FUNCION.sql
- [ ] Pegaste en el editor
- [ ] Ejecutaste el script
- [ ] Verificaste que hay 1 función
- [ ] Recargaste el dashboard
- [ ] Intentaste iniciar sesión
- [ ] La validación funciona correctamente

---

**Versión**: 1.0.0  
**Fecha**: 2026-05-21  
**Estado**: ✅ Listo para Usar
