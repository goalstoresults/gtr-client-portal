// tab-add.js — Add Task (Workspace Style)

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

  /* =========================================================
     3) Build dropdown HTML
  ========================================================= */
  function buildOptions(field) {
    return getOptions(field)
      .map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.value)}</option>`)
      .join("");
  }

  const statusOptions = buildOptions("status");
  const priorityOptions = buildOptions("priority");
  const areaOptions = buildOptions("area");
  const whoOptions = buildOptions("who");
  const whoForOptions = buildOptions("who_is_this_for");

  /* =========================================================
     4) Render Add Form (Workspace Style)
  ========================================================= */
  content.innerHTML = `
    <form id="addTaskForm" class="workspace-form">

      <!-- Title -->
      <div class="form-row full">
        <label>Title</label>
        <input id="titleInput" placeholder="Task title">
      </div>

      <!-- Description -->
      <div class="form-row full">
        <label>Description</label>
        <textarea id="descriptionInput" placeholder="Task details"></textarea>
      </div>

      <!-- Status + Priority -->
      <div class="form-row">
        <div class="col">
          <label>Status</label>
          <select id="statusInput">${statusOptions}</select>
        </div>
        <div class="col">
          <label>Priority</label>
          <select id="priorityInput">${priorityOptions}</select>
        </div>
      </div>

      <!-- Area + Who -->
      <div class="form-row">
        <div class="col">
          <label>Area</label>
          <select id="areaInput">${areaOptions}</select>
        </div>
        <div class="col">
          <label>Who</label>
          <select id="whoInput">${whoOptions}</select>
        </div>
      </div>

      <!-- Who Is This For + Due Date -->
      <div class="form-row">
        <div class="col">
          <label>Who Is This For</label>
          <select id="whoForInput">${whoForOptions}</select>
        </div>
        <div class="col">
          <label>Due Date</label>
          <input id="dueDateInput" type="date">
        </div>
      </div>

      <!-- Notes -->
      <div class="form-row full">
        <label>Notes</label>
        <textarea id="notesInput" placeholder="Optional notes"></textarea>
      </div>

    </form>
  `;

  /* =========================================================
     5) Save Handler
  ========================================================= */
  const form = content.querySelector("#addTaskForm");

  saveBtn.addEventListener("click", async () => {
    const payload = {
      project: portalState.project,
      title: form.querySelector("#titleInput").value.trim(),
      description: form.querySelector("#descriptionInput").value.trim(),
      status: form.querySelector("#statusInput").value,
      priority: form.querySelector("#priorityInput").value,
      area: form.querySelector("#areaInput").value,
      who: form.querySelector("#whoInput").value,
      who_for: form.querySelector("#whoForInput").value,
      due_date: form.querySelector("#dueDateInput").value || null,
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
