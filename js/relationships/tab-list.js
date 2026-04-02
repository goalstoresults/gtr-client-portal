// /js/relationships/tab-list.js
// Relationships — List View (EXACT Contacts-style architecture)

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
            <option value="client">Client</option>
            <option value="vendor">Vendor</option>
            <option value="attorney">Attorney</option>
            <option value="spouse">Spouse</option>
            <option value="child">Child</option>
            <option value="lead">Lead</option>
            <option value="new_contact">New Contact</option>
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
       SORTING ENGINE (IDENTICAL TO CONTACTS)
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
       RENDER TABLE (IDENTICAL STRUCTURE TO CONTACTS)
    ------------------------------------------------------- */
    function renderSortedTable() {
      if (!rows.length) {
        tableDiv.innerHTML = `<p class="muted">(no results)</p>`;
        return;
      }

      const sorted = sortRows();

      const arrow = (field) =>
        currentSortField === field
          ? currentSortDirection === "asc"
            ? "▲"
            : "▼"
          : "";

      tableDiv.innerHTML = `
        <table class="notes-table">
          <thead>
            <tr>
              <th class="sortable" data-field="full_name">Full Name ${arrow("full_name")}</th>
              <th class="sortable" data-field="email">Email ${arrow("email")}</th>
              <th class="sortable" data-field="contact_type">Type ${arrow("contact_type")}</th>
              <th class="sortable" data-field="relationship_count">Relationships ${arrow("relationship_count")}</th>
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
         SELECT BUTTONS
      ------------------------------------------------------- */
      tableDiv.querySelectorAll(".rel-select-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          tableDiv.innerHTML = `
            <section class="card">
              <p>Details view coming soon for contact: <strong>${id}</strong></p>
            </section>
          `;
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
