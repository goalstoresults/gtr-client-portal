// /js/relationships/tab-overview.js
// Relationships → Overview (sortable grids + inline expand/collapse identical to Notes)

import { escapeHtml } from "../utilities.js";

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

      <section id="relOverviewTotals" style="margin-bottom:16px;"></section>
      <section id="relOverviewTypes" style="margin-bottom:16px;"></section>
      <section id="relOverviewRoles" style="margin-bottom:16px;"></section>
    </section>
  `;

  const totalsContainer = container.querySelector("#relOverviewTotals");
  const typesContainer = container.querySelector("#relOverviewTypes");
  const rolesContainer = container.querySelector("#relOverviewRoles");

  const { contacts, relationships } = await loadOverviewData(project);
  const contactMap = buildContactMap(contacts);
  const stats = buildStatsModel(contacts, relationships, contactMap);

  renderSection(
    totalsContainer,
    "Totals",
    "totals",
    stats.totals.rows,
    stats.totals.datasets,
    contactMap,
    portalState
  );

  renderSection(
    typesContainer,
    "Types",
    "types",
    stats.types.rows,
    stats.types.datasets,
    contactMap,
    portalState
  );

  renderSection(
    rolesContainer,
    "Roles",
    "roles",
    stats.roles.rows,
    stats.roles.datasets,
    contactMap,
    portalState
  );
}

/* -------------------------------------------------------
Data loading
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
Contact map — FIXED NAME RESOLVER
------------------------------------------------------- */

function buildContactMap(contacts) {
  const map = {};

  contacts.forEach(c => {
    const name =
      c.search_name ||
      c.contact_name ||
      `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
      c.business_name ||
      c.email ||
      c.contact_id ||
      "(unknown)";

    map[c.contact_id] = {
      id: c.contact_id,
      name,
      type: c.contact_type || "Unknown",
      email: c.email || c.primary_email || ""
    };
  });

  return map;
}

/* -------------------------------------------------------
Stats model (unchanged)
------------------------------------------------------- */

function buildStatsModel(contacts, relationships, contactMap) {
  const totalRelationshipRecords = relationships.length;

  const allClients = contacts.filter(c => c.contact_type === "Client");

  const clientsWithRelSet = new Set();
  relationships.forEach(r => {
    if (contactMap[r.source_contact_id]?.type === "Client") {
      clientsWithRelSet.add(r.source_contact_id);
    }
    if (contactMap[r.related_contact_id]?.type === "Client") {
      clientsWithRelSet.add(r.related_contact_id);
    }
  });

  const clientsWithRelationships = [...clientsWithRelSet].map(id => {
    const c = contactMap[id];
    return {
      contact_id: c.id,
      name: c.name,
      email: c.email,
      contact_type: c.type
    };
  });

  const clientRelationships = relationships.filter(r => {
    return (
      contactMap[r.source_contact_id]?.type === "Client" ||
      contactMap[r.related_contact_id]?.type === "Client"
    );
  });

  const typeCounts = {};
  relationships.forEach(r => {
    const t = r.relationship_type || "Unknown";
    if (!typeCounts[t]) typeCounts[t] = { count: 0, rows: [] };
    typeCounts[t].count++;
    typeCounts[t].rows.push(r);
  });

  const roleCounts = {};
  relationships.forEach(r => {
    const role = r.relationship_role || "Unknown";
    if (!roleCounts[role]) roleCounts[role] = { count: 0, rows: [] };
    roleCounts[role].count++;
    roleCounts[role].rows.push(r);
  });

  const totalsRows = [];
  const totalsDatasets = {};

  totalsRows.push({
    key: "totalClients",
    category: "Total Clients",
    count: allClients.length,
    percentText: "",
    percentValue: 0
  });

  totalsDatasets["totalClients"] = {
    type: "clients",
    label: "All Clients",
    rows: allClients
  };

  totalsRows.push({
    key: "totalClientsWithRelationships",
    category: "Total Clients With Relationships",
    count: clientsWithRelationships.length,
    percentText: "",
    percentValue: 0
  });

  totalsDatasets["totalClientsWithRelationships"] = {
    type: "relationships",
    label: "Clients With Relationships",
    rows: clientRelationships
  };

  totalsRows.push({
    key: "totalClientRelationships",
    category: "Total Client Relationships",
    count: clientRelationships.length,
    percentText: "",
    percentValue: 0
  });

  totalsDatasets["totalClientRelationships"] = {
    type: "relationships",
    label: "Client Relationships",
    rows: clientRelationships
  };

  totalsRows.push({
    key: "totalRelationshipRecords",
    category: "Total Relationship Records",
    count: totalRelationshipRecords,
    percentText: "",
    percentValue: 0
  });

  totalsDatasets["totalRelationshipRecords"] = {
    type: "relationships",
    label: "All Relationship Records",
    rows: relationships
  };

  const typesRows = [];
  const typesDatasets = {};

  Object.keys(typeCounts)
    .sort((a, b) => a.localeCompare(b))
    .forEach(type => {
      const { count, rows } = typeCounts[type];
      const pctVal =
        totalRelationshipRecords > 0
          ? (count / totalRelationshipRecords) * 100
          : 0;
      const pctText =
        totalRelationshipRecords > 0 ? pctVal.toFixed(1) + "%" : "";
      const key = `type:${type}`;

      typesRows.push({
        key,
        category: type,
        count,
        percentText: pctText,
        percentValue: pctVal
      });

      typesDatasets[key] = {
        type: "relationships",
        label: `Relationships of type "${type}"`,
        rows
      };
    });

  const rolesRows = [];
  const rolesDatasets = {};

  Object.keys(roleCounts)
    .sort((a, b) => a.localeCompare(b))
    .forEach(role => {
      const { count, rows } = roleCounts[role];
      const pctVal =
        totalRelationshipRecords > 0
          ? (count / totalRelationshipRecords) * 100
          : 0;
      const pctText =
        totalRelationshipRecords > 0 ? pctVal.toFixed(1) + "%" : "";
      const key = `role:${role}`;

      rolesRows.push({
        key,
        category: role,
        count,
        percentText: pctText,
        percentValue: pctVal
      });

      rolesDatasets[key] = {
        type: "relationships",
        label: `Relationships with role "${role}"`,
        rows
      };
    });

  return {
    totals: { rows: totalsRows, datasets: totalsDatasets },
    types: { rows: typesRows, datasets: typesDatasets },
    roles: { rows: rolesRows, datasets: rolesDatasets }
  };
}

/* -------------------------------------------------------
Backend expand logic
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
Section rendering
------------------------------------------------------- */

function renderSection(
  container,
  title,
  sectionKey,
  rows,
  datasets,
  contactMap,
  portalState
) {
  if (!rows || !rows.length) {
    container.innerHTML = `
      <h3 style="margin:8px 0 4px 0; font-size:1em;">${escapeHtml(
        title
      )}</h3>
      <p class="muted">(no data)</p>
    `;
    return;
  }

  let sortField = "category";
  let sortDirection = "asc";
  let expandedKey = null;

  function arrowsFor(field) {
    const isSorted = sortField === field;
    const up = isSorted && sortDirection === "asc" ? "▲" : "△";
    const down = isSorted && sortDirection === "desc" ? "▼" : "▽";
    return `
      <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
        <span class="sort-up">${up}</span>
        <span class="sort-down">${down}</span>
      </span>
    `;
  }

  function sortRows() {
    const sorted = [...rows];

    sorted.sort((a, b) => {
      if (sortField === "count") {
        const A = Number(a.count || 0);
        const B = Number(b.count || 0);
        return sortDirection === "asc" ? A - B : B - A;
      }

      if (sortField === "percent") {
        const A = Number(a.percentValue || 0);
        const B = Number(b.percentValue || 0);
        return sortDirection === "asc" ? A - B : B - A;
      }

      const A = (a.category || "").toLowerCase();
      const B = (b.category || "").toLowerCase();
      return sortDirection === "asc"
        ? A.localeCompare(B)
        : B.localeCompare(A);
    });

    return sorted;
  }

  function render() {
    const sorted = sortRows();

    let headerLabel = "Category";
    if (sectionKey === "types") headerLabel = "Relationship Type";
    if (sectionKey === "roles") headerLabel = "Relationship Role";

    let html = `
      <h3 style="margin:8px 0 4px 0; font-size:1em;">${escapeHtml(
        title
      )}</h3>

      <table class="notes-table">
        <thead>
          <tr>
            <th class="sortable" data-field="category">
              ${escapeHtml(headerLabel)} ${arrowsFor("category")}
            </th>
            <th class="sortable" data-field="count" style="width:120px; text-align:right;">
              Count ${arrowsFor("count")}
            </th>
            <th class="sortable" data-field="percent" style="width:160px; text-align:right;">
              % of total relationships ${arrowsFor("percent")}
            </th>
            <th style="width:140px; text-align:center;">Action</th>
          </tr>
        </thead>
        <tbody>
    `;

    sorted.forEach(row => {
      const isExpanded = expandedKey === row.key;
      const safeKey = sanitizeKey(row.key);

      html += `
        <tr data-key="${escapeHtml(row.key)}">
          <td>${escapeHtml(row.category)}</td>
          <td style="text-align:right;">${row.count}</td>
          <td style="text-align:right;">${row.percentText || ""}</td>
          <td style="text-align:center;">
            <button class="btn-secondary expand-btn" data-key="${escapeHtml(
              row.key
            )}">
              ${isExpanded ? "▼ Collapse" : "▶ Expand"}
            </button>
          </td>
        </tr>
      `;

      if (isExpanded) {
        html += `
          <tr class="expand-row" data-expand-for="${escapeHtml(row.key)}">
            <td colspan="4">
              <div id="drill-${sectionKey}-${safeKey}" class="expand-container" style="background:#fafafa; border-top:1px solid #ddd; padding:8px;"></div>
            </td>
          </tr>
        `;
      }
    });

    html += `
        </tbody>
      </table>
    `;

    container.innerHTML = html;

    container.querySelectorAll("th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.dataset.field;

        if (field === "category" || field === "count" || field === "percent") {
          if (sortField === field) {
            sortDirection = sortDirection === "asc" ? "desc" : "asc";
          } else {
            sortField = field;
            sortDirection = "asc";
          }

          expandedKey = null;
          render();
        }
      });
    });

    container.querySelectorAll(".expand-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const key = btn.getAttribute("data-key");

        if (expandedKey === key) {
          expandedKey = null;
          render();
        } else {
          expandedKey = key;
          render();

          const safeKey = sanitizeKey(key);
          const drillContainer = container.querySelector(
            `#drill-${sectionKey}-${safeKey}`
          );

          if (drillContainer) {
            await loadDrilldownData(
              drillContainer,
              sectionKey,
              key,
              portalState
            );
          }
        }
      });
    });

    if (expandedKey) {
      const safeKey = sanitizeKey(expandedKey);
      const drillContainer = container.querySelector(
        `#drill-${sectionKey}-${safeKey}`
      );

      if (drillContainer) {
        loadDrilldownData(drillContainer, sectionKey, expandedKey, portalState);
      }
    }
  }

  render();
}

function sanitizeKey(key) {
  return String(key).replace(/[^a-zA-Z0-9_-]/g, "_");
}

/* -------------------------------------------------------
Drilldown loading — FIXED ROUTING
------------------------------------------------------- */

async function loadDrilldownData(container, sectionKey, key, portalState) {
  const project = portalState.project;

  container.innerHTML = `<div class="muted">Loading…</div>`;

  try {
    const { rows, total_count } = await fetchSectionRows(project, key);

    const DISPLAY_LIMIT = 1000;
    const displayRows =
      rows.length > DISPLAY_LIMIT ? rows.slice(0, DISPLAY_LIMIT) : rows;

    const idSet = new Set();
    displayRows.forEach(r => {
      if (r.source_contact_id) idSet.add(r.source_contact_id);
      if (r.related_contact_id) idSet.add(r.related_contact_id);
      if (r.contact_id) idSet.add(r.contact_id);
    });

    let contacts = await fetchContactsByIds(project, Array.from(idSet));

    if (!Array.isArray(contacts)) {
      if (contacts && Array.isArray(contacts.data)) {
        contacts = contacts.data;
      } else if (contacts && Array.isArray(contacts.contacts)) {
        contacts = contacts.contacts;
      } else {
        contacts = [];
      }
    }

    const contactMap = {};
    contacts.forEach(c => {
      const name =
        c.search_name ||
        c.contact_name ||
        `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
        c.business_name ||
        c.email ||
        c.contact_id ||
        "(unknown)";

      contactMap[c.contact_id] = {
        id: c.contact_id,
        name,
        email: c.email || "",
        type: c.contact_type || ""
      };
    });

    const label = buildSectionLabel(key);

    // 🔥 FIXED ROUTING
    if (key === "totalClients") {
      renderClientsDrilldown(container, label, displayRows, portalState);
    } else {
      renderRelationshipsDrilldown(
        container,
        label,
        displayRows,
        contactMap,
        portalState
      );
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="error">Failed to load details.</div>`;
  }
}

function buildSectionLabel(key) {
  if (key === "totalClients") return "All Clients";
  if (key === "totalClientsWithRelationships")
    return "Clients With Relationships";
  if (key === "totalClientRelationships") return "Client Relationships";
  if (key === "totalRelationshipRecords") return "All Relationship Records";
  if (key.startsWith("type:"))
    return `Relationships of type "${key.slice(5)}"`;
  if (key.startsWith("role:"))
    return `Relationships with role "${key.slice(5)}"`;
  return key;
}

/* -------------------------------------------------------
Clients drilldown
------------------------------------------------------- */

function renderClientsDrilldown(container, label, clients, portalState) {
  let html = `
    <strong>${escapeHtml(label)}</strong>
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

  clients.forEach(c => {
    html += `
      <tr class="drill-client-row" data-contact-id="${escapeHtml(
        c.contact_id
      )}">
        <td>
          <a href="#" class="drill-contact" data-id="${escapeHtml(
            c.contact_id
          )}">
            ${escapeHtml(c.name || "")}
          </a>
        </td>
        <td>${escapeHtml(c.email || "")}</td>
        <td>${escapeHtml(c.contact_type || "")}</td>
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
      portalState.selectedContactId = id;
      portalState.selectedContactName = a.textContent.trim();

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
    <strong>${escapeHtml(label)}</strong>
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
    const s = contactMap[r.source_contact_id];
    const t = contactMap[r.related_contact_id];

    const sName = s ? s.name : r.source_contact_id || "(unknown)";
    const tName = t ? t.name : r.related_contact_id || "(unknown)";

    const relType = r.relationship_type || "";
    const role = r.relationship_role || "";

    html += `
      <tr>
        <td>
          <a href="#" class="drill-contact" data-id="${escapeHtml(
            r.source_contact_id || ""
          )}">
            ${escapeHtml(sName)}
          </a>
        </td>
        <td>
          <a href="#" class="drill-contact" data-id="${escapeHtml(
            r.related_contact_id || ""
          )}">
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
