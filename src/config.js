module.exports = {
  devices: [
    { ip: "192.168.1.10", port: 4370, id: "f22-1" },
    { ip: "192.168.1.11", port: 4370, id: "f22-2" },
    { ip: "192.168.1.12", port: 4370, id: "f22-3" },
  ],
  backendBaseUrl: "http://localhost:3000",
  pollIntervalMs: 15000,
  syncIntervalMs: 30000,
};
