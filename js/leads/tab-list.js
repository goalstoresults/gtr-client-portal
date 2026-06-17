// js/leads/tab-list.js
// Lead List Tab — Fully aligned with Contacts List UX + behavior

import { escapeHtml, formatDateTime } from "../utilities.js";

export async function renderLeadsList(container, portalState) {
  try {

    /* -------------------------------------------------------
       RENDER FILTER BAR + TABLE SHELL (MATCHES CONTACTS)
    ------------------------------------------------------- */
    container.innerHTML = `
      <section class="card">
        <h2>Leads</h2>

        <!-- ROW 1: SEARCH INPUT -->
        <div style="display:flex; align-items:flex-start; gap:20px; flex-wrap:wrap; margin-bottom:6px;">
          <label style="display:flex; flex-direction:column;">
            <span>Search Lead / Client / Status</span>
            <input type="text" id="leadSearchInput" style="min-width:240px;">
            <div style="font-size:0.75em; color:#666; margin-top:2px;">
              Tip: Leave blank for full list.
            </div>
          </label>
        </div>

        <!-- ROW 2: BUTTONS -->
        <div style="display:flex; gap:10px; margin-bottom:12px;">
          <button id="btnApplyLeadFilter" class="secondary">Apply Filter</button>
          <button id="btnClearLeadFilter" class="secondary">Clear Filter</button>
          <button id="btnAddLead" class="btn-primary">Add Lead</button>
        </div>

        <div id="leadTable">(loading…)</div>
      </section>
    `;

    const tableDiv = document.getElementById("leadTable");
    const searchInput = document.getElementById("leadSearchInput");

    // ENTER triggers filter
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("btnApplyLeadFilter").click();
      }
    });

    /* -------------------------------------------------------
       INTERNAL STATE
    ------------------------------------------------------- */
    let leads = [];
    let currentSortField = null;
    let currentSortDirection = "asc";

    /* -------------------------------------------------------
       FETCH LEADS
    ------------------------------------------------------- */
    async function fetchLeads() {
      const url = `
        https://leads-module.dennis-e64.workers.dev/leads/list?
        project=${encodeURIComponent(portalState.project)}
      `.replace(/\s+/g, "");

      const res = await fetch(url, { cache: "no-cache" });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }

    /* -------------------------------------------------------
       FETCH CONTACTS FOR NAME LOOKUP
    ------------------------------------------------------- */
    async function fetchContacts() {
      const url = `
        https://contacts-module.dennis-e64.workers.dev/contacts/list?
        project=${encodeURIComponent(portalState.project)}&limit=2000
      `.replace(/\s+/g, "");

      const res = await fetch(url, { cache: "no-cache" });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }

    /* -------------------------------------------------------
       MERGE CONTACT NAMES INTO LEADS
    ------------------------------------------------------- */
    function mergeContactNames(leadRows, contactRows) {
      const nameById = new Map();

      contactRows.forEach(c => {
        nameById.set(
          c.contact_id,
          c.search_name ||
          `${c.first_name || ""} ${c.last_name || ""}`.trim()
        );
      });

      return leadRows.map(l => ({
        ...l,
        contact_name: nameById.get(l.contact_id) || ""
      }));
    }

    /* -------------------------------------------------------
       LOAD DEFAULT (LAST UPDATED)
    ------------------------------------------------------- */
    async function loadDefault() {
      const [leadRows, contactRows] = await Promise.all([
        fetchLeads(),
        fetchContacts()
      ]);

      leads = mergeContactNames(leadRows, contactRows);

      leads.sort((a, b) => {
        const da = a.updated_at ? new Date(a.updated_at) : new Date(0);
        const db = b.updated_at ? new Date(b.updated_at) : new Date(0);
        return db - da;
      });

      currentSortField = "updated_at";
      currentSortDirection = "desc";

      renderTable();
    }

    /* -------------------------------------------------------
       APPLY FILTER
    ------------------------------------------------------- */
    async function applyFilter() {
      const term = searchInput.value.trim().toLowerCase();

      const [leadRows, contactRows] = await Promise.all([
        fetchLeads(),
        fetchContacts()
      ]);

      leads = mergeContactNames(leadRows, contactRows);

      if (term !== "") {
        leads = leads.filter(l =>
          (l.lead_name || "").toLowerCase().includes(term) ||
          (l.contact_name || "").toLowerCase().includes(term) ||
          (l.status || "").toLowerCase().includes(term)
        );
      }

      leads.sort((a, b) => a.lead_name.localeCompare(b.lead_name));

      currentSortField = "lead_name";
      currentSortDirection = "asc";

      renderTable();
    }

    /* -------------------------------------------------------
       RENDER TABLE
    ------------------------------------------------------- */
    function renderTable() {
      const sorted = [...leads];

      if (currentSortField) {
        sorted.sort((a, b) => {
          if (currentSortField === "updated_at") {
            const da = a.updated_at ? new Date(a.updated_at) : new Date(0);
            const db = b.updated_at ? new Date(b.updated_at) : new Date(0);
            return currentSortDirection === "asc" ? da - db : db - da;
          }

          const A = (a[currentSortField] || "").toLowerCase();
          const B = (b[currentSortField] || "").toLowerCase();
          return currentSortDirection === "asc"
            ? A.localeCompare(B)
            : B.localeCompare(A);
        });
      }

      const headerText = `
        <h4>Showing ${sorted.length} leads</h4>
      `;

      tableDiv.innerHTML = `
        ${headerText}
        <table class="notes-table">
          <thead>
            <tr>
              ${sortableHeader("lead_name", "Lead Name")}
              ${sortableHeader("contact_name", "Client")}
              ${sortableHeader("stage_name", "Stage")}
              ${sortableHeader("status", "Status")}
              ${sortableHeader("created_at", "Created")}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              sorted.length
                ? sorted.map(renderRow).join("")
                : `<tr><td colspan="6">(no leads found)</td></tr>`
            }
          </tbody>
        </table>
      `;

      // Sorting handlers
      tableDiv.querySelectorAll("th.sortable").forEach(th => {
        th.addEventListener("click", () => {
          const field = th.dataset.field;

          if (currentSortField === field) {
            currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
          } else {
            currentSortField = field;
            currentSortDirection = "asc";
          }

          renderTable();
        });
      });

      // Row select → go to Details tab
      tableDiv.querySelectorAll(".btn-select-lead").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          const name = btn.dataset.name;
          const client = btn.dataset.client;

          portalState.activeLeadId = id;
          portalState.activeLeadName = name;
          portalState.activeLeadContactName = client;

          localStorage.setItem("activeLeadId", id);
          localStorage.setItem("activeLeadName", name);
          localStorage.setItem("activeLeadContactName", client);

          const bar = document.getElementById("lead-context-bar");
          if (bar) {
            bar.textContent = `${name} (${client})`;
            bar.style.display = "block";
          }

          const detailsBtn = document.querySelector(
            '#leads-subtabs button[data-subtab="details"]'
          );
          if (detailsBtn) detailsBtn.click();
        });
      });
    }

    /* -------------------------------------------------------
       HELPERS
    ------------------------------------------------------- */
    function sortableHeader(field, label) {
      const isSorted = currentSortField === field;
      const up = isSorted && currentSortDirection === "asc" ? "▲" : "△";
      const down = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

      return `
        <th class="sortable" data-field="${field}">
          ${label}
          <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
            <span>${up}</span>
            <span>${down}</span>
          </span>
        </th>
      `;
    }

    /* -------------------------------------------------------
       ⭐ PATCHED renderRow — FIXES APOSTROPHES
    ------------------------------------------------------- */
    function renderRow(l) {

      // Escape double quotes for safe HTML attributes
      const safeName = (l.lead_name || "").replace(/"/g, '&quot;');
      const safeClient = (l.contact_name || "").replace(/"/g, '&quot;');

      return `
        <tr>
          <td>${escapeHtml(l.lead_name || "")}</td>
          <td>${escapeHtml(l.contact_name || "")}</td>
          <td>${escapeHtml(l.stage_name || "")}</td>
          <td>${escapeHtml(l.status || "")}</td>
          <td>${formatDateTime(l.created_at)}</td>
          <td>
            <button class="btn-primary btn-select-lead"
              data-id="${l.lead_id}"
              data-name="${safeName}"
              data-client="${safeClient}">
              Select
            </button>
          </td>
        </tr>
      `;
    }

    /* -------------------------------------------------------
       BUTTONS
    ------------------------------------------------------- */
    document.getElementById("btnApplyLeadFilter").addEventListener("click", applyFilter);

    document.getElementById("btnClearLeadFilter").addEventListener("click", async () => {
      searchInput.value = "";
      await loadDefault();
    });

    document.getElementById("btnAddLead").addEventListener("click", () => {
      portalState.activeLeadId = null;
      portalState.activeLeadName = "";
      portalState.activeLeadContactName = "";

      localStorage.removeItem("activeLeadId");
      localStorage.removeItem("activeLeadName");
      localStorage.removeItem("activeLeadContactName");

      const bar = document.getElementById("lead-context-bar");
      if (bar) {
        bar.textContent = "No Lead Selected";
        bar.style.display = "block";
      }

      const clientBtn = document.querySelector(
        '#leads-subtabs button[data-subtab="client"]'
      );
      if (clientBtn) clientBtn.click();
    });

    /* -------------------------------------------------------
       INITIAL LOAD
    ------------------------------------------------------- */
    await loadDefault();

  } catch (err) {
    tableDiv.innerHTML = `<p class="error">Error loading leads.</p>`;
    console.error("[Leads] Error:", err);
  }
}
