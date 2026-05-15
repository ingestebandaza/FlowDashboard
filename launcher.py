import os
import json
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

from app_meta import APP_NAME, APP_VERSION

SERVER_PORT = 8765
HTML_FILE = "wsapi_demo.html"
REQUIRED_SERVER_FEATURES = {"static_dashboard", "client_info", "license_remember", "adb_path_probe", "client_network_info", "adb_diagnostics", "visual_update_check", "bundled_flowagent_apk"}


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

    webbrowser.open_new_tab(f"http://127.0.0.1:{SERVER_PORT}/{HTML_FILE}")


def get_server_health():
    try:
        raw = urllib.request.urlopen(f"http://127.0.0.1:{SERVER_PORT}/health", timeout=2).read()
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return None


def server_is_current():
    health = get_server_health()
    if not isinstance(health, dict):
        return False
    if str(health.get("appVersion") or "") != APP_VERSION:
        return False
    features = set(health.get("features") or [])
    return REQUIRED_SERVER_FEATURES.issubset(features)


def run_hidden(args):
    options = {}
    if os.name == "nt":
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        options["startupinfo"] = startupinfo
        options["creationflags"] = subprocess.CREATE_NO_WINDOW
    return subprocess.run(args, capture_output=True, text=True, timeout=10, **options)


def stop_server_on_port():
    if os.name != "nt":
        return
    try:
        result = run_hidden(["netstat", "-ano"])
    except Exception:
        return

    pids = set()
    for line in (result.stdout or "").splitlines():
        if f":{SERVER_PORT}" not in line or "LISTENING" not in line.upper():
            continue
        parts = line.split()
        if parts and parts[-1].isdigit():
            pids.add(parts[-1])

    for pid in pids:
        try:
            run_hidden(["taskkill", "/PID", pid, "/F", "/T"])
        except Exception:
            pass


if __name__ == "__main__":
    if server_is_current():
        open_browser_when_ready()
        sys.exit(0)

    if get_server_health():
        stop_server_on_port()
        time.sleep(1)

    threading.Thread(target=open_browser_when_ready, daemon=True).start()
    run_server()
