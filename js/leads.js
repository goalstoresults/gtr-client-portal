// js/leads.js

import { renderLeadsList } from "./leads/tab-list.js";
import { renderLeadClient } from "./leads/tab-client.js";
import { renderLeadDetails } from "./leads/tab-details.js";
import { renderLeadServices } from "./leads/tab-services.js";
import { renderLeadPricing } from "./leads/tab-pricing.js";
import { renderLeadSchedule } from "./leads/tab-schedule.js";
import { renderLeadTimeline } from "./leads/tab-timeline.js";

export async function loadLeadsTab({ portalState, tabContent }) {

  /* ============================================================
     1. LOAD BASE HTML TEMPLATE (JUST LIKE CONTACTS)
  ============================================================ */

  const res = await fetch("./components/leads.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  /* ============================================================
     2. INJECT LEAD CONTEXT BAR (JUST LIKE CONTACTS)
  ============================================================ */

  let leadBar = document.getElementById("lead-context-bar");
  if (!leadBar) {
    leadBar = document.createElement("div");
    leadBar.id = "lead-context-bar";
    leadBar.className = "contact-context-bar";   // same styling as contacts
    tabContent.prepend(leadBar);
  }

  // Default state
  leadBar.textContent = "No lead selected";
  leadBar.style.display = "block";

  /* ============================================================
     3. GET CONTENT + SUBTABS
  ============================================================ */

  const content = tabContent.querySelector("#leadsContent");
  const buttons = tabContent.querySelectorAll("#leads-subtabs button");

  /* ============================================================
     4. SUBTAB ROUTER (MATCHES CONTACTS PATTERN)
  ============================================================ */

  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {

      // Reset active state
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;

      switch (subtab) {

        case "list":
          await renderLeadsList(content, portalState, updateLeadContextBar);
          break;

        case "client":
          await renderLeadClient(content, portalState);
          break;

        case "details":
          if (portalState.activeLeadId) {
            await renderLeadDetails(content, portalState);
          } else {
            content.innerHTML = `
              <section class="card">
                <h2>Lead Details</h2>
                <p>Select a lead from the list to view details.</p>
              </section>
            `;
          }
          break;

        case "services":
          await renderLeadServices(content, portalState);
          break;

        case "pricing":
          await renderLeadPricing(content, portalState);
          break;

        case "schedule":
          await renderLeadSchedule(content, portalState);
          break;

        case "timeline":
          await renderLeadTimeline(content, portalState);
          break;

        default:
          content.innerHTML = `
            <section class="card">
              <p>Select a subtab to begin.</p>
            </section>
          `;
      }
    });
  });

  /* ============================================================
     5. UPDATE CONTEXT BAR WHEN A LEAD IS SELECTED
  ============================================================ */

  function updateLeadContextBar(lead) {
    portalState.activeLeadId = lead.lead_id;
    portalState.activeLeadName = lead.lead_name;
    portalState.activeLeadContactName = lead.contact_name;

    leadBar.textContent = `${lead.lead_name} (${lead.contact_name})`;
    leadBar.style.display = "block";
  }

  /* ============================================================
     6. DEFAULT TO LIST VIEW (JUST LIKE CONTACTS)
  ============================================================ */

  const defaultBtn = tabContent.querySelector('#leads-subtabs button[data-subtab="list"]');
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    await renderLeadsList(content, portalState, updateLeadContextBar);
  }
}
