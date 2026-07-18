// js/dashboard.js

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

  // Hide admin-only subtabs
  buttons.forEach(btn => {
    const subtab = btn.dataset.subtab;
    if ((subtab === "defaults" || subtab === "staff") && !fullAdmin) {
      btn.remove();
    }
  });

  // Re-select buttons after removals
  const wiredButtons = tabContent.querySelectorAll("#dashboard-subtabs button");

  // Wire subtab clicks
  wiredButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      wiredButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;

      switch (subtab) {
        case "stats":
          await renderDashboardStats(content, portalState);
          break;

        case "defaults":
          await renderDashboardDefaults(content, portalState);
          break;

        case "staff":
          await renderDashboardStaff(content, portalState);
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

  // ⭐ ALWAYS ACTIVATE STATS WHEN TOP MENU "Dashboard" IS CLICKED
  const statsBtn = tabContent.querySelector(
    '#dashboard-subtabs button[data-subtab="stats"]'
  );

  if (statsBtn) {
    statsBtn.classList.add("active");
    await renderDashboardStats(content, portalState);
  }
}
