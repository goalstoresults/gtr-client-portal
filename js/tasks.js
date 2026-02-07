// /tasks/tasks.js
// Phase 1: Wrap the legacy Task Manager inside the Portal

export async function renderTasksTab(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h3>Tasks</h3>
      <div id="tasksFrameWrap" style="margin-top:16px;">
        <iframe id="tasksFrame"
          src="about:blank"
          style="width:100%; height:72vh; border:1px solid #e5e7eb; border-radius:12px; background:#fff;">
        </iframe>
      </div>
    </section>
  `;

  const frame = document.getElementById("tasksFrame");

  // === CONFIG (copied from legacy index.html) ===
  const GTR_ID = "hezFHREjxhfwcOdxYOcc";
  const WORKER_BASE = "https://gtr-task-add.dennis-e64.workers.dev";

  // === Determine cid ===
  // Option A: Use the Portal project ID
  let cid = portalState.selectedProjectId;

  // ⭐ Option B: Fallback to URL ?cid= (this fixes your issue)
  if (!cid) {
    const url = new URL(window.location.href);
    cid = (url.searchParams.get("cid") || "").trim();
  }

  if (!cid) {
    frame.srcdoc = `<p style="padding:20px;">No project selected.</p>`;
    return;
  }

  // === Determine admin mode ===
  const isAdmin = true; // You can refine this later

  // === Build the legacy URL ===
  function buildTasksUrl(view, cid, keepAdmin, embed = false) {
    const a = keepAdmin ? "&admin=1" : "";
    const e = embed ? "&embed=1" : "";
    return `${WORKER_BASE}/tasks?view=${encodeURIComponent(view)}&cid=${encodeURIComponent(cid)}${a}${e}`;
  }

  // Default view = active
  const src = buildTasksUrl("active", cid, isAdmin, true);

  // Load the legacy Task Manager
  frame.src = src;
}
