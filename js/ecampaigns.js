import { renderECOverview } from "./ecampaigns/tab-overview.js";
import { renderECCampaigns } from "./ecampaigns/tab-campaigns.js";
import { renderECTopContacts } from "./ecampaigns/tab-top-contacts.js";
import { renderECSegmentation } from "./ecampaigns/tab-segmentation.js";
import { renderECTimeline } from "./ecampaigns/tab-timeline.js";
import { renderECContactActivity } from "./ecampaigns/tab-contact-activity.js";

// ⭐ NEW IMPORT FOR STEP 5
import { renderECCampaignClicks } from "./ecampaigns/tab-campaign-clicks.js";

//
// Helper: reveal the hidden Campaign Clicks tab
//
export function showCampaignClicksTab() {
  const btn = document.querySelector('[data-subtab="campaign-clicks"]');
  if (btn) btn.style.display = "inline-block";
}

//
// Main loader for the E‑Campaigns module
//
export async function loadECCampaignsTab(container, portalState) {
  container.innerHTML = `
    <div class="subtabs">
      <button data-subtab="overview">Overview</button>
      <button data-subtab="campaigns">Campaigns</button>
      <button data-subtab="top-contacts">Top Contacts</button>
      <button data-subtab="segmentation">Segmentation</button>
      <button data-subtab="timeline">Timeline</button>
      <button data-subtab="contact-activity">Contact Activity</button>

//      <!-- ⭐ NEW HIDDEN TAB BUTTON -->
//      <button data-subtab="campaign-clicks" style="display:none;">Campaign Clicks</button>
    </div>

    <div id="ec-subtab-content"></div>
  `;

  const content = container.querySelector("#ec-subtab-content");

  //
  // Default subtab
  //
  let activeSubtab = "overview";

  //
  // If user clicked a "Clicked" number, jump directly to Campaign Clicks
  //
  if (portalState.selectedCampaignId) {
    activeSubtab = "campaign-clicks";
    showCampaignClicksTab();
  }

  //
  // Render initial subtab
  //
  await renderSubtab(activeSubtab, content, portalState);

  //
  // Wire subtab buttons
  //
  container.querySelectorAll(".subtabs button").forEach(btn => {
    btn.addEventListener("click", async () => {
      const subtab = btn.dataset.subtab;
      await renderSubtab(subtab, content, portalState);
    });
  });
}

//
// Subtab router
//
async function renderSubtab(subtab, content, portalState) {
  if (subtab === "overview") {
    await renderECOverview(content, portalState);
  }
  else if (subtab === "campaigns") {
    await renderECCampaigns(content, portalState);
  }
  else if (subtab === "top-contacts") {
    await renderECTopContacts(content, portalState);
  }
  else if (subtab === "segmentation") {
    await renderECSegmentation(content, portalState);
  }
  else if (subtab === "timeline") {
    await renderECTimeline(content, portalState);
  }
  else if (subtab === "contact-activity") {
    await renderECContactActivity(content, portalState);
  }

  //
  // ⭐ NEW SUBTAB: Campaign Clicks
  //
  else if (subtab === "campaign-clicks") {
    await renderECCampaignClicks(content, portalState);
  }
}

