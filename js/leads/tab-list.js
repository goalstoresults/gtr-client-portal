// js/leads/tab-list.js

export async function renderLeadsList(container, portalState, updateLeadContextBar) {

  /* ============================================================
     1. BASE UI (CLEAN + MATCHES CONTACTS)
  ============================================================ */

  container.innerHTML = `
    <section class="card">
      <h2>Lead List</h2>

      <div class="filter-row">
        <input type="text" id="leadSearchInput" placeholder="Search leads..." />
        <button id="applyLeadFilterBtn">Apply Filter</button>
        <button id="clearLeadFilterBtn">Clear Filter</button>
        <button id="addLeadBtn" class="btn-primary">Add Lead</button>
      </div>

      <div id="leadListTable">
        <p style="opacity:0.6;">Loading leads…</p>
      </div>
    </section>
  `;

  const tableDiv = document.getElementById("leadListTable");

  /* ============================================================
     2. REAL API CALL — NO MOCKS
     GET /leads/list?project=...
  ============================================================ */

  let rows = [];
  try {
    const endpoint = `https://leads-module.dennis-e64.workers.dev/leads/list?project=${encodeURIComponent(portalState.project)}`;

    const res = await fetch(endpoint, { cache: "no-cache" });
    rows = await res.json();

    if (!Array.isArray(rows)) rows = [];

  } catch (err) {
    console.error("Lead list fetch error:", err);
    tableDiv.innerHTML = `<p style="color:red;">Error loading leads.</p>`;
    return;
  }

  /* ============================================================
     3. RENDER REAL GRID HEADERS (EVEN IF EMPTY)
  ============================================================ */

  let html = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Lead Name</th>
          <th>Contact</th>
          <th>Status</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
  `;

  /* ============================================================
     4. IF NO LEADS, SHOW EMPTY GRID (NOTHING ELSE)
  ============================================================ */

  if (rows.length === 0) {
    html += `
      <tr>
        <td colspan="4" style="text-align:center; opacity:0.6;">
          No leads found.
        </td>
      </tr>
    `;
  } else {
    /* ============================================================
       5. RENDER REAL ROWS
    ============================================================ */

    rows.forEach(lead => {
      html += `
        <tr class="lead-row" data-id="${lead.lead_id}">
          <td>${lead.lead_name || ""}</td>
          <td>${lead.contact_name || ""}</td>
          <td>${lead.status || ""}</td>
          <td>${lead.created_at || ""}</td>
        </tr>
      `;
    });
  }

  html += `
      </tbody>
    </table>
  `;

  tableDiv.innerHTML = html;

  /* ============================================================
     6. CLICK HANDLER — SELECT A LEAD
     (UPDATES BLUE CONTEXT BAR)
  ============================================================ */

  document.querySelectorAll(".lead-row").forEach(row => {
    row.addEventListener("click", () => {

      const leadId = row.dataset.id;
      const lead = rows.find(l => l.lead_id === leadId);
      if (!lead) return;

      // Store in portalState
      portalState.activeLeadId = lead.lead_id;
      portalState.activeLeadName = lead.lead_name;
      portalState.activeLeadContactName = lead.contact_name;

      // Update the blue context bar
      if (typeof updateLeadContextBar === "function") {
        updateLeadContextBar(lead);
      }

      // Highlight selected row
      document.querySelectorAll(".lead-row").forEach(r => r.classList.remove("selected"));
      row.classList.add("selected");
    });
  });

  /* ============================================================
     7. FILTER BUTTONS (SKELETON ONLY)
  ============================================================ */

  document.getElementById("applyLeadFilterBtn").addEventListener("click", () => {
    alert("Lead filter logic coming soon.");
  });

  document.getElementById("clearLeadFilterBtn").addEventListener("click", () => {
    alert("Clear filter logic coming soon.");
  });

  document.getElementById("addLeadBtn").addEventListener("click", () => {
    alert("Add Lead form coming soon.");
  });
}
