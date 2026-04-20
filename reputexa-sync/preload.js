'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reputexaSync', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (/** @type {Record<string, unknown>} */ patch) => ipcRenderer.invoke('config:set', patch),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  scanFolder: () => ipcRenderer.invoke('watcher:scan'),
  onLog: (/** @type {(line: string) => void} */ fn) => {
    ipcRenderer.on('log-line', (_e, line) => fn(line));
  },
});
