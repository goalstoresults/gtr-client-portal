// inspections/tab-list.js
// List tab: display all inspections for the selected project

import { escapeHtml } from "../utilities.js";

/* =========================================================
   RENDER: Inspections List
========================================================= */
export async function renderInspectionList(container, portalState) {
  const project = portalState?.project;

  if (!project) {
    container.innerHTML = `<p>No project selected.</p>`;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <h3>Inspections – List</h3>
      <div style="margin-bottom:12px;">
        <button id="refreshInspectionList" class="btn-primary">Refresh</button>
      </div>
      <div id="inspectionListGrid"></div>
    </section>
  `;

  document
    .getElementById("refreshInspectionList")
    .addEventListener("click", () => loadInspectionList(project));

  await loadInspectionList(project);
}

/* =========================================================
   LOAD DATA
========================================================= */
async function loadInspectionList(project) {
  const grid = document.getElementById("inspectionListGrid");
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
    grid.innerHTML = `<p style="color:red;">Failed to load inspections.</p>`;
    return;
  }

  renderInspectionTable(grid, rows);
}

/* =========================================================
   RENDER TABLE
========================================================= */
function renderInspectionTable(container, rows) {
  let currentSortField = "inspection_date";
  let currentSortDirection = "desc";

  const columns = [
    { key: "inspection_date", label: "Date", isDate: true },
    { key: "client_name", label: "Client" },
    { key: "agent_name", label: "Agent" },
    { key: "inspector1_name", label: "Inspector 1" },
    { key: "inspector2_name", label: "Inspector 2" },
    { key: "inspection_type", label: "Type" },
    { key: "fee_total", label: "Fee", numeric: true }
  ];

  function sortRows() {
    rows.sort((a, b) => {
      let A = a[currentSortField];
      let B = b[currentSortField];

      const col = columns.find((c) => c.key === currentSortField);

      if (col?.isDate) {
        A = new Date(A);
        B = new Date(B);
      } else if (col?.numeric) {
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
            id="insp-${row.inspection_id}"
            style="background:${i % 2 === 0 ? "#ffffff" : "#f9f9f9"};"
            onclick="toggleInspectionDetails('${row.inspection_id}')"
          >
            <td>${escapeHtml(row.inspection_date || "")}</td>
            <td>${escapeHtml(row.client_name || "(none)")}</td>
            <td>${escapeHtml(row.agent_name || "(none)")}</td>
            <td>${escapeHtml(row.inspector1_name || "(none)")}</td>
            <td>${escapeHtml(row.inspector2_name || "(none)")}</td>
            <td>${escapeHtml(row.inspection_type || "")}</td>
            <td>${escapeHtml((Number(row.fee_total) || 0).toFixed(2))}</td>
          </tr>

          <tr id="details-${row.inspection_id}" style="display:none; background:#f7f7f7;">
            <td colspan="7" style="padding:12px;">
              <div><strong>Address:</strong> ${escapeHtml(row.address_full || "")}</div>
              <div><strong>City:</strong> ${escapeHtml(row.city || "")}</div>
              <div><strong>State:</strong> ${escapeHtml(row.state || "")}</div>
              <div><strong>Zip:</strong> ${escapeHtml(row.postal_code || "")}</div>
              <div><strong>Order ID:</strong> ${escapeHtml(row.order_id || "")}</div>
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
   TOGGLE DETAILS ROW
========================================================= */
window.toggleInspectionDetails = function (id) {
  const row = document.getElementById(`details-${id}`);
  if (!row) return;

  row.style.display = row.style.display === "none" ? "table-row" : "none";
};
