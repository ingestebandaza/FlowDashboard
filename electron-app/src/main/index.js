const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const {
  atomicWriteApprovedJson,
  createPathResolver,
  migrateApprovedDataFiles,
  readApprovedJson
} = require('./path-resolver');
const { RuntimeManager } = require('./runtime-manager');
const { UpdateManager } = require('./update-manager');
const { createConsoleLog } = require('./log-manager');
const {
  saveEntitlementsCache,
  loadEntitlementsCache,
  clearEntitlementsCache
} = require('./entitlements-cache');

let mainWindow;
let runtimeManager;
let updateManager;
const embeddedWindows = new Map(); // windowHandle -> BrowserWindow

const configuredUserData = process.env.FLOWDASHBOARD_ELECTRON_USER_DATA;
if (configuredUserData) {
  app.setPath('userData', configuredUserData);
}

const paths = createPathResolver(app, { dirname: __dirname });
process.env.FLOWDASHBOARD_BASE_DIR = process.env.FLOWDASHBOARD_BASE_DIR || paths.projectRoot;
process.env.FLOWDASHBOARD_RESOURCE_DIR = process.env.FLOWDASHBOARD_RESOURCE_DIR || paths.resourceRoot;
process.env.FLOWDASHBOARD_DATA_DIR = process.env.FLOWDASHBOARD_DATA_DIR || paths.dataRoot;
process.env.FLOWDASHBOARD_ADB = process.env.FLOWDASHBOARD_ADB || path.join(paths.scrcpyRoot, 'adb.exe');
process.env.SCRCPY_PATH = process.env.SCRCPY_PATH || path.join(paths.scrcpyRoot, 'scrcpy.exe');
process.env.SCRCPY_SERVER_JAR = process.env.SCRCPY_SERVER_JAR || path.join(paths.scrcpyRoot, 'scrcpy-server.jar');

const migratedDataFiles = migrateApprovedDataFiles(paths.projectRoot, paths.dataRoot);
if (migratedDataFiles.length > 0) {
  console.log(`[paths] Migrados a dataRoot: ${migratedDataFiles.join(', ')}`);
}

const FLOWTRACKNAME_EXE = paths.flowTrackNameExe;
let flowTrackNameProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0b1220',
    frame: false, // Frameless window for custom titlebar
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', '..', 'preload', 'preload.js')
    },
    icon: path.join(paths.electronRoot, 'assets', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Capturar logs de la consola en un archivo
  const appLog = createConsoleLog(paths.logsRoot);

  mainWindow.webContents.on('console-message', (level, message, line, sourceId) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message} (${sourceId}:${line})\n`;
    appLog.write(logMessage);
    console.log(logMessage.trim());
  });
  
  // Log cuando la página se carga
  mainWindow.webContents.on('did-finish-load', () => {
    updateManager?.broadcast();
    updateManager?.startAutoCheck();
    console.log('✅ Página cargada en Electron');
    appLog.write(`[${new Date().toISOString()}] ✅ Página cargada en Electron\n`);
  });

  // Abrir DevTools automáticamente para diagnóstico
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Atajo F12 para abrir/cerrar DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
  });

  mainWindow.on('closed', () => {
    // Cleanup: cerrar todas las ventanas embebidas
    embeddedWindows.forEach((win, handle) => {
      try {
        if (win && !win.isDestroyed()) {
          win.close();
        }
      } catch (e) {
        console.error('Error cerrando ventana embebida:', e);
      }
    });
    embeddedWindows.clear();
    mainWindow = null;
  });
}

// NO iniciar servidor C# - asumimos que ya está corriendo
// function startCSharpServer() { ... }

async function startRuntimeManager() {
  runtimeManager = new RuntimeManager(paths, { logger: console });
  const status = await runtimeManager.start();
  if (!status.ready) {
    const details = [
      ...status.errors,
      ...status.warnings
    ].filter(Boolean).join('\n');
    console.warn(`[runtime] Inicio incompleto:\n${details || 'sin detalle'}`);
    dialog.showErrorBox(
      'FlowDashboard runtime incompleto',
      `Algunos servicios no quedaron listos. El dashboard abrira para diagnostico.\n\n${details || 'Revisa logs/runtime en dataRoot.'}`
    );
  }
  return status;
}

function startUpdateManager() {
  updateManager = new UpdateManager({
    app,
    paths,
    getMainWindow: () => mainWindow,
    getRuntimeManager: () => runtimeManager,
    logger: console
  });
  return updateManager;
}

app.whenReady().then(async () => {
  try {
    await startRuntimeManager();
  } catch (error) {
    console.error('[runtime] Error inicializando RuntimeManager:', error);
    dialog.showErrorBox(
      'FlowDashboard runtime',
      `No se pudo preparar el runtime local: ${error.message}`
    );
  }

  startUpdateManager();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  runtimeManager?.shutdown();

  // Cleanup ventanas embebidas
  embeddedWindows.forEach((win, handle) => {
    try {
      if (win && !win.isDestroyed()) {
        win.close();
      }
    } catch (e) {
      console.error('Error en cleanup:', e);
    }
  });
  embeddedWindows.clear();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  runtimeManager?.shutdown();
  
  // Cleanup ventanas embebidas
  embeddedWindows.forEach((win, handle) => {
    try {
      if (win && !win.isDestroyed()) {
        win.close();
      }
    } catch (e) {
      console.error('Error en before-quit:', e);
    }
  });
  embeddedWindows.clear();
});

// IPC Handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('close-window', () => {
  if (mainWindow) mainWindow.close();
});

// Streaming IPC Handlers
ipcMain.handle('embed-window', async (event, { windowHandle, containerId, width, height }) => {
  try {
    console.log(`Embebiendo ventana ${windowHandle} en contenedor ${containerId}`);
    
    // Por ahora, solo registramos la ventana
    // En una implementación completa, usaríamos Win32 API para embeber
    // Pero eso requiere ffi-napi que es complejo de compilar
    
    // Alternativa: Las ventanas de scrcpy ya están posicionadas correctamente
    // por el backend C#, así que solo necesitamos trackearlas
    
    return { success: true, message: 'Ventana registrada' };
  } catch (error) {
    console.error('Error embebiendo ventana:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('detach-window', async (event, { windowHandle }) => {
  try {
    console.log(`Desembebiendo ventana ${windowHandle}`);
    
    if (embeddedWindows.has(windowHandle)) {
      const win = embeddedWindows.get(windowHandle);
      if (win && !win.isDestroyed()) {
        win.close();
      }
      embeddedWindows.delete(windowHandle);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error desembebiendo ventana:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-window-handle', async (event, { processId }) => {
  try {
    // En Windows, podríamos usar Win32 API para obtener el handle
    // Por ahora, retornamos el processId como handle
    return { success: true, windowHandle: processId.toString() };
  } catch (error) {
    console.error('Error obteniendo window handle:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-main-window-handle', async () => {
  try {
    if (!mainWindow) return { success: false, error: 'mainWindow no disponible' };
    const buf = mainWindow.getNativeWindowHandle();
    if (!buf || buf.length === 0) {
      return { success: false, error: 'getNativeWindowHandle vacio' };
    }
    // En Windows, HWND ocupa el tamaño nativo del puntero (4 u 8 bytes), pero
    // el valor real cabe en 32 bits. Convertimos a Number para que viaje como
    // numero JSON y System.Text.Json del backend lo deserialice como long.
    let handleBig;
    if (buf.length >= 8) {
      handleBig = buf.readBigUInt64LE(0);
    } else {
      handleBig = BigInt(buf.readUInt32LE(0));
    }
    const handleNumber = Number(handleBig);
    return { success: true, handle: handleNumber, handleString: handleBig.toString() };
  } catch (error) {
    console.error('Error obteniendo HWND main:', error);
    return { success: false, error: error.message };
  }
});

// ─── Persistencia local de archivos ───────────────────────────────────────────
ipcMain.handle('read-json-file', async (event, filename) => {
  try {
    return { ok: true, data: readApprovedJson(paths.dataRoot, filename) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('write-json-file', async (event, filename, data) => {
  try {
    atomicWriteApprovedJson(paths.dataRoot, filename, data);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('get-data-dir', async () => paths.dataRoot);
ipcMain.handle('get-path-info', async () => ({ ...paths, migratedDataFiles }));

ipcMain.handle('entitlements-cache-save', async (event, payload) => {
  try {
    return saveEntitlementsCache(paths.dataRoot, payload || {});
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('entitlements-cache-load', async () => {
  try {
    return loadEntitlementsCache(paths.dataRoot);
  } catch (e) {
    return { ok: false, reason: 'exception', error: e.message };
  }
});

ipcMain.handle('entitlements-cache-clear', async () => {
  try {
    return clearEntitlementsCache(paths.dataRoot);
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle('runtime-status', async () => {
  if (!runtimeManager) return { ready: false, error: 'RuntimeManager no inicializado' };
  return runtimeManager.refreshHealth();
});
ipcMain.handle('runtime-prepare-for-update', async () => {
  if (!runtimeManager) return { ready: false, error: 'RuntimeManager no inicializado' };
  return runtimeManager.prepareForUpdate();
});

ipcMain.handle('updates-status', async () => {
  if (!updateManager) return { state: 'error', error: 'UpdateManager no inicializado' };
  return updateManager.getStatus();
});

ipcMain.handle('updates-check', async () => {
  if (!updateManager) return { state: 'error', error: 'UpdateManager no inicializado' };
  return updateManager.checkForUpdates({ manual: true });
});

ipcMain.handle('updates-install', async () => {
  if (!updateManager) return { state: 'error', error: 'UpdateManager no inicializado' };
  return updateManager.installDownloadedUpdate();
});

ipcMain.handle('updates-defer', async () => {
  if (!updateManager) return { state: 'error', error: 'UpdateManager no inicializado' };
  return updateManager.deferDownloadedUpdate();
});

ipcMain.handle('launch-flowtrackname', async () => {
  try {
    if (!fs.existsSync(FLOWTRACKNAME_EXE)) {
      return { ok: false, error: `No se encontro ${FLOWTRACKNAME_EXE}` };
    }

    if (flowTrackNameProcess && !flowTrackNameProcess.killed && flowTrackNameProcess.exitCode === null) {
      return { ok: true, alreadyRunning: true, pid: flowTrackNameProcess.pid, path: FLOWTRACKNAME_EXE };
    }

    flowTrackNameProcess = spawn(FLOWTRACKNAME_EXE, [], {
      cwd: path.dirname(FLOWTRACKNAME_EXE),
      detached: false,
      stdio: 'ignore',
      windowsHide: false,
    });

    const pid = flowTrackNameProcess.pid;
    flowTrackNameProcess.once('exit', (code) => {
      console.log(`FlowTrackName cerrado pid=${pid} code=${code}`);
      flowTrackNameProcess = null;
    });

    return { ok: true, pid, path: FLOWTRACKNAME_EXE };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('flowtrackname-status', async () => {
  const running = !!(flowTrackNameProcess && !flowTrackNameProcess.killed && flowTrackNameProcess.exitCode === null);
  return {
    ok: true,
    running,
    pid: running ? flowTrackNameProcess.pid : null,
    path: FLOWTRACKNAME_EXE,
    exists: fs.existsSync(FLOWTRACKNAME_EXE),
  };
});

ipcMain.handle('stop-flowtrackname', async () => {
  try {
    if (!flowTrackNameProcess || flowTrackNameProcess.killed || flowTrackNameProcess.exitCode !== null) {
      flowTrackNameProcess = null;
      return { ok: true, running: false };
    }
    const pid = flowTrackNameProcess.pid;
    flowTrackNameProcess.kill();
    flowTrackNameProcess = null;
    return { ok: true, running: false, pid };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ─── Shell Actions ────────────────────────────────────────────────────────
function resolveAllowedShellPath(filePath) {
  const target = path.resolve(String(filePath || ''));
  const allowedRoots = [
    paths.recordingsRoot,
    paths.logsRoot,
    paths.projectRoot ? path.join(paths.projectRoot, 'recordings') : ''
  ].filter(Boolean).map((root) => path.resolve(root));
  const allowed = allowedRoots.some((root) => target === root || target.startsWith(`${root}${path.sep}`));
  if (!allowed) {
    throw new Error('ruta no aprobada para abrir desde Electron');
  }
  return target;
}

ipcMain.handle('shell-open-path', async (event, filePath) => {
  try {
    const result = await shell.openPath(resolveAllowedShellPath(filePath));
    return { ok: true, error: result };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('shell-show-item-in-folder', (event, filePath) => {
  try {
    shell.showItemInFolder(resolveAllowedShellPath(filePath));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
