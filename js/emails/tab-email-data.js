// /emails/tab-email-data.js
// Handles CSV upload, staging preview, auto-match, and commit (Worker-based)

import { escapeHtml } from "../utilities.js";

/* =========================================================
   RENDER: Email Data Tab
========================================================= */

export async function renderEmailData(container, portalState) {
  const campaignId = portalState.selectedCampaignId;

  if (!campaignId) {
    container.innerHTML = `
      <section class="card">
        <p>No campaign selected.</p>
      </section>
    `;
    return;
  }

  if (!portalState.staffSelectedProjectId) {
    container.innerHTML = `
      <section class="card warning">
        <p>Please select a project to continue.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <h3>Email Data – Upload & Review</h3>

      <div class="notes-row">
        <label class="notes-label">Upload Delivered CSV</label>
        <input type="file" id="emailData-file" accept=".csv" class="form-control" />
      </div>

      <button id="emailData-uploadBtn" class="btn-primary" style="margin-top:12px;">
        Upload & Stage
      </button>

      <div id="emailData-status" class="status-area" style="margin-top:12px;"></div>
    </section>

    <section class="card" style="margin-top:16px;">
      <h3>Staging Preview</h3>

      <!-- Summary Bar -->
      <div id="emailData-summary" class="summary-bar" style="margin-bottom:12px; display:flex; gap:20px;">
        <div>Total: <span id="totalRecords">0</span></div>
        <div>Matched: <span id="matchedRecords">0</span></div>
        <div>Unmatched: <span id="unmatchedRecords">0</span></div>
        <div>Errors: <span id="errorRecords">0</span></div>
      </div>

      <button id="emailData-matchBtn" class="btn-secondary" style="margin-bottom:12px;">
        Auto‑Match Contacts
      </button>

      <div id="emailData-stagingGrid"></div>

      <div style="margin-top:16px;">
        <button id="emailData-commitBtn" class="btn-primary">Commit to Final Table</button>
      </div>
    </section>
  `;

  const status = document.getElementById("emailData-status");
  const stagingGrid = document.getElementById("emailData-stagingGrid");

  /* =========================================================
     ⭐ NEW: Fetch totals helper
  ========================================================== */
  async function fetchTotals() {
    try {
      const res = await fetch(
        `https://emails-module.dennis-e64.workers.dev/staging/totals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project: portalState.staffSelectedProjectId,
            campaign_id: campaignId
          })
        }
      );

      if (!res.ok) throw new Error("Totals fetch failed");

      const totals = await res.json();
      updateTotalsUI(totals);

    } catch (err) {
      console.error("Totals fetch error:", err);
    }
  }

  /* =========================================================
     UPLOAD CSV → Worker → staging_emails_delivered
  ========================================================== */

  document.getElementById("emailData-uploadBtn").addEventListener("click", async () => {
    status.innerHTML = "";

    const fileInput = document.getElementById("emailData-file");
    if (!fileInput.files.length) {
      status.innerHTML = `<p class="error">Please select a CSV file.</p>`;
      return;
    }

    const file = fileInput.files[0];
    const csvText = await file.text();

    try {
      const res = await fetch(
        `https://emails-module.dennis-e64.workers.dev/staging/upload?project=${encodeURIComponent(
          portalState.staffSelectedProjectId
        )}&campaign_id=${encodeURIComponent(campaignId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "text/csv" },
          body: csvText
        }
      );

      if (!res.ok) throw new Error("Upload failed");

      status.innerHTML = `<p class="success">CSV uploaded and staged successfully.</p>`;

      await loadStagingRows(stagingGrid, portalState, campaignId);

      // ⭐ NEW: Fetch totals after upload
      await fetchTotals();

    } catch (err) {
      console.error(err);
      status.innerHTML = `<p class="error">Error uploading CSV.</p>`;
    }
  });

  /* =========================================================
     AUTO-MATCH CONTACTS (bulk SQL match)
  ========================================================== */

  document.getElementById("emailData-matchBtn").addEventListener("click", async () => {
    status.innerHTML = `<p>Matching...</p>`;

    try {
      const res = await fetch(
        `https://emails-module.dennis-e64.workers.dev/staging/match`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project: portalState.staffSelectedProjectId,
            campaign_id: campaignId
          })
        }
      );

      if (!res.ok) throw new Error("Match failed");

      const data = await res.json();
      console.log("Match result:", data);

      // Update totals UI (already correct)
      updateTotalsUI(data.totals);

      status.innerHTML = `<p class="success">Auto‑match complete.</p>`;

      await loadStagingRows(stagingGrid, portalState, campaignId);

    } catch (err) {
      console.error(err);
      status.innerHTML = `<p class="error">Error matching contacts.</p>`;
    }
  });

  /* =========================================================
     COMMIT STAGING → Final Table
  ========================================================== */

  document.getElementById("emailData-commitBtn").addEventListener("click", async () => {
    status.innerHTML = "";

    try {
      const res = await fetch(
        `https://emails-module.dennis-e64.workers.dev/staging/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project: portalState.staffSelectedProjectId,
            campaign_id: campaignId
          })
        }
      );

      if (!res.ok) throw new Error("Commit failed");

      status.innerHTML = `<p class="success">Staging committed to final table.</p>`;
      stagingGrid.innerHTML = `<p>Committed. No staging rows remain.</p>`;

      // Reset totals
      updateTotalsUI({ total_records: 0, matched_records: 0, unmatched_records: 0, error_records: 0 });

    } catch (err) {
      console.error(err);
      status.innerHTML = `<p class="error">Error committing staging data.</p>`;
    }
  });

  // Load initial staging rows
  await loadStagingRows(stagingGrid, portalState, campaignId);

  // ⭐ NEW: Fetch totals on initial load
  await fetchTotals();
}

/* =========================================================
   UPDATE TOTALS UI
========================================================= */

function updateTotalsUI(totals) {
  if (!totals) return;

  document.getElementById("totalRecords").textContent = totals.total_records ?? 0;
  document.getElementById("matchedRecords").textContent = totals.matched_records ?? 0;
  document.getElementById("unmatchedRecords").textContent = totals.unmatched_records ?? 0;
  document.getElementById("errorRecords").textContent = totals.error_records ?? 0;
}

/* =========================================================
   LOAD STAGING ROWS (Worker-based, sortable grid)
========================================================= */

async function loadStagingRows(grid, portalState, campaignId) {
  grid.innerHTML = `<p>Loading...</p>`;

  let rows = [];

  try {
    const res = await fetch(
      `https://emails-module.dennis-e64.workers.dev/staging/list?project=${encodeURIComponent(
        portalState.staffSelectedProjectId
      )}&campaign_id=${encodeURIComponent(campaignId)}`,
      { cache: "no-cache" }
    );

    const text = await res.text();
    rows = text ? JSON.parse(text) : [];
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p class="error">Error loading staging rows.</p>`;
    return;
  }

  if (!rows || rows.length === 0) {
    grid.innerHTML = `<p>No staging rows found.</p>`;
    return;
  }

  /* ---------------------------------------------------------
     SORTING STATE
  --------------------------------------------------------- */
  let sortField = "event_timestamp_eastern";
  let sortDirection = "desc";

  const columns = [
    { key: "full_name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "status", label: "Status" },
    { key: "event_timestamp_eastern", label: "Timestamp (ET)", isDate: true },
    { key: "match_status", label: "Match Status" },
    { key: "error_message", label: "Error" }
  ];

  function sortRows() {
    rows.sort((a, b) => {
      let A = a[sortField];
      let B = b[sortField];

      const col = columns.find(c => c.key === sortField);

      if (col?.isDate) {
        A = A ? new Date(A) : 0;
        B = B ? new Date(B) : 0;
      } else {
        A = (A || "").toString().toLowerCase();
        B = (B || "").toString().toLowerCase();
      }

      if (A < B) return sortDirection === "asc" ? -1 : 1;
      if (A > B) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  /* ---------------------------------------------------------
     RENDER TABLE
  --------------------------------------------------------- */
  function renderTable() {
    sortRows();

    const headerHtml = columns
      .map(col => {
        const isSorted = sortField === col.key;
        const upArrow = isSorted && sortDirection === "asc" ? "▲" : "△";
        const downArrow = isSorted && sortDirection === "desc" ? "▼" : "▽";

        return `
          <th class="sortable" data-field="${col.key}">
            ${col.label}
            <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
              <span class="sort-up">${upArrow}</span>
              <span class="sort-down">${downArrow}</span>
            </span>
          </th>
        `;
      })
      .join("");

    const rowsHtml = rows
      .map(r => `
        <tr class="${r.match_status === 'unmatched' ? 'row-error' : ''}">
          <td>${escapeHtml(r.full_name || "")}</td>
          <td>${escapeHtml(r.email || "")}</td>
          <td>${escapeHtml(r.status || "")}</td>
          <td>${escapeHtml(r.event_timestamp_eastern || "")}</td>
          <td>${escapeHtml(r.match_status || "")}</td>
          <td>${escapeHtml(r.error_message || "")}</td>
        </tr>
      `)
      .join("");

    grid.innerHTML = `
      <table class="notes-table">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;

    // Sorting events
    grid.querySelectorAll("th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.dataset.field;

        sortDirection =
          sortField === field
            ? sortDirection === "asc"
              ? "desc"
              : "asc"
            : "asc";

        sortField = field;
        renderTable();
      });
    });
  }

  renderTable();
}
