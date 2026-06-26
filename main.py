import os
import subprocess
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import re
import threading
import time
from pathlib import Path

# --- Funciones auxiliares de local_adb_server.py ---
# Estas funciones son necesarias para que list_devices funcione correctamente.
# Las hemos extraído y adaptado para el contexto de FastAPI.

BASE_DIR = Path(__file__).resolve().parent
DEVICE_NAMES_FILE = BASE_DIR / "device_names.json"
DEVICE_GROUPS_FILE = BASE_DIR / "device_groups.json"

ADB = "adb" # Por ahora, asumimos que 'adb' está en el PATH. Luego integraremos find_adb()

ANDROID_ID_CACHE = {}
ANDROID_ID_LOCK = threading.Lock()
PUBLIC_IP_CACHE = {}
PUBLIC_IP_LOCK = threading.Lock()
PUBLIC_IP_CACHE_TTL = 600 # 10 minutos
DEVICE_MAC_CACHE = {}
DEVICE_MAC_LOCK = threading.Lock()
DEVICE_LOCAL_IP_CACHE = {}
DEVICE_LOCAL_IP_LOCK = threading.Lock()
LAST_ADB_DEVICES_OUTPUT = ""

def run_process(args, timeout=120):
    # Simplificado para este ejemplo. En una migración completa, usarías la versión robusta de local_adb_server.py
    completed = subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=timeout,
        encoding="utf-8",
        errors="replace",
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

def get_device_mac_address(serial):
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

def serial_host_ip(serial):
    text = str(serial or "").strip()
    match = re.match(r"^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$", text)
    return match.group(1) if match else ""

def get_device_local_ip_address(serial):
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

def list_devices_sync():
    global LAST_ADB_DEVICES_OUTPUT
    output = adb(["devices", "-l"], timeout=20)
    LAST_ADB_DEVICES_OUTPUT = output
    
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
        
        # Estas funciones (get_device_mac_address, get_device_android_id, get_device_local_ip_address)
        # son las que hemos migrado arriba o que se migrarán en pasos posteriores.
        mac_address = get_device_mac_address(serial)
        device_key = device_key_from_parts(serial, mac_address)
        android_id = get_device_android_id(serial)
        device_ip = get_device_local_ip_address(serial)

        # Por ahora, no cargaremos device_names.json ni device_groups.json
        # Esto se hará en pasos posteriores para simplificar la migración inicial.
        # El frontend usará los datos básicos que le enviamos.
        
        devices.append({
            "id": device_key,
            "serial": serial,
            "deviceId": device_key,
            "deviceKey": device_key,
            "legacyDeviceId": serial,
            "androidId": android_id,
            "deviceIp": device_ip,
            "publicIp": "", # Se implementará en un paso posterior
            "countryCode": "", # Se implementará en un paso posterior
            "countryName": "", # Se implementará en un paso posterior
            "macAddress": mac_address,
            "name": original_name, # Usamos el nombre original por ahora
            "customName": "",
            "person": "", # Se implementará en un paso posterior
            "accountStatuses": [], # Se implementará en un paso posterior
            "originalName": original_name,
            "model": model or original_name,
            "product": product,
        })
    
    devices.sort(key=lambda item: (
        0 if str(item.get("deviceKey", "")).startswith("mac:") else 1,
        str(item.get("deviceKey") or item.get("serial") or "").lower(),
    ))
    return devices

app = FastAPI()

# Configura CORS para permitir que el frontend (que correrá en otro puerto) se comunique con el backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción, deberías limitarlo a la URL de tu frontend.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/health")
def health_check():
    return {"status": "ok", "message": "FastAPI está vivo"}

@app.get("/api/v1/devices")
def get_devices():
    # Cuando llames a este endpoint, FastAPI ejecutará tu lógica de Python.
    devices = list_devices_sync() # Ahora llama a la función real
    return {"devices": devices}