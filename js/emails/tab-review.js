// /emails/tab-review.js
// Review + Edit campaign metadata

import { escapeHtml } from "../utilities.js";
import { renderEmailList } from "./tab-list.js";
import { renderEmailData } from "./tab-email-data.js";

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
      )}?project=${encodeURIComponent(portalState.staffSelectedProjectId)}`,
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
     3) Render UI (Upload removed)
  --------------------------------------------------------- */
  container.innerHTML = `
    <section class="card">

      <!-- TITLE ROW -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>
          <h3 style="display:inline-block; margin-right:12px;">
            Review Campaign: ${escapeHtml(campaign.campaign_name || "")}
          </h3>

          <button id="review-saveBtn" class="btn-primary" style="margin-right:8px;">Save</button>
          <button id="review-deleteBtn" class="btn-danger">Delete</button>
        </div>

        <!-- Redirect to Email Data -->
        <button id="review-goToUploadBtn" class="btn-secondary">
          Upload File
        </button>
      </div>

      <!-- FORM -->
      <div class="notes-row">
        <label class="notes-label">Project</label>
        <input class="form-control" value="${escapeHtml(
          portalState.staffSelectedProjectName
        )}" readonly />
      </div>

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
        <textarea id="review-notes" class="form-control" rows="4">${escapeHtml(
          campaign.notes || ""
        )}</textarea>
      </div>

      <div id="review-status" class="status-area" style="margin-top:12px;"></div>

    </section>
  `;

  /* =========================================================
     SAVE CHANGES
  ========================================================== */
  document.getElementById("review-saveBtn").addEventListener("click", async () => {
    const status = document.getElementById("review-status");
    status.innerHTML = "";

    const campaignName = document.getElementById("review-campaignName").value.trim();
    const subjectLine = document.getElementById("review-subjectLine").value.trim();
    const sendDate = document.getElementById("review-sendDate").value;
    const segment = document.getElementById("review-segment").value.trim();
    const rawText = document.getElementById("review-rawText").value.trim();
    const notes = document.getElementById("review-notes").value.trim();

    if (!campaignName || !subjectLine || !rawText) {
      status.innerHTML = `<p class="error">Please fill in all required fields.</p>`;
      return;
    }

    try {
      const res = await fetch(
        `https://emails-module.dennis-e64.workers.dev/campaigns/update/${encodeURIComponent(
          campaignId
        )}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project: portalState.staffSelectedProjectId,
            campaign_name: campaignName,
            subject_line: subjectLine,
            send_date: sendDate ? new Date(sendDate).toISOString() : null,
            segment_description: segment || null,
            raw_text: rawText,
            notes: notes || null,
            updated_at: new Date().toISOString()
          })
        }
      );

      if (!res.ok) throw new Error("Update failed");

      status.innerHTML = `<p class="success">Campaign updated successfully.</p>`;
    } catch (err) {
      console.error(err);
      status.innerHTML = `<p class="error">Error saving changes.</p>`;
    }
  });

  /* =========================================================
     DELETE CAMPAIGN
  ========================================================== */
  document.getElementById("review-deleteBtn").addEventListener("click", async () => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;

    await fetch(
      `https://emails-module.dennis-e64.workers.dev/campaigns/delete/${encodeURIComponent(
        campaignId
      )}?project=${encodeURIComponent(portalState.staffSelectedProjectId)}`,
      { method: "DELETE" }
    );

    await renderEmailList(container, portalState);
  });

  /* =========================================================
     REDIRECT TO EMAIL DATA TAB
  ========================================================== */
  document.getElementById("review-goToUploadBtn").addEventListener("click", () => {
    const emailDataBtn = document.querySelector(
      '#emails-subtabs button[data-subtab="email-data"]'
    );

    if (emailDataBtn) {
      emailDataBtn.click();
    }
  });
}

