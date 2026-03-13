// tab-all-requests.js — Admin Triage Dashboard (notes-table + expand + full edit)

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
  if (portalState.full_admin) {
    try {
      const res = await fetch(
        `${portalState.api_base}/projects/list`,
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
       4) Render table — NOTES TABLE STYLE WITH ARROW
    ========================================================== */
    const tableHtml = `
      <table class="notes-table" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th></th>
            <th>User</th>
            <th>Project</th>
            <th>Module</th>
            <th>Issue</th>
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
              <td>${escapeHtml(r.first_name)} ${escapeHtml(r.last_name)}</td>
              <td>${escapeHtml(r.project)}</td>
              <td>${escapeHtml(r.module)}</td>
              <td>${escapeHtml(r.issue_type)}</td>
              <td>${escapeHtml(r.severity)}</td>
              <td>${escapeHtml(r.status)}</td>
              <td>${new Date(r.created_at).toLocaleString()}</td>
            </tr>

            <!-- Expand row -->
            <tr id="details-${escapeHtml(r.id)}" style="display:none;">
              <td colspan="8">
                <div style="padding:12px; background:#f7f7f7; border:1px solid #ddd;">

                  <!-- Description -->
                  <div style="margin-bottom:12px;">
                    <label><strong>Description</strong></label><br>
                    <textarea class="descInput" data-id="${escapeHtml(
                      r.id
                    )}" style="width:100%; height:80px;">${escapeHtml(
                r.description || ""
              )}</textarea>
                  </div>

                  <!-- Steps -->
                  <div style="margin-bottom:12px;">
                    <label><strong>Steps to Reproduce</strong></label><br>
                    <textarea class="stepsInput" data-id="${escapeHtml(
                      r.id
                    )}" style="width:100%; height:80px;">${escapeHtml(
                r.steps_to_reproduce || ""
              )}</textarea>
                  </div>

                  <!-- Module / Issue / Severity / Status -->
                  <div style="display:flex; gap:16px; margin-bottom:12px;">

                    <div style="flex:1;">
                      <label>Module</label><br>
                      <input class="moduleInput" data-id="${escapeHtml(
                        r.id
                      )}" value="${escapeHtml(r.module)}" style="width:100%;">
                    </div>

                    <div style="flex:1;">
                      <label>Issue Type</label><br>
                      <input class="issueInput" data-id="${escapeHtml(
                        r.id
                      )}" value="${escapeHtml(r.issue_type)}" style="width:100%;">
                    </div>

                    <div style="flex:1;">
                      <label>Severity</label><br>
                      <select class="severityInput" data-id="${escapeHtml(
                        r.id
                      )}" style="width:100%;">
                        <option value="low" ${
                          r.severity === "low" ? "selected" : ""
                        }>Low</option>
                        <option value="medium" ${
                          r.severity === "medium" ? "selected" : ""
                        }>Medium</option>
                        <option value="high" ${
                          r.severity === "high" ? "selected" : ""
                        }>High</option>
                        <option value="blocking" ${
                          r.severity === "blocking" ? "selected" : ""
                        }>Blocking</option>
                      </select>
                    </div>

                    <div style="flex:1;">
                      <label>Status</label><br>
                      <select class="statusInput" data-id="${escapeHtml(
                        r.id
                      )}" style="width:100%;">
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

                  </div>

                  <!-- Save + Delete -->
                  <div style="display:flex; gap:16px; margin-top:12px;">
                    <button class="saveAdminBtn btn-primary" data-id="${escapeHtml(
                      r.id
                    )}">Save Changes</button>

                    ${
                      portalState.full_admin
                        ? `<button class="deleteAdminBtn btn-danger" data-id="${escapeHtml(
                            r.id
                          )}">Delete</button>`
                        : ""
                    }
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
       5) Expand/Collapse Logic — MATCH TASK LIST
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

    /* =========================================================
       6) Save Admin Changes (FULL EDIT PANEL)
    ========================================================== */
    content.querySelectorAll(".saveAdminBtn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;

        const descVal = content.querySelector(
          `.descInput[data-id="${id}"]`
        ).value.trim();

        const stepsVal = content.querySelector(
          `.stepsInput[data-id="${id}"]`
        ).value.trim();

        const moduleVal = content.querySelector(
          `.moduleInput[data-id="${id}"]`
        ).value.trim();

        const issueVal = content.querySelector(
          `.issueInput[data-id="${id}"]`
        ).value.trim();

        const severityVal = content.querySelector(
          `.severityInput[data-id="${id}"]`
        ).value;

        const statusVal = content.querySelector(
          `.statusInput[data-id="${id}"]`
        ).value;

        await fetch(
          "https://help-center-worker.dennis-e64.workers.dev/help/admin-update",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id,
              description: descVal,
              steps_to_reproduce: stepsVal,
              module: moduleVal,
              issue_type: issueVal,
              severity: severityVal,
              status: statusVal
            })
          }
        );

        alert("Changes saved.");
        loadTable();
      });
    });

    /* =========================================================
       7) Delete Request (Admin Only)
    ========================================================== */
    content.querySelectorAll(".deleteAdminBtn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;

        if (!confirm("Delete this help request?")) return;

        await fetch(
          "https://help-center-worker.dennis-e64.workers.dev/help/delete",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
          }
        );

        alert("Request deleted.");
        loadTable();
      });
    });
  }

  /* =========================================================
     8) Load table initially + on filter change
  ========================================================== */
  await loadTable();

  projectFilter.addEventListener("change", () => {
    loadTable();
  });
}
