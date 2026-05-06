// /js/relationships/tab-client-vendor.js
// Client–Vendor Explorer (Client = "Client", Vendor = "Client Vendor")

import { escapeHtml } from "../utilities.js";

export async function renderClientVendorTab(container, portalState) {
  const project = portalState.project;

  if (!project) {
    container.innerHTML = `
      <section class="card">
        <p>Missing project. Select a project to view client–vendor relationships.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
  <section class="card">
    <h2>Client–Vendor Explorer</h2>
    <section id="cvClients" style="margin-top:16px;"></section>
    <section id="cvVendors" style="margin-top:32px;"></section>
    <section id="cvMismatches" style="margin-top:32px;"></section>
  </section>
  `;


  const clientsContainer = container.querySelector("#cvClients");
  const vendorsContainer = container.querySelector("#cvVendors");

  const { contacts, relationships } = await loadClientVendorData(project);
  const contactMap = buildContactMap(contacts);

  // EXACT match to your DB
  const clientVendorRels = relationships.filter(
    r => r.relationship_type === "Client- Vendor"
  );

  const {
    clientsList,
    vendorsList,
    groupedByClient,
    groupedByVendor
  } = buildClientVendorModel(contacts, clientVendorRels, contactMap);

  renderClientSection(clientsContainer, clientsList, groupedByClient, contactMap, portalState);
  renderVendorSection(vendorsContainer, vendorsList, groupedByVendor, contactMap, portalState);
  renderMismatchSection(mismatchesContainer, mismatchesList, groupedByMismatch, contactMap, portalState);

}

/* -------------------------------------------------------
Data loading
------------------------------------------------------- */

async function loadClientVendorData(projectId) {
  const contactsUrl =
    `https://contacts-module.dennis-e64.workers.dev/contacts/all?project=${encodeURIComponent(projectId)}`;
  const relUrl =
    `https://contacts-module.dennis-e64.workers.dev/contact_relationships?project=${encodeURIComponent(projectId)}`;

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

function buildClientVendorModel(contacts, clientVendorRels, contactMap) {
  // ------------------------------------------------------------
  // 1. CLIENTS = DISTINCT source_contact_id
  // ------------------------------------------------------------
  const clientIdSet = new Set(
    clientVendorRels.map(r => r.source_contact_id).filter(Boolean)
  );

  const clientsList = [...clientIdSet]
    .map(id => contactMap[id])
    .filter(Boolean);

  // ------------------------------------------------------------
  // 2. VENDORS = DISTINCT related_contact_id
  // ------------------------------------------------------------
  const vendorIdSet = new Set(
    clientVendorRels.map(r => r.related_contact_id).filter(Boolean)
  );

  const vendorsList = [...vendorIdSet]
    .map(id => contactMap[id])
    .filter(Boolean);

  // ------------------------------------------------------------
  // 3. GROUP BY CLIENT (client → vendors)
  // ------------------------------------------------------------
  const groupedByClient = {};
  clientVendorRels.forEach(r => {
    const clientId = r.source_contact_id;
    const vendorId = r.related_contact_id;
    if (!clientId || !vendorId) return;

    if (!groupedByClient[clientId]) groupedByClient[clientId] = [];
    groupedByClient[clientId].push({
      vendorId,
      role: r.relationship_role || "",
      rel: r
    });
  });

  // ------------------------------------------------------------
  // 4. GROUP BY VENDOR (vendor → clients)
  // ------------------------------------------------------------
  const groupedByVendor = {};
  clientVendorRels.forEach(r => {
    const clientId = r.source_contact_id;
    const vendorId = r.related_contact_id;
    if (!clientId || !vendorId) return;

    if (!groupedByVendor[vendorId]) groupedByVendor[vendorId] = [];
    groupedByVendor[vendorId].push({
      clientId,
      role: r.relationship_role || "",
      rel: r
    });
  });

  // ------------------------------------------------------------
  // 5. TYPE MISMATCH = vendors where contact_type != "Client Vendor"
  // ------------------------------------------------------------
  const mismatchesList = [...vendorIdSet]
    .map(id => contactMap[id])
    .filter(c => c && c.type !== "Client Vendor");

  // Group mismatches (vendor → clients)
  const groupedByMismatch = {};
  clientVendorRels.forEach(r => {
    const vendorId = r.related_contact_id;
    if (!vendorId) return;

    const vendor = contactMap[vendorId];
    if (!vendor || vendor.type === "Client Vendor") return;

    if (!groupedByMismatch[vendorId]) groupedByMismatch[vendorId] = [];
    groupedByMismatch[vendorId].push({
      clientId: r.source_contact_id,
      role: r.relationship_role || "",
      rel: r
    });
  });

  return {
    clientsList,
    vendorsList,
    groupedByClient,
    groupedByVendor,
    mismatchesList,
    groupedByMismatch
  };
}

/* -------------------------------------------------------
Rendering — Clients
------------------------------------------------------- */

function renderClientSection(container, clientsList, groupedByClient, contactMap, portalState) {
  let html = `
    <h3>Clients (${clientsList.length})</h3>
    <table class="notes-table">
      <thead>
        <tr>
          <th>Client</th>
          <th style="width:140px; text-align:center;">Action</th>
        </tr>
      </thead>
      <tbody>
  `;

  clientsList.forEach(c => {
    html += `
      <tr data-id="${escapeHtml(c.id)}">
        <td>${escapeHtml(c.name)}</td>
        <td style="text-align:center;">
          <button class="btn-secondary cv-expand" data-id="${escapeHtml(c.id)}">▶ Expand</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;

  container.querySelectorAll(".cv-expand").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const expanded = btn.textContent.includes("Collapse");

      if (expanded) {
        collapseRow(btn);
      } else {
        expandClientRow(btn, id, groupedByClient[id], contactMap, portalState);
      }
    });
  });
}

function expandClientRow(btn, clientId, rows, contactMap, portalState) {
  btn.textContent = "▼ Collapse";

  const tr = btn.closest("tr");
  const newRow = document.createElement("tr");
  newRow.classList.add("cv-expand-row");

  let html = `
    <td colspan="2">
      <div style="background:#fafafa; padding:8px;">
        <strong>Vendors</strong>
        <table class="notes-table" style="margin-top:6px;">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
  `;

  (rows || []).forEach(r => {
    const vendor = contactMap[r.vendorId];
    html += `
      <tr>
        <td>
          <a href="#" class="cv-link" data-id="${escapeHtml(vendor.id)}">
            ${escapeHtml(vendor.name)}
          </a>
        </td>
        <td>${escapeHtml(r.role)}</td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
    </td>
  `;

  newRow.innerHTML = html;
  tr.after(newRow);

  newRow.querySelectorAll(".cv-link").forEach(a => {
    a.addEventListener("click", evt => {
      evt.preventDefault();
      portalState.selectedContactId = a.dataset.id;
      document
        .querySelector('#relationships-subtabs button[data-subtab="details"]')
        ?.click();
    });
  });
}

function collapseRow(btn) {
  btn.textContent = "▶ Expand";
  const tr = btn.closest("tr");
  const next = tr.nextElementSibling;
  if (next && next.classList.contains("cv-expand-row")) next.remove();
}

/* -------------------------------------------------------
Rendering — Vendors
------------------------------------------------------- */

function renderVendorSection(container, vendorsList, groupedByVendor, contactMap, portalState) {
  let html = `
    <h3>Client Vendors (${vendorsList.length})</h3>
    <table class="notes-table">
      <thead>
        <tr>
          <th>Vendor</th>
          <th style="width:140px; text-align:center;">Action</th>
        </tr>
      </thead>
      <tbody>
  `;

  vendorsList.forEach(v => {
    html += `
      <tr data-id="${escapeHtml(v.id)}">
        <td>${escapeHtml(v.name)}</td>
        <td style="text-align:center;">
          <button class="btn-secondary cv-expand" data-id="${escapeHtml(v.id)}">▶ Expand</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;

  container.querySelectorAll(".cv-expand").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const expanded = btn.textContent.includes("Collapse");

      if (expanded) {
        collapseRow(btn);
      } else {
        expandVendorRow(btn, id, groupedByVendor[id], contactMap, portalState);
      }
    });
  });
}

function expandVendorRow(btn, vendorId, rows, contactMap, portalState) {
  btn.textContent = "▼ Collapse";

  const tr = btn.closest("tr");
  const newRow = document.createElement("tr");
  newRow.classList.add("cv-expand-row");

  let html = `
    <td colspan="2">
      <div style="background:#fafafa; padding:8px;">
        <strong>Clients</strong>
        <table class="notes-table" style="margin-top:6px;">
          <thead>
            <tr>
              <th>Client</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
  `;

  (rows || []).forEach(r => {
    const client = contactMap[r.clientId];
    html += `
      <tr>
        <td>
          <a href="#" class="cv-link" data-id="${escapeHtml(client.id)}">
            ${escapeHtml(client.name)}
          </a>
        </td>
        <td>${escapeHtml(r.role)}</td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
    </td>
  `;

  newRow.innerHTML = html;
  tr.after(newRow);

  newRow.querySelectorAll(".cv-link").forEach(a => {
    a.addEventListener("click", evt => {
      evt.preventDefault();
      portalState.selectedContactId = a.dataset.id;
      document
        .querySelector('#relationships-subtabs button[data-subtab="details"]')
        ?.click();
    });
  });

  /* -------------------------------------------------------
  Rendering — Type Mismatches
  ------------------------------------------------------- */
  
  function renderMismatchSection(
    container,
    mismatchesList,
    groupedByMismatch,
    contactMap,
    portalState
  ) {
    let html = `
  <h3>Contacts With Type Mismatch (${mismatchesList.length})</h3>
  <table class="notes-table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Contact Type</th>
        <th>Relationship Type</th>
        <th style="width:140px; text-align:center;">Action</th>
      </tr>
    </thead>
    <tbody>
  `;
  
    mismatchesList.forEach(v => {
      html += `
  <tr data-id="${escapeHtml(v.id)}">
    <td>${escapeHtml(v.name)}</td>
    <td>${escapeHtml(v.type)}</td>
    <td>Client- Vendor</td>
    <td style="text-align:center;">
      <button class="btn-secondary cv-expand" data-id="${escapeHtml(
        v.id
      )}">▶ Expand</button>
    </td>
  </tr>
  `;
    });
  
    html += `</tbody></table>`;
    container.innerHTML = html;
  
    container.querySelectorAll(".cv-expand").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const expanded = btn.textContent.includes("Collapse");
        if (expanded) {
          collapseRow(btn);
        } else {
          expandMismatchRow(
            btn,
            id,
            groupedByMismatch[id],
            contactMap,
            portalState
          );
        }
      });
    });
  }
  
  function expandMismatchRow(
    btn,
    vendorId,
    rows,
    contactMap,
    portalState
  ) {
    btn.textContent = "▼ Collapse";
  
    const tr = btn.closest("tr");
    const newRow = document.createElement("tr");
    newRow.classList.add("cv-expand-row");
  
    let html = `
  <td colspan="4">
    <div style="background:#fafafa; padding:8px;">
      <strong>Clients (for this mismatched vendor)</strong>
      <table class="notes-table" style="margin-top:6px;">
        <thead>
          <tr>
            <th>Client</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
  `;
  
    (rows || []).forEach(r => {
      const client = contactMap[r.clientId];
      if (!client) return;
      html += `
  <tr>
    <td>
      <a href="#" class="cv-link" data-id="${escapeHtml(client.id)}">
        ${escapeHtml(client.name)}
      </a>
    </td>
    <td>${escapeHtml(r.role)}</td>
  </tr>
  `;
    });
  
    html += `
        </tbody>
      </table>
    </div>
  </td>
  `;
  
    newRow.innerHTML = html;
    tr.after(newRow);
  
    newRow.querySelectorAll(".cv-link").forEach(a => {
      a.addEventListener("click", evt => {
        evt.preventDefault();
        portalState.selectedContactId = a.dataset.id;
        document
          .querySelector('#relationships-subtabs button[data-subtab="details"]')
          ?.click();
      });
    });
  }
}
