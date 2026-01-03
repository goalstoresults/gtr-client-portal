// financials_render.js
// UI Rendering for Financials (Add, List, Summary, Staging Grid)

import {
  escapeHtml,
  renderContactPicker,
  formatCurrency,
  formatDateTimeFull
} from "./utilities.js";

import { addPaymentWithReferral } from "./financials_logic.js";
import {
  loadStagingData
} from "./financials_staging.js";

import {
  summarizeByClient,
  summarizeByReferral,
  summarizeByYear,
  summarizeByYearClient,
  summarizeByYearReferral,
  summarizeByGroup,
  summarizeByGroupYear
} from "./financials_logic.js";

/* =========================================================
   ADD PAYMENT
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


/* =========================================================
   BULK IMPORT
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
   LIST VIEW
========================================================= */

export async function renderFinancialList(container, portalState) {
  // fetch payments
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

  // fetch contacts
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


/* =========================================================
   SUMMARY VIEW
========================================================= */

export async function renderFinancialSummary(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h3>Financial Summary</h3>

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
   SUMMARY YEARS
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
   SUMMARY DATA
========================================================= */

async function loadSummaryData(portalState) {
  const type = document.getElementById("summaryType").value;
  const year = document.getElementById("summaryYear").value;

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

  if (year !== "all") {
    payments = payments.filter(p => {
      if (!p.payment_date) return false;
      return new Date(p.payment_date).getFullYear().toString() === year;
    });
  }

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

    case "group":
      summaryRows = summarizeByGroup(payments, groupByContactId, nameById);
      break;

    case "group_year":
      summaryRows = summarizeByGroupYear(payments, groupByContactId, nameById);
      break;
  }

  renderSummaryGrid(summaryRows, type);
}
