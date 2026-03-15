// tab-list.js — Tasks List with Filters, Multi-Sort, Export CSV, Inline Expand (Edit moved to tab-edit.js)

import { escapeHtml, formatDateOnly } from "../utilities.js";
import { renderTaskEdit } from "./tab-edit.js";

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
        return `<option value="${escapeHtml(val)}" ${selected}>${escapeHtml(val)}</option>`;
      })
      .join("");

    return `
      <option value="">-- Select --</option>
      ${optionsHtml}
    `;
  }

  function renderDueIn(dueIn) {
    if (dueIn === null) return `<span style="color:#999;">⚪ —</span>`;
    if (dueIn <= 2) return `<span style="color:#d00;">🔴 ${dueIn}d</span>`;
    if (dueIn <= 5) return `<span style="color:#c9a000;">🟡 ${dueIn}d</span>`;
    return `<span style="color:#0a0;">🟢 ${dueIn}d</span>`;
  }

  /* ---------------------------------------------------------
     Fetch project staff (for Assigned To resolution)
  --------------------------------------------------------- */
  let projectStaff = [];
  try {
    const res = await fetch(
      `https://tasks-manager.dennis-e64.workers.dev/projects/staff?project=${encodeURIComponent(
        portalState.project
      )}`,
      { cache: "no-cache" }
    );
    projectStaff = await res.json();
    if (!Array.isArray(projectStaff)) projectStaff = [];
  } catch {
    projectStaff = [];
  }

  function resolveAssigned(t) {
    // 1. Assigned to a user
    if (t.assigned_to_user_id) {
      const u = projectStaff.find(x => x.id === t.assigned_to_user_id);
      if (u) {
        const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
        return name || u.staff_name || u.staff_email || "";
      }
    }

    // 2. Assigned to client contact
    if (
      t.assigned_to_contact_id &&
      t.assigned_to_contact_id === portalState.project_contact_id
    ) {
      return "Client";
    }

    // 3. Other
    if (t.who === "Other") return "Other";

    return "";
  }

  /* ---------------------------------------------------------
     Build Assigned To filter options
  --------------------------------------------------------- */
  function buildAssignedFilterOptions() {
    let html = `<option value="">-- All --</option>`;

    // Users
    for (const u of projectStaff) {
      const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
      const label = name || u.staff_name || u.staff_email || "";
      html += `<option value="user:${escapeHtml(u.id)}">${escapeHtml(label)}</option>`;
    }

    // Client
    if (portalState.project_contact_id) {
      html += `<option value="contact:${escapeHtml(
        portalState.project_contact_id
      )}">Client</option>`;
    }

    // Other
    html += `<option value="other">Other</option>`;

    return html;
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
     Compute due_in (timezone-proof)
  --------------------------------------------------------- */
  function computeDueIn(arr) {
    const today = new Date();
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return arr.map(t => {
      if (!t.due_date) return { ...t, due_in: null };

      const [y, m, d] = t.due_date.split("-").map(Number);
      const dueMid = new Date(y, m - 1, d);

      const diffDays = Math.round((dueMid - todayMid) / 86400000);
      return { ...t, due_in: diffDays };
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
    "assigned_to",
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
    const assignedSel = filterPanel.querySelector("#fAssigned").value;
    const areaSel = [...filterPanel.querySelector("#fArea").selectedOptions].map(o => o.value);
    const forSel = [...filterPanel.querySelector("#fFor").selectedOptions].map(o => o.value);
    const dueFilter = filterPanel.querySelector("#fDue").value;
    const followDueToday = filterPanel.querySelector("#fFollowToday").checked;

    filteredTasks = tasks.filter(t => {
      if (statusSel.length && !statusSel.includes(t.status)) return false;
      if (prioritySel.length && !prioritySel.includes(String(t.priority))) return false;
      if (areaSel.length && !areaSel.includes(t.area)) return false;
      if (forSel.length && !forSel.includes(t.who_is_this_for)) return false;

      // Assigned To filter
      if (assignedSel) {
        if (assignedSel.startsWith("user:")) {
          const id = assignedSel.replace("user:", "");
          if (t.assigned_to_user_id !== id) return false;
        } else if (assignedSel.startsWith("contact:")) {
          const id = assignedSel.replace("contact:", "");
          if (t.assigned_to_contact_id !== id) return false;
        } else if (assignedSel === "other") {
          if (t.who !== "Other") return false;
        }
      }

      const today = new Date();
      const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      const due = t.due_date ? new Date(t.due_date) : null;
      const dueMid = due ? new Date(due.getFullYear(), due.getMonth(), due.getDate()) : null;

      if (dueFilter === "today" && (!dueMid || dueMid.getTime() !== todayMid.getTime())) return false;
      if (dueFilter === "overdue" && (!dueMid || dueMid >= todayMid)) return false;
      if (dueFilter === "7" && (!dueMid || dueMid > new Date(todayMid.getTime() + 7 * 86400000))) return false;
      if (dueFilter === "30" && (!dueMid || dueMid > new Date(todayMid.getTime() + 30 * 86400000))) return false;

      if (followDueToday) {
        const f = t.followup_date ? new Date(t.followup_date) : null;
        const fMid = f ? new Date(f.getFullYear(), f.getMonth(), f.getDate()) : null;
        if (!fMid || fMid > todayMid) return false;
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

        let A, B;

        if (lvl.field === "assigned_to") {
          A = resolveAssigned(a).toLowerCase();
          B = resolveAssigned(b).toLowerCase();
        } else {
          A = a[lvl.field];
          B = b[lvl.field];

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
        <label>Assigned To</label>
        <select id="fAssigned" style="width:150px;">
          ${buildAssignedFilterOptions()}
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
            .map(
              f =>
                `<option value="${f}" ${
                  sortLevels[idx].field === f ? "selected" : ""
                }>${f}</option>`
            )
            .join("")}
        </select>

        <select class="sort-dir" data-idx="${idx}" style="width:120px;">
          <option value="asc" ${
            sortLevels[idx].dir === "asc" ? "selected" : ""
          }>A → Z / Oldest</option>
          <option value="desc" ${
            sortLevels[idx].dir === "desc" ? "selected" : ""
          }>Z → A / Newest</option>
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
     Render Table (with new Edit UI)
  --------------------------------------------------------- */
  function renderTable() {
    applySort();

    const rowsHtml = filteredTasks
      .map(t => {
        return `
          <tr class="task-row" data-id="${t.id}">
            <td><button class="expand-btn" data-id="${t.id}">▶</button></td>
            <td>${escapeHtml(t.title || "")}</td>
            <td>${escapeHtml(t.who_is_this_for || "")}</td>
            <td>${escapeHtml(resolveAssigned(t))}</td>
            <td>${escapeHtml(t.area || "")}</td>
            <td>${t.priority != null ? escapeHtml(String(t.priority)) : ""}</td>
            <td>${escapeHtml(t.status || "")}</td>
            <td>${renderDueIn(t.due_in)}</td>
            <td>${formatDateOnly(t.due_date)}</td>
            <td>${formatDateOnly(t.followup_date)}</td>
          </tr>

          <!-- NEW EDIT PANEL -->
          <tr id="expand-${t.id}" style="display:none;">
            <td colspan="10">
              <div style="padding:12px; background:#f7f7f7; border:1px solid #ddd;">
                <div id="edit-${t.id}"></div>
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
            <th>Assigned To</th>
            <th>Area</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Due In</th>
            <th>Due</th>
            <th>Follow-up</th>
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

        if (!open) {
          // Render the new Add-style Edit UI
          renderTaskEdit({
            task: tasks.find(x => x.id === id),
            portalState,
            container: document.getElementById(`edit-${id}`)
          });
        }
      });
    });
  }

  /* ---------------------------------------------------------
     FILTER PANEL TOGGLE
  --------------------------------------------------------- */
  container.querySelector("#filterToggle").addEventListener("click", () => {
    filterPanel.style.display =
      filterPanel.style.display === "none" ? "block" : "none";
  });

   /* ---------------------------------------------------------
     SORT PANEL TOGGLE
  --------------------------------------------------------- */
  container.querySelector("#sortToggle").addEventListener("click", () => {
    sortPanel.style.display =
      sortPanel.style.display === "none" ? "block" : "none";
  });

  /* ---------------------------------------------------------
     APPLY FILTERS
  --------------------------------------------------------- */
  filterPanel.querySelector("#applyFilters").addEventListener("click", () => {
    applyFilters();
    renderTable();
  });

  /* ---------------------------------------------------------
     RESET FILTERS
  --------------------------------------------------------- */
  filterPanel.querySelector("#resetFilters").addEventListener("click", () => {
    filterPanel.querySelectorAll("select").forEach(sel => (sel.selectedIndex = -1));
    filterPanel.querySelector("#fDue").value = "all";
    filterPanel.querySelector("#fFollowToday").checked = false;

    filteredTasks = [...tasks];
    renderTable();
  });

  /* ---------------------------------------------------------
     APPLY SORT
  --------------------------------------------------------- */
  sortPanel.querySelector("#applySort").addEventListener("click", () => {
    const fields = sortPanel.querySelectorAll(".sort-field");
    const dirs = sortPanel.querySelectorAll(".sort-dir");

    fields.forEach((f, i) => {
      sortLevels[i].field = f.value;
      sortLevels[i].dir = dirs[i].value;
    });

    renderTable();
  });

  /* ---------------------------------------------------------
     RESET SORT
  --------------------------------------------------------- */
  sortPanel.querySelector("#resetSort").addEventListener("click", () => {
    sortLevels = [
      { field: "due_date", dir: "asc" },
      { field: "", dir: "asc" },
      { field: "", dir: "asc" },
      { field: "", dir: "asc" }
    ];
    renderTable();
  });

  /* ---------------------------------------------------------
     EXPORT CSV
  --------------------------------------------------------- */
  container.querySelector("#exportCsvBtn").addEventListener("click", () => {
    if (!filteredTasks.length) {
      alert("No tasks to export.");
      return;
    }

    const headers = [
      "id",
      "title",
      "who_is_this_for",
      "assigned_to",
      "area",
      "priority",
      "status",
      "due_in",
      "due_date",
      "followup_date",
      "notes"
    ];

    const csvRows = [
      headers.join(","),
      ...filteredTasks.map(t => {
        const row = {
          id: t.id,
          title: t.title || "",
          who_is_this_for: t.who_is_this_for || "",
          assigned_to: resolveAssigned(t),
          area: t.area || "",
          priority: t.priority ?? "",
          status: t.status || "",
          due_in: t.due_in ?? "",
          due_date: t.due_date || "",
          followup_date: t.followup_date || "",
          notes: t.notes || ""
        };

        return headers
          .map(h => `"${String(row[h]).replace(/"/g, '""')}"`)
          .join(",");
      })
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tasks_export_${portalState.project}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  /* ---------------------------------------------------------
     INITIAL RENDER
  --------------------------------------------------------- */
  renderTable();
}
