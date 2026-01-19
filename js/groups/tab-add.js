// js/groups/tab-add.js
// GROUP ADD TAB — modular version

import { escapeHtml } from "../utilities.js";

export async function renderGroupAdd(container, portalState) {
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

  // SAVE NEW GROUP
  document.getElementById("btnSaveNewGroup").addEventListener("click", async () => {
    const name = document.getElementById("newGroupName").value.trim();

    if (!name) {
      alert("Group name cannot be empty");
      return;
    }

    // Create group
    await fetch(
      `https://groups-module.dennis-e64.workers.dev/groups/add?project=${portalState.project}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_name: name })
      }
    );

    alert("Group added");

    // Reset global state
    portalState.selectedGroupId = null;
    portalState.selectedGroupName = null;

    const contextBar = document.getElementById("groups-context-bar");
    if (contextBar) {
      contextBar.textContent = "No group selected";
    }

    // Switch to List tab
    const listBtn = document.querySelector('#groups-subtabs button[data-subtab="list"]');
    if (listBtn) {
      listBtn.classList.add("active");

      const content = document.querySelector("#groupsContent");
      const { renderGroupList } = await import("./tab-list.js");
      await renderGroupList(content, portalState);
    }
  });
}
