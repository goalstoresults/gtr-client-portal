// js/tasks.js
export async function loadTasksTab({ portalState, tabContent }) {
  tabContent.innerHTML = `
    <section class="card">
      <h2>Tasks</h2>

      <div style="margin-bottom: 12px; display:flex; gap:12px; align-items:center;">
        <a id="openFullTasks" class="btn" href="#" target="_blank" rel="noopener">Open Full</a>
        <div style="flex:1;"></div>
      </div>

      <iframe
        id="tasksFrame"
        src="about:blank"
        style="width:100%; height:72vh; border:1px solid #e5e7eb; border-radius:12px; background:#fff;">
      </iframe>
    </section>
  `;

  const WORKER_BASE = "https://gtr-task-add.dennis-e64.workers.dev";

  // 1) Try Portal project id
  let cid = portalState.selectedProjectId;

  // 2) Fallback to URL ?cid= like the old app
  if (!cid) {
    const url = new URL(window.location.href);
    cid = (url.searchParams.get("cid") || "").trim();
  }

  const frame = document.getElementById("tasksFrame");
  const openFull = document.getElementById("openFullTasks");

  if (!cid) {
    frame.srcdoc = `<p style="padding:20px;">No project selected (cid missing).</p>`;
    openFull.style.display = "none";
    return;
  }

  const isAdmin = true;

  function buildTasksUrl(view, cid, keepAdmin, embed = true) {
    const a = keepAdmin ? "&admin=1" : "";
    const e = embed ? "&embed=1" : "";
    return `${WORKER_BASE}/tasks?view=${encodeURIComponent(view)}&cid=${encodeURIComponent(cid)}${a}${e}`;
  }

  const src = buildTasksUrl("active", cid, isAdmin, true);
  frame.src = src;
  openFull.href = buildTasksUrl("active", cid, isAdmin, false);
}
