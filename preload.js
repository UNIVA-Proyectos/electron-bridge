const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bridgeApi", {
  getStatus: () => ipcRenderer.invoke("get-status"),
  onStatusUpdate: (cb) =>
    ipcRenderer.on("status-update", (event, status) => cb(status)),
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(event, ...args)),
});
