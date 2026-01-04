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

  await fetch(
    `https://financials-module.dennis-e64.workers.dev/staging/auto-match?id=${id}&project=${project}`,
    { method: "POST" }
  );

  loadStagingData();
};


window.insertStagingRow = async function(id) {
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

window.fixRow = async function(id) {
  const rowEl = document.querySelector(`#row-${id}`);
  if (!rowEl) return;

  // Extract values from the correct columns
  const customer = rowEl.children[0].textContent.trim();
  const invoice = rowEl.children[1].textContent.trim();
  const date = rowEl.children[2].textContent.trim();     // transaction_date
  const amount = rowEl.children[3].textContent.trim();   // amount
  const contact = rowEl.querySelector(".contact-cell").textContent.trim();

  const modal = document.createElement("div");
  modal.style = `
    position:fixed; top:0; left:0; width:100%; height:100%;
    background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center;
    z-index:9999;
  `;

  modal.innerHTML = `
    <div style="background:white; padding:20px; width:360px; border-radius:6px;">
      <h3>Fix Row</h3>

      <label>Customer</label>
      <input id="fix_customer" class="form-control" value="${customer}" />

      <label style="margin-top:10px;">Invoice #</label>
      <input id="fix_invoice" class="form-control" value="${invoice}" />

      <label style="margin-top:10px;">Transaction Date</label>
      <input id="fix_date" class="form-control" type="date" value="${date}" />

      <label style="margin-top:10px;">Amount</label>
      <input id="fix_amount" class="form-control" type="number" step="0.01" value="${amount}" />

      <label style="margin-top:10px;">Contact ID</label>
      <input id="fix_contact" class="form-control" value="${contact === "(none)" ? "" : contact}" />

      <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:10px;">
        <button id="fix_cancel">Cancel</button>
        <button id="fix_save" class="btn-primary">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector("#fix_cancel").onclick = () => modal.remove();

  modal.querySelector("#fix_save").onclick = async () => {
    const updatedContact = document.getElementById("fix_contact").value.trim() || null;

    await fetch(
      `https://financials-module.dennis-e64.workers.dev/staging/update`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          contact_id: updatedContact,
          needs_review: updatedContact ? false : true,
          notes: ""
        })
      }
    );

    modal.remove();
    loadStagingData();
  };
};

window.refreshStagingGrid = function() {
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
   Updated for referral_id + group_id + filters
========================================================= */
function renderStagingGrid(rows) {
  const container = document.getElementById("stagingGrid");

  // Sorting state
  let currentSortField = "transaction_date";
  let currentSortDirection = "asc";

  // FINAL column list (group_id removed)
  const columns = [
    { key: "customer_name", label: "Customer Name" },
    { key: "invoice_number", label: "Invoice #" },
    { key: "transaction_date", label: "Date", isDate: true },
    { key: "amount", label: "Amount", numeric: true },
    { key: "contact_id", label: "Contact ID" },
    { key: "referral_id", label: "Referral ID" },
    { key: "status", label: "Status" },

    // Required for alignment
    { key: "error_message", label: "Error" },
    { key: "action", label: "Action" }
  ];

  function sortRows() {
    rows.sort((a, b) => {
      let A = a[currentSortField];
      let B = b[currentSortField];

      const col = columns.find(c => c.key === currentSortField);

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
      .map(col => {
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

    // Rows
    const rowsHtml = rows
      .map(
        (row, i) => `
      <tr id="row-${row.id}" style="background:${i % 2 === 0 ? "#ffffff" : "#f9f9f9"};">
        <td>${escapeHtml(row.customer_name || "")}</td>
        <td>${escapeHtml(row.invoice_number || "")}</td>
        <td>${escapeHtml(row.transaction_date || "")}</td>
        <td>${escapeHtml((Number(row.amount) || 0).toFixed(2))}</td>

        <td class="contact-cell">${escapeHtml(row.contact_id || "(none)")}</td>

        <td class="referral-cell" style="color:${row.referral_id ? "#000" : "red"};">
          ${escapeHtml(row.referral_id || "(none)")}
        </td>

        <td class="status-cell">${escapeHtml(row.status || "")}</td>

        <td class="error-cell" style="color:red;">
          ${escapeHtml(row.error_message || "")}
        </td>

        <td class="action-cell">
          ${renderStagingActionButton(row)}
        </td>
      </tr>
    `
      )
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
        <thead>
          <tr>${headerHtml}</tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;

    // Sorting events
    container.querySelectorAll("th.sortable").forEach(th => {
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

    // Refresh button
    document
      .getElementById("refreshStagingGrid")
      .addEventListener("click", loadStagingData);

    // Filter dropdown
    document
      .getElementById("stagingFilter")
      .addEventListener("change", loadStagingData);
  }

  renderTable();
}




/* =========================================================
   BUlk CSV File Upload
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
        `https://financials-module.dennis-e64.workers.dev/staging/bulk-upload?project=${encodeURIComponent(project)}`,
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
