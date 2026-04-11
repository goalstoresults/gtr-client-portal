// /js/relationships/tab-overview.js
// Relationships → Overview (table-based analytics with sortable grids + inline expand)

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
Contact map
------------------------------------------------------- */

function buildContactMap(contacts) {
  const map = {};
  contacts.forEach(c => {
    const name =
      c.contact_name ||
      `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
      c.contact_id;
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
Stats model
------------------------------------------------------- */

function buildStatsModel(contacts, relationships, contactMap) {
  const totalRelationships = relationships.length;

  // Clients with relationships (source_contact_id with contact_type = 'Client')
  const clientRelCounts = {};
  relationships.forEach(r => {
    const cid = r.source_contact_id;
    if (!cid) return;
    const c = contactMap[cid];
    if (!c) return;
    if (c.type !== "Client") return;
    clientRelCounts[cid] = (clientRelCounts[cid] || 0) + 1;
  });

  const clientIds = Object.keys(clientRelCounts);
  const clientsWithRelationships = clientIds
    .map(id => {
      const c = contactMap[id];
      if (!c) return null;
      return {
        contact_id: c.id,
        name: c.name,
        email: c.email,
        contact_type: c.type,
        relationship_count: clientRelCounts[id]
      };
    })
    .filter(Boolean);

  // Relationship types
  const typeCounts = {};
  relationships.forEach(r => {
    const t = r.relationship_type || "Unknown";
    if (!typeCounts[t]) {
      typeCounts[t] = { count: 0, rows: [] };
    }
    typeCounts[t].count += 1;
    typeCounts[t].rows.push(r);
  });

  // Relationship roles (relationship_role field)
  const roleCounts = {};
  relationships.forEach(r => {
    const role = r.relationship_role || "Unknown";
    if (!roleCounts[role]) {
      roleCounts[role] = { count: 0, rows: [] };
    }
    roleCounts[role].count += 1;
    roleCounts[role].rows.push(r);
  });

  const totalsRows = [];
  const totalsDatasets = {};

  totalsRows.push({
    key: "totalRelationships",
    category: "Total Relationships",
    count: totalRelationships,
    percentText: "",
    percentValue: 0
  });
  totalsDatasets["totalRelationships"] = {
    type: "relationships",
    label: "All Relationships",
    rows: relationships
  };

  totalsRows.push({
    key: "totalClientsWithRelationships",
    category: "Total Clients With Relationships",
    count: clientsWithRelationships.length,
    percentText: "",
    percentValue: 0
  });
  totalsDatasets["totalClientsWithRelationships"] = {
    type: "clients",
    label: "Clients With Relationships",
    rows: clientsWithRelationships
  };

  const typesRows = [];
  const typesDatasets = {};

  Object.keys(typeCounts)
    .sort((a, b) => a.localeCompare(b))
    .forEach(type => {
      const { count, rows } = typeCounts[type];
      const pctVal =
        totalRelationships > 0 ? (count / totalRelationships) * 100 : 0;
      const pctText =
        totalRelationships > 0 ? pctVal.toFixed(1) + "%" : "";
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
        totalRelationships > 0 ? (count / totalRelationships) * 100 : 0;
      const pctText =
        totalRelationships > 0 ? pctVal.toFixed(1) + "%" : "";
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
Section rendering (sortable + expandable)
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
      <h3 style="margin:8px 0 4px 0; font-size:1em;">${escapeHtml(title)}</h3>
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
            <th style="width:80px; text-align:center;">Action</th>
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
              ${isExpanded ? "▼" : "▶"}
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

    // Sort handlers
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
          expandedKey = null; // collapse on sort
          render();
        }
      });
    });

    // Expand handlers
    container.querySelectorAll(".expand-btn").forEach(btn => {
      btn.addEventListener("click", () => {
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
            const dataset = datasets[key];
            if (dataset) {
              renderDrilldownTable(
                drillContainer,
                dataset,
                contactMap,
                portalState
              );
            }
          }
        }
      });
    });

    // After render, if something is expanded, fill its drilldown
    if (expandedKey) {
      const safeKey = sanitizeKey(expandedKey);
      const drillContainer = container.querySelector(
        `#drill-${sectionKey}-${safeKey}`
      );
      if (drillContainer) {
        const dataset = datasets[expandedKey];
        if (dataset) {
          renderDrilldownTable(
            drillContainer,
            dataset,
            contactMap,
            portalState
          );
        }
      }
    }
  }

  render();
}

function sanitizeKey(key) {
  return String(key).replace(/[^a-zA-Z0-9_-]/g, "_");
}

/* -------------------------------------------------------
Drilldown rendering
------------------------------------------------------- */

function renderDrilldownTable(container, dataset, contactMap, portalState) {
  const { type, label, rows } = dataset;

  if (!rows || !rows.length) {
    container.innerHTML = `
      <strong>${escapeHtml(label)}</strong><br>
      <span class="muted">(no rows)</span>
    `;
    return;
  }

  if (type === "clients") {
    renderClientsDrilldown(container, label, rows, portalState);
  } else {
    renderRelationshipsDrilldown(container, label, rows, contactMap, portalState);
  }
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
            <th style="width:140px; text-align:right;">Relationships</th>
          </tr>
        </thead>
        <tbody>
  `;

  clients.forEach(c => {
    html += `
      <tr class="drill-client-row" data-contact-id="${escapeHtml(
        c.contact_id
      )}">
        <td>${escapeHtml(c.name || "")}</td>
        <td>${escapeHtml(c.email || "")}</td>
        <td>${escapeHtml(c.contact_type || "")}</td>
        <td style="text-align:right;">${c.relationship_count || 0}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;

  container.querySelectorAll(".drill-client-row").forEach(row => {
    row.addEventListener("click", () => {
      const contactId = row.getAttribute("data-contact-id");
      const client = clients.find(c => c.contact_id === contactId);
      if (!client) return;

      portalState.selectedContactId = client.contact_id;
      portalState.selectedContactName = client.name || client.contact_id;

      console.log("Selected client from overview:", {
        id: client.contact_id,
        name: client.name
      });
    });
  });
}

/* -------------------------------------------------------
Relationships drilldown
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
      <tr class="drill-rel-row" data-source-id="${escapeHtml(
        r.source_contact_id || ""
      )}">
        <td>${escapeHtml(sName)}</td>
        <td>${escapeHtml(tName)}</td>
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

  const rows = container.querySelectorAll(".drill-rel-row");
  rows.forEach((row, index) => {
    row.addEventListener("click", () => {
      const rel = relationships[index];
      if (!rel) return;
      const source = contactMap[rel.source_contact_id];
      if (!source) return;

      portalState.selectedContactId = source.id;
      portalState.selectedContactName = source.name;

      console.log("Selected relationship source from overview:", {
        id: source.id,
        name: source.name
      });
    });
  });
}

