// tab-add.js

/* =========================================================
   BACKEND INSERT: Add Task
========================================================= */
export async function addTask({ project, name, description, due_date }) {
  const res = await fetch(
    `https://tasks-manager.dennis-e64.workers.dev/tasks/add`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project,
        name,
        description,
        due_date
      })
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error("Task insert failed: " + text);
  }

  return await res.json();
}

/* =========================================================
   RENDER: Add Task Form
========================================================= */
export function loadTasksAdd({ portalState, container }) {
  container.innerHTML = `
    <section class="card">
      <h2>Add Task</h2>

      <div class="notes-row">
        <label class="notes-label">Task Name</label>
        <input id="taskName" class="form-control" required />
      </div>

      <div class="notes-row">
        <label class="notes-label">Description</label>
        <textarea id="taskDescription" class="form-control"></textarea>
      </div>

      <div class="notes-row">
        <label class="notes-label">Due Date</label>
        <input id="taskDueDate" class="form-control" type="date" />
      </div>

      <button id="btnSaveTask" class="btn-primary" style="margin-top:12px;">Save Task</button>

      <div id="taskAddMessage" style="margin-top:12px;"></div>
    </section>
  `;

  const btn = container.querySelector("#btnSaveTask");
  const msg = container.querySelector("#taskAddMessage");

  btn.addEventListener("click", async () => {
    const name = container.querySelector("#taskName").value.trim();
    const description = container.querySelector("#taskDescription").value.trim();
    const due_date = container.querySelector("#taskDueDate").value.trim();

    if (!name) {
      msg.innerHTML = `<p class="error">Task name is required.</p>`;
      return;
    }

    msg.innerHTML = "Saving…";

    try {
      await addTask({
        project: portalState.project,
        name,
        description,
        due_date: due_date || null
      });

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
