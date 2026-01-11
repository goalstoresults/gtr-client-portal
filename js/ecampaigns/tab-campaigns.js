// /ecampaigns/tab-campaigns.js

console.log("[tab-campaigns.js] loaded");

// ------------------------------------------------------------
// Fetch campaigns for a given project + optional year
// ------------------------------------------------------------
async function fetchCampaignsForProject(project, selectedYear) {
  try {
    const base = "https://ecampaigns-module.dennis-e64.workers.dev/analytics/campaigns";

    const url =
      `${base}?project=${encodeURIComponent(project)}` +
      (selectedYear ? `&year=${encodeURIComponent(selectedYear)}` : "");

    console.log("[tab-campaigns] fetching campaigns from:", url);

    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    return await res.json();
  } catch (err) {
    console.error("Error fetching campaigns:", err);
    return [];
  }
}

// ------------------------------------------------------------
// Render Campaigns subtab
// ------------------------------------------------------------
export async function renderECCampaigns(container, portalState) {
  container.innerHTML = `<p>Loading campaigns...</p>`;

  try {
    // Use the same project identifier you used in the original (working) URL
    const project = portalState.project; // if it used portalState.project.id before, change this line
    const selectedYear = portalState.selectedCampaignYear || null;

    console.log("[tab-campaigns] renderECCampaigns project:", project, "year:", selectedYear);

    const campaigns = await fetchCampaignsForProject(project, selectedYear);

    if (!campaigns || campaigns.length === 0) {
      container.innerHTML = `<section class="card"><p>No campaigns found.</p></section>`;
      return;
    }

    container.innerHTML = `
      <section class="card">
        <h3>Campaigns</h3>
        <table class="striped">
          <thead>
            <tr>
              <th>Name</th>
              <th>Sent</th>
              <th>Delivered</th>
              <th>Opened</th>
              <th>Clicked</th>
            </tr>
          </thead>
          <tbody>
            ${campaigns
              .map(c => {
                const sent = c.delivered_count ?? 0; // or whatever you used as "sent" before
                const delivered = c.delivered_count ?? 0;
                const opened = c.opened_count ?? 0;
                const clicked = c.clicked_count ?? 0;

                // use campaign_id / campaign_name from the worker
                return `
                  <tr data-campaign-id="${c.campaign_id}">
                    <td>${c.campaign_name}</td>
                    <td>${sent}</td>
                    <td>${delivered}</td>
                    <td>${opened}</td>
                    <td class="clickable-clicks" data-campaign-id="${c.campaign_id}">
                      ${clicked}
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </section>
    `;

    // ------------------------------------------------------------
    // Wire click handlers for "Clicked" column
    // ------------------------------------------------------------
    container.querySelectorAll(".clickable-clicks").forEach(cell => {
      cell.addEventListener("click", () => {
        const campaignId = cell.dataset.campaignId;
        console.log("[tab-campaigns] clicked campaign:", campaignId);

        // Store selected campaign ID for the clicks subtab
        portalState.selectedCampaignId = campaignId;

        // Enable and switch to the Campaign Clicks subtab
        const btn = document.querySelector(
          '#ec-subtabs button[data-subtab="campaign-clicks"]'
        );

        if (btn) {
          btn.disabled = false;
          btn.classList.remove("disabled");
          btn.style.display = "inline-block";
          btn.click();
        }
      });
    });
  } catch (err) {
    console.error("Error loading campaigns:", err);
    container.innerHTML = `<section class="card"><p>Error loading campaigns.</p></section>`;
  }
}
