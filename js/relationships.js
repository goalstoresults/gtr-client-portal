// relationships.js
// Main controller for the Relationships module

import { renderRelList } from "./relationships/tab-list.js";
import { renderRelDetails } from "./relationships/tab-details.js";
import { renderRelSettings } from "./relationships/tab-settings.js";

export async function loadRelationshipsTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/relationships.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  const content = document.getElementById("relationshipsContent");
  const buttons = tabContent.querySelectorAll("#relationships-subtabs button");

  // ------------------------------------------------------------
  // SUBTAB HANDLERS
  // ------------------------------------------------------------
  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      // Highlight active button
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;

      if (subtab === "list") {
        await renderRelList(content, portalState);
        return;
      }

      if (subtab === "details") {
        await renderRelDetails(content, portalState);
        return;
      }

      if (subtab === "settings") {
        await renderRelSettings(content, portalState);
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

  // Default view
  content.innerHTML = `
    <section class="card">
      <p>Select a subtab to begin.</p>
    </section>
  `;
}
