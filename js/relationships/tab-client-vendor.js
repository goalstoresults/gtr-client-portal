// /js/relationships/tab-client-vendor.js

// FINAL REWRITE — Count column, sorting, arrows, lazy expand, section expand/collapse

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
        </section>
    `;

    const clientsContainer = container.querySelector("#cvClients");
    const vendorsContainer = container.querySelector("#cvVendors");

    // Load top-level grids (NO MISMATCHES)
    const [clients, vendors] = await Promise.all([
        fetchJson(`${API_BASE}/client-vendor/clients?project=${encodeURIComponent(project)}`),
        fetchJson(`${API_BASE}/client-vendor/vendors?project=${encodeURIComponent(project)}`)
    ]);

    renderClientSection(clientsContainer, clients || [], portalState, project);
    renderVendorSection(vendorsContainer, vendors || [], portalState, project);
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

function arrowsFor(field, sortField, sortDirection) {
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

/* -------------------------------------------------------
Rendering — Clients
------------------------------------------------------- */

function renderClientSection(container, list, portalState, project) {

    let sortField = "count";
    let sortDirection = "desc";

    function sortRows() {
        const rows = [...list];
        rows.sort((a, b) => {
            const A = Number(a.relationship_count || 0);
            const B = Number(b.relationship_count || 0);
            if (A !== B) return sortDirection === "asc" ? A - B : B - A;
            return (a.search_name || "").localeCompare(b.search_name || "");
        });
        return rows;
    }

    function render() {
        const rows = sortRows();

        let html = `
            <div class="cv-section" data-section="clients">
                <div class="cv-section-header">
                    <span class="cv-section-title">Clients (${rows.length})</span>
                    <button class="btn-secondary cv-toggle">▼ Collapse</button>
                </div>
                <div class="cv-section-body">
                    <table class="notes-table">
                        <thead>
                            <tr>
                                <th class="sortable" data-field="name">
                                    Client ${arrowsFor("name", sortField, sortDirection)}
                                </th>
                                <th class="sortable" data-field="count" style="width:80px; text-align:right;">
                                    Count ${arrowsFor("count", sortField, sortDirection)}
                                </th>
                                <th style="width:160px; text-align:center;">Action</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        rows.forEach(c => {
            const count = Number(c.relationship_count || 0);
            const canExpand = count > 0;

            html += `
                <tr data-id="${escapeHtml(c.contact_id)}">
                    <td>${escapeHtml(c.search_name || "(unknown)")}</td>
                    <td style="text-align:right;">${count}</td>
                    <td style="text-align:center; white-space:nowrap;">
                        ${
                            canExpand
                                ? `<button class="btn-secondary cv-expand" data-id="${escapeHtml(
                                      c.contact_id
                                  )}" style="margin-right:6px;">▶ Expand</button>`
                                : ""
                        }
                        <button class="btn-primary cv-details" data-id="${escapeHtml(
                            c.contact_id
                        )}">Details</button>
                    </td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;

        const section = container.querySelector(".cv-section");
        const body = section.querySelector(".cv-section-body");
        const toggleBtn = section.querySelector(".cv-toggle");

        body.style.display = "block";
        toggleBtn.textContent = "▼ Collapse";

        toggleBtn.addEventListener("click", () => {
            const isCollapsed = body.style.display === "none";
            body.style.display = isCollapsed ? "block" : "none";
            toggleBtn.textContent = isCollapsed ? "▼ Collapse" : "▶ Expand";
        });

        body.querySelectorAll("th.sortable").forEach(th => {
            th.addEventListener("click", () => {
                const field = th.dataset.field;
                if (field === "name") {
                    sortField = "name";
                    sortDirection = sortDirection === "asc" ? "desc" : "asc";
                } else if (field === "count") {
                    sortField = "count";
                    sortDirection = sortDirection === "asc" ? "desc" : "asc";
                }
                render();
            });
        });

        body.querySelectorAll(".cv-expand").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.id;
                const expanded = btn.textContent.includes("Collapse");
                if (expanded) collapseRow(btn);
                else expandClientRow(btn, id, portalState, project);
            });
        });

        body.querySelectorAll(".cv-details").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.id;
                const row = list.find(r => r.contact_id === id);
                portalState.selectedContactId = id;
                portalState.selectedContactName = row?.search_name || "";
                document
                    .querySelector('#relationships-subtabs button[data-subtab="details"]')
                    ?.click();
                window.scrollTo({ top: 0, behavior: "auto" });
            });
        });
    }

    render();
}

async function expandClientRow(btn, clientId, portalState, project) {
    btn.textContent = "▼ Collapse";

    const tr = btn.closest("tr");
    const newRow = document.createElement("tr");
    newRow.classList.add("cv-expand-row");

    const url = `${API_BASE}/client-vendor/expand-client/${encodeURIComponent(
        clientId
    )}?project=${encodeURIComponent(project)}`;

    const rows = await fetchJson(url);

    let html = `
        <td colspan="3">
            <div style="background:#fafafa; padding:8px;">
                <strong>All Relationships</strong>
                <table class="notes-table" style="margin-top:6px;">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Related Contact</th>
                            <th>Role</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    rows.forEach(r => {
        const isSource = r.source_contact_id === clientId;
        const other = isSource ? r.related : r.client;
        const otherId = isSource ? r.related_contact_id : r.source_contact_id;
        const otherName = other?.search_name || "(missing contact)";

        html += `
            <tr>
                <td>${escapeHtml(r.relationship_type || "")}</td>
                <td>
                    ${
                        otherName !== "(missing contact)"
                            ? `<a href="#" class="cv-link" data-id="${escapeHtml(
                                  otherId
                              )}">${escapeHtml(otherName)}</a>`
                            : escapeHtml(otherName)
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
            window.scrollTo({ top: 0, behavior: "auto" });
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

function renderVendorSection(container, list, portalState, project) {

    let sortField = "count";
    let sortDirection = "desc";

    function sortRows() {
        const rows = [...list];
        rows.sort((a, b) => {
            const A = Number(a.relationship_count || 0);
            const B = Number(b.relationship_count || 0);
            if (A !== B) return sortDirection === "asc" ? A - B : B - A;
            return (a.search_name || "").localeCompare(b.search_name || "");
        });
        return rows;
    }

    function render() {
        const rows = sortRows();

        let html = `
            <div class="cv-section" data-section="vendors">
                <div class="cv-section-header">
                    <span class="cv-section-title">Client Vendors (${rows.length})</span>
                    <button class="btn-secondary cv-toggle">▶ Expand</button>
                </div>
                <div class="cv-section-body" style="display:none;">
                    <table class="notes-table">
                        <thead>
                            <tr>
                                <th class="sortable" data-field="name">
                                    Vendor ${arrowsFor("name", sortField, sortDirection)}
                                </th>
                                <th class="sortable" data-field="count" style="width:80px; text-align:right;">
                                    Count ${arrowsFor("count", sortField, sortDirection)}
                                </th>
                                <th style="width:160px; text-align:center;">Action</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        rows.forEach(v => {
            const count = Number(v.relationship_count || 0);
            const canExpand = count > 0;

            html += `
                <tr data-id="${escapeHtml(v.contact_id)}">
                    <td>${escapeHtml(v.search_name || "(unknown)")}</td>
                    <td style="text-align:right;">${count}</td>
                    <td style="text-align:center; white-space:nowrap;">
                        ${
                            canExpand
                                ? `<button class="btn-secondary cv-expand" data-id="${escapeHtml(
                                      v.contact_id
                                  )}" style="margin-right:6px;">▶ Expand</button>`
                                : ""
                        }
                        <button class="btn-primary cv-details" data-id="${escapeHtml(
                            v.contact_id
                        )}">Details</button>
                    </td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;

        const section = container.querySelector(".cv-section");
        const body = section.querySelector(".cv-section-body");
        const toggleBtn = section.querySelector(".cv-toggle");

        body.style.display = "none";
        toggleBtn.textContent = "▶ Expand";

        toggleBtn.addEventListener("click", () => {
            const isCollapsed = body.style.display === "none";
            body.style.display = isCollapsed ? "block" : "none";
            toggleBtn.textContent = isCollapsed ? "▼ Collapse" : "▶ Expand";
        });

        body.querySelectorAll("th.sortable").forEach(th => {
            th.addEventListener("click", () => {
                const field = th.dataset.field;
                if (field === "name") {
                    sortField = "name";
                    sortDirection = sortDirection === "asc" ? "desc" : "asc";
                } else if (field === "count") {
                    sortField = "count";
                    sortDirection = sortDirection === "asc" ? "desc" : "asc";
                }
                render();
            });
        });

        body.querySelectorAll(".cv-expand").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.id;
                const expanded = btn.textContent.includes("Collapse");
                if (expanded) collapseRow(btn);
                else expandVendorRow(btn, id, portalState, project);
            });
        });

        body.querySelectorAll(".cv-details").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.id;
                const row = list.find(r => r.contact_id === id);
                portalState.selectedContactId = id;
                portalState.selectedContactName = row?.search_name || "";
                document
                    .querySelector('#relationships-subtabs button[data-subtab="details"]')
                    ?.click();
                window.scrollTo({ top: 0, behavior: "auto" });
            });
        });
    }

    render();
}

async function expandVendorRow(btn, vendorId, portalState, project) {
    btn.textContent = "▼ Collapse";

    const tr = btn.closest("tr");
    const newRow = document.createElement("tr");
    newRow.classList.add("cv-expand-row");

    const url = `${API_BASE}/client-vendor/expand-vendor/${encodeURIComponent(
        vendorId
    )}?project=${encodeURIComponent(project)}`;

    const rows = await fetchJson(url);

    let html = `
        <td colspan="3">
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

    rows.forEach(r => {
        const client = r.client || {};
        const name = client.search_name || "(missing contact)";

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
