"""Test rapido del scrcpy_raw_streamer contra el primer device conectado."""
import os
import sys
import time

sys.path.insert(0, r"C:\DASHBOARD\FlowDashboard")

from scrcpy_raw_streamer import ScrcpyRawStreamer

ADB = r"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe"


def get_first_serial():
    import subprocess
    cp = subprocess.run([ADB, "devices"], capture_output=True, text=True, timeout=4)
    for line in cp.stdout.splitlines()[1:]:
        parts = line.strip().split()
        if len(parts) >= 2 and parts[1] == "device":
            return parts[0]
    return None


def main():
    serial = get_first_serial()
    if not serial:
        print("Sin devices conectados.")
        return 1
    print(f"Probando con {serial}")

    streamer = ScrcpyRawStreamer(adb_path=ADB)

    received = {"bytes": 0, "chunks": 0, "first_byte_at": None}

    def on_data(chunk: bytes):
        if received["first_byte_at"] is None:
            received["first_byte_at"] = time.time()
        received["bytes"] += len(chunk)
        received["chunks"] += 1

    print("Arrancando sesion 'thumbnail' (240p@8fps@300kbps)...")
    t0 = time.time()
    try:
        session = streamer.attach_subscriber(serial, "thumbnail", on_data)
    except Exception as exc:
        print(f"Error: {exc}")
        return 2

    handshake_time = time.time() - t0
    print(f"Sesion abierta en {handshake_time:.2f}s")
    print(f"  local_port={session.local_port}")

    # Recibir durante 5s.
    time.sleep(5)

    print(f"Recibidos {received['bytes']} bytes en {received['chunks']} chunks")
    if received["first_byte_at"]:
        latency_first_byte = received["first_byte_at"] - t0
        print(f"  primer byte a los {latency_first_byte:.2f}s desde el start")

    # Inspeccionar primeros bytes para validar Annex-B.
    # Para eso necesitamos guardar los primeros chunks; modifico la callback al vuelo:
    print("\nInspeccionando primeros bytes para validar Annex-B...")
    head = bytearray()
    def on_head(chunk: bytes):
        if len(head) < 64:
            head.extend(chunk[: 64 - len(head)])
    session2 = streamer.attach_subscriber(serial, "thumbnail", on_head)
    time.sleep(2.0)
    print(f"  Primeros {len(head)} bytes: {head[:32].hex()}")
    if head[:4] == b"\x00\x00\x00\x01" or head[:3] == b"\x00\x00\x01":
        print("  OK: empieza con Annex-B start code (NALU H.264 raw)")
    else:
        print("  AVISO: NO empieza con start code Annex-B. Primeros bytes inesperados.")

    # Limpieza.
    print("\nDesconectando subscribers...")
    streamer.detach_subscriber(session, on_data)
    streamer.detach_subscriber(session2, on_head)
    streamer.stop_all()
    print("Test terminado OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
