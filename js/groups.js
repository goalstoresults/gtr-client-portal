// js/groups.js v2.0
console.log("[Groups.js] loaded");

export async function loadGroupsTab({ portalState, tabContent }) {
  // Base HTML template for Groups tab
  tabContent.innerHTML = `
    <section class="card">
      <h2>Groups</h2>
      <nav id="groups-subtabs" class="subtabs" style="margin-bottom:12px;">
        <button data-subtab="add">Add</button>
        <button data-subtab="list">List</button>
        <button data-subtab="details">Details</button>
        <button data-subtab="members">Members</button>
        <button data-subtab="roi">ROI</button>
      </nav>
      <div id="groupsContent"></div>
    </section>
  `;

  const content = tabContent.querySelector("#groupsContent");
  const buttons = tabContent.querySelectorAll("#groups-subtabs button");

  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;
      switch (subtab) {
        case "add":
          content.innerHTML = `<section class="card"><p>(Add Group form placeholder)</p></section>`;
          break;

        case "list":
          await renderGroupList(content, portalState);
          break;

        case "details":
          content.innerHTML = `<section class="card"><p>Select a group to view details.</p></section>`;
          break;

        case "members":
          content.innerHTML = `<section class="card"><p>(Members view placeholder)</p></section>`;
          break;

        case "roi":
          content.innerHTML = `<section class="card"><p>(ROI metrics placeholder)</p></section>`;
          break;

        default:
          content.innerHTML = `<section class="card"><p>Select a subtab to begin.</p></section>`;
      }
    });
  });

  // ✅ Default to List view
  const defaultBtn = tabContent.querySelector('#groups-subtabs button[data-subtab="list"]');
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    await renderGroupList(content, portalState);
  }
}

// 🔧 Group List with filters, search, sort
async function renderGroupList(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h2>Groups for ${escapeHtml(portalState.display_name || portalState.project)}</h2>
      <div id="groupsFilters" style="margin-bottom:12px;">
        <label>Name: <input type="text" id="filter-group-name" /></label>
        <label style="margin-left:12px;">From: <input type="date" id="filter-from" /></label>
        <label style="margin-left:12px;">To: <input type="date" id="filter-to" /></label>
        <button id="btnApplyGroupsFilter" class="btn-secondary" style="margin-left:12px;">Apply Filter</button>
        <button id="btnClearGroupsFilter" class="btn-secondary" style="margin-left:12px;">Clear Filter</button>
      </div>
      <div id="groupTable">Loading...</div>
    </section>
  `;

  const tableDiv = container.querySelector("#groupTable");

  const name = document.getElementById("filter-group-name")?.value.trim();
  const from = document.getElementById("filter-from")?.value;
  const to   = document.getElementById("filter-to")?.value;

  const hasFilters = name || from || to;
  const limit = hasFilters ? 500 : 100;

  // ✅ Build params cleanly
  const params = new URLSearchParams({
    project: portalState.project,
    order: "created_at.desc",
    limit: limit.toString()
  });
  if (name) params.set("group_name", name);
  if (from) params.set("from", from);
  if (to)   params.set("to", to);

  const url = `https://groups-module.dennis-e64.workers.dev/groups/list?${params}`;
  console.log("[Groups] Fetching:", url);

  const res = await fetch(url);
  const groups = await res.json();

  tableDiv.innerHTML = `
    <h4>Showing ${Array.isArray(groups) ? groups.length : 0} ${hasFilters ? "filtered" : "recent"} groups</h4>
    <table class="notes-table">
      <thead><tr><th>Name</th><th>Total Amount</th><th>ROI</th><th>Actions</th></tr></thead>
      <tbody>
        ${Array.isArray(groups) && groups.length > 0
          ? groups.map(g => `
              <tr>
                <td>${escapeHtml(g.group_name || "")}</td>
                <td>${escapeHtml(g.total_amount || "0.00")}</td>
                <td>${escapeHtml(g.total_roi || "0.0000")}</td>
                <td>
                  <button class="btn-primary btn-select" data-id="${g.group_id}">Select</button>
                  <button class="btn-danger btn-delete" data-id="${g.group_id}">Delete</button>
                </td>
              </tr>
            `).join("")
          : `<tr><td colspan="4">(no groups found)</td></tr>`
        }
      </tbody>
    </table>
  `;

  // Wire Select/Delete
  tableDiv.querySelectorAll(".btn-select").forEach(btn => {
    btn.addEventListener("click", async () => {
      const groupId = btn.dataset.id;
      const buttons = document.querySelectorAll("#groups-subtabs button");
      buttons.forEach(b => b.classList.remove("active"));
      const detailsBtn = document.querySelector('#groups-subtabs button[data-subtab="details"]');
      if (detailsBtn) detailsBtn.classList.add("active");

      const content = document.querySelector("#groupsContent");
      await renderGroupDetails(content, portalState, groupId);
    });
  });

  tableDiv.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      const groupId = btn.dataset.id;
      if (!confirm("Delete this group?")) return;
      await fetch(`https://groups-module.dennis-e64.workers.dev/groups/delete/${groupId}?project=${portalState.project}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });
      await renderGroupList(container, portalState);
    });
  });

  // Wire filter buttons
  document.getElementById("btnApplyGroupsFilter").addEventListener("click", () => {
    renderGroupList(container, portalState);
  });
  document.getElementById("btnClearGroupsFilter").addEventListener("click", () => {
    document.getElementById("filter-group-name").value = "";
    document.getElementById("filter-from").value = "";
    document.getElementById("filter-to").value = "";
    renderGroupList(container, portalState);
  });
}

// 🔧 Placeholder for Group Details
async function renderGroupDetails(container, portalState, groupId) {
  container.innerHTML = `<section class="card"><p>Details for group ${escapeHtml(groupId)} (placeholder)</p></section>`;
}

// helper
function escapeHtml(str) {
  const s = String(str ?? "");
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
