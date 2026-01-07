// emails.js
// Main controller for the Emails module

import { renderEmailAdd } from "./emails/tab-add.js";
import { renderEmailList } from "./emails/tab-list.js";
import { renderEmailReview } from "./emails/tab-review.js";
import { renderEmailData } from "./emails/tab-email-data.js";
import { renderEmailSystem } from "./emails/tab-system.js";

export async function loadEmailsTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/emails.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  // Context bar
  const contextBar = document.getElementById("emails-context-bar");
  contextBar.textContent = portalState.selectedProjectName
    ? `Project: ${portalState.selectedProjectName}`
    : "No project selected";

  const content = document.getElementById("emailsContent");
  const buttons = tabContent.querySelectorAll("#emails-subtabs button");

  // Wire subtab buttons
  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;

      // SYSTEM TAB — does NOT require project selection
      if (subtab === "system") {
        await renderEmailSystem(content, portalState);
        return;
      }

      // All other tabs require a project
      if (!portalState.selectedProjectId) {
        content.innerHTML = `
          <section class="card warning">
            <p>Please select a project to continue.</p>
          </section>
        `;
        return;
      }

      if (subtab === "add") {
        await renderEmailAdd(content, portalState);
        return;
      }

      if (subtab === "list") {
        await renderEmailList(content, portalState);
        return;
      }

      if (subtab === "review") {
        await renderEmailReview(content, portalState);
        return;
      }

      if (subtab === "email-data") {
        await renderEmailData(content, portalState);
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

  // Default to List view
  const defaultBtn = tabContent.querySelector(
    '#emails-subtabs button[data-subtab="list"]'
  );

  if (defaultBtn) {
    defaultBtn.classList.add("active");

    if (portalState.selectedProjectId) {
      await renderEmailList(content, portalState);
    } else {
      content.innerHTML = `
        <section class="card warning">
          <p>Please select a project to continue.</p>
        </section>
      `;
    }
  }
}
