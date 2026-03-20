// js/contacts/tab-timeline.js
// Contact Timeline Tab — Full Production Version
// Matches styling + patterns of tab-list.js

import { escapeHtml, formatDateTime } from "../utilities.js";

/* -------------------------------------------------------
   MAIN ENTRY: Render Contact Timeline
------------------------------------------------------- */
export async function renderContactTimeline(container, portalState, contactId) {
  try {
    container.innerHTML = `
      <section class="card">
        <h2>Timeline for ${escapeHtml(portalState.selectedContactName || "")}</h2>

        <!-- FILTER BAR -->
        <div style="display:flex; align-items:flex-start; gap:20px; flex-wrap:wrap; margin-bottom:6px;">

          <!-- DATE FILTER -->
          <label style="display:flex; flex-direction:column;">
            <span>Date >=</span>
            <input type="date" id="timelineDateFilter" style="min-width:160px;">
          </label>

          <!-- SECTION FILTER -->
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

        <!-- BUTTONS -->
        <div style="display:flex; gap:10px; margin-bottom:12px;">
          <button id="btnApplyTimelineFilter" class="secondary">Apply Filter</button>
          <button id="btnClearTimelineFilter" class="secondary">Clear Filter</button>
        </div>

        <div id="timelineTable">(loading…)</div>
      </section>
    `;

    const tableDiv = container.querySelector("#timelineTable");
    const dateInput = document.getElementById("timelineDateFilter");
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

      // Date filter
      const dateVal = dateInput.value;
      if (dateVal) {
        const cutoff = new Date(dateVal);
        filtered = filtered.filter(ev => new Date(ev.event_timestamp) >= cutoff);
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
          const da = new Date(a.event_timestamp);
          const db = new Date(b.event_timestamp);
          return currentSortDirection === "asc" ? da - db : db - da;
        }

        const valA = (a[currentSortField] || "").toLowerCase();
        const valB = (b[currentSortField] || "").toLowerCase();
        return currentSortDirection === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      });

      const rows = sorted.map(ev => {
        const section = mapSection(ev.event_type);

        return `
          <tr>
            <td>${formatDateTime(ev.event_timestamp)}</td>
            <td>${escapeHtml(section)}</td>
            <td>${escapeHtml(ev.summary || "")}</td>
            <td><button class="btn-primary btn-details" data-type="${ev.event_type}" data-id="${ev.event_source_id}">Details</button></td>
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
              <th class="sortable" data-field="event_timestamp">Date</th>
              <th class="sortable" data-field="section">Section</th>
              <th class="sortable" data-field="summary">Summary</th>
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
         DETAILS BUTTON ROUTING
      ------------------------------------------------------- */
      tableDiv.querySelectorAll(".btn-details").forEach(btn => {
        btn.addEventListener("click", async () => {
          const eventType = btn.dataset.type;
          const sourceId = btn.dataset.id;

          // ROUTING LOGIC
          if (eventType.startsWith("contact_")) {
            document.querySelector('#contacts-subtabs button[data-subtab="details"]').click();
          } else if (eventType.startsWith("note_")) {
            document.querySelector('#contacts-subtabs button[data-subtab="notes"]').click();
          } else if (eventType.startsWith("relationship_")) {
            document.querySelector('#contacts-subtabs button[data-subtab="relationships"]').click();
          } else if (eventType.startsWith("payment_")) {
            alert("Financials tab coming soon!");
          }
        });
      });
    }

    /* -------------------------------------------------------
       FILTER BUTTONS
    ------------------------------------------------------- */
    document.getElementById("btnApplyTimelineFilter").addEventListener("click", renderTable);

    document.getElementById("btnClearTimelineFilter").addEventListener("click", async () => {
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
