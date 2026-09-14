const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  runPythonAnalysis: (params) => ipcRenderer.invoke('run-python-analysis', params),
  selectFile: (options) => ipcRenderer.invoke('select-file', options),
  getPlatformInfo: () => ipcRenderer.invoke('get-platform-info'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
