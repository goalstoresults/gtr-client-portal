// financials/tab-list.js
// List tab: revenue listing, sorting, editing, deleting

import { escapeHtml, formatCurrency, formatDateTime, formatDateOnly } from "../utilities.js";

/* =========================================================
   RENDER: Revenue List
========================================================= */

export async function renderFinancialList(container, portalState) {
  /* ---------------------------------------------------------
     1) Fetch revenue rows
  --------------------------------------------------------- */
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

  /* ---------------------------------------------------------
     2) Fetch contacts for name lookup
  --------------------------------------------------------- */
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

  /* ---------------------------------------------------------
     3) Normalize revenue rows
  --------------------------------------------------------- */
  payments = payments.map(p => ({
    ...p,
    revenue_id: p.revenue_id,
    transaction_date: p.transaction_date,
    amount: Number(p.amount) || 0,
    contact_name: nameById.get(p.contact_id) || "",
    referral_name: nameById.get(p.referral_id) || ""
  }));

  /* ---------------------------------------------------------
     Sorting state
  --------------------------------------------------------- */
  let currentSortField = "transaction_date";
  let currentSortDirection = "desc";

  const columns = [
    { key: "transaction_date", label: "Date", isDate: true },
    { key: "contact_name", label: "Contact" },
    { key: "amount", label: "Amount", numeric: true },
    { key: "invoice_number", label: "Invoice #" },
    { key: "referral_name", label: "Referral" },
    { key: "actions", label: "Actions" }
  ];

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

  /* ---------------------------------------------------------
     Render table
  --------------------------------------------------------- */
  function renderTable() {
    sortPayments();

    /* ---------- HEADER ---------- */
    const headerHtml = columns
      .map(col => {
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
      })
      .join("");

    /* ---------- ROWS ---------- */
    const rowsHtml = payments
      .map(
        p => `
      <tr data-id="${p.revenue_id}">
        <td>${escapeHtml(formatDateOnly(p.transaction_date))}</td>
        <td>${escapeHtml(p.contact_name)}</td>
        <td class="right">${escapeHtml(formatCurrency(p.amount))}</td>
        <td>${escapeHtml(p.invoice_number || "")}</td>
        <td>${escapeHtml(p.referral_name || "")}</td>
        <td>
          <button class="btn-secondary btn-edit" data-id="${p.revenue_id}">Edit</button>
          ${portalState.deleteAllowed ? `<button class="btn-danger btn-delete" data-id="${p.revenue_id}">Delete</button>` : ``}
        </td>
      </tr>

      <tr class="edit-row" id="edit-${p.revenue_id}" style="display:none;">
        <td colspan="6">
          <div class="edit-container" style="display:flex; gap:1rem; align-items:center;">
            <label>Date:
              <input type="date" class="edit-date" value="${p.transaction_date?.split("T")[0] || ""}">
            </label>
            <label>Amount:
              <input type="number" class="edit-amount" value="${p.amount}">
            </label>
            <label>Invoice #:
              <input type="text" class="edit-invoice" value="${p.invoice_number || ""}">
            </label>
            ${portalState.canEdit ? `<button class="btn-primary btn-save" data-id="${p.revenue_id}">Save</button>` : ''}
            <button class="btn-tertiary btn-cancel" data-id="${p.revenue_id}">Cancel</button>
          </div>
        </td>
      </tr>
    `
      )
      .join("");

    /* ---------- FINAL HTML ---------- */
    container.innerHTML = `
      <section class="card">
        <h3>Revenue List</h3>
        <table class="notes-table">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="6">(no revenue found)</td></tr>`}
          </tbody>
        </table>
      </section>
    `;

    /* ---------- SORT EVENTS ---------- */
    container.querySelectorAll("th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.dataset.field;

        currentSortDirection =
          currentSortField === field
            ? currentSortDirection === "asc"
              ? "desc"
              : "asc"
            : "asc";

        currentSortField = field;
        renderTable();
      });
    });

    /* ---------- EDIT EVENTS ---------- */
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

    /* ---------- SAVE EVENTS ---------- */
    container.querySelectorAll(".btn-save").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const row = container.querySelector(`#edit-${id}`);

        const date = row.querySelector(".edit-date").value;
        const amount = Number(row.querySelector(".edit-amount").value);
        const invoice = row.querySelector(".edit-invoice").value;

        await fetch(
          `https://financials-module.dennis-e64.workers.dev/payments/update`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              payment_id: id,            // Worker still expects this external name
              payment_date: date,        // Worker converts to transaction_date
              payment_amount: amount,    // Worker converts to amount
              invoice_number: invoice,
              project: portalState.project
            })
          }
        );

        renderFinancialList(container, portalState);
      });
    });

    /* ---------- DELETE EVENTS ---------- */
    container.querySelectorAll(".btn-delete").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!confirm("Delete this revenue entry? This cannot be undone.")) return;

        await fetch(
          `https://financials-module.dennis-e64.workers.dev/payments/delete`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payment_id: id, project: portalState.project })
          }
        );

        renderFinancialList(container, portalState);
      });
    });
  }

  renderTable();
}
