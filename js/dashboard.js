// js/dashboard.js
// Main controller for the Dashboard module

import { renderDashboardStats } from "./dashboard/stats.js";
import { renderDashboardDefaults } from "./dashboard/defaults.js";
import { renderDashboardStaff } from "./dashboard/staff.js";

export async function loadDashboardTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/dashboard.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  // Context bar
  let contextBar = document.getElementById("dashboard-context-bar");
  if (!contextBar) {
    contextBar = document.createElement("div");
    contextBar.id = "dashboard-context-bar";
    contextBar.className = "contact-context-bar";
    tabContent.prepend(contextBar);
  }

  contextBar.textContent = "Dashboard Overview";

  const content = tabContent.querySelector("#dashboardContent");
  const buttons = tabContent.querySelectorAll("#dashboard-subtabs button");

  const fullAdmin = portalState.full_admin === true;

  buttons.forEach(btn => {
    const subtab = btn.dataset.subtab;

    // Hide Defaults + Staff if not admin
    if ((subtab === "defaults" || subtab === "staff") && !fullAdmin) {
      btn.style.display = "none";
      return;
    }

    btn.addEventListener("click", async () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      if (subtab === "stats") {
        await renderDashboardStats(content, portalState);
        return;
      }

      if (subtab === "defaults") {
        await renderDashboardDefaults(content, portalState);
        return;
      }

      if (subtab === "staff") {
        await renderDashboardStaff(content, portalState);
        return;
      }

      content.innerHTML = `
        <section class="card">
          <p>Select a subtab to begin.</p>
        </section>
      `;
    });
  });

  // Default = Stats
  const defaultBtn = tabContent.querySelector(
    '#dashboard-subtabs button[data-subtab="stats"]'
  );

  if (defaultBtn) {
    defaultBtn.classList.add("active");
    await renderDashboardStats(content, portalState);
  }
}
