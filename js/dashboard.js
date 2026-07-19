// js/dashboard.js
import { renderDashboardStats } from "./dashboard/stats.js";
import { renderDashboardDefaults } from "./dashboard/defaults.js";
import { renderDashboardStaff } from "./dashboard/staff.js";
export async function loadDashboardTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/dashboard.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();
  // Context bar (same pattern as Contacts)
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
  // Hide Defaults + Staff if not admin
  buttons.forEach(btn => {
    const subtab = btn.dataset.subtab;
    if ((subtab === "defaults" || subtab === "staff") && !fullAdmin) {
      btn.remove();
    }
  });
  // Re‑query after removals
  const wiredButtons = tabContent.querySelectorAll("#dashboard-subtabs button");
  // Subtab router (same style as Contacts.js)
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
  // Default to Stats when Dashboard top tab is clicked
  const defaultBtn = tabContent.querySelector(
    '#dashboard-subtabs button[data-subtab="stats"]'
  );
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    await renderDashboardStats(content, portalState);
  }
}
