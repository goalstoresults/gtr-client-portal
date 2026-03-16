// tab-edit.js — Restored Original Layout (multi‑column workspace style)

import { escapeHtml } from "../utilities.js";

export function renderTaskEdit({ task, portalState, container }) {
  const isEdit = !!task;

  // Build dropdown options
  const statusOptions = (portalState.lookups?.status || [])
    .map(o => `<option value="${escapeHtml(o.value)}" ${task?.status === o.value ? "selected" : ""}>${escapeHtml(o.value)}</option>`)
    .join("");

  const priorityOptions = (portalState.lookups?.priority || [])
    .map(o => `<option value="${escapeHtml(o.value)}" ${String(task?.priority) === String(o.value) ? "selected" : ""}>${escapeHtml(o.value)}</option>`)
    .join("");

  const areaOptions = (portalState.lookups?.area || [])
    .map(o => `<option value="${escapeHtml(o.value)}" ${task?.area === o.value ? "selected" : ""}>${escapeHtml(o.value)}</option>`)
    .join("");

  const whoForOptions = (portalState.lookups?.who_is_this_for || [])
    .map(o => `<option value="${escapeHtml(o.value)}" ${task?.who_is_this_for === o.value ? "selected" : ""}>${escapeHtml(o.value)}</option>`)
    .join("");

  const assignedOptions = [
    ...(portalState.projectStaff || []).map(u => {
      const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.staff_name || u.staff_email;
      const selected = task?.assigned_to_user_id === u.id ? "selected" : "";
      return `<option value="user:${escapeHtml(u.id)}" ${selected}>${escapeHtml(name)}</option>`;
    }),
    portalState.project_contact_id
      ? `<option value="contact:${escapeHtml(portalState.project_contact_id)}" ${
          task?.assigned_to_contact_id === portalState.project_contact_id ? "selected" : ""
        }>Client</option>`
      : "",
    `<option value="other" ${task?.who === "Other" ? "selected" : ""}>Other</option>`
  ].join("");

  container.innerHTML = `
    <form class="workspace-form" style="display:flex; flex-direction:column; gap:12px;">

      <!-- Row 1 -->
      <div style="display:flex; gap:12px;">
        <div style="flex:0 0 50%;">
          <label>Title</label>
          <input id="eTitle" value="${escapeHtml(task?.title || "")}" style="width:100%;">
        </div>

        <div style="flex:0 0 20%;">
          <label>Status</label>
          <select id="eStatus" style="width:100%;">${statusOptions}</select>
        </div>

        <div style="flex:0 0 20%;">
          <label>Priority</label>
          <select id="ePriority" style="width:100%;">${priorityOptions}</select>
        </div>
      </div>

      <!-- Row 2 -->
      <div style="display:flex; gap:12px;">
        <div style="flex:0 0 30%;">
          <label>Area</label>
          <select id="eArea" style="width:100%;">${areaOptions}</select>
        </div>

        <div style="flex:0 0 25%;">
          <label>Assigned</label>
          <select id="eAssigned" style="width:100%;">
            <option value="">-- Select --</option>
            ${assignedOptions}
          </select>
        </div>

        <div style="flex:0 0 25%;">
          <label>Who Is This For</label>
          <select id="eFor" style="width:100%;">${whoForOptions}</select>
        </div>
      </div>

      <!-- Row 3 -->
      <div style="display:flex; gap:12px;">
        <div style="flex:0 0 30%;">
          <label>Due Date</label>
          <input type="date" id="eDue" value="${task?.due_date || ""}" style="width:100%;">
        </div>

        <div style="flex:0 0 30%;">
          <label>Follow-up Date</label>
          <input type="date" id="eFollow" value="${task?.followup_date || ""}" style="width:100%;">
        </div>
      </div>

      <!-- Notes -->
      <div style="display:flex; flex-direction:column;">
        <label>Notes</label>
        <textarea 
          id="eNotes" 
          style="width:100%; height:160px;"
        >${escapeHtml(task?.notes || "")}</textarea>
      </div>

      <div style="display:flex; gap:12px;">
        <button type="button" id="eSave" class="btn-primary">${isEdit ? "Save" : "Add"}</button>
        <button type="button" id="eCancel" class="btn-secondary">Cancel</button>
      </div>

    </form>
  `;

  // SAVE HANDLER
  container.querySelector("#eSave").addEventListener("click", async () => {
    const title = container.querySelector("#eTitle").value.trim();
    if (!title) {
      alert("Title is required.");
      return;
    }

    const assignedVal = container.querySelector("#eAssigned").value;
    let assigned_to_user_id = "";
    let assigned_to_contact_id = "";
    let who = "";

    if (assignedVal.startsWith("user:")) {
      assigned_to_user_id = assignedVal.replace("user:", "");
    } else if (assignedVal.startsWith("contact:")) {
      assigned_to_contact_id = assignedVal.replace("contact:", "");
    } else if (assignedVal === "other") {
      who = "Other";
    }

    const payload = {
      id: task?.id || undefined,
      project: portalState.project,
      title,
      who_is_this_for: container.querySelector("#eFor").value || "",
      assigned_to_user_id,
      assigned_to_contact_id,
      who,
      area: container.querySelector("#eArea").value || "",
      priority: container.querySelector("#ePriority").value || "",
      status: container.querySelector("#eStatus").value || "",
      due_date: container.querySelector("#eDue").value || "",
      followup_date: container.querySelector("#eFollow").value || "",
      notes: container.querySelector("#eNotes").value || ""
    };

    const url = isEdit
      ? "https://tasks-manager.dennis-e64.workers.dev/tasks/update"
      : "https://tasks-manager.dennis-e64.workers.dev/tasks/add";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      alert("Error saving task.");
      return;
    }

    alert("Task saved.");

    if (portalState.refreshTasks) {
      await portalState.refreshTasks();
    }

    if (task?.id) {
      const row = document.getElementById(`expand-${task.id}`);
      if (row) row.style.display = "none";
    }
  });

  // CANCEL HANDLER
  container.querySelector("#eCancel").addEventListener("click", () => {
    if (task?.id) {
      const row = document.getElementById(`expand-${task.id}`);
      if (row) row.style.display = "none";
    }
    container.innerHTML = "";
  });
}
