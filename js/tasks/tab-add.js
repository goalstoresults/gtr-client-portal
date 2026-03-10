// tab-add.js — Add Task (3-per-row workspace layout, wide Title)

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
     3) Render Add Form
  ========================================================= */
  content.innerHTML = `
    <form id="addTaskForm" class="workspace-form" style="display:flex; flex-direction:column; gap:12px;">

      <!-- Row 1: Title (wide), Status, Priority -->
      <div style="display:flex; gap:12px;">
        <div style="flex:0 0 50%;">
          <label>Title</label>
          <input id="titleInput" placeholder="Task title" style="width:100%;">
        </div>
        <div style="flex:0 0 20%;">
          <label>Status</label>
          <select id="statusInput" style="width:100%;">
            <option value="">-- Select --</option>
            ${statusOptions}
          </select>
        </div>
        <div style="flex:0 0 20%;">
          <label>Priority</label>
          <select id="priorityInput" style="width:100%;">
            <option value="">-- Select --</option>
            ${priorityOptions}
          </select>
        </div>
      </div>

      <!-- Row 2: Area, Assigned, Who Is This For -->
      <div style="display:flex; gap:12px;">
        <div style="flex:0 0 30%;">
          <label>Area</label>
          <select id="areaInput" style="width:100%;">
            <option value="">-- Select --</option>
            ${areaOptions}
          </select>
        </div>
        <div style="flex:0 0 25%;">
          <label>Assigned</label>
          <select id="whoInput" style="width:100%;">
            <option value="">-- Select --</option>
            ${whoOptions}
          </select>
        </div>
        <div style="flex:0 0 25%;">
          <label>Who Is This For</label>
          <select id="whoForInput" style="width:100%;">
            <option value="">-- Select --</option>
            ${whoForOptions}
          </select>
        </div>
      </div>

      <!-- Row 3: Due Date, Follow-up Date -->
      <div style="display:flex; gap:12px;">
        <div style="flex:0 0 30%;">
          <label>Due Date</label>
          <input id="dueDateInput" type="date" style="width:100%;">
        </div>
        <div style="flex:0 0 30%;">
          <label>Follow-up Date</label>
          <input id="followupDateInput" type="date" style="width:100%;">
        </div>
        <div style="flex:1;"></div>
      </div>

      <!-- Row 4: Notes (full width) -->
      <div style="display:flex; flex-direction:column;">
        <label>Notes</label>
        <textarea id="notesInput" placeholder="Optional notes" style="width:100%;"></textarea>
      </div>

    </form>
  `;

  /* =========================================================
     4) Save Handler — frontend validation + safe payload
  ========================================================= */
  const form = content.querySelector("#addTaskForm");

  saveBtn.addEventListener("click", async () => {

    // ⭐ FRONTEND VALIDATION
    const titleVal = form.querySelector("#titleInput").value.trim();
    if (!titleVal) {
      alert("Please enter a title.");
      return;
    }

    // Grab values
    const statusVal = form.querySelector("#statusInput").value;
    const priorityVal = form.querySelector("#priorityInput").value;
    const areaVal = form.querySelector("#areaInput").value;
    const whoVal = form.querySelector("#whoInput").value;
    const whoForVal = form.querySelector("#whoForInput").value;
    const dueDateVal = form.querySelector("#dueDateInput").value;
    const followupDateVal = form.querySelector("#followupDateInput").value;
    const notesVal = form.querySelector("#notesInput").value.trim();

    // ⭐ SAFE PAYLOAD (string dates, numeric priority)
    const payload = {
      project: portalState.project,
      created_by_user_id: portalState.user_id,

      title: titleVal,
      status: statusVal,
      priority: priorityVal ? Number(priorityVal) : null,

      area: areaVal || "",
      who: whoVal || "",
      who_is_this_for: whoForVal || "",

      due_date: dueDateVal || null,          // <-- STRING, no UTC
      followup_date: followupDateVal || null, // <-- STRING, no UTC
      notes: notesVal || null,

      created_at: new Date().toISOString()
    };

    await fetch(
      "https://tasks-manager.dennis-e64.workers.dev/tasks/add",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    alert("Task added.");

    // Reset form
    form.reset();
  });
}
