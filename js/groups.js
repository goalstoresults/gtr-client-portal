// js/groups.js v6.0
console.log("[Groups.js] loaded");

export async function loadGroupsTab({ portalState, tabContent }) {
  tabContent.innerHTML = `
    <section class="card">
      <h2>Groups v2</h2>
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
          await renderGroupAdd(content, portalState);
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

  // Default to List view
  const defaultBtn = tabContent.querySelector('#groups-subtabs button[data-subtab="list"]');
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    await renderGroupList(content, portalState);
  }
}

// Group List with filters, search, sort
async function renderGroupList(container, portalState, options = {}) {
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
  const order = options.order || "created_at.desc";

  const params = new URLSearchParams({
    project: portalState.project,
    order,
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
      <thead>
        <tr>
          <th>
            Name
            <button class="sort-btn" data-col="group_name" data-dir="asc">▲</button>
            <button class="sort-btn" data-col="group_name" data-dir="desc">▼</button>
          </th>
          <th class="amount">
            Total Amount
            <button class="sort-btn" data-col="total_amount" data-dir="asc">▲</button>
            <button class="sort-btn" data-col="total_amount" data-dir="desc">▼</button>
          </th>
          <th class="amount">
            Total Referral Amount
            <button class="sort-btn" data-col="total_referral_amount" data-dir="asc">▲</button>
            <button class="sort-btn" data-col="total_referral_amount" data-dir="desc">▼</button>
          </th>
          <th class="amount">
            ROI
            <button class="sort-btn" data-col="total_roi" data-dir="asc">▲</button>
            <button class="sort-btn" data-col="total_roi" data-dir="desc">▼</button>
          </th>
          <th>
            Created
            <button class="sort-btn" data-col="created_at" data-dir="asc">▲</button>
            <button class="sort-btn" data-col="created_at" data-dir="desc">▼</button>
          </th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${Array.isArray(groups) && groups.length > 0
          ? groups.map(g => `
              <tr>
                <td>${escapeHtml(g.group_name || "")}</td>
                <td class="amount">${formatCurrency(g.total_amount)}</td>
                <td class="amount">${formatCurrency(g.total_referral_amount)}</td>
                <td class="amount">${escapeHtml(g.total_roi || "0.0000")}</td>
                <td>${escapeHtml(g.created_at || "")}</td>
                <td>
                  <button class="btn-primary btn-select" data-id="${g.group_id}">Select</button>
                </td>
              </tr>
            `).join("")
          : `<tr><td colspan="6">(no groups found)</td></tr>`
        }
      </tbody>
    </table>
  `;

  // Wire Select
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

  // Wire sort buttons
  tableDiv.querySelectorAll(".sort-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const col = btn.dataset.col;
      const dir = btn.dataset.dir;
      await renderGroupList(container, portalState, { order: `${col}.${dir}` });
    });
  });
}

// Group Details view
async function renderGroupDetails(container, portalState, groupId) {
  container.innerHTML = `<section class="card"><p>Loading group details...</p></section>`;

  const url = `https://groups-module.dennis-e64.workers.dev/groups/details/${groupId}?project=${portalState.project}`;
  console.log("[Groups] Fetching details:", url);

  const res = await fetch(url);
  const raw = await res.json();

  const group = Array.isArray(raw) ? raw[0] : raw;
  if (!group || !group.group_id) {
    container.innerHTML = `<section class="card"><p>(Group not found)</p></section>`;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>Group Details</h3>
        <div>
          <button id="btnSaveGroup" class="btn-primary">Save</button>
          <button id="btnDeleteGroup" class="btn-danger">Delete</button>
        </div>
      </div>
      <div class="notes-row">
        <label class="notes-label">Name</label>
        <input id="groupNameInput" class="form-control" value="${escapeHtml(group.group_name || "")}" />
      </div>
      <div class="notes-row">
        <label class="notes-label">Total Amount</label>
        <input class="form-control amount" value="${formatCurrency(group.total_amount)}" readonly />
      </div>
      <div class="notes-row">
        <label class="notes-label">Total Referral Amount</label>
        <input class="form-control amount" value="${formatCurrency(group.total_referral_amount)}" readonly />
      </div>
      <div class="notes-row">
        <label class="notes-label">ROI</label>
        <input class="form-control amount" value="${escapeHtml(group.total_roi || "0.0000")}" readonly />
      </div>
      <div class="notes-row">
        <label class="notes-label">Date Started</label>
        <input class="form-control" value="${escapeHtml(group.date_started || "")}" readonly />
      </div>
      <div class="notes-row">
        <label class="notes-label">Created At</label>
        <input class="form-control" value="${escapeHtml(group.created_at || "")}" readonly />
      </div>
    </section>
  `;

  // Wire Save
  document.getElementById("btnSaveGroup").addEventListener("click", async () => {
    const newName = document.getElementById("groupNameInput").value.trim();
    if (!newName) {
      alert("Name cannot be empty");
      return;
    }
    await fetch(`https://groups-module.dennis-e64.workers.dev/groups/update/${group.group_id}?project=${portalState.project}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_name: newName })
    });
    alert("Group name updated");
  });

  // Wire Delete
  document.getElementById("btnDeleteGroup").addEventListener("click", async () => {
    if (!confirm("Delete this group?")) return;
    await fetch(`https://groups-module.dennis-e64.workers.dev/groups/delete/${group.group_id}?project=${portalState.project}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" }
    });
    alert("Group deleted");
    // Return to list view
    const listBtn = document.querySelector('#groups-subtabs button[data-subtab="list"]');
    if (listBtn) {
      listBtn.classList.add("active");
      const content = document.querySelector("#groupsContent");
      await renderGroupList(content, portalState);
    }
  });
}

async function renderGroupAdd(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>Add Group</h3>
        <button id="btnSaveNewGroup" class="btn-primary">Save</button>
      </div>
      <div class="notes-row">
        <label class="notes-label">Name</label>
        <input id="newGroupName" class="form-control" placeholder="Enter group name" />
      </div>
    </section>
  `;

  document.getElementById("btnSaveNewGroup").addEventListener("click", async () => {
    const name = document.getElementById("newGroupName").value.trim();
    if (!name) {
      alert("Group name cannot be empty");
      return;
    }

    await fetch(`https://groups-module.dennis-e64.workers.dev/groups/add?project=${portalState.project}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_name: name })
    });

    alert("Group added");

    // Switch back to List view
    const listBtn = document.querySelector('#groups-subtabs button[data-subtab="list"]');
    if (listBtn) {
      listBtn.classList.add("active");
      const content = document.querySelector("#groupsContent");
      await renderGroupList(content, portalState);
    }
  });
}



// helpers
function escapeHtml(str) {
  const s = String(str ?? "");
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function formatCurrency(value) {
  const num = Number(value) || 0;
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
