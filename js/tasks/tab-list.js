// tab-list.js — Tasks List (Financials-style sorting + table UI)

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
     1) Fetch tasks
  --------------------------------------------------------- */
  let tasks = [];
  try {
    const res = await fetch(
      `https://tasks-manager.dennis-e64.workers.dev/tasks/list?project=${encodeURIComponent(portalState.project)}`,
      { cache: "no-cache" }
    );
    const j = await res.json();
    tasks = Array.isArray(j) ? j : [];
  } catch {
    tasks = [];
  }

  /* ---------------------------------------------------------
     Sorting state
  --------------------------------------------------------- */
  let currentSortField = "due_date";
  let currentSortDirection = "asc";

  const columns = [
    { key: "description", label: "Title" },
    { key: "contact_id", label: "For" },
    { key: "assigned_to", label: "Who" },
    { key: "status", label: "Status" },
    { key: "due_in", label: "Due In", numeric: true },
    { key: "due_date", label: "Due Date", isDate: true },
    { key: "actions", label: "Actions" }
  ];

  /* ---------------------------------------------------------
     Precompute due_in
  --------------------------------------------------------- */
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

    /* ---------- HEADER ---------- */
    const headerHtml = columns
      .map(col => {
        const isSorted = currentSortField === col.key;
        const upArrow = isSorted && currentSortDirection === "asc" ? "▲" : "△";
        const downArrow = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

        return `
          <th class="${col.key !== 'actions' ? 'sortable' : ''}" data-field="${col.key}">
            ${escapeHtml(col.label)}
            ${col.key !== 'actions' ? `
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">${upArrow}</span>
                <span class="sort-down">${downArrow}</span>
              </span>` : ""}
          </th>
        `;
      })
      .join("");

    /* ---------- ROWS ---------- */
    const rowsHtml = tasks
      .map(t => `
        <tr>
          <td>${escapeHtml(t.description || "")}</td>
          <td>${escapeHtml(t.contact_id || "")}</td>
          <td>${escapeHtml(t.assigned_to || "")}</td>
          <td>${escapeHtml(t.status || "")}</td>
          <td>${t.due_in === null ? "—" : t.due_in + "d"}</td>
          <td>${formatDateOnly(t.due_date)}</td>
          <td>
            <button class="btn-secondary" disabled>Edit</button>
            <button class="btn-danger" disabled>Delete</button>
          </td>
        </tr>
      `)
      .join("");

    /* ---------- FINAL HTML ---------- */
    listEl.innerHTML = `
      <table class="notes-table">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="7">(no tasks found)</td></tr>`}
        </tbody>
      </table>
    `;

    /* ---------- SORT EVENTS ---------- */
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
  }

  renderTable();
}
