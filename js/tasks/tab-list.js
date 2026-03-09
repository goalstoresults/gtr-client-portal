// tab-list.js — Tasks List with Filters, Multi-Sort, Export CSV, Inline Edit

import { escapeHtml, formatDateOnly } from "../utilities.js";

export async function loadTasksList({ portalState, container }) {
  container.innerHTML = `
    <section class="card">
      <h3>Tasks — List</h3>

      <div style="display:flex; gap:8px; margin-bottom:12px;">
        <button id="filterToggle" class="btn-secondary">Filter</button>
        <button id="sortToggle" class="btn-secondary">Sort</button>
        <button id="exportCsvBtn" class="btn-secondary">Export CSV</button>
      </div>

      <div id="filterPanel" style="display:none; padding:12px; background:#f7f7f7; border:1px solid #ddd; margin-bottom:12px;"></div>
      <div id="sortPanel" style="display:none; padding:12px; background:#f7f7f7; border:1px solid #ddd; margin-bottom:12px;"></div>

      <div id="tasksListContent">
        <p>Loading tasks...</p>
      </div>
    </section>
  `;

  const listEl = container.querySelector("#tasksListContent");
  const filterPanel = container.querySelector("#filterPanel");
  const sortPanel = container.querySelector("#sortPanel");

  if (!portalState.project) {
    listEl.innerHTML = `<p>No project selected.</p>`;
    return;
  }

  /* ---------------------------------------------------------
     Fetch lookups
  --------------------------------------------------------- */
  let lookups = [];
  try {
    const res = await fetch(
      `https://tasks-manager.dennis-e64.workers.dev/lookups/list?project=${encodeURIComponent(
        portalState.project
      )}`,
      { cache: "no-cache" }
    );
    const j = await res.json();
    lookups = Array.isArray(j) ? j : [];
  } catch {
    lookups = [];
  }

  function getOptions(field) {
    return lookups
      .filter(r => r.field === field && r.active)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  function buildOptions(field, currentValue) {
    const opts = getOptions(field);
    const cur = currentValue || "";
    const optionsHtml = opts
      .map(o => {
        const val = o.value || "";
        const selected = val === cur ? "selected" : "";
        return `<option value="${escapeHtml(val)}" ${selected}>${escapeHtml(
          val
        )}</option>`;
      })
      .join("");
    return `
      <option value="">-- Select --</option>
      ${optionsHtml}
    `;
  }

  function buildMultiSelect(field) {
    const opts = getOptions(field);
    return opts
      .map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.value)}</option>`)
      .join("");
  }

  /* ---------------------------------------------------------
     Fetch tasks
  --------------------------------------------------------- */
  async function fetchTasks() {
    try {
      const res = await fetch(
        `https://tasks-manager.dennis-e64.workers.dev/tasks/list?project=${encodeURIComponent(
          portalState.project
        )}`,
        { cache: "no-cache" }
      );
      const j = await res.json();
      return Array.isArray(j) ? j : [];
    } catch {
      return [];
    }
  }

  let tasks = await fetchTasks();
  let filteredTasks = [...tasks];

  /* ---------------------------------------------------------
     Compute due_in
  --------------------------------------------------------- */
  function computeDueIn(arr) {
    const now = new Date();
    return arr.map(t => {
      let dueIn = null;
      if (t.due_date) {
        const d = new Date(t.due_date);
        const diff = Math.floor((d - now) / (1000 * 60 * 60 * 24));
        dueIn = diff;
      }
      return { ...t, due_in: dueIn };
    });
  }

  tasks = computeDueIn(tasks);
  filteredTasks = [...tasks];

  /* ---------------------------------------------------------
     Sorting state
  --------------------------------------------------------- */
  let sortLevels = [
    { field: "due_date", dir: "asc" },
    { field: "", dir: "asc" },
    { field: "", dir: "asc" },
    { field: "", dir: "asc" }
  ];

  const sortableFields = [
    "title",
    "who",
    "who_is_this_for",
    "area",
    "priority",
    "status",
    "due_in",
    "due_date",
    "followup_date"
  ];

  /* ---------------------------------------------------------
     Apply filters
  --------------------------------------------------------- */
  function applyFilters() {
    const statusSel = [...filterPanel.querySelector("#fStatus").selectedOptions].map(o => o.value);
    const prioritySel = [...filterPanel.querySelector("#fPriority").selectedOptions].map(o => o.value);
    const whoSel = [...filterPanel.querySelector("#fWho").selectedOptions].map(o => o.value);
    const areaSel = [...filterPanel.querySelector("#fArea").selectedOptions].map(o => o.value);
    const forSel = [...filterPanel.querySelector("#fFor").selectedOptions].map(o => o.value);

    const dueFilter = filterPanel.querySelector("#fDue").value;
    const followDueToday = filterPanel.querySelector("#fFollowToday").checked;

    filteredTasks = tasks.filter(t => {
      if (statusSel.length && !statusSel.includes(t.status)) return false;
      if (prioritySel.length && !prioritySel.includes(String(t.priority))) return false;
      if (whoSel.length && !whoSel.includes(t.who)) return false;
      if (areaSel.length && !areaSel.includes(t.area)) return false;
      if (forSel.length && !forSel.includes(t.who_is_this_for)) return false;

      if (dueFilter !== "all") {
        const today = new Date();
        const due = t.due_date ? new Date(t.due_date) : null;

        if (dueFilter === "today" && (!due || due.toDateString() !== today.toDateString())) return false;
        if (dueFilter === "overdue" && (!due || due >= today)) return false;
        if (dueFilter === "7" && (!due || due > new Date(today.getTime() + 7 * 86400000))) return false;
        if (dueFilter === "30" && (!due || due > new Date(today.getTime() + 30 * 86400000))) return false;
      }

      if (followDueToday) {
        const today = new Date();
        const f = t.followup_date ? new Date(t.followup_date) : null;
        if (!f || f > today) return false;
      }

      return true;
    });
  }

  /* ---------------------------------------------------------
     Apply multi-sort
  --------------------------------------------------------- */
  function applySort() {
    filteredTasks.sort((a, b) => {
      for (const lvl of sortLevels) {
        if (!lvl.field) continue;

        let A = a[lvl.field];
        let B = b[lvl.field];

        if (lvl.field === "due_date" || lvl.field === "followup_date") {
          A = A ? new Date(A) : new Date(0);
          B = B ? new Date(B) : new Date(0);
        } else if (lvl.field === "priority" || lvl.field === "due_in") {
          A = Number(A) || 0;
          B = Number(B) || 0;
        } else {
          A = (A || "").toString().toLowerCase();
          B = (B || "").toString().toLowerCase();
        }

        if (A < B) return lvl.dir === "asc" ? -1 : 1;
        if (A > B) return lvl.dir === "asc" ? 1 : -1;
      }
      return 0;
    });
  }

  /* ---------------------------------------------------------
     Render Filter Panel
  --------------------------------------------------------- */
  filterPanel.innerHTML = `
    <h4>Filters</h4>

    <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:12px;">
      <div>
        <label>Status</label>
        <select id="fStatus" multiple size="4" style="width:150px;">
          ${buildMultiSelect("status")}
        </select>
      </div>

      <div>
        <label>Priority</label>
        <select id="fPriority" multiple size="4" style="width:150px;">
          ${buildMultiSelect("priority")}
        </select>
      </div>

      <div>
        <label>Who</label>
        <select id="fWho" multiple size="4" style="width:150px;">
          ${buildMultiSelect("who")}
        </select>
      </div>

      <div>
        <label>Area</label>
        <select id="fArea" multiple size="4" style="width:150px;">
          ${buildMultiSelect("area")}
        </select>
      </div>

      <div>
        <label>For</label>
        <select id="fFor" multiple size="4" style="width:150px;">
          ${buildMultiSelect("who_is_this_for")}
        </select>
      </div>

      <div>
        <label>Due</label>
        <select id="fDue" style="width:150px;">
          <option value="all">All</option>
          <option value="today">Today</option>
          <option value="overdue">Overdue</option>
          <option value="7">Next 7 days</option>
          <option value="30">Next 30 days</option>
        </select>
      </div>

      <div>
        <label>Follow-up</label><br>
        <input type="checkbox" id="fFollowToday"> Due ≤ Today
      </div>
    </div>

    <button id="applyFilters" class="btn-primary">Apply Filters</button>
    <button id="resetFilters" class="btn-secondary">Reset</button>
  `;

  /* ---------------------------------------------------------
     Render Sort Panel
  --------------------------------------------------------- */
  function buildSortRow(idx) {
    return `
      <div style="display:flex; gap:8px; margin-bottom:8px;">
        <select class="sort-field" data-idx="${idx}" style="width:180px;">
          <option value="">— none —</option>
          ${sortableFields
            .map(f => `<option value="${f}" ${sortLevels[idx].field === f ? "selected" : ""}>${f}</option>`)
            .join("")}
        </select>

        <select class="sort-dir" data-idx="${idx}" style="width:120px;">
          <option value="asc" ${sortLevels[idx].dir === "asc" ? "selected" : ""}>A → Z / Oldest</option>
          <option value="desc" ${sortLevels[idx].dir === "desc" ? "selected" : ""}>Z → A / Newest</option>
        </select>
      </div>
    `;
  }

  sortPanel.innerHTML = `
    <h4>Sort</h4>

    ${buildSortRow(0)}
    ${buildSortRow(1)}
    ${buildSortRow(2)}
    ${buildSortRow(3)}

    <button id="applySort" class="btn-primary">Apply Sort</button>
    <button id="resetSort" class="btn-secondary">Reset</button>
  `;

  /* ---------------------------------------------------------
     Render Table
  --------------------------------------------------------- */
  function renderTable() {
    applySort();

    const rowsHtml = filteredTasks
      .map(t => {
        const statusOptions = buildOptions("status", t.status);
        const priorityOptions = buildOptions("priority", t.priority?.toString());
        const areaOptions = buildOptions("area", t.area);
        const whoOptions = buildOptions("who", t.who);
        const whoForOptions = buildOptions("who_is_this_for", t.who_is_this_for);

        return `
        <tr class="task-row" data-id="${t.id}">
          <td><button class="expand-btn" data-id="${t.id}">▶</button></td>
          <td>${escapeHtml(t.title || "")}</td>
          <td>${escapeHtml(t.who_is_this_for || "")}</td>
          <td>${escapeHtml(t.who || "")}</td>
          <td>${escapeHtml(t.area || "")}</td>
          <td>${escapeHtml(t.priority || "")}</td>
          <td>${escapeHtml(t.status || "")}</td>
          <td>${t.due_in === null ? "—" : t.due_in + "d"}</td>
          <td>${formatDateOnly(t.due_date)}</td>
          <td>${formatDateOnly(t.followup_date)}</td>
          <td>${escapeHtml(t.project || "")}</td>
        </tr>

        <tr id="expand-${t.id}" style="display:none;">
          <td colspan="11">
            <div style="padding:12px; background:#f7f7f7; border:1px solid #ddd;">

              <div style="display:flex; gap:12px; margin-bottom:8px;">
                <div style="flex:1;">
                  <label>Title</label>
                  <input class="edit-title" value="${escapeHtml(t.title || "")}" style="width:100%;">
                </div>
                <div style="flex:0 0 20%;">
                  <label>Status</label>
                  <select class="edit-status" style="width:100%;">${statusOptions}</select>
                </div>
                <div style="flex:0 0 20%;">
                  <label>Priority</label>
                  <select class="edit-priority" style="width:100%;">${priorityOptions}</select>
                </div>
              </div>

              <div style="display:flex; gap:12px; margin-bottom:8px;">
                <div style="flex:0 0 25%;">
                  <label>Area</label>
                  <select class="edit-area" style="width:100%;">${areaOptions}</select>
                </div>
                <div style="flex:0 0 25%;">
                  <label>Assigned</label>
                  <select class="edit-who" style="width:100%;">${whoOptions}</select>
                </div>
                <div style="flex:0 0 25%;">
                  <label>Who Is This For</label>
                  <select class="edit-whoFor" style="width:100%;">${whoForOptions}</select>
                </div>
              </div>

              <div style="display:flex; gap:12px; margin-bottom:8px;">
                <div style="flex:0 0 25%;">
                  <label>Due Date</label>
                  <input type="date" class="edit-due" value="${t.due_date || ""}" style="width:100%;">
                </div>
                <div style="flex:0 0 25%;">
                  <label>Follow-up</label>
                  <input type="date" class="edit-follow" value="${t.followup_date || ""}" style="width:100%;">
                </div>
              </div>

              <div style="margin-bottom:8px;">
                <label>Notes</label>
                <textarea class="edit-notes" style="width:100%;">${escapeHtml(t.notes || "")}</textarea>
              </div>

              <div style="display:flex; gap:12px;">
                <button class="btn-primary save-edit" data-id="${t.id}">Save</button>
                <button class="btn-danger delete-task" data-id="${t.id}">Delete</button>
              </div>

            </div>
          </td>
        </tr>
      `;
      })
      .join("");

    listEl.innerHTML = `
      <table class="notes-table">
        <thead>
          <tr>
            <th></th>
            <th>Title</th>
            <th>For</th>
            <th>Who</th>
            <th>Area</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Due In</th>
            <th>Due</th>
            <th>Follow-up</th>
            <th>Project</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;

    /* Expand */
    listEl.querySelectorAll(".expand-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const row = document.getElementById(`expand-${id}`);
        const open = row.style.display === "table-row";
        row.style.display = open ? "none" : "table-row";
        btn.textContent = open ? "▶" : "▼";
      });
    });

    /* Save Edit */
    listEl.querySelectorAll(".save-edit").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const row = document.getElementById(`expand-${id}`);

        const payload = {
          id,
          project: portalState.project,
          title: row.querySelector(".edit-title").value.trim(),
          status: row.querySelector(".edit-status").value,
          priority: row.querySelector(".edit-priority").value,
          area: row.querySelector(".edit-area").value,
          who: row.querySelector(".edit-who").value,
          who_is_this_for: row.querySelector(".edit-whoFor").value,
          due_date: row.querySelector(".edit-due").value || null,
          followup_date: row.querySelector(".edit-follow").value || null,
          notes: row.querySelector(".edit-notes").value.trim()
        };

        await fetch("https://tasks-manager.dennis-e64.workers.dev/tasks/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        tasks = computeDueIn(await fetchTasks());
        filteredTasks = [...tasks];
        renderTable();
      });
    });

    /* Delete */
    listEl.querySelectorAll(".delete-task").forEach(btn => {
      btn.add
