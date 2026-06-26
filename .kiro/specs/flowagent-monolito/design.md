# FlowAgent Monolito - Design

Fecha: 2026-05-26

## Arquitectura general

```
[Cliente Electron Dashboard]
        |
        | HTTP / WebSocket
        v
[Backend Python local_adb_server.py]
        |
        | Socket TCP 8766 (JSON)
        v
[FlowAgent Monolito APK 1.0.0]
   |-- AccessibilityService (taps, swipes, dump UI tree)
   |-- ScreenCaptureThread (MediaProjection -> WebP -> socket)
   |-- AgentSocketClient (TCP a backend)
   |-- FlowKeyboardService (IME)
   |-- AutoJs6 Engine (Rhino + APIs)         <-- NUEVO
   |     |-- modules canonicos (__app__, __dialogs__, __floaty__, ...)
   |     |-- runtime de scripts
   |-- OpenCV 4 nativo                        <-- NUEVO
   |-- PaddleOCR / MLKit OCR                  <-- NUEVO
   `-- MainActivity con nueva UI              <-- REDISEÑADO
```

## Estructura de carpetas planeada

Vamos a crear `flow_agent_monolito/` paralelo al actual `flow_agent_apk/`. No tocamos el viejo hasta que el monolito este validado.

```
flow_agent_monolito/
  build.gradle.kts                   <-- root
  settings.gradle.kts
  gradle.properties
  gradle/wrapper/                    <-- gradle wrapper
  app/
    build.gradle.kts
    proguard-rules.pro
    src/main/
      AndroidManifest.xml
      java/com/flowlogin/agent/
        MainActivity.kt              <-- nueva UI
        AgentApplication.kt
        socket/
          AgentSocketClient.java
        accessibility/
          FlowAccessibilityService.java
        capture/
          ScreenCaptureThread.java
          MediaProjectionHolder.java
        keyboard/
          FlowKeyboardService.java
        identity/
          DeviceIdentity.java
        runner/                      <-- NUEVO
          ScriptRunner.kt            <-- bridge al engine AutoJs6
          OcrBridge.kt               <-- expone OCR como comando socket
          OpenCvBridge.kt            <-- expone OpenCV como comando socket
      res/
        layout/
          activity_main.xml          <-- nueva UI
          flow_keyboard_view.xml
        drawable/, mipmap-*/, values/
        xml/
          accessibility_service.xml
          flow_keyboard_method.xml
      assets/                        <-- modulos AutoJs6 (init.js, modules/__*.js, ocr models)
  autojs6_core/                      <-- modulo Gradle del motor AutoJs6
  opencv/                            <-- AAR de OpenCV 4
  README.md
```

## Estrategia de integracion AutoJs6

**Opcion A: Fork directo de AutoJs6**
- `git clone https://github.com/SuperMonster003/AutoJs6.git flow_agent_monolito_base`.
- Cambiar `applicationId` a `com.flowlogin.agent`.
- Cambiar `versionName` y `versionCode` segun el plan.
- Cambiar nombre y icono de la app.
- Insertar nuestras clases (FlowAccessibilityService, AgentSocketClient, etc) dentro de `app/src/main/java/com/flowlogin/agent/`.
- Cambiar la `MainActivity` por la nuestra y reasignar el intent-filter `LAUNCHER`.
- Mantener el resto de codigo de AutoJs6 intacto (modulos JS, runtime, plugins).

Esta es la opcion recomendada porque AutoJs6 es un proyecto vivo con cientos de archivos. Reescribir el monolito desde cero es inviable.

**Opcion B: AutoJs6 como modulo Gradle**
- Mas limpio en teoria, pero AutoJs6 NO publica un AAR oficial.
- Habria que hacer el AAR manualmente, lo cual implica casi tanto trabajo como la Opcion A.
- Riesgo de incompatibilidades sutiles.

**Vamos por Opcion A.**

## Plan de migracion de codigo FlowAgent

Archivos a mover desde `flow_agent_apk/` al fork de AutoJs6, renombrando si hay conflicto:

| Archivo actual | Destino | Renombrar? |
|---|---|---|
| `MainActivity.java` | `com.flowlogin.agent.MainActivity.kt` | Si, AutoJs6 ya tiene una. La nuestra reemplaza la suya como entry point |
| `FlowAccessibilityService.java` | `com.flowlogin.agent.accessibility.FlowAccessibilityService.java` | No (nombre unico) |
| `AgentSocketClient.java` | `com.flowlogin.agent.socket.AgentSocketClient.java` | No |
| `ScreenCaptureThread.java` | `com.flowlogin.agent.capture.ScreenCaptureThread.java` | No |
| `MediaProjectionHolder.java` | `com.flowlogin.agent.capture.MediaProjectionHolder.java` | No |
| `FlowKeyboardService.java` | `com.flowlogin.agent.keyboard.FlowKeyboardService.java` | No |
| `DeviceIdentity.java` | `com.flowlogin.agent.identity.DeviceIdentity.java` | No |

Recursos:
- `res/xml/accessibility_service.xml` -> mismo nombre (no choca con AutoJs6).
- `res/xml/flow_keyboard_method.xml` -> mismo nombre.
- `res/layout/flow_keyboard_view.xml` -> mismo nombre.
- `res/layout/activity_main.xml` -> reemplaza al de AutoJs6 al cambiar la entry activity.

## Bridges nuevos (JS -> Java)

AutoJs6 expone APIs Java al motor JS via `Rhino`. Vamos a:

### `ScriptRunner.kt` (nueva clase)
Recibe peticion `run_script` desde el `AgentSocketClient`:
```kotlin
fun run(scriptPath: String, options: Map<String,Any> = emptyMap()): String {
    // 1. Leer el archivo del path.
    // 2. Crear ScriptEngine de AutoJs6.
    // 3. Ejecutar.
    // 4. Devolver resultado o error como JSON al socket.
}
```

Reusa `org.autojs.autojs.engine.ScriptEngineService` y `ScriptExecution` de AutoJs6 sin modificarlos.

### `OcrBridge.kt`
- Detect en captura completa: `ocrDetect(serial: String): String`.
- Detect en region: `ocrDetectRegion(serial: String, x:Int, y:Int, w:Int, h:Int): String`.
- Detect bloques con bounding boxes: `ocrDetectAll(serial: String): JSONArray`.

Por dentro: usa MLKit Text Recognition (sincrono via `Tasks.await`) o PaddleOCR (sincrono).

Comando socket nuevo: `{"name":"ocr_detect", "region":[x,y,w,h]}` -> `{"ok":true, "text":"..."}`.

### `OpenCvBridge.kt`
- `findColor(image, color, threshold)` -> `[x,y]` o `null`.
- `matchTemplate(image, template, threshold)` -> `[x,y,w,h]` o `null`.

Comando socket: `{"name":"image_match_template", "templateBase64":"..."}` -> `{"ok":true, "found":true, "x":120, "y":340}`.

## Cambios en backend Python

Endpoints nuevos (todos siguen el patron actual):

| Endpoint | Body | Respuesta |
|---|---|---|
| `POST /flowagent/run-script` | `{serial, scriptPath, options}` | `{ok, output, error}` |
| `POST /flowagent/stop-script` | `{serial}` | `{ok}` |
| `POST /flowagent/ocr-detect` | `{serial, region?}` | `{ok, text, blocks}` |
| `POST /flowagent/find-template` | `{serial, templateBase64, threshold}` | `{ok, found, x, y}` |

Todos usan `agent_result(agent, {"name":"run_script", ...})` que envia por socket.

## Cambios visuales en MainActivity

Layout `activity_main.xml`:

```
┌────────────────────────────────────────────┐
│  FlowAgent  v1.0.0          [●  CONECTADO] │
├────────────────────────────────────────────┤
│  Estado del telefono                        │
│   • Accesibilidad        [✓ Activa]         │
│   • Captura de pantalla  [✓ Activa]         │
│   • Permiso overlay      [✓ Concedido]      │
│   • FlowKeyboard         [○ Disponible]     │
│                                             │
│  Conexion                                   │
│   • Socket               [✓ 8766]           │
│   • Backend              [192.168.1.x:8765] │
│   • Latencia             [12 ms]            │
│                                             │
│  Ultimo script                              │
│   test_hello.js  hace 5s  ✓                 │
│                                             │
│  [        ACTIVAR TODO        ]             │
│  [    Abrir AutoJs6 Editor    ]             │
│  [        Ver registros       ]             │
└────────────────────────────────────────────┘
```

- Paleta consistente con dashboard (cyan #45caff, verde #22b86f).
- Material Components 3 (botones con elevacion suave).
- Sin emojis en strings.xml.
- Iconos SVG de Material Symbols.

## Versionado

| Componente | Antes | Despues |
|---|---|---|
| `versionName` | 0.3.8 | 1.0.0 |
| `versionCode` | 19 | 100 |
| `applicationId` | com.flowlogin.agent | com.flowlogin.agent (igual) |
| keystore | flowagent-debug.keystore | mismo |
| signingConfig | debug | release con misma keystore |
| minSdk | 26 | 24 |
| targetSdk | 28 | 33 |
| compileSdk | 28 | 34 |

## Lista de dependencias Gradle a importar

```kotlin
// app/build.gradle.kts
dependencies {
    // Mantener todas las que AutoJs6 ya trae.
    // Agregar nuestras:
    implementation("com.google.mlkit:text-recognition:16.0.0")  // OCR
    implementation("com.google.mlkit:text-recognition-chinese:16.0.0")  // OCR chino
    implementation("org.opencv:opencv:4.10.0")  // o el AAR oficial
    // No agregamos PaddleOCR aun, MLKit cubre el caso de uso.
}
```

## Plan de despliegue

Ver `tasks.md` para el desglose por fase. Resumen:

1. Setup (clonado, primer build verde).
2. Migracion de codigo FlowAgent.
3. Validacion en `.43`.
4. Bridges OCR + OpenCV.
5. Nueva UI MainActivity.
6. Despliegue gradual: 1 -> 3 -> 17.
7. Documentacion.

## Compatibilidad con dashboard actual

El dashboard Electron NO requiere cambios para que el monolito funcione, porque:
- Mismo socket TCP 8766.
- Mismos comandos JSON existentes (`tap`, `swipe`, `dump`, etc).
- Comandos nuevos (`run_script`, `ocr_detect`, `find_template`) son opt-in.

El dashboard puede empezar a usar los comandos nuevos cuando los UI panels esten listos. Mientras tanto, los antiguos siguen funcionando.

## Plan B (rollback)

Si el monolito falla en `.43`:
- `pm install -r flowagent-debug.apk` (el FlowAgent 0.3.8 viejo) restaura todo.
- Los teléfonos sin actualizar siguen con 0.3.8 sin problema.
- AutoJs6 separado sigue siendo el plan B funcional.

Si falla durante despliegue masivo:
- Solo desplegar a un teléfono a la vez. Si el primero ok, seguir.
- Mantener `flow_agent_apk/build/flowagent-debug.apk` (0.3.8) listo para rollback.
