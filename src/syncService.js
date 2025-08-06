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

module.exports = { syncPendingLogs };
