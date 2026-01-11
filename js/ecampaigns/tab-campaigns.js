// /ecampaigns/tab-campaigns.js
// Renders the Campaigns subtab inside E‑Campaigns

console.log("[tab-campaigns.js] loaded");

// ------------------------------------------------------------
// Fetch campaigns for the selected project
// ------------------------------------------------------------
export async function renderECCampaigns(container, portalState, selectedYear = null) {
  container.innerHTML = `
    <section class="card">
      <h3>Email Campaigns</h3>
      <p>Loading campaigns...</p>
    </section>
  `;

  try {
    const res = await fetch(
      `https://ecampaigns-module.dennis-e64.workers.dev/analytics/campaigns?project=${portalState.project}${selectedYear ? `&year=${selectedYear}` : ""}`,
      { cache: "no-cache" }
    );

    let rows = await res.json();
    if (!Array.isArray(rows)) rows = [];

    rows.forEach(r => {
      r.delivered = r.delivered_count ?? 0;
      r.opened = r.opened_count ?? 0;
      r.clicked = r.clicked_count ?? 0;
      r.unsubscribed = r.unsubscribed_count ?? 0;

      r.open_rate = r.open_rate ? (Number(r.open_rate) * 100).toFixed(1) : "0.0";
      r.click_rate = r.click_rate ? (Number(r.click_rate) * 100).toFixed(1) : "0.0";

      r.raw_text = r.raw_text ?? "";
    });

    renderTable(rows, container, portalState, selectedYear);
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <section class="card">
        <h3>Email Campaigns</h3>
        <p class="error">Unable to load campaigns.</p>
      </section>
    `;
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
