// js/financials/financials_render.js
// =========================================================
// EXPORTED RENDER + UI FUNCTIONS FOR FINANCIALS MODULE
// =========================================================

import { escapeHtml, renderContactPicker, formatCurrency } from "../utilities.js";

/* =========================================================
   STAGING — TOP BLOCK (window.* functions)
========================================================= */

export async function autoMatchContact(id) {
  const project = window.portalState?.project;
  if (!project) {
    alert("No project selected.");
    return;
  }

  await fetch(
    `https://financials-module.dennis-e64.workers.dev/staging/auto-match?id=${id}&project=${project}`
  );

  loadStagingData();
}

export async function insertStagingRow(id) {
  const project = window.portalState?.project;
  if (!project) {
    alert("No project selected.");
    return;
  }

  const rowEl = document.querySelector(`#row-${id}`);
  if (!rowEl) return;

  const contact = rowEl.querySelector(".contact-cell")?.textContent.trim();

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
}

export async function fixRow(id) {
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
}

export function refreshStagingGrid() {
  loadStagingData();
}

/* =========================================================
   LOAD STAGING DATA (UI ENTRY POINT)
========================================================= */

export async function loadStagingData() {
  const project = window.portalState?.project;
  if (!project) {
    console.error("No project selected.");
    renderStagingGrid([]);
    return;
  }

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

/* =========================================================
   ADD PAYMENT UI
========================================================= */

export async function renderFinancialAdd(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h3>Financials – Add Payment</h3>
      <div id="contactPickerArea"></div>
    </section>

    <div style="margin-top:16px;">
      <button id="btnLoadStaging" class="btn-primary" style="background-color:#007bff;">
        Review Bulk Data
      </button>
    </div>

    <div id="stagingGrid" style="margin-top:16px;"></div>
  `;

  const pickerArea = document.getElementById("contactPickerArea");
  await renderContactPicker(pickerArea, portalState, async (contact) => {
    const formArea = document.createElement("div");
    await renderAddPaymentForm(formArea, portalState, contact);
    container.appendChild(formArea);
  });

  document.getElementById("btnLoadStaging").addEventListener("click", () => {
    loadStagingData();
  });
}

export async function renderAddPaymentForm(formArea, portalState, contact) {
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
      await fetch(
        `https://financials-module.dennis-e64.workers.dev/payments/add`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project: portalState.project,
            contact_id: contact.contact_id,
            payment_amount: parseFloat(amount),
            payment_date: date,
            invoice_number: invoice || null
          })
        }
      );

      alert("Payment added");
    } catch (err) {
      console.error(err);
      alert("Failed to add payment");
    }
  });
}

/* =========================================================
   BULK IMPORT UI
========================================================= */

export async function startBulkImport(portalState) {
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

  const res = await fetch(
    `https://financials-module.dennis-e64.workers.dev/payments/import?project=${portalState.project}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows)
    }
  );

  if (res.ok) {
    alert("Bulk import complete");
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

/* =========================================================
   LIST UI
========================================================= */

export async function renderFinancialList(container, portalState) {
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
    sortPayments();

    const headerHtml = columns.map(col => {
      const isSorted = currentSortField === col.key;
      const upArrow = isSorted && currentSortDirection === "asc" ? "▲" : "△";
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
