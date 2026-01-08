// /emails/tab-email-data.js
// Handles CSV upload, staging preview, and commit (Worker-based)

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
      <div id="emailData-stagingGrid"></div>

      <div style="margin-top:16px;">
        <button id="emailData-commitBtn" class="btn-primary">Commit to Final Table</button>
      </div>
    </section>
  `;

  const status = document.getElementById("emailData-status");
  const stagingGrid = document.getElementById("emailData-stagingGrid");

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

    } catch (err) {
      console.error(err);
      status.innerHTML = `<p class="error">Error uploading CSV.</p>`;
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

    } catch (err) {
      console.error(err);
      status.innerHTML = `<p class="error">Error committing staging data.</p>`;
    }
  });

  // Load initial staging rows
  await loadStagingRows(stagingGrid, portalState, campaignId);
}

/* =========================================================
   LOAD STAGING ROWS (Worker-based)
========================================================= */

async function loadStagingRows(grid, portalState, campaignId) {
  grid.innerHTML = `<p>Loading...</p>`;

  try {
    const res = await fetch(
      `https://emails-module.dennis-e64.workers.dev/staging/list?project=${encodeURIComponent(
        portalState.staffSelectedProjectId
      )}&campaign_id=${encodeURIComponent(campaignId)}`,
      { cache: "no-cache" }
    );

    const text = await res.text();
    const rows = text ? JSON.parse(text) : [];

    if (!rows || rows.length === 0) {
      grid.innerHTML = `<p>No staging rows found.</p>`;
      return;
    }

    const htmlRows = rows
      .map(row => `
        <tr>
          <td>${escapeHtml(row.full_name || "")}</td>
          <td>${escapeHtml(row.email || "")}</td>
          <td>${escapeHtml(row.status || "")}</td>
          <td>${escapeHtml(row.event_timestamp_eastern || "")}</td>
          <td>${escapeHtml(row.match_status || "")}</td>
          <td>${escapeHtml(row.error_message || "")}</td>
        </tr>
      `)
      .join("");

    grid.innerHTML = `
      <table class="simple-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Status</th>
            <th>Timestamp (ET)</th>
            <th>Match Status</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>${htmlRows}</tbody>
      </table>
    `;

  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p class="error">Error loading staging rows.</p>`;
  }
}
