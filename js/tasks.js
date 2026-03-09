// js/tasks.js — Phase 1: full iframe, hard-coded cid

export async function loadTasksTab({ portalState, tabContent }) {
  tabContent.innerHTML = `
    <section class="card">
      <h2>Tasks</h2>

      <iframe
        id="tasksFrame"
        src="https://gtr-task-manager.pages.dev/?cid=hezFHREjxhfwcOdxYOcc"
        style="width:100%; height:80vh; border:1px solid #e5e7eb; border-radius:12px; background:#fff;">
      </iframe>
    </section>
  `;
}
