// tab-all-requests.js — Admin Triage Dashboard (with Project Filter)

import { escapeHtml } from "../utilities.js";

export async function loadHelpAllRequests({ portalState, container }) {
  if (!portalState.project) {
    container.innerHTML = `
      <section class="card">
        <p>No project selected.</p>
      </section>
    `;
    return;
  }

  /* =========================================================
     1) Shell with Project Filter
  ========================================================== */
  container.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2 style="margin-top:0;">All Help Requests</h2>

        <div>
          <label style="font-weight:bold;">Project:</label>
          <select id="projectFilter" style="margin-left:8px; padding:4px 8px;">
            <option value="${escapeHtml(portalState.project)}">Current Project</option>
            <option value="all">All Projects</option>
          </select>
        </div>
      </div>

      <div id="allHelpRequestsContent">Loading…</div>
    </section>
  `;

  const content = container.querySelector("#allHelpRequestsContent");
  const projectFilter = container.querySelector("#projectFilter");

  /* =========================================================
     2) Load project list for dropdown (admin only)
  ========================================================== */
  if (portalState.is_admin) {
    try {
      const res = await fetch(
        `${portalState.api_base}/projects/list`, // adjust if needed
        { cache: "no-cache" }
      );
      const projects = await res.json();

      projects.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.project;
        opt.textContent = p.project;
        projectFilter.appendChild(opt);
      });
    } catch (err) {
      console.warn("Could not load project list for filter.");
    }
  }

  /* =========================================================
     3) Fetch + Render Function
  ========================================================== */
  async function loadTable() {
    const selectedProject = projectFilter.value;

    let endpoint = "";
    if (selectedProject === "all") {
      endpoint = "https://help-center-worker.dennis-e64.workers.dev/help/all-projects";
    } else {
      endpoint = `https://help-center-worker.dennis-e64.workers.dev/help/all?project=${encodeURIComponent(
        selectedProject
      )}`;
    }

    let rows = [];
    try {
      const res = await fetch(endpoint, { cache: "no-cache" });
      rows = await res.json();
      if (!Array.isArray(rows)) rows = [];
    } catch (err) {
      content.innerHTML = `<p>Error loading help requests.</p>`;
      return;
    }

    if (rows.length === 0) {
      content.innerHTML = `<p>No help requests found.</p>`;
      return;
    }

    /* =========================================================
       4) Render table
    ========================================================== */
    const tableHtml = `
      <table class="data-table" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;">User</th>
            <th style="text-align:left;">Project</th>
            <th style="text-align:left;">Module</th>
            <th style="text-align:left;">Issue</th>
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
              <td>${escapeHtml(r.first_name)} ${escapeHtml(r.last_name)}</td>
              <td>${escapeHtml(r.project)}</td>
              <td>${escapeHtml(r.module)}</td>
              <td>${escapeHtml(r.issue_type)}</td>
              <td>${escapeHtml(r.severity)}</td>
              <td>${escapeHtml(r.status)}</td>
              <td>${new Date(r.created_at).toLocaleString()}</td>
            </tr>

            <!-- Hidden detail row -->
            <tr id="details-${escapeHtml(r.id)}" style="display:none; background:#fafafa;">
              <td colspan="7" style="padding:12px;">

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

                <strong>Submitted By:</strong> ${escapeHtml(
                  r.first_name
                )} ${escapeHtml(r.last_name)} (${escapeHtml(r.email)})<br><br>

                <strong>Last Updated:</strong> ${new Date(
                  r.updated_at
                ).toLocaleString()}<br><br>

                <!-- Admin Controls -->
                <div style="display:flex; gap:24px; margin-top:12px;">

                  <!-- Status -->
                  <div>
                    <label>Status</label><br>
                    <select class="statusInput" data-id="${escapeHtml(r.id)}">
                      <option value="new" ${
                        r.status === "new" ? "selected" : ""
                      }>New</option>
                      <option value="in_review" ${
                        r.status === "in_review" ? "selected" : ""
                      }>In Review</option>
                      <option value="in_progress" ${
                        r.status === "in_progress" ? "selected" : ""
                      }>In Progress</option>
                      <option value="waiting_on_user" ${
                        r.status === "waiting_on_user" ? "selected" : ""
                      }>Waiting on User</option>
                      <option value="resolved" ${
                        r.status === "resolved" ? "selected" : ""
                      }>Resolved</option>
                    </select>
                  </div>

                  <!-- Assigned To -->
                  <div>
                    <label>Assigned To (UUID)</label><br>
                    <input class="assignInput" data-id="${escapeHtml(
                      r.id
                    )}" value="${escapeHtml(
              r.assigned_to || ""
            )}" style="width:220px;">
                  </div>

                </div>

                <!-- Internal Notes -->
                <div style="margin-top:16px;">
                  <label>Internal Notes</label><br>
                  <textarea class="notesInput" data-id="${escapeHtml(
                    r.id
                  )}" style="width:100%; height:100px;">${escapeHtml(
              r.internal_notes || ""
            )}</textarea>
                </div>

                <button class="saveAdminBtn" data-id="${escapeHtml(
                  r.id
                )}" style="margin-top:12px;" class="btn-primary">Save Changes</button>

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
       5) Expand/Collapse Logic
    ========================================================== */
    const rowsEls = content.querySelectorAll(".help-row");

    rowsEls.forEach((rowEl) => {
      rowEl.addEventListener("click", () => {
        const id = rowEl.getAttribute("data-id");
        const detailRow = content.querySelector(`#details-${id}`);

        detailRow.style.display =
          detailRow.style.display === "none" ? "table-row" : "none";
      });
    });

    /* =========================================================
       6) Save Admin Changes
    ========================================================== */
    const saveButtons = content.querySelectorAll(".saveAdminBtn");

    saveButtons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");

        const statusVal = content.querySelector(
          `.statusInput[data-id="${id}"]`
        ).value;

        const assignedVal = content.querySelector(
          `.assignInput[data-id="${id}"]`
        ).value.trim();

        const notesVal = content.querySelector(
          `.notesInput[data-id="${id}"]`
        ).value.trim();

        // Update status
        await fetch(
          "https://help-center-worker.dennis-e64.workers.dev/help/update-status",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status: statusVal })
          }
        );

        // Update assignment
        await fetch(
          "https://help-center-worker.dennis-e64.workers.dev/help/assign",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, assigned_to: assignedVal || null })
          }
        );

        // Update notes
        await fetch(
          "https://help-center-worker.dennis-e64.workers.dev/help/add-note",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, internal_notes: notesVal || null })
          }
        );

        alert("Changes saved.");
      });
    });
  }

  /* =========================================================
     7) Load table initially + on filter change
  ========================================================== */
  await loadTable();

  projectFilter.addEventListener("change", () => {
    loadTable();
  });
}

