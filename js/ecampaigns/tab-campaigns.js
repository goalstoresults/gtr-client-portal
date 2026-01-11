// /js/ecampaigns/tab-campaigns.js
// Client-facing Campaigns analytics tab

import { escapeHtml, formatDateTime } from "../utilities.js";

export async function renderECCampaigns(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h3>Email Campaigns</h3>
      <p>Loading campaigns...</p>
    </section>
  `;

  try {
    // ⭐ Fetch campaign analytics from the NEW ecampaigns-module Worker
    const res = await fetch(
      `https://ecampaigns-module.dennis-e64.workers.dev/analytics/campaigns?project=${portalState.project}`,
      { cache: "no-cache" }
    );

    const rows = await res.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      container.innerHTML = `
        <section class="card">
          <h3>Email Campaigns</h3>
          <p>No campaigns found.</p>
        </section>
      `;
      return;
    }

    // ⭐ Build table
    container.innerHTML = `
      <section class="card">
        <h3>Email Campaigns</h3>

        <table class="notes-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Subject</th>
              <th>Send Date</th>
              <th>Delivered</th>
              <th>Opened</th>
              <th>Clicked</th>
              <th>Unsub</th>
              <th>Open %</th>
              <th>Click %</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="ecampaigns-campaignRows"></tbody>
        </table>
      </section>
    `;

    const tbody = document.getElementById("ecampaigns-campaignRows");

    rows.forEach(row => {
      const openRate = row.delivered ? ((row.opened / row.delivered) * 100).toFixed(1) : "0.0";
      const clickRate = row.delivered ? ((row.clicked / row.delivered) * 100).toFixed(1) : "0.0";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(row.campaign_name)}</td>
        <td>${escapeHtml(row.subject_line)}</td>
        <td>${formatDateTime(row.send_date)}</td>
        <td>${row.delivered}</td>
        <td>${row.opened}</td>
        <td>${row.clicked}</td>
        <td>${row.unsubscribed}</td>
        <td>${openRate}%</td>
        <td>${clickRate}%</td>
        <td>
          <button class="expand-btn" data-id="${row.campaign_id}">▶</button>
        </td>
      `;

      tbody.appendChild(tr);

      // ⭐ Add expandable detail row
      const detailRow = document.createElement("tr");
      detailRow.className = "detail-row";
      detailRow.style.display = "none";
      detailRow.innerHTML = `
        <td colspan="10">
          <div class="detail-box" id="detail-${row.campaign_id}">
            <p>Loading details...</p>
          </div>
        </td>
      `;
      tbody.appendChild(detailRow);
    });

    // ⭐ Expand/collapse handlers
    tbody.querySelectorAll(".expand-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const detailRow = document.querySelector(`#detail-${id}`).parentElement.parentElement;

        if (detailRow.style.display === "none") {
          detailRow.style.display = "table-row";
          btn.textContent = "▼";

          const box = document.getElementById(`detail-${id}`);

          // Load details only once
          if (!box.dataset.loaded) {
            await loadCampaignDetails(id, box, portalState);
            box.dataset.loaded = "1";
          }
        } else {
          detailRow.style.display = "none";
          btn.textContent = "▶";
        }
      });
    });

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

/* ---------------------------------------------------------
   Load expandable details (metadata, raw text, engagement)
--------------------------------------------------------- */
async function loadCampaignDetails(campaignId, box, portalState) {
  try {
    const res = await fetch(
      `https://ecampaigns-module.dennis-e64.workers.dev/analytics/campaign-details?project=${portalState.project}&campaign_id=${campaignId}`,
      { cache: "no-cache" }
    );

    const data = await res.json();

    box.innerHTML = `
      <div class="detail-section">
        <h4>Metadata</h4>
        <pre>${escapeHtml(JSON.stringify(data.metadata, null, 2))}</pre>
      </div>

      <div class="detail-section">
        <h4>Raw Email Text</h4>
        <pre>${escapeHtml(data.raw_text || "")}</pre>
      </div>

      <div class="detail-section">
        <h4>Engagement</h4>
        <table class="notes-table">
          <thead>
            <tr>
              <th>Contact</th>
              <th>Action</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${
              Array.isArray(data.engagement)
                ? data.engagement
                    .map(
                      e => `
              <tr>
                <td>${escapeHtml(e.contact_name)}</td>
                <td>${escapeHtml(e.action)}</td>
                <td>${formatDateTime(e.action_date)}</td>
              </tr>
            `
                    )
                    .join("")
                : ""
            }
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.error(err);
    box.innerHTML = `<p class="error">Unable to load details.</p>`;
  }
}
