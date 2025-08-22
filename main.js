const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { startBridge, getStatus } = require("./src/api");
const { readSyncLog, writeSyncLog } = require("./src/syncLog");
const { SyncUsuariosTerm } = require("./src/syncService");

let mainWindow;
let syncService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 360,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.loadFile("app/index.html");
}

app.whenReady().then(() => {
  createWindow();
  startBridge();
  syncService = new SyncUsuariosTerm();

  ipcMain.handle("get-status", async () => getStatus());
  setInterval(() => {
    if (mainWindow) mainWindow.webContents.send("status-update", getStatus());
  }, 2000);

  // ----------- SYNC LOGIC -----------
  ipcMain.handle("get-sync-log", () => readSyncLog());

  ipcMain.handle("start-sync", async (event) => {
    try {
      await syncService.startSync("full", null, (progress) => {
        event.sender.send("sync-progress", progress);
      });
      const log = readSyncLog();
      writeSyncLog({
        ...log,
        fullSyncCompleted: true,
        lastFullSyncDate: new Date().toISOString(),
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("start-incremental-sync", async (event) => {
    try {
      const log = readSyncLog();
      const lastSync = log.lastIncrementalSyncDate || log.lastFullSyncDate;
      await syncService.startSync("incremental", lastSync, (progress) => {
        event.sender.send("sync-progress", progress);
      });
      writeSyncLog({
        ...log,
        lastIncrementalSyncDate: new Date().toISOString(),
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  // --------- END SYNC LOGIC ---------
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
