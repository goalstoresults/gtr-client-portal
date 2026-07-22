// js/leads.js

import { renderLeadsList } from "./leads/tab-list.js";
import { renderLeadContact } from "./leads/tab-contact.js";   // renamed from tab-client.js
import { renderLeadDetails } from "./leads/tab-details.js";
import { renderLeadServices } from "./leads/tab-services.js";
import { renderLeadPricing } from "./leads/tab-pricing.js";
import { renderLeadSchedule } from "./leads/tab-schedule.js";
import { renderLeadTimeline } from "./leads/tab-timeline.js";

/*
  Map tab keys → renderer functions.
  These keys MUST match the "key" values in project_lead_config.tabs.
*/
const TAB_RENDERERS = {
  list: renderLeadsList,
  contact: renderLeadContact,
  details: renderLeadDetails,
  services: renderLeadServices,
  pricing: renderLeadPricing,
  calendar: renderLeadSchedule,
  timeline: renderLeadTimeline
};

export async function loadLeadsTab({ portalState, tabContent }) {

  /* ============================================================
     1. LOAD BASE HTML TEMPLATE
  ============================================================ */

  const res = await fetch("./components/leads.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  /* ============================================================
     2. LOAD PROJECT LEAD CONFIG (dynamic tabs)
  ============================================================ */

  const project = portalState.project; // "csi", "gtr", etc.

  const configRes = await fetch(`/leads/config?project=${project}`);
  const leadConfig = await configRes.json();

  const tabs = (leadConfig.tabs || []).filter(t => t.enabled);

  /* ============================================================
     3. RENDER SUBTABS DYNAMICALLY
  ============================================================ */

  const subtabsContainer = tabContent.querySelector("#leads-subtabs");
  subtabsContainer.innerHTML = ""; // wipe CSI hardcoded buttons

  tabs.forEach(tab => {
    const btn = document.createElement("button");
    btn.dataset.subtab = tab.key;
    btn.textContent = tab.label; // dynamic label (Client, Contact, Applicant, etc.)
    subtabsContainer.appendChild(btn);
  });

  const buttons = subtabsContainer.querySelectorAll("button");

  /* ============================================================
     4. CONTEXT BAR
  ============================================================ */

  let leadBar = document.getElementById("lead-context-bar");
  if (!leadBar) {
    leadBar = document.createElement("div");
    leadBar.id = "lead-context-bar";
    leadBar.className = "contact-context-bar";
    tabContent.prepend(leadBar);
  }

  leadBar.textContent = "No lead selected";

  /* ============================================================
     5. SUBTAB ROUTER (dynamic)
  ============================================================ */

  const content = tabContent.querySelector("#leadsContent");

  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {

      // reset active state
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;
      const renderer = TAB_RENDERERS[subtab];

      if (!renderer) {
        content.innerHTML = `
          <section class="card">
            <p>Tab not implemented.</p>
          </section>
        `;
        return;
      }

      // details tab requires a selected lead
      if (subtab === "details" && !portalState.activeLeadId) {
        content.innerHTML = `
          <section class="card">
            <h2>Lead Details</h2>
            <p>Select a lead from the list to view details.</p>
          </section>
        `;
        return;
      }

      await renderer(content, portalState, updateLeadContextBar);
    });
  });

  /* ============================================================
     6. UPDATE CONTEXT BAR
  ============================================================ */

  function updateLeadContextBar(lead) {
    portalState.activeLeadId = lead.lead_id;
    portalState.activeLeadName = lead.lead_name;
    portalState.activeLeadContactName = lead.contact_name;

    leadBar.textContent = `${lead.lead_name} (${lead.contact_name})`;
  }

  /* ============================================================
     7. DEFAULT TAB = LIST
  ============================================================ */

  const listBtn = subtabsContainer.querySelector('button[data-subtab="list"]');
  if (listBtn) {
    listBtn.classList.add("active");
    await renderLeadsList(content, portalState, updateLeadContextBar);
  }
}
