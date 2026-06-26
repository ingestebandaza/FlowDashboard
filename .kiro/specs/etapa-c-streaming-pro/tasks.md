# Implementation Plan: Etapa C - Streaming Pro (RAW H.264 via scrcpy v4.0)

## Overview

Reemplazar la captura WebP (FlowAgent + MediaProjection) por streaming H.264
nativo del scrcpy-server.jar v4.0 en modo `raw_stream=true`. Esto bypasea
FLAG_SECURE (Spotify visible), reduce latencia a 50-80 ms en LAN, y permite
17+ thumbnails simultaneos sin saturar CPU.

Fecha: 2026-05-28
Restore points:
- `restore_points/PuntoAntesEtapaC_StreamingPro/` (antes de Etapa C global)
- `restore_points/PuntoAntesScrcpyRaw/` (antes del pivot a raw H.264)

## Decision arquitectural

Tras evaluar 4 opciones (`scrcpy.exe --record=-` mp4, scrcpy ventana nativa con
SetParent, WebP via FlowAgent, y protocolo nativo del jar), se eligio el
**protocolo nativo del scrcpy-server.jar v4.0**.

Razones:
1. `--record=-` con mp4 NO sirve para live: libavformat buffera el `moov` hasta
   cerrar el archivo. Probado y descartado.
2. El protocolo nativo es lo que usa Laixi: latencia 50-80 ms.
3. Sin `scrcpy.exe`, sin SDL3, sin libavcodec en PC. Solo socket TCP + WebSocket.
4. WebCodecs come Annex-B nativamente; sin parser MP4 = ~150 lineas menos de
   cliente y CPU mucho menor.

## Task Dependency Graph

```json
{
  "waves": [
    { "name": "C0", "tasks": ["1"] },
    { "name": "C1", "tasks": ["2"] },
    { "name": "C2", "tasks": ["3"] },
    { "name": "C3", "tasks": ["4"] },
    { "name": "C4", "tasks": ["5", "6"] },
    { "name": "C5", "tasks": ["7"] },
    { "name": "C6", "tasks": ["8"] }
  ]
}
```

## Tasks

- [x] 1. Pre-flight (restore points + lectura doc oficial scrcpy 4.0).
- [x] 2. Modulo Python `scrcpy_raw_streamer.py` (handshake + multiplex).
- [x] 3. Modulo Python `scrcpy_raw_ws_server.py` (WebSocket asyncio puerto 8768).
- [x] 4. Integracion en `local_adb_server.py` (imports + startup + 2 endpoints REST).
- [x] 5. Refactor `stream-renderer-h264.js` (parser Annex-B + WebCodecs).
- [x] 6. Cambios menores en `app.js` (wsUrl) y `flow-touch.js` (no-Promise).
- [x] 7. Tests E2E: diag manual, modulo Python, server completo.
- [ ] 8. Smoke desde Electron con Spotify abierto + UI presets en Settings.

## Notes

### Detalles tecnicos clave

- **SCID en HEX**: `Options.parse` hace `Integer.parseInt(value, 16)`. Max 31 bits = `7fffffff`. El nombre del socket abstract es `scrcpy_<%08x>` del mismo numero.
- **Comando shell unico**: `adb shell <multi-arg>` debe pasarse como UN STRING al ProcessStartInfo, no como args separados.
- **Delay 600ms**: tras lanzar el server, esperar antes de conectar el TCP para que `LocalServerSocket.accept()` este listo.
- **Flags raw**: `tunnel_forward=true raw_stream=true audio=false control=false cleanup=true`.
- **cleanup=true**: el server mata sus threads cuando el cliente cierra el socket.

### Presets

| Preset | max_size | max_fps | bit_rate |
|---|---|---|---|
| thumbnail | 240 | 8 | 300 kbps |
| eco | 480 | 24 | 1 Mbps |
| balanced | 720 | 30 | 2.5 Mbps |
| pro | 1080 | 30 | 5 Mbps |

### Endpoints nuevos

- `WS  ws://127.0.0.1:8768/<serial>?preset=name`
- `GET http://127.0.0.1:8765/streaming/raw/sessions`
- `POST http://127.0.0.1:8765/streaming/raw/stop` con `{serial, preset}`

### Tests pasados (2026-05-28 PM)

- Diag manual contra `.11`: 15.231 bytes/4s, header `00 00 00 01 67 42 80 0d` (SPS baseline 3.1).
- Test modulo Python: 17.323 bytes/5s, 51 chunks, primer byte Annex-B IDR.
- Test E2E full: 41 chunks/5s, header SPS+PPS+SEI valido.

### Riesgos

| Riesgo | Mitigacion |
|---|---|
| Algun device antiguo no soporta H.264 baseline | MediaCodec negocia; fallback a software dentro del server |
| Cliente lento drop de bytes | queue.maxsize=64, descartamos. Mejor frame perdido que latencia |
| Sin HW accel en GPU integrada | `prefer-hardware` no es hard-required; SW decode arranca solo |
| 17 sockets saturan ADB | Cada sesion tiene su propio `forward` port; ADB soporta >100 |
| Device se duerme | Auto-reconnect con backoff 0.5/1/2/4/8s |

### Rollback

```powershell
$rp = 'c:\DASHBOARD\FlowDashboard\restore_points\PuntoAntesScrcpyRaw\runtime-files'
Copy-Item "$rp\local_adb_server.py" 'c:\DASHBOARD\FlowDashboard\local_adb_server.py' -Force
Copy-Item "$rp\electron-renderer\*" 'c:\DASHBOARD\FlowDashboard\electron-app\src\renderer\' -Force
Remove-Item 'c:\DASHBOARD\FlowDashboard\scrcpy_raw_streamer.py' -ErrorAction SilentlyContinue
Remove-Item 'c:\DASHBOARD\FlowDashboard\scrcpy_raw_ws_server.py' -ErrorAction SilentlyContinue
```
