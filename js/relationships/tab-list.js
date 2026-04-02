// /js/relationships/tab-list.js
// Relationships — List View (REAL VERSION)

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

      // Build table
      let html = `
        <div class="goals-scroll-container">
          <table class="notes-table goals-table" style="margin-top:12px;">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Contact Type</th>
                <th>Relationships</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
      `;

      rows.forEach(row => {
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

      // Wire up Select buttons (placeholder for now)
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
