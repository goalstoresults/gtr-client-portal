// inspections.js
// Main controller for the Inspections module

import { renderInspectionAdd } from "./inspections/tab-add.js";
import { renderInspectionList } from "./inspections/tab-list.js";
import { renderInspectionSummary } from "./inspections/tab-summary.js";
import { renderInspectionRevenue } from "./inspections/tab-revenue.js";

/* ============================================================
   PUBLIC ENTRY POINT (required by your portal)
============================================================ */
export async function loadInspectionsTab({ portalState, tabContent }) {
  // Load the HTML shell EXACTLY like financials.js
  const res = await fetch("./components/inspections.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  // Now the HTML exists in the DOM
  initInspectionsModule(portalState, tabContent);
}

/* ============================================================
   INIT MODULE
============================================================ */
export function initInspectionsModule(portalState, tabContent) {
  const container = tabContent.querySelector("#inspectionsContent");
  const tabs = tabContent.querySelector("#inspectionsTabs");

  if (!container || !tabs) {
    console.error("Inspections module container missing.");
    return;
  }

  // Default tab
  loadTab("add");

  /* ------------------------------------------------------------
     Wire subtab buttons
  ------------------------------------------------------------ */
  tabs.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      loadTab(tab);
    });
  });

  /* ------------------------------------------------------------
     Load a tab
  ------------------------------------------------------------ */
  async function loadTab(tab) {
    tabs.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });

    container.innerHTML = `<p>Loading...</p>`;

    switch (tab) {
      case "add":
        await renderInspectionAdd(container, portalState);
        break;

      case "list":
        await renderInspectionList(container, portalState);
        break;

      case "summary":
        await renderInspectionSummary(container, portalState);
        break;

      case "revenue":
        await renderInspectionRevenue(container, portalState);
        break;

      default:
        container.innerHTML = `<p>Unknown tab: ${tab}</p>`;
        break;
    }
  }
}
