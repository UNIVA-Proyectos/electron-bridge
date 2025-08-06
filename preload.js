const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bridgeApi", {
  getStatus: () => ipcRenderer.invoke("get-status"),
  onStatusUpdate: (cb) =>
    ipcRenderer.on("status-update", (event, status) => cb(status)),
});
