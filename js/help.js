// help.js — Router for Help Module

import { loadHelpSubmit } from "./help/tab-submit.js";
import { loadHelpMyRequests } from "./help/tab-my-requests.js";
import { loadHelpAllRequests } from "./help/tab-all-requests.js";

export async function loadHelpTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/help.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  const content = tabContent.querySelector("#helpContent");
  const buttons = tabContent.querySelectorAll("#help-subtabs button");

  /* =========================================================
     Normalize role — determine if user is admin
  ========================================================== */
  const role = (portalState.role || "").trim().toLowerCase();
  const isAdmin = role === "admin" || portalState.is_admin === true;

  // Hide "All Requests" tab if not admin
  if (!isAdmin) {
    const allBtn = tabContent.querySelector('#help-subtabs button[data-subtab="all"]');
    if (allBtn) allBtn.style.display = "none";
  }

  /* =========================================================
     Subtab Router
  ========================================================== */
  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      // Reset active state
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;

      // Block admin-only tab
      if (subtab === "all" && !isAdmin) {
        content.innerHTML = `
          <section class="card">
            <p>You do not have permission to view all help requests.</p>
          </section>
        `;
        return;
      }

      switch (subtab) {
        case "submit":
          await loadHelpSubmit({ portalState, container: content });
          break;

        case "my":
          await loadHelpMyRequests({ portalState, container: content });
          break;

        case "all":
          await loadHelpAllRequests({ portalState, container: content });
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

  /* =========================================================
     Default to Submit Help Request
  ========================================================== */
  const defaultBtn = tabContent.querySelector('#help-subtabs button[data-subtab="submit"]');
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    await loadHelpSubmit({ portalState, container: content });
  }
}
