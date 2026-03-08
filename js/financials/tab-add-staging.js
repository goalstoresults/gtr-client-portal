// financials/tab-add-staging.js
// Staging subsystem for the Financials "Add" tab

import { escapeHtml } from "../utilities.js";

/* =========================================================
   STAGING ACTIONS (window.* so inline buttons still work)
========================================================= */

window.autoMatchContact = async function(id) {
  const project = window.portalState?.project;
  if (!project) {
    alert("No project selected.");
    return;
  }

  const rowEl = document.querySelector(`#row-${id}`);
  const actionCell = rowEl?.querySelector(".action-cell");
  const statusCell = rowEl?.querySelector(".status-cell");
  const errorCell = rowEl?.querySelector(".error-cell");

  if (actionCell) {
    actionCell.innerHTML = `<span style="color:#555;">Matching...</span>`;
  }

  let res, data = {};
  try {
    res = await fetch(
      `https://financials-module.dennis-e64.workers.dev/staging/auto-match?id=${id}&project=${project}`,
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

  // 🔥 NEW LOGIC:
  // Backend always sets needs_review = true in staging.
  // So we should NOT treat needs_review as "no match found".
  // Instead, we decide based on status.

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

  // If status is still "uploaded", we can show "no match found"
  if (data.status === "uploaded") {
    if (statusCell) {
      statusCell.textContent = "uploaded";
      statusCell.style.color = "orange";
    }
    if (errorCell) {
      errorCell.textContent = "No contact match found";
    }
    if (actionCell) {
      actionCell.innerHTML = `<button onclick="fixRow('${id}')">Fix Row</button>`;
    }
    return;
  }

  // Otherwise (matched / ready / etc.), reload the grid to reflect new state
  await loadStagingData();
};

window.insertStagingRow = async function (id) {
  const project = window.portalState?.project;
  if (!project) {
    alert("No project selected.");
    return;
  }

  const rowEl = document.querySelector(`#row-${id}`);
  if (!rowEl) return;

  const contact = rowEl.querySelector(".contact-cell")?.textContent.trim();

  // Only block if contact missing
  if (!contact || contact === "(none)") {
    alert("Cannot import: missing contact_id.");
    return;
  }

  const actionCell = rowEl.querySelector(".action-cell");
  if (actionCell) {
    actionCell.innerHTML = `<span style="color:#555;">Inserting...</span>`;
  }

  const res = await fetch(
    `https://financials-module.dennis-e64.workers.dev/payments/add-from-staging?id=${id}&project=${project}`,
    { method: "POST" }
  );

  let data = {};
  try {
    data = await res.json();
  } catch {}

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
    if (errorCell) {
      errorCell.textContent = data.error || "Insert failed";
    }
  }
};

// NEW: inline editor toggle (replaces modal-style fix)
window.toggleEdit = function (id) {
  const existing = document.querySelector(`#edit-${id}`);
  if (existing) {
    existing.remove();
    return;
  }

  const row = document.querySelector(`#row-${id}`);
  if (!row) return;

  const customer = row.children[0].textContent.trim();
  const invoice = row.children[1].textContent.trim();
  const date = row.children[2].textContent.trim();
  const amount = row.children[3].textContent.trim();
  const contact = row.querySelector(".contact-cell")?.textContent.trim() || "";
  const description = row.dataset.description || "";   // ⭐ NEW

  const editRow = document.createElement("tr");
  editRow.id = `edit-${id}`;
  editRow.style.background = "#f7f7f7";

  editRow.innerHTML = `
    <td colspan="9" style="padding:16px;">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">

        <div>
          <label>Customer</label>
          <input id="edit_customer_${id}" class="form-control" value="${escapeHtml(customer)}">
        </div>

        <div>
          <label>Invoice #</label>
          <input id="edit_invoice_${id}" class="form-control" value="${escapeHtml(invoice)}">
        </div>

        <div>
          <label>Description</label>
          <input id="edit_description_${id}" class="form-control" value="${escapeHtml(description)}">
        </div>

        <div>
          <label>Date</label>
          <input id="edit_date_${id}" type="date" class="form-control" value="${date}">
        </div>

        <div>
          <label>Amount</label>
          <input id="edit_amount_${id}" type="number" step="0.01" class="form-control" value="${amount}">
        </div>

        <div>
          <label>Contact ID</label>
          <input id="edit_contact_${id}" class="form-control" value="${escapeHtml(contact === "(none)" ? "" : contact)}">
        </div>

      </div>

      <div style="margin-top:16px; display:flex; gap:10px;">
        <button class="btn-primary" onclick="saveEdit('${id}')">Save</button>
        <button class="btn-danger" onclick="deleteStagingRow('${id}')">Delete</button>
        <button class="btn-secondary" onclick="toggleEdit('${id}')">Cancel</button>
      </div>
    </td>
  `;

  row.insertAdjacentElement("afterend", editRow);
};


// fixRow now just opens the inline editor
window.fixRow = function (id) {
  window.toggleEdit(id);
};

window.saveEdit = async function(id) {
  const project = window.portalState?.project;
  if (!project) {
    alert("No project selected.");
    return;
  }

  // Extract values
  const customer_name = document.getElementById(`edit_customer_${id}`).value.trim();
  const invoice_number = document.getElementById(`edit_invoice_${id}`).value.trim();
  const description = document.getElementById(`edit_description_${id}`).value.trim();   // ⭐ NEW
  const transaction_date_raw = document.getElementById(`edit_date_${id}`).value.trim();
  const amount_raw = document.getElementById(`edit_amount_${id}`).value.trim();
  const contact_id_raw = document.getElementById(`edit_contact_${id}`).value.trim();

  // Sanitize
  const transaction_date = transaction_date_raw === "" ? null : transaction_date_raw;
  const amount = amount_raw === "" ? null : Number(amount_raw);
  const contact_id = contact_id_raw === "" ? null : contact_id_raw;

  const payload = {
    id,
    customer_name,
    invoice_number,
    description,        // ⭐ NEW
    transaction_date,
    amount,
    contact_id,
    needs_review: !contact_id
  };

  console.log("INLINE UPDATE PAYLOAD:", payload);

  // Send PATCH
  const res = await fetch(
    `https://financials-module.dennis-e64.workers.dev/staging/update-inline`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  let data = {};
  try { data = await res.json(); } catch {}

  console.log("INLINE UPDATE RESPONSE:", res.status, data);

  if (!res.ok) {
    alert("Update failed. Check console.");
    return;
  }

  // Reload grid before closing editor
  await loadStagingData();

  const editRow = document.querySelector(`#edit-${id}`);
  if (editRow) editRow.remove();
};


window.deleteStagingRow = async function (id) {
  const project = window.portalState?.project;
  if (!project) {
    alert("No project selected.");
    return;
  }

  if (!confirm("Delete this staging row?")) return;

  const res = await fetch(
    `https://financials-module.dennis-e64.workers.dev/staging/delete-inline?id=${id}&project=${project}`,
    { method: "DELETE" }
  );

  let data = {};
  try {
    data = await res.json();
  } catch {}

  console.log("INLINE DELETE RESPONSE:", res.status, data);

  if (!res.ok) {
    alert("Delete failed. Check console.");
    return;
  }

  const editRow = document.querySelector(`#edit-${id}`);
  if (editRow) editRow.remove();

  loadStagingData();
};

window.refreshStagingGrid = function () {
  loadStagingData();
};

window.reviewBulkData = function () {
  const filterEl = document.getElementById("stagingFilter");
  if (filterEl) {
    filterEl.value = "needs_review";
  }
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
  let url = `https://financials-module.dennis-e64.workers.dev/staging/list?project=${project}`;

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
    case "missing_contact":
      url += `&contact_missing=true`;
      break;
    case "missing_referral":
      url += `&referral_missing=true`;
      break;
    case "missing_group":
      url += `&group_missing=true`;
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
  try {
    rows = await res.json();
  } catch {
    rows = [];
  }

  renderStagingGrid(rows);
}

window.loadStagingData = loadStagingData;

/* =========================================================
STAGING GRID RENDERING
Updated to show contact/referral NAMES instead of IDs
========================================================= */

function buildName(c) {
  if (!c) return null;
  if (c.business_name) return c.business_name;
  if (c.first_name || c.last_name)
    return `${c.first_name || ""} ${c.last_name || ""}`.trim();
  return null;
}

function renderStagingGrid(rows) {
  const container = document.getElementById("stagingGrid");

  // Sorting state
  let currentSortField = "transaction_date";
  let currentSortDirection = "asc";

  // FINAL column list (unchanged labels)
  const columns = [
    { key: "customer_name", label: "Customer Name" },
    { key: "invoice_number", label: "Invoice #" },
    { key: "transaction_date", label: "Date", isDate: true },
    { key: "amount", label: "Amount", numeric: true },
    { key: "contact_name", label: "Contact" },
    { key: "referral_name", label: "Referral" },
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

    // Header
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

    // Rows
    const rowsHtml = rows
      .map((row, i) => {
        // ⭐ FIXED: use flattened backend fields
        const contactName = row.contact_name || "(none)";
        const referralName = row.referral_name || "(none)";

        return `
        <tr
          id="row-${row.id}"
          data-description="${escapeHtml(row.description || "")}"
          style="background:${i % 2 === 0 ? "#ffffff" : "#f9f9f9"};"
        >
          <td class="expand-cell">
            <a href="#" onclick="toggleEdit('${row.id}'); return false;">
              ${escapeHtml(row.customer_name || "")}
            </a>
          </td>

          <td>${escapeHtml(row.invoice_number || "")}</td>
          <td>${escapeHtml(row.transaction_date || "")}</td>
          <td>${escapeHtml((Number(row.amount) || 0).toFixed(2))}</td>

          <!-- ⭐ CONTACT NAME -->
          <td class="contact-cell">
            ${escapeHtml(contactName)}
            <div style="font-size:0.75em; color:#888;">
              ${escapeHtml(row.contact_id || "")}
            </div>
          </td>

          <!-- ⭐ REFERRAL NAME -->
          <td class="referral-cell" style="color:${row.referral_id ? "#000" : "red"};">
            ${escapeHtml(referralName)}
            <div style="font-size:0.75em; color:#888;">
              ${escapeHtml(row.referral_id || "")}
            </div>
          </td>

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
          <option value="missing_contact">Missing Contact</option>
          <option value="missing_referral">Missing Referral</option>
          <option value="needs_review">Needs Review</option>
        </select>
      </div>

      <table class="notes-table" style="width:100%; border-collapse:collapse; margin-top:12px;">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;

    // Sorting events
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

    // Refresh button
    let refreshBtn = document.getElementById("refreshStagingGrid");
    refreshBtn.replaceWith(refreshBtn.cloneNode(true));
    refreshBtn = document.getElementById("refreshStagingGrid");
    refreshBtn.addEventListener("click", loadStagingData);

    // Filter dropdown
    let filter = document.getElementById("stagingFilter");
    filter.replaceWith(filter.cloneNode(true));
    filter = document.getElementById("stagingFilter");
    filter.addEventListener("change", loadStagingData);
  }

  renderTable();
}




/* =========================================================
   Bulk CSV File Upload
========================================================= */

window.showBulkUploadModal = function () {
  const modal = document.createElement("div");
  modal.style = `
    position:fixed; top:0; left:0; width:100%; height:100%;
    background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center;
    z-index:9999;
  `;

  modal.innerHTML = `
    <div style="background:white; padding:20px; width:500px; border-radius:6px;">
      <h3>Bulk Upload</h3>
      <p>Select a CSV file to upload. First row must contain column names.</p>
      <input type="file" id="bulkCsvFile" accept=".csv" style="margin-top:10px;" />
      <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:10px;">
        <button id="bulkCancel">Cancel</button>
        <button id="bulkUpload" class="btn-primary">Upload</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector("#bulkCancel").onclick = () => modal.remove();

  modal.querySelector("#bulkUpload").onclick = async () => {
    const fileInput = document.getElementById("bulkCsvFile");
    const file = fileInput.files[0];

    if (!file) {
      alert("Please select a CSV file.");
      return;
    }

    const project = window.portalState?.project;
    if (!project) {
      alert("No project selected.");
      return;
    }

    let csvText;
    try {
      csvText = await file.text();
    } catch (err) {
      console.error("Failed to read file", err);
      alert("Could not read CSV file.");
      return;
    }

    try {
      const res = await fetch(
        `https://financials-module.dennis-e64.workers.dev/staging/bulk-upload?project=${encodeURIComponent(
          project
        )}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "text/csv"
          },
          body: csvText
        }
      );

      const text = await res.text();

      if (!res.ok) {
        console.error("Bulk upload failed:", text);
        alert("Bulk upload failed. Check console for details.");
        return;
      }

      alert("Bulk upload complete.");
      if (typeof window.loadStagingData === "function") {
        window.loadStagingData();
      }
      modal.remove();
    } catch (err) {
      console.error("Bulk upload error:", err);
      alert("Bulk upload failed due to a network or server error.");
    }
  };
};

/* =========================================================
   ACTION BUTTON LOGIC (Insert gating)
========================================================= */

function renderStagingActionButton(row) {
  const hasContact = !!row.contact_id;

  // If contact is missing but status isn't uploaded, show message
  if (!hasContact && row.status !== "uploaded") {
    return `<span style="color:red;">Missing contact</span>`;
  }

  switch (row.status) {
    case "uploaded":
      // No contact yet → Populate only
      return `<button onclick="autoMatchContact('${row.id}')">Populate</button>`;

    case "matched":
      // Contact found but referral missing → Populate + Insert
      return `
        <button onclick="autoMatchContact('${row.id}')">Populate</button>
        <button onclick="insertStagingRow('${row.id}')">Insert</button>
      `;

    case "ready":
      // Contact + referral found → Insert only
      return `<button onclick="insertStagingRow('${row.id}')">Insert</button>`;

    case "error":
      return `<button onclick="fixRow('${row.id}')">Fix Row</button>`;

    case "imported":
      return `<span style="color:green;">Imported</span>`;

    default:
      return "";
  }
}
