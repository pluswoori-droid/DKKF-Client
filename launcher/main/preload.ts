import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('dkkf', {
  call: async (method: string, args?: unknown) => {
    const r = await ipcRenderer.invoke('dkkf:call', method, args);
    if (!r.ok) throw Error(r.error);
    return r.data;
  },
  onEvent: (fn: (e: unknown) => void) => {
    const handler = (_event: unknown, data: unknown) => fn(data);
    ipcRenderer.on('dkkf:event', handler);
    return () => ipcRenderer.removeListener('dkkf:event', handler);
  },
});
