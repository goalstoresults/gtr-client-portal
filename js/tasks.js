// /tasks/tasks.js
// Phase 1: Portal-native UI that injects the legacy task list HTML (no iframe)
// Includes Portal styling + future-proof structure for JSON mode

export async function loadTasksTab({ portalState, tabContent }) {
  tabContent.innerHTML = `
    <section class="card">
      <h2 style="margin-bottom: 12px;">Tasks</h2>

      <div id="tasksControls" style="
        margin-bottom: 16px;
        display: flex;
        gap: 12px;
        align-items: center;
      ">
        <button id="addTaskBtn" class="btn">Add Task</button>

        <select id="viewSelect" class="input" style="padding: 6px 10px;">
          <option value="active">Active</option>
          <option value="attention">Attention</option>
          <option value="done">Done</option>
        </select>

        <div style="flex: 1;"></div>
      </div>

      <div id="tasksListWrap" class="portal-table-wrap">
        <div class="loading">Loading tasks…</div>
      </div>
    </section>

    <style>
      /* === Portal Task Table Styling === */

      .portal-table-wrap table {
        width: 100%;
        border-collapse: collapse;
        background: #fff;
        border-radius: 12px;
        overflow: hidden;
        font-size: 14px;
      }

      .portal-table-wrap table thead {
        background: #f3f4f6;
        font-weight: 600;
      }

      .portal-table-wrap table th,
      .portal-table-wrap table td {
        padding: 10px 12px;
        border-bottom: 1px solid #e5e7eb;
        text-align: left;
        vertical-align: middle;
      }

      .portal-table-wrap table tr:last-child td {
        border-bottom: none;
      }

      /* Priority badges */
      .priority-1 {
        background: #fee2e2;
        color: #b91c1c;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
      }

      .priority-2 {
        background: #fef3c7;
        color: #92400e;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
      }

      /* Status badges */
      .status-todo {
        background: #e0e7ff;
        color: #3730a3;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
      }

      /* Due date badges */
      .due-overdue {
        background: #fee2e2;
        color: #b91c1c;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
      }

      .due-soon {
        background: #fef3c7;
        color: #92400e;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
      }

      /* Action buttons */
      .task-action-btn {
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        border: 1px solid #d1d5db;
        background: #f9fafb;
      }

      .task-action-btn:hover {
        background: #f3f4f6;
      }

      .loading {
        padding: 20px;
        color: #6b7280;
      }
    </style>
  `;

  const tasksWrap = document.getElementById("tasksListWrap");
  const viewSelect = document.getElementById("viewSelect");

  // === CONFIG (same as legacy) ===
  const WORKER_BASE = "https://gtr-task-add.dennis-e64.workers.dev";

  // === Determine cid from Portal ===
  const cid = portalState.selectedProjectId;

  if (!cid) {
    tasksWrap.innerHTML = `<p style="padding:20px;">No project selected.</p>`;
    return;
  }

  // === Admin mode (always true for you) ===
  const isAdmin = true;

  // === Build legacy URL ===
  function buildTasksUrl(view, cid, keepAdmin, embed = true) {
    const a = keepAdmin ? "&admin=1" : "";
    const e = embed ? "&embed=1" : "";
    return `${WORKER_BASE}/tasks?view=${encodeURIComponent(view)}&cid=${encodeURIComponent(cid)}${a}${e}`;
  }

  // === Load tasks HTML and inject only the table ===
  async function loadTasks() {
    const view = viewSelect.value || "active";
    const url = buildTasksUrl(view, cid, isAdmin, true);

    tasksWrap.innerHTML = `<div class="loading">Loading tasks…</div>`;

    try {
      const html = await fetch(url).then(r => r.text());

      // Create a temporary DOM to extract the table
      const temp = document.createElement("div");
      temp.innerHTML = html;

      // Find the table (your Worker always returns one)
      const table = temp.querySelector("table");

      if (!table) {
        tasksWrap.innerHTML = `<p style="padding:20px;">No tasks found.</p>`;
        return;
      }

      // Inject the table into the Portal
      tasksWrap.innerHTML = "";
      tasksWrap.appendChild(table);

      // Add Portal table class
      table.classList.add("portal-table");

    } catch (err) {
      console.error(err);
      tasksWrap.innerHTML = `<p style="padding:20px; color:red;">Error loading tasks.</p>`;
    }
  }

  // === Events ===
  viewSelect.addEventListener("change", loadTasks);

  // Initial load
  loadTasks();
}
