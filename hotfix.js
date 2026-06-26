const fs = require('fs');
const path = 'C:\\DASHBOARD\\FlowDashboard\\electron-app\\src\\renderer\\app.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Agregar fetchWithTimeout al final antes de LocalStorage
content = content.replace(
  '// --- Persistencia local mejorada ---------------------------------------------\r\nconst LocalStorage = {',
  '// --- Utility functions -------------------------------------------------------\r\nconst fetchWithTimeout = async (url, options = {}, timeoutMs = 4000) => {\r\n  const ctrl = new AbortController();\r\n  const id = setTimeout(() => ctrl.abort(), timeoutMs);\r\n  try {\r\n    const res = await fetch(url, { ...options, signal: ctrl.signal });\r\n    return res;\r\n  } finally {\r\n    clearTimeout(id);\r\n  }\r\n};\r\n\r\n// --- Persistencia local mejorada ---------------------------------------------\r\nconst LocalStorage = {'
);

// 2. Modificar loadDeviceNames
content = content.replace(
  'const response = await fetch(${PYTHON_API}/devices);',
  'const response = await fetchWithTimeout(${PYTHON_API}/devices, {}, 4000);'
);

// Note: Reemplaza todos los fetch(${PYTHON_API}/devices) a fetchWithTimeout
content = content.replace(
  /const response = await fetch\(\\$\{PYTHON_API\}\/devices\\);/g,
  'const response = await fetchWithTimeout(${PYTHON_API}/devices, {}, 4000);'
);

// 3. Modificar loadDeviceGroups
content = content.replace(
  /const response = await fetch\(\\$\{PYTHON_API\}\/device-groups\\);/g,
  'const response = await fetchWithTimeout(${PYTHON_API}/device-groups, {}, 4000);'
);

// 4. Modificar loadLoginStatuses
content = content.replace(
  /const response = await fetch\(\\$\{PYTHON_API\}\/login-status\\, \{/g,
  'const response = await fetchWithTimeout(${PYTHON_API}/login-status, {'
);

// 5. En loadDevices, CSHARP fallback
content = content.replace(
  /const response = await fetch\(\\$\{CSHARP_API\}\/devices\\);/g,
  'const response = await fetchWithTimeout(${CSHARP_API}/devices, {}, 4000);'
);

// 6. En loadDevices, renderizado inmediato
content = content.replace(
  '      this.devices = mergedDevices;\r\n      await this.loadDeviceNames();\r\n      await this.loadDeviceAccounts();\r\n      await this.loadDeviceGroups();\r\n      await this.loadLoginStatuses();\r\n      \r\n      if (devicesChanged) {\r\n        // Lista cambió — rerenderizar completo\r\n        this.renderDevices();\r\n      } else {\r\n        // Lista igual — solo actualizar canvas sin destruir DOM\r\n        if (this.livePreviewEnabled) {\r\n          this.createCanvasesForVisibleDevices();\r\n        }\r\n      }',
  '      this.devices = mergedDevices;\r\n      \r\n      if (devicesChanged) {\r\n        this.renderDevices();\r\n      } else {\r\n        if (this.livePreviewEnabled) {\r\n          this.createCanvasesForVisibleDevices();\r\n        }\r\n      }\r\n\r\n      await this.loadDeviceNames();\r\n      await this.loadDeviceAccounts();\r\n      await this.loadDeviceGroups();\r\n      await this.loadLoginStatuses();\r\n      \r\n      if (devicesChanged) {\r\n        this.renderDevices();\r\n      }'
);

// 7. validateLicense - proteccion DOM
content = content.replace(
  /async function validateLicense\(opts = \{\}\) \{\r\n  const email = \(document\.getElementById\('licenseEmail'\)\.value \|\| ''\)\.trim\(\);\r\n  const key = \(document\.getElementById\('licenseKeyInput'\)\.value \|\| ''\)\.trim\(\);/g,
  'async function validateLicense(opts = {}) {\r\n  const emailEl = document.getElementById(\'licenseEmail\');\r\n  const keyEl = document.getElementById(\'licenseKeyInput\');\r\n  const email = (emailEl ? emailEl.value : \'\').trim();\r\n  const key = (keyEl ? keyEl.value : \'\').trim();'
);

// Guardar
fs.writeFileSync(path, content, 'utf8');
console.log("Reemplazos aplicados");
