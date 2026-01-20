// js/groups/tab-list.js
// GROUP LIST TAB — Year-aware, View-powered, Option A

import { renderGroupDetails } from "./tab-details.js";
import { escapeHtml, formatCurrency, formatDateTime } from "../utilities.js";

export async function renderGroupList(container, portalState) {
  if (!portalState.project) {
    container.innerHTML = `<section class="card"><p>No project selected.</p></section>`;
    return;
  }

  // Load available years + default year
  const yearRes = await fetch(
    `https://groups-module.dennis-e64.workers.dev/groups/years?project=${portalState.project}`,
    { cache: "no-cache" }
  );
  const { years = [], defaultYear = "all" } = await yearRes.json();

  // Initialize selected year
  if (!portalState.groupsListYear) {
    portalState.groupsListYear = defaultYear;
  }

  const prevName = portalState.groupsListFilter || "";

  container.innerHTML = `
    <section class="card">
      <h2>Groups for ${
        escapeHtml(
          portalState.projects_config?.business_name ||
          portalState.display_name ||
          portalState.project
        )
      }</h2>

      <div style="margin-bottom:12px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        
        <label>Year:
          <select id="groups-year-select">
            <option value="all">All</option>
            ${years
              .map(
                y => `<option value="${y}" ${
                  y == portalState.groupsListYear ? "selected" : ""
                }>${y}</option>`
              )
              .join("")}
          </select>
        </label>

        <label>Name:
          <input type="text" id="filter-group-name" value="${escapeHtml(prevName)}" />
        </label>

        <button id="btnApplyGroupsFilter" class="btn-secondary">Apply Filter</button>
        <button id="btnClearGroupsFilter" class="btn-secondary">Clear Filter</button>
      </div>

      <div id="groupTable">Loading...</div>
    </section>
  `;

  const tableDiv = container.querySelector("#groupTable");

  // Fetch year-aware ROI list
  const listUrl = `https://groups-module.dennis-e64.workers.dev/groups/roi-list?project=${portalState.project}&year=${portalState.groupsListYear}`;
  const res = await fetch(listUrl, { cache: "no-cache" });

  let groups = await res.json();
  if (!Array.isArray(groups)) groups = groups.rows || [];
  if (!Array.isArray(groups)) groups = [];

  // Apply name filter
  if (prevName && prevName.length >= 3) {
    const term = prevName.toLowerCase();
    groups = groups.filter(g => (g.group_name || "").toLowerCase().includes(term));
  }

  // Sorting state
  let currentSortField = "group_name";
  let currentSortDirection = "asc";

  const columns = [
    { key: "group_name", label: "Name" },
    { key: "fee_amount", label: "Fees", numeric: true },
    { key: "referral_amount", label: "Revenue", numeric: true },
    { key: "roi", label: "ROI (%)", numeric: true },
    { key: "created_at", label: "Created" }
  ];

  function sortGroups() {
    groups.sort((a, b) => {
      let A = a[currentSortField];
      let B = b[currentSortField];

      if (A == null) A = "";
      if (B == null) B = "";

      if (columns.find(c => c.key === currentSortField)?.numeric) {
        const numA = Number(A) || 0;
        const numB = Number(B) || 0;
        return currentSortDirection === "asc" ? numA - numB : numB - numA;
      }

      const strA = String(A).toLowerCase();
      const strB = String(B).toLowerCase();

      return currentSortDirection === "asc"
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
  }

function renderTable() {
  sortGroups();

  // --- TOTALS CALCULATION ---
  const totalFees = groups.reduce((sum, g) => sum + Number(g.fee_amount || 0), 0);
  const totalRevenue = groups.reduce((sum, g) => sum + Number(g.referral_amount || 0), 0);

  let totalRoiDisplay;
  if (totalFees === 0 && totalRevenue > 0) {
    totalRoiDisplay = "N/A";
  } else if (totalFees > 0) {
    totalRoiDisplay = ((totalRevenue / totalFees) * 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + "%";
  } else {
    totalRoiDisplay = "0.00%";
  }

  // --- HEADER ---
  const headerHtml = columns
    .map(col => {
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

  // --- ROWS ---
  const rowsHtml = groups
    .map(g => {
      let roiDisplay;
      if (g.roi === null) {
        roiDisplay = "N/A";
      } else {
        roiDisplay = (Number(g.roi) * 100).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }) + "%";
      }

      return `
      <tr>
        <td>${escapeHtml(g.group_name || "")}</td>
        <td class="amount">${formatCurrency(g.fee_amount)}</td>
        <td class="amount">${formatCurrency(g.referral_amount)}</td>
        <td class="amount">${roiDisplay}</td>
        <td>${formatDateTime(g.created_at)}</td>
        <td><button class="btn-primary btn-select" data-id="${g.group_id}">Select</button></td>
      </tr>
    `;
    })
    .join("");

  // --- TOTALS FOOTER ---
  const totalsFooter = `
    <tfoot>
      <tr style="font-weight:bold; background:#f7f7f7;">
        <td>Total</td>
        <td class="amount">${formatCurrency(totalFees)}</td>
        <td class="amount">${formatCurrency(totalRevenue)}</td>
        <td class="amount">${totalRoiDisplay}</td>
        <td></td>
        <td></td>
      </tr>
    </tfoot>
  `;

  // --- FINAL TABLE ---
  tableDiv.innerHTML = `
    <h4>Showing ${groups.length} ${
    prevName ? "filtered" : portalState.groupsListYear === "all" ? "groups" : "active groups"
  }</h4>

    <table class="notes-table">
      <thead>
        <tr>
          ${headerHtml}
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${
          rowsHtml ||
          `<tr><td colspan="6">(no groups found for this year)</td></tr>`
        }
      </tbody>
      ${totalsFooter}
    </table>
  `;

  // Sorting
  tableDiv.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const field = th.dataset.field;
      if (currentSortField === field) {
        currentSortDirection =
          currentSortDirection === "asc" ? "desc" : "asc";
      } else {
        currentSortField = field;
        currentSortDirection = "asc";
      }
      renderTable();
    });
  });

  // Select buttons
  tableDiv.querySelectorAll(".btn-select").forEach(btn => {
    btn.addEventListener("click", async () => {
      const groupId = btn.dataset.id;
      const group = groups.find(g => g.group_id === groupId);

      portalState.selectedGroupId = groupId;
      portalState.selectedGroupName = group?.group_name || "";

      const contextBar = document.getElementById("groups-context-bar");
      if (contextBar) {
        contextBar.textContent = portalState.selectedGroupName
          ? `Group: ${portalState.selectedGroupName}`
          : "No group selected";
      }

      const buttons = document.querySelectorAll("#groups-subtabs button");
      buttons.forEach(b => b.classList.remove("active"));
      const detailsBtn = document.querySelector(
        '#groups-subtabs button[data-subtab="details"]'
      );
      if (detailsBtn) detailsBtn.classList.add("active");

      const content = document.querySelector("#groupsContent");
      await renderGroupDetails(content, portalState, groupId);
    });
  });
}
} // end renderGroupList
