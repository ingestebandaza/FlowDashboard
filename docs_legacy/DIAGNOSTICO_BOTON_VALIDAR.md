# 🔍 Diagnóstico - Botón Validar No Responde

## Problema Reportado
- ❌ El botón "Validar" no responde cuando se ingresa email y licencia
- ❌ No entra en la función de validación

## Posibles Causas

### 1. Error en la Función JavaScript
La función `validateLicense()` podría tener un error que impide su ejecución.

### 2. Endpoint No Disponible
El servidor podría no estar respondiendo al endpoint `/validate-license`.

### 3. Campos Vacíos
Los campos de email o licencia podrían estar vacíos.

### 4. Error de Red
Podría haber un problema de conectividad con el servidor.

## Cómo Diagnosticar

### Paso 1: Abre DevTools
```
F12 → Console
```

### Paso 2: Ingresa Email y Licencia
1. Ingresa tu email en el campo "Email del Usuario"
2. Ingresa tu licencia en el campo "Clave de Licencia"
3. Abre DevTools (F12) ANTES de hacer click

### Paso 3: Haz Click en Validar
Observa la consola para ver si hay errores.

### Paso 4: Verifica Errores
Busca en la consola:
- ❌ Errores en rojo (exceptions)
- ❌ Mensajes de error
- ✅ Mensajes de éxito

### Paso 5: Verifica Network
1. Abre DevTools (F12)
2. Ve a la pestaña "Network"
3. Haz click en "Validar"
4. Busca la solicitud a `/validate-license`
5. Verifica el status:
   - ✅ 200 = OK
   - ❌ 404 = No encontrado
   - ❌ 500 = Error del servidor

## Solución Rápida

### Opción 1: Verifica que el Servidor Está Activo
```bash
# En terminal
curl http://127.0.0.1:8765/health
```

Deberías ver una respuesta JSON con `"ok": true`

### Opción 2: Verifica que los Campos No Están Vacíos
En la consola (F12), ejecuta:
```javascript
console.log('Email:', document.getElementById('licenseDeviceEmail').value);
console.log('Licencia:', document.getElementById('licenseKey').value);
```

Ambos deben tener valores.

### Opción 3: Fuerza la Validación Manualmente
En la consola (F12), ejecuta:
```javascript
validateLicense()
```

Observa si hay errores.

### Opción 4: Verifica la Respuesta del Servidor
En la consola (F12), ejecuta:
```javascript
fetch('http://127.0.0.1:8765/validate-license', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    device_email: 'tu_email@ejemplo.com',
    license_key: 'tu_licencia',
    device_hostname: 'test',
    device_serial: 'test',
    device_os: 'Windows',
    ip_public: '0.0.0.0',
    country_code: 'US',
    device_hash: 'test',
    windows_user: 'test',
    local_ip: '127.0.0.1',
    mac_address: '00:00:00:00:00:00',
    country_name: 'United States'
  })
})
.then(r => r.json())
.then(d => console.log('Respuesta:', d))
.catch(e => console.error('Error:', e))
```

Observa la respuesta en la consola.

## Checklist de Verificación

- [ ] Servidor está activo (curl /health devuelve OK)
- [ ] Email no está vacío
- [ ] Licencia no está vacía
- [ ] DevTools abierto (F12)
- [ ] Hice click en "Validar"
- [ ] No hay errores en rojo en Console
- [ ] La solicitud a /validate-license tiene status 200
- [ ] La respuesta contiene datos válidos

## Próximos Pasos

1. Abre DevTools (F12)
2. Ingresa email y licencia
3. Haz click en "Validar"
4. Observa la consola para errores
5. Verifica la pestaña Network
6. Si hay errores, cópialos y reporta

## Notas Técnicas

### Función validateLicense()
```javascript
async function validateLicense(options = {}) {
  const email = document.getElementById('licenseDeviceEmail').value.trim();
  const key = document.getElementById('licenseKey').value.trim();
  
  if (!email || !key) {
    // Mostrar error: campos vacíos
    return;
  }
  
  // Enviar solicitud al servidor
  const response = await fetch('http://127.0.0.1:8765/validate-license', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({...})
  });
  
  // Procesar respuesta
  const data = await response.json();
  
  if (data.error || data.status === 'error') {
    // Mostrar error
  } else if (data.device_status === 'approved') {
    // Dispositivo aprobado
  }
}
```

### Endpoint /validate-license
```python
elif path == "/validate-license":
    result = validate_device_license(
        body.get("device_email", ""),
        body.get("license_key", ""),
        device_info={...}
    )
    self._json(result)
```

---

**Última actualización**: 2026-05-21
**Estado**: 🔍 Diagnóstico disponible
**Próximo paso**: Sigue los pasos de diagnóstico
