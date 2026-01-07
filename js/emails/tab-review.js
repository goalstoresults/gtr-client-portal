// /emails/tab-review.js
// Review + Edit campaign metadata

import { escapeHtml } from "../utilities.js";
import { renderEmailList } from "./tab-list.js";

/* =========================================================
   RENDER: Review Campaign
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

  // Fetch campaign
  const { data, error } = await supabase
    .from("project_email_campaigns")
    .select("*")
    .eq("campaign_id", campaignId)
    .single();

  if (error || !data) {
    container.innerHTML = `
      <section class="card">
        <p class="error">Unable to load campaign.</p>
      </section>
    `;
    return;
  }

  const sendDateLocal = data.send_date
    ? new Date(data.send_date).toISOString().slice(0, 16)
    : "";

  container.innerHTML = `
    <section class="card">
      <h3>Review Campaign</h3>

      <div class="notes-row">
        <label class="notes-label">Campaign Name *</label>
        <input id="review-campaignName" class="form-control" value="${escapeHtml(data.campaign_name || "")}" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Subject Line *</label>
        <input id="review-subjectLine" class="form-control" value="${escapeHtml(data.subject_line || "")}" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Send Date (Eastern)</label>
        <input id="review-sendDate" class="form-control" type="datetime-local" value="${sendDateLocal}" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Segment Description</label>
        <input id="review-segment" class="form-control" value="${escapeHtml(data.segment_description || "")}" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Raw Email Text *</label>
        <textarea id="review-rawText" class="form-control" rows="10">${escapeHtml(data.raw_text || "")}</textarea>
      </div>

      <div class="notes-row">
        <label class="notes-label">Internal Notes</label>
        <textarea id="review-notes" class="form-control" rows="4">${escapeHtml(data.notes || "")}</textarea>
      </div>

      <div style="margin-top:16px;">
        <button id="review-saveBtn" class="btn-primary">Save Changes</button>
        <button id="review-cancelBtn" class="btn-secondary">Back to List</button>
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
      const { error: updateError } = await supabase
        .from("project_email_campaigns")
        .update({
          campaign_name: campaignName,
          subject_line: subjectLine,
          send_date: sendDate ? new Date(sendDate).toISOString() : null,
          segment_description: segment || null,
          raw_text: rawText,
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq("campaign_id", campaignId);

      if (updateError) throw updateError;

      status.innerHTML = `<p class="success">Campaign updated successfully.</p>`;

    } catch (err) {
      console.error(err);
      status.innerHTML = `<p class="error">Error saving changes.</p>`;
    }
  });

  /* =========================================================
     CANCEL → Back to List
  ========================================================== */

  document.getElementById("review-cancelBtn").addEventListener("click", async () => {
    await renderEmailList(container, portalState);
  });
}
