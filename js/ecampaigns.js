// ecampaigns.js
// Main controller for the ECampaigns intelligence module

import { renderECOverview } from "./ecampaigns/tab-overview.js";
import { renderECCampaigns } from "./ecampaigns/tab-campaigns.js";
import { renderECTopContacts } from "./ecampaigns/tab-top-contacts.js";
import { renderECSegmentation } from "./ecampaigns/tab-segmentation.js";
import { renderECTimeline } from "./ecampaigns/tab-timeline.js";
import { renderECContactActivity } from "./ecampaigns/tab-contact-activity.js";

export async function loadECCampaignsTab({ portalState, tabContent }) {
  const res = await fetch("./components/ecampaigns.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  // Inject context bar
  let contextBar = document.getElementById("ecampaigns-context-bar");
  if (!contextBar) {
    contextBar = document.createElement("div");
    contextBar.id = "ecampaigns-context-bar";
    contextBar.className = "contact-context-bar";
    tabContent.prepend(contextBar);
  }

  contextBar.textContent = portalState.selectedContactName
    ? `Contact: ${portalState.selectedContactName}`
    : "No contact selected";

  const content = tabContent.querySelector("#ecampaignsContent");
  const buttons = tabContent.querySelectorAll("#ecampaigns-subtabs button");

  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;

      if (subtab === "overview") {
        await renderECOverview(content, portalState);
        return;
      }

      if (subtab === "campaigns") {
        await renderECCampaigns(content, portalState);
        return;
      }

      if (subtab === "top-contacts") {
        await renderECTopContacts(content, portalState);
        return;
      }

      if (subtab === "segmentation") {
        await renderECSegmentation(content, portalState);
        return;
      }

      if (subtab === "timeline") {
        await renderECTimeline(content, portalState);
        return;
      }

      if (subtab === "contact-activity") {
        await renderECContactActivity(content, portalState);
        return;
      }

      // fallback

      content.innerHTML = `
        <section class="card">
          <p>Select a subtab to begin.</p>
        </section>
      `;
    });
  });

  // Default to Campaigns view
  const defaultBtn = tabContent.querySelector(
    '#ecampaigns-subtabs button[data-subtab="campaigns"]'
  );

  if (defaultBtn) {
    defaultBtn.classList.add("active");
    await renderECCampaigns(content, portalState);
  }
}
