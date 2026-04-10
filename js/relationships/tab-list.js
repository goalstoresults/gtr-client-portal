// /js/relationships/tab-list.js
// Relationships — List View (EXACT Contacts-style architecture)

import { renderRelDetails } from "./tab-details.js";

export async function renderRelList(container, portalState) {
  try {
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

          <button id="rel-applyFilter" class="secondary">Apply Filter</button>
          <button id="rel-clearFilter" class="secondary">Clear</button>
        </div>

        <div id="relTable">(apply filter to load)</div>
      </section>
    `;

    const tableDiv = container.querySelector("#relTable");
    const typeSelect = document.getElementById("rel-contactType");

    /* -------------------------------------------------------
       INTERNAL STATE (MATCHES CONTACTS TAB)
    ------------------------------------------------------- */
    let currentSortField = "full_name";
    let currentSortDirection = "asc";
    let rows = []; // in-memory dataset

    /* -------------------------------------------------------
       SORTING ENGINE
    ------------------------------------------------------- */
    function sortRows() {
      const sorted = [...rows];

      sorted.sort((a, b) => {
        const field = currentSortField;

        // numeric sort
        if (field === "relationship_count") {
          const A = Number(a[field] || 0);
          const B = Number(b[field] || 0);
          return currentSortDirection === "asc" ? A - B : B - A;
        }

        // string sort
        const A = (a[field] || "").toLowerCase();
        const B = (b[field] || "").toLowerCase();
        return currentSortDirection === "asc"
          ? A.localeCompare(B)
          : B.localeCompare(A);
      });

      return sorted;
    }

    /* -------------------------------------------------------
       NOTES-STYLE SORT ARROWS
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
              <tr>
                <td>${r.full_name}</td>
                <td>${r.email || ""}</td>
                <td>${r.contact_type || ""}</td>
                <td>${r.relationship_count || 0}</td>
                <td><button class="btn-primary rel-select-btn" data-id="${r.contact_id}">Select</button></td>
              </tr>`
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

          renderSortedTable();
        });
      });

      /* -------------------------------------------------------
         SELECT BUTTON HANDLER (FIXED)
      ------------------------------------------------------- */
      tableDiv.querySelectorAll(".rel-select-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.id;

          // Save selected contact ID
          portalState.selectedContactId = id;

          // Fetch contact details to get the display name
          const res = await fetch(
            `https://contacts-module.dennis-e64.workers.dev/contacts/details/${id}`,
            { cache: "no-cache" }
          );
          const data = await res.json();
          const contact = Array.isArray(data) ? data[0] : data;

          portalState.selectedContactName =
            contact.search_name ||
            `${contact.first_name || ""} ${contact.last_name || ""}`.trim();

          // Switch to Details subtab
          document
            .querySelectorAll("#relationships-subtabs button")
            .forEach((b) => b.classList.remove("active"));

          const detailsBtn = document.querySelector(
            '#relationships-subtabs button[data-subtab="details"]'
          );
          if (detailsBtn) detailsBtn.classList.add("active");

          // Render the Details tab
          const content = document.getElementById("relationshipsContent");
          await renderRelDetails(content, portalState);
        });
      });
    }

    /* -------------------------------------------------------
       LOAD DATA FROM WORKER
    ------------------------------------------------------- */
    async function loadList() {
      tableDiv.innerHTML = `<p class="muted">Loading…</p>`;

      const url = new URL(
        "https://relationships-topview.dennis-e64.workers.dev/relationships/list"
      );
      url.searchParams.set("project", portalState.project);

      const type = typeSelect.value.trim();
      if (type) url.searchParams.set("contact_type", type);

      const res = await fetch(url.toString(), { cache: "no-cache" });
      const data = await res.json();

      rows = Array.isArray(data) ? data : [];
      renderSortedTable();
    }

    /* -------------------------------------------------------
       BUTTON HANDLERS
    ------------------------------------------------------- */
    document
      .getElementById("rel-applyFilter")
      .addEventListener("click", loadList);

    document.getElementById("rel-clearFilter").addEventListener("click", () => {
      typeSelect.value = "";
      rows = [];
      tableDiv.innerHTML = `<p class="muted">Apply a filter to load results.</p>`;
    });
  } catch (err) {
    container.innerHTML = `
      <h4>Relationships</h4>
      <p>Error: ${err.message}</p>
    `;
  }
}
