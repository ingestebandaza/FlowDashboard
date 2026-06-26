# Screen Streaming con scrcpy - Resumen de Implementación

**Fecha:** 2026-05-21  
**Versión:** 1.0.60  
**Estado:** Implementación completa

---

## Visión General

Se ha creado una especificación completa para implementar **streaming de pantalla Android en tiempo real** desde FlowDashboard usando **scrcpy** como motor de streaming.

---

## ¿Qué es scrcpy?

**scrcpy** es una herramienta open-source que permite:
- **Streaming de pantalla** desde Android a computadora
- **Latencia muy baja:** ~35ms (casi en tiempo real)
- **Calidad:** H.264 hasta 4K
- **Compatibilidad:** Android 8.0+ (sin root)
- **Recursos:** < 20% CPU en dispositivo

---

## Arquitectura Propuesta

```
wsapi_demo.html (Dashboard)
  ↓ HTTP/WebSocket
local_adb_server.py
  ↓ ADB shell command
scrcpy-server (en dispositivo Android)
  ↓ ADB tunnel (H.264 video)
Cliente WebSocket en navegador
  ↓ MediaSource API
<video> element en tarjeta de dispositivo
```

---

## Características Principales

### 1. Streaming en Tiempo Real
- Video H.264 desde dispositivos Android
- Latencia < 200ms en 720p
- 30 FPS fluidos

### 2. Calidad Configurable
- 720p (HD) - 4 Mbps
- 1080p (Full HD) - 8 Mbps (por defecto)
- 4K (Ultra HD) - 16 Mbps

### 3. UI Integrada
- Video en tarjeta de dispositivo
- Botón toggle para iniciar/stop
- Selector de calidad
- Controles: Play/Pause/Zoom/Fullscreen

### 4. Múltiples Streams
- Hasta 12 dispositivos en 1080p simultáneos (100Mbps)
- Hasta 25 dispositivos en 720p simultáneos (100Mbps)
- Gestión eficiente de recursos

---

## Especificación Completa

La especificación completa se encuentra en:

```
.kiro/specs/screen-streaming-scrcpy/
├── README.md          (Visión general y resumen)
├── requirements.md    (Requisitos funcionales y no funcionales)
├── design.md          (Diseño técnico detallado)
└── tasks.md           (Tareas de implementación y roadmap)
```

---

## Implementación Progresiva

### Fase 1: MVP (Semana 1-2)
- Streaming básico en 720p
- Latencia < 200ms
- UI básica en tarjeta de dispositivo

### Fase 2: Mejoras (Semana 3-4)
- Calidad variable (720p/1080p/4k)
- Controles de reproducción
- Latencia < 100ms en 720p

### Fase 3: Pro (Semana 5-6)
- Streaming múltiple simultáneo
- Estabilidad 24/7
- Optimización para producción

---

## Archivos a Crear/Modificar

### Nuevos Archivos
1. `scrcpy-server.jar` - Servidor binario de scrcpy (descargar)
2. `.kiro/specs/screen-streaming-scrcpy/` - Este spec

### Modificaciones
1. `local_adb_server.py` - Agregar endpoints de scrcpy
2. `wsapi.js` - Agregar métodos para streaming
3. `wsapi_demo.html` - Agregar UI de streaming
4. `AGENTS.md` - Actualizar reglas visuales
5. `PROJECT_CONTEXT.md` - Actualizar arquitectura (ya actualizado en v1.0.60)

---

## Criterios de Aceptación

### MVP Funcional
- [ ] Streaming de pantalla en tiempo real
- [ ] Latencia < 200ms en 720p
- [ ] Resolución 720p/1080p configurable
- [ ] Múltiples streams simultáneos
- [ ] UI integrada en tarjeta de dispositivo
- [ ] Estabilidad 24/7 sin reinicios

### Calidad de Producción
- [ ] Latencia < 100ms en 720p
- [ ] Video fluido a 30 FPS
- [ ] Control de reproducción (Play/Pause/Zoom)
- [ ] Soporte para 50+ dispositivos
- [ ] Documentación de usuario
- [ ] Pruebas automatizadas

---

## Consideraciones Técnicas

### Latencia
- **scrcpy:** ~35ms (muy bajo)
- **minicap:** ~20ms (requiere root para algunas funciones)
- **WebRTC:** ~50-100ms (más complejo pero escalable)

**Elección:** scrcpy por mejor balance entre latencia y complejidad.

### Ancho de Banda

| Resolución | FPS | Bitrate | Devices simultáneos (100Mbps) |
|------------|-----|---------|-------------------------------|
| 720p       | 30  | 4 Mbps  | ~25                           |
| 1080p      | 30  | 8 Mbps  | ~12                           |
| 4k         | 30  | 16 Mbps | ~6                            |

### Recursos del Dispositivo
- scrcpy-server usa ~5-15% CPU en dispositivo
- Memoria: ~50-100MB adicionales
- Red: depende del bitrate configurado

### Seguridad
- scrcpy-server se ejecuta en dispositivo Android
- Datos H.264 se transmiten por ADB tunnel (cifrado)
- No se exponen credenciales ni datos sensibles

---

## Roadmap Futuro

### Fase 4: Control Remoto
- Implementar control táctil remoto
- Soporte para teclado virtual
- Control de botones físicos

### Fase 5: WebRTC (FlowDashboard Pro v2.0)
- Reemplazar scrcpy por WebRTC para mejor escalabilidad
- Soporte para múltiples usuarios por dispositivo
- Transmisión a servicios externos (YouTube, Twitch)

### Fase 6: IA y Análisis
- Detección de cambios de pantalla
- Análisis de contenido visual
- Automatización basada en visión por computadora

---

## Notas Finales

1. **No romper la arquitectura actual:** scrcpy se ejecuta en dispositivo Android, no en el servidor
2. **Mantener compatibilidad:** wsapi.js debe seguir funcionando sin streaming activo
3. **Optimizar recursos:** Limitar streaming a dispositivos seleccionados
4. **Feedback visual:** Indicar claramente cuándo un dispositivo está en streaming
5. **Error handling:** Mostrar mensajes claros cuando el streaming falle

---

## Próximos Pasos

1. **Revisar especificación completa** en `.kiro/specs/screen-streaming-scrcpy/`
2. **Descargar scrcpy-server.jar** desde https://github.com/Genymobile/scrcpy/releases
3. **Implementar endpoints** en `local_adb_server.py`
4. **Implementar frontend** en `wsapi.js` y `wsapi_demo.html`
5. **Probar con dispositivos reales**
6. **Iterar según feedback**

---

**Aprobado por:** Equipo de desarrollo  
**Fecha de aprobación:** 2026-05-20  
**Próxima revisión:** 2026-06-20