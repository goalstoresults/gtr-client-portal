// tasks.js

import { loadTasksList } from "./tasks/tab-list.js";
import { loadTasksAdd } from "./tasks/tab-add.js";
import { loadTasksEdit } from "./tasks/tab-edit.js";
import { loadTasksLookups } from "./tasks/tab-lookups.js";
import { loadTasksOverview } from "./tasks/tab-overview.js";

export async function loadTasksTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/tasks.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  const content = tabContent.querySelector("#tasksContent");
  const buttons = tabContent.querySelectorAll("#tasks-subtabs button");

  // --- Subtab Router ---
  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      // Reset active state
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;

      switch (subtab) {
        case "list":
          await loadTasksList({ portalState, container: content });
          break;

        case "add":
          await loadTasksAdd({ portalState, container: content });
          break;

        case "edit":
          await loadTasksEdit({ portalState, container: content });
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
