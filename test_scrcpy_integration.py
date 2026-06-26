#!/usr/bin/env python3
"""
Prueba de integración de scrcpy con FlowDashboard.
"""

import subprocess
import time
import json
import requests
import threading
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def test_adb_devices():
    """Probar que ADB funciona"""
    print("=== Probando ADB ===")
    result = subprocess.run("adb devices", shell=True, capture_output=True, text=True)
    print("Dispositivos ADB:")
    print(result.stdout)
    
    # Extraer serials
    lines = result.stdout.strip().split('\n')
    devices = []
    for line in lines[1:]:
        if line.strip() and not line.startswith('*'):
            serial = line.split('\t')[0]
            devices.append(serial)
    
    return devices

def test_server_health():
    """Probar que el servidor está funcionando"""
    print("\n=== Probando servidor HTTP ===")
    try:
        response = requests.get("http://127.0.0.1:8765/health", timeout=5)
        data = response.json()
        print(f"Servidor OK: {data.get('ok', False)}")
        print(f"Versión: {data.get('version')}")
        print(f"Features: {data.get('features', [])}")
        
        # Verificar si scrcpy está en features
        features = data.get('features', [])
        if 'screen_streaming_scrcpy' in features:
            print("✓ Feature 'screen_streaming_scrcpy' encontrada")
        else:
            print("✗ Feature 'screen_streaming_scrcpy' NO encontrada")
            
        return True
    except Exception as e:
        print(f"Error conectando al servidor: {e}")
        return False

def test_scrcpy_endpoints():
    """Probar endpoints de scrcpy"""
    print("\n=== Probando endpoints de scrcpy ===")
    
    # 1. GET /screen-streams
    try:
        response = requests.get("http://127.0.0.1:8765/screen-streams", timeout=5)
        data = response.json()
        print(f"GET /screen-streams: {data}")
    except Exception as e:
        print(f"Error en GET /screen-streams: {e}")
    
    # 2. POST /screen-stream/start (solo si hay dispositivos)
    devices = test_adb_devices()
    if devices:
        serial = devices[0]
        print(f"\nProbando con dispositivo: {serial}")
        
        try:
            payload = {
                "serial": serial,
                "maxWidth": 1280,
                "bitRate": 4000000,
                "maxFps": 30
            }
            response = requests.post("http://127.0.0.1:8765/screen-stream/start", 
                                    json=payload, timeout=10)
            data = response.json()
            print(f"POST /screen-stream/start: {data}")
            
            if data.get('success'):
                print("✓ Streaming iniciado exitosamente")
                
                # 3. GET /screen-stream/status/{serial}
                time.sleep(2)
                response = requests.get(f"http://127.0.0.1:8765/screen-stream/status/{serial}", 
                                       timeout=5)
                status_data = response.json()
                print(f"GET /screen-stream/status/{serial}: {status_data}")
                
                # 4. POST /screen-stream/stop
                time.sleep(5)  # Dejar streaming por 5 segundos
                response = requests.post("http://127.0.0.1:8765/screen-stream/stop", 
                                        json={"serial": serial}, timeout=5)
                stop_data = response.json()
                print(f"POST /screen-stream/stop: {stop_data}")
                
                if stop_data.get('success'):
                    print("✓ Streaming detenido exitosamente")
                else:
                    print("✗ Error deteniendo streaming")
            else:
                print(f"✗ Error iniciando streaming: {data.get('error', 'Unknown error')}")
                
        except Exception as e:
            print(f"Error probando endpoints: {e}")
    else:
        print("No hay dispositivos ADB conectados para probar")

def test_scrcpy_manager():
    """Probar el módulo scrcpy_manager directamente"""
    print("\n=== Probando scrcpy_manager directamente ===")
    
    try:
        from scrcpy_manager import scrcpy_manager, test_scrcpy
        
        # Probar función de prueba
        test_scrcpy()
        
        # Probar gestión de streams
        devices = test_adb_devices()
        if devices:
            serial = devices[0]
            print(f"\nProbando scrcpy_manager con dispositivo: {serial}")
            
            # Iniciar stream
            if scrcpy_manager.start_stream(serial, max_width=1280, bit_rate=4000000):
                print(f"✓ Stream iniciado para {serial}")
                
                # Obtener estado
                status = scrcpy_manager.get_stream_status(serial)
                print(f"Estado: {status}")
                
                # Listar todos los streams
                streams = scrcpy_manager.get_all_streams()
                print(f"Streams activos: {streams}")
                
                # Detener stream
                time.sleep(3)
                scrcpy_manager.stop_stream(serial)
                print(f"✓ Stream detenido para {serial}")
            else:
                print(f"✗ Error iniciando stream para {serial}")
        else:
            print("No hay dispositivos para probar scrcpy_manager")
            
    except ImportError as e:
        print(f"Error importando scrcpy_manager: {e}")
    except Exception as e:
        print(f"Error probando scrcpy_manager: {e}")

def main():
    """Función principal de prueba"""
    print("=" * 60)
    print("PRUEBA DE INTEGRACIÓN SCRCPY CON FLOWDASHBOARD")
    print("=" * 60)
    
    # Verificar que el servidor esté corriendo
    print("\n[1] Verificando servidor...")
    if not test_server_health():
        print("\n⚠️  El servidor no está corriendo. Ejecuta:")
        print("   python local_adb_server.py")
        print("   o")
        print("   abrir_dashboard.bat")
        return
    
    # Probar ADB
    print("\n[2] Verificando ADB...")
    devices = test_adb_devices()
    if not devices:
        print("⚠️  No hay dispositivos ADB conectados.")
        print("   Conecta al menos un dispositivo Android por USB o WiFi ADB.")
    
    # Probar endpoints de scrcpy
    print("\n[3] Probando endpoints de scrcpy...")
    test_scrcpy_endpoints()
    
    # Probar scrcpy_manager directamente
    print("\n[4] Probando scrcpy_manager...")
    test_scrcpy_manager()
    
    print("\n" + "=" * 60)
    print("PRUEBA COMPLETADA")
    print("=" * 60)
    
    if devices:
        print("\n🎉 ¡scrcpy está integrado correctamente!")
        print(f"   Dispositivos detectados: {len(devices)}")
        print(f"   Seriales: {', '.join(devices)}")
    else:
        print("\n⚠️  scrcpy está integrado pero no hay dispositivos para probar.")
    
    print("\nPróximos pasos:")
    print("1. Implementar WebSocket para streaming H.264")
    print("2. Agregar UI en wsapi_demo.html")
    print("3. Implementar MediaSource API en frontend")
    print("4. Agregar controles de calidad y reproducción")

if __name__ == "__main__":
    main()