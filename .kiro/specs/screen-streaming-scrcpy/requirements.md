# Requisitos: Screen Streaming con scrcpy

## Visión General

Implementar streaming de pantalla Android en tiempo real desde FlowDashboard usando scrcpy como motor de streaming.

**Estado actual:** Dashboard muestra dispositivos conectados pero sin visualización de pantalla en vivo.

**Objetivo:** Agregar capacidad de ver pantallas Android en tiempo real desde el dashboard web.

---

## Requisitos Funcionales

### RF1: Iniciar Streaming
- **ID:** RF1
- **Prioridad:** Alta
- **Descripción:** El usuario debe poder iniciar streaming de pantalla desde cualquier dispositivo conectado
- **Criterios de Aceptación:**
  - Botón "Streaming" en cada tarjeta de dispositivo
  - Al pulsar, inicia scrcpy-server en el dispositivo
  - Muestra video en tiempo real en la tarjeta
  - Indicador visual de estado "streaming activo"

### RF2: Detener Streaming
- **ID:** RF2
- **Prioridad:** Alta
- **Descripción:** El usuario debe poder detener streaming en cualquier momento
- **Criterios de Aceptación:**
  - Botón "Detener Streaming" visible mientras se transmite
  - Al pulsar, detiene scrcpy-server en el dispositivo
  - Video se detiene y se muestra estado "streaming detenido"
  - Recursos se liberan correctamente

### RF3: Calidad Configurable
- **ID:** RF3
- **Prioridad:** Media
- **Descripción:** El usuario debe poder seleccionar la calidad del streaming
- **Opciones:**
  - 720p (HD) - 4 Mbps, 1280x720
  - 1080p (Full HD) - 8 Mbps, 1920x1080 (por defecto)
  - 4K (Ultra HD) - 16 Mbps, 3840x2160
  - Personalizado
- **Criterios de Aceptación:**
  - Selector de calidad en cada tarjeta
  - Cambio de calidad sin reiniciar streaming
  - Ajuste automático según capacidad de red

### RF4: Múltiples Streams Simultáneos
- **ID:** RF4
- **Prioridad:** Media
- **Descripción:** El sistema debe soportar múltiples streams simultáneos
- **Criterios de Aceptación:**
  - Hasta 12 dispositivos en 1080p simultáneos (100Mbps)
  - Hasta 25 dispositivos en 720p simultáneos (100Mbps)
  - Sin degradación de calidad significativa
  - Gestión eficiente de recursos

### RF5: Control de Reproducción
- **ID:** RF5
- **Prioridad:** Media
- **Descripción:** El usuario debe poder controlar la reproducción del video
- **Funcionalidades:**
  - Play/Pause
  - Zoom in/out
  - Rotación de pantalla
  - Fullscreen
- **Criterios de Aceptación:**
  - Controles visibles y accesibles
  - Sin latencia significativa
  - Funcionan en todos los navegadores modernos

---

## Requisitos No Funcionales

### RNF1: Latencia
- **ID:** RNF1
- **Prioridad:** Alta
- **Requisito:** Latencia máxima de 200ms en 720p, 300ms en 1080p
- **Medición:** Tiempo desde captura en dispositivo hasta visualización en navegador
- **Método:** Pruebas con cronómetro manual y scripts automatizados

### RNF2: Calidad de Video
- **ID:** RNF2
- **Prioridad:** Alta
- **Requisito:** Video debe ser claro y fluido sin artefactos visibles
- **Criterios:**
  - Sin pixelación excesiva
  - Movimientos suaves (30 FPS mínimo)
  - Colores precisos
  - Sin cortes o congelamientos

### RNF3: Estabilidad
- **ID:** RNF3
- **Prioridad:** Alta
- **Requisito:** Streaming debe funcionar 24/7 sin reinicios
- **Criterios:**
  - Sin fugas de memoria
  - Sin desconexiones espontáneas
  - Recuperación automática de errores

### RNF4: Recursos del Dispositivo
- **ID:** RNF4
- **Prioridad:** Media
- **Requisito:** scrcpy-server debe usar < 20% CPU en dispositivo
- **Criterios:**
  - CPU < 20% en dispositivo Android
  - Memoria < 150MB adicionales
  - Red < bitrate configurado

### RNF5: Compatibilidad
- **ID:** RNF5
- **Prioridad:** Alta
- **Requisito:** Soportar Android 8.0 (API 26) a Android 14 (API 34)
- **Criterios:**
  - Funciona en dispositivos sin root
  - Compatible con todas las marcas (Samsung, Xiaomi, Huawei, etc.)
  - Sin dependencias de fabricante

### RNF6: Escalabilidad
- **ID:** RNF6
- **Prioridad:** Media
- **Requisito:** Sistema debe soportar 50+ dispositivos simultáneos
- **Criterios:**
  - Servidor no se satura con múltiples streams
  - Ancho de banda suficiente para todos los dispositivos
  - UI responsiva con muchos dispositivos

---

## Requisitos de UI/UX

### RUI1: Integración Visual
- **ID:** RUI1
- **Prioridad:** Alta
- **Requisito:** Streaming debe integrarse perfectamente con el diseño actual
- **Criterios:**
  - Video en tarjeta de dispositivo (no ventana emergente)
  - Mantiene colores y estilo de FlowDashboard
  - Sin desbordes en layout
  - Responsive en mobile

### RUI2: Feedback Visual
- **ID:** RUI2
- **Prioridad:** Alta
- **Requisito:** Usuario debe saber estado del streaming en todo momento
- **Indicadores:**
  - Icono de streaming en tarjeta
  - Color de borde cambia (verde = activo)
  - Contador de dispositivos en streaming
  - Mensajes de error claros

### RUI3: Facilidad de Uso
- **ID:** RUI3
- **Prioridad:** Alta
- **Requisito:** Streaming debe ser intuitivo
- **Criterios:**
  - Un solo clic para iniciar/stop
  - Selector de calidad visible pero no invasivo
  - Controles accesibles pero no prominentes
  - Sin necesidad de documentación

---

## Restricciones

### R1: Arquitectura Actual
- No se puede cambiar la arquitectura de local_adb_server.py
- wsapi.js debe mantener compatibilidad con endpoints existentes
- wsapi_demo.html debe mantener su diseño y estilos

### R2: Dependencias
- No se pueden agregar dependencias externas complejas
- scrcpy-server debe ser descargado desde GitHub releases
- No se puede requerir root en dispositivos Android

### R3: Licencias
- scrcpy-server usa licencia Apache 2.0 (compatible)
- FlowDashboard usa licencia propietaria
- No se pueden incluir dependencias con licencias conflictivas

### R4: Seguridad
- Datos H.264 se transmiten por ADB tunnel (ya cifrado)
- No se exponen credenciales ni datos sensibles
- No se requiere acceso a internet para streaming

---

## Suposiciones

### S1: Red Local
- Dispositivos Android están conectados por ADB (USB o WiFi)
- Red local tiene ancho de banda suficiente (100Mbps mínimo)
- No hay firewalls que bloqueen ADB

### S2: Dispositivos
- Android 8.0+ en todos los dispositivos
- Sin requerimientos de root
- Scrcpy-server puede ejecutarse en dispositivo

### S3: Servidor
- local_adb_server.py corre en Windows
- Python 3.8+ disponible
- Ancho de banda suficiente para múltiples streams

---

## Dependencias

### D1: scrcpy-server
- Versión: 2.7 o superior
- Fuente: https://github.com/Genymobile/scrcpy/releases
- Tamaño: ~500KB
- Licencia: Apache 2.0

### D2: ADB
- Versión: 31.0.0 o superior
- Fuente: Android SDK Platform Tools
- Tamaño: ~10MB
- Licencia: Apache 2.0

### D3: Browser Support
- Chrome 90+ (recomendado)
- Firefox 88+ (recomendado)
- Edge 90+ (recomendado)
- Safari 14+ (con limitaciones)

---

## Criterios de Aceptación

### CA1: MVP Funcional
- [ ] Streaming de pantalla en tiempo real
- [ ] Latencia < 200ms en 720p
- [ ] Resolución 720p/1080p configurable
- [ ] Múltiples streams simultáneos
- [ ] UI integrada en tarjeta de dispositivo
- [ ] Estabilidad 24/7 sin reinicios

### CA2: Calidad de Producción
- [ ] Latencia < 100ms en 720p
- [ ] Video fluido a 30 FPS
- [ ] Control de reproducción (Play/Pause/Zoom)
- [ ] Soporte para 50+ dispositivos
- [ ] Documentación de usuario
- [ ] Pruebas automatizadas

### CA3: Escalabilidad
- [ ] WebRTC para FlowDashboard Pro v2.0
- [ ] Control remoto táctil
- [ ] Audio streaming
- [ ] Transmisión a servicios externos

---

## Notas

1. **No romper la arquitectura actual:** scrcpy se ejecuta en dispositivo Android, no en el servidor
2. **Mantener compatibilidad:** wsapi.js debe seguir funcionando sin streaming activo
3. **Optimizar recursos:** Limitar streaming a dispositivos seleccionados
4. **Feedback visual:** Indicar claramente cuándo un dispositivo está en streaming
5. **Error handling:** Mostrar mensajes claros cuando el streaming falle
