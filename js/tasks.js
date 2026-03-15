// tasks.js

import { loadTasksList } from "./tasks/tab-list.js";
import { loadTasksAdd } from "./tasks/tab-add.js";
import { loadTasksLookups } from "./tasks/tab-lookups.js";
import { loadTasksOverview } from "./tasks/tab-overview.js";

export async function loadTasksTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/tasks.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  const content = tabContent.querySelector("#tasksContent");
  const buttons = tabContent.querySelectorAll("#tasks-subtabs button");

  // ⭐ NEW — Normalize role and hide Lookups tab if not admin
  const role = (portalState.task_manager || "").trim().toLowerCase();
  if (role !== "admin") {
    const lookupsBtn = tabContent.querySelector('#tasks-subtabs button[data-subtab="lookups"]');
    if (lookupsBtn) lookupsBtn.style.display = "none";
  }

  // --- Subtab Router ---
  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      // Reset active state
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;

      // ⭐ NEW — Block routing to Lookups if not admin
      if (subtab === "lookups" && role !== "admin") {
        content.innerHTML = `
          <section class="card">
            <p>You do not have permission to access Lookups.</p>
          </section>
        `;
        return;
      }

      switch (subtab) {
        case "list":
          await loadTasksList({ portalState, container: content });
          break;

        case "add":
          await loadTasksAdd({ portalState, container: content });
          break;

        case "lookups":
          await loadTasksLookups({ portalState, container: content });
          break;

        case "overview":
          await loadTasksOverview({ portalState, container: content });
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

  // ⭐ DEFAULT TO LIST VIEW
  const defaultBtn = tabContent.querySelector('#tasks-subtabs button[data-subtab="list"]');
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    await loadTasksList({ portalState, container: content });
  }
}
