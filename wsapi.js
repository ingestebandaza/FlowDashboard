class Wsapi {
  constructor(options = {}) {
    const { onConnectSuccess, onConnectFail, onConnectClose } = options;

    this.CONNECT_IP = '127.0.0.1:8765';
    this.baseUrl = `http://${this.CONNECT_IP}`;
    this.loading = '';
    this.connected = false;
    this._queue = Promise.resolve();

    this.onConnectSuccess = deviceList =>
      onConnectSuccess && onConnectSuccess(deviceList);
    this.onConnectFail = error => onConnectFail && onConnectFail(error);
    this.onConnectClose = () => onConnectClose && onConnectClose();
  }

  _formatResult(resText = '') {
    return String(resText).replace(/\r\n/g, '\n').replace(/\\"/g, '"');
  }

  async _request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) {
      throw new Error(data.error || `Error HTTP ${response.status}`);
    }
    return data;
  }

  async _post(path, body = {}) {
    return await this._request(path, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async connectWs() {
    this.loading = 'Conectando...';

    try {
      const health = await this._request('/health');
      const features = Array.isArray(health.features) ? health.features : [];
      if (!features.includes('flowlogin_status')) {
        throw new Error('El servidor ADB local esta desactualizado. Cierra el servidor viejo o abre abrir_dashboard.bat para reiniciarlo.');
      }
      this.connected = true;
      this.loading = '';
      const deviceList = await this.getDeviceListAll();
      this.onConnectSuccess(deviceList);
    } catch (error) {
      this.connected = false;
      this.loading = '';
      this.onConnectFail(error);
    }
  }

  async getDeviceListAll() {
    const data = await this._request('/devices');
    return Array.isArray(data.devices) ? data.devices : [];
  }

  async sendWsApi(wsapiVal = '') {
    const run = async () => {
      if (!this.connected) {
        throw new Error('Servidor ADB local no conectado. No se pudo ejecutar la accion.');
      }

      this.loading = 'Ejecutando...';
      const payload = typeof wsapiVal === 'string' ? JSON.parse(wsapiVal) : wsapiVal;
      const action = String(payload.action || '').toLowerCase();
      const comm = payload.comm || {};

      let data;
      if (action === 'adb') {
        data = await this._post('/adb', comm);
      } else if (action === 'executeautojs') {
        data = await this._post('/autojs/run', comm);
      } else if (action === 'stopautojs') {
        data = await this._post('/autojs/stop', comm);
      } else {
        throw new Error(`Accion no soportada por el servidor local: ${payload.action}`);
      }

      const deviceList = Array.isArray(data.devices) ? data.devices : await this.getDeviceListAll();
      return [deviceList, this._formatResult(data.result || '')];
    };

    const queued = this._queue.then(run, run);
    this._queue = queued.catch(() => {});

    try {
      return await queued;
    } catch (error) {
      const message =
        error.message ||
        'No se pudo enviar la accion. Revisa el comando e intenta de nuevo.';
      throw new Error(message);
    } finally {
      this.loading = '';
    }
  }

  async sendAdbCommand(options = {}) {
    if (typeof options !== 'object') {
      throw new Error('Los parametros deben enviarse como objeto.');
    }

    const { command, deviceIds = 'all' } = options;
    if (!command || !command.trim()) {
      throw new Error('Escribe un comando ADB antes de enviarlo.');
    }

    return await this.sendWsApi(
      JSON.stringify({
        action: 'ADB',
        comm: {
          deviceIds,
          command: command.trim()
        }
      })
    );
  }

  async listPackages(options = {}) {
    const { deviceIds = 'all' } = options;
    const data = await this._post('/packages', { deviceIds });
    const deviceList = Array.isArray(data.devices) ? data.devices : await this.getDeviceListAll();
    return [deviceList, this._formatResult(data.result || '')];
  }

  async updateDeviceName(options = {}) {
    const { serial = '', name = '' } = options;
    if (!serial) {
      throw new Error('Falta el serial del dispositivo.');
    }

    const data = await this._post('/device-name', { serial, name });
    return Array.isArray(data.devices) ? data.devices : await this.getDeviceListAll();
  }

  async updateDevicePerson(options = {}) {
    const { serial = '', person = '' } = options;
    if (!serial) {
      throw new Error('Falta el serial del dispositivo.');
    }

    const data = await this._post('/device-person', { serial, person });
    return Array.isArray(data.devices) ? data.devices : await this.getDeviceListAll();
  }

  async refreshDevicePublicIp(options = {}) {
    const { serial = '' } = options;
    if (!serial) {
      throw new Error('Falta el serial del dispositivo.');
    }

    const data = await this._post('/device-public-ip', { serial });
    const deviceList = Array.isArray(data.devices) ? data.devices : await this.getDeviceListAll();
    return [deviceList, data.info || {}];
  }

  async executeAutoJs(options = {}) {
    if (typeof options !== 'object') {
      throw new Error('Los parametros deben enviarse como objeto.');
    }

    const { deviceIds = 'all', filePath = '', clone = null, clones = null, delimiter = ':' } = options;
    if (!filePath.trim()) {
      throw new Error('Escribe la ruta del script .js antes de ejecutar.');
    }

    const comm = {
      deviceIds,
      filePath: filePath.trim(),
      delimiter: String(delimiter || ':')
    };
    if (clone) {
      comm.clone = clone;
    }
    if (Array.isArray(clones) && clones.length) {
      comm.clones = clones;
    }

    return await this.sendWsApi(
      JSON.stringify({
        action: 'ExecuteAutoJs',
        comm
      })
    );
  }

  async refreshLoginStatus(options = {}) {
    const { deviceIds = 'all' } = options;
    const data = await this._post('/login-status', { deviceIds });
    const deviceList = Array.isArray(data.devices) ? data.devices : await this.getDeviceListAll();
    return [deviceList, this._formatResult(data.result || '')];
  }

  async getAgents() {
    const data = await this._request('/agents');
    return Array.isArray(data.agents) ? data.agents : [];
  }

  async setupFlowAgent(options = {}) {
    const {
      deviceIds = 'all',
      install = true,
      launch = true,
      openAccessibility = false
    } = options;
    const data = await this._post('/flowagent/setup', {
      deviceIds,
      install,
      launch,
      openAccessibility
    });
    const deviceList = Array.isArray(data.devices) ? data.devices : await this.getDeviceListAll();
    const agents = Array.isArray(data.agents) ? data.agents : [];
    return [deviceList, this._formatResult(data.result || ''), agents];
  }

  async sendAgentCommand(options = {}) {
    const { agentId = '', command = {}, timeout = 12 } = options;
    if (!agentId) {
      throw new Error('Falta agentId del agente APK.');
    }
    const data = await this._post('/agent/command', { agentId, command, timeout });
    return data.response || {};
  }

  async stopAutoJs(options = {}) {
    if (typeof options !== 'object') {
      throw new Error('Los parametros deben enviarse como objeto.');
    }

    const { deviceIds = 'all', filePath = '' } = options;
    if (!filePath.trim()) {
      throw new Error('Escribe la ruta del script .js antes de detener.');
    }

    return await this.sendWsApi(
      JSON.stringify({
        action: 'StopAutoJs',
        comm: {
          deviceIds,
          filePath: filePath.trim()
        }
      })
    );
  }

  async getDeviceMac(options = {}) {
    const { serial = '' } = options;
    if (!serial) {
      throw new Error('Falta el serial del dispositivo.');
    }
    const data = await this._post('/device-mac', { serial });
    return data.macAddress || '';
  }
}
