// js/pipeline.js v1.0

import { renderPipelineAdd } from "./pipeline/tab-add.js";
import { renderPipelineCurrent } from "./pipeline/tab-current.js";
import { renderPipelinePast } from "./pipeline/tab-past.js";
import { renderPipelineDetails } from "./pipeline/tab-details.js";
import { renderPipelineStats } from "./pipeline/tab-stats.js";


// 🔧 Load Pipeline Tab with subtab switching

export async function loadPipelineTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/pipeline.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  // 🔧 Inject pipeline context bar (above subtabs)
  let contextBar = document.getElementById("pipeline-context-bar");
  if (!contextBar) {
    contextBar = document.createElement("div");
    contextBar.id = "pipeline-context-bar";
    contextBar.className = "contact-context-bar"; // same styling as Contacts
    tabContent.prepend(contextBar);
  }

  contextBar.textContent = portalState.selectedLeadName
    ? `Lead: ${portalState.selectedLeadName}`
    : "No lead selected";

  const content = tabContent.querySelector("#pipelineContent");
  const buttons = tabContent.querySelectorAll("#pipeline-subtabs button");

  // 🔧 Wire subtab buttons
  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      // Reset active state
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;

      switch (subtab) {
        case "add":
          await renderPipelineAdd(content, portalState);
          break;

        case "current":
          await renderPipelineCurrent(content, portalState);
          break;

        case "past":
          await renderPipelinePast(content, portalState);
          break;

        case "details":
          if (portalState.selectedLeadId) {
            await renderPipelineDetails(
              content,
              portalState,
              portalState.selectedLeadId
            );
          } else {
            content.innerHTML = `
              <section class="card">
                <h2>Lead Details</h2>
                <p>Select a lead from Current or Past to view details.</p>
              </section>
            `;
          }
          break;

        case "stats":
          await renderPipelineStats(content, portalState);
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

  // ✅ Default to Current view when tab first loads
  const defaultBtn = tabContent.querySelector(
    '#pipeline-subtabs button[data-subtab="current"]'
  );

  if (defaultBtn) {
    defaultBtn.classList.add("active");
    await renderPipelineCurrent(content, portalState);
  }
}
