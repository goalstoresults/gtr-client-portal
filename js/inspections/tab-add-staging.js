// inspections/tab-add-staging.js
// Full Clone Mode – Inspections Staging Subsystem
// Mirrors financials/tab-add-staging.js patterns

import { escapeHtml } from "../utilities.js";

const INSPECTIONS_API_BASE = "https://inspections-module.dennis-e64.workers.dev";

const REQUIRED_COLUMNS = [
  "OID",
  "Date",
  "Inspectors",
  "Inspection Address",
  "Inspection City",
  "Inspection State",
  "Inspection Zip",
  "Buyer's Agent First Name",
  "Buyer's Agent Last Name",
  "Buyer's Agent Address",
  "Buyer's Agent City",
  "Buyer's Agent State",
  "Buyer's Agent Zip",
  "Buyer's Agent Email",
  "Buyer's Agent Cell",
  "Client First Name",
  "Client Last Name",
  "Client's Address",
  "Client's City",
  "Client's State",
  "Client's Zip",
  "Client's Email",
  "Client's Mobile",
  "Total Fee",
  "Type of Inspection"
];

/* =========================================================
BULK UPLOAD MODAL
========================================================= */

export function openInspectionBulkUpload(container, portalState) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  modal.innerHTML = `
    <div class="modal">
      <h2>Bulk Upload</h2>
      <p>
        Select a CSV file to upload.<br>
        First row must contain column names.<br><br>
        <strong>Names must be exactly:</strong><br>
        <code>${REQUIRED_COLUMNS.join(", ")}</code>
      </p>
      <input type="file" id="inspBulkFile" accept=".csv" />
      <div style="margin-top:16px; display:flex; gap:8px; justify-content:flex-end;">
        <button id="inspBulkCancel">Cancel</button>
        <button id="inspBulkUpload" class="primary">Upload</button>
      </div>
      <div id="inspBulkStatus" style="margin-top:12px;"></div>
    </div>
  `;

  document.body.appendChild(modal);

  const fileInput = modal.querySelector("#inspBulkFile");
  const cancelBtn = modal.querySelector("#inspBulkCancel");
  const uploadBtn = modal.querySelector("#inspBulkUpload");
  const statusDiv = modal.querySelector("#inspBulkStatus");

  cancelBtn.onclick = () => modal.remove();

  uploadBtn.onclick = async () => {
    if (!fileInput.files.length) {
      statusDiv.innerHTML = `<p style="color:red;">Please select a CSV file.</p>`;
      return;
    }

    const file = fileInput.files[0];
    const text = await file.text();

    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (!lines.length) {
      statusDiv.innerHTML = `<p style="color:red;">CSV is empty.</p>`;
      return;
    }

    const header = lines[0].split(",").map((h) => h.trim());
    const missing = REQUIRED_COLUMNS.filter((col) => !header.includes(col));

    if (missing.length) {
      statusDiv.innerHTML = `
        <p style="color:red;">Missing required columns:</p>
        <pre>${missing.join("\n")}</pre>
      `;
      return;
    }

    statusDiv.innerHTML = `<p>Uploading…</p>`;

    const res = await fetch(
      `${INSPECTIONS_API_BASE}/staging/bulk-upload?project=${encodeURIComponent(
        portalState.project
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text
      }
    );

    let data = null;
    try {
      data = await res.json();
    } catch {
      statusDiv.innerHTML = `<p style="color:red;">Upload failed (invalid response).</p>`;
      return;
    }

    if (!res.ok) {
      statusDiv.innerHTML = `<p style="color:red;">${data.error || "Upload failed"}</p>`;
      return;
    }

    statusDiv.innerHTML = `<p style="color:green;">Imported ${data.inserted} rows.</p>`;

    setTimeout(() => {
      modal.remove();
      renderInspectionStaging(container, portalState);
    }, 800);
  };
}

/* =========================================================
TOP-LEVEL RENDER
========================================================= */

export async function renderInspectionStaging(container, portalState) {
  const project = portalState?.project;
  if (!project) {
    container.innerHTML = `<p>No project selected.</p>`;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <h2>Inspection Staging</h2>

      <div style="margin-bottom:12px; display:flex; gap:8px; align-items:center;">
        <button id="inspRefreshStaging" class="btn-primary">Refresh Grid</button>
        <button id="inspAutoMatchAll" class="secondary">Auto-Match All</button>

        <select id="inspStagingFilter" style="padding:4px 6px;">
          <option value="">All (except imported)</option>
          <option value="uploaded">Uploaded</option>
          <option value="matched">Matched</option>
          <option value="ready">Ready</option>
          <option value="error">Error</option>
          <option value="imported">Imported</option>
          <option value="needs_review">Needs Review</option>
          <option value="missing_contact">Missing Contact</option>
        </select>
      </div>

      <div id="inspectionStagingGrid"></div>
    </section>
  `;

  document.getElementById("inspRefreshStaging")
    .addEventListener("click", loadInspectionStagingData);

  document.getElementById("inspStagingFilter")
    .addEventListener("change", loadInspectionStagingData);

  const autoMatchAllBtn = document.getElementById("inspAutoMatchAll");
  autoMatchAllBtn.onclick = async () => {
    const project = window.portalState?.project;
    if (!project) {
      alert("No project selected.");
      return;
    }

    autoMatchAllBtn.disabled = true;
    autoMatchAllBtn.textContent = "Matching…";

    let res, data;
    try {
      res = await fetch(
        `${INSPECTIONS_API_BASE}/staging/auto-match-all?project=${encodeURIComponent(
          project
        )}`,
        { method: "POST" }
      );
      data = await res.json();
    } catch (err) {
      console.error("Auto-match-all failed", err);
      alert("Error running auto-match-all.");
      autoMatchAllBtn.disabled = false;
      autoMatchAllBtn.textContent = "Auto-Match All";
      return;
    }

    autoMatchAllBtn.disabled = false;
    autoMatchAllBtn.textContent = "Auto-Match All";

    if (!res.ok) {
      alert(data.error || "Error running auto-match-all.");
      return;
    }

    alert(`Auto-match complete.\nMatched: ${data.matched || data.ready || data.updated || 0}`);
    await loadInspectionStagingData();
  };

  await loadInspectionStagingData();
}

/* =========================================================
LOAD STAGING DATA
========================================================= */

window.loadInspectionStagingData = loadInspectionStagingData;

async function loadInspectionStagingData() {
  const project = window.portalState?.project;
  if (!project) {
    console.error("No project selected.");
    renderInspectionStagingGrid([]);
    return;
  }

  const filterEl = document.getElementById("inspStagingFilter");
  const filter = filterEl?.value || "";

  let url = `${INSPECTIONS_API_BASE}/staging/list?project=${encodeURIComponent(project)}`;

  switch (filter) {
    case "":
      url += `&status=neq.imported`;
      break;
    case "uploaded":
      url += `&status=eq.uploaded`;
      break;
    case "matched":
      url += `&status=eq.matched`;
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
    case "needs_review":
      url += `&needs_review=eq.true`;
      break;
    case "missing_contact":
      url += `&contact_missing=true`;
      break;
    default:
      url += `&status=neq.imported`;
      break;
  }

  let rows = [];
  try {
    const res = await fetch(url);
    rows = await res.json();
  } catch (err) {
    console.error("Failed to load inspection staging:", err);
    rows = [];
  }

  renderInspectionStagingGrid(rows);
}

/* =========================================================
AUTO-MATCH SINGLE ROW
========================================================= */

window.autoMatchInspection = async function (id) {
  const project = window.portalState?.project;
  if (!project) {
    alert("No project selected.");
    return;
  }

  const rowEl = document.querySelector(`#insp-row-${id}`);
  const actionCell = rowEl?.querySelector(".insp-action-cell");
  const statusCell = rowEl?.querySelector(".insp-status-cell");
  const errorCell = rowEl?.querySelector(".insp-error-cell");

  if (actionCell) {
    actionCell.innerHTML = `<span style="color:#555;">Matching...</span>`;
  }

  let res, data = {};

  try {
    res = await fetch(
      `${INSPECTIONS_API_BASE}/staging/auto-match?id=${encodeURIComponent(id)}&project=${encodeURIComponent(project)}`,
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
      actionCell.innerHTML = `<button onclick="inspFixRow('${id}')">Fix Row</button>`;
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
      actionCell.innerHTML = `<button onclick="inspFixRow('${id}')">Fix Row</button>`;
    }
    return;
  }

  await loadInspectionStagingData();
};


/* =========================================================
IMPORT ROW
========================================================= */

window.insertStagingInspection = async function (id) {
  const project = window.portalState?.project;
  if (!project) {
    alert("No project selected.");
    return;
  }

  const rowEl = document.querySelector(`#insp-row-${id}`);
  if (!rowEl) return;

  const clientCell = rowEl.querySelector(".insp-client-cell")?.textContent.trim();
  if (!clientCell || clientCell === "(none)") {
    alert("Cannot import: missing client contact.");
    return;
  }

  const actionCell = rowEl.querySelector(".insp-action-cell");
  if (actionCell) {
    actionCell.innerHTML = `<span style="color:#555;">Inserting...</span>`;
  }

  let res, data = {};
  try {
    res = await fetch(
      `${INSPECTIONS_API_BASE}/inspections/add-from-staging`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, project })
      }
    );
    data = await res.json();
  } catch (err) {
    console.error("Insert from staging failed", err);
  }

  if (res && res.ok) {
    await loadInspectionStagingData();
  } else {
    if (actionCell) {
      actionCell.innerHTML = `<button onclick="inspFixRow('${id}')">Fix Row</button>`;
    }
    const statusCell = rowEl.querySelector(".insp-status-cell");
    if (statusCell) {
      statusCell.textContent = "error";
      statusCell.style.color = "red";
    }
    const errorCell = rowEl.querySelector(".insp-error-cell");
    if (errorCell) {
      errorCell.textContent = data.error || "Insert failed";
    }
  }
};

/* =========================================================
INLINE EDIT
========================================================= */

window.inspToggleEdit = function (id) {
  const existing = document.querySelector(`#insp-edit-${id}`);
  if (existing) {
    existing.remove();
    return;
  }

  const row = document.querySelector(`#insp-row-${id}`);
  if (!row) return;

  const date = row.children[0].textContent.trim();
  const client = row.children[1].textContent.trim();
  const agent = row.children[2].textContent.trim();
  const address = row.children[3].textContent.trim();
  const city = row.children[4].textContent.trim();
  const state = row.children[5].textContent.trim();
  const zip = row.children[6].textContent.trim();
  const type = row.children[7].textContent.trim();
  const fee = row.children[8].textContent.trim();

  const editRow = document.createElement("tr");
  editRow.id = `insp-edit-${id}`;
  editRow.style.background = "#f7f7f7";

  editRow.innerHTML = `
    <td colspan="12" style="padding:16px;">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
        <div>
          <label>Date</label>
          <input id="insp_edit_date_${id}" class="form-control" value="${escapeHtml(date)}">
        </div>
        <div>
          <label>Client Name</label>
          <input id="insp_edit_client_${id}" class="form-control" value="${escapeHtml(client)}">
        </div>
        <div>
          <label>Agent Name</label>
          <input id="insp_edit_agent_${id}" class="form-control" value="${escapeHtml(agent)}">
        </div>
        <div>
          <label>Address</label>
          <input id="insp_edit_address_${id}" class="form-control" value="${escapeHtml(address)}">
        </div>
        <div>
          <label>City</label>
          <input id="insp_edit_city_${id}" class="form-control" value="${escapeHtml(city)}">
        </div>
        <div>
          <label>State</label>
          <input id="insp_edit_state_${id}" class="form-control" value="${escapeHtml(state)}">
        </div>
        <div>
          <label>Zip</label>
          <input id="insp_edit_zip_${id}" class="form-control" value="${escapeHtml(zip)}">
        </div>
        <div>
          <label>Type</label>
          <input id="insp_edit_type_${id}" class="form-control" value="${escapeHtml(type)}">
        </div>
        <div>
          <label>Fee</label>
          <input id="insp_edit_fee_${id}" type="number" step="0.01" class="form-control" value="${fee}">
        </div>
      </div>

      <div style="margin-top:16px; display:flex; gap:10px;">
        <button class="btn-primary" onclick="inspSaveEdit('${id}')">Save</button>
        <button class="btn-danger" onclick="inspDeleteStagingRow('${id}')">Delete</button>
        <button class="btn-secondary" onclick="inspToggleEdit('${id}')">Cancel</button>
      </div>
    </td>
  `;

  row.insertAdjacentElement("afterend", editRow);
};

window.inspFixRow = function (id) {
  window.inspToggleEdit(id);
};

window.inspSaveEdit = async function (id) {
  const project = window.portalState?.project;
  if (!project) {
    alert("No project selected.");
    return;
  }

  const inspection_date = document.getElementById(`insp_edit_date_${id}`).value.trim();
  const client_name = document.getElementById(`insp_edit_client_${id}`).value.trim();
  const agent_name = document.getElementById(`insp_edit_agent_${id}`).value.trim();
  const inspection_address = document.getElementById(`insp_edit_address_${id}`).value.trim();
  const inspection_city = document.getElementById(`insp_edit_city_${id}`).value.trim();
  const inspection_state = document.getElementById(`insp_edit_state_${id}`).value.trim();
  const inspection_zip = document.getElementById(`insp_edit_zip_${id}`).value.trim();
  const inspection_type = document.getElementById(`insp_edit_type_${id}`).value.trim();
  const fee_raw = document.getElementById(`insp_edit_fee_${id}`).value.trim();

  const fee_total = fee_raw === "" ? null : Number(fee_raw);

  const payload = {
    id,
    project,
    inspection_date,
    inspection_type,
    inspection_address,
    inspection_city,
    inspection_state,
    inspection_zip,
    client_name,
    agent_name,
    fee_total,
    needs_review: true
  };

  const res = await fetch(
    `${INSPECTIONS_API_BASE}/staging/update-inline`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  let data = {};
  try {
    data = await res.json();
  } catch {}

    if (!res.ok) {
    console.error("Inspection staging update failed:", res.status, data);
    alert("Update failed. Check console.");
    return;
  }

  // Reload grid before closing editor
  await loadInspectionStagingData();

  const editRow = document.querySelector(`#insp-edit-${id}`);
  if (editRow) editRow.remove();
};

/* =========================================================
DELETE STAGING ROW
========================================================= */

window.inspDeleteStagingRow = async function (id) {
  const project = window.portalState?.project;
  if (!project) {
    alert("No project selected.");
    return;
  }

  if (!confirm("Delete this staging row?")) return;

  const res = await fetch(
    `${INSPECTIONS_API_BASE}/staging/delete-inline?id=${encodeURIComponent(
      id
    )}&project=${encodeURIComponent(project)}`,
    { method: "DELETE" }
  );

  let data = {};
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    console.error("Inspection staging delete failed:", res.status, data);
    alert("Delete failed. Check console.");
    return;
  }

  const editRow = document.querySelector(`#insp-edit-${id}`);
  if (editRow) editRow.remove();

  await loadInspectionStagingData();
};

/* =========================================================
GRID RENDERING (Full Clone Mode)
========================================================= */

function renderInspectionStagingGrid(rows) {
  const container = document.getElementById("inspectionStagingGrid");
  if (!container) return;

  let currentSortField = "inspection_date";
  let currentSortDirection = "asc";

  const columns = [
    { key: "inspection_date", label: "Date", isDate: true },

    // Names + IDs
    { key: "client_name", label: "Client" },
    { key: "client_email", label: "Client Email" },
    { key: "agent_name", label: "Agent" },
    { key: "buyer_agent_email", label: "Agent Email" },

    { key: "inspection_address", label: "Address" },
    { key: "inspection_city", label: "City" },
    { key: "inspection_state", label: "State" },
    { key: "inspection_zip", label: "Zip" },
    { key: "inspection_type", label: "Type" },
    { key: "fee_total", label: "Fee", numeric: true },
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
        const downArrow =
          isSorted && currentSortDirection === "desc" ? "▼" : "▽";

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
        const fee = (Number(row.fee_total) || 0).toFixed(2);
        const status = row.status || "";
        const error = row.error_message || "";

        const clientName = row.client_name || "(none)";
        const agentName = row.agent_name || "(none)";

        const clientDisplay = row.client_contact_id
          ? `${clientName} (${row.client_contact_id})`
          : clientName;

        const agentDisplay = row.agent_contact_id
          ? `${agentName} (${row.agent_contact_id})`
          : agentName;

        return `
<tr
  id="insp-row-${row.id}"
  style="background:${i % 2 === 0 ? "#ffffff" : "#f9f9f9"};"
>
  <td>
    <a href="#" onclick="inspToggleEdit('${row.id}'); return false;">
      ${escapeHtml(row.inspection_date || "")}
    </a>
  </td>

  <td class="insp-client-cell">${escapeHtml(clientDisplay)}</td>
  <td>${escapeHtml(row.client_email || "")}</td>

  <td>${escapeHtml(agentDisplay)}</td>
  <td>${escapeHtml(row.buyer_agent_email || "")}</td>

  <td>${escapeHtml(row.inspection_address || "")}</td>
  <td>${escapeHtml(row.inspection_city || "")}</td>
  <td>${escapeHtml(row.inspection_state || "")}</td>
  <td>${escapeHtml(row.inspection_zip || "")}</td>
  <td>${escapeHtml(row.inspection_type || "")}</td>
  <td>${escapeHtml(fee)}</td>

  <td class="insp-status-cell">${escapeHtml(status)}</td>

  <td class="insp-error-cell" style="color:red;">
    ${escapeHtml(error)}
  </td>

  <td class="insp-action-cell">
    ${renderInspectionActionButton(row)}
  </td>
</tr>
`;
      })
      .join("");

    container.innerHTML = `
      <table class="notes-table" style="width:100%; border-collapse:collapse; margin-top:12px;">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;

    container.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const field = th.dataset.field;

        if (currentSortField === field) {
          currentSortDirection =
            currentSortDirection === "asc" ? "desc" : "asc";
        } else {
          currentSortField = field;
          currentSortDirection = "asc";
        }

        renderTable();
      });
    });
  }

  renderTable();
}

function cleanName(name) {
  if (!name) return "";
  return name.replace(/\(.*?\)/, "").trim();
}


async function findContactId(project, email, name) {
  const base = `${env.SUPABASE_URL}/rest/v1/contacts`;
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`
  };

  name = cleanName(name);

  // 1) Try email first
  if (email && email.trim()) {
    const url =
      `${base}?project=eq.${encodeURIComponent(project)}` +
      `&email=eq.${encodeURIComponent(email.trim().toLowerCase())}` +
      `&select=contact_id&limit=1`;

    const res = await fetch(url, { headers });
    const rows = await res.json();

    if (Array.isArray(rows) && rows.length === 1) {
      return rows[0].contact_id;
    }
  }

  // 2) Try name (search_name)
  if (name && name.trim()) {
    const url =
      `${base}?project=eq.${encodeURIComponent(project)}` +
      `&search_name=eq.${encodeURIComponent(name.trim())}` +
      `&select=contact_id&limit=1`;

    const res = await fetch(url, { headers });
    const rows = await res.json();

    if (Array.isArray(rows) && rows.length === 1) {
      return rows[0].contact_id;
    }
  }

  // 3) No match
  return null;
}


/* =========================================================
ACTION BUTTON LOGIC
========================================================= */

function renderInspectionActionButton(row) {
  const hasClient = !!row.client_contact_id;
  const hasAgent = !!row.agent_contact_id;

  // Case 1: Neither found → Find only
  if (!hasClient && !hasAgent) {
    return `<button onclick="autoMatchInspection('${row.id}')">Find</button>`;
  }

  // Case 2: One found, one missing → Find + Import
  if ((hasClient && !hasAgent) || (!hasClient && hasAgent)) {
    return `
      <button onclick="autoMatchInspection('${row.id}')">Find</button>
      <button onclick="insertStagingInspection('${row.id}')">Import</button>
    `;
  }

  // Case 3: Both found → Import only
  if (hasClient && hasAgent) {
    return `<button onclick="insertStagingInspection('${row.id}')">Import</button>`;
  }

  return "";
}


