// /js/filter/neighborhoods.js
// Neighborhood Drill‑Down — Phase 1 parity with cleaner UI + Choices.js

import { escapeHtml, formatDateOnly } from "../utilities.js";

export async function renderFilterNeighborhoods(container, portalState) {
  container.innerHTML = `
    <section class="card">

      <h3>Neighborhood Drill‑Down</h3>

      <div class="inline" style="flex-wrap:wrap; gap:16px; margin-bottom:16px;">

        <label>
          Neighborhood
          <select id="drill-nh"></select>
        </label>

        <label>
          Past
          <input type="number" id="drill-days" value="30" min="1" max="3650" style="width:80px;">
          days
        </label>

        <button id="drill-load" class="primary">Show Used SqFt</button>

      </div>

      <div id="drill-status" class="mini-label" style="margin-bottom:12px;"></div>

      <table class="notes-table" id="drill-table" style="display:none;">
        <thead>
          <tr>
            <th>SqFt Range</th>
            <th>Runs</th>
            <th>Last Used</th>
          </tr>
        </thead>
        <tbody id="drill-body"></tbody>
      </table>

    </section>
  `;

  // ------------------------------------------------------------
  // Initialize Choices.js for Neighborhood selector
  // ------------------------------------------------------------
  const nhSelect = new Choices("#drill-nh", {
    removeItemButton: false,
    searchEnabled: true,
    shouldSort: false,
    placeholderValue: "Select neighborhood"
  });

  // ------------------------------------------------------------
  // Load Lookups (Neighborhoods only)
  // ------------------------------------------------------------
  const LOOKUP_URL = "https://filter-module.dennis-e64.workers.dev/lookups";

  let NEIGHBORHOODS = [];

  try {
    const res = await fetch(LOOKUP_URL);
    const data = await res.json();

    NEIGHBORHOODS = data.neighborhoods || [];

    nhSelect.setChoices(
      NEIGHBORHOODS.map(n => ({ value: n, label: n })),
      "value",
      "label",
      false
    );
  } catch (err) {
    console.error("Lookup load error:", err);
  }

  // ------------------------------------------------------------
  // Load Drill‑Down Data
  // ------------------------------------------------------------
  document.getElementById("drill-load").onclick = async () => {
    const neighborhood = nhSelect.getValue(true);
    const days = Math.max(
      1,
      Math.min(3650, parseInt(document.getElementById("drill-days").value || "30", 10))
    );

    const status = document.getElementById("drill-status");
    const table = document.getElementById("drill-table");
    const body = document.getElementById("drill-body");

    status.textContent = "";
    table.style.display = "none";
    body.innerHTML = "";

    if (!neighborhood) {
      status.textContent = "Please select a neighborhood.";
      return;
    }

    status.textContent = "Loading…";

    const qs = new URLSearchParams({ neighborhood, days: String(days) });

    try {
      const res = await fetch(
        `https://filter-module.dennis-e64.workers.dev/used-sqft?${qs.toString()}`,
        { headers: { accept: "application/json" } }
      );

      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`);

      const items = Array.isArray(data.items) ? data.items : [];

      if (!items.length) {
        status.textContent = `No runs for "${neighborhood}" in last ${data.window_days ?? days} days.`;
        return;
      }

      body.innerHTML = items
        .map(item => {
          return `
            <tr>
              <td>${escapeHtml(item.label)}</td>
              <td>${item.runs}</td>
              <td>${formatDateOnly(item.last_used)}</td>
            </tr>
          `;
        })
        .join("");

      table.style.display = "";
      status.textContent = `Showing ${items.length} range(s) for "${neighborhood}".`;

    } catch (err) {
      status.textContent = "Error: " + err.message;
    }
  };
}
