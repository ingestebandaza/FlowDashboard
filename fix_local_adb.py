import sys

def apply_fixes():
    with open("c:\\DASHBOARD\\FlowDashboard\\local_adb_server.py", "r", encoding="utf-8") as f:
        content = f.read()

    # Fix 1: _devices_cache_updater (remove _known list)
    old_known = """    _known = [
        '192.168.1.11:5555','192.168.1.38:5555','192.168.1.39:5555','192.168.1.40:5555',
        '192.168.1.41:5555','192.168.1.42:5555','192.168.1.43:5555','192.168.1.44:5555',
        '192.168.1.45:5555','192.168.1.46:5555','192.168.1.47:5555','192.168.1.48:5555',
        '192.168.1.49:5555','192.168.1.50:5555','192.168.1.51:5555','192.168.1.52:5555',
        '192.168.1.53:5555',
    ]"""
    content = content.replace(old_known, "    _known = []")

    # Fix 2: serve_forever (remove legacy_known_serials)
    old_legacy = """    legacy_known_serials = [
        '192.168.1.11:5555','192.168.1.38:5555','192.168.1.39:5555','192.168.1.40:5555',
        '192.168.1.41:5555','192.168.1.42:5555','192.168.1.43:5555','192.168.1.44:5555',
        '192.168.1.45:5555','192.168.1.46:5555','192.168.1.47:5555','192.168.1.48:5555',
        '192.168.1.49:5555','192.168.1.50:5555','192.168.1.51:5555','192.168.1.52:5555',
        '192.168.1.53:5555',
    ]"""
    content = content.replace(old_legacy, "")

    # Fix 3: list_devices (capture unauthorized)
    old_list_dev = """        if len(parts) < 2 or parts[1] != "device":
            continue"""
    new_list_dev = """        if len(parts) < 2:
            continue
        state = parts[1]
        if state not in ("device", "unauthorized", "offline"):
            continue"""
    content = content.replace(old_list_dev, new_list_dev)

    # Fix 4: list_devices (add adbState to devices list)
    old_dict = """            "product": product,
        })"""
    new_dict = """            "product": product,
            "adbState": state,
        })"""
    content = content.replace(old_dict, new_dict, 1)

    # Fix 5: list_devices fallback for empty output (unknown state)
    old_fallback = """            "product": "",
        })"""
    new_fallback = """            "product": "",
            "adbState": "unknown",
        })"""
    content = content.replace(old_fallback, new_fallback, 1)

    # Fix 6: do_POST (add /device/forget)
    old_post = """            if path == "/adb":
                self._json({"result": run_adb_command(body.get("command", ""), body.get("deviceIds", "all")), "devices": _get_cached_devices()})
            elif path == "/packages":"""
    new_post = """            if path == "/adb":
                self._json({"result": run_adb_command(body.get("command", ""), body.get("deviceIds", "all")), "devices": _get_cached_devices()})
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
            elif path == "/packages":"""
    content = content.replace(old_post, new_post)

    with open("c:\\DASHBOARD\\FlowDashboard\\local_adb_server.py", "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    apply_fixes()
    print("Fixes applied successfully to local_adb_server.py")
