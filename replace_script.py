import sys

with open('local_adb_server.py', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''def agent_click_node(agent, node):
    bounds = agent_bounds(node)
    if not bounds or bounds["width"] <= 0 or bounds["height"] <= 0:
        return False
    agent_tap(agent, bounds["centerX"], bounds["centerY"])
    return True'''

new = '''def agent_click_node(agent, node):
    bounds = agent_bounds(node)
    if not bounds or bounds["width"] <= 0 or bounds["height"] <= 0:
        return False
    
    serial = str(agent.meta.get("serial") or "")
    jitter_ratio = 0.1
    if serial:
        profile = get_or_create_human_profile(serial)
        jitter_ratio = float(profile.get("tap", {}).get("jitterRatio", 0.1))
    
    import random
    w = bounds["width"]
    h = bounds["height"]
    safe_w = max(1, int(w * (1.0 - jitter_ratio)))
    safe_h = max(1, int(h * (1.0 - jitter_ratio)))
    
    x = random.randint(bounds["centerX"] - safe_w // 2, bounds["centerX"] + safe_w // 2)
    y = random.randint(bounds["centerY"] - safe_h // 2, bounds["centerY"] + safe_h // 2)
    
    agent_tap(agent, x, y)
    return True'''

if old in content:
    with open('local_adb_server.py', 'w', encoding='utf-8') as f:
        f.write(content.replace(old, new))
    print("Replaced successfully")
else:
    print("Old content not found")
