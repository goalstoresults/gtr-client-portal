// /js/relationships/tab-overview.js
// Relationships → Overview (30,000-foot relationship map)

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

      <!-- Filters -->
      <div id="relOverviewFilters" class="row" style="gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <div>
          <label style="font-size:0.85em; color:#555;">Contact type</label><br>
          <select id="ovFilterContactType" class="form-control" style="min-width:160px;">
            <option value="">(All)</option>
          </select>
        </div>

        <div>
          <label style="font-size:0.85em; color:#555;">Relationship type</label><br>
          <select id="ovFilterRelType" class="form-control" style="min-width:160px;">
            <option value="">(All)</option>
          </select>
        </div>

        <div>
          <label style="font-size:0.85em; color:#555;">Direction</label><br>
          <select id="ovFilterDirection" class="form-control" style="min-width:140px;">
            <option value="">Inbound + Outbound</option>
            <option value="outbound">Outbound only</option>
            <option value="inbound">Inbound only</option>
          </select>
        </div>

        <div>
          <label style="font-size:0.85em; color:#555;">Search contact</label><br>
          <input id="ovSearchContact" class="form-control" placeholder="Name contains..." style="min-width:200px;">
        </div>

        <div style="align-self:flex-end;">
          <button id="ovApplyFilters" class="btn-secondary">Apply</button>
        </div>
      </div>

      <!-- Graph host -->
      <div id="relOverviewGraph"
           style="width:100%; height:480px; border:1px solid #ddd; border-radius:4px; background:#fafafa;"></div>

      <!-- Optional stats (easy to remove if you don't like it) -->
      <section id="relOverviewStats" style="margin-top:16px; font-size:0.9em; color:#444;">
        <h3 style="margin-bottom:8px;">Network Summary</h3>
        <div id="relOverviewStatsContent" class="muted">Loading summary…</div>
      </section>
    </section>
  `;

  const graphContainer = container.querySelector("#relOverviewGraph");
  const statsContainer = container.querySelector("#relOverviewStatsContent");

  const filterContactType = container.querySelector("#ovFilterContactType");
  const filterRelType = container.querySelector("#ovFilterRelType");
  const filterDirection = container.querySelector("#ovFilterDirection");
  const searchInput = container.querySelector("#ovSearchContact");
  const applyBtn = container.querySelector("#ovApplyFilters");

  // Load data
  const { contacts, relationships } = await loadOverviewData(project);

  // Build lookup maps
  const contactMap = {};
  contacts.forEach(c => {
    const name =
      c.contact_name ||
      `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
      c.contact_id;
    contactMap[c.contact_id] = {
      id: c.contact_id,
      name,
      type: c.contact_type || "Unknown"
    };
  });

  // Populate filters
  populateContactTypeFilter(filterContactType, contacts);
  populateRelTypeFilter(filterRelType, relationships);

  // Prepare vis-network datasets
  let { nodes, edges } = buildGraphDatasets(contacts, relationships, contactMap);

  // Create network (requires vis-network loaded globally)
  // e.g. <script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
  let network = null;
  if (window.vis && window.vis.Network) {
    const data = { nodes, edges };
    const options = {
      physics: {
        stabilization: true,
        barnesHut: {
          gravitationalConstant: -3000,
          springLength: 120,
          springConstant: 0.04
        }
      },
      nodes: {
        shape: "dot",
        font: { size: 12 }
      },
      edges: {
        arrows: { to: { enabled: false } },
        color: { color: "#cccccc" },
        smooth: false
      },
      interaction: {
        hover: true,
        tooltipDelay: 150
      }
    };

    network = new window.vis.Network(graphContainer, data, options);

    // Click → jump to Details tab
    network.on("click", params => {
      if (!params.nodes || !params.nodes.length) return;
      const nodeId = params.nodes[0];
      const contact = contactMap[nodeId];
      if (!contact) return;

      portalState.selectedContactId = contact.id;
      portalState.selectedContactName = contact.name;

      // If you have a tab switcher, call it here.
      // For now, we just log.
      console.log("Clicked contact node:", contact);
    });
  } else {
    graphContainer.innerHTML = `
      <div style="padding:16px; color:#a00;">
        vis-network library not found.  
        Include it in your HTML to enable the relationship graph.
      </div>
    `;
  }

  // Initial stats
  updateStats(statsContainer, contacts, relationships);

  // Filters apply
  applyBtn.addEventListener("click", () => {
    const typeFilter = filterContactType.value;
    const relTypeFilter = filterRelType.value;
    const directionFilter = filterDirection.value;
    const searchTerm = (searchInput.value || "").trim().toLowerCase();

    const { nodes: newNodes, edges: newEdges } = buildGraphDatasets(
      contacts,
      relationships,
      contactMap,
      { typeFilter, relTypeFilter, directionFilter, searchTerm }
    );

    if (network) {
      network.setData({ nodes: newNodes, edges: newEdges });
    }

    updateStats(statsContainer, contacts, relationships, {
      typeFilter,
      relTypeFilter,
      directionFilter,
      searchTerm
    });
  });
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
Filters population
------------------------------------------------------- */

function populateContactTypeFilter(selectEl, contacts) {
  const types = new Set();
  contacts.forEach(c => {
    if (c.contact_type) types.add(c.contact_type);
  });

  Array.from(types)
    .sort((a, b) => a.localeCompare(b))
    .forEach(t => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      selectEl.appendChild(opt);
    });
}

function populateRelTypeFilter(selectEl, relationships) {
  const types = new Set();
  relationships.forEach(r => {
    if (r.relationship_type) types.add(r.relationship_type);
  });

  Array.from(types)
    .sort((a, b) => a.localeCompare(b))
    .forEach(t => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      selectEl.appendChild(opt);
    });
}

/* -------------------------------------------------------
Graph dataset builder
------------------------------------------------------- */

function buildGraphDatasets(
  contacts,
  relationships,
  contactMap,
  filters = {}
) {
  const {
    typeFilter = "",
    relTypeFilter = "",
    directionFilter = "",
    searchTerm = ""
  } = filters;

  const nodes = new window.vis.DataSet();
  const edges = new window.vis.DataSet();

  // Precompute relationship counts per contact for node sizing
  const relCounts = {};
  relationships.forEach(r => {
    const s = r.source_contact_id;
    const t = r.related_contact_id;
    if (!s || !t) return;
    relCounts[s] = (relCounts[s] || 0) + 1;
    relCounts[t] = (relCounts[t] || 0) + 1;
  });

  // Filtered contacts
  const allowedContacts = new Set();

  contacts.forEach(c => {
    const id = c.contact_id;
    if (!id) return;

    const type = c.contact_type || "Unknown";
    const name =
      c.contact_name ||
      `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
      id;

    if (typeFilter && type !== typeFilter) return;
    if (searchTerm && !name.toLowerCase().includes(searchTerm)) return;

    allowedContacts.add(id);

    const size = 10 + (relCounts[id] || 0) * 2;
    const color = colorForContactType(type);

    nodes.add({
      id,
      label: name,
      title: `${escapeHtml(name)}<br/><small>${escapeHtml(type)}</small>`,
      value: relCounts[id] || 0,
      color,
      size
    });
  });

  // Filtered relationships
  relationships.forEach(r => {
    const s = r.source_contact_id;
    const t = r.related_contact_id;
    if (!s || !t) return;

    if (!allowedContacts.has(s) || !allowedContacts.has(t)) return;

    const relType = r.relationship_type || "";
    if (relTypeFilter && relType !== relTypeFilter) return;

    // Direction filter: from perspective of "graph"? We'll treat:
    // outbound = edges where source has more relationships than target (rough heuristic)
    if (directionFilter === "outbound" || directionFilter === "inbound") {
      const sCount = relCounts[s] || 0;
      const tCount = relCounts[t] || 0;
      const isOutbound = sCount >= tCount;
      if (directionFilter === "outbound" && !isOutbound) return;
      if (directionFilter === "inbound" && isOutbound) return;
    }

    edges.add({
      id: r.id,
      from: s,
      to: t,
      title: escapeHtml(relType || "Relationship"),
      color: colorForRelationshipType(relType)
    });
  });

  return { nodes, edges };
}

/* -------------------------------------------------------
Color helpers
------------------------------------------------------- */

function colorForContactType(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("client")) return "#2b8a3e";
  if (t.includes("vendor")) return "#1c7ed6";
  if (t.includes("family")) return "#e67700";
  if (t.includes("staff") || t.includes("team")) return "#7048e8";
  return "#868e96";
}

function colorForRelationshipType(relType) {
  const t = (relType || "").toLowerCase();
  if (t.includes("referral")) return "#e03131";
  if (t.includes("family")) return "#e67700";
  if (t.includes("client") || t.includes("vendor")) return "#1c7ed6";
  return "#adb5bd";
}

/* -------------------------------------------------------
Stats (optional, easy to remove)
------------------------------------------------------- */

function updateStats(
  container,
  contacts,
  relationships,
  filters = {}
) {
  const {
    typeFilter = "",
    relTypeFilter = "",
    directionFilter = "",
    searchTerm = ""
  } = filters;

  let filteredContacts = contacts;
  let filteredRelationships = relationships;

  if (typeFilter) {
    filteredContacts = filteredContacts.filter(
      c => (c.contact_type || "") === typeFilter
    );
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredContacts = filteredContacts.filter(c => {
      const name =
        c.contact_name ||
        `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
        c.contact_id;
      return name.toLowerCase().includes(term);
    });
  }

  const allowedIds = new Set(filteredContacts.map(c => c.contact_id));

  filteredRelationships = filteredRelationships.filter(r => {
    if (!allowedIds.has(r.source_contact_id) || !allowedIds.has(r.related_contact_id)) {
      return false;
    }
    if (relTypeFilter && (r.relationship_type || "") !== relTypeFilter) {
      return false;
    }
    return true;
  });

  const totalContacts = filteredContacts.length;
  const totalRelationships = filteredRelationships.length;

  // Simple hub calc
  const counts = {};
  filteredRelationships.forEach(r => {
    counts[r.source_contact_id] = (counts[r.source_contact_id] || 0) + 1;
    counts[r.related_contact_id] = (counts[r.related_contact_id] || 0) + 1;
  });

  const hubs = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (!totalContacts && !totalRelationships) {
    container.innerHTML = `<span class="muted">No data matches the current filters.</span>`;
    return;
  }

  container.innerHTML = `
    <div style="display:flex; flex-wrap:wrap; gap:16px;">
      <div>
        <strong>Total contacts:</strong> ${totalContacts}<br>
        <strong>Total relationships:</strong> ${totalRelationships}
      </div>
      <div>
        <strong>Top hubs:</strong><br>
        ${
          hubs.length
            ? hubs
                .map(([id, count]) => {
                  const c = contacts.find(x => x.contact_id === id);
                  const name =
                    c?.contact_name ||
                    `${c?.first_name || ""} ${c?.last_name || ""}`.trim() ||
                    id;
                  return `${escapeHtml(name)} (${count})`;
                })
                .join("<br>")
            : "<span class='muted'>(none)</span>"
        }
      </div>
    </div>
  `;
}
