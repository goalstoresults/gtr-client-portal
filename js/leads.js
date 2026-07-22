// js/leads.js

import { renderLeadsList } from "./leads/tab-list.js";
import { renderLeadClient } from "./leads/tab-client.js";
import { renderLeadDetails } from "./leads/tab-details.js";
import { renderLeadServices } from "./leads/tab-services.js";
import { renderLeadPricing } from "./leads/tab-pricing.js";
import { renderLeadSchedule } from "./leads/tab-schedule.js";
import { renderLeadTimeline } from "./leads/tab-timeline.js";

const TAB_RENDERERS = {
  list: renderLeadsList,
  contact: renderLeadClient,      // CSI calls this "Client"
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
     2. LOAD PROJECT LEAD CONFIG
  ============================================================ */

  const project = portalState.project;  // "csi", "gtr", etc.

  const configRes = await fetch(`/api/project-lead-config?project=${project}`);
  const leadConfig = await configRes.json();

  const tabs = leadConfig.tabs.filter(t => t.enabled);

  /* ============================================================
     3. RENDER SUBTABS DYNAMICALLY
  ============================================================ */

  const subtabsContainer = tabContent.querySelector("#leads-subtabs");
  subtabsContainer.innerHTML = ""; // wipe CSI hardcoded buttons

  tabs.forEach(tab => {
    const btn = document.createElement("button");
    btn.dataset.subtab = tab.key;
    btn.textContent = tab.label;
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
     5. SUBTAB ROUTER (DYNAMIC)
  ============================================================ */

  const content = tabContent.querySelector("#leadsContent");

  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {

      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;

      const renderer = TAB_RENDERERS[subtab];

      if (!renderer) {
        content.innerHTML = `<section class="card"><p>Tab not implemented.</p></section>`;
        return;
      }

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

