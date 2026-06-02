// inspections/tab-add-staging.js
// Staging UI wired to inspections-module Worker

const INSPECTIONS_API_BASE = "https://inspections-module.dennis-e64.workers.dev";

const REQUIRED_COLUMNS = [
  "OID",
  "Date",
  "Inspectors",
  "Inspection Address",
  "Inspection City",
  "Inspection State",
  "Inspection Zip",
  "Buyer's Agent First Name",
  "Buyer's Agent Last Name",
  "Buyer's Agent Address",
  "Buyer's Agent City",
  "Buyer's Agent State",
  "Buyer's Agent Zip",
  "Buyer's Agent Email",
  "Buyer's Agent Cell",
  "Client First Name",
  "Client Last Name",
  "Client's Address",
  "Client's City",
  "Client's State",
  "Client's Zip",
  "Client's Email",
  "Client's Mobile",
  "Total Fee",
  "Type of Inspection"
];

/* ============================================================
   Bulk Upload popup → POST /staging/bulk-upload?project=...
============================================================ */
export function openInspectionBulkUpload(container, portalState) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal">
      <h2>Bulk Upload</h2>
      <p>
        Select a CSV file to upload.<br>
        First row must contain column names.<br><br>
        <strong>Names must be exactly:</strong><br>
        <code>${REQUIRED_COLUMNS.join(", ")}</code>
      </p>

      <input type="file" id="inspBulkFile" accept=".csv" />

      <div style="margin-top:16px; display:flex; gap:8px; justify-content:flex-end;">
        <button id="inspBulkCancel">Cancel</button>
        <button id="inspBulkUpload" class="primary">Upload</button>
      </div>

      <div id="inspBulkStatus" style="margin-top:12px;"></div>
    </div>
  `;

  document.body.appendChild(modal);

  const fileInput = modal.querySelector("#inspBulkFile");
  const cancelBtn = modal.querySelector("#inspBulkCancel");
  const uploadBtn = modal.querySelector("#inspBulkUpload");
  const statusDiv = modal.querySelector("#inspBulkStatus");

  cancelBtn.onclick = () => modal.remove();

  uploadBtn.onclick = async () => {
    if (!fileInput.files.length) {
      statusDiv.innerHTML = `<p style="color:red;">Please select a CSV file.</p>`;
      return;
    }

    const file = fileInput.files[0];
    const text = await file.text();

    // Quick header sanity check before hitting Worker
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
    if (!lines.length) {
      statusDiv.innerHTML = `<p style="color:red;">CSV is empty.</p>`;
      return;
    }

    const header = lines[0].split(",").map(h => h.trim());
    const missing = REQUIRED_COLUMNS.filter(col => !header.includes(col));

    if (missing.length) {
      statusDiv.innerHTML = `
        <p style="color:red;">Missing required columns:</p>
        <pre>${missing.join("\n")}</pre>
      `;
      return;
    }

    statusDiv.innerHTML = `<p>Uploading…</p>`;

    const res = await fetch(
      `${INSPECTIONS_API_BASE}/staging/bulk-upload?project=${encodeURIComponent(
        portalState.project
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text
      }
    );

    let data = null;
    try {
      data = await res.json();
    } catch {
      statusDiv.innerHTML = `<p style="color:red;">Upload failed (invalid response).</p>`;
      return;
    }

    if (!res.ok) {
      statusDiv.innerHTML = `<p style="color:red;">${
        data.error || "Upload failed"
      }</p>`;
      return;
    }

    statusDiv.innerHTML = `<p style="color:green;">Imported ${
      data.inserted
    } rows.</p>`;

    setTimeout(() => {
      modal.remove();
      renderInspectionStaging(container, portalState);
    }, 800);
  };
}

/* ============================================================
   Staging table → GET /staging/list?project=...
============================================================ */
export async function renderInspectionStaging(container, portalState) {
  const res = await fetch(
    `${INSPECTIONS_API_BASE}/staging/list?project=${encodeURIComponent(
      portalState.project
    )}`
  );

  let rows;
  try {
    rows = await res.json();
  } catch {
    rows = [];
  }

  if (!Array.isArray(rows)) rows = [];

  container.innerHTML = `
    <section class="card">
      <h2>Inspection Staging</h2>
      <p>${rows.length} rows in staging.</p>

      <div style="margin-bottom:12px; display:flex; gap:8px;">
        <button id="inspAutoMatchAll" class="secondary">Auto-Match All</button>
      </div>

      <div class="staging-table-wrapper">
        ${renderTable(rows)}
      </div>
    </section>
  `;

  const autoMatchAllBtn = container.querySelector("#inspAutoMatchAll");
  autoMatchAllBtn.onclick = async () => {
    autoMatchAllBtn.disabled = true;
    autoMatchAllBtn.textContent = "Matching…";

    const res = await fetch(
      `${INSPECTIONS_API_BASE}/staging/auto-match-all?project=${encodeURIComponent(
        portalState.project
      )}`,
      { method: "POST" }
    );

    let data;
    try {
      data = await res.json();
    } catch {
      autoMatchAllBtn.disabled = false;
      autoMatchAllBtn.textContent = "Auto-Match All";
      alert("Error parsing auto-match response.");
      return;
    }

    autoMatchAllBtn.disabled = false;
    autoMatchAllBtn.textContent = "Auto-Match All";

    if (!res.ok) {
      alert(data.error || "Error running auto-match.");
      return;
    }

    alert(
      `Auto-match complete.\nMatched: ${data.matched || data.ready || 0}`
    );
    renderInspectionStaging(container, portalState);
  };
}

/* ============================================================
   Simple table renderer (read-only for now)
============================================================ */
function renderTable(rows) {
  if (!rows.length) return `<p>(no staging rows)</p>`;

  return `
    <table class="notes-table" style="width:100%; border-collapse:collapse;">
      <thead>
        <tr>
          <th>Date</th>
          <th>Client</th>
          <th>Agent</th>
          <th>Address</th>
          <th>City</th>
          <th>State</th>
          <th>Zip</th>
          <th>Type</th>
          <th>Fee</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((r, i) => {
            const bg = i % 2 === 0 ? "#ffffff" : "#f9f9f9";
            return `
              <tr style="background:${bg};">
                <td>${escapeHtml(r.inspection_date || "")}</td>
                <td>${escapeHtml(
                  `${r.client_first_name || ""} ${r.client_last_name || ""}`
                )}</td>
                <td>${escapeHtml(
                  `${r.buyer_agent_first_name || ""} ${r.buyer_agent_last_name || ""}`
                )}</td>
                <td>${escapeHtml(r.inspection_address || "")}</td>
                <td>${escapeHtml(r.inspection_city || "")}</td>
                <td>${escapeHtml(r.inspection_state || "")}</td>
                <td>${escapeHtml(r.inspection_zip || "")}</td>
                <td>${escapeHtml(r.inspection_type || "")}</td>
                <td>${escapeHtml(r.total_fee || "")}</td>
                <td>
                  <button class="btn-small" onclick="importStaging('${r.id}')">
                    Import
                  </button>
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}
