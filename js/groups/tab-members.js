// js/groups/tab-members.js
// GROUP MEMBERS TAB — modular version

import {
  escapeHtml
} from "../utilities.js";

export async function renderGroupMembers(container, portalState, groupId) {
  if (!groupId) {
    container.innerHTML = `
      <section class="card">
        <p>Select a group to view members.</p>
      </section>
    `;
    return;
  }

  // Fetch group name for header
  const groupRes = await fetch(
    `https://groups-module.dennis-e64.workers.dev/groups/details/${groupId}?project=${portalState.project}`,
    { cache: "no-cache" }
  );

  const groupData = await groupRes.json();
  const group = Array.isArray(groupData) ? groupData[0] : groupData;

  const prevName = document.getElementById("filter-member-name")?.value.trim() || "";
  const prevBiz  = document.getElementById("filter-member-business")?.value.trim() || "";

  container.innerHTML = `
    <section class="card">

      <h2>Group Members for ${escapeHtml(group?.group_name || "(Unnamed Group)")}</h2>

      <div style="margin-bottom:12px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <label>Name: <input type="text" id="filter-member-name" value="${escapeHtml(prevName)}" /></label>
        <label>Business: <input type="text" id="filter-member-business" value="${escapeHtml(prevBiz)}" /></label>
        <button id="btnApplyMemberFilter" class="btn-secondary">Apply Filter</button>
        <button id="btnClearMemberFilter" class="btn-secondary">Clear Filter</button>
      </div>

      <div id="groupMemberTable">Loading...</div>

    </section>
  `;

  const tableDiv = container.querySelector("#groupMemberTable");

  // Fetch members
  const url = `https://groups-module.dennis-e64.workers.dev/groups/members/${groupId}?project=${portalState.project}&limit=500`;
  const membersRes = await fetch(url, { cache: "no-cache" });

  let contacts = await membersRes.json();
  if (!Array.isArray(contacts)) contacts = [];

  // Apply filters
  if (prevName && prevName.length >= 3) {
    const term = prevName.toLowerCase();
    contacts = contacts.filter(c => (c.contact_name || "").toLowerCase().includes(term));
  }

  if (prevBiz && prevBiz.length >= 3) {
    const term = prevBiz.toLowerCase();
    contacts = contacts.filter(c => (c.business_name || "").toLowerCase().includes(term));
  }

  // Sorting
  let currentSortField = "contact_name";
  let currentSortDirection = "asc";

  const columns = [
    { key: "contact_name",  label: "Name" },
    { key: "business_name", label: "Business Name" },
    { key: "contact_type",  label: "Contact Type" }
  ];

  function sortMembers() {
    contacts.sort((a, b) => {
      let A = a[currentSortField] || "";
      let B = b[currentSortField] || "";

      A = A.toString().toLowerCase();
      B = B.toString().toLowerCase();

      return currentSortDirection === "asc"
        ? A.localeCompare(B)
        : B.localeCompare(A);
    });
  }

  function renderMembersTable() {
    sortMembers();

    const headerHtml = columns.map(col => {
      const isSorted = currentSortField === col.key;
      const upArrow   = isSorted && currentSortDirection === "asc"  ? "▲" : "△";
      const downArrow = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

      return `
        <th class="sortable" data-field="${col.key}">
          ${escapeHtml(col.label)}
          <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
            <span>${upArrow}</span>
            <span>${downArrow}</span>
          </span>
        </th>
      `;
    }).join("");

    const rowsHtml = contacts.map(c => `
      <tr>
        <td>${escapeHtml(c.contact_name || "")}</td>
        <td>${escapeHtml(c.business_name || "")}</td>
        <td>${escapeHtml(c.contact_type || "")}</td>
      </tr>
    `).join("");

    tableDiv.innerHTML = `
      <h4>Showing ${contacts.length} ${prevName || prevBiz ? "filtered" : "members"} contacts</h4>

      <table class="notes-table">
        <thead>
          <tr>${headerHtml}</tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="3">(no contacts found)</td></tr>`}
        </tbody>
      </table>
    `;

    // Sorting handlers
    tableDiv.querySelectorAll("th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.dataset.field;

        if (currentSortField === field) {
          currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
        } else {
          currentSortField = field;
          currentSortDirection = "asc";
        }

        renderMembersTable();
      });
    });
  }

  renderMembersTable();

  // Filter buttons
  document.getElementById("btnApplyMemberFilter").addEventListener("click", () => {
    renderGroupMembers(container, portalState, groupId);
  });

  document.getElementById("btnClearMemberFilter").addEventListener("click", () => {
    document.getElementById("filter-member-name").value = "";
    document.getElementById("filter-member-business").value = "";
    renderGroupMembers(container, portalState, groupId);
  });
}
