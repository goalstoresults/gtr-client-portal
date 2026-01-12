// /ecampaigns/tab-campaigns.js
// Renders the Campaigns subtab inside E‑Campaigns

console.log("[tab-campaigns.js] loaded");



// ------------------------------------------------------------
// Fetch campaigns for the selected project
// ------------------------------------------------------------
async function fetchCampaignsForProject(project, selectedYear, portalState) {
  try {
    // 🔥 Fallback: if project is missing, use portalState.project
    project = project || portalState.project;

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
// Render Campaigns table
// ------------------------------------------------------------
export async function renderECCampaigns(container, portalState) {
  container.innerHTML = `<p>Loading campaigns...</p>`;

  try {
    const campaigns = await fetchCampaignsForProject(portalState.project.id);

    if (!campaigns || campaigns.length === 0) {
      container.innerHTML = `<p>No campaigns found.</p>`;
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
                const sent = c.sent_count ?? 0;
                const delivered = c.delivered_count ?? 0;
                const opened = c.opened_count ?? 0;
                const clicked = c.clicked_count ?? 0;

                return `
                  <tr data-campaign-id="${c.id}">
                    <td>${c.name}</td>
                    <td>${sent}</td>
                    <td>${delivered}</td>
                    <td>${opened}</td>
                    <td class="clickable-clicks" data-campaign-id="${c.id}">
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

        // Store selected campaign in portalState
        portalState.selectedCampaignId = campaignId;

        // Switch to the Campaign Clicks subtab
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
    container.innerHTML = `<p>Error loading campaigns.</p>`;
  }
}
