// js/groups.js v7.0
console.log("[Groups.js] loaded");

export async function loadGroupsTab({ portalState, tabContent }) {
  tabContent.innerHTML = `
    <section class="card">
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
          if (portalState.selectedGroupId) {
            await renderGroupDetails(content, portalState, portalState.selectedGroupId);
          } else {
            content.innerHTML = `<section class="card"><p>Select a group to view details.</p></section>`;
          }
          break;
        case "members":
          if (portalState.selectedGroupId) {
            await renderGroupMembers(content, portalState, portalState.selectedGroupId);
          } else {
            content.innerHTML = `<section class="card"><p>Select a group to view members.</p></section>`;
          }
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

// Group List with simple name filter + client-side search/sort
async function renderGroupList(container, portalState, options = {}) {
  const prevName = document.getElementById("filter-group-name")?.value.trim() || "";

        container.innerHTML = `
          <section class="card">
          <h2>Groups for ${
        escapeHtml(
          portalState.projects_config?.business_name ||
          portalState.display_name ||
          portalState.project
        )
      }</h2>
       <div id="groupsFilters" style="margin-bottom:12px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <label>Name: <input type="text" id="filter-group-name" value="${escapeHtml(prevName)}" /></label>
        <button id="btnApplyGroupsFilter" class="btn-secondary">Apply Filter</button>
        <button id="btnClearGroupsFilter" class="btn-secondary">Clear Filter</button>
      </div>
      <div id="groupTable">Loading...</div>
    </section>
  `;

  const tableDiv = container.querySelector("#groupTable");

  const order = options.order || "created_at.desc";
  const params = new URLSearchParams({
    project: portalState.project,
    order,
    limit: "500"
  });
  const url = `https://groups-module.dennis-e64.workers.dev/groups/list?${params}`;
  console.log("[Groups] Fetching:", url);

  const res = await fetch(url, { cache: "no-cache" });
  let groups = await res.json();
  if (!Array.isArray(groups)) groups = groups.rows || [];
  if (!Array.isArray(groups)) groups = [];

  if (prevName && prevName.length >= 3) {
    const term = prevName.toLowerCase();
    groups = groups.filter(g => (g.group_name || "").toLowerCase().includes(term));
  }

  groups.sort((a, b) => (a.group_name || "").localeCompare(b.group_name || ""));

  tableDiv.innerHTML = `
    <h4>Showing ${groups.length} ${prevName ? "filtered" : "recent"} groups</h4>
    <table class="notes-table">
      <thead>
        <tr>
          <th>
            Name
            <button class="sort-btn" data-col="group_name" data-dir="asc">▲</button>
            <button class="sort-btn" data-col="group_name" data-dir="desc">▼</button>
          </th>
          <th class="amount">Total Amount</th>
          <th class="amount">Total Referral Amount</th>
          <th class="amount">ROI</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${groups.length > 0
          ? groups.map(g => `
              <tr>
                <td>${escapeHtml(g.group_name || "")}</td>
                <td class="amount">${formatCurrency(g.total_amount)}</td>
                <td class="amount">${formatCurrency(g.total_referral_amount)}</td>
                <td class="amount">${escapeHtml(g.total_roi || "0.0000")}</td>
                <td>${formatDateTime(g.created_at)}</td>
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

  tableDiv.querySelectorAll(".btn-select").forEach(btn => {
    btn.addEventListener("click", async () => {
      const groupId = btn.dataset.id;
      portalState.selectedGroupId = groupId;   // ✅ store active group
      const buttons = document.querySelectorAll("#groups-subtabs button");
      buttons.forEach(b => b.classList.remove("active"));
      const detailsBtn = document.querySelector('#groups-subtabs button[data-subtab="details"]');
      if (detailsBtn) detailsBtn.classList.add("active");
      const content = document.querySelector("#groupsContent");
      await renderGroupDetails(content, portalState, groupId);
    });
  });

  document.getElementById("btnApplyGroupsFilter").addEventListener("click", () => {
    renderGroupList(container, portalState);
  });
  document.getElementById("btnClearGroupsFilter").addEventListener("click", () => {
    document.getElementById("filter-group-name").value = "";
    renderGroupList(container, portalState);
  });

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
        <input class="form-control" value="${formatDateTime(group.date_started)}" readonly />
      </div>
      <div class="notes-row">
        <label class="notes-label">Created At</label>
        <input class="form-control" value="${formatDateTime(group.created_at)}" readonly />
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

// Group Members view
async function renderGroupMembers(container, portalState, groupId) {
  if (!portalState.project || !groupId) {
    container.innerHTML = `<section class="card"><p>Select a group to view members.</p></section>`;
    return;
  }

  // Fetch the group details to get its name
  const res = await fetch(`/groups/details/${groupId}?project=${portalState.project}`);
  const data = await res.json();
  const group = Array.isArray(data) ? data[0] : data;

  const prevName = document.getElementById("filter-member-name")?.value.trim() || "";
  const prevBiz  = document.getElementById("filter-member-business")?.value.trim() || "";

  container.innerHTML = `
    <section class="card">
      <h2>Group Members for ${escapeHtml(group?.group_name || "(Unnamed Group)")}</h2>
      <div style="margin-bottom:12px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <label>Name: <input type="text" id="filter-member-name" value="${escapeHtml(prevName)}" /></label>
        <label>Business: <input type="text" id="filter-member-business" value="${escapeHtml(prevBiz)}" /></label>
        <button id="btnApplyMemberFilter" class="secondary">Apply Filter</button>
        <button id="btnClearMemberFilter" class="secondary">Clear Filter</button>
      </div>
      <div id="groupMemberTable">Loading...</div>
    </section>
  `;

  const tableDiv = container.querySelector("#groupMemberTable");

  // Call groups-module /groups/members/:id
  const url = `https://groups-module.dennis-e64.workers.dev/groups/members/${groupId}?project=${portalState.project}&limit=500`;
  const res = await fetch(url, { cache: "no-cache" });
  let contacts = await res.json();
  if (!Array.isArray(contacts)) contacts = [];

  if (prevName && prevName.length >= 3) {
    const term = prevName.toLowerCase();
    contacts = contacts.filter(c => (c.contact_name || "").toLowerCase().includes(term));
  }
  if (prevBiz && prevBiz.length >= 3) {
    const term = prevBiz.toLowerCase();
    contacts = contacts.filter(c => (c.business_name || "").toLowerCase().includes(term));
  }

  contacts.sort((a, b) => (a.contact_name || "").localeCompare(b.contact_name || ""));

  tableDiv.innerHTML = `
    <h4>Showing ${contacts.length} ${prevName || prevBiz ? "filtered" : "members"} contacts</h4>
    <table class="notes-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Business Name</th>
          <th>Contact Type</th>
        </tr>
      </thead>
      <tbody>
        ${contacts.length > 0
          ? contacts.map(c => `
              <tr>
                <td>${escapeHtml(c.contact_name || "")}</td>
                <td>${escapeHtml(c.business_name || "")}</td>
                <td>${escapeHtml(c.contact_type || "")}</td>
              </tr>
            `).join("")
          : `<tr><td colspan="3">(no contacts found)</td></tr>`
        }
      </tbody>
    </table>
  `;

  document.getElementById("btnApplyMemberFilter").addEventListener("click", () => {
    renderGroupMembers(container, portalState, groupId);
  });
  document.getElementById("btnClearMemberFilter").addEventListener("click", () => {
    document.getElementById("filter-member-name").value = "";
    document.getElementById("filter-member-business").value = "";
    renderGroupMembers(container, portalState, groupId);
  });
}

// Add Group view
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

    const listBtn = document.querySelector('#groups-subtabs button[data-subtab="list"]');
    if (listBtn) {
      listBtn.classList.add("active");
      const content = document.querySelector("#groupsContent");
      await renderGroupList(content, portalState);
    }
  });
}

// Helpers
function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

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
                                                                   
