"""Test: abrir 17 sesiones thumbnail simultaneas y medir cuantas reciben bytes."""
import sys
import threading
import time

sys.path.insert(0, r"C:\DASHBOARD\FlowDashboard")
from scrcpy_raw_streamer import ScrcpyRawStreamer

ADB = r"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe"


def get_serials():
    import subprocess
    cp = subprocess.run([ADB, "devices"], capture_output=True, text=True, timeout=4)
    out = []
    for line in cp.stdout.splitlines()[1:]:
        parts = line.strip().split()
        if len(parts) >= 2 and parts[1] == "device":
            out.append(parts[0])
    return out


def main():
    serials = get_serials()
    print(f"Devices conectados: {len(serials)}")
    if not serials:
        return 1

    streamer = ScrcpyRawStreamer(adb_path=ADB)
    counters = {s: {"bytes": 0, "chunks": 0} for s in serials}

    def make_cb(s):
        def cb(chunk):
            c = counters[s]
            c["bytes"] += len(chunk)
            c["chunks"] += 1
        return cb

    # Lanzar todos en paralelo via threads para acelerar el spawn.
    sessions = {}
    errors = {}

    def attach(s):
        try:
            sessions[s] = streamer.attach_subscriber(s, "thumbnail", make_cb(s))
        except Exception as exc:
            errors[s] = str(exc)

    print("Abriendo 17 sesiones en paralelo...")
    t0 = time.time()
    threads = [threading.Thread(target=attach, args=(s,), daemon=True) for s in serials]
    for t in threads: t.start()
    for t in threads: t.join(timeout=20)
    print(f"Spawn paralelo terminado en {time.time()-t0:.1f}s")

    # Recibir bytes durante 6s.
    time.sleep(6)

    print("\n--- RESULTADOS ---")
    ok = 0
    no_bytes = 0
    fallaron = 0
    for s in serials:
        c = counters[s]
        if s in errors:
            print(f"  {s}: FALLO -> {errors[s]}")
            fallaron += 1
        elif c["bytes"] == 0:
            print(f"  {s}: SIN BYTES (sesion abierta pero 0 bytes)")
            no_bytes += 1
        else:
            print(f"  {s}: {c['bytes']:>9} bytes en {c['chunks']:>3} chunks")
            ok += 1
    print(f"\nResumen: OK={ok}  Sin bytes={no_bytes}  Fallaron={fallaron}  Total={len(serials)}")

    streamer.stop_all()
    return 0


if __name__ == "__main__":
    sys.exit(main())
