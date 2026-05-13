// /js/relationships/tab-client-vendor.js

// Client–Vendor Explorer (Client = "Client", Vendor = "Client Vendor")

import { escapeHtml } from "../utilities.js";

const API_BASE = "https://relationships-topview.dennis-e64.workers.dev";

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
  const mismatchesContainer = container.querySelector("#cvMismatches");

  // Load top-level grids (small, filtered payloads)
  const [clients, vendors, mismatches] = await Promise.all([
    fetchJson(`${API_BASE}/client-vendor/clients?project=${encodeURIComponent(project)}`),
    fetchJson(`${API_BASE}/client-vendor/vendors?project=${encodeURIComponent(project)}`),
    fetchJson(`${API_BASE}/client-vendor/mismatches?project=${encodeURIComponent(project)}`)
  ]);

  renderClientSection(clientsContainer, clients || [], portalState, project);
  renderVendorSection(vendorsContainer, vendors || [], portalState, project);
  renderMismatchSection(mismatchesContainer, mismatches || [], portalState);
}

/* -------------------------------------------------------
   Utilities
------------------------------------------------------- */

async function fetchJson(url) {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.rows || [];
  } catch {
    return [];
  }
}

/* -------------------------------------------------------
   Rendering — Clients
------------------------------------------------------- */

function renderClientSection(container, clientsList, portalState, project) {
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
      <tr data-id="${escapeHtml(c.contact_id)}">
        <td>${escapeHtml(c.search_name || "(unknown)")}</td>
        <td style="text-align:center;">
          <button class="btn-secondary cv-expand" data-id="${escapeHtml(c.contact_id)}">▶ Expand</button>
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
        expandClientRow(btn, id, portalState, project);
      }
    });
  });
}

async function expandClientRow(btn, clientId, portalState, project) {
  btn.textContent = "▼ Collapse";

  const tr = btn.closest("tr");
  const newRow = document.createElement("tr");
  newRow.classList.add("cv-expand-row");

  // Lazy-load vendors for this client
  const url = `${API_BASE}/client-vendor/expand-client/${encodeURIComponent(
    clientId
  )}?project=${encodeURIComponent(project)}`;
  const rows = await fetchJson(url);

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
    const vendor = r.vendor || {};
    const name =
      vendor.search_name ||
      "(missing contact)";
    html += `
      <tr>
        <td>
          ${
            vendor.search_name
              ? `<a href="#" class="cv-link" data-id="${escapeHtml(
                  r.related_contact_id
                )}">${escapeHtml(name)}</a>`
              : escapeHtml(name)
          }
        </td>
        <td>${escapeHtml(r.relationship_role || "")}</td>
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

/* -------------------------------------------------------
   Rendering — Vendors
------------------------------------------------------- */

function renderVendorSection(container, vendorsList, portalState, project) {
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
      <tr data-id="${escapeHtml(v.contact_id)}">
        <td>${escapeHtml(v.search_name || "(unknown)")}</td>
        <td style="text-align:center;">
          <button class="btn-secondary cv-expand" data-id="${escapeHtml(v.contact_id)}">▶ Expand</button>
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
        expandVendorRow(btn, id, portalState, project);
      }
    });
  });
}

async function expandVendorRow(btn, vendorId, portalState, project) {
  btn.textContent = "▼ Collapse";

  const tr = btn.closest("tr");
  const newRow = document.createElement("tr");
  newRow.classList.add("cv-expand-row");

  // Lazy-load clients for this vendor
  const url = `${API_BASE}/client-vendor/expand-vendor/${encodeURIComponent(
    vendorId
  )}?project=${encodeURIComponent(project)}`;
  const rows = await fetchJson(url);

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
    const client = r.client || {};
    const name =
      client.search_name ||
      "(missing contact)";
    html += `
      <tr>
        <td>
          ${
            client.search_name
              ? `<a href="#" class="cv-link" data-id="${escapeHtml(
                  r.source_contact_id
                )}">${escapeHtml(name)}</a>`
              : escapeHtml(name)
          }
        </td>
        <td>${escapeHtml(r.relationship_role || "")}</td>
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

/* -------------------------------------------------------
   Rendering — Type Mismatches
------------------------------------------------------- */

function renderMismatchSection(container, mismatchesList, portalState) {
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
      <tr data-id="${escapeHtml(v.contact_id)}">
        <td>${escapeHtml(v.search_name || "(unknown)")}</td>
        <td>${escapeHtml(v.contact_type || "")}</td>
        <td>Client- Vendor</td>
        <td style="text-align:center;">
          <button class="btn-primary cv-details" data-id="${escapeHtml(v.contact_id)}">Details</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;

  container.querySelectorAll(".cv-details").forEach(btn => {
    btn.addEventListener("click", () => {
      portalState.selectedContactId = btn.dataset.id;
      document
        .querySelector('#relationships-subtabs button[data-subtab="contact-details"]')
        ?.click();
    });
  });
}

/* -------------------------------------------------------
   Shared — Collapse
------------------------------------------------------- */

function collapseRow(btn) {
  btn.textContent = "▶ Expand";
  const tr = btn.closest("tr");
  const next = tr.nextElementSibling;
  if (next && next.classList.contains("cv-expand-row")) next.remove();
}

