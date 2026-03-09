// tab-edit.js
export function loadTasksEdit({ portalState, container, taskId }) {
  container.innerHTML = `
    <div class="card">
      <h3>Edit Task</h3>
      <p>Edit placeholder for task ID: ${taskId || "(none)"}</p>
    </div>
  `;
}
