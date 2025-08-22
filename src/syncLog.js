const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const LOG_PATH = path.join(app.getPath("userData"), "sync-log.json");

function readSyncLog() {
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
  } catch {
    return {
      fullSyncCompleted: false,
      lastFullSyncDate: null,
      lastIncrementalSyncDate: null,
    };
  }
}

function writeSyncLog(data) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(data, null, 2));
}

module.exports = { readSyncLog, writeSyncLog, LOG_PATH };
