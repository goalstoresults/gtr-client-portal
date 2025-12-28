// js/financials.js v4
// Load Financials Tab with subtab switching + tab-level context bar

import { escapeHtml, renderContactPicker, formatCurrency } from "./utilities.js";

/* =========================================================
   STAGING — TOP BLOCK (window.* functions)
   Updated for referral_id + group_id + filters
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


// ------------------------------------------------------------
// load staging data
// ------------------------------------------------------------
async function loadStagingData() {
  const project = window.portalState?.project;
  if (!project) {
    console.error("No project selected.");
    renderStagingGrid([]);
    return;
  }

  // Default filter: exclude imported
  const filter = document.getElementById("stagingFilter")?.value || "";
  const isDefault = filter === "";

  const url = isDefault
    ? `https://financials-module.dennis-e64.workers.dev/staging/list?project=${project}&status=neq.imported`
    : `https://financials-module.dennis-e64.workers.dev/staging/list?project=${project}&status=${filter}`;

  const res = await fetch(url);

  let rows = [];
  try { rows = await res.json(); } catch {}

  renderStagingGrid(rows);
}


// ------------------------------------------------------------
// FRONTEND: Canonical call to backend payment insert
// ------------------------------------------------------------
async function addPaymentWithReferral({
  project,
  contact_id,
  payment_amount,
  payment_date,
 invoice_number
}) {
  const res = await fetch(
    `https://financials-module.dennis-e64.workers.dev/payments/add`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project,
        contact_id,
        payment_amount,
        payment_date,
        invoice_number
      })
    }
  );

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

  const columns = [
    { key: "payment_date", label: "Date", isDate: true },
    { key: "contact_name", label: "Contact" },
    { key: "payment_amount", label: "Amount", numeric: true },
    { key: "invoice_number", label: "Invoice #" },
    { key: "referral_name", label: "Referral" },
    { key: "actions", label: "Actions" }
  ];

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
        <th class="${col.key !== 'actions' ? 'sortable' : ''}" data-field="${col.key}">
          ${escapeHtml(col.label)}
          ${col.key !== 'actions' ? `
            <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
              <span class="sort-up">${upArrow}</span>
              <span class="sort-down">${downArrow}</span>
            </span>` : ""}
        </th>
      `;
    }).join("");

    const rowsHtml = payments.map(p => `
      <tr data-id="${p.payment_id}">
        <td>${escapeHtml(formatDateTimeFull(p.payment_date))}</td>
        <td>${escapeHtml(p.contact_name)}</td>
        <td class="right">${escapeHtml(formatCurrency(p.payment_amount))}</td>
        <td>${escapeHtml(p.invoice_number || "")}</td>
        <td>${escapeHtml(p.referral_name || "")}</td>
        <td>
          <button class="btn-secondary btn-edit" data-id="${p.payment_id}">Edit</button>
          <button class="btn-danger btn-delete" data-id="${p.payment_id}">Delete</button>
        </td>
      </tr>
      <tr class="edit-row" id="edit-${p.payment_id}" style="display:none;">
        <td colspan="6">
          <div class="edit-container" style="display:flex; gap:1rem; align-items:center;">
            <label>Date:
              <input type="date" class="edit-date" value="${p.payment_date.split('T')[0]}">
            </label>
            <label>Amount:
              <input type="number" class="edit-amount" value="${p.payment_amount}">
            </label>
            <label>Invoice #:
              <input type="text" class="edit-invoice" value="${p.invoice_number || ""}">
            </label>
            <button class="btn-primary btn-save" data-id="${p.payment_id}">Save</button>
            <button class="btn-tertiary btn-cancel" data-id="${p.payment_id}">Cancel</button>
          </div>
        </td>
      </tr>
    `).join("");

    container.innerHTML = `
      <section class="card">
        <h3>Payments List</h3>
        <table class="notes-table">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${rowsHtml || `<tr><td colspan="6">(no payments found)</td></tr>`}</tbody>
        </table>
      </section>
    `;

    container.querySelectorAll("th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.dataset.field;
        currentSortDirection = currentSortField === field
          ? (currentSortDirection === "asc" ? "desc" : "asc")
          : "asc";
        currentSortField = field;
        renderTable();
      });
    });

    container.querySelectorAll(".btn-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        const row = container.querySelector(`#edit-${btn.dataset.id}`);
        row.style.display = row.style.display === "none" ? "table-row" : "none";
      });
    });

    container.querySelectorAll(".btn-cancel").forEach(btn => {
      btn.addEventListener("click", () => {
        container.querySelector(`#edit-${btn.dataset.id}`).style.display = "none";
      });
    });

    container.querySelectorAll(".btn-save").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const row = container.querySelector(`#edit-${id}`);
        const date = row.querySelector(".edit-date").value;
        const amount = Number(row.querySelector(".edit-amount").value);
        const invoice = row.querySelector(".edit-invoice").value;

        await fetch(`https://financials-module.dennis-e64.workers.dev/payments/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_id: id,
            payment_date: date,
            payment_amount: amount,
            invoice_number: invoice,
            project: portalState.project
          })
        });

        renderFinancialList(container, portalState);
      });
    });

    container.querySelectorAll(".btn-delete").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!confirm("Delete this payment? This cannot be undone.")) return;

        await fetch(`https://financials-module.dennis-e64.workers.dev/payments/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_id: id, project: portalState.project })
        });

        renderFinancialList(container, portalState);
      });
    });
  }

  renderTable();
}



/* =========================================================
   SUMMARY MODULE (FULL REPLACEMENT)
========================================================= */
async function renderFinancialSummary(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h3>Financial Summary 2</h3>

      <div id="summaryFilters" style="margin-bottom: 12px;">
        <label>Summary Type:</label>
        <select id="summaryType">
          <option value="client">By Client</option>
          <option value="referral">By Referral</option>
          <option value="year">By Year</option>
          <option value="year_client">By Year + Client</option>
          <option value="year_referral">By Year + Referral</option>
          <option value="group">By Group</option>
          <option value="group_year">By Group + Year</option>
        </select>

        <label style="margin-left: 20px;">Year:</label>
        <select id="summaryYear">
          <option value="all">All</option>
        </select>
      </div>

      <div id="summaryGrid"></div>
    </section>
  `;

  await loadSummaryYears(portalState);
  await loadSummaryData(portalState);

  document.getElementById("summaryType").addEventListener("change", () => {
    loadSummaryData(portalState);
  });

  document.getElementById("summaryYear").addEventListener("change", () => {
    loadSummaryData(portalState);
  });
}



/* =========================================================
   LOAD YEARS
========================================================= */

async function loadSummaryYears(portalState) {
  const yearSelect = document.getElementById("summaryYear");

  const res = await fetch(
    `https://financials-module.dennis-e64.workers.dev/payments/list?project=${portalState.project}&limit=2000`,
    { cache: "no-cache" }
  );

  let payments = [];
  try {
    payments = await res.json();
  } catch {
    payments = [];
  }

  const years = new Set();
  for (const p of payments) {
    if (p.payment_date) {
      years.add(new Date(p.payment_date).getFullYear());
    }
  }

  [...years].sort((a, b) => b - a).forEach(y => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  });
}

/* =========================================================
   LOAD SUMMARY DATA
========================================================= */
async function loadSummaryData(portalState) {
  const type = document.getElementById("summaryType").value;
  const year = document.getElementById("summaryYear").value;

  // ============================================================
  // Fetch payments (unfiltered except project + limit)
  // ============================================================
  const payRes = await fetch(
    `https://financials-module.dennis-e64.workers.dev/payments/list?project=${portalState.project}&limit=2000`,
    { cache: "no-cache" }
  );

  let payments = [];
  try {
    payments = await payRes.json();
  } catch {
    payments = [];
  }

  // ============================================================
  // Fetch contacts for name + group lookup
  //   - Non-group summaries: /contacts/list
  //   - Group summaries:     /contacts/list-with-groups
  // ============================================================
  const isGroupSummary = type === "group" || type === "group_year";

  const contactsEndpointPath = isGroupSummary
    ? "/contacts/list-with-groups"
    : "/contacts/list";

  const contactsRes = await fetch(
    `https://contacts-module.dennis-e64.workers.dev${contactsEndpointPath}?project=${portalState.project}&limit=2000`,
    { cache: "no-cache" }
  );

  let contacts = [];
  try {
    contacts = await contactsRes.json();
  } catch {
    contacts = [];
  }

  // Build lookup maps
  const nameById = new Map();
  const groupByContactId = new Map();

  for (const c of contacts) {
    nameById.set(
      c.contact_id,
      c.search_name || c.contact_name || c.contact_id
    );

    const groupId = c.group_id || null;
    const groupName = c.group_name || (groupId || "(none)");

    groupByContactId.set(c.contact_id, {
      group_id: groupId,
      group_name: groupName
    });
  }

  // ============================================================
  // Filter by year (UI-level filter)
  // ============================================================
  if (year !== "all") {
    payments = payments.filter(p => {
      if (!p.payment_date) return false;
      return new Date(p.payment_date).getFullYear().toString() === year;
    });
  }

  // ============================================================
  // Summary selection
  // ============================================================
  let summaryRows = [];

  switch (type) {
    case "client":
      summaryRows = summarizeByClient(payments, nameById);
      break;

    case "referral":
      summaryRows = summarizeByReferral(payments, nameById);
      break;

    case "year":
      summaryRows = summarizeByYear(payments);
      break;

    case "year_client":
      summaryRows = summarizeByYearClient(payments, nameById);
      break;

    case "year_referral":
      summaryRows = summarizeByYearReferral(payments, nameById);
      break;

    // ============================================================
    // GROUP SUMMARIES
    // ============================================================
    case "group":
      summaryRows = summarizeByGroup(payments, groupByContactId, nameById);
      break;

    case "group_year":
      summaryRows = summarizeByGroupYear(payments, groupByContactId, nameById);
      break;
  }

  renderSummaryGrid(summaryRows, type);
}


/* =========================================================
   SUMMARY LOGIC
========================================================= */

function summarizeByClient(payments, nameById) {
  const map = new Map();

  for (const p of payments) {
    const key = p.contact_id;
    if (!map.has(key)) {
      map.set(key, {
        client_name: nameById.get(p.contact_id) || "(unknown)",
        referral_name: nameById.get(p.referral_id) || "(none)",
        total_amount: 0,
        count: 0
      });
    }
    const row = map.get(key);
    row.total_amount += Number(p.payment_amount) || 0;
    row.count++;
  }

  return [...map.values()];
}

function summarizeByReferral(payments, nameById) {
  const map = new Map();

  for (const p of payments) {
    const key = p.referral_id;
    if (!map.has(key)) {
      map.set(key, {
        referral_name: nameById.get(p.referral_id) || "(none)",
        total_amount: 0,
        count: 0,
        clients: new Set()
      });
    }
    const row = map.get(key);
    row.total_amount += Number(p.payment_amount) || 0;
    row.count++;
    row.clients.add(p.contact_id);
  }

  return [...map.values()].map(r => ({
    ...r,
    clients: r.clients.size
  }));
}

function summarizeByYear(payments) {
  const map = new Map();

  for (const p of payments) {
    if (!p.payment_date) continue;
    const year = new Date(p.payment_date).getFullYear();

    if (!map.has(year)) {
      map.set(year, {
        year,
        total_amount: 0,
        count: 0,
        clients: new Set(),
        referrals: new Set()
      });
    }

    const row = map.get(year);
    row.total_amount += Number(p.payment_amount) || 0;
    row.count++;
    row.clients.add(p.contact_id);
    row.referrals.add(p.referral_id);
  }

  return [...map.values()].map(r => ({
    ...r,
    clients: r.clients.size,
    referrals: r.referrals.size
  }));
}

function summarizeByYearClient(payments, nameById) {
  const map = new Map();

  for (const p of payments) {
    if (!p.payment_date) continue;
    const year = new Date(p.payment_date).getFullYear();
    const key = `${year}-${p.contact_id}`;

    if (!map.has(key)) {
      map.set(key, {
        year,
        client_name: nameById.get(p.contact_id) || "(unknown)",
        referral_name: nameById.get(p.referral_id) || "(none)",
        total_amount: 0,
        count: 0
      });
    }

    const row = map.get(key);
    row.total_amount += Number(p.payment_amount) || 0;
    row.count++;
  }

  return [...map.values()];
}

function summarizeByYearReferral(payments, nameById) {
  const map = new Map();

  for (const p of payments) {
    if (!p.payment_date) continue;
    const year = new Date(p.payment_date).getFullYear();
    const key = `${year}-${p.referral_id}`;

    if (!map.has(key)) {
      map.set(key, {
        year,
        referral_name: nameById.get(p.referral_id) || "(none)",
        total_amount: 0,
        count: 0
      });
    }

    const row = map.get(key);
    row.total_amount += Number(p.payment_amount) || 0;
    row.count++;
  }

  return [...map.values()];
}

function summarizeByGroup(payments, groupByContactId, nameById) {
  const map = new Map();

  for (const p of payments) {
    const groupInfo =
      groupByContactId.get(p.referral_id) || { group_id: null, group_name: "(none)" };

    const key = groupInfo.group_id || "(none)";

    if (!map.has(key)) {
      map.set(key, {
        group_id: groupInfo.group_id,
        group_name: groupInfo.group_name,
        total_amount: 0,
        count: 0,
        clients: new Set(),
        referrals: new Set()
      });
    }

    const row = map.get(key);
    row.total_amount += Number(p.payment_amount) || 0;
    row.count++;
    row.clients.add(p.contact_id);
    row.referrals.add(p.referral_id);
  }

  return [...map.values()].map(r => ({
    ...r,
    clients: r.clients.size,
    referrals: r.referrals.size
  }));
}

function summarizeByGroupYear(payments, groupByContactId, nameById) {
  const map = new Map();

  for (const p of payments) {
    if (!p.payment_date) continue;

    const year = new Date(p.payment_date).getFullYear();
    const groupInfo =
      groupByContactId.get(p.referral_id) || { group_id: null, group_name: "(none)" };

    const key = `${groupInfo.group_id || "(none)"}-${year}`;

    if (!map.has(key)) {
      map.set(key, {
        year,
        group_id: groupInfo.group_id,
        group_name: groupInfo.group_name,
        total_amount: 0,
        count: 0,
        clients: new Set(),
        referrals: new Set()
      });
    }

    const row = map.get(key);
    row.total_amount += Number(p.payment_amount) || 0;
    row.count++;
    row.clients.add(p.contact_id);
    row.referrals.add(p.referral_id);
  }

  return [...map.values()].map(r => ({
    ...r,
    clients: r.clients.size,
    referrals: r.referrals.size
  }));
}



/* =========================================================
   RENDER SUMMARY GRID (SORTABLE)
========================================================= */
function renderSummaryGrid(rows, type) {
  const container = document.getElementById("summaryGrid");

  if (!rows.length) {
    container.innerHTML = "<p>No data found.</p>";
    return;
  }

  /* =========================================================
     COLUMN DEFINITIONS (UPDATED LABELS)
  ========================================================= */
  const columnSets = {
    client: [
      { key: "client_name", label: "Client" },
      { key: "total_amount", label: "Total Amount", numeric: true },
      { key: "count", label: "# of Payments", numeric: true },
      { key: "referral_name", label: "Referral" }
    ],
    referral: [
      { key: "referral_name", label: "Referral" },
      { key: "total_amount", label: "Total Amount", numeric: true },
      { key: "count", label: "# of Payments", numeric: true },
      { key: "clients", label: "# of Clients", numeric: true }
    ],
    year: [
      { key: "year", label: "Year", numeric: true },
      { key: "total_amount", label: "Total Amount", numeric: true },
      { key: "count", label: "# of Payments", numeric: true },
      { key: "clients", label: "# of Clients", numeric: true },
      { key: "referrals", label: "# of Referrals", numeric: true }
    ],
    year_client: [
      { key: "year", label: "Year", numeric: true },
      { key: "client_name", label: "Client" },
      { key: "total_amount", label: "Total Amount", numeric: true },
      { key: "count", label: "# of Payments", numeric: true },
      { key: "referral_name", label: "Referral" }
    ],
    year_referral: [
      { key: "year", label: "Year", numeric: true },
      { key: "referral_name", label: "Referral" },
      { key: "total_amount", label: "Total Amount", numeric: true },
      { key: "count", label: "# of Payments", numeric: true }
    ],
    group: [
      { key: "group_name", label: "Group" },
      { key: "total_amount", label: "Total Amount", numeric: true },
      { key: "count", label: "# of Payments", numeric: true },
      { key: "clients", label: "# of Clients", numeric: true },
      { key: "referrals", label: "# of Referrals", numeric: true }
    ],
    group_year: [
      { key: "year", label: "Year", numeric: true },
      { key: "group_name", label: "Group" },
      { key: "total_amount", label: "Total Amount", numeric: true },
      { key: "count", label: "# of Payments", numeric: true },
      { key: "clients", label: "# of Clients", numeric: true },
      { key: "referrals", label: "# of Referrals", numeric: true }
    ]
  };

  const columns = columnSets[type];

  /* =========================================================
     SORTING STATE
  ========================================================= */
  let currentSortField = columns[0].key;
  let currentSortDirection = "asc";

  function sortRows() {
    rows.sort((a, b) => {
      let A = a[currentSortField];
      let B = b[currentSortField];

      const col = columns.find(c => c.key === currentSortField);

      if (col?.numeric) {
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

  /* =========================================================
     CURRENCY FORMATTER
  ========================================================= */
  function formatCurrency(n) {
    return Number(n).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /* =========================================================
     TOTALS CALCULATION (ONLY NUMERIC EXCEPT YEAR)
  ========================================================= */
  function computeTotals(rows, columns) {
    const totals = {};

    for (const col of columns) {
      if (col.numeric && col.key !== "year") {
        totals[col.key] = rows.reduce((sum, r) => {
          return sum + (Number(r[col.key]) || 0);
        }, 0);
      }
    }

    return totals;
  }

  /* =========================================================
     RENDER FUNCTION
  ========================================================= */
  function render() {
    sortRows();

    const totals = computeTotals(rows, columns);

    /* ---------- HEADER ---------- */
    const headerHtml = columns.map(col => {
      const isSorted = currentSortField === col.key;
      const upArrow = isSorted && currentSortDirection === "asc" ? "▲" : "△";
      const downArrow = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

      return `
        <th class="sortable" data-field="${col.key}">
          ${col.label}
          <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
            <span class="sort-up">${upArrow}</span>
            <span class="sort-down">${downArrow}</span>
          </span>
        </th>
      `;
    }).join("");

    /* ---------- BODY ROWS ---------- */
    const rowsHtml = rows.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f9f9f9"};">
        ${columns.map(col => {
          let val = r[col.key];

          if (col.numeric && col.key === "total_amount") {
            val = formatCurrency(val);
          }

          return `<td style="${col.numeric ? "text-align:right;" : ""}">${val}</td>`;
        }).join("")}
      </tr>
    `).join("");

    /* ---------- TOTALS ROW ---------- */
    const totalsRowHtml = `
      <tr style="background:#e8f0fe; font-weight:bold;">
        ${columns.map(col => {
          if (col.numeric && col.key !== "year") {
            const raw = totals[col.key] || 0;
            const val = col.key === "total_amount"
              ? formatCurrency(raw)
              : raw.toLocaleString("en-US");

            return `<td style="text-align:right;">${val}</td>`;
          }
          return `<td></td>`;
        }).join("")}
      </tr>
    `;

    /* ---------- FINAL TABLE ---------- */
    container.innerHTML = `
      <table class="notes-table" style="width:100%; border-collapse:collapse;">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>
          ${rowsHtml}
          ${totalsRowHtml}
        </tbody>
      </table>
    `;

    /* ---------- SORT EVENTS ---------- */
    container.querySelectorAll("th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.dataset.field;

        if (currentSortField === field) {
          currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
        } else {
          currentSortField = field;
          currentSortDirection = "asc";
        }

        render();
      });
    });
  }

  render();
}

/* =========================================================
   STAGING — BOTTOM BLOCK (Rendering)
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
    { key: "referral_id", label: "Referral ID" },   // NEW
    { key: "group_id", label: "Group ID" },         // NEW
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
          <option value="">All</option>
          <option value="missing_contact">Missing Contact</option>
          <option value="missing_referral">Missing Referral</option>
          <option value="missing_group">Missing Group</option>
          <option value="ready">Ready</option>
          <option value="error">Error</option>
          <option value="imported">Imported</option>
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
