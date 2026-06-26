# Plan Monolito PRO

Ultima actualizacion: 2026-05-31

## Objetivo

Construir una arquitectura PRO estable:

- Un solo APK monolito: `com.flowlogin.agent`.
- Una sola opcion visible de Accesibilidad, basada en el motor AutoJs6.
- FlowAgent socket como capa de producto/API encima del motor Android.
- FlowKeyboard como IME humano para texto.
- scrcpy reservado para video H.264, Focus Mode y diagnostico visual.
- Auditoria global de mojibake/encoding en APK, dashboard, servidores y docs.

## Estado Actual

- El backend prioriza el monolito:
  `flow_agent_monolito/app/build/outputs/apk/app/release/agent-v1.0.0-arm64-v8a.apk`.
- Package esperado: `com.flowlogin.agent`.
- Version esperada: `1.0.0`, `versionCode=103`.
- El monolito actual declara dos servicios de Accesibilidad:
  - `org.autojs.autojs.core.accessibility.AccessibilityServiceUsher`.
  - `com.flowlogin.agent.FlowAccessibilityService`.
- Android muestra una opcion por servicio de Accesibilidad, no una por APK.
- Por eso ahora puede verse mas de una opcion aunque sea un solo APK.
- `FlowKeyboardService` y `HumanInputBridge` del monolito ya tienen una ruta `keyboard_type_human` con QWERTY visible y `dispatchGesture`.
- `.43` fue usado para prueba de reinstalacion del monolito. Tras uninstall/install, Android dejo Accesibilidad e IME apagados.
- `.48` fue usado para pruebas preliminares de scrcpy externo. No se integro todavia scrcpy control dentro del Focus embebido.

## Principios De Seguridad

- No desplegar cambios en toda la flota hasta pasar por 1, 3, 10 y 17 dispositivos.
- No borrar `FlowAccessibilityService` hasta que todos los comandos funcionen con el engine AutoJs6.
- No hacer reemplazos globales de mojibake sin reporte y revision.
- No copiar secretos ni datos sensibles desde `device_names.json` o `.flowlogin_payloads`.
- No cambiar contratos HTTP/socket existentes salvo agregar campos compatibles.
- No depender de ADB del PATH: usar `scrcpy-win64-v4.0/adb.exe`.
- Mantener rollback de APK antes de cada fase riesgosa.

## Arquitectura Deseada

```text
Dashboard Electron
  -> local_adb_server.py HTTP
  -> FlowAgent socket
  -> Command Router
  -> AccessibilityEngine basado en AutoJs6
  -> Android

FlowKeyboard
  -> IME visible
  -> teclas reales
  -> dispatchGesture sobre QWERTY
  -> timing humano

scrcpy
  -> H.264 video
  -> Focus/diagnostico
  -> posible input manual futuro por SDK/UHID
```

## Roadmap

### Fase 0 - Restore Point

Crear punto de restauracion del repo y APKs funcionales antes de tocar arquitectura.

### Fase 1 - Auditoria Global Mojibake

Escanear todo el repo, clasificar por riesgo y corregir primero UI visible y strings del APK.

### Fase 2 - FlowKeyboard Humano V2

Completar soporte de texto humano: simbolos, numeros, shift visual, errores, pausas y perfiles por campo.

### Fase 3 - Perfiles Humanos Por Dispositivo

Persistir estilos de comportamiento distintos por dispositivo/MAC/serial.

### Fase 4 - Gestos Humanos

Taps con zona segura, jitter, duracion variable, swipes curvos y scroll con desaceleracion.

### Fase 5 - Esperas Por Estado Real

Reducir sleeps fijos y esperar nodos, OCR, cambios visuales o estados reales.

### Fase 6 - FlowAgent Socket Encima Del Engine

Crear una interfaz `AccessibilityEngine` y migrar comandos de FlowAgent hacia el engine AutoJs6 sin romper compatibilidad.

### Fase 7 - Una Sola Accesibilidad

Cuando todo funcione con AutoJs6, quitar `FlowAccessibilityService` como servicio visible del manifest o convertirlo en helper no visible.

### Fase 8 - Pruebas Graduales

Validar en 1, 3, 10 y 17 dispositivos con rollback claro.

## Riesgos Principales

- Romper AutoJs6 si se elimina su servicio o inicializacion interna.
- Romper comandos del dashboard si cambia el contrato socket/HTTP.
- Perder permisos de Accesibilidad tras uninstall/install.
- FlowKeyboard fallando con caracteres especiales.
- Jitter excesivo tocando fuera del elemento.
- OCR lento o con falsos positivos.
- Correcciones masivas de encoding introduciendo cambios no deseados.

## Validaciones Base

```powershell
node --check electron-app/src/renderer/app.js
node --check electron-app/src/renderer/flow-touch.js
python -m py_compile local_adb_server.py
cd flow_agent_monolito
.\gradlew.bat :app:assembleAppRelease
cd ..
.\scrcpy-win64-v4.0\adb.exe devices
```

