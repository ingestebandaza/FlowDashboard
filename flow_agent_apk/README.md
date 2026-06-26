# FlowAgent APK

Agente Android experimental para conectar un telefono con `local_adb_server.py` por socket TCP.

Version actual: `0.3.7`.

La APK incluye icono propio, interfaz visual con tarjetas, chips de estado para Accesibilidad/Socket y configuracion automatica desde el dashboard.

En Android 9 el serial visible de licencia/dispositivo debe ser el serial ADB WiFi (`IP:5555`) que inyecta el dashboard o que FlowAgent deriva desde la IP WiFi. No se usa `Build.SERIAL` como identidad porque puede venir vacio o `unknown` en apps normales.

## Uso

1. Ejecuta `local_adb_server.py`. El servidor HTTP queda en `127.0.0.1:8765` y el socket de agentes en `0.0.0.0:8766`.
2. Desde el dashboard puedes pulsar `Preparar FlowAgent`; eso instala/actualiza la APK, crea `adb reverse tcp:8766 tcp:8766` y abre la app con host `127.0.0.1`.
3. Activa el servicio FlowAgent en Ajustes de accesibilidad cuando Android lo pida.

Para compilar manualmente la APK:

   ```powershell
   .\build_apk.ps1
   ```

Para USB puedes usar ADB reverse y dejar host `127.0.0.1` en la APK:

```powershell
adb reverse tcp:8766 tcp:8766
```

Para WiFi usa la IP LAN del PC como host.

## Comandos soportados por el agente

El servidor puede enviar JSON a `POST /agent/command`:

```json
{
  "agentId": "ANDROID_ID",
  "command": { "name": "ping" }
}
```

Comandos disponibles:

- `ping`
- `status`
- `dump`
- `launchPackage`
- `openAppInfo`
- `getEditTexts`
- `clickText`
- `setText`
- `setTextIndex`
- `tap`
- `swipe`
- `home`
- `back`
- `recents`

Usalo solo en tus dispositivos y sesiones autorizadas. No esta pensado para saltar captchas, 2FA o verificaciones de servicios.
