// Referencias a elementos del DOM
const statusDiv = document.getElementById("status");
const detailsDiv = document.getElementById("details");
const termTableBody = document.querySelector("#termTable tbody");
const connectionStatusEl = document.getElementById("connection-status");
const syncStatusEl = document.getElementById("sync-status");
const terminalCountEl = document.getElementById("terminal-count");

function updateStatusBar(status) {
  // Actualizar estado de conexión
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

  // Actualizar estado de sincronización
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

  // Actualizar contador de terminales
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
  // Actualizar barra de estado moderna
  updateStatusBar(status);

  // Mostrar información detallada en la sección de estado
  if (status.online) {
    statusDiv.innerHTML = '<div class="alert success">✅ Servicio Activo</div>';
  } else {
    statusDiv.innerHTML = '<div class="alert">❌ Servicio Detenido</div>';
  }

  // Detalles de sincronización y errores
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

  // Actualizar tabla de terminales con estilos modernos
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

// Función mejorada para sincronización manual
function manualSync() {
  const button = document.querySelector('button[onclick="manualSync()"]');
  const originalText = button.innerHTML;

  // Mostrar estado de carga
  button.innerHTML = '<span class="btn-icon">⏳</span> Sincronizando...';
  button.disabled = true;

  // Aquí deberías implementar la llamada real a la API
  // Por ahora simulo una llamada async
  setTimeout(() => {
    button.innerHTML = originalText;
    button.disabled = false;

    // Mostrar notificación temporal
    showNotification("Sincronización iniciada correctamente", "success");
  }, 2000);
}

// Función para mostrar notificaciones
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

  // Agregar estilos de animación si no existen
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

  // Remover automáticamente después de 4 segundos
  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease-in";
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// Inicialización
window.bridgeApi.getStatus().then(setStatus);
window.bridgeApi.onStatusUpdate(setStatus);

// Actualizar cada 30 segundos para mantener la información fresca
setInterval(() => {
  window.bridgeApi.getStatus().then(setStatus);
}, 30000);
