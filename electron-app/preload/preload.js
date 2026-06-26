const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  
  // Streaming APIs
  embedWindow: (windowHandle, containerId, width, height) => 
    ipcRenderer.invoke('embed-window', { windowHandle, containerId, width, height }),
  detachWindow: (windowHandle) => 
    ipcRenderer.invoke('detach-window', { windowHandle }),
  getWindowHandle: (processId) => 
    ipcRenderer.invoke('get-window-handle', { processId }),
  getMainWindowHandle: () =>
    ipcRenderer.invoke('get-main-window-handle'),

  // Persistencia local de archivos JSON
  readJsonFile: (filename) => ipcRenderer.invoke('read-json-file', filename),
  writeJsonFile: (filename, data) => ipcRenderer.invoke('write-json-file', filename, data),
  getDataDir: () => ipcRenderer.invoke('get-data-dir'),
  getPathInfo: () => ipcRenderer.invoke('get-path-info'),
  getRuntimeStatus: () => ipcRenderer.invoke('runtime-status'),
  prepareRuntimeForUpdate: () => ipcRenderer.invoke('runtime-prepare-for-update'),
  getUpdateStatus: () => ipcRenderer.invoke('updates-status'),
  checkForUpdates: () => ipcRenderer.invoke('updates-check'),
  installDownloadedUpdate: () => ipcRenderer.invoke('updates-install'),
  deferDownloadedUpdate: () => ipcRenderer.invoke('updates-defer'),
  onUpdateStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('updates-status', listener);
    return () => ipcRenderer.removeListener('updates-status', listener);
  },
  launchFlowTrackName: () => ipcRenderer.invoke('launch-flowtrackname'),
  getFlowTrackNameStatus: () => ipcRenderer.invoke('flowtrackname-status'),
  stopFlowTrackName: () => ipcRenderer.invoke('stop-flowtrackname'),

  // Shell actions
  openPath: (path) => ipcRenderer.invoke('shell-open-path', path),
  showItemInFolder: (path) => ipcRenderer.invoke('shell-show-item-in-folder', path),
});
