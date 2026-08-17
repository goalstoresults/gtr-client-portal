// financials/tab-add.js
// Add tab: manual payment entry + bulk import + staging trigger

import { escapeHtml, renderContactPicker } from "../utilities.js";
import "./tab-add-staging.js";
import { renderFinancialList } from "./tab-list.js";

/* =========================================================
   BACKEND INSERT: Add Payment With Referral
========================================================= */

export async function addPaymentWithReferral({
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

/* =========================================================
   RENDER: Add Tab
========================================================= */

export async function renderFinancialAdd(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h3>Financials – Add Payment </h3>
      <div id="contactPickerArea"></div>
    </section>

    <div style="margin-top:16px; display:flex; gap:12px;">
      <button id="btnLoadStaging" class="btn-primary">Review Bulk Data</button>
      <button id="btnAddBulk" class="btn-secondary">Add Bulk</button>
    </div>

    <div id="stagingGrid" style="margin-top:16px;"></div>
  `;

  // Render contact picker
  const pickerArea = document.getElementById("contactPickerArea");
  await renderContactPicker(pickerArea, portalState, async (contact) => {
    const formArea = document.createElement("div");
    await renderAddPaymentForm(formArea, portalState, contact);
    container.appendChild(formArea);
  });

  // Wire staging button
  document.getElementById("btnLoadStaging").addEventListener("click", () => {
     window.loadStagingData();
  });

  // Wire bulk upload button
  document.getElementById("btnAddBulk").addEventListener("click", () => {
    if (typeof window.showBulkUploadModal === "function") {
      window.showBulkUploadModal();
    } else {
      alert("Bulk upload modal not available.");
    }
  });
}

/* =========================================================
   RENDER: Add Payment Form
========================================================= */

async function renderAddPaymentForm(formArea, portalState, contact) {
  formArea.innerHTML = `
    <section class="card">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
        <h3 style="margin:0;">Add Payment for ${escapeHtml(contact.search_name || contact.contact_id)}</h3>
        ${portalState.canEdit
        ? `<button id="btnSavePayment" class="btn-primary">Save</button>`
        : ``}
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
