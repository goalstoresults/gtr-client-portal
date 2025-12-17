// js/financials.js v2.2
// Load Financials Tab with subtab switching + tab-level context bar

import { escapeHtml, renderContactPicker } from "./utilities.js";

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

      <!-- Bulk import area -->
      <div id="bulkAddArea" style="display:none; margin-top:12px;">
        <p>Upload a CSV file with columns: Customer Name, Invoice Number, Payment Date, Payment Amount.</p>
        <input id="bulkFileInput" type="file" accept=".csv,.json" />
        <button id="btnStartBulk" class="btn-primary">Start Import</button>
      </div>
    </section>
  `;

  // Render the generic contact picker
  const pickerArea = document.getElementById("contactPickerArea");
  await renderContactPicker(pickerArea, portalState, async (contact) => {
    const formArea = document.createElement("div");
    await renderAddPaymentForm(formArea, portalState, contact);
    container.appendChild(formArea);
  });

  // 🔑 Add Bulk button underneath filter buttons
  const filterRow = pickerArea.querySelector("div[style*='display:flex']");
  if (filterRow) {
    const bulkBtn = document.createElement("button");
    bulkBtn.textContent = "Add Bulk";
    bulkBtn.className = "btn-primary";
    bulkBtn.style.backgroundColor = "#007bff"; // blue

    bulkBtn.addEventListener("click", () => {
      const bulkArea = document.getElementById("bulkAddArea");
      bulkArea.style.display = bulkArea.style.display === "none" ? "block" : "none";
      bulkArea.scrollIntoView({ behavior: "smooth" });
    });

    // Append underneath
    filterRow.insertAdjacentElement("afterend", bulkBtn);
  }

  // Wire Start Import button
  document.getElementById("btnStartBulk").addEventListener("click", () => {
    startBulkImport(portalState);
  });
}


async function renderAddPaymentForm(formArea, portalState, contact) {
  formArea.innerHTML = `
    <section class="card">
      <h3>Add Payment for ${escapeHtml(contact.search_name || contact.contact_id)}</h3>
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
      <button id="btnSavePayment" class="btn-primary">Save</button>
    </section>
  `;

  document.getElementById("btnSavePayment").addEventListener("click", async () => {
    const amount = document.getElementById("paymentAmount").value.trim();
    const date = document.getElementById("paymentDate").value.trim();
    const invoice = document.getElementById("invoiceNumber").value.trim();

    if (!amount || !date) {
      alert("Amount and Date are required");
      return;
    }

    await fetch(`https://financials-module.dennis-e64.workers.dev/payments/add?project=${portalState.project}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_id: contact.contact_id,
        payment_amount: parseFloat(amount),
        payment_date: date,
        invoice_number: invoice || null,
        project: portalState.project
      })
    });

    alert("Payment added");
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
  // 1) Fetch payments (raw rows; IDs are text)
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

  // 2) Fetch contacts to build ID → name map (client-side join)
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

  // 3) Render table (Date first, Contact second) with checkbox
  container.innerHTML = `
    <section class="card">
      <h3>Payments List</h3>
      <table class="notes-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Contact</th>
            <th>Amount</th>
            <th>Invoice #</th>
            <th>Referral</th>
            <th>Needs review</th>
          </tr>
        </thead>
        <tbody>
          ${
            payments.length
              ? payments.map(p => {
                  const contactName = nameById.get(p.contact_id) || p.contact_id || "";
                  const referralName = nameById.get(p.referral_id) || p.referral_id || "";
                  const amt = p.payment_amount != null ? String(p.payment_amount) : "";

                  return `
                    <tr>
                      <td>${escapeHtml(p.payment_date || "")}</td>
                      <td>${escapeHtml(contactName)}</td>
                      <td>${escapeHtml(amt)}</td>
                      <td>${escapeHtml(p.invoice_number || "")}</td>
                      <td>${escapeHtml(referralName)}</td>
                      <td>
                        <input type="checkbox"
                               class="needsReviewCheckbox"
                               data-id="${p.payment_id}"
                               ${p.needs_review ? "checked" : ""} />
                      </td>
                    </tr>
                  `;
                }).join("")
              : `<tr><td colspan="6">(no payments found)</td></tr>`
          }
        </tbody>
      </table>
    </section>
  `;

  // 4) Wire checkbox -> backend PATCH
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
        console.warn("Failed to update needs_review:", err);
        // revert UI if backend fails
        e.target.checked = !checked;
        alert("Update failed. Please try again.");
      }
    });
  });
}




/* ---------- Summary ---------- */

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
            <th>Referral</th>
            <th>Total Amount</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          ${
            summary.length
              ? summary.map(s => `
                <tr>
                  <td>${escapeHtml(s.referral_name || s.referral_id || "")}</td>
                  <td>${escapeHtml(s.total_amount || "")}</td>
                  <td>${escapeHtml(s.count || "")}</td>
                </tr>
              `).join("")
              : `<tr><td colspan="3">(no summary data)</td></tr>`
          }
        </tbody>
      </table>
    </section>
  `;
}
