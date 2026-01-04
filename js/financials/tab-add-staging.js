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
    `https://financials-module.dennis-e64.workers.dev/staging/auto-match?id=${id}&project=${project}`
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

  const customer = rowEl.children[0].textContent.trim();
  const invoice = rowEl.children[1].textContent.trim();
  const date = rowEl.children[2].textContent.trim();
  const amount = rowEl.children[3].textContent.trim();
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

      <label>Customer Name</label>
      <input id="fix_customer" class="form-control" value="${customer}" />

      <label style="margin-top:10px;">Invoice #</label>
      <input id="fix_invoice" class="form-control" value="${invoice}" />

      <label style="margin-top:10px;">Payment Date</label>
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


/* =========================================================
   STAGING GRID RENDERING
   Updated for referral_id + group_id + filters
========================================================= */

function renderStagingGrid(rows) {
  const container = document.getElementById("stagingGrid");

  // Sorting state
  let currentSortField = "payment_date";
  let currentSortDirection = "asc";

  // Columns including new referral/group
  const columns = [
    { key: "customer_name", label: "Customer" },
    { key: "invoice_number", label: "Invoice #" },
    { key: "payment_date", label: "Date", isDate: true },
    { key: "payment_amount", label: "Amount", numeric: true },
    { key: "contact_id", label: "Contact ID" },
    { key: "referral_id", label: "Referral ID" },
    { key: "group_id", label: "Group ID" },
    { key: "status", label: "Status" }
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
        <td>${escapeHtml(row.payment_date || "")}</td>
        <td>${escapeHtml((Number(row.payment_amount) || 0).toFixed(2))}</td>

        <td class="contact-cell">${escapeHtml(row.contact_id || "(none)")}</td>

        <td class="referral-cell" style="color:${row.referral_id ? "#000" : "red"};">
          ${escapeHtml(row.referral_id || "(none)")}
        </td>

        <td class="group-cell" style="color:${row.group_id ? "#000" : "red"};">
          ${escapeHtml(row.group_id || "(none)")}
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

    // Full grid HTML
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
          <option value="missing_group">Missing Group</option>
          <option value="needs_review">Needs Review</option>
        </select>
      </div>

      <table class="notes-table" style="width:100%; border-collapse:collapse; margin-top:12px;">
        <thead>
          <tr>
            ${headerHtml}
            <th>Error</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
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
      <p>Paste CSV data below. First row must contain column names.</p>

      <textarea id="bulkCsvInput" style="width:100%; height:200px; margin-top:10px;"></textarea>

      <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:10px;">
        <button id="bulkCancel">Cancel</button>
        <button id="bulkUpload" class="btn-primary">Upload</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector("#bulkCancel").onclick = () => modal.remove();

  modal.querySelector("#bulkUpload").onclick = async () => {
    const csv = document.getElementById("bulkCsvInput").value.trim();
    if (!csv) {
      alert("Please paste CSV data.");
      return;
    }

    await window.processBulkUpload(csv);
    modal.remove();
  };
};


// =========================================================
// FLEXIBLE BULK CSV PARSER + UPLOADER
// =========================================================

window.processBulkUpload = async function(csvText) {
  const project = window.portalState?.project;
  if (!project) {
    alert("No project selected.");
    return;
  }

  // Normalize CSV lines
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    alert("CSV must include a header row and at least one data row.");
    return;
  }

  // Normalize header row
  const rawHeaders = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
  
  // Flexible column mapping
  const columnMap = {
    client: "customer_name",
    customer: "customer_name",
    name: "customer_name",

    invoicedate: "transaction_date",
    date: "transaction_date",
    paymentdate: "transaction_date",

    invoicenumber: "invoice_number",
    invoiceno: "invoice_number",
    number: "invoice_number",

    description: "description",
    memo: "description",
    notes: "description",

    quantity: "quantity",
    qty: "quantity",

    salesprice: "sales_price",
    price: "sales_price",
    rate: "sales_price",

    amount: "amount",
    total: "amount",
    paymentamount: "amount",

    reftype: "ref_type",
    type: "ref_type",
    category: "ref_type"
  };

  // Map header → staging field
  const mappedHeaders = rawHeaders.map(h => columnMap[h] || null);

  const rows = [];

  // Parse each row
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim());

    const row = {
      project,
      status: "uploaded",
      needs_review: true,
      origin: "csv"
    };

    for (let j = 0; j < cols.length; j++) {
      const field = mappedHeaders[j];
      if (!field) continue; // ignore unmapped columns

      row[field] = cols[j] || null;
    }

    // Default ref_type if missing
    if (!row.ref_type) row.ref_type = "payment";

    // Required fields check
    if (!row.customer_name || !row.amount || !row.transaction_date) {
      row.error_message = "Missing required fields";
    }

    rows.push(row);
  }

  // Send to Worker
  const res = await fetch(
    `https://financials-module.dennis-e64.workers.dev/staging/bulk-upload`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows)
    }
  );

  if (!res.ok) {
    alert("Bulk upload failed.");
    return;
  }

  alert("Bulk upload complete.");
  loadStagingData();
};



/* =========================================================
   ACTION BUTTON LOGIC (Insert gating)
========================================================= */

function renderStagingActionButton(row) {
  const hasContact = !!row.contact_id;

  // Only block insert if contact is missing
  if (!hasContact) {
    return `<span style="color:red;">Missing contact</span>`;
  }

  switch (row.status) {
    case "uploaded":
      return `<button onclick="autoMatchContact('${row.id}')">Populate</button>`;

    case "matched":
    case "ready":
      return `<button onclick="insertStagingRow('${row.id}')">Insert</button>`;

    case "error":
      return `<button onclick="fixRow('${row.id}')">Fix Row</button>`;

    case "imported":
      return `<span style="color:green;">Imported</span>`;

    default:
      return "";
  }
}
