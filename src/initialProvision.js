const fs = require("fs");
const path = require("path");
const axios = require("axios");
const config = require("./config");
const { pushUsersToDevice } = require("./deviceManager");
// Asegúrate de tener una función parecida en deviceManager
// que reciba (device, usersChunk) y haga la carga real a la terminal.

const STATE_FILE = path.join(__dirname, ".bridge_state.json");

let inMemoryState = {
  initialProvisionDone: false,
  lastProvisionAt: null,
};

// Carga estado persistido (si existe)
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, "utf8");
      const data = JSON.parse(raw);
      inMemoryState = { ...inMemoryState, ...data };
    }
  } catch (err) {
    console.error("No se pudo leer estado de provisionamiento:", err.message);
  }
}

// Guarda estado
function saveState() {
  try {
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify(inMemoryState, null, 2),
      "utf8"
    );
  } catch (err) {
    console.error(
      "No se pudo guardar estado de provisionamiento:",
      err.message
    );
  }
}

// Llama al backend para traer todos los alumnos.
// Si ya tienes un endpoint específico para todos, úsalo.
// Aquí asumo que /api/bridge/sync?updated_since=1970-01-01 devuelve todo.
async function fetchAllAlumnos() {
  const url = `${config.backendBaseUrl}/api/bridge/sync?updated_since=1970-01-01`;
  const resp = await axios.get(url, { timeout: 60000 });
  if (!resp.data || !resp.data.success) {
    throw new Error("Respuesta inválida del backend al pedir alumnos");
  }
  return resp.data.usuarios || [];
}

// Divide un array grande en trozos
function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

// Provisiona a un solo dispositivo en lotes
async function provisionDevice(device, allUsers, batchSize = 100) {
  const batches = chunk(allUsers, batchSize);
  console.log(
    `[Provision] Dispositivo ${device.id} - Total usuarios: ${allUsers.length} en ${batches.length} lotes`
  );
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      await pushUsersToDevice(device, batch);
      console.log(
        `[Provision] Device ${device.id} -> Lote ${i + 1}/${
          batches.length
        } OK (${batch.length} usuarios)`
      );
    } catch (err) {
      console.error(
        `[Provision] Error en device ${device.id} lote ${i + 1}: ${err.message}`
      );
      // Decide si quieres abortar o continuar
      // throw err;
    }
  }
}

// Provisiona todos los dispositivos conectados
async function provisionAllDevices(devices, users) {
  for (const device of devices) {
    if (!device.connected) {
      console.log(`[Provision] Saltando device ${device.id}: no conectado`);
      continue;
    }
    await provisionDevice(device, users, 100); // Ajusta batchSize
  }
}

// Función principal: se asegura de que si NO se ha hecho el primer provisionamiento, lo ejecute.
let running = false;
async function ensureInitialProvision(devices) {
  if (inMemoryState.initialProvisionDone) {
    return; // Ya hecho
  }
  if (running) {
    return; // Evita condiciones de carrera
  }
  running = true;
  console.log("[Provision] Iniciando primera carga de alumnos...");
  try {
    const users = await fetchAllAlumnos();
    console.log(`[Provision] Usuarios recibidos del backend: ${users.length}`);
    if (!users.length) {
      console.warn(
        "[Provision] No hay usuarios para provisionar (lista vacía)."
      );
    }
    await provisionAllDevices(devices, users);
    inMemoryState.initialProvisionDone = true;
    inMemoryState.lastProvisionAt = new Date().toISOString();
    saveState();
    console.log("[Provision] Primera carga completa.");
  } catch (err) {
    console.error("[Provision] Error en la primera carga:", err.message);
  } finally {
    running = false;
  }
}

// Inicializa (leer estado)
loadState();

module.exports = {
  ensureInitialProvision,
};
