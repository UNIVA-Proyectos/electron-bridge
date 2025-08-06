const fs = require("fs");
const path = require("path");

const LOGS_DIR = path.join(__dirname, "../offline_logs/");
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR);
}

// Guarda un registro nuevo (log = {id, userId, timestamp, status, device})
function saveLocalLog(log) {
  const fname = path.join(LOGS_DIR, `${Date.now()}_${log.userId}.json`);
  fs.writeFileSync(fname, JSON.stringify(log, null, 2), { encoding: "utf-8" });
}

// Devuelve todos los logs pendientes (array de objetos)
function getPendingLogs() {
  const files = fs.readdirSync(LOGS_DIR);
  return files.map((f) => {
    const content = fs.readFileSync(path.join(LOGS_DIR, f), "utf-8");
    return { ...JSON.parse(content), _filename: f };
  });
}

// Borra un log después de sincronizarse
function removeLogFile(filename) {
  fs.unlinkSync(path.join(LOGS_DIR, filename));
}

module.exports = { saveLocalLog, getPendingLogs, removeLogFile };
