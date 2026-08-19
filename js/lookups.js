// js/lookups.js v1.5.0
// Lookup tab with inline editable rows, Save/Delete actions, Add Group + Add Value inline forms
console.log("[Lookups.js] loaded");

export async function loadLookupsTab({ portalState, tabContent }) {
  tabContent.innerHTML = `
    <section class="card">
      <h2>Lookup Groups</h2>
      <div id="lookupGroups">Loading...</div>
      ${portalState.canEdit ? `<button id="addGroupBtn" class="primary">+ Add Lookup Group</button>` : ``}
    </section>
  `;

  const groupsDiv = tabContent.querySelector("#lookupGroups");

  try {
    const url =
      `https://lookups-module.dennis-e64.workers.dev/lookups/list?project=${portalState.project}`;
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
        <table class="notes-table">
          <thead>
            <tr>
              <th>Value</th>
              <th>Sort</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${grouped[type].map(item => `
              <tr data-id="${item.id}">
                <td>
                  <input type="text" class="valueInput" value="${escapeHtml(item.value)}" style="width:100%;">
                </td>
                <td>
                  <input type="number" class="sortInput" value="${item.sort_order}" style="width:70px;">
                </td>
                <td>
                  <select class="activeDropdown">
                    <option value="true" ${item.is_active ? "selected" : ""}>Yes</option>
                    <option value="false" ${!item.is_active ? "selected" : ""}>No</option>
                  </select>
                </td>
                <td>
                  ${portalState.canEdit ? `<button class="saveBtn" style="background:#2979ff;color:#fff;border:none;border-radius:4px;padding:6px 12px;">Save</button>` : ``}
                  ${portalState.deleteAllowed ? `<button class="deleteBtn" style="background:#e53935;color:#fff;border:none;border-radius:4px;padding:6px 12px;margin-left:6px;">Delete</button>` : ``}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        ${portalState.canEdit ? `<button class="addValueBtn primary" data-type="${type}" style="margin-top:8px;">+ Add Value</button>` : ``}
      </section>
    `).join("");

    // --- Add Group inline form ---
    const addGroupBtn = tabContent.querySelector("#addGroupBtn");
    if (addGroupBtn) {
      addGroupBtn.addEventListener("click", () => {
        const addRow = document.createElement("div");
        addRow.innerHTML = `
          <table class="notes-table" style="margin-top:12px;">
            <thead>
              <tr>
                <th>Lookup Type</th>
                <th>Value</th>
                <th>Sort</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><input type="text" class="newTypeInput" placeholder="Group name"></td>
                <td><input type="text" class="newValueInput" placeholder="First value"></td>
                <td><input type="number" class="newSortInput" value="10" style="width:70px;"></td>
                <td>
                  <select class="newActiveDropdown">
                    <option value="true" selected>Yes</option>
                    <option value="false">No</option>
                  </select>
                </td>
                <td>
                  ${portalState.canEdit ? `<button class="saveNewGroupBtn" style="background:#2979ff;color:#fff;border:none;border-radius:4px;padding:6px 12px;">Save</button>` : ``}
                  <button class="cancelNewGroupBtn" style="background:#999;color:#fff;border:none;border-radius:4px;padding:6px 12px;margin-left:6px;">Cancel</button>
                </td>
              </tr>
            </tbody>
          </table>
        `;

        addGroupBtn.insertAdjacentElement("afterend", addRow);

        const saveNewGroupBtn = addRow.querySelector(".saveNewGroupBtn");
        if (saveNewGroupBtn) {
          saveNewGroupBtn.addEventListener("click", async () => {
            const type = addRow.querySelector(".newTypeInput").value.trim();
            const value = addRow.querySelector(".newValueInput").value.trim();
            const sort = parseInt(addRow.querySelector(".newSortInput").value, 10);
            const active = addRow.querySelector(".newActiveDropdown").value === "true";

            if (!type || !value) {
              alert("Please enter both a group name and a value.");
              return;
            }

            const payload = {
              lookup_type: type,
              value,
              sort_order: sort,
              is_active: active,
              project: portalState.project,
              created_at: new Date().toISOString()
            };

            await fetch("https://lookups-module.dennis-e64.workers.dev/lookups/addGroup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });

            loadLookupsTab({ portalState, tabContent });
          });
        }

        addRow.querySelector(".cancelNewGroupBtn").addEventListener("click", () => {
          addRow.remove();
        });
      });
    }

    // --- Event delegation for Save/Delete/Add Value ---
    groupsDiv.addEventListener("click", async e => {
      const row = e.target.closest("tr");
      const id = row?.dataset?.id;

      if (e.target.classList.contains("saveBtn")) {
        const value = row.querySelector(".valueInput").value.trim();
        const sort = parseInt(row.querySelector(".sortInput").value, 10);
        const active = row.querySelector(".activeDropdown").value === "true";
        const updates = { value, sort_order: sort, is_active: active };

        await fetch(`https://lookups-module.dennis-e64.workers.dev/lookups/edit/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates })
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
        const groupSection = e.target.closest(".lookup-group");
        const tbody = groupSection.querySelector("tbody");
        const lastRow = tbody.querySelector("tr:last-child");
        const lastSort = lastRow
          ? parseInt(
              lastRow.querySelector(".sortInput")?.value ||
                lastRow.querySelector("td:nth-child(2)")?.textContent,
              10
            )
          : 0;
        const nextSort = (isNaN(lastSort) ? 0 : lastSort) + 10;

        const newRow = document.createElement("tr");
        newRow.innerHTML = `
          <td><input type="text" class="newValueInput" placeholder="New value"></td>
          <td><input type="number" class="newSortInput" value="${nextSort}" style="width:70px;"></td>
          <td>
            <select class="newActiveDropdown">
              <option value="true" selected>Yes</option>
              <option value="false">No</option>
            </select>
          </td>
          <td>
            ${portalState.canEdit ? `<button class="saveNewValueBtn" style="background:#2979ff;color:#fff;border:none;border-radius:4px;padding:6px 12px;">Save</button>` : ``}
            <button class="cancelNewValueBtn" style="background:#999;color:#fff;border:none;border-radius:4px;padding:6px 12px;margin-left:6px;">Cancel</button>
          </td>
        `;

        tbody.appendChild(newRow);

        // NOTE: this listener is duplicated in your original file (the
        // exact same block appears twice in a row) - preserved as-is
        // here since that's a pre-existing issue unrelated to the
        // canEdit/deleteAllowed gating requested tonight, not something
        // introduced by this change.
        const saveNewValueBtn1 = newRow.querySelector(".saveNewValueBtn");
        if (saveNewValueBtn1) {
          saveNewValueBtn1.addEventListener("click", async () => {
            const value = newRow.querySelector(".newValueInput").value.trim();
            const sort = parseInt(newRow.querySelector(".newSortInput").value, 10);
            const active = newRow.querySelector(".newActiveDropdown").value === "true";

            if (!value) {
              alert("Please enter a value.");
              return;
            }

            const payload = {
              lookup_type: type,
              value,
              sort_order: sort,
              is_active: active,
              project: portalState.project,
              created_at: new Date().toISOString()
            };

            await fetch("https://lookups-module.dennis-e64.workers.dev/lookups/addValue", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });

            // Refresh the tab to show the new row
            loadLookupsTab({ portalState, tabContent });
          });
        }

        const saveNewValueBtn2 = newRow.querySelector(".saveNewValueBtn");
        if (saveNewValueBtn2) {
          saveNewValueBtn2.addEventListener("click", async () => {
            const value = newRow.querySelector(".newValueInput").value.trim();
            const sort = parseInt(newRow.querySelector(".newSortInput").value, 10);
            const active = newRow.querySelector(".newActiveDropdown").value === "true";

            if (!value) {
              alert("Please enter a value.");
              return;
            }

            const payload = {
              lookup_type: type,
              value,
              sort_order: sort,
              is_active: active,
              project: portalState.project,
              created_at: new Date().toISOString()
            };

            await fetch("https://lookups-module.dennis-e64.workers.dev/lookups/addValue", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });

            // Refresh the tab to show the new row
            loadLookupsTab({ portalState, tabContent });
          });
        }

        newRow.querySelector(".cancelNewValueBtn").addEventListener("click", () => {
          newRow.remove();
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
