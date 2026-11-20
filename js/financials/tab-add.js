// financials/tab-add.js
// Add tab: manual payment entry + bulk import + staging trigger.

import {
  escapeHtml,
  renderContactPicker
} from "../utilities.js";

/* =========================================================
   STAGING MODULE SELECTION

   SNF:
     ./snf_add_staging.js

   Other projects:
     ./tab-add-staging.js

   Each staging module assigns window.* handlers.
   Save those handlers and restore the correct set whenever
   the Add tab is rendered, including after project changes.
========================================================= */

const stagingHandlerNames = [
  "autoMatchContact",
  "insertStagingRow",
  "toggleEdit",
  "fixRow",
  "saveEdit",
  "deleteStagingRow",
  "refreshStagingGrid",
  "reviewBulkData",
  "loadStagingData",
  "showBulkUploadModal"
];

const stagingHandlerCache = new Map();

async function activateStagingModule(stagingVariant) {
  if (!stagingHandlerCache.has(stagingVariant)) {
    if (stagingVariant === "snf") {
      await import("./snf_add_staging.js");
    } else {
      await import("./tab-add-staging.js");
    }

    const handlers = {};

    for (const name of stagingHandlerNames) {
      if (typeof window[name] !== "function") {
        throw new Error(
          `Staging module "${stagingVariant}" is missing window.${name}`
        );
      }

      handlers[name] = window[name];
    }

    stagingHandlerCache.set(
      stagingVariant,
      handlers
    );
  }

  const handlers = stagingHandlerCache.get(
    stagingVariant
  );

  for (const name of stagingHandlerNames) {
    window[name] = handlers[name];
  }
}

/* =========================================================
   BACKEND INSERT: Add Payment With Referral

   Manual payment entry remains unchanged.
   This is separate from staging insertion.
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
      headers: {
        "Content-Type": "application/json"
      },
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

export async function renderFinancialAdd(
  container,
  portalState,
  options = {}
) {
  const stagingVariant =
    options.stagingVariant ??
    (
      portalState.project === "snf"
        ? "snf"
        : "standard"
    );

  const isSnf =
    portalState.project === "snf" ||
    stagingVariant === "snf";

  // Activate the correct staging handlers before rendering
  // or wiring buttons that use them.
  await activateStagingModule(stagingVariant);

  container.innerHTML = `
    <section class="card">
      <h3>Financials – Add Payment </h3>
      <div id="contactPickerArea"></div>
    </section>

    <div
      style="
        margin-top:16px;
        display:flex;
        gap:12px;
      "
    >
      <button
        id="btnLoadStaging"
        class="btn-primary"
      >
        Review Bulk Data
      </button>

      <button
        id="btnAddBulk"
        class="btn-secondary"
      >
        ${isSnf ? "Add Bulk" : "Import CSV"}
      </button>

      ${
        !isSnf
          ? `
            <button
              id="btnImportQuickBooks"
              class="btn-primary"
            >
              Import QuickBooks CSV
            </button>
          `
          : ""
      }
    </div>

    <div
      id="stagingGrid"
      style="margin-top:16px;"
    ></div>
  `;

  // Render contact picker.
  const pickerArea = container.querySelector(
    "#contactPickerArea"
  );

  await renderContactPicker(
    pickerArea,
    portalState,
    async (contact) => {
      const formArea = document.createElement("div");

      await renderAddPaymentForm(
        formArea,
        portalState,
        contact
      );

      container.appendChild(formArea);
    }
  );

  // Wire staging button.
  container
    .querySelector("#btnLoadStaging")
    .addEventListener("click", () => {
      window.loadStagingData();
    });

  // Wire existing generic bulk upload button.
  container
    .querySelector("#btnAddBulk")
    .addEventListener("click", () => {
      if (
        typeof window.showBulkUploadModal === "function"
      ) {
        window.showBulkUploadModal();
      } else {
        alert("Bulk upload modal not available.");
      }
    });

  // QuickBooks import is available only on the non-SNF screen.
  const quickBooksBtn = container.querySelector(
    "#btnImportQuickBooks"
  );

  if (quickBooksBtn) {
    quickBooksBtn.addEventListener("click", () => {
      if (
        typeof window.showQuickBooksUploadModal === "function"
      ) {
        window.showQuickBooksUploadModal();
      } else {
        alert(
          "The QuickBooks import button is ready. " +
          "The QuickBooks upload popup is not connected yet."
        );
      }
    });
  }
}

/* =========================================================
   RENDER: Add Payment Form
========================================================= */

async function renderAddPaymentForm(
  formArea,
  portalState,
  contact
) {
  formArea.innerHTML = `
    <section class="card">
      <div
        style="
          display:flex;
          align-items:center;
          gap:12px;
          margin-bottom:12px;
        "
      >
        <h3 style="margin:0;">
          Add Payment for ${escapeHtml(
            contact.search_name || contact.contact_id
          )}
        </h3>

        ${
          portalState.canEdit
            ? `
              <button
                id="btnSavePayment"
                class="btn-primary"
              >
                Save
              </button>
            `
            : ""
        }
      </div>

      <div class="notes-row">
        <label class="notes-label">Amount</label>
        <input
          id="paymentAmount"
          class="form-control"
          type="number"
          step="0.01"
        />
      </div>

      <div class="notes-row">
        <label class="notes-label">Date</label>
        <input
          id="paymentDate"
          class="form-control"
          type="date"
        />
      </div>

      <div class="notes-row">
        <label class="notes-label">Invoice #</label>
        <input
          id="invoiceNumber"
          class="form-control"
        />
      </div>
    </section>
  `;

  const savePaymentBtn = formArea.querySelector(
    "#btnSavePayment"
  );

  if (savePaymentBtn) {
    savePaymentBtn.addEventListener(
      "click",
      async () => {
        const amount = formArea
          .querySelector("#paymentAmount")
          .value.trim();

        const date = formArea
          .querySelector("#paymentDate")
          .value.trim();

        const invoice = formArea
          .querySelector("#invoiceNumber")
          .value.trim();

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
      }
    );
  }
}
