import os
import subprocess
import time
from pathlib import Path

SCRCPY_EXE = Path("scrcpy-win64-v4.0/scrcpy.exe")
SERIAL = "192.168.1.48:5555"

def check_mp4(filepath):
    if not filepath.exists():
        return False, 0, False, False, False
    size = filepath.stat().st_size
    if size < 100:
        return False, size, False, False, False
    
    with open(filepath, "rb") as f:
        data = f.read()
        ftyp = b"ftyp" in data[:1000]
        moov = b"moov" in data
        mdat = b"mdat" in data
    
    is_valid = ftyp and moov and mdat
    return is_valid, size, ftyp, moov, mdat

def main():
    name = "G_TASKKILL"
    out_file = Path(f"spike_{name}.mp4")
    log_file = Path(f"spike_{name}.log")
    
    if out_file.exists(): out_file.unlink()
    if log_file.exists(): log_file.unlink()

    # Quitamos --no-window, pero usamos SW_HIDE
    cmd = [str(SCRCPY_EXE), "--serial", SERIAL, "--no-audio", "--no-playback", "--no-control", "--record", str(out_file)]
    
    startupinfo = subprocess.STARTUPINFO()
    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    startupinfo.wShowWindow = subprocess.SW_HIDE

    # NO usamos CREATE_NEW_PROCESS_GROUP porque taskkill se encarga
    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)

    print(f"Comando: {' '.join(cmd)}")
    with open(log_file, "w") as f:
        proc = subprocess.Popen(
            cmd,
            stdout=f,
            stderr=f,
            creationflags=creationflags,
            startupinfo=startupinfo
        )
        
        time.sleep(6)
        print(f"Enviando taskkill a pid {proc.pid}")
        subprocess.run(["taskkill", "/PID", str(proc.pid)])
        
        try:
            proc.wait(timeout=5)
            print("Cerro con taskkill suave!")
        except subprocess.TimeoutExpired:
            print("Timeout tras taskkill suave. Forzando...")
            subprocess.run(["taskkill", "/F", "/PID", str(proc.pid)])
            proc.wait()
            
    time.sleep(1)
    
    valid, size, ftyp, moov, mdat = check_mp4(out_file)
    with open(log_file, "r") as f:
        log_content = f.read()
        
    log_summary = "OK" if "Recording complete" in log_content or "File saved" in log_content else "Cortado/Error"
    if "ERROR:" in log_content:
        log_summary = "ERROR"
        
    print(f"Resultado {name}: Valido={valid}, Tamaño={size} bytes, Atoms=(ftyp:{ftyp}, moov:{moov}, mdat:{mdat}), Log={log_summary}")

if __name__ == "__main__":
    main()
