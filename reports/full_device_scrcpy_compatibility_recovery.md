# Inventario y Compatibilidad: Recuperación scrcpy-control

## Fase actual: Diagnóstico profundo de dispositivos del Rack Local

La flota local validada incluye `.44`, `.45`, `.48` y `.53` como dispositivos confirmados con `scrcpy_control` + Live Touch. Los demás dispositivos del rack local quedan pendientes de validación u offline temporal según disponibilidad. Esto no limita la cantidad de dispositivos soportados por el producto final.

**Objetivo:** Asegurar la compatibilidad universal del control manual basado en `scrcpy-control` con la nueva configuración fluida (Visuales OFF, Delay DOWN, Live Touch).

### Dispositivos Sanos Confirmados
| Serial | Estado | Modelo | Video OK | Control Custom | Oficial OK | Live Touch OK | Método |
|---|---|---|---|---|---|---|---|
| 192.168.1.44:5555 | Online | (por rellenar) | ✅ | ✅ | ✅ | ✅ | `scrcpy_live_touch` |
| 192.168.1.45:5555 | Online | (por rellenar) | ✅ | ✅ | ✅ | ✅ | `scrcpy_live_touch` |
| 192.168.1.53:5555 | Online | (por rellenar) | ✅ | ✅ | ✅ | ✅ | `scrcpy_live_touch` |

### Dispositivos bajo Investigación

#### 192.168.1.48:5555
- **Estado Actual:** Online
- **Prueba Nativa:** ✅ Funciona perfecto con `scrcpy.exe` oficial (Touch, Swipe, Home, Back).
- **Prueba UI (Dashboard):** ✅ Funciona perfecto con el fix del Dummy Byte y Live Touch híbrido.
- **Conclusión:** El fallo silencioso fue solucionado completamente con el fix del "Dummy Byte".
- **Estado de Recuperación:** RECUPERADO — `scrcpy_control` + Live Touch validado. Ya NO requiere ADB-only fallback.

#### Dispositivos .43 a .52 (Resto del rack)
*Se completará el inventario a medida que sean validados desde la UI.*

| Serial | Estado ADB | Video OK | Control Custom | Oficial OK | Live Touch OK | Método Actual | Problema / Decisión |
|---|---|---|---|---|---|---|---|
| 192.168.1.43:5555 | Online | ? | ? | ? | ? | Pendiente | Prueba requerida |
| 192.168.1.46:5555 | Online | ? | ? | ? | ? | Pendiente | Prueba requerida |
| 192.168.1.47:5555 | Online | ? | ? | ? | ? | Pendiente | Prueba requerida |
| 192.168.1.49:5555 | Online | ? | ? | ? | ? | Pendiente | Prueba requerida |
| 192.168.1.50:5555 | Online | ? | ? | ? | ? | Pendiente | Prueba requerida |
| 192.168.1.51:5555 | Online | ? | ? | ? | ? | Pendiente | Prueba requerida |
| 192.168.1.52:5555 | Online | ? | ? | ? | ? | Pendiente | Prueba requerida |

#### Dispositivos .54 a .60
*No respondieron durante esta validación local. Se marcan como offline temporal / no detectados en esta sesión. Esto no representa una limitación del producto ni del motor de control.*

| Serial | Estado ADB | Decisión |
|---|---|---|
| 192.168.1.54:5555 | Offline | Offline temporal / No detectado |
| 192.168.1.55:5555 | Offline | Offline temporal / No detectado |
| 192.168.1.56:5555 | Offline | Offline temporal / No detectado |
| 192.168.1.57:5555 | Offline | Offline temporal / No detectado |
| 192.168.1.58:5555 | Offline | Offline temporal / No detectado |
| 192.168.1.59:5555 | Offline | Offline temporal / No detectado |
| 192.168.1.60:5555 | Offline | Offline temporal / No detectado |

## Escalabilidad comercial y descubrimiento dinámico de dispositivos

- `.43-.60` es solo el rack local de pruebas de Esteban.
- El producto final debe funcionar con cualquier cantidad de teléfonos.
- Los dispositivos pueden conectarse por USB o WiFi.
- Los rangos de red deben ser configurables.
- Los dispositivos offline son estados temporales, no fallos.
- Los perfiles deben asignarse dinámicamente por serial detectado.
- No debe haber lógica comercial hardcodeada a `192.168.1.x`.
- No debe decirse que `.54-.60` están fuera del producto, solo fuera de esta sesión de validación local.
## Próximos Pasos Completados
1. **Verificación desde Dashboard (.48):** Exitosa. `.48` queda libre de restricciones.
2. **Offline .54-.60:** Se documentaron como offline temporal en el laboratorio local, sin limitar la escalabilidad del sistema.
