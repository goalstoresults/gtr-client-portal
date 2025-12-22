// js/financials.js v2.2
// Load Financials Tab with subtab switching + tab-level context bar

import { escapeHtml, renderContactPicker } from "./utilities.js";

window.autoMatchContact = async function(id) {
  const btn = document.querySelector(`#row-${id} .action-cell button`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Matching...";
  }

  const res = await fetch(
    `https://financials-module.dennis-e64.workers.dev/staging/auto-match?id=${id}&project=snf`
  );
  const data = await res.json();

  // Find the row in the DOM
  const rowEl = document.querySelector(`#row-${id}`);
  if (!rowEl) return;

  const actionCell = rowEl.querySelector(".action-cell");
  const contactCell = rowEl.querySelector(".contact-cell");
  const statusCell = rowEl.querySelector(".status-cell");

  if (res.ok && data?.contact_id) {
    // Update contact_id cell
    if (contactCell) contactCell.textContent = data.contact_id;

    // Update status cell
    if (statusCell) {
      statusCell.textContent = "matched";
      statusCell.style.color = "green";
    }

    // Replace action button with Insert
    if (actionCell) {
      actionCell.innerHTML = `
        <button onclick="insertStagingRow('${id}')">Insert</button>
      `;
    }
  } else {
    // No match found
    if (statusCell) {
      statusCell.textContent = "no match";
      statusCell.style.color = "red";
    }

    if (actionCell) {
      actionCell.innerHTML = `
        <span style="color:red;">No match found</span>
      `;
    }
  }
};

window.insertStagingRow = async function(id) {
  const rowEl = document.querySelector(`#row-${id}`);
  if (!rowEl) return;

  const actionCell = rowEl.querySelector(".action-cell");
  const statusCell = rowEl.querySelector(".status-cell");
  const errorCell = rowEl.querySelector(".error-cell");

  if (actionCell) {
    actionCell.innerHTML = `<span style="color:#555;">Inserting...</span>`;
  }

  // Call backend to insert this staging row
  const res = await fetch(
    `https://financials-module.dennis-e64.workers.dev/payments/add-from-staging?id=${id}&project=snf`,
    { method: "POST" }
  );

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (res.ok) {
    // SUCCESS
    if (statusCell) {
      statusCell.textContent = "imported";
      statusCell.style.color = "green";
    }

    if (errorCell) {
      errorCell.textContent = "";
    }

    if (actionCell) {
      actionCell.innerHTML = `<span style="color:green;">Imported</span>`;
    }
  } else {
    // FAILURE
    const msg = data.error || "Insert failed";

    if (statusCell) {
      statusCell.textContent = "error";
      statusCell.style.color = "red";
    }

    if (errorCell) {
      errorCell.textContent = msg;
    }

    if (actionCell) {
      actionCell.innerHTML = `
        <button onclick="fixRow('${id}')">Fix Row</button>
      `;
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

  // Build modal
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

  // Cancel
  modal.querySelector("#fix_cancel").onclick = () => modal.remove();

  // Save
  modal.querySelector("#fix_save").onclick = async () => {
    const updated = {
      id,
      customer_name: document.getElementById("fix_customer").value.trim(),
      invoice_number: document.getElementById("fix_invoice").value.trim(),
      payment_date: document.getElementById("fix_date").value.trim(),
      payment_amount: document.getElementById("fix_amount").value.trim(),
      contact_id: document.getElementById("fix_contact").value.trim() || null,
      status: "ready",
      error_message: ""
    };

    // Send update to backend
    await fetch(
      `https://financials-module.dennis-e64.workers.dev/staging/update?project=snf`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      }
    );

    // Update row inline
    rowEl.children[0].textContent = updated.customer_name;
    rowEl.children[1].textContent = updated.invoice_number;
    rowEl.children[2].textContent = updated.payment_date;
    rowEl.children[3].textContent = updated.payment_amount;
    rowEl.querySelector(".contact-cell").textContent =
      updated.contact_id || "(none)";

    const statusCell = rowEl.querySelector(".status-cell");
    statusCell.textContent = "ready";
    statusCell.style.color = "orange";

    const errorCell = rowEl.querySelector(".error-cell");
    errorCell.textContent = "";

    const actionCell = rowEl.querySelector(".action-cell");
    actionCell.innerHTML = `<button onclick="insertStagingRow('${id}')">Insert</button>`;

    modal.remove();
  };
};

function closeModal(modal) {
  if (modal && modal.remove) {
    modal.remove();
  }
}


window.refreshStagingGrid = function() {
  loadStagingData();
};


window.loadStagingData = async function() {
  const container = document.getElementById("stagingGrid");
  if (container) {
    container.innerHTML = `<p style="padding:8px;">Loading staging data...</p>`;
  }

  const res = await fetch(
    `https://financials-module.dennis-e64.workers.dev/staging/list?project=snf`
  );

  let rows = [];
  try {
    rows = await res.json();
  } catch {
    rows = [];
  }

  renderStagingGrid(rows);
};


// ------------------------------------------------------------
// FRONTEND: Canonical call to backend payment insert
// ------------------------------------------------------------
async function addPaymentWithReferral({ project, contact_id, payment_amount, payment_date, invoice_number }) {
  const res = await fetch(`https://financials-module.dennis-e64.workers.dev/payments/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project,
      contact_id,
      payment_amount,
      payment_date,
      invoice_number
    })
  });

  if (!res.ok) {
    throw new Error("Payment insert failed");
  }

  return await res.json();
}



export async function loadFinancialsTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/financials.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  // Inject financials context bar (above subtabs) — mirrors Contacts v2.0
  let contextBar = document.getElementById("financials-context-bar");
  if (!contextBar) {
    contextBar = document.createElement("div");
    contextBar.id = "financials-context-bar";
    contextBar.className = "contact-context-bar";
    tabContent.prepend(contextBar);
  }
  contextBar.textContent = portalState.selectedContactName
    ? `Contact: ${portalState.selectedContactName}`
    : "No contact selected";

  const content = tabContent.querySelector("#financialsContent");
  const buttons = tabContent.querySelectorAll("#financials-subtabs button");

  // Wire subtab buttons
  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;
      if (subtab === "add") {
        await renderFinancialAdd(content, portalState);
        return;
      }
      if (subtab === "list") {
        await renderFinancialList(content, portalState);
        return;
      }
      if (subtab === "summary") {
        await renderFinancialSummary(content, portalState);
        return;
      }

      content.innerHTML = `
        <section class="card">
          <p>Select a subtab to begin.</p>
        </section>
      `;
    });
  });

  // Default to List view
  const defaultBtn = tabContent.querySelector('#financials-subtabs button[data-subtab="list"]');
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    await renderFinancialList(content, portalState);
  }
}

/* ---------- Add ---------- */

async function renderFinancialAdd(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h3>Financials – Add Payment</h3>
      <div id="contactPickerArea"></div>
    </section>

    <!-- ✅ Review Bulk Data button -->
    <div style="margin-top:16px;">
      <button id="btnLoadStaging" class="btn-primary" style="background-color:#007bff;">
        Review Bulk Data
      </button>
    </div>

    <!-- ✅ Staging grid area -->
    <div id="stagingGrid" style="margin-top:16px;"></div>
  `;

  // ✅ Render contact picker inside the card (unchanged)
  const pickerArea = document.getElementById("contactPickerArea");
  await renderContactPicker(pickerArea, portalState, async (contact) => {
    const formArea = document.createElement("div");
    await renderAddPaymentForm(formArea, portalState, contact);
    container.appendChild(formArea);
  });

  // ✅ Wire up Review Bulk Data button
  document.getElementById("btnLoadStaging").addEventListener("click", () => {
    loadStagingData();
  });
}

async function renderAddPaymentForm(formArea, portalState, contact) {
  formArea.innerHTML = `
    <section class="card">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
        <h3 style="margin:0;">Add Payment for ${escapeHtml(contact.search_name || contact.contact_id)}</h3>
        <button id="btnSavePayment" class="btn-primary">Save</button>
      </div>

      <div class="notes-row">
        <label class="notes-label">Amount</label>
        <input id="paymentAmount" class="form-control" type="number" step="0.01" />
      </div>
      <div class="notes-row">
        <label class="notes-label">Date</label>
        <input id="paymentDate" class="form-control" type="date" />
      </div>
      <div class="notes-row">
        <label class="notes-label">Invoice #</label>
        <input id="invoiceNumber" class="form-control" />
      </div>
    </section>
  `;

  formArea.querySelector("#btnSavePayment").addEventListener("click", async () => {
    const amount = formArea.querySelector("#paymentAmount").value.trim();
    const date = formArea.querySelector("#paymentDate").value.trim();
    const invoice = formArea.querySelector("#invoiceNumber").value.trim();

    if (!amount || !date) {
      alert("Amount and Date are required");
      return;
    }

    try {
      await addPaymentWithReferral({
        project: portalState.project,
        contact_id: contact.contact_id,
        payment_amount: parseFloat(amount),
        payment_date: date,
        invoice_number: invoice || null
      });

      alert("Payment added");
    } catch (err) {
      console.error(err);
      alert("Failed to add payment");
    }
  });
}





/* ---------- Bulk Add ---------- */
async function startBulkImport(portalState) {
  const fileInput = document.getElementById("bulkFileInput");
  if (!fileInput.files.length) {
    alert("Please select a file first");
    return;
  }

  const file = fileInput.files[0];
  const text = await file.text();
  let rows = [];

  if (file.name.endsWith(".json")) {
    rows = JSON.parse(text);
  } else {
    // Simple CSV parser: assumes header row
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    rows = lines.slice(1).map(line => {
      const cols = line.split(",");
      return {
        customer_name: cols[headers.indexOf("customer name")]?.trim(),
        invoice_number: cols[headers.indexOf("invoice number")]?.trim(),
        payment_date: cols[headers.indexOf("payment date")]?.trim(),
        payment_amount: cols[headers.indexOf("payment amount")]?.trim()
      };
    });
  }

  // Send to backend import endpoint
  const res = await fetch(`https://financials-module.dennis-e64.workers.dev/payments/import?project=${portalState.project}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows)
  });

  if (res.ok) {
    alert("Bulk import complete");
    // Refresh list view
    const listBtn = document.querySelector('#financials-subtabs button[data-subtab="list"]');
    if (listBtn) {
      listBtn.classList.add("active");
      const content = document.querySelector("#financialsContent");
      await renderFinancialList(content, portalState);
    }
  } else {
    alert("Bulk import failed");
  }
}



/* ---------- List ---------- */

async function renderFinancialList(container, portalState) {
  // 1) Fetch payments
  const paymentsRes = await fetch(
    `https://financials-module.dennis-e64.workers.dev/payments/list?project=${portalState.project}&limit=500`,
    { cache: "no-cache" }
  );
  let payments = [];
  try {
    const j = await paymentsRes.json();
    payments = Array.isArray(j) ? j : (Array.isArray(j?.data) ? j.data : []);
  } catch {
    payments = [];
  }

  // 2) Fetch contacts for name lookup
  const contactsRes = await fetch(
    `https://contacts-module.dennis-e64.workers.dev/contacts/list?project=${portalState.project}&limit=2000`,
    { cache: "no-cache" }
  );
  let contacts = [];
  try {
    const cj = await contactsRes.json();
    contacts = Array.isArray(cj) ? cj : (Array.isArray(cj?.data) ? cj.data : []);
  } catch {
    contacts = [];
  }

  const nameById = new Map();
  for (const c of contacts) {
    nameById.set(c.contact_id, c.search_name || c.contact_name || c.contact_id);
  }

  // Sorting state
  let currentSortField = "payment_date";
  let currentSortDirection = "desc";

  // Columns definition
  const columns = [
    { key: "payment_date", label: "Date", isDate: true },
    { key: "contact_name", label: "Contact" },
    { key: "payment_amount", label: "Amount", numeric: true },
    { key: "invoice_number", label: "Invoice #" },
    { key: "referral_name", label: "Referral" }
  ];

  // Preprocess rows
  payments = payments.map(p => ({
    ...p,
    contact_name: nameById.get(p.contact_id) || "",
    referral_name: nameById.get(p.referral_id) || "",
    payment_amount: Number(p.payment_amount) || 0
  }));

  function sortPayments() {
    payments.sort((a, b) => {
      let A = a[currentSortField];
      let B = b[currentSortField];

      if (columns.find(c => c.key === currentSortField)?.isDate) {
        A = new Date(A);
        B = new Date(B);
      } else if (columns.find(c => c.key === currentSortField)?.numeric) {
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
    sortPayments();

    const headerHtml = columns.map(col => {
      const isSorted = currentSortField === col.key;
      const upArrow   = isSorted && currentSortDirection === "asc"  ? "▲" : "△";
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
    }).join("");

    const rowsHtml = payments.map(p => `
      <tr>
        <td>${escapeHtml(formatDateTimeFull(p.payment_date))}</td>
        <td>${escapeHtml(p.contact_name)}</td>
        <td>${escapeHtml(p.payment_amount.toFixed(2))}</td>
        <td>${escapeHtml(p.invoice_number || "")}</td>
        <td>${escapeHtml(p.referral_name || "")}</td>
        <td>
          <input type="checkbox"
                 class="needsReviewCheckbox"
                 data-id="${p.payment_id}"
                 ${p.needs_review ? "checked" : ""} />
        </td>
      </tr>
    `).join("");

    container.innerHTML = `
      <section class="card">
        <h3>Payments List</h3>
        <table class="notes-table">
          <thead>
            <tr>
              ${headerHtml}
              <th>Needs Review</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="6">(no payments found)</td></tr>`}
          </tbody>
        </table>
      </section>
    `;

    // Wire sorting
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

    // Wire checkbox updates
    container.querySelectorAll(".needsReviewCheckbox").forEach(cb => {
      cb.addEventListener("change", async (e) => {
        const paymentId = e.target.dataset.id;
        const checked = e.target.checked;
        try {
          await fetch(`https://financials-module.dennis-e64.workers.dev/payments/updateNeedsReview`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              payment_id: paymentId,
              needs_review: checked,
              project: portalState.project
            })
          });
        } catch (err) {
          e.target.checked = !checked;
          alert("Update failed. Please try again.");
        }
      });
    });
  }

  renderTable();
}




/* ---------- Summary ---------- */

async function renderFinancialSummary(container, portalState) {
  const url = `https://financials-module.dennis-e64.workers.dev/payments/summary?project=${portalState.project}`;
  const res = await fetch(url, { cache: "no-cache" });
  let summary = await res.json();
  if (!Array.isArray(summary)) summary = [];

  // Sorting state
  let currentSortField = "referral_name";
  let currentSortDirection = "asc";

  const columns = [
    { key: "referral_name", label: "Referral" },
    { key: "total_amount", label: "Total Amount", numeric: true },
    { key: "count", label: "Count", numeric: true }
  ];

  function sortSummary() {
    summary.sort((a, b) => {
      let A = a[currentSortField];
      let B = b[currentSortField];

      if (columns.find(c => c.key === currentSortField)?.numeric) {
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
    sortSummary();

    const headerHtml = columns.map(col => {
      const isSorted = currentSortField === col.key;
      const upArrow   = isSorted && currentSortDirection === "asc"  ? "▲" : "△";
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
    }).join("");

    const rowsHtml = summary.map(s => `
      <tr>
        <td>${escapeHtml(s.referral_name || s.referral_id || "")}</td>
        <td>${escapeHtml((Number(s.total_amount) || 0).toFixed(2))}</td>
        <td>${escapeHtml(s.count || "")}</td>
      </tr>
    `).join("");

    container.innerHTML = `
      <section class="card">
        <h3>Payments Summary</h3>
        <table class="notes-table">
          <thead>
            <tr>${headerHtml}</tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="3">(no summary data)</td></tr>`}
          </tbody>
        </table>
      </section>
    `;

    // Wire sorting
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
  }

  renderTable();
}

function renderStagingGrid(rows) {
  const container = document.getElementById("stagingGrid");
  container.innerHTML = `
    <div style="margin-bottom:10px;">
      <button id="refreshStagingGrid" class="btn-primary">Refresh Grid</button>
    </div>
  `;

  if (!rows.length) {
    container.innerHTML += "<p>No staging rows found.</p>";
    return;
  }

  const table = document.createElement("table");
  table.style = "width:100%; border-collapse:collapse; margin-top:12px;";
  table.innerHTML = `
    <thead>
      <tr style="background:#f0f0f0;">
        <th style="padding:6px;">Customer</th>
        <th style="padding:6px;">Invoice #</th>
        <th style="padding:6px;">Date</th>
        <th style="padding:6px;">Amount</th>
        <th style="padding:6px;">Contact ID</th>
        <th style="padding:6px;">Status</th>
        <th style="padding:6px;">Error</th>
        <th style="padding:6px;">Action</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) => `
        <tr id="row-${row.id}">
          <td style="padding:6px;">${row.customer_name || ""}</td>
          <td style="padding:6px;">${row.invoice_number || ""}</td>
          <td style="padding:6px;">${row.payment_date || ""}</td>
          <td style="padding:6px;">${row.payment_amount || ""}</td>
          <td class="contact-cell" style="padding:6px;">${row.contact_id || "(none)"}</td>
          <td class="status-cell" style="padding:6px;">${row.status || ""}</td>
          <td class="error-cell" style="padding:6px; color:red;">${row.error_message || ""}</td>
          <td class="action-cell" style="padding:6px;">
            ${renderStagingActionButton(row)}
          </td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  `;

  container.appendChild(table);

  document
    .getElementById("refreshStagingGrid")
    .addEventListener("click", loadStagingData);
}

function renderStagingActionButton(row) {
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
    case "skipped":
      return `<span style="color:gray;">Skipped</span>`;
    default:
      return "";
  }
}


async function autoMatchContact(id) {
  const res = await fetch(`https://financials-module.dennis-e64.workers.dev/staging/auto-match?id=${id}&project=snf`);
  const data = await res.json();

  // Reload grid to show updated contact_id
  loadStagingData();
}


async function loadStagingData() {
  const res = await fetch(`https://financials-module.dennis-e64.workers.dev/staging/list?project=snf`);
  const rows = await res.json();
  renderStagingGrid(rows);
}



function formatDateTimeFull(value) {
  if (!value) return "";
  const d = new Date(value);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();

  let hh = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const ampm = hh >= 12 ? "PM" : "AM";
  hh = hh % 12;
  if (hh === 0) hh = 12;

  return `${mm}/${dd}/${yyyy} ${hh}:${min} ${ampm}`;
}
