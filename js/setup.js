export async function loadSetupTab({ portalState, tabContent }) {
  const res = await fetch("./components/setup.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  const subtabs = tabContent.querySelector("#setup-subtabs");
  const setupContent = tabContent.querySelector("#setupContent");

  subtabs.querySelectorAll("button[data-subtab]").forEach(btn => {
    btn.addEventListener("click", () => {
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

  const resConfig = await fetch("https://lookups-module.dennis-e64.workers.dev/api/projects_config", { cache: "no-cache" });
  const configRows = await resConfig.json();

  configRows.forEach(row => {
    const opt = document.createElement("option");
    opt.value = row.project;
    opt.textContent = row.display_name;
    if (row.project === portalState.setup_project_id) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener("change", async () => {
    const selectedProject = select.value;
    portalState.setup_project_id = selectedProject;

    const selectedRow = configRows.find(r => r.project === selectedProject);
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

    detailsDiv.innerHTML = `
      <section class="card">
        <p><strong>Project:</strong> ${selectedRow.project}</p>
        <p><strong>Display Name:</strong> ${selectedRow.display_name}</p>
        <h3>Enabled Tabs</h3>
        <table id="tabConfigGrid" class="striped" style="width:100%; margin-top:12px;">
          <thead>
            <tr>
              <th style="width:80px;">Enabled</th>
              <th>Tab Name</th>
              <th style="width:100px;">Sort Order</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <button id="btnSaveConfig" class="primary" style="margin-top:12px;">Save Config</button>
      </section>
    `;

    const gridBody = detailsDiv.querySelector("#tabConfigGrid tbody");
    gridBody.innerHTML = allTabs.map((tab, i) => {
      const checked = enabled.includes(tab.tab_id) ? "checked" : "";
      const sortIndex = enabled.indexOf(tab.tab_id);
      return `
        <tr>
          <td style="text-align:center;">
            <input type="checkbox" data-tabid="${tab.tab_id}" ${checked}>
          </td>
          <td>${tab.description}</td>
          <td>
            <input type="number" min="1" max="99" value="${sortIndex >= 0 ? sortIndex + 1 : ""}"
                   style="width:60px;" data-sort="${tab.tab_id}">
          </td>
        </tr>
      `;
    }).join("");

    detailsDiv.querySelector("#btnSaveConfig").addEventListener("click", async () => {
      const checkedTabs = [];
      gridBody.querySelectorAll("input[type=checkbox]").forEach(cb => {
        if (cb.checked) {
          const sortInput = gridBody.querySelector(`input[data-sort="${cb.dataset.tabid}"]`);
          const sortVal = parseInt(sortInput.value, 10) || 99;
          checkedTabs.push({ tab_id: cb.dataset.tabid, sort: sortVal });
        }
      });

      checkedTabs.sort((a, b) => a.sort - b.sort);
      const newEnabledTabs = checkedTabs.map(t => t.tab_id);

      await fetch(`https://lookups-module.dennis-e64.workers.dev/api/projects_config?project=eq.${encodeURIComponent(selectedRow.project)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...selectedRow,
          enabled_tabs: newEnabledTabs
        })
      });

      alert("✅ Config saved.");
    });
  });
}
