// financials/tab-add.js
// Add tab: choose manual payment entry or staging review.
//
// Manual entry:
//   Contact picker and payment form stay in their own panel.
//
// Staging:
//   Loads existing records when opened.
//   Uploading a new file is not required.
//
// SNF:
//   Continues using snf_add_staging.js and its existing controls.

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

  for (const name of standardOnlyHandlerNames) {
    window[name] =
      stagingVariant === "snf"
        ? undefined
        : handlers[name];
  }
}

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
  const project = portalState.project;

  const isSnf =
    String(project || "").toLowerCase() === "snf" ||
    options.stagingVariant === "snf";

  const stagingVariant = isSnf
    ? "snf"
    : options.stagingVariant ?? "standard";

  await activateStagingModule(stagingVariant);

  const loadStaging = window.loadStagingData;
  const showBulkUpload = window.showBulkUploadModal;

  container.innerHTML = `
    <section
      class="card"
      style="padding:20px; margin-bottom:16px;"
    >
      <h3 style="margin:0 0 8px;">
        Financials – Add
      </h3>

      <p style="margin:0 0 16px; color:#555;">
        What would you like to do?
      </p>

      <div
        style="
          display:flex;
          gap:12px;
          flex-wrap:wrap;
        "
      >
        <button
          id="btnChooseSinglePayment"
          type="button"
          class="btn-secondary"
          aria-pressed="false"
          aria-controls="singlePaymentPanel"
        >
          Add Single Payment
        </button>

        <button
          id="btnChooseStaging"
          type="button"
          class="btn-secondary"
          aria-pressed="false"
          aria-controls="stagingWorkflowPanel"
        >
          Import &amp; Review Records
        </button>
      </div>

      <p
        id="financialAddChoiceHelp"
        style="margin:12px 0 0; color:#666;"
      >
        Enter one payment manually, or open staging
        to import a file and review existing records.
      </p>
    </section>

    <div id="singlePaymentPanel" hidden>
      <section
        class="card"
        style="padding:20px; margin-bottom:16px;"
      >
        <h3 style="margin:0 0 8px;">
          Add Single Payment
        </h3>

        <p style="margin:0 0 16px; color:#555;">
          Find and select a contact.
          The payment form will appear directly below.
        </p>

        <div id="contactPickerArea"></div>
      </section>

      <div id="singlePaymentFormArea"></div>
    </div>

    <div id="stagingWorkflowPanel" hidden>
      <section
        class="card"
        style="padding:20px; margin-bottom:16px;"
      >
        <h3 style="margin:0 0 8px;">
          Import &amp; Review Records
        </h3>

        <p style="margin:0; color:#555;">
          ${
            isSnf
              ? `
                Review records already received into
                this project's staging area.
                No new upload is required.
              `
              : `
                Importing a new file is optional.
                If you uploaded previously, or records
                arrived automatically, continue with
                Step 2: Match Contacts below.
                Do not upload the same file again
                just to continue reviewing it.
              `
          }
        </p>
      </section>

      ${
        isSnf
          ? `
            <div
              style="
                display:flex;
                gap:12px;
                flex-wrap:wrap;
                margin-bottom:16px;
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
        id="stagingLoadError"
        role="alert"
        style="
          color:#b00020;
          white-space:pre-wrap;
          margin-bottom:12px;
        "
        hidden
      ></div>

      <button
        id="btnRetryStagingLoad"
        type="button"
        class="btn-secondary"
        style="margin-bottom:16px;"
        hidden
      >
        Retry Loading Records
      </button>

      <div id="stagingGrid"></div>
    </div>
  `;

  const singleButton = container.querySelector(
    "#btnChooseSinglePayment"
  );

  const stagingButton = container.querySelector(
    "#btnChooseStaging"
  );

  const choiceHelp = container.querySelector(
    "#financialAddChoiceHelp"
  );

  const singlePanel = container.querySelector(
    "#singlePaymentPanel"
  );

  const stagingPanel = container.querySelector(
    "#stagingWorkflowPanel"
  );

  const pickerArea = container.querySelector(
    "#contactPickerArea"
  );

  const formArea = container.querySelector(
    "#singlePaymentFormArea"
  );

  const stagingGrid = container.querySelector(
    "#stagingGrid"
  );

  const stagingError = container.querySelector(
    "#stagingLoadError"
  );

  const retryStagingButton = container.querySelector(
    "#btnRetryStagingLoad"
  );

  let pickerReady = false;
  let pickerLoading = false;
  let stagingReady = false;
  let stagingLoading = false;

  function isCurrentView() {
    return (
      singlePanel.isConnected &&
      container.querySelector("#singlePaymentPanel") ===
        singlePanel &&
      portalState.project === project
    );
  }

  function selectPanel(mode) {
    const singleSelected = mode === "single";

    singlePanel.hidden = !singleSelected;
    stagingPanel.hidden = singleSelected;

    singleButton.className = singleSelected
      ? "btn-primary"
      : "btn-secondary";

    stagingButton.className = singleSelected
      ? "btn-secondary"
      : "btn-primary";

    singleButton.setAttribute(
      "aria-pressed",
      String(singleSelected)
    );

    stagingButton.setAttribute(
      "aria-pressed",
      String(!singleSelected)
    );

    choiceHelp.textContent = singleSelected
      ? "Select a contact below to enter one payment."
      : "Review existing staging records, or import a new file. A new upload is not required.";
  }

  async function openSinglePayment() {
    if (!isCurrentView()) {
      return;
    }

    selectPanel("single");

    // Preserve the picker and entered payment fields
    // when returning from the staging panel.
    if (pickerReady || pickerLoading) {
      return;
    }

    pickerLoading = true;

    pickerArea.innerHTML = `
      <p role="status">Loading contacts...</p>
    `;

    try {
      await renderContactPicker(
        pickerArea,
        portalState,
        async (contact) => {
          if (!isCurrentView()) {
            return;
          }

          // Reuse one dedicated form container.
          // Do not append forms after the staging workspace.
          await renderAddPaymentForm(
            formArea,
            portalState,
            contact
          );

          if (
            isCurrentView() &&
            !singlePanel.hidden
          ) {
            formArea.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
          }
        }
      );

      pickerReady = true;
    } catch (err) {
      console.error(
        "Contact picker load failed:",
        err
      );

      if (isCurrentView()) {
        pickerArea.innerHTML = `
          <p role="alert" style="color:#b00020;">
            ${escapeHtml(
              err.message ||
              "Could not load the contact picker."
            )}
          </p>

          <p>
            Click Add Single Payment again to retry.
          </p>
        `;
      }
    } finally {
      pickerLoading = false;
    }
  }

  async function loadExistingStaging() {
    if (!isCurrentView() || stagingLoading) {
      return;
    }

    stagingLoading = true;
    stagingError.hidden = true;
    stagingError.textContent = "";
    retryStagingButton.hidden = true;

    if (!stagingReady) {
      stagingGrid.innerHTML = `
        <p role="status" aria-live="polite">
          Loading existing staging records...
        </p>
      `;
    }

    try {
      await loadStaging();

      if (isCurrentView()) {
        stagingReady = true;
      }
    } catch (err) {
      console.error(
        "Staging load failed:",
        err
      );

      if (isCurrentView()) {
        stagingError.textContent =
          (
            err.message ||
            "Could not load staging records."
          ) +
          "\n\nRetry loading the records. " +
          "Do not upload a previously uploaded file again.";

        stagingError.hidden = false;
        retryStagingButton.hidden = false;

        // Remove the initial loading message, but retain
        // any workflow/error UI rendered by the module.
        if (
          !stagingReady &&
          !stagingGrid.querySelector("section, table")
        ) {
          stagingGrid.innerHTML = "";
        }
      }
    } finally {
      stagingLoading = false;
    }
  }

  async function openStaging() {
    if (!isCurrentView()) {
      return;
    }

    selectPanel("staging");

    // Keep the existing workspace when switching panels.
    // Users can refresh it using its existing controls.
    if (!stagingReady) {
      await loadExistingStaging();
    }
  }

  singleButton.addEventListener(
    "click",
    openSinglePayment
  );

  stagingButton.addEventListener(
    "click",
    openStaging
  );

  retryStagingButton.addEventListener(
    "click",
    loadExistingStaging
  );

  if (isSnf) {
    container
      .querySelector("#btnLoadStaging")
      .addEventListener(
        "click",
        loadExistingStaging
      );

    container
      .querySelector("#btnAddBulk")
      .addEventListener("click", () => {
        if (!isCurrentView()) {
          return;
        }

        if (typeof showBulkUpload === "function") {
          showBulkUpload();
        } else {
          alert("Bulk upload modal not available.");
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
  const project = portalState.project;
  const contactId = contact.contact_id;

  formArea.innerHTML = `
    <section class="card" style="padding:20px;">
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
            contact.search_name || contactId
          )}
        </h3>

        ${
          portalState.canEdit
            ? `
              <button
                id="btnSavePayment"
                type="button"
                class="btn-primary"
              >
                Save
              </button>
            `
            : ""
        }
      </div>

      <div class="notes-row">
        <label
          class="notes-label"
          for="paymentAmount"
        >
          Amount
        </label>

        <input
          id="paymentAmount"
          class="form-control"
          type="number"
          step="0.01"
        />
      </div>

      <div class="notes-row">
        <label
          class="notes-label"
          for="paymentDate"
        >
          Date
        </label>

        <input
          id="paymentDate"
          class="form-control"
          type="date"
        />
      </div>

      <div class="notes-row">
        <label
          class="notes-label"
          for="invoiceNumber"
        >
          Invoice #
        </label>

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

  if (!savePaymentBtn) {
    return;
  }

  let saving = false;

  savePaymentBtn.addEventListener(
    "click",
    async () => {
      if (saving) {
        return;
      }

      if (
        !formArea.isConnected ||
        !formArea.contains(savePaymentBtn) ||
        portalState.project !== project
      ) {
        return;
      }

      if (!portalState.canEdit) {
        alert(
          "You do not have permission to add payments."
        );
        return;
      }

      const amountText = formArea
        .querySelector("#paymentAmount")
        .value.trim();

      const date = formArea
        .querySelector("#paymentDate")
        .value.trim();

      const invoice = formArea
        .querySelector("#invoiceNumber")
        .value.trim();

      if (amountText === "" || !date) {
        alert("Amount and Date are required");
        return;
      }

      const amount = Number(amountText);

      if (!Number.isFinite(amount)) {
        alert("Enter a valid amount.");
        return;
      }

      saving = true;
      savePaymentBtn.disabled = true;
      savePaymentBtn.textContent = "Saving...";

      try {
        await addPaymentWithReferral({
          project,
          contact_id: contactId,
          payment_amount: amount,
          payment_date: date,
          invoice_number: invoice || null
        });

        if (
          formArea.isConnected &&
          formArea.contains(savePaymentBtn) &&
          portalState.project === project
        ) {
          alert("Payment added");

          // Keep the successful form disabled to avoid
          // accidentally saving the same entry again.
          savePaymentBtn.textContent = "Saved";
        }
      } catch (err) {
        console.error(
          "Payment insert failed:",
          err
        );

        if (
          formArea.isConnected &&
          formArea.contains(savePaymentBtn) &&
          portalState.project === project
        ) {
          alert(
            "Payment could not be confirmed. " +
            "Check the payment list before retrying."
          );

          saving = false;
          savePaymentBtn.disabled = false;
          savePaymentBtn.textContent = "Save";
        }
      }
    }
  );
}
