// js/setup/tab-client.js
// v3.0 — Client Setup Subtab (extracted from legacy setup.js)

import { escapeHtml } from "../utilities.js";

export async function renderClientSetup(container, portalState) {
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

  // Fetch all project configs
  const resConfig = await fetch(
    "https://lookups-module.dennis-e64.workers.dev/api/projects_config",
    { cache: "no-cache" }
  );
  const configRows = await resConfig.json();

  // Populate dropdown
  configRows.forEach(row => {
    const opt = document.createElement("option");
    opt.value = row.project;
    opt.textContent = row.display_name;
    if (row.project === portalState.setup_project_id) opt.selected = true;
    select.appendChild(opt);
  });

  // Add new client
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

  // When a client is selected
  select.addEventListener("change", () => {
    const selectedProject = select.value;
    portalState.setup_project_id = selectedProject;

    const selectedRow = configRows.find(r => r.project === selectedProject);
    portalState.display_name = selectedRow?.display_name || "";

    // Update Setup context bar
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
      { tab_id: "6", description: "E-Campaigns" },
      { tab_id: "7", description: "Groups" },
      { tab_id: "9", description: "Operations" },
      { tab_id: "11", description: "Pipeline" },
      { tab_id: "12", description: "Filter" }
      { tab_id: "13", description: "Help" }
    ];

    // Render client details + tab config
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

    // Populate tab config grid
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

    // Save config
    detailsDiv.querySelector("#btnSaveConfig").addEventListener("click", async () => {
      const checkedTabs = [];

      gridBody.querySelectorAll("input[type=checkbox]").forEach(cb => {
        if (cb.checked) {
          const sortInput = gridBody.querySelector(
            `input[data-sort="${cb.dataset.tabid}"]`
          );
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
        contact_name: `${detailsDiv.querySelector("#contactFirstInput").value.trim()} ${detailsDiv.querySelector("#contactLastInput").value.trim()}`.trim(),
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
      renderClientSetup(container, portalState);
    });
  });

  // Auto-trigger if already selected
  if (select.value) {
    select.dispatchEvent(new Event("change"));
  }
}
