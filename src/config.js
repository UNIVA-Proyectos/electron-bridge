module.exports = {
  TERMINALS: [
    { ip: "192.168.68.102", port: 4370, id: "f22-1" },
    //{ ip: "192.168.1.11", port: 4370, id: "f22-2" },
    //{ ip: "192.168.1.12", port: 4370, id: "f22-3" },
  ],
  backendBaseUrl: "http://localhost:3000/api",
  pollIntervalMs: 10000,
  syncIntervalMs: 30000,
  CHUNK_SIZE: 100,
};
