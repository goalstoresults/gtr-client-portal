// /emails/tab-review.js
// Review + Edit campaign metadata

import { escapeHtml } from "../utilities.js";
import { renderEmailList } from "./tab-list.js";

/* =========================================================
   RENDER: Review Campaign (Worker-based)
========================================================= */

export async function renderEmailReview(container, portalState) {
  const campaignId = portalState.selectedCampaignId;

  if (!campaignId) {
    container.innerHTML = `
      <section class="card">
        <p>No campaign selected.</p>
      </section>
    `;
    return;
  }

  /* ---------------------------------------------------------
     1) Fetch campaign from Worker
  --------------------------------------------------------- */
  let campaign = null;

  try {
    const res = await fetch(
      `https://emails-module.dennis-e64.workers.dev/campaigns/details/${encodeURIComponent(
        campaignId
      )}`,
      { cache: "no-cache" }
    );

    const text = await res.text();
    const rows = text ? JSON.parse(text) : [];

    campaign = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error("Review fetch error:", err);
    campaign = null;
  }

  if (!campaign) {
    container.innerHTML = `
      <section class="card">
        <p class="error">Unable to load campaign.</p>
      </section>
    `;
    return;
  }

  /* ---------------------------------------------------------
     2) Prepare date for datetime-local input
  --------------------------------------------------------- */
  const sendDateLocal = campaign.send_date
    ? new Date(campaign.send_date).toISOString().slice(0, 16)
    : "";

  /* ---------------------------------------------------------
     3) Render form
  --------------------------------------------------------- */
  container.innerHTML = `
    <section class="card">
      <h3>Review Campaign</h3>

      <div class="notes-row">
        <label class="notes-label">Campaign Name *</label>
        <input id="review-campaignName" class="form-control"
          value="${escapeHtml(campaign.campaign_name || "")}" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Subject Line *</label>
        <input id="review-subjectLine" class="form-control"
          value="${escapeHtml(campaign.subject_line || "")}" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Send Date (Eastern)</label>
        <input id="review-sendDate" class="form-control" type="datetime-local"
          value="${sendDateLocal}" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Segment Description</label>
        <input id="review-segment" class="form-control"
          value="${escapeHtml(campaign.segment_description || "")}" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Raw Email Text *</label>
        <textarea id="review-rawText" class="form-control" rows="10">${escapeHtml(
          campaign.raw_text || ""
        )}</textarea>
      </div>

      <div class="notes-row">
        <label class="notes-label">Internal Notes</label>
        <textarea id="review
