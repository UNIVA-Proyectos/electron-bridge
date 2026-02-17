const axios = require("axios");
const config = require("./config");
const { getPendingLogs, removeLogFile } = require("./offlineStorage");
const net = require("net");
const api = require("./api");

// --------- LOGS OFFLINE ---------
async function syncPendingLogs() {
  const logs = getPendingLogs();
  let errors = [];

  for (const log of logs) {
    try {
      // --- TRANSFORMACIÓN DE DATOS ---
      // Convertimos el formato de ZK (userId, status) al formato del Backend (alumno_id, es_entrada)
      const payload = {
        alumno_id: log.userId, // Mapeamos userId -> alumno_id
        es_entrada: true, // Valor por defecto
        timestamp: log.timestamp, // Enviamos la fecha original
      };

      // Lógica para determinar si es entrada o salida basado en el estado de la terminal
      // 0/4 = Entrada, 1/5 = Salida
      if (log.status !== undefined && log.status !== null) {
        const s = Number(log.status);
        if (s === 1 || s === 5) {
          payload.es_entrada = false;
        }
      }
      // -------------------------------

      await axios.post(
        `${config.backendBaseUrl}/bridge/access-logs`,
        payload,
        {},
      );
      removeLogFile(log._filename);
      console.log(`[SYNC] Log sincronizado correctamente: ${log.userId}`);
    } catch (e) {
      // Si el error es del servidor, mostramos detalle
      const msg =
        e.response && e.response.data
          ? JSON.stringify(e.response.data)
          : e.message;
      errors.push(`Sync log ${log._filename}: ${msg}`);
      console.error(`[SYNC ERROR] ${msg}`);
    }
  }
  return errors;
}

// --------- USUARIOS: SYNC TO TERMINALS ---------
// (El resto del archivo se mantiene igual, pero te lo incluyo para que esté completo si copias todo)

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

class SyncUsuariosTerm {
  constructor() {
    this.terminalStates = {};
    config.TERMINALS.forEach((t) => {
      this.terminalStates[t.id] = { currentChunk: 0, status: "pending" };
    });
  }

  async startSync(type, lastSync, onProgress) {
    let alumnos = [];
    try {
      alumnos =
        type === "full"
          ? await api.fetchAllUsers()
          : await api.fetchChangedUsers(lastSync);
      console.log("[SYNC] Usuarios obtenidos del backend (full):", alumnos);
    } catch (err) {
      throw new Error("Error al obtener usuarios del backend: " + err.message);
    }

    if (!alumnos || !Array.isArray(alumnos) || alumnos.length === 0) {
      // Nada que sincronizar, marcar como completo todo
      config.TERMINALS.forEach((t) => {
        this.terminalStates[t.id] = { currentChunk: 0, status: "complete" };
      });
      onProgress?.(this.getProgress());
      return;
    }

    this.chunks = chunkArray(alumnos, config.CHUNK_SIZE);
    this.totalChunks = this.chunks.length;
    config.TERMINALS.forEach((t) => {
      this.terminalStates[t.id] = { currentChunk: 0, status: "pending" };
      this.syncToTerminal(t, onProgress);
    });
    await this._waitUntilComplete(onProgress);
  }

  async _waitUntilComplete(onProgress) {
    while (
      Object.values(this.terminalStates).some((s) => s.status !== "complete")
    ) {
      onProgress?.(this.getProgress());
      await new Promise((r) => setTimeout(r, 300));
    }
    onProgress?.(this.getProgress());
  }

  getProgress() {
    return {
      totalChunks: this.totalChunks || 0,
      terminals: config.TERMINALS.map((t) => ({
        id: t.id,
        currentChunk: this.terminalStates[t.id].currentChunk,
        status: this.terminalStates[t.id].status,
      })),
    };
  }

  syncToTerminal(terminal, onProgress) {
    const state = this.terminalStates[terminal.id];
    if (state.currentChunk >= this.totalChunks) {
      state.status = "complete";
      return;
    }
    const chunk = this.chunks[state.currentChunk];
    this.sendChunk(terminal, chunk, state.currentChunk).then((success) => {
      if (success) {
        state.currentChunk += 1;
        this.syncToTerminal(terminal, onProgress);
      } else {
        setTimeout(() => this.syncToTerminal(terminal, onProgress), 2000);
      }
    });
  }

  sendChunk(terminal, chunk, chunkNumber) {
    return new Promise((resolve) => {
      const client = new net.Socket();
      let ackTimeout;
      client.connect(terminal.port, terminal.ip, () => {
        const msg = JSON.stringify({
          type: "SYNC_CHUNK",
          chunkNumber,
          totalChunks: this.totalChunks,
          data: chunk,
        });
        client.write(msg);
        ackTimeout = setTimeout(() => {
          client.destroy();
          resolve(false);
        }, 5000);
      });
      client.on("data", (data) => {
        clearTimeout(ackTimeout);
        try {
          const resp = JSON.parse(data.toString());
          if (resp.type === "ACK" && resp.chunkNumber === chunkNumber) {
            client.destroy();
            resolve(true);
          } else {
            client.destroy();
            resolve(false);
          }
        } catch {
          client.destroy();
          resolve(false);
        }
      });
      client.on("error", () => {
        clearTimeout(ackTimeout);
        client.destroy();
        resolve(false);
      });
      client.on("close", () => {});
    });
  }
}

module.exports = {
  syncPendingLogs,
  SyncUsuariosTerm,
};
