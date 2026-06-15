// js/leads/tab-list.js
import { escapeHtml } from "../utilities.js";

export async function renderLeadsList(container, portalState) {

  container.innerHTML = `
    <section class="card">
      <h2>Leads</h2>
      <div id="leadListArea">Loading leads…</div>
    </section>
  `;

  const listArea = document.getElementById("leadListArea");

  try {
    const url = `
      https://leads-module.dennis-e64.workers.dev/leads/list?
      project=${encodeURIComponent(portalState.project)}
    `.replace(/\s+/g, "");

    const res = await fetch(url);
    const leads = await res.json();

    if (!Array.isArray(leads) || leads.length === 0) {
      listArea.innerHTML = `<p class="muted">No leads found.</p>`;
      return;
    }

    listArea.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Lead Name</th>
            <th>Client</th>
            <th>Stage</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          ${leads
            .map(
              (l) => `
            <tr class="lead-row"
                data-json='${escapeHtml(JSON.stringify(l))}'>
              <td>${escapeHtml(l.opportunity_name || "")}</td>
              <td>${escapeHtml(l.contact_name || "")}</td>
              <td>${escapeHtml(l.stage_name || "")}</td>
              <td>${escapeHtml(l.status || "")}</td>
              <td>${escapeHtml(formatDate(l.created_at))}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;

    // CLICK HANDLERS
    listArea.querySelectorAll(".lead-row").forEach((row) => {
      row.addEventListener("click", () => {
        const lead = JSON.parse(row.dataset.json);

        // ⭐ SET GLOBAL STATE
        portalState.activeLeadId = lead.lead_id;
        portalState.activeLeadName = lead.opportunity_name;
        portalState.activeLeadContactName = lead.contact_name;

        // ⭐ PERSIST STATE
        localStorage.setItem("activeLeadId", lead.lead_id);
        localStorage.setItem("activeLeadName", lead.opportunity_name);
        localStorage.setItem("activeLeadContactName", lead.contact_name);

        // ⭐ UPDATE BLUE BAR
        const bar = document.getElementById("lead-context-bar");
        if (bar) {
          bar.textContent = `${lead.opportunity_name} (${lead.contact_name})`;
          bar.style.display = "block";
        }

        // ⭐ SWITCH TO DETAILS TAB
        const detailsBtn = document.querySelector(
          '#leads-subtabs button[data-subtab="details"]'
        );
        if (detailsBtn) detailsBtn.click();
      });
    });
  } catch (err) {
    console.error(err);
    listArea.innerHTML = `<p class="error">Error loading leads.</p>`;
  }
}

/* ============================================================
   HELPERS
============================================================ */

function formatDate(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  return d.toLocaleDateString();
}
