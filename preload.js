const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('devsuite', {
  isDesktop: true,
  platform: process.platform,
  versions: { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node },
  httpStart: (opts) => ipcRenderer.invoke('http:start', opts),
  httpAbort: (id) => ipcRenderer.invoke('http:abort', id),
  onHttpEvent: (callback) => {
    const channels = [
      ['http:response', 'response'],
      ['http:chunk', 'chunk'],
      ['http:end', 'end'],
      ['http:error', 'error']
    ];
    const listeners = channels.map(([channel, type]) => {
      const listener = (_event, payload) => callback(Object.assign({ type }, payload));
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    });
    return () => listeners.forEach((off) => off());
  },
  dnsLookup: (host, type) => ipcRenderer.invoke('dns:lookup', { host, type }),
  systemInfo: () => ipcRenderer.invoke('system:info'),
  saveFile: (opts) => ipcRenderer.invoke('app:saveFile', opts),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  clipboardWrite: (text) => ipcRenderer.invoke('app:clipboardWrite', text),
  clipboardRead: () => ipcRenderer.invoke('app:clipboardRead'),
  showItem: (path) => ipcRenderer.invoke('app:showItem', path)
});
