import os
import threading
from datetime import datetime, timezone


def _truthy(value):
    return str(value or "").strip().lower() in ("1", "true", "yes", "on")


ENFORCEMENT_ENABLED = _truthy(os.getenv("FLOWDASHBOARD_ENFORCE_ENTITLEMENTS", ""))

POST_FEATURE_MAP = {
    "/adb": "adb.shell",
    "/packages": "apps.manage",
    "/autojs/run": "autojs.execute",
    "/autojs/stop": "autojs.execute",
    "/autojs/push": "autojs.execute",
    "/autojs/prepare-overlay": "autojs.execute",
    "/autojs/install-bundled": "autojs.execute",
    "/login-status": "flowlogin.execute",
    "/flowagent/setup": "flowagent.install",
    "/flowagent/setup-smart": "flowagent.install",
    "/flowagent/run-script": "autojs.execute",
    "/flowagent/stop-script": "autojs.execute",
    "/flowkeyboard/status": "flowkeyboard.use",
    "/flowkeyboard/prepare": "flowkeyboard.use",
    "/flowkeyboard/type": "flowkeyboard.use",
    "/flowkeyboard/type-human": "flowkeyboard.use",
    "/flowkeyboard/select-via-settings": "flowkeyboard.use",
    "/flowkeyboard/command": "flowkeyboard.use",
    "/clone-apks/install": "apps.manage",
    "/clone-apks/uninstall": "apps.manage",
    "/apps/list": "apps.manage",
    "/apps/launch": "apps.manage",
    "/apps/force-stop": "apps.manage",
    "/apps/clear-cache": "apps.manage",
    "/apps/uninstall": "apps.manage",
    "/apps/details": "apps.manage",
    "/apps/icon": "apps.manage",
    "/apps/install": "apps.manage",
    "/file-push": "files.push",
    "/power/reboot": "power.reboot",
    "/power/shutdown": "power.shutdown",
    "/control/tap": "control.touch",
    "/control/touch": "control.touch",
    "/control/swipe": "control.touch",
    "/control/keyevent": "control.touch",
    "/control/type-text": "control.keyboard",
    "/control/paste-text": "control.keyboard",
    "/recordings/start": "recording.video",
    "/recordings/stop": "recording.video",
    "/recordings/stop-all": "recording.video",
    "/recordings/status": "recording.video",
    "/inspector/dump": "inspector.tree",
    "/inspector/tap": "inspector.tree",
    "/inspector/long-press": "inspector.tree",
    "/inspector/input-text": "inspector.tree",
    "/inspector/scroll": "inspector.tree",
    "/inspector/blind-search": "inspector.tree",
    "/inspector/auto-detect": "inspector.hybrid",
    "/inspector/accessibility-dump": "inspector.accessibility",
    "/inspector/native-detect": "inspector.native",
    "/inspector/web-detect": "inspector.web",
    "/inspector/cdp-connect": "inspector.web",
    "/inspector/cdp-dump": "inspector.web",
}

_LOCK = threading.Lock()
_STATE = {
    "loaded": False,
    "features": set(),
    "limits": {},
    "plan": {},
    "grace": {},
    "updated_at": None,
    "source": None,
}


def _extract_features(rpc_result):
    features = rpc_result.get("features")
    if isinstance(features, list):
        return {str(code).strip() for code in features if str(code).strip()}
    return set()


def set_entitlements(rpc_result, source="validate"):
    if not isinstance(rpc_result, dict):
        return
    status = str(rpc_result.get("status", "")).strip().lower()
    if status not in ("success", "ok", "valid", "active"):
        return
    with _LOCK:
        _STATE["features"] = _extract_features(rpc_result)
        _STATE["limits"] = rpc_result.get("limits") or {}
        _STATE["plan"] = rpc_result.get("plan") or {}
        _STATE["grace"] = rpc_result.get("grace") or {}
        _STATE["updated_at"] = datetime.now(timezone.utc).isoformat()
        _STATE["source"] = source
        _STATE["loaded"] = True


def clear_entitlements():
    with _LOCK:
        _STATE["loaded"] = False
        _STATE["features"] = set()
        _STATE["limits"] = {}
        _STATE["plan"] = {}
        _STATE["grace"] = {}
        _STATE["updated_at"] = None
        _STATE["source"] = None


def get_state():
    with _LOCK:
        return {
            "enforcement": ENFORCEMENT_ENABLED,
            "loaded": _STATE["loaded"],
            "features": sorted(_STATE["features"]),
            "limits": dict(_STATE["limits"]),
            "plan": dict(_STATE["plan"]),
            "grace": dict(_STATE["grace"]),
            "updatedAt": _STATE["updated_at"],
            "source": _STATE["source"],
        }


def is_feature_allowed(feature_code):
    if not ENFORCEMENT_ENABLED:
        return True
    if not feature_code:
        return True
    with _LOCK:
        if not _STATE["loaded"]:
            return True
        features = _STATE["features"]
    if not features:
        return True
    return feature_code in features


def check_post(path):
    feature_code = POST_FEATURE_MAP.get(path)
    if feature_code is None:
        return True, None
    return is_feature_allowed(feature_code), feature_code
