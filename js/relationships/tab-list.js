// /js/relationships/tab-list.js
// Relationships — List View (FULL VERSION with sorting)

export async function renderRelList(container, portalState) {
  const project = portalState.project;

  // Initial UI shell
  container.innerHTML = `
    <section class="card">
      <h3 style="margin-bottom:12px;">Relationships — List View</h3>

      <!-- FILTER BAR -->
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
        <label style="font-weight:bold;">Contact Type:</label>
        <select id="rel-contactType" class="form-control" style="width:200px;">
          <option value="">ALL</option>
          <option value="client">Client</option>
          <option value="vendor">Vendor</option>
          <option value="attorney">Attorney</option>
          <option value="spouse">Spouse</option>
          <option value="child">Child</option>
          <option value="lead">Lead</option>
          <option value="new_contact">New Contact</option>
        </select>

        <button id="rel-applyFilter" class="btn-primary">Apply Filter</button>
        <button id="rel-clearFilter" class="btn-secondary">Clear</button>
      </div>

      <!-- RESULTS -->
      <div id="rel-results">
        <p class="muted">Apply a filter to load results.</p>
      </div>
    </section>
  `;

  const typeSelect = document.getElementById("rel-contactType");
  const applyBtn = document.getElementById("rel-applyFilter");
  const clearBtn = document.getElementById("rel-clearFilter");
  const resultsDiv = document.getElementById("rel-results");

  // ------------------------------------------------------------
  // SORTING STATE
  // ------------------------------------------------------------
  let currentSortField = "full_name";
  let currentSortDirection = "asc";

  function sortRows(rows) {
    const sorted = [...rows];

    sorted.sort((a, b) => {
      const field = currentSortField;

      let valA = a[field];
      let valB = b[field];

      // Numeric sort for relationship_count
      if (field === "relationship_count") {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return currentSortDirection === "asc" ? valA - valB : valB - valA;
      }

      // String sort for everything else
      valA = (valA || "").toString().toLowerCase();
      valB = (valB || "").toString().toLowerCase();

      return currentSortDirection === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });

    return sorted;
  }

  // ------------------------------------------------------------
  // LOAD LIST FUNCTION
  // ------------------------------------------------------------
  async function loadList() {
    const contactType = typeSelect.value.trim();

    resultsDiv.innerHTML = `
      <section class="card loader">
        <p>Loading relationships...</p>
      </section>
    `;

    try {
      const url = new URL("https://relationships-topview.dennis-e64.workers.dev/relationships/list");
      url.searchParams.set("project", project);
      if (contactType) url.searchParams.set("contact_type", contactType);

      const res = await fetch(url.toString(), { cache: "no-cache" });
      const rows = await res.json();

      if (!Array.isArray(rows) || rows.length === 0) {
        resultsDiv.innerHTML = `
          <section class="card">
            <p>No contacts found for this filter.</p>
          </section>
        `;
        return;
      }

      const sortedRows = sortRows(rows);

      // Build table
      let html = `
        <div class="goals-scroll-container">
          <table class="notes-table goals-table" style="margin-top:12px;">
            <thead>
              <tr>
                <th class="sortable" data-field="full_name">
                  Full Name
                  <span class="sort-arrow">${currentSortField === "full_name" ? (currentSortDirection === "asc" ? "▲" : "▼") : ""}</span>
                </th>

                <th class="sortable" data-field="email">
                  Email
                  <span class="sort-arrow">${currentSortField === "email" ? (currentSortDirection === "asc" ? "▲" : "▼") : ""}</span>
                </th>

                <th class="sortable" data-field="contact_type">
                  Contact Type
                  <span class="sort-arrow">${currentSortField === "contact_type" ? (currentSortDirection === "asc" ? "▲" : "▼") : ""}</span>
                </th>

                <th class="sortable" data-field="relationship_count">
                  Relationships
                  <span class="sort-arrow">${currentSortField === "relationship_count" ? (currentSortDirection === "asc" ? "▲" : "▼") : ""}</span>
                </th>

                <th>Action</th>
              </tr>
            </thead>
            <tbody>
      `;

      sortedRows.forEach(row => {
        const fullName = row.full_name || row.search_name || "Unknown";
        const email = row.email || "";
        const type = row.contact_type || "";
        const count = row.relationship_count || 0;

        html += `
          <tr>
            <td>${fullName}</td>
            <td>${email}</td>
            <td>${type}</td>
            <td>${count}</td>
            <td>
              <button class="btn-primary rel-select-btn" data-id="${row.contact_id}">
                Select
              </button>
            </td>
          </tr>
        `;
      });

      html += `
            </tbody>
          </table>
        </div>
      `;

      resultsDiv.innerHTML = html;

      // ------------------------------------------------------------
      // SORTING CLICK HANDLERS
      // ------------------------------------------------------------
      document.querySelectorAll("th.sortable").forEach(th => {
        th.addEventListener("click", () => {
          const field = th.dataset.field;

          if (currentSortField === field) {
            currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
          } else {
            currentSortField = field;
            currentSortDirection = "asc";
          }

          loadList(); // reload + re-sort
        });
      });

      // ------------------------------------------------------------
      // SELECT BUTTONS
      // ------------------------------------------------------------
      document.querySelectorAll(".rel-select-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          resultsDiv.innerHTML = `
            <section class="card">
              <p>Details view coming soon for contact: <strong>${id}</strong></p>
            </section>
          `;
        });
      });

    } catch (err) {
      resultsDiv.innerHTML = `
        <section class="card error">
          <p>Error loading data.</p>
        </section>
      `;
    }
  }

  // ------------------------------------------------------------
  // BUTTON HANDLERS
  // ------------------------------------------------------------
  applyBtn.addEventListener("click", loadList);

  clearBtn.addEventListener("click", () => {
    typeSelect.value = "";
    resultsDiv.innerHTML = `
      <p class="muted">Apply a filter to load results.</p>
    `;
  });
}
