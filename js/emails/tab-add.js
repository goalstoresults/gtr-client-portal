// /emails/tab-add.js
// Add tab: create a new email campaign

import { escapeHtml } from "../utilities.js";
import { renderEmailList } from "./tab-list.js";

/* =========================================================
   BACKEND INSERT
========================================================= */

export async function addEmailCampaign({
  project,
  campaign_name,
  subject_line,
  send_date,
  segment_description,
  raw_text,
  notes,
  created_by
}) {
  const res = await fetch(
    `https://emails-module.dennis-e64.workers.dev/campaigns/add`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project,
        campaign_name,
        subject_line,
        send_date,
        segment_description,
        raw_text,
        notes,
        created_by
      })
    }
  );

  if (!res.ok) {
    throw new Error("Campaign insert failed");
  }

  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

/* =========================================================
   RENDER: Add Campaign Tab
========================================================= */

export async function renderEmailAdd(container, portalState) {
  // Require project selection
  if (!portalState.selectedProjectId) {
    container.innerHTML = `
      <section class="card warning">
        <p>Please select a project to continue.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <h3>Email – Add Campaign</h3>

      <div class="notes-row">
        <label class="notes-label">Project</label>
        <input class="form-control" value="${escapeHtml(
          portalState.selectedProjectName
        )}" readonly />
      </div>

      <div id="emailAdd-formArea" style="margin-top:24px;"></div>
    </section>
  `;

  renderCampaignForm(
    document.getElementById("emailAdd-formArea"),
    portalState
  );
}

/* =========================================================
   RENDER: Campaign Form
========================================================= */

function renderCampaignForm(formArea, portalState) {
  formArea.innerHTML = `
    <div class="notes-row">
      <label class="notes-label">Campaign Name *</label>
      <input id="emailAdd-campaignName" class="form-control" />
    </div>

    <div class="notes-row">
      <label class="notes-label">Subject Line *</label>
      <input id="emailAdd-subjectLine" class="form-control" />
    </div>

    <div class="notes-row">
      <label class="notes-label">Send Date (Eastern)</label>
      <input id="emailAdd-sendDate" class="form-control" type="datetime-local" />
    </div>

    <div class="notes-row">
      <label class="notes-label">Segment Description</label>
      <input id="emailAdd-segment" class="form-control" />
    </div>

    <div class="notes-row">
      <label class="notes-label">Raw Email Text *</label>
      <textarea id="emailAdd-rawText" class="form-control" rows="10"></textarea>
    </div>

    <div class="notes-row">
      <label class="notes-label">Internal Notes</label>
      <textarea id="emailAdd-notes" class="form-control" rows="4"></textarea>
    </div>

    <div style="margin-top:16px;">
      <button id="emailAdd-saveBtn" class="btn-primary">Save Campaign</button>
      <button id="emailAdd-cancelBtn" class="btn-secondary">Cancel</button>
    </div>

    <div id="emailAdd-status" class="status-area" style="margin-top:12px;"></div>
  `;

  document.getElementById("emailAdd-saveBtn").addEventListener("click", async () => {
    const status = document.getElementById("emailAdd-status");
    status.innerHTML = "";

    const campaignName = document.getElementById("emailAdd-campaignName").value.trim();
    const subjectLine = document.getElementById("emailAdd-subjectLine").value.trim();
    const sendDate = document.getElementById("emailAdd-sendDate").value;
    const segment = document.getElementById("emailAdd-segment").value.trim();
    const rawText = document.getElementById("emailAdd-rawText").value.trim();
    const notes = document.getElementById("emailAdd-notes").value.trim();

    if (!campaignName || !subjectLine || !rawText) {
      status.innerHTML = `<p class="error">Please fill in all required fields.</p>`;
      return;
    }

    try {
      await addEmailCampaign({
        project: portalState.selectedProjectId,
        campaign_name: campaignName,
        subject_line: subjectLine,
        send_date: sendDate ? new Date(sendDate).toISOString() : null,
        segment_description: segment || null,
        raw_text: rawText,
        notes: notes || null,
        created_by: portalState.currentUserEmail || "GTR Staff"
      });

      status.innerHTML = `<p class="success">Campaign created successfully.</p>`;

      document.getElementById("emailAdd-campaignName").value = "";
      document.getElementById("emailAdd-subjectLine").value = "";
      document.getElementById("emailAdd-sendDate").value = "";
      document.getElementById("emailAdd-segment").value = "";
      document.getElementById("emailAdd-rawText").value = "";
      document.getElementById("emailAdd-notes").value = "";

    } catch (err) {
      console.error(err);
      status.innerHTML = `<p class="error">Error saving campaign.</p>`;
    }
  });

  document.getElementById("emailAdd-cancelBtn").addEventListener("click", async () => {
    await renderEmailList(formArea.parentElement, portalState);
  });
}
