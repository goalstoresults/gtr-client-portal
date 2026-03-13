// tab-my-requests.js — User's Help Requests

import { escapeHtml } from "../utilities.js";

export async function loadHelpMyRequests({ portalState, container }) {
  if (!portalState.project) {
    container.innerHTML = `
      <section class="card">
        <p>No project selected.</p>
      </section>
    `;
    return;
  }

  /* =========================================================
     1) Shell
  ========================================================== */
  container.innerHTML = `
    <section class="card">
      <h2 style="margin-top:0;">My Help Requests</h2>
      <div id="myHelpRequestsContent">Loading…</div>
    </section>
  `;

  const content = container.querySelector("#myHelpRequestsContent");

  /* =========================================================
     2) Fetch user's help requests
  ========================================================== */
  let rows = [];
  try {
    const res = await fetch(
      `https://help-center-worker.dennis-e64.workers.dev/help/my-requests?user_id=${encodeURIComponent(
        portalState.user_id
      )}`,
      { cache: "no-cache" }
    );
    rows = await res.json();
    if (!Array.isArray(rows)) rows = [];
  } catch (err) {
    content.innerHTML = `<p>Error loading help requests.</p>`;
    return;
  }

  if (rows.length === 0) {
    content.innerHTML = `<p>You have not submitted any help requests yet.</p>`;
    return;
  }

  /* =========================================================
     3) Render table — NOTES TABLE STYLE WITH ARROW
  ========================================================== */
  const tableHtml = `
    <table class="notes-table" style="width:100%; border-collapse:collapse;">
      <thead>
        <tr>
          <th></th>
          <th>Module</th>
          <th>Issue Type</th>
          <th>Severity</th>
          <th>Status</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr class="help-row" data-id="${escapeHtml(r.id)}">
            <td><button class="expand-btn" data-id="${escapeHtml(r.id)}">▶</button></td>
            <td>${escapeHtml(r.module)}</td>
            <td>${escapeHtml(r.issue_type)}</td>
            <td>${escapeHtml(r.severity)}</td>
            <td>${escapeHtml(r.status)}</td>
            <td>${new Date(r.created_at).toLocaleString()}</td>
          </tr>

          <!-- Expand row -->
          <tr id="details-${escapeHtml(r.id)}" style="display:none;">
            <td colspan="6">
              <div style="padding:12px; background:#f7f7f7; border:1px solid #ddd;">

                <div style="margin-bottom:8px;">
                  <strong>Description:</strong><br>
                  ${escapeHtml(r.description || "")}
                </div>

                ${
                  r.steps_to_reproduce
                    ? `
                <div style="margin-bottom:8px;">
                  <strong>Steps to Reproduce:</strong><br>
                  ${escapeHtml(r.steps_to_reproduce)}
                </div>`
                    : ""
                }

                <div style="margin-bottom:8px;">
                  <strong>Severity:</strong> ${escapeHtml(r.severity)}
                </div>

                <div>
                  <strong>Last Updated:</strong> ${new Date(
                    r.updated_at
                  ).toLocaleString()}
                </div>

              </div>
            </td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;

  content.innerHTML = tableHtml;

  /* =========================================================
     4) Expand/Collapse Logic — MATCH TASK LIST
  ========================================================== */
  content.querySelectorAll(".expand-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const detailRow = content.querySelector(`#details-${id}`);
      const isOpen = detailRow.style.display === "table-row";

      detailRow.style.display = isOpen ? "none" : "table-row";
      btn.textContent = isOpen ? "▶" : "▼";
    });
  });
}
