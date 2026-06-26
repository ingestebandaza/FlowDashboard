const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_RESTART_LIMIT = 3;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestJson(url, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = body ? JSON.parse(body) : null;
        } catch {}
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          statusCode: res.statusCode,
          json,
          body
        });
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error(`timeout ${timeoutMs}ms`));
    });
    req.on('error', (error) => {
      resolve({ ok: false, error: error.message });
    });
  });
}

function isPortOccupied(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (error) => {
      resolve(error && error.code === 'EADDRINUSE');
    });
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port, host);
  });
}

function firstExisting(candidates) {
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || '';
}

function redactEnv(env) {
  return {
    FLOWDASHBOARD_BASE_DIR: env.FLOWDASHBOARD_BASE_DIR,
    FLOWDASHBOARD_RESOURCE_DIR: env.FLOWDASHBOARD_RESOURCE_DIR,
    FLOWDASHBOARD_DATA_DIR: env.FLOWDASHBOARD_DATA_DIR,
    FLOWDASHBOARD_ADB: env.FLOWDASHBOARD_ADB,
    SCRCPY_PATH: env.SCRCPY_PATH,
    SCRCPY_SERVER_JAR: env.SCRCPY_SERVER_JAR,
    FLOWDASHBOARD_MAIL_HELPER_EXE: env.FLOWDASHBOARD_MAIL_HELPER_EXE || '',
    FLOWDASHBOARD_PRODUCT_MODE: env.FLOWDASHBOARD_PRODUCT_MODE || '',
    FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART: env.FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART || ''
  };
}

class RuntimeManager {
  constructor(paths, options = {}) {
    this.paths = paths;
    this.logger = options.logger || console;
    this.restartLimit = options.restartLimit || DEFAULT_RESTART_LIMIT;
    this.productMode = Boolean(paths.isPackaged) || isTruthy(process.env.FLOWDASHBOARD_PRODUCT_MODE);
    this.runtimeLogRoot = ensureDir(path.join(paths.logsRoot, 'runtime'));
    this.statusPath = path.join(this.runtimeLogRoot, 'runtime-status.json');
    this.shuttingDown = false;
    this.restartTimers = new Map();
    this.sidecars = {
      csharp: this.createSidecarState({
        key: 'csharp',
        name: 'FlowDashboard.Core',
        port: 5000,
        healthUrl: 'http://127.0.0.1:5000/api/health',
        waitSeconds: 35
      }),
      python: this.createSidecarState({
        key: 'python',
        name: 'FlowDashboard.Python',
        port: 8765,
        healthUrl: 'http://127.0.0.1:8765/health',
        waitSeconds: 30
      })
    };
    this.state = {
      startedAt: null,
      ready: false,
      productMode: this.productMode,
      env: {},
      resources: {},
      warnings: [],
      errors: []
    };
  }

  createSidecarState(base) {
    return {
      ...base,
      status: 'idle',
      pid: null,
      startedByRuntime: false,
      external: false,
      command: null,
      cwd: null,
      exitCode: null,
      exitSignal: null,
      lastError: '',
      lastHealth: null,
      restarts: 0,
      child: null,
      streams: []
    };
  }

  prepareProcessEnvironment() {
    const env = { ...process.env };
    env.FLOWDASHBOARD_BASE_DIR = env.FLOWDASHBOARD_BASE_DIR || this.paths.projectRoot || this.paths.resourceRoot;
    env.FLOWDASHBOARD_RESOURCE_DIR = env.FLOWDASHBOARD_RESOURCE_DIR || this.paths.resourceRoot;
    env.FLOWDASHBOARD_DATA_DIR = env.FLOWDASHBOARD_DATA_DIR || this.paths.dataRoot;
    env.FLOWDASHBOARD_ADB = env.FLOWDASHBOARD_ADB || path.join(this.paths.scrcpyRoot, 'adb.exe');
    env.SCRCPY_PATH = env.SCRCPY_PATH || path.join(this.paths.scrcpyRoot, 'scrcpy.exe');
    env.SCRCPY_SERVER_JAR = env.SCRCPY_SERVER_JAR || path.join(this.paths.scrcpyRoot, 'scrcpy-server.jar');
    const mailHelper = path.join(this.paths.runtimeRoot, 'python', 'FlowDashboard.MailHelper.exe');
    if (!env.FLOWDASHBOARD_MAIL_HELPER_EXE && fs.existsSync(mailHelper)) {
      env.FLOWDASHBOARD_MAIL_HELPER_EXE = mailHelper;
    }
    if (process.env.FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART !== undefined) {
      env.FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART = process.env.FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART;
    } else {
      env.FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART = '0';
    }
    if (this.productMode) {
      env.FLOWDASHBOARD_PRODUCT_MODE = '1';
    }
    if (!isTruthy(env.FLOWDASHBOARD_USE_SYSTEM_PROXY)) {
      delete env.HTTP_PROXY;
      delete env.HTTPS_PROXY;
      delete env.ALL_PROXY;
      delete env.http_proxy;
      delete env.https_proxy;
      delete env.all_proxy;
    }

    process.env.FLOWDASHBOARD_ADB = env.FLOWDASHBOARD_ADB;
    process.env.SCRCPY_PATH = env.SCRCPY_PATH;
    process.env.SCRCPY_SERVER_JAR = env.SCRCPY_SERVER_JAR;
    process.env.FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART = env.FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART;
    if (this.productMode) {
      process.env.FLOWDASHBOARD_PRODUCT_MODE = '1';
    }

    this.state.env = redactEnv(env);
    return env;
  }

  validateCoreResources(env) {
    const resources = {
      adb: { path: env.FLOWDASHBOARD_ADB, required: true, exists: fs.existsSync(env.FLOWDASHBOARD_ADB || '') },
      scrcpy: { path: env.SCRCPY_PATH, required: true, exists: fs.existsSync(env.SCRCPY_PATH || '') },
      scrcpyServer: { path: env.SCRCPY_SERVER_JAR, required: true, exists: fs.existsSync(env.SCRCPY_SERVER_JAR || '') },
      dataRoot: { path: this.paths.dataRoot, required: true, exists: fs.existsSync(this.paths.dataRoot || '') },
      logsRoot: { path: this.paths.logsRoot, required: true, exists: fs.existsSync(this.paths.logsRoot || '') }
    };

    for (const [key, item] of Object.entries(resources)) {
      if (item.required && !item.exists) {
        this.state.errors.push(`Falta recurso requerido ${key}: ${item.path}`);
      }
    }

    this.state.resources = resources;
    return resources;
  }

  resolveCSharpCommand() {
    const configured = process.env.FLOWDASHBOARD_CSHARP_EXE;
    const exe = firstExisting([
      configured,
      path.join(this.paths.runtimeRoot, 'dotnet', 'FlowDashboard.Core.exe'),
      path.join(this.paths.resourceRoot, 'runtime', 'dotnet', 'FlowDashboard.Core.exe'),
      this.paths.projectRoot ? path.join(this.paths.projectRoot, 'FlowDashboard.Core', 'bin', 'Release', 'net8.0', 'FlowDashboard.Core.exe') : '',
      this.paths.projectRoot ? path.join(this.paths.projectRoot, 'FlowDashboard.Core', 'bin', 'Debug', 'net8.0', 'FlowDashboard.Core.exe') : ''
    ]);
    if (exe) {
      return {
        command: exe,
        args: [],
        cwd: this.paths.projectRoot || this.paths.resourceRoot,
        label: exe
      };
    }

    const csproj = this.paths.projectRoot ? path.join(this.paths.projectRoot, 'FlowDashboard.Core', 'FlowDashboard.Core.csproj') : '';
    if (!this.productMode && csproj && fs.existsSync(csproj)) {
      return {
        command: 'dotnet',
        args: ['run', '--project', csproj],
        cwd: this.paths.projectRoot,
        label: `dotnet run --project ${csproj}`
      };
    }

    return null;
  }

  resolvePythonCommand() {
    const packaged = firstExisting([
      process.env.FLOWDASHBOARD_BACKEND_EXE,
      path.join(this.paths.runtimeRoot, 'python', 'FlowDashboard.Backend.exe'),
      path.join(this.paths.resourceRoot, 'runtime', 'python', 'FlowDashboard.Backend.exe')
    ]);
    if (packaged) {
      return {
        command: packaged,
        args: [],
        cwd: this.paths.resourceRoot,
        label: packaged
      };
    }

    const script = firstExisting([
      this.paths.projectRoot ? path.join(this.paths.projectRoot, 'local_adb_server.py') : '',
      path.join(this.paths.resourceRoot, 'local_adb_server.py')
    ]);
    if (!script) return null;

    const python = firstExisting([
      process.env.FLOWDASHBOARD_PYTHON,
      this.paths.projectRoot ? path.join(this.paths.projectRoot, '.venv', 'Scripts', 'python.exe') : '',
      this.paths.projectRoot ? path.join(this.paths.projectRoot, 'python', 'python.exe') : ''
    ]);
    if (python) {
      return {
        command: python,
        args: ['-u', script],
        cwd: this.paths.projectRoot || this.paths.resourceRoot,
        label: `${python} -u ${script}`
      };
    }

    if (!this.productMode) {
      return {
        command: 'python',
        args: ['-u', script],
        cwd: this.paths.projectRoot || this.paths.resourceRoot,
        label: `python -u ${script}`
      };
    }

    return null;
  }

  async start() {
    this.state.startedAt = new Date().toISOString();
    this.shuttingDown = false;
    const env = this.prepareProcessEnvironment();
    this.validateCoreResources(env);

    await this.ensureSidecar('csharp', env);
    await this.ensureSidecar('python', env);

    this.state.ready = ['csharp', 'python'].every((key) => {
      const sidecar = this.sidecars[key];
      return sidecar.status === 'running' || sidecar.status === 'external';
    });

    this.writeStatusSnapshot('start');
    return this.getStatus();
  }

  async ensureSidecar(key, env = this.prepareProcessEnvironment()) {
    const sidecar = this.sidecars[key];
    const currentHealth = await requestJson(sidecar.healthUrl, 2000);
    sidecar.lastHealth = currentHealth.ok ? currentHealth.json || currentHealth.body || 'ok' : null;
    if (currentHealth.ok) {
      sidecar.status = sidecar.startedByRuntime ? 'running' : 'external';
      sidecar.external = !sidecar.startedByRuntime;
      sidecar.lastError = '';
      return true;
    }

    if (await isPortOccupied(sidecar.port)) {
      sidecar.status = 'port-occupied';
      sidecar.external = true;
      sidecar.lastError = `Puerto ${sidecar.port} ocupado, pero ${sidecar.healthUrl} no responde correctamente`;
      this.state.warnings.push(`${sidecar.name}: ${sidecar.lastError}`);
      return false;
    }

    const autostartDisabled = env.FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART === '1';
    if (autostartDisabled) {
      sidecar.status = 'external';
      sidecar.external = true;
      sidecar.lastError = `Auto-arranque deshabilitado. Esperando que el host levante el proceso en puerto ${sidecar.port}.`;
      this.state.warnings.push(`${sidecar.name}: ${sidecar.lastError}`);
      
      const healthy = await this.waitForHealth(sidecar);
      if (healthy) {
        sidecar.status = 'external';
        sidecar.lastError = '';
        return true;
      }
      return false;
    }

    const command = key === 'csharp' ? this.resolveCSharpCommand() : this.resolvePythonCommand();
    if (!command) {
      sidecar.status = 'missing-runtime';
      sidecar.lastError = key === 'csharp'
        ? 'No se encontro runtime C# empaquetado ni fallback de desarrollo'
        : 'No se encontro runtime Python empaquetado ni fallback de desarrollo';
      this.state.errors.push(`${sidecar.name}: ${sidecar.lastError}`);
      return false;
    }

    return this.spawnSidecar(sidecar, command, env);
  }

  async spawnSidecar(sidecar, command, env) {
    const logPrefix = path.join(this.runtimeLogRoot, sidecar.key);
    const stdout = fs.createWriteStream(`${logPrefix}.out.log`, { flags: 'a' });
    const stderr = fs.createWriteStream(`${logPrefix}.err.log`, { flags: 'a' });
    const launchedAt = new Date().toISOString();
    stdout.write(`\n[${launchedAt}] starting ${command.label}\n`);
    stderr.write(`\n[${launchedAt}] starting ${command.label}\n`);

    sidecar.status = 'starting';
    sidecar.command = command.label;
    sidecar.cwd = command.cwd;
    sidecar.external = false;
    sidecar.startedByRuntime = true;
    sidecar.exitCode = null;
    sidecar.exitSignal = null;
    sidecar.lastError = '';
    sidecar.streams = [stdout, stderr];

    let child;
    try {
      child = spawn(command.command, command.args, {
        cwd: command.cwd,
        env,
        detached: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      if (child.stdout) {
        child.stdout.pipe(stdout);
        child.stdout.on('error', (err) => this.logger.warn(`[runtime] Error en stdout de ${sidecar.name}: ${err.message}`));
      }
      if (child.stderr) {
        child.stderr.pipe(stderr);
        child.stderr.on('error', (err) => this.logger.warn(`[runtime] Error en stderr de ${sidecar.name}: ${err.message}`));
      }
    } catch (error) {
      sidecar.status = 'failed';
      sidecar.lastError = error.message;
      this.state.errors.push(`${sidecar.name}: ${error.message}`);
      return false;
    }

    sidecar.child = child;
    sidecar.pid = child.pid;
    this.logger.log(`[runtime] ${sidecar.name} iniciado pid=${child.pid}`);

    child.once('error', (error) => {
      sidecar.status = 'failed';
      sidecar.lastError = error.message;
      this.state.errors.push(`${sidecar.name}: ${error.message}`);
    });

    child.once('exit', (code, signal) => {
      sidecar.exitCode = code;
      sidecar.exitSignal = signal;
      sidecar.pid = null;
      sidecar.child = null;
      for (const stream of sidecar.streams) {
        try { stream.end(); } catch {}
      }
      sidecar.streams = [];
      if (this.shuttingDown) {
        sidecar.status = 'stopped';
        return;
      }
      sidecar.status = 'exited';
      sidecar.lastError = `${sidecar.name} termino inesperadamente code=${code} signal=${signal || ''}`;
      this.scheduleRestart(sidecar.key);
    });

    const healthy = await this.waitForHealth(sidecar);
    if (healthy) {
      sidecar.status = 'running';
      sidecar.lastError = '';
      return true;
    }

    sidecar.status = 'starting-timeout';
    sidecar.lastError = `${sidecar.name} no respondio en ${sidecar.healthUrl}`;
    this.state.warnings.push(sidecar.lastError);
    return false;
  }

  async waitForHealth(sidecar) {
    const attempts = Math.max(1, sidecar.waitSeconds * 2);
    for (let i = 0; i < attempts; i += 1) {
      if (this.shuttingDown) return false;
      const health = await requestJson(sidecar.healthUrl, 2500);
      if (health.ok) {
        sidecar.lastHealth = health.json || health.body || 'ok';
        return true;
      }
      await sleep(500);
    }
    return false;
  }

  scheduleRestart(key) {
    const sidecar = this.sidecars[key];
    if (sidecar.restarts >= this.restartLimit) {
      sidecar.status = 'restart-limit';
      sidecar.lastError = `${sidecar.name} alcanzo el limite de reinicios (${this.restartLimit})`;
      this.state.errors.push(sidecar.lastError);
      return;
    }
    sidecar.restarts += 1;
    const delayMs = Math.min(30000, 2000 * (2 ** (sidecar.restarts - 1)));
    const timer = setTimeout(async () => {
      this.restartTimers.delete(key);
      if (this.shuttingDown) return;
      await this.ensureSidecar(key);
    }, delayMs);
    this.restartTimers.set(key, timer);
  }

  async refreshHealth() {
    for (const sidecar of Object.values(this.sidecars)) {
      const health = await requestJson(sidecar.healthUrl, 2000);
      sidecar.lastHealth = health.ok ? health.json || health.body || 'ok' : null;
      if (health.ok && sidecar.status !== 'running' && sidecar.status !== 'external') {
        sidecar.status = sidecar.startedByRuntime ? 'running' : 'external';
      }
      if (!health.ok && (sidecar.status === 'running' || sidecar.status === 'external')) {
        sidecar.status = sidecar.startedByRuntime ? 'unhealthy' : 'external-unhealthy';
        sidecar.lastError = health.error || `HTTP ${health.statusCode || 'sin respuesta'}`;
      }
    }
    this.state.ready = ['csharp', 'python'].every((key) => {
      const sidecar = this.sidecars[key];
      return sidecar.status === 'running' || sidecar.status === 'external';
    });
    this.writeStatusSnapshot('refreshHealth');
    return this.getStatus();
  }

  shutdown() {
    this.shuttingDown = true;
    this.state.ready = false;
    for (const timer of this.restartTimers.values()) {
      clearTimeout(timer);
    }
    this.restartTimers.clear();

    for (const sidecar of Object.values(this.sidecars)) {
      if (sidecar.child && sidecar.startedByRuntime) {
        try {
          sidecar.child.kill();
        } catch (error) {
          sidecar.lastError = error.message;
        }
      }
      if (!sidecar.child && sidecar.startedByRuntime && sidecar.status !== 'stopped') {
        sidecar.status = 'stopped';
      }
    }
    this.writeStatusSnapshot('shutdown');
  }

  prepareForUpdate() {
    this.shutdown();
    this.writeStatusSnapshot('prepareForUpdate');
    return this.getStatus();
  }

  writeStatusSnapshot(reason) {
    try {
      const snapshot = {
        capturedAt: new Date().toISOString(),
        reason,
        ...this.getStatus()
      };
      const tempPath = `${this.statusPath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
      fs.renameSync(tempPath, this.statusPath);
    } catch (error) {
      this.logger.warn(`[runtime] No se pudo escribir runtime-status.json: ${error.message}`);
    }
  }

  getStatus() {
    const sidecars = {};
    for (const [key, sidecar] of Object.entries(this.sidecars)) {
      sidecars[key] = {
        key,
        name: sidecar.name,
        port: sidecar.port,
        healthUrl: sidecar.healthUrl,
        status: sidecar.status,
        pid: sidecar.pid,
        startedByRuntime: sidecar.startedByRuntime,
        external: sidecar.external,
        command: sidecar.command,
        cwd: sidecar.cwd,
        exitCode: sidecar.exitCode,
        exitSignal: sidecar.exitSignal,
        lastError: sidecar.lastError,
        lastHealth: sidecar.lastHealth,
        restarts: sidecar.restarts
      };
    }
    return {
      startedAt: this.state.startedAt,
      ready: this.state.ready,
      productMode: this.productMode,
      env: this.state.env,
      paths: {
        isPackaged: this.paths.isPackaged,
        resourceRoot: this.paths.resourceRoot,
        runtimeRoot: this.paths.runtimeRoot,
        dataRoot: this.paths.dataRoot,
        logsRoot: this.paths.logsRoot
      },
      resources: this.state.resources,
      warnings: Array.from(new Set(this.state.warnings)),
      errors: Array.from(new Set(this.state.errors)),
      sidecars
    };
  }
}

module.exports = {
  RuntimeManager
};
