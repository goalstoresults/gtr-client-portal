// inspections/tab-add-staging.js
// Matches your existing backend routes EXACTLY.
// Exports the two functions tab-add.js imports.

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
   EXPORT 1: OPEN BULK UPLOAD POPUP
   Calls: POST /staging/bulk-upload?project=...
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

    // Validate header BEFORE sending to backend
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
      `/staging/bulk-upload?project=${encodeURIComponent(portalState.project)}`,
      {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text
      }
    );

    const data = await res.json();

    if (!res.ok) {
      statusDiv.innerHTML = `<p style="color:red;">${data.error || "Upload failed"}</p>`;
      return;
    }

    statusDiv.innerHTML = `<p style="color:green;">Imported ${data.inserted} rows.</p>`;

    setTimeout(() => {
      modal.remove();
      renderInspectionStaging(container, portalState);
    }, 800);
  };
}

/* ============================================================
   EXPORT 2: RENDER STAGING TABLE
   Calls:
     GET    /staging/list?project=...
     POST   /staging/auto-match-all?project=...
     PATCH  /staging/update-inline
     DELETE /staging/delete-inline
     POST   /inspections/add-from-staging?id=...&project=...
============================================================ */
export async function renderInspectionStaging(container, portalState) {
  const res = await fetch(
    `/staging/list?project=${encodeURIComponent(portalState.project)}`
  );

  let rows = await res.json();
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

  // Auto-match all
  container.querySelector("#inspAutoMatchAll").onclick = async () => {
    const btn = container.querySelector("#inspAutoMatchAll");
    btn.disabled = true;
    btn.textContent = "Matching…";

    const res = await fetch(
      `/staging/auto-match-all?project=${encodeURIComponent(portalState.project)}`,
      { method: "POST" }
    );

    const data = await res.json();

    btn.disabled = false;
    btn.textContent = "Auto-Match All";

    alert(`Auto-match complete.\nMatched: ${data.matched || 0}`);

    renderInspectionStaging(container, portalState);
  };
}

/* ============================================================
   TABLE RENDERER
============================================================ */
function renderTable(rows) {
  if (!rows.length) return `<p>(no staging rows)</p>`;

  const cols = Object.keys(rows[0]);

  return `
    <table class="staging-table">
      <thead>
        <tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            row => `
          <tr>
            ${cols.map(c => `<td>${row[c] ?? ""}</td>`).join("")}
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

