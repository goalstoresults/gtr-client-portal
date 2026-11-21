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
      defaultContactType: "",
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
        <summary>New contact settings — not enabled yet</summary>
        <div style="margin-top:12px;">
          <label for="defaultNewContactType">Default type for new contacts:</label>
          <select id="defaultNewContactType" disabled title="Contact-type lookup is not connected yet." style="padding:4px 6px;">
            <option value="">Contact types — connection pending</option>
          </select>
          <p style="color:#666;font-size:0.9em;">This setting will apply only to new contacts. Existing contact types will not be changed.</p>
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
   REVIEW PANEL AND FULL INVOICE EDITOR
========================================================= */

function renderReviewEditor(row, state, canEdit) {
  const id = escapeHtml(String(row.id));
  const result = getRowResult(row, state);

  const candidates =
    Array.isArray(result?.candidates)
      ? result.candidates
      : [];

  const candidateRows = candidates.map(
    (candidate) => {
      const personName = [
        candidate.first_name,
        candidate.last_name
      ].filter(Boolean).join(" ");

      const name =
        candidate.search_name ||
        personName ||
        candidate.business_name ||
        candidate.contact_id;

      return `
        <tr>
          <td>${escapeHtml(name || "")}</td>
          <td>
            ${escapeHtml(
              candidate.business_name || ""
            )}
          </td>
          <td>
            ${escapeHtml(candidate.email || "")}
          </td>
          <td>
            ${escapeHtml(
              candidate.contact_type || ""
            )}
          </td>
          <td>
            <button
              type="button"
              disabled
              title="Contact selection will be connected next."
            >
              Use This
            </button>
          </td>
        </tr>
      `;
    }
  ).join("");

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
              class="form-control"
              placeholder="Name, business, or email"
              disabled
            >

            <button type="button" disabled>
              Search Contacts
            </button>
          </div>
        </div>

        <details style="margin-top:16px;">
          <summary>Add New Contact</summary>

          <div
            style="
              display:grid;
              grid-template-columns:repeat(
                auto-fit,
                minmax(200px, 1fr)
              );
              gap:12px;
              margin-top:12px;
            "
          >
            <div>
              <label>First Name</label>
              <input class="form-control" disabled>
            </div>

            <div>
              <label>Last Name</label>
              <input class="form-control" disabled>
            </div>

            <div>
              <label>Business</label>
              <input class="form-control" disabled>
            </div>

            <div>
              <label>Email</label>
              <input
                class="form-control"
                type="email"
                disabled
              >
            </div>

            <div>
              <label>Contact Type</label>
              <select class="form-control" disabled>
                <option>
                  Contact types — connection pending
                </option>
              </select>
            </div>
          </div>

          <p style="color:#555;">
            The review default will be preselected,
            with an override for this contact.
            Contact creation will be connected after
            matching is tested.
          </p>

          <button type="button" disabled>
            Create Contact &amp; Use
          </button>
        </details>

        <p
          style="
            margin-top:16px;
            color:#666;
            font-size:0.9em;
          "
        >
          Contact selection, contact search, and creation
          are not enabled in this test.
          Invoice corrections below are available.
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
