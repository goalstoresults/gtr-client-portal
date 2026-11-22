
// financials/tab-add-staging.js
// Non-SNF staging subsystem for the Financials "Add" tab.

import { escapeHtml } from "../utilities.js";

/* =========================================================
   CONFIGURATION AND STATE
========================================================= */

const FINANCIALS_API =
  "https://financials-module.dennis-e64.workers.dev";

const stagingStates = new Map();

function getProject() {
  return window.portalState?.project || "";
}

function getStagingState(project = getProject()) {
  if (!stagingStates.has(project)) {
    stagingStates.set(project, {
      rows: [],
      filter: "",
      sortField: "transaction_date",
      sortDirection: "asc",
      busy: false,
      message: "",
      error: "",
      results: new Map(),
      processed: 0,
      total: 0,
      openRowId: null,
      contactSearch: "",
      contactLookups: new Map(),
      defaultContactType: "",
      contactTypes: [],
      contactTypesLoaded: false,
      contactTypesLoading: false,
      contactTypesError: "",
      newContacts: new Map(),
      matchedExpanded: false,
      finalizing: false,
      insertionResults: []
    });
  }

  return stagingStates.get(project);
}

function requireNonSnfProject() {
  const project = getProject();

  if (!project) {
    throw new Error("No project selected.");
  }

  if (project.toLowerCase() === "snf") {
    throw new Error(
      "This staging screen is not available for SNF."
    );
  }

  return project;
}

function requireEditPermission() {
  if (!window.portalState?.canEdit) {
    throw new Error(
      "You do not have permission to modify financial data."
    );
  }
}

function isCurrentGrid(project, container) {
  return (
    getProject() === project &&
    container?.isConnected &&
    document.getElementById("stagingGrid") === container
  );
}

function showActionError(err) {
  console.error("Staging action failed:", err);
  alert(err.message || "The staging action failed.");
}

async function stagingRequest(
  path,
  {
    project = getProject(),
    method = "GET",
    body,
    csv = false
  } = {}
) {
  const separator = path.includes("?") ? "&" : "?";

  const options = {
    method,
    headers: {}
  };

  if (body !== undefined) {
    options.headers["Content-Type"] = csv
      ? "text/csv"
      : "application/json";

    options.body = csv
      ? body
      : JSON.stringify(body);
  }

  const res = await fetch(
    `${FINANCIALS_API}${path}${separator}project=${encodeURIComponent(
      project
    )}`,
    options
  );

  const text = await res.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (res.ok) {
      throw new Error(
        `The server returned invalid JSON (${res.status}).`
      );
    }
  }

  if (!res.ok) {
    const message =
      typeof data?.error === "string"
        ? data.error
        : typeof data?.message === "string"
          ? data.message
          : `Request failed (${res.status}).`;

    console.error(
      "STAGING REQUEST FAILED:",
      path,
      res.status,
      text
    );

    const error = new Error(message);
    error.uncertain = data?.uncertain === true;
    error.setupRequired = data?.setup_required === true;
    error.httpStatus = res.status;
    throw error;
  }

  return data;
}

/* =========================================================
   LOAD STAGING DATA
========================================================= */

export async function loadStagingData() {
  const container = document.getElementById(
    "stagingGrid"
  );

  if (!container) {
    return;
  }

  let project;

  try {
    project = requireNonSnfProject();
  } catch (err) {
    container.textContent = err.message;
    return;
  }

  const state = getStagingState(project);

  const filterEl = container.querySelector(
    "#stagingFilter"
  );

  if (filterEl) {
    state.filter = filterEl.value;
  }

  let path = "/staging/list";

  switch (state.filter) {
    case "uploaded":
      path += "?status=eq.uploaded";
      break;

    case "ready":
      path += "?status=eq.ready";
      break;

    case "matched":
      path += "?status=eq.matched";
      break;

    case "error":
      path += "?status=eq.error";
      break;

    case "imported":
      path += "?status=eq.imported";
      break;

    case "missing_contact":
      path +=
        "?status=neq.imported&contact_missing=true";
      break;

    case "missing_referral":
      path +=
        "?status=neq.imported&referral_missing=true";
      break;

    case "missing_group":
      path +=
        "?status=neq.imported&group_missing=true";
      break;

    case "needs_review":
      path +=
        "?status=neq.imported&needs_review=eq.true";
      break;

    default:
      path += "?status=neq.imported";
      break;
  }

  try {
    await loadStagingContactTypes(project, container);

    const rows = await stagingRequest(path, {
      project
    });

    if (!Array.isArray(rows)) {
      throw new Error(
        "The staging request did not return an array."
      );
    }

    if (!isCurrentGrid(project, container)) {
      return;
    }

    state.rows = rows;
    state.openRowId = null;

    renderStagingGrid();
  } catch (err) {
    if (!isCurrentGrid(project, container)) {
      return;
    }

    state.error =
      err.message || "Could not load staging data.";

    renderStagingGrid();
    throw err;
  }
}

window.loadStagingData = loadStagingData;

window.refreshStagingGrid = function () {
  const state = getStagingState();

  if (state.busy) {
    return;
  }

  state.error = "";

  loadStagingData().catch((err) => {
    console.error("Staging refresh failed:", err);
  });
};

window.reviewBulkData = function () {
  const state = getStagingState();

  if (state.busy) {
    return;
  }

  state.filter = "needs_review";

  const filterEl = document.getElementById(
    "stagingFilter"
  );

  if (filterEl) {
    filterEl.value = state.filter;
  }

  loadStagingData().catch((err) => {
    console.error("Staging review failed:", err);
  });
};

/* =========================================================
   MATCHING RESULTS AND LABELS
========================================================= */

function getRowResult(row, state) {
  return state.results.get(String(row.id)) || null;
}

function isResolvedResult(result) {
  return (
    result?.outcome === "exact_match" ||
    result?.outcome === "existing_assignment"
  );
}

function isRowPrepared(row, state) {
  const result = getRowResult(row, state);

  return (
    row.status !== "imported" &&
    !!row.contact_id &&
    isResolvedResult(result)
  );
}

function getRowStatus(row, state) {
  if (row.status === "imported") {
    return "Imported";
  }

  const result = getRowResult(row, state);

  if (isRowPrepared(row, state)) {
    return "Ready";
  }

  switch (result?.outcome) {
    case "multiple_exact_matches":
      return "Choose contact";

    case "similar_matches":
      return "Review suggestions";

    case "no_matches":
      return "Add / find contact";

    case "review_error":
    case "not_found":
      return "Review error";

    case "already_imported":
      return "Imported";

    default:
      return row.contact_id
        ? "Contact assigned — recheck"
        : "Not checked";
  }
}

function getRowMessage(row, state) {
  const result = getRowResult(row, state);

  if (result) {
    return result.message || "";
  }

  return row.error_message || "";
}

function getRunSummary(state) {
  const results = [...state.results.values()];

  return {
    checked: results.length,
    resolved: results.filter(
      isResolvedResult
    ).length,
    choices: results.filter(
      (row) =>
        row.outcome === "multiple_exact_matches" ||
        row.outcome === "similar_matches"
    ).length,
    noMatches: results.filter(
      (row) => row.outcome === "no_matches"
    ).length,
    errors: results.filter(
      (row) =>
        row.outcome === "review_error" ||
        row.outcome === "not_found"
    ).length,
    skipped: results.filter(
      (row) => row.outcome === "already_imported"
    ).length
  };
}

/* =========================================================
   POPULATE ALL / RETRY MATCHING

   Uses a snapshot independent of the grid filter.
   Processes up to 5 invoices per backend request.
========================================================= */

async function runPopulateAll(onlyIds = null) {
  let project;

  try {
    project = requireNonSnfProject();
    requireEditPermission();
  } catch (err) {
    showActionError(err);
    return;
  }

  const state = getStagingState(project);
  const container = document.getElementById(
    "stagingGrid"
  );

  if (state.busy || !container) {
    return;
  }

  const batchSize = 5;

  state.busy = true;
  state.error = "";
  state.message = onlyIds
    ? "Rechecking the selected invoice..."
    : "Finding pending invoices...";

  state.processed = 0;
  state.total = 0;
  state.openRowId = null;

  if (!onlyIds) {
    state.results.clear();
  }

  renderStagingGrid();

  try {
    let ids;

    if (onlyIds) {
      ids = [...new Set(
        onlyIds.map((id) => String(id))
      )];
    } else {
      const snapshot = await stagingRequest(
        "/staging/populate-snapshot",
        { project }
      );

      if (!Array.isArray(snapshot?.ids)) {
        throw new Error(
          "The pending-invoice response did not contain an ID list."
        );
      }

      ids = [...new Set(
        snapshot.ids.map((id) => String(id))
      )];
    }

    state.total = ids.length;

    if (!ids.length) {
      state.message =
        "There are no pending staging invoices to match.";
      return;
    }

    for (
      let offset = 0;
      offset < ids.length;
      offset += batchSize
    ) {
      if (!isCurrentGrid(project, container)) {
        throw new Error(
          "Populate stopped because the project or screen changed. " +
          "Completed matching updates were saved."
        );
      }

      requireEditPermission();

      const batchIds = ids.slice(
        offset,
        offset + batchSize
      );

      state.message =
        `Matching invoices ${offset + 1}–` +
        `${offset + batchIds.length} of ${ids.length}...`;

      renderStagingGrid();

      const data = await stagingRequest(
        "/staging/populate-batch",
        {
          project,
          method: "POST",
          body: { ids: batchIds }
        }
      );

      if (!Array.isArray(data?.results)) {
        throw new Error(
          "The matching response did not contain results."
        );
      }

      const returnedIds = new Set(
        data.results.map(
          (result) => String(result.id)
        )
      );

      if (
        data.results.length !== batchIds.length ||
        returnedIds.size !== batchIds.length ||
        batchIds.some(
          (id) => !returnedIds.has(id)
        )
      ) {
        throw new Error(
          "The matching response was incomplete. " +
          "Refresh staging before retrying."
        );
      }

      for (const result of data.results) {
        state.results.set(
          String(result.id),
          result
        );
      }

      state.processed += data.results.length;

      state.message =
        `Processed ${state.processed} of ${state.total} invoices.`;

      if (isCurrentGrid(project, container)) {
        renderStagingGrid();
      }
    }

    state.message =
      `Matching finished: ${state.processed} invoices checked. ` +
      "No contacts were created and no final revenue was inserted.";
  } catch (err) {
    console.error("Populate failed:", err);

    state.error =
      err.message || "Populate failed.";

    state.message =
      `Stopped after ${state.processed} of ${state.total} confirmed results. ` +
      "Some work in the last request may have completed. " +
      "Refresh staging before retrying.";
  } finally {
    if (isCurrentGrid(project, container)) {
      try {
        await loadStagingData();
      } catch (err) {
        state.error +=
          (state.error ? "\n\n" : "") +
          "The grid could not refresh. Click Refresh Records.";
      }
    }

    state.busy = false;

    if (isCurrentGrid(project, container)) {
      renderStagingGrid();
    }
  }
}

window.autoMatchContact = function (id) {
  return runPopulateAll([String(id)]);
};

/* =========================================================
   INSERTION GATE

   Final insertion uses the transactional database function
   through the non-SNF Worker route.
========================================================= */

function readyRowsForInsertion(state) {
  return state.rows.filter((row) =>
    isRowPrepared(row, state) &&
    ["matched", "ready"].includes(row.status) &&
    !row.imported_at && !row.error_message
  );
}

async function runInsertReady(onlyIds = null) {
  let project;
  try {
    project = requireNonSnfProject();
    requireEditPermission();
  } catch (err) { showActionError(err); return; }
  const state = getStagingState(project);
  const container = document.getElementById("stagingGrid");
  if (!container || state.busy) return;
  const requested = onlyIds ? new Set(onlyIds.map(String)) : null;
  const selected = readyRowsForInsertion(state).filter((row) =>
    !requested || requested.has(String(row.id))
  );
  if (!selected.length) {
    alert("No ready records are loaded for this filter. Run Match All Contacts and review the results.");
    return;
  }
  const total = selected.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const confirmed = window.confirm(
    `Add these ${selected.length} ready revenue record(s)?\n` +
    `Total amount: ${total.toFixed(2)}\n\n` +
    selected.map((row) => `${row.customer_name || "(unnamed)"} | ${row.invoice_number || "no invoice number"} | ${Number(row.amount || 0).toFixed(2)}`).join("\n") +
    "\n\nOnly ready records loaded for the current filter will be processed. Unresolved records will remain in staging."
  );
  if (!confirmed) return;
  state.busy = true;
  state.finalizing = true;
  state.error = "";
  state.openRowId = null;
  state.insertionResults = [];
  let attempted = 0;
  try {
    for (const row of selected) {
      if (!isCurrentGrid(project, container)) {
        throw new Error("Stopped because the project or screen changed. Completed records remain saved.");
      }
      requireEditPermission();
      state.message = `Adding ready record ${attempted + 1} of ${selected.length}...`;
      renderStagingGrid();
      attempted++;
      try {
        const result = await stagingRequest(
          `/payments/add-from-staging?id=${encodeURIComponent(row.id)}`,
          { project, method: "POST" }
        );
        if (result?.success !== true ||
            !["inserted", "already_imported"].includes(result?.outcome) ||
            String(result?.id) !== String(row.id)) {
          const error = new Error("The result could not be confirmed. Refresh records before retrying.");
          error.uncertain = true;
          throw error;
        }
        state.insertionResults.push({ id: row.id, name: row.customer_name || "", outcome: result.outcome, message: result.outcome === "inserted" ? "Added successfully." : "Already processed; skipped." });
        // Update the local row immediately, even if a later refresh fails.
        row.status = "imported";
        row.imported_at = new Date().toISOString();
        state.results.delete(String(row.id));
      } catch (err) {
        const uncertain = err.uncertain || !err.httpStatus;
        state.insertionResults.push({ id: row.id, name: row.customer_name || "", outcome: uncertain ? "unconfirmed" : "failed", message: err.message || "Could not add this record." });
        if (uncertain || err.setupRequired) {
          state.error = err.message || "Finalization stopped. Refresh records before retrying.";
          break;
        }
      }
    }
  } catch (err) {
    state.error = err.message || "Finalization stopped.";
  } finally {
    const count = (outcome) => state.insertionResults.filter((item) => item.outcome === outcome).length;
    state.message =
      `Finished: ${count("inserted")} added; ${count("already_imported")} already processed; ` +
      `${count("failed")} failed; ${count("unconfirmed")} unconfirmed; ` +
      `${selected.length - attempted} not attempted. Unresolved records remain in staging.`;
    if (isCurrentGrid(project, container)) {
      try { await loadStagingData(); } catch {
        state.error += (state.error ? "\n\n" : "") + "Refresh Records before continuing. Do not re-upload the file.";
      }
    }
    state.busy = false;
    state.finalizing = false;
    if (isCurrentGrid(project, container)) renderStagingGrid();
  }
}

window.insertStagingRow = function (id) {
  return runInsertReady(id == null ? null : [String(id)]);
};

/* =========================================================
   GRID RENDERING
========================================================= */

function renderStagingGrid() {
  const project = getProject();
  const container = document.getElementById(
    "stagingGrid"
  );

  if (
    !container ||
    !project ||
    project.toLowerCase() === "snf"
  ) {
    return;
  }

  const state = getStagingState(project);
  const summary = getRunSummary(state);
  const insertionReady = readyRowsForInsertion(state);

  const canEdit =
    !!window.portalState?.canEdit;

  const rows = [...state.rows];

  const columns = [
    {
      key: "customer_name",
      label: "Customer Name"
    },
    {
      key: "invoice_number",
      label: "Invoice #"
    },
    {
      key: "transaction_date",
      label: "Date",
      isDate: true
    },
    {
      key: "amount",
      label: "Amount",
      numeric: true
    },
    {
      key: "contact_name",
      label: "Contact"
    },
    {
      key: "referral_name",
      label: "Referral"
    },
    {
      key: "status",
      label: "Status"
    },
    {
      key: "error_message",
      label: "Details"
    },
    {
      key: "action",
      label: "Action"
    }
  ];

  rows.sort((a, b) => {
    const column = columns.find(
      (item) => item.key === state.sortField
    );

    let A = a[state.sortField];
    let B = b[state.sortField];

    if (state.sortField === "status") {
      A = getRowStatus(a, state);
      B = getRowStatus(b, state);
    }

    if (state.sortField === "error_message") {
      A = getRowMessage(a, state);
      B = getRowMessage(b, state);
    }

    if (column?.isDate) {
      A = Date.parse(A) || 0;
      B = Date.parse(B) || 0;
    } else if (column?.numeric) {
      A = Number(A) || 0;
      B = Number(B) || 0;
    } else {
      A = String(A || "").toLowerCase();
      B = String(B || "").toLowerCase();
    }

    if (A < B) {
      return state.sortDirection === "asc"
        ? -1
        : 1;
    }

    if (A > B) {
      return state.sortDirection === "asc"
        ? 1
        : -1;
    }

    return 0;
  });

  const headerHtml = columns.map((column) => {
    if (column.key === "action") {
      return `<th>Action</th>`;
    }

    const sorted =
      state.sortField === column.key;

    const up =
      sorted && state.sortDirection === "asc"
        ? "▲"
        : "△";

    const down =
      sorted && state.sortDirection === "desc"
        ? "▼"
        : "▽";

    return `
      <th
        class="sortable"
        data-field="${column.key}"
        style="cursor:pointer;"
      >
        ${escapeHtml(column.label)}
        <span
          style="margin-left:4px; font-size:0.8em;"
        >
          ${up} ${down}
        </span>
      </th>
    `;
  }).join("");

  const renderRows = (groupRows) => groupRows.map((row, index) => {
    const id = escapeHtml(String(row.id));
    const result = getRowResult(row, state);
    const imported =
      row.status === "imported" ||
      result?.outcome === "already_imported";

    const prepared =
      isRowPrepared(row, state);

    const contactName =
      row.contact_name ||
      result?.contact?.search_name ||
      (
        row.contact_id
          ? "(assigned contact)"
          : "(none)"
      );

    const referralName =
      row.referral_name ||
      (
        row.referral_id
          ? "(assigned referral)"
          : prepared
            ? "Self on insert"
            : "(not assigned)"
      );

    return `
      <tr
        id="row-${id}"
        style="background:${
          index % 2 === 0
            ? "#ffffff"
            : "#f9f9f9"
        };"
      >
        <td>
          <a
            href="#"
            data-action="edit"
            data-id="${id}"
          >
            ${escapeHtml(row.customer_name || "")}
          </a>
        </td>

        <td>
          ${escapeHtml(row.invoice_number || "")}
        </td>

        <td>
          ${escapeHtml(row.transaction_date || "")}
        </td>

        <td>
          ${escapeHtml(
            (Number(row.amount) || 0).toFixed(2)
          )}
        </td>

        <td class="contact-cell">
          ${escapeHtml(contactName)}
          <div style="font-size:0.75em; color:#888;">
            ${escapeHtml(row.contact_id || "")}
          </div>
        </td>

        <td class="referral-cell">
          ${escapeHtml(referralName)}
          <div style="font-size:0.75em; color:#888;">
            ${escapeHtml(row.referral_id || "")}
          </div>
        </td>

        <td
          class="status-cell"
          style="color:${
            imported || prepared
              ? "#267326"
              : "#9a4500"
          };"
        >
          ${escapeHtml(getRowStatus(row, state))}
        </td>

        <td
          class="error-cell"
          style="color:${
            prepared ? "#555" : "#9a4500"
          };"
        >
          ${escapeHtml(getRowMessage(row, state))}
        </td>

        <td class="action-cell">
          ${
            imported
              ? `<span style="color:green;">Imported</span>`
              : `
                <button
                  type="button"
                  data-action="edit"
                  data-id="${id}"
                  ${state.busy ? "disabled" : ""}
                >
                  ${
                    prepared
                      ? "Edit Invoice"
                      : result
                        ? "Fix / Review"
                        : "Edit / Review"
                  }
                </button>
              `
          }
        </td>
      </tr>

      ${
        state.openRowId === String(row.id) &&
        !imported
          ? renderReviewEditor(
              row,
              state,
              canEdit
            )
          : ""
      }
    `;
  }).join("");

  const importedRows = rows.filter((row) =>
    row.status === "imported" ||
    getRowResult(row, state)?.outcome === "already_imported"
  );
  const pendingRows = rows.filter((row) => !importedRows.includes(row));
  const matchedRows = pendingRows.filter((row) => isRowPrepared(row, state));
  const uncheckedRows = pendingRows.filter((row) => !getRowResult(row, state));
  const reviewRows = pendingRows.filter((row) =>
    !!getRowResult(row, state) && !isRowPrepared(row, state)
  );
  const tableFor = (groupRows, emptyMessage) => `
    <div style="overflow-x:auto;">
      <table class="notes-table" style="width:100%;border-collapse:collapse;margin-top:12px;">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${renderRows(groupRows) || `<tr><td colspan="9" style="padding:16px;">${escapeHtml(emptyMessage)}</td></tr>`}</tbody>
      </table>
    </div>
  `;

  container.innerHTML = `
    <section class="card" aria-labelledby="stagingImportHeading" style="padding:20px;margin-bottom:20px;">
      <h3 id="stagingImportHeading" style="margin:0 0 8px;">Step 1: Import File — Optional</h3>
      <p style="margin:0 0 16px;color:#555;">Upload a new file, or continue to Step 2 to review records already in staging.</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
        ${canEdit ? `
          <button id="stagingImportQuickBooks" type="button" class="btn-primary" ${state.busy ? "disabled" : ""}>Import QuickBooks File</button>
          <button id="stagingImportCsv" type="button" class="btn-secondary" ${state.busy ? "disabled" : ""}>Import CSV</button>
        ` : ""}
      </div>
      <p style="margin:12px 0 0;color:#666;font-size:0.9em;">QuickBooks: upload the original Invoice List by Date CSV. Import CSV: upload a prepared file. Uploading adds invoices to staging only.</p>
    </section>

    <section class="card" aria-labelledby="stagingMatchHeading" style="padding:20px;margin-bottom:20px;">
      <h3 id="stagingMatchHeading" style="margin:0 0 8px;">Step 2: Review &amp; Match Contacts</h3>
      <p style="margin:0 0 16px;color:#555;">Review pending records, correct any details, then match them to your contacts.</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
        ${canEdit ? `
          <button id="btnPopulateAll" type="button" class="btn-primary" ${state.busy ? "disabled" : ""}>${state.busy ? "Working..." : "Match All Contacts"}</button>
        ` : ""}
        <button id="refreshStagingGrid" type="button" class="btn-secondary" ${state.busy ? "disabled" : ""}>Refresh Records</button>
      </div>
      <p style="margin:12px 0;color:#555;font-size:0.9em;">Match All Contacts checks every pending record in this project, regardless of the selected filter. It does not create contacts or add final financial records.</p>
      <div role="status" aria-live="polite" style="white-space:pre-wrap;">${escapeHtml(state.message)}</div>
      ${state.error ? `<div role="alert" style="margin-top:12px;color:#b00020;white-space:pre-wrap;">${escapeHtml(state.error)}</div>` : ""}
      ${summary.checked ? `
        <div style="display:flex;gap:16px;flex-wrap:wrap;padding:12px;margin-top:12px;background:#f4f7fa;border-radius:6px;">
          <span>Checked this session: ${summary.checked}</span>
          <span>Matched: ${summary.resolved}</span>
          <span>Need contact choice: ${summary.choices}</span>
          <span>No matches: ${summary.noMatches}</span>
          <span>Errors: ${summary.errors}</span>
          <span>Already imported: ${summary.skipped}</span>
        </div>
      ` : `<p style="margin:12px 0;color:#666;">Review the pending records below, then click Match All Contacts.</p>`}
      <p style="margin:12px 0;color:#666;font-size:0.9em;">Matching summaries and suggestions are held in this browser session. After a page reload, run Match All Contacts again to rebuild them.</p>

      <details style="margin:16px 0;">
        <summary>New contact settings</summary>

        <div style="margin-top:12px;">
          <label for="defaultNewContactType">
            Default type for new contacts:
          </label>

          <select
            id="defaultNewContactType"
            style="padding:4px 6px;"
            ${
              !canEdit || state.busy || !state.contactTypes.length
                ? "disabled"
                : ""
            }
          >
            ${renderStagingContactTypeOptions(
              state,
              state.defaultContactType
            )}
          </select>

          <button
            type="button"
            data-action="reload-contact-types"
            ${state.busy ? "disabled" : ""}
          >
            Reload Contact Types
          </button>

          ${renderStagingContactTypeMessage(state)}

          <p style="color:#666; font-size:0.9em;">
            This default applies only to new contacts.
            Each form can override it. Existing contacts
            and their contact types will not be changed.
          </p>
        </div>
      </details>

      <div style="border-top:1px solid #ddd;padding-top:16px;margin-top:16px;">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px;">
          <label for="stagingFilter">Show:</label>
          <select id="stagingFilter" style="padding:4px 6px;" ${state.busy ? "disabled" : ""}>
            <option value="">All Pending Records</option>
            <option value="uploaded">Uploaded / unresolved</option>
            <option value="matched">Matched — self-referral fallback</option>
            <option value="ready">Matched with referral</option>
            <option value="error">Error</option>
            <option value="imported">Imported</option>
            <option value="missing_contact">Missing Contact</option>
            <option value="missing_referral">Missing Referral</option>
            <option value="needs_review">Needs Review</option>
          </select>
          <span style="color:#666;">${rows.length} record(s) loaded for this filter</span>
        </div>
        <p style="margin:0 0 16px;color:#666;font-size:0.9em;">The groups below reflect the selected filter. Not checked means no matching result is available in this browser session; it does not mean matching failed.</p>
        ${reviewRows.length ? `
          <div id="stagingNeedsReview" style="margin-bottom:20px;">
            <h4 style="margin:0 0 8px;">Needs Review — ${reviewRows.length}</h4>
            <p style="margin:0;color:#666;font-size:0.9em;">These checked records need a contact decision, correction, or error review.</p>
            ${tableFor(reviewRows, "No checked records need review in this filter.")}
          </div>
        ` : ""}
        <div id="stagingPendingRecords">
          <h4 style="margin:0 0 8px;">Pending Records — Not Checked — ${uncheckedRows.length}</h4>
          ${tableFor(uncheckedRows, pendingRows.length ? "All pending records in this filter have a matching result for this session. See Needs Review or Matched." : "No pending records found for this filter.")}
        </div>
        <details id="stagingMatchedGroup" style="margin-top:20px;" ${state.matchedExpanded ? "open" : ""}>
          <summary style="cursor:pointer;">Matched — ${matchedRows.length}</summary>
          ${tableFor(matchedRows, "No checked and prepared invoices in this filter.")}
        </details>
        ${importedRows.length ? `
          <details style="margin-top:20px;" open>
            <summary>Imported — ${importedRows.length}</summary>
            ${tableFor(importedRows, "No imported invoices in this filter.")}
          </details>
        ` : ""}
      </div>
    </section>

    <section class="card" aria-labelledby="stagingFinishHeading" style="padding:20px;margin-bottom:20px;">
      <h3 id="stagingFinishHeading" style="margin:0 0 8px;">Step 3: Review &amp; Finish</h3>
      <p style="margin:0 0 12px;color:#555;">${insertionReady.length} revenue record(s) ready to add in the current filter. Unresolved records will remain in staging.</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
        <button id="stagingReviewReady" type="button" class="btn-secondary" ${state.busy ? "disabled" : ""}>Review Ready Records</button>
        <button id="btnInsertReady" type="button" class="btn-primary" ${!canEdit || state.busy || !insertionReady.length ? "disabled" : ""}>${state.finalizing ? "Adding Records..." : `Add All ${insertionReady.length} Ready Records`}</button>
      </div>
      <p style="margin:12px 0;color:#666;font-size:0.9em;">Adds ready records currently loaded for the selected filter. Choose All Pending Records in Step 2 to include all loaded pending records. Only the same staging ID is protected against repeat insertion; separate records are not compared for duplicates.</p>
      <div role="status" aria-live="polite" style="white-space:pre-wrap;">${escapeHtml(state.message)}</div>
      ${state.error ? `<p role="alert" style="color:#b00020;white-space:pre-wrap;">${escapeHtml(state.error)}</p>` : ""}
      ${state.insertionResults.length ? `
        <div style="overflow-x:auto;margin-top:12px;">
          <table class="notes-table" style="width:100%;border-collapse:collapse;">
            <thead><tr><th>Record</th><th>Result</th><th>Details</th></tr></thead>
            <tbody>${state.insertionResults.map((item) => `
              <tr><td>${escapeHtml(item.name)}<div style="font-size:0.8em;">${escapeHtml(String(item.id))}</div></td><td>${escapeHtml(item.outcome)}</td><td>${escapeHtml(item.message)}</td></tr>
            `).join("")}</tbody>
          </table>
        </div>
      ` : ""}
    </section>
  `;

  container.querySelector("#btnInsertReady").addEventListener("click", () => runInsertReady());

  container.querySelector("#stagingImportQuickBooks")?.addEventListener("click", () => window.showQuickBooksUploadModal());
  container.querySelector("#stagingImportCsv")?.addEventListener("click", () => window.showBulkUploadModal());
  const matchedGroup = container.querySelector("#stagingMatchedGroup");
  matchedGroup.addEventListener("toggle", () => {
    if (matchedGroup.isConnected) state.matchedExpanded = matchedGroup.open;
  });
  container.querySelector("#stagingReviewReady").addEventListener("click", async () => {
    if (state.busy) return;
    state.matchedExpanded = true;
    if (state.filter) {
      state.filter = "";
      container.querySelector("#stagingFilter").value = "";
      try {
        await loadStagingData();
      } catch (err) {
        console.error("Ready invoice review failed:", err);
        return;
      }
    } else {
      renderStagingGrid();
    }
    if (isCurrentGrid(project, container)) {
      container.querySelector("#stagingMatchedGroup")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  container.querySelector(
    "#stagingFilter"
  ).value = state.filter;

  container.querySelector(
    "#btnPopulateAll"
  )?.addEventListener("click", () => {
    runPopulateAll();
  });

  container.querySelector(
    "#refreshStagingGrid"
  ).addEventListener("click", () => {
    window.refreshStagingGrid();
  });

  container.querySelector(
    "#stagingFilter"
  ).addEventListener("change", (event) => {
    state.filter = event.target.value;
    state.error = "";

    loadStagingData().catch((err) => {
      console.error("Filter load failed:", err);
    });
  });

  container.querySelectorAll(
    "th.sortable"
  ).forEach((th) => {
    th.addEventListener("click", () => {
      if (state.busy) {
        return;
      }

      const field = th.dataset.field;

      if (state.sortField === field) {
        state.sortDirection =
          state.sortDirection === "asc"
            ? "desc"
            : "asc";
      } else {
        state.sortField = field;
        state.sortDirection = "asc";
      }

      renderStagingGrid();
    });
  });

  container.querySelector(
    "#defaultNewContactType"
  )?.addEventListener("change", (event) => {
    try {
      const openRow = state.rows.find(
        (row) => String(row.id) === state.openRowId
      );

      if (openRow) {
        requireSavedContactReview(openRow, container);
      }

      state.defaultContactType = event.target.value;
      renderStagingGrid();
    } catch (err) {
      event.target.value = state.defaultContactType;
      showActionError(err);
    }
  });

  container.querySelectorAll(
    "[data-new-contact-field]"
  ).forEach((input) => {
    const remember = () => {
      getStagingNewContact(
        state,
        input.dataset.id
      )[input.dataset.newContactField] = input.value;
    };

    input.addEventListener("input", remember);
    input.addEventListener("change", remember);
  });

  container.querySelectorAll(
    "[data-new-contact-panel]"
  ).forEach((panel) => {
    panel.addEventListener("toggle", () => {
      if (panel.isConnected) {
        getStagingNewContact(
          state,
          panel.dataset.newContactPanel
        ).open = panel.open;
      }
    });
  });

  container.querySelectorAll(
    "[data-contact-query]"
  ).forEach((input) => {
    input.addEventListener("input", () => {
      getContactLookup(
        state,
        input.dataset.contactQuery
      ).query = input.value;
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runContactSearch(input.dataset.contactQuery);
      }
    });
  });

  container.querySelectorAll(
    "[data-action]"
  ).forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();

      if (state.busy) {
        return;
      }

      const id = element.dataset.id;

      switch (element.dataset.action) {
        case "edit":
        case "cancel":
          window.toggleEdit(id);
          break;

        case "retry":
          window.autoMatchContact(id);
          break;

        case "reload-contact-types":
          reloadStagingContactTypes();
          break;

        case "create-contact":
          createStagingContact(id);
          break;

        case "search-contacts":
          runContactSearch(id);
          break;

        case "use-contact":
          useStagingContact(
            id,
            element.dataset.contactId
          );
          break;

        case "save":
          window.saveEdit(id);
          break;

        case "delete":
          window.deleteStagingRow(id);
          break;
      }
    });
  });
}

/* =========================================================
   EXISTING CONTACT SEARCH AND SELECTION

   Uses the contact-resolution routes in the Financials Worker.
   No contact creation and no final revenue insertion.
========================================================= */

function getContactLookup(state, id) {
  const key = String(id);

  if (!state.contactLookups.has(key)) {
    state.contactLookups.set(key, {
      query: "",
      contacts: [],
      searched: false,
      total: 0,
      error: ""
    });
  }

  return state.contactLookups.get(key);
}

function getContactDisplayName(contact) {
  const personName = [
    contact.first_name,
    contact.last_name
  ].filter(Boolean).join(" ");

  return (
    contact.search_name ||
    personName ||
    contact.business_name ||
    contact.contact_id ||
    ""
  );
}

function renderContactCandidateRows(
  contacts,
  stagingId,
  canSelect
) {
  return contacts.map((contact) => `
    <tr>
      <td>
        ${escapeHtml(getContactDisplayName(contact))}
        <div style="font-size:0.75em; color:#888;">
          ${escapeHtml(contact.contact_id || "")}
        </div>
      </td>

      <td>
        ${escapeHtml(contact.business_name || "")}
      </td>

      <td>
        ${escapeHtml(contact.email || "")}
      </td>

      <td>
        ${escapeHtml(contact.contact_type || "")}
      </td>

      <td>
        <button
          type="button"
          data-action="use-contact"
          data-id="${escapeHtml(String(stagingId))}"
          data-contact-id="${escapeHtml(contact.contact_id || "")}"
          ${canSelect ? "" : "disabled"}
        >
          Use This
        </button>
      </td>
    </tr>
  `).join("");
}

function requireSavedContactReview(row, container) {
  const fields = [
    ["edit_customer", row.customer_name],
    ["edit_invoice", row.invoice_number],
    ["edit_description", row.description],
    ["edit_date", row.transaction_date],
    ["edit_amount", row.amount]
  ];

  const changed = fields.some(([prefix, original]) => {
    const input = document.getElementById(
      `${prefix}_${row.id}`
    );

    if (!input || !container.contains(input)) {
      return false;
    }

    if (prefix === "edit_amount") {
      return input.value.trim() === ""
        ? original != null
        : Number(input.value) !== Number(original);
    }

    return (
      input.value.trim() !==
      String(original ?? "").trim()
    );
  });

  if (changed) {
    throw new Error(
      "Save your invoice corrections before searching or selecting a contact. " +
      "Your current edits have not been discarded."
    );
  }
}

async function runContactSearch(id) {
  let project;

  try {
    project = requireNonSnfProject();
    requireEditPermission();
  } catch (err) {
    showActionError(err);
    return;
  }

  const state = getStagingState(project);
  const container = document.getElementById("stagingGrid");
  const row = state.rows.find(
    (item) => String(item.id) === String(id)
  );

  if (
    state.busy ||
    !container ||
    !row ||
    row.status === "imported" ||
    row.imported_at
  ) {
    return;
  }

  const lookup = getContactLookup(state, id);

  try {
    requireSavedContactReview(row, container);

    const input = document.getElementById(
      `contact_search_${id}`
    );

    if (input && container.contains(input)) {
      lookup.query = input.value;
    }

    if (
      lookup.query.trim().length < 2 ||
      lookup.query.trim().length > 200
    ) {
      throw new Error("Enter 2 to 200 characters to search.");
    }
  } catch (err) {
    showActionError(err);
    return;
  }

  state.busy = true;
  state.error = "";
  state.message = "Searching existing contacts...";
  lookup.error = "";

  renderStagingGrid();

  try {
    const data = await stagingRequest(
      `/staging/contact-search?q=${encodeURIComponent(
        lookup.query.trim()
      )}`,
      { project }
    );

    if (
      data?.success !== true ||
      data.project !== project ||
      !Array.isArray(data.contacts)
    ) {
      throw new Error(
        "The contact-search response could not be confirmed."
      );
    }

    lookup.contacts = data.contacts;
    lookup.total = data.total;
    lookup.searched = true;

    state.message =
      "Contact search finished. Review the results before choosing.";
  } catch (err) {
    lookup.error = err.message || "Contact search failed.";
    state.error = lookup.error;
  } finally {
    state.busy = false;

    if (isCurrentGrid(project, container)) {
      renderStagingGrid();
    }
  }
}

async function useStagingContact(id, contactId, options = {}) {
  let project;

  try {
    project = requireNonSnfProject();
    requireEditPermission();
  } catch (err) {
    showActionError(err);
    return;
  }

  const state = getStagingState(project);
  const container = document.getElementById("stagingGrid");
  const row = state.rows.find(
    (item) => String(item.id) === String(id)
  );

  if (
    state.busy ||
    !container ||
    !row ||
    row.status === "imported" ||
    row.imported_at
  ) {
    return;
  }

  const lookup = getContactLookup(state, id);
  const result = getRowResult(row, state);
  const candidates = [
    ...(Array.isArray(result?.candidates)
      ? result.candidates
      : []),
    ...lookup.contacts
  ];

  const contact = candidates.find(
    (item) => String(item.contact_id) === String(contactId)
  );

  try {
    requireSavedContactReview(row, container);

    if (!contact) {
      throw new Error(
        "This suggestion is no longer available. " +
        "Retry matching or search again."
      );
    }
  } catch (err) {
    showActionError(err);
    return;
  }

  const confirmed = options.confirmed === true || window.confirm(
    `Use ${getContactDisplayName(contact)} for invoice ` +
    `${row.invoice_number || "(no number)"}?\n\n` +
    `Business: ${contact.business_name || "(none)"}\n` +
    `Email: ${contact.email || "(none)"}\n` +
    `Contact ID: ${contact.contact_id}\n\n` +
    "This updates this staging record only. " +
    "It does not rename a contact or add revenue."
  );

  if (!confirmed) {
    return;
  }

  state.busy = true;
  state.error = "";
  state.message =
    "Assigning selected contact and checking its referral...";

  renderStagingGrid();

  try {
    const data = await stagingRequest(
      "/staging/assign-contact",
      {
        project,
        method: "POST",
        body: {
          id: row.id,
          contact_id: contact.contact_id,
          expected_updated_at: row.updated_at || null
        }
      }
    );

    if (
      data?.success !== true ||
      data.project !== project ||
      String(data.row?.id) !== String(row.id) ||
      String(data.result?.id) !== String(row.id) ||
      data.row.contact_id !== contact.contact_id ||
      !["existing_assignment", "review_error"].includes(
        data.result?.outcome
      )
    ) {
      throw new Error(
        "The contact-assignment result could not be confirmed. " +
        "Refresh records before continuing."
      );
    }

    Object.assign(row, data.row);
    row.contact_name = getContactDisplayName(contact);

    state.results.set(String(id), data.result);
    state.message = data.result.message;

    if (data.result.outcome === "existing_assignment") {
      state.matchedExpanded = true;
      state.openRowId = null;
    }

    if (isCurrentGrid(project, container)) {
      try {
        await loadStagingData();
      } catch (err) {
        state.error =
          "The assignment was saved, but the grid could not refresh. " +
          "Click Refresh Records.";
      }
    }
  } catch (err) {
    state.results.delete(String(id));
    state.error = err.message || "Contact assignment failed.";
    state.message =
      "Assignment could not be confirmed. Refresh records and " +
      "run matching before adding revenue.";
  } finally {
    state.busy = false;

    if (isCurrentGrid(project, container)) {
      renderStagingGrid();
    }
  }
}

/* =========================================================
   NEW CONTACT TYPES AND CREATION
========================================================= */

async function loadStagingContactTypes(project, container, force = false) {
  const state = getStagingState(project);

  if (state.contactTypesLoaded && !force) return;

  state.contactTypesLoading = true;
  state.contactTypesError = "";

  try {
    const data = await stagingRequest(
      "/staging/contact-types",
      { project }
    );

    if (
      data?.success !== true ||
      data.project !== project ||
      !Array.isArray(data.types) ||
      data.types.some((type) => typeof type.value !== "string")
    ) {
      throw new Error("The contact-type response could not be confirmed.");
    }

    state.contactTypes = data.types;
    state.contactTypesLoaded = true;

    if (!data.types.some((type) => type.value === state.defaultContactType)) {
      state.defaultContactType = "";
    }
  } catch (err) {
    state.contactTypes = [];
    state.contactTypesLoaded = false;
    state.contactTypesError = err.message || "Contact types could not load.";
  } finally {
    state.contactTypesLoading = false;
  }
}

function renderStagingContactTypeOptions(state, selected) {
  const placeholder = state.contactTypesLoading
    ? "Loading contact types..."
    : state.contactTypes.length
      ? "Choose a contact type"
      : "No active contact types available";

  return `
    <option value="">${escapeHtml(placeholder)}</option>
    ${state.contactTypes.map((type) => `
      <option
        value="${escapeHtml(type.value)}"
        ${type.value === selected ? "selected" : ""}
      >
        ${escapeHtml(type.value)}
      </option>
    `).join("")}
  `;
}

function renderStagingContactTypeMessage(state) {
  if (state.contactTypesError) {
    return `
      <p role="alert" style="color:#b00020;">
        ${escapeHtml(state.contactTypesError)}
        Contact creation is blocked until types load.
      </p>
    `;
  }

  if (state.contactTypesLoaded && !state.contactTypes.length) {
    return `
      <p style="color:#9a4500;">
        No active contact_type lookups were found for this project.
        Add or activate a lookup, then reload contact types.
      </p>
    `;
  }

  return "";
}

async function reloadStagingContactTypes() {
  let project;

  try {
    project = requireNonSnfProject();
  } catch (err) {
    showActionError(err);
    return;
  }

  const state = getStagingState(project);
  const container = document.getElementById("stagingGrid");

  if (state.busy || !container) return;

  try {
    const row = state.rows.find(
      (item) => String(item.id) === state.openRowId
    );

    if (row) requireSavedContactReview(row, container);
  } catch (err) {
    showActionError(err);
    return;
  }

  state.busy = true;

  try {
    await loadStagingContactTypes(project, container, true);
  } finally {
    state.busy = false;

    if (isCurrentGrid(project, container)) renderStagingGrid();
  }
}

function getStagingNewContact(state, id) {
  const key = String(id);

  if (!state.newContacts.has(key)) {
    state.newContacts.set(key, {
      first_name: "",
      last_name: "",
      business_name: "",
      email: "",
      contact_type: null,
      createdContact: null,
      attempted: false,
      open: false,
      error: ""
    });
  }

  return state.newContacts.get(key);
}

function renderStagingNewContactForm(row, state, canEdit) {
  const form = getStagingNewContact(state, row.id);
  const id = escapeHtml(String(row.id));
  const selectedType = form.contact_type === null
    ? state.defaultContactType
    : form.contact_type;
  const disabled = !canEdit || state.busy || !!form.createdContact;
  const createDisabled = disabled || !state.contactTypes.length || !!row.contact_id;
  const fields = [
    ["first_name", "First Name", "text"],
    ["last_name", "Last Name", "text"],
    ["business_name", "Business", "text"],
    ["email", "Email", "email"]
  ];

  return `
    <details
      data-new-contact-panel="${id}"
      style="margin-top:16px;"
      ${form.open ? "open" : ""}
    >
      <summary>Add New Contact</summary>

      <div
        style="
          display:grid;
          grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));
          gap:12px;
          margin-top:12px;
        "
      >
        ${fields.map(([key, label, type]) => `
          <div>
            <label for="new_contact_${key}_${id}">${label}</label>
            <input
              id="new_contact_${key}_${id}"
              class="form-control"
              type="${type}"
              data-new-contact-field="${key}"
              data-id="${id}"
              value="${escapeHtml(form[key])}"
              maxlength="${key === "email" ? 254 : key === "business_name" ? 500 : 200}"
              ${disabled ? "disabled" : ""}
            >
          </div>
        `).join("")}

        <div>
          <label for="new_contact_contact_type_${id}">Contact Type</label>
          <select
            id="new_contact_contact_type_${id}"
            class="form-control"
            data-new-contact-field="contact_type"
            data-id="${id}"
            ${disabled || !state.contactTypes.length ? "disabled" : ""}
          >
            ${renderStagingContactTypeOptions(state, selectedType)}
          </select>
        </div>
      </div>

      ${renderStagingContactTypeMessage(state)}

      <p style="color:#555;">
        The review default is preselected unless you override it here.
        Enter a person name or business name. Email is optional.
        Search existing contacts before creating a new contact.
      </p>

      ${form.error ? `
        <p role="alert" style="color:#b00020; white-space:pre-wrap;">
          ${escapeHtml(form.error)}
        </p>
      ` : ""}

      ${form.createdContact ? `
        <p role="status">
          Saved contact: ${escapeHtml(getContactDisplayName(form.createdContact))}
          (${escapeHtml(form.createdContact.contact_id)}).
          Use this contact instead of creating another one.
        </p>
        <button
          type="button"
          data-action="use-created-contact"
          data-id="${id}"
          ${!canEdit || state.busy ? "disabled" : ""}
        >
          Use Created Contact
        </button>
      ` : `
        <button
          type="button"
          data-action="create-contact"
          data-id="${id}"
          ${createDisabled ? "disabled" : ""}
        >
          ${form.attempted ? "Check / Retry Creation" : "Create Contact &amp; Use"}
        </button>
      `}

      <button
        type="button"
        data-action="recover-created-contact"
        data-id="${id}"
        ${!canEdit || state.busy ? "disabled" : ""}
      >
        Check Previous Creation
      </button>

      <p style="color:#666; font-size:0.9em;">
        Check Previous Creation only looks for a contact previously
        created from this staging record. It does not create one.
        Contact creation and revenue insertion are separate actions.
      </p>
    </details>
  `;
}

async function createStagingContact(id, recoverOnly = false) {
  let project;

  try {
    project = requireNonSnfProject();
    requireEditPermission();
  } catch (err) {
    showActionError(err);
    return;
  }

  const state = getStagingState(project);
  const container = document.getElementById("stagingGrid");
  const row = state.rows.find((item) => String(item.id) === String(id));

  if (state.busy || !container || !row || row.status === "imported" || row.imported_at) return;

  const form = getStagingNewContact(state, id);
  let payload;

  try {
    requireSavedContactReview(row, container);

    if (recoverOnly) {
      payload = { id: row.id, recover_only: true };
    } else {
      if (row.contact_id) throw new Error("A contact is already assigned. Review it before creating a new contact.");

      for (const key of ["first_name", "last_name", "business_name", "email", "contact_type"]) {
        const input = document.getElementById(`new_contact_${key}_${id}`);

        if (input && container.contains(input)) form[key] = input.value;
      }

      const type = form.contact_type === null
        ? state.defaultContactType
        : form.contact_type;

      if (!state.contactTypes.some((item) => item.value === type)) {
        throw new Error("Choose an active contact type for this project.");
      }

      payload = {
        id: row.id,
        expected_updated_at: row.updated_at || null,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        business_name: form.business_name.trim(),
        email: form.email.trim(),
        contact_type: type
      };

      if (!payload.first_name && !payload.last_name && !payload.business_name) {
        throw new Error("Enter a person name or business name.");
      }

      if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        throw new Error("Enter a valid email address, or leave it blank.");
      }

      const confirmed = window.confirm(
        "Create and use this contact?\n\n" +
        `First name: ${payload.first_name || "(none)"}\n` +
        `Last name: ${payload.last_name || "(none)"}\n` +
        `Business: ${payload.business_name || "(none)"}\n` +
        `Email: ${payload.email || "(none)"}\n` +
        `Contact type: ${payload.contact_type}\n\n` +
        "This creates a contact and assigns it to this staging record. " +
        "It does not insert revenue."
      );

      if (!confirmed) return;
      form.attempted = true;
    }
  } catch (err) {
    showActionError(err);
    return;
  }

  form.error = "";
  form.open = true;
  state.busy = true;
  state.error = "";
  state.message = recoverOnly ? "Checking previous contact creation..." : "Creating contact...";
  let assignContactId = null;

  renderStagingGrid();

  try {
    const data = await stagingRequest(
      "/staging/create-contact",
      { project, method: "POST", body: payload }
    );

    if (
      data?.success !== true ||
      data.project !== project ||
      data.contact?.project !== project ||
      data.contact?.contact_id !== `stg-${String(id).toLowerCase()}`
    ) {
      throw new Error("Contact creation could not be confirmed. Use Check Previous Creation before trying again.");
    }

    form.createdContact = data.contact;
    const lookup = getContactLookup(state, id);
    lookup.contacts = [data.contact, ...lookup.contacts.filter(
      (contact) => contact.contact_id !== data.contact.contact_id
    )];
    lookup.total = lookup.contacts.length;
    lookup.searched = true;

    if (data.reused || recoverOnly) {
      state.message = data.message || "Saved contact found. Review it, then click Use Created Contact.";
    } else {
      assignContactId = data.contact.contact_id;
      state.message = "Contact created. Assigning it to the staging record...";
    }
  } catch (err) {
    form.error = err.message || "Contact creation could not be confirmed.";
    state.error = form.error;
    state.message = "No revenue was inserted. Check previous creation before making another contact.";
  } finally {
    state.busy = false;

    if (isCurrentGrid(project, container)) renderStagingGrid();
  }

  if (assignContactId && isCurrentGrid(project, container)) {
    await useStagingContact(id, assignContactId, { confirmed: true });
  }
}

/* =========================================================
   REVIEW PANEL AND FULL INVOICE EDITOR
========================================================= */

function renderReviewEditor(row, state, canEdit) {
  const id = escapeHtml(String(row.id));
  const result = getRowResult(row, state);

  const candidates =
    Array.isArray(result?.candidates)
      ? result.candidates
      : [];

  const lookup = getContactLookup(state, row.id);

  const candidateRows = renderContactCandidateRows(
    candidates,
    row.id,
    canEdit && !state.busy
  );

  return `
    <tr id="edit-${id}" style="background:#f7f7f7;">
      <td colspan="9" style="padding:16px;">

        <h3 style="margin-top:0;">Resolve Contact</h3>

        <p style="white-space:pre-wrap;">
          ${escapeHtml(
            result?.message ||
            row.error_message ||
            "Run Match All Contacts or Retry Matching to check this invoice."
          )}
        </p>

        ${
          canEdit
            ? `
              <button
                type="button"
                class="btn-primary"
                data-action="retry"
                data-id="${id}"
              >
                Retry Matching
              </button>
            `
            : ""
        }

        ${
          candidates.length
            ? `
              <div
                style="
                  margin-top:16px;
                  overflow-x:auto;
                "
              >
                <table
                  class="notes-table"
                  style="
                    width:100%;
                    border-collapse:collapse;
                  "
                >
                  <thead>
                    <tr>
                      <th>Contact</th>
                      <th>Business</th>
                      <th>Email</th>
                      <th>Contact Type</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>${candidateRows}</tbody>
                </table>
              </div>
            `
            : ""
        }

        <div style="margin-top:16px;">
          <label>Search existing contacts</label>

          <div
            style="
              display:flex;
              gap:10px;
              margin-top:6px;
              flex-wrap:wrap;
            "
          >
            <input
              id="contact_search_${id}"
              class="form-control"
              placeholder="Name, business, or email"
              maxlength="200"
              value="${escapeHtml(lookup.query)}"
              data-contact-query="${id}"
              ${canEdit && !state.busy ? "" : "disabled"}
            >

            <button
              type="button"
              data-action="search-contacts"
              data-id="${id}"
              ${canEdit && !state.busy ? "" : "disabled"}
            >
              Search Contacts
            </button>
          </div>
        </div>

        <p style="color:#666; font-size:0.9em;">
          Search existing contacts in this project by name,
          business, or email. Enter at least two characters.
          Save invoice corrections before searching or selecting.
        </p>

        ${
          lookup.error
            ? `
              <p role="alert" style="color:#b00020;">
                ${escapeHtml(lookup.error)}
              </p>
            `
            : ""
        }

        ${
          lookup.searched
            ? `
              <div style="margin-top:16px;">
                <h4>Contact Search Results</h4>

                <p role="status">
                  ${escapeHtml(String(lookup.total))}
                  matching contact(s).
                  ${
                    lookup.total > 50
                      ? "Showing the first 50. Refine your search for other results."
                      : ""
                  }
                </p>

                ${
                  lookup.contacts.length
                    ? `
                      <div style="overflow-x:auto;">
                        <table
                          class="notes-table"
                          style="width:100%; border-collapse:collapse;"
                        >
                          <thead>
                            <tr>
                              <th>Contact</th>
                              <th>Business</th>
                              <th>Email</th>
                              <th>Contact Type</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${renderContactCandidateRows(
                              lookup.contacts,
                              row.id,
                              canEdit && !state.busy
                            )}
                          </tbody>
                        </table>
                      </div>
                    `
                    : `
                      <p>
                        No contacts found. Try part of a name,
                        business, or email.
                      </p>
                    `
                }
              </div>
            `
            : ""
        }

        ${renderStagingNewContactForm(row, state, canEdit)}

        <p style="margin-top:16px; color:#666; font-size:0.9em;">
          Use an existing contact when it is the correct person
          or business. Creating a contact does not add revenue;
          Step 3 remains a separate action.
        </p>

        <hr style="margin:20px 0;">

        <h3>Edit Imported Invoice</h3>

        <div
          style="
            display:grid;
            grid-template-columns:repeat(
              auto-fit,
              minmax(220px, 1fr)
            );
            gap:12px;
          "
        >
          <div>
            <label>Customer</label>
            <input
              id="edit_customer_${id}"
              class="form-control"
              value="${escapeHtml(
                row.customer_name || ""
              )}"
              ${canEdit ? "" : "disabled"}
            >
          </div>

          <div>
            <label>Invoice #</label>
            <input
              id="edit_invoice_${id}"
              class="form-control"
              value="${escapeHtml(
                row.invoice_number || ""
              )}"
              ${canEdit ? "" : "disabled"}
            >
          </div>

          <div>
            <label>Description</label>
            <input
              id="edit_description_${id}"
              class="form-control"
              value="${escapeHtml(
                row.description || ""
              )}"
              ${canEdit ? "" : "disabled"}
            >
          </div>

          <div>
            <label>Date</label>
            <input
              id="edit_date_${id}"
              type="date"
              class="form-control"
              value="${escapeHtml(
                row.transaction_date || ""
              )}"
              ${canEdit ? "" : "disabled"}
            >
          </div>

          <div>
            <label>Amount</label>
            <input
              id="edit_amount_${id}"
              type="number"
              step="0.01"
              class="form-control"
              value="${escapeHtml(
                row.amount == null
                  ? ""
                  : String(row.amount)
              )}"
              ${canEdit ? "" : "disabled"}
            >
          </div>

          <div>
            <label>Assigned Contact ID</label>
            <input
              class="form-control"
              value="${escapeHtml(
                row.contact_id || ""
              )}"
              readonly
            >
          </div>
        </div>

        <p style="color:#555;">
          Changing the customer name clears the existing
          contact assignment. Save, then retry matching.
          Editing an invoice does not rename a contact.
        </p>

        <div
          style="
            margin-top:16px;
            display:flex;
            gap:10px;
            flex-wrap:wrap;
          "
        >
          ${
            canEdit
              ? `
                <button
                  type="button"
                  class="btn-primary"
                  data-action="save"
                  data-id="${id}"
                >
                  Save Invoice
                </button>

                <button
                  type="button"
                  class="btn-danger"
                  data-action="delete"
                  data-id="${id}"
                >
                  Delete Invoice
                </button>
              `
              : ""
          }

          <button
            type="button"
            class="btn-secondary"
            data-action="cancel"
            data-id="${id}"
          >
            Close
          </button>
        </div>
      </td>
    </tr>
  `;
}

window.toggleEdit = function (id) {
  const state = getStagingState();

  if (state.busy) {
    return;
  }

  const key = String(id);

  state.openRowId =
    state.openRowId === key ? null : key;

  renderStagingGrid();
};

window.fixRow = function (id) {
  window.toggleEdit(id);
};

/* =========================================================
   SAVE INVOICE CORRECTIONS
========================================================= */

window.saveEdit = async function (id) {
  let project;

  try {
    project = requireNonSnfProject();
    requireEditPermission();
  } catch (err) {
    showActionError(err);
    return;
  }

  const state = getStagingState(project);

  if (state.busy) {
    return;
  }

  const row = state.rows.find(
    (item) => String(item.id) === String(id)
  );

  if (!row || row.status === "imported") {
    alert("This pending invoice is no longer available.");
    return;
  }

  const container = document.getElementById(
    "stagingGrid"
  );

  function inputValue(prefix) {
    const input = document.getElementById(
      `${prefix}_${id}`
    );

    if (!input || !container?.contains(input)) {
      throw new Error(
        "The invoice editor is no longer open."
      );
    }

    return input.value.trim();
  }

  try {
    const customer_name = inputValue(
      "edit_customer"
    );

    const invoice_number = inputValue(
      "edit_invoice"
    );

    const description = inputValue(
      "edit_description"
    );

    const date = inputValue("edit_date");
    const amountText = inputValue("edit_amount");

    if (
      !customer_name ||
      !invoice_number ||
      !date ||
      amountText === ""
    ) {
      throw new Error(
        "Customer, invoice number, date, and amount are required."
      );
    }

    const amount = Number(amountText);

    if (!Number.isFinite(amount)) {
      throw new Error("Enter a valid amount.");
    }

    const nameChanged =
      customer_name !==
      String(row.customer_name || "");

    const payload = {
      id: row.id,
      project,
      customer_name,
      invoice_number,
      description,
      transaction_date: date,
      amount,
      contact_id: nameChanged
        ? null
        : row.contact_id || null,
      needs_review: true
    };

    state.busy = true;
    state.error = "";
    state.message = "Saving invoice...";

    renderStagingGrid();

    await stagingRequest(
      "/staging/update-inline",
      {
        project,
        method: "PATCH",
        body: payload
      }
    );

    // Any edit requires a fresh matching/preparation check
    // before this screen displays the invoice as ready.
    state.results.delete(String(id));
    state.openRowId = null;

    state.message =
      "Invoice saved. Retry matching or run Match All Contacts.";

    if (isCurrentGrid(project, container)) {
      await loadStagingData();
    }
  } catch (err) {
    state.error =
      err.message || "Invoice update failed.";

    console.error("Invoice update failed:", err);
  } finally {
    state.busy = false;

    if (isCurrentGrid(project, container)) {
      renderStagingGrid();
    }
  }
};

/* =========================================================
   DELETE STAGING ROW
========================================================= */

window.deleteStagingRow = async function (id) {
  let project;

  try {
    project = requireNonSnfProject();
    requireEditPermission();
  } catch (err) {
    showActionError(err);
    return;
  }

  const state = getStagingState(project);

  if (state.busy) {
    return;
  }

  const row = state.rows.find(
    (item) => String(item.id) === String(id)
  );

  if (!row || row.status === "imported") {
    alert("This pending invoice is no longer available.");
    return;
  }

  if (!confirm("Delete this staging invoice?")) {
    return;
  }

  const container = document.getElementById(
    "stagingGrid"
  );

  state.busy = true;
  state.error = "";
  state.message = "Deleting invoice...";

  renderStagingGrid();

  try {
    await stagingRequest(
      `/staging/delete-inline?id=${encodeURIComponent(id)}`,
      {
        project,
        method: "DELETE"
      }
    );

    state.results.delete(String(id));
    state.openRowId = null;
    state.message = "Staging invoice deleted.";

    if (isCurrentGrid(project, container)) {
      await loadStagingData();
    }
  } catch (err) {
    state.error =
      err.message || "Could not delete the invoice.";

    console.error("Invoice deletion failed:", err);
  } finally {
    state.busy = false;

    if (isCurrentGrid(project, container)) {
      renderStagingGrid();
    }
  }
};

/* =========================================================
   CSV UPLOAD MODALS

   Existing endpoints:
   Generic:
     POST /staging/bulk-upload

   QuickBooks:
     POST /staging/quickbooks-upload
========================================================= */

window.showBulkUploadModal = function () {
  openStagingUploadModal("generic");
};

window.showQuickBooksUploadModal = function () {
  openStagingUploadModal("quickbooks");
};

function openStagingUploadModal(kind) {
  let project;

  try {
    project = requireNonSnfProject();
    requireEditPermission();
  } catch (err) {
    showActionError(err);
    return;
  }

  if (getStagingState(project).busy) {
    alert(
      "Wait for the current staging operation to finish."
    );
    return;
  }

  const quickBooks = kind === "quickbooks";

  const modalId = quickBooks
    ? "quickBooksUploadModal"
    : "bulkUploadModal";

  // Do not allow simultaneous upload popups.
  const existing =
    document.getElementById(
      "quickBooksUploadModal"
    ) ||
    document.getElementById(
      "bulkUploadModal"
    );

  if (existing) {
    existing.querySelector(
      'input[type="file"]'
    )?.focus();
    return;
  }

  const previousFocus = document.activeElement;
  const modal = document.createElement("div");

  modal.id = modalId;

  modal.style.cssText = `
    position:fixed;
    inset:0;
    background:rgba(0,0,0,0.4);
    display:flex;
    align-items:center;
    justify-content:center;
    padding:16px;
    box-sizing:border-box;
    z-index:9999;
  `;

  modal.innerHTML = `
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="${modalId}Title"
      style="
        background:white;
        padding:24px;
        width:520px;
        max-width:100%;
        max-height:90vh;
        overflow:auto;
        border-radius:6px;
        box-sizing:border-box;
      "
    >
      <h3
        id="${modalId}Title"
        style="margin:0 0 12px;"
      >
        ${
          quickBooks
            ? "Import QuickBooks Invoices"
            : "Bulk Upload"
        }
      </h3>

      ${
        quickBooks
          ? `
            <p style="margin:0 0 12px;">
              Select the CSV exported from QuickBooks’
              “Invoice List by Date” report.
            </p>

            <p style="margin:0 0 16px; color:#555;">
              Upload the original export. Do not remove
              report headings, totals, or extra columns.
            </p>
          `
          : `
            <p style="margin:0 0 16px;">
              Select a prepared CSV file.
              The first row must contain column names:
              transaction_date, invoice_number,
              customer_name, amount.
            </p>
          `
      }

      <label
        for="${modalId}File"
        style="display:block; margin-bottom:6px;"
      >
        ${quickBooks ? "QuickBooks CSV file" : "CSV file"}
      </label>

      <input
        type="file"
        id="${modalId}File"
        accept=".csv"
        style="
          display:block;
          width:100%;
          box-sizing:border-box;
        "
      />

      <p
        style="
          margin:14px 0 0;
          font-size:0.9em;
          color:#555;
        "
      >
        This uploads invoices to the review area only.
        It does not add contacts or insert final
        financial records.
      </p>

      <div
        class="upload-status"
        role="status"
        aria-live="polite"
        style="
          margin-top:14px;
          white-space:pre-wrap;
          overflow-wrap:anywhere;
        "
      ></div>

      <div
        style="
          margin-top:20px;
          display:flex;
          justify-content:flex-end;
          gap:10px;
        "
      >
        <button
          type="button"
          class="upload-cancel"
        >
          Cancel
        </button>

        <button
          type="button"
          class="btn-primary upload-submit"
        >
          Upload to Review
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const fileInput = modal.querySelector(
    'input[type="file"]'
  );

  const cancelBtn = modal.querySelector(
    ".upload-cancel"
  );

  const uploadBtn = modal.querySelector(
    ".upload-submit"
  );

  const statusEl = modal.querySelector(
    ".upload-status"
  );

  let uploading = false;

  function showStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.style.color =
      isError ? "#b00020" : "#555";
  }

  function closeModal() {
    if (uploading) {
      return;
    }

    document.removeEventListener(
      "keydown",
      handleKeyDown
    );

    modal.remove();

    if (previousFocus?.isConnected) {
      previousFocus.focus();
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      closeModal();
    }
  }

  cancelBtn.addEventListener(
    "click",
    closeModal
  );

  document.addEventListener(
    "keydown",
    handleKeyDown
  );

  fileInput.focus();

  uploadBtn.addEventListener("click", async () => {
    if (uploading) {
      return;
    }

    if (getProject() !== project) {
      showStatus(
        "The selected project changed. Close this popup and reopen import.",
        true
      );
      return;
    }

    try {
      requireEditPermission();
    } catch (err) {
      showStatus(err.message, true);
      return;
    }

    const state = getStagingState(project);

    if (state.busy) {
      showStatus(
        "Wait for the current staging operation to finish.",
        true
      );
      return;
    }

    const file = fileInput.files?.[0];

    if (!file) {
      showStatus(
        "Please select a CSV file.",
        true
      );
      return;
    }

    if (!/\.csv$/i.test(file.name)) {
      showStatus(
        "Please select a file ending in .csv.",
        true
      );
      return;
    }

    uploading = true;
    state.busy = true;
    uploadBtn.disabled = true;
    cancelBtn.disabled = true;
    fileInput.disabled = true;
    uploadBtn.textContent = "Uploading...";

    const container = document.getElementById(
      "stagingGrid"
    );

    if (container && isCurrentGrid(project, container)) {
      renderStagingGrid();
    }

    let uploaded = false;

    try {
      showStatus("Reading CSV file...");

      const csvText = await file.text();

      if (!csvText.trim()) {
        throw new Error(
          "The selected CSV file is empty."
        );
      }

      showStatus(
        "Uploading invoices to the review area..."
      );

      const result = await stagingRequest(
        quickBooks
          ? "/staging/quickbooks-upload"
          : "/staging/bulk-upload",
        {
          project,
          method: "POST",
          body: csvText,
          csv: true
        }
      );

      uploaded = true;

      if (getProject() !== project) {
        showStatus(
          "Upload completed for the original project. " +
          "Return to that project to review the invoices."
        );
        return;
      }

      // Show pending records after an upload, even if
      // the user previously selected Imported.
      state.filter = "";
      state.error = "";
      state.message =
        "Upload complete. Review the records in Step 2, then run Match All Contacts.";

      const filterEl = document.getElementById(
        "stagingFilter"
      );

      if (filterEl) {
        filterEl.value = "";
      }

      const count =
        Number.isInteger(result?.uploaded_count)
          ? result.uploaded_count
          : Array.isArray(result)
            ? result.length
            : null;

      try {
        await loadStagingData();

        showStatus(
          (
            count === null
              ? "Upload complete."
              : `${count} invoice(s) uploaded.`
          ) +
          " Close this popup to review the records in Step 2, then click Match All Contacts."
        );
      } catch (err) {
        console.error(
          "Staging refresh after upload failed:",
          err
        );

        showStatus(
          "Upload succeeded, but the review area could not refresh. " +
          "Close this popup and click Refresh Records in Step 2. " +
          "Do not upload the file again.",
          true
        );
      }
    } catch (err) {
      console.error("CSV upload failed:", err);

      showStatus(
        (err.message || "CSV upload failed.") +
        "\n\nIf the connection failed during upload, " +
        "check the staging area before retrying.",
        true
      );
    } finally {
      uploading = false;
      state.busy = false;
      cancelBtn.disabled = false;

      if (uploaded) {
        uploadBtn.disabled = true;
        uploadBtn.textContent = "Uploaded";
        fileInput.disabled = true;
        cancelBtn.textContent = "Close";
      } else {
        uploadBtn.disabled = false;
        uploadBtn.textContent = "Upload to Review";
        fileInput.disabled = false;
      }

      if (
        container &&
        isCurrentGrid(project, container)
      ) {
        renderStagingGrid();
      }
    }
  });
}
