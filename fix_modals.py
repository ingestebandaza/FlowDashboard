import re

with open('c:/DASHBOARD/FlowDashboard/electron-app/src/renderer/app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Inject the button in FlowLogin content
old_btn = 'onclick="app.divideAccounts()" style="background:var(--accent);width:100%;">Dividir y Asignar</button>'
new_btn = old_btn + '\n                      <button class="btn-sidebar" onclick="app.openAccountsHistoryModal()" style="margin-top:6px;width:100%;background:rgba(20,184,166,0.1);color:var(--accent);border:1px solid rgba(20,184,166,0.3);">Historial de Cuentas</button>'

if old_btn in text:
    text = text.replace(old_btn, new_btn)
else:
    print('COULD NOT FIND DIVIDE BUTTON')

# 2. Inject modal functions around openPlansModal
old_plans = '  openPlansModal() {'
new_funcs = '''  openAccountsHistoryModal() {
    let modal = document.getElementById('accountsHistoryModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'dashboard-modal';
      modal.id = 'accountsHistoryModal';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; width: 90%;">
          <div class="modal-header">
            <h2 class="modal-title">Historial de Cuentas</h2>
            <button class="modal-close" onclick="app.closeAccountsHistoryModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <input type="text" id="accountsHistorySearch" placeholder="Buscar por correo, dispositivo, fecha..." style="flex:1; padding:8px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3); color:white; font-size:14px; margin-right:12px;" oninput="app.renderAccountsHistory()">
              <button class="btn-danger" onclick="app.clearAccountsHistory()" style="padding:8px 14px;">Limpiar</button>
            </div>
            <div id="accountsHistoryContainer" style="max-height: 400px; overflow-y:auto; border:1px solid rgba(255,255,255,0.05); border-radius:6px; background:rgba(0,0,0,0.2); padding:8px;">
              <!-- Lista dinámica -->
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    modal.classList.add('is-visible');
    this.renderAccountsHistory();
  }

  closeAccountsHistoryModal() {
    const modal = document.getElementById('accountsHistoryModal');
    if (modal) modal.classList.remove('is-visible');
  }

  renderAccountsHistory() {
    const container = document.getElementById('accountsHistoryContainer');
    const searchInput = document.getElementById('accountsHistorySearch');
    if (!container) return;

    let history = [];
    try { history = JSON.parse(localStorage.getItem('flowdashboard.accountsHistory') || '[]'); } catch(e){}

    const term = searchInput ? searchInput.value.toLowerCase() : '';
    if (term) {
      history = history.filter(h => 
        h.account.toLowerCase().includes(term) || 
        (h.deviceName && h.deviceName.toLowerCase().includes(term)) ||
        h.date.includes(term)
      );
    }

    if (history.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:rgba(255,255,255,0.5); font-size:13px;">No hay registros de asignación.</div>';
      return;
    }

    const html = history.map(h => {
      const d = new Date(h.date);
      const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid rgba(255,255,255,0.05);">
          <div>
            <div style="color:var(--accent); font-weight:600; font-size:14px; margin-bottom:4px;">${h.account}</div>
            <div style="color:rgba(255,255,255,0.5); font-size:12px;">Dispositivo: ${h.deviceName || h.deviceSerial}</div>
          </div>
          <div style="color:rgba(255,255,255,0.4); font-size:11px; text-align:right;">
            ${dateStr}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  clearAccountsHistory() {
    if (confirm('¿Estás seguro de limpiar todo el historial de cuentas asignadas?')) {
      localStorage.removeItem('flowdashboard.accountsHistory');
      this.renderAccountsHistory();
    }
  }

  openPlansModal() {'''

if old_plans in text:
    text = text.replace(old_plans, new_funcs)
else:
    print('COULD NOT FIND OPENPLANSMODAL')

with open('c:/DASHBOARD/FlowDashboard/electron-app/src/renderer/app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print('DONE MODALS')
