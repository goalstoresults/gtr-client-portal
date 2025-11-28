// js/lookups.js v1.0.0
// Lookups module with full Worker URLs (lookups-module.dennis-e64.workers.dev)

console.log("[Lookups.js] loaded");

export async function loadLookupsTab({ portalState, tabContent }) {
  tabContent.innerHTML = `
    <section class="card">
      <h2>Lookup Groups</h2>
      <div id="lookupGroups">Loading...</div>
      <button id="addGroupBtn" class="primary">+ Add Lookup Group</button>
    </section>
  `;

  const groupsDiv = tabContent.querySelector("#lookupGroups");

  try {
    const url = `https://lookups-module.dennis-e64.workers.dev/lookups/list?project=${portalState.project}`;
    console.log("[Lookups] Fetching:", url);

    const res = await fetch(url, { cache: "no-cache" });
    const data = await res.json();

    if (!res.ok || data.status !== "ok" || !Array.isArray(data.lookups)) {
      groupsDiv.innerHTML = `<p>Error loading lookups: ${data.error || "Unknown error"}</p>`;
      return;
    }

    // Group by lookup_type
    const grouped = {};
    data.lookups.forEach(row => {
      if (!grouped[row.lookup_type]) grouped[row.lookup_type] = [];
      grouped[row.lookup_type].push(row);
    });

    // Render each group
    groupsDiv.innerHTML = Object.keys(grouped).map(type => `
      <section class="lookup-group card" style="margin-bottom:16px;">
        <h3>${type}</h3>
        <table class="lookups-table">
          <thead>
            <tr><th>Value</th><th>Sort</th><th>Active</th><th>Actions</th></tr>
          </thead>
          <tbody>
            ${grouped[type].map(item => `
              <tr data-id="${item.id}">
                <td>${escapeHtml(item.value)}</td>
                <td>${item.sort_order}</td>
                <td>${item.is_active ? "Yes" : "No"}</td>
                <td>
                  <button class="editBtn secondary">Edit</button>
                  <button class="deleteBtn danger">Delete</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <button class="addValueBtn primary" data-type="${type}">+ Add Value</button>
      </section>
    `).join("");

    // Wire up Add Group button
    tabContent.querySelector("#addGroupBtn").addEventListener("click", async () => {
      const type = prompt("Enter new lookup group name:");
      if (!type) return;
      const addUrl = `https://lookups-module.dennis-e64.workers.dev/lookups/addGroup`;
      const res = await fetch(addUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookup_type: type, project: portalState.project })
      });
      await res.json();
      loadLookupsTab({ portalState, tabContent }); // reload
    });

    // Event delegation for edit/delete/addValue
    groupsDiv.addEventListener("click", async e => {
      const row = e.target.closest("tr");
      if (e.target.classList.contains("editBtn")) {
        const newVal = prompt("Enter new value:");
        if (!newVal) return;
        const patchUrl = `https://lookups-module.dennis-e64.workers.dev/lookups/edit/${row.dataset.id}`;
        await fetch(patchUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates: { value: newVal } })
        });
        loadLookupsTab({ portalState, tabContent });
      }
      if (e.target.classList.contains("deleteBtn")) {
        if (!confirm("Delete this lookup value?")) return;
        const delUrl = `https://lookups-module.dennis-e64.workers.dev/lookups/delete/${row.dataset.id}`;
        await fetch(delUrl, { method: "DELETE" });
        loadLookupsTab({ portalState, tabContent });
      }
      if (e.target.classList.contains("addValueBtn")) {
        const type = e.target.dataset.type;
        const val = prompt(`Enter new value for group "${type}":`);
        if (!val) return;
        const addValUrl = `https://lookups-module.dennis-e64.workers.dev/lookups/addValue`;
        await fetch(addValUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lookup_type: type, value: val, project: portalState.project })
        });
        loadLookupsTab({ portalState, tabContent });
      }
    });

  } catch (err) {
    groupsDiv.innerHTML = `<p>Error loading lookups: ${err.message}</p>`;
  }
}

// Simple HTML escape helper
function escapeHtml(str) {
  return str?.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c])) || "";
}
