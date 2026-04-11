// /js/relationships/tab-overview.js

// Relationships → Overview (table-based analytics dashboard)

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

      <!-- Stats -->
      <section id="relOverviewStats" style="margin-bottom:16px; font-size:0.9em; color:#444;">
        <div class="muted">Loading stats…</div>
      </section>

      <!-- Drilldown -->
      <section id="relOverviewDrilldown" style="margin-top:8px; font-size:0.9em; color:#444;">
        <div class="muted">Click any count to see the underlying rows.</div>
      </section>
    </section>
  `;

  const statsContainer = container.querySelector("#relOverviewStats");
  const drilldownContainer = container.querySelector("#relOverviewDrilldown");

  // Load data
  const { contacts, relationships } = await loadOverviewData(project);

  // Build contact map for quick lookup
  const contactMap = buildContactMap(contacts);

  // Build stats model + datasets for drilldown
  const { statsRows, datasets } = buildStatsModel(contacts, relationships);

  // Render stats table
  renderStatsTable(statsContainer, statsRows, datasets, drilldownContainer, contactMap, portalState);
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
Helpers: contact map
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
Stats model builder
------------------------------------------------------- */

function buildStatsModel(contacts, relationships) {
  const totalRelationships = relationships.length;
  const clients = contacts.filter(c => (c.contact_type || "") === "Client");
  const totalClients = clients.length;

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

  // Relationship roles (assuming field name relationship_role)
  const roleCounts = {};
  relationships.forEach(r => {
    const role = r.relationship_role || "Unknown";
    if (!roleCounts[role]) {
      roleCounts[role] = { count: 0, rows: [] };
    }
    roleCounts[role].count += 1;
    roleCounts[role].rows.push(r);
  });

  const statsRows = [];
  const datasets = {};

  // Total relationships
  statsRows.push({
    category: "Total Relationships",
    key: "totalRelationships",
    count: totalRelationships,
    percent: "",
    group: "Totals"
  });
  datasets["totalRelationships"] = {
    label: "All Relationships",
    type: "relationships",
    rows: relationships
  };

  // Total clients
  statsRows.push({
    category: "Total Clients",
    key: "totalClients",
    count: totalClients,
    percent: "",
    group: "Totals"
  });
  datasets["totalClients"] = {
    label: "Client Contacts",
    type: "clients",
    rows: clients
  };

  // Relationship types
  Object.keys(typeCounts)
    .sort((a, b) => a.localeCompare(b))
    .forEach(type => {
      const { count, rows } = typeCounts[type];
      const pct =
        totalRelationships > 0
          ? ((count / totalRelationships) * 100).toFixed(1) + "%"
          : "";
      const key = `type:${type}`;
      statsRows.push({
        category: `Relationship Type: ${type}`,
        key,
        count,
        percent: pct,
        group: "Types"
      });
      datasets[key] = {
        label: `Relationships of type "${type}"`,
        type: "relationships",
        rows
      };
    });

  // Relationship roles
  Object.keys(roleCounts)
    .sort((a, b) => a.localeCompare(b))
    .forEach(role => {
      const { count, rows } = roleCounts[role];
      const pct =
        totalRelationships > 0
          ? ((count / totalRelationships) * 100).toFixed(1) + "%"
          : "";
      const key = `role:${role}`;
      statsRows.push({
        category: `Relationship Role: ${role}`,
        key,
        count,
        percent: pct,
        group: "Roles"
      });
      datasets[key] = {
        label: `Relationships with role "${role}"`,
        type: "relationships",
        rows
      };
    });

  return { statsRows, datasets };
}

/* -------------------------------------------------------
Stats table rendering
------------------------------------------------------- */

function renderStatsTable(
  container,
  statsRows,
  datasets,
  drilldownContainer,
  contactMap,
  portalState
) {
  if (!statsRows.length) {
    container.innerHTML = `<span class="muted">No relationship data available.</span>`;
    return;
  }

  // Group rows by group label
  const groups = {};
  statsRows.forEach(row => {
    if (!groups[row.group]) groups[row.group] = [];
    groups[row.group].push(row);
  });

  let html = "";

  Object.keys(groups)
    .sort((a, b) => a.localeCompare(b))
    .forEach(groupName => {
      const rows = groups[groupName];

      html += `
        <h3 style="margin:8px 0 4px 0; font-size:1em;">${escapeHtml(
          groupName
        )}</h3>
        <table class="table table-sm" style="width:100%; margin-bottom:8px;">
          <thead>
            <tr>
              <th style="width:60%;">Category</th>
              <th style="width:20%; text-align:right;">Count</th>
              <th style="width:20%; text-align:right;">% of total relationships</th>
            </tr>
          </thead>
          <tbody>
      `;

      rows.forEach(row => {
        html += `
          <tr>
            <td>${escapeHtml(row.category)}</td>
            <td style="text-align:right;">
              <a href="#" 
                 class="rel-stat-count" 
                 data-stat-key="${escapeHtml(row.key)}"
                 style="text-decoration:none;">
                ${row.count}
              </a>
            </td>
            <td style="text-align:right;">${row.percent || ""}</td>
          </tr>
        `;
      });

      html += `
          </tbody>
        </table>
      `;
    });

  container.innerHTML = html;

  // Attach click handlers
  const links = container.querySelectorAll(".rel-stat-count");
  links.forEach(link => {
    link.addEventListener("click", evt => {
      evt.preventDefault();
      const key = link.getAttribute("data-stat-key");
      const dataset = datasets[key];
      if (!dataset) return;
      renderDrilldownTable(
        drilldownContainer,
        dataset,
        contactMap,
        portalState
      );
    });
  });
}

/* -------------------------------------------------------
Drilldown table rendering
------------------------------------------------------- */

function renderDrilldownTable(container, dataset, contactMap, portalState) {
  const { label, type, rows } = dataset;

  if (!rows || !rows.length) {
    container.innerHTML = `
      <div style="margin-top:8px;">
        <strong>${escapeHtml(label)}</strong><br>
        <span class="muted">No rows found for this selection.</span>
      </div>
    `;
    return;
  }

  if (type === "clients") {
    container.innerHTML = renderClientsTableHtml(label, rows);
    attachClientRowHandlers(container, rows, portalState);
  } else {
    container.innerHTML = renderRelationshipsTableHtml(
      label,
      rows,
      contactMap
    );
    attachRelationshipRowHandlers(container, rows, contactMap, portalState);
  }
}

/* -------------------------------------------------------
Clients drilldown
------------------------------------------------------- */

function renderClientsTableHtml(label, clients) {
  let html = `
    <div style="margin-top:8px;">
      <strong>${escapeHtml(label)}</strong>
      <div style="margin-top:4px; max-height:360px; overflow:auto;">
        <table class="table table-sm" style="width:100%;">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
  `;

  clients.forEach(c => {
    const name =
      c.contact_name ||
      `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
      c.contact_id;
    const email = c.email || c.primary_email || "";
    const type = c.contact_type || "Unknown";

    html += `
      <tr class="drill-client-row" data-contact-id="${escapeHtml(
        c.contact_id
      )}">
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(type)}</td>
        <td>${escapeHtml(email)}</td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

  return html;
}

function attachClientRowHandlers(container, clients, portalState) {
  const rows = container.querySelectorAll(".drill-client-row");
  rows.forEach(row => {
    row.addEventListener("click", () => {
      const contactId = row.getAttribute("data-contact-id");
      const contact = clients.find(c => c.contact_id === contactId);
      if (!contact) return;

      const name =
        contact.contact_name ||
        `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
        contact.contact_id;

      portalState.selectedContactId = contact.contact_id;
      portalState.selectedContactName = name;

      // If you have a tab switcher, call it here.
      console.log("Selected client from overview:", {
        id: contact.contact_id,
        name
      });
    });
  });
}

/* -------------------------------------------------------
Relationships drilldown
------------------------------------------------------- */

function renderRelationshipsTableHtml(label, relationships, contactMap) {
  let html = `
    <div style="margin-top:8px;">
      <strong>${escapeHtml(label)}</strong>
      <div style="margin-top:4px; max-height:360px; overflow:auto;">
        <table class="table table-sm" style="width:100%;">
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
    </div>
  `;

  return html;
}

function attachRelationshipRowHandlers(
  container,
  relationships,
  contactMap,
  portalState
) {
  const rows = container.querySelectorAll(".drill-rel-row");
  rows.forEach((row, index) => {
    row.addEventListener("click", () => {
      const rel = relationships[index];
      if (!rel) return;

      const sourceId = rel.source_contact_id;
      const source = contactMap[sourceId];

      if (!source) return;

      portalState.selectedContactId = source.id;
      portalState.selectedContactName = source.name;

      // If you have a tab switcher, call it here.
      console.log("Selected relationship source from overview:", {
        id: source.id,
        name: source.name
      });
    });
  });
}

