# 🔐 Problema: Anon Key vs Service Role Key

## ❌ Problema Actual

```
Error: function digest(text, unknown) does not exist
```

**Causa Real**: El servidor está usando la **anon key** de Supabase, que tiene permisos limitados y NO puede usar `pgcrypto`.

## 🔍 Explicación Técnica

### Anon Key (Pública)
- ❌ Permisos limitados
- ❌ NO puede usar extensiones como `pgcrypto`
- ❌ NO puede usar `digest()`
- ✅ Solo lectura/escritura de datos

### Service Role Key (Privada)
- ✅ Permisos completos
- ✅ Puede usar extensiones como `pgcrypto`
- ✅ Puede usar `digest()`
- ✅ Lectura/escritura de datos
- ⚠️ NUNCA debe exponerse en el cliente

## ✅ Solución

El servidor Python (`local_adb_server.py`) debe usar la **service_role key** en lugar de la **anon key**.

### Paso 1: Obtener las Claves de Supabase

1. **Abre Supabase**
   - https://supabase.com
   - Selecciona tu proyecto

2. **Ve a Settings → API**
   - Panel izquierdo → Settings → API

3. **Copia las Claves**
   - `anon public` - Clave pública (NO usar para esto)
   - `service_role secret` - Clave privada (USAR ESTA)

### Paso 2: Configurar el Servidor

El archivo `local_adb_server.py` necesita usar la **service_role key**.

**Ubicación en el código**:
```python
SUPABASE_API_KEY = os.getenv("SUPABASE_API_KEY", "")
```

**Debe ser**:
```python
SUPABASE_API_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
```

O configurar la variable de entorno:
```
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
```

### Paso 3: Verificar la Configuración

En `local_adb_server.py`, busca:

```python
SUPABASE_HEADERS = {
    "Authorization": f"Bearer {SUPABASE_API_KEY}",
    "apikey": SUPABASE_API_KEY,
    "Content-Type": "application/json",
}
```

Debe usar la **service_role key**, no la **anon key**.

## 📋 Checklist

- [ ] Obtuviste la `service_role secret` de Supabase
- [ ] Configuraste la variable de entorno `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Reiniciaste el servidor (`local_adb_server.py`)
- [ ] Recargaste el dashboard
- [ ] Intentaste iniciar sesión
- [ ] La validación funciona correctamente

## 🚀 Próximos Pasos

1. Obtén la `service_role secret` de Supabase
2. Configura la variable de entorno
3. Reinicia el servidor
4. Recarga el dashboard
5. Intenta iniciar sesión nuevamente

---

**Versión**: 1.0.0  
**Fecha**: 2026-05-21  
**Estado**: ✅ Identificado el Problema
