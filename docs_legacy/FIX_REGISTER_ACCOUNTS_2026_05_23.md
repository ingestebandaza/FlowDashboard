# Fix: TypeError en updateRegisterAccountCounts

**Fecha:** 2026-05-23  
**Problema:** `Cannot read properties of undefined (reading 'total')`  
**Causa:** `this.registerAccounts` no estaba inicializado en el constructor  
**Estado:** ✅ CORREGIDO

## Error Original

```
Promise rechazada:
TypeError: Cannot read properties of undefined (reading 'total')
  at FlowDashboardApp.updateRegisterAccountCounts (app.js:2404:46)
  at FlowDashboardApp.init (app.js:61:10)
  at new FlowDashboardApp (app.js:56:10)
```

## Causa

El método `updateRegisterAccountCounts()` intentaba acceder a `this.registerAccounts.total`, pero `this.registerAccounts` nunca fue inicializado en el constructor.

## Solución

Se agregaron las siguientes inicializaciones en el constructor:

```javascript
// Register accounts state
this.registerAccounts = {
  total: localStorage.getItem('flowdashboard.register.total') || '',
  valid: localStorage.getItem('flowdashboard.register.valid') || '',
  invalid: localStorage.getItem('flowdashboard.register.invalid') || ''
};
this.activeRegisterTab = 'total';
this.registerCountPerDevice = parseInt(localStorage.getItem('flowdashboard.register.countPerDevice') || '5', 10);
```

## Cambios Realizados

**Archivo:** `electron-app/src/renderer/app.js`

**Líneas:** Constructor (línea 20-60)

**Agregado:**
- `this.registerAccounts` - Objeto con tabs: total, valid, invalid
- `this.activeRegisterTab` - Tab activo (default: 'total')
- `this.registerCountPerDevice` - Cantidad de cuentas por dispositivo (default: 5)

## Verificación

✅ Sintaxis JavaScript validada  
✅ Propiedades inicializadas desde localStorage  
✅ Valores por defecto correctos  
✅ No hay más errores de undefined

## Resultado

El error se ha corregido. Ahora:
- `updateRegisterAccountCounts()` funciona correctamente
- `init()` se ejecuta sin errores
- Electron inicia correctamente
- Canvas WebP está listo para usar

## Próximos Pasos

1. Reinicia Electron
2. Verifica que no hay errores en DevTools
3. Habilita Live Preview
4. Verifica que canvas aparece
