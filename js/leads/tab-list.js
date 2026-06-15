// js/leads/tab-list.js
import { escapeHtml } from "../utilities.js";

export async function renderLeadsList(container, portalState) {

  /* ============================================================
     BASE UI — FILTERS + ADD BUTTON + TABLE AREA
  ============================================================ */

  container.innerHTML = `
    <section class="card">
      <h2>Leads</h2>

      <div class="row" style="gap:12px; margin-bottom:16px;">
        <input id="leadFilterInput" placeholder="Filter by name, client, or status" style="flex:1;">
        <button id="btnFilterLeads" class="btn-secondary">Filter</button>
        <button id="btnAddLead" class="btn-primary">Add Lead</button>
      </div>

      <div id="leadListArea">Loading leads…</div>
    </section>
  `;

  const listArea = document.getElementById("leadListArea");

  /* ============================================================
     LOAD LEADS
  ============================================================ */

  async function loadLeads(filter = "") {
    listArea.textContent = "Loading…";

    const url = `
      https://leads-module.dennis-e64.workers.dev/leads/list?
      project=${encodeURIComponent(portalState.project)}
    `.replace(/\s+/g, "");

    try {
      const res = await fetch(url);
      let leads = await res.json();

      if (!Array.isArray(leads)) leads = [];

      // Apply filter
      if (filter) {
        const f = filter.toLowerCase();
        leads = leads.filter(l =>
          (l.opportunity_name || "").toLowerCase().includes(f) ||
          (l.contact_name || "").toLowerCase().includes(f) ||
          (l.status || "").toLowerCase().includes(f)
        );
      }

      if (leads.length === 0) {
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

  // Initial load
  loadLeads();

  /* ============================================================
     FILTER BUTTON
  ============================================================ */

  document.getElementById("btnFilterLeads").addEventListener("click", () => {
    const term = document.getElementById("leadFilterInput").value.trim();
    loadLeads(term);
  });

  /* ============================================================
     ADD LEAD BUTTON
  ============================================================ */

  document.getElementById("btnAddLead").addEventListener("click", () => {
    const clientBtn = document.querySelector(
      '#leads-subtabs button[data-subtab="client"]'
    );
    if (clientBtn) clientBtn.click();
  });
}

/* ============================================================
   HELPERS
============================================================ */

function formatDate(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  return d.toLocaleDateString();
}
