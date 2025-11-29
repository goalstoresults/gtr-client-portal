// js/setup.js v1.0 — rollback baseline + Client subtab
import { getProjectsConfig, getTabLookups, saveProjectConfig } from "./lookups-module.js";

export async function loadSetupTab({ portalState, tabContent }) {
  // Load the partial shell
  const res = await fetch("./components/setup.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  const subtabs = tabContent.querySelector("#setup-subtabs");
  const setupContent = tabContent.querySelector("#setupContent");

  subtabs.querySelectorAll("button[data-subtab]").forEach(btn => {
    btn.addEventListener("click", () => {
      // Reset active state
      subtabs.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const sub = btn.dataset.subtab;
      switch (sub) {
        case "client":
          renderClientSetup(setupContent, portalState);
          break;
        case "contact":
          setupContent.innerHTML = `
            <section class="card">
              <h2>Contact Setup</h2>
              <p>Placeholder for field visibility/labels.</p>
            </section>
          `;
          break;
        case "lookups":
          setupContent.innerHTML = `
            <section class="card">
              <h2>Lookups Setup</h2>
              <p>Placeholder for dropdown values.</p>
            </section>
          `;
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

/* -------------------------------
   Client Setup Subtab
-------------------------------- */
async function renderClientSetup(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2>Select Client</h2>
        <button id="btnAddClient" class="primary">Add Client</button>
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

  // Fetch configs
  const configRows = await getProjectsConfig(); // [{ project, display_name, enabled_tabs }]

  // Populate dropdown
  configRows.forEach(row => {
    const opt = document.createElement("option");
    opt.value = row.project;
    opt.textContent = row.display_name;
    if (row.project === portalState.setup_project_id) opt.selected = true;
    select.appendChild(opt);
  });

  // Handle selection
  select.addEventListener("change", async () => {
    const selectedProject = select.value;
    portalState.setup_project_id = selectedProject;

    const selectedRow = configRows.find(r => r.project === selectedProject);
    if (!selectedRow) {
      detailsDiv.innerHTML = "";
      return;
    }

    // Fetch tab lookups for this project
    const tabLookups = await getTabLookups(selectedProject);
    const enabled = selectedRow.enabled_tabs || [];

    detailsDiv.innerHTML = `
      <section class="card">
        <p><strong>Project:</strong> ${selectedRow.project}</p>
        <p><strong>Display Name:</strong> ${selectedRow.display_name}</p>
        <h3>Enabled Tabs</h3>
        <div id="tabConfigGrid" class="card" style="margin-top:12px;"></div>
        <button id="btnSaveConfig" class="primary" style="margin-top:12px;">Save Config</button>
      </section>
    `;

    const grid = detailsDiv.querySelector("#tabConfigGrid");
    grid.innerHTML = tabLookups.map(tab => {
      const checked = enabled.includes(tab.tab_id) ? "checked" : "";
      const sortIndex = enabled.indexOf(tab.tab_id);
      return `
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
          <input type="checkbox" data-tabid="${tab.tab_id}" ${checked}>
          <label>${tab.description}</label>
          <input type="number" min="1" max="99" value="${sortIndex >= 0 ? sortIndex + 1 : ""}"
                 style="width:60px;" data-sort="${tab.tab_id}">
        </div>
      `;
    }).join("");

    // Save handler
    detailsDiv.querySelector("#btnSaveConfig").addEventListener("click", async () => {
      const checkedTabs = [];
      grid.querySelectorAll("input[type=checkbox]").forEach(cb => {
        if (cb.checked) {
          const sortInput = grid.querySelector(`input[data-sort="${cb.dataset.tabid}"]`);
          const sortVal = parseInt(sortInput.value, 10) || 99;
          checkedTabs.push({ tab_id: cb.dataset.tabid, sort: sortVal });
        }
      });

      checkedTabs.sort((a, b) => a.sort - b.sort);
      const newEnabledTabs = checkedTabs.map(t => t.tab_id);

      await saveProjectConfig(selectedRow.project, {
        ...selectedRow,
        enabled_tabs: newEnabledTabs
      });

      alert("✅ Config saved.");
    });
  });
}
