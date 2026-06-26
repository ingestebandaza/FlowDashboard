# 📸 Guía Visual - Ejecutar SQL en Supabase

## Paso 1: Acceder a Supabase

```
┌─────────────────────────────────────────────────────────┐
│ https://supabase.com                                    │
│                                                         │
│ [Inicia Sesión]                                         │
│                                                         │
│ Email: tu_email@example.com                             │
│ Contraseña: ••••••••                                    │
│                                                         │
│ [Inicia Sesión]                                         │
└─────────────────────────────────────────────────────────┘
```

## Paso 2: Seleccionar Proyecto

```
┌─────────────────────────────────────────────────────────┐
│ Mis Proyectos                                           │
│                                                         │
│ [Tu Proyecto] ← Haz clic aquí                           │
│ [Otro Proyecto]                                         │
│ [Otro Proyecto]                                         │
└─────────────────────────────────────────────────────────┘
```

## Paso 3: Abrir SQL Editor

```
┌─────────────────────────────────────────────────────────┐
│ Panel Izquierdo:                                        │
│                                                         │
│ ├─ Dashboard                                            │
│ ├─ SQL Editor ← Haz clic aquí                           │
│ ├─ Database                                             │
│ ├─ Auth                                                 │
│ ├─ Storage                                              │
│ └─ Settings                                             │
└─────────────────────────────────────────────────────────┘
```

## Paso 4: Crear Nueva Query

```
┌─────────────────────────────────────────────────────────┐
│ SQL Editor                                              │
│                                                         │
│ [New Query] ← Haz clic aquí                             │
│                                                         │
│ Queries Recientes:                                      │
│ - Query 1                                               │
│ - Query 2                                               │
└─────────────────────────────────────────────────────────┘
```

## Paso 5: Copiar el SQL

```
┌─────────────────────────────────────────────────────────┐
│ Archivo: supabase_license_rpc.sql                       │
│                                                         │
│ -- Validacion de licencias sin Edge Function.           │
│ -- Ejecutar en Supabase SQL Editor...                   │
│                                                         │
│ create extension if not exists pgcrypto;                │
│                                                         │
│ alter table public.app_devices                          │
│   add column if not exists license_id uuid,             │
│   add column if not exists pc_name text,                │
│   ...                                                   │
│                                                         │
│ [Ctrl+A] Seleccionar todo                               │
│ [Ctrl+C] Copiar                                         │
└─────────────────────────────────────────────────────────┘
```

## Paso 6: Pegar en SQL Editor

```
┌─────────────────────────────────────────────────────────┐
│ SQL Editor - New Query                                  │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ -- Validacion de licencias sin Edge Function.       │ │
│ │ -- Ejecutar en Supabase SQL Editor...               │ │
│ │                                                     │ │
│ │ create extension if not exists pgcrypto;            │ │
│ │                                                     │ │
│ │ alter table public.app_devices                      │ │
│ │   add column if not exists license_id uuid,         │ │
│ │   add column if not exists pc_name text,            │ │
│ │   ...                                               │ │
│ │                                                     │ │
│ │ [Ctrl+V] Pegar                                      │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Paso 7: Ejecutar el SQL

```
┌─────────────────────────────────────────────────────────┐
│ SQL Editor - New Query                                  │
│                                                         │
│ [Run] ← Haz clic aquí (o Ctrl+Enter)                    │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ -- Validacion de licencias sin Edge Function.       │ │
│ │ create extension if not exists pgcrypto;            │ │
│ │ ...                                                 │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Ejecutando...                                           │
└─────────────────────────────────────────────────────────┘
```

## Paso 8: Verificar Éxito

```
┌─────────────────────────────────────────────────────────┐
│ SQL Editor - New Query                                  │
│                                                         │
│ ✅ Query ejecutada exitosamente                         │
│                                                         │
│ Resultados:                                             │
│ - Extension pgcrypto creada                             │
│ - Columnas agregadas a app_devices                      │
│ - Columnas agregadas a app_access_logs                  │
│ - Columnas agregadas a app_device_registrations         │
│ - Función validate_flowdashboard_license creada         │
│ - Permisos configurados                                 │
│                                                         │
│ ✅ ÉXITO                                                │
└─────────────────────────────────────────────────────────┘
```

## Paso 9: Verificar que la Función Existe

```
┌─────────────────────────────────────────────────────────┐
│ Panel Izquierdo:                                        │
│                                                         │
│ ├─ Database                                             │
│ │  ├─ Tables                                            │
│ │  ├─ Views                                             │
│ │  └─ Functions ← Haz clic aquí                         │
│ │     ├─ validate_flowdashboard_license ✅              │
│ │     ├─ otra_funcion                                   │
│ │     └─ otra_funcion                                   │
│                                                         │
│ Deberías ver: validate_flowdashboard_license            │
└─────────────────────────────────────────────────────────┘
```

## Paso 10: Recargar Dashboard

```
┌─────────────────────────────────────────────────────────┐
│ Dashboard - FlowLogin                                   │
│                                                         │
│ [F5] Recargar página                                    │
│                                                         │
│ O                                                       │
│                                                         │
│ [Ctrl+Shift+R] Recargar sin caché                       │
│                                                         │
│ Deberías ver:                                           │
│ - Botón "Iniciar Sesión"                                │
│ - Campo de Email                                        │
│ - Campo de Licencia                                     │
│ - Sin errores de validación                             │
└─────────────────────────────────────────────────────────┘
```

## Paso 11: Iniciar Sesión

```
┌─────────────────────────────────────────────────────────┐
│ FlowLogin - Validación de Licencias                     │
│                                                         │
│ Email: tu_email@example.com                             │
│ Licencia: tu_clave_de_licencia                          │
│                                                         │
│ [Validar Licencia]                                      │
│                                                         │
│ Resultado esperado:                                     │
│ ✅ Licencia válida                                      │
│ ✅ Dispositivo registrado                               │
│ ✅ Acceso permitido                                     │
└─────────────────────────────────────────────────────────┘
```

## Resumen Visual

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1. Supabase.com                                        │
│     ↓                                                   │
│  2. Inicia Sesión                                       │
│     ↓                                                   │
│  3. Selecciona Proyecto                                 │
│     ↓                                                   │
│  4. SQL Editor → New Query                              │
│     ↓                                                   │
│  5. Copia supabase_license_rpc.sql                       │
│     ↓                                                   │
│  6. Pega en SQL Editor                                  │
│     ↓                                                   │
│  7. Haz clic en [Run]                                   │
│     ↓                                                   │
│  8. Verifica ✅ Éxito                                   │
│     ↓                                                   │
│  9. Verifica que función existe                         │
│     ↓                                                   │
│  10. Recarga Dashboard                                  │
│     ↓                                                   │
│  11. Intenta Iniciar Sesión                             │
│     ↓                                                   │
│  ✅ FUNCIONA CORRECTAMENTE                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Checklist Visual

```
┌─────────────────────────────────────────────────────────┐
│ CHECKLIST DE EJECUCIÓN                                  │
│                                                         │
│ [ ] Accediste a Supabase                                │
│ [ ] Seleccionaste tu proyecto                           │
│ [ ] Abriste SQL Editor                                  │
│ [ ] Creaste New Query                                   │
│ [ ] Copiaste supabase_license_rpc.sql                    │
│ [ ] Pegaste el SQL en el editor                         │
│ [ ] Ejecutaste el SQL (Run)                             │
│ [ ] Viste ✅ Éxito                                      │
│ [ ] Verificaste que la función existe                   │
│ [ ] Recargaste el dashboard                             │
│ [ ] Intentaste iniciar sesión                           │
│ [ ] La validación funciona correctamente                │
│                                                         │
│ ✅ TODO COMPLETADO                                      │
└─────────────────────────────────────────────────────────┘
```

---

**Versión**: 1.0.0  
**Fecha**: 2026-05-21  
**Estado**: ✅ Listo para Usar
