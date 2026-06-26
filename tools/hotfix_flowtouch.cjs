const fs = require('fs');

const path = 'C:/DASHBOARD/FlowDashboard/electron-app/src/renderer/flow-touch.js';
let content = fs.readFileSync(path, 'utf8');

// Fix 1: Transports badge [object Object]
const badgeRegex = /const transports = device\?\.transports \|\| \['usb'\];\s*const preferred = device\?\.preferredTransport \|\| 'auto';\s*const transportsText = transports\.join\(' \+ '\)\.toUpperCase\(\);\s*const prefText = 'Pref: ' \+ preferred\.charAt\(0\)\.toUpperCase\(\) \+ preferred\.slice\(1\);/;

const badgeNew = `const transportsArray = Array.isArray(device?.transports) ? device.transports : [];
    const types = transportsArray.map(t => typeof t === 'string' ? t : t?.type).filter(Boolean);
    const transportsText = types.length > 0 ? types.join(' + ').toUpperCase() : 'OFFLINE';
    const badgeClass = types[0] || 'offline';
    
    const preferred = device?.preferredTransport || 'auto';
    const prefText = 'Pref: ' + preferred.charAt(0).toUpperCase() + preferred.slice(1);`;

content = content.replace(badgeRegex, badgeNew);

// In the HTML string, replace transports[0] with badgeClass
content = content.replace(/\$\{this\._escape\(transports\[0\]\)\}/g, '${this._escape(badgeClass)}');

// Fix 2: Remove empty block in CSS or HTML? The user mentioned "queda una tarjeta vacía en el lateral izquierdo".
// Wait, is there an empty block in the HTML?
// Let's check `_bindProPanelApps()`
const bindProPanelAppsRegex = /_bindProPanelApps\(\) \{[\s\S]*?\}\s*\/\*\*/;
const bindProPanelAppsNew = `_bindProPanelApps() {
    const blockHeader = this.overlay.querySelector('#fpAppsBlockHeader');
    if (blockHeader) {
      blockHeader.addEventListener('click', () => this._openAppsWindow());
    }
    const launchers = this.overlay.querySelectorAll('[data-fp-launcher]') || [];
    launchers.forEach(header => {
      const blockId = header.dataset.fpLauncher;
      header.addEventListener('click', () => {
         if (blockId === 'apps') this._openAppsWindow();
         else this._openSectionWindow(blockId);
      });
    });
  }

  /**`;
content = content.replace(bindProPanelAppsRegex, bindProPanelAppsNew);

fs.writeFileSync(path, content, 'utf8');
console.log('Hotfix applied successfully');
