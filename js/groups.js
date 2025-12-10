// js/groups.js v6.0
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
async function renderGroupMembers(container, portalState, groupId) {
  if (!portalState.project || !groupId) {
    container.innerHTML = `<section class="card"><p>Select a group to view members.</p></section>`;
    return;
  }

  // Preserve filters
  const prevName = document.getElementById("filter-member-name")?.value.trim() || "";
  const prevBiz  = document.getElementById("filter-member-business")?.value.trim() || "";

  container.innerHTML = `
    <section class="card">
      <h2>Group Members for ${escapeHtml(portalState.display_name || portalState.project)}</h2>
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

  // 🔑 Call groups-module /groups/members/:id
  const url = `https://groups-module.dennis-e64.workers.dev/groups/members/${groupId}?project=${portalState.project}&limit=500`;
  const res = await fetch(url, { cache: "no-cache" });
  let contacts = await res.json();
  if (!Array.isArray(contacts)) contacts = [];

  // Apply client-side filters
  if (prevName && prevName.length >= 3) {
    const term = prevName.toLowerCase();
    contacts = contacts.filter(c => (c.contact_name || "").toLowerCase().includes(term));
  }
  if (prevBiz && prevBiz.length >= 3) {
    const term = prevBiz.toLowerCase();
    contacts = contacts.filter(c => (c.business_name || "").toLowerCase().includes(term));
  }

  // Sort alphabetically by contact_name
  contacts.sort((a, b) => (a.contact_name || "").localeCompare(b.contact_name || ""));

  // Render table (no Actions column)
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

  // Wire filter buttons
  document.getElementById("btnApplyMemberFilter").addEventListener("click", () => {
    renderGroupMembers(container, portalState, groupId);
  });
  document.getElementById("btnClearMemberFilter").addEventListener("click", () => {
    document.getElementById("filter-member-name").value = "";
    document.getElementById("filter-member-business").value = "";
    renderGroupMembers(container, portalState, groupId);
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

async function renderGroupMembers(container, portalState, groupId) {
  if (!portalState.project || !groupId) {
    container.innerHTML = `<section class="card"><p>Select a group to view members.</p></section>`;
    return;
  }

  // Preserve filters
  const prevName = document.getElementById("filter-member-name")?.value.trim() || "";
  const prevBiz  = document.getElementById("filter-member-business")?.value.trim() || "";

  container.innerHTML = `
    <section class="card">
      <h2>Group Members for ${escapeHtml(portalState.display_name || portalState.project)}</h2>
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

  // Fetch contacts for this group
  const url = `https://contacts-module.dennis-e64.workers.dev/contacts/list?project=${portalState.project}&group_id=${groupId}&limit=500`;
  const res = await fetch(url, { cache: "no-cache" });
  let contacts = await res.json();
  if (!Array.isArray(contacts)) contacts = [];

  // Apply client-side filters
  if (prevName && prevName.length >= 3) {
    const term = prevName.toLowerCase();
    contacts = contacts.filter(c => (c.contact_name || "").toLowerCase().includes(term));
  }
  if (prevBiz && prevBiz.length >= 3) {
    const term = prevBiz.toLowerCase();
    contacts = contacts.filter(c => (c.business_name || "").toLowerCase().includes(term));
  }

  // Sort alphabetically by contact_name
  contacts.sort((a, b) => (a.contact_name || "").localeCompare(b.contact_name || ""));

  // Render table
  tableDiv.innerHTML = `
    <h4>Showing ${contacts.length} ${prevName || prevBiz ? "filtered" : "members"} contacts</h4>
    <table class="notes-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Business Name</th>
          <th>Contact Type</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${contacts.length > 0
          ? contacts.map(c => `
              <tr>
                <td>${escapeHtml(c.contact_name || "")}</td>
                <td>${escapeHtml(c.business_name || "")}</td>
                <td>${escapeHtml(c.contact_type || "")}</td>
                <td>
                  <button class="btn-primary btn-select" data-id="${c.contact_id}">Select</button>
                </td>
              </tr>
            `).join("")
          : `<tr><td colspan="4">(no contacts found)</td></tr>`
        }
      </tbody>
    </table>
  `;

  // Wire Select → same logic as Contacts list
  tableDiv.querySelectorAll(".btn-select").forEach(btn => {
    btn.addEventListener("click", async () => {
      const contactId = btn.dataset.id;
      portalState.selectedContactId = contactId;

      const buttons = document.querySelectorAll("#contacts-subtabs button");
      buttons.forEach(b => b.classList.remove("active"));
      const detailsBtn = document.querySelector('#contacts-subtabs button[data-subtab="details"]');
      if (detailsBtn) detailsBtn.classList.add("active");

      const content = document.querySelector("#contactsContent");
      await renderContactDetails(content, portalState, contactId);
    });
  });

  // Wire filter buttons
  document.getElementById("btnApplyMemberFilter").addEventListener("click", () => {
    renderGroupMembers(container, portalState, groupId);
  });
  document.getElementById("btnClearMemberFilter").addEventListener("click", () => {
    document.getElementById("filter-member-name").value = "";
    document.getElementById("filter-member-business").value = "";
    renderGroupMembers(container, portalState, groupId);
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
