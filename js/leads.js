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

  // 🔧 Inject lead context bar -- mirrors the contacts.js context bar.
  // tab-list.js owns keeping this current once a lead is selected, added,
  // or deleted (it writes directly to #lead-context-bar) -- this just needs
  // to create the element and set its correct state on initial load,
  // restoring from localStorage if portalState hasn't been hydrated yet
  // (e.g. on a page refresh).
  let contextBar = document.getElementById("lead-context-bar");
  if (!contextBar) {
    contextBar = document.createElement("div");
    contextBar.id = "lead-context-bar";
    // Reuses the same styling as the contacts context bar -- no new CSS
    // needed as long as .contact-context-bar exists in your stylesheet.
    contextBar.className = "contact-context-bar";
    tabContent.prepend(contextBar);
  }

  // Match contacts.js's behavior: landing on this tab always starts
  // blank, no restore-from-localStorage. A lead selection only lives
  // for as long as you stay within the Leads tab - navigate away to
  // any other top-level tab (or switch projects) and it resets, same
  // as "No contact selected" does when you leave and return to
  // Contacts. localStorage is no longer used for this at all.
  portalState.activeLeadId = null;
  portalState.activeLeadName = "";
  portalState.activeLeadContactName = "";
  localStorage.removeItem("activeLeadId");
  localStorage.removeItem("activeLeadName");
  localStorage.removeItem("activeLeadContactName");

  contextBar.textContent = portalState.activeLeadId
    ? `Lead: ${portalState.activeLeadName} (${portalState.activeLeadContactName})`
    : "No Lead Selected";
  contextBar.style.display = "block";

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
    btn.addEventListener("click", async () => {
      const key = btn.dataset.subtab;
      const renderer = TAB_RENDERERS[key];
      const tabLabel = btn.textContent;

      // ⭐ FIX: update active tab styling
      subtabsContainer.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      if (renderer) {
        renderer(content, portalState, { tabLabel });
      }
    });
  });

  // ⭐ Always open List first
  const listBtn = subtabsContainer.querySelector('button[data-subtab="list"]');
  if (listBtn) listBtn.click();
}
