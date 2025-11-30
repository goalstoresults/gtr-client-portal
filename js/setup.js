export async function loadSetupTab({ portalState, tabContent }) {
  const res = await fetch("./components/setup.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  const subtabs = tabContent.querySelector("#setup-subtabs");
  const setupContent = tabContent.querySelector("#setupContent");

  subtabs.querySelectorAll("button[data-subtab]").forEach(btn => {
    btn.addEventListener("click", () => {
      subtabs.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      switch (btn.dataset.subtab) {
        case "client":
          renderClientSetup(setupContent, portalState);
          break;
        case "contact":
          renderContactSetup(setupContent, portalState);
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
}

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

  const resConfig = await fetch("https://lookups-module.dennis-e64.workers.dev/api/projects_config", { cache: "no-cache" });
  const configRows = await resConfig.json();

  // Populate dropdown
  configRows.forEach(row => {
    const opt = document.createElement("option");
    opt.value = row.project;
    opt.textContent = row.display_name;
    if (row.project === portalState.setup_project_id) opt.selected = true;
    select.appendChild(opt);
  });
  
  // Add Client button handler
  container.querySelector("#btnAddClient").addEventListener("click", async () => {
    const projectId = prompt("Enter new project ID (short code):");
    if (!projectId) return;
  
    const displayName = prompt("Enter display name for client:");
    if (!displayName) return;
  
    const payload = {
      project: projectId,
      display_name: displayName,
      created_at: new Date().toISOString(),
      enabled_tabs: [] // start empty, admin will configure later
    };
  
    const res = await fetch("https://lookups-module.dennis-e64.workers.dev/api/projects_config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  
    if (res.ok) {
      alert("Client added.");
      // Refresh the Client tab so dropdown updates
      renderClientSetup(container, portalState);
    } else {
      const text = await res.text();
      alert("Error adding client: " + text);
    }
  });

  select.addEventListener("change", () => {
    const selectedProject = select.value;
    portalState.setup_project_id = selectedProject;

    const selectedRow = configRows.find(r => r.project === selectedProject);
    if (!selectedRow) {
      detailsDiv.innerHTML = "";
      return;
    }

    const enabled = selectedRow.enabled_tabs || [];

    // Master tab list
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

    detailsDiv.innerHTML = `
      <section class="card">
        <p><strong>Project:</strong> ${selectedRow.project}</p>
        <p><strong>Display Name:</strong> ${selectedRow.display_name}</p>
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

    const gridBody = detailsDiv.querySelector("#tabConfigGrid tbody");
    gridBody.innerHTML = allTabs.map(tab => {
      const checked = enabled.includes(tab.tab_id) ? "checked" : "";
      const sortIndex = enabled.indexOf(tab.tab_id);
      return `
        <tr>
          <td style="text-align:center;">
            <input type="checkbox" data-tabid="${tab.tab_id}" ${checked}>
          </td>
          <td>${tab.description}</td>
          <td>
            <input type="number" min="1" max="99" value="${sortIndex >= 0 ? sortIndex + 1 : ""}" style="width:80px;" data-sort="${tab.tab_id}">
          </td>
        </tr>
      `;
    }).join("");

    detailsDiv.querySelector("#btnSaveConfig").addEventListener("click", async () => {
      const checkedTabs = [];
      gridBody.querySelectorAll("input[type=checkbox]").forEach(cb => {
        if (cb.checked) {
          const sortInput = gridBody.querySelector(`input[data-sort="${cb.dataset.tabid}"]`);
          const sortVal = parseInt(sortInput.value, 10);
          checkedTabs.push({ tab_id: cb.dataset.tabid, sort: Number.isFinite(sortVal) ? sortVal : 99 });
        }
      });

      checkedTabs.sort((a, b) => a.sort - b.sort);
      const newEnabledTabs = checkedTabs.map(t => t.tab_id);
      await fetch(`https://lookups-module.dennis-e64.workers.dev/api/projects_config?project=${encodeURIComponent(selectedRow.project)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled_tabs: newEnabledTabs })
      });

      alert("Config saved.");
    });
  });

  // If a project is already selected, render its details
  if (select.value) select.dispatchEvent(new Event("change"));
}



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
      <div class="lookup-groups-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <h2 style="margin:0;">Lookup Groups for ${escapeHtml(portalState.display_name || portalState.setup_project_id)}</h2>
        <div>
          <button id="btnCloneLookups" class="btn-secondary" style="margin-right:8px;">Clone Group</button>
          <button id="addGroupBtn" class="btn-primary">+ Add Lookup Group</button>
        </div>
      </div>
      <div id="cloneForm" style="display:none; margin-bottom:12px; border:1px solid #ccc; padding:8px;"></div>
      <div id="lookupGroups">Loading...</div>
    </section>
  `;

  const groupsDiv = tabContent.querySelector("#lookupGroups");

  try {
    const url = `https://lookups-module.dennis-e64.workers.dev/lookups/list?project=${portalState.setup_project_id}`;
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
                <td><input type="text" class="valueInput" value="${escapeHtml(item.value)}" style="width:100%;"></td>
                <td><input type="number" class="sortInput" value="${item.sort_order}" style="width:70px;"></td>
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
        <button class="addValueBtn btn-primary" data-type="${type}" style="margin-top:8px;">+ Add Value</button>
      </section>
    `).join("");

    // Add Group inline form
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
      addGroupBtn.insertAdjacentElement("afterend", addRow);

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

        await fetch("https://lookups-module.dennis-e64.workers.dev/lookups/addGroup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        renderSetupLookups(tabContent, portalState);
      });

      addRow.querySelector(".cancelNewGroupBtn").addEventListener("click", () => {
        addRow.remove();
      });
    });

    // Clone Group fold-out form
    const cloneBtn = tabContent.querySelector("#btnCloneLookups");
    cloneBtn.addEventListener("click", async () => {
      const formDiv = tabContent.querySelector("#cloneForm");
      formDiv.style.display = formDiv.style.display === "none" ? "block" : "none";
    
      if (formDiv.innerHTML === "") {
        const resConfig = await fetch("https://lookups-module.dennis-e64.workers.dev/api/projects_config", { cache: "no-cache" });
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
    
          const resSource = await fetch(`https://lookups-module.dennis-e64.workers.dev/lookups/list?project=${sourceProject}`, { cache: "no-cache" });
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
    
          const resSource = await fetch(`https://lookups-module.dennis-e64.workers.dev/lookups/list?project=${sourceProject}`, { cache: "no-cache" });
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

            await fetch("https://lookups-module.dennis-e64.workers.dev/lookups/addValue", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
    
            alert(`Group "${group}" cloned from ${sourceProject}.`);
            renderSetupLookups(tabContent, portalState);
          }
        });
      }
    });


    

    // Event delegation for Save/Delete/Add Value
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

        renderSetupLookups(tabContent, portalState);
      }

      if (e.target.classList.contains("deleteBtn")) {
        if (!confirm("Delete this lookup value?")) return;
        await fetch(`https://lookups-module.dennis-e64.workers.dev/lookups/delete/${id}`, {
          method: "DELETE"
        });
        renderSetupLookups(tabContent, portalState);
      }

      if (e.target.classList.contains("addValueBtn")) {
        const type = e.target.dataset.type;
        const groupSection = e.target.closest(".lookup-group");
        const tbody = groupSection.querySelector("tbody");

        const lastRow = tbody.querySelector("tr:last-child");
        const lastSort = lastRow ? parseInt(lastRow.querySelector(".sortInput")?.value || lastRow.querySelector("td:nth-child(2)")?.textContent, 10) : 0;
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
        `;   // <-- this backtick was missing
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

          await fetch("https://lookups-module.dennis-e64.workers.dev/lookups/addValue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          // Refresh the tab to show the new row
          renderSetupLookups(tabContent, portalState);
        });

        newRow.querySelector(".cancelNewValueBtn").addEventListener("click", () => {
          newRow.remove();
        });
      }
    });

  } catch (err) {
    groupsDiv.innerHTML = `<p>Error loading lookups: ${err.message}</p>`;
  }
}

async function renderContactSetup(container, portalState) {
  if (!portalState.setup_project_id) {
    container.innerHTML = `
      <section class="card">
        <p>Please select a project in the Client tab before configuring Contacts.</p>
      </section>
    `;
    return;
  }

  // Fetch project lookup groups (for dropdown options)
  const resLookups = await fetch(`https://lookups-module.dennis-e64.workers.dev/lookups/list?project=${portalState.setup_project_id}`, { cache: "no-cache" });
  const lookupsData = await resLookups.json();
  const lookupGroups = Array.isArray(lookupsData.lookups)
    ? [...new Set(lookupsData.lookups.map(l => l.lookup_type))].sort()
    : [];

  container.innerHTML = `
    <section class="card">
      <div style="display:flex; align-items:center; justify-content:space-between;">
      <h2>Contact Setup for ${escapeHtml(portalState.display_name || portalState.setup_project_id)}</h2>

        <div>
          <button id="btnDefaultMode" class="btn-secondary" style="margin-right:8px;">Default Mode</button>
          <button id="btnSaveContactConfig" class="btn-primary">Save Config</button>
        </div>
      </div>
      <p>Enable fields for this project, customize labels, set order, and bind lookup groups.</p>
      <table id="contactFieldsGrid" class="notes-table" style="width:100%; margin-top:12px;">
        <thead>
          <tr>
            <th style="width:60px;">Enabled</th>
            <th style="width:200px;">System Field</th>
            <th style="width:200px;">Label</th>
            <th style="width:100px;">Order</th>
            <th style="width:180px;">Lookup Type</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </section>
  `;

  const gridBody = container.querySelector("#contactFieldsGrid tbody");

  // Fetch existing config rows for this project (includes lookup_type after your schema change)
  const url = `https://lookups-module.dennis-e64.workers.dev/contact_fields?project=${portalState.setup_project_id}`;
  const res = await fetch(url, { cache: "no-cache" });
  const data = await res.json();
  const configured = Array.isArray(data.rows) ? data.rows : [];

  const systemFields = [
    "first_name","last_name","business_name","phone","email","contact_type",
    "address_full","street_address","city","postal_code","state","title",
    "website","additional_emails","additional_phones","additional_emails_2",
    "additional_phones_2","contact_name","last_activity","last_appointment",
    "loa_sent_date","loa_signed_date","onboarding_start_date","onboarding_completed_date",
    "last_payment_date","last_payment_amount","no_referred_clients",
    "occupation_type","group_id"
  ];

  function toTitleCase(field) {
    return field.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }

  gridBody.innerHTML = systemFields.map(field => {
    const row = configured.find(r => r.field_key === field);
    const enabled = !!row;
    const label = row ? row.label : "";
    const order = row ? row.sort_order : "";
    const boundLookup = row ? (row.lookup_type || "") : "";
    const placeholder = toTitleCase(field);

    const options = [`<option value="">-- none --</option>`]
      .concat(lookupGroups.map(g => `<option value="${g}" ${boundLookup === g ? "selected" : ""}>${g}</option>`))
      .join("");

    return `
      <tr data-field="${field}">
        <td style="text-align:center;">
          <input type="checkbox" class="enableCheckbox" ${enabled ? "checked" : ""}>
        </td>
        <td>${field}</td>
        <td>
          <input type="text" class="labelInput"
                 value="${escapeHtml(label)}"
                 placeholder="${placeholder}"
                 style="width:100%;">
        </td>
        <td><input type="number" class="orderInput" value="${order}" style="width:70px;"></td>
        <td>
          <select class="lookupTypeSelect" style="width:100%;">
            ${options}
          </select>
        </td>
      </tr>
    `;
  }).join("");

  // Default Mode
  container.querySelector("#btnDefaultMode").addEventListener("click", () => {
    const rows = gridBody.querySelectorAll("tr");
    rows.forEach((tr, idx) => {
      const checkbox = tr.querySelector(".enableCheckbox");
      const labelInput = tr.querySelector(".labelInput");
      const orderInput = tr.querySelector(".orderInput");

      checkbox.checked = true;
      if (!labelInput.value.trim()) {
        labelInput.value = labelInput.placeholder;
      }
      orderInput.value = idx + 1;
    });
  });

  // Save
  container.querySelector("#btnSaveContactConfig").addEventListener("click", async () => {
    const rows = [];
    gridBody.querySelectorAll("tr").forEach(tr => {
      const field = tr.dataset.field;
      const enabled = tr.querySelector(".enableCheckbox").checked;
      if (enabled) {
        const labelInput = tr.querySelector(".labelInput");
        const label = labelInput.value.trim() || labelInput.placeholder;
        const order = parseInt(tr.querySelector(".orderInput").value, 10) || 99;
        const lookupType = tr.querySelector(".lookupTypeSelect").value || null;
        rows.push({ field_key: field, label, sort_order: order, lookup_type: lookupType });
      }
    });

    await fetch("https://lookups-module.dennis-e64.workers.dev/contact_fields/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: portalState.setup_project_id, fields: rows })
    });

    alert("Contact fields saved.");
  });
}





// helper for safe HTML rendering
function escapeHtml(str) {
  return str?.replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c])) || "";
}
