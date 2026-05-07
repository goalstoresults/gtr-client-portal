// relationships.js
// Main controller for the Relationships module

import { renderRelList } from "./relationships/tab-list.js";
import { renderRelDetails } from "./relationships/tab-details.js";
import { renderRelOverview } from "./relationships/tab-overview.js";
import { renderClientVendorTab } from "./relationships/tab-client-vendor.js";
import { renderContactDetails } from "../contacts/tab-details.js";   // ⭐ NEW IMPORT

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

      if (subtab === "overview") {
        await renderRelOverview(content, portalState);
        return;
      }

      if (subtab === "clientVendor") {
        await renderClientVendorTab(content, portalState);
        return;
      }

      if (subtab === "contact-details") {     // ⭐ NEW ROUTER CASE
        await renderContactDetails(content, portalState, portalState.selectedContactId);
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

  // ------------------------------------------------------------
  // DEFAULT VIEW = AUTO‑LOAD LIST SUBTAB
  // ------------------------------------------------------------
  buttons.forEach(b => b.classList.remove("active"));

  const listBtn = tabContent.querySelector('#relationships-subtabs button[data-subtab="list"]');
  if (listBtn) listBtn.classList.add("active");

  await renderRelList(content, portalState);
}


