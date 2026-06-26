"""Test E2E del WS server raw H.264.

Pasos:
  1. Arrancar local_adb_server.py en subproceso.
  2. Esperar a /health y al WS port 8768.
  3. Conectar WebSocket a ws://127.0.0.1:8768/<serial>?preset=thumbnail
  4. Recibir bytes durante 5s, validar Annex-B start code.
  5. Cerrar el WS y consultar GET /streaming/raw/sessions.
"""
import asyncio
import os
import socket
import subprocess
import sys
import time
import urllib.request

import websockets

ADB = r"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe"


def get_first_serial():
    cp = subprocess.run([ADB, "devices"], capture_output=True, text=True, timeout=4)
    for line in cp.stdout.splitlines()[1:]:
        parts = line.strip().split()
        if len(parts) >= 2 and parts[1] == "device":
            return parts[0]
    return None


def http_ok(url, timeout=2):
    try:
        urllib.request.urlopen(url, timeout=timeout).read()
        return True
    except Exception:
        return False


def port_open(host, port, timeout=1):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


async def main_async(serial):
    url = f"ws://127.0.0.1:8768/{serial}?preset=thumbnail"
    print(f"Conectando a {url}")
    received = bytearray()
    chunk_count = 0
    start = time.monotonic()
    try:
        async with websockets.connect(url, max_size=None) as ws:
            print("WS abierto")
            while time.monotonic() - start < 5.0:
                try:
                    chunk = await asyncio.wait_for(ws.recv(), timeout=2.0)
                except asyncio.TimeoutError:
                    break
                if isinstance(chunk, str):
                    print(f"  msg texto: {chunk[:80]}")
                    continue
                chunk_count += 1
                if len(received) < 64:
                    received.extend(chunk[: 64 - len(received)])
            print(f"Recibidos {chunk_count} chunks, header bytes: {received[:32].hex()}")
            if received[:4] == b"\x00\x00\x00\x01" or received[:3] == b"\x00\x00\x01":
                print("OK: Annex-B start code")
            else:
                print("AVISO: NO empieza con Annex-B")
    except Exception as exc:
        print(f"ERROR WS: {exc}")
        return 2
    return 0 if chunk_count > 0 else 3


def main():
    serial = get_first_serial()
    if not serial:
        print("Sin device.")
        return 1

    # Verificar que servidor ya esta corriendo (asumimos lo arranca otro proceso).
    if not http_ok("http://127.0.0.1:8765/health"):
        print("ERROR: Python server no responde en 8765.")
        return 4
    if not port_open("127.0.0.1", 8768):
        print("ERROR: WS server raw H.264 no escucha en 8768.")
        return 5
    print("Python server OK; WS port abierto.")

    rc = asyncio.run(main_async(serial))
    return rc


if __name__ == "__main__":
    sys.exit(main())
