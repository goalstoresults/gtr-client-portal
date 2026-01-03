// financials/tab-add.js
// Add tab: manual payment entry + bulk import + staging trigger

import { escapeHtml, renderContactPicker } from "./utilities.js";
import { loadStagingData } from "./tab-add-staging.js";
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

  // Render contact picker
  const pickerArea = document.getElementById("contactPickerArea");
  await renderContactPicker(pickerArea, portalState, async (contact) => {
    const formArea = document.createElement("div");
    await renderAddPaymentForm(formArea, portalState, contact);
    container.appendChild(formArea);
  });

  // Wire staging button
  document.getElementById("btnLoadStaging").addEventListener("click", () => {
    loadStagingData();
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
    // Simple CSV parser
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

    // Switch to List tab
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
