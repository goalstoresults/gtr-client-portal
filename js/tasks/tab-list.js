// tab-list.js — Tasks List with Inline Expand/Edit

import { escapeHtml, formatDateOnly } from "../utilities.js";

export async function loadTasksList({ portalState, container }) {
  container.innerHTML = `
    <section class="card">
      <h3>Tasks — List</h3>
      <div id="tasksListContent">
        <p>Loading tasks...</p>
      </div>
    </section>
  `;

  const listEl = container.querySelector("#tasksListContent");

  if (!portalState.project) {
    listEl.innerHTML = `<p>No project selected.</p>`;
    return;
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

  /* ---------------------------------------------------------
     Sorting state
  --------------------------------------------------------- */
  let currentSortField = "due_date";
  let currentSortDirection = "asc";

  const columns = [
    { key: "expand", label: "" },
    { key: "title", label: "Title" },
    { key: "who_is_this_for", label: "For" },
    { key: "who", label: "Who" },
    { key: "status", label: "Status" },
    { key: "due_in", label: "Due In", numeric: true },
    { key: "due_date", label: "Due Date", isDate: true }
  ];

  /* ---------------------------------------------------------
     Precompute due_in
  --------------------------------------------------------- */
  function computeDueIn() {
    const now = new Date();
    tasks = tasks.map(t => {
      let dueIn = null;
      if (t.due_date) {
        const d = new Date(t.due_date);
        const diff = Math.floor((d - now) / (1000 * 60 * 60 * 24));
        dueIn = diff;
      }
      return { ...t, due_in: dueIn };
    });
  }
  computeDueIn();

  /* ---------------------------------------------------------
     Sorting logic
  --------------------------------------------------------- */
  function sortTasks() {
    tasks.sort((a, b) => {
      let A = a[currentSortField];
      let B = b[currentSortField];

      const col = columns.find(c => c.key === currentSortField);

      if (col?.isDate) {
        A = A ? new Date(A) : new Date(0);
        B = B ? new Date(B) : new Date(0);
      } else if (col?.numeric) {
        A = Number(A) || 0;
        B = Number(B) || 0;
      } else {
        A = (A || "").toString().toLowerCase();
        B = (B || "").toString().toLowerCase();
      }

      if (A < B) return currentSortDirection === "asc" ? -1 : 1;
      if (A > B) return currentSortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  /* ---------------------------------------------------------
     Render table
  --------------------------------------------------------- */
  function renderTable() {
    sortTasks();

    const headerHtml = columns
      .map(col => {
        if (col.key === "expand") return `<th></th>`;

        const isSorted = currentSortField === col.key;
        const upArrow = isSorted && currentSortDirection === "asc" ? "▲" : "△";
        const downArrow = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

        return `
          <th class="sortable" data-field="${col.key}">
            ${escapeHtml(col.label)}
            <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
              <span class="sort-up">${upArrow}</span>
              <span class="sort-down">${downArrow}</span>
            </span>
          </th>
        `;
      })
      .join("");

    const rowsHtml = tasks
      .map(
        t => `
        <tr class="task-row" data-id="${t.id}">
          <td class="expand-cell">
            <button class="expand-btn" data-id="${t.id}">▶</button>
          </td>
          <td>${escapeHtml(t.title || "")}</td>
          <td>${escapeHtml(t.who_is_this_for || "")}</td>
          <td>${escapeHtml(t.who || "")}</td>
          <td>${escapeHtml(t.status || "")}</td>
          <td>${t.due_in === null ? "—" : t.due_in + "d"}</td>
          <td>${formatDateOnly(t.due_date)}</td>
        </tr>

        <!-- EXPAND ROW -->
        <tr class="expand-row" id="expand-${t.id}" style="display:none;">
          <td colspan="${columns.length}">
            <div class="expand-box" style="padding:12px; background:#f7f7f7; border:1px solid #ddd;">

              <div style="display:flex; gap:12px; margin-bottom:8px;">
                <div style="flex:1;">
                  <label>Title</label>
                  <input class="edit-title" value="${escapeHtml(t.title || "")}" style="width:100%;">
                </div>
                <div style="flex:0 0 20%;">
                  <label>Status</label>
                  <input class="edit-status" value="${escapeHtml(t.status || "")}" style="width:100%;">
                </div>
                <div style="flex:0 0 20%;">
                  <label>Priority</label>
                  <input class="edit-priority" value="${escapeHtml(t.priority || "")}" style="width:100%;">
                </div>
              </div>

              <div style="display:flex; gap:12px; margin-bottom:8px;">
                <div style="flex:0 0 25%;">
                  <label>Area</label>
                  <input class="edit-area" value="${escapeHtml(t.area || "")}" style="width:100%;">
                </div>
                <div style="flex:0 0 25%;">
                  <label>Assigned</label>
                  <input class="edit-who" value="${escapeHtml(t.who || "")}" style="width:100%;">
                </div>
                <div style="flex:0 0 25%;">
                  <label>Who Is This For</label>
                  <input class="edit-whoFor" value="${escapeHtml(t.who_is_this_for || "")}" style="width:100%;">
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
      `
      )
      .join("");

    listEl.innerHTML = `
      <table class="notes-table">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="${columns.length}">(no tasks found)</td></tr>`}
        </tbody>
      </table>
    `;

    /* ---------------------------------------------------------
       Sorting events
    --------------------------------------------------------- */
    listEl.querySelectorAll("th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.dataset.field;

        currentSortDirection =
          currentSortField === field
            ? currentSortDirection === "asc"
              ? "desc"
              : "asc"
            : "asc";

        currentSortField = field;
        renderTable();
      });
    });

    /* ---------------------------------------------------------
       Expand / Collapse
    --------------------------------------------------------- */
    listEl.querySelectorAll(".expand-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const row = document.getElementById(`expand-${id}`);
        const isOpen = row.style.display === "table-row";

        row.style.display = isOpen ? "none" : "table-row";
        btn.textContent = isOpen ? "▶" : "▼";
      });
    });

    /* ---------------------------------------------------------
       Save Edit
    --------------------------------------------------------- */
    listEl.querySelectorAll(".save-edit").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const row = document.getElementById(`expand-${id}`);

        const payload = {
          id,
          project: portalState.project,
          title: row.querySelector(".edit-title").value.trim(),
          status: row.querySelector(".edit-status").value.trim(),
          priority: row.querySelector(".edit-priority").value.trim(),
          area: row.querySelector(".edit-area").value.trim(),
          who: row.querySelector(".edit-who").value.trim(),
          who_is_this_for: row.querySelector(".edit-whoFor").value.trim(),
          due_date: row.querySelector(".edit-due").value || null,
          followup_date: row.querySelector(".edit-follow").value || null,
          notes: row.querySelector(".edit-notes").value.trim()
        };

        await fetch(
          "https://tasks-manager.dennis-e64.workers.dev/tasks/update",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          }
        );

        tasks = await fetchTasks();
        computeDueIn();
        renderTable();
      });
    });

    /* ---------------------------------------------------------
       Delete Task
    --------------------------------------------------------- */
    listEl.querySelectorAll(".delete-task").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;

        if (!confirm("Delete this task?")) return;

        await fetch(
          "https://tasks-manager.dennis-e64.workers.dev/tasks/delete",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
          }
        );

        tasks = await fetchTasks();
        computeDueIn();
        renderTable();
      });
    });
  }

  renderTable();
}
