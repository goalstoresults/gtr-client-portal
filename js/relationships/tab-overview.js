/* -------------------------------------------------------
Relationships Overview Tab (Lazy-load, efficient)
------------------------------------------------------- */

import { escapeHtml } from "../utils/escapeHtml.js";

/*
  High-level architecture:

  - On load:
      - Use your existing loadOverviewData() to fetch:
          • ALL relationships (unlimited)
          • FIRST 1000 contacts (for summary only)
      - Compute totals from relationships
      - Render summary rows

  - On expand of a row:
      - Fetch ONLY the relationships for that row (backend-filtered)
      - Extract unique contact IDs
      - Fetch ONLY those contacts by ID (bulk endpoint)
      - Build a contactMap from those contacts
      - Render drilldown table with guaranteed names
      - If > 1000 rows, show "Showing first 1000 of X" message

  - On collapse:
      - Remove drilldown container for that row
*/

/* -------------------------------------------------------
Entry point
------------------------------------------------------- */

export async function renderRelOverview(container, portalState) {
  container.innerHTML = `
    <div class="rel-overview">
      <h3>Relationships Overview</h3>
      <div id="rel-overview-summary" class="rel-overview-summary">
        <div class="loading">Loading relationship summary...</div>
      </div>
    </div>
  `;

  try {
    const project = portalState?.project;

    // ⭐ Use your existing loadOverviewData()
    const { contacts, relationships } = await loadOverviewData(project);

    const totals = computeOverviewTotals(relationships);

    renderOverviewSummary(
      container.querySelector("#rel-overview-summary"),
      totals,
      portalState
    );
  } catch (err) {
    console.error("Error loading relationship overview:", err);
    const summaryEl = container.querySelector("#rel-overview-summary");
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="error">
          Failed to load relationship overview.
        </div>
      `;
    }
  }
}

/* -------------------------------------------------------
Totals computation (from full relationships dataset)
------------------------------------------------------- */

function computeOverviewTotals(relationships) {
  const total_relationship_records = relationships.length;

  const clientsWithRels = new Set();
  const uniqueRelated = new Set();
  const byTypeMap = {};

  relationships.forEach(r => {
    if (r.source_contact_id) clientsWithRels.add(r.source_contact_id);
    if (r.related_contact_id) uniqueRelated.add(r.related_contact_id);

    const t = r.relationship_type || "Unknown";
    byTypeMap[t] = (byTypeMap[t] || 0) + 1;
  });

  const by_type = Object.entries(byTypeMap).map(([type, count]) => ({
    type,
    count
  }));

  return {
    total_relationship_records,
    total_clients_with_relationships: clientsWithRels.size,
    total_unique_related_contacts: uniqueRelated.size,
    by_type
  };
}

/* -------------------------------------------------------
Backend calls for expand logic
------------------------------------------------------- */

async function fetchSectionRows(project, sectionKey) {
  const url = `https://contacts-module.dennis-e64.workers.dev/relationships/overview-section?project=${encodeURIComponent(
    project
  )}&section=${encodeURIComponent(sectionKey)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load section rows");
  return res.json();
}

async function fetchContactsByIds(project, ids) {
  const url = `https://contacts-module.dennis-e64.workers.dev/contacts/bulk-get`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, ids })
  });

  if (!res.ok) throw new Error("Failed to load contacts by IDs");
  return res.json();
}

/* -------------------------------------------------------
Overview summary rendering
------------------------------------------------------- */

function renderOverviewSummary(container, totals, portalState) {
  if (!totals) {
    container.innerHTML = `<div class="muted">No relationship data available.</div>`;
    return;
  }

  const {
    total_relationship_records,
    total_clients_with_relationships,
    total_unique_related_contacts,
    by_type
  } = totals;

  const grandTotal = total_relationship_records || 0;

  let html = `
    <table class="rel-overview-table">
      <thead>
        <tr>
          <th>Category</th>
          <th class="numeric">Count</th>
          <th class="numeric">Percent</th>
          <th class="actions">Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  html += renderSummaryRow({
    label: "Total Relationship Records",
    key: "total_relationship_records",
    count: total_relationship_records,
    grandTotal
  });

  html += renderSummaryRow({
    label: "Total Clients With Relationships",
    key: "total_clients_with_relationships",
    count: total_clients_with_relationships,
    grandTotal
  });

  html += renderSummaryRow({
    label: "Total Unique Related Contacts",
    key: "total_unique_related_contacts",
    count: total_unique_related_contacts,
    grandTotal
  });

  html += `
    <tr class="section-divider">
      <td colspan="4">By Relationship Type</td>
    </tr>
  `;

  by_type.forEach(row => {
    html += renderSummaryRow({
      label: `Relationships of type "${row.type}"`,
      key: `type:${row.type}`,
      count: row.count,
      grandTotal
    });
  });

  html += `
      </tbody>
    </table>
  `;

  container.innerHTML = html;

  container.querySelectorAll(".rel-summary-expand-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tr = btn.closest("tr");
      if (!tr) return;

      const sectionKey = tr.dataset.sectionKey;
      const expanded = tr.dataset.expanded === "true";

      if (expanded) {
        collapseSection(tr);
      } else {
        await expandSection(tr, sectionKey, portalState);
      }
    });
  });
}

function renderSummaryRow({ label, key, count, grandTotal }) {
  const pct =
    grandTotal && count ? ((count / grandTotal) * 100).toFixed(1) : "0.0";

  return `
    <tr class="rel-summary-row" data-section-key="${escapeHtml(
      key
    )}" data-expanded="false">
      <td>${escapeHtml(label)}</td>
      <td class="numeric">${count}</td>
      <td class="numeric">${pct}%</td>
      <td class="actions">
        ${
          count > 0
            ? `<button type="button" class="rel-summary-expand-btn">Expand</button>`
            : `<span class="muted">No data</span>`
        }
      </td>
    </tr>
  `;
}

/* -------------------------------------------------------
Expand / Collapse logic
------------------------------------------------------- */

async function expandSection(rowEl, sectionKey, portalState) {
  rowEl.dataset.expanded = "true";
  const btn = rowEl.querySelector(".rel-summary-expand-btn");
  if (btn) btn.textContent = "Collapse";

  const tableBody = rowEl.parentElement;
  const drillRow = document.createElement("tr");
  drillRow.className = "rel-drilldown-row";

  const colCount = rowEl.children.length;
  drillRow.innerHTML = `
    <td colspan="${colCount}">
      <div class="rel-drilldown-container">
        <div class="loading">Loading details...</div>
      </div>
    </td>
  `;

  tableBody.insertBefore(drillRow, rowEl.nextSibling);

  const drillContainer = drillRow.querySelector(".rel-drilldown-container");

  try {
    const project = portalState?.project;

    const { rows, total_count } = await fetchSectionRows(project, sectionKey);

    const DISPLAY_LIMIT = 1000;
    const displayRows =
      rows.length > DISPLAY_LIMIT ? rows.slice(0, DISPLAY_LIMIT) : rows;

    const idSet = new Set();
    displayRows.forEach(r => {
      if (r.source_contact_id) idSet.add(r.source_contact_id);
      if (r.related_contact_id) idSet.add(r.related_contact_id);
      if (r.contact_id) idSet.add(r.contact_id);
    });

    const ids = Array.from(idSet);

    const contacts = await fetchContactsByIds(project, ids);

    const contactMap = {};
    contacts.forEach(c => {
      const name =
        c.search_name ||
        `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
        c.business_name ||
        c.email ||
        "(unknown)";
      contactMap[c.contact_id] = {
        id: c.contact_id,
        name,
        email: c.email || "",
        type: c.contact_type || ""
      };
    });

    renderSectionDrilldown(
      drillContainer,
      sectionKey,
      displayRows,
      total_count,
      contactMap,
      portalState
    );
  } catch (err) {
    console.error("Error expanding section:", err);
    drillContainer.innerHTML = `
      <div class="error">
        Failed to load details for this section.
      </div>
    `;
  }
}

function collapseSection(rowEl) {
  rowEl.dataset.expanded = "false";
  const btn = rowEl.querySelector(".rel-summary-expand-btn");
  if (btn) btn.textContent = "Expand";

  const nextRow = rowEl.nextElementSibling;
  if (nextRow && nextRow.classList.contains("rel-drilldown-row")) {
    nextRow.remove();
  }
}

/* -------------------------------------------------------
Drilldown rendering
------------------------------------------------------- */

function renderSectionDrilldown(
  container,
  sectionKey,
  rows,
  totalCount,
  contactMap,
  portalState
) {
  const label = buildSectionLabel(sectionKey);

  let html = `
    <div class="rel-drilldown-header">
      <strong>${escapeHtml(label)}</strong>
  `;

  if (rows.length < totalCount) {
    html += `
      <div class="muted">
        Showing first ${rows.length} of ${totalCount} records. Apply filters to narrow results.
      </div>
    `;
  }

  html += `</div><div class="rel-drilldown-body"></div>`;

  container.innerHTML = html;

  const bodyEl = container.querySelector(".rel-drilldown-body");

  if (sectionKey === "total_clients_with_relationships") {
    renderClientsDrilldown(bodyEl, rows, contactMap, portalState);
  } else if (sectionKey === "total_unique_related_contacts") {
    renderClientsDrilldown(bodyEl, rows, contactMap, portalState);
  } else {
    renderRelationshipsDrilldown(bodyEl, rows, contactMap, portalState);
  }
}

function buildSectionLabel(sectionKey) {
  if (sectionKey === "total_relationship_records") {
    return "All Relationship Records";
  }
  if (sectionKey === "total_clients_with_relationships") {
    return "Clients With At Least One Relationship";
  }
  if (sectionKey === "total_unique_related_contacts") {
    return "Unique Related Contacts";
  }
  if (sectionKey.startsWith("type:")) {
    const t = sectionKey.slice("type:".length);
    return `Relationships of type "${t}"`;
  }
  return sectionKey;
}

/* -------------------------------------------------------
Clients drilldown
------------------------------------------------------- */

function renderClientsDrilldown(container, rows, contactMap, portalState) {
  let html = `
    <div style="margin-top:4px; max-height:360px; overflow:auto;">
      <table class="notes-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
  `;

  rows.forEach(r => {
    const c = contactMap[r.contact_id] || null;

    const name = c?.name || r.contact_id || "(unknown)";
    const email = c?.email || "";
    const type = c?.type || "";

    html += `
      <tr>
        <td>
          <a href="#" class="drill-contact" data-id="${escapeHtml(
            r.contact_id
          )}">
            ${escapeHtml(name)}
          </a>
        </td>
        <td>${escapeHtml(email)}</td>
        <td>${escapeHtml(type)}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;

  container.querySelectorAll(".drill-contact").forEach(a => {
    a.addEventListener("click", evt => {
      evt.preventDefault();
      const id = a.dataset.id;
      const name = a.textContent.trim();

      portalState.selectedContactId = id;
      portalState.selectedContactName = name;

      document
        .querySelector('#relationships-subtabs button[data-subtab="details"]')
        ?.click();
    });
  });
}

/* -------------------------------------------------------
Relationships drilldown
------------------------------------------------------- */

function renderRelationshipsDrilldown(container, rows, contactMap, portalState) {
  let html = `
    <div style="margin-top:4px; max-height:360px; overflow:auto;">
      <table class="notes-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Target</th>
            <th>Type</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
  `;

  rows.forEach(r => {
    const s = contactMap[r.source_contact_id];
    const t = contactMap[r.related_contact_id];

    const sName = s?.name || r.source_contact_id || "(unknown)";
    const tName = t?.name || r.related_contact_id || "(unknown)";

    html += `
      <tr>
        <td>
          <a href="#" class="drill-contact" data-id="${escapeHtml(
            r.source_contact_id
          )}">
            ${escapeHtml(sName)}
          </a>
        </td>
        <td>
          <a href="#" class="drill-contact" data-id="${escapeHtml(
            r.related_contact_id
          )}">
            ${escapeHtml(tName)}
          </a>
        </td>
        <td>${escapeHtml(r.relationship_type || "")}</td>
        <td>${escapeHtml(r.relationship_role || "")}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;

  container.querySelectorAll(".drill-contact").forEach(a => {
    a.addEventListener("click", evt => {
      evt.preventDefault();
      const id = a.dataset.id;
      const name = a.textContent.trim();

      portalState.selectedContactId = id;
      portalState.selectedContactName = name;

      document
        .querySelector('#relationships-subtabs button[data-subtab="details"]')
        ?.click();
    });
  });
}

/* -------------------------------------------------------
END OF FILE
------------------------------------------------------- */
