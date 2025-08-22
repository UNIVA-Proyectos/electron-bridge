// Referencias a elementos del DOM
const statusDiv = document.getElementById("status");
const detailsDiv = document.getElementById("details");
const termTableBody = document.querySelector("#termTable tbody");
const connectionStatusEl = document.getElementById("connection-status");
const syncStatusEl = document.getElementById("sync-status");
const terminalCountEl = document.getElementById("terminal-count");
const syncBtn = document.getElementById("sync-btn");
const syncIncrementalBtn = document.getElementById("sync-incremental-btn");
const syncProgressDiv = document.getElementById("sync-progress");
const syncProgressContainer = document.getElementById(
  "sync-progress-container"
);

let syncInProgress = false;

// Actualiza la barra de estado como antes...
function updateStatusBar(status) {
  // ... (igual que en tu código original)
  const connectionDot = connectionStatusEl.querySelector(".status-dot");
  const connectionText = connectionStatusEl.querySelector("span:last-child");

  if (status.online) {
    connectionStatusEl.className = "status-item online";
    connectionDot.className = "status-dot online";
    connectionText.textContent = "Conexión Activa";
  } else {
    connectionStatusEl.className = "status-item offline";
    connectionDot.className = "status-dot offline";
    connectionText.textContent = "Sin Conexión";
  }

  const syncDot = syncStatusEl.querySelector(".status-dot");
  const syncText = syncStatusEl.querySelector("span:last-child");

  if (status.syncing) {
    syncStatusEl.className = "status-item warning";
    syncDot.className = "status-dot warning";
    syncText.textContent = "Sincronizando...";
  } else if (status.lastSync) {
    syncStatusEl.className = "status-item online";
    syncDot.className = "status-dot online";
    syncText.textContent = "Sincronización OK";
  } else {
    syncStatusEl.className = "status-item offline";
    syncDot.className = "status-dot offline";
    syncText.textContent = "Sin Sincronizar";
  }

  const activeTerminals = Array.isArray(status.terminals)
    ? status.terminals.filter((t) => t.connected).length
    : 0;
  const totalTerminals = Array.isArray(status.terminals)
    ? status.terminals.length
    : 0;

  terminalCountEl.innerHTML = `
    <span>Terminales: <strong>${activeTerminals}/${totalTerminals}</strong> activos</span>
  `;
}

function setStatus(status) {
  updateStatusBar(status);

  // ... resto igual que antes ...
  if (status.online) {
    statusDiv.innerHTML = '<div class="alert success">✅ Servicio Activo</div>';
  } else {
    statusDiv.innerHTML = '<div class="alert">❌ Servicio Detenido</div>';
  }

  let html = "";
  html += `<div class="card">
    <div style="padding: 1.5rem;">
      <h3>Información del Sistema</h3>
      <p><strong>Última sincronización:</strong> ${
        status.lastSync || "Nunca"
      }</p>`;

  if (status.polling) {
    html += '<div class="alert warning">📡 Leyendo terminales...</div>';
  }

  if (status.syncing) {
    html += '<div class="alert warning">🔄 Sincronizando con backend...</div>';
  }

  if (status.errors && status.errors.length > 0) {
    html += `<div class="alert">
      <strong>Errores del sistema:</strong>
      <pre style="margin-top: 0.5rem; padding: 1rem; background: rgba(220, 38, 38, 0.1); border-radius: 6px;">${status.errors.join(
        "\n"
      )}</pre>
    </div>`;
  }

  html += "</div></div>";
  detailsDiv.innerHTML = html;

  if (Array.isArray(status.terminals)) {
    termTableBody.innerHTML = status.terminals
      .map((t) => {
        const statusBadge = t.connected
          ? '<span class="status-badge online">En línea</span>'
          : '<span class="status-badge offline">Desconectado</span>';

        const errorDisplay = t.lastError
          ? `<span style="color: var(--error-color); font-size: 0.875rem;">${t.lastError}</span>`
          : '<span style="color: var(--success-color); font-size: 0.875rem;">Sin errores</span>';

        const lastActivity = t.lastReceived
          ? new Date(t.lastReceived).toLocaleString("es-ES", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-";

        return `
          <tr>
            <td><strong>${t.id}</strong></td>
            <td><code>${t.ip}</code></td>
            <td>${statusBadge}</td>
            <td style="text-align: right;">
              <span class="font-semibold">${
                t.lastRecordsCount || 0
              }</span> registros
            </td>
            <td class="text-sm">${lastActivity}</td>
            <td>${errorDisplay}</td>
          </tr>
        `;
      })
      .join("");
  } else {
    termTableBody.innerHTML =
      '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No hay terminales disponibles</td></tr>';
  }
}

// ------------- NUEVA LÓGICA DE BOTONES Y PROGRESO -------------

async function checkSyncStatus() {
  // Consulta el log de sincronización al backend (main process)
  const log = await window.bridgeApi.invoke("get-sync-log");
  if (log.fullSyncCompleted) {
    syncBtn.disabled = true;
    syncIncrementalBtn.disabled = false;
    syncBtn.innerHTML =
      '<span class="btn-icon">🔄</span>Sincronizar terminales (sólo una vez)';
    syncIncrementalBtn.innerHTML =
      '<span class="btn-icon">🆕</span>Buscar cambios';
  } else {
    syncBtn.disabled = false;
    syncIncrementalBtn.disabled = true;
    syncBtn.innerHTML =
      '<span class="btn-icon">🔄</span>Sincronizar terminales (sólo una vez)';
    syncIncrementalBtn.innerHTML =
      '<span class="btn-icon">🆕</span>Buscar cambios';
  }
  syncProgressDiv.innerHTML = "";
  syncProgressContainer.style.display = "none";
}

syncBtn.onclick = async () => {
  if (syncInProgress) return;
  syncInProgress = true;
  syncBtn.disabled = true;
  syncBtn.innerHTML = '<span class="btn-icon">⏳</span>Sincronizando...';
  syncProgressContainer.style.display = "block";
  syncProgressDiv.innerHTML = "Iniciando sincronización...";
  await window.bridgeApi.invoke("start-sync");
};

syncIncrementalBtn.onclick = async () => {
  if (syncInProgress) return;
  syncInProgress = true;
  syncIncrementalBtn.disabled = true;
  syncIncrementalBtn.innerHTML =
    '<span class="btn-icon">⏳</span>Buscando cambios...';
  syncProgressContainer.style.display = "block";
  syncProgressDiv.innerHTML = "Buscando y sincronizando cambios...";
  await window.bridgeApi.invoke("start-incremental-sync");
};

window.bridgeApi.on("sync-progress", (_event, progress) => {
  // Mostrar progreso por terminal y chunk
  const { totalChunks, terminals } = progress;
  let html = "<strong>Progreso de sincronización:</strong><br>";
  terminals.forEach((t) => {
    html += `<div>${t.id}: ${t.currentChunk}/${totalChunks} (${t.status})</div>`;
  });
  syncProgressDiv.innerHTML = html;
  syncProgressContainer.style.display = "block";
  if (terminals.every((t) => t.status === "complete")) {
    syncInProgress = false;
    syncBtn.innerHTML =
      '<span class="btn-icon">🔄</span>Sincronizar terminales (sólo una vez)';
    syncIncrementalBtn.innerHTML =
      '<span class="btn-icon">🆕</span>Buscar cambios';
    checkSyncStatus();
    setTimeout(() => {
      syncProgressContainer.style.display = "none";
      syncProgressDiv.innerHTML = "";
    }, 3000);
    showNotification("Sincronización completada", "success");
  }
});

function manualSync() {
  const button = document.querySelector('button[onclick="manualSync()"]');
  const originalText = button.innerHTML;
  button.innerHTML = '<span class="btn-icon">⏳</span> Sincronizando...';
  button.disabled = true;
  setTimeout(() => {
    button.innerHTML = originalText;
    button.disabled = false;
    showNotification("Sincronización iniciada correctamente", "success");
  }, 2000);
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `alert ${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    min-width: 300px;
    animation: slideIn 0.3s ease-out;
  `;
  notification.innerHTML = message;
  if (!document.getElementById("notification-styles")) {
    const styles = document.createElement("style");
    styles.id = "notification-styles";
    styles.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(styles);
  }
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease-in";
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// Inicialización
window.bridgeApi.getStatus().then(setStatus);
window.bridgeApi.onStatusUpdate(setStatus);
checkSyncStatus();
setInterval(() => {
  window.bridgeApi.getStatus().then(setStatus);
  checkSyncStatus();
}, 30000);
