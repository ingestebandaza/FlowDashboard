# updater.py
import os
import sys
import json
import shutil
import tempfile
import urllib.request
import subprocess

# ------------------- CONFIGURACIÓN -------------------
GITHUB_OWNER = "ingestebandaza"          # <-- cambia por tu nombre de usuario en GitHub
GITHUB_REPO  = "FlowDashboard"              # <-- cambia por el nombre del repo
CURRENT_VERSION = "1.0.0"                    # <-- debe coincidir con APP_VERSION en launcher.py
EXECUTABLE_NAME = "FlowDashboard.exe"        # nombre que tendrá el .exe final
# -----------------------------------------------------

API_URL = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/releases/latest"

def get_latest_release():
    with urllib.request.urlopen(API_URL) as resp:
        return json.load(resp)

def version_tuple(v):
    return tuple(map(int, (v.split("."))))

def download_asset(url, dest_path):
    with urllib.request.urlopen(url) as resp, open(dest_path, "wb") as out:
        shutil.copyfileobj(resp, out)

def main():
    try:
        latest = get_latest_release()
        latest_version = latest["tag_name"].lstrip("v")
        if version_tuple(latest_version) <= version_tuple(CURRENT_VERSION):
            # No hay nada que actualizar
            return

        # Buscamos el asset que termina en .exe (el instalador que subiste)
        asset = next(a for a in latest["assets"] if a["name"].endswith(".exe"))
        download_url = asset["browser_download_url"]

        print(f"Nueva versión encontrada: {latest_version}")
        print("Descargando…")
        tmp_dir = tempfile.mkdtemp()
        tmp_path = os.path.join(tmp_dir, EXECUTABLE_NAME)
        download_asset(download_url, tmp_path)

        # Ruta del ejecutable que está corriendo ahora
        current_exe = sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__)

        backup = current_exe + ".old"
        try:
            os.replace(current_exe, backup)          # guardamos la versión actual
            shutil.move(tmp_path, current_exe)        # movemos la nueva versión
            os.chmod(current_exe, 0o755)             # permisos ejecutables
            print("Actualización completada. Reiniciando…")
            subprocess.Popen([current_exe] + sys.argv[1:])
        finally:
            # Si algo falla, restauramos el backup
            if os.path.exists(backup):
                os.replace(backup, current_exe)
        sys.exit(0)

    except Exception as e:
        print("Error al comprobar actualizaciones:", e)

if __name__ == "__main__":
    main()