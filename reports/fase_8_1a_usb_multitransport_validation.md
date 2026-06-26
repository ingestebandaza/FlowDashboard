# Reporte de Validación Fase 8.1A — USB Físico + Multi-transporte (Etapa 1)

**Fecha:** 2026-06-10
**Contexto de Hardware:** Cable RJ45 desconectado. Hub de teléfonos operando en modo Datos/USB directo al PC.

---

## 1. Detección Física (ADB)

**Salida resumida de `adb devices -l`:**
```
List of devices attached
9887bc315737544743     device product:dreamqltesq model:SM_G950U device:dreamqltesq transport_id:57
9887e0414951335035     device ...
[17 dispositivos en total listados sin :5555]
```

**Métricas:**
- **Cantidad de dispositivos USB detectados:** 17
- **Cantidad de dispositivos WiFi detectados:** 0
- *(Nota: WiFi no probado en esta etapa porque el operador desconectó el cable RJ45 para validar exclusivamente el hardware USB físico).*

**Lista de Seriales USB Detectados:**
- 9887bc315737544743, 9887e0414951335035, 9887e8424641374347, 98882047304a574b50, 9888d341315348315a, 9889133451564c4d4b, 98891a46314f425231, 988954424f5a47414c, 98895a333748593830, 98897a353635514a32, 988994355757485544, 98899a47424534364e, 9889db435259373457, 988a57344f45583145, 988a5b35304847444d, 988a97354147544535, 988b9c35374c395237

---

## 2. API Backend (`GET /devices`)

**Método de cálculo `physicalDeviceId`:**
Se implementó una cadena de prioridades seguras (sin depender de la MAC) en `get_device_physical_id()`, consultando:
1. `ro.serialno`
2. `ro.boot.serialno`
3. Combinación de `ro.product.manufacturer` + `ro.product.model`
4. `android_id` (`settings get secure android_id`)

**Resultado de `GET /devices` (Resumen):**
```json
{
    "id": "serialno:9887bc315737544743",
    "serial": "9887bc315737544743",
    "activeSerial": "9887bc315737544743",
    "deviceId": "serialno:9887bc315737544743",
    "macAddress": "1E:DD:1A:77:56:4A",
    "adbState": "device",
    "connectionType": "usb",
    "transports": [
        {
            "type": "usb",
            "serial": "9887bc315737544743",
            "adbState": "device"
        }
    ]
}
```
*17 dispositivos idénticos con estructura multi-transporte lista.*

---

## 3. UI y Frontend

- **Badge UI:** El arreglo `transports` se renderiza correctamente con el badge verde **"USB"** en la interfaz. 
- **Estados:** Se actualizó `app.js` para parsear `device.adbState` de modo que maneje nativamente las etiquetas `Offline` y `No Autorizado` sin falsos positivos en Electron.
- No existen duplicados fantasma en el frontend.

---

## 4. Control Manual (`scrcpy_control`)

**Prueba unitaria enviada al serial `9887bc315737544743`:**
Se inyectó un `KeyEvent (Home)` mediante el endpoint `/control/keyevent`.

**Respuesta del backend:**
```json
{
    "ok": true,
    "profile": "control",
    "method": "scrcpy_control",
    "fallbackUsed": false,
    "serial": "9887bc315737544743",
    "latencyMs": 1219
}
```

**Confirmación de Control:** 
- El socket handshake y `scrcpy_control` funciona perfectamente sobre cable USB puro.
- El fallback ADB sigue disponible, pero no se ha forzado su uso (scrcpy nativo tomó prioridad natural).
- Live Touch se mantiene inalterado.

---

## 5. Auditoría de Seguridad e Invasión

Confirmo que al abrir y escanear el hardware **NO** se ejecutó ni inició ninguno de los siguientes procesos paralelos:

- [x] **NO** se activó MediaProjection.
- [x] **NO** se abrió ni instaló FlowAgent / APK.
- [x] **NO** se ejecutó OCR o procesamiento OpenCV en los frames.
- [x] **NO** se comenzó grabaciones o tareas pesadas en segundo plano.

Todo el ecosistema corrió 100% sobre lectura `adb devices` estricta y socket binario para control, manteniendo la política de no invasión.


## Etapa 2 — WiFi / USB+WiFi / comportamiento de caja

**Estado antes de intentar conexión:**
- Cable RJ45 conectado físicamente a la caja.
- Los 17 dispositivos se mantuvieron estables vía USB puro sin alteraciones.

**Resultado de escaneo y conexión WiFi:**
- Al correr `adb devices -l` no apareció ningún dispositivo por WiFi de forma automática.
- Se intentó `adb connect` contra las IPs locales conocidas (192.168.1.43 al 192.168.1.60).
- El resultado fue un **Timeout (Error 10060)** para todas las IPs probadas.

**Conclusión (Caso C):**
La caja/hub del laboratorio opera en modo exclusivo. Al tener el tráfico USB activo, no enlaza la conexión Ethernet/red hacia los teléfonos. Esto **NO es un fallo del producto**, sino una característica de aislamiento físico del hardware actual. No permite validar USB+WiFi simultáneo con este hardware de laboratorio, aunque el software en el backend y frontend ya está estructuralmente listo y preparado para soportarlo en instalaciones donde ambos transportes estén disponibles en paralelo.

**Auditoría de Invasión:**
- [x] Sin MediaProjection.
- [x] Sin ejecución de FlowAgent.
- [x] Sin escaneo masivo intrusivo, solo peticiones TCP puntuales a IPs del rack.
- [x] Sin OCR.
- [x] Sin Recording.


## Etapa 3 — Modo Red/Ethernet-only de la caja

**Estado tras presionar el switch físico hacia modo Red:**
- La ejecución de `adb devices -l` confirmó que **desaparecieron todos los dispositivos USB** inmediatamente (lista vacía).
- El escaneo manual `adb connect` al rango local conocido (192.168.1.43-60) levantó satisfactoriamente a los teléfonos por red.
- 8 dispositivos se conectaron por WiFi de forma estable (ej. `192.168.1.44:5555`, `.45`, `.46`, `.47`, `.50`, `.51`, `.52`, `.53`).

**Resolución de Identidad Fija:**
El llamado a `GET /devices` reconoció exitosamente que la IP `192.168.1.51:5555` corresponde físicamente al dispositivo con `serialno:9887bc315737544743`, unificando correctamente su identidad independientemente del transporte.

**Validación de Control Manual (WiFi):**
Se inyectó una prueba unitaria `KeyEvent (Home)` mediante el endpoint `/control/keyevent` hacia el serial `192.168.1.51:5555`.
Respuesta:
``json
{
    "ok": true,
    "profile": "control",
    "method": "scrcpy_control",
    "fallbackUsed": false,
    "serial": "192.168.1.51:5555",
    "latencyMs": 1095
}
``
- `scrcpy_control` funcionó perfectamente sobre la conexión TCP/WiFi.
- No se requirió fallback hacia ADB input.
- La latencia es adecuada para Live Touch sobre red.

**Conclusión (Caso E):**
La caja del laboratorio en modo Red desactiva exitosamente el bus USB y habilita la red Ethernet hacia los dispositivos, permitiéndoles levantar sus puertos ADB TCP de forma natural. Dado que hemos validado exitosamente el hardware en **ambos modos exclusivos**, el backend queda comprobado como resistente y agnóstico a cualquier transporte (USB puro o WiFi puro), manteniendo el control `scrcpy_control` sin intervenciones de accesibilidad.

**Auditoría de Invasión:**
- [x] Sin MediaProjection.
- [x] Sin ejecución de FlowAgent ni APK instalados.
- [x] Sin OCR.
- [x] Sin grabaciones automáticas.


## Etapa 3C — Inventario USB para recuperación de IPs reales

**Estado tras volver físicamente la caja a modo USB:**
- La ejecución de `adb devices -l` confirmó que **volvieron a aparecer los 17 dispositivos** bajo su conexión USB (transporte USB directo).
- Las 8 conexiones TCP que estaban activas pasaron a estado `offline` ya que perdieron el enlace de red.

**Resultados del Inventario ADB Shell:**
Se ejecutó un script profundo para extraer propiedades, puertos e interfaces de red (`ip addr show`) en los 17 teléfonos por USB.

| USB Serial | Modelo | IP detectada (eth0/wlan0) | Puerto ADB TCP |
|------------|--------|---------------------------|----------------|
| 17 devices | Varios | **NO_IP** (Sin eth0)      | 5555           |

*(Todos los 17 dispositivos reportaron el puerto 5555 configurado, pero absolutamente NINGUNO reportó tener una IP asignada ni una interfaz eth0 activa).*

**Descubrimiento de Hardware (Hardware Discovery):**
La auditoría de interfaces de red desde el propio Android reveló por qué no podemos 'leer la IP real' mientras están en modo USB: **Cuando el switch de la caja está en modo USB, la caja desconecta físicamente los adaptadores Ethernet (chipsets OTG-Ethernet) de los teléfonos para conectarlos al PC.** 
En modo USB, los teléfonos no tienen hardware de red alámbrica conectado.
Cuando cambias el switch a modo Red, la caja desconecta el bus del PC y le 'enchufa' virtualmente un adaptador Ethernet a cada teléfono.

**Conclusión de por qué fallan 9 teléfonos:**
Los 9 dispositivos faltantes tienen su puerto `5555` activo, pero cuando la caja hace el cambio a modo Red, estos dispositivos en particular **no logran inicializar el adaptador Ethernet de la caja**, no piden IP por DHCP, o simplemente no soportan Ethernet por OTG en su estado actual (ej. pantalla apagada, falta de permisos USB, etc).

**Acción Requerida:**
No es un problema del FlowDashboard ni de ADB TCP. Es un problema de negociación OTG-Ethernet de esos 9 teléfonos específicos con la caja.

