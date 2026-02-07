// js/tasks.js
// Phase 1: full iframe of legacy Task Manager (safe, minimal, working)

export async function loadTasksTab({ portalState, tabContent }) {
  tabContent.innerHTML = `
    <section class="card">
      <h2>Tasks</h2>

      <iframe
        id="tasksFrame"
        src="about:blank"
        style="width:100%; height:80vh; border:1px solid #e5e7eb; border-radius:12px; background:#fff;">
      </iframe>
    </section>
  `;

  const frame = document.getElementById("tasksFrame");

  const LEGACY_URL = "https://gtr-task-add.dennis-e64.workers.dev";

  // 1) Try Portal project id
  let cid = portalState?.selectedProjectId;

  // 2) Fallback to URL ?cid= like the old app
  if (!cid) {
    try {
      const url = new URL(window.location.href);
      cid = (url.searchParams.get("cid") || "").trim();
    } catch (e) {
      // if URL constructor fails for any reason, just leave cid as-is
    }
  }

  if (!cid) {
    frame.srcdoc = `<p style="padding:20px;">No project selected (cid missing).</p>`;
    return;
  }

  const fullUrl = `${LEGACY_URL}/?cid=${encodeURIComponent(cid)}&admin=1`;
  frame.src = fullUrl;
}
