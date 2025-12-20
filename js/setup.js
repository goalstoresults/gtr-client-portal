// setup.js

// Central list of valid contact fields (matches contacts table + derived fields)
const CONTACT_FIELD_OPTIONS = [
  "first_name",
  "last_name",
  "contact_name",
  "business_name",
  "email",
  "phone",
  "website",
  "title",
  "source",
  "contact_type",
  "search_name",
  "updated_at",
];

// ---------- Utils ----------

function escapeHtml(str) {
  return str?.replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c])) || "";
}

// ---------- Entry point ----------

export async function loadSetupTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/setup.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  // ✅ Inject Setup context bar (mirrors Contacts tab)
  let contextBar = document.getElementById("setup-context-bar");
  if (!contextBar) {
    contextBar = document.createElement("div");
    contextBar.id = "setup-context-bar";
    contextBar.className = "contact-context-bar";
    tabContent.prepend(contextBar);
  }

  // ✅ Show selected client name (or fallback)
  contextBar.textContent = portalState.display_name
    ? `GTR Client: ${portalState.display_name}`
    : "No client selected";

  // ✅ Wire subtabs
  const subtabs = tabContent.querySelector("#setup-subtabs");
  const setupContent = tabContent.querySelector("#setupContent");

  subtabs.querySelectorAll("button[data-subtab]").forEach(btn => {
    btn.addEventListener("click", () => {
      // Clear active state
      subtabs.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Route to correct subtab
      switch (btn.dataset.subtab) {
        case "client":
          renderClientSetup(setupContent, portalState);
          break;

        case "contact":
          renderContactSetup(setupContent, portalState);
          break;

        case "contact-list":
          renderContactListSetup(setupContent, portalState);
          break;

        case "lookups":
          renderSetupLookups(setupContent, portalState);
          break;

        default:
          setupContent.innerHTML = `
            <section class="card">
              <p>Select a subtab to begin.</p>
            </section>
          `;
      }
    });
  });

  // ✅ Default to Client tab on load
  const defaultBtn = subtabs.querySelector('button[data-subtab="client"]');
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    renderClientSetup(setupContent, portalState);
  }
}


// ---------- Client setup ----------

async function renderClientSetup(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2>Select Client</h2>
        <button id="btnAddClient" class="btn-primary">Add Client</button>
      </div>

      <div style="margin-top:16px;">
        <label><strong>Client:</strong></label>
        <select id="clientSelect" style="margin-left:12px;">
          <option value="">---Select---</option>
        </select>
      </div>

      <div id="clientDetails" style="margin-top:24px;"></div>
    </section>
  `;

  const select = container.querySelector("#clientSelect");
  const detailsDiv = container.querySelector("#clientDetails");

  // ✅ Fetch all project configs
  const resConfig = await fetch(
    "https://lookups-module.dennis-e64.workers.dev/api/projects_config",
    { cache: "no-cache" }
  );
  const configRows = await resConfig.json();

  // ✅ Populate dropdown
  configRows.forEach(row => {
    const opt = document.createElement("option");
    opt.value = row.project;
    opt.textContent = row.display_name;
    if (row.project === portalState.setup_project_id) opt.selected = true;
    select.appendChild(opt);
  });

  // ✅ Add new client
  container.querySelector("#btnAddClient").addEventListener("click", async () => {
    const projectId = prompt("Enter new project ID (short code):");
    if (!projectId) return;

    const displayName = prompt("Enter display name for client:");
    if (!displayName) return;

    const payload = {
      project: projectId,
      display_name: displayName,
      created_at: new Date().toISOString(),
      enabled_tabs: [],
      owner_ghl_id: "",
      search_name_source: "contact"
    };

    await fetch(
      "https://lookups-module.dennis-e64.workers.dev/api/projects_config",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    alert("Client added.");
    renderClientSetup(container, portalState);
  });

  // ✅ When a client is selected
  select.addEventListener("change", () => {
    const selectedProject = select.value;
    portalState.setup_project_id = selectedProject;

    const selectedRow = configRows.find(r => r.project === selectedProject);
    portalState.display_name = selectedRow?.display_name || "";

    // ✅ Update Setup context bar
    const contextBar = document.getElementById("setup-context-bar");
    if (contextBar) {
      contextBar.textContent = portalState.display_name
        ? `GTR Client: ${portalState.display_name}`
        : "No client selected";
    }

    if (!selectedRow) {
      detailsDiv.innerHTML = "";
      return;
    }

    const enabled = selectedRow.enabled_tabs || [];
    const allTabs = [
      { tab_id: "1", description: "Contacts" },
      { tab_id: "2", description: "Financials" },
      { tab_id: "3", description: "Notes" },
      { tab_id: "4", description: "Tasks" },
      { tab_id: "5", description: "Lookups" },
      { tab_id: "6", description: "Dashboard" },
      { tab_id: "7", description: "Groups" },
      { tab_id: "8", description: "Setup" }
    ];

    // ✅ Render client details + tab config
    detailsDiv.innerHTML = `
      <section class="card">
        <p><strong>Project:</strong> ${escapeHtml(selectedRow.project)}</p>

        <label><strong>Display Name:</strong></label>
        <input id="displayNameInput" value="${escapeHtml(selectedRow.display_name || "")}"
               style="width:100%; margin-bottom:16px;">

        <div style="display:flex; gap:16px; margin-bottom:16px;">
          <div style="flex:1;">
            <label><strong>Contact First Name:</strong></label>
            <input id="contactFirstInput" value="${escapeHtml(selectedRow.contact_first || "")}"
                   style="width:100%;">
          </div>

          <div style="flex:1;">
            <label><strong>Contact Last Name:</strong></label>
            <input id="contactLastInput" value="${escapeHtml(selectedRow.contact_last || "")}"
                   style="width:100%;">
          </div>

          <div style="flex:1;">
            <label><strong>Contact Name:</strong></label>
            <p id="contactNameDisplay">${escapeHtml(selectedRow.contact_name || "")}</p>
          </div>
        </div>

        <label><strong>Business Name:</strong></label>
        <input id="businessNameInput" value="${escapeHtml(selectedRow.business_name || "")}"
               style="width:100%; margin-bottom:12px;">

        <label><strong>Contact Email:</strong></label>
        <input id="contactEmailInput" value="${escapeHtml(selectedRow.contact_email || "")}"
               style="width:100%; margin-bottom:24px;">

        <label><strong>Owner GHL ID:</strong></label>
        <input id="ownerGhlIdInput" value="${escapeHtml(selectedRow.owner_ghl_id || "")}"
               style="width:100%; margin-bottom:24px;">

        <label><strong>Search Name Source:</strong></label>
        <select id="searchNameSourceSelect" style="width:100%; margin-bottom:24px;">
          <option value="contact" ${selectedRow.search_name_source === "contact" ? "selected" : ""}>
            Contact — always use contact name
          </option>
          <option value="business" ${selectedRow.search_name_source === "business" ? "selected" : ""}>
            Business — always use business name
          </option>
          <option value="mix" ${selectedRow.search_name_source === "mix" ? "selected" : ""}>
            Mix — business if present, otherwise contact
          </option>
        </select>

        <h3>Enabled Tabs</h3>
        <table id="tabConfigGrid" class="notes-table" style="width:100%; margin-top:12px;">
          <thead>
            <tr>
              <th style="width:80px;">Enabled</th>
              <th>Tab Name</th>
              <th style="width:120px;">Sort Order</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>

        <button id="btnSaveConfig" class="btn-primary" style="margin-top:12px;">Save Config</button>
      </section>
    `;

    // ✅ Populate tab config grid
    const gridBody = detailsDiv.querySelector("#tabConfigGrid tbody");
    gridBody.innerHTML = allTabs
      .map(tab => {
        const checked = enabled.includes(tab.tab_id) ? "checked" : "";
        const sortIndex = enabled.indexOf(tab.tab_id);

        return `
          <tr>
            <td style="text-align:center;">
              <input type="checkbox" data-tabid="${tab.tab_id}" ${checked}>
            </td>
            <td>${escapeHtml(tab.description)}</td>
            <td>
              <input type="number" min="1" max="99"
                     value="${sortIndex >= 0 ? sortIndex + 1 : ""}"
                     style="width:80px;" data-sort="${tab.tab_id}">
            </td>
          </tr>
        `;
      })
      .join("");

    // ✅ Save config
    detailsDiv.querySelector("#btnSaveConfig").addEventListener("click", async () => {
      const checkedTabs = [];

      gridBody.querySelectorAll("input[type=checkbox]").forEach(cb => {
        if (cb.checked) {
          const sortInput = gridBody.querySelector(`input[data-sort="${cb.dataset.tabid}"]`);
          const sortVal = parseInt(sortInput.value, 10);
          checkedTabs.push({
            tab_id: cb.dataset.tabid,
            sort: Number.isFinite(sortVal) ? sortVal : 99
          });
        }
      });

      checkedTabs.sort((a, b) => a.sort - b.sort);
      const newEnabledTabs = checkedTabs.map(t => t.tab_id);

      const patchPayload = {
        enabled_tabs: newEnabledTabs,
        display_name: detailsDiv.querySelector("#displayNameInput").value.trim(),
        business_name: detailsDiv.querySelector("#businessNameInput").value.trim(),
        contact_first: detailsDiv.querySelector("#contactFirstInput").value.trim(),
        contact_last: detailsDiv.querySelector("#contactLastInput").value.trim(),
        contact_email: detailsDiv.querySelector("#contactEmailInput").value.trim(),
        contact_name:
          `${detailsDiv.querySelector("#contactFirstInput").value.trim()} ${detailsDiv.querySelector("#contactLastInput").value.trim()}`.trim(),
        owner_ghl_id: detailsDiv.querySelector("#ownerGhlIdInput").value.trim(),
        search_name_source: detailsDiv.querySelector("#searchNameSourceSelect").value
      };

      await fetch(
        `https://lookups-module.dennis-e64.workers.dev/api/projects_config?project=${encodeURIComponent(
          selectedRow.project
        )}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchPayload)
        }
      );

      alert("Config saved.");

      // ✅ Refresh UI
      renderClientSetup(container, portalState);
    });
  });

  // ✅ Auto-trigger if already selected
  if (select.value) {
    select.dispatchEvent(new Event("change"));
  }
}


// ---------- Lookups setup ----------
async function renderSetupLookups(tabContent, portalState) {
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
    const url =
      `https://lookups-module.dennis-e64.workers.dev/lookups/list?project=${portalState.setup_project_id}`;
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
            `).join("")}
          </tbody>
        </table>
        <button class="addValueBtn btn-primary" data-type="${escapeHtml(type)}"
                style="margin-top:8px;">+ Add Value</button>
      </section>
    `).join("");

    // Add group inline
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

        renderSetupLookups(tabContent, portalState);
      });

      addRow.querySelector(".cancelNewGroupBtn").addEventListener("click", () => {
        addRow.remove();
      });
    });

    // Clone group fold-out
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
        <label>Select Another Project:</label>
        <select id="cloneProjectSelect"><option value="">-- choose --</option></select>
        <br/>
        <label>Select a Group:</label>
        <select id="cloneGroupSelect"><option value="">-- choose --</option></select>
        <br/>
        <button id="btnDoClone" class="btn-primary">Clone</button>
      `;

      const projectSelect = formDiv.querySelector("#cloneProjectSelect");
      configRows.forEach(row => {
        if (row.project !== portalState.setup_project_id) {
          const opt = document.createElement("option");
          opt.value = row.project;
          opt.textContent = row.display_name;
          projectSelect.appendChild(opt);
        }
      });

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

      formDiv.querySelector("#btnDoClone").addEventListener("click", async () => {
        const sourceProject = projectSelect.value;
        const group = formDiv.querySelector("#cloneGroupSelect").value;
        if (!sourceProject || !group) return;

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
          renderSetupLookups(tabContent, portalState);
        }
      });
    });

    // Save/Delete/Add value delegation
    groupsDiv.addEventListener("click", async e => {
      const row = e.target.closest("tr");
      const id = row?.dataset?.id;

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

        renderSetupLookups(tabContent, portalState);
      }

      if (e.target.classList.contains("deleteBtn")) {
        if (!confirm("Delete this lookup value?")) return;
        await fetch(
          `https://lookups-module.dennis-e64.workers.dev/lookups/delete/${id}`,
          { method: "DELETE" }
        );
        renderSetupLookups(tabContent, portalState);
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

          renderSetupLookups(tabContent, portalState);
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





// ---------- Contact Add setup ----------
async function renderContactSetup(container, portalState) {
  if (!portalState.setup_project_id) {
    container.innerHTML = `
      <section class="card">
        <p>Please select a project in the Client tab before configuring Contact Add fields.</p>
      </section>
    `;
    return;
  }

  // Load lookup groups + sections
  const resLookups = await fetch(
    `https://lookups-module.dennis-e64.workers.dev/lookups/list?project=${portalState.setup_project_id}`,
    { cache: "no-cache" }
  );
  const lookupsData = await resLookups.json();

  const lookupGroups = Array.isArray(lookupsData.lookups)
    ? [...new Set(lookupsData.lookups.map(l => l.lookup_type))].sort()
    : [];

  const sectionValues = Array.isArray(lookupsData.lookups)
    ? lookupsData.lookups
        .filter(l => l.lookup_type === "section")
        .map(l => l.value)
    : [];

  // Render shell
  container.innerHTML = `
    <section class="card">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <h2>Contact Add Setup for ${escapeHtml(portalState.display_name || portalState.setup_project_id)}</h2>
        <div>
          <button id="btnAddAddField" class="btn-secondary" style="margin-right:8px;">+ Add Field</button>
          <button id="btnDefaultAddMode" class="btn-secondary" style="margin-right:8px;">Default Mode</button>
          <button id="btnSaveAddConfig" class="btn-primary">Save Config</button>
        </div>
      </div>

      <p>Enable fields for the Add form, customize labels, set order, bind lookup groups, and assign sections.</p>

      <table id="contactAddFieldsGrid" class="notes-table" style="width:100%; margin-top:12px;">
        <thead>
          <tr>
            <th style="width:60px;">Enabled</th>
            <th style="width:200px;">System Field</th>
            <th style="width:200px;">Label</th>
            <th style="width:100px;">Order</th>
            <th style="width:180px;">Lookup Type</th>
            <th style="width:160px;">Section</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </section>
  `;

  const gridBody = container.querySelector("#contactAddFieldsGrid tbody");

  // Load existing config
  const url =
    `https://lookups-module.dennis-e64.workers.dev/contact_fields?project=${portalState.setup_project_id}`;
  const res = await fetch(url, { cache: "no-cache" });
  const data = await res.json();

  const configured = Array.isArray(data.rows)
    ? data.rows.filter(r => r.contact_tab === "add")
    : [];

  const defaultBtn = container.querySelector("#btnDefaultAddMode");

  // ✅ Default Mode only appears when there are NO rows
  if (configured.length > 0) {
    defaultBtn.style.display = "none";
  } else {
    defaultBtn.style.display = "inline-block";

    defaultBtn.addEventListener("click", () => {
      const defaults = [
        { field_key: "first_name", label: "First Name", sort_order: 10, section: "General" },
        { field_key: "last_name", label: "Last Name", sort_order: 20, section: "General" },
        { field_key: "business_name", label: "Business Name", sort_order: 30, section: "General" },
        { field_key: "email", label: "Email", sort_order: 40, section: "General" },
        { field_key: "phone", label: "Phone", sort_order: 50, section: "General" },
        { field_key: "contact_type", label: "Contact Type", sort_order: 60, section: "General" }
      ];

      gridBody.innerHTML = defaults.map(row => {
        const field = row.field_key;
        const label = row.label;
        const order = row.sort_order;
        const section = row.section;
        const placeholder = field.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

        const lookupOptions = [`<option value="">-- none --</option>`]
          .concat(lookupGroups.map(g => `<option value="${g}">${g}</option>`))
          .join("");

        const sectionOptions = [`<option value="">-- none --</option>`]
          .concat(sectionValues.map(s => `<option value="${s}" ${s === section ? "selected" : ""}>${s}</option>`))
          .join("");

        const systemFieldOptions = [`<option value="">-- select field --</option>`]
          .concat(CONTACT_FIELD_OPTIONS.map(
            f => `<option value="${f}" ${f === field ? "selected" : ""}>${f}</option>`
          ))
          .join("");

        return `
          <tr data-field="${field}">
            <td style="text-align:center;"><input type="checkbox" class="enableCheckbox" checked></td>
            <td><select class="systemFieldSelect" style="width:100%;">${systemFieldOptions}</select></td>
            <td><input type="text" class="labelInput" value="${escapeHtml(label)}" placeholder="${escapeHtml(placeholder)}" style="width:100%;"></td>
            <td><input type="number" class="orderInput" value="${order}" style="width:70px;"></td>
            <td><select class="lookupTypeSelect" style="width:100%;">${lookupOptions}</select></td>
            <td><select class="sectionSelect" style="width:100%;">${sectionOptions}</select></td>
          </tr>
        `;
      }).join("");
    });
  }

  // ✅ Render existing rows dynamically
  const sortedRows = configured.sort((a, b) => a.sort_order - b.sort_order);

  function toTitleCase(field) {
    return field
      .split("_")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  gridBody.innerHTML = sortedRows.map(row => {
    const field = row.field_key;
    const label = row.label || "";
    const order = row.sort_order || "";
    const boundLookup = row.lookup_type || "";
    const section = row.section || "";
    const placeholder = toTitleCase(field);

    const lookupOptions = [`<option value="">-- none --</option>`]
      .concat(lookupGroups.map(
        g => `<option value="${g}" ${boundLookup === g ? "selected" : ""}>${g}</option>`
      ))
      .join("");

    const sectionOptions = [`<option value="">-- none --</option>`]
      .concat(sectionValues.map(
        s => `<option value="${s}" ${section === s ? "selected" : ""}>${s}</option>`
      ))
      .join("");

    const systemFieldOptions = [`<option value="">-- select field --</option>`]
      .concat(CONTACT_FIELD_OPTIONS.map(
        f => `<option value="${f}" ${f === field ? "selected" : ""}>${f}</option>`
      ))
      .join("");

    return `
      <tr data-field="${field}">
        <td style="text-align:center;"><input type="checkbox" class="enableCheckbox" checked></td>
        <td><select class="systemFieldSelect" style="width:100%;">${systemFieldOptions}</select></td>
        <td><input type="text" class="labelInput" value="${escapeHtml(label)}" placeholder="${escapeHtml(placeholder)}" style="width:100%;"></td>
        <td><input type="number" class="orderInput" value="${order}" style="width:70px;"></td>
        <td><select class="lookupTypeSelect" style="width:100%;">${lookupOptions}</select></td>
        <td><select class="sectionSelect" style="width:100%;">${sectionOptions}</select></td>
      </tr>
    `;
  }).join("");

  // ✅ Add Field
  container.querySelector("#btnAddAddField").addEventListener("click", () => {
    const used = new Set(
      [...gridBody.querySelectorAll("tr")].map(tr => {
        const explicit = tr.dataset.field;
        const selectVal = tr.querySelector(".systemFieldSelect")?.value;
        return selectVal || explicit || "";
      }).filter(Boolean)
    );

    const available = CONTACT_FIELD_OPTIONS.filter(f => !used.has(f));
    if (!available.length) {
      alert("All contact fields are already configured.");
      return;
    }

    const lookupOptions = [`<option value="">-- none --</option>`]
      .concat(lookupGroups.map(g => `<option value="${g}">${g}</option>`))
      .join("");

    const sectionOptions = [`<option value="">-- none --</option>`]
      .concat(sectionValues.map(s => `<option value="${s}">${s}</option>`))
      .join("");

    const systemFieldOptions = [`<option value="">-- select field --</option>`]
      .concat(available.map(f => `<option value="${f}">${f}</option>`))
      .join("");

    const newRow = document.createElement("tr");
    newRow.dataset.field = "";
    newRow.innerHTML = `
      <td style="text-align:center;"><input type="checkbox" class="enableCheckbox" checked></td>
      <td><select class="systemFieldSelect" style="width:100%;">${systemFieldOptions}</select></td>
      <td><input type="text" class="labelInput" placeholder="Label" style="width:100%;"></td>
      <td><input type="number" class="orderInput" value="99" style="width:70px;"></td>
      <td><select class="lookupTypeSelect" style="width:100%;">${lookupOptions}</select></td>
      <td><select class="sectionSelect" style="width:100%;">${sectionOptions}</select></td>
    `;
    gridBody.appendChild(newRow);
  });

  // ✅ Save
  container.querySelector("#btnSaveAddConfig").addEventListener("click", async () => {
    await saveContactSetup(portalState, "add", gridBody);
  });
}



// ---------- Contact List setup ----------
async function renderContactListSetup(container, portalState) {
  if (!portalState.setup_project_id) {
    container.innerHTML = `
      <section class="card">
        <p>Please select a project in the Client tab before configuring Contact List fields.</p>
      </section>
    `;
    return;
  }

  // Load lookup groups + sections
  const resLookups = await fetch(
    `https://lookups-module.dennis-e64.workers.dev/lookups/list?project=${portalState.setup_project_id}`,
    { cache: "no-cache" }
  );
  const lookupsData = await resLookups.json();

  const lookupGroups = Array.isArray(lookupsData.lookups)
    ? [...new Set(lookupsData.lookups.map(l => l.lookup_type))].sort()
    : [];

  const sectionValues = Array.isArray(lookupsData.lookups)
    ? lookupsData.lookups
        .filter(l => l.lookup_type === "section")
        .map(l => l.value)
    : [];

  // Render shell
  container.innerHTML = `
    <section class="card">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <h2>Contact List Setup for ${escapeHtml(portalState.display_name || portalState.setup_project_id)}</h2>
        <div>
          <button id="btnAddListField" class="btn-secondary" style="margin-right:8px;">+ Add Field</button>
          <button id="btnDefaultListMode" class="btn-secondary" style="margin-right:8px;">Default Mode</button>
          <button id="btnSaveListConfig" class="btn-primary">Save Config</button>
        </div>
      </div>

      <p>Enable fields for the List view, customize labels, set order, bind lookup groups, and assign sections.</p>

      <table id="contactListFieldsGrid" class="notes-table" style="width:100%; margin-top:12px;">
        <thead>
          <tr>
            <th style="width:60px;">Enabled</th>
            <th style="width:200px;">System Field</th>
            <th style="width:200px;">Label</th>
            <th style="width:100px;">Order</th>
            <th style="width:180px;">Lookup Type</th>
            <th style="width:160px;">Section</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </section>
  `;

  const gridBody = container.querySelector("#contactListFieldsGrid tbody");

  // Load existing config
  const url =
    `https://lookups-module.dennis-e64.workers.dev/contact_fields?project=${portalState.setup_project_id}`;
  const res = await fetch(url, { cache: "no-cache" });
  const data = await res.json();

  const configured = Array.isArray(data.rows)
    ? data.rows.filter(r => r.contact_tab === "list")
    : [];

  const defaultBtn = container.querySelector("#btnDefaultListMode");

  // ✅ Default Mode only appears when there are NO rows
  if (configured.length > 0) {
    defaultBtn.style.display = "none";
  } else {
    defaultBtn.style.display = "inline-block";

    defaultBtn.addEventListener("click", () => {
      const defaults = [
        { field_key: "search_name", label: "Name", sort_order: 10, section: "General" },
        { field_key: "first_name", label: "First Name", sort_order: 20, section: "General" },
        { field_key: "last_name", label: "Last Name", sort_order: 30, section: "General" },
        { field_key: "business_name", label: "Business Name", sort_order: 40, section: "General" },
        { field_key: "email", label: "Email", sort_order: 50, section: "General" },
        { field_key: "contact_type", label: "Contact Type", sort_order: 60, section: "General" },
        { field_key: "updated_at", label: "Last Updated", sort_order: 70, section: "" }
      ];

      gridBody.innerHTML = defaults.map(row => {
        const field = row.field_key;
        const label = row.label;
        const order = row.sort_order;
        const section = row.section;
        const placeholder = field.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

        const lookupOptions = [`<option value="">-- none --</option>`]
          .concat(lookupGroups.map(g => `<option value="${g}">${g}</option>`))
          .join("");

        const sectionOptions = [`<option value="">-- none --</option>`]
          .concat(sectionValues.map(s => `<option value="${s}" ${s === section ? "selected" : ""}>${s}</option>`))
          .join("");

        const systemFieldOptions = [`<option value="">-- select field --</option>`]
          .concat(CONTACT_FIELD_OPTIONS.map(
            f => `<option value="${f}" ${f === field ? "selected" : ""}>${f}</option>`
          ))
          .join("");

        return `
          <tr data-field="${field}">
            <td style="text-align:center;"><input type="checkbox" class="enableCheckbox" checked></td>
            <td><select class="systemFieldSelect" style="width:100%;">${systemFieldOptions}</select></td>
            <td><input type="text" class="labelInput" value="${escapeHtml(label)}" placeholder="${escapeHtml(placeholder)}" style="width:100%;"></td>
            <td><input type="number" class="orderInput" value="${order}" style="width:70px;"></td>
            <td><select class="lookupTypeSelect" style="width:100%;">${lookupOptions}</select></td>
            <td><select class="sectionSelect" style="width:100%;">${sectionOptions}</select></td>
          </tr>
        `;
      }).join("");
    });
  }

  // ✅ Render existing rows dynamically
  const sortedRows = configured.sort((a, b) => a.sort_order - b.sort_order);

  function toTitleCase(field) {
    return field
      .split("_")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  gridBody.innerHTML = sortedRows.map(row => {
    const field = row.field_key;
    const label = row.label || "";
    const order = row.sort_order || "";
    const boundLookup = row.lookup_type || "";
    const section = row.section || "";
    const placeholder = toTitleCase(field);

    const lookupOptions = [`<option value="">-- none --</option>`]
      .concat(lookupGroups.map(
        g => `<option value="${g}" ${boundLookup === g ? "selected" : ""}>${g}</option>`
      ))
      .join("");

    const sectionOptions = [`<option value="">-- none --</option>`]
      .concat(sectionValues.map(
        s => `<option value="${s}" ${section === s ? "selected" : ""}>${s}</option>`
      ))
      .join("");

    const systemFieldOptions = [`<option value="">-- select field --</option>`]
      .concat(CONTACT_FIELD_OPTIONS.map(
        f => `<option value="${f}" ${f === field ? "selected" : ""}>${f}</option>`
      ))
      .join("");

    return `
      <tr data-field="${field}">
        <td style="text-align:center;"><input type="checkbox" class="enableCheckbox" checked></td>
        <td><select class="systemFieldSelect" style="width:100%;">${systemFieldOptions}</select></td>
        <td><input type="text" class="labelInput" value="${escapeHtml(label)}" placeholder="${escapeHtml(placeholder)}" style="width:100%;"></td>
        <td><input type="number" class="orderInput" value="${order}" style="width:70px;"></td>
        <td><select class="lookupTypeSelect" style="width:100%;">${lookupOptions}</select></td>
        <td><select class="sectionSelect" style="width:100%;">${sectionOptions}</select></td>
      </tr>
    `;
  }).join("");

  // ✅ Add Field
  container.querySelector("#btnAddListField").addEventListener("click", () => {
    const used = new Set(
      [...gridBody.querySelectorAll("tr")].map(tr => {
        const explicit = tr.dataset.field;
        const selectVal = tr.querySelector(".systemFieldSelect")?.value;
        return selectVal || explicit || "";
      }).filter(Boolean)
    );

    const available = CONTACT_FIELD_OPTIONS.filter(f => !used.has(f));
    if (!available.length) {
      alert("All contact fields are already configured.");
      return;
    }

    const lookupOptions = [`<option value="">-- none --</option>`]
      .concat(lookupGroups.map(g => `<option value="${g}">${g}</option>`))
      .join("");

    const sectionOptions = [`<option value="">-- none --</option>`]
      .concat(sectionValues.map(s => `<option value="${s}">${s}</option>`))
      .join("");

    const systemFieldOptions = [`<option value="">-- select field --</option>`]
      .concat(available.map(f => `<option value="${f}">${f}</option>`))
      .join("");

    const newRow = document.createElement("tr");
    newRow.dataset.field = "";
    newRow.innerHTML = `
      <td style="text-align:center;"><input type="checkbox" class="enableCheckbox" checked></td>
      <td><select class="systemFieldSelect" style="width:100%;">${systemFieldOptions}</select></td>
      <td><input type="text" class="labelInput" placeholder="Label" style="width:100%;"></td>
      <td><input type="number" class="orderInput" value="99" style="width:70px;"></td>
      <td><select class="lookupTypeSelect" style="width:100%;">${lookupOptions}</select></td>
      <td><select class="sectionSelect" style="width:100%;">${sectionOptions}</select></td>
    `;
    gridBody.appendChild(newRow);
  });

  // ✅ Save
  container.querySelector("#btnSaveListConfig").addEventListener("click", async () => {
    await saveContactSetup(portalState, "list", gridBody);
  });
}



// ---------- Shared save ----------
async function saveContactSetup(portalState, tab, gridBody) {
  const rows = [];

  // Build rows from UI
  gridBody.querySelectorAll("tr").forEach(tr => {
    const enabled = tr.querySelector(".enableCheckbox")?.checked;
    if (!enabled) return;

    const rawField = tr.dataset.field || "";
    const selectField = tr.querySelector(".systemFieldSelect")?.value || "";
    const fieldKey = selectField || rawField;
    if (!fieldKey) return;

    const labelInput = tr.querySelector(".labelInput");
    const label =
      (labelInput.value.trim() || labelInput.placeholder || fieldKey).trim();

    const orderRaw = parseInt(tr.querySelector(".orderInput").value, 10);
    const sortOrder = Number.isFinite(orderRaw) ? orderRaw : 99;

    const lookupType = tr.querySelector(".lookupTypeSelect").value || null;
    const section = tr.querySelector(".sectionSelect").value || null;

    rows.push({
      field_key: fieldKey,
      label,
      sort_order: sortOrder,
      lookup_type: lookupType,
      section,
      contact_tab: tab
    });
  });

  // Save to backend
  await fetch(
    "https://lookups-module.dennis-e64.workers.dev/contact_fields/save",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: portalState.setup_project_id,
        fields: rows
      })
    }
  );

  alert(`Contact ${tab} fields saved.`);
}


