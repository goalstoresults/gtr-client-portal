// tab-edit.js — Reusable Edit Component (matches Add UI)

import { escapeHtml } from "../utilities.js";

export async function renderTaskEdit({ task, portalState, container }) {
  if (!task) {
    container.innerHTML = `<p>Error: No task provided.</p>`;
    return;
  }

  container.innerHTML = `<p>Loading…</p>`;

  /* =========================================================
     1) Fetch lookups
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
    container.innerHTML = `<p>Error loading lookups.</p>`;
    return;
  }

  /* =========================================================
     2) Fetch project staff (real users)
     WHERE project = portalState.project
  ========================================================= */
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
     Helper: Build lookup options
  ========================================================= */
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

  const statusOptions = buildOptions("status", task.status);
  const priorityOptions = buildOptions("priority", task.priority?.toString());
  const areaOptions = buildOptions("area", task.area);
  const whoForOptions = buildOptions("who_is_this_for", task.who_is_this_for);

  /* =========================================================
     Build Assigned dropdown (Users + Client + Other)
  ========================================================= */
  function buildAssignedOptions() {
    let html = "";

    // 1. Project staff users
    for (const u of projectStaff) {
      const name = getStaffDisplayName(u);
      const selected =
        task.assigned_to_user_id === u.id ? "selected" : "";
      html += `<option value="user:${escapeHtml(u.id)}" ${selected}>${escapeHtml(
        name
      )}</option>`;
    }

    // 2. Client
    if (portalState.project_contact_id) {
      const selected =
        task.assigned_to_contact_id === portalState.project_contact_id
          ? "selected"
          : "";
      html += `<option value="contact:${escapeHtml(
        portalState.project_contact_id
      )}" ${selected}>Client</option>`;
    }

    // 3. Other
    const otherSelected = task.who === "Other" ? "selected" : "";
    html += `<option value="other" ${otherSelected}>Other</option>`;

    return html;
  }

  const assignedOptions = buildAssignedOptions();

  /* =========================================================
     3) Render Edit Form (matches Add UI)
  ========================================================= */
  container.innerHTML = `
    <form class="workspace-form" style="display:flex; flex-direction:column; gap:12px;">

      <!-- Row 1 -->
      <div style="display:flex; gap:12px;">
        <div style="flex:0 0 50%;">
          <label>Title</label>
          <input class="edit-title" value="${escapeHtml(task.title || "")}" style="width:100%;">
        </div>
        <div style="flex:0 0 20%;">
          <label>Status</label>
          <select class="edit-status" style="width:100%;">${statusOptions}</select>
        </div>
        <div style="flex:0 0 20%;">
          <label>Priority</label>
          <select class="edit-priority" style="width:100%;">${priorityOptions}</select>
        </div>
      </div>

      <!-- Row 2 -->
      <div style="display:flex; gap:12px;">
        <div style="flex:0 0 30%;">
          <label>Area</label>
          <select class="edit-area" style="width:100%;">${areaOptions}</select>
        </div>
        <div style="flex:0 0 25%;">
          <label>Assigned</label>
          <select class="edit-assigned" style="width:100%;">
            <option value="">-- Select --</option>
            ${assignedOptions}
          </select>
        </div>
        <div style="flex:0 0 25%;">
          <label>Who Is This For</label>
          <select class="edit-whoFor" style="width:100%;">${whoForOptions}</select>
        </div>
      </div>

      <!-- Row 3 -->
      <div style="display:flex; gap:12px;">
        <div style="flex:0 0 30%;">
          <label>Due Date</label>
          <input type="date" class="edit-due" value="${task.due_date || ""}" style="width:100%;">
        </div>
        <div style="flex:0 0 30%;">
          <label>Follow-up Date</label>
          <input type="date" class="edit-follow" value="${task.followup_date || ""}" style="width:100%;">
        </div>
      </div>

      <!-- Notes -->
      <div style="display:flex; flex-direction:column;">
        <label>Notes</label>
        <textarea class="edit-notes" style="width:100%;">${escapeHtml(task.notes || "")}</textarea>
      </div>

      <div style="display:flex; gap:12px;">
        <button type="button" class="btn-primary edit-save">Save</button>
        <button type="button" class="btn-danger edit-delete">Delete</button>
      </div>

    </form>
  `;

  /* =========================================================
     4) Save Handler
  ========================================================= */
  container.querySelector(".edit-save").addEventListener("click", async () => {
    const title = container.querySelector(".edit-title").value.trim();
    const status = container.querySelector(".edit-status").value;
    const priority = container.querySelector(".edit-priority").value || null;
    const area = container.querySelector(".edit-area").value;
    const assignedVal = container.querySelector(".edit-assigned").value;
    const whoFor = container.querySelector(".edit-whoFor").value;
    const due = container.querySelector(".edit-due").value || null;
    const follow = container.querySelector(".edit-follow").value || null;
    const notes = container.querySelector(".edit-notes").value.trim();

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

    const payload = {
      id: task.id,
      project: portalState.project,
      title,
      status,
      priority,
      area,
      who,
      who_is_this_for: whoFor,
      assigned_to_user_id,
      assigned_to_contact_id,
      due_date: due,
      followup_date: follow,
      notes
    };

    await fetch("https://tasks-manager.dennis-e64.workers.dev/tasks/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    alert("Task updated.");
  });

  /* =========================================================
     5) Delete Handler
  ========================================================= */
  container.querySelector(".edit-delete").addEventListener("click", async () => {
    if (!confirm("Delete this task?")) return;

    await fetch("https://tasks-manager.dennis-e64.workers.dev/tasks/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id })
    });

    alert("Task deleted.");
  });
}
