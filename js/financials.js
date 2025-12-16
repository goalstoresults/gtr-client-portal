// js/financials.js
console.log("[Financials.js] loaded");

export async function loadFinancialsTab({ portalState, tabContent }) {
  tabContent.innerHTML = `
    <section class="card">
      <nav id="financials-subtabs" class="subtabs" style="margin-bottom:12px;">
        <button data-subtab="add">Add</button>
        <button data-subtab="list">List</button>
        <button data-subtab="summary">Summary</button>
      </nav>
      <div id="financialsContent"></div>
    </section>
  `;

  const content = tabContent.querySelector("#financialsContent");
  const buttons = tabContent.querySelectorAll("#financials-subtabs button");

  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;
      switch (subtab) {
        case "add":
          await renderFinancialAdd(content, portalState);
          break;
        case "list":
          await renderFinancialList(content, portalState);
          break;
        case "summary":
          await renderFinancialSummary(content, portalState);
          break;
        default:
          content.innerHTML = `<section class="card"><p>Select a subtab to begin.</p></section>`;
      }
    });
  });

  // Default to List view
  const defaultBtn = tabContent.querySelector('#financials-subtabs button[data-subtab="list"]');
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    await renderFinancialList(content, portalState);
  }
}

// Add Payment view
async function renderFinancialAdd(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>Add Payment</h3>
        <button id="btnSavePayment" class="btn-primary">Save</button>
      </div>
      <div class="notes-row">
        <label class="notes-label">Contact ID</label>
        <input id="contactId" class="form-control" placeholder="UUID of contact" />
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
      <div class="notes-row">
        <label class="notes-label">Referral ID (optional)</label>
        <input id="referralId" class="form-control" placeholder="UUID" />
      </div>
    </section>
  `;

  document.getElementById("btnSavePayment").addEventListener("click", async () => {
    const contactId = document.getElementById("contactId").value.trim();
    const amount = document.getElementById("paymentAmount").value.trim();
    const date = document.getElementById("paymentDate").value.trim();
    const invoice = document.getElementById("invoiceNumber").value.trim();
    const referral = document.getElementById("referralId").value.trim();

    if (!contactId || !amount || !date) {
      alert("Contact ID, Amount, and Date are required");
      return;
    }

    await fetch(`https://financials-module.dennis-e64.workers.dev/payments/add?project=${portalState.project}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_id: contactId,
        payment_amount: amount,
        payment_date: date,
        invoice_number: invoice,
        referral_id: referral || null
      })
    });

    alert("Payment added");

    const listBtn = document.querySelector('#financials-subtabs button[data-subtab="list"]');
    if (listBtn) {
      listBtn.classList.add("active");
      const content = document.querySelector("#financialsContent");
      await renderFinancialList(content, portalState);
    }
  });
}

// List Payments view
async function renderFinancialList(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h2>Payments for ${escapeHtml(portalState.projects_config?.business_name || portalState.display_name || portalState.project)}</h2>
      <div id="paymentsTable">Loading...</div>
    </section>
  `;

  const tableDiv = container.querySelector("#paymentsTable");
  const url = `https://financials-module.dennis-e64.workers.dev/payments/list?project=${portalState.project}&limit=500`;
  console.log("[Financials] Fetching:", url);

  const res = await fetch(url, { cache: "no-cache" });
  let payments = await res.json();
  if (!Array.isArray(payments)) payments = payments.rows || [];
  if (!Array.isArray(payments)) payments = [];

  tableDiv.innerHTML = `
    <h4>Showing ${payments.length} payments</h4>
    <table class="notes-table">
      <thead>
        <tr>
          <th>Date</th>
          <th class="amount">Amount</th>
          <th>Invoice #</th>
          <th>Referral ID</th>
          <th>Contact ID</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        ${payments.length > 0
          ? payments.map(p => `
              <tr>
                <td>${formatDateTime(p.payment_date)}</td>
                <td class="amount">${formatCurrency(p.payment_amount)}</td>
                <td>${escapeHtml(p.invoice_number || "")}</td>
                <td>${escapeHtml(p.referral_id || "")}</td>
                <td>${escapeHtml(p.contact_id || "")}</td>
                <td>${formatDateTime(p.created_at)}</td>
              </tr>
            `).join("")
          : `<tr><td colspan="6">(no payments found)</td></tr>`
        }
      </tbody>
    </table>
  `;
}

// Summary view
async function renderFinancialSummary(container, portalState) {
  container.innerHTML = `<section class="card"><p>Loading summary...</p></section>`;

  const url = `https://financials-module.dennis-e64.workers.dev/payments/summary?project=${portalState.project}`;
  console.log("[Financials] Fetching summary:", url);

  const res = await fetch(url, { cache: "no-cache" });
  const summary = await res.json();

  container.innerHTML = `
    <section class="card">
      <h3>Financial Summary</h3>
      <p>Total Payments: ${formatCurrency(summary.total)}</p>
      <h4>By Referral</h4>
      <ul>
        ${summary.by_referral.map(r => `<li>${escapeHtml(r.referral_id || "(none)")}: ${formatCurrency(r.total)}</li>`).join("")}
      </ul>
      <h4>By Invoice</h4>
      <ul>
        ${summary.by_invoice.map(i => `<li>${escapeHtml(i.invoice_number || "(none)")}: ${formatCurrency(i.total)}</li>`).join("")}
      </ul>
    </section>
  `;
}

// Helpers
function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

function escapeHtml(str) {
  const s = String(str ?? "");
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function formatCurrency(value) {
  const num = Number(value) || 0;
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
