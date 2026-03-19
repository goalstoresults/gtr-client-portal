// /js/setup/tab-timeline-diags.js
// Timeline Diagnostics (Round 1) — NEW UI + NEW BACKEND

const TD_BASE_URL_GETS = "https://timeline-module-gets.dennis-e64.workers.dev";
const TD_BASE_URL = "https://timeline-module.dennis-e64.workers.dev";

let TD_CACHE = [];

export async function renderTimelineDiagnostics(setupContent, portalState) {
  const project = portalState.setup_project_id;

  if (!project) {
    setupContent.innerHTML = `
      <section class="card">
        <p>Please select a project in the Client tab before using Timeline Diagnostics.</p>
      </section>
    `;
    return;
  }

  // Sorting state
  if (!portalState.timelineDiagSort) {
    portalState.timelineDiagSort = {
      column: "timestamp",
      direction: "desc"
    };
  }

  setupContent.innerHTML = `
    <section class="card">
      <h2>Timeline Diagnostics</h2>

      <!-- TOP CONTROLS -->
      <div style="margin-bottom: 15px; display:flex; gap:10px; align-items:center;">
        
        <!-- MODE DROPDOWN -->
        <label style="font-weight:bold;">Mode:</label>
        <select id="td-mode" class="form-select" style="width:260px;">
          <option value="">Select...</option>
          <option value="contact-created">Contact Created</option>
          <option value="contact-updated">Contact Updated</option>
          <option value="relationships-created">Relationships</option>
          <option value="relationships-updated">Relationship Updated</option>
          <option value="notes-created">Notes Created</option>
          <option value="notes-updated">Notes Updated</option>
          <option value="payments-created">Payments</option>
          <option value="payments-updated">Payment Updated</option>
        </select>

        <!-- RETRIEVE BUTTON -->
        <button id="td-retrieve" class="btn btn-primary">Retrieve</button>

        <span id="td-selected-count" style="font-weight:bold; margin-left:auto;">
          Total: 0 Selected: 0
        </span>
      </div>

      <!-- GRID -->
      <table class="notes-table" style="width:100%;">
        <thead>
          <tr>
            <th style="width:40px; text-align:center;">
              <input type="checkbox" id="td-select-all">
            </th>

            <th class="td-sortable" data-field="id">
              ID
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">△</span>
                <span class="sort-down">▽</span>
              </span>
            </th>

            <th class="td-sortable" data-field="contact_name">
              Contact Name
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">△</span>
                <span class="sort-down">▽</span>
              </span>
            </th>

            <th class="td-sortable" data-field="timestamp">
              Timestamp
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">△</span>
                <span class="sort-down">▽</span>
              </span>
            </th>
          </tr>
        </thead>

        <tbody id="td-body">
          <tr><td colspan="4">Awaiting selection...</td></tr>
        </tbody>
      </table>

      <!-- BOTTOM BUTTONS -->
      <div style="margin-top:15px; display:flex; gap:10px;">
        <button id="td-clear-all" class="btn btn-secondary">Clear All</button>
        <button id="td-create-timeline" class="btn btn-primary" disabled>Create Timeline</button>
      </div>

    </section>
  `;

  // Wire up events
  document.getElementById("td-retrieve").onclick = () =>
    retrieveDiagnostics(project, portalState);

  document.getElementById("td-select-all").onclick = toggleSelectAllTD;
  document.getElementById("td-clear-all").onclick = clearAllTD;

  // Create Timeline button
  document.getElementById("td-create-timeline").onclick = () =>
    createTimelineEvents(project);
}

/* ============================================================
   RETRIEVE DATA FROM BACKEND
============================================================ */
async function retrieveDiagnostics(project, portalState) {
  const mode = document.getElementById("td-mode").value;
  const tbody = document.getElementById("td-body");

  if (!mode) {
    tbody.innerHTML = `<tr><td colspan="4">Please select a mode.</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="4">Loading...</td></tr>`;

  const endpoint = {
  "contact-created": "/diag/contact-created",
  "contact-updated": "/diag/contact-updated",

  "relationships": "/diag/relationships-created",
  "relationships-updated": "/diag/relationships-updated",

  "notes-created": "/diag/notes-created",
  "notes-updated": "/diag/notes-updated",

  "payments": "/diag/payments-created",
  "payments-updated": "/diag/payments-updated"
}[mode];

  try {
    const res = await fetch(
      `${TD_BASE_URL_GETS}${endpoint}?project=${encodeURIComponent(project)}`
    );

    const data = await res.json();
    TD_CACHE = Array.isArray(data) ? data : [];

    renderRowsTD(portalState);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4">Error loading diagnostics.</td></tr>`;
  }
}

/* ============================================================
   RENDER GRID
============================================================ */
function renderRowsTD(portalState) {
  const tbody = document.getElementById("td-body");
  if (!tbody) return;

  let rows = [...TD_CACHE];
  rows = sortRowsTD(rows, portalState);

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">No matching records.</td></tr>`;
    updateSelectedCountTD();
    return;
  }

  tbody.innerHTML = rows
    .map((e) => {
      return `
        <tr data-id="${e.id}">
          <td style="text-align:center;">
            <input type="checkbox" class="td-row">
          </td>
          <td>${e.id || ""}</td>
          <td>${e.contact_name || ""}</td>
          <td>${e.timestamp || ""}</td>
        </tr>
      `;
    })
    .join("");

  document.querySelectorAll(".td-row").forEach((cb) => {
    cb.addEventListener("change", updateSelectedCountTD);
  });

  document.querySelectorAll(".td-sortable").forEach((th) => {
    th.onclick = () => handleSortClickTD(th, portalState);
  });

  updateSortArrowsTD(portalState);
  updateSelectedCountTD();
}

/* ============================================================
   SORTING
============================================================ */
function sortRowsTD(rows, portalState) {
  const { column, direction } = portalState.timelineDiagSort;

  return rows.sort((a, b) => {
    let A = (a[column] || "").toString().toLowerCase();
    let B = (b[column] || "").toString().toLowerCase();

    if (A < B) return direction === "asc" ? -1 : 1;
    if (A > B) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

function handleSortClickTD(th, portalState) {
  const field = th.dataset.field;

  if (portalState.timelineDiagSort.column === field) {
    portalState.timelineDiagSort.direction =
      portalState.timelineDiagSort.direction === "asc" ? "desc" : "asc";
  } else {
    portalState.timelineDiagSort.column = field;
    portalState.timelineDiagSort.direction = "asc";
  }

  renderRowsTD(portalState);
}

function updateSortArrowsTD(portalState) {
  const { column, direction } = portalState.timelineDiagSort;

  document.querySelectorAll(".td-sortable").forEach((th) => {
    const field = th.dataset.field;
    const up = th.querySelector(".sort-up");
    const down = th.querySelector(".sort-down");

    if (field === column) {
      up.textContent = direction === "asc" ? "▲" : "△";
      down.textContent = direction === "desc" ? "▼" : "▽";
    } else {
      up.textContent = "△";
      down.textContent = "▽";
    }
  });
}

/* ============================================================
   SELECTION
============================================================ */
function toggleSelectAllTD() {
  const checked = document.getElementById("td-select-all").checked;
  document.querySelectorAll(".td-row").forEach((cb) => (cb.checked = checked));
  updateSelectedCountTD();
}

function clearAllTD() {
  document.querySelectorAll(".td-row").forEach((cb) => (cb.checked = false));
  const selectAll = document.getElementById("td-select-all");
  if (selectAll) selectAll.checked = false;
  updateSelectedCountTD();
}

function updateSelectedCountTD() {
  const selected = document.querySelectorAll(".td-row:checked").length;
  const total = TD_CACHE.length;

  const el = document.getElementById("td-selected-count");
  if (el) el.innerText = `Total: ${total} Selected: ${selected}`;

  const btn = document.getElementById("td-create-timeline");
  if (btn) btn.disabled = selected === 0;
}

/* ============================================================
   CREATE TIMELINE EVENTS (Full Tree Logic)
============================================================ */
async function createTimelineEvents(project) {
  const mode = document.getElementById("td-mode").value;

  if (!mode) {
    alert("Please select a mode first.");
    return;
  }

  const checkboxes = Array.from(document.querySelectorAll(".td-row:checked"));

  if (checkboxes.length === 0) {
    alert("Please select at least one row.");
    return;
  }

  const ids = checkboxes
    .map((cb) => cb.closest("tr")?.getAttribute("data-id"))
    .filter(Boolean);

  if (ids.length === 0) {
    alert("No valid IDs found.");
    return;
  }

  const btn = document.getElementById("td-create-timeline");
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Creating...";
  }

  try {
    const results = [];

    for (const id of ids) {
      let endpoint = null;
      let payload = { project };

 /* ============================
   MODE ROUTING (FULL TREE)
============================ */

if (mode === "contact-created") {
  endpoint = "/timeline/contact-created";
  payload.contact_id = id;
}

else if (mode === "contact-updated") {
  endpoint = "/timeline/contact-updated";
  payload.contact_id = id;
}

else if (mode === "relationships") {
  endpoint = "/timeline/relationship-created";
  payload.relationship_id = id;
}

else if (mode === "relationships-updated") {
  endpoint = "/timeline/relationship-updated";
  payload.relationship_id = id;
}

else if (mode === "notes-created") {
  endpoint = "/timeline/note-created";
  payload.note_id = id;
}

else if (mode === "notes-updated") {
  endpoint = "/timeline/note-updated";
  payload.note_id = id;
}

else if (mode === "payments") {
  endpoint = "/timeline/payment-created";
  payload.revenue_id = id;
}

else if (mode === "payments-updated") {
  endpoint = "/timeline/payment-updated";
  payload.revenue_id = id;
}

else {
  alert("Unknown mode selected.");
  return;
}

      /* ============================
         EXECUTE POST
      ============================ */

      const res = await fetch(`${TD_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      results.push({ id, status: res.status, data });
    }

    console.log("Timeline create results:", results);
    alert(`Created timeline events for ${results.length} record(s).`);

  } catch (err) {
    console.error("Error creating timeline events:", err);
    alert("Error creating timeline events. Check console for details.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Create Timeline";
    }
  }
}
