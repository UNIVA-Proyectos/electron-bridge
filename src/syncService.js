const axios = require("axios");
const config = require("./config");
const { getPendingLogs, removeLogFile } = require("./offlineStorage");

async function syncPendingLogs() {
  const logs = getPendingLogs();
  let errors = [];
  for (const log of logs) {
    try {
      await axios.post(config.backendUrl, log, {
        headers: { Authorization: `Bearer ${config.backendApiKey}` },
      });
      removeLogFile(log._filename);
    } catch (e) {
      errors.push(`Sync log ${log._filename}: ${e.message}`);
    }
  }
  return errors;
}

// Helper para obtener fecha actual en formato YYYY-MM-DD
function getTodayIsoDate() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

async function syncUsuarios() {
  const today = getTodayIsoDate();
  const url = `http://localhost:3000/api/bridge/sync?updated_since=${today}`;
  try {
    const resp = await axios.get(url);
    console.log("Respuesta del backend:");
    console.log("success:", resp.data.success);
    console.log("count:", resp.data.count);
    console.log("Primeros usuarios:", resp.data.usuarios?.slice(0, 3));
  } catch (err) {
    console.error("Error al sincronizar usuarios:", err.message);
  }
}

module.exports = { syncPendingLogs, syncUsuarios };
