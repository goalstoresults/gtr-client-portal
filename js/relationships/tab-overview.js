/* -------------------------------------------------------
Relationships Overview Tab (Lazy-load, efficient)
------------------------------------------------------- */

import { escapeHtml } from "../utils/escapeHtml.js";

/*
  High-level architecture:

  - On load:
      - Fetch ONLY overview totals (no contacts, no relationships)
      - Render summary rows with Expand/Collapse controls

  - On expand of a row:
      - Fetch ONLY the relationships for that row (backend-filtered)
      - Extract unique contact IDs from those relationships
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
    const totals = await loadOverviewTotals(project);

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
Backend data loading (totals only)
------------------------------------------------------- */

/**
 * Load only the summary totals for the overview.
 * No contacts, no relationships here.
 */
async function loadOverviewTotals(project) {
  // Adjust endpoint/params to match your backend
  const params = new URLSearchParams();
  if (project) params.set("project", project);

  const res = await fetch(`/api/relationships/overview-totals?${params.toString()}`);
  if (!res.ok) {
    throw new Error("Failed to load overview totals");
  }
  const data = await res.json();

  // Expected shape (example):
  // {
  //   total_relationship_records: 40,
  //   total_clients_with_relationships: 12,
  //   total_unique_related_contacts: 25,
  //   by_type: [
  //     { type: "Client - Vendor", count: 20 },
  //     { type: "Family", count: 12 },
  //     ...
  //   ]
  // }

  return data;
}

/* -------------------------------------------------------
Backend data loading (lazy-loaded detail)
------------------------------------------------------- */

/**
 * Fetch relationships for a specific section key.
 * Section key examples:
 *   - "total_relationship_records"
 *   - "total_clients_with_relationships"
 *   - "total_unique_related_contacts"
 *   - "type:Client - Vendor"
 *   - "type:Family"
 */
async function loadRelationshipsForSection(project, sectionKey) {
  const params = new URLSearchParams();
  if (project) params.set("project", project);
  params.set("section", sectionKey);

  const res = await fetch(`/api/relationships/overview-section?${params.toString()}`);
  if (!res.ok) {
    throw new Error("Failed to load relationships for section");
  }
  const data = await res.json();

  // Expected shape:
  // {
  //   rows: [ { ...relationshipRow }, ... ],
  //   total_count: number
  // }

  return data;
}

/**
 * Fetch contacts by a set of IDs (bulk).
 * Expects an array of IDs (strings).
 */
async function loadContactsByIds(project, ids) {
  if (!ids || !ids.length) return [];

  const body = {
    ids,
  };
  if (project) {
    body.project = project;
  }

  const res = await fetch(`/api/contacts/bulk-get`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error("Failed to load contacts by IDs");
  }

  const data = await res.json();

  // Expected shape:
  // [ { id, name, email, contact_type, ... }, ... ]

  return data;
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
    total_relationship_records = 0,
    total_clients_with_relationships = 0,
    total_unique_related_contacts = 0,
    by_type = [],
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

  // Total Relationship Records
  html += renderSummaryRow({
    label: "Total Relationship Records",
    key: "total_relationship_records",
    count: total_relationship_records,
    grandTotal,
  });

  // Total Clients With Relationships
  html += renderSummaryRow({
    label: "Total Clients With Relationships",
    key: "total_clients_with_relationships",
    count: total_clients_with_relationships,
    grandTotal,
  });

  // Total Unique Related Contacts
  html += renderSummaryRow({
    label: "Total Unique Related Contacts",
    key: "total_unique_related_contacts",
    count: total_unique_related_contacts,
    grandTotal,
  });

  // Spacer row
  html += `
    <tr class="section-divider">
      <td colspan="4">By Relationship Type</td>
    </tr>
  `;

  // By Type rows
  by_type.forEach(row => {
    html += renderSummaryRow({
      label: `Relationships of type "${row.type}"`,
      key: `type:${row.type}`,
      count: row.count,
      grandTotal,
    });
  });

  html += `
      </tbody>
    </table>
  `;

  container.innerHTML = html;

  // Wire up expand/collapse handlers
  container
    .querySelectorAll(".rel-summary-expand-btn")
    .forEach(btn => {
      btn.addEventListener("click", async () => {
        const tr = btn.closest("tr");
        if (!tr) return;

        const sectionKey = tr.dataset.sectionKey;
        const expanded = tr.dataset.expanded === "true";

        if (expanded) {
          // Collapse
          collapseSection(tr);
        } else {
          // Expand
          await expandSection(tr, sectionKey, portalState);
        }
      });
    });
}

function renderSummaryRow({ label, key, count, grandTotal }) {
  const pct =
    grandTotal && count
      ? ((count / grandTotal) * 100).toFixed(1)
      : "0.0";

  const safeLabel = escapeHtml(label);
  const safeKey = escapeHtml(key);

  return `
    <tr class="rel-summary-row" data-section-key="${safeKey}" data-expanded="false">
      <td>${safeLabel}</td>
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
Expand / Collapse logic (lazy-load detail)
------------------------------------------------------- */

async function expandSection(rowEl, sectionKey, portalState) {
  if (!sectionKey) return;

  // Mark as expanded
  rowEl.dataset.expanded = "true";
  const btn = rowEl.querySelector(".rel-summary-expand-btn");
  if (btn) btn.textContent = "Collapse";

  // Insert a new row below for the drilldown container
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

    // 1) Load relationships for this section
    const { rows, total_count } = await loadRelationshipsForSection(
      project,
      sectionKey
    );

    const allRows = Array.isArray(rows) ? rows : [];
    const totalCount = typeof total_count === "number" ? total_count : allRows.length;

    // 2) If more than 1000, cap display but show message
    const DISPLAY_LIMIT = 1000;
    const displayRows =
      allRows.length > DISPLAY_LIMIT
        ? allRows.slice(0, DISPLAY_LIMIT)
        : allRows;

    // 3) Extract unique contact IDs from these rows
    const idSet = new Set();
    displayRows.forEach(r => {
      if (r.source_contact_id) idSet.add(r.source_contact_id);
      if (r.related_contact_id) idSet.add(r.related_contact_id);
      if (r.contact_id) idSet.add(r.contact_id); // in case of client-based sections
    });

    const ids = Array.from(idSet);

    // 4) Fetch ONLY those contacts
    const contacts = await loadContactsByIds(project, ids);

    // 5) Build contactMap
    const contactMap = buildContactMapFromContacts(contacts);

    // 6) Render drilldown
    renderSectionDrilldown(
      drillContainer,
      sectionKey,
      displayRows,
      totalCount,
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
Contact map builder
------------------------------------------------------- */

function buildContactMapFromContacts(contacts) {
  const map = {};
  if (!Array.isArray(contacts)) return map;

  contacts.forEach(c => {
    if (!c || !c.id) return;

    const name =
      c.name ||
      [c.first_name, c.last_name].filter(Boolean).join(" ") ||
      c.email ||
      c.business_name ||
      "";

    map[c.id] = {
      id: c.id,
      name,
      email: c.email || "",
      contact_type: c.contact_type || c.type || "",
    };
  });

  return map;
}

/* -------------------------------------------------------
Section drilldown rendering
------------------------------------------------------- */

function renderSectionDrilldown(
  container,
  sectionKey,
  rows,
  totalCount,
  contactMap,
  portalState
) {
  if (!rows || !rows.length) {
    container.innerHTML = `
      <div class="muted">(no rows)</div>
    `;
    return;
  }

  // Determine dataset type based on sectionKey
  // For now, we treat:
  //   - "total_clients_with_relationships" as clients
  //   - everything else as relationships
  let datasetType = "relationships";

  if (sectionKey === "total_clients_with_relationships") {
    datasetType = "clients";
  }

  // Build dataset object
  const label = buildSectionLabel(sectionKey);
  const dataset = {
    type: datasetType,
    label,
    rows,
    totalCount,
  };

  // Render header + optional "showing first N" message
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

  html += `</div>`;

  html += `<div class="rel-drilldown-body"></div>`;

  container.innerHTML = html;

  const bodyEl = container.querySelector(".rel-drilldown-body");

  renderDrilldownTable(bodyEl, dataset, contactMap, portalState);
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
Drilldown rendering
------------------------------------------------------- */

function renderDrilldownTable(container, dataset, contactMap, portalState) {
  const { type, label, rows } = dataset;

  if (!rows || !rows.length) {
    container.innerHTML = `
      <span class="muted">(no rows)</span>
    `;
    return;
  }

  if (type === "clients") {
    renderClientsDrilldown(container, label, rows, contactMap, portalState);
  } else {
    renderRelationshipsDrilldown(container, label, rows, contactMap, portalState);
  }
}

/* -------------------------------------------------------
Clients drilldown (Name only clickable)
------------------------------------------------------- */

function renderClientsDrilldown(container, label, rows, contactMap, portalState) {
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
    const c =
      (r.contact_id && contactMap[r.contact_id]) ||
      (r.id && contactMap[r.id]) ||
      null;

    const name = c?.name || r.contact_name || r.name || r.contact_id || "(unknown)";
    const email = c?.email || r.email || "";
    const contactType = c?.contact_type || r.contact_type || "";

    const contactId = c?.id || r.contact_id || r.id || "";

    html += `
      <tr class="drill-client-row" data-contact-id="${escapeHtml(contactId)}">
        <td>
          <a href="#" class="drill-contact" data-id="${escapeHtml(contactId)}">
            ${escapeHtml(name)}
          </a>
        </td>
        <td>${escapeHtml(email)}</td>
        <td>${escapeHtml(contactType)}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;

  // Clickable names → Details tab
  container.querySelectorAll(".drill-contact").forEach(a => {
    a.addEventListener("click", evt => {
      evt.preventDefault();
      const id = a.dataset.id;
      const name = a.textContent.trim();

      portalState.selectedContactId = id;
      portalState.selectedContactName = name;

      // Auto-switch to Details tab
      document
        .querySelector('#relationships-subtabs button[data-subtab="details"]')
        ?.click();
    });
  });
}

/* -------------------------------------------------------
Relationships drilldown (Source + Target names clickable)
------------------------------------------------------- */

function renderRelationshipsDrilldown(
  container,
  label,
  relationships,
  contactMap,
  portalState
) {
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

  relationships.forEach(r => {
    const s = r.source_contact_id ? contactMap[r.source_contact_id] : null;
    const t = r.related_contact_id ? contactMap[r.related_contact_id] : null;

    const sName =
      s?.name ||
      r.source_contact_name ||
      r.source_contact_id ||
      "(unknown)";

    const tName =
      t?.name ||
      r.related_contact_name ||
      r.related_contact_id ||
      "(unknown)";

    const relType = r.relationship_type || r.type || "";
    const role = r.relationship_role || r.role || "";

    const sourceId = s?.id || r.source_contact_id || "";
    const targetId = t?.id || r.related_contact_id || "";

    html += `
      <tr>
        <td>
          <a href="#" class="drill-contact" data-id="${escapeHtml(sourceId)}">
            ${escapeHtml(sName)}
          </a>
        </td>
        <td>
          <a href="#" class="drill-contact" data-id="${escapeHtml(targetId)}">
            ${escapeHtml(tName)}
          </a>
        </td>
        <td>${escapeHtml(relType)}</td>
        <td>${escapeHtml(role)}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;

  // Clickable names → Details tab
  container.querySelectorAll(".drill-contact").forEach(a => {
    a.addEventListener("click", evt => {
      evt.preventDefault();
      const id = a.dataset.id;
      const name = a.textContent.trim();

      portalState.selectedContactId = id;
      portalState.selectedContactName = name;

      // Auto-switch to Details tab
      document
        .querySelector('#relationships-subtabs button[data-subtab="details"]')
        ?.click();
    });
  });
}

/* -------------------------------------------------------
(End of file)
------------------------------------------------------- */
