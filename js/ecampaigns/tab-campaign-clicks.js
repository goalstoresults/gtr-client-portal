import { escapeHtml, formatDateTime } from "../utilities.js";

//
// Campaign Clicks Tab
//
export async function renderECCampaignClicks(container, portalState) {
  const campaignId = portalState.selectedCampaignId;
  const selectedYear = portalState.selectedCampaignYear;

  if (!campaignId || !selectedYear) {
    container.innerHTML = `
      <section class="card">
        <h3>Campaign Clicks</h3>
        <p>No campaign selected.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <h3 style="display:flex; align-items:center; gap:12px;">
        Campaign Clicks
        <span id="cc-campaign-dropdown"></span>
      </h3>

      <p>Loading click data...</p>
    </section>
  `;

  //
  // 1. Load all campaigns for the selected year (for dropdown)
  //
  const campaignsRes = await fetch(
    `https://ecampaigns-module.dennis-e64.workers.dev/analytics/campaigns?project=${portalState.project}&year=${selectedYear}`,
    { cache: "no-cache" }
  );

  let campaigns = await campaignsRes.json();
  if (!Array.isArray(campaigns)) campaigns = [];

  //
  // Populate dropdown
  //
  const dropdownContainer = container.querySelector("#cc-campaign-dropdown");
  dropdownContainer.innerHTML = `
    <label><strong>Campaign:</strong></label>
    <select id="cc-campaign-select" style="margin-left:6px;">
      ${campaigns
        .map(
          c => `
        <option value="${c.campaign_id}" ${c.campaign_id === campaignId ? "selected" : ""}>
          ${escapeHtml(c.campaign_name)}
        </option>`
        )
        .join("")}
    </select>
  `;

  const campaignSelect = container.querySelector("#cc-campaign-select");

  //
  // 2. Load click data for the selected campaign
  //
  await loadClickData(container, portalState, campaignSelect.value);

  //
  // 3. Wire dropdown change
  //
  campaignSelect.addEventListener("change", async () => {
    portalState.selectedCampaignId = campaignSelect.value;
    await loadClickData(container, portalState, campaignSelect.value);
  });
}

//
// Load matched + unmatched clickers
//
async function loadClickData(container, portalState, campaignId) {
  const res = await fetch(
    `https://ecampaigns-module.dennis-e64.workers.dev/analytics/campaign-clicks?project=${portalState.project}&campaign_id=${campaignId}`,
    { cache: "no-cache" }
  );

  const data = await res.json();

  const matched = Array.isArray(data.matched) ? data.matched : [];
  const unmatched = Array.isArray(data.unmatched) ? data.unmatched : [];

  renderClickTables(container, matched, unmatched);
}

//
// Render the two tables
//
function renderClickTables(container, matched, unmatched) {
  container.innerHTML = `
    <section class="card">
      <h3 style="display:flex; align-items:center; gap:12px;">
        Campaign Clicks
        <span id="cc-campaign-dropdown"></span>
      </h3>

      <h4>Matched Clickers</h4>
      <table class="notes-table">
        <thead>
          <tr>
            <th>Contact Name</th>
            <th>Contact Type</th>
            <th>Clicks (All)</th>
            <th>Opens (All)</th>
            <th>Clicked This Campaign</th>
          </tr>
        </thead>
        <tbody>
          ${
            matched.length === 0
              ? `<tr><td colspan="5" style="text-align:center;">No matched clickers.</td></tr>`
              : matched
                  .map(
                    m => `
            <tr>
              <td>${escapeHtml(m.contact_name)}</td>
              <td>${escapeHtml(m.contact_type || "")}</td>
              <td>${m.total_clicks ?? 0}</td>
              <td>${m.total_opens ?? 0}</td>
              <td>${formatDateTime(m.action_date)}</td>
            </tr>
          `
                  )
                  .join("")
          }
        </tbody>
      </table>

      <h4 style="margin-top:24px;">Unmatched Clicks (Staging)</h4>
      <table class="notes-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Action Date</th>
            <th>Raw Text</th>
          </tr>
        </thead>
        <tbody>
          ${
            unmatched.length === 0
              ? `<tr><td colspan="3" style="text-align:center;">No unmatched clicks.</td></tr>`
              : unmatched
                  .map(
                    u => `
            <tr>
              <td>${escapeHtml(u.email)}</td>
              <td>${formatDateTime(u.action_date)}</td>
              <td><pre style="white-space:pre-wrap;margin:0;">${escapeHtml(
                u.raw_text || ""
              )}</pre></td>
            </tr>
          `
                  )
                  .join("")
          }
        </tbody>
      </table>
    </section>
  `;
}
