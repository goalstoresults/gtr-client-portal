// /js/filter/run.js
// Main Filter Tab — updated order:
// 1) Run By
// 2) Filter Name
// 3) Neighborhoods
// 4) Square Footage
// (rest unchanged)

import { escapeHtml } from "../utilities.js";

export async function renderRunFilter(container, portalState) {
  container.innerHTML = `
    <section class="card">

      <h3>Filter Criteria</h3>

      <!-- ⭐ Run By FIRST -->
      <div style="margin-bottom:16px;">
        <label>
          Run By
          <input id="filter-runby" type="text" readonly value="${portalState.contact_name || ''}">
        </label>
      </div>

      <!-- ⭐ Filter Name SECOND -->
      <div style="margin-bottom:16px;">
        <label>
          Filter Name (optional)
          <input id="filter-name" type="text" placeholder="e.g. Bryant Park — Q4 Outreach">
        </label>
      </div>

      <!-- ⭐ Neighborhoods THIRD -->
      <div style="margin-bottom:16px;">
        <label>
          Neighborhoods
          <select id="filter-nh" multiple></select>
        </label>
        <div class="mini-buttons">
          <button id="nh-select-all" type="button">Select All</button>
          <button id="nh-clear" type="button">Clear</button>
        </div>
      </div>

      <!-- ⭐ Square Footage FOURTH -->
      <div style="margin-bottom:16px;">
        <label>
          Square Footage
          <select id="filter-sqft" multiple></select>
        </label>
        <div class="mini-buttons">
          <button id="sqft-select-all" type="button">Select All</button>
          <button id="sqft-clear" type="button">Clear</button>
        </div>
      </div>

      <!-- ⭐ Additional Filter Options -->
      <div style="margin-bottom:16px;">
        <label>
          <input type="checkbox" id="filter-noemail">
          Show contacts with no emails in the last
        </label>
        <input id="filter-noemail-days" type="number" value="30" min="1" max="3650" style="width:80px;">
        days
      </div>

      <div style="margin-bottom:16px;">
        <label>
          <input type="checkbox" id="filter-hotleads">
          Include Hot Leads
        </label>
      </div>

      <div style="margin-bottom:16px;">
        <label>
          <input type="checkbox" id="filter-customers">
          Include Customers
        </label>
      </div>

      <button id="filter-run" class="primary">Run Filter</button>

      <div id="filter-status" class="mini-label" style="margin-top:16px;"></div>

      <table class="notes-table" id="filter-table" style="display:none; margin-top:16px;">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Neighborhood</th>
            <th>SqFt</th>
            <th>Lead Level</th>
            <th>Type</th>
            <th>Last Email</th>
          </tr>
        </thead>
        <tbody id="filter-body"></tbody>
      </table>

    </section>
  `;

  // ------------------------------------------------------------
  // Initialize Choices.js
  // ------------------------------------------------------------
  const nhSelect = new Choices("#filter-nh", {
    removeItemButton: true,
    searchEnabled: true,
    shouldSort: false
  });

  const sqftSelect = new Choices("#filter-sqft", {
    removeItemButton: true,
    searchEnabled: true,
    shouldSort: false
  });

  // ------------------------------------------------------------
  // Load Lookups
  // ------------------------------------------------------------
  const LOOKUP_URL = "https://filter-module.dennis-e64.workers.dev/lookups";

  try {
    const res = await fetch(LOOKUP_URL);
    const data = await res.json();

    const neighborhoods = data.neighborhoods || [];
    const sqft = data.square_footage || [];

    nhSelect.setChoices(
      neighborhoods.map(n => ({ value: n, label: n })),
      "value",
      "label",
      false
    );

    sqftSelect.setChoices(
      sqft.map(s => ({ value: s, label: s })),
      "value",
      "label",
      false
    );
  } catch (err) {
    console.error("Lookup load error:", err);
  }

  // ------------------------------------------------------------
  // Select All / Clear Buttons
  // ------------------------------------------------------------
  document.getElementById("nh-select-all").onclick = () => {
    nhSelect.setChoiceByValue(nhSelect._currentState.choices.map(c => c.value));
  };
  document.getElementById("nh-clear").onclick = () => nhSelect.clearStore();

  document.getElementById("sqft-select-all").onclick = () => {
    sqftSelect.setChoiceByValue(sqftSelect._currentState.choices.map(c => c.value));
  };
  document.getElementById("sqft-clear").onclick = () => sqftSelect.clearStore();

  // ------------------------------------------------------------
  // Run Filter
  // ------------------------------------------------------------
  document.getElementById("filter-run").onclick = async () => {
    const status = document.getElementById("filter-status");
    const table = document.getElementById("filter-table");
    const body = document.getElementById("filter-body");

    status.textContent = "";
    table.style.display = "none";
    body.innerHTML = "";

    const neighborhoods = nhSelect.getValue(true);
    const square_footage = sqftSelect.getValue(true);
    const runBy = document.getElementById("filter-runby").value.trim();
    const filterName = document.getElementById("filter-name").value.trim();

    const applyNoEmail = document.getElementById("filter-noemail").checked;
    const noEmailDays = parseInt(document.getElementById("filter-noemail-days").value || "30", 10);

    const includeHotLeads = document.getElementById("filter-hotleads").checked;
    const includeCustomers = document.getElementById("filter-customers").checked;

    if (!neighborhoods.length || !square_footage.length) {
      status.textContent = "Please select neighborhoods and square footage.";
      return;
    }

    status.textContent = "Running filter…";

    const payload = {
      neighborhoods,
      square_footage,
      includeHotLeads,
      includeCustomers,
      applyNoEmail,
      noEmailDays
    };

    try {
      const res = await fetch("https://filter-module.dennis-e64.workers.dev/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`);

      const results = data.results || [];

      if (!results.length) {
        status.textContent = "No matching contacts found.";
        return;
      }

      body.innerHTML = results
        .map(r => `
          <tr>
            <td>${escapeHtml(r.first_name || "")} ${escapeHtml(r.last_name || "")}</td>
            <td>${escapeHtml(r.email || "")}</td>
            <td>${escapeHtml(r.neighborhood || "")}</td>
            <td>${escapeHtml(r.square_footage || "")}</td>
            <td>${escapeHtml(r.lead_level || "")}</td>
            <td>${escapeHtml(r.type || "")}</td>
            <td>${escapeHtml(r.last_email_date || "")}</td>
          </tr>
        `)
        .join("");

      table.style.display = "";
      status.textContent = `Found ${results.length} contacts.`;

      // ------------------------------------------------------------
      // Log Run
      // ------------------------------------------------------------
      await fetch("https://filter-module.dennis-e64.workers.dev/log-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_label: runBy,
          filter_name: filterName,
          neighborhoods,
          square_footage,
          result_count: results.length
        })
      });

    } catch (err) {
      status.textContent = "Error: " + err.message;
    }
  };
}
