import { escapeHtml, formatDateTime } from "../utilities.js";

let currentSortField = "send_date";
let currentSortDirection = "desc";

const columns = [
  { key: "campaign_name", label: "Campaign" },
  { key: "subject_line", label: "Subject" },
  { key: "send_date", label: "Send Date" },
  { key: "delivered", label: "Delivered" },
  { key: "opened", label: "Opened" },
  { key: "clicked", label: "Clicked" },
  { key: "unsubscribed", label: "Unsub" },
  { key: "open_rate", label: "Open %" },
  { key: "click_rate", label: "Click %" },
  { key: "actions", label: "" }
];

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

function renderTable(rows, container, portalState, selectedYear) {
  sortCampaigns(rows);

  container.innerHTML = `
    <section class="card">
      <h3>Email Campaigns</h3>
      <table class="notes-table">
        <thead>
          <tr>${renderHeader()}</tr>
        </thead>
        <tbody>
          ${renderRows(rows)}
        </tbody>
      </table>
    </section>
  `;

  attachSortHandlers(rows, container, portalState, selectedYear);
  attachExpandHandlers(rows);
  attachClickedHandlers(rows, portalState);
}

function sortCampaigns(rows) {
  rows.sort((a, b) => {
    const x = a[currentSortField];
    const y = b[currentSortField];

    if (typeof x === "number" && typeof y === "number") {
      return currentSortDirection === "asc" ? x - y : y - x;
    }

    if (currentSortField === "send_date") {
      return currentSortDirection === "asc"
        ? new Date(x) - new Date(y)
        : new Date(y) - new Date(x);
    }

    return currentSortDirection === "asc"
      ? String(x).localeCompare(String(y))
      : String(y).localeCompare(String(x));
  });
}

function renderHeader() {
  return columns
    .map(col => {
      const isSorted = currentSortField === col.key;
      const upArrow = isSorted && currentSortDirection === "asc" ? "▲" : "△";
      const downArrow = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

      return `
        <th class="${col.key !== 'actions' ? 'sortable' : ''}" data-field="${col.key}">
          ${escapeHtml(col.label)}
          ${col.key !== "actions" ? `
            <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
              <span class="sort-up">${upArrow}</span>
              <span class="sort-down">${downArrow}</span>
            </span>
          ` : ""}
        </th>
      `;
    })
    .join("");
}

function renderRows(rows) {
  return rows
    .map(row => `
      <tr>
        <td>${escapeHtml(row.campaign_name)}</td>
        <td>${escapeHtml(row.subject_line)}</td>
        <td>${formatDateTime(row.send_date)}</td>
        <td>${row.delivered}</td>
        <td>${row.opened}</td>

        <!-- ⭐ CLICKED NUMBER IS NOW CLICKABLE -->
        <td>
          <button 
            class="campaign-clicks-link"
            data-campaign-id="${row.campaign_id}"
            data-campaign-name="${escapeHtml(row.campaign_name)}"
            data-year="${row.year}"
            style="background:none;border:none;color:#0077cc;text-decoration:underline;cursor:pointer;padding:0;"
          >
            ${row.clicked}
          </button>
        </td>

        <td>${row.unsubscribed}</td>
        <td>${row.open_rate}%</td>
        <td>${row.click_rate}%</td>
        <td><button class="expand-btn" data-id="${row.campaign_id}">▼</button></td>
      </tr>

      <tr class="detail-row" id="detail-${row.campaign_id}" style="display:none;">
        <td colspan="10">
          <div class="detail-box" style="padding: 12px;">
            <div class="detail-field">
              <strong>Campaign Name</strong><br>
              <span class="detail-value">${escapeHtml(row.campaign_name)}</span>
            </div>

            <div class="detail-field" style="margin-top: 12px;">
              <strong>Subject Line</strong><br>
              <span class="detail-value">${escapeHtml(row.subject_line)}</span>
            </div>

            <div class="detail-field" style="margin-top: 12px;">
              <strong>Send Date (Eastern Time)</strong><br>
              <span class="detail-value">${formatDateTime(row.send_date)}</span>
            </div>

            <div class="detail-field" style="margin-top: 12px;">
              <strong>Raw Email Content</strong><br>
              <pre class="detail-value" style="white-space: pre-wrap; margin: 0;">
${escapeHtml(row.raw_text)}
              </pre>
            </div>
          </div>
        </td>
      </tr>
    `)
    .join("");
}

function attachSortHandlers(rows, container, portalState, selectedYear) {
  container.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const field = th.dataset.field;

      if (currentSortField === field) {
        currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
      } else {
        currentSortField = field;
        currentSortDirection = "asc";
      }

      renderTable(rows, container, portalState, selectedYear);
    });
  });
}

function attachExpandHandlers(rows) {
  document.querySelectorAll(".expand-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const detailRow = document.getElementById(`detail-${id}`);

      const isHidden = detailRow.style.display === "none";

      if (isHidden) {
        detailRow.style.display = "table-row";
        btn.textContent = "▲";
      } else {
        detailRow.style.display = "none";
        btn.textContent = "▼";
      }
    });
  });
}

//
// ⭐ STEP 1: CLICKED NUMBER HANDLER
//
function attachClickedHandlers(rows, portalState) {
  document.querySelectorAll(".campaign-clicks-link").forEach(btn => {
    btn.addEventListener("click", () => {
      const campaignId = btn.dataset.campaignId;
      const campaignName = btn.dataset.campaignName;
      const year = btn.dataset.year;

      portalState.selectedCampaignId = campaignId;
      portalState.selectedCampaignName = campaignName;
      portalState.selectedCampaignYear = year;

      // ⭐ NEW: enable the subtab before clicking it
      const tabButton = document.querySelector('[data-subtab="campaign-clicks"]');
      if (tabButton) {
        tabButton.disabled = false;
        tabButton.classList.remove("disabled");
        tabButton.click();
      }
    });
  });
}

