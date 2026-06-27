const fs = require('fs');
const path = require('path');

const SANITIZE_RULES = [
  { re: /eyJ[A-Za-z0-9_=-]{8,}\.[A-Za-z0-9_=-]{8,}\.[A-Za-z0-9_=-]{6,}/g, tag: '[JWT_REDACTED]' },
  { re: /gh[pousr]_[A-Za-z0-9]{20,}/g, tag: '[GH_TOKEN_REDACTED]' },
  { re: /github_pat_[A-Za-z0-9_]{20,}/g, tag: '[GH_PAT_REDACTED]' },
  { re: /CAP-[A-Z0-9]{16,}/g, tag: '[CAPSOLVER_REDACTED]' },
  { re: /postgres(?:ql)?:\/\/[^:/\s]+:[^@\s]{3,}@/gi, tag: 'postgresql://[REDACTED]@' },
  { re: /(?<=(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["']?)[^\s"']{6,}/gi, tag: '[REDACTED]' }
];

function sanitize(text) {
  if (text === null || text === undefined) { return ''; }
  let out = String(text);
  for (const rule of SANITIZE_RULES) {
    out = out.replace(rule.re, rule.tag);
  }
  return out;
}

function rotate(logPath, maxBytes, maxFiles) {
  try {
    if (!fs.existsSync(logPath)) { return; }
    const size = fs.statSync(logPath).size;
    if (size < maxBytes) { return; }
    const oldest = `${logPath}.${maxFiles}`;
    if (fs.existsSync(oldest)) { fs.unlinkSync(oldest); }
    for (let i = maxFiles - 1; i >= 1; i--) {
      const src = `${logPath}.${i}`;
      const dst = `${logPath}.${i + 1}`;
      if (fs.existsSync(src)) { fs.renameSync(src, dst); }
    }
    fs.renameSync(logPath, `${logPath}.1`);
  } catch (err) {
    console.error(`[log-manager] rotacion fallida: ${err.message}`);
  }
}

function createConsoleLog(logsRoot, options) {
  const opts = options || {};
  const baseName = opts.baseName || 'electron-console.log';
  const maxBytes = opts.maxBytes || 5 * 1024 * 1024;
  const maxFiles = opts.maxFiles || 5;
  const logPath = path.join(logsRoot, baseName);

  try { fs.mkdirSync(logsRoot, { recursive: true }); } catch (e) { void e; }
  rotate(logPath, maxBytes, maxFiles);

  let stream = fs.createWriteStream(logPath, { flags: 'a' });
  let written = 0;
  try { if (fs.existsSync(logPath)) { written = fs.statSync(logPath).size; } } catch (e) { void e; }

  function write(message) {
    const clean = sanitize(message);
    try {
      stream.write(clean);
      written += Buffer.byteLength(clean);
      if (written >= maxBytes) {
        stream.end();
        rotate(logPath, maxBytes, maxFiles);
        stream = fs.createWriteStream(logPath, { flags: 'a' });
        written = 0;
      }
    } catch (err) {
      console.error(`[log-manager] escritura fallida: ${err.message}`);
    }
  }

  return { write, path: logPath, sanitize };
}

module.exports = { createConsoleLog, sanitize };
