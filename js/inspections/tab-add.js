// inspections/tab-add.js
// Inspections → Add tab (Financials-style contact picker + bulk buttons)

import {
  openInspectionBulkUpload,
  renderInspectionStaging
} from "./tab-add-staging.js";

const PORTAL_API_BASE = "https://client-portal-api.dennis-e64.workers.dev";
const INSPECTIONS_API_BASE = "https://inspections-module.dennis-e64.workers.dev";

export function renderInspectionAdd(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h2>Inspections – Add Inspection</h2>

      <div class="filter-row">
        <label>First:
          <input type="text" id="inspFilterFirst" />
        </label>

        <label>Last:
          <input type="text" id="inspFilterLast" />
        </label>

        <label>Business:
          <input type="text" id="inspFilterBusiness" />
        </label>

        <label>Contact Type:
          <select id="inspFilterType">
            <option value="ALL">ALL</option>
            <option value="Client">Client</option>
            <option value="Agent">Agent</option>
            <option value="Other">Other</option>
          </select>
        </label>

        <button id="inspApplyFilter" class="primary">Apply Filter</button>
        <button id="inspClearFilter">Clear Filter</button>
      </div>

      <div id="inspContactResults" class="results-grid">
        <p>(no contacts found)</p>
      </div>

      <div class="bulk-actions" style="margin-top:16px; display:flex; gap:8px;">
        <button id="inspReviewBulk" class="secondary">Review Bulk Data</button>
        <button id="inspAddBulk" class="primary">Add Bulk</button>
        <button id="inspAutoMatchAll" class="secondary">Auto-Match All</button>
      </div>
    </section>
  `;

  const firstInput = container.querySelector("#inspFilterFirst");
  const lastInput = container.querySelector("#inspFilterLast");
  const businessInput = container.querySelector("#inspFilterBusiness");
  const typeSelect = container.querySelector("#inspFilterType");
  const applyBtn = container.querySelector("#inspApplyFilter");
  const clearBtn = container.querySelector("#inspClearFilter");
  const resultsDiv = container.querySelector("#inspContactResults");

  applyBtn.addEventListener("click", loadContacts);

  clearBtn.addEventListener("click", () => {
    firstInput.value = "";
    lastInput.value = "";
    businessInput.value = "";
    typeSelect.value = "ALL";
    resultsDiv.innerHTML = `<p>(no contacts found)</p>`;
  });

  async function loadContacts() {
    resultsDiv.innerHTML = `<p>Loading…</p>`;

    const payload = {
      project: portalState.project,
      first: firstInput.value.trim() || null,
      last: lastInput.value.trim() || null,
      business: businessInput.value.trim() || null,
      contact_type: typeSelect.value === "ALL" ? null : typeSelect.value
    };

    const res = await fetch(`${PORTAL_API_BASE}/api/contacts/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    let data;
    try {
      data = await res.json();
    } catch {
      resultsDiv.innerHTML = `<p style="color:red;">Error parsing contacts response.</p>`;
      return;
    }

    if (!res.ok) {
      resultsDiv.innerHTML = `<p style="color:red;">${data.error || "Error loading contacts."}</p>`;
      return;
    }

    if (!Array.isArray(data) || !data.length) {
      resultsDiv.innerHTML = `<p>(no contacts found)</p>`;
      return;
    }

    resultsDiv.innerHTML = `
      <table class="results-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Business</th>
            <th>Email</th>
            <th>Mobile</th>
          </tr>
        </thead>
        <tbody>
          ${data
            .map(
              c => `
            <tr>
              <td>${c.first_name || ""} ${c.last_name || ""}</td>
              <td>${c.business_name || ""}</td>
              <td>${c.email || ""}</td>
              <td>${c.mobile || ""}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  // Bulk buttons
  const reviewBulkBtn = container.querySelector("#inspReviewBulk");
  const addBulkBtn = container.querySelector("#inspAddBulk");
  const autoMatchAllBtn = container.querySelector("#inspAutoMatchAll");

  reviewBulkBtn.addEventListener("click", () => {
    renderInspectionStaging(container, portalState);
  });

  addBulkBtn.addEventListener("click", () => {
    openInspectionBulkUpload(container, portalState);
  });

  autoMatchAllBtn.addEventListener("click", async () => {
    autoMatchAllBtn.disabled = true;
    autoMatchAllBtn.textContent = "Auto-Matching…";

    const res = await fetch(
      `${INSPECTIONS_API_BASE}/staging/auto-match-all?project=${encodeURIComponent(
        portalState.project
      )}`,
      { method: "POST" }
    );

    let data;
    try {
      data = await res.json();
    } catch {
      autoMatchAllBtn.disabled = false;
      autoMatchAllBtn.textContent = "Auto-Match All";
      alert("Error parsing auto-match response.");
      return;
    }

    autoMatchAllBtn.disabled = false;
    autoMatchAllBtn.textContent = "Auto-Match All";

    if (!res.ok) {
      alert(data.error || "Error running auto-match.");
      return;
    }

    alert(
      `Auto-match complete.\nMatched: ${data.matched || data.ready || 0}`
    );
    renderInspectionStaging(container, portalState);
  });
}

