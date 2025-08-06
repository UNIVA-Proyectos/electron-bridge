const statusDiv = document.getElementById("status");
const detailsDiv = document.getElementById("details");
const termTableBody = document.querySelector("#termTable tbody");

function setStatus(status) {
  if (status.online) {
    statusDiv.innerHTML = '<span class="ok">Servicio Activo</span>';
  } else {
    statusDiv.innerHTML = '<span class="error">Servicio Detenido</span>';
  }

  let html = "";
  html += `<strong>Última sincronización:</strong> ${
    status.lastSync || "Nunca"
  }<br>`;
  if (status.polling)
    html += '<span class="warn">Leyendo terminales...</span><br>';
  if (status.syncing)
    html += '<span class="warn">Sincronizando con backend...</span><br>';
  if (status.errors && status.errors.length > 0) {
    html += `<strong>Errores generales:</strong><pre>${status.errors.join(
      "\n"
    )}</pre>`;
  }
  detailsDiv.innerHTML = html;

  // Tabla de terminales
  if (Array.isArray(status.terminals)) {
    termTableBody.innerHTML = status.terminals
      .map(
        (t) => `
      <tr>
        <td>${t.id}</td>
        <td>${t.ip}</td>
        <td style="font-weight:bold; color:${
          t.connected ? "#27ae60" : "#c0392b"
        }">
          ${t.connected ? "Conectada" : "Sin conexión"}
        </td>
        <td style="text-align:right">${t.lastRecordsCount || 0}</td>
        <td>${t.lastReceived || "-"}</td>
        <td style="color:${t.lastError ? "#c0392b" : "#27ae60"}">${
          t.lastError || "-"
        }</td>
      </tr>
    `
      )
      .join("");
  }
}

window.bridgeApi.getStatus().then(setStatus);
window.bridgeApi.onStatusUpdate(setStatus);

function manualSync() {
  alert("Forzar sincronización (a implementar manualSync)");
}
