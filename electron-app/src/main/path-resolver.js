const fs = require('fs');
const path = require('path');

const APPROVED_JSON_FILES = new Set([
  'device_names.json',
  'device_groups.json',
  'device_inventory.json',
  'device_mappings.json',
  'device_registrations.json',
  'license.json',
  'update_config.json'
]);

function firstExisting(paths) {
  return paths.find((candidate) => candidate && fs.existsSync(candidate)) || paths.find(Boolean) || '';
}

function findProjectRoot(startDir) {
  const envRoot = process.env.FLOWDASHBOARD_BASE_DIR;
  if (envRoot && fs.existsSync(envRoot)) return path.resolve(envRoot);

  let current = path.resolve(startDir);
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(current, 'local_adb_server.py')) && fs.existsSync(path.join(current, 'electron-app'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return path.resolve(startDir, '..', '..', '..');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function resolveFlowAgentApk(resourceRoot) {
  const commercialCandidates = [
    path.join(resourceRoot, 'android', 'flowagent', 'agent-v1.0.0-arm64-v8a.apk'),
    path.join(resourceRoot, 'flow_agent', 'agent-v1.0.0-arm64-v8a.apk')
  ];
  const commercialApk = commercialCandidates.find((candidate) => fs.existsSync(candidate));
  if (commercialApk) return commercialApk;

  const releaseDir = path.join(resourceRoot, 'flow_agent_monolito', 'app', 'build', 'outputs', 'apk', 'app', 'release');
  try {
    const releaseApks = fs.existsSync(releaseDir)
      ? fs.readdirSync(releaseDir)
        .filter((name) => /^agent-v.*-arm64-v8a\.apk$/i.test(name))
        .map((name) => path.join(releaseDir, name))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
      : [];
    if (releaseApks.length > 0) return releaseApks[0];
  } catch {}

  return firstExisting([
    ...commercialCandidates,
    path.join(resourceRoot, 'flow_agent_monolito', 'app', 'build', 'outputs', 'apk', 'app', 'release', 'agent-v1.0.0-arm64-v8a.apk'),
    path.join(resourceRoot, 'flow_agent_apk', 'build', 'flowagent-debug.apk')
  ]);
}

function resolveFlowTrackNameExe(resourceRoot) {
  return firstExisting([
    path.join(resourceRoot, 'Herramientas', 'FlowTrackName.exe'),
    path.join(resourceRoot, 'tools', 'FlowTrackName.exe')
  ]);
}

function createPathResolver(electronApp, options = {}) {
  const startDir = options.dirname || __dirname;
  const isPackaged = Boolean(electronApp.isPackaged);
  const projectRoot = isPackaged ? '' : findProjectRoot(startDir);
  const resourceRoot = path.resolve(process.env.FLOWDASHBOARD_RESOURCE_DIR || (isPackaged ? process.resourcesPath : projectRoot));
  const runtimeRoot = path.resolve(process.env.FLOWDASHBOARD_RUNTIME_DIR || (isPackaged ? path.join(resourceRoot, 'runtime') : path.join(projectRoot, 'build', 'runtime')));
  const userDataRoot = path.resolve(process.env.FLOWDASHBOARD_ELECTRON_USER_DATA || electronApp.getPath('userData'));
  const dataRoot = path.resolve(process.env.FLOWDASHBOARD_DATA_DIR || userDataRoot);
  const logsRoot = ensureDir(path.join(dataRoot, 'logs'));
  const recordingsRoot = ensureDir(path.join(dataRoot, 'recordings'));
  const scriptsRoot = path.resolve(isPackaged ? path.join(resourceRoot, 'scripts') : path.join(projectRoot, 'scripts'));
  const scrcpyRoot = path.resolve(path.join(resourceRoot, 'scrcpy-win64-v4.0'));
  const electronRoot = path.resolve(isPackaged ? resourceRoot : path.join(projectRoot, 'electron-app'));

  ensureDir(dataRoot);

  return {
    isPackaged,
    projectRoot,
    resourceRoot,
    runtimeRoot,
    userDataRoot,
    dataRoot,
    logsRoot,
    recordingsRoot,
    scriptsRoot,
    scrcpyRoot,
    electronRoot,
    flowAgentApk: resolveFlowAgentApk(resourceRoot),
    flowTrackNameExe: resolveFlowTrackNameExe(resourceRoot)
  };
}

function normalizeApprovedJsonFilename(filename) {
  const text = String(filename || '').trim();
  if (!text) throw new Error('filename requerido');
  if (path.isAbsolute(text)) throw new Error('rutas absolutas no permitidas');
  if (text.includes('..')) throw new Error('rutas relativas superiores no permitidas');
  if (text.includes('/') || text.includes('\\')) throw new Error('separadores de ruta no permitidos');
  if (path.extname(text).toLowerCase() !== '.json') throw new Error('solo se permiten archivos .json');
  if (!APPROVED_JSON_FILES.has(text)) throw new Error(`archivo no aprobado: ${text}`);
  return text;
}

function approvedJsonPath(dataRoot, filename) {
  return path.join(dataRoot, normalizeApprovedJsonFilename(filename));
}

function migrateApprovedDataFiles(projectRoot, dataRoot) {
  if (!projectRoot || path.resolve(projectRoot) === path.resolve(dataRoot)) return [];
  const migrated = [];
  for (const filename of APPROVED_JSON_FILES) {
    const source = path.join(projectRoot, filename);
    const target = path.join(dataRoot, filename);
    if (!fs.existsSync(source) || fs.existsSync(target)) continue;
    ensureDir(path.dirname(target));
    fs.copyFileSync(source, target);
    migrated.push(filename);
  }
  return migrated;
}

function readApprovedJson(dataRoot, filename) {
  const filePath = approvedJsonPath(dataRoot, filename);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function atomicWriteApprovedJson(dataRoot, filename, data) {
  const filePath = approvedJsonPath(dataRoot, filename);
  ensureDir(path.dirname(filePath));

  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const backupPath = `${filePath}.bak`;
  const fd = fs.openSync(tempPath, 'w');
  try {
    fs.writeFileSync(fd, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
  }
  fs.renameSync(tempPath, filePath);
}

module.exports = {
  APPROVED_JSON_FILES,
  atomicWriteApprovedJson,
  createPathResolver,
  migrateApprovedDataFiles,
  readApprovedJson
};
