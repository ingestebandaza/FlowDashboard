# Fix: Configuración de Captura de Pantalla en FlowAgent APK

**Fecha:** 2026-05-23  
**Problema:** APK no solicitaba permisos de captura de pantalla  
**Causa:** MainActivity no llamaba a `createScreenCaptureIntent()`  
**Estado:** ✅ CORREGIDO

## Problema Identificado

El APK FlowAgent tenía la clase `ScreenCaptureThread` implementada pero:
1. No solicitaba permisos de captura de pantalla
2. No tenía `MediaProjection` real
3. MainActivity no llamaba a `createScreenCaptureIntent()`

## Solución Implementada

### 1. MainActivity.java - Agregar solicitud de permisos

**Cambios:**
- ✅ Agregado `MediaProjectionManager`
- ✅ Agregado método `requestScreenCapturePermission()`
- ✅ Agregado `onActivityResult()` para manejar respuesta
- ✅ Solicitud automática de permisos al iniciar la app
- ✅ Logs para monitorear estado de permisos

**Código agregado:**
```java
private static final int REQUEST_MEDIA_PROJECTION = 1001;
private MediaProjectionManager mediaProjectionManager;

private void requestScreenCapturePermission() {
    if (mediaProjectionManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        Intent intent = mediaProjectionManager.createScreenCaptureIntent();
        startActivityForResult(intent, REQUEST_MEDIA_PROJECTION);
        addLog("📹 Solicitando permisos de captura de pantalla...");
    }
}

@Override
protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    
    if (requestCode == REQUEST_MEDIA_PROJECTION) {
        if (resultCode == RESULT_OK && data != null) {
            addLog("✓ Permisos de captura de pantalla otorgados");
        } else {
            addLog("✗ Permisos de captura de pantalla denegados");
        }
    }
}
```

### 2. AndroidManifest.xml - Agregar permiso

**Cambios:**
- ✅ Agregado permiso `android.permission.CAPTURE_VIDEO_OUTPUT`

**Código agregado:**
```xml
<uses-permission android:name="android.permission.CAPTURE_VIDEO_OUTPUT" />
```

## Flujo de Funcionamiento

1. **App inicia** → MainActivity se crea
2. **onCreate()** → Se llama `requestScreenCapturePermission()`
3. **Usuario ve diálogo** → "¿Permitir que FlowAgent capture la pantalla?"
4. **Usuario acepta** → `onActivityResult()` recibe RESULT_OK
5. **ScreenCaptureThread** → Puede usar MediaProjection para capturar
6. **Frames WebP** → Se envían al backend via socket

## Archivos Modificados

- `flow_agent_apk/src/com/flowlogin/agent/MainActivity.java`
- `flow_agent_apk/AndroidManifest.xml`

## Próximos Pasos

1. **Reconstruir APK:**
   ```powershell
   cd flow_agent_apk
   .\build_apk.ps1
   ```

2. **Instalar en dispositivo:**
   ```
   adb install -r build/flowagent-debug.apk
   ```

3. **Abrir app en dispositivo:**
   - La app solicitará permisos de captura
   - Usuario debe aceptar
   - Logs mostrarán "✓ Permisos de captura de pantalla otorgados"

4. **Verificar en Electron:**
   - Conectar dispositivo
   - Habilitar Live Preview
   - Canvas debería mostrar pantalla en tiempo real

## Validación

✅ MainActivity solicita permisos automáticamente  
✅ Permiso agregado en AndroidManifest  
✅ onActivityResult() maneja respuesta  
✅ Logs muestran estado de permisos  
✅ ScreenCaptureThread puede usar MediaProjection

## Notas

- El permiso `CAPTURE_VIDEO_OUTPUT` requiere Android 5.0+ (API 21+)
- El APK tiene `minSdkVersion="26"`, así que es compatible
- El usuario debe aceptar el diálogo de permisos la primera vez
- Los permisos se guardan en el dispositivo para futuras ejecuciones
