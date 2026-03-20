// js/contacts/tab-timeline.js
// Contact Timeline Tab — uses event_timestamp as canonical date
// Now supports deep-linking into Notes via portalState.notesFilterDate + notesFilterSubject

import { escapeHtml, formatDateTime } from "../utilities.js";

export async function renderContactTimeline(container, portalState, contactId) {
  try {
    /* -------------------------------------------------------
       RENDER FILTER BAR + TABLE SHELL
    ------------------------------------------------------- */
    container.innerHTML = `
      <section class="card">
        <h2>Timeline for ${escapeHtml(portalState.selectedContactName || "")}</h2>

        <!-- ROW 1: FILTERS -->
        <div style="display:flex; align-items:flex-start; gap:20px; flex-wrap:wrap; margin-bottom:6px;">

          <label style="display:flex; flex-direction:column;">
            <span>Date ≥</span>
            <input type="date" id="timelineDateFilter" style="min-width:160px;">
          </label>

          <label style="display:flex; flex-direction:column;">
            <span>Section</span>
            <select id="timelineSectionFilter" class="form-control" style="min-width:160px;">
              <option value="">ALL</option>
              <option value="Contacts">Contacts</option>
              <option value="Notes">Notes</option>
              <option value="Relationships">Relationships</option>
              <option value="Financial">Financial</option>
            </select>
          </label>

        </div>

        <!-- ROW 2: BUTTONS -->
        <div style="display:flex; gap:10px; margin-bottom:12px;">
          <button id="btnApplyTimelineFilter" class="secondary">Apply Filter</button>
          <button id="btnClearTimelineFilter" class="secondary">Clear Filter</button>
        </div>

        <div id="timelineTable">(loading…)</div>
      </section>
    `;

    const tableDiv      = container.querySelector("#timelineTable");
    const dateInput     = document.getElementById("timelineDateFilter");
    const sectionSelect = document.getElementById("timelineSectionFilter");

    /* -------------------------------------------------------
       INTERNAL STATE
    ------------------------------------------------------- */
    let events = [];
    let currentSortField = "event_timestamp";
    let currentSortDirection = "desc";

    /* -------------------------------------------------------
       FETCH TIMELINE EVENTS
    ------------------------------------------------------- */
    async function fetchTimeline() {
      const url =
        `https://timeline-module-gets.dennis-e64.workers.dev/timeline/list` +
        `?contact_id=${encodeURIComponent(contactId)}` +
        `&project=${encodeURIComponent(portalState.project)}`;

      const res = await fetch(url, { cache: "no-cache" });
      const data = await res.json();
      events = Array.isArray(data) ? data : [];
    }

    /* -------------------------------------------------------
       MAP event_type → Section
    ------------------------------------------------------- */
    function mapSection(eventType) {
      if (!eventType) return "Other";
      if (eventType.startsWith("contact_")) return "Contacts";
      if (eventType.startsWith("note_")) return "Notes";
      if (eventType.startsWith("relationship_")) return "Relationships";
      if (eventType.startsWith("payment_")) return "Financial";
      return "Other";
    }

    /* -------------------------------------------------------
       APPLY FILTER
    ------------------------------------------------------- */
    function applyFilter() {
      let filtered = [...events];

      // Date >= event_timestamp
      const dateVal = dateInput.value;
      if (dateVal) {
        const cutoff = new Date(dateVal);
        filtered = filtered.filter(ev => {
          const ts = ev.event_timestamp ? new Date(ev.event_timestamp) : null;
          return ts && ts >= cutoff;
        });
      }

      // Section filter
      const sectionVal = sectionSelect.value;
      if (sectionVal) {
        filtered = filtered.filter(ev => mapSection(ev.event_type) === sectionVal);
      }

      return filtered;
    }

    /* -------------------------------------------------------
       SORT + RENDER TABLE
    ------------------------------------------------------- */
    function renderTable() {
      const filtered = applyFilter();
      const sorted = [...filtered];

      sorted.sort((a, b) => {
        if (currentSortField === "event_timestamp") {
          const da = a.event_timestamp ? new Date(a.event_timestamp) : new Date(0);
          const db = b.event_timestamp ? new Date(b.event_timestamp) : new Date(0);
          return currentSortDirection === "asc" ? da - db : db - da;
        }

        if (currentSortField === "section") {
          const sa = mapSection(a.event_type).toLowerCase();
          const sb = mapSection(b.event_type).toLowerCase();
          return currentSortDirection === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
        }

        // summary
        const va = (a.summary || "").toLowerCase();
        const vb = (b.summary || "").toLowerCase();
        return currentSortDirection === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      });

      // Headers with arrows
      const headerDefs = [
        { field: "event_timestamp", label: "Date" },
        { field: "section",        label: "Section" },
        { field: "summary",        label: "Summary" }
      ];

      const headers = headerDefs.map(h => {
        const isSorted = currentSortField === h.field;
        const upArrow   = isSorted && currentSortDirection === "asc"  ? "▲" : "△";
        const downArrow = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

        return `
          <th class="sortable" data-field="${h.field}">
            ${escapeHtml(h.label)}
            <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
              <span class="sort-up">${upArrow}</span>
              <span class="sort-down">${downArrow}</span>
            </span>
          </th>
        `;
      }).join("");

      const rows = sorted.map(ev => {
        const section = mapSection(ev.event_type);
        return `
          <tr>
            <td>${formatDateTime(ev.event_timestamp)}</td>
            <td>${escapeHtml(section)}</td>
            <td>${escapeHtml(ev.summary || "")}</td>
            <td><button class="btn-primary btn-details" data-type="${ev.event_type}" data-id="${ev.event_source_id}" data-summary="${escapeHtml(ev.summary || "")}" data-date="${ev.event_timestamp}">Details</button></td>
          </tr>
        `;
      }).join("");

      const headerText =
        sorted.length >= 1000
          ? `
            <h4>Showing 1,000+ timeline events (partial list)</h4>
            <div style="font-size:0.85em; color:#666; margin-bottom:8px;">
              Refine your filter to narrow results.
            </div>
          `
          : `<h4>Showing ${sorted.length} timeline events</h4>`;

      tableDiv.innerHTML = `
        ${headerText}
        <table class="notes-table">
          <thead>
            <tr>
              ${headers}
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="4">(no timeline events found)</td></tr>`}
          </tbody>
        </table>
      `;

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

          renderTable();
        });
      });

      /* -------------------------------------------------------
         DETAILS BUTTON ROUTING (NOW WITH NOTES FILTER PASSING)
      ------------------------------------------------------- */
      tableDiv.querySelectorAll(".btn-details").forEach(btn => {
        btn.addEventListener("click", () => {
          const eventType = btn.dataset.type;

          /* -----------------------------
             NOTES: pass filters to portalState
          ------------------------------*/
          if (eventType.startsWith("note_")) {
            const rawDate = btn.dataset.date;
            const summary = btn.dataset.summary || "";

            // Set filters for Notes tab
            portalState.notesFilterDate = rawDate ? rawDate.split("T")[0] : null;
            portalState.notesFilterSubject = summary || null;

            // Switch to Notes tab
            const notesBtn = document.querySelector('#contacts-subtabs button[data-subtab="notes"]');
            if (notesBtn) notesBtn.click();
            return;
          }

          /* -----------------------------
             CONTACTS
          ------------------------------*/
          if (eventType.startsWith("contact_")) {
            const btnTab = document.querySelector('#contacts-subtabs button[data-subtab="details"]');
            if (btnTab) btnTab.click();
            return;
          }

          /* -----------------------------
             RELATIONSHIPS
          ------------------------------*/
          if (eventType.startsWith("relationship_")) {
            const btnTab = document.querySelector('#contacts-subtabs button[data-subtab="relationships"]');
            if (btnTab) btnTab.click();
            return;
          }

          /* -----------------------------
             FINANCIALS
          ------------------------------*/
          if (eventType.startsWith("payment_")) {
            const btnTab = document.querySelector('#contacts-subtabs button[data-subtab="financials"]');
            if (btnTab) btnTab.click();
            return;
          }
        });
      });
    }

    /* -------------------------------------------------------
       FILTER BUTTONS
    ------------------------------------------------------- */
    document.getElementById("btnApplyTimelineFilter").addEventListener("click", renderTable);

    document.getElementById("btnClearTimelineFilter").addEventListener("click", () => {
      dateInput.value = "";
      sectionSelect.value = "";
      renderTable();
    });

    /* -------------------------------------------------------
       INITIAL LOAD
    ------------------------------------------------------- */
    await fetchTimeline();
    renderTable();

  } catch (err) {
    container.innerHTML = `
      <h4>Timeline</h4>
      <p>Error loading timeline: ${escapeHtml(err.message || "Unknown error")}</p>
    `;
    console.error("[Timeline] Error in renderContactTimeline:", err);
  }
}

