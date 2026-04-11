// /js/relationships/tab-overview.js
// Relationships → Overview (lazy-loaded drilldowns + accurate totals)

import { escapeHtml } from "../utilities.js";

/* -------------------------------------------------------
Data loading (your original logic — unchanged)
------------------------------------------------------- */

async function loadOverviewData(projectId) {
  const contactsUrl = `https://contacts-module.dennis-e64.workers.dev/contacts/list?project=${encodeURIComponent(
    projectId
  )}&limit=1000`;

  const relUrl = `https://contacts-module.dennis-e64.workers.dev/contact_relationships?project=${encodeURIComponent(
    projectId
  )}`;

  const [contactsRes, relRes] = await Promise.all([
    fetch(contactsUrl, { cache: "no-cache" }),
    fetch(relUrl, { cache: "no-cache" })
  ]);

  let contacts = await contactsRes.json().catch(() => []);
  let relationships = await relRes.json().catch(() => []);

  if (!Array.isArray(contacts)) contacts = [];
  if (!Array.isArray(relationships)) relationships = [];

  return { contacts, relationships };
}

/* -------------------------------------------------------
Entry point
------------------------------------------------------- */

export async function renderRelOverview(container, portalState) {
  const project = portalState.project;

  if (!project) {
    container.innerHTML = `
      <section class="card">
        <p>Missing project. Select a project to view relationship overview.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h2>Relationship Overview</h2>
      </div>

      <section id="relOverviewStats" style="margin-bottom:16px; font-size:0.9em; color:#444;">
        <div class="muted">Loading stats…</div>
      </section>

      <section id="relOverviewDrilldown" style="margin-top:8px; font-size:0.9em; color:#444;">
        <div class="muted">Click any count to see the underlying rows.</div>
      </section>
    </section>
  `;

  const statsContainer = container.querySelector("#relOverviewStats");
  const drilldownContainer = container.querySelector("#relOverviewDrilldown");

  try {
    const { contacts, relationships } = await loadOverviewData(project);

    const totals = computeOverviewTotals(relationships);

    renderOverviewSummary(
      statsContainer,
      totals,
      drilldownContainer,
      portalState
    );
  } catch (err) {
    console.error("Error loading relationship overview:", err);
    statsContainer.innerHTML = `<div class="error">Failed to load relationship overview.</div>`;
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
Render summary table
------------------------------------------------------- */

function renderOverviewSummary(container, totals, drilldownContainer, portalState) {
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

  html += summaryRow("Total Relationship Records", "total_relationship_records", total_relationship_records, grandTotal);
  html += summaryRow("Total Clients With Relationships", "total_clients_with_relationships", total_clients_with_relationships, grandTotal);
  html += summaryRow("Total Unique Related Contacts", "total_unique_related_contacts", total_unique_related_contacts, grandTotal);

  html += `
    <tr class="section-divider">
      <td colspan="4">By Relationship Type</td>
    </tr>
  `;

  by_type.forEach(row => {
    html += summaryRow(
      `Relationships of type "${row.type}"`,
      `type:${row.type}`,
      row.count,
      grandTotal
    );
  });

  html += `</tbody></table>`;

  container.innerHTML = html;

  container.querySelectorAll(".rel-summary-expand-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tr = btn.closest("tr");
      const sectionKey = tr.dataset.sectionKey;
      const expanded = tr.dataset.expanded === "true";

      if (expanded) {
        collapseSection(tr);
      } else {
        await expandSection(tr, sectionKey, drilldownContainer, portalState);
      }
    });
  });
}

function summaryRow(label, key, count, grandTotal) {
  const pct = grandTotal && count ? ((count / grandTotal) * 100).toFixed(1) : "0.0";

  return `
    <tr class="rel-summary-row" data-section-key="${escapeHtml(key)}" data-expanded="false">
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
Expand / Collapse
------------------------------------------------------- */

async function expandSection(rowEl, sectionKey, drilldownContainer, portalState) {
  rowEl.dataset.expanded = "true";
  rowEl.querySelector(".rel-summary-expand-btn").textContent = "Collapse";

  drilldownContainer.innerHTML = `<div class="loading">Loading details…</div>`;

  try {
    const project = portalState.project;

    const { rows, total_count } = await fetchSectionRows(project, sectionKey);

    const DISPLAY_LIMIT = 1000;
    const displayRows = rows.length > DISPLAY_LIMIT ? rows.slice(0, DISPLAY_LIMIT) : rows;

    const idSet = new Set();
    displayRows.forEach(r => {
      if (r.source_contact_id) idSet.add(r.source_contact_id);
      if (r.related_contact_id) idSet.add(r.related_contact_id);
      if (r.contact_id) idSet.add(r.contact_id);
    });

    const contacts = await fetchContactsByIds(project, Array.from(idSet));

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

    renderDrilldown(drilldownContainer, sectionKey, displayRows, total_count, contactMap, portalState);
  } catch (err) {
    console.error(err);
    drilldownContainer.innerHTML = `<div class="error">Failed to load details.</div>`;
  }
}

function collapseSection(rowEl) {
  rowEl.dataset.expanded = "false";
  rowEl.querySelector(".rel-summary-expand-btn").textContent = "Expand";
}

/* -------------------------------------------------------
Drilldown rendering
------------------------------------------------------- */

function renderDrilldown(container, sectionKey, rows, totalCount, contactMap, portalState) {
  const label = buildSectionLabel(sectionKey);

  let html = `
    <div class="rel-drilldown-header">
      <strong>${escapeHtml(label)}</strong>
      ${
        rows.length < totalCount
          ? `<div class="muted">Showing first ${rows.length} of ${totalCount} records.</div>`
          : ""
      }
    </div>
    <div class="rel-drilldown-body"></div>
  `;

  container.innerHTML = html;

  const bodyEl = container.querySelector(".rel-drilldown-body");

  if (sectionKey === "total_clients_with_relationships" ||
      sectionKey === "total_unique_related_contacts") {
    renderClients(bodyEl, rows, contactMap, portalState);
  } else {
    renderRelationships(bodyEl, rows, contactMap, portalState);
  }
}

function buildSectionLabel(sectionKey) {
  if (sectionKey === "total_relationship_records") return "All Relationship Records";
  if (sectionKey === "total_clients_with_relationships") return "Clients With At Least One Relationship";
  if (sectionKey === "total_unique_related_contacts") return "Unique Related Contacts";
  if (sectionKey.startsWith("type:")) return `Relationships of type "${sectionKey.slice(5)}"`;
  return sectionKey;
}

/* -------------------------------------------------------
Clients drilldown
------------------------------------------------------- */

function renderClients(container, rows, contactMap, portalState) {
  let html = `
    <div style="margin-top:4px; max-height:360px; overflow:auto;">
      <table class="notes-table">
        <thead>
          <tr><th>Name</th><th>Email</th><th>Type</th></tr>
        </thead>
        <tbody>
  `;

  rows.forEach(r => {
    const c = contactMap[r.contact_id] || {};
    html += `
      <tr>
        <td><a href="#" class="drill-contact" data-id="${escapeHtml(r.contact_id)}">${escapeHtml(c.name || "(unknown)")}</a></td>
        <td>${escapeHtml(c.email || "")}</td>
        <td>${escapeHtml(c.type || "")}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;

  container.querySelectorAll(".drill-contact").forEach(a => {
    a.addEventListener("click", evt => {
      evt.preventDefault();
      portalState.selectedContactId = a.dataset.id;
      portalState.selectedContactName = a.textContent.trim();
      document.querySelector('#relationships-subtabs button[data-subtab="details"]')?.click();
    });
  });
}

/* -------------------------------------------------------
Relationships drilldown
------------------------------------------------------- */

function renderRelationships(container, rows, contactMap, portalState) {
  let html = `
    <div style="margin-top:4px; max-height:360px; overflow:auto;">
      <table class="notes-table">
        <thead>
          <tr><th>Source</th><th>Target</th><th>Type</th><th>Role</th></tr>
        </thead>
        <tbody>
  `;

  rows.forEach(r => {
    const s = contactMap[r.source_contact_id] || {};
    const t = contactMap[r.related_contact_id] || {};

    html += `
      <tr>
        <td><a href="#" class="drill-contact" data-id="${escapeHtml(r.source_contact_id)}">${escapeHtml(s.name || "(unknown)")}</a></td>
        <td><a href="#" class="drill-contact" data-id="${escapeHtml(r.related_contact_id)}">${escapeHtml(t.name || "(unknown)")}</a></td>
        <td>${escapeHtml(r.relationship_type || "")}</td>
        <td>${escapeHtml(r.relationship_role || "")}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;

  container.querySelectorAll(".drill-contact").forEach(a => {
    a.addEventListener("click", evt => {
      evt.preventDefault();
      portalState.selectedContactId = a.dataset.id;
      portalState.selectedContactName = a.textContent.trim();
      document.querySelector('#relationships-subtabs button[data-subtab="details"]')?.click();
    });
  });
}

/* -------------------------------------------------------
END OF FILE
------------------------------------------------------- */

