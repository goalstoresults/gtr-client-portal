// js/groups/tab-details.js
// GROUP DETAILS TAB — modular version

import { renderGroupList } from "./tab-list.js";

import {
  escapeHtml,
  formatDateTime
} from "../utilities.js";

export async function renderGroupDetails(container, portalState, groupId) {
  if (!groupId) {
    container.innerHTML = `
      <section class="card">
        <p>Select a group to view details.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <p>Loading group details...</p>
    </section>
  `;

  // Fetch group details
  const url = `https://groups-module.dennis-e64.workers.dev/groups/details/${groupId}?project=${portalState.project}`;
  const res = await fetch(url, { cache: "no-cache" });
  const raw = await res.json();
  const group = Array.isArray(raw) ? raw[0] : raw;

  if (!group || !group.group_id) {
    container.innerHTML = `
      <section class="card">
        <p>(Group not found)</p>
      </section>
    `;
    return;
  }

  // Update global state
  portalState.selectedGroupId = group.group_id;
  portalState.selectedGroupName = group.group_name || "";

  // Update blue context bar
  const contextBar = document.getElementById("groups-context-bar");
  if (contextBar) {
    contextBar.textContent = portalState.selectedGroupName
      ? `Group: ${portalState.selectedGroupName}`
      : "No group selected";
  }

  // Render details UI
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
        <input id="groupNameInput" class="form-control"
               value="${escapeHtml(group.group_name || "")}" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Date Started</label>
        <input class="form-control"
               value="${formatDateTime(group.date_started)}"
               readonly />
      </div>

      <div class="notes-row">
        <label class="notes-label">Created At</label>
        <input class="form-control"
               value="${formatDateTime(group.created_at)}"
               readonly />
      </div>

    </section>
  `;

  // ------------------------------------------------------------
  // SAVE GROUP
  // ------------------------------------------------------------
  document.getElementById("btnSaveGroup").addEventListener("click", async () => {
    const newName = document.getElementById("groupNameInput").value.trim();

    if (!newName) {
      alert("Name cannot be empty");
      return;
    }

    await fetch(
      `https://groups-module.dennis-e64.workers.dev/groups/update/${group.group_id}?project=${portalState.project}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_name: newName })
      }
    );

    // Update global state + context bar
    portalState.selectedGroupName = newName;

    const contextBar = document.getElementById("groups-context-bar");
    if (contextBar) {
      contextBar.textContent = `Group: ${newName}`;
    }

    alert("Group updated");
  });

  // ------------------------------------------------------------
  // DELETE GROUP
  // ------------------------------------------------------------
  document.getElementById("btnDeleteGroup").addEventListener("click", async () => {
    if (!confirm("Delete this group?")) return;

    await fetch(
      `https://groups-module.dennis-e64.workers.dev/groups/delete/${group.group_id}?project=${portalState.project}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      }
    );

    alert("Group deleted");

    // Reset global state
    portalState.selectedGroupId = null;
    portalState.selectedGroupName = null;

    const contextBar = document.getElementById("groups-context-bar");
    if (contextBar) {
      contextBar.textContent = "No group selected";
    }

    // Switch back to List tab
    const listBtn = document.querySelector('#groups-subtabs button[data-subtab="list"]');
    if (listBtn) {
      listBtn.classList.add("active");
      const content = document.querySelector("#groupsContent");
      const { renderGroupList } = await import("./tab-list.js");
      await renderGroupList(content, portalState);
    }
  });
}
