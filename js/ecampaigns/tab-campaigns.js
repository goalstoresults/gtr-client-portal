// tab-campaigns.js

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
// Format date to Eastern Time
// ------------------------------------------------------------
function formatEastern(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

// ------------------------------------------------------------
// Render Campaigns subtab
// ------------------------------------------------------------
export async function renderECCampaigns(container, portalState) {
  container.innerHTML = `<p>Loading campaigns...</p>`;

  try {
    const project = portalState.project;
    const selectedYear = portalState.selectedCampaignYear || null;

    if (!project) {
      container.innerHTML = `<section class="card"><p>No project selected.</p></section>`;
      return;
    }

    const campaigns = await fetchCampaignsForProject(project, selectedYear);

    if (!campaigns || campaigns.length === 0) {
      container.innerHTML = `<section class="card"><p>No campaigns found.</p></section>`;
      return;
    }

    // ------------------------------------------------------------
    // Render campaign grid with collapsible detail rows
    // ------------------------------------------------------------
    container.innerHTML = `
      <section class="card">
        <h3>Campaigns</h3>
        <table class="striped">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Sent</th>
              <th>Delivered</th>
              <th>Opened</th>
              <th>Clicked</th>
            </tr>
          </thead>
          <tbody>
            ${campaigns
              .map((c) => {
                const sent = c.delivered_count ?? 0;
                const delivered = c.delivered_count ?? 0;
                const opened = c.opened_count ?? 0;
                const clicked = c.clicked_count ?? 0;

                const sendDate = formatEastern(c.send_date);

                return `
                  <tr class="campaign-row" data-campaign-id="${c.campaign_id}">
                    <td class="toggle-cell" data-campaign-id="${c.campaign_id}">
                      <span class="toggle-arrow" data-campaign-id="${c.campaign_id}">▼</span>
                    </td>
                    <td>${c.campaign_name}</td>
                    <td>${sent}</td>
                    <td>${delivered}</td>
                    <td>${opened}</td>
                    <td class="clickable-clicks" data-campaign-id="${c.campaign_id}">
                      ${clicked}
                    </td>
                  </tr>

                  <tr class="detail-row" id="detail-${c.campaign_id}" style="display:none;">
                    <td colspan="6">
                      <div class="detail-block">
                        <p><strong>Campaign Name</strong><br>${c.campaign_name}</p>
                        <p><strong>Subject Line</strong><br>${c.subject_line || ""}</p>
                        <p><strong>Send Date (Eastern)</strong><br>${sendDate}</p>
                        <p><strong>Raw Email Text</strong><br><pre>${c.raw_text || ""}</pre></p>
                      </div>
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
    // Expand/collapse logic
    // ------------------------------------------------------------
    container.querySelectorAll(".toggle-cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        const id = cell.dataset.campaignId;
        const detailRow = document.getElementById(`detail-${id}`);
        const arrow = container.querySelector(`.toggle-arrow[data-campaign-id="${id}"]`);

        if (!detailRow) return;

        const isOpen = detailRow.style.display === "table-row";

        detailRow.style.display = isOpen ? "none" : "table-row";
        arrow.textContent = isOpen ? "▼" : "▲";
      });
    });

    // ------------------------------------------------------------
    // Click-through to Campaign Clicks subtab
    // ------------------------------------------------------------
    container.querySelectorAll(".clickable-clicks").forEach((cell) => {
      cell.addEventListener("click", () => {
        const campaignId = cell.dataset.campaignId;

        portalState.selectedCampaignId = campaignId;

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
