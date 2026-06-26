const http = require('http');
const https = require('https');
const { autoUpdater } = require('electron-updater');

const GITHUB_OWNER = 'ingestebandaza';
const GITHUB_REPO = 'FlowDashboard';
const ACTIVE_STATES = new Set(['checking', 'available', 'downloading', 'downloaded', 'installing']);

function sanitizeError(error) {
  if (!error) return '';
  return String(error.message || error).replace(/\s+/g, ' ').slice(0, 500);
}

function requestJson(url, { method = 'GET', body = null, timeoutMs = 2500 } = {}) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const payload = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const req = client.request({
      method,
      hostname: parsed.hostname,
      port: parsed.port,
      path: `${parsed.pathname}${parsed.search}`,
      timeout: timeoutMs,
      headers: payload ? {
        'content-type': 'application/json',
        'content-length': payload.length
      } : undefined
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = null;
        }
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, json, text });
      });
    });
    req.on('error', (error) => resolve({ ok: false, error: sanitizeError(error) }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

class UpdateManager {
  constructor({ app, paths, getMainWindow, getRuntimeManager, logger = console }) {
    this.app = app;
    this.paths = paths;
    this.getMainWindow = getMainWindow;
    this.getRuntimeManager = getRuntimeManager;
    this.logger = logger;
    this.autoCheckStarted = false;
    this.status = {
      state: 'idle',
      currentVersion: app.getVersion(),
      latestVersion: '',
      progress: 0,
      message: '',
      notes: '',
      channel: this.getChannel(),
      canInstall: false,
      error: '',
      updateInfo: null,
      downloadedAt: null,
      provider: {
        type: 'github',
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO
      },
      disabledReason: ''
    };
    this.configureUpdater();
    this.bindEvents();
  }

  getChannel() {
    const raw = String(process.env.FLOWDASHBOARD_UPDATE_CHANNEL || '').trim().toLowerCase();
    return raw === 'beta' ? 'beta' : 'stable';
  }

  configureUpdater() {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.autoRunAppAfterInstall = true;
    autoUpdater.allowPrerelease = this.status.channel === 'beta';
    autoUpdater.fullChangelog = true;
    autoUpdater.logger = {
      info: (message) => this.logger.log(`[updates] ${message}`),
      warn: (message) => this.logger.warn(`[updates] ${message}`),
      error: (message) => this.logger.error(`[updates] ${message}`)
    };
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      private: false,
      releaseType: 'release'
    });
  }

  bindEvents() {
    autoUpdater.on('checking-for-update', () => {
      this.setStatus({ state: 'checking', progress: 0, message: 'Buscando actualizaciones...', error: '' });
    });
    autoUpdater.on('update-available', (info) => {
      this.setStatus({
        state: 'available',
        latestVersion: info.version || '',
        progress: 0,
        message: `Version ${info.version || 'nueva'} disponible. Descargando...`,
        notes: this.formatNotes(info.releaseNotes),
        updateInfo: this.sanitizeInfo(info),
        error: ''
      });
    });
    autoUpdater.on('download-progress', (progress) => {
      this.setStatus({
        state: 'downloading',
        progress: Math.max(0, Math.min(100, Number(progress.percent || 0))),
        message: 'Descargando actualizacion...'
      });
    });
    autoUpdater.on('update-downloaded', (event) => {
      this.setStatus({
        state: 'downloaded',
        latestVersion: event.version || this.status.latestVersion,
        progress: 100,
        message: 'Actualizacion descargada.',
        notes: this.formatNotes(event.releaseNotes || this.status.notes),
        updateInfo: this.sanitizeInfo(event),
        canInstall: true,
        downloadedAt: new Date().toISOString()
      });
    });
    autoUpdater.on('update-not-available', (info) => {
      this.setStatus({
        state: 'idle',
        latestVersion: info?.version || '',
        progress: 0,
        message: 'FlowDashboard ya esta actualizado.',
        updateInfo: this.sanitizeInfo(info),
        canInstall: false,
        error: ''
      });
    });
    autoUpdater.on('error', (error) => {
      this.setStatus({
        state: 'error',
        progress: 0,
        message: 'No se pudo completar la consulta de actualizacion.',
        error: sanitizeError(error),
        canInstall: false
      });
    });
  }

  sanitizeInfo(info) {
    if (!info) return null;
    return {
      version: info.version || '',
      releaseDate: info.releaseDate || '',
      releaseName: info.releaseName || '',
      tag: info.tag || '',
      files: Array.isArray(info.files) ? info.files.map((file) => ({
        url: file.url || '',
        size: file.size || 0
      })) : []
    };
  }

  formatNotes(notes) {
    if (!notes) return '';
    if (Array.isArray(notes)) {
      return notes.map((item) => `${item.version || ''}\n${item.note || ''}`.trim()).filter(Boolean).join('\n\n');
    }
    return String(notes).slice(0, 5000);
  }

  canUseUpdater({ manual = false } = {}) {
    if (this.app.isPackaged || process.env.FLOWDASHBOARD_FORCE_UPDATE_CHECK === '1') {
      return true;
    }
    this.setStatus({
      state: 'idle',
      message: 'El actualizador Electron se ejecuta solo en build empaquetada.',
      error: '',
      disabledReason: 'not packaged'
    });
    return false;
  }

  setStatus(values) {
    this.status = {
      ...this.status,
      ...values,
      currentVersion: this.app.getVersion(),
      channel: this.getChannel()
    };
    this.broadcast();
    return this.getStatus();
  }

  getStatus() {
    return { ...this.status };
  }

  broadcast() {
    const win = this.getMainWindow?.();
    if (win && !win.isDestroyed()) {
      win.webContents.send('updates-status', this.getStatus());
    }
  }

  startAutoCheck(delayMs = 6000) {
    if (this.autoCheckStarted) return this.getStatus();
    this.autoCheckStarted = true;
    setTimeout(() => {
      if (!this.canUseUpdater()) return;
      this.checkForUpdates({ manual: false }).catch((error) => {
        this.logger.warn(`[updates] auto check failed: ${sanitizeError(error)}`);
      });
    }, delayMs);
    return this.getStatus();
  }

  async checkForUpdates({ manual = true } = {}) {
    if (!this.canUseUpdater({ manual })) return this.getStatus();
    if (ACTIVE_STATES.has(this.status.state) && this.status.state !== 'downloaded') {
      return this.getStatus();
    }
    this.setStatus({ state: 'checking', progress: 0, message: 'Buscando actualizaciones...', error: '' });
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      this.setStatus({
        state: 'error',
        message: 'No se pudo buscar actualizaciones.',
        error: sanitizeError(error)
      });
    }
    return this.getStatus();
  }

  deferDownloadedUpdate() {
    if (this.status.state !== 'downloaded') return this.getStatus();
    return this.setStatus({
      state: 'deferred',
      message: 'Actualizacion pospuesta.',
      canInstall: true
    });
  }

  async installDownloadedUpdate() {
    if (this.status.state !== 'downloaded' && this.status.state !== 'deferred') {
      return this.setStatus({
        state: 'error',
        message: 'No hay una actualizacion descargada para instalar.',
        error: 'update not downloaded'
      });
    }
    this.setStatus({ state: 'installing', message: 'Preparando instalacion...', progress: 100, error: '' });
    try {
      await this.prepareForInstall();
      autoUpdater.quitAndInstall(false, true);
    } catch (error) {
      this.setStatus({
        state: 'error',
        message: 'No se pudo preparar la instalacion.',
        error: sanitizeError(error)
      });
    }
    return this.getStatus();
  }

  async prepareForInstall() {
    const recordings = await requestJson('http://127.0.0.1:8765/recordings/active', { timeoutMs: 2500 });
    const activeRecordings = Array.isArray(recordings.json?.recordings)
      ? recordings.json.recordings.filter((record) => record && record.running !== false)
      : [];
    if (activeRecordings.length > 0) {
      const stopped = await requestJson('http://127.0.0.1:8765/recordings/stop-all', {
        method: 'POST',
        body: {},
        timeoutMs: 8000
      });
      if (!stopped.ok) {
        throw new Error(`No se pudieron detener grabaciones activas: ${stopped.error || stopped.statusCode}`);
      }
    }

    const runtimeManager = this.getRuntimeManager?.();
    if (runtimeManager) {
      await Promise.resolve(runtimeManager.prepareForUpdate());
    }
  }
}

module.exports = { UpdateManager };
