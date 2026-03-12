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
     3) Render table
  ========================================================== */
  const tableHtml = `
    <table class="data-table" style="width:100%; border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;">Module</th>
          <th style="text-align:left;">Issue Type</th>
          <th style="text-align:left;">Severity</th>
          <th style="text-align:left;">Status</th>
          <th style="text-align:left;">Created</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr class="help-row" data-id="${escapeHtml(r.id)}" style="cursor:pointer;">
            <td>${escapeHtml(r.module)}</td>
            <td>${escapeHtml(r.issue_type)}</td>
            <td>${escapeHtml(r.severity)}</td>
            <td>${escapeHtml(r.status)}</td>
            <td>${new Date(r.created_at).toLocaleString()}</td>
          </tr>

          <!-- Hidden detail row -->
          <tr id="details-${escapeHtml(r.id)}" style="display:none; background:#fafafa;">
            <td colspan="5" style="padding:12px;">
              <strong>Description:</strong><br>
              ${escapeHtml(r.description)}<br><br>

              ${
                r.steps_to_reproduce
                  ? `<strong>Steps to Reproduce:</strong><br>${escapeHtml(
                      r.steps_to_reproduce
                    )}<br><br>`
                  : ""
              }

              ${
                r.screenshot_url
                  ? `<strong>Screenshot:</strong><br>
                     <a href="${escapeHtml(
                       r.screenshot_url
                     )}" target="_blank">View Screenshot</a><br><br>`
                  : ""
              }

              <strong>Last Updated:</strong> ${new Date(
                r.updated_at
              ).toLocaleString()}
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
     4) Expand/Collapse Logic
  ========================================================== */
  const rowsEls = content.querySelectorAll(".help-row");

  rowsEls.forEach((rowEl) => {
    rowEl.addEventListener("click", () => {
      const id = rowEl.getAttribute("data-id");
            const detailRow = content.querySelector(`#details-${id}`);

      if (detailRow.style.display === "none") {
        detailRow.style.display = "table-row";
      } else {
        detailRow.style.display = "none";
      }
    });
  });
}

