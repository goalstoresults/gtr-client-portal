/* ============================================================
   Timeline Diagnostics — Full Frontend Module
   Mirrors Contact Diagnostics structure and behavior
============================================================ */

const TD_BASE_URL = "https://timeline-diagnostics.dennis-e64.workers.dev";

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
        <button id="td-bulk-sync" class="btn btn-success">Bulk Sync</button>
        <button id="td-export" class="btn btn-secondary">Export Selected</button>
        <button id="td-clear-all" class="btn btn-secondary">Clear All</button>

        <span id="td-selected-count" style="font-weight:bold; margin-left:10px;">
          Total: 0 Selected: 0
        </span>

        <div style="margin-left:auto; display:flex; gap:8px; align-items:center;">
          <label style="font-weight:bold;">Filter:</label>
          <select id="td-filter" class="form-select" style="width:220px;">
            <option value="missing_summary">Missing Summary</option>
            <option value="missing_metadata">Missing Metadata</option>
            <option value="all">All Events</option>
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
  document.getElementById("td-bulk-sync").onclick = () => bulkSyncTD(project);

  document.getElementById("td-filter").onchange = () =>
    loadTimeline(project, portalState);

  loadTimeline(project, portalState);
}

/* ============================================================
   LOAD TIMELINE EVENTS
============================================================ */

async function loadTimeline(project, portalState) {
  const tbody = document.getElementById("td-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6">Loading...</td></tr>`;

  try {
    const filterSelect = document.getElementById("td-filter");
    const filter = filterSelect ? filterSelect.value || "missing_summary" : "missing_summary";

    const res = await fetch(
      `${TD_BASE_URL}/timeline_diag/list?project=${project}&filter=${filter}`
    );

    const data = await res.json();
    TD_CACHE = Array.isArray(data.events) ? data.events : [];

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

  let rows = sortRowsTD([...TD_CACHE], portalState);

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
            <button class="btn btn-secondary" onclick="tdPreview('${e.id}', '${e.project}')">Preview</button>
            <button class="btn btn-success" onclick="tdSync('${e.id}', '${e.project}')">Sync</button>
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
   PREVIEW + SYNC
============================================================ */

window.tdPreview = async function (eventId, project) {
  const res = await fetch(`${TD_BASE_URL}/timeline_diag/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, event_id: eventId })
  });

  const data = await res.json();
  alert(JSON.stringify(data.payload, null, 2));
};

window.tdSync = async function (eventId, project) {
  const res = await fetch(`${TD_BASE_URL}/timeline_diag/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, event_id: eventId })
  });

  const data = await res.json();
  alert("Sync complete:\n" + JSON.stringify(data, null, 2));

  const portalState = window.portalState || {};
  const effectiveProject = portalState.setup_project_id || project;

  loadTimeline(effectiveProject, portalState);
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

  document.getElementById("td-selected-count").innerText =
    `Total: ${total} Selected: ${selected}`;
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
  a.download = "selected_timeline_events.csv";
  a.click();

  URL.revokeObjectURL(url);
}

/* ============================================================
   BULK SYNC
============================================================ */

async function bulkSyncTD(project) {
  const ids = [...document.querySelectorAll(".td-row:checked")].map((cb) =>
    cb.closest("tr").dataset.id
  );

  if (ids.length === 0) {
    alert("No events selected.");
    return;
  }

  const res = await fetch(`${TD_BASE_URL}/timeline_diag/bulk_sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, event_ids: ids })
  });

  const data = await res.json();
  alert("Bulk sync complete:\n" + JSON.stringify(data, null, 2));

  const portalState = window.portalState || {};
  const effectiveProject = portalState.setup_project_id || project;

  loadTimeline(effectiveProject, portalState);
}
