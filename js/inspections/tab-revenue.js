// inspections/tab-revenue.js
// Revenue-style summary for inspections (by inspector, agent, or client)

import { escapeHtml } from "../utilities.js";

/* =========================================================
   RENDER: Revenue Summary Tab
========================================================= */
export async function renderInspectionRevenue(container, portalState) {
  const project = portalState?.project;

  if (!project) {
    container.innerHTML = `<p>No project selected.</p>`;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <h3>Inspections – Revenue Summary</h3>

      <div style="margin-bottom:12px; display:flex; gap:12px;">
        <button id="refreshInspectionRevenue" class="btn-primary">Refresh</button>

        <select id="revenueGroupBy" class="form-control" style="width:200px;">
          <option value="inspector">Group by Inspector</option>
          <option value="agent">Group by Agent</option>
          <option value="client">Group by Client</option>
        </select>
      </div>

      <div id="inspectionRevenueGrid"></div>
    </section>
  `;

  document
    .getElementById("refreshInspectionRevenue")
    .addEventListener("click", () => loadInspectionRevenue(project));

  document
    .getElementById("revenueGroupBy")
    .addEventListener("change", () => loadInspectionRevenue(project));

  await loadInspectionRevenue(project);
}

/* =========================================================
   LOAD SUMMARY DATA
========================================================= */
async function loadInspectionRevenue(project) {
  const grid = document.getElementById("inspectionRevenueGrid");
  if (!grid) return;

  grid.innerHTML = `<p>Loading...</p>`;

  const groupBy = document.getElementById("revenueGroupBy")?.value || "inspector";

  const url =
    `https://inspections-module.dennis-e64.workers.dev/inspections/summary?project=${encodeURIComponent(
      project
    )}&groupBy=${groupBy}`;

  let rows = [];
  try {
    const res = await fetch(url);
    rows = await res.json();
  } catch (err) {
    console.error("Failed to load inspection revenue:", err);
    grid.innerHTML = `<p style="color:red;">Failed to load revenue summary.</p>`;
    return;
  }

  renderRevenueTable(grid, rows, groupBy, project);
}

/* =========================================================
   RENDER SUMMARY TABLE
========================================================= */
function renderRevenueTable(container, rows, groupBy, project) {
  let currentSortField = "total_fees";
  let currentSortDirection = "desc";

  const columns = [
    { key: "name", label: groupLabel(groupBy) },
    { key: "count", label: "Count", numeric: true },
    { key: "total_fees", label: "Total Fees", numeric: true }
  ];

  function groupLabel(groupBy) {
    switch (groupBy) {
      case "agent": return "Agent";
      case "client": return "Client";
      default: return "Inspector";
    }
  }

  function sortRows() {
    rows.sort((a, b) => {
      let A = a[currentSortField];
      let B = b[currentSortField];

      const col = columns.find((c) => c.key === currentSortField);

      if (col?.numeric) {
        A = Number(A) || 0;
        B = Number(B) || 0;
      } else {
        A = (A || "").toString().toLowerCase();
        B = (B || "").toString().toLowerCase();
      }

      if (A < B) return currentSortDirection === "asc" ? -1 : 1;
      if (A > B) return currentSortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  function renderTable() {
    sortRows();

    const headerHtml = columns
      .map((col) => {
        const isSorted = currentSortField === col.key;
        const upArrow = isSorted && currentSortDirection === "asc" ? "▲" : "△";
        const downArrow = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

        return `
          <th class="sortable" data-field="${col.key}">
            ${escapeHtml(col.label)}
            <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
              <span class="sort-up">${upArrow}</span>
              <span class="sort-down">${downArrow}</span>
            </span>
          </th>
        `;
      })
      .join("");

    const rowsHtml = rows
      .map((row, i) => {
        return `
          <tr
            id="rev-${row.id}"
            style="background:${i % 2 === 0 ? "#ffffff" : "#f9f9f9"};"
            onclick="loadInspectionRevenueDetails('${project}', '${row.id}', '${groupBy}')"
          >
            <td>${escapeHtml(row.name || "(none)")}</td>
            <td>${escapeHtml(row.count)}</td>
            <td>${escapeHtml((Number(row.total_fees) || 0).toFixed(2))}</td>
          </tr>

          <tr id="rev-details-${row.id}" style="display:none; background:#f7f7f7;">
            <td colspan="3" style="padding:12px;">
              <div id="rev-details-content-${row.id}">Loading...</div>
            </td>
          </tr>
        `;
      })
      .join("");

    container.innerHTML = `
      <table class="notes-table" style="width:100%; border-collapse:collapse;">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;

    container.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const field = th.dataset.field;
        if (currentSortField === field) {
          currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
        } else {
          currentSortField = field;
          currentSortDirection = "asc";
        }
        renderTable();
      });
    });
  }

  renderTable();
}

/* =========================================================
   LOAD DETAILS FOR A SUMMARY ROW
========================================================= */
window.loadInspectionRevenueDetails = async function (project, id, groupBy) {
  const row = document.getElementById(`rev-details-${id}`);
  const content = document.getElementById(`rev-details-content-${id}`);

  if (!row || !content) return;

  // Toggle visibility
  const isOpen = row.style.display !== "none";
  row.style.display = isOpen ? "none" : "table-row";
  if (isOpen) return;

  content.innerHTML = "Loading...";

  const url =
    `https://inspections-module.dennis-e64.workers.dev/inspections/details?project=${encodeURIComponent(
      project
    )}&${groupBy}_id=${encodeURIComponent(id)}`;

  let details = [];
  try {
    const res = await fetch(url);
    details = await res.json();
  } catch (err) {
    console.error("Failed to load details:", err);
    content.innerHTML = `<p style="color:red;">Failed to load details.</p>`;
    return;
  }

  if (!Array.isArray(details) || details.length === 0) {
    content.innerHTML = `<p>No details found.</p>`;
    return;
  }

  const html = details
    .map((d) => {
      return `
        <div style="margin-bottom:10px; padding:8px; border-bottom:1px solid #ddd;">
          <div><strong>Date:</strong> ${escapeHtml(d.inspection_date || "")}</div>
          <div><strong>Type:</strong> ${escapeHtml(d.inspection_type || "")}</div>
          <div><strong>Fee:</strong> ${(Number(d.fee_total) || 0).toFixed(2)}</div>
          <div><strong>Address:</strong> ${escapeHtml(d.address_full || "")}</div>
        </div>
      `;
    })
    .join("");

  content.innerHTML = html;
};
