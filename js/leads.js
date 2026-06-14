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
     LOAD COMPONENTS
  ============================================================ */

  const contextHtml = await fetch("./components/leads-context.html").then(r => r.text());
  const componentHtml = await fetch("./components/leads.html").then(r => r.text());

  // Insert context bar + subtabs + content container
  tabContent.innerHTML = contextHtml + componentHtml;

  const leadBar = document.getElementById("lead-context-bar");
  const subContent = document.getElementById("leadsContent");

  /* ============================================================
     INITIALIZE CONTEXT BAR
  ============================================================ */

  portalState.activeLeadId = null;
  portalState.activeLeadName = null;
  portalState.activeLeadContactName = null;

  leadBar.style.display = "block";
  leadBar.innerHTML = `<span style="opacity:0.7;">No lead selected.</span>`;

  /* ============================================================
     SUBTAB SWITCHING
  ============================================================ */

  async function show(subtab) {
    switch (subtab) {
      case "list":
        await renderLeadsList(subContent, portalState, updateLeadContextBar);
        break;

      case "client":
        await renderLeadClient(subContent, portalState);
        break;

      case "details":
        await renderLeadDetails(subContent, portalState);
        break;

      case "services":
        await renderLeadServices(subContent, portalState);
        break;

      case "pricing":
        await renderLeadPricing(subContent, portalState);
        break;

      case "schedule":
        await renderLeadSchedule(subContent, portalState);
        break;

      case "timeline":
        await renderLeadTimeline(subContent, portalState);
        break;

      default:
        subContent.innerHTML = `<section class="card"><p>Unknown subtab.</p></section>`;
    }
  }

  /* ============================================================
     UPDATE BLUE CONTEXT BAR WHEN A LEAD IS SELECTED
  ============================================================ */

  function updateLeadContextBar(lead) {
    portalState.activeLeadId = lead.lead_id;
    portalState.activeLeadName = lead.lead_name;
    portalState.activeLeadContactName = lead.contact_name;

    leadBar.style.display = "block";
    leadBar.innerHTML = `
      <strong>${lead.lead_name}</strong>
      <span style="opacity:0.8;">(${lead.contact_name})</span>
    `;
  }

  /* ============================================================
     ATTACH SUBTAB CLICK HANDLERS
  ============================================================ */

  document.querySelectorAll("#leads-subtabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      const subtab = btn.dataset.subtab;
      show(subtab);
    });
  });

  /* ============================================================
     DEFAULT SUBTAB = LIST
  ============================================================ */

  show("list");
}
