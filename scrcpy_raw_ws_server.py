#!/usr/bin/env python3
"""scrcpy_raw_ws_server.py - WebSocket server para H.264 RAW de scrcpy v4.0.

Levanta un servidor WebSocket en 127.0.0.1:8768 que multiplexa streams H.264
crudos desde el `ScrcpyRawStreamer`. Cada cliente abre:

    ws://127.0.0.1:8768/<serial>?preset=thumbnail

Y recibe trozos binarios H.264 Annex-B listos para WebCodecs `VideoDecoder`.

Diseno:
  - Una sesion `ScrcpyRawStreamer` por (serial, preset). Si N clientes piden el
    mismo (serial, preset), se multiplexan los bytes (1 device -> N WS).
  - Si todos los clientes de una sesion se desconectan, la sesion se cierra
    automaticamente para no dejar `app_process` corriendo en el device.
  - Sin auth: solo escuchamos en 127.0.0.1.
"""

from __future__ import annotations

import asyncio
import logging
import threading
from typing import Optional
from urllib.parse import urlparse, parse_qs

try:
    import websockets
    WEBSOCKETS_AVAILABLE = True
except ImportError:
    WEBSOCKETS_AVAILABLE = False

from scrcpy_raw_streamer import ScrcpyRawStreamer, get_preset


WS_HOST = "127.0.0.1"
WS_PORT = 8768

logger = logging.getLogger("scrcpy_raw_ws")


def _parse_path(raw_path: str):
    """Parsea `/<serial>?preset=balanced` -> (serial, preset)."""
    from urllib.parse import urlparse, parse_qs, unquote
    parsed = urlparse(raw_path or "")
    # unquote por si el cliente envio el serial URL-encoded (ej: %3A en lugar de :)
    serial = unquote((parsed.path or "/").lstrip("/"))
    qs = parse_qs(parsed.query or "")
    preset = (qs.get("preset", ["balanced"])[0] or "balanced").lower()
    return serial, preset


async def _serve_client(websocket, streamer: ScrcpyRawStreamer):
    """Maneja un cliente WS. Path = /<serial>?preset=name."""
    # Compatibilidad websockets 16.x (path esta en websocket.request.path).
    # En versiones viejas estaba en websocket.path o se pasaba como segundo arg.
    raw_path = ""
    req = getattr(websocket, "request", None)
    if req is not None and getattr(req, "path", None):
        raw_path = req.path
    if not raw_path:
        raw_path = getattr(websocket, "path", "") or getattr(websocket, "request_path", "") or ""
    serial, preset_name = _parse_path(raw_path)
    logger.info("[H264-BACKEND] WS accepted serial=%s preset=%s key=%s|%s req_path=%s", serial, preset_name, serial, preset_name, raw_path)

    if not serial:
        await websocket.close(code=1008, reason="missing serial")
        return
    preset = get_preset(preset_name)

    loop = asyncio.get_running_loop()
    # H.264 es un byte stream: descartar chunks sueltos corrompe P-frames y
    # produce smearing. La latencia se controla en el decoder/preset, no
    # perdiendo bytes arbitrarios en la cola WS.
    queue: asyncio.Queue = asyncio.Queue(maxsize=0)
    
    ws_bytes_sent = [0]
    ws_chunks_sent = [0]

    def on_chunk(chunk: bytes):
        # Llamado desde el reader thread del streamer. Encolar de forma thread-safe.
        try:
            loop.call_soon_threadsafe(queue.put_nowait, chunk)
        except RuntimeError:
            pass

    session = None
    try:
        session = await loop.run_in_executor(
            None, streamer.attach_subscriber, serial, preset.name, on_chunk
        )
        logger.info(
            "WS abierto serial=%s preset=%s port=%d",
            serial, preset.name, session.local_port,
        )

        # Pump: chunks -> websocket binary frames.
        while True:
            try:
                chunk = await asyncio.wait_for(queue.get(), timeout=2.0)
            except asyncio.TimeoutError:
                if (
                    getattr(websocket, "closed", False)
                    or getattr(websocket, "close_code", None) is not None
                ):
                    break
                if session is not None and streamer.is_startup_stalled(session):
                    logger.warning(
                        "[H264-BACKEND] WS closing stalled startup serial=%s preset=%s bytes=%d chunks=%d",
                        serial, preset.name, session.bytes_streamed, session.chunks_read
                    )
                    break
                continue
            try:
                await websocket.send(chunk)
                ws_bytes_sent[0] += len(chunk)
                ws_chunks_sent[0] += 1
                if ws_chunks_sent[0] <= 5 or ws_chunks_sent[0] % 120 == 0:
                    logger.debug(
                        "[H264-BACKEND] ws chunks_sent=%d ws bytes_sent=%d bytes_in_chunk=%d",
                        ws_chunks_sent[0], ws_bytes_sent[0], len(chunk)
                    )
            except websockets.exceptions.ConnectionClosed:
                break
    except Exception as exc:
        logger.warning("WS error serial=%s preset=%s: %s", serial, preset.name, exc)
        try:
            await websocket.close(code=1011, reason=str(exc)[:120])
        except Exception:
            pass
    finally:
        if session is not None:
            await loop.run_in_executor(None, streamer.detach_subscriber, session, on_chunk)
        logger.info("WS cerrado serial=%s preset=%s", serial, preset.name)


def _build_handler(streamer: ScrcpyRawStreamer):
    # Compatibilidad: en websockets >=11 el handler recibe SOLO websocket; en
    # versiones viejas recibe (websocket, path). Implementamos ambos.
    async def handler(websocket, path=None):  # noqa: ARG001
        await _serve_client(websocket, streamer)
    return handler


def start_raw_ws_server_in_background(streamer: ScrcpyRawStreamer):
    """Lanza el server WS en un thread daemon. Devuelve el thread."""
    if not WEBSOCKETS_AVAILABLE:
        logger.error("paquete `websockets` no instalado; no se levanta el server raw ws")
        return None

    def _run():
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            async def _main():
                handler = _build_handler(streamer)
                # max_size=None -> sin limite por mensaje (envianos chunks de hasta 64KB).
                async with websockets.serve(
                    handler, WS_HOST, WS_PORT,
                    max_size=None,
                    ping_interval=20,
                    ping_timeout=20,
                ):
                    print(f"[scrcpy-raw-ws] listo en ws://{WS_HOST}:{WS_PORT}/<serial>?preset=balanced")
                    await asyncio.Future()  # corre para siempre

            loop.run_until_complete(_main())
        except Exception as exc:
            print(f"[scrcpy-raw-ws] fallo: {exc}")

    t = threading.Thread(target=_run, name="scrcpy-raw-ws", daemon=True)
    t.start()
    return t
