// js/contacts/tab-list.js
// Modularized Contact List Tab

import { escapeHtml, formatDateTime } from "../utilities.js";
import { renderContactDetails } from "./tab-details.js";

/* -------------------------------------------------------
   MAIN ENTRY: Render Contact List
------------------------------------------------------- */
export async function renderContactList(container, portalState) {
  try {
    const prevFirst    = document.getElementById("filter-first")?.value.trim() || "";
    const prevLast     = document.getElementById("filter-last")?.value.trim() || "";
    const prevBusiness = document.getElementById("filter-business")?.value.trim() || "";
    const prevType     = document.getElementById("filter-contact-type")?.value || "";

    /* -------------------------------------------------------
       RENDER FILTER BAR + TABLE SHELL
    ------------------------------------------------------- */
    container.innerHTML = `
      <section class="card">
        <h2>Contact List for ${escapeHtml(portalState.display_name || portalState.project)}</h2>

        <div id="contactsFilters" style="margin-bottom:12px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <label>
            First:
            <input type="text" id="filter-first" value="${escapeHtml(prevFirst)}" />
            <div style="font-size:0.75em; color:#666; margin-top:2px;">
              Tip: Type “ALL” for full list, or “A-J” for a range.
            </div>
          </label>

          <label>Last: <input type="text" id="filter-last" value="${escapeHtml(prevLast)}" /></label>
          <label>Business: <input type="text" id="filter-business" value="${escapeHtml(prevBusiness)}" /></label>

          <label>Contact Type:
            <select id="filter-contact-type" class="form-control" style="min-width:160px;">
              <option value="">ALL</option>
            </select>
          </label>

          <button id="btnApplyContactsFilter" class="secondary">Apply Filter</button>
          <button id="btnClearContactsFilter" class="secondary">Clear Filter</button>
        </div>

        <div id="contactTable">(loading…)</div>
      </section>
    `;

    const tableDiv   = container.querySelector("#contactTable");
    const typeSelect = document.getElementById("filter-contact-type");

    /* -------------------------------------------------------
       LOAD CONTACT TYPES
    ------------------------------------------------------- */
    const resTypes = await fetch(
      `https://lookups-module.dennis-e64.workers.dev/lookups?lookup_type=contact_type&project=${portalState.project}`
    );
    const values = await resTypes.json();

    if (Array.isArray(values)) {
      values
        .sort((a, b) => (a.label || a.value || "").localeCompare(b.label || b.value || ""))
        .forEach(v => {
          const opt = document.createElement("option");
          opt.value = v.value;
          opt.textContent = v.label || v.value;
          if (v.value === prevType) opt.selected = true;
          typeSelect.appendChild(opt);
        });
    }

    /* -------------------------------------------------------
       INTERNAL STATE
    ------------------------------------------------------- */
    let currentSortField = null;
    let currentSortDirection = "asc";
    let contacts = [];
    let listFields = [];

    /* -------------------------------------------------------
       FILTER DETECTOR
    ------------------------------------------------------- */
    function filtersApplied() {
      const first    = document.getElementById("filter-first").value.trim();
      const last     = document.getElementById("filter-last").value.trim();
      const business = document.getElementById("filter-business").value.trim();
      const type     = document.getElementById("filter-contact-type").value;

      return (
        first.length > 0 ||
        last.length > 0 ||
        business.length > 0 ||
        type.length > 0
      );
    }

    /* -------------------------------------------------------
       LOAD LIST FIELDS (ONCE)
    ------------------------------------------------------- */
    async function loadFieldsIfNeeded() {
      if (listFields.length > 0) return;

      const fieldsRes = await fetch(
        `https://contacts-module.dennis-e64.workers.dev/contact_fields?project=${portalState.project}`,
        { cache: "no-cache" }
      );
      const fieldsData = await fieldsRes.json();
      const fields = Array.isArray(fieldsData.rows) ? fieldsData.rows : [];

      fields.sort((a, b) => a.sort_order - b.sort_order);
      listFields = fields.filter(f => f.contact_tab === "list");
    }

    /* -------------------------------------------------------
       FETCH CONTACTS
    ------------------------------------------------------- */
    async function fetchAll(params) {
      const url = `https://contacts-module.dennis-e64.workers.dev/contacts/search?${params}`;
      const resList = await fetch(url, { cache: "no-cache" });
      const data = await resList.json();
      contacts = Array.isArray(data) ? data : [];
    }

    /* -------------------------------------------------------
       DEFAULT: LOAD LAST 50 UPDATED CONTACTS
    ------------------------------------------------------- */
    async function loadDefaultRecentContacts() {
      const params = new URLSearchParams({ project: portalState.project });

      await fetchAll(params);

      // Sort by updated_at DESC
      contacts.sort((a, b) => {
        const da = a.updated_at ? new Date(a.updated_at) : new Date(0);
        const db = b.updated_at ? new Date(b.updated_at) : new Date(0);
        return db - da;
      });

      // Keep only top 50
      contacts = contacts.slice(0, 50);

      currentSortField = "updated_at";
      currentSortDirection = "desc";

      await loadFieldsIfNeeded();
      renderSortedTable();
    }

    /* -------------------------------------------------------
       APPLY FILTER
    ------------------------------------------------------- */
      async function applyFilter() {
        const first = document.getElementById("filter-first").value.trim();
        const last = document.getElementById("filter-last").value.trim();
        const business = document.getElementById("filter-business").value.trim();
        const type = document.getElementById("contact-type").value.trim();
      
        const isAll = first.toLowerCase() === "all";
        const rangeMatch = first.match(/^([a-z])-([a-z])$/i);
      
        const hasMinimumInput =
          isAll ||
          rangeMatch ||
          first.length >= 1 ||
          last.length >= 1 ||
          business.length >= 1 ||
          type.length >= 1;
      
        if (!hasMinimumInput) {
          alert("Please enter at least one filter value.");
          return;
        }
      
        const params = new URLSearchParams({ project: portalState.project });
      
        if (!isAll && !rangeMatch && first.length >= 1) params.set("first", first);
        if (last.length >= 1) params.set("last", last);
        if (business.length >= 1) params.set("business", business);
      
        // ⭐ NEW: SEND CONTACT TYPE TO BACKEND
        if (type.length >= 1) params.set("contact_type", type);
      
        // Fetch from backend
        await fetchAll(params);
      
        // ⭐ REMOVE LOCAL FILTERING — BACKEND NOW DOES IT
        // if (type) contacts = contacts.filter(c => c.contact_type === type);
      
        // Sort alphabetically for filtered results
        contacts.sort((a, b) => a.search_name.localeCompare(b.search_name));
      
        renderSortedTable();
      }

    /* -------------------------------------------------------
       RENDER SORTED TABLE
    ------------------------------------------------------- */
    function renderSortedTable() {
      const sorted = [...contacts];

      if (currentSortField) {
        sorted.sort((a, b) => {
          if (currentSortField === "updated_at") {
            const da = a.updated_at ? new Date(a.updated_at) : new Date(0);
            const db = b.updated_at ? new Date(b.updated_at) : new Date(0);
            return currentSortDirection === "asc" ? da - db : db - da;
          }

          const valA = (a[currentSortField] || "").toLowerCase();
          const valB = (b[currentSortField] || "").toLowerCase();
          return currentSortDirection === "asc"
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        });
      }

      const headers = listFields.map(f => {
        const isSorted = currentSortField === f.field_key;
        const upArrow   = isSorted && currentSortDirection === "asc"  ? "▲" : "△";
        const downArrow = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

        return `
          <th class="sortable" data-field="${f.field_key}">
            ${escapeHtml(f.label || f.field_key)}
            <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
              <span class="sort-up">${upArrow}</span>
              <span class="sort-down">${downArrow}</span>
            </span>
          </th>
        `;
      }).join("");

      const rows = sorted.map(c => {
        const cells = listFields.map(f => {
          const key = f.field_key;

          if (key === "updated_at") {
            return `<td>${formatDateTime(c.updated_at)}</td>`;
          }

          return `<td>${escapeHtml(c[key] || "")}</td>`;
        }).join("");

        return `
          <tr>
            ${cells}
            <td><button class="btn-primary btn-select" data-id="${c.contact_id}">Select</button></td>
          </tr>
        `;
      }).join("");

      const headerText =
        sorted.length >= 1000
          ? `
            <h4>Showing 1,000+ contacts (partial list)</h4>
            <div style="font-size:0.85em; color:#666; margin-bottom:8px;">
              Refine your filter to narrow results.
            </div>
          `
          : `<h4>Showing ${sorted.length} contacts</h4>`;

      tableDiv.innerHTML = `
        ${headerText}
        <table class="notes-table">
          <thead><tr>${headers}<th>Actions</th></tr></thead>
          <tbody>
            ${rows || `<tr><td colspan="${listFields.length + 1}">(no contacts found)</td></tr>`}
          </tbody>
        </table>
      `;

      /* -------------------------------------------------------
         SELECT CONTACT
      ------------------------------------------------------- */
      tableDiv.querySelectorAll(".btn-select").forEach(btn => {
        btn.addEventListener("click", async () => {
          const contactId = btn.dataset.id;
          portalState.selectedContactId = contactId;

          const res = await fetch(
            `https://contacts-module.dennis-e64.workers.dev/contacts/details/${contactId}`,
            { cache: "no-cache" }
          );
          const data = await res.json();
          const contact = Array.isArray(data) ? data[0] : data;

          portalState.selectedContactName =
            contact.search_name ||
            `${contact.first_name || ""} ${contact.last_name || ""}`.trim();

          const contextBar = document.getElementById("contact-context-bar");
          if (contextBar) contextBar.textContent = `Contact: ${portalState.selectedContactName}`;

          document.querySelectorAll("#contacts-subtabs button").forEach(b => b.classList.remove("active"));
          const detailsBtn = document.querySelector('#contacts-subtabs button[data-subtab="details"]');
          if (detailsBtn) detailsBtn.classList.add("active");

          const content = document.querySelector("#contactsContent");
          await renderContactDetails(content, portalState, contactId);
        });
      });

      /* -------------------------------------------------------
         SORTING
      ------------------------------------------------------- */
      tableDiv.querySelectorAll("th.sortable").forEach(th => {
        th.addEventListener("click", () => {
          const field = th.dataset.field;

          if (currentSortField === field) {
            currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
          } else {
            currentSortField = field;
            currentSortDirection = "asc";
          }

          renderSortedTable();
        });
      });
    }

    /* -------------------------------------------------------
       FILTER BUTTONS
    ------------------------------------------------------- */
    document.getElementById("btnApplyContactsFilter").addEventListener("click", applyFilter);

    document.getElementById("btnClearContactsFilter").addEventListener("click", async () => {
      document.getElementById("filter-first").value = "";
      document.getElementById("filter-last").value = "";
      document.getElementById("filter-business").value = "";
      document.getElementById("filter-contact-type").value = "";

      await loadDefaultRecentContacts();
    });

    /* -------------------------------------------------------
       INITIAL LOAD: LAST 50 UPDATED
    ------------------------------------------------------- */
    await loadDefaultRecentContacts();

  } catch (err) {
    container.innerHTML = `
      <h4>Contacts</h4>
      <p>Error loading contacts: ${escapeHtml(err.message || "Unknown error")}</p>
    `;
    console.error("[Contacts] Error in renderContactList:", err);
  }
}

