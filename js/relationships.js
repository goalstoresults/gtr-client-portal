// relationships.js
// Main controller for the Relationships module

import { renderRelList } from "./relationships/tab-list.js";
import { renderRelDetails } from "./relationships/tab-details.js";
import { renderRelSettings } from "./relationships/tab-settings.js";

export async function loadRelationshipsTab({ portalState, tabContent }) {
  // Ensure project state exists (same pattern as Emails)
  if (!("staffSelectedProjectId" in portalState)) {
    portalState.staffSelectedProjectId = "";
    portalState.staffSelectedProjectName = "";
  }

  // Load base HTML template
  const res = await fetch("./components/relationships.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  const content = document.getElementById("relationshipsContent");
  const buttons = tabContent.querySelectorAll("#relationships-subtabs button");

  // ------------------------------------------------------------
  // ⭐ STAFF PROJECT SELECTOR (same pattern as Emails)
  // ------------------------------------------------------------
  const selectorRow = document.getElementById("relationships-staff-project-selector");
  selectorRow.innerHTML = `
    <label style="font-weight:bold; margin-right:8px;">Project:</label>
    <select id="relationships-projectSelect" class="form-control" style="width:240px;">
      <option value="">--- Select Project ---</option>
    </select>
  `;

  const projectSelect = document.getElementById("relationships-projectSelect");

  // Load all projects
  const resConfig = await fetch(
    "https://lookups-module.dennis-e64.workers.dev/api/projects_config",
    { cache: "no-cache" }
  );
  const configRows = await resConfig.json();

  configRows.forEach(row => {
    const opt = document.createElement("option");
    opt.value = row.project;
    opt.textContent = row.display_name;
    projectSelect.appendChild(opt);
  });

  // Restore previous staff selection if exists
  if (portalState.staffSelectedProjectId) {
    projectSelect.value = portalState.staffSelectedProjectId;
  }

  // Handle project selection
  projectSelect.addEventListener("change", () => {
    const selectedProject = projectSelect.value;
    portalState.staffSelectedProjectId = selectedProject;

    const selectedRow = configRows.find(r => r.project === selectedProject);
    portalState.staffSelectedProjectName = selectedRow?.display_name || "";

    // Clear content until user clicks a subtab
    content.innerHTML = `
      <section class="card">
        <p>Select a subtab to begin.</p>
      </section>
    `;
  });

  // ------------------------------------------------------------
  // SUBTAB HANDLERS
  // ------------------------------------------------------------
  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;

      // SETTINGS TAB — does NOT require project selection
      if (subtab === "settings") {
        await renderRelSettings(content, portalState);
        return;
      }

      // ALL OTHER TABS REQUIRE STAFF PROJECT
      if (!portalState.staffSelectedProjectId) {
        content.innerHTML = `
          <section class="card warning">
            <p>Please select a project to continue.</p>
          </section>
        `;
        return;
      }

      if (subtab === "list") {
        await renderRelList(content, portalState);
        return;
      }

      if (subtab === "details") {
        await renderRelDetails(content, portalState);
        return;
      }

      // Fallback
      content.innerHTML = `
        <section class="card">
          <p>Select a subtab to begin.</p>
        </section>
      `;
    });
  });

  // Default view
  content.innerHTML = `
    <section class="card">
      <p>Select a subtab to begin.</p>
    </section>
  `;
}
