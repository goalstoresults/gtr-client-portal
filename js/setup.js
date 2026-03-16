// js/setup.js
// v3.2 — Modular Setup Loader 
// (Client, Contact Add, Contact List, Lookups, Staff, Contact Diagnostics, Timeline Diagnostics)

import { renderClientSetup } from "./setup/tab-client.js";
import { renderContactAddSetup } from "./setup/tab-contact-add.js";
import { renderContactListSetup } from "./setup/tab-contact-list.js";
import { renderLookupsSetup } from "./setup/tab-lookups.js";
import { renderStaffSetup } from "./setup/tab-staff.js";
import { renderContactDiagnostics } from "./setup/tab-contact-diagnostics.js";
import { renderTimelineDiagnostics } from "./setup/tab-timeline-diags.js";   // ✅ NEW

export async function loadSetupTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/setup.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  // Inject context bar (mirrors Contacts)
  let contextBar = document.getElementById("setup-context-bar");
  if (!contextBar) {
    contextBar = document.createElement("div");
    contextBar.id = "setup-context-bar";
    contextBar.className = "contact-context-bar";
    tabContent.prepend(contextBar);
  }

  // Show selected client name
  contextBar.textContent = portalState.display_name
    ? `GTR Client: ${portalState.display_name}`
    : "No client selected";

  // Subtab buttons + content container
  const subtabs = tabContent.querySelector("#setup-subtabs");
  const setupContent = tabContent.querySelector("#setupContent");

  // Wire subtab switching
  subtabs.querySelectorAll("button[data-subtab]").forEach(btn => {
    btn.addEventListener("click", async () => {
      // Reset active state
      subtabs.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;

      switch (subtab) {
        case "client":
          await renderClientSetup(setupContent, portalState);
          break;

        case "contact":
          await renderContactAddSetup(setupContent, portalState);
          break;

        case "contact-list":
          await renderContactListSetup(setupContent, portalState);
          break;

        case "lookups":
          await renderLookupsSetup(setupContent, portalState);
          break;

        case "staff":
          await renderStaffSetup(setupContent, portalState);
          break;

        case "contact-diagnostics":
          await renderContactDiagnostics(setupContent, portalState);
          break;

        case "timeline-diagnostics":                                // ✅ NEW
          await renderTimelineDiagnostics(setupContent, portalState);
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

  // Default to Client tab on load
  const defaultBtn = subtabs.querySelector('button[data-subtab="client"]');
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    await renderClientSetup(setupContent, portalState);
  }
}
