/**
 * Script de Debugging para el Botón Validar
 * 
 * Inyecta logging mejorado para diagnosticar problemas con la validación de licencia
 */

console.log('[DebugValidar] Cargando script de debugging...');

// Guardar la función original
const originalValidateLicense = window.validateLicense;

// Crear nueva función con logging
window.validateLicense = async function(options = {}) {
  console.log('[DebugValidar] validateLicense() llamada con opciones:', options);
  
  try {
    const email = document.getElementById('licenseDeviceEmail').value.trim();
    const key = document.getElementById('licenseKey').value.trim();
    const msgEl = document.getElementById('licenseMessage');
    const btnEl = document.getElementById('licenseSubmitBtn');
    
    console.log('[DebugValidar] Email:', email);
    console.log('[DebugValidar] Licencia:', key);
    console.log('[DebugValidar] Mensaje elemento:', msgEl);
    console.log('[DebugValidar] Botón elemento:', btnEl);
    
    if (!email || !key) {
      console.warn('[DebugValidar] Email o licencia vacíos');
      if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.style.background = '#ff5f72';
        msgEl.style.color = '#fff';
        msgEl.textContent = 'Por favor ingresa email y licencia';
      }
      return;
    }
    
    console.log('[DebugValidar] Enviando solicitud a /validate-license...');
    
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.textContent = 'Validando...';
    }
    
    const payload = {
      device_email: email,
      license_key: key,
      device_hostname: 'web-browser',
      device_serial: 'web-browser',
      device_os: navigator.platform || 'Unknown',
      ip_public: '0.0.0.0',
      country_code: 'US',
      device_hash: 'web-browser',
      windows_user: 'web-user',
      local_ip: '127.0.0.1',
      mac_address: '00:00:00:00:00:00',
      country_name: 'Unknown'
    };
    
    console.log('[DebugValidar] Payload:', payload);
    
    const response = await fetch('http://127.0.0.1:8765/validate-license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log('[DebugValidar] Response status:', response.status);
    console.log('[DebugValidar] Response ok:', response.ok);
    
    const data = await response.json();
    console.log('[DebugValidar] Response data:', data);
    
    if (msgEl) {
      msgEl.style.display = 'block';
    }
    
    if (data.error || data.status === 'error') {
      console.error('[DebugValidar] Error en respuesta:', data.error || data.message);
      if (msgEl) {
        msgEl.style.background = '#ff5f72';
        msgEl.style.color = '#fff';
        msgEl.textContent = `Error: ${data.error || data.message || 'No se pudo validar la licencia.'}`;
      }
    } else if (data.device_status === 'approved') {
      console.log('[DebugValidar] Dispositivo aprobado');
      
      // GUARDAR LICENCIA EN LOCALSTORAGE
      try {
        localStorage.setItem('flowdashboard.license', JSON.stringify({ email, key }));
        console.log('[DebugValidar] Licencia guardada en localStorage');
      } catch (e) {
        console.warn('[DebugValidar] Error al guardar licencia:', e);
      }
      
      if (msgEl) {
        msgEl.style.background = '#3ddc97';
        msgEl.style.color = '#000';
        msgEl.textContent = `✓ Dispositivo aprobado. ${data.message}`;
      }
      // Cerrar modal después de 900ms
      setTimeout(() => {
        const modal = document.getElementById('licenseLoginModal');
        if (modal) {
          modal.style.display = 'none';
        }
      }, 900);
    } else if (data.device_status === 'pending') {
      console.log('[DebugValidar] Dispositivo pendiente');
      if (msgEl) {
        msgEl.style.background = '#f7c948';
        msgEl.style.color = '#000';
        msgEl.textContent = `⏳ Pendiente de aprobación. ${data.message}`;
      }
    } else if (data.device_status === 'blocked') {
      console.error('[DebugValidar] Dispositivo bloqueado');
      if (msgEl) {
        msgEl.style.background = '#ff5f72';
        msgEl.style.color = '#fff';
        msgEl.textContent = `❌ Dispositivo bloqueado. ${data.message}`;
      }
    } else {
      console.warn('[DebugValidar] Estado desconocido:', data.device_status);
      if (msgEl) {
        msgEl.style.background = '#f7c948';
        msgEl.style.color = '#000';
        msgEl.textContent = `Estado: ${data.device_status}. ${data.message}`;
      }
    }
    
  } catch (error) {
    console.error('[DebugValidar] Error en validateLicense:', error);
    const msgEl = document.getElementById('licenseMessage');
    if (msgEl) {
      msgEl.style.display = 'block';
      msgEl.style.background = '#ff5f72';
      msgEl.style.color = '#fff';
      msgEl.textContent = `Error: ${error.message}`;
    }
  } finally {
    const btnEl = document.getElementById('licenseSubmitBtn');
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.textContent = 'Validar';
    }
  }
};

console.log('[DebugValidar] Script de debugging cargado correctamente');
console.log('[DebugValidar] Función validateLicense reemplazada con versión mejorada');
