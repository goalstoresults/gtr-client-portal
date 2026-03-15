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
     1b) Fetch project staff (real users)
     WHERE project = portalState.project
  ========================================================= */
  let projectStaff = [];
  try {
    const res = await fetch(
      `${portalState.supabaseUrl}/rest/v1/projects_staff?project=eq.${encodeURIComponent(
        portalState.project
      )}&select=id,first_name,last_name,staff_name,staff_email`,
      {
        headers: {
          apikey: portalState.supabaseAnonKey,
          Authorization: `Bearer ${portalState.supabaseAnonKey}`
        }
      }
    );
    projectStaff = await res.json();
    if (!Array.isArray(projectStaff)) projectStaff = [];
  } catch (err) {
    console.error("Error loading project staff", err);
  }

  /* =========================================================
     Helper: Resolve staff display name
  ========================================================= */
  function getStaffDisplayName(row) {
    if (row.first_name || row.last_name) {
      return `${row.first_name || ""} ${row.last_name || ""}`.trim();
    }
    if (row.staff_name) return row.staff_name;
    return row.staff_email;
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
  const whoForOptions = buildOptions("who_is_this_for");

  /* =========================================================
     Build Assigned dropdown (Users + Client + Other)
  ========================================================= */
  function buildAssignedOptions() {
    let html = "";

    // 1. Project staff users
    for (const u of projectStaff) {
      const name = getStaffDisplayName(u);
      html += `<option value="user:${escapeHtml(u.id)}">${escapeHtml(
        name
      )}</option>`;
    }

    // 2. Client (contact)
    if (portalState.project_contact_id) {
      html += `<option value="contact:${escapeHtml(
        portalState.project_contact_id
      )}">Client</option>`;
    }

    // 3. Other
    html += `<option value="other">Other</option>`;

    return html;
  }

  const assignedOptions = buildAssignedOptions();

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
          <select id="assignedInput" style="width:100%;">
            <option value="">-- Select --</option>
            ${assignedOptions}
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
    const assignedVal = form.querySelector("#assignedInput").value;
    const whoForVal = form.querySelector("#whoForInput").value;
    const dueDateVal = form.querySelector("#dueDateInput").value;
    const followupDateVal = form.querySelector("#followupDateInput").value;
    const notesVal = form.querySelector("#notesInput").value.trim();

    // ⭐ Interpret Assigned selection
    let assigned_to_user_id = null;
    let assigned_to_contact_id = null;
    let who = "";

    if (assignedVal.startsWith("user:")) {
      assigned_to_user_id = assignedVal.replace("user:", "");
    } else if (assignedVal.startsWith("contact:")) {
      assigned_to_contact_id = assignedVal.replace("contact:", "");
    } else if (assignedVal === "other") {
      who = "Other";
    }

    // ⭐ SAFE PAYLOAD
