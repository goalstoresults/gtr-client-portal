// ------------------------------------------------------------
// RENDER E‑CAMPAIGNS → TOP CONTACTS (FULL GRID + SORTING)
// ------------------------------------------------------------
import { escapeHtml, formatDateTime } from "../utilities.js";

let currentSortField = "total_clicks";
let currentSortDirection = "desc";

const columns = [
  { key: "contact_name", label: "Contact" },
  { key: "email", label: "Email" },
  { key: "total_opens", label: "Opens" },
  { key: "total_clicks", label: "Clicks" },
  { key: "total_unsubscribes", label: "Unsubs" },
  { key: "last_activity_at", label: "Last Activity" },
  { key: "actions", label: "" }
];

export async function renderECTopContacts(container, portalState, selectedYear = null) {
  container.innerHTML = `
    <section class="card">
      <h3>Top Contacts</h3>
      <p>Loading contacts...</p>
    </section>
  `;

  try {
    const res = await fetch(
      `https://ecampaigns-module.dennis-e64.workers.dev/analytics/top-contacts?project=${portalState.project}${selectedYear ? `&year=${selectedYear}` : ""}`,
      { cache: "no-cache" }
    );

    let rows = await res.json();
    if (!Array.isArray(rows)) rows = [];

    // Normalize fields
    rows.forEach(r => {
      r.contact_id = r.contact_id;
      r.contact_name = r.contact_name || "(No name)";
      r.email = r.email || "";
      r.total_opens = r.total_opens ?? 0;
      r.total_clicks = r.total_clicks ?? 0;
      r.total_unsubscribes = r.total_unsubscribes ?? 0;
      r.last_activity_at = r.last_activity_at || null;
    });

    renderTable(rows, container, portalState, selectedYear);
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <section class="card">
        <h3>Top Contacts</h3>
        <p class="error">Unable to load contacts.</p>
      </section>
    `;
  }
}

function renderTable(rows, container, portalState, selectedYear) {
  sortContacts(rows);

  container.innerHTML = `
    <section class="card">
      <h3>Top Contacts</h3>
      <p>Contacts with engagement from your current contacts.</p>
      <table class="notes-table">
        <thead>
          <tr>${renderHeader()}</tr>
        </thead>
        <tbody>
          ${renderRows(rows)}
        </tbody>
      </table>
    </section>
  `;

  attachSortHandlers(rows, container, portalState, selectedYear);
  attachExpandHandlers(rows, portalState);
}

function sortContacts(rows) {
  rows.sort((a, b) => {
    const x = a[currentSortField];
    const y = b[currentSortField];

    if (typeof x === "number" && typeof y === "number") {
      return currentSortDirection === "asc" ? x - y : y - x;
    }

    if (currentSortField === "last_activity_at") {
      const dx = x ? new Date(x) : new Date(0);
      const dy = y ? new Date(y) : new Date(0);
      return currentSortDirection === "asc" ? dx - dy : dy - dx;
    }

    return currentSortDirection === "asc"
      ? String(x || "").localeCompare(String(y || ""))
      : String(y || "").localeCompare(String(x || ""));
  });
}

function renderHeader() {
  return columns
    .map(col => {
      const isSorted = currentSortField === col.key;
      const upArrow = isSorted && currentSortDirection === "asc" ? "▲" : "△";
      const downArrow = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

      return `
        <th class="${col.key !== 'actions' ? 'sortable' : ''}" data-field="${col.key}">
          ${escapeHtml(col.label)}
          ${col.key !== "actions" ? `
            <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
              <span class="sort-up">${upArrow}</span>
              <span class="sort-down">${downArrow}</span>
            </span>
          ` : ""}
        </th>
      `;
    })
    .join("");
}

function renderRows(rows) {
  return rows
    .map(row => {
      const lastActivity = row.last_activity_at
        ? formatDateTime(row.last_activity_at)
        : "—";

      return `
        <tr>
          <td>${escapeHtml(row.contact_name)}</td>
          <td>${escapeHtml(row.email)}</td>
          <td>${row.total_opens}</td>
          <td>${row.total_clicks}</td>
          <td>${row.total_unsubscribes}</td>
          <td>${lastActivity}</td>
          <td>
            <button 
              class="expand-contact-btn"
              data-contact-id="${row.contact_id}"
              style="background:none;border:none;color:#0077cc;text-decoration:underline;cursor:pointer;padding:0;"
            >
              View Activity
            </button>
          </td>
        </tr>

        <tr class="contact-detail-row" id="contact-detail-${row.contact_id}" style="display:none;">
          <td colspan="7">
            <div class="detail-box" style="padding: 12px;">
              <div class="detail-field">
                <strong>Activity for ${escapeHtml(row.contact_name)} (${escapeHtml(row.email)})</strong>
              </div>
              <div class="contact-activity-container" data-contact-id="${row.contact_id}">
                <p>Loading activity...</p>
              </div>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function attachSortHandlers(rows, container, portalState, selectedYear) {
  container.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const field = th.dataset.field;

      if (currentSortField === field) {
        currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
      } else {
        currentSortField = field;
        currentSortDirection = "asc";
      }

      renderTable(rows, container, portalState, selectedYear);
    });
  });
}

function attachExpandHandlers(rows, portalState) {
  document.querySelectorAll(".expand-contact-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const contactId = btn.dataset.contactId;
      const detailRow = document.getElementById(`contact-detail-${contactId}`);
      const container = detailRow.querySelector(".contact-activity-container");

      const isHidden = detailRow.style.display === "none";

      if (isHidden) {
        detailRow.style.display = "table-row";
        btn.textContent = "Hide Activity";

        // Only load once per contact
        if (!container.dataset.loaded) {
          await loadContactActivity(contactId, container, portalState);
          container.dataset.loaded = "true";
        }
      } else {
        detailRow.style.display = "none";
        btn.textContent = "View Activity";
      }
    });
  });
}

async function loadContactActivity(contactId, container, portalState) {
  try {
    const res = await fetch(
      `https://ecampaigns-module.dennis-e64.workers.dev/analytics/contact-activity?project=${portalState.project}&contact_id=${encodeURIComponent(contactId)}`,
      { cache: "no-cache" }
    );

    let events = await res.json();
    if (!Array.isArray(events)) events = [];

    // Sort newest → oldest
    events.sort((a, b) => new Date(b.event_at) - new Date(a.event_at));

    if (events.length === 0) {
      container.innerHTML = `<p>No activity found for this contact.</p>`;
      return;
    }

    container.innerHTML = `
      <table class="notes-table" style="margin-top:8px;">
        <thead>
          <tr>
            <th>When</th>
            <th>Type</th>
            <th>Campaign</th>
            <th>Subject</th>
          </tr>
        </thead>
        <tbody>
          ${events
            .map(ev => `
              <tr>
                <td>${formatDateTime(ev.event_at)}</td>
                <td>${escapeHtml(ev.event_type || "")}</td>
                <td>${escapeHtml(ev.campaign_name || "")}</td>
                <td>${escapeHtml(ev.subject_line || "")}</td>
              </tr>
            `)
            .join("")}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="error">Unable to load activity.</p>`;
  }
}
