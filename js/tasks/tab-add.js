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
   RENDER: Add Task Form (text fields only for now)
========================================================= */
export function loadTasksAdd({ portalState, container }) {
  container.innerHTML = `
    <section class="card">
      <h2>Add Task</h2>

      <div class="notes-row">
        <label class="notes-label">Title</label>
        <input id="taskTitle" class="form-control" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Status</label>
        <input id="taskStatus" class="form-control" placeholder="To-Do" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Priority</label>
        <input id="taskPriority" class="form-control" placeholder="P2" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Area</label>
        <input id="taskArea" class="form-control" placeholder="Select" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Who</label>
        <input id="taskWho" class="form-control" placeholder="Select" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Who is this for?</label>
        <input id="taskWhoFor" class="form-control" placeholder="Select" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Due Date</label>
        <input id="taskDueDate" class="form-control" type="date" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Follow-up Date</label>
        <input id="taskFollowUpDate" class="form-control" type="date" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Project/Client</label>
        <input id="taskProjectClient" class="form-control" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Notes</label>
        <textarea id="taskNotes" class="form-control" placeholder="Optional details"></textarea>
      </div>

      <button id="btnAddTask" class="btn-primary" style="margin-top:16px;">Add Task</button>
      <div id="taskAddMessage" style="margin-top:12px;"></div>
    </section>
  `;

  const msg = container.querySelector("#taskAddMessage");

  container.querySelector("#btnAddTask").addEventListener("click", async () => {
    const payload = {
      project: portalState.project,
      title: container.querySelector("#taskTitle").value.trim(),
      status: container.querySelector("#taskStatus").value.trim(),
      priority: container.querySelector("#taskPriority").value.trim(),
      area: container.querySelector("#taskArea").value.trim(),
      who: container.querySelector("#taskWho").value.trim(),
      who_for: container.querySelector("#taskWhoFor").value.trim(),
      due_date: container.querySelector("#taskDueDate").value || null,
      follow_up_date: container.querySelector("#taskFollowUpDate").value || null,
      project_client: container.querySelector("#taskProjectClient").value.trim(),
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
