const ZKLib = require("node-zklib");
const config = require("./config");

// Lee todos los logs nuevos de todas las terminales configuradas
async function pollDevices() {
  let allLogs = [];
  let deviceErrors = [];

  for (const dev of config.devices) {
    const zk = new ZKLib(dev.ip, dev.port, 10000, 4000);
    try {
      await zk.createSocket();
      // Lee los registros de asistencia (huella, tarjeta o PIN)
      const logs = await zk.getAttendances();
      if (logs.data && logs.data.length > 0) {
        allLogs = allLogs.concat(
          logs.data.map((e) => ({
            userId: e.userId,
            timestamp: e.timestamp ? e.timestamp : new Date().toISOString(),
            status: e.type,
            device: dev.id,
          }))
        );
      }
      await zk.disconnect();
    } catch (err) {
      deviceErrors.push(`Error ${dev.id} (${dev.ip}): ${err.message}`);
    }
  }
  return { logs: allLogs, errors: deviceErrors };
}

module.exports = { pollDevices };
