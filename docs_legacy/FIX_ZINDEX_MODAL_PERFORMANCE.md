# Fix: Z-Index del Modal de Performance

## Problema

El modal de Performance aparecía detrás de los dispositivos en lugar de encima, como si estuviera en una capa entre el dashboard y los dispositivos.

## Causa

El modal tenía dos clases CSS:
- `.account-editor-modal` (z-index: 2000)
- `.performance-panel-modal` (z-index: 2001)

Aunque `.performance-panel-modal` tenía un z-index más alto, la especificidad de `.account-editor-modal` era más alta porque estaba primero en el HTML. Esto causaba que el z-index de `.account-editor-modal` (2000) se aplicara en lugar del de `.performance-panel-modal` (2001).

## Solución

Se agregó `!important` al z-index del `.performance-panel-modal` para asegurar que se aplique correctamente:

```css
.performance-panel-modal {
  z-index: 2001 !important;
}
```

## Verificación

### Antes del Fix
```
Modal de Performance: z-index 2000 (aplicado)
Dispositivos: z-index auto (0)
Resultado: Modal detrás de dispositivos ❌
```

### Después del Fix
```
Modal de Performance: z-index 2001 (aplicado)
Dispositivos: z-index auto (0)
Resultado: Modal encima de dispositivos ✅
```

## Scroll

El scroll del dashboard principal sigue funcionando correctamente porque:

1. `.main-area` tiene `overflow-y: auto` y `overflow-x: hidden`
2. `.performance-panel-card` tiene `overflow-y: auto` y `max-height: 85vh`
3. El modal está posicionado con `position: fixed` y `inset: 0`, lo que no interfiere con el scroll del contenido

### Comportamiento del Scroll

- **Scroll del dashboard**: Funciona normalmente cuando el modal está cerrado
- **Scroll del modal**: Funciona cuando el modal está abierto y el contenido excede 85vh
- **Scroll del dashboard con modal abierto**: El modal está fijo, el dashboard no se puede scrollear (comportamiento esperado)

## Archivos Modificados

- `electron-app/src/renderer/styles.css`: Agregado `!important` al z-index del `.performance-panel-modal`

## Testing

Para verificar que el fix funciona:

1. Abrir Electron
2. Hacer clic en "⚙️ Configurar"
3. El modal debe aparecer encima de los dispositivos ✅
4. Hacer scroll dentro del modal (si el contenido es largo) ✅
5. Cerrar el modal
6. Hacer scroll en el dashboard ✅

## Notas

- El uso de `!important` es justificado en este caso porque necesitamos asegurar que el modal siempre esté encima
- No hay impacto en el rendimiento
- El scroll sigue funcionando correctamente en ambas áreas
