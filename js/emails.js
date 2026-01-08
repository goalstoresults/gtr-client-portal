// emails.js
// Main controller for the Emails module

import { renderEmailAdd } from "./emails/tab-add.js";
import { renderEmailList } from "./emails/tab-list.js";
import { renderEmailReview } from "./emails/tab-review.js";
import { renderEmailData } from "./emails/tab-email-data.js";
import { renderEmailSystem } from "./emails/tab-system.js";

export async function loadEmailsTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/emails.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  const content = document.getElementById("emailsContent");
  const buttons = tabContent.querySelectorAll("#emails-subtabs button");

  // ------------------------------------------------------------
  // ⭐ GLOBAL PROJECT SELECTOR (new)
  // ------------------------------------------------------------
  const selectorRow = document.getElementById("emails-project-selector");
  selectorRow.innerHTML = `
    <label style="font-weight:bold; margin-right:8px;">Project:</label>
    <select id="emails-projectSelect" class="form-control" style="width:240px;">
      <option value="">--- Select Project ---</option>
    </select>
  `;

  const projectSelect = document.getElementById("emails-projectSelect");

  // Load all clients
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

  // Restore previous selection if exists
  if (portalState.selectedProjectId) {
    projectSelect.value = portalState.selectedProjectId;
  }

  // Handle project selection
  projectSelect.addEventListener("change", () => {
    const selectedProject = projectSelect.value;
    portalState.selectedProjectId = selectedProject;

    const selectedRow = configRows.find(r => r.project === selectedProject);
    portalState.selectedProjectName = selectedRow?.display_name || "";

    // Clear content until user clicks a tab
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

      // SYSTEM TAB — does NOT require project selection
      if (subtab === "system") {
        await renderEmailSystem(content, portalState);
        return;
      }

      // ADD TAB — allowed without project (but will show read-only field)
      if (subtab === "add") {
        await renderEmailAdd(content, portalState);
        return;
      }

      // ALL OTHER TABS REQUIRE PROJECT
      if (!portalState.selectedProjectId) {
        content.innerHTML = `
          <section class="card warning">
            <p>Please select a project to continue.</p>
          </section>
        `;
        return;
      }

      if (subtab === "list") {
        await renderEmailList(content, portalState);
        return;
      }

      if (subtab === "review") {
        await renderEmailReview(content, portalState);
        return;
      }

      if (subtab === "email-data") {
        await renderEmailData(content, portalState);
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
