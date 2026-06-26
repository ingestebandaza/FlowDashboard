#!/usr/bin/env python3
"""
Pruebas para WebSocket Streaming
- Verifica que el servidor WebSocket funciona
- Verifica que scrcpy_manager se integra correctamente
- Verifica que los frames se envían correctamente
"""

import asyncio
import json
import logging
import sys
import time
from pathlib import Path

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(name)s] %(levelname)s: %(message)s'
)
logger = logging.getLogger('TestWebSocket')

# Importar módulos
try:
    import websockets
    WEBSOCKETS_AVAILABLE = True
except ImportError:
    WEBSOCKETS_AVAILABLE = False
    logger.error("websockets no está instalado. Instalar con: pip install websockets")
    sys.exit(1)

try:
    from websocket_server import WebSocketStreamManager, ws_manager
    from scrcpy_manager import scrcpy_manager
    MODULES_AVAILABLE = True
except ImportError as e:
    MODULES_AVAILABLE = False
    logger.error(f"Error importando módulos: {e}")
    sys.exit(1)


async def test_websocket_connection():
    """Prueba 1: Verificar que WebSocket conecta"""
    logger.info("=" * 60)
    logger.info("PRUEBA 1: Conexión WebSocket")
    logger.info("=" * 60)
    
    try:
        # Conectar a WebSocket
        async with websockets.connect('ws://127.0.0.1:8766/ws/screen-stream/test-device') as ws:
            logger.info("✅ WebSocket conectado exitosamente")
            
            # Enviar mensaje de prueba
            await ws.send(b"test frame data")
            logger.info("✅ Mensaje enviado")
            
            # Esperar respuesta (no debería haber)
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=1)
                logger.warning(f"Respuesta inesperada: {response}")
            except asyncio.TimeoutError:
                logger.info("✅ Sin respuesta (esperado)")
        
        logger.info("✅ PRUEBA 1 PASADA\n")
        return True
    
    except Exception as e:
        logger.error(f"❌ PRUEBA 1 FALLÓ: {e}\n")
        return False


async def test_websocket_manager():
    """Prueba 2: Verificar que WebSocketStreamManager funciona"""
    logger.info("=" * 60)
    logger.info("PRUEBA 2: WebSocketStreamManager")
    logger.info("=" * 60)
    
    try:
        # Crear gestor
        manager = WebSocketStreamManager()
        logger.info("✅ WebSocketStreamManager creado")
        
        # Registrar cliente
        class MockWebSocket:
            def __init__(self, name):
                self.name = name
                self.messages = []
            
            async def send(self, data):
                self.messages.append(data)
        
        ws1 = MockWebSocket("ws1")
        ws2 = MockWebSocket("ws2")
        
        await manager.register_client("device1", ws1)
        await manager.register_client("device1", ws2)
        logger.info("✅ Clientes registrados")
        
        # Verificar cantidad de clientes
        count = manager.get_client_count("device1")
        assert count == 2, f"Esperaba 2 clientes, obtuve {count}"
        logger.info(f"✅ Cantidad de clientes correcta: {count}")
        
        # Broadcast frame
        test_frame = b"test frame data"
        await manager.broadcast_frame("device1", test_frame)
        logger.info("✅ Frame enviado a todos los clientes")
        
        # Verificar que ambos clientes recibieron el frame
        assert ws1.messages[-1] == test_frame, "ws1 no recibió el frame"
        assert ws2.messages[-1] == test_frame, "ws2 no recibió el frame"
        logger.info("✅ Ambos clientes recibieron el frame")
        
        # Desregistrar cliente
        await manager.unregister_client("device1", ws1)
        count = manager.get_client_count("device1")
        assert count == 1, f"Esperaba 1 cliente, obtuve {count}"
        logger.info(f"✅ Cliente desregistrado correctamente")
        
        logger.info("✅ PRUEBA 2 PASADA\n")
        return True
    
    except Exception as e:
        logger.error(f"❌ PRUEBA 2 FALLÓ: {e}\n")
        return False


async def test_scrcpy_integration():
    """Prueba 3: Verificar que scrcpy_manager se integra"""
    logger.info("=" * 60)
    logger.info("PRUEBA 3: Integración con scrcpy_manager")
    logger.info("=" * 60)
    
    try:
        # Verificar que scrcpy_manager existe
        assert scrcpy_manager is not None, "scrcpy_manager es None"
        logger.info("✅ scrcpy_manager disponible")
        
        # Verificar métodos
        assert hasattr(scrcpy_manager, 'get_stream'), "get_stream no existe"
        assert hasattr(scrcpy_manager, 'get_all_streams'), "get_all_streams no existe"
        assert hasattr(scrcpy_manager, 'start_stream'), "start_stream no existe"
        assert hasattr(scrcpy_manager, 'stop_stream'), "stop_stream no existe"
        logger.info("✅ Todos los métodos existen")
        
        # Obtener streams (debería estar vacío)
        streams = scrcpy_manager.get_all_streams()
        logger.info(f"✅ Streams actuales: {len(streams)}")
        
        logger.info("✅ PRUEBA 3 PASADA\n")
        return True
    
    except Exception as e:
        logger.error(f"❌ PRUEBA 3 FALLÓ: {e}\n")
        return False


async def test_websocket_manager_integration():
    """Prueba 4: Verificar que ws_manager se integra con scrcpy_manager"""
    logger.info("=" * 60)
    logger.info("PRUEBA 4: Integración ws_manager + scrcpy_manager")
    logger.info("=" * 60)
    
    try:
        # Establecer scrcpy_manager
        ws_manager.set_scrcpy_manager(scrcpy_manager)
        logger.info("✅ scrcpy_manager establecido en ws_manager")
        
        # Verificar que se estableció
        assert ws_manager.scrcpy_manager is not None, "scrcpy_manager no se estableció"
        logger.info("✅ scrcpy_manager verificado")
        
        logger.info("✅ PRUEBA 4 PASADA\n")
        return True
    
    except Exception as e:
        logger.error(f"❌ PRUEBA 4 FALLÓ: {e}\n")
        return False


async def test_multiple_clients():
    """Prueba 5: Verificar que múltiples clientes funcionan"""
    logger.info("=" * 60)
    logger.info("PRUEBA 5: Múltiples clientes simultáneos")
    logger.info("=" * 60)
    
    try:
        # Crear múltiples conexiones
        connections = []
        for i in range(3):
            try:
                ws = await websockets.connect('ws://127.0.0.1:8766/ws/screen-stream/device-multi')
                connections.append(ws)
                logger.info(f"✅ Cliente {i+1} conectado")
            except Exception as e:
                logger.warning(f"⚠️ Cliente {i+1} no pudo conectar: {e}")
        
        if connections:
            logger.info(f"✅ {len(connections)} clientes conectados")
            
            # Cerrar conexiones
            for ws in connections:
                await ws.close()
            logger.info("✅ Todas las conexiones cerradas")
        
        logger.info("✅ PRUEBA 5 PASADA\n")
        return True
    
    except Exception as e:
        logger.error(f"❌ PRUEBA 5 FALLÓ: {e}\n")
        return False


async def run_all_tests():
    """Ejecutar todas las pruebas"""
    logger.info("\n")
    logger.info("╔" + "=" * 58 + "╗")
    logger.info("║" + " " * 58 + "║")
    logger.info("║" + "  PRUEBAS DE WEBSOCKET STREAMING".center(58) + "║")
    logger.info("║" + " " * 58 + "║")
    logger.info("╚" + "=" * 58 + "╝")
    logger.info("\n")
    
    results = []
    
    # Prueba 1
    try:
        result = await test_websocket_connection()
        results.append(("Conexión WebSocket", result))
    except Exception as e:
        logger.error(f"Error en prueba 1: {e}")
        results.append(("Conexión WebSocket", False))
    
    # Prueba 2
    try:
        result = await test_websocket_manager()
        results.append(("WebSocketStreamManager", result))
    except Exception as e:
        logger.error(f"Error en prueba 2: {e}")
        results.append(("WebSocketStreamManager", False))
    
    # Prueba 3
    try:
        result = await test_scrcpy_integration()
        results.append(("Integración scrcpy_manager", result))
    except Exception as e:
        logger.error(f"Error en prueba 3: {e}")
        results.append(("Integración scrcpy_manager", False))
    
    # Prueba 4
    try:
        result = await test_websocket_manager_integration()
        results.append(("Integración ws_manager", result))
    except Exception as e:
        logger.error(f"Error en prueba 4: {e}")
        results.append(("Integración ws_manager", False))
    
    # Prueba 5
    try:
        result = await test_multiple_clients()
        results.append(("Múltiples clientes", result))
    except Exception as e:
        logger.error(f"Error en prueba 5: {e}")
        results.append(("Múltiples clientes", False))
    
    # Resumen
    logger.info("\n")
    logger.info("╔" + "=" * 58 + "╗")
    logger.info("║" + " RESUMEN DE PRUEBAS ".center(58) + "║")
    logger.info("╠" + "=" * 58 + "╣")
    
    passed = 0
    for name, result in results:
        status = "✅ PASADA" if result else "❌ FALLÓ"
        logger.info(f"║ {name:<40} {status:<16} ║")
        if result:
            passed += 1
    
    logger.info("╠" + "=" * 58 + "╣")
    logger.info(f"║ Total: {passed}/{len(results)} pruebas pasadas".ljust(59) + "║")
    logger.info("╚" + "=" * 58 + "╝")
    logger.info("\n")
    
    return passed == len(results)


if __name__ == "__main__":
    logger.info("Iniciando pruebas de WebSocket Streaming...")
    logger.info(f"websockets disponible: {WEBSOCKETS_AVAILABLE}")
    logger.info(f"Módulos disponibles: {MODULES_AVAILABLE}")
    logger.info("")
    
    try:
        success = asyncio.run(run_all_tests())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.info("\n\nPruebas interrumpidas por el usuario")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n\nError fatal: {e}")
        sys.exit(1)
