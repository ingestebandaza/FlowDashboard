(() => {
/**
 * License Persistence Manager
 * 
 * Guarda y carga automáticamente la licencia desde localStorage
 * para que no sea necesario ingresarla cada vez que se abre el dashboard
 */

console.log('[LicensePersistence] Inicializando gestor de persistencia de licencia...');

// Clave para almacenar la licencia en localStorage
const LICENSE_STORAGE_KEY = 'flowdashboard_license_email';
const LICENSE_DEVICE_MAC_KEY = 'flowdashboard_device_mac';

/**
 * Guardar licencia en localStorage
 */
function saveLicenseToStorage(email, deviceMac = null) {
  try {
    localStorage.setItem(LICENSE_STORAGE_KEY, email);
    if (deviceMac) {
      localStorage.setItem(LICENSE_DEVICE_MAC_KEY, deviceMac);
    }
    console.log('[LicensePersistence] Licencia guardada en localStorage:', email);
  } catch (error) {
    console.warn('[LicensePersistence] Error al guardar licencia:', error);
  }
}

/**
 * Cargar licencia desde localStorage
 */
function loadLicenseFromStorage() {
  try {
    const email = localStorage.getItem(LICENSE_STORAGE_KEY);
    const deviceMac = localStorage.getItem(LICENSE_DEVICE_MAC_KEY);
    
    if (email) {
      console.log('[LicensePersistence] Licencia cargada desde localStorage:', email);
      return { email, deviceMac };
    }
    return null;
  } catch (error) {
    console.warn('[LicensePersistence] Error al cargar licencia:', error);
    return null;
  }
}

/**
 * Limpiar licencia guardada
 */
function clearLicenseFromStorage() {
  try {
    localStorage.removeItem(LICENSE_STORAGE_KEY);
    localStorage.removeItem(LICENSE_DEVICE_MAC_KEY);
    console.log('[LicensePersistence] Licencia eliminada de localStorage');
  } catch (error) {
    console.warn('[LicensePersistence] Error al limpiar licencia:', error);
  }
}

/**
 * Inyectar licencia guardada en el campo de email
 */
function injectSavedLicense() {
  const license = loadLicenseFromStorage();
  
  if (!license || !license.email) {
    console.log('[LicensePersistence] No hay licencia guardada');
    return;
  }
  
  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectLicenseToField(license.email);
    });
  } else {
    injectLicenseToField(license.email);
  }
}

/**
 * Inyectar licencia en el campo de email
 */
function injectLicenseToField(email) {
  // Buscar campo de email (puede tener diferentes selectores)
  const emailInputs = [
    document.querySelector('input[type="email"]'),
    document.querySelector('input[name="email"]'),
    document.querySelector('input[placeholder*="email" i]'),
    document.querySelector('input[placeholder*="correo" i]'),
    document.querySelector('input[placeholder*="licencia" i]'),
    document.querySelector('#email'),
    document.querySelector('[data-email]')
  ];
  
  const emailInput = emailInputs.find(el => el !== null);
  
  if (emailInput) {
    emailInput.value = email;
    // Disparar evento de cambio para que se registre
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    emailInput.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('[LicensePersistence] Licencia inyectada en campo de email:', email);
  } else {
    console.warn('[LicensePersistence] No se encontró campo de email en el DOM');
  }
}

/**
 * Interceptar envío de formulario de licencia
 */
function interceptLicenseSubmission() {
  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupLicenseInterception);
  } else {
    setupLicenseInterception();
  }
}

function setupLicenseInterception() {
  // Buscar formularios o botones de envío de licencia
  const forms = document.querySelectorAll('form');
  
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      // Buscar campo de email en el formulario
      const emailInput = form.querySelector('input[type="email"]') || 
                        form.querySelector('input[name="email"]') ||
                        form.querySelector('input[placeholder*="email" i]');
      
      if (emailInput && emailInput.value) {
        saveLicenseToStorage(emailInput.value);
      }
    });
  });
  
  // Buscar botones de validación/login
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => {
    if (button.textContent.toLowerCase().includes('validar') ||
        button.textContent.toLowerCase().includes('login') ||
        button.textContent.toLowerCase().includes('conectar') ||
        button.textContent.toLowerCase().includes('verificar')) {
      
      button.addEventListener('click', () => {
        // Buscar campo de email cercano
        const emailInput = button.closest('form')?.querySelector('input[type="email"]') ||
                          button.closest('div')?.querySelector('input[type="email"]') ||
                          document.querySelector('input[type="email"]');
        
        if (emailInput && emailInput.value) {
          saveLicenseToStorage(emailInput.value);
        }
      });
    }
  });
  
  console.log('[LicensePersistence] Interceptores de licencia configurados');
}

/**
 * Monitorear cambios en localStorage para sincronizar entre pestañas
 */
function setupStorageSync() {
  window.addEventListener('storage', (e) => {
    if (e.key === LICENSE_STORAGE_KEY && e.newValue) {
      console.log('[LicensePersistence] Licencia sincronizada desde otra pestaña:', e.newValue);
      injectLicenseToField(e.newValue);
    }
  });
}

/**
 * Inicializar todo
 */
function initLicensePersistence() {
  console.log('[LicensePersistence] Inicializando...');
  
  // Cargar licencia guardada
  injectSavedLicense();
  
  // Interceptar envíos de formulario
  interceptLicenseSubmission();
  
  // Sincronizar entre pestañas
  setupStorageSync();
  
  console.log('[LicensePersistence] Inicialización completada');
}

// Inicializar cuando el script se carga
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLicensePersistence);
} else {
  initLicensePersistence();
}

// Exportar funciones para uso manual
window.LicensePersistence = {
  save: saveLicenseToStorage,
  load: loadLicenseFromStorage,
  clear: clearLicenseFromStorage,
  inject: injectLicenseToField
};
})();

console.log('[LicensePersistence] Módulo cargado. Uso: window.LicensePersistence.save(email), window.LicensePersistence.load(), window.LicensePersistence.clear()');
