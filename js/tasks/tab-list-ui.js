// tab-list-ui.js — DOM, rendering, events

import { escapeHtml, formatDateOnly } from "../utilities.js";
import { renderTaskEdit } from "./tab-edit.js";
import {
  buildMultiSelect,
  renderDueIn,
  resolveAssigned,
  buildAssignedFilterOptions
} from "./tab-list-data.js";
import {
  getTasks,
  getFilteredTasks,
  setFilteredTasks,
  getSortLevels,
  setSortLevels,
  applyFiltersRaw,
  applySortInPlace,
  applyShowMineFilterRaw
} from "./tab-list-logic.js";

export function renderShell({ portalState, container }) {
  container.innerHTML = `
<section class="card">
  <h3>Tasks — List</h3>

  <div style="display:flex; gap:12px; margin-bottom:12px; align-items:center;">
    <button id="filterToggle" class="btn-secondary">Filter</button>
    <button id="sortToggle" class="btn-secondary">Sort</button>
    <button id="exportCsvBtn" class="btn-secondary">Export CSV</button>

    <label style="display:flex; align-items:center; gap:6px; margin-left:20px;">
      <input type="checkbox" id="showMine" checked>
      Show Only My Assigned Tasks
    </label>
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

  return { listEl, filterPanel, sortPanel };
}

export function renderFilterPanel({ filterPanel, lookups, projectStaff, portalState }) {
  filterPanel.innerHTML = `
<h4>Filters</h4>

<div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:12px;">

  <div>
    <label>Status</label>
    <select id="fStatus" multiple size="4" style="width:150px;">
      ${buildMultiSelect(lookups, "status")}
    </select>
  </div>

  <div>
    <label>Priority</label>
    <select id="fPriority" multiple size="4" style="width:150px;">
      ${buildMultiSelect(lookups, "priority")}
    </select>
  </div>

  <div>
    <label>Assigned To</label>
    <select id="fAssigned" style="width:150px;">
      ${buildAssignedFilterOptions(projectStaff, portalState)}
    </select>
  </div>

  <div>
    <label>Area</label>
    <select id="fArea" multiple size="4" style="width:150px;">
      ${buildMultiSelect(lookups, "area")}
    </select>
  </div>

  <div>
    <label>For</label>
    <select id="fFor" multiple size="4" style="width:150px;">
      ${buildMultiSelect(lookups, "who_is_this_for")}
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
}

function buildSortRow(idx, sortLevels, sortableFields) {
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
      <option value="asc" ${sortLevels[idx].dir === "asc" ? "selected" : ""}>
        A → Z / Oldest
      </option>
      <option value="desc" ${sortLevels[idx].dir === "desc" ? "selected" : ""}>
        Z → A / Newest
      </option>
    </select>
  </div>
  `;
}

export function renderSortPanel({ sortPanel }) {
  const sortableFields = [
    "title",
    "assigned_to",
    "who_is_this_for",
    "area",
    "priority",
    "status",
    "due_in",
    "due_date",
    "followup_date",
    "created_at"
  ];

  const sortLevels = getSortLevels();

  sortPanel.innerHTML = `
<h4>Sort</h4>
${buildSortRow(0, sortLevels, sortableFields)}
${buildSortRow(1, sortLevels, sortableFields)}
${buildSortRow(2, sortLevels, sortableFields)}
${buildSortRow(3, sortLevels, sortableFields)}
<button id="applySort" class="btn-primary">Apply Sort</button>
<button id="resetSort" class="btn-secondary">Reset</button>
`;
}

export function renderTable({ listEl, portalState, projectStaff }) {
  const tasks = getFilteredTasks();

  const rowsHtml = tasks
    .map(t => {
      return `
      <tr class="task-row" data-id="${t.id}">
        <td><button class="expand-btn" data-id="${t.id}">▶</button></td>
        <td>${escapeHtml(t.title || "")}</td>
        <td>${escapeHtml(t.who_is_this_for || "")}</td>
        <td>${escapeHtml(resolveAssigned(t, projectStaff, portalState))}</td>
        <td>${escapeHtml(t.area || "")}</td>
        <td>${t.priority != null ? escapeHtml(String(t.priority)) : ""}</td>
        <td>${escapeHtml(t.status || "")}</td>
        <td>${renderDueIn(t.due_in)}</td>
        <td>${formatDateOnly(t.due_date)}</td>
        <td>${formatDateOnly(t.followup_date)}</td>
        <td>${formatDateOnly(t.created_at)}</td>
      </tr>

      <tr id="expand-${t.id}" style="display:none;">
        <td colspan="11">
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
        <th>Created</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  `;

  listEl.querySelectorAll(".expand-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const row = document.getElementById(`expand-${id}`);
      const open = row.style.display === "table-row";

      row.style.display = open ? "none" : "table-row";
      btn.textContent = open ? "▶" : "▼";

      if (!open) {
        renderTaskEdit({
          task: getTasks().find(x => x.id === id),
          portalState,
          container: document.getElementById(`edit-${id}`)
        });
      }
    });
  });
}

export function wireToggles({ container, filterPanel, sortPanel }) {
  container.querySelector("#filterToggle").addEventListener("click", () => {
    filterPanel.style.display =
      filterPanel.style.display === "none" ? "block" : "none";
  });

  container.querySelector("#sortToggle").addEventListener("click", () => {
    sortPanel.style.display =
      sortPanel.style.display === "none" ? "block" : "none";
  });
}

export function wireFilterButtons({ filterPanel, portalState, render }) {
  filterPanel.querySelector("#applyFilters").addEventListener("click", () => {
    const statusSel = [...filterPanel.querySelector("#fStatus").selectedOptions].map(o => o.value);
    const prioritySel = [...filterPanel.querySelector("#fPriority").selectedOptions].map(o => o.value);
    const assignedSel = filterPanel.querySelector("#fAssigned").value;
    const areaSel = [...filterPanel.querySelector("#fArea").selectedOptions].map(o => o.value);
    const forSel = [...filterPanel.querySelector("#fFor").selectedOptions].map(o => o.value);
    const dueFilter = filterPanel.querySelector("#fDue").value;
    const followDueToday = filterPanel.querySelector("#fFollowToday").checked;

    let arr = applyFiltersRaw(getTasks(), {
      statusSel,
      prioritySel,
      assignedSel,
      areaSel,
      forSel,
      dueFilter,
      followDueToday
    });

    arr = applyShowMineFilterRaw(arr, portalState);
    setFilteredTasks(arr);
    render();
  });

  filterPanel.querySelector("#resetFilters").addEventListener("click", () => {
    filterPanel.querySelectorAll("select").forEach(sel => (sel.selectedIndex = -1));
    filterPanel.querySelector("#fDue").value = "all";
    filterPanel.querySelector("#fFollowToday").checked = false;

    let arr = [...getTasks()];
    arr = applyShowMineFilterRaw(arr, portalState);
    setFilteredTasks(arr);
    render();
  });
}

export function wireSortButtons({ sortPanel, render }) {
  sortPanel.querySelector("#applySort").addEventListener("click", () => {
    const fields = sortPanel.querySelectorAll(".sort-field");
    const dirs = sortPanel.querySelectorAll(".sort-dir");

    const newLevels = getSortLevels().map((lvl, i) => ({
      field: fields[i].value,
      dir: dirs[i].value
    }));

    setSortLevels(newLevels);
    applySortInPlace(getFilteredTasks(), getSortLevels(), {
      resolveAssigned: t => resolveAssigned(t, [], {}) // not used here for created_at etc
    });
    render();
  });

  sortPanel.querySelector("#resetSort").addEventListener("click", () => {
    setSortLevels([
      { field: "due_date", dir: "asc" },
      { field: "", dir: "asc" },
      { field: "", dir: "asc" },
      { field: "", dir: "asc" }
    ]);
    applySortInPlace(getFilteredTasks(), getSortLevels(), {
      resolveAssigned: t => "" // not used when field not assigned_to
    });
    render();
  });
}

export function wireShowMine({ container, portalState, render }) {
  const showMineEl = container.querySelector("#showMine");
  portalState.showMineChecked = showMineEl.checked;

  showMineEl.addEventListener("change", () => {
    portalState.showMineChecked = showMineEl.checked;

    let arr = applyFiltersRaw(getTasks(), {
      statusSel: [],
      prioritySel: [],
      assignedSel: "",
      areaSel: [],
      forSel: [],
      dueFilter: "all",
      followDueToday: false
    });

    arr = applyShowMineFilterRaw(arr, portalState);
    setFilteredTasks(arr);
    render();
  });
}

export function wireExportCsv({ container, portalState, resolveAssignedHelper }) {
  container.querySelector("#exportCsvBtn").addEventListener("click", () => {
    const filtered = getFilteredTasks();
    if (!filtered.length) {
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
      "created_at",
      "notes"
    ];

    const csvRows = [
      headers.join(","),
      ...filtered.map(t => {
        const row = {
          id: t.id,
          title: t.title || "",
          who_is_this_for: t.who_is_this_for || "",
          assigned_to: resolveAssignedHelper(t),
          area: t.area || "",
          priority: t.priority ?? "",
          status: t.status || "",
          due_in: t.due_in ?? "",
          due_date: t.due_date || "",
          followup_date: t.followup_date || "",
          created_at: t.created_at || "",
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
}
