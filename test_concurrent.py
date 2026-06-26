import asyncio
import aiohttp
import time
import json
import sys

DEVICES = [
    "192.168.1.45:5555",
    "192.168.1.46:5555",
    "192.168.1.47:5555",
    "192.168.1.49:5555",
    "192.168.1.50:5555"
]

BASE_URL = "http://127.0.0.1:8765/control"

async def test_device(session, serial, prefer_scrcpy):
    results = {}
    
    # 1. Tap
    try:
        t0 = time.time()
        resp = await session.post(f"{BASE_URL}/tap", json={
            "serial": serial, "x": 500, "y": 500, "preferScrcpy": prefer_scrcpy
        })
        results['tap'] = await resp.json()
    except Exception as e:
        results['tap'] = {"error": str(e)}

    # 2. Swipe
    try:
        resp = await session.post(f"{BASE_URL}/swipe", json={
            "serial": serial, "startX": 500, "startY": 1500, "endX": 500, "endY": 500, "preferScrcpy": prefer_scrcpy
        })
        results['swipe'] = await resp.json()
    except Exception as e:
        results['swipe'] = {"error": str(e)}

    # 3. KeyEvent
    try:
        resp = await session.post(f"{BASE_URL}/keyevent", json={
            "serial": serial, "name": "home", "preferScrcpy": prefer_scrcpy
        })
        results['keyevent'] = await resp.json()
    except Exception as e:
        results['keyevent'] = {"error": str(e)}

    return {serial: results}

async def main():
    async with aiohttp.ClientSession() as session:
        # Run Control Puro
        print("--- CONCURRENT SCRCPY CONTROL ---")
        tasks = [test_device(session, dev, True) for dev in DEVICES]
        scrcpy_results = await asyncio.gather(*tasks)
        for r in scrcpy_results:
            print(json.dumps(r))
            
        print("\n--- CONCURRENT FALLBACK ADB ---")
        tasks = [test_device(session, dev, False) for dev in DEVICES]
        adb_results = await asyncio.gather(*tasks)
        for r in adb_results:
            print(json.dumps(r))

if __name__ == "__main__":
    asyncio.run(main())
