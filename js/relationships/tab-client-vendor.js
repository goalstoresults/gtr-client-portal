// tab-client-vendor.js — UPDATED WITH CORRECT LOGIC + TYPE MISMATCH SECTION

import { createElement } from "../utils/dom.js";
import { fetchContacts, fetchRelationships } from "../api/data.js";

export async function renderClientVendorTab(container) {
  container.innerHTML = "<p>Loading Client–Vendor data…</p>";

  const [contacts, relationships] = await Promise.all([
    fetchContacts(),
    fetchRelationships()
  ]);

  const contactMap = Object.fromEntries(
    contacts.map(c => [c.contact_id, c])
  );

  // ------------------------------------------------------------
  // 1. FILTER RELATIONSHIPS BY EXACT TYPE
  // ------------------------------------------------------------
  const clientVendorRels = relationships.filter(
    r => r.relationship_type === "Client- Vendor"
  );

  // ------------------------------------------------------------
  // 2. CLIENTS = source_contact_id ONLY
  // ------------------------------------------------------------
  const clientIds = new Set(clientVendorRels.map(r => r.source_contact_id));
  const clientsList = [...clientIds]
    .map(id => contactMap[id])
    .filter(Boolean);

  // ------------------------------------------------------------
  // 3. VENDORS = related_contact_id ONLY
  // ------------------------------------------------------------
  const vendorIds = new Set(clientVendorRels.map(r => r.related_contact_id));
  const vendorsList = [...vendorIds]
    .map(id => contactMap[id])
    .filter(Boolean);

  // ------------------------------------------------------------
  // 4. TYPE MISMATCH = related_contact_id where contact_type != "Client Vendor"
  // ------------------------------------------------------------
  const mismatches = [...vendorIds]
    .map(id => contactMap[id])
    .filter(c => c && c.contact_type !== "Client Vendor")
    .map(c => ({
      id: c.contact_id,
      name: c.contact_name,
      contactType: c.contact_type,
      relationshipType: "Client- Vendor"
    }));

  // ------------------------------------------------------------
  // RENDERING
  // ------------------------------------------------------------
  container.innerHTML = "";

  // CLIENTS SECTION
  container.appendChild(sectionHeader(`Clients (${clientsList.length})`));
  container.appendChild(
    buildTable(["Name", "Contact Type", "Link"], clientsList.map(c => [
      c.contact_name,
      c.contact_type,
      linkToContact(c.contact_id)
    ]))
  );

  // VENDORS SECTION
  container.appendChild(sectionHeader(`Client Vendors (${vendorsList.length})`));
  container.appendChild(
    buildTable(["Name", "Contact Type", "Link"], vendorsList.map(c => [
      c.contact_name,
      c.contact_type,
      linkToContact(c.contact_id)
    ]))
  );

  // TYPE MISMATCH SECTION
  container.appendChild(sectionHeader(`⚠️ Type Mismatches (${mismatches.length})`));
  container.appendChild(
    buildTable(["Name", "Contact Type", "Relationship Type", "Link"], mismatches.map(m => [
      m.name,
      m.contactType,
      m.relationshipType,
      linkToContact(m.id)
    ]))
  );
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
function sectionHeader(text) {
  const h = document.createElement("h3");
  h.textContent = text;
  return h;
}

function buildTable(headers, rows) {
  const table = document.createElement("table");
  table.className = "cv-table";

  const thead = document.createElement("thead");
  const tr = document.createElement("tr");
  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach(row => {
    const tr = document.createElement("tr");
    row.forEach(cell => {
      const td = document.createElement("td");
      if (cell instanceof HTMLElement) td.appendChild(cell);
      else td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  return table;
}

function linkToContact(id) {
  const a = document.createElement("a");
  a.href = `#/contacts/${id}`;
  a.textContent = "View";
  return a;
}


