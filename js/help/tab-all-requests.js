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
     2) Load project list from Help Worker (admin only)
  ========================================================== */
  if (portalState.full_admin) {
    try {
      const res = await fetch(
        "https://help-center-worker.dennis-e64.workers.dev/help/projects",
        { cache: "no-cache" }
      );
      const projects = await res.json();

      projects.forEach((p) => {
        if (!p.project) return;
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
     3) Helpers for dropdowns (match Submit tab)
  ========================================================== */
  function buildModuleOptions(current) {
    const modules = [
      "contacts",
      "notes",
      "tasks",
      "pipelines",
      "financials",
      "operations",
      "setup",
      "other"
    ];
    const cur = (current || "").toLowerCase();
    return modules
      .map(
        (m) =>
          `<option value="${m}" ${
            cur === m ? "selected" : ""
          }>${m}</option>`
      )
      .join("");
  }

  function buildIssueTypeOptions(current) {
    const issues = [
      "bug",
      "confusion",
      "feature_request",
      "data_issue",
      "permission_issue"
    ];
    const cur = (current || "").toLowerCase();
    return issues
      .map(
        (i) =>
          `<option value="${i}" ${
            cur === i ? "selected" : ""
          }>${i}</option>`
      )
      .join("");
  }

  function buildSeverityOptions(current) {
    const severities = ["low", "medium", "high", "blocking"];
    const cur = (current || "").toLowerCase();
    return severities
      .map(
        (s) =>
          `<option value="${s}" ${
            cur === s ? "selected" : ""
          }>${s}</option>`
      )
      .join("");
  }

  function buildStatusOptions(current) {
    const statuses = [
      "new",
      "in_review",
      "in_progress",
      "waiting_on_user",
      "resolved"
    ];
    const cur = (current || "").toLowerCase();
    return statuses
      .map(
        (s) =>
          `<option value="${s}" ${
            cur === s ? "selected" : ""
          }>${s}</option>`
      )
      .join("");
  }

  /* =========================================================
     4) Fetch + Render Function
  ========================================================== */
  async function loadTable() {
    const selectedProject = projectFilter.value;

    let endpoint = "";
    if (selectedProject === "all") {
      endpoint =
        "https://help-center-worker.dennis-e64.workers.dev/help/all-projects";
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
       5) Render table — NOTES TABLE STYLE WITH ARROW
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
              <td><button class="expand-btn" data-id="${escapeHtml(
                r.id
              )}">▶</button></td>
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
                    <textarea
                      class="descInput"
                      data-id="${escapeHtml(r.id)}"
                      style="width:100%; height:80px;"
                    >${escapeHtml(r.description || "")}</textarea>
                  </div>

                  <!-- Steps -->
                  <div style="margin-bottom:12px;">
                    <label><strong>Steps to Reproduce</strong></label><br>
                    <textarea
                      class="stepsInput"
                      data-id="${escapeHtml(r.id)}"
                      style="width:100%; height:80px;"
                    >${escapeHtml(r.steps_to_reproduce || "")}</textarea>
                  </div>

                  <!-- Module / Issue / Severity / Status -->
                  <div style="display:flex; gap:16px; margin-bottom:12px;">

                    <div style="flex:1;">
                      <label>Module</label><br>
                      <select
                        class="moduleInput"
                        data-id="${escapeHtml(r.id)}"
                        style="width:100%;"
                      >
                        ${buildModuleOptions(r.module)}
                      </select>
                    </div>

                    <div style="flex:1;">
                      <label>Issue Type</label><br>
                      <select
                        class="issueInput"
                        data-id="${escapeHtml(r.id)}"
                        style="width:100%;"
                      >
                        ${buildIssueTypeOptions(r.issue_type)}
                      </select>
                    </div>

                    <div style="flex:1;">
                      <label>Severity</label><br>
                      <select
                        class="severityInput"
                        data-id="${escapeHtml(r.id)}"
                        style="width:100%;"
                      >
                        ${buildSeverityOptions(r.severity)}
                      </select>
                    </div>

                    <div style="flex:1;">
                      <label>Status</label><br>
                      <select
                        class="statusInput"
                        data-id="${escapeHtml(r.id)}"
                        style="width:100%;"
                      >
                        ${buildStatusOptions(r.status)}
                      </select>
                    </div>

                  </div>

                  <!-- Submitted By -->
                  <div style="margin-bottom:8px; font-size:0.9em; color:#555;">
                    <strong>Submitted By:</strong>
                    ${escapeHtml(r.first_name)} ${escapeHtml(
                r.last_name
              )} (${escapeHtml(r.email)})
                  </div>

                  <!-- Screenshot (view only) -->
                  ${
                    r.screenshot_url
                      ? `
                  <div style="margin-bottom:8px;">
                    <strong>Screenshot:</strong>
                    <a href="${escapeHtml(
                      r.screenshot_url
                    )}" target="_blank">View Screenshot</a>
                  </div>`
                      : ""
                  }

                  <!-- Save + Delete -->
                  <div style="display:flex; gap:16px; margin-top:12px;">
                    <button
                      class="saveAdminBtn btn-primary"
                      data-id="${escapeHtml(r.id)}"
                    >
                      Save Changes
                    </button>

                    ${
                      portalState.full_admin
                        ? `<button
                             class="deleteAdminBtn btn-danger"
                             data-id="${escapeHtml(r.id)}"
                           >
                             Delete
                           </button>`
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
       6) Expand/Collapse Logic — MATCH TASK LIST
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
       7) Save Admin Changes (FULL EDIT PANEL)
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
        ).value;

        const issueVal = content.querySelector(
          `.issueInput[data-id="${id}"]`
        ).value;

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
       8) Delete Request (Admin Only)
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
     9) Load table initially + on filter change
  ========================================================== */
  await loadTable();

  projectFilter.addEventListener("change", () => {
    loadTable();
  });
}
