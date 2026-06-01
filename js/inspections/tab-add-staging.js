// inspections/tab-add-staging.js
// Staging subsystem for the Inspections "Add" tab

import { escapeHtml } from "../utilities.js";

/* =========================================================
   GLOBAL ACTIONS (window.* so inline buttons still work)
========================================================= */

/* ---------------------------------------------------------
   Auto-match ONE row
--------------------------------------------------------- */
window.autoMatchInspection = async function (id) {
  const project = window.portalState?.project;
  if (!project) {
    alert("No project selected.");
    return;
  }

  const rowEl = document.querySelector(`#row-${id}`);
  const actionCell = rowEl?.querySelector(".action-cell");
  const statusCell = rowEl?.querySelector(".status-cell");
  const errorCell = rowEl?.querySelector(".error-cell");

  if (actionCell) actionCell.innerHTML = `<span style="color:#555;">Matching...</span>`;

  let res, data = {};

  try {
    res = await fetch(
      `https://inspections-module.dennis-e64.workers.dev/staging/auto-match?id=${id}&project=${project}`,
      { method: "POST" }
    );
    data = await res.json();
  } catch (err) {
    console.error("Auto-match failed", err);
    if (errorCell) errorCell.textContent = "Auto-match error";
    if (statusCell) {
      statusCell.textContent = "error";
      statusCell.style.color = "red";
    }
    if (actionCell) {
      actionCell.innerHTML = `<button onclick="fixRow('${id}')">Fix Row</button>`;
    }
    return;
  }

  if (!res.ok) {
    if (errorCell) errorCell.textContent = data.error || "Auto-match error";
    if (statusCell) {
      statusCell.textContent = "error";
      statusCell.style.color = "red";
    }
    if (actionCell) {
      actionCell.innerHTML = `<button onclick="fixRow('${id}')">Fix Row</button>`;
    }
    return;
  }

  // If still uploaded → no match found
  if (data.status === "uploaded") {
    if (statusCell) {
      statusCell.textContent = "uploaded";
      statusCell.style.color = "orange";
    }
    if (errorCell) errorCell.textContent = "No contact match found";
    if (actionCell) {
      actionCell.innerHTML = `<button onclick="fixRow('${id}')">Fix Row</button>`;
    }
    return;
  }

  // Otherwise reload grid
  await loadStagingData();
};

/* ---------------------------------------------------------
   Auto-match ALL rows
--------------------------------------------------------- */
window.autoMatchAllInspections = async function () {
  const project = window.portalState?.project;
  if (!project) {
    alert("No project selected.");
    return;
  }

  if (!confirm("Run auto-match on ALL staging rows?")) return;

  const res = await fetch(
    `https://inspections-module.dennis-e64.workers.dev/staging/auto-match-all?project=${project}`,
    { method: "POST" }
  );

  const data = await res.json();

  alert(`Auto-match complete.
Matched: ${data.matched}
Ready: ${data.ready}
Unmatched: ${data.unmatched}
Errors: ${data.errors}`);

  window.loadStagingData();
};

/* ---------------------------------------------------------
   Insert staging row → inspections table
--------------------------------------------------------- */
window.insertInspectionStagingRow = async function (id) {
  const project = window.portalState?.project;
  if (!project) {
    alert("No project selected.");
    return;
  }

  const rowEl = document.querySelector(`#row-${id}`);
  if (!rowEl) return;

  const client = rowEl.querySelector(".client-cell")?.textContent.trim();

  if (!client || client === "(none)") {
    alert("Cannot import: missing client_contact_id.");
    return;
  }

  const actionCell = rowEl.querySelector(".action-cell");
  if (actionCell) actionCell.innerHTML = `<span style="color:#555;">Inserting...</span>`;

  const res = await fetch(
    `https://inspections-module.dennis-e64.workers.dev/inspections/add-from-staging?id=${id}&project=${project}`,
    { method: "POST" }
  );

  let data = {};
  try { data = await res.json(); } catch {}

  if (res.ok) {
    loadStagingData();
  } else {
    if (actionCell) {
      actionCell.innerHTML = `<button onclick="fixRow('${id}')">Fix Row</button>`;
    }
    const statusCell = rowEl.querySelector(".status-cell");
    if (statusCell) {
      statusCell.textContent = "error";
      statusCell.style.color = "red";
    }
    const errorCell = rowEl.querySelector(".error-cell");
    if (errorCell) errorCell.textContent = data.error || "Insert failed";
  }
};

/* ---------------------------------------------------------
   Inline editor toggle
--------------------------------------------------------- */
window.toggleEdit = function (id) {
  const existing = document.querySelector(`#edit-${id}`);
  if (existing) {
    existing.remove();
    return;
  }

  const row = document.querySelector(`#row-${id}`);
  if (!row) return;

  const client = row.children[0].textContent.trim();
  const agent = row.children[1].textContent.trim();
  const insp1 = row.children[2].textContent.trim();
  const insp2 = row.children[3].textContent.trim();
  const date = row.children[4].textContent.trim();
  const fee = row.children[5].textContent.trim();

  const editRow = document.createElement("tr");
  editRow.id = `edit-${id}`;
  editRow.style.background = "#f7f7f7";

  editRow.innerHTML = `
    <td colspan="10" style="padding:16px;">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
        <div>
          <label>Client Contact ID</label>
          <input id="edit_client_${id}" class="form-control" value="${escapeHtml(client === "(none)" ? "" : client)}">
        </div>

        <div>
          <label>Agent Contact ID</label>
          <input id="edit_agent_${id}" class="form-control" value="${escapeHtml(agent === "(none)" ? "" : agent)}">
        </div>

        <div>
          <label>Inspector 1 Contact ID</label>
          <input id="edit_insp1_${id}" class="form-control" value="${escapeHtml(insp1 === "(none)" ? "" : insp1)}">
        </div>

        <div>
          <label>Inspector 2 Contact ID</label>
          <input id="edit_insp2_${id}" class="form-control" value="${escapeHtml(insp2 === "(none)" ? "" : insp2)}">
        </div>

        <div>
          <label>Date</label>
          <input id="edit_date_${id}" type="date" class="form-control" value="${date}">
        </div>

        <div>
          <label>Total Fee</label>
          <input id="edit_fee_${id}" type="number" step="0.01" class="form-control" value="${fee}">
        </div>
      </div>

      <div style="margin-top:16px; display:flex; gap:10px;">
        <button class="btn-primary" onclick="saveInspectionEdit('${id}')">Save</button>
        <button class="btn-danger" onclick="deleteInspectionStagingRow('${id}')">Delete</button>
        <button class="btn-secondary" onclick="toggleEdit('${id}')">Cancel</button>
      </div>
    </td>
  `;

  row.insertAdjacentElement("afterend", editRow);
};

/* ---------------------------------------------------------
   fixRow → open inline editor
--------------------------------------------------------- */
window.fixRow = function (id) {
  window.toggleEdit(id);
};

/* ---------------------------------------------------------
   Save inline edit
--------------------------------------------------------- */
window.saveInspectionEdit = async function (id) {
  const project = window.portalState?.project;
  if (!project) {
    alert("No project selected.");
    return;
  }

  const client_contact_id = document.getElementById(`edit_client_${id}`).value.trim() || null;
  const agent_contact_id = document.getElementById(`edit_agent_${id}`).value.trim() || null;
  const inspector1_contact_id = document.getElementById(`edit_insp1_${id}`).value.trim() || null;
  const inspector2_contact_id = document.getElementById(`edit_insp2_${id}`).value.trim() || null;

  const date_raw = document.getElementById(`edit_date_${id}`).value.trim();
  const fee_raw = document.getElementById(`edit_fee_${id}`).value.trim();

  const patch = {
    id,
    project,
    client_contact_id,
    agent_contact_id,
    inspector1_contact_id,
    inspector2_contact_id,
    "Date": date_raw || null,
    "Total Fee": fee_raw || null,
    needs_review: true
  };

  const res = await fetch(
    `https://inspections-module.dennis-e64.workers.dev/staging/update-inline`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    }
  );

  let data = {};
  try { data = await res.json(); } catch {}

  if (!res.ok) {
    alert("Update failed. Check console.");
    console.error("INLINE UPDATE ERROR:", data);
    return;
  }

  await loadStagingData();

  const editRow = document.querySelector(`#edit-${id}`);
  if (editRow) editRow.remove();
};

/* ---------------------------------------------------------
   Delete staging row
--------------------------------------------------------- */
window.deleteInspectionStagingRow = async function (id) {
  const project = window.portalState?.project;
  if (!project) {
    alert("No project selected.");
    return;
  }

  if (!confirm("Delete this staging row?")) return;

  const res = await fetch(
    `https://inspections-module.dennis-e64.workers.dev/staging/delete-inline?id=${id}&project=${project}`,
    { method: "DELETE" }
  );

  let data = {};
  try { data = await res.json(); } catch {}

  if (!res.ok) {
    alert("Delete failed. Check console.");
    console.error("DELETE ERROR:", data);
    return;
  }

  const editRow = document.querySelector(`#edit-${id}`);
  if (editRow) editRow.remove();

  loadStagingData();
};

/* =========================================================
   LOAD STAGING DATA
========================================================= */
export async function loadStagingData() {
  const project = window.portalState?.project;
  if (!project) {
    console.error("No project selected.");
    renderStagingGrid([]);
    return;
  }

  const filter = document.getElementById("stagingFilter")?.value || "";

  let url = `https://inspections-module.dennis-e64.workers.dev/staging/list?project=${project}`;

  switch (filter) {
    case "":
      url += `&status=neq.imported`;
      break;
    case "uploaded":
      url += `&status=eq.uploaded`;
      break;
    case "ready":
      url += `&status=eq.ready`;
      break;
    case "error":
      url += `&status=eq.error`;
      break;
    case "imported":
      url += `&status=eq.imported`;
      break;
    case "missing_client":
      url += `&contact_missing=true`;
      break;
    case "missing_agent":
      url += `&agent_missing=true`;
      break;
    case "missing_inspector":
      url += `&inspector_missing=true`;
      break;
    case "needs_review":
      url += `&needs_review=eq.true`;
      break;
    default:
      url += `&status=neq.imported`;
      break;
  }

  const res = await fetch(url);
  let rows = [];

  try { rows = await res.json(); } catch { rows = []; }

  renderStagingGrid(rows);
}

window.loadStagingData = loadStagingData;

/* =========================================================
   STAGING GRID RENDERING
========================================================= */
function renderStagingGrid(rows) {
  const container = document.getElementById("stagingGrid");

  let currentSortField = "Date";
  let currentSortDirection = "asc";

  const columns = [
    { key: "client_name", label: "Client" },
    { key: "agent_name", label: "Agent" },
    { key: "inspector1_name", label: "Inspector 1" },
    { key: "inspector2_name", label: "Inspector 2" },
    { key: "Date", label: "Date", isDate: true },
    { key: "Total Fee", label: "Fee", numeric: true },
    { key: "status", label: "Status" },
    { key: "error_message", label: "Error" },
    { key: "action", label: "Action" }
  ];

  function sortRows() {
    rows.sort((a, b) => {
      let A = a[currentSortField];
      let B = b[currentSortField];

      const col = columns.find((c) => c.key === currentSortField);

      if (col?.isDate) {
        A = new Date(A);
        B = new Date(B);
      } else if (col?.numeric) {
        A = Number(A) || 0;
        B = Number(B) || 0;
      } else {
        A = (A || "").toString().toLowerCase();
        B = (B || "").toString().toLowerCase();
      }

      if (A < B) return currentSortDirection === "asc" ? -1 : 1;
      if (A > B) return currentSortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  function renderTable() {
    sortRows();

    const headerHtml = columns
      .map((col) => {
        const isSorted = currentSortField === col.key;
        const upArrow = isSorted && currentSortDirection === "asc" ? "▲" : "△";
        const downArrow = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

        return `
          <th class="sortable" data-field="${col.key}">
            ${escapeHtml(col.label)}
            <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
              <span class="sort-up">${upArrow}</span>
              <span class="sort-down">${downArrow}</span>
            </span>
          </th>
        `;
      })
      .join("");

    const rowsHtml = rows
      .map((row, i) => {
        const clientName = row.client_name || "(none)";
        const agentName = row.agent_name || "(none)";
        const insp1Name = row.inspector1_name || "(none)";
        const insp2Name = row.inspector2_name || "(none)";

        return `
          <tr
            id="row-${row.id}"
            style="background:${i % 2 === 0 ? "#ffffff" : "#f9f9f9"};"
          >
            <td class="client-cell">${escapeHtml(clientName)}</td>
            <td class="agent-cell">${escapeHtml(agentName)}</td>
            <td class="insp1-cell">${escapeHtml(insp1Name)}</td>
            <td class="insp2-cell">${escapeHtml(insp2Name)}</td>
            <td>${escapeHtml(row["Date"] || "")}</td>
            <td>${escapeHtml((Number(row["Total Fee"]) || 0).toFixed(2))}</td>
            <td class="status-cell">${escapeHtml(row.status || "")}</td>
            <td class="error-cell" style="color:red;">
              ${escapeHtml(row.error_message || "")}
            </td>
            <td class="action-cell">
              ${renderStagingActionButton(row)}
            </td>
          </tr>
        `;
      })
      .join("");

    container.innerHTML = `
      <div style="margin-bottom:10px; display:flex; gap:12px; align-items:center;">
        <button id="refreshStagingGrid" class="btn-primary">Refresh Grid</button>
        <select id="stagingFilter" style="padding:4px 6px;">
          <option value="">All (except imported)</option>
          <option value="uploaded">Uploaded</option>
          <option value="ready">Ready</option>
          <option value="error">Error</option>
          <option value="imported">Imported</option>
          <option value="missing_client">Missing Client</option>
          <option value="missing_agent">Missing Agent</option>
          <option value="missing_inspector">Missing Inspector</option>
          <option value="needs_review">Needs Review</option>
        </select>
      </div>

      <table class="notes-table" style="width:100%; border-collapse:collapse; margin-top:12px;">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;

    container.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const field = th.dataset.field;
        if (currentSortField === field) {
          currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
        } else {
          currentSortField = field;
          currentSortDirection = "asc";
        }
        renderTable();
      });
    });

    let refreshBtn = document.getElementById("refreshStagingGrid");
    refreshBtn.replaceWith(refreshBtn.cloneNode(true));
    refreshBtn = document.getElementById("refreshStagingGrid");
    refreshBtn.addEventListener("click", loadStagingData);

    let filter = document.getElementById("stagingFilter");
    filter.replaceWith(filter.cloneNode(true));
    filter = document.getElementById("stagingFilter");
    filter.addEventListener("change", loadStagingData);
  }

  renderTable();
}

/* =========================================================
   ACTION BUTTON LOGIC
========================================================= */
function renderStagingActionButton(row) {
  const hasClient = !!
