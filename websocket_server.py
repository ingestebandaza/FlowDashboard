#!/usr/bin/env python3
"""
Servidor WebSocket para Streaming de Pantalla Android
- Maneja conexiones WebSocket para streaming de video H.264
- Integra con scrcpy_manager para obtener frames
- Envía frames a múltiples clientes simultáneamente
"""

import asyncio
import json
import logging
import threading
import time
from pathlib import Path
from typing import Dict, Set, Optional

try:
    import websockets
    from websockets.server import WebSocketServerProtocol
    WEBSOCKETS_AVAILABLE = True
except ImportError:
    WEBSOCKETS_AVAILABLE = False
    print("[WebSocket] Módulo websockets no disponible. Streaming WebSocket desactivado.")

# Configuración
WS_HOST = "127.0.0.1"
WS_PORT = 8767
WS_BUFFER_SIZE = 65536  # 64KB por frame

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(name)s] %(levelname)s: %(message)s'
)
logger = logging.getLogger('WebSocketServer')


class WebSocketStreamManager:
    """Gestor de conexiones WebSocket para streaming de video"""
    
    def __init__(self):
        self.clients: Dict[str, Set[WebSocketServerProtocol]] = {}  # serial -> set of websockets
        self.scrcpy_manager = None
        self.lock = asyncio.Lock()
    
    def set_scrcpy_manager(self, manager):
        """Establecer referencia al gestor de scrcpy"""
        self.scrcpy_manager = manager
    
    async def register_client(self, serial: str, websocket: WebSocketServerProtocol):
        """Registrar un nuevo cliente WebSocket"""
        async with self.lock:
            if serial not in self.clients:
                self.clients[serial] = set()
            self.clients[serial].add(websocket)
            logger.info(f"Cliente registrado para {serial}. Total: {len(self.clients[serial])}")
    
    async def unregister_client(self, serial: str, websocket: WebSocketServerProtocol):
        """Desregistrar un cliente WebSocket"""
        async with self.lock:
            if serial in self.clients:
                self.clients[serial].discard(websocket)
                if not self.clients[serial]:
                    del self.clients[serial]
                    logger.info(f"Último cliente desconectado de {serial}")
                else:
                    logger.info(f"Cliente desconectado de {serial}. Total: {len(self.clients[serial])}")
    
    async def broadcast_frame(self, serial: str, frame_data: bytes):
        """Enviar frame a todos los clientes conectados"""
        if serial not in self.clients:
            return
        
        dead_clients = set()
        
        for client in self.clients[serial]:
            try:
                await client.send(frame_data)
            except Exception as e:
                logger.warning(f"Error enviando frame a cliente: {e}")
                dead_clients.add(client)
        
        # Limpiar clientes muertos
        if dead_clients:
            async with self.lock:
                self.clients[serial] -= dead_clients
    
    def get_client_count(self, serial: str) -> int:
        """Obtener cantidad de clientes conectados"""
        return len(self.clients.get(serial, set()))
    
    def get_all_streams(self) -> Dict[str, int]:
        """Obtener información de todos los streams activos"""
        return {serial: len(clients) for serial, clients in self.clients.items()}


# Instancia global del gestor
ws_manager = WebSocketStreamManager()


async def handle_screen_stream(websocket: WebSocketServerProtocol, path: str):
    """
    Manejador de conexión WebSocket para streaming de pantalla
    
    Ruta: /ws/screen-stream/{serial}
    """
    try:
        # Extraer serial de la ruta
        parts = path.strip('/').split('/')
        if len(parts) < 3 or parts[1] != 'screen-stream':
            await websocket.close(code=1008, reason="Invalid path")
            return
        
        serial = parts[2]
        logger.info(f"Nueva conexión WebSocket para {serial}")
        
        # Verificar que el stream existe
        if not ws_manager.scrcpy_manager:
            await websocket.close(code=1011, reason="scrcpy_manager not available")
            return
        
        stream = ws_manager.scrcpy_manager.get_stream(serial)
        if not stream:
            await websocket.close(code=1008, reason="Stream not found")
            return
        
        # Registrar cliente
        await ws_manager.register_client(serial, websocket)
        
        # Agregar cliente al stream
        stream.add_client(websocket)
        
        try:
            # Mantener conexión abierta
            async for message in websocket:
                # Procesar mensajes del cliente (ej: control remoto)
                # Por ahora solo recibimos, no procesamos
                pass
        
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Conexión cerrada para {serial}")
        
        except Exception as e:
            logger.error(f"Error en conexión WebSocket para {serial}: {e}")
        
        finally:
            # Limpiar
            stream.remove_client(websocket)
            await ws_manager.unregister_client(serial, websocket)
            logger.info(f"Cliente desconectado de {serial}")
    
    except Exception as e:
        logger.error(f"Error en handle_screen_stream: {e}")
        try:
            await websocket.close(code=1011, reason=str(e))
        except:
            pass


async def handle_ws_status(websocket: WebSocketServerProtocol, path: str):
    """
    Manejador para obtener estado de streams
    
    Ruta: /ws/status
    """
    try:
        while True:
            status = {
                "streams": ws_manager.get_all_streams(),
                "timestamp": time.time()
            }
            await websocket.send(json.dumps(status))
            await asyncio.sleep(1)
    
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        logger.error(f"Error en handle_ws_status: {e}")


async def main_websocket_server():
    """Iniciar servidor WebSocket"""
    if not WEBSOCKETS_AVAILABLE:
        logger.error("websockets no está instalado. Instalar con: pip install websockets")
        return
    
    logger.info(f"Iniciando servidor WebSocket en ws://{WS_HOST}:{WS_PORT}")
    
    # Crear rutas
    async def route_handler(websocket, path):
        if path.startswith('/ws/screen-stream/'):
            await handle_screen_stream(websocket, path)
        elif path == '/ws/status':
            await handle_ws_status(websocket, path)
        else:
            await websocket.close(code=1008, reason="Unknown path")
    
    # Iniciar servidor
    async with websockets.serve(route_handler, WS_HOST, WS_PORT):
        logger.info(f"Servidor WebSocket listo en ws://{WS_HOST}:{WS_PORT}")
        await asyncio.Future()  # run forever


def start_websocket_server(scrcpy_manager=None):
    """
    Iniciar servidor WebSocket en un thread separado
    
    Args:
        scrcpy_manager: Instancia de ScrcpyManager
    """
    if not WEBSOCKETS_AVAILABLE:
        logger.warning("websockets no disponible. WebSocket streaming desactivado.")
        return
    
    if scrcpy_manager:
        ws_manager.set_scrcpy_manager(scrcpy_manager)
    
    def run_server():
        try:
            asyncio.run(main_websocket_server())
        except Exception as e:
            logger.error(f"Error en servidor WebSocket: {e}")
    
    thread = threading.Thread(target=run_server, daemon=True, name="WebSocketServer")
    thread.start()
    logger.info("Thread de WebSocket iniciado")


# Para pruebas
if __name__ == "__main__":
    logger.info("Iniciando servidor WebSocket de prueba...")
    asyncio.run(main_websocket_server())
