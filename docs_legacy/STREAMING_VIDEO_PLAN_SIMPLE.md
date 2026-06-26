# 🎥 Plan Simplificado: Video Streaming con scrcpy

## 🎯 Enfoque Pragmático

Después de analizar las opciones, voy a implementar un **enfoque híbrido** que es más simple y compatible:

### Opción Elegida: scrcpy + MJPEG sobre WebSocket

**¿Por qué?**
- ✅ No requiere decodificador H.264 complejo
- ✅ Compatible con todos los navegadores
- ✅ Más simple de implementar
- ✅ Mejor que screenshots PNG (más rápido)
- ✅ Permite 30-60 FPS

**¿Cómo funciona?**
1. scrcpy captura frames del dispositivo
2. Backend convierte H.264 → JPEG (más ligero que PNG)
3. WebSocket envía JPEGs
4. Frontend muestra en `<img>` o `<canvas>`

## 📊 Comparación

| Método | FPS | Latencia | Complejidad | Compatibilidad |
|--------|-----|----------|-------------|----------------|
| **Screenshots PNG** (actual) | 10-20 | 500ms | Baja | ✅ Alta |
| **MJPEG/WebSocket** (nuevo) | 30-60 | 150ms | Media | ✅ Alta |
| **H.264/MSE** (futuro) | 60 | 100ms | Alta | ⚠️ Media |

## 🚀 Implementación

Voy a mantener el sistema actual de screenshots pero **optimizado**:

### Mejoras Inmediatas:
1. ✅ Usar JPEG en lugar de PNG (3x más rápido)
2. ✅ WebSocket en lugar de HTTP polling (menos overhead)
3. ✅ Buffer de frames para suavizar
4. ✅ Captura paralela de múltiples dispositivos

### Resultado:
- 📈 De 10-20 FPS → 30-40 FPS
- ⚡ De 500ms → 150ms latency
- 💾 Menos uso de ancho de banda (JPEG vs PNG)
- 🎯 Sin cambios complejos en el código

¿Te parece bien este enfoque? Es más realista y lo podemos tener funcionando en minutos.
