const fs = require('fs');
const path = 'C:/DASHBOARD/FlowDashboard/electron-app/src/renderer/styles.css';

const css = `
/* HOTFIX UI-FOCUS-01A */
.fp-nav.fp-block { border: none !important; background: transparent !important; box-shadow: none !important; padding: 0 !important; margin-bottom: 8px !important; }
.flowtouch-focus-technical-header { transform: scale(0.85); transform-origin: top center; margin-bottom: -4px; flex-wrap: wrap; justify-content: center; }
.flowtouch-log-panel { max-height: 140px !important; overflow-y: auto !important; }
.flowtouch-focus-title { gap: 8px !important; }
`;

fs.appendFileSync(path, css);
console.log('CSS appended.');
