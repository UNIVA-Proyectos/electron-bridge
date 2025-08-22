const config = require("./config");
const axios = require("axios");
const { pollDevices } = require("./deviceManager");
const { saveLocalLog } = require("./offlineStorage");
const { syncPendingLogs, SyncUsuariosTerm } = require("./syncService");

let userSyncInstance = null;
let status = {
  online: false,
  lastSync: null,
  errors: [],
  polling: false,
  syncing: false,
  terminals: config.TERMINALS.map((d) => ({
    id: d.id,
    ip: d.ip,
    connected: false,
    lastReceived: null,
    lastRecordsCount: 0,
    lastError: null,
  })),
};

function getStatus() {
  return { ...status, terminals: status.terminals.map((t) => ({ ...t })) };
}

function logError(err) {
  status.errors.push(err);
  if (status.errors.length > 10) status.errors.shift();
}

function startBridge() {
  status.online = true;
  if (!userSyncInstance) {
    userSyncInstance = new SyncUsuariosTerm();
  }

  setInterval(async () => {
    status.polling = true;
    try {
      const { logs, deviceResults } = await pollDevices();
      for (const res of deviceResults) {
        const idx = status.terminals.findIndex((t) => t.id === res.id);
        if (idx !== -1) {
          status.terminals[idx].connected = res.connected;
          status.terminals[idx].lastError = res.error || null;
          status.terminals[idx].lastRecordsCount = res.recordsCount || 0;
          if (res.recordsCount > 0) {
            status.terminals[idx].lastReceived = new Date().toLocaleString();
          }
        }
      }
      for (const log of logs) {
        saveLocalLog(log);
      }
      status.lastSync = new Date().toLocaleString();
    } catch (err) {
      logError("Polling: " + err.message);
    }
    status.polling = false;
  }, config.pollIntervalMs);

  setInterval(async () => {
    status.syncing = true;
    try {
      const syncErrors = await syncPendingLogs();
      if (syncErrors.length) {
        syncErrors.forEach(logError);
      }
    } catch (err) {
      logError("Sync: " + err.message);
    }
    status.syncing = false;
  }, config.syncIntervalMs);

  // Intervalo de sincronización incremental de usuarios
  // Ajusta el valor (ej. cada 10 minutos = 600000 ms, aquí 5 minutos como ejemplo)
  setInterval(async () => {
    try {
      const anyConnected = status.terminals.some((t) => t.connected);
      if (anyConnected) {
        await syncUsuariosIncremental(status.terminals);
      } else {
        console.log(
          "[UserSync] No hay dispositivos conectados, se pospone sincronización."
        );
      }
    } catch (err) {
      logError("UserSync: " + err.message);
    }
  }, 300000);
}

async function fetchAllUsers() {
  const { data } = await axios.post(`${config.backendBaseUrl}/bridge/sync/all`);
  console.log(
    "[SYNC] Usuarios obtenidos del backend:",
    data.usuarios || data.alumnos
  );
  return data.alumnos;
}

// Nueva: obtener solo los usuarios nuevos/modificados para sync incremental
async function fetchChangedUsers(lastSync) {
  const { data } = await axios.post(`${config.backendBaseUrl}/bridge/sync`, {
    lastSync,
  });
  return data.alumnos;
}

module.exports = { startBridge, getStatus, fetchAllUsers, fetchChangedUsers };
