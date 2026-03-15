// tab-edit.js — Add/Edit Task Component

import { escapeHtml, formatDateOnly } from "../utilities.js";

export function renderTaskEdit({ task, portalState, container }) {
  container.innerHTML = `
    <div class="task-edit">
      <h4>${task ? "Edit Task" : "Add Task"}</h4>

      <div class="form-row">
        <label>Title</label>
        <input id="eTitle" type="text" value="${escapeHtml(task?.title || "")}">
      </div>

      <div class="form-row">
        <label>For</label>
        <select id="eFor">
          <option value="">-- Select --</option>
          ${(portalState.lookups?.who_is_this_for || [])
            .map(o => `<option value="${escapeHtml(o.value)}" ${task?.who_is_this_for === o.value ? "selected" : ""}>${escapeHtml(o.value)}</option>`)
            .join("")}
        </select>
      </div>

      <div class="form-row">
        <label>Assigned To</label>
        <select id="eAssigned">
          <option value="">-- Select --</option>

          <!-- Users -->
          ${(portalState.projectStaff || [])
            .map(u => {
              const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.staff_name || u.staff_email;
              const selected =
                task?.assigned_to_user_id === u.id ? "selected" : "";
              return `<option value="user:${escapeHtml(u.id)}" ${selected}>${escapeHtml(name)}</option>`;
            })
            .join("")}

          <!-- Client -->
          ${
            portalState.project_contact_id
              ? `<option value="contact:${escapeHtml(
                  portalState.project_contact_id
                )}" ${
                  task?.assigned_to_contact_id === portalState.project_contact_id
                    ? "selected"
                    : ""
                }>Client</option>`
              : ""
          }

          <!-- Other -->
          <option value="other" ${task?.who === "Other" ? "selected" : ""}>Other</option>
        </select>
      </div>

      <div class="form-row">
        <label>Area</label>
        <select id="eArea">
          <option value="">-- Select --</option>
          ${(portalState.lookups?.area || [])
            .map(o => `<option value="${escapeHtml(o.value)}" ${task?.area === o.value ? "selected" : ""}>${escapeHtml(o.value)}</option>`)
            .join("")}
        </select>
      </div>

      <div class="form-row">
        <label>Priority</label>
        <select id="ePriority">
          <option value="">-- Select --</option>
          ${(portalState.lookups?.priority || [])
            .map(o => `<option value="${escapeHtml(o.value)}" ${String(task?.priority) === String(o.value) ? "selected" : ""}>${escapeHtml(o.value)}</option>`)
            .join("")}
        </select>
      </div>

      <div class="form-row">
        <label>Status</label>
        <select id="eStatus">
          <option value="">-- Select --</option>
          ${(portalState.lookups?.status || [])
            .map(o => `<option value="${escapeHtml(o.value)}" ${task?.status === o.value ? "selected" : ""}>${escapeHtml(o.value)}</option>`)
            .join("")}
        </select>
      </div>

      <div class="form-row">
        <label>Due Date</label>
        <input id="eDue" type="date" value="${task?.due_date || ""}">
      </div>

      <div class="form-row">
        <label>Follow-up Date</label>
        <input id="eFollow" type="date" value="${task?.followup_date || ""}">
      </div>

      <div class="form-row">
        <label>Notes</label>
        <textarea id="eNotes" rows="4">${escapeHtml(task?.notes || "")}</textarea>
      </div>

      <div style="margin-top:12px; display:flex; gap:8px;">
        <button id="eSave" class="btn-primary">${task ? "Save" : "Add"}</button>
        <button id="eCancel" class="btn-secondary">Cancel</button>
      </div>
    </div>
  `;

  /* ---------------------------------------------------------
     SAVE / ADD HANDLER
  --------------------------------------------------------- */
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

    const url = task
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

    /* ---------------------------------------------------------
       REFRESH LIST VIEW
    --------------------------------------------------------- */
    if (portalState.refreshTasks) {
      await portalState.refreshTasks();
    }

    /* ---------------------------------------------------------
       COLLAPSE EDIT PANEL
    --------------------------------------------------------- */
    if (task?.id) {
      const row = document.getElementById(`expand-${task.id}`);
      if (row) row.style.display = "none";
    }
  });

  /* ---------------------------------------------------------
     CANCEL HANDLER
  --------------------------------------------------------- */
  container.querySelector("#eCancel").addEventListener("click", () => {
    if (task?.id) {
      const row = document.getElementById(`expand-${task.id}`);
      if (row) row.style.display = "none";
    }
    container.innerHTML = "";
  });
}
