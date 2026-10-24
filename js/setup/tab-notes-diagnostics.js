// /js/setup/tab-notes-diagnostics.js

const ND_BASE_URL = "https://notes-relationship-module.dennis-e64.workers.dev";

let ND_CACHE = [];

// ADDED: summary tools state (no new login or password flow)
let ND_VIEW_VERSION = 0;
let ND_LOAD_VERSION = 0;
let ND_SUMMARY_BUSY = false;
let ND_SUMMARY_STOP = false;

export async function renderNotesDiagnostics(setupContent, portalState) {
  const project = portalState.setup_project_id;

  // ADDED: invalidate work for a previously displayed project/tab.
  ND_VIEW_VERSION += 1;
  ND_LOAD_VERSION += 1;
  ND_SUMMARY_STOP = true;

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

      <!-- ADDED: summary tools; existing buttons above are unchanged -->
      <div style="margin-bottom:15px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <label for="nd-summary-mode">Show:</label>
        <select id="nd-summary-mode">
          <option value="review">Needs review</option>
          <option value="missing">Missing summaries — all review statuses</option>
          <option value="all">All notes</option>
        </select>
        <button id="nd-generate-summary" class="btn btn-primary">Generate Missing Summaries</button>
        <button id="nd-stop-summary" class="btn btn-secondary" disabled>Stop After Current</button>
        <span id="nd-missing-count">Missing summaries: 0</span>
      </div>
      <div id="nd-summary-status" role="status" style="margin-bottom:12px; white-space:pre-wrap;"></div>
      <details id="nd-summary-results-panel" style="margin-bottom:15px;">
        <summary>Summary backfill results</summary>
        <pre id="nd-summary-results" style="white-space:pre-wrap; max-height:300px; overflow:auto;"></pre>
      </details>
      <!-- END ADDED summary tools -->

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

            <th class="nd-sortable" data-field="from_name">
                FROM Name
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

            <!-- ADDED: actual summary text -->
            <th class="nd-sortable" data-field="summary">
              Summary
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
          <tr><td colspan="9">Loading...</td></tr>
        </tbody>
      </table>
    </section>
  `;

document.getElementById("nd-refresh").onclick = () => {
    const ps = window.portalState || {};
    loadNotes(ps.setup_project_id, ps);
};

document.getElementById("nd-select-all").onclick = toggleSelectAll;

document.getElementById("nd-clear-all").onclick = () => {
    clearAll();
    const ps = window.portalState || {};
    loadNotes(ps.setup_project_id, ps);
};

document.getElementById("nd-fix-to").onclick = () => {
    const ps = window.portalState || {};
    bulkFixTo(ps.setup_project_id);
};

document.getElementById("nd-fix-rel").onclick = () => {
    const ps = window.portalState || {};
    bulkFixRelationship(ps.setup_project_id);
};

document.getElementById("nd-preview").onclick = () => {
    const ps = window.portalState || {};
    previewSelected(ps.setup_project_id);
};

// ADDED: handlers for summary tools only.
document.getElementById("nd-summary-mode").onchange = () => {
    loadNotes(project, portalState);
};

document.getElementById("nd-generate-summary").onclick = () => {
    generateSelectedSummaries(project, portalState);
};

document.getElementById("nd-stop-summary").onclick = () => {
    ND_SUMMARY_STOP = true;
    ndSetSummaryStatus("Stopping after the current note finishes…");
};

// Initial load
loadNotes(project, portalState);
}

/* ============================================================
   Load Notes
============================================================ */

async function loadNotes(project, portalState) {
  const tbody = document.getElementById("nd-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="9">Loading...</td></tr>`;

  try {
    // ADDED: use the corrected backend's paginated modes when tools exist.
    // The original list implementation remains below as a fallback.
    const modeControl = document.getElementById("nd-summary-mode");
    if (modeControl) {
      await loadSummaryDiagnosticPages(project, portalState, modeControl.value, tbody);
      return;
    }

    const url = `${ND_BASE_URL}/notes_diag/list?project=${project}`;
    const res = await fetch(url);
    const data = await res.json();

    ND_CACHE = Array.isArray(data.notes) ? data.notes : [];

    renderRows(portalState);
  } catch (err) {
    console.error("Error loading notes:", err);
    tbody.innerHTML = `<tr><td colspan="9">Error loading notes.</td></tr>`;
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
    tbody.innerHTML = `<tr><td colspan="9">No notes match this view.</td></tr>`;
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
          <td>${n.from_name || ""}</td>
          <td>${n.subject || ""}</td>
          <!-- ADDED: safely display actual summary text -->
          <td style="min-width:300px; max-width:550px; white-space:pre-wrap; overflow-wrap:anywhere;">${
            ndHasSummary(n.summary)
              ? ndEscapeHtml(n.summary)
              : '<span style="color:#b45309;">Missing summary</span>'
          }</td>
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
    if (A > B) return direction === "desc" ? -1 : 1;
    return 0;
  });
}

function handleSortClick(th, portalState) {
  // ADDED: do not rebuild selection while a summary batch is running.
  if (ND_SUMMARY_BUSY) return;

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

  // ADDED: count missing summaries in the currently loaded view.
  const missingCount = document.getElementById("nd-missing-count");
  if (missingCount) {
    missingCount.textContent = `Missing summaries: ${ND_CACHE.filter(n => !ndHasSummary(n.summary)).length}`;
  }
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
    console.warn("Select exactly one note to preview.");
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

  console.log("Preview Selected:", data.payload);
}

/* ============================================================
   Bulk Fix From/To (Button 1)
============================================================ */

async function bulkFixTo(project) {
  const ids = getSelectedIds();

  if (ids.length === 0) {
    console.warn("No notes selected.");
    return;
  }

  const url = `${ND_BASE_URL}/extract-from-to`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, note_ids: ids })
  });

  const data = await res.json();

  console.log("Fix From/To result:", data);

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
    console.warn("No notes selected.");
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

  console.log("Fix Relationship result:", results);

  const portalState = window.portalState || {};
  const effectiveProject = portalState.setup_project_id || project;

  loadNotes(effectiveProject, portalState);
}


/* ============================================================
   ADDED: Summary diagnostics and summary-only backfill
   Existing repair and preview functions above are unchanged.
============================================================ */

function ndHasSummary(value) {
  return typeof value === "string" && value.trim() !== "";
}

function ndEscapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function ndSetSummaryStatus(message) {
  const status = document.getElementById("nd-summary-status");
  if (status) status.textContent = message;
}

function ndSameView(project, viewVersion, tbody) {
  const currentProject = window.portalState?.setup_project_id;
  return (
    viewVersion === ND_VIEW_VERSION &&
    tbody === document.getElementById("nd-body") &&
    tbody.isConnected &&
    (!currentProject || currentProject === project)
  );
}

function ndSetSummaryControls(busy, allowStop = false) {
  [
    "nd-refresh", "nd-fix-to", "nd-fix-rel", "nd-preview",
    "nd-clear-all", "nd-summary-mode", "nd-generate-summary", "nd-select-all"
  ].forEach(id => {
    const control = document.getElementById(id);
    if (control) control.disabled = busy;
  });

  document.querySelectorAll(".nd-row").forEach(cb => {
    cb.disabled = busy;
  });

  const stop = document.getElementById("nd-stop-summary");
  if (stop) stop.disabled = !busy || !allowStop;
}

async function loadSummaryDiagnosticPages(project, portalState, mode, tbody) {
  if (!project) throw new Error("No project selected");

  const viewVersion = ND_VIEW_VERSION;
  const loadVersion = ++ND_LOAD_VERSION;
  const stillCurrent = () => (
    ndSameView(project, viewVersion, tbody) && loadVersion === ND_LOAD_VERSION
  );

  ndSetSummaryControls(true);
  let page = 0;
  let scanned = 0;
  let hasMore = true;
  const allNotes = [];

  try {
    while (hasMore && stillCurrent()) {
      ndSetSummaryStatus(`Loading notes for ${project}… Scanned: ${scanned}`);

      const params = new URLSearchParams({
        project,
        mode,
        page: String(page),
        page_size: "100"
      });
      const res = await fetch(`${ND_BASE_URL}/notes_diag/list?${params.toString()}`);
      const data = await res.json().catch(() => null);

      if (!stillCurrent()) return;
      if (!res.ok || data?.status !== "ok" || !Array.isArray(data.notes)) {
        throw new Error(data?.error || `Loading notes failed (${res.status})`);
      }

      allNotes.push(...data.notes);
      scanned += Number(data.scanned || 0);
      // A missing-summary page can be empty while more pages still exist.
      hasMore = data.has_more === true;
      page += 1;
    }

    if (!stillCurrent()) return;

    const seen = new Set();
    ND_CACHE = allNotes.filter(note => {
      if (seen.has(note.id)) return false;
      seen.add(note.id);
      return true;
    });

    portalState.notesDiagSort ||= { column: "created_at", direction: "desc" };
    renderRows(portalState);

    const selectAll = document.getElementById("nd-select-all");
    if (selectAll) selectAll.checked = false;

    ndSetSummaryStatus(`Loaded ${ND_CACHE.length} notes for ${project}.`);
  } catch (err) {
    if (stillCurrent()) {
      ND_CACHE = [];
      tbody.innerHTML = `<tr><td colspan="9">${ndEscapeHtml(err.message)}</td></tr>`;
      updateSelectedCount();
      ndSetSummaryStatus(`Loading failed: ${err.message}`);
    }
  } finally {
    if (stillCurrent()) ndSetSummaryControls(false);
  }
}

async function generateSelectedSummaries(project, portalState) {
  if (ND_SUMMARY_BUSY) {
    ndSetSummaryStatus("A summary batch is already running. Please wait for it to finish.");
    return;
  }

  const selectedIds = getSelectedIds();
  const notes = ND_CACHE.filter(note => (
    selectedIds.includes(note.id) && !ndHasSummary(note.summary)
  ));

  if (!notes.length) {
    ndSetSummaryStatus("Select at least one note with a missing summary.");
    return;
  }

  const tbody = document.getElementById("nd-body");
  const viewVersion = ND_VIEW_VERSION;
  if (!tbody || !ndSameView(project, viewVersion, tbody)) return;

  const approved = window.confirm(
    `Generate summaries for ${notes.length} selected notes in project ${project}?\n\n` +
    "This uses OpenAI API credits. Only missing summaries will be filled. " +
    "Relationships, follow-ups, contact associations and note dates will not be changed."
  );
  if (!approved) return;

  ND_SUMMARY_BUSY = true;
  ND_SUMMARY_STOP = false;
  ndSetSummaryControls(true, true);

  const output = [];
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const remainingIds = new Set(selectedIds);

  try {
    for (const note of notes) {
      if (ND_SUMMARY_STOP || !ndSameView(project, viewVersion, tbody)) break;

      ndSetSummaryStatus(
        `Processing ${output.length + 1} of ${notes.length} — ` +
        `Updated: ${updated} | Skipped: ${skipped} | Failed: ${failed}`
      );

      try {
        const res = await fetch(`${ND_BASE_URL}/notes_diag/generate-summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project, note_id: note.id })
        });
        const data = await res.json().catch(() => null);

        if (
          !res.ok ||
          !data ||
          !["updated", "skipped"].includes(data.status)
        ) {
          throw new Error(data?.error || `Summary request failed (${res.status})`);
        }

        output.push(data);
        if (data.status === "updated") updated += 1;
        else skipped += 1;

        if (!ndSameView(project, viewVersion, tbody)) break;

        if (ndHasSummary(data.summary)) note.summary = data.summary;
        remainingIds.delete(note.id);

        // Display the saved summary immediately, retaining remaining selection.
        // In Missing mode, populated rows stay visible until Refresh.
        renderRows(portalState);
        document.querySelectorAll(".nd-row").forEach(cb => {
          cb.checked = remainingIds.has(cb.closest("tr").dataset.id);
        });
        updateSelectedCount();
        ndSetSummaryControls(true, true);
      } catch (err) {
        failed += 1;
        output.push({ note_id: note.id, status: "error", error: err.message });
        ND_SUMMARY_STOP = true;
        // Stop on the first failure instead of repeating a billing/API error.
        break;
      }
    }

    console.log("Summary backfill results:", output);

    if (ndSameView(project, viewVersion, tbody)) {
      const panel = document.getElementById("nd-summary-results-panel");
      const resultText = document.getElementById("nd-summary-results");
      if (panel) panel.open = true;
      if (resultText) resultText.textContent = JSON.stringify(output, null, 2);

      const errorResult = output.find(item => item.status === "error");
      ndSetSummaryStatus(
        `${ND_SUMMARY_STOP ? "Stopped" : "Finished"}. Processed: ${output.length}/${notes.length}. ` +
        `Updated: ${updated} | Skipped: ${skipped} | Failed: ${failed}.\n` +
        (errorResult ? `Error: ${errorResult.error}\n` : "") +
        "Saved summaries are shown in the grid. Click Refresh to reapply the selected filter."
      );
    }
  } finally {
    ND_SUMMARY_BUSY = false;
    if (ndSameView(project, viewVersion, tbody)) ndSetSummaryControls(false);
  }
}
