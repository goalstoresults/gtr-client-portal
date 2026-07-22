// js/leads.js

import { renderLeadsList } from "./leads/tab-list.js";
import { renderLeadContact } from "./leads/tab-contact.js";
import { renderLeadDetails } from "./leads/tab-details.js";
import { renderLeadServices } from "./leads/tab-services.js";
import { renderLeadPricing } from "./leads/tab-pricing.js";
import { renderLeadSchedule } from "./leads/tab-schedule.js";
import { renderLeadTimeline } from "./leads/tab-timeline.js";

export async function loadLeadsTab({ portalState, tabContent }) {

  // Load base HTML
  const res = await fetch("./components/leads.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  const subtabsContainer = tabContent.querySelector("#leads-subtabs");
  const content = tabContent.querySelector("#leadsContent");

  // Fetch dynamic config
  const configRes = await fetch(
    `https://leads-module.dennis-e64.workers.dev/leads/config?project=${portalState.project}`
  );
  const configData = await configRes.json();

  // FIX: config is an array → use index 0
  const tabs = ((configData[0]?.tabs) || []).filter(t => t.enabled);

  // Inject buttons
  tabs.forEach(tab => {
    const btn = document.createElement("button");
    btn.dataset.subtab = tab.key;
    btn.textContent = tab.label;
    subtabsContainer.appendChild(btn);
  });

  // Renderer map
  const TAB_RENDERERS = {
    list: renderLeadsList,
    contact: renderLeadContact,
    details: renderLeadDetails,
    services: renderLeadServices,
    pricing: renderLeadPricing,
    calendar: renderLeadSchedule,
    timeline: renderLeadTimeline
  };

  // FIX: Always pass tabLabel
  subtabsContainer.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.subtab;
      const renderer = TAB_RENDERERS[key];
      const tabLabel = btn.textContent;

      if (renderer) {
        renderer(content, portalState, { tabLabel });
      }
    });
  });
}

