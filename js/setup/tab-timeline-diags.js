// /js/setup/tab-timeline-diags.js
// Timeline Diagnostics — tied directly to timeline-module Worker

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

  if (!portalState.timelineDiagSort) {
    portalState.timelineDiagSort = {
      column: "event_timestamp",
      direction: "desc"
    };
  }

  setupContent.innerHTML = `
    <section class="card">
      <h2>Timeline Diagnostics</h2>

      <div style="margin-bottom: 15px; display:flex; gap:10px; align-items:center;">
        <button id="td-refresh" class="btn btn-primary">Refresh</button>
        <button id="td-export" class="btn btn-secondary">Export Selected</button>
        <button id="td-clear-all" class="btn btn-secondary">Clear All</button>

        <span id="td-selected-count" style="font-weight:bold; margin-left:10px;">
          Total: 0 Selected: 0
        </span>

        <div style="margin-left:auto; display:flex; gap:8px; align-items:center;">
          <label style="font-weight:bold;">Filter:</label>
          <select id="td-filter" class="form-select" style="width:260px;">
            <option value="contact_created">Contact Created</option>
            <option value="contact_updated">Contact Updated</option>
            <option value="relationship_added">Relationships</option>
            <option value="note_added">Notes</option>
            <option value="payment_added">Payments</option>
            <option value="email_logged">Emails</option>
            <option value="ghl_contact_synced">GHL Contact Sync</option>
            <option value="ghl_note_added">GHL Notes</option>
            <option value="errors">Errors Only</option>
          </select>
        </div>
      </div>

      <table class="notes-table" style="width:100%;">
        <thead>
          <tr>
            <th style="width:40px; text-align:center;">
              <input type="checkbox" id="td-select-all">
            </th>

            <th class="td-sortable" data-field="event_timestamp">
              Timestamp
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">△</span>
                <span class="sort-down">▽</span>
              </span>
            </th>

            <th class="td-sortable" data-field="event_type">
              Event Type
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">△</span>
                <span class="sort-down">▽</span>
              </span>
            </th>

            <th class="td-sortable" data-field="contact_id">
              Contact ID
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">△</span>
                <span class="sort-down">▽</span>
              </span>
            </th>

            <th class="td-sortable" data-field="summary">
              Summary
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">△</span>
                <span class="sort-down">▽</span>
              </span>
            </th>

            <th style="width:180px; text-align:center;">Actions</th>
          </tr>
        </thead>

        <tbody id="td-body">
          <tr><td colspan="6">Loading...</td></tr>
        </tbody>
      </table>
    </section>
  `;

  document.getElementById("td-refresh").onclick = () =>
    loadTimeline(project, portalState);

  document.getElementById("td-select-all").onclick = toggleSelectAllTD;
  document.getElementById("td-clear-all").onclick = clearAllTD;
  document.getElementById("td-export").onclick = exportSelectedTD;

  document.getElementById("td-filter").onchange = () =>
    loadTimeline(project, portalState);

  loadTimeline(project, portalState);
}

/* ============================================================
   LOAD TIMELINE EVENTS (pull all, filter client-side)
============================================================ */

async function loadTimeline(project, portalState) {
  const tbody = document.getElementById("td-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6">Loading...</td></tr>`;

  try {
    const res = await fetch(
      `${TD_BASE_URL}/timeline/project?project_id=${encodeURIComponent(project)}`
    );

    const data = await res.json();
    TD_CACHE = Array.isArray(data) ? data : [];

    renderRowsTD(portalState);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">Error loading timeline events.</td></tr>`;
  }
}

/* ============================================================
   RENDER ROWS
============================================================ */

function renderRowsTD(portalState) {
  const tbody = document.getElementById("td-body");
  if (!tbody) return;

  const filterEl = document.getElementById("td-filter");
  const filter = filterEl ? filterEl.value : "contact_created";

  let rows = [...TD_CACHE];

  if (filter === "errors") {
    rows = rows.filter(e =>
      !e.contact_id ||
      !e.event_type ||
      !e.event_timestamp ||
      !e.project ||
      e.summary == null
    );
  } else {
    rows = rows.filter(e => e.event_type === filter);
  }

  rows = sortRowsTD(rows, portalState);

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">No matching events.</td></tr>`;
    updateSelectedCountTD();
    return;
  }

  tbody.innerHTML = rows
    .map((e) => {
      const ts = e.event_timestamp || "";
      const summary = e.summary || `<span style="color:red;font-weight:bold;">None</span>`;

      return `
        <tr data-id="${e.id}">
          <td style="text-align:center;">
            <input type="checkbox" class="td-row">
          </td>

          <td>${ts}</td>
          <td>${e.event_type || ""}</td>
          <td>${e.contact_id || ""}</td>
          <td>${summary}</td>

          <td style="text-align:center;">
            <button class="btn btn-secondary" onclick="tdPreview('${e.id}')">Preview</button>
          </td>
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
   PREVIEW
============================================================ */

window.tdPreview = function (eventId) {
  const event = TD_CACHE.find(e => e.id === eventId);
  if (!event) {
    alert("Event not found.");
    return;
  }
  alert(JSON.stringify(event, null, 2));
};

/* ============================================================
   SELECTION + EXPORT
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
  if (el) {
    el.innerText = `Total: ${total} Selected: ${selected}`;
  }
}

function exportSelectedTD() {
  const selected = [...document.querySelectorAll(".td-row:checked")].map((cb) => {
    const tr = cb.closest("tr");
    const id = tr.dataset.id;
    const event = TD_CACHE.find((e) => e.id === id);

    return {
      id: event.id,
      contact_id: event.contact_id,
      event_type: event.event_type,
      event_timestamp: event.event_timestamp,
      summary: event.summary || "",
      project: event.project
    };
  });

  if (selected.length === 0) {
    alert("No rows selected.");
    return;
  }

  const headers = [
    "id",
    "contact_id",
    "event_type",
    "event_timestamp",
    "summary",
    "project"
  ];

  let csv = headers.join(",") + "\n";

  selected.forEach((row) => {
    csv +=
      headers
        .map((h) => (row[h] || "").toString().replace(/,/g, ""))
        .join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "timeline_events_diagnostics.csv";
  a.click();

  URL.revokeObjectURL(url);
}
