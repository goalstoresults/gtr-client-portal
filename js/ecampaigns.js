// /ecampaigns.js
// E‑Campaigns module controller — loads HTML, initializes subtabs, routes to subtab modules

// import { renderECOverview } from "./ecampaigns/tab-overview.js";   // ⬅️ COMMENTED OUT
import { renderECCampaigns } from "./ecampaigns/tab-campaigns.js";
import { renderECTopContacts } from "./ecampaigns/tab-top-contacts.js";
import { renderECSegmentation } from "./ecampaigns/tab-segmentation.js";
import { renderECCampaignClicks } from "./ecampaigns/tab-campaign-clicks.js";

console.log("[ECampaigns.js] loaded");

// ------------------------------------------------------------
// Load E‑Campaigns Tab
// ------------------------------------------------------------
export async function loadECCampaignsTab({ portalState, tabContent }) {
  await loadPartial("/components/ecampaigns.html", tabContent);
  initECCampaigns(portalState);
}

// ------------------------------------------------------------
// Load HTML partial
// ------------------------------------------------------------
async function loadPartial(url, tabContent) {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

    const html = await res.text();
    tabContent.innerHTML = html;

    const header = tabContent.querySelector("h2");
    if (header) header.textContent = "E‑Campaigns";
  } catch (err) {
    tabContent.innerHTML = `
      <section class="card">
        <p>Error loading partial (${url}): ${err.message}</p>
      </section>
    `;
  }
}

// ------------------------------------------------------------
// Initialize E‑Campaigns module
// ------------------------------------------------------------
function initECCampaigns(portalState) {
  window.portalState = portalState;

  // Base message
  const container = document.getElementById("ec-subtab-content");
  if (container) container.innerHTML = `<p>Select a subtab to begin.</p>`;

  // Wire subtab buttons
  document.querySelectorAll("#ec-subtabs button").forEach(btn => {
    btn.addEventListener("click", () =>
      loadECSubtab(btn.dataset.subtab, portalState)
    );
  });

  // If user clicked a "Clicked" number from Campaigns tab
  if (portalState.selectedCampaignId) {
    enableSubtab("campaign-clicks", true);
    loadECSubtab("campaign-clicks", portalState);
    return;
  }

  // ⭐ DEFAULT SUBTAB (Overview removed → Campaigns is now default)
  loadECSubtab("campaigns", portalState);
}

// ------------------------------------------------------------
// Enable/disable subtabs
// ------------------------------------------------------------
function enableSubtab(subtab, enabled) {
  const btn = document.querySelector(
    `#ec-subtabs button[data-subtab="${subtab}"]`
  );
  if (btn) {
    btn.disabled = !enabled;
    btn.classList.toggle("disabled", !enabled);
  }
}

// ------------------------------------------------------------
// Subtab Router
// ------------------------------------------------------------
async function loadECSubtab(subtab, portalState) {
  const container = document.getElementById("ec-subtab-content");
  if (!container) return;

  if (!portalState.project) {
    container.innerHTML = `<p>No project selected.</p>`;
    return;
  }

  container.innerHTML = `<p>Loading ${subtab}...</p>`;

  // Update active UI
  document
    .querySelectorAll("#ec-subtabs button")
    .forEach(btn => btn.classList.remove("active"));

  document
    .querySelector(`#ec-subtabs button[data-subtab="${subtab}"]`)
    ?.classList.add("active");

  // Route to subtab modules
  // if (subtab === "overview") return renderECOverview(container, portalState);   // ⬅️ COMMENTED OUT
  if (subtab === "campaigns") return renderECCampaigns(container, portalState);
  if (subtab === "top-contacts") return renderECTopContacts(container, portalState);
  if (subtab === "segmentation") return renderECSegmentation(container, portalState);

  // ⭐ NEW SUBTAB — Campaign Clicks
  if (subtab === "campaign-clicks") {
    enableSubtab("campaign-clicks", true);
    return renderECCampaignClicks(container, portalState);
  }

  container.innerHTML = `<p>Unknown subtab</p>`;
}

