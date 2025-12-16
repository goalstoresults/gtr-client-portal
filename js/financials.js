// js/financials.js
// 🔧 Load Financials Tab with subtab switching

import { escapeHtml, renderContactPicker } from "./utilities.js";

export async function loadFinancialsTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/financials.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  const content = tabContent.querySelector("#financialsContent");
  const buttons = tabContent.querySelectorAll("#financials-subtabs button");

  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      // Reset active state
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
          content.innerHTML = `
            <section class="card">
              <p>Select a subtab to begin.</p>
            </section>
          `;
      }
    });
  });

  // ✅ Default to List view when tab first loads
  const defaultBtn = tabContent.querySelector('#financials-subtabs button[data-subtab="list"]');
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    await renderFinancialList(content, portalState);
  }
}

// 🔧 Add Payment flow
async function renderFinancialAdd(container, portalState) {
  await renderContactPicker(container, portalState, async (contact) => {
    await renderAddPaymentForm(container, portalState, contact);
  });
}

async function renderAddPaymentForm(container, portalState, contact) {
  container.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>Add Payment for ${escapeHtml(contact.search_name || contact.contact_id)}</h3>
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
      <div class="notes-row">
        <label class="notes-label">Referral ID (optional)</label>
        <input id="referralId" class="form-control" placeholder="UUID" />
      </div>
    </section>
  `;

  document.getElementById("btnSavePayment").addEventListener("click", async () => {
    const amount = document.getElementById("paymentAmount").value.trim();
    const date = document.getElementById("paymentDate").value.trim();
    const invoice = document.getElementById("invoiceNumber").value.trim();
    const referral = document.getElementById("referralId").value.trim();

    if (!amount || !date) {
      alert("Amount and Date are required");
      return;
    }

    await fetch(`https://financials-module.dennis-e64.workers.dev/payments/add?project=${portalState.project}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_id: contact.contact_id,
        payment_amount: amount,
        payment_date: date,
        invoice_number: invoice,
        referral_id: referral || null,
        project: portalState.project
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

// 🔧 List Payments
async function renderFinancialList(container, portalState) {
  const url = `https://financials-module.dennis-e64.workers.dev/payments/list?project=${portalState.project}&limit=500`;
  const res = await fetch(url, { cache: "no-cache" });
  let payments = await res.json();
  if (!Array.isArray(payments)) payments = [];

  container.innerHTML = `
    <section class="card">
      <h3>Payments List</h3>
      <table class="notes-table">
        <thead>
          <tr>
            <th>Date</th><th>Amount</th><th>Invoice #</th><th>Referral</th><th>Contact</th>
          </tr>
        </thead>
        <tbody>
          ${payments.map(p => `
            <tr>
              <td>${escapeHtml(p.payment_date || "")}</td>
              <td>${escapeHtml(p.payment_amount || "")}</td>
              <td>${escapeHtml(p.invoice_number || "")}</td>
              <td>${escapeHtml(p.referral_id || "")}</td>
              <td>${escapeHtml(p.contact_id || "")}</td>
            </tr>
          `).join("") || `<tr><td colspan="5">(no payments found)</td></tr>`}
        </tbody>
      </table>
    </section>
  `;
}

// 🔧 Summary Payments
async function renderFinancialSummary(container, portalState) {
  const url = `https://financials-module.dennis-e64.workers.dev/payments/summary?project=${portalState.project}`;
  const res = await fetch(url, { cache: "no-cache" });
  let summary = await res.json();
  if (!Array.isArray(summary)) summary = [];

  container.innerHTML = `
    <section class="card">
      <h3>Payments Summary</h3>
      <table class="notes-table">
        <thead>
          <tr>
            <th>Referral</th><th>Total Amount</th><th>Count</th>
          </tr>
        </thead>
        <tbody>
          ${summary.map(s => `
            <tr>
              <td>${escapeHtml(s.referral_id || "")}</td>
              <td>${escapeHtml(s.total_amount || "")}</td>
              <td>${escapeHtml(s.count || "")}</td>
            </tr>
          `).join("") || `<tr><td colspan="3">(no summary data)</td></tr>`}
        </tbody>
      </table>
    </section>
  `;
}
