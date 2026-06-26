import sys

def modify_file():
    with open(r'C:\DASHBOARD\FlowDashboard\electron-app\src\renderer\app.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Añadir fetchWithTimeout
    target1 = "// ─── Persistencia local mejorada ─────────────────────────────────────────────\nconst LocalStorage = {"
    replacement1 = """// ─── Utility functions ───────────────────────────────────────────────────────
const fetchWithTimeout = async (url, options = {}, timeoutMs = 4000) => {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
};

// ─── Persistencia local mejorada ─────────────────────────────────────────────
const LocalStorage = {"""
    content = content.replace(target1, replacement1)

    # 2. Reemplazar fetch sin timeout por fetchWithTimeout
    content = content.replace("await fetch(`${PYTHON_API}/devices`);", "await fetchWithTimeout(`${PYTHON_API}/devices`, {}, 4000);")
    content = content.replace("await fetch(`${PYTHON_API}/device-groups`);", "await fetchWithTimeout(`${PYTHON_API}/device-groups`, {}, 4000);")
    content = content.replace("await fetch(`${PYTHON_API}/login-status`, {", "await fetchWithTimeout(`${PYTHON_API}/login-status`, {")
    content = content.replace("await fetch(`${CSHARP_API}/devices`);", "await fetchWithTimeout(`${CSHARP_API}/devices`, {}, 4000);")

    # 3. Mover renderizado en loadDevices
    target2 = """      this.devices = mergedDevices;
      await this.loadDeviceNames();
      await this.loadDeviceAccounts();
      await this.loadDeviceGroups();
      await this.loadLoginStatuses();
      
      if (devicesChanged) {
        // Lista cambió — rerenderizar completo
        this.renderDevices();
      } else {
        // Lista igual — solo actualizar canvas sin destruir DOM
        if (this.livePreviewEnabled) {
          this.createCanvasesForVisibleDevices();
        }
      }"""
    replacement2 = """      this.devices = mergedDevices;
      
      if (devicesChanged) {
        // Lista cambió — rerenderizar completo
        this.renderDevices();
      } else {
        // Lista igual — solo actualizar canvas sin destruir DOM
        if (this.livePreviewEnabled) {
          this.createCanvasesForVisibleDevices();
        }
      }

      await this.loadDeviceNames();
      await this.loadDeviceAccounts();
      await this.loadDeviceGroups();
      await this.loadLoginStatuses();
      
      if (devicesChanged) {
        this.renderDevices();
      }"""
    content = content.replace(target2, replacement2)

    # 4. validateLicense
    target3 = """async function validateLicense(opts = {}) {
  const email = (document.getElementById('licenseEmail').value || '').trim();
  const key = (document.getElementById('licenseKeyInput').value || '').trim();"""
    replacement3 = """async function validateLicense(opts = {}) {
  const emailEl = document.getElementById('licenseEmail');
  const keyEl = document.getElementById('licenseKeyInput');
  const email = (emailEl ? emailEl.value : '').trim();
  const key = (keyEl ? keyEl.value : '').trim();"""
    content = content.replace(target3, replacement3)

    # 5. IIFE License check
    target4 = """  const saved = await loadSavedLicense();
  const savedEmail = saved && typeof saved === 'object' ? String(saved.email || '').trim() : '';
  const savedKey = saved && typeof saved === 'object'
    ? String(saved.key || saved.licenseKey || saved.license_key || '').trim()
    : '';"""
    replacement4 = """  const saved = await loadSavedLicense();
  const isSavedValid = saved !== null && typeof saved === 'object';
  const savedEmail = isSavedValid ? String(saved.email || '').trim() : '';
  const savedKey = isSavedValid
    ? String(saved.key || saved.licenseKey || saved.license_key || '').trim()
    : '';"""
    content = content.replace(target4, replacement4)

    with open(r'C:\DASHBOARD\FlowDashboard\electron-app\src\renderer\app.js', 'w', encoding='utf-8') as f:
        f.write(content)

modify_file()
