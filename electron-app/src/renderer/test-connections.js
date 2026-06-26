/**
 * Script de prueba para verificar conexiones
 * Ejecutar desde DevTools Console: testConnections()
 */

async function testConnections() {
  console.log('🧪 Iniciando pruebas de conexión...\n');

  // Test 1: C# API
  console.log('1️⃣  Probando C# API (puerto 5000)...');
  try {
    const csharpHealth = await csharpAPI.healthCheck();
    console.log(`   ✅ C# API: ${csharpHealth ? 'CONECTADO' : 'DESCONECTADO'}`);
  } catch (error) {
    console.error(`   ❌ C# API: ${error.message}`);
  }

  // Test 2: Python API
  console.log('\n2️⃣  Probando Python API (puerto 8765)...');
  try {
    const pythonHealth = await pythonAPI.healthCheck();
    console.log(`   ✅ Python API: ${pythonHealth ? 'CONECTADO' : 'DESCONECTADO'}`);
  } catch (error) {
    console.error(`   ❌ Python API: ${error.message}`);
  }

  // Test 3: Cargar dispositivos
  console.log('\n3️⃣  Cargando dispositivos...');
  try {
    const devices = await csharpAPI.get('/devices');
    console.log(`   ✅ Dispositivos cargados: ${devices.length}`);
    if (devices.length > 0) {
      console.log('   Dispositivos:');
      devices.forEach((device, index) => {
        console.log(`     ${index + 1}. ${device.name || device.serial} (${device.serial})`);
      });
    }
  } catch (error) {
    console.error(`   ❌ Error cargando dispositivos: ${error.message}`);
  }

  // Test 4: WebSocket
  console.log('\n4️⃣  Verificando WebSocket...');
  try {
    const state = app.streamRenderer.connection.state;
    console.log(`   ✅ WebSocket: ${state || 'NO CONECTADO'}`);
  } catch (error) {
    console.error(`   ❌ Error verificando WebSocket: ${error.message}`);
  }

  // Test 5: Dispositivos suscritos
  console.log('\n5️⃣  Dispositivos suscritos a streaming...');
  try {
    const serials = app.streamRenderer.subscribedSerials;
    console.log(`   ✅ Suscritos: ${serials.size}`);
    if (serials.size > 0) {
      console.log('   Serials:');
      serials.forEach(serial => {
        console.log(`     - ${serial}`);
      });
    }
  } catch (error) {
    console.error(`   ❌ Error verificando suscripciones: ${error.message}`);
  }

  console.log('\n✅ Pruebas completadas');
}

async function testDevices() {
  console.log('📱 Obteniendo lista de dispositivos...\n');
  try {
    const devices = await csharpAPI.get('/devices');
    console.table(devices.map(d => ({
      Serial: d.serial,
      Nombre: d.name || 'Sin nombre',
      Modelo: d.model || 'Desconocido',
      Estado: d.state,
      Cuentas: d.accounts.length || 0
    })));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testFlowLogin() {
  console.log('🚀 Probando FlowLogin...\n');
  try {
    const status = await pythonAPI.post('/login-status', {
      deviceIds: 'all'
    });
    console.log('Estado de FlowLogin:');
    console.log(status);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Mostrar ayuda
function testHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  FUNCIONES DE PRUEBA DISPONIBLES                               ║
╚════════════════════════════════════════════════════════════════╝

testConnections()
  - Prueba todas las conexiones (C#, Python, WebSocket)
  - Carga dispositivos
  - Verifica estado de streaming

testDevices()
  - Obtiene lista de dispositivos
  - Muestra en tabla: Serial, Nombre, Modelo, Estado, Cuentas

testFlowLogin()
  - Obtiene estado de FlowLogin
  - Muestra progreso de cuentas

testHelp()
  - Muestra esta ayuda

Ejemplos:
  testConnections()
  testDevices()
  testFlowLogin()
  `);
}

// Mostrar ayuda al cargar
console.log('%c✅ Script de pruebas cargado', 'color: green; font-weight: bold');
console.log('%cEscribe: testHelp() para ver funciones disponibles', 'color: cyan');
