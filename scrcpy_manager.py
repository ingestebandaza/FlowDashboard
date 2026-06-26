#!/usr/bin/env python3
"""
Módulo para gestionar streaming de pantalla Android usando scrcpy.
Integración con local_adb_server.py para FlowDashboard.
"""

import os
import subprocess
import threading
import time
import socket
import json
import tempfile
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

BASE_DIR = Path(os.getenv("FLOWDASHBOARD_BASE_DIR") or Path(__file__).resolve().parent).resolve()
RESOURCE_DIR = Path(os.getenv("FLOWDASHBOARD_RESOURCE_DIR") or BASE_DIR).resolve()
SCRCPY_SERVER_JAR = Path(os.getenv("SCRCPY_SERVER_JAR") or (RESOURCE_DIR / "scrcpy-win64-v4.0" / "scrcpy-server.jar")).resolve()
SCRCPY_SERVER_BIN = RESOURCE_DIR / "scrcpy-server"
ADB_PATH = Path(os.getenv("FLOWDASHBOARD_ADB") or (RESOURCE_DIR / "scrcpy-win64-v4.0" / "adb.exe")).resolve()

# Configuración por defecto
DEFAULT_MAX_WIDTH = 1920
DEFAULT_BIT_RATE = 8000000  # 8 Mbps
DEFAULT_MAX_FPS = 30
DEFAULT_LOCK_VIDEO_ORIENTATION = -1  # -1 = desbloqueado

class ScrcpyStream:
    """Gestiona un stream de scrcpy para un dispositivo Android"""
    
    def __init__(self, serial: str, max_width: int = DEFAULT_MAX_WIDTH, 
                 bit_rate: int = DEFAULT_BIT_RATE, max_fps: int = DEFAULT_MAX_FPS):
        self.serial = serial
        self.max_width = max_width
        self.bit_rate = bit_rate
        self.max_fps = max_fps
        self.process = None
        self.socket = None
        self.port = None
        self.is_running = False
        self.clients = []  # Lista de clientes WebSocket
        self.read_thread = None
        self.data_buffer = []
        self.lock = threading.Lock()
        
    def start(self) -> bool:
        """Iniciar scrcpy-server en el dispositivo"""
        if self.is_running:
            return True
        
        try:
            # 1. Instalar scrcpy-server si no está presente
            if not self._install_server():
                print(f"[scrcpy] Error instalando scrcpy-server en {self.serial}")
                return False
            
            # 2. Iniciar scrcpy-server con ADB shell
            self.port = self._find_free_port()
            if not self._start_server():
                print(f"[scrcpy] Error iniciando scrcpy-server en {self.serial}")
                return False
            
            # 3. Crear socket para recibir datos
            if not self._create_socket():
                print(f"[scrcpy] Error creando socket para {self.serial}")
                return False
            
            # 4. Iniciar thread de lectura
            self.read_thread = threading.Thread(target=self._read_data, daemon=True)
            self.read_thread.start()
            
            self.is_running = True
            print(f"[scrcpy] Streaming iniciado para {self.serial} en puerto {self.port}")
            return True
            
        except Exception as e:
            print(f"[scrcpy] Error iniciando stream: {e}")
            self.stop()
            return False
    
    def stop(self):
        """Detener scrcpy-server y liberar recursos"""
        if not self.is_running:
            return
        
        self.is_running = False
        
        # 1. Cerrar socket
        if self.socket:
            try:
                self.socket.close()
            except:
                pass
            self.socket = None
        
        # 2. Detener scrcpy-server
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
            except:
                try:
                    self.process.kill()
                except:
                    pass
            self.process = None
        
        # 3. Notificar clientes
        with self.lock:
            for client in self.clients:
                try:
                    client.close()
                except:
                    pass
            self.clients = []
        
        # 4. Esperar thread de lectura
        if self.read_thread and self.read_thread.is_alive():
            self.read_thread.join(timeout=2)
        
        print(f"[scrcpy] Streaming detenido para {self.serial}")
    
    def add_client(self, websocket):
        """Agregar cliente WebSocket"""
        with self.lock:
            self.clients.append(websocket)
    
    def remove_client(self, websocket):
        """Eliminar cliente WebSocket"""
        with self.lock:
            if websocket in self.clients:
                self.clients.remove(websocket)
    
    def get_status(self) -> Dict[str, Any]:
        """Obtener estado del stream"""
        return {
            "serial": self.serial,
            "isRunning": self.is_running,
            "clientCount": len(self.clients),
            "maxWidth": self.max_width,
            "bitRate": self.bit_rate,
            "maxFps": self.max_fps,
            "port": self.port
        }
    
    def _install_server(self) -> bool:
        """Instalar scrcpy-server en dispositivo"""
        try:
            # Verificar si ya está instalado
            result = self._adb_shell("ls /data/local/tmp/scrcpy-server.jar")
            if result.returncode == 0:
                return True
            
            # Push scrcpy-server al dispositivo
            if SCRCPY_SERVER_JAR.exists():
                result = self._adb_push(str(SCRCPY_SERVER_JAR), "/data/local/tmp/scrcpy-server.jar")
                return result.returncode == 0
            elif SCRCPY_SERVER_BIN.exists():
                result = self._adb_push(str(SCRCPY_SERVER_BIN), "/data/local/tmp/scrcpy-server")
                return result.returncode == 0
            else:
                print(f"[scrcpy] No se encontró scrcpy-server en {BASE_DIR}")
                return False
                
        except Exception as e:
            print(f"[scrcpy] Error instalando scrcpy-server: {e}")
            return False
    
    def _start_server(self) -> bool:
        """Iniciar scrcpy-server en dispositivo"""
        try:
            # Comando para ejecutar scrcpy-server
            cmd = (
                f"CLASSPATH=/data/local/tmp/scrcpy-server.jar "
                f"app_process / "
                f"com.genymobile.scrcpy.Server 4.0 "
                f"{self.max_width} "
                f"{self.bit_rate} "
                f"{self.max_fps} "
                f"true - - - - {DEFAULT_LOCK_VIDEO_ORIENTATION} true - - -"
            )
            
            # Ejecutar con ADB shell en background
            self.process = subprocess.Popen(
                [str(ADB_PATH), "-s", self.serial, "shell", cmd],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Esperar un momento para que el servidor inicie
            time.sleep(1)
            
            # Forward del puerto
            result = subprocess.run(
                [str(ADB_PATH), "-s", self.serial, "forward", f"tcp:{self.port}", "localabstract:scrcpy"],
                capture_output=True,
                text=True,
            )
            
            if result.returncode != 0:
                print(f"[scrcpy] Error forwarding port: {result.stderr}")
                return False
            
            return True
            
        except Exception as e:
            print(f"[scrcpy] Error iniciando servidor: {e}")
            return False
    
    def _create_socket(self) -> bool:
        """Crear socket para recibir datos H.264"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(5.0)
            self.socket.connect(("127.0.0.1", self.port))
            self.socket.settimeout(None)
            return True
        except Exception as e:
            print(f"[scrcpy] Error creando socket: {e}")
            return False
    
    def _read_data(self):
        """Leer datos H.264 del socket y enviar a clientes"""
        try:
            while self.is_running and self.socket:
                try:
                    # Leer datos del socket
                    data = self.socket.recv(4096)
                    if not data:
                        break
                    
                    # Enviar a todos los clientes WebSocket
                    # Nota: Los clientes WebSocket se manejan de forma asíncrona
                    # desde websocket_server.py usando broadcast_frame()
                    # Aquí solo almacenamos el frame en buffer para que WebSocket lo envíe
                    with self.lock:
                        # Almacenar frame en buffer para clientes WebSocket
                        if self.clients:
                            self.data_buffer.append(data)
                            # Limitar tamaño del buffer
                            if len(self.data_buffer) > 30:
                                self.data_buffer.pop(0)
                                
                except socket.timeout:
                    continue
                except Exception as e:
                    if self.is_running:
                        print(f"[scrcpy] Error reading data: {e}")
                    break
                    
        except Exception as e:
            print(f"[scrcpy] Error en thread de lectura: {e}")
        finally:
            if self.is_running:
                self.stop()
    
    def get_latest_frame(self) -> Optional[bytes]:
        """Obtener el frame más reciente del buffer"""
        with self.lock:
            if self.data_buffer:
                return self.data_buffer[-1]
        return None
    
    def _find_free_port(self) -> int:
        """Encontrar puerto libre"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('', 0))
            return s.getsockname()[1]
    
    def _adb_shell(self, command: str) -> subprocess.CompletedProcess:
        """Ejecutar comando ADB shell"""
        return subprocess.run([str(ADB_PATH), "-s", self.serial, "shell", command], capture_output=True, text=True)
    
    def _adb_push(self, local_path: str, remote_path: str) -> subprocess.CompletedProcess:
        """Push archivo al dispositivo"""
        return subprocess.run([str(ADB_PATH), "-s", self.serial, "push", local_path, remote_path], capture_output=True, text=True)


class ScrcpyManager:
    """Gestor central de streams scrcpy"""
    
    def __init__(self):
        self.streams: Dict[str, ScrcpyStream] = {}
        self.lock = threading.Lock()
    
    def start_stream(self, serial: str, max_width: int = DEFAULT_MAX_WIDTH,
                     bit_rate: int = DEFAULT_BIT_RATE, max_fps: int = DEFAULT_MAX_FPS) -> bool:
        """Iniciar stream para un dispositivo"""
        with self.lock:
            if serial in self.streams:
                stream = self.streams[serial]
                if stream.is_running:
                    return True
                else:
                    # Reutilizar stream existente
                    stream.max_width = max_width
                    stream.bit_rate = bit_rate
                    stream.max_fps = max_fps
                    return stream.start()
            else:
                # Crear nuevo stream
                stream = ScrcpyStream(serial, max_width, bit_rate, max_fps)
                self.streams[serial] = stream
                return stream.start()
    
    def stop_stream(self, serial: str) -> bool:
        """Detener stream para un dispositivo"""
        with self.lock:
            if serial in self.streams:
                stream = self.streams[serial]
                stream.stop()
                del self.streams[serial]
                return True
            return False
    
    def get_stream(self, serial: str) -> Optional[ScrcpyStream]:
        """Obtener stream por serial"""
        with self.lock:
            return self.streams.get(serial)
    
    def get_all_streams(self) -> List[Dict[str, Any]]:
        """Obtener lista de todos los streams"""
        with self.lock:
            return [stream.get_status() for stream in self.streams.values()]
    
    def get_stream_status(self, serial: str) -> Optional[Dict[str, Any]]:
        """Obtener estado de un stream específico"""
        with self.lock:
            if serial in self.streams:
                return self.streams[serial].get_status()
            return None
    
    def cleanup(self):
        """Limpiar todos los streams"""
        with self.lock:
            for serial in list(self.streams.keys()):
                self.stop_stream(serial)


# Instancia global del gestor
scrcpy_manager = ScrcpyManager()


def test_scrcpy():
    """Función de prueba para scrcpy"""
    print("=== Prueba de scrcpy ===")
    
    # Listar dispositivos
    result = subprocess.run([str(ADB_PATH), "devices"], capture_output=True, text=True)
    print("Dispositivos ADB:")
    print(result.stdout)
    
    # Probar con el primer dispositivo
    lines = result.stdout.strip().split('\n')
    if len(lines) > 1:
        for line in lines[1:]:
            if line.strip() and not line.startswith('*'):
                serial = line.split('\t')[0]
                print(f"\nProbando con dispositivo: {serial}")
                
                # Iniciar stream
                if scrcpy_manager.start_stream(serial, max_width=1280, bit_rate=4000000):
                    print(f"Stream iniciado para {serial}")
                    time.sleep(5)
                    scrcpy_manager.stop_stream(serial)
                    print(f"Stream detenido para {serial}")
                else:
                    print(f"Error iniciando stream para {serial}")
                break


if __name__ == "__main__":
    test_scrcpy()
