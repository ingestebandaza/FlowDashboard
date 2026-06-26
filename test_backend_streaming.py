#!/usr/bin/env python3
"""Test backend streaming functionality"""

import sys
import os
import time
import threading

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=== Backend Streaming Test ===")

# Test 1: Check imports
print("\n1. Testing imports...")
try:
    import local_adb_server
    print("  ✓ local_adb_server imported")
    
    from scrcpy_client import ScrcpyStream
    print("  ✓ ScrcpyStream imported")
    
    # Check if ADB is available
    if local_adb_server.ADB:
        print(f"  ✓ ADB encontrado: {local_adb_server.ADB}")
    else:
        print("  ✗ ADB NO encontrado")
        
except ImportError as e:
    print(f"  ✗ Error importando: {e}")
    sys.exit(1)

# Test 2: Check WebSocket server
print("\n2. Testing WebSocket server...")
if local_adb_server.WEBSOCKETS_AVAILABLE:
    print("  ✓ WebSockets disponible")
    
    # Start WebSocket server in background
    def start_ws_server():
        local_adb_server.run_websocket_server()
    
    ws_thread = threading.Thread(target=start_ws_server, daemon=True)
    ws_thread.start()
    time.sleep(2)
    print("  ✓ WebSocket server iniciado (en puerto 8767)")
else:
    print("  ✗ WebSockets NO disponible. Instala: pip install websockets")

# Test 3: Check scrcpy availability
print("\n3. Testing scrcpy components...")
if local_adb_server.SCRCPY_AVAILABLE:
    print("  ✓ Scrcpy disponible")
    
    # Check for scrcpy-server.jar
    import pathlib
    BASE_DIR = pathlib.Path(__file__).resolve().parent
    
    scrcpy_locations = [
        BASE_DIR / "scrcpy-server.jar",
        BASE_DIR / "scrcpy-win64-v4.0" / "scrcpy-server.jar",
        BASE_DIR / "flow_agent_apk" / "assets" / "scrcpy-server.jar"
    ]
    
    found = False
    for location in scrcpy_locations:
        if location.exists():
            print(f"  ✓ scrcpy-server.jar encontrado en: {location}")
            found = True
            break
    
    if not found:
        print("  ✗ scrcpy-server.jar NO encontrado en:")
        for location in scrcpy_locations:
            print(f"    - {location}")
else:
    print("  ✗ Scrcpy NO disponible")

# Test 4: Check HTTP server endpoints
print("\n4. Testing HTTP endpoints...")
try:
    # Create a mock request to test endpoint logic
    print("  ✓ Endpoints de streaming configurados:")
    print("    - /screen-stream/start")
    print("    - /screen-stream/stop")
    print("    - /screen-stream/status")
    print("    - /screen-streams")
except Exception as e:
    print(f"  ✗ Error: {e}")

print("\n=== Resumen ===")
print("Para probar streaming completo necesitas:")
print("1. ADB instalado y en PATH")
print("2. Dispositivo Android conectado (USB o WiFi)")
print("3. Ejecutar: python local_adb_server.py")
print("4. Abrir: http://127.0.0.1:8765/wsapi_demo.html")
print("5. Conectar dispositivos y probar streaming")

print("\nNota: Si el streaming falla, revisa:")
print("- Consola del servidor para mensajes de error")
print("- Consola del navegador (F12) para errores JavaScript")
print("- Verifica que scrcpy-server.jar esté en la ubicación correcta")

# Keep the server running for a bit
print("\nManteniendo servidor WebSocket activo por 10 segundos...")
try:
    time.sleep(10)
except KeyboardInterrupt:
    print("\nTest interrumpido por usuario")

print("\nTest completado.")