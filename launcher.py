# launcher.py
import subprocess
import sys
import os
import time
import webbrowser
import threading

# ------------------- CONFIGURACIÓN -------------------
SERVER_SCRIPT = "local_adb_server.py"
SERVER_PORT   = 8765               # puerto que ya usas
HTML_FILE     = "wsapi_demo.html"  # archivo que debe abrirse
# -----------------------------------------------------

def run_server():
    """Ejecuta local_adb_server.py como proceso hijo."""
    # Usa la misma carpeta donde está el .exe (sys._MEIPASS cuando está empaquetado)
    base_path = getattr(sys, "_MEIPASS", os.path.abspath("."))
    script_path = os.path.join(base_path, SERVER_SCRIPT)

    # Inicia el servidor (stdout/err se redirigen a DEVNULL para que no aparezca consola)
    subprocess.Popen([sys.executable, script_path],
                     cwd=base_path,
                     stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL)

def open_browser_when_ready():
    """Espera a que el servidor responda y abre el HTML en el navegador predeterminado."""
    import urllib.request
    url = f"http://127.0.0.1:{SERVER_PORT}/"
    while True:
        try:
            urllib.request.urlopen(url, timeout=2)
            break
        except Exception:
            time.sleep(0.5)   # volver a intentar cada 0.5 s

    # Cuando el servidor está listo, abre la página del dashboard
    html_path = os.path.join(getattr(sys, "_MEIPASS", os.path.abspath(".")), HTML_FILE)
    # Si el HTML está en la misma carpeta que el .exe, podemos usar file://
    webbrowser.open_new_tab(f"file:///{html_path}")

if __name__ == "__main__":
    # 1️⃣ Iniciar el servidor en un hilo separado
    threading.Thread(target=run_server, daemon=True).start()

    # 2️⃣ Esperar a que el servidor esté listo y abrir el navegador
    open_browser_when_ready()