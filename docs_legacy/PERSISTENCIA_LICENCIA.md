# 🔐 Persistencia de Licencia - Guía Completa

## ¿Qué es?

La persistencia de licencia es una característica que **guarda automáticamente tu email de licencia** en el navegador para que no tengas que ingresarlo cada vez que abres el dashboard.

## ¿Cómo Funciona?

### 1. Primera Vez (Sin Licencia Guardada)
```
1. Abres: abrir_dashboard.bat
2. Se abre el dashboard en Chrome
3. Ingresas tu email de licencia
4. Haces click en "Validar" o "Conectar"
5. El email se guarda automáticamente en localStorage
```

### 2. Próximas Veces (Con Licencia Guardada)
```
1. Abres: abrir_dashboard.bat
2. Se abre el dashboard en Chrome
3. Tu email se carga automáticamente
4. ¡No necesitas ingresarlo nuevamente!
```

## Dónde se Guarda

La licencia se guarda en **localStorage del navegador**:
- **Ubicación**: Datos locales de Chrome
- **Clave**: `flowdashboard_license_email`
- **Tipo**: Texto plano (email)
- **Persistencia**: Permanece hasta que limpies caché del navegador

## Características

### ✅ Automático
- Se guarda automáticamente cuando ingresas la licencia
- Se carga automáticamente cuando abres el dashboard
- No requiere configuración manual

### ✅ Seguro
- Se guarda localmente en tu computadora
- No se envía a servidores externos
- Solo accesible desde tu navegador

### ✅ Sincronizado
- Si abres múltiples pestañas del dashboard
- La licencia se sincroniza entre ellas
- Cambios en una pestaña se reflejan en otras

### ✅ Fácil de Limpiar
- Puedes eliminar la licencia guardada en cualquier momento
- Simplemente limpia el caché del navegador
- O usa el comando: `window.LicensePersistence.clear()`

## Cómo Usar

### Guardar Licencia Manualmente
```javascript
// En la consola del navegador (F12)
window.LicensePersistence.save('tu_email@ejemplo.com');
```

### Cargar Licencia Guardada
```javascript
// En la consola del navegador (F12)
const license = window.LicensePersistence.load();
console.log(license); // { email: 'tu_email@ejemplo.com', deviceMac: null }
```

### Limpiar Licencia Guardada
```javascript
// En la consola del navegador (F12)
window.LicensePersistence.clear();
```

### Inyectar Licencia en Campo
```javascript
// En la consola del navegador (F12)
window.LicensePersistence.inject('tu_email@ejemplo.com');
```

## Cambios en abrir_dashboard.bat

### Antes
```batch
REM Detener Python si está corriendo local_adb_server.py
taskkill /F /IM python.exe 2>nul

REM Detener FlowDashboard.exe si existe
taskkill /F /IM FlowDashboard.exe 2>nul

REM Abrir en navegador (sin caché)
start "" "http://127.0.0.1:8765/wsapi_demo.html"
```

### Después
```batch
REM Detener Python si está corriendo local_adb_server.py (pero NO otros Python)
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq python.exe" 2^>nul') do (
    taskkill /F /PID %%a 2>nul
)

REM Abrir en Chrome (reutiliza ventana existente si está abierta)
start chrome "http://127.0.0.1:8765/wsapi_demo.html"
```

**Cambios principales**:
- ✅ Chrome NO se cierra
- ✅ Solo se detiene lo necesario (puerto 8765 y Python)
- ✅ Se abre en Chrome específicamente
- ✅ Reutiliza ventana existente si está abierta

## Cambios en wsapi_demo.html

Se agregó el script de persistencia:
```html
<script src="./license_persistence.js?v=20260521_184643"></script>
```

**Funcionalidades**:
- ✅ Carga automáticamente la licencia guardada
- ✅ Intercepta envíos de formulario
- ✅ Guarda la licencia cuando se valida
- ✅ Sincroniza entre pestañas del navegador

## Archivo Nuevo: license_persistence.js

Este archivo contiene toda la lógica de persistencia:

### Funciones Principales
```javascript
// Guardar licencia
saveLicenseToStorage(email, deviceMac)

// Cargar licencia
loadLicenseFromStorage()

// Limpiar licencia
clearLicenseFromStorage()

// Inyectar en campo
injectLicenseToField(email)
```

### Características
- Detecta automáticamente campos de email
- Intercepta clics en botones de validación
- Sincroniza entre pestañas
- Manejo de errores robusto
- Logging detallado en consola

## Flujo Completo

### Primera Ejecución
```
1. Usuario ejecuta: abrir_dashboard.bat
2. Script detiene procesos necesarios (NO Chrome)
3. Script inicia servidor ADB local
4. Script abre dashboard en Chrome
5. license_persistence.js se carga
6. Busca licencia guardada (no encuentra)
7. Usuario ingresa email de licencia
8. Usuario hace click en "Validar"
9. license_persistence.js intercepta el click
10. Guarda email en localStorage
11. Validación procede normalmente
```

### Ejecuciones Posteriores
```
1. Usuario ejecuta: abrir_dashboard.bat
2. Script detiene procesos necesarios (NO Chrome)
3. Script inicia servidor ADB local
4. Script abre dashboard en Chrome (nueva pestaña)
5. license_persistence.js se carga
6. Busca licencia guardada (ENCUENTRA)
7. Inyecta email en campo automáticamente
8. Dashboard está listo para usar
9. ¡Sin necesidad de ingresar email nuevamente!
```

## Ventajas

### ⏱️ Ahorra Tiempo
- No necesitas ingresar email cada vez
- Abre el dashboard y está listo
- Especialmente útil si abres varias veces al día

### 🔒 Seguro
- Se guarda localmente
- No se envía a internet
- Solo accesible desde tu navegador

### 🔄 Sincronizado
- Funciona en múltiples pestañas
- Cambios se reflejan automáticamente
- Consistencia entre sesiones

### 🧹 Fácil de Limpiar
- Puedes eliminar en cualquier momento
- Simplemente limpia caché del navegador
- O usa comando en consola

## Solución de Problemas

### Problema: La licencia no se guarda
**Solución**:
1. Abre DevTools: `F12`
2. Consola: Verifica que no hay errores
3. Verifica que localStorage está habilitado
4. Intenta guardar manualmente: `window.LicensePersistence.save('tu_email@ejemplo.com')`

### Problema: La licencia no se carga
**Solución**:
1. Abre DevTools: `F12`
2. Consola: Ejecuta `window.LicensePersistence.load()`
3. Verifica que devuelve tu email
4. Si no devuelve nada, la licencia no está guardada

### Problema: Quiero cambiar la licencia
**Solución**:
1. Limpia la licencia: `window.LicensePersistence.clear()`
2. Recarga la página: `F5`
3. Ingresa nueva licencia
4. Se guardará automáticamente

### Problema: Quiero usar otra licencia en otra pestaña
**Solución**:
1. Abre nueva pestaña: `Ctrl+T`
2. Ve a: `http://127.0.0.1:8765/wsapi_demo.html`
3. Limpia licencia: `window.LicensePersistence.clear()`
4. Recarga: `F5`
5. Ingresa nueva licencia

## Configuración Avanzada

### Cambiar Clave de Almacenamiento
Si quieres usar una clave diferente, edita `license_persistence.js`:
```javascript
// Línea 8
const LICENSE_STORAGE_KEY = 'flowdashboard_license_email';
// Cambia a:
const LICENSE_STORAGE_KEY = 'mi_clave_personalizada';
```

### Agregar Más Datos
Si quieres guardar más información (como MAC del dispositivo):
```javascript
// En consola
window.LicensePersistence.save('tu_email@ejemplo.com', 'AA:BB:CC:DD:EE:FF');
```

### Exportar Licencia
```javascript
// En consola
const license = window.LicensePersistence.load();
console.log(JSON.stringify(license));
```

## Compatibilidad

### Navegadores Soportados
- ✅ Chrome (recomendado)
- ✅ Edge
- ✅ Firefox
- ✅ Safari

### Requisitos
- localStorage habilitado
- JavaScript habilitado
- Cookies de terceros no necesarias

## Privacidad y Seguridad

### ¿Dónde se guarda?
- En tu computadora
- En la carpeta de datos de Chrome
- No en servidores externos

### ¿Quién puede acceder?
- Solo tú (desde tu navegador)
- Otros usuarios de la computadora (si acceden a Chrome)
- Programas que accedan a datos de Chrome

### ¿Cómo protegerlo?
1. Usa contraseña en tu computadora
2. No compartas acceso a Chrome
3. Limpia caché regularmente
4. Usa `window.LicensePersistence.clear()` si cambias de computadora

## Checklist de Verificación

- [ ] Ejecuté `abrir_dashboard.bat`
- [ ] Chrome NO se cerró
- [ ] Dashboard se abrió en Chrome
- [ ] Ingresé mi email de licencia
- [ ] Hice click en "Validar"
- [ ] Abrí DevTools (F12)
- [ ] Ejecuté `window.LicensePersistence.load()`
- [ ] Devolvió mi email
- [ ] Cerré el dashboard
- [ ] Ejecuté `abrir_dashboard.bat` nuevamente
- [ ] Mi email se cargó automáticamente
- [ ] ¡Todo funciona correctamente! ✅

---

**Última actualización**: 2026-05-21
**Estado**: ✅ Persistencia de licencia implementada
**Próximo paso**: Ejecuta `abrir_dashboard.bat` y prueba
