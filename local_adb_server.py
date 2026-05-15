#!/usr/bin/env python3
import hashlib
import json
import mimetypes
import os
import getpass
import platform
import re
import shlex
import shutil
import socket
import subprocess
import threading
import time
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen, Request

from app_meta import APP_VERSION

BASE_DIR = Path(os.getenv("FLOWDASHBOARD_BASE_DIR", Path(__file__).resolve().parent))
RESOURCE_DIR = Path(os.getenv("FLOWDASHBOARD_RESOURCE_DIR", str(BASE_DIR)))
ADB_HOME_OVERRIDE = os.getenv("FLOWDASHBOARD_ADB_HOME", "").strip()

HOST = "127.0.0.1"
PORT = 8765
AGENT_HOST = "0.0.0.0"
AGENT_PORT = 8766
SERVER_VERSION = "2026-05-12-device-public-ip-refresh"
SERVER_FEATURES = ["flowlogin_payload", "flowlogin_status", "account_statuses", "flowlogin_agent_runner", "flowlogin_stop", "apk_agent_socket", "flowagent_setup", "flowlogin_fresh_retry", "flowagent_auto_ensure", "flowlogin_cache_retry", "flowlogin_visual_cache_clear", "flowlogin_retry_form_fix", "flowlogin_clone_list", "device_public_ip_flags", "device_public_ip_refresh", "static_dashboard", "client_info", "license_remember", "adb_path_probe", "adb_deep_probe"]


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
    candidates = []
    path_dirs = os.getenv("PATH", "").split(os.pathsep)
    for folder in path_dirs:
        if folder:
            candidates.append(Path(folder) / "adb.exe")

    candidates = [
        os.getenv("FLOWDASHBOARD_ADB", ""),
        os.getenv("ADB", ""),
        str(BASE_DIR / "platform-tools" / "adb.exe"),
        str(RESOURCE_DIR / "platform-tools" / "adb.exe"),
        shutil.which("adb") or "",
        r"C:\adb\adb.exe",
        *[str(item) for item in candidates],
    ]
    local_app_data = os.getenv("LOCALAPPDATA", "")
    program_files = os.getenv("ProgramFiles", "")
    program_files_x86 = os.getenv("ProgramFiles(x86)", "")
    user_profile = os.getenv("USERPROFILE", "")
    android_home = os.getenv("ANDROID_HOME", "")
    android_sdk_root = os.getenv("ANDROID_SDK_ROOT", "")
    candidates.extend([
        str(Path(android_home) / "platform-tools" / "adb.exe") if android_home else "",
        str(Path(android_sdk_root) / "platform-tools" / "adb.exe") if android_sdk_root else "",
        str(Path(local_app_data) / "Android" / "Sdk" / "platform-tools" / "adb.exe") if local_app_data else "",
        str(Path(local_app_data) / "Android" / "android-sdk" / "platform-tools" / "adb.exe") if local_app_data else "",
        str(Path(program_files) / "Android" / "android-sdk" / "platform-tools" / "adb.exe") if program_files else "",
        str(Path(program_files) / "Android" / "Sdk" / "platform-tools" / "adb.exe") if program_files else "",
        str(Path(program_files_x86) / "Android" / "android-sdk" / "platform-tools" / "adb.exe") if program_files_x86 else "",
        str(Path(program_files_x86) / "Android" / "Sdk" / "platform-tools" / "adb.exe") if program_files_x86 else "",
        str(Path(user_profile) / "AppData" / "Local" / "Android" / "Sdk" / "platform-tools" / "adb.exe") if user_profile else "",
        str(Path(user_profile) / "platform-tools" / "adb.exe") if user_profile else "",
        str(Path(user_profile) / "Downloads" / "platform-tools" / "adb.exe") if user_profile else "",
        str(Path(user_profile) / "Desktop" / "platform-tools" / "adb.exe") if user_profile else "",
        str(Path(user_profile) / "adb.exe") if user_profile else "",
    ])
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
    found = deep_probe_adb()
    if found:
        return str(found)
    return shutil.which("adb") or r"C:\adb\adb.exe"


ADB = find_adb()
ANDROID_HOME_DIR = Path(ADB_HOME_OVERRIDE).expanduser() if ADB_HOME_OVERRIDE else None
if ANDROID_HOME_DIR:
    ANDROID_HOME_DIR.mkdir(exist_ok=True)
    os.environ["ANDROID_USER_HOME"] = str(ANDROID_HOME_DIR)
    os.environ["ANDROID_SDK_HOME"] = str(ANDROID_HOME_DIR)
    os.environ["ADB_VENDOR_KEYS"] = str(ANDROID_HOME_DIR)
AUTOJS_PACKAGES = [
    "youhu.laixijs",
    "org.autojs.autojs",
    "org.autojs.autojspro",
    "com.stardust.autojs",
    "com.stardust.autojspro",
    "com.stardust.commoncommonxmly1",
]
DEVICE_NAMES_FILE = BASE_DIR / "device_names.json"
FLOWLOGIN_PAYLOAD_DIR = BASE_DIR / ".flowlogin_payloads"
FLOWLOGIN_PAYLOAD_DIR.mkdir(exist_ok=True)
FLOW_AGENT_APK = BASE_DIR / "flow_agent_apk" / "build" / "flowagent-debug.apk"
if not FLOW_AGENT_APK.exists():
    FLOW_AGENT_APK = RESOURCE_DIR / "flow_agent_apk" / "build" / "flowagent-debug.apk"
FLOW_AGENT_PACKAGE = "com.flowlogin.agent"
FLOW_AGENT_ACTIVITY = "com.flowlogin.agent/.MainActivity"
FLOW_AGENT_EXPECTED_VERSION = "0.2.1"
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
TERMINAL_LOGIN_STATUSES = {"success", "error", "already", "review"}
LOGIN_SUCCESS_STATUSES = {"success", "already"}
LOGIN_RETRY_AFTER_CLEAR_STATUSES = {"error", "review"}
DEVICE_NAMES_LOCK = threading.Lock()
FLOWLOGIN_JOBS = set()
FLOWLOGIN_STOP_EVENTS = {}
FLOWLOGIN_CURRENT_ITEMS = {}
FLOWLOGIN_JOBS_LOCK = threading.Lock()
AGENT_CONNECTIONS = {}
AGENT_CONNECTIONS_LOCK = threading.Lock()
ANDROID_ID_CACHE = {}
ANDROID_ID_LOCK = threading.Lock()
PUBLIC_IP_CACHE = {}
PUBLIC_IP_LOCK = threading.Lock()
PUBLIC_IP_CACHE_TTL = 600
UI_DUMP_REMOTE = "/sdcard/window.xml"
NODE_BOUNDS_RE = re.compile(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]")
STATIC_FILES = {
    "/wsapi_demo.html": "wsapi_demo.html",
    "/wsapi.js": "wsapi.js",
    "/logo.png": "logo.png",
}

# Cargar configuración de Supabase desde archivo o variables de entorno
SUPABASE_CONFIG_FILE = BASE_DIR / ".supabase_config.json"
SUPABASE_URL = ""
SUPABASE_API_KEY = ""
ALLOW_LOCAL_LICENSE_MODE = os.getenv("FLOWDASHBOARD_ALLOW_LOCAL_LICENSE", "").strip().lower() in {"1", "true", "yes"}

if SUPABASE_CONFIG_FILE.exists():
    try:
        with SUPABASE_CONFIG_FILE.open("r", encoding="utf-8") as fh:
            config = json.load(fh)
            SUPABASE_URL = config.get("SUPABASE_URL", "")
            SUPABASE_API_KEY = config.get("SUPABASE_API_KEY", "")
    except Exception:
        pass

# Fallback a variables de entorno si no hay archivo de config
SUPABASE_URL = os.getenv("SUPABASE_URL", SUPABASE_URL)
SUPABASE_API_KEY = os.getenv("SUPABASE_API_KEY", os.getenv("SUPABASE_ANON_KEY", SUPABASE_API_KEY))

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
        with urlopen(req, timeout=10) as response:
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
    }
    return supabase_request("/rpc/validate_flowdashboard_license", method="POST", data=payload)


def validate_license_local_mode(device_email, license_key, device_info=None):
    if not license_key or license_key == "":
        return {"status": "error", "message": "Licencia invalida"}

    device_reg_file = BASE_DIR / "device_registrations.json"
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
            device_reg_file = BASE_DIR / "device_registrations.json"
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
        package = SPOTIFY_CLONE_PACKAGES[index] if index < len(SPOTIFY_CLONE_PACKAGES) else ""
        prev = previous.get((clone, line), {})
        status = str(prev.get("status", "pending") or "pending").lower()
        if status not in {"pending", "running", "retrying", "success", "error", "already", "review", "replaced"}:
            status = "pending"
        normalized.append({
            "accountId": str(prev.get("accountId") or account_id_for(serial, clone, line)),
            "clone": clone,
            "package": package,
            "line": line,
            "status": status,
            "message": str(prev.get("message", "") or ""),
            "attempts": int(prev.get("attempts", 0) or 0),
            "updatedAt": str(prev.get("updatedAt", "") or ""),
        })
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
            }
        elif value:
            profiles[str(serial)] = {
                "name": str(value),
                "person": "",
                "accountStatuses": [],
            }
    return profiles


def limit_lines(value, max_lines=10):
    lines = str(value or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    return "\n".join(lines[:max_lines]).strip()


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
    with DEVICE_NAMES_FILE.open("w", encoding="utf-8") as fh:
        json.dump(names, fh, ensure_ascii=False, indent=2, sort_keys=True)


def set_device_name(serial, name):
    serial = str(serial or "").strip()
    name = str(name or "").strip()
    if not serial:
        raise RuntimeError("Falta el serial del dispositivo.")

    names = load_device_names()
    profile = names.get(serial, {"name": "", "person": "", "accountStatuses": []})
    if name:
        profile["name"] = name[:80]
        names[serial] = profile
    else:
        profile["name"] = ""
        if profile.get("person") or profile.get("accountStatuses"):
            names[serial] = profile
        else:
            names.pop(serial, None)
    save_device_names(names)
    return names


def set_device_person(serial, person):
    serial = str(serial or "").strip()
    person = limit_lines(person, 10)
    if not serial:
        raise RuntimeError("Falta el serial del dispositivo.")

    names = load_device_names()
    profile = names.get(serial, {"name": "", "person": "", "accountStatuses": []})
    previous_statuses = profile.get("accountStatuses", [])
    if person:
        profile["person"] = person[:1200]
        profile["accountStatuses"] = normalize_account_statuses(serial, profile["person"], previous_statuses)
        names[serial] = profile
    else:
        profile["person"] = ""
        profile["accountStatuses"] = []
        if profile.get("name"):
            names[serial] = profile
        else:
            names.pop(serial, None)
    save_device_names(names)
    return names


def update_device_account_statuses(serial, status_payload):
    serial = str(serial or "").strip()
    if not serial:
        raise RuntimeError("Falta el serial del dispositivo.")

    names = load_device_names()
    profile = names.get(serial, {"name": "", "person": "", "accountStatuses": []})
    current = normalize_account_statuses(serial, profile.get("person", ""), profile.get("accountStatuses", []))
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
            if status not in {"pending", "running", "retrying", "success", "error", "already", "review", "replaced"}:
                status = target.get("status", "pending")
            target["status"] = status
            target["message"] = str(incoming.get("message", "") or "")
            target["attempts"] = int(incoming.get("attempts", target.get("attempts", 0)) or 0)
            target["updatedAt"] = str(incoming.get("updatedAt", "") or "")

    profile["accountStatuses"] = current
    if profile.get("name") or profile.get("person") or profile.get("accountStatuses"):
        names[serial] = profile
    else:
        names.pop(serial, None)
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

    status = str(status or "pending").lower()
    if status not in {"pending", "running", "retrying", "success", "error", "already", "review", "replaced"}:
        status = "review"

    with DEVICE_NAMES_LOCK:
        names = load_device_names()
        profile = names.get(serial, {"name": "", "person": "", "accountStatuses": []})
        current = normalize_account_statuses(serial, profile.get("person", ""), profile.get("accountStatuses", []))
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
            names[serial] = profile
        else:
            names.pop(serial, None)
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

    env = os.environ.copy()
    if ANDROID_HOME_DIR:
        env["ANDROID_USER_HOME"] = str(ANDROID_HOME_DIR)
        env["ANDROID_SDK_HOME"] = str(ANDROID_HOME_DIR)
        env["ADB_VENDOR_KEYS"] = str(ANDROID_HOME_DIR)

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
        **popen_options,
    )
    output = (completed.stdout or "").strip()
    error = (completed.stderr or "").strip()
    if completed.returncode != 0:
        raise RuntimeError(error or output or f"Comando fallo con codigo {completed.returncode}.")
    return output


def adb(args, timeout=120):
    return run_process([ADB, *args], timeout=timeout)


def adb_shell(serial, command, timeout=30):
    return adb(["-s", serial, "shell", command], timeout=timeout)


def adb_tap(serial, x, y):
    adb_shell(serial, f"input tap {int(x)} {int(y)}", timeout=20)


def adb_keyevent(serial, keycode):
    adb_shell(serial, f"input keyevent {keycode}", timeout=20)


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
    return ui_has_marker(serial, r"^(Home|Search|Your Library|Library)$", timeout=timeout)


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


def confirm_flowlogin_outcome(serial, package_name):
    for index in range(4):
        if confirm_logged_in(serial):
            return {"status": "success", "message": "Login confirmado", "retry": False}
        error = ui_error_marker(serial, timeout=2)
        if error:
            return {"status": "error", "message": f"Error visible: {error[:80]}", "retry": False}
        if current_package(serial) != package_name and index > 1:
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


def list_devices():
    output = adb(["devices", "-l"], timeout=20)
    saved_names = load_device_names()
    devices = []
    for line in output.splitlines()[1:]:
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) < 2 or parts[1] != "device":
            continue

        serial = parts[0]
        details = dict(item.split(":", 1) for item in parts[2:] if ":" in item)
        model = details.get("model", "").replace("_", " ")
        product = details.get("product", "").replace("_", " ")
        original_name = model or product or serial
        profile = saved_names.get(serial, {})
        custom_name = profile.get("name", "") if isinstance(profile, dict) else str(profile or "")
        person = profile.get("person", "") if isinstance(profile, dict) else ""
        account_statuses = profile.get("accountStatuses", []) if isinstance(profile, dict) else []
        name = custom_name or original_name
        android_id = get_device_android_id(serial)
        public_ip_info = get_device_public_ip_info(serial)
        mac_address = get_device_mac_address(serial)
        devices.append({
            "id": serial,
            "serial": serial,
            "deviceId": serial,
            "androidId": android_id,
            "publicIp": public_ip_info.get("publicIp", ""),
            "countryCode": public_ip_info.get("countryCode", ""),
            "countryName": public_ip_info.get("countryName", ""),
            "macAddress": mac_address,
            "name": name,
            "customName": custom_name,
            "person": person,
            "accountStatuses": normalize_account_statuses(serial, person, account_statuses),
            "originalName": original_name,
            "model": model or original_name,
            "product": product,
        })
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
        return [device["serial"] for device in list_devices()]
    if isinstance(device_ids, str):
        return [item.strip() for item in device_ids.split(",") if item.strip()]
    if isinstance(device_ids, list):
        return [str(item).strip() for item in device_ids if str(item).strip()]
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


def list_packages(device_ids="all"):
    return run_adb_command("adb shell pm list packages", device_ids)


def package_installed(serial, package):
    try:
        adb(["-s", serial, "shell", "pm", "path", package], timeout=15)
        return True
    except Exception:
        return False


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
    if not serial:
        raise RuntimeError("Falta el serial del dispositivo.")
    data = get_device_public_ip_info(serial, force=True)
    return {
        "serial": serial,
        "publicIp": data.get("publicIp", ""),
        "countryCode": data.get("countryCode", ""),
        "countryName": data.get("countryName", ""),
    }


def get_device_mac_address(serial):
    """Obtiene la dirección MAC del dispositivo Android automáticamente."""
    serial = str(serial or "").strip()
    if not serial:
        return ""
    try:
        # Intentar obtener MAC desde diferentes fuentes en Android
        commands = [
            "cat /sys/class/net/wlan0/address 2>/dev/null",
            "cat /sys/class/net/eth0/address 2>/dev/null",
            "ip addr show wlan0 2>/dev/null | grep 'ether' | awk '{print $2}'",
            "ip addr show eth0 2>/dev/null | grep 'ether' | awk '{print $2}'",
        ]
        for command in commands:
            try:
                mac = adb_shell(serial, command, timeout=10).strip()
                if mac and re.match(r"^[0-9a-fA-F:]{17}$", mac):
                    return mac.upper()
            except Exception:
                continue
        return ""
    except Exception:
        return ""


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
    return {
        "hostname": hostname,
        "windowsUser": windows_user,
        "deviceHash": device_hash,
        "os": platform.platform(),
        "appVersion": APP_VERSION,
        "adb": ADB,
        "adbExists": bool(ADB and Path(ADB).exists()),
        "adbCandidates": [str(path) for path in candidate_adb_paths()[:12]],
    }


def get_installed_package_version(serial, package_name):
    try:
        output = adb(["-s", serial, "shell", "dumpsys", "package", package_name], timeout=20)
    except Exception:
        return ""
    match = re.search(r"versionName=([^\s]+)", output)
    return match.group(1).strip() if match else ""


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

            adb(["-s", serial, "reverse", f"tcp:{AGENT_PORT}", f"tcp:{AGENT_PORT}"], timeout=20)
            lines.append(f"Reverse activo: 127.0.0.1:{AGENT_PORT} -> PC:{AGENT_PORT}")

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

            if open_accessibility:
                adb(["-s", serial, "shell", "am", "start", "-a", "android.settings.ACCESSIBILITY_SETTINGS"], timeout=20)
                lines.append("Ajustes de accesibilidad abiertos.")

            lines.append("Si no aparece conectado, activa el servicio FlowAgent en Accesibilidad.")
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
        return script

    if script.name:
        for base in (BASE_DIR, RESOURCE_DIR):
            candidate = base / script.name
            if candidate.exists() and candidate.is_file():
                return candidate
    return script


def prepare_flowlogin_payload(serial, clone=None, clones=None, delimiter=":"):
    names = load_device_names()
    profile = names.get(serial, {"name": "", "person": "", "accountStatuses": []})
    statuses = normalize_account_statuses(serial, profile.get("person", ""), profile.get("accountStatuses", []))
    clone_filter = normalize_clone_filter(clone=clone, clones=clones)
    accounts = []
    for item in statuses:
        try:
            item_clone = int(item.get("clone", 0))
        except Exception:
            item_clone = 0
        if clone_filter and item_clone not in clone_filter:
            continue
        pending = dict(item)
        pending["status"] = "pending"
        pending["message"] = ""
        pending["attempts"] = 0
        pending["freshStart"] = bool(clone_filter)
        accounts.append(pending)

    for item in statuses:
        try:
            item_clone = int(item.get("clone", 0))
        except Exception:
            item_clone = 0
        if clone_filter and item_clone not in clone_filter:
            continue
        item["status"] = "pending"
        item["message"] = ""
        item["attempts"] = 0
        item["updatedAt"] = ""
    profile["accountStatuses"] = statuses
    if profile.get("name") or profile.get("person") or statuses:
        names[serial] = profile
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


def refresh_login_statuses(device_ids="all"):
    serials = get_target_serials(device_ids)
    names = load_device_names()
    outputs = []
    for serial in serials:
        profile = names.get(serial, {}) if isinstance(names, dict) else {}
        statuses = profile.get("accountStatuses", []) if isinstance(profile, dict) else []
        with FLOWLOGIN_JOBS_LOCK:
            running = serial in FLOWLOGIN_JOBS
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


def should_retry_after_cache_clear(result):
    if not isinstance(result, dict):
        return False
    status = str(result.get("status", "") or "").lower()
    if status not in LOGIN_RETRY_AFTER_CLEAR_STATUSES:
        return False
    message = str(result.get("message", "") or "")
    if re.search(r"(captcha|verify|verification|2fa|two.factor|too many|detenido|flowagent no conectado|accesibilidad|actualizar)", message, re.I):
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


def clear_clone_cache_data_visual(serial, package_name):
    package_name = str(package_name or "").strip()
    if not package_name:
        raise RuntimeError("Paquete del clon no definido.")

    agent = agent_for_serial(serial)
    if not agent or not agent_supports_flowlogin(agent):
        return clear_clone_cache_data(serial, package_name)

    try:
        adb([
            "-s", serial,
            "shell", "am", "start",
            "-a", "android.settings.APPLICATION_DETAILS_SETTINGS",
            "-d", f"package:{package_name}",
        ], timeout=20)
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

        try:
            agent_result(agent, {"name": "back"}, timeout=8, raise_on_error=False)
            time.sleep(0.5)
            agent_result(agent, {"name": "back"}, timeout=8, raise_on_error=False)
            time.sleep(0.5)
            agent_result(agent, {"name": "home"}, timeout=8, raise_on_error=False)
        except Exception:
            pass

        if data_clicked:
            return f"{package_name} cache/datos limpiados desde App info."
        return clear_clone_cache_data(serial, package_name)
    except Exception:
        return clear_clone_cache_data(serial, package_name)


def run_flowlogin_agent_attempt(serial, item, account, attempt, status_label, line, stop_event):
    clone = int(item.get("clone", 0) or 0)
    if stop_event.is_set():
        return {"status": "review", "message": "Detenido por usuario", "retry": False}
    with FLOWLOGIN_JOBS_LOCK:
        FLOWLOGIN_CURRENT_ITEMS[serial] = item
    set_device_account_status(
        serial,
        clone,
        status_label,
        f"Intento {attempt}",
        attempts=attempt,
        line=line,
    )
    try:
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
                else "FlowAgent debe actualizarse a 0.2.0 y tener Accesibilidad activa."
            )
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
            try:
                clone = int(item.get("clone", 0))
            except Exception:
                clone = 0
            line = str(item.get("line", "") or "").strip()
            account = parse_account_line(line, delimiter=delimiter)
            if not clone:
                continue
            if not account:
                set_device_account_status(serial, clone, "error", "Formato invalido: email:password", attempts=0, line=line)
                continue
            if not item.get("package"):
                set_device_account_status(serial, clone, "error", "Paquete del clon no definido", attempts=0, line=line)
                continue

            final_result = run_flowlogin_agent_attempt(serial, item, account, 1, "running", line, stop_event)
            if stop_event.is_set():
                final_result = {"status": "review", "message": "Detenido por usuario", "retry": False}

            if final_result and final_result.get("status") in LOGIN_SUCCESS_STATUSES:
                set_device_account_status(
                    serial,
                    clone,
                    final_result.get("status"),
                    final_result.get("message", ""),
                    attempts=1,
                    line=line,
                )
            elif final_result and should_retry_after_cache_clear(final_result):
                retry_after_clear.append({
                    "item": dict(item),
                    "account": account,
                    "line": line,
                    "firstResult": final_result,
                })
                set_device_account_status(
                    serial,
                    clone,
                    "retrying",
                    "Primer intento fallo; limpiando cache/datos antes del segundo intento.",
                    attempts=1,
                    line=line,
                )
            elif final_result:
                set_device_account_status(
                    serial,
                    clone,
                    final_result.get("status", "review"),
                    final_result.get("message", ""),
                    attempts=1,
                    line=line,
                )
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
            try:
                clone = int(item.get("clone", 0))
            except Exception:
                clone = 0
            package_name = str(item.get("package", "") or "").strip()
            if not clone or not package_name:
                continue
            set_device_account_status(
                serial,
                clone,
                "retrying",
                "Abriendo App info y limpiando cache/datos del clon antes del segundo intento.",
                attempts=1,
                line=line,
            )
            try:
                clear_clone_cache_data_visual(serial, package_name)
            except Exception as exc:
                set_device_account_status(
                    serial,
                    clone,
                    "error",
                    f"No se pudo limpiar cache/datos: {exc}",
                    attempts=1,
                    line=line,
                )
                continue

            item["freshStart"] = True
            final_result = run_flowlogin_agent_attempt(serial, item, account, 2, "retrying", line, stop_event)
            if stop_event.is_set():
                final_result = {"status": "review", "message": "Detenido por usuario", "retry": False}
            if final_result:
                set_device_account_status(
                    serial,
                    clone,
                    final_result.get("status", "review"),
                    final_result.get("message", ""),
                    attempts=2,
                    line=line,
                )
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


def start_flowlogin_agent_jobs(serials, clone=None, clones=None, delimiter=":"):
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

            payload_path, account_count = prepare_flowlogin_payload(serial, clone=clone, clones=clones, delimiter=delimiter)
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
                    else "FlowAgent debe actualizarse a 0.2.0 y tener Accesibilidad activa."
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


def execute_autojs(file_path, device_ids="all", clone=None, clones=None, delimiter=":"):
    script = resolve_local_script_path(file_path)
    if not script.exists() or not script.is_file():
        raise RuntimeError(f"No se encontro el script: {script}")

    serials = get_target_serials(device_ids)
    if not serials:
        raise RuntimeError("No hay dispositivos conectados.")

    if script.name.lower() == "login.js":
        return start_flowlogin_agent_jobs(serials, clone=clone, clones=clones, delimiter=delimiter)

    for serial in serials:
        lock_device_portrait(serial)

    remote = f"/sdcard/Download/{script.name}"
    outputs = []
    for serial in serials:
        lines = [f"[{serial}]"]
        try:
            login_payload_path, account_count = prepare_flowlogin_payload(serial, clone=clone, clones=clones, delimiter=delimiter)
            lines.append(adb(["-s", serial, "push", str(login_payload_path), FLOWLOGIN_ACCOUNTS_REMOTE], timeout=60))
            adb(["-s", serial, "shell", "rm", "-f", FLOWLOGIN_STATUS_REMOTE], timeout=20)
            lines.append(f"Payload FlowLogin enviado: {account_count} cuenta(s).")
            lines.append(adb(["-s", serial, "push", str(script), remote], timeout=120))
            launched = False
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
                if launch_errors:
                    lines.append(launch_errors[-1])
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
        previous = AGENT_CONNECTIONS.get(agent.agent_id)
        if previous and previous is not agent:
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
            except Exception:
                continue

            message_type = str(payload.get("type", "") or "").lower()
            if message_type == "hello":
                agent.agent_id = str(payload.get("agentId") or agent.agent_id)
                agent.meta = {
                    "serial": str(payload.get("serial", "") or ""),
                    "deviceName": str(payload.get("deviceName", "") or ""),
                    "model": str(payload.get("model", "") or ""),
                    "manufacturer": str(payload.get("manufacturer", "") or ""),
                    "androidVersion": str(payload.get("androidVersion", "") or ""),
                    "agentVersion": str(payload.get("agentVersion", "") or ""),
                    "accessibility": bool(payload.get("accessibility", False)),
                }
                register_agent(agent)
                agent.send_json({
                    "type": "helloAck",
                    "serverVersion": SERVER_VERSION,
                    "agentPort": AGENT_PORT,
                })
            elif message_type == "response":
                request_id = str(payload.get("requestId", "") or "")
                pending = agent.pending.pop(request_id, None)
                if pending:
                    pending["payload"] = payload
                    pending["event"].set()
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
        agent.pending.pop(request_id, None)
        raise RuntimeError("El agente APK no respondio a tiempo.")
    return pending["payload"] or {}


def agent_for_serial(serial):
    serial = str(serial or "").strip()
    if not serial:
        return None
    with AGENT_CONNECTIONS_LOCK:
        for agent in AGENT_CONNECTIONS.values():
            if str(agent.meta.get("serial", "") or "").strip() == serial:
                return agent
    android_id = get_device_android_id(serial)
    if not android_id:
        return None
    with AGENT_CONNECTIONS_LOCK:
        return AGENT_CONNECTIONS.get(android_id)


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
    return bool(agent.meta.get("accessibility")) and version_tuple(agent.meta.get("agentVersion", "")) >= (0, 2, 0)


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
    return agent_result(agent, {"name": "tap", "x": int(x), "y": int(y)}, timeout=timeout)


def agent_click_node(agent, node):
    bounds = agent_bounds(node)
    if not bounds or bounds["width"] <= 0 or bounds["height"] <= 0:
        return False
    agent_tap(agent, bounds["centerX"], bounds["centerY"])
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


def agent_has_logged_in_markers(agent, timeout=3):
    return agent_ui_has_marker(agent, r"^(Home|Search|Your Library|Library)$", timeout=timeout)


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
    try:
        agent_result(agent, {"name": "launchPackage", "packageName": package_name}, timeout=12)
    except Exception:
        return False

    deadline = time.time() + wait_seconds
    while time.time() < deadline:
        if agent_current_package(agent) == package_name:
            return True
        if agent_has_login_markers(agent, timeout=1) or agent_has_logged_in_markers(agent, timeout=1):
            return True
        time.sleep(0.8)
    return False


def reset_flowlogin_clone_start(serial, agent, package_name):
    try:
        agent_result(agent, {"name": "home"}, timeout=8, raise_on_error=False)
    except Exception:
        pass
    try:
        adb_shell(serial, f"am force-stop {shlex.quote(package_name)}", timeout=15)
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


def confirm_flowlogin_agent_outcome(agent, package_name):
    for index in range(4):
        if agent_confirm_logged_in(agent):
            return {"status": "success", "message": "Login confirmado por FlowAgent", "retry": False}
        error = agent_error_marker(agent, timeout=2)
        if error:
            return {"status": "error", "message": f"Error visible: {error[:80]}", "retry": False}
        if agent_current_package(agent) != package_name and index > 1:
            return {"status": "review", "message": "El clon salio de pantalla", "retry": True}
        time.sleep(2.5)
    return {"status": "review", "message": "Sin confirmacion segura", "retry": True}


def perform_flowlogin_agent(serial, item, account):
    agent = agent_for_serial(serial)
    if not agent:
        return {"status": "review", "message": "FlowAgent no conectado. Instala/actualiza FlowAgent y activa Accesibilidad.", "retry": False}
    if not agent_supports_flowlogin(agent):
        return {"status": "review", "message": "FlowAgent debe actualizarse a 0.2.0 y tener Accesibilidad activa.", "retry": False}

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
                self._json({"ok": True, "adb": ADB, "version": SERVER_VERSION, "appVersion": APP_VERSION, "features": SERVER_FEATURES})
            elif path == "/client-info":
                self._json(get_client_info())
            elif path == "/devices":
                self._json({"devices": list_devices()})
            elif path == "/device-names":
                self._json({"names": load_device_names()})
            elif path == "/agents":
                self._json({"agents": list_agents()})
            elif path == "/device-mac":
                serial = self._body().get("serial", "")
                mac = get_device_mac_address(serial)
                self._json({"serial": serial, "macAddress": mac})
            elif path in STATIC_FILES:
                self._file(path)
            else:
                self._json({"error": "Ruta no encontrada."}, 404)
        except Exception as exc:
            self._json({"error": str(exc)}, 500)

    def do_POST(self):
        try:
            path = urlparse(self.path).path
            body = self._body()
            if path == "/adb":
                self._json({"result": run_adb_command(body.get("command", ""), body.get("deviceIds", "all")), "devices": list_devices()})
            elif path == "/packages":
                self._json({"result": list_packages(body.get("deviceIds", "all")), "devices": list_devices()})
            elif path == "/autojs/run":
                clone = body.get("clone", None)
                clones = body.get("clones", None)
                try:
                    clone = int(clone) if clone not in (None, "") else None
                except Exception:
                    clone = None
                self._json({"result": execute_autojs(body.get("filePath", ""), body.get("deviceIds", "all"), clone=clone, clones=clones, delimiter=body.get("delimiter", ":")), "devices": list_devices()})
            elif path == "/autojs/stop":
                self._json({"result": stop_autojs(body.get("deviceIds", "all")), "devices": list_devices()})
            elif path == "/login-status":
                self._json({"result": refresh_login_statuses(body.get("deviceIds", "all")), "devices": list_devices()})
            elif path == "/flowagent/setup":
                self._json({
                    "result": setup_flow_agent(
                        body.get("deviceIds", "all"),
                        install=body.get("install", True),
                        launch=body.get("launch", True),
                        open_accessibility=body.get("openAccessibility", False),
                    ),
                    "devices": list_devices(),
                    "agents": list_agents(),
                })
            elif path == "/device-public-ip":
                self._json({"info": refresh_device_public_ip(body.get("serial", "")), "devices": list_devices()})
            elif path == "/device-name":
                set_device_name(body.get("serial", ""), body.get("name", ""))
                self._json({"devices": list_devices(), "names": load_device_names()})
            elif path == "/device-person":
                set_device_person(body.get("serial", ""), body.get("person", ""))
                self._json({"devices": list_devices(), "names": load_device_names()})
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
                    }
                )
                self._json(result)
            else:
                self._json({"error": "Ruta no encontrada."}, 404)
        except Exception as exc:
            self._json({"error": str(exc)}, 500)

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} - {fmt % args}")


def serve_forever():
    threading.Thread(target=run_agent_socket_server_safely, daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"ADB dashboard local listo en http://{HOST}:{PORT}")
    print(f"ADB: {ADB or 'no encontrado'}")
    server.serve_forever()


if __name__ == "__main__":
    serve_forever()
