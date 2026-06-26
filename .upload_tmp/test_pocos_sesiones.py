"""Test: abrir 5 sesiones thumbnail simultaneas via WS server (no via modulo directo)."""
import asyncio
import subprocess
import sys
import time

import websockets

ADB = r"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe"


def get_serials(n=5):
    cp = subprocess.run([ADB, "devices"], capture_output=True, text=True, timeout=4)
    out = []
    for line in cp.stdout.splitlines()[1:]:
        parts = line.strip().split()
        if len(parts) >= 2 and parts[1] == "device":
            out.append(parts[0])
    return out[:n]


async def measure(serial: str, results: dict):
    url = f"ws://127.0.0.1:8768/{serial}?preset=thumbnail"
    bytes_total = 0
    chunks = 0
    first_at = None
    t0 = time.monotonic()
    try:
        async with websockets.connect(url, max_size=None) as ws:
            t_connect = time.monotonic() - t0
            results[serial] = {"connect_s": t_connect, "bytes": 0, "chunks": 0, "first_at_s": None, "err": None}
            deadline = time.monotonic() + 6.0
            while time.monotonic() < deadline:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                except asyncio.TimeoutError:
                    break
                if isinstance(msg, str):
                    continue
                if first_at is None:
                    first_at = time.monotonic() - t0
                bytes_total += len(msg)
                chunks += 1
            results[serial].update(bytes=bytes_total, chunks=chunks, first_at_s=first_at)
    except Exception as exc:
        results[serial] = {"connect_s": None, "bytes": 0, "chunks": 0, "first_at_s": None, "err": str(exc)[:200]}


async def main_async(serials):
    results = {}
    print(f"Lanzando {len(serials)} clientes WS en paralelo...")
    t0 = time.monotonic()
    await asyncio.gather(*[measure(s, results) for s in serials])
    print(f"Total tardo {time.monotonic()-t0:.1f}s\n")
    ok = 0
    sin_bytes = 0
    err = 0
    for s in serials:
        r = results.get(s, {})
        if r.get("err"):
            print(f"  {s}: ERR {r['err']}")
            err += 1
        elif r.get("bytes", 0) == 0:
            print(f"  {s}: SIN BYTES (handshake en {r.get('connect_s'):.2f}s pero 0 bytes)")
            sin_bytes += 1
        else:
            print(f"  {s}: connect {r['connect_s']:.2f}s, primer byte {r['first_at_s']:.2f}s, "
                  f"{r['bytes']:>8} bytes en {r['chunks']:>3} chunks")
            ok += 1
    print(f"\nResumen: OK={ok}  Sin bytes={sin_bytes}  Errores={err}  Total={len(serials)}")
    return 0 if ok == len(serials) else 1


def main():
    serials = get_serials(5)
    if len(serials) < 1:
        print("Sin devices conectados.")
        return 1
    print(f"Probando con {len(serials)} devices: {serials}")
    return asyncio.run(main_async(serials))


if __name__ == "__main__":
    sys.exit(main())
