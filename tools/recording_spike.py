import os
import subprocess
import time
import signal
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
        # Check first 100kb and last 100kb for atoms
        data = f.read()
        ftyp = b"ftyp" in data[:1000]
        moov = b"moov" in data
        mdat = b"mdat" in data
    
    # Simple check: ftyp and moov must be present for a valid MP4 usually
    is_valid = ftyp and moov and mdat
    return is_valid, size, ftyp, moov, mdat

def run_variant(name, args, use_no_window_flag, use_sw_hide, stop_method, timeout=10):
    print(f"\n--- Probando Variante {name} ---")
    out_file = Path(f"spike_{name}.mp4")
    log_file = Path(f"spike_{name}.log")
    
    if out_file.exists(): out_file.unlink()
    if log_file.exists(): log_file.unlink()

    cmd = [str(SCRCPY_EXE), "--serial", SERIAL, "--no-audio", "--no-playback", "--no-control", "--record", str(out_file)]
    if use_no_window_flag:
        cmd.append("--no-window")
    
    cmd.extend(args)
    
    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    if stop_method == "CTRL_BREAK":
        creationflags |= getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        
    startupinfo = None
    if use_sw_hide:
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = subprocess.SW_HIDE

    print(f"Comando: {' '.join(cmd)}")
    with open(log_file, "w") as f:
        proc = subprocess.Popen(
            cmd,
            stdout=f,
            stderr=f,
            creationflags=creationflags,
            startupinfo=startupinfo
        )
        
        start_time = time.time()
        if stop_method == "CTRL_BREAK":
            time.sleep(timeout)
            print(f"Enviando CTRL_BREAK a pid {proc.pid}")
            try:
                proc.send_signal(getattr(signal, "CTRL_BREAK_EVENT"))
            except Exception as e:
                print("Error sending signal:", e)
                proc.terminate()
            
            try:
                proc.wait(timeout=5)
                print("Proceso termino correctamente con CTRL_BREAK")
            except subprocess.TimeoutExpired:
                print("Timeout tras CTRL_BREAK, haciendo kill()")
                proc.kill()
                proc.wait()
        elif stop_method == "TIMEOUT":
            print(f"Esperando a que termine solo (time-limit)...")
            proc.wait(timeout=timeout + 5)
            print("Proceso termino solo.")
        elif stop_method == "TERMINATE":
            time.sleep(timeout)
            print(f"Enviando terminate() a pid {proc.pid}")
            proc.terminate()
            proc.wait()
            
    time.sleep(1) # Dar tiempo al FS
    
    valid, size, ftyp, moov, mdat = check_mp4(out_file)
    with open(log_file, "r") as f:
        log_content = f.read()
    
    log_summary = "OK" if "Recording complete" in log_content or "File saved" in log_content else "Cortado/Error"
    if "ERROR:" in log_content:
        log_summary = "ERROR"
        
    print(f"Resultado {name}: Valido={valid}, Tamaño={size} bytes, Atoms=(ftyp:{ftyp}, moov:{moov}, mdat:{mdat}), Log={log_summary}")
    return {
        "name": name,
        "valid": valid,
        "size": size,
        "moov": moov,
        "log": log_summary
    }

def main():
    results = []
    
    # Variante A: Actual
    res_a = run_variant("A_ACTUAL", [], use_no_window_flag=True, use_sw_hide=False, stop_method="CTRL_BREAK", timeout=6)
    results.append(res_a)
    
    # Variante B: Time limit
    res_b = run_variant("B_TIME_LIMIT", ["--time-limit=6"], use_no_window_flag=True, use_sw_hide=False, stop_method="TIMEOUT", timeout=6)
    results.append(res_b)
    
    # Variante C: Sin --no-window, con SW_HIDE, stop CTRL_BREAK
    res_c = run_variant("C_SW_HIDE", [], use_no_window_flag=False, use_sw_hide=True, stop_method="CTRL_BREAK", timeout=6)
    results.append(res_c)
    
    # Variante D: Visible normal, stop CTRL_BREAK
    res_d = run_variant("D_VISIBLE", [], use_no_window_flag=False, use_sw_hide=False, stop_method="CTRL_BREAK", timeout=6)
    results.append(res_d)
    
    print("\n--- RESUMEN FINAL ---")
    print("| Variante | Valido | Tamano | MOOV | Log |")
    print("|----------|--------|--------|------|-----|")
    for r in results:
        print(f"| {r['name']} | {r['valid']} | {r['size']} | {r['moov']} | {r['log']} |")

if __name__ == "__main__":
    main()
