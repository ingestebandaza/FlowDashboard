# Screen Streaming con scrcpy - Especificación Completa

## Visión General

Este spec describe la implementación de streaming de pantalla Android en tiempo real desde FlowDashboard usando scrcpy como motor de streaming.

**Estado:** Diseño técnico completado  
**Versión:** 1.0  
**Fecha:** 2026-05-20  
**Autor:** Kiro AI

---

## Archivos del Spec

| Archivo | Descripción |
|---------|-------------|
| `README.md` | Este archivo - visión general y resumen |
| `requirements.md` | Requisitos funcionales y no funcionales |
| `design.md` | Diseño técnico detallado |
| `tasks.md` | Tareas de implementación y roadmap |

---

## Resumen Ejecutivo

### Problema Actual

FlowDashboard muestra dispositivos Android conectados por ADB pero **no tiene visualización de pantalla en vivo**. Esto limita la capacidad de monitorear y controlar dispositivos remotos.

### Solución Propuesta

Implementar streaming de pantalla usando **scrcpy**, una herramienta open-source que:

- **Latencia:** ~35ms (muy baja)
- **Calidad:** H.264 hasta 4K
- **Compatibilidad:** Android 8.0+ (sin root)
- **Recursos:** < 20% CPU en dispositivo

### Arquitectura

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

## Requisitos Técnicos

### Backend (local_adb_server.py)
- Nuevos endpoints HTTP para scrcpy
- Clase `ScrcpyStream` para gestionar streams
- Integración con ADB para controlar scrcpy-server

### Frontend (wsapi.js + wsapi_demo.html)
- Nuevos métodos en `Wsapi` class
- MediaSource API para H.264
- UI en tarjeta de dispositivo
- Controles de reproducción

### Dispositivos Android
- Android 8.0+ (API 26)
- Sin requerimientos de root
- scrcpy-server ejecutándose en dispositivo

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
5. `PROJECT_CONTEXT.md` - Actualizar arquitectura

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

## Consideraciones de Riesgo

### Riesgos Técnicos
1. **Compatibilidad Android:** Algunos fabricantes pueden bloquear scrcpy
   - **Mitigación:** Probar con múltiples dispositivos y marcas

2. **Ancho de banda:** Múltiples streams pueden saturar la red
   - **Mitigación:** Limitar calidad según capacidad de red

3. **Recursos del dispositivo:** scrcpy usa CPU y memoria
   - **Mitigación:** Limitar FPS y resolución

### Riesgos de Negocio
1. **Complejidad:** Implementación compleja puede retrasar MVP
   - **Mitigación:** Implementación progresiva en fases

2. **Mantenimiento:** scrcpy requiere actualizaciones periódicas
   - **Mitigación:** Automatizar descarga de actualizaciones

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

## Contacto y Soporte

Para preguntas o problemas con este spec, contactar al equipo de desarrollo.

---

## Historial de Versiones

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 2026-05-20 | Especificación inicial completada |

---

## Notas Finales

1. **No romper la arquitectura actual:** scrcpy se ejecuta en dispositivo Android, no en el servidor
2. **Mantener compatibilidad:** wsapi.js debe seguir funcionando sin streaming activo
3. **Optimizar recursos:** Limitar streaming a dispositivos seleccionados
4. **Feedback visual:** Indicar claramente cuándo un dispositivo está en streaming
5. **Error handling:** Mostrar mensajes claros cuando el streaming falle

---

**Aprobado por:** Equipo de desarrollo  
**Fecha de aprobación:** 2026-05-20  
**Próxima revisión:** 2026-06-20
