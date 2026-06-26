# FlowAgent Monolito - Requirements

Fecha: 2026-05-26
Punto de restauracion: `restore_points/PuntoAntesFlowAgentMonolito`
Sesion estimada: 4-8 horas dedicadas

## Objetivo

Construir una unica APK que combine FlowAgent actual + AutoJs6 (motor JS completo) + OpenCV + OCR (PaddleOCR/MLKit). El cliente final instala una sola APK y recibe todas las capacidades. Compite directamente con Laixi.

## Reglas duras (no negociables)

- **NO** romper FlowAgent en produccion. Probar en `.43` antes de masificar.
- **NO** tocar el dashboard Electron salvo cambios cosmeticos minimos para reflejar nueva version.
- **NO** introducir fallback ADB para gestos.
- FlowLogin / FlowRegister deben seguir funcionando exactamente igual.
- El backend Python sigue hablando con el APK por socket TCP 8766 con los mismos comandos JSON.
- Compatible con Android 9+ (cualquier arquitectura).
- `pm install -r` debe funcionar sobre los 17 telefonos que ya tienen FlowAgent 0.3.8 sin desinstalacion masiva.

## Funcionalidad requerida

### Mantener todo lo actual
- `FlowAccessibilityService` con comandos `tap`, `swipe`, `clickText`, `setText`, `setTextIndex`, `getEditTexts`, `dump`, `launchPackage`, `home`, `back`, `recents`, `capture_screen_start/stop`.
- `AgentSocketClient` con socket TCP al backend Python.
- `ScreenCaptureThread` con captura WebP cada 100 ms a 1080x1920.
- `MediaProjectionHolder` para compartir la projection.
- `MainActivity` con UI propia.
- `FlowKeyboardService` (IME `com.flowlogin.agent/.FlowKeyboardService`).
- `DeviceIdentity` con resolucion de serial WiFi.
- Mismo keystore (`flowagent-debug.keystore`) y misma firma para que `pm install -r` no rompa.
- Mismo `applicationId = com.flowlogin.agent`.

### Funcionalidad nueva del monolito

1. **Motor JS embebido (AutoJs6)**
   - El APK puede ejecutar archivos `.js` directamente sin necesidad de tener AutoJs6 instalado aparte.
   - Comando socket nuevo `run_script` que recibe `{name, path}` y delega al motor interno.
   - Comando socket nuevo `stop_script` que detiene la ejecucion.
   - APIs disponibles desde el script: `auto`, `device`, `dialogs`, `floaty`, `ui`, `threads`, `http`, `files`, `images`, `id/text/desc`, `swipe/press/click`, `app.launchPackage`, etc. (todo lo de AutoJs6 estandar).
   - Permiso `SYSTEM_ALERT_WINDOW` declarado en manifest para que `floaty.rawWindow` funcione (el APK lo solicita la primera vez via `PermissionRequestActivity` o por `appops`).

2. **OCR nativo en el APK**
   - Integrar PaddleOCR (latency ~200-400 ms por captura) y/o MLKit (mas rapido).
   - API exposable en JS: `ocr.detect(image)` -> string de texto, `ocr.detectAll(image)` -> array de bloques con bounding boxes.
   - API exposable como comando socket: `{name:"ocr_detect", region:[x,y,w,h]}` -> texto detectado.
   - Modelos offline (no requiere internet).

3. **OpenCV nativo en el APK**
   - Integrar `org.opencv:opencv` 4.x.
   - APIs estandar de Auto.js: `images.findImage(template)`, `images.findColor(color, options)`, `images.matchTemplate(...)`.
   - Comandos socket: `{name:"image_find_template", template:"<base64>"}`.

4. **Nueva apariencia del MainActivity**
   - Layout moderno con paleta cyan/verde acorde al dashboard.
   - Estado en vivo: socket conectado, accesibilidad ON, captura activa, version, ultimo script ejecutado.
   - Boton "Activar todo": guia paso a paso para conceder permisos (accesibilidad, overlay, captura).
   - Sin emojis nuevos; iconos vectoriales de Material/AndroidX.

5. **Anti-deteccion Zygisk (FASE B opcional)**
   - Modulo Magisk Zygisk que oculte `/system/bin/adbd`, propiedades `ro.adb.*` y procesos sospechosos a apps con anti-cheat.
   - Solo aplica a clientes con telefonos rooteados con Magisk.
   - NO bloqueante para el monolito basico.

## Restricciones tecnicas

- **Build con Gradle real** (no PowerShell artesanal).
- Tamaño esperado del APK: 50-80 MB (Universal con OpenCV + OCR).
- `versionName=1.0.0`, `versionCode=100` (salto desde 0.3.8 / 19 para dejar espacio).
- `minSdk=24` (Android 7+) por compatibilidad amplia, aunque garantizamos funcionamiento Android 9+.
- `targetSdk=33` o superior para conformidad Play Store si en algun momento se publica.
- Mismo keystore y misma firma que el APK actual.

## Criterios de aceptacion

Listas para validar tras cada despliegue:

### Aceptacion en .43 (primer dispositivo)
- [ ] APK instala con `pm install -r` sobre el FlowAgent 0.3.8 sin desinstalar.
- [ ] El socket TCP 8766 vuelve a conectar al backend Python al iniciar.
- [ ] `/agents` reporta el dispositivo con `accessibility=true`.
- [ ] `/api/streaming/stats` muestra `cachedFrames` aumentando para ese serial.
- [ ] FlowKeyboard sigue figurando como IME.
- [ ] Tap real desde el dashboard llega al telefono via socket.
- [ ] FlowLogin (Login.js) ejecuta una cuenta de prueba sin errores.
- [ ] Comando socket nuevo `run_script` ejecuta `test_hello.js` desde dentro del APK.
- [ ] Comando socket nuevo `ocr_detect` lee texto de una captura.

### Aceptacion en flota (3 dispositivos adicionales)
- [ ] Mismo checklist en 3 dispositivos al azar.
- [ ] FlowLogin masivo en los 4 dispositivos sin degradacion.

### Aceptacion final (17 dispositivos)
- [ ] Mismo checklist en los 17.
- [ ] Estabilidad sostenida 30 min con streaming + 1 ciclo de FlowLogin.
- [ ] `cachedFrames=17`, accesibilidad 17/17, runningJobs vacio al final.

## No-Goals de esta sesion

- Anti-deteccion Zygisk (queda como Fase B).
- Soporte de modulos Auto.js de terceros (plugins, mlkit-extra, paddleOCR-extra) mas alla de los core.
- Reescribir FlowKeyboard.
- Migrar el backend Python a Gradle/Kotlin.
- Cambiar el protocolo socket existente.

## Riesgos y mitigaciones

| Riesgo | Mitigacion |
|---|---|
| Build Gradle falla a la primera | Iterar; usar Android Studio para auto-import de dependencias |
| Conflicto de namespace AutoJs6 vs FlowAgent | Renombrar clases de FlowAgent con prefijo `FlowAgent*` antes de mergear |
| AutoJs6 declara su propio `MainActivity` | Cambiar la entry activity a la nuestra `com.flowlogin.agent.MainActivity` |
| Dependencias rotas en Android 9 | Probar en `.43` antes de masificar; rollback con FlowAgent 0.3.8 |
| Tamaño del APK rompe `adb install` | Subir timeout backend a 600s en `apps_install` y `autojs_install_bundled` |
| Keystore no coincide y `pm install -r` falla | Confirmar keystore al inicio de la sesion antes de cualquier build |
| OpenCV/PaddleOCR explotan en arm32 | Build inicial solo arm64-v8a; agregar arm para v1.1 |
| Dashboard Electron pierde compat con APK nuevo | NO romper protocolo socket; los comandos viejos siguen iguales |
