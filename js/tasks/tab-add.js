// tab-add.js — Add Task (3-per-row workspace layout)

import { escapeHtml } from "../utilities.js";

export async function loadTasksAdd({ portalState, container }) {
  if (!portalState.project) {
    container.innerHTML = `
      <section class="card">
        <p>No project selected.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
        <h2 style="margin:0;">Add Task</h2>
        <button id="saveTaskBtn" class="btn-primary">Save</button>
      </div>
      <div id="taskAddContent">Loading…</div>
    </section>
  `;

  const content = container.querySelector("#taskAddContent");
  const saveBtn = container.querySelector("#saveTaskBtn");

  /* =========================================================
     1) Fetch lookup values
  ========================================================= */
  let lookups = [];
  try {
    const res = await fetch(
      `https://tasks-manager.dennis-e64.workers.dev/lookups/list?project=${encodeURIComponent(
        portalState.project
      )}`,
      { cache: "no-cache" }
    );
    lookups = await res.json();
    if (!Array.isArray(lookups)) lookups = [];
  } catch (err) {
    content.innerHTML = `<p>Error loading lookups.</p>`;
    return;
  }

  /* =========================================================
     2) Helper to get sorted active options for a field
  ========================================================= */
  function getOptions(field) {
    return lookups
      .filter(r => r.field === field && r.active)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  function buildOptions(field) {
    return getOptions(field)
      .map(
        o =>
          `<option value="${escapeHtml(o.value)}">${escapeHtml(
            o.value
          )}</option>`
      )
      .join("");
  }

  const statusOptions = buildOptions("status");
  const priorityOptions = buildOptions("priority");
  const areaOptions = buildOptions("area");
  const whoOptions = buildOptions("who");
  const whoForOptions = buildOptions("who_is_this_for");

  /* =========================================================
     3) Render Add Form — EXACT ROWS:
        Row 1: Title, Status, Priority
        Row 2: Area, Assigned, Who Is This For
        Row 3: Due Date, Follow-up Date
        Row 4: Notes (full width)
  ========================================================= */
  content.innerHTML = `
    <form id="addTaskForm" class="workspace-form" style="display:flex; flex-direction:column; gap:12px;">

      <!-- Row 1: Title, Status, Priority -->
      <div style="display:flex; gap:12px;">
        <div style="flex:1;">
          <label>Title</label>
          <input id="titleInput" placeholder="Task title">
        </div>
        <div style="flex:1;">
          <label>Status</label>
          <select id="statusInput">${statusOptions}</select>
        </div>
        <div style="flex:1;">
          <label>Priority</label>
          <select id="priorityInput">${priorityOptions}</select>
        </div>
      </div>

      <!-- Row 2: Area, Assigned, Who Is This For -->
      <div style="display:flex; gap:12px;">
        <div style="flex:1;">
          <label>Area</label>
          <select id="areaInput">${areaOptions}</select>
        </div>
        <div style="flex:1;">
          <label>Assigned</label>
          <select id="whoInput">${whoOptions}</select>
        </div>
        <div style="flex:1;">
          <label>Who Is This For</label>
          <select id="whoForInput">${whoForOptions}</select>
        </div>
      </div>

      <!-- Row 3: Due Date, Follow-up Date -->
      <div style="display:flex; gap:12px;">
        <div style="flex:1;">
          <label>Due Date</label>
          <input id="dueDateInput" type="date">
        </div>
        <div style="flex:1;">
          <label>Follow-up Date</label>
          <input id="followupDateInput" type="date">
        </div>
        <div style="flex:1;"></div>
      </div>

      <!-- Row 4: Notes (full width) -->
      <div style="display:flex; flex-direction:column;">
        <label>Notes</label>
        <textarea id="notesInput" placeholder="Optional notes"></textarea>
      </div>

    </form>
  `;

  /* =========================================================
     4) Save Handler
  ========================================================= */
  const form = content.querySelector("#addTaskForm");

  saveBtn.addEventListener("click", async () => {
    const payload = {
      project: portalState.project,
      title: form.querySelector("#titleInput").value.trim(),
      status: form.querySelector("#statusInput").value,
      priority: form.querySelector("#priorityInput").value,
      area: form.querySelector("#areaInput").value,
      who: form.querySelector("#whoInput").value,
      who_for: form.querySelector("#whoForInput").value,
      due_date: form.querySelector("#dueDateInput").value || null,
      followup_date: form.querySelector("#followupDateInput").value || null,
      notes: form.querySelector("#notesInput").value.trim() || null,
      created_at: new Date().toISOString()
    };

    if (!payload.title) {
      alert("Please enter a title.");
      return;
    }

    await fetch(
      "https://tasks-manager.dennis-e64.workers.dev/tasks/add",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    alert("Task added.");
    form.reset();
  });
}
