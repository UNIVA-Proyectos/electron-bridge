const ZKLib = require("node-zklib");
const config = require("./config");

// Pequeña pausa para no saturar la terminal con demasiados comandos consecutivos.
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Envuelve la conexión y desconexión a un dispositivo para reutilizar lógica.
 */
async function withDeviceConnection(device, fn) {
  const port = device.port || 4370;
  const zk = new ZKLib(device.ip, port, 10000, 4000);
  let connected = false;
  try {
    await zk.createSocket();
    connected = true;
    return await fn(zk);
  } finally {
    if (connected) {
      try {
        await zk.disconnect();
      } catch {
        // Ignora errores en disconnect
      }
    }
  }
}

/**
 * Mapea un usuario del backend a los campos usados por la terminal ZKTeco.
 * Ajusta según los datos reales que recibes del backend.
 */
function mapUserToZK(user) {
  // ZKTeco maneja:
  // uid: interno incremental (num) - clave con la que se almacena.
  // userid: string visible / identificador
  // name: nombre en pantalla (string corto)
  // password: puede ser '' si no lo usas
  // role: 0 = normal user, 14 = admin (depende del firmware)
  // Observación: Limita longitudes según el modelo (ej. name ~24 chars).
  const baseId = user.alumno_id || user.id || user.matricula;
  // Genera un UID numérico estable:
  let uidNumeric;
  if (typeof baseId === "number") {
    uidNumeric = baseId;
  } else if (/^\d+$/.test(String(baseId))) {
    uidNumeric = parseInt(baseId, 10);
  } else {
    // Hash simple para casos alfanuméricos
    uidNumeric =
      Array.from(String(baseId)).reduce((acc, c) => acc + c.charCodeAt(0), 0) %
      999999;
  }

  const userid = String(user.matricula || user.id || uidNumeric);
  const nombre = [
    user.nombre?.trim() || "",
    user.apellido_paterno?.trim() || "",
    user.apellido_materno?.trim() || "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 24);

  return {
    uid: uidNumeric,
    userid,
    name: nombre || userid,
    password: "", // Ajusta si usas PIN
    role: 0,
  };
}

/**
 * Crea o actualiza usuarios en la terminal.
 * users: array de objetos "usuario" provenientes del backend.
 */
async function pushUsersToDevice(device, users, options = {}) {
  const {
    batchDelayMs = 80,
    perUserDelayMs = 35,
    logProgress = true,
  } = options;

  if (!Array.isArray(users) || users.length === 0) return;

  return withDeviceConnection(device, async (zk) => {
    if (logProgress) {
      console.log(
        `[Device ${device.id}] Enviando ${users.length} usuarios (alta/actualización)`
      );
    }

    // Algunos modelos soportan disableDevice para evitar eventos durante la carga
    if (zk.disableDevice) {
      try {
        await zk.disableDevice();
      } catch {
        /* ignore */
      }
    }

    let ok = 0;
    let fail = 0;

    for (const user of users) {
      const mapped = mapUserToZK(user);
      try {
        // Revisa la firma exacta según tu versión de node-zklib:
        // Ejemplos comunes: zk.setUser(uid, userid, name, password, role)
        if (typeof zk.setUser === "function") {
          await zk.setUser(
            mapped.uid,
            mapped.userid,
            mapped.name,
            mapped.password,
            mapped.role
          );
        } else if (typeof zk.addUser === "function") {
          // Alternativa si la librería expone addUser
          await zk.addUser(
            mapped.uid,
            mapped.userid,
            mapped.name,
            mapped.password,
            mapped.role
          );
        } else {
          throw new Error(
            "No se encontró método setUser/addUser en la librería node-zklib"
          );
        }
        ok++;
      } catch (err) {
        fail++;
        console.error(
          `[Device ${device.id}] Error usuario ${mapped.userid}: ${err.message}`
        );
      }
      if (perUserDelayMs) {
        await sleep(perUserDelayMs);
      }
    }

    if (zk.enableDevice) {
      try {
        await zk.enableDevice();
      } catch {
        /* ignore */
      }
    }

    if (logProgress) {
      console.log(
        `[Device ${device.id}] Usuarios procesados: OK=${ok}, FAIL=${fail}`
      );
    }

    if (batchDelayMs) {
      await sleep(batchDelayMs);
    }

    return { ok, fail };
  });
}

/**
 * Elimina usuarios marcados como inactivos.
 * Se basa en su ID principal (alumno_id / id / matricula) usando el mismo mapUserToZK.
 */
async function removeUsersFromDevice(device, users, options = {}) {
  const { perUserDelayMs = 30, logProgress = true } = options;

  if (!Array.isArray(users) || users.length === 0) return;

  return withDeviceConnection(device, async (zk) => {
    if (logProgress) {
      console.log(
        `[Device ${device.id}] Eliminando ${users.length} usuarios (inactivos)`
      );
    }

    if (zk.disableDevice) {
      try {
        await zk.disableDevice();
      } catch {
        /* ignore */
      }
    }

    let ok = 0;
    let fail = 0;

    for (const user of users) {
      const mapped = mapUserToZK(user);
      try {
        // Verifica método correcto (removeUser / deleteUser) según tu versión
        if (typeof zk.removeUser === "function") {
          await zk.removeUser(mapped.uid);
        } else if (typeof zk.deleteUser === "function") {
          await zk.deleteUser(mapped.uid);
        } else {
          throw new Error(
            "No se encontró método removeUser/deleteUser en la librería node-zklib"
          );
        }
        ok++;
      } catch (err) {
        fail++;
        console.error(
          `[Device ${device.id}] Error eliminando ${mapped.userid}: ${err.message}`
        );
      }
      if (perUserDelayMs) {
        await sleep(perUserDelayMs);
      }
    }

    if (zk.enableDevice) {
      try {
        await zk.enableDevice();
      } catch {
        /* ignore */
      }
    }

    if (logProgress) {
      console.log(
        `[Device ${device.id}] Eliminación completada: OK=${ok}, FAIL=${fail}`
      );
    }

    return { ok, fail };
  });
}

/**
 * Lee todos los logs nuevos de todas las terminales configuradas.
 * Ahora retorna además deviceResults para integrar con UI/estado:
 * {
 *   logs: [...],
 *   deviceResults: [
 *     { id, ip, connected, recordsCount, error }
 *   ]
 * }
 */
async function pollDevices() {
  let allLogs = [];
  let deviceResults = [];

  for (const dev of config.devices) {
    const port = dev.port || 4370;
    const zk = new ZKLib(dev.ip, port, 10000, 4000);
    let connected = false;
    let recordsCount = 0;
    let error = null;

    try {
      await zk.createSocket();
      connected = true;

      // Obtiene asistencias
      const logs = await zk.getAttendances();
      if (logs && Array.isArray(logs.data) && logs.data.length > 0) {
        recordsCount = logs.data.length;
        allLogs = allLogs.concat(
          logs.data.map((e) => ({
            userId: e.userId,
            timestamp: e.timestamp ? e.timestamp : new Date().toISOString(),
            status: e.type,
            device: dev.id,
          }))
        );
      }

      // Si quieres limpiar logs luego de leerlos (opcional):
      // await zk.clearAttendanceLog();
    } catch (err) {
      error = err.message;
    } finally {
      if (connected) {
        try {
          await zk.disconnect();
        } catch {
          /* ignore */
        }
      }
    }

    deviceResults.push({
      id: dev.id,
      ip: dev.ip,
      connected,
      recordsCount,
      error,
    });
  }

  return { logs: allLogs, deviceResults };
}

module.exports = {
  pollDevices,
  pushUsersToDevice,
  removeUsersFromDevice,
};
