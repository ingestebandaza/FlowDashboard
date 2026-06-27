# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules


ROOT = Path(SPECPATH).parent.resolve()


def existing_data(relative_path, target="."):
    source = ROOT / relative_path
    if source.exists() and source.is_file():
        return [(str(source), target)]
    return []


def safe_collect_data_files(package_name):
    try:
        return collect_data_files(package_name)
    except Exception:
        return []


def safe_collect_submodules(package_name):
    try:
        return collect_submodules(package_name)
    except Exception:
        return []


datas = []

# Non-secret runtime data/scripts needed by the backend when RESOURCE_DIR points
# to the PyInstaller bundle. Secrets, device data, payloads, recordings, SQL and
# Android source trees are intentionally excluded.
datas += existing_data("Login.js")
datas += existing_data("Register.js")
datas += existing_data("update.json")
datas += existing_data("requirements.txt")
datas += safe_collect_data_files("certifi")

hiddenimports = [
    "app_meta",
    "entitlements",
    "scrcpy_manager",
    "scrcpy_raw_streamer",
    "scrcpy_raw_ws_server",
    "scrcpy_control_channel",
    "websocket_server",
    "updater",
    "psutil",
    "websocket",
    "websockets",
]
hiddenimports += safe_collect_submodules("websockets")
hiddenimports += safe_collect_submodules("websocket")
hiddenimports += safe_collect_submodules("psutil")


a = Analysis(
    [str(ROOT / "local_adb_server.py")],
    pathex=[str(ROOT)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter",
        "pytest",
        "unittest",
        "numpy",
        "matplotlib",
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="FlowDashboard.Backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="FlowDashboard.Backend",
)
