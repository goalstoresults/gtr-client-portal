import { escapeHtml, formatDateTimeStored } from "../utilities.js";

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
  // Load campaigns for dropdown
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
  // Load click data for selected campaign
  //
  await loadClickData(container, portalState, campaignSelect.value);

  //
  // Dropdown change handler
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
// Sorting state
//
let ccSortField = "contact_name";
let ccSortDirection = "asc";

function sortClickRows(rows) {
  rows.sort((a, b) => {
    const x = a[ccSortField] ?? "";
    const y = b[ccSortField] ?? "";

    if (ccSortField === "event_timestamp_eastern") {
      return ccSortDirection === "asc"
        ? new Date(x) - new Date(y)
        : new Date(y) - new Date(x);
    }

    return ccSortDirection === "asc"
      ? String(x).localeCompare(String(y))
      : String(y).localeCompare(String(x));
  });
}

//
// Render the two tables
//
function renderClickTables(container, matched, unmatched) {
  sortClickRows(matched);
  sortClickRows(unmatched);

  container.innerHTML = `
    <section class="card">
      <h3 style="display:flex; align-items:center; gap:12px;">
        Campaign Clicks
        <span id="cc-campaign-dropdown"></span>
      </h3>

      <h4>Portal Contacts Clicked</h4>
      <table class="notes-table">
        <thead>
          <tr>
            ${renderSortableHeader("contact_name", "Contact Name")}
            ${renderSortableHeader("contact_type", "Contact Type")}
            ${renderSortableHeader("event_timestamp_eastern", "Clicked This Campaign")}
          </tr>
        </thead>
        <tbody>
          ${
            matched.length === 0
              ? `<tr><td colspan="3" style="text-align:center;">No matched clickers.</td></tr>`
              : matched
                  .map(
                    m => `
            <tr>
              <td>${escapeHtml(m.contact_name)}</td>
              <td>${escapeHtml(m.contact_type || "")}</td>
              <td>${formatDateTimeStored(m.event_timestamp_eastern)}</td>
            </tr>
          `
                  )
                  .join("")
          }
        </tbody>
      </table>

      <h4 style="margin-top:24px;">Non‑Portal Contacts Clicked</h4>
      <table class="notes-table">
        <thead>
          <tr>
            ${renderSortableHeader("email", "Email")}
            ${renderSortableHeader("event_timestamp_eastern", "Action Date")}
          </tr>
        </thead>
        <tbody>
          ${
            unmatched.length === 0
              ? `<tr><td colspan="2" style="text-align:center;">No unmatched clicks.</td></tr>`
              : unmatched
                  .map(
                    u => `
            <tr>
              <td>${escapeHtml(u.email)}</td>
              <td>${formatDateTimeStored(u.event_timestamp_eastern)}</td>
            </tr>
          `
                  )
                  .join("")
          }
        </tbody>
      </table>
    </section>
  `;

  attachClickSortHandlers(container, matched, unmatched);
}

//
// Sorting header renderer
//
function renderSortableHeader(field, label) {
  const isSorted = ccSortField === field;
  const arrow = isSorted
    ? ccSortDirection === "asc"
      ? "▲"
      : "▼"
    : "▽";

  return `
    <th class="sortable" data-field="${field}">
      ${escapeHtml(label)}
      <span style="margin-left:4px; font-size:0.8em;">${arrow}</span>
    </th>
  `;
}

//
// Sorting click handlers
//
function attachClickSortHandlers(container, matched, unmatched) {
  container.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const field = th.dataset.field;

      if (ccSortField === field) {
        ccSortDirection = ccSortDirection === "asc" ? "desc" : "asc";
      } else {
        ccSortField = field;
        ccSortDirection = "asc";
      }

      renderClickTables(container, matched, unmatched);
    });
  });
}
