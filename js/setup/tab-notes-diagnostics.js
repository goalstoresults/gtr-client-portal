// /js/setup/tab-notes-diagnostics.js

const ND_BASE_URL = "https://relationship-processor.dennis-e64.workers.dev";

let ND_CACHE = [];

export async function renderNotesDiagnostics(setupContent, portalState) {
  const project = portalState.setup_project_id;

  if (!project) {
    setupContent.innerHTML = `
      <section class="card">
        <p>Please select a project in the Client tab before using Notes Diagnostics.</p>
      </section>
    `;
    return;
  }

  if (!portalState.notesDiagSort) {
    portalState.notesDiagSort = {
      column: "created_at",
      direction: "desc"
    };
  }

  setupContent.innerHTML = `
    <section class="card">
      <h2>Notes Diagnostics</h2>

      <div style="margin-bottom: 15px; display:flex; gap:10px; align-items:center;">
        <button id="nd-refresh" class="btn btn-primary">Refresh</button>
        <button id="nd-fix-to" class="btn btn-secondary">Fix From/To</button>
        <button id="nd-fix-rel" class="btn btn-success">Fix Relationship</button>
        <button id="nd-preview" class="btn btn-secondary">Preview Selected</button>
        <button id="nd-clear-all" class="btn btn-secondary">Clear All</button>

        <span id="nd-selected-count" style="font-weight:bold; margin-left:10px;">
          Total: 0 Selected: 0
        </span>
      </div>

      <table class="notes-table" style="width:100%;">
        <thead>
          <tr>
            <th style="width:40px; text-align:center;">
              <input type="checkbox" id="nd-select-all">
            </th>

            <th class="nd-sortable" data-field="id">
              Note ID
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">△</span>
                <span class="sort-down">▽</span>
              </span>
            </th>

            <th class="nd-sortable" data-field="contact_email">
              TO (contact_email)
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">△</span>
                <span class="sort-down">▽</span>
              </span>
            </th>

            <th class="nd-sortable" data-field="from_email">
              FROM (from_email)
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">△</span>
                <span class="sort-down">▽</span>
              </span>
            </th>

            <th class="nd-sortable" data-field="subject">
              Subject
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">△</span>
                <span class="sort-down">▽</span>
              </span>
            </th>

            <th class="nd-sortable" data-field="created_at">
              Created
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">△</span>
                <span class="sort-down">▽</span>
              </span>
            </th>

            <th class="nd-sortable" data-field="reason">
              Reason
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">△</span>
                <span class="sort-down">▽</span>
              </span>
            </th>
          </tr>
        </thead>

        <tbody id="nd-body">
          <tr><td colspan="7">Loading...</td></tr>
        </tbody>
      </table>
    </section>
  `;

  document.getElementById("nd-refresh").onclick = () =>
    loadNotes(project, portalState);

  document.getElementById("nd-select-all").onclick = toggleSelectAll;

  document.getElementById("nd-clear-all").onclick = clearAll;

  document.getElementById("nd-fix-to").onclick = () =>
    bulkFixTo(project);

  document.getElementById("nd-fix-rel").onclick = () =>
    bulkFixRelationship(project);

  document.getElementById("nd-preview").onclick = () =>
    previewSelected(project);

  loadNotes(project, portalState);
}

/* ============================================================
   Load Notes
============================================================ */

async function loadNotes(project, portalState) {
  const tbody = document.getElementById("nd-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7">Loading...</td></tr>`;

  try {
    const url = `${ND_BASE_URL}/notes_diag/list?project=${project}`;
    const res = await fetch(url);
    const data = await res.json();

    ND_CACHE = Array.isArray(data.notes) ? data.notes : [];

    renderRows(portalState);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7">Error loading notes.</td></tr>`;
  }
}

/* ============================================================
   Render Rows
============================================================ */

function renderRows(portalState) {
  const tbody = document.getElementById("nd-body");
  if (!tbody) return;

  let rows = sortRows([...ND_CACHE], portalState);

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">No notes needing review.</td></tr>`;
    updateSelectedCount();
    return;
  }

  tbody.innerHTML = rows
    .map((n) => {
      return `
        <tr data-id="${n.id}">
          <td style="text-align:center;">
            <input type="checkbox" class="nd-row">
          </td>
          <td>${n.id}</td>
          <td>${n.contact_email || ""}</td>
          <td>${n.from_email || ""}</td>
          <td>${n.subject || ""}</td>
          <td>${n.created_at || ""}</td>
          <td>${n.reason || ""}</td>
        </tr>
      `;
    })
    .join("");

  document.querySelectorAll(".nd-row").forEach((cb) => {
    cb.addEventListener("change", updateSelectedCount);
  });

  document.querySelectorAll(".nd-sortable").forEach((th) => {
    th.onclick = () => handleSortClick(th, portalState);
  });

  updateSortArrows(portalState);
  updateSelectedCount();
}

/* ============================================================
   Sorting
============================================================ */

function sortRows(rows, portalState) {
  const { column, direction } = portalState.notesDiagSort;

  return rows.sort((a, b) => {
    let A = (a[column] || "").toString().toLowerCase();
    let B = (b[column] || "").toString().toLowerCase();

    if (A < B) return direction === "asc" ? -1 : 1;
    if (A > B) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

function handleSortClick(th, portalState) {
  const field = th.dataset.field;

  if (portalState.notesDiagSort.column === field) {
    portalState.notesDiagSort.direction =
      portalState.notesDiagSort.direction === "asc" ? "desc" : "asc";
  } else {
    portalState.notesDiagSort.column = field;
    portalState.notesDiagSort.direction = "asc";
  }

  renderRows(portalState);
}

function updateSortArrows(portalState) {
  const { column, direction } = portalState.notesDiagSort;

  document.querySelectorAll(".nd-sortable").forEach((th) => {
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
   Selection
============================================================ */

function toggleSelectAll() {
  const checked = document.getElementById("nd-select-all").checked;
  document.querySelectorAll(".nd-row").forEach((cb) => (cb.checked = checked));
  updateSelectedCount();
}

function clearAll() {
  document.querySelectorAll(".nd-row").forEach((cb) => (cb.checked = false));
  const selectAll = document.getElementById("nd-select-all");
  if (selectAll) selectAll.checked = false;
  updateSelectedCount();
}

function updateSelectedCount() {
  const selected = document.querySelectorAll(".nd-row:checked").length;
  const total = ND_CACHE.length;

  document.getElementById("nd-selected-count").innerText =
    `Total: ${total} Selected: ${selected}`;
}

function getSelectedIds() {
  return [...document.querySelectorAll(".nd-row:checked")].map((cb) =>
    cb.closest("tr").dataset.id
  );
}

/* ============================================================
   Preview Selected
============================================================ */

async function previewSelected(project) {
  const ids = getSelectedIds();

  if (ids.length !== 1) {
    alert("Select exactly one note to preview.");
    return;
  }

  const noteId = ids[0];

  const url = `${ND_BASE_URL}/notes_diag/preview`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, note_id: noteId })
  });

  const data = await res.json();

  alert(JSON.stringify(data.payload, null, 2));
}

/* ============================================================
   Bulk Fix From/To (Button 1)
============================================================ */

async function bulkFixTo(project) {
  const ids = getSelectedIds();

  if (ids.length === 0) {
    alert("No notes selected.");
    return;
  }

  const url = `${ND_BASE_URL}/extract-from-to`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, note_ids: ids })
  });

  const data = await res.json();

  alert("Fix From/To complete:\n" + JSON.stringify(data, null, 2));

  const portalState = window.portalState || {};
  const effectiveProject = portalState.setup_project_id || project;

  loadNotes(effectiveProject, portalState);
}

/* ============================================================
   Bulk Fix Relationship (Button 2)
============================================================ */

async function bulkFixRelationship(project) {
  const ids = getSelectedIds();

  if (ids.length === 0) {
    alert("No notes selected.");
    return;
  }

  let results = [];

  for (const id of ids) {
    const url = `${ND_BASE_URL}/route-one`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project, note_id: id })
    });

    const data = await res.json();
    results.push({ id, result: data });
  }

  alert("Relationship routing complete:\n" + JSON.stringify(results, null, 2));

  const portalState = window.portalState || {};
  const effectiveProject = portalState.setup_project_id || project;

  loadNotes(effectiveProject, portalState);
}
