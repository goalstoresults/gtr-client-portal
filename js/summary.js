// js/summary.js

import { renderNotesSummary } from "./summary/tab-notes-summary.js";

export async function loadSummaryTab({ portalState, tabContent }) {
  // Load base HTML
  const res = await fetch("./components/summary.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  const subtabsContainer = tabContent.querySelector("#summary-subtabs");
  const content = tabContent.querySelector("#summaryContent");

  // Summary subtabs
  const tabs = [
    {
      key: "notes-summary",
      label: "Notes Summary",
      enabled: true
    }
  ];

  // Inject buttons
  tabs.filter(tab => tab.enabled).forEach(tab => {
    const btn = document.createElement("button");
    btn.dataset.subtab = tab.key;
    btn.textContent = tab.label;
    subtabsContainer.appendChild(btn);
  });

  // Renderer map
  const TAB_RENDERERS = {
    "notes-summary": renderNotesSummary
  };

  // Subtab handlers
  subtabsContainer.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.subtab;
      const renderer = TAB_RENDERERS[key];
      const tabLabel = btn.textContent;

      // Update active tab styling
      subtabsContainer.querySelectorAll("button").forEach(b => {
        b.classList.remove("active");
      });

      btn.classList.add("active");

      if (renderer) {
        await renderer(content, portalState, { tabLabel });
      }
    });
  });

  // Always open Notes Summary first
  const notesSummaryBtn = subtabsContainer.querySelector(
    'button[data-subtab="notes-summary"]'
  );

  if (notesSummaryBtn) notesSummaryBtn.click();
}
