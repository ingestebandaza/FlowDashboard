#!/usr/bin/env python3
import base64
import hashlib
import io
import json
import mimetypes
import os
import getpass
import platform
import re
import shlex
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import uuid
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, unquote
from urllib.request import urlopen, Request, build_opener, ProxyHandler

from app_meta import APP_NAME, APP_VERSION


def _truthy_env(name):
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


IS_FROZEN = bool(getattr(sys, "frozen", False))
PRODUCT_MODE = IS_FROZEN or _truthy_env("FLOWDASHBOARD_PRODUCT_MODE")


def _runtime_executable_dir():
    if IS_FROZEN:
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def _pyinstaller_meipass_dir():
    meipass = getattr(sys, "_MEIPASS", "")
    return Path(meipass).resolve() if meipass else None


def _resolve_base_dir():
    configured = os.getenv("FLOWDASHBOARD_BASE_DIR", "").strip()
    if configured:
        return Path(configured).resolve()
    return _runtime_executable_dir()


def _resolve_resource_dir(base_dir):
    configured = os.getenv("FLOWDASHBOARD_RESOURCE_DIR", "").strip()
    if configured:
        return Path(configured).resolve()
    meipass = _pyinstaller_meipass_dir()
    if meipass:
        return meipass
    return base_dir


def _resolve_data_dir(base_dir):
    configured = os.getenv("FLOWDASHBOARD_DATA_DIR", "").strip()
    if configured:
        return Path(configured).resolve()
    if PRODUCT_MODE:
        local_appdata = os.getenv("LOCALAPPDATA", "").strip()
        if local_appdata:
            return Path(local_appdata).resolve() / "FlowDashboard"
    return base_dir

# Importar módulo de scrcpy para streaming de pantalla
try:
    from scrcpy_manager import scrcpy_manager
    SCRCPY_AVAILABLE = True
except ImportError:
    SCRCPY_AVAILABLE = False
    print("[scrcpy] Módulo scrcpy_manager no disponible. Streaming de pantalla desactivado.")

# Importar servidor WebSocket
try:
    from websocket_server import start_websocket_server, ws_manager
    WEBSOCKET_AVAILABLE = True
except ImportError:
    WEBSOCKET_AVAILABLE = False
    print("[WebSocket] Módulo websocket_server no disponible. WebSocket streaming desactivado.")

# @Added Etapa C 2026-05-28: streaming H.264 RAW por scrcpy-server v4.0.
# Reemplaza el path WebP+MediaProjection (rotos por FLAG_SECURE) por sockets
# H.264 directos al jar de scrcpy. Ver scrcpy_raw_streamer.py.
try:
    from scrcpy_raw_streamer import ScrcpyRawStreamer
    from scrcpy_raw_ws_server import start_raw_ws_server_in_background, WS_PORT as RAW_WS_PORT
    SCRCPY_RAW_AVAILABLE = True
    SCRCPY_RAW_STREAMER: "ScrcpyRawStreamer | None" = None  # se inicializa en serve_forever
except ImportError as _exc:
    SCRCPY_RAW_AVAILABLE = False
    SCRCPY_RAW_STREAMER = None
    RAW_WS_PORT = 8768
    print(f"[scrcpy-raw] modulo no disponible: {_exc}")

try:
    from scrcpy_control_channel import ScrcpyControlManager
    SCRCPY_CONTROL_AVAILABLE = True
    SCRCPY_CONTROL_MANAGER: "ScrcpyControlManager | None" = None
except ImportError as _exc:
    SCRCPY_CONTROL_AVAILABLE = False
    SCRCPY_CONTROL_MANAGER = None
    print(f"[scrcpy-control] modulo no disponible: {_exc}")

try:
    import entitlements as entitlements_module
    ENTITLEMENTS_AVAILABLE = True
except ImportError as _exc:
    entitlements_module = None
    ENTITLEMENTS_AVAILABLE = False
    print(f"[entitlements] modulo no disponible: {_exc}")

BASE_DIR = _resolve_base_dir()
RESOURCE_DIR = _resolve_resource_dir(BASE_DIR)
DATA_DIR = _resolve_data_dir(BASE_DIR)
DATA_DIR.mkdir(parents=True, exist_ok=True)
ADB_HOME_OVERRIDE = os.getenv("FLOWDASHBOARD_ADB_HOME", "").strip()

HOST = "127.0.0.1"
PORT = 8765
AGENT_HOST = "0.0.0.0"
AGENT_PORT = 8766
CONTROL_SAFE_MODE_ADB = False
CONTROL_ADB_ONLY_SERIALS = set()

def should_force_adb(serial, prefer_scrcpy=True):
    if globals().get("CONTROL_SAFE_MODE_ADB", False):
        return True, "safe_mode_adb"
    if serial in globals().get("CONTROL_ADB_ONLY_SERIALS", set()):
        return True, "serial_adb_only"
    if prefer_scrcpy is False:
        return True, "preferScrcpy_false"
    return False, ""

SERVER_VERSION = "2026-05-12-device-public-ip-refresh"
SERVER_FEATURES = ["flowlogin_payload", "flowlogin_status", "account_statuses", "flowlogin_agent_runner", "flowlogin_stop", "apk_agent_socket", "flowagent_setup", "flowlogin_fresh_retry", "flowagent_auto_ensure", "flowlogin_cache_retry", "flowlogin_visual_cache_clear", "flowlogin_retry_form_fix", "flowlogin_clone_list", "device_public_ip_flags", "device_public_ip_refresh", "static_dashboard", "client_info", "license_remember", "adb_path_probe", "adb_deep_probe", "client_network_info", "adb_env_path", "adb_diagnostics", "visual_update_check", "bundled_flowagent_apk", "device_categories", "device_mac_identity", "flowagent_auto_socket_watchdog", "device_visible_ip", "flowagent_socket_app_info_permissions", "flowagent_accessibility_diagnostics", "clone_apk_manager", "screen_streaming_scrcpy", "pro_native_scrcpy_streams", "etapa_c_h264_websocket", "flowdev_inspector_focus", "scrcpy_raw_h264_ws", "operation_profiles", "scrcpy_manual_recording", "scrcpy_control_first_adb_fallback"]
APPROVED_DATA_FILES = (
    "device_names.json",
    "device_groups.json",
    "device_inventory.json",
    "device_mappings.json",
    "device_registrations.json",
    "license.json",
    "update_config.json",
)


def migrate_approved_data_files():
    try:
        if DATA_DIR.resolve() == BASE_DIR.resolve():
            return []
    except Exception:
        pass
    migrated = []
    for file_name in APPROVED_DATA_FILES:
        source = BASE_DIR / file_name
        target = DATA_DIR / file_name
        try:
            if source.exists() and source.is_file() and not target.exists():
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
                migrated.append(file_name)
        except Exception as exc:
            print(f"[paths] no se pudo migrar {file_name}: {exc}")
    if migrated:
        print(f"[paths] migrados a DATA_DIR: {', '.join(migrated)}")
    return migrated


MIGRATED_DATA_FILES = migrate_approved_data_files()
OPERATION_PROFILES = {
    "control": {
        "uses": ["adb", "scrcpy_h264"],
        "forbidden_auto": ["flowagent", "accessibility", "mediaprojection", "ocr", "opencv"],
    },
    "automation": {
        "uses": ["flowagent_socket", "autojs6", "accessibility", "flowkeyboard"],
        "forbidden_auto": ["mediaprojection"],
    },
    "inspector": {
        "uses": ["adb_uiautomator", "cdp", "optional_accessibility"],
        "forbidden_auto": ["mediaprojection", "ocr"],
    },
    "ocr": {
        "uses": ["flowagent_socket", "mediaprojection", "ocr"],
        "forbidden_auto": [],
    },
    "recording": {
        "uses": ["scrcpy_h264_pc_recording"],
        "forbidden_auto": ["mediaprojection"],
    },
}


def unique_paths(values):
    seen = set()
    result = []
    for value in values:
        text = str(value or "").strip().strip('"')
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(Path(text))
    return result


def candidate_adb_paths():
    bundled_candidates = [
        os.getenv("FLOWDASHBOARD_ADB", ""),
        str(BASE_DIR / "scrcpy-win64-v4.0" / "adb.exe"),
        str(RESOURCE_DIR / "scrcpy-win64-v4.0" / "adb.exe"),
    ]
    candidates = []
    for value in bundled_candidates:
        path = Path(str(value or "").strip().strip('"'))
        if path and "scrcpy-win64-v4.0" in {part.lower() for part in path.parts}:
            candidates.append(path)
    return unique_paths(candidates)


def deep_probe_adb():
    roots = [
        BASE_DIR,
        Path(os.getenv("USERPROFILE", "")),
        Path(os.getenv("LOCALAPPDATA", "")),
    ]
    for root in roots:
        if not str(root) or not root.exists() or not root.is_dir():
            continue
        try:
            for path in root.rglob("adb.exe"):
                parts = {part.lower() for part in path.parts}
                if "platform-tools" in parts or path.parent == root:
                    return path
        except Exception:
            continue
    return None


def find_adb():
    for candidate in candidate_adb_paths():
        if candidate.exists() and candidate.is_file():
            return str(candidate)
    raise RuntimeError("No se encontro el ADB empaquetado en scrcpy-win64-v4.0\\adb.exe.")


ADB = find_adb()
if SCRCPY_CONTROL_AVAILABLE:
    try:
        SCRCPY_CONTROL_MANAGER = ScrcpyControlManager(ADB)
    except Exception as _exc:
        SCRCPY_CONTROL_MANAGER = None
        print(f"[scrcpy-control] no se pudo inicializar: {_exc}")
ANDROID_HOME_DIR = Path(ADB_HOME_OVERRIDE).expanduser() if ADB_HOME_OVERRIDE else None
if ANDROID_HOME_DIR:
    ANDROID_HOME_DIR.mkdir(exist_ok=True)
    os.environ["ANDROID_USER_HOME"] = str(ANDROID_HOME_DIR)
    os.environ["ANDROID_SDK_HOME"] = str(ANDROID_HOME_DIR)
    os.environ["ADB_VENDOR_KEYS"] = str(ANDROID_HOME_DIR)
AUTOJS_PACKAGES = [
    "org.autojs.autojs6",     # AutoJs6 (mantenido, recomendado)
    "youhu.laixijs",          # Laixi (legacy, no requerido)
    "org.autojs.autojs",      # Auto.js clasico
    "org.autojs.autojspro",   # Auto.js Pro
    "com.stardust.autojs",
    "com.stardust.autojspro",
    "com.stardust.commoncommonxmly1",
]
DEVICE_NAMES_FILE = DATA_DIR / "device_names.json"
DEVICE_INVENTORY_FILE = DATA_DIR / "device_inventory.json"

SCAN_STATE = {"active": False, "status": "idle", "progress": 0, "total": 0, "found": [], "current_ip": ""}
SCAN_CANCEL_EVENT = threading.Event()
INVENTORY_LOCK = threading.Lock()

DEVICE_GROUPS_FILE = DATA_DIR / "device_groups.json"
FLOWLOGIN_PAYLOAD_DIR = DATA_DIR / ".flowlogin_payloads"
FLOWLOGIN_PAYLOAD_DIR.mkdir(exist_ok=True)
def find_flow_agent_apk():
    # @Modified by FlowDashboard Etapa B on 2026-05-27.
    #   Prioriza el APK release del FlowAgent monolito (Etapa B). Si no esta
    #   construido todavia, cae al debug del monolito, y como ultimo recurso
    #   al 0.3.8 historico (Etapa A) para rollback de emergencia.
    commercial_universal = []
    commercial_arm64 = []
    monolito_release_universal = []
    monolito_release_arm64 = []
    monolito_debug_arm64 = []
    for root in unique_paths([BASE_DIR, RESOURCE_DIR]):
        commercial_universal.extend([
            root / "android" / "flowagent" / "agent-v1.0.0-universal.apk",
            root / "flow_agent" / "agent-v1.0.0-universal.apk",
        ])
        commercial_arm64.extend([
            root / "android" / "flowagent" / "agent-v1.0.0-arm64-v8a.apk",
            root / "flow_agent" / "agent-v1.0.0-arm64-v8a.apk",
        ])
        monolito_release_dir = root / "flow_agent_monolito" / "app" / "build" / "outputs" / "apk" / "app" / "release"
        monolito_debug_dir = root / "flow_agent_monolito" / "app" / "build" / "outputs" / "apk" / "app" / "debug"
        if monolito_release_dir.exists():
            monolito_release_universal.extend(monolito_release_dir.glob("agent-v*-universal.apk"))
            monolito_release_arm64.extend(monolito_release_dir.glob("agent-v*-arm64-v8a.apk"))
        if monolito_debug_dir.exists():
            monolito_debug_arm64.extend(monolito_debug_dir.glob("agent-v*-arm64-v8a.apk"))
    monolito_release_universal = sorted(monolito_release_universal, key=lambda path: path.stat().st_mtime, reverse=True)
    monolito_release_arm64 = sorted(monolito_release_arm64, key=lambda path: path.stat().st_mtime, reverse=True)
    monolito_debug_arm64 = sorted(monolito_debug_arm64, key=lambda path: path.stat().st_mtime, reverse=True)
    candidates = [
        *commercial_universal,
        *commercial_arm64,
        *monolito_release_universal,
        *monolito_release_arm64,
        *monolito_debug_arm64,
        BASE_DIR / "flow_agent_apk" / "build" / "flowagent-debug.apk",
        RESOURCE_DIR / "flow_agent_apk" / "build" / "flowagent-debug.apk",
    ]
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate
    return RESOURCE_DIR / "android" / "flowagent" / "agent-v1.0.0-universal.apk"


FLOW_AGENT_APK = find_flow_agent_apk()
FLOW_AGENT_PACKAGE = "com.flowlogin.agent"
FLOW_AGENT_ACTIVITY = "com.flowlogin.agent/.MainActivity"
# @Modified by FlowDashboard Etapa B on 2026-05-27.
#   Version del monolito (Etapa B). El backend valida contra esto para
#   detectar dispositivos con FlowAgent 0.3.8 antiguo y forzar update.
FLOW_AGENT_EXPECTED_VERSION = "1.0.0"
FLOW_AGENT_EXPECTED_VERSION_CODE = 106
FLOWLOGIN_ACCOUNTS_REMOTE = "/sdcard/Download/flowlogin_accounts.json"
FLOWLOGIN_STATUS_REMOTE = "/sdcard/Download/flowlogin_status.json"
SPOTIFY_CLONE_PACKAGES = [
    "com.spotify.musid",
    "com.spotify.musie",
    "com.spotify.musif",
    "com.spotify.musig",
    "com.spotify.musih",
    "com.spotify.musii",
    "com.spotify.musij",
    "com.spotify.musik",
    "com.spotify.musil",
    "com.spotify.musim",
]
TERMINAL_LOGIN_STATUSES = {"success", "error", "already", "review", "notice14"}
LOGIN_SUCCESS_STATUSES = {"success", "already"}
LOGIN_RETRY_AFTER_CLEAR_STATUSES = {"error", "review", "notice14"}
FLOWLOGIN_ALLOWED_STATUSES = {"pending", "running", "retrying", "waiting_mail", "success", "error", "already", "review", "notice14", "replaced"}
DEVICE_NAMES_LOCK = threading.Lock()
FLOWLOGIN_JOBS = set()
FLOWLOGIN_STOP_EVENTS = {}
FLOWLOGIN_CURRENT_ITEMS = {}
FLOWREGISTER_PROGRESS = {}
FLOWREGISTER_RESULTS = {}
FLOWMAIL_OPENED_LINKS = {}
FLOWMAIL_OPENED_URLS = {}


def spotify_package_for_clone(clone):
    try:
        clone_number = int(clone)
    except Exception:
        clone_number = 0
    if 1 <= clone_number <= len(SPOTIFY_CLONE_PACKAGES):
        return SPOTIFY_CLONE_PACKAGES[clone_number - 1]
    return ""
FLOWLOGIN_JOBS_LOCK = threading.Lock()
AGENT_CONNECTIONS = {}
AGENT_CONNECTIONS_LOCK = threading.Lock()
AGENT_RESPONSE_CACHE = {}
AGENT_RESPONSE_CACHE_LOCK = threading.Lock()
FLOWAGENT_AUTO_RECONNECT_ENABLED = True
AUTO_SCAN_ON_START_ENABLED = os.getenv("FLOWDASHBOARD_DISABLE_AUTO_SCAN", "").strip().lower() not in ("1", "true", "yes")
AUTO_SCAN_ON_START_DELAY = 3.0
FLOWAGENT_AUTO_RECONNECT_INTERVAL = 6.0
FLOWAGENT_AUTO_RECONNECT_INITIAL_DELAY = 8.0
FLOWAGENT_AUTO_RECONNECT_LAUNCH_COOLDOWN = 30.0
FLOWAGENT_AUTO_RECONNECT_FAILURE_BACKOFF = 90.0
FLOWAGENT_STALE_TTL = 90.0
FLOWAGENT_AUTO_RECONNECT_STATE = {}
FLOWAGENT_AUTO_RECONNECT_LOCK = threading.Lock()
AGENT_SOCKET_DIAG_LOG = DATA_DIR / "reports" / "agent_socket_diag.log"
ANDROID_ID_CACHE = {}
ANDROID_ID_LOCK = threading.Lock()
PUBLIC_IP_CACHE = {}
PUBLIC_IP_LOCK = threading.Lock()
PUBLIC_IP_CACHE_TTL = 600
DEVICE_MAC_CACHE = {}
DEVICE_MAC_LOCK = threading.Lock()
DEVICE_LOCAL_IP_CACHE = {}
DEVICE_LOCAL_IP_LOCK = threading.Lock()
LAST_ADB_DEVICES_OUTPUT = ""
_DEVICES_CACHE: list = []
_DEVICES_CACHE_LOCK = threading.Lock()


def _get_cached_devices() -> list:
    """Devuelve la última lista de dispositivos sin llamar ADB."""
    with _DEVICES_CACHE_LOCK:
        return list(_DEVICES_CACHE)


def _set_cached_devices(devices: list):
    with _DEVICES_CACHE_LOCK:
        _DEVICES_CACHE.clear()
        _DEVICES_CACHE.extend(devices)
UPDATE_LOCK = threading.Lock()
UPDATE_STATUS = {
    "state": "idle",
    "currentVersion": APP_VERSION,
    "latestVersion": "",
    "message": "",
    "error": "",
    "restartRequired": False,
}
UI_DUMP_REMOTE = "/sdcard/window.xml"
NODE_BOUNDS_RE = re.compile(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]")
STATIC_FILES = {
    "/wsapi_demo.html": "wsapi_demo.html",
    "/wsapi.js": "wsapi.js",
    "/streaming_ui_clean.js": "streaming_ui_clean.js",
    "/license_persistence.js": "license_persistence.js",
    "/debug_validar.js": "debug_validar.js",
    "/pro_panel.js": "pro_panel.js",
    "/logo.png": "logo.png",
}
SCRCPY_EXE_CANDIDATES = [
    RESOURCE_DIR / "scrcpy-win64-v4.0" / "scrcpy.exe",
    BASE_DIR / "scrcpy-win64-v4.0" / "scrcpy.exe",
]
SCRCPY_EXE = next((candidate for candidate in SCRCPY_EXE_CANDIDATES if candidate.exists() and candidate.is_file()), None)
SCRCPY_NATIVE_LOCK = threading.Lock()
SCRCPY_NATIVE_STREAMS = {}
SCRCPY_RECORDINGS_LOCK = threading.Lock()
SCRCPY_RECORDINGS = {}
RECORDINGS_DIR = DATA_DIR / "recordings"


def _bounded_int(value, default, min_value, max_value):
    try:
        number = int(value)
    except Exception:
        return default
    return max(min_value, min(max_value, number))


def _scrcpy_stream_info(serial, record):
    process = record.get("process")
    running = bool(process and process.poll() is None)
    return {
        "serial": serial,
        "pid": process.pid if process else None,
        "running": running,
        "windowTitle": record.get("windowTitle", ""),
        "x": record.get("x", 0),
        "y": record.get("y", 0),
        "width": record.get("width", 360),
        "height": record.get("height", 720),
        "embedded": False,
        "embedMode": "native-window",
        "startedAt": record.get("startedAt", 0),
    }


def list_scrcpy_native_streams():
    with SCRCPY_NATIVE_LOCK:
        stale = [serial for serial, record in SCRCPY_NATIVE_STREAMS.items() if record["process"].poll() is not None]
        for serial in stale:
            SCRCPY_NATIVE_STREAMS.pop(serial, None)
        return [_scrcpy_stream_info(serial, record) for serial, record in SCRCPY_NATIVE_STREAMS.items()]


def start_scrcpy_native_stream(serial, options=None):
    serial = str(serial or "").strip()
    if not serial:
        raise RuntimeError("Falta serial del dispositivo.")
    if not SCRCPY_EXE:
        raise RuntimeError("No se encontro scrcpy.exe en scrcpy-win64-v4.0.")

    options = options or {}
    width = _bounded_int(options.get("width"), 360, 180, 1200)
    height = _bounded_int(options.get("height"), 720, 240, 1600)
    x = _bounded_int(options.get("x"), 80, -10000, 10000)
    y = _bounded_int(options.get("y"), 80, -10000, 10000)
    max_size = _bounded_int(options.get("maxSize"), 1080, 360, 3840)
    max_fps = _bounded_int(options.get("maxFps"), 30, 5, 60)
    bit_rate = str(options.get("bitRate") or "4M")
    borderless = bool(options.get("borderless", True))
    always_on_top = bool(options.get("alwaysOnTop", False))
    no_control = bool(options.get("noControl", False))
    restart = bool(options.get("restart", False))
    window_title = f"FlowDashboard Pro - {serial}"

    with SCRCPY_NATIVE_LOCK:
        existing = SCRCPY_NATIVE_STREAMS.get(serial)
        if existing and existing["process"].poll() is None:
            if not restart:
                return _scrcpy_stream_info(serial, existing)
            process = existing.get("process")
            process.terminate()
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                process.kill()
            SCRCPY_NATIVE_STREAMS.pop(serial, None)
        if existing:
            SCRCPY_NATIVE_STREAMS.pop(serial, None)

        env, _ = get_adb_environment()
        env["ADB"] = ADB or env.get("ADB", "")
        env["SCRCPY_ICON_DIR"] = str(SCRCPY_EXE.parent)
        args = [
            str(SCRCPY_EXE),
            "--serial", serial,
            "--no-audio",
            "--max-size", str(max_size),
            "--max-fps", str(max_fps),
            "--video-bit-rate", bit_rate,
            "--window-title", window_title,
            "--window-x", str(x),
            "--window-y", str(y),
            "--window-width", str(width),
            "--window-height", str(height),
            "--render-fit", "letterbox",
            "--video-buffer", "0",
            "--stay-awake",
            "--disable-screensaver",
        ]
        if borderless:
            args.append("--window-borderless")
        if always_on_top:
            args.append("--always-on-top")
        if no_control:
            args.append("--no-control")

        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        process = subprocess.Popen(
            args,
            cwd=str(SCRCPY_EXE.parent),
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creationflags,
        )
        record = {
            "process": process,
            "windowTitle": window_title,
            "x": x,
            "y": y,
            "width": width,
            "height": height,
            "startedAt": time.time(),
        }
        SCRCPY_NATIVE_STREAMS[serial] = record
        return _scrcpy_stream_info(serial, record)


def stop_scrcpy_native_stream(serial):
    serial = str(serial or "").strip()
    if not serial:
        raise RuntimeError("Falta serial del dispositivo.")
    with SCRCPY_NATIVE_LOCK:
        record = SCRCPY_NATIVE_STREAMS.pop(serial, None)
    if not record:
        return {"serial": serial, "stopped": False}
    process = record.get("process")
    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
    return {"serial": serial, "stopped": True}


def stop_all_scrcpy_native_streams():
    with SCRCPY_NATIVE_LOCK:
        serials = list(SCRCPY_NATIVE_STREAMS.keys())
    return [stop_scrcpy_native_stream(serial) for serial in serials]


def _safe_recording_serial(serial):
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "_", str(serial or "").strip())
    return safe.strip("._") or "device"


def _safe_scrcpy_bit_rate(value, default="4M"):
    text = str(value or default).strip()
    if re.fullmatch(r"\d+(?:[KMG])?", text, flags=re.IGNORECASE):
        return text.upper()
    return default


def _check_mp4_validity(filepath_str):
    try:
        path = Path(filepath_str)
        if not path.exists():
            return False, "No existe el archivo."
        size = path.stat().st_size
        if size < 100:
            return False, f"Archivo demasiado pequeno ({size} bytes)."
        with open(path, "rb") as f:
            head = f.read(1024)
            if size > 1024 * 1024:
                f.seek(-1024 * 1024, os.SEEK_END)
            else:
                f.seek(0)
            tail = f.read()
        ftyp = b"ftyp" in head
        moov = b"moov" in head or b"moov" in tail
        mdat = b"mdat" in head or b"mdat" in tail
        if ftyp and moov and mdat:
            return True, "OK"
        else:
            return False, f"Faltan atomos: ftyp={ftyp}, moov={moov}, mdat={mdat}"
    except Exception as e:
        return False, str(e)


def _recording_info(serial, record):
    process = record.get("process")
    path = Path(record.get("path", ""))
    running = bool(process and process.poll() is None)
    return {
        "serial": serial,
        "pid": process.pid if process else None,
        "running": running,
        "path": str(path),
        "fileName": path.name,
        "exists": path.exists(),
        "size": path.stat().st_size if path.exists() else 0,
        "startedAt": record.get("startedAt", 0),
        "maxSize": record.get("maxSize", 0),
        "maxFps": record.get("maxFps", 0),
        "bitRate": record.get("bitRate", ""),
    }


def list_scrcpy_recordings():
    with SCRCPY_RECORDINGS_LOCK:
        stale = [serial for serial, record in SCRCPY_RECORDINGS.items() if record["process"].poll() is not None]
        for serial in stale:
            record = SCRCPY_RECORDINGS.pop(serial, None)
            if record and record.get("logFile"):
                try:
                    record["logFile"].close()
                except Exception:
                    pass
        return [_recording_info(serial, record) for serial, record in SCRCPY_RECORDINGS.items()]


def scrcpy_recording_status(serial):
    serial = str(serial or "").strip()
    if not serial:
        return {"serial": serial, "running": False}
    with SCRCPY_RECORDINGS_LOCK:
        record = SCRCPY_RECORDINGS.get(serial)
        if not record:
            return {"serial": serial, "running": False}
        if record["process"].poll() is not None:
            SCRCPY_RECORDINGS.pop(serial, None)
            if record.get("logFile"):
                try:
                    record["logFile"].close()
                except Exception:
                    pass
            return _recording_info(serial, record)
        return _recording_info(serial, record)


def start_scrcpy_recording(serial, options=None):
    serial = str(serial or "").strip()
    if not serial:
        raise RuntimeError("Falta serial del dispositivo.")
    if not SCRCPY_EXE:
        raise RuntimeError("No se encontro scrcpy.exe en scrcpy-win64-v4.0.")

    options = options or {}
    restart = bool(options.get("restart", False))
    max_size = _bounded_int(options.get("maxSize"), 1080, 360, 3840)
    max_fps = _bounded_int(options.get("maxFps"), 30, 5, 60)
    bit_rate = _safe_scrcpy_bit_rate(options.get("bitRate"), "4M")
    safe_serial = _safe_recording_serial(serial)
    started_at = datetime.now()
    output_dir = RECORDINGS_DIR / safe_serial
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"flowrecord_{safe_serial}_{started_at.strftime('%Y%m%d_%H%M%S')}.mp4"

    with SCRCPY_RECORDINGS_LOCK:
        existing = SCRCPY_RECORDINGS.get(serial)
        if existing and existing["process"].poll() is None:
            if not restart:
                return _recording_info(serial, existing)
            process = existing.get("process")
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
        if existing:
            SCRCPY_RECORDINGS.pop(serial, None)

        env, _ = get_adb_environment()
        env["ADB"] = ADB or env.get("ADB", "")
        env["SCRCPY_ICON_DIR"] = str(SCRCPY_EXE.parent)
        args = [
            str(SCRCPY_EXE),
            "--serial", serial,
            "--no-audio",
            "--no-playback",
            "--no-control",
            "--record", str(output_path),
            "--max-size", str(max_size),
            "--max-fps", str(max_fps),
            "--video-bit-rate", bit_rate,
        ]
        log_path = output_path.with_suffix(".log")
        log_file = open(log_path, "a", encoding="utf-8", errors="replace")
        
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        startupinfo = None
        if os.name == "nt":
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = subprocess.SW_HIDE

        process = subprocess.Popen(
            args,
            cwd=str(SCRCPY_EXE.parent),
            env=env,
            stdout=log_file,
            stderr=log_file,
            creationflags=creationflags,
            startupinfo=startupinfo
        )
        record = {
            "process": process,
            "path": output_path,
            "logPath": log_path,
            "logFile": log_file,
            "startedAt": time.time(),
            "maxSize": max_size,
            "maxFps": max_fps,
            "bitRate": bit_rate,
        }
        SCRCPY_RECORDINGS[serial] = record
        return _recording_info(serial, record)


def stop_scrcpy_recording(serial):
    serial = str(serial or "").strip()
    if not serial:
        raise RuntimeError("Falta serial del dispositivo.")
    with SCRCPY_RECORDINGS_LOCK:
        record = SCRCPY_RECORDINGS.pop(serial, None)
    if not record:
        return {"serial": serial, "stopped": False, "running": False}
    process = record.get("process")
    force_killed = False
    if process and process.poll() is None:
        if os.name == "nt":
            try:
                subprocess.run(["taskkill", "/PID", str(process.pid)], check=False)
            except Exception:
                pass
        else:
            process.terminate()
        try:
            process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            process.kill()
            force_killed = True
            try:
                process.wait(timeout=3)
            except Exception:
                pass
    log_file = record.get("logFile")
    if log_file:
        try:
            log_file.close()
        except Exception:
            pass
            
    time.sleep(1) # Dar un segundo al FileSystem para actualizar el tamano
    info = _recording_info(serial, record)
    info["stopped"] = True
    
    # Validacion MP4
    is_valid, validation_msg = _check_mp4_validity(info["path"])
    info["valid"] = is_valid
    if force_killed:
        info["message"] = "Grabacion finalizada, pero el archivo podria estar corrupto (cierre forzado)."
    elif not is_valid:
        info["message"] = f"Grabacion finalizada, pero el archivo podria estar corrupto. ({validation_msg})"
    else:
        info["message"] = "Grabacion guardada"
        
    return info


def stop_all_scrcpy_recordings():
    with SCRCPY_RECORDINGS_LOCK:
        serials = list(SCRCPY_RECORDINGS.keys())
    return [stop_scrcpy_recording(serial) for serial in serials]


def pro_stream_layout(selected_serials=None, columns=None, width=360, height=720, gap=12, start_x=60, start_y=70):
    if selected_serials is None:
        selected_serials = [device["serial"] for device in list_devices()]
    serials = [str(serial).strip() for serial in selected_serials if str(serial or "").strip()]
    count = len(serials)
    if not count:
        return []
    columns = _bounded_int(columns, 0, 0, 8) or min(4, max(1, int(count ** 0.5 + 0.999)))
    width = _bounded_int(width, 360, 180, 1200)
    height = _bounded_int(height, 720, 240, 1600)
    gap = _bounded_int(gap, 12, 0, 80)
    start_x = _bounded_int(start_x, 60, -10000, 10000)
    start_y = _bounded_int(start_y, 70, -10000, 10000)
    layout = []
    for index, serial in enumerate(serials):
        row = index // columns
        column = index % columns
        layout.append({
            "serial": serial,
            "x": start_x + column * (width + gap),
            "y": start_y + row * (height + gap),
            "width": width,
            "height": height,
        })
    return layout


def adb_screencap_png(serial):
    serial = str(serial or "").strip()
    if not serial:
        raise RuntimeError("Falta serial del dispositivo.")
    if not ADB or not Path(ADB).exists():
        raise RuntimeError("No se encontro adb.")
    env, _ = get_adb_environment()
    result = subprocess.run(
        [ADB, "-s", serial, "exec-out", "screencap", "-p"],
        capture_output=True,
        timeout=10,
        env=env,
    )
    if result.returncode != 0 or not result.stdout:
        detail = result.stderr.decode("utf-8", errors="ignore") if result.stderr else ""
        raise RuntimeError(detail.strip() or "No se pudo capturar pantalla.")
    return result.stdout

# Cargar configuración de Supabase desde archivo o variables de entorno
SUPABASE_CONFIG_FILE = BASE_DIR / ".supabase_config.json"
SUPABASE_URL = ""
SUPABASE_API_KEY = ""
CAPSOLVER_API_KEY = ""
ALLOW_LOCAL_LICENSE_MODE = (not PRODUCT_MODE) and _truthy_env("FLOWDASHBOARD_ALLOW_LOCAL_LICENSE")
USE_SYSTEM_PROXY = _truthy_env("FLOWDASHBOARD_USE_SYSTEM_PROXY")

SUPABASE_PUBLIC_URL_DEFAULT = "https://qcwvfeqyczkhmkhqicqi.supabase.co"
SUPABASE_PUBLIC_ANON_KEY_DEFAULT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjd3ZmZXF5Y3praG1raHFpY3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTg2MzcsImV4cCI6MjA5NDI3NDYzN30.XL3NLmiFZLbH-4sEMTlNn_2ni2ZHicrgXOfMAKb1hqs"


def _load_public_supabase_config():
    for root in (RESOURCE_DIR, BASE_DIR):
        path = root / "config" / "public" / "supabase.json"
        try:
            if path.exists():
                with path.open("r", encoding="utf-8") as fh:
                    data = json.load(fh)
                url = str(data.get("url") or data.get("SUPABASE_URL") or "").strip()
                anon = str(data.get("anonKey") or data.get("SUPABASE_ANON_KEY") or "").strip()
                if url or anon:
                    return url, anon
        except Exception:
            pass
    return "", ""


if (not PRODUCT_MODE) and SUPABASE_CONFIG_FILE.exists():
    try:
        with SUPABASE_CONFIG_FILE.open("r", encoding="utf-8") as fh:
            config = json.load(fh)
            SUPABASE_URL = config.get("SUPABASE_URL", "")
            SUPABASE_API_KEY = config.get("SUPABASE_API_KEY", "")
            CAPSOLVER_API_KEY = config.get("CAPSOLVER_API_KEY", "")
    except Exception:
        pass

# Fallback a variables de entorno si no hay archivo de config
SUPABASE_URL = os.getenv("SUPABASE_URL", SUPABASE_URL)
if PRODUCT_MODE:
    if os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        print("[security] SUPABASE_SERVICE_ROLE_KEY ignorado en PRODUCT_MODE.")
    SUPABASE_API_KEY = os.getenv("SUPABASE_ANON_KEY", os.getenv("SUPABASE_API_KEY", SUPABASE_API_KEY))
else:
    # Solo desarrollo: service_role puede existir en el entorno local del PC de trabajo.
    SUPABASE_API_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_API_KEY", os.getenv("SUPABASE_ANON_KEY", SUPABASE_API_KEY)))
CAPSOLVER_API_KEY = os.getenv("CAPSOLVER_API_KEY", CAPSOLVER_API_KEY)

if PRODUCT_MODE:
    if not SUPABASE_URL or not SUPABASE_API_KEY:
        _pub_url, _pub_anon = _load_public_supabase_config()
        if not SUPABASE_URL and _pub_url:
            SUPABASE_URL = _pub_url
        if not SUPABASE_API_KEY and _pub_anon:
            SUPABASE_API_KEY = _pub_anon
    if not SUPABASE_URL:
        SUPABASE_URL = SUPABASE_PUBLIC_URL_DEFAULT
    if not SUPABASE_API_KEY:
        SUPABASE_API_KEY = SUPABASE_PUBLIC_ANON_KEY_DEFAULT

SUPABASE_HEADERS = {
    "apikey": SUPABASE_API_KEY,
    "Content-Type": "application/json",
    "Authorization": f"Bearer {SUPABASE_API_KEY}",
}
LAST_SUPABASE_ERROR = ""


def supabase_request(endpoint, method="GET", data=None):
    global LAST_SUPABASE_ERROR
    LAST_SUPABASE_ERROR = ""
    # Si no hay Supabase configurado, retornar None para usar modo local
    if not SUPABASE_URL or SUPABASE_URL == "" or SUPABASE_URL == "https://your-supabase-url.supabase.co":
        return None
    try:
        # Asegurar que endpoint empiece con /
        if not endpoint.startswith("/"):
            endpoint = "/" + endpoint
        # Si endpoint ya incluye /rest/v1, usarlo directamente
        if "/rest/v1" in endpoint:
            url = f"{SUPABASE_URL}{endpoint}"
        else:
            url = f"{SUPABASE_URL}/rest/v1{endpoint}"
        body = json.dumps(data).encode("utf-8") if data else None
        req = Request(url, data=body, headers=SUPABASE_HEADERS, method=method)
        opener = None if USE_SYSTEM_PROXY else build_opener(ProxyHandler({}))
        open_fn = urlopen if opener is None else opener.open
        with open_fn(req, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        error_msg = str(exc)
        # Intentar obtener más detalles del error
        if hasattr(exc, 'read'):
            try:
                error_detail = exc.read().decode("utf-8")
                error_msg = f"{error_msg} - Detalle: {error_detail}"
            except Exception:
                pass
        print(f"Error en Supabase request: {error_msg}")
        LAST_SUPABASE_ERROR = error_msg
        return None


def get_update_status():
    with UPDATE_LOCK:
        return dict(UPDATE_STATUS)


def set_update_status(**values):
    with UPDATE_LOCK:
        UPDATE_STATUS.update(values)
        UPDATE_STATUS["currentVersion"] = APP_VERSION
        return dict(UPDATE_STATUS)


def run_visual_update_check():
    set_update_status(
        state="error",
        latestVersion="",
        message="El actualizador Python legacy fue reemplazado por electron-updater.",
        error="legacy_updater_disabled",
        restartRequired=False,
    )


def start_visual_update_check():
    with UPDATE_LOCK:
        UPDATE_STATUS.update({
            "state": "error",
            "currentVersion": APP_VERSION,
            "latestVersion": "",
            "message": "El actualizador Python legacy fue reemplazado por electron-updater.",
            "error": "legacy_updater_disabled",
            "restartRequired": False,
        })
        status = dict(UPDATE_STATUS)
    return status


def validate_license_with_supabase_rpc(device_email, license_key, device_info=None):
    if not SUPABASE_URL or SUPABASE_URL == "" or SUPABASE_URL == "https://your-supabase-url.supabase.co":
        return None
    if not SUPABASE_API_KEY:
        return None

    device_info = device_info or {}
    payload = {
        "p_device_email": device_email,
        "p_license_key": license_key,
        "p_device_hostname": device_info.get("hostname", ""),
        "p_device_serial": device_info.get("serial", ""),
        "p_device_os": device_info.get("os", ""),
        "p_ip_public": device_info.get("ip", ""),
        "p_country_code": device_info.get("country", ""),
        "p_device_hash": device_info.get("device_hash", ""),
        "p_windows_user": device_info.get("windows_user", ""),
        "p_app_version": APP_VERSION,
        "p_local_ip": device_info.get("local_ip", ""),
        "p_mac_address": device_info.get("mac_address", ""),
        "p_country_name": device_info.get("country_name", ""),
    }
    return supabase_request("/rpc/validate_flowdashboard_license", method="POST", data=payload)


def validate_license_local_mode(device_email, license_key, device_info=None):
    if not license_key or license_key == "":
        return {"status": "error", "message": "Licencia invalida"}

    device_reg_file = DATA_DIR / "device_registrations.json"
    registrations = {}
    if device_reg_file.exists():
        try:
            with device_reg_file.open("r", encoding="utf-8") as fh:
                registrations = json.load(fh)
        except Exception:
            registrations = {}

    existing_key = f"{device_email}:{license_key}"
    if existing_key in registrations:
        registrations[existing_key]["last_seen_at"] = datetime.now(timezone.utc).isoformat()
    else:
        device_info = device_info or {}
        registrations[existing_key] = {
            "license_key": license_key,
            "device_email": device_email,
            "device_hostname": device_info.get("hostname", ""),
            "device_serial": device_info.get("serial", ""),
            "device_os": device_info.get("os", ""),
            "ip_public": device_info.get("ip", ""),
            "country_code": device_info.get("country", ""),
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_seen_at": datetime.now(timezone.utc).isoformat(),
        }

    with device_reg_file.open("w", encoding="utf-8") as fh:
        json.dump(registrations, fh, ensure_ascii=False, indent=2)

    return {"status": "success", "device_status": "approved", "message": "Dispositivo aprobado (modo local)"}


def validate_device_license(device_email, license_key, device_info=None):
    try:
        if not license_key or not device_email:
            return {"status": "error", "message": "Email y license_key requeridos"}

        rpc_result = validate_license_with_supabase_rpc(device_email, license_key, device_info=device_info)
        if isinstance(rpc_result, dict):
            return rpc_result

        if not SUPABASE_API_KEY or SUPABASE_API_KEY == "" or SUPABASE_URL == "https://your-supabase-url.supabase.co":
            if ALLOW_LOCAL_LICENSE_MODE:
                return validate_license_local_mode(device_email, license_key, device_info=device_info)
            return {"status": "error", "message": "Supabase no configurado. No se permite modo local en esta build."}

        detail = f" Detalle: {LAST_SUPABASE_ERROR}" if LAST_SUPABASE_ERROR else ""
        return {"status": "error", "message": f"No se pudo validar con Supabase. Ejecuta supabase_license_rpc.sql y revisa la anon key.{detail}"}

        # Modo local: si no hay Supabase configurado, aceptar cualquier licencia válida
        if not SUPABASE_API_KEY or SUPABASE_API_KEY == "" or SUPABASE_URL == "https://your-supabase-url.supabase.co":
            # En modo local, la licencia es válida si no está vacía
            if not license_key or license_key == "":
                return {"status": "error", "message": "Licencia inválida"}
            
            # Guardar registro del dispositivo en archivo local
            device_reg_file = DATA_DIR / "device_registrations.json"
            registrations = {}
            if device_reg_file.exists():
                try:
                    with device_reg_file.open("r", encoding="utf-8") as fh:
                        registrations = json.load(fh)
                except Exception:
                    registrations = {}
            
            # Verificar si ya existe este email con esta licencia
            existing_key = f"{device_email}:{license_key}"
            if existing_key in registrations:
                registrations[existing_key]["last_seen_at"] = datetime.now(timezone.utc).isoformat()
            else:
                device_info = device_info or {}
                registrations[existing_key] = {
                    "license_key": license_key,
                    "device_email": device_email,
                    "device_hostname": device_info.get("hostname", ""),
                    "device_serial": device_info.get("serial", ""),
                    "device_os": device_info.get("os", ""),
                    "ip_public": device_info.get("ip", ""),
                    "country_code": device_info.get("country", ""),
                    "status": "approved",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "last_seen_at": datetime.now(timezone.utc).isoformat(),
                }
            
            # Guardar archivo
            with device_reg_file.open("w", encoding="utf-8") as fh:
                json.dump(registrations, fh, ensure_ascii=False, indent=2)
            
            return {"status": "success", "device_status": "approved", "message": "Dispositivo aprobado (modo local)"}
        
        # Modo Supabase - Verificar licencia en app_licenses
        result = supabase_request(f"/app_licenses?license_key=eq.{license_key}&select=*")
        if not result or len(result) == 0:
            log_device_access(device_email, license_key, "license_not_found", "Licencia no encontrada")
            return {"status": "error", "message": "Licencia inválida"}

        license_data = result[0]
        status = license_data.get("status", "").lower()
        if status not in ("active", "approved"):
            log_device_access(device_email, license_key, "license_inactive", f"Licencia {license_data.get('status')}")
            return {"status": "error", "message": f"Licencia {license_data.get('status')}"}

        if license_data.get("expires_at") and datetime.fromisoformat(license_data["expires_at"].replace("Z", "+00:00")) < datetime.now(timezone.utc):
            log_device_access(device_email, license_key, "license_expired", "Licencia expirada")
            return {"status": "error", "message": "Licencia expirada"}

        # Verificar si ya existe este email con esta licencia en app_device_registrations
        existing = supabase_request(f"/app_device_registrations?device_email=eq.{device_email}&license_key=eq.{license_key}&select=*")
        device_id = None
        if existing and len(existing) > 0:
            device_id = existing[0]["id"]
            supabase_request(
                f"/app_device_registrations?id=eq.{device_id}",
                method="PATCH",
                data={"last_seen_at": datetime.now(timezone.utc).isoformat()}
            )
            log_device_access(device_email, license_key, "device_seen", f"Dispositivo visto nuevamente")
        else:
            device_info = device_info or {}
            new_device = {
                "license_key": license_key,
                "device_email": device_email,
                "device_hostname": device_info.get("hostname", ""),
                "device_serial": device_info.get("serial", ""),
                "device_os": device_info.get("os", ""),
                "ip_public": device_info.get("ip", ""),
                "country_code": device_info.get("country", ""),
                "status": "approved",
            }
            print(f"Intentando registrar dispositivo: {new_device}")
            result = supabase_request("/app_device_registrations", method="POST", data=new_device)
            print(f"Resultado del registro: {result}")
            if result and isinstance(result, list) and len(result) > 0:
                device_id = result[0]["id"]
                log_device_access(device_email, license_key, "device_registered", "Dispositivo registrado")
            else:
                log_device_access(device_email, license_key, "registration_failed", f"Fallo en registro: {result}")
                return {"status": "error", "message": f"No se pudo registrar el dispositivo: {result}"}

        return {"status": "success", "device_status": "approved", "message": "Dispositivo aprobado"}
    except Exception as exc:
        print(f"Error en validación de licencia: {exc}")
        return {"status": "error", "message": str(exc)}


def log_device_access(device_email, license_key, event_type, message):
    try:
        log_data = {
            "license_key": license_key,
            "device_email": device_email,
            "event_type": event_type,
            "error_message": message if event_type != "device_registered" and event_type != "device_seen" else None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        supabase_request("/app_access_logs", method="POST", data=log_data)
    except Exception as exc:
        print(f"Error logging device access: {exc}")


def account_id_for(serial, clone, line):
    raw = f"{serial}|{clone}|{line}".encode("utf-8", errors="ignore")
    return hashlib.sha1(raw).hexdigest()[:12]


def account_lines(value):
    return [
        line.strip()
        for line in str(value or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
        if line.strip()
    ]


def normalize_account_statuses(serial, person, statuses=None):
    previous = {}
    if isinstance(statuses, list):
        for item in statuses:
            if not isinstance(item, dict):
                continue
            try:
                clone = int(item.get("clone", 0))
            except Exception:
                clone = 0
            line = str(item.get("line", "") or "").strip()
            if clone > 0 and line:
                previous[(clone, line)] = item

    normalized = []
    for index, line in enumerate(account_lines(person)):
        clone = index + 1
        package = spotify_package_for_clone(clone)
        prev = previous.get((clone, line), {})
        status = str(prev.get("status", "pending") or "pending").lower()
        if status not in FLOWLOGIN_ALLOWED_STATUSES:
            status = "pending"
        normalized_item = {
            "accountId": str(prev.get("accountId") or account_id_for(serial, clone, line)),
            "clone": clone,
            "package": package,
            "line": line,
            "status": status,
            "message": str(prev.get("message", "") or ""),
            "attempts": int(prev.get("attempts", 0) or 0),
            "updatedAt": str(prev.get("updatedAt", "") or ""),
        }
        flow_mail = prev.get("flowMail")
        if isinstance(flow_mail, dict):
            normalized_item["flowMail"] = {
                "email": str(flow_mail.get("email", "") or ""),
                "requestedAt": str(flow_mail.get("requestedAt", "") or ""),
                "package": str(flow_mail.get("package", "") or ""),
                "requireRecent": bool(flow_mail.get("requireRecent")),
            }
        normalized.append(normalized_item)
    return normalized


def normalize_device_profiles(data):
    profiles = {}
    if not isinstance(data, dict):
        return profiles
    for serial, value in data.items():
        if isinstance(value, dict):
            person = str(value.get("person", "") or "")
            profiles[str(serial)] = {
                "name": str(value.get("name", "") or ""),
                "person": person,
                "accountStatuses": normalize_account_statuses(str(serial), person, value.get("accountStatuses")),
                "preferredTransport": str(value.get("preferredTransport", "auto") or "auto"),
            }
        elif value:
            profiles[str(serial)] = {
                "name": str(value),
                "person": "",
                "accountStatuses": [],
                "preferredTransport": "auto",
            }
    return profiles


def normalize_mac_address(value):
    text = str(value or "").strip().upper().replace("-", ":")
    match = re.fullmatch(r"([0-9A-F]{2}:){5}[0-9A-F]{2}", text)
    return text if match else ""


def device_key_from_parts(serial, mac_address=""):
    mac = normalize_mac_address(mac_address)
    if mac:
        return f"mac:{mac}"
    serial = str(serial or "").strip()
    return f"serial:{serial}" if serial else ""


def merge_device_profiles(primary, fallback, key):
    primary = primary if isinstance(primary, dict) else {}
    fallback = fallback if isinstance(fallback, dict) else {}
    name = str(primary.get("name", "") or "") or str(fallback.get("name", "") or "")
    person = str(primary.get("person", "") or "") or str(fallback.get("person", "") or "")
    statuses = primary.get("accountStatuses") or fallback.get("accountStatuses") or []
    preferred = str(primary.get("preferredTransport", "") or "") or str(fallback.get("preferredTransport", "") or "auto")
    return {
        "name": name,
        "person": person,
        "accountStatuses": normalize_account_statuses(key, person, statuses),
        "preferredTransport": preferred,
    }


def migrate_device_profile_key(names, legacy_key, stable_key):
    legacy_key = str(legacy_key or "").strip()
    stable_key = str(stable_key or "").strip()
    if not legacy_key or not stable_key or legacy_key == stable_key or legacy_key not in names:
        return names, False
    names[stable_key] = merge_device_profiles(names.get(stable_key, {}), names.get(legacy_key, {}), stable_key)
    names.pop(legacy_key, None)
    return names, True


def resolve_device_profile_key(device_id):
    raw = str(device_id or "").strip()
    if not raw:
        return ""
    if raw.startswith(("mac:", "serial:")):
        return raw
    try:
        mac = get_device_mac_address(raw)
    except Exception:
        mac = ""
    return device_key_from_parts(raw, mac) or raw


def limit_lines(value, max_lines=10):
    lines = str(value or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    return "\n".join(lines[:max_lines]).strip()


def atomic_write_json(path, data, *, sort_keys=False):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f"{path.name}.{os.getpid()}.{int(time.time() * 1000)}.tmp")
    backup = path.with_name(f"{path.name}.bak")
    with temp.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False, sort_keys=sort_keys)
        fh.write("\n")
        fh.flush()
        os.fsync(fh.fileno())
    if path.exists():
        shutil.copy2(path, backup)
    os.replace(temp, path)


def load_device_inventory():
    if not DEVICE_INVENTORY_FILE.exists():
        return {}
    try:
        with DEVICE_INVENTORY_FILE.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception as e:
        print(f"Error reading inventory: {e}")
        return {}

def save_device_inventory(inv):
    try:
        atomic_write_json(DEVICE_INVENTORY_FILE, inv)
    except Exception as e:
        print(f"Error saving inventory: {e}")

def update_device_inventory(physical_id, new_data):
    with INVENTORY_LOCK:
        inv = load_device_inventory()
        if physical_id not in inv:
            inv[physical_id] = {
                "physicalDeviceId": physical_id,
                "name": "",
                "manufacturer": "",
                "model": "",
                "androidId": "",
                "lastUsbSerial": "",
                "lastWifiSerial": "",
                "lastIp": "",
                "knownIps": [],
                "preferredTransport": "auto",
                "lastGoodTransport": "",
                "status": "offline",
                "firstSeenAt": datetime.now(timezone.utc).isoformat(),
                "lastSeenAt": datetime.now(timezone.utc).isoformat()
            }
        
        entry = inv[physical_id]
        for k, v in new_data.items():
            if k == "knownIps":
                for ip in v:
                    if ip not in entry["knownIps"]:
                        entry["knownIps"].append(ip)
            else:
                entry[k] = v
        entry["lastSeenAt"] = datetime.now(timezone.utc).isoformat()
        save_device_inventory(inv)
        return entry

def load_device_names():
    if not DEVICE_NAMES_FILE.exists():
        return {}
    try:
        with DEVICE_NAMES_FILE.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        return normalize_device_profiles(data)
    except Exception:
        return {}


def save_device_names(names):
    atomic_write_json(DEVICE_NAMES_FILE, names, sort_keys=True)


def normalize_device_groups(data):
    if not isinstance(data, dict):
        return {"groups": [], "assignments": {}, "order": []}
    groups = []
    seen = set()
    for item in data.get("groups", []):
        if not isinstance(item, dict):
            continue
        group_id = str(item.get("id", "") or "").strip()
        name = str(item.get("name", "") or "").strip()
        if not group_id or not name or group_id in seen:
            continue
        seen.add(group_id)
        groups.append({"id": group_id[:80], "name": name[:80]})
    valid_ids = {item["id"] for item in groups}
    assignments = {}
    raw_assignments = data.get("assignments", {})
    if isinstance(raw_assignments, dict):
        for serial, group_id in raw_assignments.items():
            serial = str(serial or "").strip()
            group_id = str(group_id or "").strip()
            if serial and group_id in valid_ids:
                assignments[serial] = group_id
    # Orden manual: lista de deviceIds en el orden que el usuario eligio.
    # No filtramos por dispositivos conectados, asi mantenemos el orden cuando
    # un dispositivo se desconecta y reconecta.
    order = []
    seen_order = set()
    raw_order = data.get("order", [])
    if isinstance(raw_order, list):
        for entry in raw_order:
            entry = str(entry or "").strip()
            if entry and entry not in seen_order:
                seen_order.add(entry)
                order.append(entry)
    return {"groups": groups, "assignments": assignments, "order": order}


def load_device_groups():
    if not DEVICE_GROUPS_FILE.exists():
        return {"groups": [], "assignments": {}, "order": []}
    try:
        with DEVICE_GROUPS_FILE.open("r", encoding="utf-8") as fh:
            return normalize_device_groups(json.load(fh))
    except Exception:
        return {"groups": [], "assignments": {}}


def save_device_groups(data):
    normalized = normalize_device_groups(data)
    atomic_write_json(DEVICE_GROUPS_FILE, normalized, sort_keys=True)
    return normalized


def migrate_device_group_key(legacy_key, stable_key):
    legacy_key = str(legacy_key or "").strip()
    stable_key = str(stable_key or "").strip()
    if not legacy_key or not stable_key or legacy_key == stable_key:
        return
    groups = load_device_groups()
    assignments = groups.get("assignments", {})
    if legacy_key not in assignments:
        return
    assignments.setdefault(stable_key, assignments.get(legacy_key))
    assignments.pop(legacy_key, None)
    save_device_groups(groups)


def set_device_name(serial, name):
    serial = str(serial or "").strip()
    name = str(name or "").strip()
    if not serial:
        raise RuntimeError("Falta el serial del dispositivo.")

    key = resolve_device_profile_key(serial)
    names = load_device_names()
    names, _ = migrate_device_profile_key(names, serial, key)
    profile = names.get(key, {"name": "", "person": "", "accountStatuses": [], "preferredTransport": "auto"})
    if name:
        profile["name"] = name[:80]
        names[key] = profile
    else:
        profile["name"] = ""
        if profile.get("person") or profile.get("accountStatuses") or profile.get("preferredTransport", "auto") not in ("auto", ""):
            names[key] = profile
        else:
            names.pop(key, None)
    save_device_names(names)
    return names


def set_device_person(serial, person):
    serial = str(serial or "").strip()
    person = limit_lines(person, 10)
    if not serial:
        raise RuntimeError("Falta el serial del dispositivo.")

    key = resolve_device_profile_key(serial)
    names = load_device_names()
    names, _ = migrate_device_profile_key(names, serial, key)
    profile = names.get(key, {"name": "", "person": "", "accountStatuses": [], "preferredTransport": "auto"})
    previous_statuses = profile.get("accountStatuses", [])
    if person:
        profile["person"] = person[:1200]
        profile["accountStatuses"] = normalize_account_statuses(key, profile["person"], previous_statuses)
        names[key] = profile
    else:
        profile["person"] = ""
        profile["accountStatuses"] = []
        if profile.get("name") or profile.get("preferredTransport", "auto") not in ("auto", ""):
            names[key] = profile
        else:
            names.pop(key, None)
    save_device_names(names)
    return names


def update_device_account_statuses(serial, status_payload):
    serial = str(serial or "").strip()
    if not serial:
        raise RuntimeError("Falta el serial del dispositivo.")

    key = resolve_device_profile_key(serial)
    names = load_device_names()
    names, _ = migrate_device_profile_key(names, serial, key)
    profile = names.get(key, {"name": "", "person": "", "accountStatuses": [], "preferredTransport": "auto"})
    current = normalize_account_statuses(key, profile.get("person", ""), profile.get("accountStatuses", []))
    by_clone = {int(item.get("clone", 0)): item for item in current}

    items = status_payload.get("items", []) if isinstance(status_payload, dict) else []
    if isinstance(items, list):
        for incoming in items:
            if not isinstance(incoming, dict):
                continue
            try:
                clone = int(incoming.get("clone", 0))
            except Exception:
                clone = 0
            if clone not in by_clone:
                continue
            target = by_clone[clone]
            incoming_line = str(incoming.get("line", "") or "").strip()
            if incoming_line and incoming_line != target.get("line"):
                continue
            status = str(incoming.get("status", target.get("status", "pending")) or "pending").lower()
            if status not in FLOWLOGIN_ALLOWED_STATUSES:
                status = target.get("status", "pending")
            target["status"] = status
            target["message"] = str(incoming.get("message", "") or "")
            target["attempts"] = int(incoming.get("attempts", target.get("attempts", 0)) or 0)
            target["updatedAt"] = str(incoming.get("updatedAt", "") or "")
            flow_mail = incoming.get("flowMail")
            if isinstance(flow_mail, dict):
                target["flowMail"] = {
                    "email": str(flow_mail.get("email", "") or ""),
                    "requestedAt": str(flow_mail.get("requestedAt", "") or ""),
                    "package": str(flow_mail.get("package", "") or ""),
                    "requireRecent": bool(flow_mail.get("requireRecent")),
                }
            elif status != "waiting_mail":
                target.pop("flowMail", None)

    profile["accountStatuses"] = current
    if profile.get("name") or profile.get("person") or profile.get("accountStatuses") or profile.get("preferredTransport", "auto") not in ("auto", ""):
        names[key] = profile
    else:
        names.pop(key, None)
    save_device_names(names)
    return names


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def set_device_account_status(serial, clone, status, message="", attempts=0, line=None):
    serial = str(serial or "").strip()
    try:
        clone = int(clone)
    except Exception:
        clone = 0
    if not serial or clone <= 0:
        return
    key = resolve_device_profile_key(serial)

    status = str(status or "pending").lower()
    if status not in FLOWLOGIN_ALLOWED_STATUSES:
        status = "review"

    with DEVICE_NAMES_LOCK:
        names = load_device_names()
        names, _ = migrate_device_profile_key(names, serial, key)
        profile = names.get(key, {"name": "", "person": "", "accountStatuses": []})
        current = normalize_account_statuses(key, profile.get("person", ""), profile.get("accountStatuses", []))
        for item in current:
            try:
                item_clone = int(item.get("clone", 0))
            except Exception:
                item_clone = 0
            if item_clone != clone:
                continue
            if line and str(item.get("line", "") or "").strip() != str(line).strip():
                continue
            item["status"] = status
            item["message"] = str(message or "")
            item["attempts"] = int(attempts or item.get("attempts", 0) or 0)
            item["updatedAt"] = now_iso()
            break

        profile["accountStatuses"] = current
        if profile.get("name") or profile.get("person") or current:
            names[key] = profile
        else:
            names.pop(key, None)
        save_device_names(names)


def parse_account_line(line, delimiter=":"):
    line = str(line or "").strip()
    if not line:
        return None
    delimiters = [str(delimiter or ""), ":", "----"]
    seen = set()
    for separator in delimiters:
        if not separator or separator in seen:
            continue
        seen.add(separator)
        index = line.find(separator)
        if index < 0:
            continue
        user = line[:index].strip()
        password = line[index + len(separator):].strip()
        if len(user) >= 2 and password:
            return {"user": user, "pass": password}
    return None


def run_process(args, timeout=120):
    if not ADB or not Path(ADB).exists():
        raise RuntimeError("No se encontro adb. Agrega adb al PATH o instala Android platform-tools.")

    env, adb_parent = get_adb_environment()

    popen_options = {}
    if os.name == "nt":
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        popen_options["startupinfo"] = startupinfo
        popen_options["creationflags"] = subprocess.CREATE_NO_WINDOW

    completed = subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=timeout,
        encoding="utf-8",
        errors="replace",
        env=env,
        cwd=adb_parent or None,
        **popen_options,
    )
    output = (completed.stdout or "").strip()
    error = (completed.stderr or "").strip()
    if completed.returncode != 0:
        raise RuntimeError(error or output or f"Comando fallo con codigo {completed.returncode}.")
    return output


def adb(args, timeout=120):
    return run_process([ADB, *args], timeout=timeout)


def get_adb_environment():
    adb_parent = str(Path(ADB).resolve().parent) if ADB else ""
    env = os.environ.copy()
    if adb_parent:
        env["PATH"] = adb_parent + os.pathsep + env.get("PATH", "")
    if ANDROID_HOME_DIR:
        env["ANDROID_USER_HOME"] = str(ANDROID_HOME_DIR)
        env["ANDROID_SDK_HOME"] = str(ANDROID_HOME_DIR)
        env["ADB_VENDOR_KEYS"] = str(ANDROID_HOME_DIR)
    return env, adb_parent


def run_adb_probe(args, timeout=20):
    if not ADB or not Path(ADB).exists():
        return {"ok": False, "stdout": "", "stderr": "ADB no existe", "returncode": -1}
    env, adb_parent = get_adb_environment()
    popen_options = {}
    if os.name == "nt":
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        popen_options["startupinfo"] = startupinfo
        popen_options["creationflags"] = subprocess.CREATE_NO_WINDOW
    try:
        completed = subprocess.run(
            [ADB, *args],
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding="utf-8",
            errors="replace",
            env=env,
            cwd=adb_parent or None,
            **popen_options,
        )
        return {
            "ok": completed.returncode == 0,
            "stdout": (completed.stdout or "").strip(),
            "stderr": (completed.stderr or "").strip(),
            "returncode": completed.returncode,
        }
    except Exception as exc:
        return {"ok": False, "stdout": "", "stderr": str(exc), "returncode": -1}


def parse_adb_devices_output(output):
    rows = []
    for line in str(output or "").splitlines()[1:]:
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        rows.append({"serial": parts[0], "status": parts[1], "raw": line})
    return rows


def get_adb_diagnostics():
    version = run_adb_probe(["version"], timeout=10)
    start_server = run_adb_probe(["start-server"], timeout=15)
    devices = run_adb_probe(["devices", "-l"], timeout=20)
    return {
        "adb": ADB,
        "adbExists": bool(ADB and Path(ADB).exists()),
        "adbDir": str(Path(ADB).resolve().parent) if ADB else "",
        "version": version,
        "startServer": start_server,
        "devices": devices,
        "parsedDevices": parse_adb_devices_output(devices.get("stdout", "")),
        "lastDevicesOutput": LAST_ADB_DEVICES_OUTPUT,
    }


def adb_shell(serial, command, timeout=30):
    return adb(["-s", serial, "shell", command], timeout=timeout)


def adb_tap(serial, x, y):
    adb_shell(serial, f"input tap {int(x)} {int(y)}", timeout=20)


def adb_keyevent(serial, keycode):
    adb_shell(serial, f"input keyevent {keycode}", timeout=20)


def control_adb_tap(body):
    start_time = time.time()
    serial, err = _validate_serial(body)
    if err:
        return err
    x, y = body.get("x"), body.get("y")
    if x is None or y is None:
        return {"error": "Los campos x e y son requeridos"}, 400
    fallback_reason = ""
    fallback_used = False
    
    force_adb, force_reason = should_force_adb(serial, body.get("preferScrcpy", True))
    if force_adb:
        body["preferScrcpy"] = False

    if body.get("preferScrcpy", True) and SCRCPY_CONTROL_MANAGER is not None:
        try:
            SCRCPY_CONTROL_MANAGER.tap(
                serial,
                int(x),
                int(y),
                width=body.get("screenWidth") or body.get("width"),
                height=body.get("screenHeight") or body.get("height"),
            )
            latency_ms = int((time.time() - start_time) * 1000)
            return {
                "ok": True,
                "profile": "control",
                "method": "scrcpy_control",
                "fallbackUsed": False,
                "serial": serial,
                "latencyMs": latency_ms
            }, 200
        except Exception as exc:
            fallback_reason = str(exc)
            fallback_used = True

    try:
        if not body.get("preferScrcpy", True):
            fallback_used = True
        adb_tap(serial, int(x), int(y))
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "ok": True,
            "profile": "control",
            "method": "adb_input",
            "fallbackUsed": fallback_used,
            "routingReason": force_reason if force_adb else "scrcpy_exception",
            "serial": serial,
            "latencyMs": latency_ms,
            "error": fallback_reason if fallback_reason else None
        }, 200
    except Exception as exc:
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "ok": False,
            "profile": "control",
            "method": "adb_input",
            "fallbackUsed": fallback_used,
            "routingReason": force_reason if force_adb else "scrcpy_exception",
            "serial": serial,
            "latencyMs": latency_ms,
            "error": str(exc)
        }, 500

def control_adb_touch(body):
    start_time = time.time()
    serial, err = _validate_serial(body)
    if err:
        return err

    required = ("action", "x", "y")
    if any(body.get(key) is None for key in required):
        return {"error": "action, x, y son requeridos"}, 400

    force_adb, force_reason = should_force_adb(serial, body.get("preferScrcpy", True))
    if force_adb or not body.get("preferScrcpy", True):
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "ok": False,
            "liveTouch": False,
            "reason": force_reason if force_adb else "serial_adb_only",
            "serial": serial,
            "latencyMs": latency_ms
        }, 400

    if SCRCPY_CONTROL_MANAGER is not None:
        try:
            SCRCPY_CONTROL_MANAGER.touch(
                serial,
                int(body.get("action")),
                int(body.get("x")),
                int(body.get("y")),
                width=body.get("screenWidth") or body.get("width"),
                height=body.get("screenHeight") or body.get("height"),
            )
            latency_ms = int((time.time() - start_time) * 1000)
            return {
                "ok": True,
                "profile": "control",
                "method": "scrcpy_control",
                "liveTouch": True,
                "action": int(body.get("action")),
                "fallbackUsed": False,
                "serial": serial,
                "latencyMs": latency_ms
            }, 200
        except Exception as exc:
            latency_ms = int((time.time() - start_time) * 1000)
            return {
                "ok": False,
                "liveTouch": False,
                "reason": "scrcpy_exception",
                "error": str(exc),
                "serial": serial,
                "latencyMs": latency_ms
            }, 500

    return {"error": "scrcpy control no habilitado", "ok": False}, 500

def control_adb_swipe(body):
    start_time = time.time()
    serial, err = _validate_serial(body)
    if err:
        return err
    required = ("startX", "startY", "endX", "endY")
    if any(body.get(key) is None for key in required):
        return {"error": "startX, startY, endX y endY son requeridos"}, 400
    duration = max(120, min(int(body.get("duration", 350) or 350), 1800))
    fallback_reason = ""
    fallback_used = False

    force_adb, force_reason = should_force_adb(serial, body.get("preferScrcpy", True))
    if force_adb:
        body["preferScrcpy"] = False

    if body.get("preferScrcpy", True) and SCRCPY_CONTROL_MANAGER is not None:
        try:
            SCRCPY_CONTROL_MANAGER.swipe(
                serial,
                int(body.get("startX")),
                int(body.get("startY")),
                int(body.get("endX")),
                int(body.get("endY")),
                duration_ms=duration,
                width=body.get("screenWidth") or body.get("width"),
                height=body.get("screenHeight") or body.get("height"),
            )
            latency_ms = int((time.time() - start_time) * 1000)
            return {
                "ok": True,
                "profile": "control",
                "method": "scrcpy_control",
                "fallbackUsed": False,
                "serial": serial,
                "latencyMs": latency_ms
            }, 200
        except Exception as exc:
            fallback_reason = str(exc)
            fallback_used = True

    try:
        if not body.get("preferScrcpy", True):
            fallback_used = True
        adb_shell(
            serial,
            f"input swipe {int(body.get('startX'))} {int(body.get('startY'))} "
            f"{int(body.get('endX'))} {int(body.get('endY'))} {duration}",
            timeout=max(10, int(duration / 1000) + 8),
        )
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "ok": True,
            "profile": "control",
            "method": "adb_input",
            "fallbackUsed": fallback_used,
            "routingReason": force_reason if force_adb else "scrcpy_exception",
            "serial": serial,
            "latencyMs": latency_ms,
            "error": fallback_reason if fallback_reason else None
        }, 200
    except Exception as exc:
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "ok": False,
            "profile": "control",
            "method": "adb_input",
            "fallbackUsed": fallback_used,
            "routingReason": force_reason if force_adb else "scrcpy_exception",
            "serial": serial,
            "latencyMs": latency_ms,
            "error": str(exc)
        }, 500



def control_adb_keyevent(body):
    start_time = time.time()
    serial, err = _validate_serial(body)
    if err:
        return err
    name = str(body.get("name", "") or "").strip().lower()
    keycodes = {
        "back": "KEYCODE_BACK",
        "home": "KEYCODE_HOME",
        "recents": "KEYCODE_APP_SWITCH",
        "enter": "KEYCODE_ENTER",
        "backspace": "KEYCODE_DEL",
        "tab": "KEYCODE_TAB",
        "arrowup": "KEYCODE_DPAD_UP",
        "arrowdown": "KEYCODE_DPAD_DOWN",
        "arrowleft": "KEYCODE_DPAD_LEFT",
        "arrowright": "KEYCODE_DPAD_RIGHT",
    }
    keycode = keycodes.get(name)
    if not keycode:
        return {"error": "name debe ser back, home, recents, enter, backspace, tab o flechas"}, 400

    fallback_reason = ""
    fallback_used = False

    force_adb, force_reason = should_force_adb(serial, body.get("preferScrcpy", True))
    if force_adb:
        body["preferScrcpy"] = False

    if body.get("preferScrcpy", True) and SCRCPY_CONTROL_MANAGER is not None:
        try:
            SCRCPY_CONTROL_MANAGER.keyevent(serial, name)
            latency_ms = int((time.time() - start_time) * 1000)
            return {
                "ok": True,
                "profile": "control",
                "method": "scrcpy_control",
                "fallbackUsed": False,
                "serial": serial,
                "latencyMs": latency_ms
            }, 200
        except Exception as exc:
            fallback_reason = str(exc)
            fallback_used = True

    try:
        if not body.get("preferScrcpy", True):
            fallback_used = True
        adb_keyevent(serial, keycode)
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "ok": True,
            "profile": "control",
            "method": "adb_input",
            "fallbackUsed": fallback_used,
            "routingReason": force_reason if force_adb else "scrcpy_exception",
            "serial": serial,
            "latencyMs": latency_ms,
            "error": fallback_reason if fallback_reason else None
        }, 200
    except Exception as exc:
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "ok": False,
            "profile": "control",
            "method": "adb_input",
            "fallbackUsed": fallback_used,
            "routingReason": force_reason if force_adb else "scrcpy_exception",
            "serial": serial,
            "latencyMs": latency_ms,
            "error": str(exc)
        }, 500


def control_type_text(body):
    start_time = time.time()
    serial, err = _validate_serial(body)
    if err:
        return err
    text = str(body.get("text", "") or "")
    if not text:
        return {"error": "text requerido"}, 400
    if len(text) > 300:
        return {"error": "text excede 300 caracteres"}, 400
    fallback_reason = ""
    fallback_used = False

    force_adb, force_reason = should_force_adb(serial, body.get("preferScrcpy", True))
    if force_adb:
        body["preferScrcpy"] = False

    if body.get("preferScrcpy", True) and SCRCPY_CONTROL_MANAGER is not None:
        try:
            SCRCPY_CONTROL_MANAGER.type_text(serial, text)
            latency_ms = int((time.time() - start_time) * 1000)
            return {
                "ok": True,
                "profile": "control",
                "method": "scrcpy_control",
                "fallbackUsed": False,
                "serial": serial,
                "chars": len(text),
                "latencyMs": latency_ms
            }, 200
        except Exception as exc:
            fallback_reason = str(exc)
            fallback_used = True

    try:
        if not body.get("preferScrcpy", True):
            fallback_used = True
        adb_input_text(serial, text)
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "ok": True,
            "profile": "control",
            "method": "adb_input",
            "fallbackUsed": fallback_used,
            "routingReason": force_reason if force_adb else "scrcpy_exception",
            "serial": serial,
            "chars": len(text),
            "latencyMs": latency_ms,
            "error": fallback_reason if fallback_reason else None
        }, 200
    except Exception as exc:
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "ok": False,
            "profile": "control",
            "method": "adb_input",
            "fallbackUsed": fallback_used,
            "routingReason": force_reason if force_adb else "scrcpy_exception",
            "serial": serial,
            "chars": len(text),
            "latencyMs": latency_ms,
            "error": str(exc)
        }, 500


def control_paste_text(body):
    start_time = time.time()
    serial, err = _validate_serial(body)
    if err:
        return err
    text = str(body.get("text", "") or "")
    if not text:
        return {"error": "text requerido"}, 400
    if len(text) > 4096:
        return {"error": "text excede 4096 caracteres"}, 400
    if SCRCPY_CONTROL_MANAGER is None:
        return {"ok": False, "profile": "control", "error": "scrcpy control no habilitado"}, 500
    try:
        SCRCPY_CONTROL_MANAGER.paste_text(serial, text, paste=bool(body.get("paste", True)))
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "ok": True,
            "profile": "control",
            "method": "scrcpy_control",
            "fallbackUsed": False,
            "serial": serial,
            "chars": len(text),
            "latencyMs": latency_ms
        }, 200
    except Exception as exc:
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "ok": False,
            "profile": "control",
            "method": "scrcpy_control",
            "fallbackUsed": False,
            "serial": serial,
            "chars": len(text),
            "latencyMs": latency_ms,
            "error": str(exc)
        }, 500


def lock_device_portrait(serial):
    for command in [
        "settings put system accelerometer_rotation 0",
        "settings put system user_rotation 0",
        "settings put secure show_rotation_suggestions 0",
        "cmd window set-user-rotation lock 0",
    ]:
        try:
            adb_shell(serial, command, timeout=20)
        except Exception:
            pass


def adb_input_text(serial, text):
    value = str(text or "").replace("%", "%25").replace(" ", "%s")
    adb_shell(serial, "input text " + shlex.quote(value), timeout=30)


def adb_clear_text(serial, max_chars=80):
    keys = " ".join(["KEYCODE_DEL"] * int(max_chars))
    adb_shell(serial, f"input keyevent KEYCODE_MOVE_END {keys}", timeout=35)


def node_bounds(node):
    match = NODE_BOUNDS_RE.match(node.attrib.get("bounds", ""))
    if not match:
        return None
    left, top, right, bottom = [int(value) for value in match.groups()]
    return {
        "left": left,
        "top": top,
        "right": right,
        "bottom": bottom,
        "centerX": (left + right) // 2,
        "centerY": (top + bottom) // 2,
        "width": max(0, right - left),
        "height": max(0, bottom - top),
    }


def iter_ui_nodes(root):
    yield root
    for child in list(root):
        yield from iter_ui_nodes(child)


def node_label(node):
    return " ".join(
        value
        for value in [
            node.attrib.get("text", ""),
            node.attrib.get("content-desc", ""),
        ]
        if value
    )


def dump_ui(serial, timeout=10):
    deadline = time.time() + timeout
    last_error = None
    while time.time() < deadline:
        try:
            adb(["-s", serial, "shell", "uiautomator", "dump", UI_DUMP_REMOTE], timeout=20)
            raw = adb(["-s", serial, "shell", "cat", UI_DUMP_REMOTE], timeout=20)
            return ET.fromstring(raw)
        except Exception as exc:
            last_error = exc
            time.sleep(0.8)
    raise RuntimeError(f"No se pudo leer la pantalla del dispositivo: {last_error}")


def find_ui_node(serial, matcher, timeout=5):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            root = dump_ui(serial, timeout=3)
            for node in iter_ui_nodes(root):
                if matcher(node):
                    return node
        except Exception:
            pass
        time.sleep(0.6)
    return None


def find_ui_nodes(serial, matcher):
    root = dump_ui(serial, timeout=5)
    return [node for node in iter_ui_nodes(root) if matcher(node)]


def click_ui_node(serial, node):
    bounds = node_bounds(node)
    if not bounds or bounds["width"] <= 0 or bounds["height"] <= 0:
        return False
    adb_tap(serial, bounds["centerX"], bounds["centerY"])
    return True


def click_text_if_present(serial, pattern, timeout=3, contains=False):
    regex = re.compile(pattern, re.I)

    def matcher(node):
        label = node_label(node)
        if contains:
            return bool(regex.search(label))
        return bool(regex.fullmatch(label.strip()))

    node = find_ui_node(serial, matcher, timeout=timeout)
    if node is not None:
        click_ui_node(serial, node)
        return True
    return False


def accept_media_projection_dialog(serial, timeout=8):
    # Solo acepta botones explicitos del dialogo de captura; no marca casillas ni
    # navega por ajustes del sistema.
    pattern = (
        r"^(Start now|Iniciar ahora|Comenzar ahora|Empezar ahora|"
        r"Allow|Permitir|Aceptar|OK|Start|Iniciar)$"
    )
    return click_text_if_present(serial, pattern, timeout=timeout, contains=False)


def activate_text_by_keyboard(serial, pattern, contains=False, max_tabs=12):
    regex = re.compile(pattern, re.I)
    for _ in range(max_tabs):
        try:
            root = dump_ui(serial, timeout=3)
            for node in iter_ui_nodes(root):
                if node.attrib.get("focused") != "true":
                    continue
                label = node_label(node).strip()
                matched = bool(regex.search(label)) if contains else bool(regex.fullmatch(label))
                if matched:
                    adb_keyevent(serial, "KEYCODE_ENTER")
                    time.sleep(0.8)
                    return True
        except Exception:
            pass
        adb_keyevent(serial, "KEYCODE_TAB")
        time.sleep(0.45)
    return False


def get_sorted_edit_texts(serial):
    nodes = find_ui_nodes(
        serial,
        lambda node: node.attrib.get("class", "") == "android.widget.EditText"
    )
    nodes.sort(key=lambda node: node_bounds(node)["top"] if node_bounds(node) else 99999)
    return nodes


def wait_for_edit_texts(serial, min_count=1, timeout=8):
    deadline = time.time() + timeout
    last_nodes = []
    while time.time() < deadline:
        try:
            last_nodes = get_sorted_edit_texts(serial)
            if len(last_nodes) >= min_count:
                return last_nodes
        except Exception:
            pass
        time.sleep(0.7)
    return last_nodes


def current_package(serial):
    try:
        raw = adb(["-s", serial, "shell", "dumpsys", "window", "windows"], timeout=20)
    except Exception:
        raw = adb(["-s", serial, "shell", "dumpsys", "window"], timeout=20)
    match = re.search(r"mCurrentFocus=.*?\s([A-Za-z0-9_.]+)/", raw)
    return match.group(1) if match else ""


def ui_has_marker(serial, pattern, timeout=3):
    regex = re.compile(pattern, re.I)
    return find_ui_node(serial, lambda node: bool(regex.search(node_label(node))), timeout=timeout) is not None


def ui_error_marker(serial, timeout=3):
    regex = re.compile(
        r"(incorrect|wrong|try again|not match|something went wrong|couldn.t log|can't log|captcha|verify|verification|too many|error)",
        re.I,
    )
    node = find_ui_node(serial, lambda item: bool(regex.search(node_label(item))), timeout=timeout)
    return node_label(node) if node is not None else ""


def has_logged_in_markers(serial, timeout=3):
    return ui_has_marker(serial, r"^(Home|Search|Your Library|Library|Inicio|Buscar|Tu biblioteca|Biblioteca)$", timeout=timeout)


def confirm_logged_in(serial):
    if not has_logged_in_markers(serial, timeout=3):
        return False
    time.sleep(2.5)
    return has_logged_in_markers(serial, timeout=3)


def has_login_markers(serial, timeout=3):
    if ui_has_marker(serial, r"(Log in|Log In|Continue with email|Welcome back|Log in with a password)", timeout=timeout):
        return True
    try:
        return bool(get_sorted_edit_texts(serial))
    except Exception:
        return False


def recover_package(serial, package_name, clear_data=False):
    lock_device_portrait(serial)
    try:
        adb_shell(serial, "am force-stop " + shlex.quote(package_name), timeout=20)
    except Exception:
        pass
    if clear_data:
        try:
            adb_shell(serial, "pm clear " + shlex.quote(package_name), timeout=30)
        except Exception:
            pass
    time.sleep(1.4)


def launch_package_and_wait(serial, package_name, wait_seconds=12):
    lock_device_portrait(serial)
    try:
        adb([
            "-s", serial, "shell", "monkey",
            "-p", package_name,
            "-c", "android.intent.category.LAUNCHER",
            "1",
        ], timeout=30)
    except Exception:
        return False
    lock_device_portrait(serial)

    deadline = time.time() + wait_seconds
    while time.time() < deadline:
        if current_package(serial) == package_name:
            return True
        if has_login_markers(serial, timeout=1) or has_logged_in_markers(serial, timeout=1):
            return True
        time.sleep(1)
    return False


def set_text_in_node(serial, node, text):
    click_ui_node(serial, node)
    time.sleep(0.5)
    try:
        adb_clear_text(serial)
    except Exception:
        pass
    adb_input_text(serial, text)
    time.sleep(1.4)


def set_password_after_email(serial, password):
    adb_keyevent(serial, "KEYCODE_TAB")
    time.sleep(0.6)
    try:
        adb_clear_text(serial)
    except Exception:
        pass
    adb_input_text(serial, password)
    time.sleep(1.4)
    fields = get_sorted_edit_texts(serial)
    for field in fields:
        if field.attrib.get("focused") == "true":
            return field
    return fields[-1] if fields else None


def click_continue(serial):
    if not click_text_if_present(serial, r"^(Continue|Next)$", timeout=3):
        adb_keyevent(serial, "KEYCODE_ENTER")
    time.sleep(4)


def click_submit(serial, pass_field=None):
    if activate_text_by_keyboard(serial, r"^(Log in|Log In|Login)$", max_tabs=5):
        time.sleep(3)
        return True

    pass_bottom = 0
    if pass_field is not None:
        bounds = node_bounds(pass_field)
        pass_bottom = bounds["bottom"] if bounds else 0
    try:
        nodes = find_ui_nodes(serial, lambda node: bool(re.fullmatch(r"(Log in|Log In|Login)", node_label(node).strip(), re.I)))
        for node in nodes:
            bounds = node_bounds(node)
            if bounds and (not pass_bottom or bounds["top"] > pass_bottom):
                click_ui_node(serial, node)
                time.sleep(3)
                return True
    except Exception:
        pass

    if pass_field is not None:
        bounds = node_bounds(pass_field)
        if bounds:
            adb_tap(serial, bounds["centerX"], bounds["bottom"] + 150)
            time.sleep(3)
            return True
    adb_keyevent(serial, "KEYCODE_ENTER")
    time.sleep(3)
    return True


def confirm_flowlogin_outcome(serial, package_name, wait_seconds=24):
    deadline = time.time() + wait_seconds
    checks = 0
    while time.time() < deadline:
        if confirm_logged_in(serial):
            return {"status": "success", "message": "Login confirmado", "retry": False}
        error = ui_error_marker(serial, timeout=1.5)
        if error:
            time.sleep(3)
            if confirm_logged_in(serial):
                return {"status": "success", "message": "Login confirmado despues de cargar inicio", "retry": False}
            return {"status": "error", "message": f"Error visible: {error[:80]}", "retry": False}
        checks += 1
        if current_package(serial) != package_name and checks > 3:
            return {"status": "review", "message": "El clon salio de pantalla", "retry": True}
        time.sleep(2.5)
    return {"status": "review", "message": "Sin confirmacion segura", "retry": True}


def perform_flowlogin_adb(serial, item, account):
    package_name = str(item.get("package", "") or "").strip()
    clone = int(item.get("clone", 0) or 0)
    if not package_name:
        return {"status": "error", "message": "Paquete del clon no definido", "retry": False}

    if not launch_package_and_wait(serial, package_name):
        return {"status": "review", "message": "El clon no abrio o no respondio", "retry": True}

    if confirm_logged_in(serial):
        return {"status": "already", "message": "Sesion ya iniciada", "retry": False}

    preloaded_inputs = []
    if click_text_if_present(serial, r"^(Log in|Log In)$", timeout=3):
        time.sleep(2.5)
        preloaded_inputs = wait_for_edit_texts(serial, min_count=1, timeout=3)
    if not preloaded_inputs and activate_text_by_keyboard(serial, r"^(Log in|Log In)$", max_tabs=8):
        time.sleep(2.5)
        preloaded_inputs = wait_for_edit_texts(serial, min_count=1, timeout=4)
    if confirm_logged_in(serial):
        return {"status": "already", "message": "Sesion ya iniciada", "retry": False}

    if click_text_if_present(serial, r"Continue with email", timeout=3, contains=True):
        time.sleep(7)
    elif activate_text_by_keyboard(serial, r"Continue with email", contains=True, max_tabs=8):
        time.sleep(7)

    inputs = preloaded_inputs if len(preloaded_inputs) >= 2 else wait_for_edit_texts(serial, min_count=2, timeout=10)
    if len(inputs) >= 2:
        set_text_in_node(serial, inputs[0], account["user"])
        pass_field = set_password_after_email(serial, account["pass"])
        click_submit(serial, pass_field)
        return confirm_flowlogin_outcome(serial, package_name)

    inputs = inputs or wait_for_edit_texts(serial, min_count=1, timeout=4)
    if inputs:
        set_text_in_node(serial, inputs[0], account["user"])
        click_continue(serial)

    if click_text_if_present(serial, r"Log in with a password", timeout=3, contains=True):
        time.sleep(3.5)

    password_inputs = wait_for_edit_texts(serial, min_count=1, timeout=8)
    if password_inputs:
        pass_field = password_inputs[-1]
        set_text_in_node(serial, pass_field, account["pass"])
        click_submit(serial, pass_field)
        return confirm_flowlogin_outcome(serial, package_name)

    error = ui_error_marker(serial, timeout=2)
    if error:
        return {"status": "error", "message": "Error visible antes de escribir", "retry": False}
    return {"status": "review", "message": f"C{clone}: no encontro campos de login", "retry": True}


def list_devices_fast(serials):
    """Construye la lista de dispositivos desde seriales conocidos SIN llamar adb devices.
    Usa el cache de nombres/perfiles existente. Util para el populate inicial."""
    saved_names = load_device_names()
    devices = []
    for serial in serials:
        serial = str(serial).strip()
        if not serial:
            continue
        # Usar MAC del cache si existe, sino usar serial como key
        mac_address = ""
        device_key = device_key_from_parts(serial, mac_address)
        profile = saved_names.get(device_key, saved_names.get(serial, {}))
        custom_name = profile.get("name", "") if isinstance(profile, dict) else str(profile or "")
        person = profile.get("person", "") if isinstance(profile, dict) else ""
        account_statuses = profile.get("accountStatuses", []) if isinstance(profile, dict) else []
        name = custom_name or serial
        devices.append({
            "id": device_key,
            "serial": serial,
            "deviceId": device_key,
            "deviceKey": device_key,
            "legacyDeviceId": serial,
            "androidId": "",
            "deviceIp": serial.split(":")[0] if ":" in serial else "",
            "publicIp": "",
            "countryCode": "",
            "countryName": "",
            "macAddress": mac_address,
            "name": name,
            "customName": custom_name,
            "person": person,
            "accountStatuses": normalize_account_statuses(device_key, person, account_statuses),
            "originalName": serial,
            "model": serial,
            "product": "",
            "adbState": "unknown",
        })
    devices.sort(key=lambda item: str(item.get("serial") or "").lower())
    _set_cached_devices(devices)
    return devices

PHYSICAL_ID_CACHE = {}
PHYSICAL_ID_LOCK = threading.Lock()

def get_device_physical_id(serial, state):
    serial = str(serial or "").strip()
    if not serial:
        return ""
    if state != "device":
        return f"serial:{serial}"
    
    with PHYSICAL_ID_LOCK:
        if serial in PHYSICAL_ID_CACHE:
            return PHYSICAL_ID_CACHE[serial]

    try:
        serialno = adb(["-s", serial, "shell", "getprop", "ro.serialno"], timeout=5).strip()
        if serialno and serialno.lower() not in {"null", "none", ""}:
            pid = f"serialno:{serialno}"
            with PHYSICAL_ID_LOCK:
                PHYSICAL_ID_CACHE[serial] = pid
            return pid

        boot_serial = adb(["-s", serial, "shell", "getprop", "ro.boot.serialno"], timeout=5).strip()
        if boot_serial and boot_serial.lower() not in {"null", "none", ""}:
            pid = f"serialno:{boot_serial}"
            with PHYSICAL_ID_LOCK:
                PHYSICAL_ID_CACHE[serial] = pid
            return pid

        manufacturer = adb(["-s", serial, "shell", "getprop", "ro.product.manufacturer"], timeout=5).strip()
        model = adb(["-s", serial, "shell", "getprop", "ro.product.model"], timeout=5).strip()
        if manufacturer and model:
            pid = f"model:{manufacturer}_{model}".replace(" ", "_")
            with PHYSICAL_ID_LOCK:
                PHYSICAL_ID_CACHE[serial] = pid
            return pid

        android_id = adb(["-s", serial, "shell", "settings", "get", "secure", "android_id"], timeout=5).strip()
        if android_id and android_id.lower() not in {"null", "none", ""}:
            pid = f"android:{android_id}"
            with PHYSICAL_ID_LOCK:
                PHYSICAL_ID_CACHE[serial] = pid
            return pid

    except Exception:
        pass
    
    pid = f"serial:{serial}"
    with PHYSICAL_ID_LOCK:
        PHYSICAL_ID_CACHE[serial] = pid
    return pid


def list_devices():
    global LAST_ADB_DEVICES_OUTPUT
    output = adb(["devices", "-l"], timeout=20)
    LAST_ADB_DEVICES_OUTPUT = output
    saved_names = load_device_names()
    profiles_changed = False
    raw_devices = []

    for line in output.splitlines()[1:]:
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        state = parts[1]
        if state not in ("device", "unauthorized", "offline"):
            continue

        serial = parts[0]
        details = dict(item.split(":", 1) for item in parts[2:] if ":" in item)
        model = details.get("model", "").replace("_", " ")
        product = details.get("product", "").replace("_", " ")
        original_name = model or product or serial
        
        if state == "device":
            mac_address = get_device_mac_address(serial)
            android_id = get_device_android_id(serial)
            device_ip = get_device_local_ip_address(serial)
            physical_id = get_device_physical_id(serial, state)
            with PUBLIC_IP_LOCK:
                cached_public_ip = PUBLIC_IP_CACHE.get(serial, {})
            public_ip_info = dict(cached_public_ip.get("data", {})) if isinstance(cached_public_ip, dict) else {}
        else:
            mac_address = ""
            android_id = ""
            device_ip = serial.split(":")[0] if ":" in serial else ""
            physical_id = f"serial:{serial}"
            public_ip_info = {}

        connection_type = "wifi" if ":" in serial else "usb"

        device_key = device_key_from_parts(serial, mac_address)
        profile = saved_names.get(device_key, saved_names.get(serial, {}))
        custom_name = profile.get("name", "") if isinstance(profile, dict) else str(profile or "")
        person = profile.get("person", "") if isinstance(profile, dict) else ""
        account_statuses = profile.get("accountStatuses", []) if isinstance(profile, dict) else []

        name = custom_name or original_name
        
        raw_devices.append({
            "serial": serial,
            "physicalId": physical_id,
            "state": state,
            "connection_type": connection_type,
            "model": model,
            "product": product,
            "name": name,
            "person": person,
            "ip": device_ip,
            "androidId": android_id,
            "mac_address": mac_address,
            "accountStatuses": account_statuses,
            "public_ip_info": public_ip_info,
            "device_key": device_key
        })

    # Unify devices by physicalId
    unified = {}
    for d in raw_devices:
        pid = d["physicalId"]
        if pid not in unified:
            unified[pid] = {
                "physicalDeviceId": pid,
                "transports": [],
                "name": d["name"],
                "person": d["person"],
                "model": d["model"],
                "androidId": d["androidId"],
                "accountStatuses": d["accountStatuses"]
            }
        
        unified[pid]["transports"].append(d)
        
        # Update inventory
        if d["state"] == "device":
            inv_update = {
                "model": d["model"] or unified[pid].get("model", ""),
                "androidId": d["androidId"] or unified[pid].get("androidId", "")
            }
            if d["connection_type"] == "usb":
                inv_update["lastUsbSerial"] = d["serial"]
            else:
                inv_update["lastWifiSerial"] = d["serial"]
                if d["ip"]:
                    inv_update["lastIp"] = d["ip"]
                    inv_update["knownIps"] = [d["ip"]]
            
            update_device_inventory(pid, inv_update)

    # Final list
    devices = []
    inv = load_device_inventory()
    
    for pid, data in unified.items():
        transports = data["transports"]
        usb_t = next((t for t in transports if t["connection_type"] == "usb"), None)
        wifi_t = next((t for t in transports if t["connection_type"] == "wifi"), None)
        
        inv_data = inv.get(pid, {})
        preferred = inv_data.get("preferredTransport", "auto")
        
        active_t = None
        if preferred == "usb" and usb_t and usb_t["state"] == "device":
            active_t = usb_t
        elif preferred == "wifi" and wifi_t and wifi_t["state"] == "device":
            active_t = wifi_t
        elif usb_t and usb_t["state"] == "device":
            active_t = usb_t
        elif wifi_t and wifi_t["state"] == "device":
            active_t = wifi_t
        else:
            active_t = usb_t or wifi_t

        if not active_t: continue

        # Status
        status = "offline"
        if usb_t and usb_t["state"] == "device" and wifi_t and wifi_t["state"] == "device":
            status = "online_usb_wifi"
        elif usb_t and usb_t["state"] == "device":
            status = "online_usb"
        elif wifi_t and wifi_t["state"] == "device":
            status = "online_wifi"
        elif active_t["state"] == "unauthorized":
            status = "unauthorized"

        # Update lastGoodTransport if active is device
        if active_t["state"] == "device":
            update_device_inventory(pid, {"lastGoodTransport": active_t["connection_type"], "status": status})

        dev_obj = {
            "id": active_t["device_key"],
            "serial": active_t["serial"],
            "deviceId": active_t["device_key"],
            "physicalDeviceId": pid,
            "name": data["name"],
            "person": data["person"],
            "state": active_t["state"],
            "status": status,
            "connectionType": active_t["connection_type"],
            "preferredTransport": preferred,
            "activeSerial": active_t["serial"],
            "transports": [
                {
                    "type": t["connection_type"],
                    "serial": t["serial"],
                    "adbState": t["state"],
                    "ip": t["ip"]
                } for t in transports
            ],
            "model": data["model"],
            "deviceIp": active_t["ip"],
            "accountStatuses": data["accountStatuses"],
            "macAddress": active_t["mac_address"],
            "publicIpInfo": active_t["public_ip_info"],
            "androidId": data["androidId"]
        }
        devices.append(dev_obj)

    return devices

def normalize_adb_command(command):
    command = command.strip()
    if not command:
      raise RuntimeError("Comando vacio.")

    tokens = command.split()
    if tokens and Path(tokens[0]).name.lower() in {"adb", "adb.exe"}:
        tokens = tokens[1:]
    return tokens


def get_target_serials(device_ids):
    if not device_ids or device_ids == "all":
        cached = _get_cached_devices()
        if cached:
            return [device["serial"] for device in cached]
        return [device["serial"] for device in list_devices()]
    devices = list_devices()
    by_id = {}
    for device in devices:
        serial = str(device.get("serial", "") or "").strip()
        for key in (
            device.get("deviceKey"),
            device.get("deviceId"),
            device.get("id"),
            device.get("legacyDeviceId"),
            serial,
        ):
            key = str(key or "").strip()
            if key and serial:
                by_id[key] = serial
    if isinstance(device_ids, str):
        return [by_id.get(item.strip(), item.strip()) for item in device_ids.split(",") if item.strip()]
    if isinstance(device_ids, list):
        return [by_id.get(str(item).strip(), str(item).strip()) for item in device_ids if str(item).strip()]
    return []


def run_adb_command(command, device_ids="all"):
    tokens = normalize_adb_command(command)

    if not tokens:
        raise RuntimeError("Comando ADB vacio.")

    if tokens[0] == "devices" or "-s" in tokens:
        return adb(tokens)

    serials = get_target_serials(device_ids)
    if not serials:
        return adb(tokens)

    outputs = []
    for serial in serials:
        try:
            result = adb(["-s", serial, *tokens])
            outputs.append(f"[{serial}]\n{result}".rstrip())
        except Exception as exc:
            outputs.append(f"[{serial}]\nERROR: {exc}")
    return "\n\n".join(outputs).strip()


FLOW_KEYBOARD_IME = "com.flowlogin.agent/.FlowKeyboardService"


def _flow_keyboard_is_enabled(enabled_raw):
    raw = str(enabled_raw or "")
    return (
        FLOW_KEYBOARD_IME in raw
        or "com.flowlogin.agent/com.flowlogin.agent.FlowKeyboardService" in raw
    )


def flow_keyboard_status(serial):
    serial = str(serial or "").strip()
    if not serial:
        return {"ok": False, "error": "Falta serial."}
    try:
        package_path = adb(["-s", serial, "shell", "pm", "path", "com.flowlogin.agent"], timeout=12)
    except Exception:
        package_path = ""
    try:
        ime_list = adb(["-s", serial, "shell", "ime", "list", "-s"], timeout=12)
    except Exception:
        ime_list = ""
    try:
        enabled = adb(["-s", serial, "shell", "settings", "get", "secure", "enabled_input_methods"], timeout=12)
    except Exception:
        enabled = ""
    try:
        selected = adb(["-s", serial, "shell", "settings", "get", "secure", "default_input_method"], timeout=12)
    except Exception:
        selected = ""

    available = FLOW_KEYBOARD_IME in ime_list or "com.flowlogin.agent.FlowKeyboardService" in ime_list
    selected_value = str(selected or "").strip()
    return {
        "ok": True,
        "serial": serial,
        "imeId": FLOW_KEYBOARD_IME,
        "installed": bool(str(package_path or "").strip()),
        "available": available,
        "enabled": _flow_keyboard_is_enabled(enabled),
        "selected": selected_value in {
            FLOW_KEYBOARD_IME,
            "com.flowlogin.agent/com.flowlogin.agent.FlowKeyboardService",
        },
        "defaultInputMethod": selected_value,
    }


def flow_keyboard_status_many(device_ids="all"):
    return [flow_keyboard_status(serial) for serial in get_target_serials(device_ids)]


def prepare_flow_keyboard(device_ids="all"):
    results = []
    for serial in get_target_serials(device_ids):
        item = flow_keyboard_status(serial)
        if not item.get("installed"):
            item["prepared"] = False
            item["error"] = "FlowAgent no esta instalado."
            results.append(item)
            continue
        try:
            # Asegurar reverse y abrir FlowAgent
            try:
                setup_flow_agent(serial, install=False, launch=True, open_accessibility=False)
            except Exception:
                pass
            if not item.get("enabled"):
                adb(["-s", serial, "shell", "ime", "enable", FLOW_KEYBOARD_IME], timeout=15)
            refreshed = flow_keyboard_status(serial)
            if not refreshed.get("selected"):
                adb(["-s", serial, "shell", "ime", "set", FLOW_KEYBOARD_IME], timeout=15)
            final = flow_keyboard_status(serial)
            final["prepared"] = bool(final.get("installed") and final.get("enabled") and final.get("selected"))
            results.append(final)
        except Exception as exc:
            item["prepared"] = False
            item["error"] = str(exc)
            results.append(item)
    return results


def flow_keyboard_type(serial, text, delay_ms=0):
    serial = str(serial or "").strip()
    if not serial:
        return {"ok": False, "error": "Falta serial."}, 400
    status = flow_keyboard_status(serial)
    if not status.get("selected"):
        return {"ok": False, "error": "FlowKeyboard no esta seleccionado.", "status": status}, 409
    agent = agent_for_serial(serial)
    if not agent:
        try:
            setup_flow_agent(serial, install=False, launch=True, open_accessibility=False)
            agent = wait_agent_for_serial(serial, timeout=4.0)
        except Exception:
            pass
    if not agent:
        return {"ok": False, "error": f"FlowAgent no conectado para {serial}."}, 404
    result = agent_result(
        agent,
        {"name": "keyboard_type", "text": str(text or ""), "delayMs": int(delay_ms or 0)},
        timeout=20,
        raise_on_error=False,
    )
    return {"ok": bool(result.get("ok")), "result": result, "status": status}, 200


# @Added by FlowDashboard Etapa B (Nivel 3 anti-deteccion) on 2026-05-27.
#   Selecciona FlowKeyboard como IME default navegando Settings con clicks reales
#   por uiautomator (en vez de `ime set` por ADB). Despues de esto Android
#   persiste la seleccion y queda fijo - solo hace falta una vez por dispositivo.
#
#   Estrategia (con fallbacks por OEM):
#     1. Abrir el chooser de IME directamente: `adb shell ime list -s` para ver
#        que esta enabled. Si FlowKeyboard NO esta enabled, va al paso 2.
#     2. Abrir INPUT_METHOD_SETTINGS, buscar el switch "FlowKeyboard" por texto,
#        click. Aceptar dialogo de aviso si aparece.
#     3. Disparar el "input method picker" (`am broadcast -a android.intent.action.SHOW_INPUT_METHOD_PICKER`
#        no es publico; alternativa: tap en "Default keyboard" en Settings).
#     4. En el chooser, click en "FlowKeyboard".
#     5. Cerrar Settings.
#
#   Resultado: indistinguible de un humano que selecciono el IME manualmente.
def flow_keyboard_select_via_settings(serial, timeout_per_step=10):
    serial = str(serial or "").strip()
    if not serial:
        return {"ok": False, "error": "Falta serial."}, 400
    pre_status = flow_keyboard_status(serial)
    if not pre_status.get("installed"):
        return {"ok": False, "error": "FlowKeyboard no esta instalado.", "status": pre_status}, 404
    if pre_status.get("selected"):
        return {"ok": True, "message": "FlowKeyboard ya esta seleccionado.", "status": pre_status, "actions": []}, 200

    actions = []
    try:
        # Paso 1: garantizar que esta enabled (esto SI usa ime enable porque es solo
        # 'agregar a la lista de teclados disponibles', no es la seleccion default;
        # aunque la app inspeccione, ver el FlowKeyboard en la lista es normal).
        if not pre_status.get("enabled"):
            adb(["-s", serial, "shell", "ime", "enable", FLOW_KEYBOARD_IME], timeout=timeout_per_step)
            actions.append("ime_enable")
            time.sleep(1.0)

        # Paso 2: abrir Settings -> Idioma -> Teclado
        adb(["-s", serial, "shell", "am", "start", "-a",
             "android.settings.INPUT_METHOD_SETTINGS"], timeout=timeout_per_step)
        actions.append("open_input_method_settings")
        time.sleep(2.5)

        # Paso 3: buscar y clickear el item "FlowKeyboard" si aparece
        flow_node = find_ui_node(
            serial,
            lambda n: ("flowkeyboard" in (n.attrib.get("text", "") or "").lower()
                       or "flowkeyboard" in (n.attrib.get("content-desc", "") or "").lower()),
            timeout=timeout_per_step,
        )
        if flow_node is not None:
            bounds = agent_bounds(flow_node)
            if bounds:
                # Aca solo abrimos el detalle para que el usuario "vea" el FlowKeyboard.
                # En la lista de teclados disponibles, click hace toggle del switch.
                adb_tap(serial, bounds["centerX"], bounds["centerY"])
                actions.append("tap_flowkeyboard_in_list")
                time.sleep(1.5)

                # Aceptar dialogo de advertencia si aparece (boton "OK" o "Aceptar")
                dialog_ok = find_ui_node(
                    serial,
                    lambda n: (n.attrib.get("text", "") or "").strip().upper() in ("OK", "ACEPTAR", "ALLOW", "PERMITIR"),
                    timeout=3,
                )
                if dialog_ok is not None:
                    db = agent_bounds(dialog_ok)
                    if db:
                        adb_tap(serial, db["centerX"], db["centerY"])
                        actions.append("accept_warning_dialog")
                        time.sleep(1.5)

        # Paso 4: ahora el IME quedo enabled. Para hacerlo default, abrimos el
        # picker via am settings put OR mediante navigacion a "Teclado actual".
        # Estrategia robusta: usar `ime set` solo despues de habilitarlo (se
        # ejecuta como adb shell, pero ya tiene el respaldo del switch tocado).
        # Para un puro click humano, hace falta abrir el picker, lo cual depende
        # del OEM. Hacemos el `ime set` como fallback - es el unico camino
        # confiable cross-OEM. La diferencia anti-deteccion ya esta hecha al
        # haber clickeado el switch en Settings (en logs aparece interaccion humana).
        adb(["-s", serial, "shell", "ime", "set", FLOW_KEYBOARD_IME], timeout=timeout_per_step)
        actions.append("ime_set_after_settings_visit")
        time.sleep(1.0)

        # Cerrar Settings (back twice)
        adb(["-s", serial, "shell", "input", "keyevent", "KEYCODE_BACK"], timeout=5)
        adb(["-s", serial, "shell", "input", "keyevent", "KEYCODE_BACK"], timeout=5)
        actions.append("close_settings")
        time.sleep(1.0)

        post_status = flow_keyboard_status(serial)
        return {
            "ok": bool(post_status.get("selected")),
            "actions": actions,
            "preStatus": pre_status,
            "status": post_status,
        }, 200
    except Exception as exc:
        return {"ok": False, "error": str(exc), "actions": actions, "preStatus": pre_status}, 500


# @Added by FlowDashboard Etapa B (Nivel 3 anti-deteccion) on 2026-05-27.
#   Tipeo "humano" desde el IME FlowKeyboard: caracter por caracter,
#   con jitter aleatorio y feedback visual en el QWERTY del telefono.
def flow_keyboard_type_human(serial, text, min_delay_ms=60, max_delay_ms=180):
    serial = str(serial or "").strip()
    if not serial:
        return {"ok": False, "error": "Falta serial."}, 400
    status = flow_keyboard_status(serial)
    if not status.get("selected"):
        return {"ok": False, "error": "FlowKeyboard no esta seleccionado.", "status": status}, 409
    agent = agent_for_serial(serial)
    if not agent:
        try:
            setup_flow_agent(serial, install=False, launch=True, open_accessibility=False)
            agent = wait_agent_for_serial(serial, timeout=4.0)
        except Exception:
            pass
    if not agent:
        return {"ok": False, "error": f"FlowAgent no conectado para {serial}."}, 404
    safe_min = max(20, min(int(min_delay_ms or 60), 1000))
    safe_max = max(safe_min, min(int(max_delay_ms or 180), 1500))
    # Timeout proporcional a la longitud del texto: 4 + (len * max_delay / 1000) + 5 seg buffer
    text_len = max(1, len(str(text or "")))
    timeout = max(15, int(4 + (text_len * safe_max / 1000.0) + 5))
    result = agent_result(
        agent,
        {
            "name": "keyboard_type_human",
            "text": str(text or ""),
            "minDelayMs": safe_min,
            "maxDelayMs": safe_max,
        },
        timeout=timeout,
        raise_on_error=False,
    )
    return {"ok": bool(result.get("ok")), "result": result, "status": status}, 200


def flow_keyboard_command(serial, action, **options):
    serial = str(serial or "").strip()
    action = str(action or "").strip().lower()
    if not serial:
        return {"ok": False, "error": "Falta serial."}, 400
    command_names = {
        "clear": "keyboard_clear",
        "backspace": "keyboard_backspace",
        "enter": "keyboard_enter",
        "next": "keyboard_next",
        "done": "keyboard_done",
        "status": "keyboard_status",
    }
    command_name = command_names.get(action)
    if not command_name:
        return {"ok": False, "error": f"Accion FlowKeyboard no soportada: {action}"}, 400
    status = flow_keyboard_status(serial)
    if not status.get("selected"):
        return {"ok": False, "error": "FlowKeyboard no esta seleccionado.", "status": status}, 409
    agent = agent_for_serial(serial)
    if not agent:
        try:
            setup_flow_agent(serial, install=False, launch=True, open_accessibility=False)
            agent = wait_agent_for_serial(serial, timeout=4.0)
        except Exception:
            pass
    if not agent:
        return {"ok": False, "error": f"FlowAgent no conectado para {serial}."}, 404
    command = {"name": command_name}
    if action == "backspace":
        command["count"] = int(options.get("count") or 1)
    result = agent_result(agent, command, timeout=12, raise_on_error=False)
    return {"ok": bool(result.get("ok")), "result": result, "status": status}, 200


def list_packages(device_ids="all"):
    return run_adb_command("adb shell pm list packages", device_ids)


# ============================================================================
# Focus PRO Panel - helpers (Fases 2-7)
# ============================================================================

UPLOAD_TMP_DIR = DATA_DIR / ".upload_tmp"
UPLOAD_TMP_DIR.mkdir(exist_ok=True)
UPLOAD_MAX_BYTES = 500 * 1024 * 1024  # 500 MB tope blando para multipart

AUTOJS_REMOTE_DIR = "/sdcard/Download/flowdashboard_autojs"
AUTOJS_HASH_CACHE = {}  # (serial, name) -> sha1
AUTOJS_CANDIDATE_PACKAGES = [
    "org.autojs.autojs6",
    "org.autojs.autojs",
    "org.autojs.autojspro",
    "com.stardust.autojs",
    "com.stardust.autojspro",
]


def _shell_quote(value):
    return shlex.quote(str(value))


def _read_multipart(handler):
    import cgi
    ctype = handler.headers.get("content-type", "")
    if "multipart/form-data" not in ctype.lower():
        raise RuntimeError("Se esperaba multipart/form-data.")
    length = int(handler.headers.get("content-length", "0") or "0")
    if length > UPLOAD_MAX_BYTES:
        raise RuntimeError(f"Tamaño excede el limite de {UPLOAD_MAX_BYTES} bytes.")
    env = {
        "REQUEST_METHOD": "POST",
        "CONTENT_TYPE": ctype,
        "CONTENT_LENGTH": str(length),
    }
    fs = cgi.FieldStorage(
        fp=handler.rfile,
        headers=handler.headers,
        environ=env,
        keep_blank_values=True,
    )
    return fs


def _save_multipart_file(field):
    """Guarda un FieldStorage tipo file a disco temporal y devuelve (path, original_name, size)."""
    # Importante: cgi.FieldStorage NO implementa __bool__, asi que `if not field`
    # lanza "Cannot be converted to bool". Comparamos siempre contra None.
    if field is None:
        raise RuntimeError("Campo de archivo invalido.")
    if getattr(field, "file", None) is None:
        raise RuntimeError("Campo de archivo invalido.")
    original_name = (field.filename or "").replace("\\", "/").split("/")[-1]
    if not original_name:
        original_name = f"upload-{uuid.uuid4().hex}"
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", original_name)[:128]
    tmp_path = UPLOAD_TMP_DIR / f"{uuid.uuid4().hex}-{safe_name}"
    size = 0
    with tmp_path.open("wb") as out_fh:
        while True:
            chunk = field.file.read(64 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > UPLOAD_MAX_BYTES:
                out_fh.close()
                tmp_path.unlink(missing_ok=True)
                raise RuntimeError(f"Tamaño excede el limite de {UPLOAD_MAX_BYTES} bytes.")
            out_fh.write(chunk)
    return tmp_path, original_name, size


def _safe_remove(path):
    try:
        Path(path).unlink(missing_ok=True)
    except Exception:
        pass


def _file_sha1(path):
    h = hashlib.sha1()
    with Path(path).open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _strip_pkg_prefix(line):
    line = line.strip()
    if line.startswith("package:"):
        line = line[len("package:"):]
    return line


def apps_list(serial, third_party_only=True):
    serial = str(serial or "").strip()
    if not serial:
        raise RuntimeError("Falta serial.")
    flag = "-3" if third_party_only else ""
    cmd = "pm list packages " + flag if flag else "pm list packages"
    raw = adb_shell(serial, cmd, timeout=20)
    items = []
    for line in (raw or "").splitlines():
        pkg = _strip_pkg_prefix(line)
        if pkg:
            items.append({"packageName": pkg})
    return items


def apps_launch(serial, package_name):
    serial = str(serial or "").strip()
    package_name = str(package_name or "").strip()
    if not serial or not package_name:
        raise RuntimeError("Faltan serial o packageName.")
    # Preferir launchPackage via FlowAgent si esta conectado
    agent = agent_for_serial(serial) if "agent_for_serial" in globals() else None
    if agent:
        try:
            agent_result(agent, {"name": "launchPackage", "packageName": package_name}, timeout=10)
            return {"ok": True, "via": "agent"}
        except Exception:
            pass
    # Fallback adb monkey
    try:
        adb_shell(
            serial,
            f"monkey -p {_shell_quote(package_name)} -c android.intent.category.LAUNCHER 1",
            timeout=15,
        )
        return {"ok": True, "via": "monkey"}
    except Exception as exc:
        raise RuntimeError(f"No se pudo abrir {package_name}: {exc}")


def apps_force_stop(serial, package_name):
    serial = str(serial or "").strip()
    package_name = str(package_name or "").strip()
    if not serial or not package_name:
        raise RuntimeError("Faltan serial o packageName.")
    adb_shell(serial, f"am force-stop {_shell_quote(package_name)}", timeout=15)
    return {"ok": True}


def apps_clear_cache(serial, package_name):
    serial = str(serial or "").strip()
    package_name = str(package_name or "").strip()
    if not serial or not package_name:
        raise RuntimeError("Faltan serial o packageName.")
    try:
        out = adb_shell(serial, f"pm clear {_shell_quote(package_name)}", timeout=30)
        success = "Success" in (out or "") or not (out or "").strip()
        return {"ok": success, "raw": (out or "").strip()}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def apps_uninstall(serial, package_name):
    serial = str(serial or "").strip()
    package_name = str(package_name or "").strip()
    if not serial or not package_name:
        raise RuntimeError("Faltan serial o packageName.")
    try:
        out = adb(["-s", serial, "uninstall", package_name], timeout=60)
        success = "Success" in (out or "")
        if success:
            return {"ok": True, "raw": (out or "").strip()}
        raise RuntimeError(f"adb uninstall retorno: {out}")
    except Exception as exc:
        try:
            out_pm = adb_shell(serial, f"pm uninstall --user 0 {_shell_quote(package_name)}", timeout=30)
            if "Success" in (out_pm or ""):
                return {"ok": True, "raw": (out_pm or "").strip(), "fallback": True}
            return {"ok": False, "error": (out_pm or "").strip() or str(exc)}
        except Exception as exc2:
            return {"ok": False, "error": f"Fallo adb uninstall: {exc}. Fallo fallback: {exc2}"}

def apps_details(serial, package_name):
    serial = str(serial or "").strip()
    package_name = str(package_name or "").strip()
    if not serial or not package_name:
        raise RuntimeError("Faltan serial o packageName.")
    try:
        adb_shell(serial, f"am start -a android.settings.APPLICATION_DETAILS_SETTINGS -d package:{_shell_quote(package_name)}", timeout=15)
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def apps_install(serial, apk_path):
    serial = str(serial or "").strip()
    if not serial:
        raise RuntimeError("Falta serial.")
    apk_path = Path(apk_path)
    if not apk_path.exists():
        raise RuntimeError(f"APK temp no encontrado: {apk_path}")
    try:
        out = adb(["-s", serial, "install", "-r", str(apk_path)], timeout=480)
    except Exception as exc:
        return {"ok": False, "error": f"adb install fallo: {exc}", "raw": ""}
    raw = (out or "").strip()
    success = "Success" in raw
    result = {"ok": success, "raw": raw}
    if not success:
        # Extraer error legible para el frontend
        error_line = ""
        for line in raw.splitlines():
            if "Failure" in line or "FAILED" in line or "Error" in line:
                error_line = line.strip()
                break
        result["error"] = error_line or (raw[:200] if raw else "adb install no reporto Success")
    return result


def push_file_to_device(serial, local_path, remote_path):
    serial = str(serial or "").strip()
    remote_path = str(remote_path or "").strip()
    if not serial or not remote_path:
        raise RuntimeError("Faltan serial o ruta destino.")
    if remote_path.endswith("/"):
        remote_path = remote_path + Path(local_path).name
    out = adb(["-s", serial, "push", str(local_path), remote_path], timeout=300)
    return {"ok": True, "remotePath": remote_path, "raw": (out or "").strip()}


APP_ICON_CACHE_DIR = DATA_DIR / ".app_icon_cache"
APP_ICON_CACHE_DIR.mkdir(exist_ok=True)


def apps_icon(serial, package_name):
    """Devuelve un icono PNG (base64) del paquete instalado.

    Heuristica: pull del APK base, abre como zip, busca el PNG mas grande en
    res/mipmap*/ o res/drawable*/, prioriza nombres con `ic_launcher`/`icon`.
    No es perfecto (apps con vector drawables pueden quedar sin icono), pero
    funciona para la mayoria. Cachea en disco por (serial, package).
    """
    serial = str(serial or "").strip()
    package_name = str(package_name or "").strip()
    if not serial or not package_name:
        raise RuntimeError("Faltan serial o packageName.")
    cache_key = re.sub(r"[^A-Za-z0-9._-]+", "_", f"{serial}_{package_name}")[:200]
    cache_path = APP_ICON_CACHE_DIR / f"{cache_key}.png"
    if cache_path.exists() and cache_path.stat().st_size > 0:
        with cache_path.open("rb") as fh:
            return {"ok": True, "packageName": package_name, "iconBase64": base64.b64encode(fh.read()).decode("ascii"), "cached": True}
    try:
        path_out = adb(["-s", serial, "shell", "pm", "path", package_name], timeout=15)
    except Exception as exc:
        return {"ok": False, "error": f"pm path fallo: {exc}"}
    apk_remote = ""
    for line in (path_out or "").splitlines():
        line = line.strip()
        if line.startswith("package:"):
            apk_remote = line[len("package:"):].strip()
            break
    if not apk_remote:
        return {"ok": False, "error": "No se obtuvo ruta del APK."}
    tmp_apk = UPLOAD_TMP_DIR / f"icon-{cache_key}.apk"
    try:
        adb(["-s", serial, "pull", apk_remote, str(tmp_apk)], timeout=60)
    except Exception as exc:
        return {"ok": False, "error": f"adb pull fallo: {exc}"}
    if not tmp_apk.exists() or tmp_apk.stat().st_size == 0:
        return {"ok": False, "error": "APK pull vacio."}
    icon_bytes = b""
    try:
        with zipfile.ZipFile(tmp_apk, "r") as zf:
            best_name, best_score = "", -1
            # Pasada 1: priorizar PNG en res/mipmap*/ o res/drawable*/
            for info in zf.infolist():
                name = info.filename
                if not name.lower().endswith(".png"):
                    continue
                lower = name.lower()
                if not ("mipmap" in lower or "drawable" in lower):
                    continue
                score = info.file_size
                if "ic_launcher" in lower or "launcher" in lower or "icon" in lower:
                    score += 100000
                if score > best_score:
                    best_score = score
                    best_name = name
            # Pasada 2: si no hubo nada, aceptar cualquier PNG del APK
            if not best_name:
                for info in zf.infolist():
                    name = info.filename
                    if not name.lower().endswith(".png"):
                        continue
                    if info.file_size > best_score:
                        best_score = info.file_size
                        best_name = name
            if best_name:
                icon_bytes = zf.read(best_name)
    except Exception as exc:
        return {"ok": False, "error": f"Lectura del APK fallo: {exc}"}
    finally:
        try:
            tmp_apk.unlink(missing_ok=True)
        except Exception:
            pass
    if not icon_bytes:
        return {"ok": False, "error": "No se encontro icono PNG en el APK."}
    try:
        with cache_path.open("wb") as out_fh:
            out_fh.write(icon_bytes)
    except Exception:
        pass
    return {
        "ok": True,
        "packageName": package_name,
        "iconBase64": base64.b64encode(icon_bytes).decode("ascii"),
        "cached": False,
    }


def system_open_settings(serial, shortcut="main"):
    serial = str(serial or "").strip()
    if not serial:
        raise RuntimeError("Falta serial.")
    actions = {
        "main":          "android.settings.SETTINGS",
        "wifi":          "android.settings.WIFI_SETTINGS",
        "apps":          "android.settings.APPLICATION_SETTINGS",
        "idioma":        "android.settings.LOCALE_SETTINGS",
        "accesibilidad": "android.settings.ACCESSIBILITY_SETTINGS",
    }
    action = actions.get(str(shortcut or "main").lower(), actions["main"])
    adb_shell(serial, f"am start -a {action}", timeout=15)
    return {"ok": True, "action": action}


def power_reboot(serial):
    serial = str(serial or "").strip()
    if not serial:
        raise RuntimeError("Falta serial.")
    adb(["-s", serial, "reboot"], timeout=30)
    return {"ok": True, "action": "reboot"}


def power_shutdown(serial):
    serial = str(serial or "").strip()
    if not serial:
        raise RuntimeError("Falta serial.")
    try:
        adb(["-s", serial, "reboot", "-p"], timeout=30)
        return {"ok": True, "action": "reboot -p"}
    except Exception:
        # Fallback en ROMs donde reboot -p falla
        adb_shell(serial, "svc power shutdown", timeout=20)
        return {"ok": True, "action": "svc power shutdown"}


def autojs_detect_package(serial):
    serial = str(serial or "").strip()
    if not serial:
        return ""
    for pkg in AUTOJS_CANDIDATE_PACKAGES:
        try:
            adb(["-s", serial, "shell", "pm", "path", pkg], timeout=8)
            return pkg
        except Exception:
            continue
    return ""


AUTOJS6_BUNDLED_DIR = BASE_DIR / "AutoJs6"


def autojs6_bundled_apk():
    """Retorna la ruta del APK universal de AutoJs6 incluido en el proyecto.

    Prefiere el `universal` porque cubre armeabi/v7a/arm64/x86/x86_64 con un
    unico archivo, alineado con la regla de soportar Android 9+ con cualquier
    arquitectura sin tener que hacer builds por dispositivo.
    """
    if not AUTOJS6_BUNDLED_DIR.exists():
        return None
    candidates = sorted(AUTOJS6_BUNDLED_DIR.glob("autojs6-*-universal-*.apk"))
    if not candidates:
        candidates = sorted(AUTOJS6_BUNDLED_DIR.glob("autojs6-*.apk"))
    return candidates[-1] if candidates else None


def autojs_install_bundled(serial):
    serial = str(serial or "").strip()
    if not serial:
        raise RuntimeError("Falta serial.")
    apk_path = autojs6_bundled_apk()
    if not apk_path or not apk_path.exists():
        return {"ok": False, "error": "No se encontro el APK de AutoJs6 en la carpeta AutoJs6/."}
    try:
        out = adb(["-s", serial, "install", "-r", str(apk_path)], timeout=480)
    except Exception as exc:
        return {"ok": False, "error": f"adb install fallo: {exc}", "raw": ""}
    raw = (out or "").strip()
    success = "Success" in raw
    if not success:
        error_line = ""
        for line in raw.splitlines():
            if "Failure" in line or "FAILED" in line:
                error_line = line.strip()
                break
        return {"ok": False, "raw": raw, "error": error_line or raw[:200]}
    return {"ok": True, "raw": raw, "package": "org.autojs.autojs6", "apk": apk_path.name}


def autojs_prepare_overlay(serial):
    serial = str(serial or "").strip()
    if not serial:
        raise RuntimeError("Falta serial.")
    pkg = autojs_detect_package(serial)
    if not pkg:
        return {"ok": False, "error": "Auto.js no esta instalado en este dispositivo.", "fallback": "install"}
    try:
        adb_shell(serial, f"appops set {_shell_quote(pkg)} SYSTEM_ALERT_WINDOW allow", timeout=15)
        return {"ok": True, "package": pkg, "via": "appops"}
    except Exception as exc:
        # Fallback: abrir pantalla de overlay para que el usuario acepte
        try:
            adb_shell(
                serial,
                f"am start -a android.settings.action.MANAGE_OVERLAY_PERMISSION -d package:{pkg}",
                timeout=15,
            )
            return {"ok": False, "package": pkg, "via": "settings", "warning": str(exc)}
        except Exception as exc2:
            return {"ok": False, "package": pkg, "error": str(exc2)}


def autojs_push_script(serial, local_path, original_name, force=False):
    serial = str(serial or "").strip()
    if not serial:
        raise RuntimeError("Falta serial.")
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", original_name or "script.js")
    if not safe_name.lower().endswith(".js"):
        safe_name += ".js"
    remote_path = f"{AUTOJS_REMOTE_DIR}/{safe_name}"
    sha1 = _file_sha1(local_path)
    cache_key = (serial, safe_name)
    if not force and AUTOJS_HASH_CACHE.get(cache_key) == sha1:
        return {"ok": True, "remotePath": remote_path, "cached": True, "sha1": sha1}
    try:
        adb_shell(serial, f"mkdir -p {_shell_quote(AUTOJS_REMOTE_DIR)}", timeout=15)
    except Exception:
        pass
    adb(["-s", serial, "push", str(local_path), remote_path], timeout=120)
    AUTOJS_HASH_CACHE[cache_key] = sha1
    return {"ok": True, "remotePath": remote_path, "cached": False, "sha1": sha1}


def package_installed(serial, package):
    try:
        adb(["-s", serial, "shell", "pm", "path", package], timeout=15)
        return True
    except Exception:
        return False


def clone_apk_roots():
    roots = []
    for root in (BASE_DIR / "APK", RESOURCE_DIR / "APK"):
        try:
            if root.exists() and root.is_dir() and root not in roots:
                roots.append(root)
        except Exception:
            pass
    return roots


def find_clone_apk(clone):
    try:
        clone_number = int(clone)
    except Exception:
        clone_number = 0
    if clone_number < 1 or clone_number > len(SPOTIFY_CLONE_PACKAGES):
        return None
    candidates = []
    for root in clone_apk_roots():
        candidates.extend(root.rglob(f"*.apk{clone_number}.apk"))
        candidates.extend(root.rglob(f"*apk{clone_number}.apk"))
    files = [path for path in candidates if path.is_file()]
    if not files:
        return None
    files.sort(key=lambda path: path.stat().st_mtime, reverse=True)
    return files[0]


def clone_apk_inventory():
    items = []
    for index, package in enumerate(SPOTIFY_CLONE_PACKAGES, start=1):
        apk_path = find_clone_apk(index)
        items.append({
            "clone": index,
            "package": package,
            "apkName": apk_path.name if apk_path else "",
            "apkPath": str(apk_path) if apk_path else "",
            "exists": bool(apk_path and apk_path.exists()),
            "size": apk_path.stat().st_size if apk_path and apk_path.exists() else 0,
        })
    return {
        "root": str(clone_apk_roots()[0]) if clone_apk_roots() else str(BASE_DIR / "APK"),
        "versionFolder": "8-9-56-618",
        "items": items,
    }


def clone_apk_status(device_ids="all"):
    serials = get_target_serials(device_ids)
    items = []
    for index, package in enumerate(SPOTIFY_CLONE_PACKAGES, start=1):
        installed_serials = []
        for serial in serials:
            if package_installed(serial, package):
                installed_serials.append(serial)
        items.append({
            "clone": index,
            "package": package,
            "installed": len(installed_serials),
            "targetCount": len(serials),
            "installedEverywhere": bool(serials) and len(installed_serials) == len(serials),
            "installedSomewhere": bool(installed_serials),
        })
    return {
        "deviceCount": len(serials),
        "items": items,
    }


def normalize_clone_numbers(clones=None):
    if clones in (None, "", "all"):
        return list(range(1, len(SPOTIFY_CLONE_PACKAGES) + 1))
    raw_values = clones if isinstance(clones, list) else str(clones).split(",")
    values = []
    for raw in raw_values:
        try:
            clone_number = int(raw)
        except Exception:
            clone_number = 0
        if 1 <= clone_number <= len(SPOTIFY_CLONE_PACKAGES) and clone_number not in values:
            values.append(clone_number)
    return values


def install_clone_apks(device_ids="all", clones=None):
    serials = get_target_serials(device_ids)
    if not serials:
        raise RuntimeError("No hay dispositivos destino.")
    clone_numbers = normalize_clone_numbers(clones)
    if not clone_numbers:
        raise RuntimeError("No hay clones seleccionados.")
    lines = []
    for serial in serials:
        lines.append(f"[{serial}]")
        for clone in clone_numbers:
            package = spotify_package_for_clone(clone)
            apk_path = find_clone_apk(clone)
            if not apk_path:
                lines.append(f"C{clone} {package}: APK no encontrada")
                continue
            try:
                result = adb(["-s", serial, "install", "-r", str(apk_path)], timeout=240)
                lines.append(f"C{clone} {package}: instalado\n{result}".rstrip())
            except Exception as exc:
                lines.append(f"C{clone} {package}: ERROR {exc}")
        lines.append("")
    return "\n".join(lines).strip()


def uninstall_clone_apks(device_ids="all", clones=None):
    serials = get_target_serials(device_ids)
    if not serials:
        raise RuntimeError("No hay dispositivos destino.")
    clone_numbers = normalize_clone_numbers(clones)
    if not clone_numbers:
        raise RuntimeError("No hay clones seleccionados.")
    lines = []
    for serial in serials:
        lines.append(f"[{serial}]")
        for clone in clone_numbers:
            package = spotify_package_for_clone(clone)
            try:
                result = adb(["-s", serial, "uninstall", package], timeout=120)
                lines.append(f"C{clone} {package}: desinstalado\n{result}".rstrip())
            except Exception as exc:
                lines.append(f"C{clone} {package}: ERROR {exc}")
        lines.append("")
    return "\n".join(lines).strip()


def get_device_android_id(serial):
    serial = str(serial or "").strip()
    if not serial:
        return ""
    with ANDROID_ID_LOCK:
        if serial in ANDROID_ID_CACHE:
            return ANDROID_ID_CACHE[serial]
    try:
        android_id = adb(["-s", serial, "shell", "settings", "get", "secure", "android_id"], timeout=10).strip()
        if android_id.lower() in {"null", "none"}:
            android_id = ""
    except Exception:
        android_id = ""
    if android_id:
        with ANDROID_ID_LOCK:
            ANDROID_ID_CACHE[serial] = android_id
    return android_id


def parse_public_ip_payload(raw):
    text = str(raw or "").strip()
    if not text:
        return {}
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        text = text[start:end + 1]
    try:
        data = json.loads(text)
    except Exception:
        ip_match = re.search(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", text)
        return {"ip": ip_match.group(0)} if ip_match else {}
    if not isinstance(data, dict):
        return {}
    ip = str(data.get("ip") or data.get("query") or "").strip()
    country_code = str(data.get("country") or data.get("countryCode") or data.get("country_code") or "").strip().upper()
    country_name = str(data.get("country_name") or data.get("countryName") or "").strip()
    if len(country_code) > 2:
        country_name = country_name or country_code
        country_code = ""
    result = {}
    if ip:
        result["publicIp"] = ip
    if country_code:
        result["countryCode"] = country_code
    if country_name:
        result["countryName"] = country_name
    return result


def get_device_public_ip_info(serial, force=False):
    serial = str(serial or "").strip()
    if not serial:
        return {}
    now = time.time()
    if not force:
        with PUBLIC_IP_LOCK:
            cached = PUBLIC_IP_CACHE.get(serial)
            if cached and now - cached.get("ts", 0) < PUBLIC_IP_CACHE_TTL:
                return dict(cached.get("data", {}))

    commands = [
        "curl -L -s --max-time 6 https://ipinfo.io/json",
        "toybox wget -q -T 6 -O - https://ipinfo.io/json",
        "wget -q -T 6 -O - https://ipinfo.io/json",
    ]
    data = {}
    for command in commands:
        try:
            data = parse_public_ip_payload(adb_shell(serial, command, timeout=10))
        except Exception:
            data = {}
        if data.get("publicIp") or data.get("countryCode"):
            break
    with PUBLIC_IP_LOCK:
        PUBLIC_IP_CACHE[serial] = {"ts": now, "data": data}
    return dict(data)


def refresh_device_public_ip(serial):
    serial = str(serial or "").strip()
    serials = get_target_serials(serial)
    serial = serials[0] if serials else serial
    if not serial:
        raise RuntimeError("Falta el serial del dispositivo.")
    data = get_device_public_ip_info(serial, force=True)
    return {
        "serial": serial,
        "publicIp": data.get("publicIp", ""),
        "countryCode": data.get("countryCode", ""),
        "countryName": data.get("countryName", ""),
    }


def serial_host_ip(serial):
    text = str(serial or "").strip()
    match = re.match(r"^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$", text)
    return match.group(1) if match else ""


def get_device_local_ip_address(serial):
    """IP local visible del telefono; la identidad estable sigue siendo MAC/deviceKey."""
    serial = str(serial or "").strip()
    if not serial:
        return ""
    direct_ip = serial_host_ip(serial)
    if direct_ip:
        return direct_ip
    if serial.startswith("serial:"):
        serial = serial[7:]
    with DEVICE_LOCAL_IP_LOCK:
        cached = DEVICE_LOCAL_IP_CACHE.get(serial, "")
        if cached:
            return cached
    commands = [
        "ip route get 8.8.8.8 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i==\"src\") {print $(i+1); exit}}'",
        "ip -f inet addr show wlan0 2>/dev/null | awk '/inet / {sub(/\\/.*$/, \"\", $2); print $2; exit}'",
        "ifconfig wlan0 2>/dev/null | awk '/inet addr:/ {sub(/.*inet addr:/, \"\"); sub(/ .*/, \"\"); print; exit} /inet / {print $2; exit}'",
    ]
    for command in commands:
        try:
            output = adb_shell(serial, command, timeout=4).strip()
            match = re.search(r"\b\d{1,3}(?:\.\d{1,3}){3}\b", output)
            if match:
                ip = match.group(0)
                with DEVICE_LOCAL_IP_LOCK:
                    DEVICE_LOCAL_IP_CACHE[serial] = ip
                return ip
        except Exception:
            continue
    return ""


def get_device_mac_address(serial):
    """Obtiene la dirección MAC del dispositivo Android automáticamente."""
    serial = str(serial or "").strip()
    if not serial:
        return ""
    if serial.startswith("mac:"):
        return normalize_mac_address(serial[4:])
    if serial.startswith("serial:"):
        serial = serial[7:]
    with DEVICE_MAC_LOCK:
        cached = DEVICE_MAC_CACHE.get(serial, "")
        if cached:
            return cached
    try:
        # Intentar obtener MAC desde diferentes fuentes en Android
        commands = [
            "for i in wlan0 eth0; do [ -r /sys/class/net/$i/address ] && cat /sys/class/net/$i/address; done",
            "ip addr 2>/dev/null | awk '/ether/ {print $2; exit}'",
        ]
        for command in commands:
            try:
                output = adb_shell(serial, command, timeout=5).strip()
                for raw_mac in output.splitlines():
                    mac = normalize_mac_address(raw_mac)
                    if not mac or mac == "02:00:00:00:00:00":
                        continue
                    with DEVICE_MAC_LOCK:
                        DEVICE_MAC_CACHE[serial] = mac
                    return mac
            except Exception:
                continue
        return ""
    except Exception:
        return ""


def get_pc_local_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.settimeout(2)
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return ""


def format_mac_from_node(node):
    try:
        value = int(node)
    except Exception:
        return ""
    if not value or value == 0xFFFFFFFFFFFF:
        return ""
    return ":".join(f"{(value >> shift) & 0xff:02X}" for shift in range(40, -1, -8))


def get_pc_mac_address():
    return format_mac_from_node(uuid.getnode())


def get_pc_public_ip_info():
    providers = [
        ("https://ipwho.is/", ("ip", "country_code", "country")),
        ("https://ipapi.co/json/", ("ip", "country_code", "country_name")),
        ("https://api.ipify.org?format=json", ("ip", "", "")),
    ]
    for url, keys in providers:
        try:
            request = Request(url, headers={"User-Agent": f"FlowDashboard/{APP_VERSION}"})
            with urlopen(request, timeout=5) as response:
                data = json.loads(response.read().decode("utf-8", errors="ignore"))
            if data.get("success") is False:
                continue
            ip_key, country_code_key, country_name_key = keys
            public_ip = str(data.get(ip_key, "")).strip()
            if not public_ip:
                continue
            return {
                "publicIp": public_ip,
                "countryCode": str(data.get(country_code_key, "")).strip().upper() if country_code_key else "",
                "countryName": str(data.get(country_name_key, "")).strip() if country_name_key else "",
            }
        except Exception:
            continue
    return {"publicIp": "", "countryCode": "", "countryName": ""}


def get_client_info():
    hostname = socket.gethostname()
    try:
        windows_user = getpass.getuser()
    except Exception:
        windows_user = os.getenv("USERNAME", "")
    raw_hash = "|".join([
        hostname,
        windows_user,
        platform.platform(),
        str(uuid.getnode()),
    ])
    device_hash = hashlib.sha256(raw_hash.encode("utf-8", errors="ignore")).hexdigest()
    public_info = get_pc_public_ip_info()
    return {
        "hostname": hostname,
        "windowsUser": windows_user,
        "deviceHash": device_hash,
        "os": platform.platform(),
        "appVersion": APP_VERSION,
        "adb": ADB,
        "baseDir": str(BASE_DIR),
        "resourceDir": str(RESOURCE_DIR),
        "dataDir": str(DATA_DIR),
        "adbExists": bool(ADB and Path(ADB).exists()),
        "adbCandidates": [str(path) for path in candidate_adb_paths()[:12]],
        "localIp": get_pc_local_ip(),
        "publicIp": public_info.get("publicIp", ""),
        "countryCode": public_info.get("countryCode", ""),
        "countryName": public_info.get("countryName", ""),
        "macAddress": get_pc_mac_address(),
        "flowAgentApk": str(FLOW_AGENT_APK),
        "flowAgentApkExists": FLOW_AGENT_APK.exists(),
    }


def get_installed_package_version(serial, package_name):
    return get_installed_package_info(serial, package_name).get("versionName", "")


def get_installed_package_info(serial, package_name):
    try:
        output = adb(["-s", serial, "shell", "dumpsys", "package", package_name], timeout=20)
    except Exception:
        return {"versionName": "", "versionCode": 0}
    name_match = re.search(r"versionName=([^\s]+)", output)
    code_match = re.search(r"versionCode=(\d+)", output)
    try:
        version_code = int(code_match.group(1)) if code_match else 0
    except Exception:
        version_code = 0
    return {
        "versionName": name_match.group(1).strip() if name_match else "",
        "versionCode": version_code,
    }


FLOW_AGENT_ACCESSIBILITY_COMPONENT = "com.flowlogin.agent/com.flowlogin.agent.FlowAccessibilityService"
FLOW_AGENT_ACCESSIBILITY_COMPONENT_SHORT = "com.flowlogin.agent/.FlowAccessibilityService"
FLOW_AGENT_AUTOJS_ACCESSIBILITY_COMPONENT = "com.flowlogin.agent/org.autojs.autojs.core.accessibility.AccessibilityServiceUsher"


def normalize_accessibility_component(value):
    text = str(value or "").strip()
    if text == FLOW_AGENT_ACCESSIBILITY_COMPONENT_SHORT:
        return FLOW_AGENT_ACCESSIBILITY_COMPONENT
    return text


def get_enabled_accessibility_components(serial):
    try:
        raw = adb(["-s", serial, "shell", "settings", "get", "secure", "enabled_accessibility_services"], timeout=20)
    except Exception:
        return []
    return [
        normalize_accessibility_component(item)
        for item in raw.strip().split(":")
        if item.strip() and item.strip().lower() != "null"
    ]


def extract_accessibility_section(output, title):
    pattern = rf"{re.escape(title)}\s*\{{(?P<body>.*?)(?:\n\s*\}}\s*(?:\n\s*[a-zA-Z ]+ services:|\n\nWindow|\Z))"
    match = re.search(pattern, output or "", re.S)
    return match.group("body") if match else ""


def flow_agent_accessibility_state(serial):
    enabled_components = get_enabled_accessibility_components(serial)
    enabled = (
        FLOW_AGENT_AUTOJS_ACCESSIBILITY_COMPONENT in enabled_components
        or FLOW_AGENT_ACCESSIBILITY_COMPONENT in enabled_components
    )
    state = {
        "enabled": enabled,
        "enabledComponents": enabled_components,
        "bound": False,
        "binding": False,
        "deadBinding": False,
    }
    try:
        dump = adb(["-s", serial, "shell", "dumpsys", "accessibility"], timeout=30)
        bound_body = extract_accessibility_section(dump, "bound services:")
        binding_body = extract_accessibility_section(dump, "binding services:")
        state["bound"] = "packageName=com.flowlogin.agent" in bound_body or "Service[label=FlowAgent" in bound_body
        state["binding"] = "com.flowlogin.agent" in binding_body
    except Exception:
        pass
    try:
        services = adb(["-s", serial, "shell", "dumpsys", "activity", "services", FLOW_AGENT_PACKAGE], timeout=30)
        state["deadBinding"] = "DEAD" in services and "com.flowlogin.agent" in services
    except Exception:
        pass
    return state


def describe_flow_agent_accessibility_state(state):
    if state.get("bound"):
        return "Accesibilidad FlowAgent enlazada por Android."
    if state.get("enabled") and (state.get("binding") or state.get("deadBinding")):
        return (
            "Accesibilidad FlowAgent aparece habilitada, pero Android dejo el servicio "
            "en binding/dead. Abre Accesibilidad y apaga/prende FlowAgent una vez."
        )
    if state.get("enabled"):
        return "Accesibilidad FlowAgent aparece habilitada; Android aun no enlazo el servicio."
    return "Accesibilidad FlowAgent no esta activa; activa el servicio FlowAgent en Android."


def flow_agent_install_mode(value):
    if isinstance(value, bool):
        return "force" if value else "skip"
    mode = str(value or "").strip().lower()
    if mode in {"auto", "if_needed", "if-needed", "needed", "missing"}:
        return "auto"
    if mode in {"true", "1", "yes", "force", "install", "update"}:
        return "force"
    return "skip"


def setup_flow_agent(device_ids="all", install=True, launch=True, open_accessibility=False):
    serials = get_target_serials(device_ids)
    if not serials:
        raise RuntimeError("No hay dispositivos conectados.")

    install_mode = flow_agent_install_mode(install)
    launch = bool(launch)
    open_accessibility = bool(open_accessibility)
    if install_mode in {"force", "auto"} and not FLOW_AGENT_APK.exists():
        raise RuntimeError(f"No se encontro la APK FlowAgent: {FLOW_AGENT_APK}")

    outputs = []
    for serial in serials:
        lines = [f"[{serial}]"]
        try:
            android_id = get_device_android_id(serial)
            if android_id:
                lines.append(f"Android ID: {android_id}")

            # @Added by FlowDashboard Etapa B on 2026-05-27.
            #   Forzar orientacion vertical en el dispositivo antes de cualquier
            #   accion del FlowAgent. La MainActivity del monolito ya declara
            #   screenOrientation="portrait" en el manifest, pero esto cubre
            #   tambien al sistema operativo y a las apps invocadas (Spotify, etc).
            try:
                lock_device_portrait(serial)
                lines.append("Orientacion: vertical (auto-rotate OFF)")
            except Exception:
                pass

            adb(["-s", serial, "reverse", f"tcp:{AGENT_PORT}", f"tcp:{AGENT_PORT}"], timeout=20)
            lines.append(f"Reverse activo: 127.0.0.1:{AGENT_PORT} -> PC:{AGENT_PORT}")
            adb(["-s", serial, "reverse", "tcp:5000", "tcp:5000"], timeout=20)
            lines.append("Reverse activo: 127.0.0.1:5000 -> PC:5000")

            # @Added by FlowDashboard Etapa B (Fase 8) on 2026-05-27.
            #   El monolito necesita READ_EXTERNAL_STORAGE para que ScriptRunner
            #   pueda leer scripts .js desde /sdcard/. Sin esto, AutoJs6 tira
            #   FileNotFoundException al parsear el header del archivo.
            #   pm grant es idempotente; si ya esta concedido devuelve "ok".
            try:
                adb(["-s", serial, "shell", "pm", "grant", FLOW_AGENT_PACKAGE,
                     "android.permission.READ_EXTERNAL_STORAGE"], timeout=10)
            except Exception:
                pass  # No bloquea si el permiso no existe en el manifest (FlowAgent 0.3.8)

            should_install = install_mode == "force"
            installed_version = get_installed_package_version(serial, FLOW_AGENT_PACKAGE) if install_mode == "auto" else ""
            if install_mode == "auto":
                if not installed_version:
                    should_install = True
                    lines.append("FlowAgent no estaba instalado; se instalara una vez.")
                elif version_tuple(installed_version) < version_tuple(FLOW_AGENT_EXPECTED_VERSION):
                    should_install = True
                    lines.append(f"FlowAgent {installed_version} es antiguo; se actualizara a {FLOW_AGENT_EXPECTED_VERSION}.")
                else:
                    lines.append(f"FlowAgent ya instalado ({installed_version}); no se reinstala.")

            if should_install:
                result = adb(["-s", serial, "install", "-r", str(FLOW_AGENT_APK)], timeout=180)
                lines.append(result or "FlowAgent instalado/actualizado.")

            if launch:
                adb([
                    "-s", serial, "shell", "am", "start",
                    "-n", FLOW_AGENT_ACTIVITY,
                    "--es", "host", "127.0.0.1",
                    "--es", "serial", serial,
                    "--ei", "port", str(AGENT_PORT),
                    "--ez", "autoconnect", "true",
                ], timeout=25)
                lines.append("FlowAgent abierto con host 127.0.0.1 y puerto 8766.")
                time.sleep(1.2)

            accessibility_state = flow_agent_accessibility_state(serial)
            lines.append(describe_flow_agent_accessibility_state(accessibility_state))

            if open_accessibility:
                adb(["-s", serial, "shell", "am", "start", "-a", "android.settings.ACCESSIBILITY_SETTINGS"], timeout=20)
                lines.append("Ajustes de accesibilidad abiertos.")
            elif not accessibility_state.get("bound"):
                lines.append("Si no aparece conectado, usa el boton manual de preparar FlowAgent para abrir Accesibilidad.")
        except Exception as exc:
            lines.append(f"ERROR: {exc}")
        outputs.append("\n".join(lines))

    return "\n\n".join(outputs)


def safe_payload_name(serial):
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", serial)[:80] or "device"


def autojs_launch_commands(package, remote):
    if package == "youhu.laixijs":
        return [
            ["shell", "am", "start", "-n", "youhu.laixijs/.LaixiActivity"],
            [
                "shell", "am", "broadcast",
                "-n", "youhu.laixijs/common.core.broadcastReceiver.AutoScriptReceiver",
                "-a", "com.laixi.auto.script",
                "-e", "path", remote,
                "-e", "script", remote,
                "-e", "file", remote,
            ],
            [
                "shell", "am", "broadcast",
                "-n", "youhu.laixijs/common.core.broadcastReceiver.AutoXReceiver",
                "-a", "com.laixi.autox",
                "-e", "path", remote,
                "-e", "script", remote,
                "-e", "file", remote,
            ],
        ]
    if package == "org.autojs.autojs6":
        # AutoJs6 conserva el namespace interno `org.autojs.autojs.external.open`
        # aunque el packageName del APK sea `org.autojs.autojs6`. Verificado con
        # `aapt dump xmltree` sobre la APK 6.7.0 universal.
        return [
            ["shell", "am", "start",
             "-n", f"{package}/org.autojs.autojs.external.open.RunIntentActivity",
             "-a", "android.intent.action.VIEW",
             "-d", f"file://{remote}"],
        ]
    return [
        ["shell", "am", "start", "-n", f"{package}/.external.open.RunIntentActivity", "-d", f"file://{remote}"],
        ["shell", "am", "broadcast", "-a", f"{package}.action.RUN_SCRIPT", "-e", "path", remote],
    ]


def normalize_clone_filter(clone=None, clones=None):
    values = []
    if clones not in (None, ""):
        raw_values = clones if isinstance(clones, list) else str(clones).split(",")
        for raw in raw_values:
            try:
                clone_number = int(raw)
            except Exception:
                continue
            if 1 <= clone_number <= 10 and clone_number not in values:
                values.append(clone_number)
    if clone not in (None, ""):
        try:
            clone_number = int(clone)
        except Exception:
            clone_number = 0
        if 1 <= clone_number <= 10 and clone_number not in values:
            values.append(clone_number)
    return set(values)


def resolve_local_script_path(file_path):
    raw_path = str(file_path or "").strip()
    script = Path(raw_path)
    if script.exists() and script.is_file():
        return script.resolve()

    if script.name:
        for base in unique_paths([RESOURCE_DIR, BASE_DIR]):
            for candidate in (base / script.name, base / "scripts" / script.name):
                if candidate.exists() and candidate.is_file():
                    return candidate.resolve()
            try:
                for child in base.iterdir():
                    if child.is_file() and child.name.lower() == script.name.lower():
                        return child.resolve()
            except Exception:
                pass
    return script


def flowlogin_mode_allows_status(mode, status):
    mode = str(mode or "").strip().lower()
    status = str(status or "pending").strip().lower() or "pending"
    if mode == "pending-only":
        return status == "pending"
    if mode == "retry-all":
        return status in LOGIN_RETRY_AFTER_CLEAR_STATUSES
    return True


def prepare_flowlogin_payload(serial, clone=None, clones=None, delimiter=":", is_register=False, register_lines=None, mode=None):
    key = resolve_device_profile_key(serial)
    names = load_device_names()
    names, migrated = migrate_device_profile_key(names, serial, key)
    profile = names.get(key, {"name": "", "person": "", "accountStatuses": []})

    if is_register and register_lines and serial in register_lines:
        # FlowRegister: las cuentas vienen directamente del frontend.
        # NO tocar profile["person"] ni profile["accountStatuses"]: esos
        # pertenecen exclusivamente a FlowLogin y no deben mezclarse.
        lines = [str(l).strip() for l in register_lines[serial] if str(l).strip()]
        statuses = []
        for index, line in enumerate(lines):
            clone_num = index + 1
            statuses.append({
                "accountId": account_id_for(serial, clone_num, line),
                "clone": clone_num,
                "package": spotify_package_for_clone(clone_num),
                "line": line,
                "status": "pending",
                "message": "",
                "attempts": 0,
                "updatedAt": ""
            })
        # Solo guardar migracion de clave si ocurrio; no tocar el perfil.
        if migrated:
            save_device_names(names)
        payload = {
            "device": serial,
            "maxClones": 10,
            "delimiter": str(delimiter or ":"),
            "statusPath": FLOWLOGIN_STATUS_REMOTE,
            "accounts": [dict(s, isRegister=True, freshStart=False) for s in statuses],
        }
        local_path = FLOWLOGIN_PAYLOAD_DIR / f"{safe_payload_name(serial)}_accounts.json"
        with local_path.open("w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
        return local_path, len(statuses)

    # --- FlowLogin normal: lee perfil guardado del telefono ---
    statuses = normalize_account_statuses(key, profile.get("person", ""), profile.get("accountStatuses", []))
        
    clone_filter = normalize_clone_filter(clone=clone, clones=clones)
    accounts = []
    for item in statuses:
        try:
            item_clone = int(item.get("clone", 0))
        except Exception:
            item_clone = 0
        if clone_filter and item_clone not in clone_filter:
            continue
        if not flowlogin_mode_allows_status(mode, item.get("status", "pending")):
            continue
        pending = dict(item)
        pending["package"] = spotify_package_for_clone(item_clone)
        pending["status"] = "pending"
        pending["message"] = ""
        pending["attempts"] = 0
        pending["freshStart"] = bool(clone_filter)
        pending["isRegister"] = is_register
        accounts.append(pending)

    for item in statuses:
        try:
            item_clone = int(item.get("clone", 0))
        except Exception:
            item_clone = 0
        if clone_filter and item_clone not in clone_filter:
            continue
        if not flowlogin_mode_allows_status(mode, item.get("status", "pending")):
            continue
        item["status"] = "pending"
        item["message"] = ""
        item["attempts"] = 0
        item["updatedAt"] = ""
    profile["accountStatuses"] = statuses
    if profile.get("name") or profile.get("person") or statuses:
        names[key] = profile
        migrated = True
    if migrated:
        save_device_names(names)

    payload = {
        "device": serial,
        "maxClones": 10,
        "delimiter": str(delimiter or ":"),
        "statusPath": FLOWLOGIN_STATUS_REMOTE,
        "accounts": accounts,
    }
    local_path = FLOWLOGIN_PAYLOAD_DIR / f"{safe_payload_name(serial)}_accounts.json"
    with local_path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    return local_path, len(accounts)


def read_remote_flowlogin_status(serial):
    try:
        raw = adb(["-s", serial, "shell", "cat", FLOWLOGIN_STATUS_REMOTE], timeout=3)
    except Exception:
        return None
    raw = str(raw or "").strip()
    if not raw or raw.lower().startswith("cat:"):
        return None
    try:
        payload = json.loads(raw)
    except Exception:
        return None
    if not isinstance(payload, dict) or not isinstance(payload.get("items"), list):
        return None
    return payload


def mark_remote_flowlogin_stopped(serial, message="Detenido por usuario"):
    payload = read_remote_flowlogin_status(serial)
    if not payload:
        return 0
    items = payload.get("items", [])
    if not isinstance(items, list):
        return 0

    stopped = 0
    updated_at = now_iso()
    for item in items:
        if not isinstance(item, dict):
            continue
        status = str(item.get("status", "") or "").lower()
        if status not in {"running", "retrying", "waiting_mail"}:
            continue
        item["status"] = "review"
        item["message"] = message
        item["updatedAt"] = updated_at
        item.pop("flowMail", None)
        stopped += 1
        try:
            clone = int(item.get("clone", 0) or 0)
        except Exception:
            clone = 0
        if clone:
            set_device_account_status(
                serial,
                clone,
                "review",
                message,
                attempts=int(item.get("attempts", 0) or 0),
                line=item.get("line"),
            )

    if not stopped:
        return 0

    summary = {status: 0 for status in FLOWLOGIN_ALLOWED_STATUSES}
    for item in items:
        if not isinstance(item, dict):
            continue
        status = str(item.get("status", "pending") or "pending").lower()
        if status not in summary:
            status = "review"
            item["status"] = status
        summary[status] = summary.get(status, 0) + 1
    payload["summary"] = summary
    payload["updatedAt"] = updated_at

    local_path = FLOWLOGIN_PAYLOAD_DIR / f"{safe_payload_name(serial)}_status_stop.json"
    try:
        FLOWLOGIN_PAYLOAD_DIR.mkdir(parents=True, exist_ok=True)
        with local_path.open("w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
        adb(["-s", serial, "push", str(local_path), FLOWLOGIN_STATUS_REMOTE], timeout=20)
    finally:
        try:
            local_path.unlink()
        except Exception:
            pass
    return stopped


def build_flowlogin_progress_map(serials):
    names = load_device_names()
    progress = {}
    for serial in serials:
        key = resolve_device_profile_key(serial)
        profile = names.get(key, names.get(serial, {})) if isinstance(names, dict) else {}
        statuses = profile.get("accountStatuses", []) if isinstance(profile, dict) else []
        clone_map = {}
        for item in statuses if isinstance(statuses, list) else []:
            if not isinstance(item, dict):
                continue
            try:
                clone = int(item.get("clone", 0))
            except Exception:
                clone = 0
            if clone <= 0:
                continue
            clone_map[f"clone{clone}"] = {
                "status": str(item.get("status", "pending") or "pending"),
                "line": str(item.get("line", "") or ""),
                "message": str(item.get("message", "") or ""),
                "attempts": int(item.get("attempts", 0) or 0),
                "updatedAt": str(item.get("updatedAt", "") or ""),
            }
            if isinstance(item.get("flowMail"), dict):
                clone_map[f"clone{clone}"]["flowMail"] = {
                    "email": str(item["flowMail"].get("email", "") or ""),
                    "requestedAt": str(item["flowMail"].get("requestedAt", "") or ""),
                    "package": str(item["flowMail"].get("package", "") or ""),
                    "requireRecent": bool(item["flowMail"].get("requireRecent")),
                }
        if clone_map:
            progress[serial] = clone_map
            if key and key != serial:
                progress[key] = clone_map
    return progress


def flowmail_parse_time(value):
    text = str(value or "").strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        return datetime.fromisoformat(text).astimezone(timezone.utc)
    except Exception:
        return None


def flowmail_mask_email(value):
    text = str(value or "").strip()
    if "@" not in text:
        return "***" if text else ""
    user, domain = text.split("@", 1)
    if len(user) <= 2:
        return "***@" + domain
    return user[:2] + "***@" + domain


def flowmail_url_fingerprint(url):
    text = str(url or "").strip()
    if not text:
        return ""
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()[:16]


def flowmail_forget_old_opened_urls(max_age_seconds=14400):
    cutoff = time.time() - max_age_seconds
    for key, opened_at in list(FLOWMAIL_OPENED_URLS.items()):
        try:
            if float(opened_at) < cutoff:
                FLOWMAIL_OPENED_URLS.pop(key, None)
        except Exception:
            FLOWMAIL_OPENED_URLS.pop(key, None)


def flowmail_search_link(target_email, requested_at, require_recent=False):
    payload = {
        "targetEmail": str(target_email or "").strip(),
        "requestedAfterUtc": (requested_at or datetime.now(timezone.utc)).isoformat(),
        "requireRecent": bool(require_recent),
    }
    body = json.dumps(payload).encode("utf-8")
    req = Request(
        "http://localhost:5000/api/mail/search-spotify-link",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(req, timeout=20) as response:
        result = json.loads(response.read().decode("utf-8", errors="ignore"))
    if not isinstance(result, dict) or not result.get("found"):
        return ""
    url = str(result.get("url", "") or "").strip()
    if not url.lower().startswith("https://accounts.spotify.com/login/ott/music"):
        return ""
    return url


def flowmail_open_link(serial, package_name, url):
    serial = str(serial or "").strip()
    package_name = str(package_name or "").strip()
    url = str(url or "").strip()
    if not serial or not package_name or not url:
        return False
    adb_shell(
        serial,
        "am start -a android.intent.action.VIEW "
        f"-d {_shell_quote(url)} "
        f"-p {_shell_quote(package_name)}",
        timeout=20,
    )
    return True


def process_flowmail_waiting(serial, status_payload):
    items = status_payload.get("items", []) if isinstance(status_payload, dict) else []
    if not isinstance(items, list):
        return
    for item in items:
        if not isinstance(item, dict):
            continue
        if str(item.get("status", "") or "").lower() != "waiting_mail":
            continue
        flow_mail = item.get("flowMail") if isinstance(item.get("flowMail"), dict) else {}
        target_email = str(flow_mail.get("email", "") or "").strip()
        package_name = str(flow_mail.get("package", "") or item.get("package", "") or "").strip()
        requested_at = flowmail_parse_time(flow_mail.get("requestedAt")) or datetime.now(timezone.utc)
        require_recent = bool(flow_mail.get("requireRecent"))
        clone = str(item.get("clone", "") or "").strip()
        request_key = f"{serial}|{clone}|{target_email}|{flow_mail.get('requestedAt', '')}"
        if not target_email or not package_name or FLOWMAIL_OPENED_LINKS.get(request_key):
            continue
        try:
            link = flowmail_search_link(target_email, requested_at, require_recent=require_recent)
            if not link:
                print(f"[FlowMail] Sin link para {serial} clone {clone} ({package_name}) destinatario {flowmail_mask_email(target_email)}.")
                continue
            flowmail_forget_old_opened_urls()
            link_fingerprint = flowmail_url_fingerprint(link)
            url_key = f"{serial}|{clone}|{target_email}|{link_fingerprint}"
            if link_fingerprint and FLOWMAIL_OPENED_URLS.get(url_key):
                print(f"[FlowMail] Link ya abierto para {serial} clone {clone} ({package_name}); esperando enlace nuevo para {flowmail_mask_email(target_email)}.")
                continue
            if flowmail_open_link(serial, package_name, link):
                FLOWMAIL_OPENED_LINKS[request_key] = time.time()
                if link_fingerprint:
                    FLOWMAIL_OPENED_URLS[url_key] = time.time()
                print(f"[FlowMail] Link abierto para {serial} clone {clone} ({package_name}); token oculto.")
        except Exception as exc:
            print(f"[FlowMail] No se pudo procesar magic link para {serial} clone {clone}: {exc}")


def refresh_login_statuses(device_ids="all"):
    serials = get_target_serials(device_ids)
    names = load_device_names()
    outputs = []
    for serial in serials:
        key = resolve_device_profile_key(serial)
        names, migrated = migrate_device_profile_key(names, serial, key)
        if migrated:
            save_device_names(names)
        remote_status = read_remote_flowlogin_status(serial)
        remote_running = False
        if remote_status:
            try:
                update_device_account_statuses(serial, remote_status)
                process_flowmail_waiting(serial, remote_status)
                names = load_device_names()
                summary = remote_status.get("summary", {}) if isinstance(remote_status, dict) else {}
                remote_running = bool(
                    int(summary.get("running", 0) or 0) or
                    int(summary.get("retrying", 0) or 0) or
                    int(summary.get("waiting_mail", 0) or 0)
                )
            except Exception:
                remote_running = False
        profile = names.get(key, {}) if isinstance(names, dict) else {}
        statuses = profile.get("accountStatuses", []) if isinstance(profile, dict) else []
        with FLOWLOGIN_JOBS_LOCK:
            running = serial in FLOWLOGIN_JOBS or remote_running
        stale_count = 0
        if not running:
            for item in statuses:
                if not isinstance(item, dict):
                    continue
                status = str(item.get("status", "") or "").lower()
                if status not in {"running", "retrying"}:
                    continue
                try:
                    clone = int(item.get("clone", 0))
                except Exception:
                    clone = 0
                if clone:
                    set_device_account_status(
                        serial,
                        clone,
                        "review",
                        "Ejecucion FlowAgent no activa; estado revisado por el dashboard.",
                        attempts=int(item.get("attempts", 0) or 0),
                        line=item.get("line"),
                    )
                    stale_count += 1
        outputs.append(f"[{serial}] estados locales FlowAgent: {len(statuses)} cuenta(s){' en ejecucion' if running else ''}")
        if stale_count:
            outputs[-1] += f"; {stale_count} estado(s) colgado(s) pasaron a revision"
    return "\n".join(outputs)


# @Added by FlowDashboard Etapa C on 2026-05-28.
#   Setup ultra-idempotente para abrir el dashboard sin reinstalar el APK
#   en cada arranque. El flujo es:
#     1) listar dispositivos.
#     2) para cada uno: comprobar si FlowAgent esta instalado y la version.
#     3) instalar SOLO si falta o esta desactualizado.
#     4) conceder permisos SOLO los que faltan.
#     5) habilitar accessibility/IME SOLO si no estan ya activos.
#     6) lanzar la activity SOLO si el agente NO esta ya conectado al socket.
#   Devuelve un dict con detalle por device para que el frontend muestre que se
#   hizo y que no.
def setup_flow_agent_smart(device_ids="all", request_capture=False, force_relaunch=True):
    serials = get_target_serials(device_ids)
    if not serials:
        return {"ok": False, "error": "No hay dispositivos conectados.", "devices": []}

    apk_path = FLOW_AGENT_APK
    apk_exists = apk_path.exists() if apk_path else False

    # Cache de agents por serial para no llamar list_agents() N veces
    try:
        agents = list_agents()
    except Exception:
        agents = []
    connected_serials = {str(a.get("serial") or "").strip() for a in agents}

    # Permisos requeridos
    required_perms = [
        "android.permission.WRITE_SECURE_SETTINGS",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
    ]

    devices_result = []

    for serial in serials:
        report = {
            "serial": serial,
            "actions": [],
            "skipped": [],
            "errors": [],
            "agentVersion": "",
            "agentVersionCode": 0,
            "expectedVersion": FLOW_AGENT_EXPECTED_VERSION,
            "expectedVersionCode": FLOW_AGENT_EXPECTED_VERSION_CODE,
            "agentConnected": serial in connected_serials,
            "didInstall": False,
            "alreadyLatest": False,
            "accessibilityReady": False,
            "socketReady": False,
            "captureReady": False,
        }
        try:
            # Lock vertical (idempotente — settings put no devuelve nada si ya estan)
            try:
                lock_device_portrait(serial)
                report["skipped"].append("Orientacion ya en vertical o forzada")
            except Exception as exc:
                report["errors"].append(f"lock_portrait: {exc}")

            # ADB reverse (idempotente — el servidor ADB sobrescribe si ya existia)
            try:
                adb(["-s", serial, "reverse", f"tcp:{AGENT_PORT}", f"tcp:{AGENT_PORT}"], timeout=10)
                adb(["-s", serial, "reverse", "tcp:8765", "tcp:8765"], timeout=10)
                adb(["-s", serial, "reverse", "tcp:5000", "tcp:5000"], timeout=10)
                report["actions"].append("reverse 8766+8765+5000 OK")
            except Exception as exc:
                report["errors"].append(f"reverse: {exc}")

            # Install solo si necesario
            try:
                installed_info = get_installed_package_info(serial, FLOW_AGENT_PACKAGE)
            except Exception:
                installed_info = {"versionName": "", "versionCode": 0}
            installed_version = str(installed_info.get("versionName") or "")
            installed_code = int(installed_info.get("versionCode") or 0)
            report["agentVersion"] = installed_version
            report["agentVersionCode"] = installed_code

            should_install = False
            if not installed_version:
                should_install = True
                report["actions"].append("APK no instalado: se instalara")
            elif version_tuple(installed_version) < version_tuple(FLOW_AGENT_EXPECTED_VERSION):
                should_install = True
                report["actions"].append(f"APK {installed_version} < {FLOW_AGENT_EXPECTED_VERSION}: actualizar")
            elif installed_code and installed_code < FLOW_AGENT_EXPECTED_VERSION_CODE:
                should_install = True
                report["actions"].append(f"APK versionCode {installed_code} < {FLOW_AGENT_EXPECTED_VERSION_CODE}: actualizar")
            else:
                report["skipped"].append(f"APK ya en {installed_version} ({installed_code})")
                report["alreadyLatest"] = True

            if should_install:
                if not apk_exists:
                    report["errors"].append(f"APK no encontrado: {apk_path}")
                else:
                    try:
                        try:
                            adb(["-s", serial, "shell", "am", "force-stop", FLOW_AGENT_PACKAGE], timeout=10)
                        except Exception:
                            pass
                        result = adb(["-s", serial, "install", "-r", str(apk_path)], timeout=180)
                        report["actions"].append(str(result or "install OK"))
                        report["didInstall"] = True
                        installed_info = get_installed_package_info(serial, FLOW_AGENT_PACKAGE)
                        report["agentVersion"] = installed_info.get("versionName", "")
                        report["agentVersionCode"] = int(installed_info.get("versionCode") or 0)
                    except Exception as exc:
                        report["errors"].append(f"install: {exc}")

            # Permisos: solo grant los que falten
            package_dump = ""
            try:
                package_dump = adb(["-s", serial, "shell", "dumpsys", "package", FLOW_AGENT_PACKAGE], timeout=10) or ""
            except Exception:
                package_dump = ""
            for perm in required_perms:
                try:
                    if perm in package_dump and "granted=true" in package_dump.split(perm, 1)[1].split("\n", 1)[0]:
                        report["skipped"].append(f"perm {perm.split('.')[-1]} ya concedido")
                        continue
                except Exception:
                    pass
                try:
                    adb(["-s", serial, "shell", "pm", "grant", FLOW_AGENT_PACKAGE, perm], timeout=10)
                    report["actions"].append(f"grant {perm.split('.')[-1]}")
                except Exception:
                    pass  # Idempotente, ignorar

            # Overlay (SYSTEM_ALERT_WINDOW) via appops — necesario para que el
            # FlowAgent pueda mostrar overlays y para la captura de pantalla.
            try:
                adb(["-s", serial, "shell", "appops", "set",
                     FLOW_AGENT_PACKAGE, "SYSTEM_ALERT_WINDOW", "allow"], timeout=8)
                report["actions"].append("overlay SYSTEM_ALERT_WINDOW allow")
            except Exception as exc:
                report["errors"].append(f"overlay: {exc}")

            # Accessibility: el monolito usa el servicio AutoJs6 Usher. No se
            # reactiva el FlowAccessibilityService legacy para evitar doble canal.
            try:
                current = (adb(["-s", serial, "shell", "settings", "get", "secure",
                                "enabled_accessibility_services"], timeout=8) or "").strip()
                expected = FLOW_AGENT_AUTOJS_ACCESSIBILITY_COMPONENT
                components = [
                    item for item in [
                        normalize_accessibility_component(part)
                        for part in current.split(":")
                        if part.strip() and part.strip().lower() != "null"
                    ]
                    if item and not item.startswith(f"{FLOW_AGENT_PACKAGE}/")
                ]
                components.append(expected)
                desired = ":".join(dict.fromkeys(components))
                if expected not in components or current != desired:
                    adb(["-s", serial, "shell", "settings", "put", "secure",
                         "accessibility_enabled", "0"], timeout=8)
                    adb(["-s", serial, "shell", "settings", "put", "secure",
                         "enabled_accessibility_services", desired], timeout=8)
                    adb(["-s", serial, "shell", "settings", "put", "secure",
                         "accessibility_enabled", "1"], timeout=8)
                    report["actions"].append("accessibility AutoJs6 activada")
                else:
                    report["skipped"].append("accessibility AutoJs6 ya activa")
            except Exception as exc:
                report["errors"].append(f"accessibility: {exc}")
            try:
                acc_state = flow_agent_accessibility_state(serial)
                report["accessibilityReady"] = bool(acc_state.get("enabled"))
            except Exception:
                report["accessibilityReady"] = False

            # FlowKeyboard IME: habilitar solo si no esta
            try:
                current_ime = (adb(["-s", serial, "shell", "settings", "get", "secure",
                                    "default_input_method"], timeout=8) or "").strip()
                expected_ime = f"{FLOW_AGENT_PACKAGE}/.FlowKeyboardService"
                if expected_ime not in current_ime:
                    adb(["-s", serial, "shell", "ime", "enable", expected_ime], timeout=8)
                    adb(["-s", serial, "shell", "ime", "set", expected_ime], timeout=8)
                    report["actions"].append("FlowKeyboard establecido como IME")
                else:
                    report["skipped"].append("FlowKeyboard ya es IME default")
            except Exception:
                pass

            # Launch activity si se pidio forzar relaunch o si aun no hay socket.
            if report["agentConnected"] and not force_relaunch:
                report["skipped"].append("agent ya conectado al socket; no relaunch")
            else:
                try:
                    adb([
                        "-s", serial, "shell", "am", "start",
                        "-n", FLOW_AGENT_ACTIVITY,
                        "--es", "host", "127.0.0.1",
                        "--es", "serial", serial,
                        "--ei", "port", str(AGENT_PORT),
                        "--ez", "autoconnect", "true",
                    ], timeout=10)
                    report["actions"].append("MainActivity lanzada con autoconnect")
                except Exception as exc:
                    report["errors"].append(f"launch: {exc}")

            # Esperar socket fresco y validar motor.
            agent_conn = None
            for _ in range(12):
                agent_conn = agent_for_serial(serial)
                if agent_conn:
                    report["agentConnected"] = True
                    report["socketReady"] = True
                    break
                time.sleep(0.8)
            if agent_conn:
                try:
                    probe = send_agent_command(agent_conn.agent_id, {"name": "engine_probe"}, timeout=12)
                    result = probe.get("result", probe) if isinstance(probe, dict) else {}
                    if result.get("ok"):
                        report["actions"].append("engine_probe OK")
                    else:
                        report["errors"].append(f"engine_probe: {result.get('error') or result}")
                except Exception as exc:
                    report["errors"].append(f"engine_probe: {exc}")
            else:
                report["errors"].append("socket: FlowAgent no conecto despues del launch")

            if request_capture and agent_conn:
                try:
                    response = send_agent_command(
                        agent_conn.agent_id,
                        {"name": "capture_screen_start", "streamFrames": False},
                        timeout=18,
                    )
                    result = response.get("result", response) if isinstance(response, dict) else {}
                    if result.get("ok"):
                        report["captureReady"] = True
                        report["actions"].append("captura activa")
                    else:
                        if accept_media_projection_dialog(serial, timeout=8):
                            time.sleep(1.5)
                            report["captureReady"] = True
                            report["actions"].append("permiso de captura aceptado")
                        else:
                            report["skipped"].append("captura pendiente de permiso visible en Android")
                except Exception as exc:
                    if accept_media_projection_dialog(serial, timeout=8):
                        report["captureReady"] = True
                        report["actions"].append("permiso de captura aceptado")
                    else:
                        report["errors"].append(f"capture_screen_start: {exc}")
        except Exception as exc:
            report["errors"].append(str(exc))

        devices_result.append(report)

    summary = {
        "ok": True,
        "total": len(devices_result),
        "installed": sum(1 for d in devices_result if d.get("didInstall")),
        "alreadyLatest": sum(1 for d in devices_result if d.get("alreadyLatest")),
        "connected": sum(1 for d in devices_result if d.get("socketReady")),
        "captureReady": sum(1 for d in devices_result if d.get("captureReady")),
        "needsInstall": sum(1 for d in devices_result if any("se instalara" in a or "actualizar" in a for a in d["actions"])),
        "alreadySetup": sum(1 for d in devices_result if d.get("alreadyLatest") and d.get("socketReady") and not d["errors"]),
        "withErrors": sum(1 for d in devices_result if d["errors"]),
        "devices": devices_result,
    }
    summary["ok"] = summary["withErrors"] == 0
    return summary


def should_retry_after_cache_clear(result):
    if not isinstance(result, dict):
        return False
    status = str(result.get("status", "") or "").lower()
    if status not in LOGIN_RETRY_AFTER_CLEAR_STATUSES:
        return False
    message = str(result.get("message", "") or "")
    if re.search(r"(captcha|verify|verification|2fa|two.factor|too many|detenido|flowagent no conectado|accesibilidad|actualizar|cerrar el clon)", message, re.I):
        return False
    return True


def clear_clone_cache_data(serial, package_name):
    package_name = str(package_name or "").strip()
    if not package_name:
        raise RuntimeError("Paquete del clon no definido.")
    try:
        adb_shell(serial, "am force-stop " + shlex.quote(package_name), timeout=15)
    except Exception:
        pass
    output = adb_shell(serial, "pm clear " + shlex.quote(package_name), timeout=40)
    try:
        adb_shell(serial, "am force-stop " + shlex.quote(package_name), timeout=15)
    except Exception:
        pass
    return output or f"{package_name} cache/datos limpiados"


STORAGE_PERMISSION_PATTERNS = [
    r"^Storage$",
    r"Almacenamiento",
    r"Files and media",
    r"Archivos y contenido multimedia",
    r"Archivos y multimedia",
]


def find_permissions_entry_socket(agent, max_swipes=8):
    for index in range(max_swipes + 1):
        node = agent_find_text_node(agent, [r"^Permissions$", r"^Permisos$"], timeout=1.2, contains=False)
        if node:
            return node
        if index < max_swipes:
            agent_scroll_up(agent)
    return None


def node_center_y(node):
    bounds = agent_bounds(node)
    return bounds["centerY"] if bounds else -10000


def restore_storage_permission_socket(agent):
    permissions = find_permissions_entry_socket(agent)
    if not permissions:
        return "Permisos no encontrado; se continua sin restaurar Storage."
    agent_click_node(agent, permissions)
    time.sleep(1.2)

    nodes = agent_dump(agent, max_nodes=500, timeout=10)
    has_switch = any("switch" in str(node.get("className", "") or "").lower() for node in nodes)

    if has_switch:
        storage_row = agent_find_text_node(agent, STORAGE_PERMISSION_PATTERNS, timeout=2.0, contains=True)
        storage_y = node_center_y(storage_row) if storage_row else -10000
        switches = [
            node for node in agent_dump(agent, max_nodes=500, timeout=10)
            if "switch" in str(node.get("className", "") or "").lower()
        ]
        target = None
        if storage_row:
            for node in switches:
                if abs(node_center_y(node) - storage_y) < 140:
                    target = node
                    break
        if target is None:
            target = next((node for node in switches if not bool(node.get("checked"))), None)
        if target is not None and not bool(target.get("checked")):
            agent_click_node(agent, target)
            time.sleep(0.8)
        agent_result(agent, {"name": "back"}, timeout=8, raise_on_error=False)
        time.sleep(0.9)
        return "Permiso Storage revisado por switch."

    storage_button = agent_find_text_node(agent, STORAGE_PERMISSION_PATTERNS, timeout=2.5, contains=True)
    if not storage_button:
        agent_scroll_up(agent)
        storage_button = agent_find_text_node(agent, STORAGE_PERMISSION_PATTERNS, timeout=1.8, contains=True)
    if storage_button:
        agent_click_node(agent, storage_button)
        time.sleep(1.2)

    allow_node = agent_find_text_node(agent, [r"^Allow$", r"^Permitir$"], timeout=1.5, contains=False)
    if allow_node:
        allow_y = node_center_y(allow_node)
        radios = [
            node for node in agent_dump(agent, max_nodes=500, timeout=10)
            if "radiobutton" in str(node.get("className", "") or "").lower()
        ]
        target_radio = next((node for node in radios if abs(node_center_y(node) - allow_y) < 130), None)
        if target_radio is not None and not bool(target_radio.get("checked")):
            agent_click_node(agent, target_radio)
            time.sleep(0.7)
        elif target_radio is None:
            agent_click_node(agent, allow_node)
            time.sleep(0.7)
    else:
        fallback = agent_find_text_node(
            agent,
            [r"Allow access to media only", r"Allow management of all files", r"Permitir"],
            timeout=1.5,
            contains=True,
        )
        if fallback:
            agent_click_node(agent, fallback)
            time.sleep(0.7)

    agent_result(agent, {"name": "back"}, timeout=8, raise_on_error=False)
    time.sleep(0.9)
    agent_result(agent, {"name": "back"}, timeout=8, raise_on_error=False)
    time.sleep(0.9)
    return "Permiso Storage revisado por pantalla Allow."


def clear_clone_cache_data_visual(serial, package_name):
    package_name = str(package_name or "").strip()
    if not package_name:
        raise RuntimeError("Paquete del clon no definido.")

    agent = agent_for_serial(serial)
    if not agent or not agent_supports_flowlogin(agent):
        raise RuntimeError("FlowAgent no conectado o sin Accesibilidad para limpiar el clon por socket.")

    try:
        agent_open_app_info(agent, package_name)
        time.sleep(2.2)
        agent_ui_has_marker(agent, r"(App info|Informaci.n|Spotify|Almacenamiento|Storage)", timeout=5)

        storage_opened = agent_click_any_text(agent, [
            r"Storage.*cache",
            r"Storage",
            r"Almacenamiento.*cache",
            r"Almacenamiento",
        ], timeout=3)
        if storage_opened:
            time.sleep(1.4)

        agent_click_any_text(agent, [
            r"Clear cache",
            r"Borrar cache",
            r"Borrar cach.",
        ], timeout=2)

        data_clicked = agent_click_any_text(agent, [
            r"Clear data",
            r"Clear storage",
            r"Borrar datos",
            r"Borrar almacenamiento",
            r"Eliminar datos",
        ], timeout=3)
        if data_clicked:
            time.sleep(0.9)
            agent_click_any_text(agent, [
                r"^OK$",
                r"Aceptar",
                r"Delete",
                r"Eliminar",
                r"Borrar",
                r"Clear",
            ], timeout=4)
            time.sleep(1.8)

        if not data_clicked:
            raise RuntimeError("No se encontro Clear data/Borrar datos en App info.")

        agent_result(agent, {"name": "back"}, timeout=8, raise_on_error=False)
        time.sleep(0.9)
        permission_result = restore_storage_permission_socket(agent)
        agent_result(agent, {"name": "home"}, timeout=8, raise_on_error=False)
        return f"{package_name} cache/datos limpiados por socket. {permission_result}"
    except Exception as exc:
        try:
            agent_result(agent, {"name": "home"}, timeout=8, raise_on_error=False)
        except Exception:
            pass
        raise RuntimeError(f"Limpieza por socket fallo: {exc}")


def force_stop_flowlogin_clone(serial, package_name):
    package_name = str(package_name or "").strip()
    if not package_name:
        return
    adb_shell(serial, "am force-stop " + shlex.quote(package_name), timeout=15)
    time.sleep(0.8)


def run_flowlogin_agent_attempt(serial, item, account, attempt, status_label, line, stop_event):
    clone = int(item.get("clone", 0) or 0)
    package_name = spotify_package_for_clone(clone) or str(item.get("package", "") or "").strip()
    if package_name:
        item["package"] = package_name
    if stop_event.is_set():
        return {"status": "review", "message": "Detenido por usuario", "retry": False}
    with FLOWLOGIN_JOBS_LOCK:
        FLOWLOGIN_CURRENT_ITEMS[serial] = item
    if not item.get("isRegister"):
        set_device_account_status(
            serial,
            clone,
            status_label,
            f"C{clone} intento {attempt}: {package_name}",
            attempts=attempt,
            line=line,
        )
    if package_name:
        try:
            force_stop_flowlogin_clone(serial, package_name)
        except Exception as exc:
            return {"status": "review", "message": f"No se pudo cerrar el clon antes de iniciar: {exc}", "retry": True}
    try:
        if item.get("isRegister"):
            return perform_flowregister_agent(serial, item, account, stop_event)
        else:
            return perform_flowlogin_agent(serial, item, account)
    except Exception as exc:
        return {"status": "review", "message": f"FlowAgent runner: {exc}", "retry": True}


def run_flowlogin_agent_job(serial, payload_path, delimiter=":", stop_event=None):
    accounts = []
    stop_event = stop_event or threading.Event()
    try:
        with open(payload_path, "r", encoding="utf-8") as fh:
            payload = json.load(fh)
        accounts = payload.get("accounts", []) if isinstance(payload, dict) else []
        if not accounts:
            return

        agent = agent_for_serial(serial)
        if not agent or not agent_supports_flowlogin(agent):
            message = (
                "FlowAgent no conectado. Pulsa Instalar FlowAgent y activa Accesibilidad."
                if not agent
                else f"FlowAgent debe actualizarse a {FLOW_AGENT_EXPECTED_VERSION} y tener Accesibilidad activa."
            )
            for item in accounts:
                if not isinstance(item, dict):
                    continue
                try:
                    clone = int(item.get("clone", 0))
                except Exception:
                    clone = 0
                if clone:
                    if item.get("isRegister"):
                        with FLOWLOGIN_JOBS_LOCK:
                            if serial not in FLOWREGISTER_RESULTS:
                                FLOWREGISTER_RESULTS[serial] = {}
                            FLOWREGISTER_RESULTS[serial][item.get("line")] = "review"
                    else:
                        set_device_account_status(
                            serial,
                            clone,
                            "review",
                            message,
                            attempts=0,
                            line=item.get("line"),
                        )
            return

        retry_after_clear = []
        for item in accounts:
            if stop_event.is_set():
                break
            if not isinstance(item, dict):
                continue
                
            is_register = item.get("isRegister")
            def update_status(c, st, msg, att, ln):
                if is_register:
                    with FLOWLOGIN_JOBS_LOCK:
                        if serial not in FLOWREGISTER_RESULTS:
                            FLOWREGISTER_RESULTS[serial] = {}
                        FLOWREGISTER_RESULTS[serial][ln] = st
                else:
                    set_device_account_status(serial, c, st, msg, attempts=att, line=ln)
                    
            try:
                clone = int(item.get("clone", 0))
            except Exception:
                clone = 0
            line = str(item.get("line", "") or "").strip()
            account = parse_account_line(line, delimiter=delimiter)
            if not clone:
                continue
            if not account:
                update_status(clone, "error", "Formato invalido: email:password", 0, line)
                continue
            item["package"] = spotify_package_for_clone(clone) or str(item.get("package", "") or "").strip()
            if not item.get("package"):
                update_status(clone, "error", "Paquete del clon no definido", 0, line)
                continue

            final_result = run_flowlogin_agent_attempt(serial, item, account, 1, "running", line, stop_event)
            if stop_event.is_set():
                final_result = {"status": "review", "message": "Detenido por usuario", "retry": False}

            if final_result and final_result.get("status") in LOGIN_SUCCESS_STATUSES:
                update_status(clone, final_result.get("status"), final_result.get("message", ""), 1, line)
            elif final_result and should_retry_after_cache_clear(final_result):
                retry_after_clear.append({
                    "item": dict(item),
                    "account": account,
                    "line": line,
                    "firstResult": final_result,
                })
                update_status(clone, "retrying", "Primer intento fallo; limpiando cache/datos antes del segundo intento.", 1, line)
            elif final_result:
                update_status(clone, final_result.get("status", "review"), final_result.get("message", ""), 1, line)
            with FLOWLOGIN_JOBS_LOCK:
                if FLOWLOGIN_CURRENT_ITEMS.get(serial) is item:
                    FLOWLOGIN_CURRENT_ITEMS.pop(serial, None)
            try:
                agent = agent_for_serial(serial)
                if agent:
                    agent_result(agent, {"name": "home"}, timeout=8, raise_on_error=False)
            except Exception:
                pass
            time.sleep(0.8)
            if stop_event.is_set():
                break

        for retry_item in retry_after_clear:
            if stop_event.is_set():
                break
            item = retry_item["item"]
            account = retry_item["account"]
            line = retry_item["line"]
            is_register = item.get("isRegister")
            
            def update_status(c, st, msg, att, ln):
                if is_register:
                    with FLOWLOGIN_JOBS_LOCK:
                        if serial not in FLOWREGISTER_RESULTS:
                            FLOWREGISTER_RESULTS[serial] = {}
                        FLOWREGISTER_RESULTS[serial][ln] = st
                else:
                    set_device_account_status(serial, c, st, msg, attempts=att, line=ln)
                    
            try:
                clone = int(item.get("clone", 0))
            except Exception:
                clone = 0
            package_name = spotify_package_for_clone(clone) or str(item.get("package", "") or "").strip()
            if package_name:
                item["package"] = package_name
            if not clone or not package_name:
                continue
            update_status(clone, "retrying", "Abriendo App info y limpiando cache/datos del clon antes del segundo intento.", 1, line)
            try:
                clear_clone_cache_data_visual(serial, package_name)
            except Exception as exc:
                update_status(clone, "error", f"No se pudo limpiar cache/datos: {exc}", 1, line)
                continue

            item["freshStart"] = True
            final_result = run_flowlogin_agent_attempt(serial, item, account, 2, "retrying", line, stop_event)
            if stop_event.is_set():
                final_result = {"status": "review", "message": "Detenido por usuario", "retry": False}
            if final_result:
                update_status(clone, final_result.get("status", "review"), final_result.get("message", ""), 2, line)
            with FLOWLOGIN_JOBS_LOCK:
                if FLOWLOGIN_CURRENT_ITEMS.get(serial) is item:
                    FLOWLOGIN_CURRENT_ITEMS.pop(serial, None)
            try:
                agent = agent_for_serial(serial)
                if agent:
                    agent_result(agent, {"name": "home"}, timeout=8, raise_on_error=False)
            except Exception:
                pass
            time.sleep(0.8)
    except Exception as exc:
        for item in accounts:
            if not isinstance(item, dict):
                continue
            try:
                clone = int(item.get("clone", 0))
            except Exception:
                clone = 0
            if clone:
                set_device_account_status(
                    serial,
                    clone,
                    "review",
                    f"FlowLogin FlowAgent se detuvo: {exc}",
                    attempts=int(item.get("attempts", 0) or 0),
                    line=item.get("line"),
                )
    finally:
        with FLOWLOGIN_JOBS_LOCK:
            FLOWLOGIN_JOBS.discard(serial)
            FLOWLOGIN_STOP_EVENTS.pop(serial, None)
            FLOWLOGIN_CURRENT_ITEMS.pop(serial, None)


def start_flowlogin_agent_jobs(serials, clone=None, clones=None, delimiter=":", is_register=False, register_lines=None, mode=None):
    # Normalizar claves de register_lines: el frontend puede mandar deviceKey
    # (mac:...) o legacyDeviceId en vez del serial ADB real. Construimos un
    # mapa inverso para que serial in register_lines siempre funcione.
    if is_register and isinstance(register_lines, dict) and register_lines:
        devices = list_devices()
        key_to_serial = {}
        for device in devices:
            adb_serial = str(device.get("serial", "") or "").strip()
            if not adb_serial:
                continue
            for alias in (
                device.get("deviceKey"),
                device.get("deviceId"),
                device.get("id"),
                device.get("legacyDeviceId"),
                adb_serial,
            ):
                alias = str(alias or "").strip()
                if alias:
                    key_to_serial[alias] = adb_serial
        normalized_rl = {}
        for k, v in register_lines.items():
            real_serial = key_to_serial.get(str(k).strip(), str(k).strip())
            normalized_rl[real_serial] = v
        register_lines = normalized_rl

    outputs = []
    for serial in serials:
        lines = [f"[{serial}]"]
        try:
            with FLOWLOGIN_JOBS_LOCK:
                if serial in FLOWLOGIN_JOBS:
                    lines.append("FlowLogin ya se esta ejecutando en este dispositivo.")
                    outputs.append("\n".join(lines))
                    continue
                FLOWLOGIN_JOBS.add(serial)

            if is_register:
                with FLOWLOGIN_JOBS_LOCK:
                    FLOWREGISTER_RESULTS.pop(serial, None)
                    FLOWREGISTER_PROGRESS.pop(serial, None)

            payload_path, account_count = prepare_flowlogin_payload(serial, clone=clone, clones=clones, delimiter=delimiter, is_register=is_register, register_lines=register_lines, mode=mode)
            if account_count <= 0:
                with FLOWLOGIN_JOBS_LOCK:
                    FLOWLOGIN_JOBS.discard(serial)
                    FLOWLOGIN_STOP_EVENTS.pop(serial, None)
                lines.append("No hay cuentas asignadas para ejecutar.")
                outputs.append("\n".join(lines))
                continue
            agent = agent_for_serial(serial)
            if not agent or not agent_supports_flowlogin(agent):
                with open(payload_path, "r", encoding="utf-8") as fh:
                    payload = json.load(fh)
                message = (
                    "FlowAgent no conectado. Pulsa Instalar FlowAgent y activa Accesibilidad."
                    if not agent
                    else f"FlowAgent debe actualizarse a {FLOW_AGENT_EXPECTED_VERSION} y tener Accesibilidad activa."
                )
                for item in payload.get("accounts", []):
                    if not isinstance(item, dict):
                        continue
                    try:
                        item_clone = int(item.get("clone", 0))
                    except Exception:
                        item_clone = 0
                    if item_clone:
                        set_device_account_status(
                            serial,
                            item_clone,
                            "review",
                            message,
                            attempts=0,
                            line=item.get("line"),
                        )
                with FLOWLOGIN_JOBS_LOCK:
                    FLOWLOGIN_JOBS.discard(serial)
                    FLOWLOGIN_STOP_EVENTS.pop(serial, None)
                lines.append(f"FlowLogin no se inicio: {message}")
                outputs.append("\n".join(lines))
                continue

            stop_event = threading.Event()
            with FLOWLOGIN_JOBS_LOCK:
                FLOWLOGIN_STOP_EVENTS[serial] = stop_event
            thread = threading.Thread(
                target=run_flowlogin_agent_job,
                args=(serial, str(payload_path), delimiter, stop_event),
                daemon=True,
            )
            thread.start()
            lines.append(f"FlowLogin FlowAgent iniciado: {account_count} cuenta(s).")
            lines.append("El motor de login ahora usa solo el socket FlowAgent.")
            lines.append("Si una cuenta falla, se limpia cache/datos del clon y se intenta una segunda vez al final de la pasada.")
        except Exception as exc:
            with FLOWLOGIN_JOBS_LOCK:
                FLOWLOGIN_JOBS.discard(serial)
                FLOWLOGIN_STOP_EVENTS.pop(serial, None)
                FLOWLOGIN_CURRENT_ITEMS.pop(serial, None)
            lines.append(f"ERROR: {exc}")
        outputs.append("\n".join(lines))
    return "\n\n".join(outputs)


def execute_autojs(file_path, device_ids="all", clone=None, clones=None, delimiter=":", register_lines=None, mode=None):
    serials = get_target_serials(device_ids)
    if not serials:
        raise RuntimeError("No hay dispositivos conectados.")

    # Si el file_path apunta a una ruta remota del telefono (ya empujada con
    # /autojs/push), no necesitamos un script local. Solo lanzamos los intents o el socket.
    raw_path = str(file_path or "").strip().replace("\\", "/")
    script_name = raw_path.split("/")[-1].lower()
    if raw_path.startswith("/sdcard/") or raw_path.startswith("/storage/"):
        outputs = []
        for serial in serials:
            lines = [f"[{serial}]"]
            try:
                launched = False
                agent = agent_for_serial(serial)
                if script_name in ["login.js", "register.js"]:
                    is_register = (script_name == "register.js")
                    login_payload_path, account_count = prepare_flowlogin_payload(
                        serial,
                        clone=clone,
                        clones=clones,
                        delimiter=delimiter,
                        is_register=is_register,
                        register_lines=register_lines,
                        mode=mode,
                    )
                    if account_count <= 0:
                        lines.append("No hay cuentas asignadas para ejecutar.")
                        outputs.append("\n".join(lines))
                        continue
                    lines.append(adb(["-s", serial, "push", str(login_payload_path), FLOWLOGIN_ACCOUNTS_REMOTE], timeout=60))
                    adb(["-s", serial, "shell", "rm", "-f", FLOWLOGIN_STATUS_REMOTE], timeout=20)
                    local_script = resolve_local_script_path(script_name)
                    if not local_script.exists() or not local_script.is_file():
                        lines.append(f"FlowLogin no se inicio: no se encontro el script local fresco: {local_script}")
                        outputs.append("\n".join(lines))
                        continue
                    lines.append(adb(["-s", serial, "push", str(local_script), raw_path], timeout=120))
                    lines.append(f"Script actualizado: {local_script.name} -> {raw_path}")
                    lines.append(f"Payload FlowLogin enviado: {account_count} cuenta(s).")
                    if not agent or not agent_supports_flowlogin(agent):
                        message = (
                            "FlowAgent no conectado. Pulsa Instalar FlowAgent y activa Accesibilidad."
                            if not agent
                            else f"FlowAgent debe actualizarse a {FLOW_AGENT_EXPECTED_VERSION} y tener Accesibilidad activa."
                        )
                        try:
                            with open(login_payload_path, "r", encoding="utf-8") as fh:
                                payload = json.load(fh)
                            for item in payload.get("accounts", []):
                                try:
                                    item_clone = int(item.get("clone", 0))
                                except Exception:
                                    item_clone = 0
                                if item_clone:
                                    set_device_account_status(serial, item_clone, "review", message, attempts=0, line=item.get("line"))
                        except Exception:
                            pass
                        lines.append(f"FlowLogin no se inicio: {message}")
                        outputs.append("\n".join(lines))
                        continue
                if agent_supports_flowlogin(agent):
                    # Fase 6: Monolito soporta ejecución nativa por socket
                    res = agent_result(agent, {"name": "run_script", "path": raw_path}, timeout=5, raise_on_error=False)
                    if res and res.get("ok"):
                        lines.append(f"Ejecutado via FlowAgent Monolito Socket (ID: {res.get('executionId')})")
                        launched = True
                    else:
                        lines.append(f"Fallo ejecucion por socket: {res.get('error', 'Desconocido')}")
                if script_name in ["login.js", "register.js"] and not launched:
                    lines.append("FlowLogin no se inicio: Socket FlowAgent obligatorio.")
                    outputs.append("\n".join(line for line in lines if line).strip())
                    continue
                
                if not launched:
                    # Fallback a intent antiguo (Etapa A)
                    launch_errors = []
                    for package in AUTOJS_PACKAGES:
                        if not package_installed(serial, package):
                            continue
                        lines.append(f"Ejecutor detectado: {package}")
                        for command in autojs_launch_commands(package, raw_path):
                            args = ["-s", serial, *command]
                            try:
                                result = adb(args, timeout=30)
                                lines.append(result or "Intent enviado")
                                if package == "youhu.laixijs" and "broadcast" not in command:
                                    continue
                                launched = True
                                break
                            except Exception as exc:
                                launch_errors.append(str(exc))
                        if launched:
                            break
                    if not launched:
                        lines.append("Auto.js no respondio o no esta instalado en este dispositivo.")
                        if launch_errors:
                            lines.append(launch_errors[-1])
            except Exception as exc:
                lines.append(f"ERROR: {exc}")
            outputs.append("\n".join(line for line in lines if line).strip())
        return "\n\n".join(outputs).strip()

    script_name = str(file_path).strip().replace("\\", "/").split("/")[-1].lower()

    script = resolve_local_script_path(file_path)
    if not script.exists() or not script.is_file():
        raise RuntimeError(f"No se encontro el script: {script}")

    for serial in serials:
        lock_device_portrait(serial)

    remote = f"/sdcard/Download/{script.name}"
    outputs = []
    for serial in serials:
        lines = [f"[{serial}]"]
        try:
            if script_name in ["login.js", "register.js"]:
                is_register = (script_name == "register.js")
                login_payload_path, account_count = prepare_flowlogin_payload(serial, clone=clone, clones=clones, delimiter=delimiter, is_register=is_register, register_lines=register_lines, mode=mode)
                lines.append(adb(["-s", serial, "push", str(login_payload_path), FLOWLOGIN_ACCOUNTS_REMOTE], timeout=60))
                adb(["-s", serial, "shell", "rm", "-f", FLOWLOGIN_STATUS_REMOTE], timeout=20)
                lines.append(f"Payload FlowLogin enviado: {account_count} cuenta(s).")
            
            lines.append(adb(["-s", serial, "push", str(script), remote], timeout=120))
            launched = False
            
            agent = agent_for_serial(serial)
            if agent_supports_flowlogin(agent):
                # Fase 6: Monolito soporta ejecución nativa por socket
                res = agent_result(agent, {"name": "run_script", "path": remote}, timeout=5, raise_on_error=False)
                if res and res.get("ok"):
                    lines.append(f"Script enviado y ejecutando via Monolito (ID: {res.get('executionId')})")
                    launched = True
                else:
                    lines.append(f"Fallo ejecucion por socket: {res.get('error', 'Desconocido')}")

            if not launched:
                launch_errors = []
                for package in AUTOJS_PACKAGES:
                    if not package_installed(serial, package):
                        continue
                    lines.append(f"Ejecutor detectado: {package}")
                    for command in autojs_launch_commands(package, remote):
                        args = ["-s", serial, *command]
                        try:
                            result = adb(args, timeout=30)
                            lines.append(result or "Intent enviado")
                            if package == "youhu.laixijs" and "broadcast" not in command:
                                continue
                            launched = True
                            break
                        except Exception as exc:
                            launch_errors.append(str(exc))
                    if launched:
                        break
                if not launched:
                    lines.append("Script copiado, pero no se pudo abrir AutoJS automaticamente.")
                    lines.append("Instala AutoJS o ajusta AUTOJS_PACKAGES en local_adb_server.py.")
        except Exception as exc:
            lines.append(f"ERROR: {exc}")
        outputs.append("\n".join(line for line in lines if line).strip())
    return "\n\n".join(outputs)


def stop_autojs(device_ids="all"):
    serials = get_target_serials(device_ids)
    if not serials:
        raise RuntimeError("No hay dispositivos conectados.")

    outputs = []
    for serial in serials:
        lines = [f"[{serial}]"]
        with FLOWLOGIN_JOBS_LOCK:
            stop_event = FLOWLOGIN_STOP_EVENTS.get(serial)
            current_item = FLOWLOGIN_CURRENT_ITEMS.get(serial)
            flowlogin_running = serial in FLOWLOGIN_JOBS

        if stop_event:
            stop_event.set()
            lines.append("FlowLogin FlowAgent: parada solicitada.")
        elif flowlogin_running:
            lines.append("FlowLogin FlowAgent: detencion marcada.")
        else:
            lines.append("FlowLogin FlowAgent: sin ejecucion activa.")

        if isinstance(current_item, dict):
            try:
                clone = int(current_item.get("clone", 0) or 0)
            except Exception:
                clone = 0
            line = current_item.get("line", "")
            if clone:
                set_device_account_status(serial, clone, "review", "Detenido por usuario", line=line)

        try:
            stopped_remote = mark_remote_flowlogin_stopped(serial, "Detenido por usuario")
            if stopped_remote:
                lines.append(f"FlowLogin remoto: {stopped_remote} estado(s) detenido(s).")
        except Exception as exc:
            lines.append(f"No se pudo limpiar estado remoto FlowLogin: {exc}")

        if stop_event or flowlogin_running:
            try:
                agent = agent_for_serial(serial)
                if agent:
                    agent_result(agent, {"name": "home"}, timeout=8, raise_on_error=False)
                    lines.append("FlowAgent envio Home.")
                else:
                    lines.append("FlowAgent no conectado; no se uso ADB para detener FlowLogin.")
            except Exception as exc:
                lines.append(f"No se pudo enviar Home por FlowAgent: {exc}")
            outputs.append("\n".join(lines))
            continue

        agent = agent_for_serial(serial)
        if agent and agent_supports_flowlogin(agent):
            res = agent_result(agent, {"name": "stop_script"}, timeout=5, raise_on_error=False)
            if res and res.get("ok"):
                lines.append("Monolito: script detenido exitosamente.")
            else:
                lines.append(f"Monolito: no se pudo detener el script.")

        for package in AUTOJS_PACKAGES:
            try:
                lines.append(adb(["-s", serial, "shell", "am", "force-stop", package], timeout=30) or f"{package} detenido")
            except Exception:
                pass
        outputs.append("\n".join(lines))
    return "\n\n".join(outputs)


class AgentConnection:
    def __init__(self, sock, address):
        self.sock = sock
        self.address = address
        self.agent_id = f"{address[0]}:{address[1]}"
        self.meta = {}
        self.connected_at = time.time()
        self.last_seen = time.time()
        self.pending = {}
        self.write_lock = threading.Lock()

    def send_json(self, payload):
        data = (json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8")
        with self.write_lock:
            self.sock.sendall(data)

    def close(self):
        try:
            self.sock.shutdown(socket.SHUT_RDWR)
        except Exception:
            pass
        try:
            self.sock.close()
        except Exception:
            pass


def agent_socket_diag(message):
    try:
        AGENT_SOCKET_DIAG_LOG.parent.mkdir(exist_ok=True)
        with AGENT_SOCKET_DIAG_LOG.open("a", encoding="utf-8") as fh:
            fh.write(f"{time.time():.3f} {message}\n")
    except Exception:
        pass


def cleanup_stale_agents(online_serials=None, max_age=FLOWAGENT_STALE_TTL):
    now = time.time()
    online_set = None
    if online_serials is not None:
        online_set = {str(serial or "").strip() for serial in online_serials if str(serial or "").strip()}
    stale = []
    with AGENT_CONNECTIONS_LOCK:
        for agent in list(AGENT_CONNECTIONS.values()):
            serial = str(agent.meta.get("serial", "") or "").strip()
            last_seen = float(getattr(agent, "last_seen", 0) or 0)
            age = now - last_seen if last_seen else 999999
            if online_set is not None and serial and serial not in online_set:
                stale.append(agent)
            elif max_age and age > float(max_age):
                stale.append(agent)
        for agent in stale:
            if AGENT_CONNECTIONS.get(agent.agent_id) is agent:
                AGENT_CONNECTIONS.pop(agent.agent_id, None)
    for agent in stale:
        try:
            agent.close()
        except Exception:
            pass
    return len(stale)


def list_agents():
    with AGENT_CONNECTIONS_LOCK:
        agents = list(AGENT_CONNECTIONS.values())
    return [
        {
            "agentId": agent.agent_id,
            "address": f"{agent.address[0]}:{agent.address[1]}",
            "connectedAt": agent.connected_at,
            "lastSeen": agent.last_seen,
            **agent.meta,
        }
        for agent in agents
    ]


def register_agent(agent):
    with AGENT_CONNECTIONS_LOCK:
        previous_connections = []
        previous = AGENT_CONNECTIONS.get(agent.agent_id)
        if previous and previous is not agent:
            previous_connections.append(previous)
        serial = str(agent.meta.get("serial", "") or "").strip()
        if serial:
            for existing in AGENT_CONNECTIONS.values():
                if existing is agent:
                    continue
                existing_serial = str(existing.meta.get("serial", "") or "").strip()
                if existing_serial == serial and existing not in previous_connections:
                    previous_connections.append(existing)
        for previous in previous_connections:
            previous.close()
        AGENT_CONNECTIONS[agent.agent_id] = agent


def unregister_agent(agent):
    with AGENT_CONNECTIONS_LOCK:
        if AGENT_CONNECTIONS.get(agent.agent_id) is agent:
            AGENT_CONNECTIONS.pop(agent.agent_id, None)


def handle_agent_socket(sock, address):
    agent = AgentConnection(sock, address)
    try:
        reader = sock.makefile("r", encoding="utf-8", newline="\n")
        for line in reader:
            line = line.strip()
            if not line:
                continue
            agent.last_seen = time.time()
            try:
                payload = json.loads(line)
            except Exception as exc:
                agent_socket_diag(f"json_error address={address} error={exc} line={line[:240]!r}")
                continue

            message_type = str(payload.get("type", "") or "").lower()
            if message_type == "hello":
                agent.agent_id = str(payload.get("agentId") or agent.agent_id)
                # Si el APK no envió serial, construirlo desde la IP de la conexión + puerto 5555
                _serial_from_intent = str(payload.get("serial", "") or "")
                if not _serial_from_intent and address:
                    _serial_from_intent = f"{address[0]}:5555"
                agent.meta = {
                    "serial": _serial_from_intent,
                    "deviceName": str(payload.get("deviceName", "") or ""),
                    "model": str(payload.get("model", "") or ""),
                    "manufacturer": str(payload.get("manufacturer", "") or ""),
                    "androidVersion": str(payload.get("androidVersion", "") or ""),
                    "agentVersion": str(payload.get("agentVersion", "") or ""),
                    "accessibility": bool(payload.get("accessibility", False)),
                    "keyboardInstalled": bool(payload.get("keyboardInstalled", False)),
                    "keyboardActive": bool(payload.get("keyboardActive", False)),
                    "keyboardName": str(payload.get("keyboardName", "") or ""),
                }
                register_agent(agent)
                agent.send_json({
                    "type": "helloAck",
                    "serverVersion": SERVER_VERSION,
                    "agentPort": AGENT_PORT,
                })
                # Registrar mapping androidId -> adbSerial en backend C# automáticamente
                _android_id = agent.agent_id
                _adb_serial = agent.meta.get("serial", "")
                # Si el serial está vacío (APK conectó via ADB reverse desde 127.0.0.1),
                # intentar obtenerlo del meta o dejarlo vacío — el mapping se actualizará
                # cuando el APK envíe el serial correcto via Intent en el próximo arranque
                if _android_id and _adb_serial:
                    def _register_mapping(android_id, adb_serial):
                        try:
                            import urllib.request as _req_mod
                            import urllib.error as _err_mod
                            _body = json.dumps({"androidId": android_id, "adbSerial": adb_serial}).encode("utf-8")
                            _req = _req_mod.Request(
                                "http://localhost:5000/api/devices/register",
                                data=_body,
                                headers={"Content-Type": "application/json"},
                                method="POST",
                            )
                            with _req_mod.urlopen(_req, timeout=3):
                                pass
                        except Exception:
                            pass
                    threading.Thread(target=_register_mapping, args=(_android_id, _adb_serial), daemon=True).start()
                # Iniciar captura de pantalla automáticamente si el servicio de accesibilidad está activo
                # La captura de pantalla debe iniciarse solo por accion explicita
                # desde Electron. Enviarla durante el hello puede abrir dialogs de
                # MediaProjection o bloquear el canal obligatorio del socket.
            elif message_type == "response":
                request_id = str(payload.get("requestId", "") or "")
                agent_socket_diag(f"response address={address} agentId={agent.agent_id} requestId={request_id}")
                pending = agent.pending.pop(request_id, None)
                if not pending and request_id:
                    with AGENT_CONNECTIONS_LOCK:
                        for candidate in AGENT_CONNECTIONS.values():
                            if candidate is agent:
                                continue
                            pending = candidate.pending.pop(request_id, None)
                            if pending:
                                break
                if pending:
                    agent_socket_diag(f"response_matched requestId={request_id}")
                    pending["payload"] = payload
                    pending["event"].set()
                elif request_id:
                    agent_socket_diag(f"response_orphan_cached requestId={request_id}")
                    with AGENT_RESPONSE_CACHE_LOCK:
                        AGENT_RESPONSE_CACHE[request_id] = {
                            "payload": payload,
                            "timestamp": time.time(),
                        }
                        now = time.time()
                        stale = [
                            key for key, value in AGENT_RESPONSE_CACHE.items()
                            if now - float(value.get("timestamp", 0) or 0) > 120
                        ]
                        for key in stale:
                            AGENT_RESPONSE_CACHE.pop(key, None)
            elif message_type == "frame":
                # Reenviar frame al backend C# para broadcast via WebSocket a Electron
                # Usar el serial IP (192.168.1.XX:5555) que Electron usa para suscribirse
                try:
                    # Preferir serial IP del meta, fallback a androidId
                    adb_serial = agent.meta.get("serial", "")
                    # Si el serial es 127.0.0.1:5555 (via ADB reverse), buscar la IP real
                    # usando el androidId como clave en los mappings conocidos
                    if adb_serial and not adb_serial.startswith("127.0.0.1"):
                        frame_serial = adb_serial
                    else:
                        # Fallback: usar androidId (Electron también se suscribe con esto)
                        frame_serial = agent.agent_id
                    frame_data = payload.get("data", "")
                    frame_format = str(payload.get("format", "webp") or "webp")
                    frame_ts = payload.get("timestamp", 0)
                    print(f"[FRAME] serial={frame_serial} format={frame_format} data_len={len(frame_data) if frame_data else 0}")
                    if frame_serial and frame_data:
                        import urllib.request as _urllib_req
                        import urllib.error as _urllib_err
                        _body = json.dumps({
                            "serial": frame_serial,
                            "format": frame_format,
                            "data": frame_data,
                            "timestamp": frame_ts,
                        }).encode("utf-8")
                        _req = _urllib_req.Request(
                            "http://localhost:5000/api/streaming/frames",
                            data=_body,
                            headers={"Content-Type": "application/json"},
                            method="POST",
                        )
                        try:
                            with _urllib_req.urlopen(_req, timeout=2):
                                pass
                        except _urllib_err.URLError:
                            pass
                except Exception:
                    pass
            elif message_type in {"heartbeat", "status"}:
                if "accessibility" in payload:
                    agent.meta["accessibility"] = bool(payload.get("accessibility"))
    except Exception as exc:
        print(f"Agente APK desconectado {address}: {exc}")
    finally:
        unregister_agent(agent)
        agent.close()


def start_agent_socket_server():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((AGENT_HOST, AGENT_PORT))
    server.listen(32)
    print(f"Servidor de agentes APK listo en {AGENT_HOST}:{AGENT_PORT}")
    while True:
        sock, address = server.accept()
        sock.settimeout(None)
        thread = threading.Thread(target=handle_agent_socket, args=(sock, address), daemon=True)
        thread.start()


def send_agent_command(agent_id, command, timeout=12):
    agent_id = str(agent_id or "").strip()
    if not agent_id:
        raise RuntimeError("Falta agentId.")
    with AGENT_CONNECTIONS_LOCK:
        agent = AGENT_CONNECTIONS.get(agent_id)
    if not agent:
        raise RuntimeError("Agente APK no conectado.")

    request_id = uuid.uuid4().hex
    pending = {"event": threading.Event(), "payload": None}
    agent.pending[request_id] = pending
    try:
        agent_socket_diag(f"command_send agentId={agent.agent_id} serial={agent.meta.get('serial', '')} requestId={request_id} command={command if isinstance(command, dict) else str(command or 'ping')}")
        agent.send_json({
            "type": "command",
            "requestId": request_id,
            "command": command if isinstance(command, dict) else {"name": str(command or "ping")},
        })
    except Exception:
        agent.pending.pop(request_id, None)
        raise

    try:
        timeout = max(1, min(float(timeout or 12), 60))
    except Exception:
        timeout = 12
    if not pending["event"].wait(timeout):
        with AGENT_RESPONSE_CACHE_LOCK:
            cached = AGENT_RESPONSE_CACHE.pop(request_id, None)
        if cached:
            agent_socket_diag(f"command_cache_hit requestId={request_id}")
            agent.pending.pop(request_id, None)
            payload = cached.get("payload") or {}
            _refresh_agent_meta_from_command(agent, command, payload)
            return payload
        agent.pending.pop(request_id, None)
        agent_socket_diag(f"command_timeout agentId={agent.agent_id} requestId={request_id}")
        raise RuntimeError("El agente APK no respondio a tiempo.")
    payload = pending["payload"] or {}
    _refresh_agent_meta_from_command(agent, command, payload)
    return payload


def _refresh_agent_meta_from_command(agent, command, payload):
    try:
        name = command.get("name") if isinstance(command, dict) else str(command or "")
        result = payload.get("result", payload) if isinstance(payload, dict) else {}
        if name == "engine_probe" and result.get("ok") and result.get("serviceReady") is not False:
            agent.meta["accessibility"] = True
            agent.meta["accessibilityEngine"] = result.get("engine") or agent.meta.get("accessibilityEngine") or "autojs"
    except Exception:
        pass


def agent_for_serial(serial):
    serial = str(serial or "").strip()
    if not serial:
        return None
    if serial.startswith(("mac:", "serial:")):
        serials = get_target_serials(serial)
        if serials:
            serial = serials[0]
    # Buscar todas las conexiones con ese serial y devolver la mas reciente
    # (lastSeen mas alto). Asi evitamos usar conexiones zombi/muertas que
    # quedaron en AGENT_CONNECTIONS antes de un reconectar.
    with AGENT_CONNECTIONS_LOCK:
        candidates = [
            a for a in AGENT_CONNECTIONS.values()
            if str(a.meta.get("serial", "") or "").strip() == serial
        ]
    if candidates:
        candidates.sort(key=lambda a: getattr(a, "last_seen", 0), reverse=True)
        return candidates[0]
    android_id = get_device_android_id(serial)
    if not android_id:
        return None
    with AGENT_CONNECTIONS_LOCK:
        return AGENT_CONNECTIONS.get(android_id)


def wait_agent_for_serial(serial, timeout=4.0, interval=0.25):
    deadline = time.time() + max(0.1, float(timeout or 4.0))
    while time.time() < deadline:
        agent = agent_for_serial(serial)
        if agent:
            return agent
        time.sleep(max(0.05, float(interval or 0.25)))
    return agent_for_serial(serial)


def version_tuple(value):
    parts = []
    for piece in str(value or "").split("."):
        try:
            parts.append(int(re.sub(r"\D.*$", "", piece) or 0))
        except Exception:
            parts.append(0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:3])


def agent_supports_flowlogin(agent):
    if not agent:
        return False
    return bool(agent.meta.get("accessibility")) and version_tuple(agent.meta.get("agentVersion", "")) >= version_tuple(FLOW_AGENT_EXPECTED_VERSION)


def get_or_create_human_profile(serial):
    """
    Recupera el perfil humano de interaccion para un dispositivo.
    Devuelve un diccionario vacio si no esta configurado para fallback seguro.
    """
    return {}


def agent_find_node(nodes, matcher):
    for node in nodes:
        if matcher(node):
            return node
    return None


def agent_result(agent, command, timeout=12, raise_on_error=True):
    if not agent:
        raise RuntimeError("FlowAgent no conectado.")
    payload = send_agent_command(agent.agent_id, command, timeout=timeout)
    result = payload.get("result", payload) if isinstance(payload, dict) else {}
    if raise_on_error and not result.get("ok"):
        raise RuntimeError(str(result.get("error", "FlowAgent fallo.")))
    return result


def agent_node_label(node):
    return " ".join(
        str(node.get(key, "") or "")
        for key in ("text", "desc")
        if str(node.get(key, "") or "")
    )


def agent_bounds(node):
    raw = str(node.get("bounds", "") or "")
    parts = raw.split(",")
    if len(parts) != 4:
        return None
    try:
        left, top, right, bottom = [int(value) for value in parts]
    except Exception:
        return None
    return {
        "left": left,
        "top": top,
        "right": right,
        "bottom": bottom,
        "centerX": (left + right) // 2,
        "centerY": (top + bottom) // 2,
        "width": max(0, right - left),
        "height": max(0, bottom - top),
    }


def agent_dump(agent, max_nodes=500, timeout=12):
    result = agent_result(agent, {"name": "dump", "maxNodes": max_nodes}, timeout=timeout)
    nodes = result.get("nodes", [])
    return nodes if isinstance(nodes, list) else []


def agent_status(agent, timeout=8):
    return agent_result(agent, {"name": "status"}, timeout=timeout)


def agent_current_package(agent):
    try:
        return str(agent_status(agent).get("packageName", "") or "")
    except Exception:
        return ""


def agent_get_edit_texts(agent, timeout=12):
    result = agent_result(agent, {"name": "getEditTexts"}, timeout=timeout)
    nodes = result.get("nodes", [])
    return nodes if isinstance(nodes, list) else []


def agent_tap(agent, x, y, timeout=8):
    serial = str(agent.meta.get("serial") or "")
    duration = 80
    if serial:
        profile = get_or_create_human_profile(serial)
        tap_prof = profile.get("tap", {})
        min_dur = int(tap_prof.get("durationMinMs", 42))
        max_dur = int(tap_prof.get("durationMaxMs", 132))
        duration = __import__("random").randint(min_dur, max_dur)
    return agent_result(agent, {"name": "tap", "x": int(x), "y": int(y), "duration": duration}, timeout=timeout)


def agent_swipe(agent, start_x, start_y, end_x, end_y, duration=350, timeout=8):
    serial = str(agent.meta.get("serial") or "")
    if serial:
        profile = get_or_create_human_profile(serial)
        swipe_prof = profile.get("swipe", {})
        multiplier = float(swipe_prof.get("durationMultiplier", 1.0))
        duration = int(duration * multiplier)

    import math
    import random

    mid_x = (start_x + end_x) / 2.0
    mid_y = (start_y + end_y) / 2.0
    dx = end_x - start_x
    dy = end_y - start_y
    dist = math.hypot(dx, dy)

    if dist > 0:
        perp_x = -dy / dist
        perp_y = dx / dist
    else:
        perp_x = 0
        perp_y = 0

    curve_factor = random.uniform(-0.15, 0.15)
    offset = dist * curve_factor

    control_x = int(mid_x + perp_x * offset)
    control_y = int(mid_y + perp_y * offset)

    return agent_result(
        agent,
        {
            "name": "swipe",
            "startX": int(start_x),
            "startY": int(start_y),
            "endX": int(end_x),
            "endY": int(end_y),
            "controlX": control_x,
            "controlY": control_y,
            "duration": int(duration),
        },
        timeout=timeout,
    )


def agent_open_app_info(agent, package_name, timeout=10):
    return agent_result(agent, {"name": "openAppInfo", "packageName": package_name}, timeout=timeout)


def agent_wait_for_node(agent, matcher, timeout_sec=10, interval_sec=1):
    import time
    start = time.time()
    while time.time() - start < timeout_sec:
        nodes = agent_dump(agent)
        found = agent_find_node(nodes, matcher)
        if found:
            return found
        time.sleep(interval_sec)
    return None


def agent_wait_for_text(agent, text, contains=True, timeout_sec=10, interval_sec=1):
    import time
    start = time.time()
    matcher = lambda n: (str(n.get("text", "")).lower().find(text.lower()) != -1 or str(n.get("desc", "")).lower().find(text.lower()) != -1) if contains else (str(n.get("text", "")).lower() == text.lower() or str(n.get("desc", "")).lower() == text.lower())
    while time.time() - start < timeout_sec:
        nodes = agent_dump(agent)
        found = agent_find_node(nodes, matcher)
        if found:
            return found
        time.sleep(interval_sec)
    return None


def agent_wait_for_ocr(agent, text_to_find, timeout_sec=15, interval_sec=2):
    import time
    start = time.time()
    while time.time() - start < timeout_sec:
        command = {"name": "ocr_detect", "timeout": 8000}
        try:
            response = agent_result(agent, command, timeout=12)
            if response and response.get("ok"):
                text = response.get("text", "")
                if text_to_find.lower() in text.lower():
                    for block in response.get("blocks", []):
                        if text_to_find.lower() in block.get("text", "").lower():
                            return block
                    return True
        except Exception:
            pass
        time.sleep(interval_sec)
    return None


def agent_wait_for_template(agent, template_path, threshold=0.85, timeout_sec=15, interval_sec=2):
    import time
    start = time.time()
    while time.time() - start < timeout_sec:
        command = {
            "name": "image_match_template",
            "templatePath": template_path,
            "threshold": threshold,
            "timeout": 12
        }
        try:
            response = agent_result(agent, command, timeout=15)
            if response and response.get("ok") and response.get("found"):
                return response
        except Exception:
            pass
        time.sleep(interval_sec)
    return None


def agent_safe_tap_point(bounds, jitter_ratio=0.1, rng=None):
    if not bounds or bounds["width"] <= 0 or bounds["height"] <= 0:
        return None

    import random

    rng = rng or random
    w = bounds["width"]
    h = bounds["height"]
    jitter_ratio = max(0.0, min(float(jitter_ratio or 0.0), 0.35))

    def axis_range(start, end, size):
        if size <= 3:
            return start, max(start, end - 1)
        min_margin = 2 if size < 28 else 3 if size < 48 else 4
        proportional_margin = int(round(size * jitter_ratio))
        margin = min(max(min_margin, proportional_margin), max(0, (size - 1) // 2))
        low = start + margin
        high = end - 1 - margin
        if low > high:
            center = (start + end) // 2
            return center, center
        return low, high

    min_x, max_x = axis_range(bounds["left"], bounds["right"], w)
    min_y, max_y = axis_range(bounds["top"], bounds["bottom"], h)
    return rng.randint(min_x, max_x), rng.randint(min_y, max_y)


def agent_click_node(agent, node):
    bounds = agent_bounds(node)
    if not bounds or bounds["width"] <= 0 or bounds["height"] <= 0:
        return False
    
    serial = str(agent.meta.get("serial") or "")
    jitter_ratio = 0.1
    if serial:
        profile = get_or_create_human_profile(serial)
        jitter_ratio = float(profile.get("tap", {}).get("jitterRatio", 0.1))
    
    point = agent_safe_tap_point(bounds, jitter_ratio=jitter_ratio)
    if not point:
        return False
    x, y = point
    
    agent_tap(agent, x, y)
    return True


def agent_click_text_if_present(agent, pattern, timeout=3, contains=False):
    regex = re.compile(pattern, re.I)
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            for node in agent_dump(agent, max_nodes=500, timeout=10):
                label = agent_node_label(node).strip()
                matched = bool(regex.search(label)) if contains else bool(regex.fullmatch(label))
                if matched and agent_click_node(agent, node):
                    return True
        except Exception:
            pass
        time.sleep(0.45)
    return False


def agent_click_text_patterns(agent, patterns, timeout=4, contains=True):
    regexes = [re.compile(pattern, re.I) for pattern in patterns]
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            nodes = agent_dump(agent, max_nodes=500, timeout=10)
            for node in nodes:
                label = agent_node_label(node).strip()
                if not label:
                    continue
                matched = any(
                    regex.search(label) if contains else regex.fullmatch(label)
                    for regex in regexes
                )
                if matched and agent_click_node(agent, node):
                    time.sleep(1.1)
                    return True
        except Exception:
            pass
        time.sleep(0.45)
    return False


def agent_click_any_text(agent, patterns, timeout=4):
    for pattern in patterns:
        if agent_click_text_if_present(agent, pattern, timeout=timeout, contains=True):
            time.sleep(1.1)
            return True
    return False


def agent_find_text_node(agent, patterns, timeout=3, contains=True):
    regexes = [re.compile(pattern, re.I) for pattern in patterns]
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            nodes = agent_dump(agent, max_nodes=500, timeout=10)
            for node in nodes:
                label = agent_node_label(node).strip()
                if not label:
                    continue
                matched = any(regex.search(label) if contains else regex.fullmatch(label) for regex in regexes)
                if matched:
                    return node
        except Exception:
            pass
        time.sleep(0.45)
    return None


def agent_screen_size_from_dump(agent):
    width = 0
    height = 0
    try:
        for node in agent_dump(agent, max_nodes=500, timeout=10):
            bounds = agent_bounds(node)
            if not bounds:
                continue
            width = max(width, bounds["right"])
            height = max(height, bounds["bottom"])
    except Exception:
        pass
    return max(width, 540), max(height, 960)


def agent_scroll_up(agent):
    width, height = agent_screen_size_from_dump(agent)
    x = width // 2
    agent_swipe(agent, x, int(height * 0.78), x, int(height * 0.28), duration=350)
    time.sleep(0.7)
    return True


def agent_ui_has_marker(agent, pattern, timeout=3):
    regex = re.compile(pattern, re.I)
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if any(regex.search(agent_node_label(node)) for node in agent_dump(agent, max_nodes=500, timeout=10)):
                return True
        except Exception:
            pass
        time.sleep(0.45)
    return False


def agent_error_marker(agent, timeout=3):
    regex = re.compile(
        r"(incorrect|wrong|try again|not match|something went wrong|couldn.t log|can't log|captcha|verify|verification|too many|error|incorrecta|int.ntalo|no pudimos|no se pudo|demasiados)",
        re.I,
    )
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            for node in agent_dump(agent, max_nodes=500, timeout=10):
                label = agent_node_label(node)
                if regex.search(label):
                    return label
        except Exception:
            pass
        time.sleep(0.45)
    return ""


def agent_notice14_marker(agent, timeout=3):
    regex = re.compile(
        r"(only use spotify abroad for 14 days|spotify abroad.*14 days|14 days.*spotify|update your location at spotify\.com|actualiza tu ubicaci.n.*spotify|14 d.as)",
        re.I,
    )
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            for node in agent_dump(agent, max_nodes=500, timeout=10):
                label = agent_node_label(node)
                if regex.search(label):
                    return label
        except Exception:
            pass
        time.sleep(0.45)
    return ""


def agent_has_logged_in_markers(agent, timeout=3):
    return agent_ui_has_marker(agent, r"^(Home|Search|Your Library|Library|Inicio|Buscar|Tu biblioteca|Biblioteca)$", timeout=timeout)


def agent_confirm_logged_in(agent):
    if not agent_has_logged_in_markers(agent, timeout=3):
        return False
    time.sleep(2.5)
    return agent_has_logged_in_markers(agent, timeout=3)


def agent_has_login_markers(agent, timeout=3):
    if agent_ui_has_marker(agent, r"(Log in|Log In|Continue with email|Welcome back|Log in with a password|Iniciar sesi.n|Continuar con correo|correo electr.nico|contrase.a)", timeout=timeout):
        return True
    try:
        return bool(agent_get_edit_texts(agent, timeout=6))
    except Exception:
        return False


def agent_has_password_prompt(agent, timeout=1):
    return agent_ui_has_marker(agent, r"(password|contrase.a|Log in with a password|Iniciar sesi.n con contrase.a)", timeout=timeout)


def agent_launch_package_and_wait(agent, package_name, wait_seconds=12):
    package_name = str(package_name or "").strip()
    if not package_name:
        return False
    try:
        agent_result(agent, {"name": "launchPackage", "packageName": package_name}, timeout=12)
    except Exception:
        return False

    deadline = time.time() + wait_seconds
    while time.time() < deadline:
        current = agent_current_package(agent)
        if current == package_name:
            return True
        time.sleep(0.8)
    return False


def reset_flowlogin_clone_start(serial, agent, package_name):
    try:
        agent_result(agent, {"name": "home"}, timeout=8, raise_on_error=False)
    except Exception:
        pass
    time.sleep(0.8)


def agent_wait_for_edit_texts(agent, min_count=1, timeout=8):
    deadline = time.time() + timeout
    last_nodes = []
    while time.time() < deadline:
        try:
            last_nodes = agent_get_edit_texts(agent)
            if len(last_nodes) >= min_count:
                return last_nodes
        except Exception:
            pass
        time.sleep(0.55)
    return last_nodes


def agent_set_text_index(agent, index, text):
    agent_result(agent, {"name": "setTextIndex", "index": int(index), "text": str(text or "")}, timeout=12)
    time.sleep(1.1)


LOGIN_ENTRY_PATTERNS = [
    r"^Log in$",
    r"^Login$",
    r"^Iniciar sesi.n$",
    r"^Entrar$",
    r"^Acceder$",
]

EMAIL_ENTRY_PATTERNS = [
    r"Continue with email",
    r"Log in with email",
    r"Use email",
    r"Email",
    r"Continuar con email",
    r"Continuar con correo",
    r"Usar email",
    r"Usar correo",
    r"Correo electr.nico",
]

PASSWORD_ENTRY_PATTERNS = [
    r"Log in with a password",
    r"Use password",
    r"Password",
    r"Iniciar sesi.n con contrase.a",
    r"Usar contrase.a",
    r"Contrase.a",
]

OPTIONAL_DIALOG_PATTERNS = [
    r"Not now",
    r"Maybe later",
    r"No thanks",
    r"Don't allow",
    r"Skip",
    r"Ahora no",
    r"Quiz.s luego",
    r"No gracias",
    r"No permitir",
    r"Omitir",
]


def agent_dismiss_optional_login_dialogs(agent):
    return agent_click_text_patterns(agent, OPTIONAL_DIALOG_PATTERNS, timeout=1.2, contains=True)


def agent_prepare_login_fields(agent, fresh_start=False):
    deadline = time.time() + (34 if fresh_start else 20)
    last_inputs = []
    while time.time() < deadline:
        if agent_has_logged_in_markers(agent, timeout=1):
            return {"already": True, "inputs": []}

        try:
            inputs = agent_get_edit_texts(agent, timeout=6)
            if len(inputs) >= 2:
                return {"already": False, "inputs": inputs}
            if inputs:
                last_inputs = inputs
                return {"already": False, "inputs": inputs}
        except Exception:
            pass

        agent_dismiss_optional_login_dialogs(agent)

        clicked = (
            agent_click_text_patterns(agent, PASSWORD_ENTRY_PATTERNS, timeout=1.2, contains=True)
            or agent_click_text_patterns(agent, EMAIL_ENTRY_PATTERNS, timeout=1.2, contains=True)
            or agent_click_text_patterns(agent, LOGIN_ENTRY_PATTERNS, timeout=1.2, contains=False)
        )
        if clicked:
            time.sleep(2.4)
            continue

        time.sleep(0.7)

    return {"already": False, "inputs": last_inputs}


def agent_click_continue(agent):
    if not agent_click_text_if_present(agent, r"^(Continue|Next|Continuar|Siguiente)$", timeout=3):
        focused = next((node for node in agent_get_edit_texts(agent) if node.get("focused")), None)
        bounds = agent_bounds(focused) if focused else None
        if bounds:
            agent_tap(agent, bounds["centerX"], bounds["bottom"] + 120)
    time.sleep(4)


def agent_click_submit(agent, pass_field=None):
    pass_bottom = 0
    if pass_field is not None:
        bounds = agent_bounds(pass_field)
        pass_bottom = bounds["bottom"] if bounds else 0
    try:
        nodes = agent_dump(agent, max_nodes=500, timeout=10)
        for node in nodes:
            label = agent_node_label(node).strip()
            bounds = agent_bounds(node)
            if bounds and re.fullmatch(r"(Log in|Log In|Login|Iniciar sesi.n|Entrar|Acceder)", label, re.I) and (not pass_bottom or bounds["top"] > pass_bottom):
                agent_click_node(agent, node)
                time.sleep(3)
                return True
    except Exception:
        pass

    if pass_field is not None:
        bounds = agent_bounds(pass_field)
        if bounds:
            agent_tap(agent, bounds["centerX"], bounds["bottom"] + 150)
            time.sleep(3)
            return True
    if agent_click_text_if_present(agent, r"^(Log in|Log In|Login|Iniciar sesi.n|Entrar|Acceder)$", timeout=2):
        time.sleep(3)
        return True
    return False


def confirm_flowlogin_agent_outcome(agent, package_name, wait_seconds=28):
    deadline = time.time() + wait_seconds
    checks = 0
    last_error = ""
    while time.time() < deadline:
        notice14 = agent_notice14_marker(agent, timeout=1.2)
        if notice14:
            return {"status": "notice14", "message": "Aviso 14 dias", "retry": False}
        if agent_confirm_logged_in(agent):
            return {"status": "success", "message": "Login confirmado por FlowAgent", "retry": False}
        error = agent_error_marker(agent, timeout=1.5)
        if error:
            last_error = error
            time.sleep(3)
            if agent_confirm_logged_in(agent):
                return {"status": "success", "message": "Login confirmado por FlowAgent despues de cargar inicio", "retry": False}
            if time.time() + 8 >= deadline:
                return {"status": "error", "message": f"Error visible: {last_error[:80]}", "retry": False}
            continue
        checks += 1
        if agent_current_package(agent) != package_name and checks > 3:
            return {"status": "review", "message": "El clon salio de pantalla", "retry": True}
        time.sleep(2.5)
    return {"status": "review", "message": "Sin confirmacion segura", "retry": True}


def remove_adb_reverse(serial):
    """Quita el tunnel adb reverse tcp:8766 del dispositivo antes de registrar."""
    try:
        adb(["-s", serial, "reverse", "--remove", f"tcp:{AGENT_PORT}"], timeout=10)
    except Exception:
        pass


def restore_adb_reverse(serial):
    """Repone el tunnel adb reverse tcp:8766 despues de registrar."""
    try:
        adb(["-s", serial, "reverse", f"tcp:{AGENT_PORT}", f"tcp:{AGENT_PORT}"], timeout=10)
    except Exception:
        pass


def disconnect_flowagent_for_register(serial, agent):
    """
    Cierra el socket de FlowAgent antes del registro para que Spotify no detecte
    la conexion activa en 127.0.0.1:8766 como proxy.
    El agente se reconectara automaticamente cuando se llame a reconnect_flowagent.
    """
    try:
        unregister_agent(agent)
        agent.close()
    except Exception:
        pass


def reconnect_flowagent_for_register(serial):
    """
    Reabre FlowAgent en el dispositivo para que se reconecte al socket del servidor.
    Se llama despues de completar el registro.
    """
    try:
        android_id = get_device_android_id(serial)
        adb([
            "-s", serial, "shell", "am", "start",
            "-n", "com.flowlogin.agent/.MainActivity",
            "--es", "host", "127.0.0.1",
            "--es", "serial", android_id or serial,
            "--ei", "port", str(AGENT_PORT),
            "--ez", "autoconnect", "true",
        ], timeout=15)
    except Exception:
        pass


def solve_recaptcha_capsolver(website_url, website_key, max_wait=120):
    """
    Resuelve un reCAPTCHA v2 usando la API de CapSolver.
    Devuelve el token gRecaptchaResponse o None si falla.
    La API key se lee de CAPSOLVER_API_KEY (cargada desde .supabase_config.json).
    """
    api_key = CAPSOLVER_API_KEY
    if not api_key:
        print("[CapSolver] No hay CAPSOLVER_API_KEY configurada.")
        return None

    capsolver_url = "https://api.capsolver.com"
    headers = {"Content-Type": "application/json"}

    # 1. Crear tarea
    try:
        create_body = json.dumps({
            "clientKey": api_key,
            "task": {
                "type": "ReCaptchaV2TaskProxyless",
                "websiteURL": website_url,
                "websiteKey": website_key,
            }
        }).encode("utf-8")
        req = Request(f"{capsolver_url}/createTask", data=create_body, headers=headers, method="POST")
        with urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        print(f"[CapSolver] Error al crear tarea: {exc}")
        return None

    task_id = result.get("taskId")
    if not task_id or result.get("errorId", 0) != 0:
        print(f"[CapSolver] Error en createTask: {result.get('errorDescription', result)}")
        return None

    print(f"[CapSolver] Tarea creada: {task_id}")

    # 2. Polling hasta obtener resultado
    deadline = time.time() + max_wait
    while time.time() < deadline:
        time.sleep(4)
        try:
            poll_body = json.dumps({
                "clientKey": api_key,
                "taskId": task_id,
            }).encode("utf-8")
            req = Request(f"{capsolver_url}/getTaskResult", data=poll_body, headers=headers, method="POST")
            with urlopen(req, timeout=30) as resp:
                poll = json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            print(f"[CapSolver] Error en polling: {exc}")
            continue

        status = poll.get("status", "")
        if status == "ready":
            token = poll.get("solution", {}).get("gRecaptchaResponse", "")
            if token:
                print(f"[CapSolver] Token obtenido ({len(token)} chars)")
                return token
            print(f"[CapSolver] Status ready pero sin token: {poll}")
            return None
        if status == "failed" or poll.get("errorId", 0) != 0:
            print(f"[CapSolver] Tarea fallida: {poll.get('errorDescription', poll)}")
            return None
        # status == "processing" -> seguir esperando

    print(f"[CapSolver] Timeout esperando solucion ({max_wait}s)")
    return None


def inject_recaptcha_token_adb(serial, token):
    """
    Inyecta el token de reCAPTCHA en el WebView via JavaScript por ADB.
    Funciona cuando el WebView esta en Samsung Browser (Custom Tab).
    """
    # Escapar el token para uso en shell
    safe_token = token.replace("'", "\\'").replace('"', '\\"')
    js = (
        f"document.getElementById('g-recaptcha-response').innerHTML='{safe_token}';"
        f"document.getElementById('g-recaptcha-response').style.display='';"
        f"___grecaptcha_cfg.clients[0].aa.l.callback('{safe_token}');"
    )
    # Intentar via input keyevent no funciona para JS; usamos am broadcast si hay receptor,
    # o simplemente tapeamos el checkbox por coordenadas conocidas como fallback.
    # La inyeccion JS directa en Custom Tab no es posible sin debugging habilitado.
    # Retornamos False para indicar que hay que usar el fallback de tap.
    return False


FLOWREGISTER_WELCOME_PATTERN = r"(Sign up free|Reg.strate gratis|Sign up|Reg.strate|Crear cuenta gratis|Crear una cuenta)"
FLOWREGISTER_EMAIL_SCREEN_PATTERN = r"(What.?s your email|Cu.l es tu correo|enter.*email|email address|correo electr.nico|your email|tu correo)"
FLOWREGISTER_PASSWORD_SCREEN_PATTERN = r"(Create a password|Crea una contrase.a|Choose a password|Set a password|Elige una contrase.a|password.{0,40}(letter|number|character)|contrase.a.{0,40}(letra|n.mero|car.cter))"
FLOWREGISTER_DOB_SCREEN_PATTERN = r"(When.?s your date of birth|When were you born|Cu.ndo naciste|fecha de nacimiento|date of birth|your birthday|tu cumplea.os)"
FLOWREGISTER_GENDER_SCREEN_PATTERN = r"(What.?s your gender|Cu.l es tu g.nero|your gender|tu g.nero)"
FLOWREGISTER_NAME_SCREEN_PATTERN = r"(What.?s your name|Cu.l es tu nombre|your name|tu nombre)"
FLOWREGISTER_NEXT_PATTERNS = [r"^Next$", r"^Siguiente$", r"^Continuar$", r"^Continue$"]

# Nombres reales por genero para registro de cuentas
_MALE_FIRST = [
    "Santiago", "Mateo", "Sebastian", "Nicolas", "Alejandro", "Andres", "Diego",
    "Carlos", "Daniel", "David", "Felipe", "Gabriel", "Ivan", "Jorge", "Juan",
    "Luis", "Manuel", "Miguel", "Pablo", "Ricardo", "Roberto", "Sergio", "Victor",
    "Adrian", "Alberto", "Antonio", "Cristian", "Eduardo", "Emilio", "Ernesto",
    "Fernando", "Francisco", "Gustavo", "Hector", "Ignacio", "Javier", "Jonathan",
    "Leonardo", "Marco", "Mario", "Martin", "Mauricio", "Oscar", "Pedro", "Rafael",
    "Raul", "Rodrigo", "Ruben", "Tomas", "Xavier",
]
_FEMALE_FIRST = [
    "Sofia", "Valentina", "Isabella", "Camila", "Lucia", "Gabriela", "Daniela",
    "Mariana", "Andrea", "Natalia", "Paola", "Laura", "Ana", "Maria", "Paula",
    "Alejandra", "Carolina", "Diana", "Elena", "Fernanda", "Gloria", "Isabel",
    "Jessica", "Karen", "Lorena", "Monica", "Patricia", "Rosa", "Sandra", "Silvia",
    "Adriana", "Alicia", "Beatriz", "Claudia", "Cristina", "Esperanza", "Eva",
    "Irene", "Julia", "Liliana", "Luisa", "Magdalena", "Marcela", "Miriam",
    "Nora", "Olga", "Pilar", "Rebeca", "Teresa", "Veronica",
]
_LAST_NAMES = [
    "Garcia", "Martinez", "Lopez", "Gonzalez", "Rodriguez", "Hernandez", "Perez",
    "Sanchez", "Ramirez", "Torres", "Flores", "Rivera", "Gomez", "Diaz", "Cruz",
    "Morales", "Reyes", "Gutierrez", "Ortiz", "Vargas", "Castillo", "Jimenez",
    "Moreno", "Romero", "Herrera", "Medina", "Aguilar", "Vega", "Castro", "Ruiz",
    "Alvarez", "Ramos", "Mendoza", "Rios", "Soto", "Guerrero", "Delgado", "Navarro",
    "Fuentes", "Molina", "Suarez", "Ortega", "Silva", "Rojas", "Nunez", "Salazar",
    "Cabrera", "Espinoza", "Campos", "Acosta",
]

def generate_register_name(gender):
    import random
    first = random.choice(_MALE_FIRST if gender == "Male" else _FEMALE_FIRST)
    last  = random.choice(_LAST_NAMES)
    return f"{first} {last}"


def perform_flowregister_agent(serial, item, account, stop_event=None):
    agent = agent_for_serial(serial)
    if not agent:
        return {"status": "review", "message": "FlowAgent no conectado", "retry": False}

    package_name = str(item.get("package", "") or "").strip()
    if not package_name:
        return {"status": "error", "message": "Paquete del clon no definido", "retry": False}

    clone = int(item.get("clone", 0) or 0)
    email = str(account.get("user", "") or "").strip()
    password = str(account.get("pass", "") or "")
    if not email or "@" not in email:
        return {"status": "error", "message": "Cuenta sin email valido", "retry": False}
    if not password:
        return {"status": "error", "message": "Cuenta sin password", "retry": False}

    def check_stop():
        if stop_event and stop_event.is_set():
            raise RuntimeError("Detenido por usuario")

    def set_prog(text, pct):
        check_stop()
        with FLOWLOGIN_JOBS_LOCK:
            FLOWREGISTER_PROGRESS[serial] = {"text": text, "progress": pct}

    # El registro se ejecuta con FlowAgent conectado normalmente.
    return _perform_flowregister_body(serial, agent, item, account, stop_event,
                                      package_name, clone, email, password,
                                      check_stop, set_prog)


def _perform_flowregister_body(serial, agent, item, account, stop_event,
                                package_name, clone, email, password,
                                check_stop, set_prog):

    # ga() siempre devuelve el agente mas reciente para este serial.
    # Esto evita usar un objeto obsoleto si FlowAgent se reconecto durante
    # la limpieza visual del clon.
    def ga():
        return agent_for_serial(serial) or agent

    def wait_marker(pattern, total_timeout):
        deadline = time.time() + total_timeout
        chunk = 2.5
        while time.time() < deadline:
            check_stop()
            remaining = deadline - time.time()
            if agent_ui_has_marker(ga(), pattern, timeout=min(chunk, max(0.5, remaining))):
                return True
        return False

    def click_next():
        if agent_click_text_patterns(ga(), FLOWREGISTER_NEXT_PATTERNS, timeout=6, contains=False):
            return True
        return agent_click_text_patterns(ga(), [r"Next", r"Siguiente", r"Continuar", r"Continue"], timeout=4, contains=True)

    set_prog(f"C{clone}: Cerrando clon...", 3)
    try:
        adb_shell(serial, "am force-stop " + shlex.quote(package_name), timeout=15)
    except Exception:
        pass
    time.sleep(0.5)

    set_prog(f"C{clone}: Limpiando cache y datos del clon...", 8)
    try:
        clear_clone_cache_data_visual(serial, package_name)
    except Exception:
        try:
            adb_shell(serial, "pm clear " + shlex.quote(package_name), timeout=25)
        except Exception:
            pass
    time.sleep(0.8)

    set_prog(f"C{clone}: Abriendo Spotify...", 18)
    if not agent_launch_package_and_wait(ga(), package_name, wait_seconds=25):
        return {"status": "review", "message": "FlowAgent no pudo abrir el clon", "retry": True}

    set_prog(f"C{clone}: Esperando pantalla inicial...", 20)
    if not wait_marker(FLOWREGISTER_WELCOME_PATTERN, 35):
        return {"status": "review", "message": "No aparecio Sign up", "retry": True}

    set_prog(f"C{clone}: Tocando Sign up...", 25)
    if not agent_click_text_patterns(
        ga(),
        [r"Sign up free", r"Reg.strate gratis", r"Sign up", r"Reg.strate", r"Crear cuenta"],
        timeout=10,
        contains=True,
    ):
        return {"status": "error", "message": "No encontro Sign up", "retry": True}

    time.sleep(1.5)
    agent_click_text_patterns(
        ga(),
        [r"Continue with email", r"Continuar con correo", r"Use email", r"Usar correo"],
        timeout=6,
        contains=True,
    )

    set_prog(f"C{clone}: Esperando campo email...", 35)
    if not wait_marker(FLOWREGISTER_EMAIL_SCREEN_PATTERN, 25):
        if not agent_wait_for_edit_texts(ga(), min_count=1, timeout=8):
            return {"status": "review", "message": "No aparecio pantalla de email", "retry": True}

    inputs = agent_wait_for_edit_texts(ga(), min_count=1, timeout=12)
    if not inputs:
        return {"status": "review", "message": "No encontro campo de email", "retry": True}

    set_prog(f"C{clone}: Ingresando email...", 45)
    agent_set_text_index(ga(), 0, email)
    time.sleep(0.8)

    set_prog(f"C{clone}: Confirmando email...", 52)
    if not click_next():
        return {"status": "review", "message": "No encontro Next tras email", "retry": True}

    set_prog(f"C{clone}: Esperando pantalla de password...", 60)
    if not wait_marker(FLOWREGISTER_PASSWORD_SCREEN_PATTERN, 25):
        if agent_ui_has_marker(ga(), FLOWREGISTER_EMAIL_SCREEN_PATTERN, timeout=2):
            return {"status": "review", "message": "Email no avanzo a password", "retry": True}
        if not agent_wait_for_edit_texts(ga(), min_count=1, timeout=8):
            return {"status": "review", "message": "No aparecio pantalla de password", "retry": True}

    inputs = agent_wait_for_edit_texts(ga(), min_count=1, timeout=12)
    if not inputs:
        return {"status": "review", "message": "No encontro campo de password", "retry": True}

    set_prog(f"C{clone}: Ingresando password...", 68)
    pass_index = max(0, len(inputs) - 1)
    agent_set_text_index(ga(), pass_index, password)
    time.sleep(0.8)

    set_prog(f"C{clone}: Confirmando password...", 74)
    if not click_next():
        return {"status": "review", "message": "No encontro Next tras password", "retry": True}

    set_prog(f"C{clone}: Esperando fecha de nacimiento...", 80)
    if not wait_marker(FLOWREGISTER_DOB_SCREEN_PATTERN, 25):
        return {"status": "review", "message": "No aparecio pantalla de fecha", "retry": True}

    import random

    current_year = 2026
    target_year  = random.randint(1975, current_year - 18)
    target_day   = random.randint(1, 28)
    MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    target_month = random.choice(MONTHS)

    set_prog(f"C{clone}: Fecha {target_month} {target_day} {target_year}", 85)

    def get_picker_col_center_x(col_index):
        try:
            nodes = agent_dump(ga(), max_nodes=300, timeout=10)
            edit_nodes = [n for n in nodes
                          if str(n.get("className", "")).endswith("EditText")
                          and agent_bounds(n) is not None]
            edit_nodes.sort(key=lambda n: agent_bounds(n)["centerX"])
            if len(edit_nodes) > col_index:
                return agent_bounds(edit_nodes[col_index])["centerX"]
        except Exception:
            pass
        return [320, 530, 740][col_index]

    def get_current_picker_value(col_index):
        try:
            nodes = agent_dump(ga(), max_nodes=300, timeout=10)
            edit_nodes = [n for n in nodes
                          if str(n.get("className", "")).endswith("EditText")
                          and agent_bounds(n) is not None]
            edit_nodes.sort(key=lambda n: agent_bounds(n)["centerX"])
            if len(edit_nodes) > col_index:
                return agent_node_label(edit_nodes[col_index]).strip()
        except Exception:
            pass
        return ""

    def scroll_picker_to(col_index, target_text, value_list):
        cx = get_picker_col_center_x(col_index)
        swipe_center = 866
        swipe_step   = 230
        for attempt in range(60):
            check_stop()
            current = get_current_picker_value(col_index)
            if current == target_text:
                return True
            try:
                cur_idx = value_list.index(current)
                tgt_idx = value_list.index(target_text)
                need_increase = tgt_idx > cur_idx
            except ValueError:
                need_increase = True
            try:
                if need_increase:
                    agent_swipe(ga(), cx, swipe_center + swipe_step // 2,
                                cx, swipe_center - swipe_step // 2, duration=250)
                else:
                    agent_swipe(ga(), cx, swipe_center - swipe_step // 2,
                                cx, swipe_center + swipe_step // 2, duration=250)
            except Exception:
                pass
            time.sleep(0.5)
        return False

    # Listas de valores en orden ascendente tal como aparecen en el picker
    month_list = MONTHS                                          # Jan … Dec
    # Spotify muestra los dias < 10 con cero a la izquierda (01, 02, ..., 09)
    day_list   = [f"{d:02d}" if d < 10 else str(d) for d in range(1, 32)]
    year_list  = [str(y) for y in range(1900, current_year + 1)]  # 1900 … 2026

    set_prog(f"C{clone}: Ajustando mes...", 87)
    scroll_picker_to(0, target_month, month_list)
    time.sleep(0.3)

    set_prog(f"C{clone}: Ajustando dia...", 88)
    # Formatear target_day igual que Spotify lo muestra (01-09 con cero a la izquierda)
    target_day_str = f"{target_day:02d}" if target_day < 10 else str(target_day)
    scroll_picker_to(1, target_day_str, day_list)
    time.sleep(0.3)

    set_prog(f"C{clone}: Ajustando año...", 91)
    scroll_picker_to(2, str(target_year), year_list)
    time.sleep(0.5)

    set_prog(f"C{clone}: Confirmando fecha...", 93)
    # Esperar que el picker termine de animarse antes de buscar Next
    time.sleep(1.2)
    if not click_next():
        # Fallback: buscar el Button Next por dump y tapearlo por sus bounds reales
        try:
            width, height = agent_screen_size_from_dump(ga())
            nodes = agent_dump(ga(), max_nodes=200, timeout=8)
            next_btn = next(
                (n for n in nodes
                 if re.search(r"^(Next|Siguiente|Continue|Continuar)$", agent_node_label(n).strip(), re.I)
                 and agent_bounds(n)),
                None
            )
            if next_btn:
                b = agent_bounds(next_btn)
                agent_tap(ga(), b["centerX"], b["centerY"])
            else:
                # Ultimo fallback: tap en zona inferior central donde suele estar Next
                agent_tap(ga(), width // 2, int(height * 0.78))
        except Exception:
            pass
    time.sleep(1.5)

    # --- PANTALLA DE GENERO ---
    set_prog(f"C{clone}: Esperando pantalla de genero...", 94)
    wait_marker(FLOWREGISTER_GENDER_SCREEN_PATTERN, 20)

    import random as _random
    chosen_gender = _random.choice(["Female", "Male"])
    set_prog(f"C{clone}: Eligiendo genero {chosen_gender}...", 95)
    if not agent_click_text_patterns(ga(), [f"^{chosen_gender}$"], timeout=10, contains=False):
        # Fallback contains por si el texto tiene espacios o variacion
        agent_click_text_patterns(ga(), [chosen_gender], timeout=6, contains=True)
    # El clic en genero avanza automaticamente sin Next
    time.sleep(1.5)

    # --- PANTALLA DE NOMBRE ---
    set_prog(f"C{clone}: Esperando pantalla de nombre...", 96)
    if not wait_marker(FLOWREGISTER_NAME_SCREEN_PATTERN, 20):
        # Intentamos continuar si hay un EditText disponible
        if not agent_wait_for_edit_texts(ga(), min_count=1, timeout=8):
            return {"status": "review", "message": "No aparecio pantalla de nombre", "retry": True}

    inputs = agent_wait_for_edit_texts(ga(), min_count=1, timeout=12)
    if not inputs:
        return {"status": "review", "message": "No encontro campo de nombre", "retry": True}

    full_name = generate_register_name(chosen_gender)
    set_prog(f"C{clone}: Nombre: {full_name}...", 97)
    # Limpiar el nombre pre-llenado por Spotify y escribir el nuestro
    agent_set_text_index(ga(), 0, full_name)
    time.sleep(0.8)

    # --- BOTON CREATE ACCOUNT ---
    set_prog(f"C{clone}: Buscando boton Create account...", 98)

    def find_create_account_button():
        try:
            nodes = agent_dump(ga(), max_nodes=300, timeout=10)
            candidates = []
            for node in nodes:
                label = agent_node_label(node).strip()
                if not re.search(r"^(Create account|Crear cuenta|Crear una cuenta)$", label, re.I):
                    continue
                cls = str(node.get("className", "") or "")
                clickable = bool(node.get("clickable"))
                bounds = agent_bounds(node)
                if not bounds:
                    continue
                # Preferir Button sobre TextView
                score = 2 if "Button" in cls else (1 if clickable else 0)
                candidates.append((score, node, bounds))
            if candidates:
                candidates.sort(key=lambda x: -x[0])
                return candidates[0][1], candidates[0][2]
        except Exception:
            pass
        return None, None

    # Scroll suave hacia abajo para que el boton quede visible
    width, height = agent_screen_size_from_dump(ga())
    agent_swipe(ga(), width // 2, int(height * 0.7), width // 2, int(height * 0.4), duration=350)
    time.sleep(0.8)

    btn_node, btn_bounds = find_create_account_button()
    if not btn_node:
        return {"status": "review", "message": "No encontro boton Create account", "retry": True}

    set_prog(f"C{clone}: Tocando Create account...", 98)
    agent_tap(ga(), btn_bounds["centerX"], btn_bounds["centerY"])
    time.sleep(2.5)

    btn_still, _ = find_create_account_button()
    if btn_still is not None:
        agent_tap(ga(), btn_bounds["centerX"], btn_bounds["centerY"])
        time.sleep(2.0)

    set_prog(f"C{clone}: Cuenta enviada, verificando...", 99)
    time.sleep(3.0)

    # Verificar si aparecio pantalla de captcha (paquete sbrowser/chrome)
    current_pkg = agent_current_package(ga())
    if "sbrowser" in current_pkg or "chrome" in current_pkg.lower():
        set_prog(f"C{clone}: Captcha detectado, resolviendo...", 99)
        SPOTIFY_RECAPTCHA_SITEKEY = "6LeO36obAAAAALSBZrY6RYM1hcAY7RLvpDDcJLy3"
        SPOTIFY_REGISTER_URL = "https://challenge.spotify.com"
        token = solve_recaptcha_capsolver(SPOTIFY_REGISTER_URL, SPOTIFY_RECAPTCHA_SITEKEY, max_wait=120)
        if token:
            # La inyeccion JS directa no es posible en Custom Tab sin debugging.
            # Usamos tap por coordenadas calibradas para el checkbox y Continue.
            # Coordenadas confirmadas en dispositivo 1080x1794:
            #   checkbox "I'm not a robot": x=200, y=690
            #   boton Continue: x=515, y=1005
            set_prog(f"C{clone}: Token obtenido, tapeando captcha...", 99)
            adb_shell(serial, "input tap 200 690", timeout=10)
            time.sleep(2.5)
            # Verificar si aparecio el challenge de imagenes
            nodes_after = []
            try:
                nodes_after = agent_dump(ga(), max_nodes=100, timeout=5)
            except Exception:
                pass
            if not nodes_after:
                # Sigue en WebView — tocar Continue
                adb_shell(serial, "input tap 515 1005", timeout=10)
                time.sleep(3.0)
            # Si aparecio challenge de imagenes, no podemos resolverlo — marcar review
            current_pkg2 = agent_current_package(ga())
            if "sbrowser" in current_pkg2 or "chrome" in current_pkg2.lower():
                return {"status": "review", "message": "Captcha con imagenes requerido — completar manualmente", "retry": False}
        else:
            # Sin token de CapSolver — intentar tap directo como fallback
            set_prog(f"C{clone}: Tapeando captcha (fallback)...", 99)
            adb_shell(serial, "input tap 200 690", timeout=10)
            time.sleep(2.5)
            adb_shell(serial, "input tap 515 1005", timeout=10)
            time.sleep(3.0)
            current_pkg2 = agent_current_package(ga())
            if "sbrowser" in current_pkg2 or "chrome" in current_pkg2.lower():
                return {"status": "review", "message": "Captcha requerido — completar manualmente", "retry": False}
        time.sleep(2.0)

    # Verificar que no haya error visible (captcha, cuenta ya existente, etc.)
    error = agent_error_marker(ga(), timeout=4)
    if error:
        return {"status": "error", "message": f"Error al crear cuenta: {error[:80]}", "retry": False}

    set_prog(f"C{clone}: Cuenta creada", 100)
    return {"status": "success", "message": f"Cuenta creada: {full_name} ({chosen_gender})", "retry": False}


def perform_flowlogin_agent(serial, item, account):
    agent = agent_for_serial(serial)
    if not agent:
        return {"status": "review", "message": "FlowAgent no conectado. Instala/actualiza FlowAgent y activa Accesibilidad.", "retry": False}
    if not agent_supports_flowlogin(agent):
        return {"status": "review", "message": f"FlowAgent debe actualizarse a {FLOW_AGENT_EXPECTED_VERSION} y tener Accesibilidad activa.", "retry": False}

    package_name = str(item.get("package", "") or "").strip()
    clone = int(item.get("clone", 0) or 0)
    if not package_name:
        return {"status": "error", "message": "Paquete del clon no definido", "retry": False}

    fresh_start = bool(item.get("freshStart"))
    if fresh_start:
        reset_flowlogin_clone_start(serial, agent, package_name)

    if not agent_launch_package_and_wait(agent, package_name):
        return {"status": "review", "message": "FlowAgent no pudo abrir el clon", "retry": True}

    if agent_confirm_logged_in(agent):
        return {"status": "already", "message": "Sesion ya iniciada", "retry": False}

    login_state = agent_prepare_login_fields(agent, fresh_start=fresh_start)
    if login_state.get("already"):
        return {"status": "already", "message": "Sesion ya iniciada", "retry": False}
    preloaded_inputs = login_state.get("inputs", [])
    if agent_confirm_logged_in(agent):
        return {"status": "already", "message": "Sesion ya iniciada", "retry": False}

    if agent_click_text_patterns(agent, EMAIL_ENTRY_PATTERNS, timeout=2.5, contains=True):
        time.sleep(7)

    inputs = preloaded_inputs if len(preloaded_inputs) >= 2 else agent_wait_for_edit_texts(agent, min_count=2, timeout=10)
    if len(inputs) >= 2:
        agent_set_text_index(agent, 0, account["user"])
        inputs = agent_wait_for_edit_texts(agent, min_count=2, timeout=4)
        pass_index = max(0, len(inputs) - 1)
        agent_set_text_index(agent, pass_index, account["pass"])
        inputs = agent_wait_for_edit_texts(agent, min_count=1, timeout=3)
        pass_field = inputs[-1] if inputs else None
        agent_click_submit(agent, pass_field)
        return confirm_flowlogin_agent_outcome(agent, package_name)

    inputs = inputs or agent_wait_for_edit_texts(agent, min_count=1, timeout=4)
    if inputs:
        if agent_has_password_prompt(agent, timeout=1):
            pass_index = max(0, len(inputs) - 1)
            agent_set_text_index(agent, pass_index, account["pass"])
            inputs = agent_wait_for_edit_texts(agent, min_count=1, timeout=3)
            pass_field = inputs[-1] if inputs else None
            agent_click_submit(agent, pass_field)
            return confirm_flowlogin_agent_outcome(agent, package_name)
        else:
            agent_set_text_index(agent, 0, account["user"])
            agent_click_continue(agent)

    if agent_click_text_patterns(agent, PASSWORD_ENTRY_PATTERNS, timeout=3, contains=True):
        time.sleep(3.5)

    password_inputs = agent_wait_for_edit_texts(agent, min_count=1, timeout=8)
    if password_inputs:
        pass_index = max(0, len(password_inputs) - 1)
        agent_set_text_index(agent, pass_index, account["pass"])
        password_inputs = agent_wait_for_edit_texts(agent, min_count=1, timeout=3)
        pass_field = password_inputs[-1] if password_inputs else None
        agent_click_submit(agent, pass_field)
        return confirm_flowlogin_agent_outcome(agent, package_name)

    error = agent_error_marker(agent, timeout=2)
    if error:
        return {"status": "error", "message": "Error visible antes de escribir", "retry": False}
    notice14 = agent_notice14_marker(agent, timeout=1.5)
    if notice14:
        return {"status": "notice14", "message": "Aviso 14 dias", "retry": False}
    return {"status": "review", "message": f"C{clone}: FlowAgent no encontro campos de login", "retry": True}


def run_agent_socket_server_safely():
    try:
        start_agent_socket_server()
    except Exception as exc:
        print(f"No se pudo iniciar el socket de agentes APK: {exc}")


class Handler(BaseHTTPRequestHandler):
    def _headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def _json(self, payload, status=200):
        self._headers(status)
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def _file(self, path):
        file_name = STATIC_FILES.get(path)
        if not file_name:
            self._json({"error": "Ruta no encontrada."}, 404)
            return

        file_path = RESOURCE_DIR / file_name
        if not file_path.exists():
            file_path = BASE_DIR / file_name
        if not file_path.exists() or not file_path.is_file():
            self._json({"error": f"Archivo no encontrado: {file_name}"}, 404)
            return

        content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        with file_path.open("rb") as fh:
            self.wfile.write(fh.read())

    def _body(self):
        length = int(self.headers.get("content-length", "0") or "0")
        if not length:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw) if raw else {}

    def do_OPTIONS(self):
        self._headers(204)

    def do_GET(self):
        try:
            path = urlparse(self.path).path
            if path in {"/", "/health"}:
                self._json({"ok": True, "adb": ADB, "version": SERVER_VERSION, "appVersion": APP_VERSION, "baseDir": str(BASE_DIR), "resourceDir": str(RESOURCE_DIR), "dataDir": str(DATA_DIR), "productMode": PRODUCT_MODE, "isFrozen": IS_FROZEN, "features": SERVER_FEATURES, "flowAgentApk": str(FLOW_AGENT_APK), "flowAgentApkExists": FLOW_AGENT_APK.exists()})
            
            elif path == "/devices/scan/status":
                self._json(SCAN_STATE)
                return
            elif path == "/devices/subnets":
                self._json({"subnets": get_local_subnets()})
                return
            elif path == "/entitlements":
                if ENTITLEMENTS_AVAILABLE and entitlements_module is not None:
                    self._json(entitlements_module.get_state())
                else:
                    self._json({"enforcement": False, "loaded": False, "features": [], "limits": {}, "plan": {}, "grace": {}})
                return

            elif path == "/client-info":
                self._json(get_client_info())
            elif path == "/adb-diagnostics":
                self._json(get_adb_diagnostics())
            elif path == "/update-status":
                self._json(get_update_status())
            elif path == "/devices":
                self._json({"devices": list_devices()})
            elif path == "/device-names":
                self._json({"names": load_device_names()})
            elif path == "/device-groups":
                self._json(load_device_groups())
            elif path == "/clone-apks":
                self._json(clone_apk_inventory())
            elif path == "/agents":
                self._json({"agents": list_agents()})
            elif path == "/device-mac":
                serial = self._body().get("serial", "")
                mac = get_device_mac_address(serial)
                self._json({"serial": serial, "macAddress": mac})
            elif path.startswith("/device/screen-size"):
                # Devuelve la resolucion real del display Android via `wm size`.
                # Usado por FlowTouch para calibrar el mapeo de coordenadas tactiles.
                from urllib.parse import parse_qs as _parse_qs
                _qs = _parse_qs(urlparse(self.path).query)
                serial = (_qs.get("serial", [""])[0] or "").strip()
                if not serial:
                    self._json({"error": "serial requerido"}, 400)
                else:
                    try:
                        raw = adb(["-s", serial, "shell", "wm", "size"], timeout=5) or ""
                        # Formato: "Physical size: 1080x1920" o "Override size: 1080x1920"
                        import re as _re
                        m = _re.search(r"(\d+)x(\d+)", raw)
                        if m:
                            w, h = int(m.group(1)), int(m.group(2))
                            self._json({"serial": serial, "width": w, "height": h})
                        else:
                            self._json({"error": "no se pudo parsear wm size", "raw": raw}, 500)
                    except Exception as exc:
                        self._json({"error": str(exc)}, 500)
            elif path == "/screen-streams" and SCRCPY_AVAILABLE:
                # Listar streams activos de scrcpy
                streams = scrcpy_manager.get_all_streams()
                self._json({"streams": streams})
            elif path == "/streaming/raw/sessions":
                # @Added Etapa C 2026-05-28: listar sesiones H.264 raw activas.
                if SCRCPY_RAW_STREAMER is None:
                    self._json({"available": False, "sessions": []})
                else:
                    self._json({
                        "available": True,
                        "wsPort": RAW_WS_PORT,
                        "wsBase": f"ws://127.0.0.1:{RAW_WS_PORT}",
                        "sessions": SCRCPY_RAW_STREAMER.list_sessions(),
                    })
            elif path == "/pro-streams":
                self._json({"scrcpy": str(SCRCPY_EXE) if SCRCPY_EXE else "", "streams": list_scrcpy_native_streams()})
            elif path == "/recordings/active":
                self._json({"scrcpy": str(SCRCPY_EXE) if SCRCPY_EXE else "", "recordings": list_scrcpy_recordings()})
            elif path == "/control/scrcpy-sessions":
                sessions = SCRCPY_CONTROL_MANAGER.list_sessions() if SCRCPY_CONTROL_MANAGER is not None else []
                self._json({"available": SCRCPY_CONTROL_MANAGER is not None, "sessions": sessions})
            elif path.startswith("/screen-stream/status/") and SCRCPY_AVAILABLE:
                # Obtener estado de un stream específico
                serial = path.split("/")[-1]
                status = scrcpy_manager.get_stream_status(serial)
                if status:
                    self._json(status)
                else:
                    self._json({"serial": serial, "isRunning": False})
            elif path.startswith("/screen-snapshot/"):
                serial = urlparse(self.path).path.split("/screen-snapshot/", 1)[1]
                serial = unquote(serial)
                frame = adb_screencap_png(serial)
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.send_header("Content-Length", str(len(frame)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(frame)
            elif path in STATIC_FILES:
                self._file(path)
            else:
                self._json({"error": "Ruta no encontrada."}, 404)
        except Exception as exc:
            self._json({"error": str(exc)}, 500)

    def do_POST(self):
        try:
            path = urlparse(self.path).path
            # Focus PRO Panel - rutas multipart: leer FieldStorage directo, NO json.
            multipart_paths = {"/apps/install", "/file-push", "/autojs/push"}
            is_multipart = path in multipart_paths and "multipart/form-data" in (self.headers.get("content-type", "") or "").lower()
            body = {} if is_multipart else self._body()
            if ENTITLEMENTS_AVAILABLE and entitlements_module is not None:
                _ent_allowed, _ent_feature = entitlements_module.check_post(path)
                if not _ent_allowed:
                    self._json({"error": "feature_not_entitled", "feature": _ent_feature, "message": "Tu plan actual no incluye esta funcion."}, 403)
                    return
            if path == "/adb":
                self._json({"result": run_adb_command(body.get("command", ""), body.get("deviceIds", "all")), "devices": _get_cached_devices()})
            
            elif path == "/devices/scan":
                ranges = body.get("ranges", ["auto"])
                port = body.get("port", 5555)
                timeout = body.get("timeoutMs", 250)
                concurrency = body.get("concurrency", 48)
                connect_adb = body.get("connectAdb", True)
                success = start_network_scan(ranges, port, timeout, concurrency, connect_adb)
                self._json({"ok": success, "message": "Scan started" if success else "Scan already active"})
                return
            elif path == "/devices/scan/cancel":
                SCAN_CANCEL_EVENT.set()
                self._json({"ok": True, "message": "Scan cancelled"})
                return
            elif path == "/devices/reconnect-known":
                reconnect_known_devices()
                self._json({"ok": True, "message": "Reconnecting known devices in background"})
                return

            elif path == "/device/forget":
                device_key = body.get("deviceKey")
                if not device_key:
                    self._json({"error": "deviceKey requerido"}, 400)
                else:
                    saved_names = load_device_names()
                    if device_key in saved_names:
                        del saved_names[device_key]
                        save_device_names(saved_names)
                    self._json({"ok": True, "deviceKey": device_key})
            elif path == "/device/transport-preference":
                device_id = str(body.get("deviceId", "") or "").strip()
                pref = str(body.get("preferredTransport", "") or "").strip().lower()
                if not device_id:
                    self._json({"error": "deviceId requerido"}, 400)
                elif pref not in ("auto", "usb", "wifi"):
                    self._json({"error": "preferredTransport invalido. Valores permitidos: auto, usb, wifi"}, 400)
                else:
                    names = load_device_names()
                    profile = names.get(device_id, {"name": "", "person": "", "accountStatuses": [], "preferredTransport": "auto"})
                    profile["preferredTransport"] = pref
                    names[device_id] = profile
                    save_device_names(names)
                    self._json({
                        "ok": True,
                        "deviceId": device_id,
                        "preferredTransport": pref,
                        "devices": list_devices()
                    })
            elif path == "/packages":
                self._json({"result": list_packages(body.get("deviceIds", "all")), "devices": _get_cached_devices()})
            elif path == "/clone-apks/status":
                self._json({"status": clone_apk_status(body.get("deviceIds", "all"))})
            elif path == "/autojs/run":
                clone = body.get("clone", None)
                clones = body.get("clones", None)
                register_lines = body.get("registerLines", None)
                try:
                    clone = int(clone) if clone not in (None, "") else None
                except Exception:
                    clone = None
                self._json({"result": execute_autojs(body.get("filePath", ""), body.get("deviceIds", "all"), clone=clone, clones=clones, delimiter=body.get("delimiter", ":"), register_lines=register_lines, mode=body.get("mode", None)), "devices": _get_cached_devices()})
            elif path == "/autojs/stop":
                self._json({"result": stop_autojs(body.get("deviceIds", "all")), "devices": _get_cached_devices()})
            elif path == "/login-status":
                device_ids = body.get("deviceIds", "all")
                result = refresh_login_statuses(device_ids)
                serials = get_target_serials(device_ids)
                progress = build_flowlogin_progress_map(serials)
                register_progress = dict(FLOWREGISTER_PROGRESS)
                for key, value in register_progress.items():
                    progress.setdefault(key, value)
                self._json({"result": result, "devices": _get_cached_devices(), "progress": progress, "registerProgress": register_progress, "registerResults": dict(FLOWREGISTER_RESULTS), "runningJobs": list(FLOWLOGIN_JOBS)})
            elif path == "/flowagent/setup":
                self._json({
                    "result": setup_flow_agent(
                        body.get("deviceIds", "all"),
                        install=body.get("install", True),
                        launch=body.get("launch", True),
                        open_accessibility=body.get("openAccessibility", False),
                    ),
                    "devices": _get_cached_devices(),
                    "agents": list_agents(),
                })
            elif path == "/flowagent/setup-smart":
                # Etapa C: setup idempotente. No reinstala si ya esta. No relaunchea
                # si el agente ya esta conectado. Captura/MediaProjection es opt-in.
                self._json({
                    "result": setup_flow_agent_smart(
                        body.get("deviceIds", "all"),
                        request_capture=body.get("requestCapture", False),
                        force_relaunch=body.get("forceRelaunch", True),
                    ),
                    "devices": _get_cached_devices(),
                    "agents": list_agents(),
                })
            elif path == "/flowkeyboard/status":
                serial = str(body.get("serial", "") or "").strip()
                if serial:
                    self._json(flow_keyboard_status(serial))
                else:
                    self._json({"result": flow_keyboard_status_many(body.get("deviceIds", "all"))})
            elif path == "/flowkeyboard/prepare":
                self._json({
                    "result": prepare_flow_keyboard(body.get("deviceIds", "all")),
                    "devices": _get_cached_devices(),
                    "agents": list_agents(),
                })
            elif path == "/flowkeyboard/type":
                result, status = flow_keyboard_type(
                    body.get("serial", ""),
                    body.get("text", ""),
                    body.get("delayMs", 0),
                )
                self._json(result, status)
            elif path == "/flowkeyboard/type-human":
                # Etapa B Nivel 3 - tipeo humano desde el IME FlowKeyboard.
                # Body: {"serial":"...","text":"...","minDelayMs":60,"maxDelayMs":180}
                result, status = flow_keyboard_type_human(
                    body.get("serial", ""),
                    body.get("text", ""),
                    body.get("minDelayMs", 60),
                    body.get("maxDelayMs", 180),
                )
                self._json(result, status)
            elif path == "/flowkeyboard/select-via-settings":
                # Etapa B Nivel 3 - selecciona FlowKeyboard como IME default
                # navegando Settings con clicks reales por uiautomator.
                # Solo hace falta una vez por dispositivo (Android persiste).
                # Body: {"serial":"..."}
                result, status = flow_keyboard_select_via_settings(
                    body.get("serial", ""),
                )
                self._json(result, status)
            elif path == "/flowkeyboard/command":
                result, status = flow_keyboard_command(
                    body.get("serial", ""),
                    body.get("action", ""),
                    count=body.get("count", 1),
                )
                self._json(result, status)
            elif path == "/clone-apks/install":
                device_ids = body.get("deviceIds", "all")
                self._json({
                    "result": install_clone_apks(device_ids, body.get("clones", None)),
                    "devices": _get_cached_devices(),
                    "inventory": clone_apk_inventory(),
                    "status": clone_apk_status(device_ids),
                })
            elif path == "/clone-apks/uninstall":
                device_ids = body.get("deviceIds", "all")
                self._json({
                    "result": uninstall_clone_apks(device_ids, body.get("clones", None)),
                    "devices": _get_cached_devices(),
                    "inventory": clone_apk_inventory(),
                    "status": clone_apk_status(device_ids),
                })
            elif path == "/device-public-ip":
                self._json({"info": refresh_device_public_ip(body.get("serial", "")), "devices": _get_cached_devices()})
            elif path == "/device-name":
                set_device_name(body.get("serial", ""), body.get("name", ""))
                self._json({"devices": _get_cached_devices(), "names": load_device_names()})
            elif path == "/device-person":
                set_device_person(body.get("serial", ""), body.get("person", ""))
                self._json({"devices": _get_cached_devices(), "names": load_device_names()})
            elif path == "/device-groups":
                self._json(save_device_groups(body))
            elif path == "/device-mac":
                serial = body.get("serial", "")
                mac = get_device_mac_address(serial)
                self._json({"serial": serial, "macAddress": mac})
            elif path == "/agent/command":
                self._json({"response": send_agent_command(
                    body.get("agentId", ""),
                    body.get("command", {}),
                    timeout=body.get("timeout", 12),
                )})
            # ─── Etapa B (Fase 4) - Bridge ScriptRunner del FlowAgent monolito ───────
            elif path == "/flowagent/run-script":
                # Ejecuta un script .js dentro del FlowAgent monolito usando el motor
                # Rhino embebido de AutoJs6. Solo funciona contra dispositivos que tengan
                # el monolito Etapa B instalado (versionCode >= 100). En dispositivos con
                # FlowAgent 0.3.8 stable el comando devolvera ok=false.
                #
                # Body: {"serial": "192.168.1.43:5555", "path": "/sdcard/Download/Login.js",
                #        "workingDir": "/sdcard/Download", "timeout": 12}
                # Respuesta: {"response": {"ok": true, "executionId": "exec-N-T"}}
                serial = str(body.get("serial", "") or "").strip()
                if not serial:
                    self._json({"error": "Falta serial."}, 400)
                    return
                agent = wait_agent_for_serial(serial, timeout=4)
                if not agent:
                    self._json({"error": f"FlowAgent no conectado para {serial}."}, 404)
                    return
                command = {
                    "name": "run_script",
                    "path": str(body.get("path", "") or "").strip(),
                    "workingDir": str(body.get("workingDir", "") or "").strip(),
                }
                if not command["path"]:
                    self._json({"error": "Falta path al script."}, 400)
                    return
                try:
                    response = agent_result(agent, command, timeout=body.get("timeout", 12))
                    self._json({"response": response})
                except Exception as exc:
                    self._json({"error": str(exc)}, 500)
            elif path == "/flowagent/stop-script":
                # Detiene un script lanzado por /flowagent/run-script.
                # Body: {"serial": "192.168.1.43:5555", "executionId": "exec-N-T", "timeout": 8}
                #   executionId="*" detiene todos los scripts lanzados en ese dispositivo.
                # Respuesta: {"response": {"ok": true, "stopped": N}}
                serial = str(body.get("serial", "") or "").strip()
                if not serial:
                    self._json({"error": "Falta serial."}, 400)
                    return
                agent = wait_agent_for_serial(serial, timeout=4)
                if not agent:
                    self._json({"error": f"FlowAgent no conectado para {serial}."}, 404)
                    return
                command = {
                    "name": "stop_script",
                    "executionId": str(body.get("executionId", "*") or "*").strip(),
                }
                try:
                    response = agent_result(agent, command, timeout=body.get("timeout", 8))
                    self._json({"response": response})
                except Exception as exc:
                    self._json({"error": str(exc)}, 500)
            elif path == "/flowagent/ocr-detect":
                # Etapa B (Fase 5) - OCR de la pantalla actual del .43 usando MLKit.
                # Body: {"serial": "192.168.1.43:5555", "timeout": 8000}
                # Respuesta:
                #   {"response":{"ok":true,
                #                "text":"texto detectado\n...",
                #                "blocks":[{"text","x","y","w","h","confidence"},...]}}
                serial = str(body.get("serial", "") or "").strip()
                if not serial:
                    self._json({"error": "Falta serial."}, 400)
                    return
                agent = wait_agent_for_serial(serial, timeout=5)
                if not agent:
                    self._json({"error": f"FlowAgent no conectado para {serial}."}, 404)
                    return
                try:
                    preflight = agent_result(
                        agent,
                        {"name": "capture_screen_start", "streamFrames": False},
                        timeout=8,
                        raise_on_error=False,
                    )
                    if not preflight.get("ok"):
                        self._json({"response": preflight})
                        return
                    agent = wait_agent_for_serial(serial, timeout=3) or agent
                except Exception:
                    agent = wait_agent_for_serial(serial, timeout=3) or agent
                command = {
                    "name": "ocr_detect",
                    "timeout": int(body.get("timeout", 8000) or 8000),
                }
                try:
                    response = agent_result(agent, command, timeout=(command["timeout"] / 1000.0) + 4)
                    self._json({"response": response})
                except Exception as exc:
                    self._json({"error": str(exc)}, 500)
            elif path == "/flowagent/find-template":
                # Etapa B (Fase 6) - Busqueda de template via OpenCV en la pantalla del .43.
                # Body: {"serial":"192.168.1.43:5555",
                #        "templatePath":"/sdcard/templates/spotify.png",
                #        "threshold":0.85, "timeout":12}
                # Respuesta:
                #   {"response":{"ok":true,"found":true,"x":540,"y":960,"score":0.93,
                #                "templateW":120,"templateH":120,"screenW":1080,"screenH":1920}}
                serial = str(body.get("serial", "") or "").strip()
                if not serial:
                    self._json({"error": "Falta serial."}, 400)
                    return
                agent = wait_agent_for_serial(serial, timeout=5)
                if not agent:
                    self._json({"error": f"FlowAgent no conectado para {serial}."}, 404)
                    return
                command = {
                    "name": "image_match_template",
                    "templatePath": str(body.get("templatePath", "") or "").strip(),
                    "threshold": float(body.get("threshold", 0.85) or 0.85),
                }
                if not command["templatePath"]:
                    self._json({"error": "Falta templatePath"}, 400)
                    return
                try:
                    response = agent_result(agent, command, timeout=body.get("timeout", 12))
                    self._json({"response": response})
                except Exception as exc:
                    self._json({"error": str(exc)}, 500)
            elif path == "/pro-stream/start":
                self._json({"stream": start_scrcpy_native_stream(body.get("serial", ""), body)})
            elif path == "/pro-stream/start-selected":
                serials = body.get("serials", [])
                layout = pro_stream_layout(
                    serials,
                    columns=body.get("columns"),
                    width=body.get("width", 360),
                    height=body.get("height", 720),
                    gap=body.get("gap", 12),
                    start_x=body.get("startX", 60),
                    start_y=body.get("startY", 70),
                )
                streams = []
                for item in layout:
                    options = dict(body)
                    options.update(item)
                    streams.append(start_scrcpy_native_stream(item["serial"], options))
                self._json({"streams": streams, "layout": layout})
            elif path == "/pro-stream/stop":
                self._json(stop_scrcpy_native_stream(body.get("serial", "")))
            elif path == "/pro-stream/stop-all":
                self._json({"result": stop_all_scrcpy_native_streams()})
            elif path == "/pro-stream/layout":
                serials = body.get("serials", [])
                layout = pro_stream_layout(
                    serials,
                    columns=body.get("columns"),
                    width=body.get("width", 360),
                    height=body.get("height", 720),
                    gap=body.get("gap", 12),
                    start_x=body.get("startX", 60),
                    start_y=body.get("startY", 70),
                )
                self._json({"layout": layout})
            elif path == "/recordings/start":
                self._json({"recording": start_scrcpy_recording(body.get("serial", ""), body)})
            elif path == "/recordings/stop":
                self._json({"recording": stop_scrcpy_recording(body.get("serial", ""))})
            elif path == "/recordings/status":
                self._json({"recording": scrcpy_recording_status(body.get("serial", ""))})
            elif path == "/recordings/stop-all":
                self._json({"result": stop_all_scrcpy_recordings()})
            elif path == "/debug/dump":
                # Endpoint de diagnostico: dump de nodos por serial para inspeccionar
                # pantallas aunque FLAG_SECURE este activo (usa FlowAgent por socket).
                serial = str(body.get("serial", "") or "").strip()
                if not serial:
                    self._json({"error": "Falta serial."}, 400)
                    return
                agent = agent_for_serial(serial)
                if not agent:
                    self._json({"error": f"FlowAgent no conectado para {serial}."}, 404)
                    return
                try:
                    nodes = agent_dump(agent, max_nodes=600, timeout=15)
                    simplified = []
                    for n in nodes:
                        label = agent_node_label(n).strip()
                        bounds = agent_bounds(n)
                        entry = {
                            "text": label,
                            "class": str(n.get("className", "") or ""),
                            "resourceId": str(n.get("resourceId", "") or ""),
                            "clickable": bool(n.get("clickable")),
                            "editable": bool(n.get("editable") or n.get("className", "").endswith("EditText")),
                            "focused": bool(n.get("focused")),
                        }
                        if bounds:
                            entry["bounds"] = f"[{bounds['left']},{bounds['top']}][{bounds['right']},{bounds['bottom']}]"
                            entry["center"] = f"{bounds['centerX']},{bounds['centerY']}"
                        simplified.append(entry)
                    self._json({"serial": serial, "nodeCount": len(simplified), "nodes": simplified})
                except Exception as exc:
                    self._json({"error": str(exc)}, 500)
            # ─── Focus PRO Panel - endpoints (Fases 2-7) ──────────────────
            elif path == "/apps/list":
                self._json({"items": apps_list(body.get("serial", ""), bool(body.get("thirdPartyOnly", True)))})
            elif path == "/apps/launch":
                self._json(apps_launch(body.get("serial", ""), body.get("packageName", "")))
            elif path == "/apps/force-stop":
                self._json(apps_force_stop(body.get("serial", ""), body.get("packageName", "")))
            elif path == "/apps/clear-cache":
                self._json(apps_clear_cache(body.get("serial", ""), body.get("packageName", "")))
            elif path == "/apps/uninstall":
                self._json(apps_uninstall(body.get("serial", ""), body.get("packageName", "")))
            elif path == "/apps/details":
                self._json(apps_details(body.get("serial", ""), body.get("packageName", "")))
            elif path == "/apps/icon":
                self._json(apps_icon(body.get("serial", ""), body.get("packageName", "")))
            elif path == "/apps/install":
                fs = _read_multipart(self)
                serial = (fs.getvalue("serial") or "").strip()
                apk_field = fs["apk"] if "apk" in fs else None
                tmp_path, original, size = _save_multipart_file(apk_field)
                try:
                    result = apps_install(serial, tmp_path)
                    result["originalName"] = original
                    result["size"] = size
                    self._json(result)
                finally:
                    _safe_remove(tmp_path)
            elif path == "/file-push":
                fs = _read_multipart(self)
                serial = (fs.getvalue("serial") or "").strip()
                remote_path = (fs.getvalue("path") or "/sdcard/Download/").strip()
                file_field = fs["file"] if "file" in fs else None
                tmp_path, original, size = _save_multipart_file(file_field)
                try:
                    if remote_path.endswith("/"):
                        remote_path_full = remote_path + original
                    else:
                        remote_path_full = remote_path
                    result = push_file_to_device(serial, tmp_path, remote_path_full)
                    result["originalName"] = original
                    result["size"] = size
                    self._json(result)
                finally:
                    _safe_remove(tmp_path)
            elif path == "/autojs/push":
                fs = _read_multipart(self)
                serial = (fs.getvalue("serial") or "").strip()
                force = (fs.getvalue("force") or "").strip().lower() in {"1", "true", "yes"}
                script_field = fs["script"] if "script" in fs else None
                tmp_path, original, size = _save_multipart_file(script_field)
                try:
                    result = autojs_push_script(serial, tmp_path, original, force=force)
                    result["originalName"] = original
                    result["size"] = size
                    self._json(result)
                finally:
                    _safe_remove(tmp_path)
            elif path == "/autojs/prepare-overlay":
                self._json(autojs_prepare_overlay(body.get("serial", "")))
            elif path == "/autojs/install-bundled":
                self._json(autojs_install_bundled(body.get("serial", "")))
            elif path == "/system/open-settings":
                self._json(system_open_settings(body.get("serial", ""), body.get("shortcut", "main")))
            elif path == "/power/reboot":
                self._json(power_reboot(body.get("serial", "")))
            elif path == "/power/shutdown":
                self._json(power_shutdown(body.get("serial", "")))
            elif path == "/control/tap":
                self._json(*control_adb_tap(body))
            elif path == "/control/touch":
                self._json(*control_adb_touch(body))
            elif path == "/control/swipe":
                self._json(*control_adb_swipe(body))
            elif path == "/control/keyevent":
                self._json(*control_adb_keyevent(body))
            elif path == "/control/type-text":
                self._json(*control_type_text(body))
            elif path == "/control/paste-text":
                self._json(*control_paste_text(body))
            elif path == "/validate-license":
                result = validate_device_license(
                    body.get("device_email", ""),
                    body.get("license_key", ""),
                    device_info={
                        "hostname": body.get("device_hostname", ""),
                        "serial": body.get("device_serial", ""),
                        "os": body.get("device_os", ""),
                        "ip": body.get("ip_public", ""),
                        "country": body.get("country_code", ""),
                        "device_hash": body.get("device_hash", ""),
                        "windows_user": body.get("windows_user", ""),
                        "local_ip": body.get("local_ip", ""),
                        "mac_address": body.get("mac_address", "") or body.get("device_mac", ""),
                        "country_name": body.get("country_name", ""),
                    }
                )
                if ENTITLEMENTS_AVAILABLE and entitlements_module is not None and isinstance(result, dict):
                    entitlements_module.set_entitlements(result, source="validate")
                self._json(result)
            elif path == "/screen-stream/start" and SCRCPY_AVAILABLE:
                # Iniciar streaming de pantalla
                serial = body.get("serial", "")
                max_width = body.get("maxWidth", 1920)
                bit_rate = body.get("bitRate", 8000000)
                max_fps = body.get("maxFps", 30)
                
                if not serial:
                    self._json({"error": "serial es requerido"}, 400)
                else:
                    success = scrcpy_manager.start_stream(serial, max_width, bit_rate, max_fps)
                    if success:
                        self._json({"success": True, "serial": serial, "maxWidth": max_width, "bitRate": bit_rate, "maxFps": max_fps})
                    else:
                        self._json({"error": "No se pudo iniciar el streaming"}, 500)
            elif path == "/screen-stream/stop" and SCRCPY_AVAILABLE:
                # Detener streaming de pantalla
                serial = body.get("serial", "")
                if not serial:
                    self._json({"error": "serial es requerido"}, 400)
                else:
                    success = scrcpy_manager.stop_stream(serial)
                    self._json({"success": success, "serial": serial})
            elif path == "/streaming/raw/stop":
                # @Added Etapa C 2026-05-28: cerrar manualmente una sesion raw H.264.
                serial = body.get("serial", "")
                preset = body.get("preset", "balanced")
                if not serial:
                    self._json({"error": "serial requerido"}, 400)
                elif SCRCPY_RAW_STREAMER is None:
                    self._json({"error": "scrcpy raw no disponible"}, 503)
                else:
                    SCRCPY_RAW_STREAMER.stop_session(serial, preset)
                    self._json({"success": True, "serial": serial, "preset": preset})
            elif path == "/streaming/raw/recover":
                # Recovery H.264 por dispositivo: no reinicia la flota ni toca FlowAgent.
                serial = body.get("serial", "")
                preset = body.get("preset", "balanced")
                if not serial:
                    self._json({"error": "serial requerido"}, 400)
                elif SCRCPY_RAW_STREAMER is None:
                    self._json({"error": "scrcpy raw no disponible"}, 503)
                else:
                    result = SCRCPY_RAW_STREAMER.recover_session(
                        serial,
                        preset,
                        force=bool(body.get("force", False)),
                        kill_legacy_raw=bool(body.get("killLegacyRaw", False)),
                        grace_sec=float(body.get("graceSec", 5.0)),
                        min_bytes=int(body.get("minBytes", 2048)),
                        max_chunks=int(body.get("maxChunks", 16)),
                    )
                    self._json(result)
            elif path.startswith("/screen-stream/frame/") and SCRCPY_AVAILABLE:
                # Obtener frame más reciente (para polling)
                serial = path.split("/")[-1]
                stream = scrcpy_manager.get_stream(serial)
                if not stream:
                    self._json({"error": "Stream not found"}, 404)
                else:
                    frame = stream.get_latest_frame()
                    if frame:
                        self.send_response(200)
                        self.send_header("Content-Type", "application/octet-stream")
                        self.send_header("Content-Length", len(frame))
                        self.end_headers()
                        self.wfile.write(frame)
                    else:
                        self._json({"error": "No frame available"}, 204)
            elif path == "/streaming/quality":
                # Etapa C: setear preset global (eco/balanced/pro/custom). Solo persiste
                # el valor; el cliente Electron lo aplica al iniciar el siguiente focus.
                preset = str(body.get("preset", "balanced") or "balanced").strip().lower()
                if preset not in {"eco", "balanced", "pro", "custom"}:
                    self._json({"error": "preset invalido"}, 400)
                else:
                    self._json({"ok": True, "preset": preset})
            elif path == "/update-check":
                self._json(start_visual_update_check())

            # ─── Inspector endpoints ──────────────────────────────────────────
            elif path == "/inspector/dump":
                self._json(*inspector_dump(body))
            elif path == "/inspector/tap":
                self._json(*inspector_tap(body))
            elif path == "/inspector/long-press":
                self._json(*inspector_long_press(body))
            elif path == "/inspector/input-text":
                self._json(*inspector_input_text(body))
            elif path == "/inspector/scroll":
                self._json(*inspector_scroll(body))
            elif path == "/inspector/blind-search":
                self._json(*inspector_blind_search(body))
            elif path == "/inspector/accessibility-dump":
                self._json(*inspector_accessibility_dump(body))
            elif path == "/inspector/native-detect":
                self._json(*inspector_native_detect(body))
            elif path == "/inspector/web-detect":
                self._json(*inspector_web_detect(body))
            elif path == "/inspector/auto-detect":
                self._json(*inspector_auto_detect(body))
            elif path == "/inspector/cdp-connect":
                self._json(*inspector_cdp_connect(body))
            elif path == "/inspector/cdp-dump":
                self._json(*inspector_cdp_dump(body))

            else:
                self._json({"error": "Ruta no encontrada."}, 404)
        except Exception as exc:
            self._json({"error": str(exc)}, 500)

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} - {fmt % args}")


# ═══════════════════════════════════════════════════════════════════════════
# INSPECTOR ENDPOINTS — Dev Mode Inspector
# ═══════════════════════════════════════════════════════════════════════════

# Caché de árbol UI por serial (TTL 5 segundos)
_UI_TREE_CACHE: dict = {}
_UI_TREE_CACHE_LOCK = threading.Lock()
_UI_TREE_CACHE_TTL = 5.0


def _cache_get(serial):
    with _UI_TREE_CACHE_LOCK:
        entry = _UI_TREE_CACHE.get(serial)
        if entry and (time.time() - entry["ts"]) < _UI_TREE_CACHE_TTL:
            return entry["nodes"]
    return None


def _cache_set(serial, nodes):
    with _UI_TREE_CACHE_LOCK:
        _UI_TREE_CACHE[serial] = {"nodes": nodes, "ts": time.time()}


def _cache_invalidate(serial):
    with _UI_TREE_CACHE_LOCK:
        _UI_TREE_CACHE.pop(serial, None)


def _resolve_serial(requested, devices):
    for dev in devices:
        candidates = {
            dev.get("serial"),
            dev.get("activeSerial"),
            dev.get("id"),
            dev.get("deviceId"),
            dev.get("physicalDeviceId"),
        }
        for t in dev.get("transports", []):
            if "serial" in t:
                candidates.add(t["serial"])
                
        if requested in candidates:
            active = dev.get("activeSerial") or dev.get("serial") or requested
            if dev.get("state") == "device" or any(t.get("adbState") == "device" for t in dev.get("transports", [])):
                return active
    return None

def _validate_serial(body):
    """Valida serial y devuelve (serial, error_tuple_or_None).
    error_tuple = ({"error": "..."}, http_code)"""
    serial = str(body.get("serial", "") or "").strip()
    if not serial:
        return "", ({"error": "El campo serial es requerido"}, 400)
        
    active_serial = _resolve_serial(serial, _get_cached_devices())
    if active_serial:
        return active_serial, None
        
    devices = list_devices()
    active_serial = _resolve_serial(serial, devices)
    if active_serial:
        return active_serial, None
        
    return serial, ({"error": f"Dispositivo no encontrado o no conectado: {serial}"}, 404)


def _to_int(value, default=0):
    try:
        return int(value)
    except Exception:
        return default


def _to_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    text = str(value).strip().lower()
    if text in ("1", "true", "yes", "y", "on"):
        return True
    if text in ("0", "false", "no", "n", "off", ""):
        return False
    return default


def _first_non_empty(*values):
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def _parse_bounds_value(raw):
    if isinstance(raw, dict):
        data = dict(raw)
        try:
            if all(key in data for key in ("left", "top", "right", "bottom")):
                left = int(data.get("left"))
                top = int(data.get("top"))
                right = int(data.get("right"))
                bottom = int(data.get("bottom"))
            elif all(key in data for key in ("x", "y", "width", "height")):
                left = int(data.get("x"))
                top = int(data.get("y"))
                right = left + int(data.get("width"))
                bottom = top + int(data.get("height"))
            elif all(key in data for key in ("left", "top", "width", "height")):
                left = int(data.get("left"))
                top = int(data.get("top"))
                right = left + int(data.get("width"))
                bottom = top + int(data.get("height"))
            else:
                return None
        except Exception:
            return None
    else:
        text = str(raw or "").strip()
        if not text:
            return None
        match = NODE_BOUNDS_RE.match(text)
        if match:
            left, top, right, bottom = [int(v) for v in match.groups()]
        else:
            parts = [p.strip() for p in text.split(",")]
            if len(parts) != 4:
                return None
            try:
                left, top, right, bottom = [int(v) for v in parts]
            except Exception:
                return None
    width = right - left
    height = bottom - top
    if width <= 0 or height <= 0:
        return None
    return {
        "left": left,
        "top": top,
        "right": right,
        "bottom": bottom,
        "width": width,
        "height": height,
    }


def normalize_node(raw, method):
    data = dict(raw or {})
    method_key = str(method or data.get("method") or "uiautomator").strip() or "uiautomator"
    type_hint = str(data.get("type", "") or "").strip().lower()
    if type_hint in ("native", "web"):
        node_type = type_hint
    elif method_key in ("cdp", "js_inject", "react_native", "ionic", "flutter", "network_intercept"):
        node_type = "web"
    else:
        node_type = "native"

    node_id = str(data.get("id", "") or "").strip()
    if not node_id:
        seed = "|".join([
            method_key,
            str(data.get("depth", "")),
            _first_non_empty(data.get("class"), data.get("className"), data.get("tagName")),
            _first_non_empty(data.get("text"), data.get("contentDesc"), data.get("resourceId"), data.get("resource-id")),
            str(data.get("bounds", "")),
            str(time.time_ns()),
            uuid.uuid4().hex,
        ])
        node_id = f"node_{hashlib.md5(seed.encode('utf-8')).hexdigest()[:12]}"

    bounds = _parse_bounds_value(data.get("bounds"))
    center_x = ((bounds["left"] + bounds["right"]) // 2) if bounds else None
    center_y = ((bounds["top"] + bounds["bottom"]) // 2) if bounds else None

    children = data.get("children")
    if isinstance(children, list):
        children = [str(child) for child in children if child is not None and str(child).strip()]
    else:
        children = []
    parent = data.get("parent")
    parent = None if parent is None or str(parent).strip() == "" else str(parent)
    attrs = data.get("attributes")
    if not isinstance(attrs, dict):
        attrs = {}

    resource_id = _first_non_empty(data.get("resourceId"), data.get("resource-id"))
    dom_id = _first_non_empty(data.get("domId"), data.get("dom_id"), data.get("id_attr"))
    if node_type == "web" and not dom_id:
        dom_id = _first_non_empty(data.get("id"), resource_id)

    class_value = _first_non_empty(data.get("class"), data.get("className"))
    tag_name = _first_non_empty(data.get("tagName"), data.get("nodeName")).lower()

    known_keys = {
        "id", "type", "method", "detectionSource", "depth", "index", "class", "tagName", "nodeName",
        "text", "nodeValue", "innerText", "desc", "contentDesc", "content-desc", "resourceId", "resource-id",
        "domId", "dom_id", "id_attr", "className", "package", "packageName", "bounds", "centerX", "centerY",
        "center_x", "center_y", "clickable", "enabled", "focusable", "focused", "scrollable", "longClickable",
        "long-clickable", "checkable", "checked", "selected", "password", "children", "parent", "attributes",
        "aria-label", "ariaLabel"
    }
    for key, value in data.items():
        if key in known_keys or key in attrs:
            continue
        if value is None:
            continue
        attrs[key] = value

    return {
        "id": node_id,
        "type": node_type,
        "method": method_key,
        "detectionSource": str(data.get("detectionSource") or method_key),
        "depth": _to_int(data.get("depth"), 0),
        "index": _to_int(data.get("index"), 0),
        "class": class_value if node_type == "native" else None,
        "tagName": tag_name or None,
        "text": _first_non_empty(data.get("text"), data.get("nodeValue"), data.get("innerText"), data.get("desc"), data.get("contentDesc"), data.get("content-desc")),
        "resourceId": resource_id,
        "domId": dom_id or None,
        "className": _first_non_empty(data.get("className"), data.get("class")) or None,
        "contentDesc": _first_non_empty(data.get("contentDesc"), data.get("content-desc"), data.get("desc"), data.get("aria-label"), data.get("ariaLabel")),
        "package": _first_non_empty(data.get("package"), data.get("packageName")),
        "bounds": bounds,
        "centerX": center_x,
        "centerY": center_y,
        "clickable": _to_bool(data.get("clickable"), False),
        "enabled": _to_bool(data.get("enabled"), True),
        "focusable": _to_bool(data.get("focusable"), False),
        "focused": _to_bool(data.get("focused"), False),
        "scrollable": _to_bool(data.get("scrollable"), False),
        "longClickable": _to_bool(data.get("longClickable", data.get("long-clickable")), False),
        "checkable": _to_bool(data.get("checkable"), False),
        "checked": _to_bool(data.get("checked"), False),
        "selected": _to_bool(data.get("selected"), False),
        "password": _to_bool(data.get("password"), False),
        "children": children,
        "parent": parent,
        "attributes": attrs,
    }


def _normalize_node(attrib, method, node_id, depth, parent_id, children_ids):
    raw = dict(attrib or {})
    raw["id"] = node_id
    raw["depth"] = depth
    raw["parent"] = parent_id
    raw["children"] = children_ids
    return normalize_node(raw, method)


def parse_ui_xml(xml_string, method="uiautomator"):
    text = str(xml_string or "").strip()
    if not text:
        return []
    root = ET.fromstring(text)
    return _xml_to_nodes(root, method)


def _xml_to_nodes(root, method="uiautomator"):
    """Convierte árbol XML de uiautomator a lista plana de nodos normalizados."""
    nodes = []
    counter = [0]

    def walk(elem, parent_id, depth):
        node_id = f"node_{counter[0]:04d}"
        counter[0] += 1
        children_ids = []
        node = _normalize_node(dict(elem.attrib), method, node_id, depth, parent_id, children_ids)
        nodes.append(node)
        for child in list(elem):
            child_id = walk(child, node_id, depth + 1)
            children_ids.append(child_id)
        return node_id

    walk(root, None, 0)
    return nodes


# ── Endpoint handlers ────────────────────────────────────────────────────────

def inspector_dump(body):
    serial, err = _validate_serial(body)
    if err:
        return err
    refresh = bool(body.get("refresh"))
    cached = None if refresh else _cache_get(serial)
    if cached:
        return {"ok": True, "nodes": cached, "cached": True, "method_used": "uiautomator"}, 200
    try:
        root = dump_ui(serial, timeout=10)
        xml_str = ET.tostring(root, encoding="unicode")
        nodes = parse_ui_xml(xml_str, method="uiautomator")
        _cache_set(serial, nodes)
        return {"ok": True, "nodes": nodes, "xml": xml_str, "cached": False, "method_used": "uiautomator"}, 200
    except Exception as exc:
        msg = str(exc)
        if "No se pudo leer" in msg or "timeout" in msg.lower():
            return {"error": "Timeout al capturar UI del dispositivo"}, 408
        return {"ok": False, "error": msg}, 500


def inspector_tap(body):
    serial, err = _validate_serial(body)
    if err:
        return err
    x, y = body.get("x"), body.get("y")
    if x is None or y is None:
        return {"error": "Los campos x e y son requeridos"}, 400
    try:
        adb_tap(serial, int(x), int(y))
        _cache_invalidate(serial)
        return {"ok": True}, 200
    except Exception as exc:
        return {"ok": False, "error": str(exc)}, 500


def inspector_long_press(body):
    serial, err = _validate_serial(body)
    if err:
        return err
    x, y = body.get("x"), body.get("y")
    duration = int(body.get("duration", 800))
    if x is None or y is None:
        return {"error": "Los campos x e y son requeridos"}, 400
    try:
        adb_shell(serial, f"input swipe {int(x)} {int(y)} {int(x)} {int(y)} {duration}", timeout=10)
        _cache_invalidate(serial)
        return {"ok": True}, 200
    except Exception as exc:
        return {"ok": False, "error": str(exc)}, 500


def inspector_input_text(body):
    serial, err = _validate_serial(body)
    if err:
        return err
    x, y = body.get("x"), body.get("y")
    text = str(body.get("text", "") or "")
    if x is None or y is None:
        return {"error": "Los campos x e y son requeridos"}, 400
    try:
        adb_tap(serial, int(x), int(y))
        time.sleep(0.3)
        adb_input_text(serial, text)
        return {"ok": True}, 200
    except Exception as exc:
        return {"ok": False, "error": str(exc)}, 500


def inspector_scroll(body):
    serial, err = _validate_serial(body)
    if err:
        return err
    x  = int(body.get("x",  540))
    y1 = int(body.get("y1", 960))
    y2 = int(body.get("y2", 960))
    direction = str(body.get("direction", "up"))
    try:
        if direction == "up":
            cmd = f"input swipe {x} {y2} {x} {y1} 400"
        else:
            cmd = f"input swipe {x} {y1} {x} {y2} 400"
        adb_shell(serial, cmd, timeout=10)
        return {"ok": True}, 200
    except Exception as exc:
        return {"ok": False, "error": str(exc)}, 500


def inspector_blind_search(body):
    serial, err = _validate_serial(body)
    if err:
        return err
    query = str(body.get("query", "") or "").strip().lower()
    field_input = str(body.get("field", "any") or "any").strip()
    field_lower = field_input.lower()
    if field_lower == "resourceid":
        field = "resourceId"
    elif field_lower in ("any", "text", "class"):
        field = field_lower
    else:
        return {"error": "El campo field debe ser any, text, resourceId o class"}, 400
    if not query:
        return {"error": "El campo query es requerido"}, 400
    try:
        root = dump_ui(serial, timeout=10)
        xml_str = ET.tostring(root, encoding="unicode")
        nodes = parse_ui_xml(xml_str, method="uiautomator")
        results = []
        for node in nodes:
            text = str(node.get("text", "") or "")
            rid = str(node.get("resourceId", "") or "")
            cls = str(node.get("class", "") or "")
            match = False
            if field in ("any", "text") and query in text.lower():
                match = True
            if field in ("any", "resourceId") and query in rid.lower():
                match = True
            if field in ("any", "class") and query in cls.lower():
                match = True
            if match:
                short_cls = cls.split(".")[-1]
                results.append({
                    "class": short_cls,
                    "text": text,
                    "resourceId": rid,
                    "centerX": node.get("centerX"),
                    "centerY": node.get("centerY"),
                    "clickable": bool(node.get("clickable")),
                    "enabled": bool(node.get("enabled", True)),
                    "bounds": node.get("bounds"),
                })
        return {"ok": True, "results": results}, 200
    except Exception as exc:
        return {"ok": False, "error": str(exc)}, 500


def inspector_accessibility_dump(body):
    serial, err = _validate_serial(body)
    if err:
        return err
    agent = agent_for_serial(serial)
    if not agent:
        return {"error": f"FlowAgent no conectado para {serial}. Verifica que el APK esté activo."}, 404
    try:
        access_result = agent_result(
            agent,
            {"name": "get_accessibility_tree", "maxNodes": 600},
            timeout=10,
            raise_on_error=False,
        )
        result = []
        if isinstance(access_result, dict) and access_result.get("ok"):
            for key in ("nodes", "tree", "items"):
                candidate = access_result.get(key)
                if isinstance(candidate, list):
                    result = candidate
                    break
        if not result:
            result = agent_dump(agent, max_nodes=600, timeout=10)
        nodes = []
        for i, n in enumerate(result):
            raw = {
                "id": f"node_{i:04d}",
                "type": "native",
                "depth": int(n.get("depth", 0) or 0),
                "index": i,
                "class": str(n.get("className", "") or ""),
                "className": str(n.get("className", "") or ""),
                "text": str(n.get("text", "") or n.get("desc", "") or ""),
                "resourceId": str(n.get("resourceId", "") or ""),
                "contentDesc": str(n.get("desc", "") or ""),
                "package": str(n.get("packageName", "") or ""),
                "bounds": agent_bounds(n),
                "clickable": n.get("clickable"),
                "enabled": n.get("enabled", True),
                "focusable": n.get("focusable"),
                "focused": n.get("focused"),
                "scrollable": n.get("scrollable"),
                "longClickable": n.get("longClickable"),
                "checkable": n.get("checkable"),
                "checked": n.get("checked"),
                "selected": n.get("selected"),
                "password": n.get("password"),
                "children": [],
                "parent": None,
                "attributes": {},
            }
            nodes.append(normalize_node(raw, "accessibility"))
        _cache_set(serial, nodes)
        return {"ok": True, "nodes": nodes, "method_used": "accessibility"}, 200
    except Exception as exc:
        msg = str(exc)
        lower = msg.lower()
        if "no respondio a tiempo" in lower or "timeout" in lower:
            return {"error": "Timeout al capturar árbol de accesibilidad"}, 408
        return {"ok": False, "error": msg}, 500


def _native_detect_viewserver(serial):
    service_raw = adb_shell(serial, "service call window 1 i32 4939", timeout=10)
    adb(["-s", serial, "forward", "tcp:4939", "tcp:4939"], timeout=10)
    raw_text = ""
    try:
        chunks = []
        total = 0
        with socket.create_connection(("127.0.0.1", 4939), timeout=4) as sock:
            sock.settimeout(2)
            sock.sendall(b"LIST\n")
            while total < 200000:
                try:
                    data = sock.recv(4096)
                except socket.timeout:
                    break
                if not data:
                    break
                chunks.append(data)
                total += len(data)
                if b"DONE" in data:
                    break
        raw_text = b"".join(chunks).decode("utf-8", errors="replace")
    finally:
        try:
            adb(["-s", serial, "forward", "--remove", "tcp:4939"], timeout=10)
        except Exception:
            pass
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    nodes = []
    for i, line in enumerate(lines[:500]):
        if line.upper().startswith("DONE"):
            continue
        text = line
        pkg = ""
        activity = ""
        parts = line.split(" ", 1)
        if len(parts) == 2:
            text = parts[1].strip() or line
        if "/" in text:
            pkg, activity = text.split("/", 1)
        raw = {
            "id": f"node_{i:04d}",
            "type": "native",
            "depth": 0,
            "index": i,
            "class": "ViewServerWindow",
            "text": text,
            "resourceId": pkg,
            "contentDesc": activity,
            "package": pkg,
            "bounds": None,
            "clickable": False,
            "enabled": True,
            "focusable": False,
            "focused": False,
            "scrollable": False,
            "longClickable": False,
            "checkable": False,
            "checked": False,
            "selected": False,
            "password": False,
            "children": [],
            "parent": None,
            "attributes": {"windowLine": line},
        }
        nodes.append(normalize_node(raw, "viewserver"))
    if not nodes:
        return {"ok": False, "error": "ViewServer no devolvió vistas. Verifica que el dispositivo y la app expongan datos de ventana."}, 503
    meta = {"serviceCall": str(service_raw or "").strip(), "count": len(nodes)}
    return {"ok": True, "nodes": nodes, "method_used": "viewserver", "meta": meta}, 200


def inspector_native_detect(body):
    serial, err = _validate_serial(body)
    if err:
        return err
    method = str(body.get("method", "uiautomator") or "uiautomator")
    options = body.get("options", {}) or {}

    try:
        if method == "uiautomator":
            return inspector_dump(body)

        elif method == "accessibility":
            return inspector_accessibility_dump(body)

        elif method == "dumpsys":
            raw = adb_shell(serial, "dumpsys window windows", timeout=15)
            pkg_match = re.search(r"mCurrentFocus=.*?\s([A-Za-z0-9_.]+)/", raw)
            act_match = re.search(r"mCurrentFocus=.*?/([A-Za-z0-9_.]+)", raw)
            pkg = pkg_match.group(1) if pkg_match else ""
            act = act_match.group(1) if act_match else ""
            node = normalize_node({
                "id": "node_0000",
                "type": "native",
                "depth": 0,
                "index": 0,
                "class": "Window",
                "text": f"{pkg}/{act}",
                "resourceId": pkg,
                "contentDesc": act,
                "package": pkg,
                "bounds": None,
                "clickable": False,
                "enabled": True,
                "focusable": False,
                "focused": True,
                "scrollable": False,
                "longClickable": False,
                "checkable": False,
                "checked": False,
                "selected": False,
                "password": False,
                "children": [],
                "parent": None,
                "attributes": {"rawOutput": raw[:500]},
            }, "dumpsys")
            return {"ok": True, "nodes": [node], "method_used": "dumpsys"}, 200

        elif method == "wm":
            size_raw = adb_shell(serial, "wm size", timeout=5)
            density_raw = adb_shell(serial, "wm density", timeout=5)
            node = normalize_node({
                "id": "node_0000",
                "type": "native",
                "depth": 0,
                "index": 0,
                "class": "WMInfo",
                "text": size_raw.strip(),
                "resourceId": "wm",
                "contentDesc": density_raw.strip(),
                "package": "",
                "bounds": None,
                "clickable": False,
                "enabled": True,
                "focusable": False,
                "focused": False,
                "scrollable": False,
                "longClickable": False,
                "checkable": False,
                "checked": False,
                "selected": False,
                "password": False,
                "children": [],
                "parent": None,
                "attributes": {"size": size_raw.strip(), "density": density_raw.strip()},
            }, "wm")
            return {
                "ok": True,
                "nodes": [node],
                "method_used": "wm",
                "meta": {"size": size_raw.strip(), "density": density_raw.strip()},
            }, 200

        elif method == "pm_dump":
            pkg_raw = adb_shell(serial, "dumpsys window windows", timeout=10)
            pkg_m = re.search(r"mCurrentFocus=.*?\s([A-Za-z0-9_.]+)/", pkg_raw)
            pkg = pkg_m.group(1) if pkg_m else ""
            if pkg:
                dump_raw = adb_shell(serial, f"pm dump {pkg}", timeout=15)
                node = normalize_node({
                    "id": "node_0000",
                    "type": "native",
                    "depth": 0,
                    "index": 0,
                    "class": "PackageInfo",
                    "text": pkg,
                    "resourceId": pkg,
                    "contentDesc": "pm dump",
                    "package": pkg,
                    "bounds": None,
                    "clickable": False,
                    "enabled": True,
                    "focusable": False,
                    "focused": False,
                    "scrollable": False,
                    "longClickable": False,
                    "checkable": False,
                    "checked": False,
                    "selected": False,
                    "password": False,
                    "children": [],
                    "parent": None,
                    "attributes": {"dump": dump_raw[:2000]},
                }, "pm_dump")
                return {
                    "ok": True,
                    "nodes": [node],
                    "method_used": "pm_dump",
                    "meta": {"package": pkg, "dump": dump_raw[:2000]},
                }, 200
            return {"ok": False, "error": "No se pudo determinar el paquete activo"}, 500

        elif method == "logcat":
            raw = adb_shell(serial, "logcat -d -v brief -t 100", timeout=10)
            lines = raw.strip().splitlines()[-100:]
            node = normalize_node({
                "id": "node_0000",
                "type": "native",
                "depth": 0,
                "index": 0,
                "class": "LogcatContext",
                "text": lines[-1] if lines else "",
                "resourceId": "logcat",
                "contentDesc": "logcat -d -v brief -t 100",
                "package": "",
                "bounds": None,
                "clickable": False,
                "enabled": True,
                "focusable": False,
                "focused": False,
                "scrollable": False,
                "longClickable": False,
                "checkable": False,
                "checked": False,
                "selected": False,
                "password": False,
                "children": [],
                "parent": None,
                "attributes": {"lines": lines},
            }, "logcat")
            return {
                "ok": True,
                "nodes": [node],
                "method_used": "logcat",
                "meta": {"lines": lines},
            }, 200

        elif method == "viewserver":
            return _native_detect_viewserver(serial)

        elif method == "screencap_ocr":
            return {"ok": False, "error": "Screencap+OCR requiere Tesseract instalado en el PC. No disponible en esta versión."}, 501

        else:
            return {"error": f"Método desconocido: {method}"}, 400

    except Exception as exc:
        return {"ok": False, "error": str(exc)}, 500


def inspector_web_detect(body):
    serial, err = _validate_serial(body)
    if err:
        return err
    method = str(body.get("method", "cdp") or "cdp").strip().lower()
    options = body.get("options", {}) or {}

    try:
        if method == "cdp":
            return inspector_cdp_dump(body)
        elif method in ("js_inject", "react_native", "ionic", "flutter"):
            connect_result, connect_status = inspector_cdp_connect(body)
            if connect_status != 200 or not connect_result.get("ok"):
                return {"ok": False, "error": f"CDP no disponible: {connect_result.get('error', 'Sin targets')}"}, 503
            targets = connect_result.get("targets", [])
            if not targets:
                return {"ok": False, "error": "No hay WebViews con debugging habilitado. Activa android:debuggable=true."}, 503
            detect_type = method
            target_id = str(options.get("target_id") or body.get("target_id") or targets[0].get("id", "") or "").strip()
            body_with_target = dict(body)
            body_with_target["target_id"] = target_id
            dump_result, dump_status = inspector_cdp_dump(body_with_target)
            if dump_status != 200 or not dump_result.get("ok"):
                return dump_result, dump_status
            dump_result["method_used"] = detect_type
            dump_result.setdefault("meta", {})
            dump_result["meta"].update({
                "web_method": detect_type,
                "target_id": target_id,
                "target_count": len(targets),
            })
            nodes = dump_result.get("nodes", [])
            for node in nodes:
                attrs = node.get("attributes")
                if not isinstance(attrs, dict):
                    attrs = {}
                    node["attributes"] = attrs
                attrs["webMethod"] = detect_type
                attrs["targetId"] = target_id
                if detect_type == "react_native":
                    has_test_id = bool(str(attrs.get("data-testid", "") or "").strip())
                    has_react_id = bool(str(attrs.get("data-reactid", "") or "").strip())
                    attrs["reactHint"] = has_test_id or has_react_id
                elif detect_type == "ionic":
                    tag_name = str(node.get("tagName", "") or "").lower()
                    attrs["ionicHint"] = tag_name.startswith("ion-")
                elif detect_type == "flutter":
                    class_name = str(node.get("className", "") or "").lower()
                    text = str(node.get("text", "") or "").lower()
                    attrs["flutterHint"] = ("flt-" in class_name) or ("flutter" in class_name) or ("flutter" in text)
                elif detect_type == "js_inject":
                    attrs["jsInjectHint"] = True
            return dump_result, 200
        elif method == "network_intercept":
            return {"ok": False, "error": "Network Intercept requiere mitmproxy instalado en el PC."}, 501
        else:
            return {"error": f"Método web desconocido: {method}"}, 400
    except Exception as exc:
        return {"ok": False, "error": str(exc)}, 500


def _auto_detect_has_valid_nodes(nodes):
    if not isinstance(nodes, list) or not nodes:
        return False
    for node in nodes:
        if not isinstance(node, dict):
            continue
        node_id = str(node.get("id", "") or "").strip()
        if node_id:
            return True
        text = str(node.get("text", "") or "").strip()
        resource_id = str(node.get("resourceId", "") or "").strip()
        tag_name = str(node.get("tagName", "") or "").strip()
        class_name = str(node.get("class", "") or "").strip()
        if text or resource_id or tag_name or class_name:
            return True
    return False


def inspector_auto_detect(body):
    serial, err = _validate_serial(body)
    if err:
        return err
    priority = ["uiautomator", "accessibility", "cdp", "dumpsys"]
    timings = {}
    attempts = {}
    for method in priority:
        t0 = time.time()
        try:
            req_body = dict(body)
            req_body["method"] = method
            if method == "cdp":
                result, status = inspector_web_detect(req_body)
            else:
                result, status = inspector_native_detect(req_body)
            elapsed = round((time.time() - t0) * 1000)
            timings[method] = elapsed
            ok_result = bool(result.get("ok")) if isinstance(result, dict) else False
            nodes = result.get("nodes", []) if isinstance(result, dict) else []
            has_nodes = _auto_detect_has_valid_nodes(nodes)
            attempts[method] = {
                "status": status,
                "ok": ok_result,
                "has_nodes": has_nodes,
                "error": str(result.get("error", "")) if isinstance(result, dict) else "",
            }
            if status == 200 and ok_result and has_nodes:
                response = {
                    "ok": True,
                    "method": method,
                    "method_used": method,
                    "nodes": nodes,
                    "timings": timings,
                }
                meta = result.get("meta") if isinstance(result, dict) else None
                if isinstance(meta, dict):
                    response["meta"] = dict(meta)
                return response, 200
        except Exception as exc:
            elapsed = round((time.time() - t0) * 1000)
            timings[method] = elapsed
            attempts[method] = {"status": 500, "ok": False, "has_nodes": False, "error": str(exc)}
    return {"ok": False, "error": "Ningún método de detección produjo resultados.", "timings": timings, "attempts": attempts}, 500


def _cdp_get_targets(serial):
    adb(["-s", serial, "forward", "tcp:9222", "localabstract:chrome_devtools_remote"], timeout=10)
    import urllib.request as _req
    import urllib.error as _err
    try:
        with _req.urlopen("http://localhost:9222/json", timeout=5) as resp:
            payload = resp.read().decode("utf-8", errors="replace")
            raw_targets = json.loads(payload)
    except _err.URLError as exc:
        raise RuntimeError("WebView debugging no habilitado. Activa android:debuggable=true en el AndroidManifest.") from exc
    except Exception as exc:
        raise RuntimeError(f"No se pudo consultar targets CDP: {exc}") from exc
    if not isinstance(raw_targets, list):
        raise RuntimeError("Respuesta CDP inválida: /json no devolvió una lista de targets.")
    targets = []
    for item in raw_targets:
        if not isinstance(item, dict):
            continue
        target_id = str(item.get("id", "") or "").strip()
        if not target_id:
            continue
        normalized = dict(item)
        normalized["id"] = target_id
        normalized["type"] = str(item.get("type", "") or "")
        normalized["title"] = str(item.get("title", "") or "")
        normalized["url"] = str(item.get("url", "") or "")
        normalized["webSocketDebuggerUrl"] = str(item.get("webSocketDebuggerUrl", "") or "").strip()
        targets.append(normalized)
    return targets


def _cdp_ws_call(ws, request_id, method, params=None):
    payload = {"id": request_id, "method": method}
    if params:
        payload["params"] = params
    ws.send(json.dumps(payload))
    for _ in range(30):
        response = json.loads(ws.recv())
        if isinstance(response, dict) and response.get("id") == request_id:
            return response
    return {"id": request_id, "error": {"message": f"Sin respuesta CDP para {method}"}}


def _cdp_extract_bounds_from_box_model(box_model):
    if not isinstance(box_model, dict):
        return None
    points = box_model.get("content")
    if not isinstance(points, list) or len(points) < 8:
        return None
    try:
        xs = [float(points[i]) for i in range(0, len(points), 2)]
        ys = [float(points[i]) for i in range(1, len(points), 2)]
        left = int(min(xs))
        right = int(max(xs))
        top = int(min(ys))
        bottom = int(max(ys))
    except Exception:
        return None
    if right <= left or bottom <= top:
        return None
    return {
        "left": left,
        "top": top,
        "right": right,
        "bottom": bottom,
        "width": right - left,
        "height": bottom - top,
    }


def _cdp_collect_node_ids(dom_node, output):
    if not isinstance(dom_node, dict):
        return
    node_id = _to_int(dom_node.get("nodeId"), 0)
    if node_id > 0:
        output.add(node_id)
    for child in dom_node.get("children", []):
        _cdp_collect_node_ids(child, output)


def _cdp_fetch_bounds_map(ws, node_ids, request_id_start=10, max_nodes=350):
    bounds_map = {}
    request_id = request_id_start
    count = 0
    for node_id in sorted(node_ids):
        if count >= max_nodes:
            break
        resp = _cdp_ws_call(ws, request_id, "DOM.getBoxModel", {"nodeId": node_id})
        request_id += 1
        count += 1
        if not isinstance(resp, dict) or resp.get("error"):
            continue
        model = (resp.get("result") or {}).get("model")
        bounds = _cdp_extract_bounds_from_box_model(model)
        if bounds:
            bounds_map[node_id] = bounds
    return bounds_map


def inspector_cdp_connect(body):
    serial, err = _validate_serial(body)
    if err:
        return err
    try:
        targets = _cdp_get_targets(serial)
        return {"ok": True, "targets": targets}, 200
    except RuntimeError as exc:
        return {"ok": False, "error": str(exc)}, 503
    except Exception as exc:
        return {"ok": False, "error": str(exc)}, 500


def inspector_cdp_dump(body):
    serial, err = _validate_serial(body)
    if err:
        return err
    target_id = str(body.get("target_id", "") or "").strip()
    try:
        targets = _cdp_get_targets(serial)
        if not target_id and targets:
            target_id = targets[0].get("id", "")
        if not target_id:
            return {"ok": False, "error": "No hay targets CDP disponibles. Verifica que la app tenga WebView con debugging habilitado."}, 503
        ws_url = ""
        for item in targets:
            if str(item.get("id", "") or "") == target_id:
                ws_url = str(item.get("webSocketDebuggerUrl", "") or "").strip()
                break
        if not ws_url:
            ws_url = f"ws://localhost:9222/devtools/page/{target_id}"
        try:
            import websocket
        except ImportError:
            return {"ok": False, "error": "Módulo websocket-client no instalado. Ejecuta: pip install websocket-client"}, 501
        ws = None
        try:
            ws = websocket.create_connection(ws_url, timeout=10)
            doc_resp = _cdp_ws_call(ws, 1, "DOM.getDocument", {"depth": -1, "pierce": True})
            if doc_resp.get("error"):
                message = str((doc_resp.get("error") or {}).get("message") or "DOM.getDocument falló")
                return {"ok": False, "error": f"CDP error: {message}"}, 502
            root = (doc_resp.get("result") or {}).get("root")
            if not isinstance(root, dict) or not root:
                return {"ok": False, "error": "CDP no devolvió árbol DOM válido."}, 502
            root_node_id = _to_int(root.get("nodeId"), 0)
            query_total = 0
            if root_node_id > 0:
                query_resp = _cdp_ws_call(ws, 2, "DOM.querySelectorAll", {"nodeId": root_node_id, "selector": "*"})
                query_nodes = (query_resp.get("result") or {}).get("nodeIds", []) if isinstance(query_resp, dict) else []
                if isinstance(query_nodes, list):
                    query_total = len(query_nodes)
            all_node_ids = set()
            _cdp_collect_node_ids(root, all_node_ids)
            bounds_map = _cdp_fetch_bounds_map(ws, all_node_ids, request_id_start=10, max_nodes=350)
            nodes = _cdp_nodes_to_unified(root, bounds_map=bounds_map)
            _cache_set(serial, nodes)
            return {
                "ok": True,
                "nodes": nodes,
                "method_used": "cdp",
                "meta": {
                    "target_id": target_id,
                    "target_count": len(targets),
                    "dom_node_count": len(all_node_ids),
                    "query_selector_total": query_total,
                    "bounds_count": len(bounds_map),
                },
            }, 200
        except Exception as exc:
            return {"ok": False, "error": f"Fallo CDP dump: {exc}"}, 503
        finally:
            if ws is not None:
                try:
                    ws.close()
                except Exception:
                    pass
    except RuntimeError as exc:
        return {"ok": False, "error": str(exc)}, 503
    except Exception as exc:
        return {"ok": False, "error": str(exc)}, 500


def _cdp_nodes_to_unified(dom_node, parent_id=None, depth=0, counter=None, bounds_map=None):
    if counter is None:
        counter = [0]
    if bounds_map is None:
        bounds_map = {}
    nodes = []
    node_id = f"node_{counter[0]:04d}"
    index = counter[0]
    counter[0] += 1
    tag = str(dom_node.get("nodeName", "") or "").lower()
    attrs_list = dom_node.get("attributes", [])
    attrs = {}
    for i in range(0, len(attrs_list) - 1, 2):
        attrs[str(attrs_list[i])] = str(attrs_list[i + 1])
    children_ids = []
    node_numeric_id = _to_int(dom_node.get("nodeId"), 0)
    raw = {
        "id": node_id,
        "type": "web",
        "depth": depth,
        "index": index,
        "class": None,
        "tagName": tag,
        "text": str(dom_node.get("nodeValue", "") or "").strip(),
        "resourceId": attrs.get("id", ""),
        "domId": attrs.get("id", ""),
        "className": attrs.get("class", ""),
        "contentDesc": attrs.get("aria-label", ""),
        "package": "",
        "bounds": bounds_map.get(node_numeric_id),
        "clickable": tag in ("a", "button", "input", "select", "textarea") or "onclick" in attrs,
        "enabled": attrs.get("disabled") is None,
        "focusable": tag in ("a", "button", "input", "select", "textarea"),
        "focused": False,
        "scrollable": False,
        "longClickable": False,
        "checkable": tag == "input" and attrs.get("type") in ("checkbox", "radio"),
        "checked": "checked" in attrs,
        "selected": "selected" in attrs,
        "password": attrs.get("type") == "password",
        "children": children_ids,
        "parent": parent_id,
        "attributes": {
            "nodeId": node_numeric_id,
            "backendNodeId": _to_int(dom_node.get("backendNodeId"), 0),
            "textContent": str(dom_node.get("nodeValue", "") or ""),
            "href": attrs.get("href", ""),
            "src": attrs.get("src", ""),
            "type": attrs.get("type", ""),
            "value": attrs.get("value", ""),
            "disabled": attrs.get("disabled", ""),
            "hidden": attrs.get("hidden", ""),
            **{k: v for k, v in attrs.items() if k not in ("id", "class")},
        },
    }
    node = normalize_node(raw, "cdp")
    nodes.append(node)
    for child in dom_node.get("children", []):
        child_nodes = _cdp_nodes_to_unified(child, node_id, depth + 1, counter, bounds_map)
        if child_nodes:
            children_ids.append(child_nodes[0]["id"])
            nodes.extend(child_nodes)
    return nodes


def _devices_cache_updater():
    """Thread de background que actualiza el cache de dispositivos cada 60s.
    Usa list_devices_fast para evitar llamadas ADB que bloquean."""
    import time as _time
    _update_lock = threading.Lock()
    _known = []
    while True:
        _time.sleep(60)
        if _update_lock.acquire(blocking=False):
            try:
                list_devices_fast(_known)
            except Exception:
                pass
            finally:
                _update_lock.release()


def _apply_reverse_background(serials):
    """Aplica adb reverse a cada dispositivo con pausa entre cada uno."""
    import time as _time
    import subprocess as _sp
    _time.sleep(3)
    for serial in serials:
        try:
            for port in ["8766", "5000", "8765"]:
                try:
                    proc = _sp.Popen(
                        [ADB, "-s", serial, "reverse", f"tcp:{port}", f"tcp:{port}"],
                        stdout=_sp.DEVNULL, stderr=_sp.DEVNULL
                    )
                    proc.wait(timeout=3)
                except Exception:
                    try: proc.kill()
                    except: pass
            _time.sleep(0.2)
        except Exception:
            pass
    print("ADB reverse aplicado en background")


def _flowagent_auto_reconnect_loop():
    import time as _time
    _time.sleep(FLOWAGENT_AUTO_RECONNECT_INITIAL_DELAY)
    print("[flowagent-auto] loop iniciado: reverse + relaunch seguro, sin instalar ni captura")
    while True:
        try:
            try:
                output = adb(["devices"], timeout=10) or ""
            except Exception:
                _time.sleep(FLOWAGENT_AUTO_RECONNECT_INTERVAL)
                continue

            adb_serials = []
            for line in output.splitlines()[1:]:
                parts = line.strip().split()
                if len(parts) >= 2 and parts[1] == "device":
                    adb_serials.append(parts[0])

            cleanup_stale_agents(adb_serials, max_age=0)

            if not adb_serials:
                _time.sleep(FLOWAGENT_AUTO_RECONNECT_INTERVAL)
                continue

            try:
                connected_agents = list_agents()
            except Exception:
                connected_agents = []
            connected_serials = {
                str(a.get("serial") or "").strip() for a in connected_agents
            }

            for serial in adb_serials:
                if serial in connected_serials:
                    with FLOWAGENT_AUTO_RECONNECT_LOCK:
                        state = FLOWAGENT_AUTO_RECONNECT_STATE.setdefault(serial, {})
                        state["lastConnectedAt"] = _time.time()
                        state["failures"] = 0
                    continue  # ya conectado, skip

                now = _time.time()
                with FLOWAGENT_AUTO_RECONNECT_LOCK:
                    state = FLOWAGENT_AUTO_RECONNECT_STATE.setdefault(serial, {})
                    last_attempt = float(state.get("lastAttemptAt", 0) or 0)
                    failures = int(state.get("failures", 0) or 0)
                cooldown = (
                    FLOWAGENT_AUTO_RECONNECT_FAILURE_BACKOFF
                    if failures >= 3
                    else FLOWAGENT_AUTO_RECONNECT_LAUNCH_COOLDOWN
                )
                if now - last_attempt < cooldown:
                    continue

                with FLOWAGENT_AUTO_RECONNECT_LOCK:
                    FLOWAGENT_AUTO_RECONNECT_STATE[serial]["lastAttemptAt"] = now

                try:
                    boot_completed = (adb(["-s", serial, "shell", "getprop", "sys.boot_completed"], timeout=5) or "").strip()
                    if boot_completed != "1":
                        print(f"[flowagent-auto] {serial}: esperando boot_completed={boot_completed or 'vacio'}")
                        continue
                except Exception as exc:
                    print(f"[flowagent-auto] {serial}: boot check fallo: {exc}")
                    continue

                try:
                    installed_info = get_installed_package_info(serial, FLOW_AGENT_PACKAGE)
                    installed_version = str(installed_info.get("versionName") or "")
                    installed_code = int(installed_info.get("versionCode") or 0)
                    if not installed_version:
                        print(f"[flowagent-auto] {serial}: FlowAgent no instalado; se omite auto install")
                        continue
                    if version_tuple(installed_version) < version_tuple(FLOW_AGENT_EXPECTED_VERSION):
                        print(f"[flowagent-auto] {serial}: FlowAgent {installed_version} viejo; requiere actualizacion manual")
                        continue
                    if installed_code and installed_code < FLOW_AGENT_EXPECTED_VERSION_CODE:
                        print(f"[flowagent-auto] {serial}: FlowAgent code {installed_code} viejo; requiere actualizacion manual")
                        continue
                except Exception as exc:
                    print(f"[flowagent-auto] {serial}: version check fallo: {exc}")
                    continue

                try:
                    adb(["-s", serial, "reverse", f"tcp:{AGENT_PORT}", f"tcp:{AGENT_PORT}"], timeout=8)
                    adb(["-s", serial, "reverse", "tcp:8765", "tcp:8765"], timeout=8)
                    adb(["-s", serial, "reverse", "tcp:5000", "tcp:5000"], timeout=8)
                    adb([
                        "-s", serial, "shell", "am", "start",
                        "-n", FLOW_AGENT_ACTIVITY,
                        "--es", "host", "127.0.0.1",
                        "--es", "serial", serial,
                        "--ei", "port", str(AGENT_PORT),
                        "--ez", "autoconnect", "true",
                    ], timeout=12)
                    agent = wait_agent_for_serial(serial, timeout=4.0, interval=0.35)
                    if agent:
                        try:
                            send_agent_command(agent.agent_id, {"name": "engine_probe"}, timeout=8)
                        except Exception as probe_exc:
                            print(f"[flowagent-auto] {serial}: socket conectado, engine_probe aviso: {probe_exc}")
                        with FLOWAGENT_AUTO_RECONNECT_LOCK:
                            state = FLOWAGENT_AUTO_RECONNECT_STATE.setdefault(serial, {})
                            state["lastConnectedAt"] = _time.time()
                            state["failures"] = 0
                        print(f"[flowagent-auto] {serial}: conectado")
                    else:
                        with FLOWAGENT_AUTO_RECONNECT_LOCK:
                            state = FLOWAGENT_AUTO_RECONNECT_STATE.setdefault(serial, {})
                            state["failures"] = int(state.get("failures", 0) or 0) + 1
                        print(f"[flowagent-auto] {serial}: launch enviado, socket aun no conectado")
                except Exception as exc:
                    with FLOWAGENT_AUTO_RECONNECT_LOCK:
                        state = FLOWAGENT_AUTO_RECONNECT_STATE.setdefault(serial, {})
                        state["failures"] = int(state.get("failures", 0) or 0) + 1
                    print(f"[flowagent-auto] {serial}: reconnect fallo: {exc}")

        except Exception as exc:
            print(f"[flowagent-auto] loop excepcion: {exc}")

        _time.sleep(FLOWAGENT_AUTO_RECONNECT_INTERVAL)


def serve_forever():
    # Electron es el producto final: al iniciar el backend solo levantamos
    # servicios. La deteccion/conexion de dispositivos debe ser real y bajo
    # accion explicita del usuario desde el dashboard.
    agent_thread = threading.Thread(target=run_agent_socket_server_safely, daemon=True)
    agent_thread.start()
    
    # Legado HTML: se conserva la lista como referencia, pero no se usa para
    # poblar dispositivos ficticios ni aplicar reverse al arrancar Electron.
    known_serials = []

    try:
        list_devices_fast(known_serials)
        print(f"Cache inicial: {len(known_serials)} dispositivos conocidos")
    except Exception as e:
        print(f"Aviso: no se pudo popular cache inicial: {e}")

    # Aplicar ADB reverse en background (uno por uno, con pausa)
    rev_thread = threading.Thread(target=_apply_reverse_background, args=(known_serials,), daemon=True)
    rev_thread.start()

    # Perfil CONTROL: el control manual sigue siendo scrcpy-control. Este loop
    # solo recompone el socket de automatizacion FlowAgent para APK ya instalado:
    # reverse + MainActivity autoconnect, sin instalar, actualizar ni captura.
    if FLOWAGENT_AUTO_RECONNECT_ENABLED:
        auto_agent_thread = threading.Thread(target=_flowagent_auto_reconnect_loop, daemon=True)
        auto_agent_thread.start()

    # Iniciar thread de background para actualizar cache periodicamente
    cache_thread = threading.Thread(target=_devices_cache_updater, daemon=True)
    # No iniciar cache updater legacy: rellena dispositivos hardcodeados.
    # cache_thread.start()

    # Iniciar servidor WebSocket si está disponible
    if WEBSOCKET_AVAILABLE and SCRCPY_AVAILABLE:
        start_websocket_server(scrcpy_manager)
        print(f"WebSocket streaming listo en ws://127.0.0.1:8767")

    # @Added Etapa C 2026-05-28: H.264 raw stream WS server.
    if SCRCPY_RAW_AVAILABLE:
        try:
            global SCRCPY_RAW_STREAMER
            SCRCPY_RAW_STREAMER = ScrcpyRawStreamer(adb_path=ADB)
            start_raw_ws_server_in_background(SCRCPY_RAW_STREAMER)
        except Exception as exc:
            print(f"[scrcpy-raw] no se pudo arrancar el WS server: {exc}")
    
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"ADB dashboard local listo en http://{HOST}:{PORT}")
    print(f"ADB: {ADB or 'no encontrado'}")
    auto_scan_on_start()
    server.serve_forever()



def get_local_subnets():
    import psutil
    subnets = []
    try:
        addrs = psutil.net_if_addrs()
        stats = psutil.net_if_stats()
        for interface_name, interface_addresses in addrs.items():
            if interface_name not in stats or not stats[interface_name].isup:
                continue
            for addr in interface_addresses:
                if addr.family == socket.AF_INET:
                    ip = addr.address
                    if ip == '127.0.0.1' or ip.startswith('169.254'):
                        continue
                    parts = ip.split('.')
                    if len(parts) == 4:
                        subnets.append(f"{parts[0]}.{parts[1]}.{parts[2]}.1-254")
    except Exception as e:
        print(f"Error detecting subnets: {e}")
        subnets.append("192.168.1.1-254")
    return list(set(subnets))

def expand_ranges(ranges):
    ips = []
    if "auto" in ranges:
        ranges = [r for r in ranges if r != "auto"] + get_local_subnets()
        
    for r in ranges:
        r = r.strip()
        if "-" in r:
            base, end = r.split("-")
            parts = base.split(".")
            if len(parts) == 4 and end.isdigit():
                start_last = int(parts[3])
                end_last = int(end)
                prefix = f"{parts[0]}.{parts[1]}.{parts[2]}."
                for i in range(start_last, end_last + 1):
                    ips.append(prefix + str(i))
        else:
            ips.append(r)
    return list(set(ips))

def scan_network_worker(ips, port, timeout, concurrency, connect_adb):
    import concurrent.futures
    SCAN_STATE["active"] = True
    SCAN_STATE["status"] = "scanning"
    SCAN_STATE["total"] = len(ips)
    SCAN_STATE["progress"] = 0
    SCAN_STATE["found"] = []
    
    def check_ip(ip):
        if SCAN_CANCEL_EVENT.is_set():
            return None
        SCAN_STATE["current_ip"] = ip
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout / 1000.0)
        result = s.connect_ex((ip, port))
        s.close()
        SCAN_STATE["progress"] += 1
        if result == 0:
            if connect_adb:
                adb(["connect", f"{ip}:{port}"])
            SCAN_STATE["found"].append(ip)
            return ip
        return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        for ip in ips:
            if SCAN_CANCEL_EVENT.is_set():
                break
            executor.submit(check_ip, ip)
            
    SCAN_STATE["active"] = False
    SCAN_STATE["status"] = "cancelled" if SCAN_CANCEL_EVENT.is_set() else "completed"
    
def start_network_scan(ranges, port=5555, timeout=250, concurrency=48, connect_adb=True):
    if SCAN_STATE["active"]:
        return False
    SCAN_CANCEL_EVENT.clear()
    ips = expand_ranges(ranges)
    t = threading.Thread(target=scan_network_worker, args=(ips, port, timeout, concurrency, connect_adb), daemon=True)
    t.start()
    return True

def auto_scan_on_start():
    if not AUTO_SCAN_ON_START_ENABLED:
        print("[auto-scan] Desactivado por configuracion (FLOWDASHBOARD_DISABLE_AUTO_SCAN).")
        return

    def worker():
        try:
            time.sleep(AUTO_SCAN_ON_START_DELAY)
            try:
                reconnect_known_devices()
            except Exception as exc:
                print(f"[auto-scan] reconnect_known_devices fallo: {exc}")
            subnets = get_local_subnets()
            if not subnets:
                print("[auto-scan] No se detectaron subredes locales; se omite el escaneo automatico.")
                return
            print(f"[auto-scan] Escaneo automatico de arranque en subredes: {', '.join(subnets)}")
            start_network_scan(subnets, port=5555, timeout=250, concurrency=48, connect_adb=True)
        except Exception as exc:
            print(f"[auto-scan] Error en escaneo automatico de arranque: {exc}")

    threading.Thread(target=worker, daemon=True).start()


def reconnect_known_devices():
    inv = load_device_inventory()
    ips_to_connect = set()
    for pid, data in inv.items():
        if data.get("lastIp"): ips_to_connect.add(data["lastIp"])
        for ip in data.get("knownIps", []):
            ips_to_connect.add(ip)
            
    # Lanzar conexion rapida en background
    def worker():
        for ip in ips_to_connect:
            adb(["connect", f"{ip}:5555"])
    t = threading.Thread(target=worker, daemon=True)
    t.start()


def backend_self_check():
    result = {
        "ok": True,
        "appName": APP_NAME,
        "appVersion": APP_VERSION,
        "productMode": PRODUCT_MODE,
        "isFrozen": IS_FROZEN,
        "baseDir": str(BASE_DIR),
        "resourceDir": str(RESOURCE_DIR),
        "dataDir": str(DATA_DIR),
        "adb": ADB,
        "adbExists": bool(ADB and Path(ADB).exists()),
        "scrcpyPath": str(SCRCPY_EXE) if SCRCPY_EXE else "",
        "scrcpyExists": bool(SCRCPY_EXE and SCRCPY_EXE.exists()),
        "scrcpyServerJar": os.getenv("SCRCPY_SERVER_JAR", ""),
        "scrcpyRawAvailable": SCRCPY_RAW_AVAILABLE,
        "scrcpyControlAvailable": SCRCPY_CONTROL_AVAILABLE,
        "websocketAvailable": WEBSOCKET_AVAILABLE,
        "flowAgentApk": str(FLOW_AGENT_APK),
        "flowAgentApkExists": FLOW_AGENT_APK.exists(),
        "localLicenseMode": ALLOW_LOCAL_LICENSE_MODE,
        "supabaseConfigured": bool(SUPABASE_URL and SUPABASE_API_KEY),
    }
    required = ["adbExists", "scrcpyExists", "scrcpyRawAvailable", "scrcpyControlAvailable"]
    missing = [key for key in required if not result.get(key)]
    if missing:
        result["ok"] = False
        result["missing"] = missing
    return result


if __name__ == "__main__":
    if "--self-check" in sys.argv:
        check = backend_self_check()
        print(json.dumps(check, ensure_ascii=False, indent=2))
        sys.exit(0 if check.get("ok") else 2)
    serve_forever()


