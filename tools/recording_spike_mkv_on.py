import os
import subprocess
import time
import signal
from pathlib import Path

SCRCPY_EXE = Path("scrcpy-win64-v4.0/scrcpy.exe")
SERIAL = "192.168.1.48:5555"

def check_mkv(filepath):
    if not filepath.exists():
        return False, 0
    size = filepath.stat().st_size
    if size < 100:
        return False, size
    # Simple check for MKV header
    with open(filepath, "rb") as f:
        data = f.read(100)
        is_mkv = b"\x1A\x45\xDF\xA3" in data # EBML header for MKV
    return is_mkv, size

def run_variant(name, use_mkv=False):
    print(f"\n--- Probando Variante {name} ---")
    ext = ".mkv" if use_mkv else ".mp4"
    out_file = Path(f"spike_{name}{ext}")
    log_file = Path(f"spike_{name}.log")
    
    if out_file.exists(): out_file.unlink()
    if log_file.exists(): log_file.unlink()

    # Añadido --turn-screen-on para forzar frames
    cmd = [str(SCRCPY_EXE), "--serial", SERIAL, "--turn-screen-on", "--no-audio", "--no-playback", "--no-control", "--record", str(out_file), "--no-window"]
    
    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)

    print(f"Comando: {' '.join(cmd)}")
    with open(log_file, "w") as f:
        proc = subprocess.Popen(
            cmd,
            stdout=f,
            stderr=f,
            creationflags=creationflags
        )
        
        time.sleep(6)
        print(f"Enviando CTRL_BREAK a pid {proc.pid}")
        try:
            proc.send_signal(getattr(signal, "CTRL_BREAK_EVENT"))
        except Exception:
            pass
        
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
            
    time.sleep(1)
    
    valid, size = check_mkv(out_file) if use_mkv else (False, out_file.stat().st_size if out_file.exists() else 0)
    
    with open(log_file, "r") as f:
        log_content = f.read()
    
    print(f"Resultado {name}: Valido={valid}, Tamaño={size} bytes")
    return {"name": name, "valid": valid, "size": size}

def main():
    run_variant("F_MKV_SCREEN_ON", use_mkv=True)

if __name__ == "__main__":
    main()
