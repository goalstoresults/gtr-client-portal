// js/stats.js

import { renderStatsOverview } from "./stats/overview.js";
import { renderStatsPipeline } from "./stats/pipeline.js";
import { renderStatsStageTiming } from "./stats/stagetiming.js";

export async function loadStatsTab({ portalState, tabContent }) {
  tabContent.innerHTML = `
    <div id="stats-subtabs" class="subtabs"></div>
    <div id="statsContent"></div>
  `;

  const subtabsContainer = tabContent.querySelector("#stats-subtabs");
  const content = tabContent.querySelector("#statsContent");

  const tabs = [
    {
      key: "overview",
      label: "Overview",
      renderer: renderStatsOverview
    },
    {
      key: "pipeline",
      label: "Pipeline",
      renderer: renderStatsPipeline
    },
    {
      key: "stagetiming",
      label: "Stage Timing",
      renderer: renderStatsStageTiming
    }
  ];

  const TAB_RENDERERS = Object.fromEntries(
    tabs.map(tab => [tab.key, tab.renderer])
  );

  // Create subtab buttons.
  tabs.forEach(tab => {
    const button = document.createElement("button");

    button.type = "button";
    button.dataset.subtab = tab.key;
    button.textContent = tab.label;

    subtabsContainer.appendChild(button);
  });

  async function openSubtab(button) {
    const key = button.dataset.subtab;
    const renderer = TAB_RENDERERS[key];

    if (!renderer) return;

    subtabsContainer.querySelectorAll("button").forEach(other => {
      other.classList.toggle("active", other === button);
    });

    await renderer(content, portalState, {
      tabLabel: button.textContent
    });
  }

  // Wire subtab navigation.
  subtabsContainer.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      void openSubtab(button);
    });
  });

  // Always open Overview first.
  const overviewButton = subtabsContainer.querySelector(
    'button[data-subtab="overview"]'
  );

  if (overviewButton) {
    await openSubtab(overviewButton);
  }
}
