import io

with io.open('c:/DASHBOARD/FlowDashboard/electron-app/src/renderer/app.js', 'r', encoding='utf-8') as f:
    text = f.read()

start_idx = text.find('  switchAccountTab(tab) {')
end_idx = text.find('  startPolling() {')

if start_idx != -1 and end_idx != -1:
    new_block = """  switchAccountTab(tab) {
    this.activeAccountTab = tab;
    // Mostrar/ocultar los textareas individuales de cada pestaña
    ['total','valid','invalid'].forEach(t => {
      const ta = document.getElementById(`accountsTextarea${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (ta) ta.classList.toggle('is-tab-hidden', t !== tab);
    });
    // Retrocompatibilidad: si existe el textarea antiguo también actualizarlo
    const taOld = document.getElementById('accountsTextarea');
    if (taOld) taOld.value = this.accounts[tab];
    // Update tab styles (ambas clases usadas en sidebar y popover)
    document.querySelectorAll('.account-tab, .account-tab-sidebar').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.tab === tab);
    });
  }

  onAccountsChange(tab) {
    // Puede recibir tab explícito (nuevos textareas individuales) o leer el activo
    const activeTab = tab || this.activeAccountTab;
    const idMap = { total: 'accountsTextareaTotal', valid: 'accountsTextareaValid', invalid: 'accountsTextareaInvalid' };
    const textarea = document.getElementById(idMap[activeTab]) || document.getElementById('accountsTextarea');
    if (textarea) {
      this.accounts[activeTab] = textarea.value;
      localStorage.setItem(`flowdashboard.accounts.${activeTab}`, textarea.value);
      this.updateAccountCounts();
    }
  }

  onDelimiterChange(value) {
    this.delimiter = value || ':';
    localStorage.setItem('flowdashboard.delimiter', this.delimiter);
  }

  onDivideCountChange(value) {
    this.divideCount = Math.min(10, Math.max(1, parseInt(value) || 10));
    document.getElementById('divideCount').value = this.divideCount;
  }

  updateAccountCounts() {
    const totalLines = this.accounts.total.split('\\n').filter(l => l.trim()).length;
    const validLines = this.accounts.valid.split('\\n').filter(l => l.trim()).length;
    const invalidLines = this.accounts.invalid.split('\\n').filter(l => l.trim()).length;

    const totalEl = document.getElementById('totalCount');
    const validEl = document.getElementById('validCount');
    const invalidEl = document.getElementById('invalidCount');

    if (totalEl) totalEl.textContent = totalLines;
    if (validEl) validEl.textContent = validLines;
    if (invalidEl) invalidEl.textContent = invalidLines;
  }

  async divideAccounts() {
    if (this.selectedDeviceIds.size === 0) {
      alert('Selecciona al menos un dispositivo');
      return;
    }

    const accounts = this.accounts.total
      .split('\\n')
      .map(l => l.trim())
      .filter(Boolean);

    if (accounts.length === 0) {
      alert('No hay cuentas en Total para dividir');
      return;
    }

    const countPerDevice = this.divideCount;

    if (countPerDevice < 1) {
      alert('Dividir debe ser al menos 1');
      return;
    }
    if (countPerDevice > 10) {
      alert('No se pueden asignar mas de 10 cuentas por dispositivo');
      return;
    }

    const devicesArray = Array.from(this.selectedDeviceIds);
    const totalNeeded = countPerDevice * devicesArray.length;
    if (accounts.length < totalNeeded) {
      alert(`No hay suficientes cuentas.\\nNecesitas ${totalNeeded} (${countPerDevice} x ${devicesArray.length} dispositivos) pero solo hay ${accounts.length}.`);
      return;
    }

    console.log(`Dividiendo: ${countPerDevice} cuentas x ${devicesArray.length} dispositivos`);

    try {
      let accountIndex = 0;
      const assignments = [];

      for (const serial of devicesArray) {
        const deviceAccounts = accounts.slice(accountIndex, accountIndex + countPerDevice);
        accountIndex += countPerDevice;

        const response = await fetch(`${PYTHON_API}/device-person`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serial,
            person: deviceAccounts.join('\\n')
          })
        });

        if (!response.ok) throw new Error(`Error asignando cuentas a ${serial}`);
        assignments.push({ serial, count: deviceAccounts.length, assignedAccounts: deviceAccounts });
        console.log(`${deviceAccounts.length} cuentas asignadas a ${serial}`);
      }

      // Consumir las cuentas asignadas
      const remainingAccounts = accounts.slice(accountIndex);
      this.accounts.total = remainingAccounts.join('\\n');
      localStorage.setItem('flowdashboard.accounts.total', this.accounts.total);
      
      const textareaTotal = document.getElementById('accountsTextareaTotal') || document.getElementById('accountsTextarea');
      if (textareaTotal) textareaTotal.value = this.accounts.total;
      
      this.updateAccountCounts();

      // Guardar en el historial
      let history = [];
      try { history = JSON.parse(localStorage.getItem('flowdashboard.accountsHistory') || '[]'); } catch(e){}
      
      assignments.forEach(a => {
        if (a.assignedAccounts) {
          a.assignedAccounts.forEach(acc => {
             history.unshift({
               account: acc.split(':')[0],
               fullAccount: acc,
               deviceSerial: a.serial,
               deviceName: this.deviceNames[a.serial] || a.serial,
               date: new Date().toISOString()
             });
          });
        }
      });
      if (history.length > 1000) history = history.slice(0, 1000);
      localStorage.setItem('flowdashboard.accountsHistory', JSON.stringify(history));

      await this.loadDevices();

      const summary = assignments.map(a => {
        const name = this.deviceNames[a.serial] || a.serial;
        return `${name}: ${a.count}/10`;
      }).join('\\n');
      alert(`Cuentas asignadas correctamente:\\n\\n${summary}`);
    } catch (error) {
      console.error('[ERROR] Error dividiendo cuentas:', error);
      alert(`Error dividiendo cuentas: ${error.message}`);
    }
  }

"""
    text = text[:start_idx] + new_block + text[end_idx:]
    with io.open('c:/DASHBOARD/FlowDashboard/electron-app/src/renderer/app.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("SUCCESSFULLY REPLACED")
else:
    print("COULD NOT FIND START/END MARKERS")
