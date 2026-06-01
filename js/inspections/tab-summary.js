// inspections/tab-summary.js
// Summary tab: yearly inspection totals + drill-down details

import { escapeHtml } from "../utilities.js";

/* =========================================================
   RENDER: Summary Tab
========================================================= */
export async function renderInspectionSummary(container, portalState) {
  const project = portalState?.project;

  if (!project) {
    container.innerHTML = `<p>No project selected.</p>`;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <h3>Inspections – Summary</h3>

      <div style="margin-bottom:12px;">
        <button id="refreshInspectionSummary" class="btn-primary">Refresh</button>
      </div>

      <div id="inspectionSummaryGrid"></div>
    </section>
  `;

  document
    .getElementById("refreshInspectionSummary")
    .addEventListener("click", () => loadInspectionSummary(project));

  await loadInspectionSummary(project);
}

/* =========================================================
   LOAD SUMMARY DATA
========================================================= */
async function loadInspectionSummary(project) {
  const grid = document.getElementById("inspectionSummaryGrid");
  if (!grid) return;

  grid.innerHTML = `<p>Loading...</p>`;

  const url =
    `https://inspections-module.dennis-e64.workers.dev/inspections/list?project=${encodeURIComponent(
      project
    )}`;

  let rows = [];
  try {
    const res = await fetch(url);
    rows = await res.json();
  } catch (err) {
    console.error("Failed to load inspections:", err);
    grid.innerHTML = `<p style="color:red;">Failed to load summary.</p>`;
    return;
  }

  const summary = buildYearSummary(rows);
  renderSummaryTable(grid, summary, project);
}

/* =========================================================
   BUILD YEAR SUMMARY
========================================================= */
function buildYearSummary(rows) {
  const summary = {};

  for (const row of rows) {
    if (!row.inspection_date) continue;

    const year = new Date(row.inspection_date).getFullYear();
    if (!summary[year]) {
      summary[year] = {
        year,
        count: 0,
        total_fees: 0
      };
    }

    summary[year].count++;
    summary[year].total_fees += Number(row.fee_total || 0);
  }

  return Object.values(summary).sort((a, b) => b.year - a.year);
}

/* =========================================================
   RENDER SUMMARY TABLE
========================================================= */
function renderSummaryTable(container, rows, project) {
  let currentSortField = "year";
  let currentSortDirection = "desc";

  const columns = [
    { key: "year", label: "Year", numeric: true },
    { key: "count", label: "Count", numeric: true },
    { key: "total_fees", label: "Total Fees", numeric: true }
  ];

  function sortRows() {
    rows.sort((a, b) => {
      let A = a[currentSortField];
      let B = b[currentSortField];

      if (typeof A === "string") A = A.toLowerCase();
      if (typeof B === "string") B = B.toLowerCase();

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
            id="sum-${row.year}"
            style="background:${i % 2 === 0 ? "#ffffff" : "#f9f9f9"};"
            onclick="toggleInspectionSummaryDetails('${project}', '${row.year}')"
          >
            <td>${escapeHtml(row.year)}</td>
            <td>${escapeHtml(row.count)}</td>
            <td>${escapeHtml((Number(row.total_fees) || 0).toFixed(2))}</td>
          </tr>

          <tr id="sum-details-${row.year}" style="display:none; background:#f7f7f7;">
            <td colspan="3" style="padding:12px;">
              <div id="sum-details-content-${row.year}">Loading...</div>
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
   LOAD DETAILS FOR A YEAR
========================================================= */
window.toggleInspectionSummaryDetails = async function (project, year) {
  const row = document.getElementById(`sum-details-${year}`);
  const content = document.getElementById(`sum-details-content-${year}`);

  if (!row || !content) return;

  const isOpen = row.style.display !== "none";
  row.style.display = isOpen ? "none" : "table-row";
  if (isOpen) return;

  content.innerHTML = "Loading...";

  const url =
    `https://inspections-module.dennis-e64.workers.dev/inspections/details?project=${encodeURIComponent(
      project
    )}&year=${encodeURIComponent(year)}`;

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
    content.innerHTML = `<p>No inspections found for ${year}.</p>`;
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
