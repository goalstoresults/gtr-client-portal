// financials/tab-add.js
// Add tab: manual payment entry + project-specific staging.
//
// SNF:
//   Preserve the existing toolbar and click-to-load workflow.
//
// Other projects:
//   Show the staging workflow automatically.
//   Import buttons are rendered inside Step 1 by tab-add-staging.js.

import {
  escapeHtml,
  renderContactPicker
} from "../utilities.js";

/* =========================================================
   STAGING MODULE SELECTION
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

// QuickBooks import belongs only to the standard staging module.
// Do not require the SNF module to implement it.
const standardOnlyHandlerNames = [
  "showQuickBooksUploadModal"
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

    if (stagingVariant !== "snf") {
      for (const name of standardOnlyHandlerNames) {
        if (typeof window[name] !== "function") {
          throw new Error(
            `Staging module "${stagingVariant}" is missing window.${name}`
          );
        }

        handlers[name] = window[name];
      }
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

  // Prevent the standard QuickBooks handler from remaining
  // active while the SNF staging module is selected.
  for (const name of standardOnlyHandlerNames) {
    window[name] =
      stagingVariant === "snf"
        ? undefined
        : handlers[name];
  }
}

/* =========================================================
   BACKEND INSERT: Add Payment With Referral

   Manual payment entry remains separate from staging.
========================================================= */

export async function addPaymentWithReferral({
  project,
  contact_id,
  payment_amount,
  payment_date,
  invoice_number
}) {
  const res = await fetch(
    "https://financials-module.dennis-e64.workers.dev/payments/add",
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

  await activateStagingModule(stagingVariant);

  // Capture the selected module's handlers for this render.
  const loadStaging = window.loadStagingData;
  const showBulkUpload = window.showBulkUploadModal;

  container.innerHTML = `
    <section class="card">
      <h3>Financials – Add Payment</h3>
      <div id="contactPickerArea"></div>
    </section>

    ${
      isSnf
        ? `
          <div
            style="
              margin-top:16px;
              display:flex;
              gap:12px;
            "
          >
            <button
              id="btnLoadStaging"
              type="button"
              class="btn-primary"
            >
              Review Bulk Data
            </button>

            <button
              id="btnAddBulk"
              type="button"
              class="btn-secondary"
            >
              Add Bulk
            </button>
          </div>
        `
        : ""
    }

    <div
      id="stagingGrid"
      style="margin-top:16px;"
    ></div>
  `;

  const pickerArea = container.querySelector(
    "#contactPickerArea"
  );

  const stagingGrid = container.querySelector(
    "#stagingGrid"
  );

  /*
   * SNF retains its existing toolbar.
   * Standard staging renders its own import buttons in Step 1.
   */
  if (isSnf) {
    container
      .querySelector("#btnLoadStaging")
      .addEventListener("click", () => {
        loadStaging();
      });

    container
      .querySelector("#btnAddBulk")
      .addEventListener("click", () => {
        if (typeof showBulkUpload === "function") {
          showBulkUpload();
        } else {
          alert("Bulk upload modal not available.");
        }
      });
  }

  /*
   * Start standard staging immediately, independently of the
   * contact picker. The numbered workflow should not require
   * a toolbar click or a selected contact.
   */
  let stagingReady = Promise.resolve();

  if (!isSnf) {
    stagingGrid.innerHTML = `
      <p role="status" aria-live="polite">
        Loading invoice import workflow...
      </p>
    `;

    stagingReady = (async () => {
      try {
        await loadStaging();
      } catch (err) {
        console.error(
          "Initial staging load failed:",
          err
        );

        // The staging module normally renders its own error
        // inside the workflow. Preserve that when available.
        if (
          stagingGrid.isConnected &&
          container.querySelector("#stagingGrid") ===
            stagingGrid &&
          !stagingGrid.querySelector(
            "#stagingImportHeading"
          )
        ) {
          stagingGrid.innerHTML = `
            <section
              class="card"
              style="padding:20px;"
            >
              <h3 style="margin-top:0;">
                Invoice Import
              </h3>

              <p
                role="alert"
                style="color:#b00020;"
              >
                ${escapeHtml(
                  err.message ||
                  "Could not load the invoice import workflow."
                )}
              </p>

              <p>
                Reopen the Add tab to try again.
                Do not upload the file again if an
                earlier upload already completed.
              </p>
            </section>
          `;
        }
      }
    })();
  }

  // Manual payment contact picker remains available.
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

  await stagingReady;
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
