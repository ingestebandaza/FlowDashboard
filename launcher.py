import os
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

from app_meta import APP_NAME, APP_VERSION

SERVER_PORT = 8765
HTML_FILE = "wsapi_demo.html"


def app_dir():
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def bundle_dir():
    return Path(getattr(sys, "_MEIPASS", app_dir())).resolve()


def resource_path(name):
    bundled = bundle_dir() / name
    return bundled if bundled.exists() else app_dir() / name


def run_update_check():
    try:
        import updater

        result = updater.check_for_updates(APP_VERSION, app_dir(), app_name=APP_NAME)
        if result.get("restart_required"):
            sys.exit(0)
    except SystemExit:
        raise
    except Exception:
        pass


def run_server():
    os.environ.setdefault("FLOWDASHBOARD_BASE_DIR", str(app_dir()))
    os.environ.setdefault("FLOWDASHBOARD_RESOURCE_DIR", str(bundle_dir()))
    import local_adb_server

    local_adb_server.serve_forever()


def open_browser_when_ready():
    url = f"http://127.0.0.1:{SERVER_PORT}/health"
    deadline = time.time() + 30
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=2).read()
            break
        except Exception:
            time.sleep(0.5)

    html_path = resource_path(HTML_FILE)
    webbrowser.open_new_tab(html_path.as_uri())


def server_is_ready():
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{SERVER_PORT}/health", timeout=2).read()
        return True
    except Exception:
        return False


if __name__ == "__main__":
    if server_is_ready():
        open_browser_when_ready()
        sys.exit(0)

    run_update_check()
    threading.Thread(target=open_browser_when_ready, daemon=True).start()
    run_server()
