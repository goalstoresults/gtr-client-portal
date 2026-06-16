// leads/tab-list.js
// List tab: leads listing, sorting, selecting

import { escapeHtml, formatDateTime } from "../utilities.js";

/* =========================================================
   RENDER: Leads List
========================================================= */

export async function renderLeadsList(container, portalState) {
  /* ---------------------------------------------------------
     1) Fetch leads
  --------------------------------------------------------- */
  const leadsRes = await fetch(
    `https://leads-module.dennis-e64.workers.dev/leads/list?project=${portalState.project}&limit=1000`,
    { cache: "no-cache" }
  );

  let leads = [];
  try {
    const j = await leadsRes.json();
    leads = Array.isArray(j) ? j : (Array.isArray(j?.data) ? j.data : []);
  } catch {
    leads = [];
  }

  /* ---------------------------------------------------------
     2) Fetch contacts for name lookup (same pattern as Financials)
  --------------------------------------------------------- */
  const contactsRes = await fetch(
    `https://contacts-module.dennis-e64.workers.dev/contacts/list?project=${portalState.project}&limit=2000`,
    { cache: "no-cache" }
  );

  let contacts = [];
  try {
    const cj = await contactsRes.json();
    contacts = Array.isArray(cj) ? cj : (Array.isArray(cj?.data) ? cj.data : []);
  } catch {
    contacts = [];
  }

  const nameById = new Map();
  for (const c of contacts) {
    nameById.set(c.contact_id, c.search_name || c.contact_name || c.contact_id);
  }

  /* ---------------------------------------------------------
     3) Normalize leads rows
  --------------------------------------------------------- */
  leads = leads.map(l => ({
    ...l,
    contact_name: nameById.get(l.contact_id) || ""
  }));

  /* ---------------------------------------------------------
     Sorting state
  --------------------------------------------------------- */
  let currentSortField = "created_at";
  let currentSortDirection = "desc";

  const columns = [
    { key: "lead_name", label: "Lead" },
    { key: "contact_name", label: "Contact" },
    { key: "stage_name", label: "Stage" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created", isDate: true },
    { key: "actions", label: "Actions" }
  ];

  function sortLeads() {
    leads.sort((a, b) => {
      let A = a[currentSortField];
      let B = b[currentSortField];

      const col = columns.find(c => c.key === currentSortField);

      if (col?.isDate) {
        A = new Date(A);
        B = new Date(B);
      } else {
        A = (A || "").toString().toLowerCase();
        B = (B || "").toString().toLowerCase();
      }

      if (A < B) return currentSortDirection === "asc" ? -1 : 1;
      if (A > B) return currentSortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  /* ---------------------------------------------------------
     Render table
  --------------------------------------------------------- */
  function renderTable() {
    sortLeads();

    /* ---------- HEADER ---------- */
    const headerHtml = columns
      .map(col => {
        const isSorted = currentSortField === col.key;
        const upArrow = isSorted && currentSortDirection === "asc" ? "▲" : "△";
        const downArrow = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

        return `
          <th class="${col.key !== 'actions' ? 'sortable' : ''}" data-field="${col.key}">
            ${escapeHtml(col.label)}
            ${col.key !== 'actions' ? `
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">${upArrow}</span>
                <span class="sort-down">${downArrow}</span>
              </span>` : ""}
          </th>
        `;
      })
      .join("");

    /* ---------- ROWS ---------- */
    const rowsHtml = leads
      .map(
        l => `
      <tr data-id="${l.lead_id}">
        <td>${escapeHtml(l.lead_name)}</td>
        <td>${escapeHtml(l.contact_name)}</td>
        <td>${escapeHtml(l.stage_name || "")}</td>
        <td>${escapeHtml(l.status || "")}</td>
        <td>${escapeHtml(formatDateTime(l.created_at))}</td>
        <td>
          <button class="btn-primary btn-select" data-id="${l.lead_id}">Select</button>
        </td>
      </tr>
    `
      )
      .join("");

    /* ---------- FINAL HTML ---------- */
    container.innerHTML = `
      <section class="card">
        <h3>Leads List</h3>
        <table class="notes-table">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="6">(no leads found)</td></tr>`}
          </tbody>
        </table>
      </section>
    `;

    /* ---------- SORT EVENTS ---------- */
    container.querySelectorAll("th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.dataset.field;

        currentSortDirection =
          currentSortField === field
            ? currentSortDirection === "asc"
              ? "desc"
              : "asc"
            : "asc";

        currentSortField = field;
        renderTable();
      });
    });

    /* ---------- SELECT EVENTS ---------- */
    container.querySelectorAll(".btn-select").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const lead = leads.find(l => l.lead_id === id);
        if (!lead) return;

        // ⭐ 1. Set global lead variables
        portalState.activeLeadId = lead.lead_id;
        portalState.activeLeadName = lead.lead_name;
        portalState.activeLeadContactId = lead.contact_id;
        portalState.activeLeadContactName = lead.contact_name;

        // ⭐ 2. Persist to localStorage
        localStorage.setItem("activeLeadId", lead.lead_id);
        localStorage.setItem("activeLeadName", lead.lead_name);
        localStorage.setItem("activeLeadContactId", lead.contact_id);
        localStorage.setItem("activeLeadContactName", lead.contact_name);

        // ⭐ 3. Update the blue bar
        const bar = document.querySelector("#active-lead-bar");
        if (bar) {
          bar.innerHTML = `
            <strong>Lead:</strong> ${escapeHtml(lead.lead_name)} 
            <span style="margin-left:1rem;">
              <strong>Client:</strong> ${escapeHtml(lead.contact_name)}
            </span>
          `;
        }

        // ⭐ 4. Switch to Details tab
        document.querySelector(`#tab-details`).click();

        // ⭐ 5. Trigger Details renderer
        if (window.renderLeadDetails) {
          window.renderLeadDetails(
            document.querySelector("#details-container"),
            portalState
          );
        }
      });
    });
  }

  renderTable();
}
