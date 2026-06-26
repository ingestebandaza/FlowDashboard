import requests
import time
import sys

try:
    print("Getting devices...")
    r = requests.get("http://127.0.0.1:8765/devices")
    devices = r.json().get('devices', [])
    if not devices:
        print("No devices found")
        sys.exit(1)
        
    serial = devices[0]['activeSerial']
    print(f"Testing recording on {serial}")
    
    print("Starting recording...")
    r = requests.post("http://127.0.0.1:8765/recordings/start", json={"serial": serial})
    print(r.json())
    
    print("Waiting 10 seconds...")
    time.sleep(10)
    
    print("Stopping recording...")
    r = requests.post("http://127.0.0.1:8765/recordings/stop", json={"serial": serial})
    print(r.json())
except Exception as e:
    print(f"Error: {e}")
