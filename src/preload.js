const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pomodoro', {
  getState: () => ipcRenderer.invoke('get-state'),
  start: () => ipcRenderer.invoke('start'),
  pause: () => ipcRenderer.invoke('pause'),
  reset: () => ipcRenderer.invoke('reset'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),
  quit: () => ipcRenderer.invoke('quit'),
  onState: (cb) => ipcRenderer.on('state-update', (_e, s) => cb(s)),
  onChime: (cb) => ipcRenderer.on('play-chime', () => cb()),
  onTick: (cb) => ipcRenderer.on('play-tick', () => cb()),
});
