// /js/relationships/tab-list.js

// Relationships — List View with inline edit/delete + persistent filter/sort state + row count

import { renderRelDetails } from "./tab-details.js";

export async function renderRelList(container, portalState) {

try {

/* -------------------------------------------------------
INITIALIZE PERSISTENT STATE
------------------------------------------------------- */

if (!portalState.relationshipsListState) {
    portalState.relationshipsListState = {
        contact_type: "",
        sortField: "full_name",
        sortDirection: "asc",
        fullList: false   // NEW
    };
}

/* -------------------------------------------------------
RENDER FILTER BAR + TABLE SHELL
------------------------------------------------------- */

container.innerHTML = `
<section class="card">
<h2>Relationships for ${portalState.display_name || portalState.project}</h2>

<div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">

    <label style="font-weight:bold;">Contact Type:</label>

    <select id="rel-contactType" class="form-control" style="min-width:160px;">
        <option value="">ALL</option>
        <option value="Client">Client</option>
        <option value="Client Vendor">Client Vendor</option>
        <option value="NYFO Vendor">NYFO Vendor</option>
        <option value="Lead">Lead</option>
        <option value="child">Child</option>
        <option value="Family">Family</option>
        <option value="New Contact">New Contact</option>
        <option value="Other">Other</option>
        <option value="Unknown">Unknown</option>
    </select>

    <label style="display:flex; align-items:center; gap:6px;">
        <input type="checkbox" id="rel-fullList" />
        Full List
    </label>

    <button id="rel-applyFilter" class="secondary">Apply Filter</button>
    <button id="rel-clearFilter" class="secondary">Clear</button>
</div>

<p id="relRowCount" class="muted"></p>

<div id="relTable">(apply filter to load)</div>

</section>
`;

const tableDiv = container.querySelector("#relTable");
const rowCountDiv = container.querySelector("#relRowCount");
const typeSelect = document.getElementById("rel-contactType");
const fullListCheckbox = document.getElementById("rel-fullList");

/* -------------------------------------------------------
LOAD SAVED FILTER STATE
------------------------------------------------------- */

typeSelect.value = portalState.relationshipsListState.contact_type || "";
fullListCheckbox.checked = portalState.relationshipsListState.fullList;

let currentSortField = portalState.relationshipsListState.sortField;
let currentSortDirection = portalState.relationshipsListState.sortDirection;

let rows = [];

/* -------------------------------------------------------
SORTING ENGINE
------------------------------------------------------- */

function sortRows() {
    const sorted = [...rows];

    sorted.sort((a, b) => {
        const field = currentSortField;

        if (field === "relationship_count") {
            const A = Number(a[field] || 0);
            const B = Number(b[field] || 0);
            return currentSortDirection === "asc" ? A - B : B - A;
        }

        const A = (a[field] || "").toLowerCase();
        const B = (b[field] || "").toLowerCase();

        return currentSortDirection === "asc"
            ? A.localeCompare(B)
            : B.localeCompare(A);
    });

    return sorted;
}

/* -------------------------------------------------------
SORT ARROWS
------------------------------------------------------- */

function arrowsFor(field) {
    const isSorted = currentSortField === field;
    const up = isSorted && currentSortDirection === "asc" ? "▲" : "△";
    const down = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

    return `
        <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
            <span class="sort-up">${up}</span>
            <span class="sort-down">${down}</span>
        </span>
    `;
}

/* -------------------------------------------------------
RENDER TABLE
------------------------------------------------------- */

function renderSortedTable() {

    rowCountDiv.textContent = `Showing ${rows.length} relationships`;

    if (!rows.length) {
        tableDiv.innerHTML = `<p class="muted">(no results)</p>`;
        return;
    }

    const sorted = sortRows();

    tableDiv.innerHTML = `
<table class="notes-table">
<thead>
<tr>
    <th class="sortable" data-field="full_name">
        Full Name ${arrowsFor("full_name")}
    </th>
    <th class="sortable" data-field="email">
        Email ${arrowsFor("email")}
    </th>
    <th class="sortable" data-field="contact_type">
        Type ${arrowsFor("contact_type")}
    </th>
    <th class="sortable" data-field="relationship_count">
        Relationships ${arrowsFor("relationship_count")}
    </th>
    <th>Action</th>
</tr>
</thead>

<tbody>
${sorted
    .map(
        (r) => `
<tr data-id="${r.contact_id}">
    <td>${r.full_name}</td>
    <td>${r.email || ""}</td>
    <td>${r.contact_type || ""}</td>
    <td>${r.relationship_count || 0}</td>
    <td>
        <button class="btn-primary rel-select-btn" data-id="${r.contact_id}">Select</button>
        <button class="btn-secondary rel-edit-btn" data-id="${r.contact_id}">Edit</button>
    </td>
</tr>

<tr class="inline-editor" id="editor-${r.contact_id}" style="display:none;">
<td colspan="5" style="background:#fafafa; border-top:1px solid #ddd;">

    <label style="font-weight:bold;">Contact Type</label>
    <select class="edit-contact-type form-control" data-id="${r.contact_id}">
        <option value="Client">Client</option>
        <option value="Client Vendor">Client Vendor</option>
        <option value="NYFO Vendor">NYFO Vendor</option>
        <option value="Lead">Lead</option>
        <option value="child">Child</option>
        <option value="Family">Family</option>
        <option value="New Contact">New Contact</option>
        <option value="Other">Other</option>
        <option value="Unknown">Unknown</option>
    </select>

    <div style="margin-top:12px; display:flex; gap:12px;">
        <button class="btn-primary save-contact-type" data-id="${r.contact_id}">Save</button>
        <button class="btn-danger delete-contact" data-id="${r.contact_id}">Delete</button>
    </div>

</td>
</tr>
`
    )
    .join("")}
</tbody>
</table>
`;

    /* -------------------------------------------------------
    SORT CLICK HANDLERS
    ------------------------------------------------------- */

    tableDiv.querySelectorAll("th.sortable").forEach((th) => {
        th.addEventListener("click", () => {
            const field = th.dataset.field;

            if (currentSortField === field) {
                currentSortDirection =
                    currentSortDirection === "asc" ? "desc" : "asc";
            } else {
                currentSortField = field;
                currentSortDirection = "asc";
            }

            portalState.relationshipsListState.sortField = currentSortField;
            portalState.relationshipsListState.sortDirection = currentSortDirection;

            renderSortedTable();
        });
    });

    /* -------------------------------------------------------
    SELECT BUTTON HANDLER
    ------------------------------------------------------- */

    tableDiv.querySelectorAll(".rel-select-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;

            portalState.selectedContactId = id;

            const res = await fetch(
                `https://contacts-module.dennis-e64.workers.dev/contacts/details/${id}`,
                { cache: "no-cache" }
            );

            const data = await res.json();
            const contact = Array.isArray(data) ? data[0] : data;

            portalState.selectedContactName =
                contact.search_name ||
                `${contact.first_name || ""} ${contact.last_name || ""}`.trim();

            document
                .querySelectorAll("#relationships-subtabs button")
                .forEach((b) => b.classList.remove("active"));

            const detailsBtn = document.querySelector(
                '#relationships-subtabs button[data-subtab="details"]'
            );

            if (detailsBtn) detailsBtn.classList.add("active");

            const content = document.getElementById("relationshipsContent");
            await renderRelDetails(content, portalState);
        });
    });

    /* -------------------------------------------------------
    EDIT BUTTON HANDLER
    ------------------------------------------------------- */

    tableDiv.querySelectorAll(".rel-edit-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.id;
            const editor = document.getElementById(`editor-${id}`);
            editor.style.display =
                editor.style.display === "none" ? "table-row" : "none";
        });
    });

    /* -------------------------------------------------------
    SAVE CONTACT TYPE
    ------------------------------------------------------- */

    tableDiv.querySelectorAll(".save-contact-type").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;

            const select = document.querySelector(
                `.edit-contact-type[data-id="${id}"]`
            );

            const newType = select.value;

            await fetch(
                `https://contacts-module.dennis-e64.workers.dev/contacts/edit/${id}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contact_type: newType
                    })
                }
            );

            await loadList();
        });
    });

    /* -------------------------------------------------------
    DELETE CONTACT
    ------------------------------------------------------- */

    tableDiv.querySelectorAll(".delete-contact").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;

            if (!confirm("Are you sure you want to delete this contact?")) return;

            await fetch(
                `https://contacts-module.dennis-e64.workers.dev/contacts/delete/${id}?project=${portalState.project}`,
                { method: "DELETE" }
            );

            await loadList();
        });
    });
}

/* -------------------------------------------------------
LOAD DATA FROM WORKER
------------------------------------------------------- */

async function loadList() {

    tableDiv.innerHTML = `<p class="muted">Loading…</p>`;
    rowCountDiv.textContent = "";

    const url = new URL(
        "https://relationships-topview.dennis-e64.workers.dev/relationships/list"
    );

    url.searchParams.set("project", portalState.project);

    const type = typeSelect.value.trim();
    if (type) url.searchParams.set("contact_type", type);

    const res = await fetch(url.toString(), { cache: "no-cache" });
    const data = await res.json();

    rows = Array.isArray(data) ? data : [];

    // NEW: Apply Full List filter
    if (!fullListCheckbox.checked) {
        rows = rows.filter(r => Number(r.relationship_count || 0) > 0);
    }

    renderSortedTable();
}

/* -------------------------------------------------------
BUTTON HANDLERS
------------------------------------------------------- */

document.getElementById("rel-applyFilter").addEventListener("click", () => {
    portalState.relationshipsListState.contact_type = typeSelect.value.trim();
    portalState.relationshipsListState.fullList = fullListCheckbox.checked;
    loadList();
});

document.getElementById("rel-clearFilter").addEventListener("click", () => {
    portalState.relationshipsListState = {
        contact_type: "",
        sortField: "full_name",
        sortDirection: "asc",
        fullList: false
    };

    typeSelect.value = "";
    fullListCheckbox.checked = false;

    rows = [];
    rowCountDiv.textContent = "";
    tableDiv.innerHTML = `<p class="muted">Apply a filter to load results.</p>`;
});

/* -------------------------------------------------------
AUTO-LOAD IF FILTER EXISTS
------------------------------------------------------- */

if (portalState.relationshipsListState.contact_type ||
    portalState.relationshipsListState.fullList) {
    loadList();
}

} catch (err) {
    container.innerHTML = `
        <h4>Relationships</h4>
        <p>Error: ${err.message}</p>
    `;
}

}

