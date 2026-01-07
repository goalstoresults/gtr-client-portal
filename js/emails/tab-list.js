// /emails/tab-list.js
// Renders the campaign list for the selected project

import { escapeHtml } from "../utilities.js";
import { renderEmailReview } from "./tab-review.js";
import { renderEmailData } from "./tab-email-data.js";

export async function renderEmailList(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h3>Email – Campaigns for ${escapeHtml(portalState.selectedProjectName || "")}</h3>
      <div id="emailListGrid" style="margin-top:16px;"></div>
    </section>
  `;

  const grid = document.getElementById("emailListGrid");

  try {
    const { data, error } = await supabase
      .from("project_email_campaigns")
      .select("*")
      .eq("project", portalState.selectedProjectId)
      .order("send_date", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      grid.innerHTML = `<p>No campaigns found for this project.</p>`;
      return;
    }

    const rows = data.map(row => {
      const sendDate = row.send_date
        ? new Date(row.send_date).toLocaleString("en-US", { timeZone: "America/New_York" })
        : "—";

      return `
        <tr>
          <td>${escapeHtml(row.campaign_name || "")}</td>
          <td>${escapeHtml(row.subject_line || "")}</td>
          <td>${sendDate}</td>
          <td>
            <button class="btn-secondary btn-sm" data-action="review" data-id="${row.campaign_id}">Review</button>
            <button class="btn-primary btn-sm" data-action="data" data-id="${row.campaign_id}">Email Data</button>
          </td>
        </tr>
      `;
    });

    grid.innerHTML = `
      <table class="simple-table">
        <thead>
          <tr>
            <th>Campaign Name</th>
            <th>Subject Line</th>
            <th>Send Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join("")}
        </tbody>
      </table>
    `;

    // Wire action buttons
    grid.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const campaignId = btn.dataset.id;
        const action = btn.dataset.action;

        portalState.selectedCampaignId = campaignId;

        if (action === "review") {
          await renderEmailReview(container, portalState);
        }

        if (action === "data") {
          await renderEmailData(container, portalState);
        }
      });
    });

  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p class="error">Error loading campaigns.</p>`;
  }
}
