import hashlib
import json
import os
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

from app_meta import APP_NAME, APP_VERSION

CONFIG_FILE = "update_config.json"
DEFAULT_MANIFEST_URL = "https://raw.githubusercontent.com/ingestebandaza/FlowDashboard/main/update.json"


def version_tuple(value):
    parts = []
    for part in str(value or "0").lstrip("v").split("."):
        try:
            parts.append(int(part))
        except ValueError:
            parts.append(0)
    return tuple(parts)


def load_config(app_dir):
    config_path = Path(app_dir) / CONFIG_FILE
    config = {}
    if config_path.exists():
        with config_path.open("r", encoding="utf-8-sig") as fh:
            config = json.load(fh)
    manifest_url = os.getenv("FLOWDASHBOARD_UPDATE_MANIFEST_URL", config.get("manifest_url", DEFAULT_MANIFEST_URL))
    return {"manifest_url": manifest_url.strip()}


def fetch_json(url):
    with urllib.request.urlopen(url, timeout=15) as response:
        return json.loads(response.read().decode("utf-8-sig"))


def download_file(url, destination):
    with urllib.request.urlopen(url, timeout=60) as response:
        with open(destination, "wb") as out:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_apply_script(app_dir, staging_dir, app_name):
    app_dir = Path(app_dir).resolve()
    staging_dir = Path(staging_dir).resolve()
    exe_path = app_dir / f"{app_name}.exe"
    if not exe_path.exists():
        exe_path = Path(sys.executable).resolve()

    script_path = Path(tempfile.gettempdir()) / f"{app_name}_apply_update.bat"
    script = f"""@echo off
setlocal
set "APP_DIR={app_dir}"
set "STAGING_DIR={staging_dir}"
set "APP_EXE={exe_path}"
set "PID={os.getpid()}"

:wait_loop
tasklist /FI "PID eq %PID%" 2>NUL | find "%PID%" >NUL
if not errorlevel 1 (
  timeout /T 1 /NOBREAK >NUL
  goto wait_loop
)

robocopy "%STAGING_DIR%" "%APP_DIR%" /E /NFL /NDL /NJH /NJS /NP >NUL
start "" "%APP_EXE%"
endlocal
"""
    script_path.write_text(script, encoding="utf-8")
    return script_path


def stage_update(package_path):
    staging_dir = Path(tempfile.mkdtemp(prefix=f"{APP_NAME}_update_"))
    with zipfile.ZipFile(package_path, "r") as archive:
        archive.extractall(staging_dir)

    entries = list(staging_dir.iterdir())
    if len(entries) == 1 and entries[0].is_dir():
        return entries[0]
    return staging_dir


def check_for_updates(current_version=APP_VERSION, app_dir=None, app_name=APP_NAME):
    app_dir = Path(app_dir or Path(sys.executable).resolve().parent)
    config = load_config(app_dir)
    manifest_url = config.get("manifest_url", "")
    if not manifest_url:
        return {"updated": False, "reason": "no_manifest_url"}

    manifest = fetch_json(manifest_url)
    latest_version = str(manifest.get("version") or manifest.get("tag_name") or "").lstrip("v")
    package_url = manifest.get("package_url") or manifest.get("url") or ""
    expected_sha256 = str(manifest.get("sha256") or "").lower().strip()

    if not latest_version or not package_url:
        return {"updated": False, "reason": "invalid_manifest"}
    if version_tuple(latest_version) <= version_tuple(current_version):
        return {"updated": False, "version": latest_version, "reason": "already_current"}

    temp_dir = Path(tempfile.mkdtemp(prefix=f"{app_name}_download_"))
    package_path = temp_dir / f"{app_name}-{latest_version}.zip"
    download_file(package_url, package_path)

    if expected_sha256:
        actual_sha256 = sha256_file(package_path)
        if actual_sha256 != expected_sha256:
            raise RuntimeError("El paquete descargado no coincide con el sha256 del manifest.")

    staging_dir = stage_update(package_path)
    apply_script = write_apply_script(app_dir, staging_dir, app_name)
    subprocess.Popen(["cmd", "/c", str(apply_script)], cwd=str(app_dir), close_fds=True)
    return {"updated": True, "version": latest_version, "restart_required": True}


def main():
    result = check_for_updates(APP_VERSION)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
