// /js/filter/neighborhoods.js
// Neighborhood Drill‑Down — Phase 1 parity with cleaner UI + Choices.js

import { escapeHtml, formatDateOnly } from "../utilities.js";

export async function renderFilterNeighborhoods(container, portalState) {

  // ------------------------------------------------------------
  // Initialize sort state (NEW)
  // ------------------------------------------------------------
  if (!portalState.filterNeighborhoodSort) {
    portalState.filterNeighborhoodSort = {
      column: "label",
      direction: "asc"
    };
  }

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
          <tr id="drill-header-row">
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

      let items = Array.isArray(data.items) ? data.items : [];

      if (!items.length) {
        status.textContent = `No runs for "${neighborhood}" in last ${data.window_days ?? days} days.`;
        return;
      }

      // ------------------------------------------------------------
      // SORTING SYSTEM (NEW)
      // ------------------------------------------------------------
      function sortItems() {
        const { column, direction } = portalState.filterNeighborhoodSort;

        items.sort((a, b) => {
          let A = a[column];
          let B = b[column];

          if (column === "last_used") {
            A = A ? new Date(A) : 0;
            B = B ? new Date(B) : 0;
          } else if (column === "runs") {
            A = Number(A) || 0;
            B = Number(B) || 0;
          } else {
            A = (A || "").toString().toLowerCase();
            B = (B || "").toString().toLowerCase();
          }

          if (A < B) return direction === "asc" ? -1 : 1;
          if (A > B) return direction === "asc" ? 1 : -1;
          return 0;
        });
      }

      function renderDrillTable() {
        sortItems();

        const headerConfig = [
          { key: "label", label: "SqFt Range" },
          { key: "runs", label: "Runs" },
          { key: "last_used", label: "Last Used" }
        ];

        const headerHtml = headerConfig
          .map(col => {
            const isSorted = portalState.filterNeighborhoodSort.column === col.key;
            const up = isSorted && portalState.filterNeighborhoodSort.direction === "asc" ? "▲" : "△";
            const down = isSorted && portalState.filterNeighborhoodSort.direction === "desc" ? "▼" : "▽";

            return `
              <th class="sortable" data-field="${col.key}">
                ${col.label}
                <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                  <span>${up}</span>
                  <span>${down}</span>
                </span>
              </th>
            `;
          })
          .join("");

        document.getElementById("drill-header-row").innerHTML = headerHtml;

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

        // Sorting events
        document.querySelectorAll("th.sortable").forEach(th => {
          th.addEventListener("click", () => {
            const field = th.dataset.field;

            if (portalState.filterNeighborhoodSort.column === field) {
              portalState.filterNeighborhoodSort.direction =
                portalState.filterNeighborhoodSort.direction === "asc" ? "desc" : "asc";
            } else {
              portalState.filterNeighborhoodSort.column = field;
              portalState.filterNeighborhoodSort.direction = "asc";
            }

            renderDrillTable();
          });
        });
      }

      // Initial render
      renderDrillTable();

      table.style.display = "";
      status.textContent = `Showing ${items.length} range(s) for "${neighborhood}".`;

    } catch (err) {
      status.textContent = "Error: " + err.message;
    }
  };
}
