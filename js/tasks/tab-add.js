// tab-add.js — Add Task

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
      <h2>Add Task</h2>
      <div id="taskAddContent">Loading…</div>
    </section>
  `;

  const content = container.querySelector("#taskAddContent");

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
  const statusOptions = getOptions("status")
    .map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.value)}</option>`)
    .join("");

  const priorityOptions = getOptions("priority")
    .map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.value)}</option>`)
    .join("");

  const areaOptions = getOptions("area")
    .map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.value)}</option>`)
    .join("");

  const whoOptions = getOptions("who")
    .map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.value)}</option>`)
    .join("");

  const whoForOptions = getOptions("who_is_this_for")
    .map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.value)}</option>`)
    .join("");

  /* =========================================================
     4) Render Add Form
  ========================================================= */
  content.innerHTML = `
    <form id="addTaskForm" class="form-grid">

      <label>Title</label>
      <input id="titleInput" placeholder="Task title">

      <label>Description</label>
      <textarea id="descriptionInput" placeholder="Task details"></textarea>

      <label>Status</label>
      <select id="statusInput">${statusOptions}</select>

      <label>Priority</label>
      <select id="priorityInput">${priorityOptions}</select>

      <label>Area</label>
      <select id="areaInput">${areaOptions}</select>

      <label>Who</label>
      <select id="whoInput">${whoOptions}</select>

      <label>Who Is This For</label>
      <select id="whoForInput">${whoForOptions}</select>

      <label>Due Date</label>
      <input id="dueDateInput" type="date">

      <button id="saveTaskBtn" class="btn-primary" style="margin-top:16px;">Save Task</button>
    </form>
  `;

  /* =========================================================
     5) Save Handler
  ========================================================= */
  const form = content.querySelector("#addTaskForm");
  const saveBtn = content.querySelector("#saveTaskBtn");

  saveBtn.addEventListener("click", async e => {
    e.preventDefault();

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
