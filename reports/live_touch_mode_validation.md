# Live Touch Mode Validation Report

## 1. Hallazgos Adicionales: Focus visual gestures still affect perceived latency
Durante las pruebas de la Fase 1, se descubrió que aunque el modo Live Touch enviaba eventos más rápido para los taps, el swipe se sentía lento debido a que las animaciones visuales locales (flecha azul, marcadores de tap) seguían ejecutándose en el hilo de renderizado, bloqueando o alterando la percepción del gesto, y a su vez retrasando el envío puro del evento MOVE. 

Además, se detectó que para operaciones de arrastrar y soltar (ej. mover un icono), el sistema estaba programando un "Long Press" sintético que interfería con el Live Touch nativo.

## 2. Ajustes Realizados (Fase 2)
1. **Desactivación de Animaciones (`FLOWTOUCH_GESTURE_VISUALS = false`):**
   - Se desactivó completamente la flecha de arrastre azul y la onda del tap.
   - Todo el cálculo visual del *trail* se ignora por defecto, asegurando que `pointermove` procese y envíe el evento de inyección Android con mínima sobrecarga.
   
2. **Modo `LONG_PRESS_DRAG_MODE`:**
   - Si el usuario mantiene pulsado un elemento más del tiempo umbral de long press (500ms), en lugar de inyectar un swipe sintético estático bloqueante (comportamiento antiguo), el modo Live Touch ahora simplemente *mantiene el dedo abajo* de forma nativa (`DOWN` sostenido).
   - Esto permite que el usuario empiece a arrastrar el ratón después, activando la interfaz de arrastre de Android como lo haría un usuario físico.
   - El evento se libera normalmente con un `UP` al soltar el ratón.

3. **Métricas Temporales:**
   - Se añadieron mediciones explícitas de latencia usando `performance.now()`, registrando el ciclo exacto desde que Chromium detecta el `pointerdown`/`move`/`up` hasta que el socket recibe la confirmación.

## 3. Estado de Pruebas
- **Prueba en .44 (scrcpy_control):** ✅ COMPLETADO - Visuales OFF, swipe en tiempo real, tap corto, latencia OK.
- **Prueba en .45 (scrcpy_control):** ✅ COMPLETADO - Funciona correctamente.
- **Prueba en .53 (scrcpy_control):** ✅ COMPLETADO - Funciona correctamente.
- **Prueba en .48 (scrcpy_control):** ✅ COMPLETADO - RECUPERADO. Funciona perfectamente con Live Touch. Ya no requiere fallback ADB.

## 4. Decisión Final
Implementación HÍBRIDA (Delay DOWN + Live Touch) APROBADA y validada en dispositivos .44, .45, .48, .53.

## 5. False long press on short tap fixed
Se detecto que el modo Live Touch original inyectaba DOWN inmediatamente y UP en pointerup. Sin embargo, la separacion entre los mensajes de red (HTTP) provocaba que Android registrara duraciones de contacto superiores al umbral de long press para taps muy rapidos.

Para solucionarlo, se implemento un sistema Hibrido (Delay DOWN):
- Al detectar pointerdown, no se inyecta el DOWN nativo de inmediato.
- Si el usuario suelta el click rapidamente y sin moverse (Tap Corto), el gesto cae limpiamente al flujo legado de _handleTapGesture, el cual llama a /control/tap inyectando un tap perfecto sin arrastre.
- Si el usuario mueve el raton mas de 6px, el arrastre se activa e inyecta el DOWN retrasado y los subsecuentes MOVE.
- Si el usuario mantiene pulsado mas de 600ms, se inyecta el DOWN habilitando el verdadero LONG_PRESS_DRAG_MODE.
