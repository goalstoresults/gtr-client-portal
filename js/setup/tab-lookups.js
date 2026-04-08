// js/setup/tab-lookups.js
// v3.0 — Lookups Setup Subtab (extracted from legacy setup.js)

import { escapeHtml } from "../utilities.js";

export async function renderLookupsSetup(tabContent, portalState) {
  if (!portalState.setup_project_id) {
    tabContent.innerHTML = `
      <section class="card">
        <p>Please select a project in the Client tab before configuring Lookups.</p>
      </section>
    `;
    return;
  }

  tabContent.innerHTML = `
    <section class="card">
      <div class="lookup-groups-header"
           style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h2 style="margin:0;">Lookup Groups for ${escapeHtml(portalState.display_name || portalState.setup_project_id)}</h2>
        <div>
          <button id="btnCloneLookups" class="btn-secondary" style="margin-right:8px;">Clone Group</button>
          <button id="addGroupBtn" class="btn-primary">+ Add Lookup Group</button>
        </div>
      </div>

      <div id="cloneForm"
           style="display:none; margin-bottom:12px; border:1px solid #ccc; padding:8px;"></div>

      <div id="lookupGroups">Loading...</div>
    </section>
  `;

  const groupsDiv = tabContent.querySelector("#lookupGroups");

  try {
    const url = `https://lookups-module.dennis-e64.workers.dev/lookups/list?project=${portalState.setup_project_id}`;
    const res = await fetch(url, { cache: "no-cache" });
    const data = await res.json();

    if (!res.ok || data.status !== "ok" || !Array.isArray(data.lookups)) {
      groupsDiv.innerHTML = `<p>Error loading lookups: ${escapeHtml(data.error || "Unknown error")}</p>`;
      return;
    }

    const grouped = {};
    data.lookups.forEach(row => {
      if (!grouped[row.lookup_type]) grouped[row.lookup_type] = [];
      grouped[row.lookup_type].push(row);
    });

    groupsDiv.innerHTML = Object.keys(grouped)
      .map(type => `
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
              ${grouped[type]
                .map(
                  item => `
                <tr data-id="${item.id}">
                  <td><input type="text" class="valueInput"
                             value="${escapeHtml(item.value)}" style="width:100%;"></td>
                  <td><input type="number" class="sortInput"
                             value="${item.sort_order}" style="width:70px;"></td>
                  <td>
                    <select class="activeDropdown">
                      <option value="true" ${item.is_active ? "selected" : ""}>Yes</option>
                      <option value="false" ${!item.is_active ? "selected" : ""}>No</option>
                    </select>
                  </td>
                  <td>
                    <button class="saveBtn btn-primary">Save</button>
                    <button class="deleteBtn btn-danger">Delete</button>
                  </td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <button class="addValueBtn btn-primary" data-type="${escapeHtml(type)}"
                  style="margin-top:8px;">+ Add Value</button>
        </section>
      `)
      .join("");

    /* -------------------------
       ADD GROUP
    ------------------------- */
    const addGroupBtn = tabContent.querySelector("#addGroupBtn");
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
                <button class="saveNewGroupBtn btn-primary">Save</button>
                <button class="cancelNewGroupBtn btn-secondary">Cancel</button>
              </td>
            </tr>
          </tbody>
        </table>
      `;

      const headerDiv = tabContent.querySelector(".lookup-groups-header");
      headerDiv.insertAdjacentElement("afterend", addRow);

      addRow.querySelector(".saveNewGroupBtn").addEventListener("click", async () => {
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
          project: portalState.setup_project_id,
          created_at: new Date().toISOString()
        };

        await fetch(
          "https://lookups-module.dennis-e64.workers.dev/lookups/addGroup",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          }
        );

        renderLookupsSetup(tabContent, portalState);
      });

      addRow.querySelector(".cancelNewGroupBtn").addEventListener("click", () => {
        addRow.remove();
      });
    });

/* -------------------------
   CLONE GROUP
------------------------- */
const cloneBtn = tabContent.querySelector("#btnCloneLookups");

cloneBtn.addEventListener("click", async () => {
  const formDiv = tabContent.querySelector("#cloneForm");
  formDiv.style.display = formDiv.style.display === "none" ? "block" : "none";

  if (formDiv.innerHTML !== "") return;

  const resConfig = await fetch(
    "https://lookups-module.dennis-e64.workers.dev/api/projects_config",
    { cache: "no-cache" }
  );
  const configRows = await resConfig.json();

  formDiv.innerHTML = `
    <label>Select Project to Clone From:</label>
    <select id="cloneProjectSelect"><option value="">-- choose --</option></select>
    <br/>

    <label>Select a Group:</label>
    <select id="cloneGroupSelect"><option value="">-- choose --</option></select>
    <br/>

    <button id="btnDoClone" class="btn-primary">Clone</button>
  `;

  const projectSelect = formDiv.querySelector("#cloneProjectSelect");

  // ✅ Allow SAME PROJECT to appear in dropdown
  configRows.forEach(row => {
    const opt = document.createElement("option");
    opt.value = row.project;
    opt.textContent =
      row.project === portalState.setup_project_id
        ? `${row.display_name} (current)`
        : row.display_name;

    projectSelect.appendChild(opt);
  });

  // Load groups when project changes
  projectSelect.addEventListener("change", async () => {
    const sourceProject = projectSelect.value;
    const groupSelect = formDiv.querySelector("#cloneGroupSelect");

    groupSelect.innerHTML = `<option value="">-- choose --</option>`;
    if (!sourceProject) return;

    const resSource = await fetch(
      `https://lookups-module.dennis-e64.workers.dev/lookups/list?project=${sourceProject}`,
      { cache: "no-cache" }
    );
    const sourceData = await resSource.json();

    if (sourceData.status === "ok" && Array.isArray(sourceData.lookups)) {
      const groups = [...new Set(sourceData.lookups.map(l => l.lookup_type))];
      groups.forEach(g => {
        const opt = document.createElement("option");
        opt.value = g;
        opt.textContent = g;
        groupSelect.appendChild(opt);
      });
    }
  });

  // Perform clone
  formDiv.querySelector("#btnDoClone").addEventListener("click", async () => {
    const sourceProject = projectSelect.value;
    const group = formDiv.querySelector("#cloneGroupSelect").value;

    if (!sourceProject || !group) return;

    // ❌ Prevent cloning a group into itself
    if (
      sourceProject === portalState.setup_project_id &&
      group === group // same name
    ) {
      alert("Cannot clone a group into itself. Choose a different target group.");
      return;
    }

    const resSource = await fetch(
      `https://lookups-module.dennis-e64.workers.dev/lookups/list?project=${sourceProject}`,
      { cache: "no-cache" }
    );
    const sourceData = await resSource.json();

    if (sourceData.status === "ok" && Array.isArray(sourceData.lookups)) {
      const payload = sourceData.lookups
        .filter(l => l.lookup_type === group)
        .map(l => ({
          lookup_type: l.lookup_type,
          value: l.value,
          sort_order: l.sort_order,
          is_active: l.is_active,
          project: portalState.setup_project_id,
          created_at: new Date().toISOString()
        }));

      await fetch(
        "https://lookups-module.dennis-e64.workers.dev/lookups/addValue",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      alert(`Group "${group}" cloned from ${sourceProject}.`);
      renderLookupsSetup(tabContent, portalState);
    }
  });
});


    /* -------------------------
       SAVE / DELETE / ADD VALUE
    ------------------------- */
    groupsDiv.addEventListener("click", async e => {
      const row = e.target.closest("tr");
      const id = row?.dataset?.id;

      // SAVE
      if (e.target.classList.contains("saveBtn")) {
        const value = row.querySelector(".valueInput").value.trim();
        const sort = parseInt(row.querySelector(".sortInput").value, 10);
        const active = row.querySelector(".activeDropdown").value === "true";

        const updates = { value, sort_order: sort, is_active: active };

        await fetch(
          `https://lookups-module.dennis-e64.workers.dev/lookups/edit/${id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ updates })
          }
        );

        renderLookupsSetup(tabContent, portalState);
      }

      // DELETE
      if (e.target.classList.contains("deleteBtn")) {
        if (!confirm("Delete this lookup value?")) return;

        await fetch(
          `https://lookups-module.dennis-e64.workers.dev/lookups/delete/${id}`,
          { method: "DELETE" }
        );

        renderLookupsSetup(tabContent, portalState);
      }

      // ADD VALUE
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
            <button class="saveNewValueBtn btn-primary">Save</button>
            <button class="cancelNewValueBtn btn-secondary">Cancel</button>
          </td>
        `;

        tbody.appendChild(newRow);

        newRow.querySelector(".saveNewValueBtn").addEventListener("click", async () => {
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
            project: portalState.setup_project_id,
            created_at: new Date().toISOString()
          };

          await fetch(
            "https://lookups-module.dennis-e64.workers.dev/lookups/addValue",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            }
          );

          renderLookupsSetup(tabContent, portalState);
        });

        newRow.querySelector(".cancelNewValueBtn").addEventListener("click", () => {
          newRow.remove();
        });
      }
    });
  } catch (err) {
    groupsDiv.innerHTML = `<p>Error loading lookups: ${escapeHtml(err.message)}</p>`;
  }
}
