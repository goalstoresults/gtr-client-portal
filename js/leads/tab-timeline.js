// js/leads/tab-timeline.js
// Lead Timeline — reads /leads/history.
// Displays stage history and quote events without modifying records.

import { escapeHtml } from "../utilities.js";

const LEADS_MODULE_URL =
  "https://leads-module.dennis-e64.workers.dev";

export async function renderLeadTimeline(container, portalState) {
  const leadId = portalState.activeLeadId;
  const project = portalState.project;

  if (!leadId || !project) {
    container.innerHTML = `
      <section class="card">
        <h2>Timeline</h2>
        <p class="muted">Select a lead first.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <h2>Lead Timeline</h2>

      <div style="
        display:flex;
        align-items:flex-start;
        gap:20px;
        flex-wrap:wrap;
        margin-bottom:10px;
      ">
        <label style="display:flex;flex-direction:column;gap:4px;">
          <span>Date ≥</span>
          <input
            type="date"
            id="leadTimelineDateFilter"
            style="min-width:160px;"
          >
        </label>

        <label style="display:flex;flex-direction:column;gap:4px;">
          <span>Section</span>
          <select
            id="leadTimelineSectionFilter"
            class="form-control"
            style="min-width:160px;"
          >
            <option value="">ALL</option>
            <option value="Pipeline">Pipeline</option>
            <option value="Quotes">Quotes</option>
            <option value="Other">Other</option>
          </select>
        </label>
      </div>

      <div style="
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-bottom:12px;
      ">
        <button id="btnApplyLeadTimelineFilter" class="secondary">
          Apply Filter
        </button>

        <button id="btnClearLeadTimelineFilter" class="secondary">
          Clear Filter
        </button>

        <button id="btnRefreshLeadTimeline" class="secondary">
          Refresh
        </button>
      </div>

      <div
        id="leadTimelineStatus"
        role="status"
        aria-live="polite"
        class="muted"
        style="margin-bottom:10px;"
      ></div>

      <div id="leadTimelineTable" style="overflow-x:auto;">
        <p class="muted">Loading timeline…</p>
      </div>
    </section>
  `;

  const dateInput =
    container.querySelector("#leadTimelineDateFilter");

  const sectionSelect =
    container.querySelector("#leadTimelineSectionFilter");

  const applyButton =
    container.querySelector("#btnApplyLeadTimelineFilter");

  const clearButton =
    container.querySelector("#btnClearLeadTimelineFilter");

  const refreshButton =
    container.querySelector("#btnRefreshLeadTimeline");

  const statusDiv =
    container.querySelector("#leadTimelineStatus");

  const tableDiv =
    container.querySelector("#leadTimelineTable");

  let events = [];
  let hasLoaded = false;
  let loading = false;

  let appliedDate = "";
  let appliedSection = "";

  let sortField = "changed_at";
  let sortDirection = "desc";

  const expandedEvents = new Set();

  /*
    This screen belongs to one lead. Prevent a delayed response
    from rendering after the user has switched leads or tabs.
  */
  function isCurrentView() {
    return (
      container.contains(tableDiv) &&
      portalState.activeLeadId === leadId &&
      portalState.project === project
    );
  }

  function eventKey(event) {
    return String(event.history_id || "");
  }

  function eventDate(event) {
    return event.changed_at || event.stage_entered_at || "";
  }

  /*
    History timestamps are currently stored without timezone.
    The worker writes UTC timestamps, so interpret timestamps
    without an explicit offset as UTC for display.
  */
  function parseTimestamp(value) {
    if (!value) return null;

    let text = String(value).trim().replace(" ", "T");

    if (
      /^\d{4}-\d{2}-\d{2}T/.test(text) &&
      !/(Z|[+-]\d{2}(?::?\d{2})?)$/i.test(text)
    ) {
      text += "Z";
    }

    const date = new Date(text);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  function displayDate(value) {
    const date = parseTimestamp(value);

    return date ? date.toLocaleString() : "Not recorded";
  }

  function displayMoney(value) {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    ) {
      return "Not recorded";
    }

    const number = Number(value);

    return Number.isFinite(number)
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD"
        }).format(number)
      : String(value);
  }

  function eventDetails(event) {
    const details = event.event_details;

    if (
      details &&
      typeof details === "object" &&
      !Array.isArray(details)
    ) {
      return details;
    }

    if (typeof details === "string") {
      try {
        const parsed = JSON.parse(details);

        return parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
          ? parsed
          : {};
      } catch {
        return {};
      }
    }

    return {};
  }

  function sectionFor(event) {
    const type = String(event.event_type || "");

    if (type.startsWith("quote_")) return "Quotes";

    if (
      !type ||
      type === "pipeline_stage_change" ||
      type.startsWith("pipeline_") ||
      type === "lead_created"
    ) {
      return "Pipeline";
    }

    return "Other";
  }

  function summaryFor(event) {
    if (event.event_summary) {
      return String(event.event_summary);
    }

    const details = eventDetails(event);

    if (details.action === "lead_created") {
      return `Lead created — ${event.stage_name || "Inquiry"}`;
    }

    if (
      details.previous_stage_name &&
      event.stage_name
    ) {
      return (
        `Stage changed: ${details.previous_stage_name}` +
        ` → ${event.stage_name}`
      );
    }

    const labels = {
      quote_released: "Quote released",
      quote_sent: "Quote sent",
      quote_viewed: "Quote viewed",
      quote_accepted: "Quote confirmation received",
      quote_revision_created: "Revised quote created"
    };

    if (labels[event.event_type]) {
      return (
        labels[event.event_type] +
        (details.quote_number ? ` — ${details.quote_number}` : "")
      );
    }

    if (sectionFor(event) === "Pipeline") {
      return `Stage recorded — ${event.stage_name || "Not set"}`;
    }

    return String(event.event_type || "History event")
      .replace(/_/g, " ");
  }

  function filteredEvents() {
    let filtered = [...events];

    if (appliedDate) {
      // Date filter uses the beginning of the selected local day.
      const cutoff = new Date(`${appliedDate}T00:00:00`);

      filtered = filtered.filter(event => {
        const date = parseTimestamp(eventDate(event));
        return date && date >= cutoff;
      });
    }

    if (appliedSection) {
      filtered = filtered.filter(
        event => sectionFor(event) === appliedSection
      );
    }

    return filtered;
  }

  function detailsMarkup(event) {
    const details = eventDetails(event);

    const fields = [
      ["Pipeline", event.pipeline_name],
      ["Stage", event.stage_name],
      ["Previous stage", details.previous_stage_name],
      ["Status", event.status],
      ["Changed by", event.changed_by],
      ["Quote number", details.quote_number],
      ["Quote ID", event.quote_id],
      ["Assigned user ID", event.assigned_user_id],
      ["Updated user ID", event.updated_user_id]
    ];

    if (event.amount !== null && event.amount !== undefined) {
      fields.push(["Lead amount", displayMoney(event.amount)]);
    }

    const visibleFields = fields.filter(
      ([, value]) =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
    );

    const fieldHtml = visibleFields.map(([label, value]) => `
      <div style="margin-bottom:6px;overflow-wrap:anywhere;">
        <span style="font-weight:600;">
          ${escapeHtml(label)}:
        </span>
        ${escapeHtml(String(value))}
      </div>
    `).join("");

    const extraDetails = Object.keys(details).length
      ? `
        <details style="margin-top:12px;">
          <summary style="cursor:pointer;">
            Saved event data
          </summary>
          <pre style="
            white-space:pre-wrap;
            overflow-wrap:anywhere;
            background:#fff;
            border:1px solid #e1e6ec;
            padding:12px;
            border-radius:4px;
            font-size:12px;
          ">${escapeHtml(JSON.stringify(details, null, 2))}</pre>
        </details>
      `
      : "";

    return `
      <div style="padding:8px 4px;">
        ${fieldHtml || '<p class="muted">No additional details.</p>'}
        ${extraDetails}
      </div>
    `;
  }

  function renderTable() {
    const sorted = filteredEvents();

    sorted.sort((a, b) => {
      let comparison;

      if (sortField === "changed_at") {
        const timeA =
          parseTimestamp(eventDate(a))?.getTime() ?? 0;

        const timeB =
          parseTimestamp(eventDate(b))?.getTime() ?? 0;

        comparison = timeA - timeB;
      } else if (sortField === "section") {
        comparison = sectionFor(a).localeCompare(sectionFor(b));
      } else {
        comparison = summaryFor(a).localeCompare(summaryFor(b));
      }

      return sortDirection === "asc"
        ? comparison
        : -comparison;
    });

    const headerDefinitions = [
      { field: "changed_at", label: "Date" },
      { field: "section", label: "Section" },
      { field: "summary", label: "Summary" }
    ];

    const headers = headerDefinitions.map(header => {
      const active = sortField === header.field;

      const arrow = active
        ? sortDirection === "asc" ? "▲" : "▼"
        : "↕";

      const ariaSort = active
        ? sortDirection === "asc"
          ? "ascending"
          : "descending"
        : "none";

      return `
        <th aria-sort="${ariaSort}">
          <button
            type="button"
            class="lead-timeline-sort"
            data-sort="${header.field}"
            style="
              background:none;
              border:0;
              padding:0;
              color:inherit;
              font:inherit;
              font-weight:600;
              cursor:pointer;
              text-align:left;
              white-space:nowrap;
            "
          >
            ${escapeHtml(header.label)}
            <span style="margin-left:4px;font-size:0.8em;">
              ${arrow}
            </span>
          </button>
        </th>
      `;
    }).join("");

    const rows = sorted.map((event, index) => {
      const expanded = expandedEvents.has(eventKey(event));

      return `
        <tr>
          <td style="min-width:170px;">
            ${escapeHtml(displayDate(eventDate(event)))}
          </td>

          <td style="min-width:100px;">
            ${escapeHtml(sectionFor(event))}
          </td>

          <td style="min-width:260px;">
            ${escapeHtml(summaryFor(event))}
          </td>

          <td>
            <button
              type="button"
              class="secondary lead-timeline-details"
              data-index="${index}"
              aria-expanded="${expanded}"
              aria-controls="leadTimelineDetails${index}"
            >
              ${expanded ? "Hide" : "Details"}
            </button>
          </td>
        </tr>

        ${
          expanded
            ? `
              <tr id="leadTimelineDetails${index}">
                <td colspan="4" style="background:#f6f9fc;">
                  ${detailsMarkup(event)}
                </td>
              </tr>
            `
            : ""
        }
      `;
    }).join("");

    const countText =
      `Showing ${sorted.length} of ${events.length} loaded events`;

    const limitNotice = events.length >= 1000
      ? `
        <p class="muted" style="font-size:0.85em;">
          The newest 1,000 records are loaded.
          Filters apply only to those loaded records.
        </p>
      `
      : "";

    const emptyText = events.length
      ? "No events match these filters."
      : "No history has been recorded for this lead yet.";

    tableDiv.innerHTML = `
      <h4 style="margin:8px 0 12px;">
        ${escapeHtml(countText)}
      </h4>

      ${limitNotice}

      <table class="notes-table" style="width:100%;">
        <thead>
          <tr>
            ${headers}
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          ${
            rows ||
            `
              <tr>
                <td colspan="4" class="muted">
                  ${escapeHtml(emptyText)}
                </td>
              </tr>
            `
          }
        </tbody>
      </table>
    `;

    tableDiv.querySelectorAll(".lead-timeline-sort")
      .forEach(button => {
        button.addEventListener("click", () => {
          const field = button.dataset.sort;

          if (sortField === field) {
            sortDirection =
              sortDirection === "asc" ? "desc" : "asc";
          } else {
            sortField = field;
            sortDirection =
              field === "changed_at" ? "desc" : "asc";
          }

          renderTable();
        });
      });

    tableDiv.querySelectorAll(".lead-timeline-details")
      .forEach(button => {
        button.addEventListener("click", () => {
          const event = sorted[Number(button.dataset.index)];
          if (!event) return;

          const key = eventKey(event);

          if (expandedEvents.has(key)) {
            expandedEvents.delete(key);
          } else {
            expandedEvents.add(key);
          }

          renderTable();
        });
      });
  }

  async function loadTimeline() {
    if (loading || !isCurrentView()) return;

    loading = true;
    refreshButton.disabled = true;
    refreshButton.textContent = "Loading…";

    statusDiv.style.color = "";
    statusDiv.textContent = "Loading timeline…";

    try {
      const params = new URLSearchParams({
        project,
        lead_id: leadId,
        limit: "1000"
      });

      const response = await fetch(
        `${LEADS_MODULE_URL}/leads/history?${params.toString()}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(
          data.error ||
          `Unable to load timeline (${response.status}).`
        );
      }

      if (!Array.isArray(data.rows)) {
        throw new Error("The history endpoint returned an unexpected response.");
      }

      if (!isCurrentView()) return;

      events = data.rows;
      hasLoaded = true;

      statusDiv.textContent = "";
      renderTable();
    } catch (error) {
      console.error("[Lead Timeline] Load failed:", error);

      if (!isCurrentView()) return;

      statusDiv.style.color = "#b42318";
      statusDiv.textContent =
        `Unable to load timeline: ${error.message || "Unknown error"}` +
        (hasLoaded ? " Previously loaded records remain below." : "");

      if (!hasLoaded) {
        tableDiv.innerHTML = `
          <p class="muted">
            Click Refresh to try again.
          </p>
        `;
      }
    } finally {
      loading = false;

      if (isCurrentView()) {
        refreshButton.disabled = false;
        refreshButton.textContent = "Refresh";
      }
    }
  }

  applyButton.addEventListener("click", () => {
    appliedDate = dateInput.value;
    appliedSection = sectionSelect.value;

    if (hasLoaded) renderTable();
  });

  clearButton.addEventListener("click", () => {
    dateInput.value = "";
    sectionSelect.value = "";
    appliedDate = "";
    appliedSection = "";

    if (hasLoaded) renderTable();
  });

  refreshButton.addEventListener("click", loadTimeline);

  await loadTimeline();
}
