const fs = require("fs");
const path = require("path");
const axios = require("axios");
const config = require("./config");
const { pushUsersToDevice, removeUsersFromDevice } = require("./deviceManager");

const STATE_FILE = path.join(__dirname, ".bridge_state.json");

let state = {
  initialProvisionDone: false,
  lastProvisionAt: null,
  lastUserSyncAt: null, // fecha/hora ISO de la última sincronización exitosa (después de aplicar en terminales)
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, "utf8");
      const data = JSON.parse(raw);
      state = { ...state, ...data };
    }
  } catch (err) {
    console.error("[UserSync] No se pudo leer estado:", err.message);
  }
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    console.error("[UserSync] No se pudo guardar estado:", err.message);
  }
}

// Devuelve fecha (YYYY-MM-DD) desde un Date o ISO actual
function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

// Determina la fecha base de updated_since.
// Si no hay sincronización previa, usa un mínimo (ej. 1970-01-01) para traer todo.
function getUpdatedSinceDate() {
  if (!state.lastUserSyncAt) {
    return "1970-01-01";
  }
  // Usamos solo la parte de fecha:
  return state.lastUserSyncAt.slice(0, 10);
}

// Llama al backend para traer usuarios modificados desde la fecha base
async function fetchUpdatedUsers() {
  const since = getUpdatedSinceDate();
  const url = `${config.backendBaseUrl}/api/bridge/sync?updated_since=${since}`;
  console.log(`[UserSync] Consultando backend: ${url}`);
  const resp = await axios.get(url, { timeout: 60000 });
  if (!resp.data || !resp.data.success) {
    throw new Error("Respuesta inválida del backend al pedir usuarios");
  }
  return {
    since,
    usuarios: Array.isArray(resp.data.usuarios) ? resp.data.usuarios : [],
    count: resp.data.count || 0,
  };
}

// Separa usuarios según su estado (asumiendo que backend manda algo como estado: 'activo' | 'inactivo')
function classifyUsers(usuarios) {
  const activos = [];
  const inactivos = [];
  for (const u of usuarios) {
    if (u.estado && u.estado.toLowerCase() === "inactivo") {
      inactivos.push(u);
    } else {
      activos.push(u);
    }
  }
  return { activos, inactivos };
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

// Aplica usuarios (altas/actualizaciones) a un device
async function applyActivesToDevice(device, activos, batchSize = 100) {
  if (!activos.length) return;
  const batches = chunk(activos, batchSize);
  console.log(
    `[UserSync] Device ${device.id} -> ${activos.length} usuarios activos en ${batches.length} lotes`
  );
  for (let i = 0; i < batches.length; i++) {
    try {
      await pushUsersToDevice(device, batches[i]);
      console.log(
        `[UserSync] Device ${device.id} lote ${i + 1}/${batches.length} OK`
      );
    } catch (err) {
      console.error(
        `[UserSync] Error pushUsersToDevice device ${device.id} lote ${
          i + 1
        }: ${err.message}`
      );
      // Puedes decidir si continuar o abortar
    }
  }
}

// Aplica usuarios inactivos (borrado) a un device
async function applyInactivesToDevice(device, inactivos, batchSize = 100) {
  if (!inactivos.length) return;
  const batches = chunk(inactivos, batchSize);
  console.log(
    `[UserSync] Device ${device.id} -> ${inactivos.length} usuarios inactivos (eliminar) en ${batches.length} lotes`
  );
  for (let i = 0; i < batches.length; i++) {
    try {
      await removeUsersFromDevice(device, batches[i]);
      console.log(
        `[UserSync] Device ${device.id} eliminación lote ${i + 1}/${
          batches.length
        } OK`
      );
    } catch (err) {
      console.error(
        `[UserSync] Error removeUsersFromDevice device ${device.id} lote ${
          i + 1
        }: ${err.message}`
      );
    }
  }
}

// Aplica cambios a todos los dispositivos conectados
async function applyUsersToAllDevices(devices, activos, inactivos) {
  for (const device of devices) {
    if (!device.connected) {
      console.log(`[UserSync] Saltando device ${device.id}: no conectado`);
      continue;
    }
    await applyActivesToDevice(device, activos);
    await applyInactivesToDevice(device, inactivos);
  }
}

// Control de concurrencia
let syncing = false;

// Función pública: sincronización incremental
async function syncUsuariosIncremental(devices) {
  if (syncing) {
    console.log("[UserSync] syncUsuariosIncremental ya en curso, se omite.");
    return;
  }
  syncing = true;
  console.log("[UserSync] Iniciando sincronización incremental de usuarios...");
  try {
    const { usuarios, count, since } = await fetchUpdatedUsers();
    console.log(
      `[UserSync] Backend devolvió ${count} usuarios modificados desde ${since}`
    );
    if (!usuarios.length) {
      console.log("[UserSync] No hay cambios de usuarios para aplicar.");
      // Igual actualizamos la marca de tiempo para no repetir la misma ventana.
      state.lastUserSyncAt = new Date().toISOString();
      saveState();
      return;
    }
    const { activos, inactivos } = classifyUsers(usuarios);
    console.log(
      `[UserSync] Clasificación -> Activos: ${activos.length}, Inactivos: ${inactivos.length}`
    );
    await applyUsersToAllDevices(devices, activos, inactivos);
    // Solo si todo fue razonablemente bien actualizamos la marca de sincronización
    state.lastUserSyncAt = new Date().toISOString();
    saveState();
    console.log("[UserSync] Sincronización incremental completada.");
  } catch (err) {
    console.error(
      "[UserSync] Error en sincronización incremental:",
      err.message
    );
  } finally {
    syncing = false;
  }
}

// Función para forzar reset (opcional)
function resetUserSyncState() {
  state.lastUserSyncAt = null;
  saveState();
  console.log("[UserSync] Estado de sincronización de usuarios reseteado.");
}

// Inicializar al cargar el módulo
loadState();

module.exports = {
  syncUsuariosIncremental,
  resetUserSyncState,
  getUserSyncState: () => ({ ...state }),
};
