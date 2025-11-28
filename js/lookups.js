// js/lookups.js v1.1.0
// Lookup tab with portal styling and full Worker integration

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
    const res = await fetch(url, { cache: "no-cache" });
    const data = await res.json();

    if (!res.ok || data.status !== "ok" || !Array.isArray(data.lookups)) {
      groupsDiv.innerHTML = `<p>Error loading lookups: ${data.error || "Unknown error"}</p>`;
      return;
    }

    const grouped = {};
    data.lookups.forEach(row => {
      if (!grouped[row.lookup_type]) grouped[row.lookup_type] = [];
      grouped[row.lookup_type].push(row);
    });

    groupsDiv.innerHTML = Object.keys(grouped).map(type => `
      <section class="lookup-group card" style="margin-bottom:24px;">
        <h3>${escapeHtml(type)}</h3>
        <table class="portal-table striped">
          <thead>
            <tr>
              <th>Value</th>
              <th>Sort</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${grouped[type].map((item, i) => `
              <tr data-id="${item.id}" class="${i % 2 === 0 ? 'even' : 'odd'}">
                <td>${escapeHtml(item.value)}</td>
                <td>${item.sort_order}</td>
                <td>
                  <select class="activeDropdown">
                    <option value="true" ${item.is_active ? "selected" : ""}>Yes</option>
                    <option value="false" ${!item.is_active ? "selected" : ""}>No</option>
                  </select>
                </td>
                <td>
                  <button class="editBtn" style="background:#2979ff;color:#fff;border:none;border-radius:4px;padding:6px 12px;">Edit</button>
                  <button class="deleteBtn" style="background:#e53935;color:#fff;border:none;border-radius:4px;padding:6px 12px;margin-left:6px;">Delete</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <button class="addValueBtn primary" data-type="${type}" style="margin-top:8px;">+ Add Value</button>
      </section>
    `).join("");

    tabContent.querySelector("#addGroupBtn").addEventListener("click", async () => {
      const type = prompt("Enter new lookup group name:");
      if (!type) return;
      await fetch("https://lookups-module.dennis-e64.workers.dev/lookups/addGroup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookup_type: type, project: portalState.project })
      });
      loadLookupsTab({ portalState, tabContent });
    });

    groupsDiv.addEventListener("click", async e => {
      const row = e.target.closest("tr");
      const id = row?.dataset?.id;

      if (e.target.classList.contains("editBtn")) {
        const newVal = prompt("Enter new value:");
        if (!newVal) return;
        await fetch(`https://lookups-module.dennis-e64.workers.dev/lookups/edit/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates: { value: newVal } })
        });
        loadLookupsTab({ portalState, tabContent });
      }

      if (e.target.classList.contains("deleteBtn")) {
        if (!confirm("Delete this lookup value?")) return;
        await fetch(`https://lookups-module.dennis-e64.workers.dev/lookups/delete/${id}`, {
          method: "DELETE"
        });
        loadLookupsTab({ portalState, tabContent });
      }

      if (e.target.classList.contains("addValueBtn")) {
        const type = e.target.dataset.type;
        const val = prompt(`Enter new value for group "${type}":`);
        if (!val) return;
        await fetch("https://lookups-module.dennis-e64.workers.dev/lookups/addValue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lookup_type: type, value: val, project: portalState.project })
        });
        loadLookupsTab({ portalState, tabContent });
      }
    });

    groupsDiv.addEventListener("change", async e => {
      if (e.target.classList.contains("activeDropdown")) {
        const row = e.target.closest("tr");
        const id = row?.dataset?.id;
        const newVal = e.target.value === "true";
        await fetch(`https://lookups-module.dennis-e64.workers.dev/lookups/edit/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates: { is_active: newVal } })
        });
      }
    });

  } catch (err) {
    groupsDiv.innerHTML = `<p>Error loading lookups: ${err.message}</p>`;
  }
}

function escapeHtml(str) {
  return str?.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c])) || "";
}
