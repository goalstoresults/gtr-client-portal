/* =========================================================
   Dashboard Module (Tab 0)
   - Stats
   - Defaults (admin only)
   - Staff (admin only)
========================================================= */

export async function loadDashboardTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/dashboard.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  /* ---------------------------------------------------------
     Inject context bar (same pattern as Financials)
  --------------------------------------------------------- */
  let contextBar = document.getElementById("dashboard-context-bar");
  if (!contextBar) {
    contextBar = document.createElement("div");
    contextBar.id = "dashboard-context-bar";
    contextBar.className = "contact-context-bar";
    tabContent.prepend(contextBar);
  }

  contextBar.textContent = "Dashboard Overview";

  /* ---------------------------------------------------------
     Submenu buttons
  --------------------------------------------------------- */
  const content = tabContent.querySelector("#dashboardContent");
  const buttons = tabContent.querySelectorAll("#dashboard-subtabs button");

  // Determine which submenus to show
  const fullAdmin = portalState.full_admin === true;

  buttons.forEach(btn => {
    const subtab = btn.dataset.subtab;

    // Hide Defaults + Staff if not admin
    if ((subtab === "defaults" || subtab === "staff") && !fullAdmin) {
      btn.style.display = "none";
      return;
    }

    // Wire click handler
    btn.addEventListener("click", async () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      /* -----------------------------------------------------
         Subtab Routing
      ----------------------------------------------------- */
      if (subtab === "stats") {
        content.innerHTML = `
          <section class="card">
            <h3>Dashboard Stats</h3>
            <p>Coming soon…</p>
          </section>
        `;
        return;
      }

      if (subtab === "defaults") {
        content.innerHTML = `
          <section class="card">
            <h3>Dashboard Defaults</h3>
            <p>Coming soon…</p>
          </section>
        `;
        return;
      }

      if (subtab === "staff") {
        content.innerHTML = `
          <section class="card">
            <h3>Dashboard Staff Settings</h3>
            <p>Coming soon…</p>
          </section>
        `;
        return;
      }

      // Fallback
      content.innerHTML = `
        <section class="card">
          <p>Select a subtab to begin.</p>
        </section>
      `;
    });
  });

  /* ---------------------------------------------------------
     Default view = Stats
  --------------------------------------------------------- */
  const defaultBtn = tabContent.querySelector(
    '#dashboard-subtabs button[data-subtab="stats"]'
  );

  if (defaultBtn) {
    defaultBtn.classList.add("active");
    content.innerHTML = `
      <section class="card">
        <h3>Dashboard Stats</h3>
        <p>Coming soon…</p>
      </section>
    `;
  }
}
