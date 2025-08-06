const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { startBridge, getStatus } = require("./src/api");

let mainWindow;

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

  ipcMain.handle("get-status", async () => getStatus());
  setInterval(() => {
    if (mainWindow) mainWindow.webContents.send("status-update", getStatus());
  }, 2000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
