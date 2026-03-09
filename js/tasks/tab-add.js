// tab-add.js

/* =========================================================
   BACKEND INSERT: Add Task
========================================================= */
export async function addTask(payload) {
  const res = await fetch(
    `https://tasks-manager.dennis-e64.workers.dev/tasks/add`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Task insert failed");
  }

  return data;
}

/* =========================================================
   RENDER: Add Task Form (2-column layout)
========================================================= */
export function loadTasksAdd({ portalState, container }) {
  container.innerHTML = `
    <section class="card">
      <h2>Add Task</h2>

      <!-- Title (full width) -->
      <div class="notes-row">
        <label class="notes-label">Title</label>
        <input id="taskTitle" class="form-control" />
      </div>

      <!-- Status + Priority -->
      <div class="two-col">
        <div class="notes-row">
          <label class="notes-label">Status</label>
          <input id="taskStatus" class="form-control" placeholder="todo" />
        </div>

        <div class="notes-row">
          <label class="notes-label">Priority</label>
          <input id="taskPriority" class="form-control" placeholder="2" />
        </div>
      </div>

      <!-- Area + Who -->
      <div class="two-col">
        <div class="notes-row">
          <label class="notes-label">Area</label>
          <input id="taskArea" class="form-control" />
        </div>

        <div class="notes-row">
          <label class="notes-label">Who</label>
          <input id="taskWho" class="form-control" />
        </div>
      </div>

      <!-- Who is this for + Project -->
      <div class="two-col">
        <div class="notes-row">
          <label class="notes-label">Who is this for?</label>
          <input id="taskWhoFor" class="form-control" />
        </div>

        <div class="notes-row">
          <label class="notes-label">Project</label>
          <input id="taskProject" class="form-control" />
        </div>
      </div>

      <!-- Due Date + Follow-up Date -->
      <div class="two-col">
        <div class="notes-row">
          <label class="notes-label">Due Date</label>
          <input id="taskDueDate" class="form-control" type="date" />
        </div>

        <div class="notes-row">
          <label class="notes-label">Follow-up Date</label>
          <input id="taskFollowUpDate" class="form-control" type="date" />
        </div>
      </div>

      <!-- Notes (full width) -->
      <div class="notes-row">
        <label class="notes-label">Notes</label>
        <textarea id="taskNotes" class="form-control" placeholder="Optional details"></textarea>
      </div>

      <!-- Primary Button Only -->
      <div style="margin-top:16px;">
        <button id="btnAddTask" class="btn-primary">Add Task</button>
      </div>

      <div id="taskAddMessage" style="margin-top:12px;"></div>
    </section>

    <style>
      .two-col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
    </style>
  `;

  const msg = container.querySelector("#taskAddMessage");

  container.querySelector("#btnAddTask").addEventListener("click", async () => {
    const payload = {
      project: portalState.project,
      created_by_user_id: portalState.user_id,   // REQUIRED

      title: container.querySelector("#taskTitle").value.trim(),
      status: container.querySelector("#taskStatus").value.trim(),
      priority: parseInt(container.querySelector("#taskPriority").value.trim()) || 2,

      area: container.querySelector("#taskArea").value.trim(),
      who: container.querySelector("#taskWho").value.trim(),
      who_is_this_for: container.querySelector("#taskWhoFor").value.trim(),

      due_date: container.querySelector("#taskDueDate").value || null,
      followup_date: container.querySelector("#taskFollowUpDate").value || null,

      project: container.querySelector("#taskProject").value.trim(),
      notes: container.querySelector("#taskNotes").value.trim()
    };

    if (!payload.title) {
      msg.innerHTML = `<p class="error">Title is required.</p>`;
      return;
    }

    msg.innerHTML = "Saving…";

    try {
      await addTask(payload);
      msg.innerHTML = `<p class="success">Task added!</p>`;

      // Auto-switch to List
      const listBtn = document.querySelector('#tasks-subtabs button[data-subtab="list"]');
      if (listBtn) listBtn.click();

    } catch (err) {
      console.error(err);
      msg.innerHTML = `<p class="error">Failed to add task.</p>`;
    }
  });
}
