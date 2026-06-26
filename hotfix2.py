import sys
import re

def modify_file():
    path = r'C:\DASHBOARD\FlowDashboard\electron-app\src\renderer\app.js'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Quitar el return si no hay deviceSerial en validateLicense
    target1 = """    if (!deviceMac || !deviceSerial) {
      setMsg('Detectando dispositivo Android conectado...', 'info');
      const detected = await waitForFirstDeviceMac(8000);
      deviceMac    = deviceMac    || detected.mac;
      deviceSerial = deviceSerial || detected.serial;
    }
    if (!deviceSerial) {
      setMsg('Conecta al menos un dispositivo Android antes de validar.', 'warn');
      if (btn) { btn.disabled = false; btn.classList.remove('is-busy'); }
      return;
    }"""
    replacement1 = """    if (!deviceMac || !deviceSerial) {
      setMsg('Detectando dispositivo Android...', 'info');
      const detected = await waitForFirstDeviceMac(3000); // 3s en lugar de 8s para no demorar
      deviceMac    = deviceMac    || detected.mac;
      deviceSerial = deviceSerial || detected.serial;
    }
    
    if (!deviceSerial) {
      setMsg('Sin dispositivos Android detectados. Puedes validar la licencia y continuar.', 'info');
      // NO HACE RETURN: permite continuar con la validacion de la identidad del PC.
    } else {
      setMsg('Dispositivo detectado. Validando licencia...', 'info');
    }"""
    content = content.replace(target1, replacement1)

    # 2. Modificar la IIFE para que no exija el dispositivo y valide silenciosamente igual
    target2 = """  // Esperar device + MAC con timeout generoso (el usuario puede tardar en
  // arrancar Electron antes que sus telefonos).
  const detected = await waitForFirstDeviceMac(15000);
  if (!detected.serial) {
    // Sin dispositivo conectado: mostrar modal con aviso y dejar que el
    // usuario conecte y reintente manualmente.
    showLicenseModal();
    const msgEl = document.getElementById('licenseMsg');
    if (msgEl) {
      msgEl.hidden = false;
      msgEl.className = 'license-modal-msg is-warn';
      msgEl.textContent = 'Conecta al menos un dispositivo Android y pulsa Validar licencia.';
    }
    return;
  }"""
    replacement2 = """  // Esperar device + MAC con un timeout más corto para no demorar el inicio (ej. 3000ms en vez de 15s).
  // Si no hay, igual intenta validar silenciosamente con la MAC del PC.
  const detected = await waitForFirstDeviceMac(3000);
  if (!detected.serial) {
    console.warn('[License] No se detectó dispositivo Android, procediendo con la validación del PC.');
  }"""
    content = content.replace(target2, replacement2)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

modify_file()
print("Sustituciones realizadas")
