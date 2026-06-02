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

  // Initialize module AFTER HTML is injected
  initInspectionsModule(portalState, tabContent);
}

/* ============================================================
   INIT MODULE
============================================================ */
export function initInspectionsModule(portalState, tabContent) {
  // IMPORTANT: Look inside tabContent, not document
  const container = tabContent.querySelector("#inspectionsContent");
  const tabs = tabContent.querySelector("#inspections-subtabs");

  if (!container || !tabs) {
    console.error("Inspections module container missing.");
    return;
  }

  // Default subtab
  loadTab("list");

  // Wire subtab buttons
  tabs.querySelectorAll("button[data-subtab]").forEach(btn => {
    btn.addEventListener("click", () => {
      const subtab = btn.dataset.subtab;
      loadTab(subtab);
    });
  });

  /* ------------------------------------------------------------
     Load a subtab
  ------------------------------------------------------------ */
  async function loadTab(subtab) {
    // Highlight active button
    tabs.querySelectorAll("button[data-subtab]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.subtab === subtab);
    });

    container.innerHTML = `<p>Loading...</p>`;

    if (subtab === "add") return renderInspectionAdd(container, portalState);
    if (subtab === "list") return renderInspectionList(container, portalState);
    if (subtab === "summary") return renderInspectionSummary(container, portalState);
    if (subtab === "revenue") return renderInspectionRevenue(container, portalState);

    container.innerHTML = `<p>Unknown subtab: ${subtab}</p>`;
  }
}

