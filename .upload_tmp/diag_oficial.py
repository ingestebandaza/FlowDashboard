"""Replica exacta del ejemplo oficial de la doc de scrcpy 4.0.
Sin SCID, sin comillas problemáticas, usando subprocess.Popen directamente."""
import socket
import subprocess
import sys
import time

ADB = r"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe"
SERIAL = "192.168.1.11:5555"
PORT = 28050
JAR = "/data/local/tmp/scrcpy-server-manual.jar"

def run(args, timeout=8):
    r = subprocess.run([ADB] + args, capture_output=True, text=True, timeout=timeout)
    return r.stdout.strip(), r.stderr.strip()

print("=== 1) Conectar ===")
out, err = run(["connect", SERIAL])
print(out or err)

print("=== 2) Push jar ===")
out, err = run(["-s", SERIAL, "push",
    r"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\scrcpy-server",
    JAR], timeout=20)
print(out or err)

print("=== 3) Limpiar forwards ===")
run(["-s", SERIAL, "forward", "--remove-all"])

print("=== 4) Forward sin SCID (como doc oficial) ===")
# La doc usa: adb forward tcp:1234 localabstract:scrcpy
out, err = run(["-s", SERIAL, "forward", f"tcp:{PORT}", "localabstract:scrcpy"])
print(f"forward -> {out or err}")

print("=== 5) Lanzar server (sin scid, como doc oficial) ===")
# Exactamente como la doc: sin scid, cleanup=false
shell_cmd = (
    f"CLASSPATH={JAR} app_process / com.genymobile.scrcpy.Server 4.0 "
    "tunnel_forward=true audio=false control=false cleanup=false "
    "raw_stream=true max_size=240 max_fps=8 video_bit_rate=300000"
)
proc = subprocess.Popen(
    [ADB, "-s", SERIAL, "shell", shell_cmd],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.PIPE,
)
print(f"  PID: {proc.pid}")

print("=== 6) Esperar 1.5s ===")
time.sleep(1.5)

print("=== 7) Conectar TCP y leer ===")
total = 0
head = b""
try:
    s = socket.create_connection(("127.0.0.1", PORT), timeout=3)
    s.settimeout(4)
    print("  Socket conectado")
    try:
        while True:
            chunk = s.recv(8192)
            if not chunk:
                print("  Conexion cerrada")
                break
            total += len(chunk)
            if len(head) < 32:
                head += chunk[:32-len(head)]
    except socket.timeout:
        pass
    s.close()
except Exception as e:
    print(f"  ERROR: {e}")

print(f"  Total bytes: {total}")
if head:
    print(f"  Primeros bytes: {head.hex()}")
    if head[:4] == b'\x00\x00\x00\x01' or head[:3] == b'\x00\x00\x01':
        print("  OK: Annex-B start code")
    else:
        print("  AVISO: no empieza con Annex-B")

print("=== 8) Stderr del server ===")
try:
    proc.kill()
    stderr = proc.stderr.read()
    if stderr:
        print(stderr.decode("utf-8", errors="ignore")[:500])
    else:
        print("  (vacio)")
except Exception as e:
    print(f"  {e}")

print("=== 9) Limpiar ===")
run(["-s", SERIAL, "forward", "--remove-all"])
print("Listo.")
