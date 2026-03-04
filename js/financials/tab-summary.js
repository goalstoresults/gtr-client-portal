// financials/tab-summary.js
// Summary tab: grouped financial summaries with sorting + totals

import { escapeHtml } from "../utilities.js";

/* =========================================================
   ENTRY POINT: Render Summary Tab
========================================================= */

export async function renderFinancialSummary(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h3>Financial Summary</h3>

      <div id="summaryFilters" style="margin-bottom: 12px;">
        <label>Summary Type:</label>
        <select id="summaryType">
          <option value="client">By Client</option>
          <option value="referral">By Referral</option>
          <option value="year">By Year</option>
          <option value="year_client">By Year + Client</option>
          <option value="year_referral">By Year + Referral</option>
          <option value="group">By Group</option>
          <option value="group_year">By Group + Year</option>
        </select>

        <label style="margin-left: 20px;">Year:</label>
        <select id="summaryYear">
          <option value="all">All</option>
        </select>
      </div>

      <div id="summaryGrid"></div>
    </section>
  `;

  await loadSummaryYears(portalState);
  await loadSummaryData(portalState);

  document.getElementById("summaryType").addEventListener("change", () => {
    loadSummaryData(portalState);
  });

  document.getElementById("summaryYear").addEventListener("change", () => {
    loadSummaryData(portalState);
  });
}

/* =========================================================
   LOAD YEARS (using transaction_year)
========================================================= */

async function loadSummaryYears(portalState) {
  const yearSelect = document.getElementById("summaryYear");

  const res = await fetch(
    `https://financials-module.dennis-e64.workers.dev/payments/list?project=${portalState.project}&limit=2000`,
    { cache: "no-cache" }
  );

  let payments = [];
  try {
    payments = await res.json();
  } catch {
    payments = [];
  }

  const years = new Set();
  for (const p of payments) {
    if (p.transaction_year) {
      years.add(Number(p.transaction_year));
    }
  }

  [...years].sort((a, b) => b - a).forEach(y => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  });
}

/* =========================================================
   LOAD SUMMARY DATA
========================================================= */

async function loadSummaryData(portalState) {
  const type = document.getElementById("summaryType").value;
  const year = document.getElementById("summaryYear").value;

  // Fetch revenue rows (now guaranteed to include transaction_year)
  const payRes = await fetch(
    `https://financials-module.dennis-e64.workers.dev/payments/list?project=${portalState.project}&limit=2000`,
    { cache: "no-cache" }
  );

  let payments = [];
  try {
    payments = await payRes.json();
  } catch {
    payments = [];
  }

  // Fetch contacts (with or without groups)
  const isGroupSummary = type === "group" || type === "group_year";
  const contactsEndpointPath = isGroupSummary
    ? "/contacts/list-with-groups"
    : "/contacts/list";

  const contactsRes = await fetch(
    `https://contacts-module.dennis-e64.workers.dev${contactsEndpointPath}?project=${portalState.project}&limit=2000`,
    { cache: "no-cache" }
  );

  let contacts = [];
  try {
    contacts = await contactsRes.json();
  } catch {
    contacts = [];
  }

  // Build lookup maps
  const nameById = new Map();
  const groupByContactId = new Map();

  for (const c of contacts) {
    nameById.set(
      c.contact_id,
      c.search_name || c.contact_name || c.contact_id
    );

    const groupId = c.group_id || null;
    const groupName = c.group_name || (groupId || "(none)");

    groupByContactId.set(c.contact_id, {
      group_id: groupId,
      group_name: groupName
    });
  }

  // Filter by year (using transaction_year)
  if (year !== "all") {
    payments = payments.filter(p => {
      return String(p.transaction_year) === String(year);
    });
  }

  // Summary selection
  let summaryRows = [];

  switch (type) {
    case "client":
      summaryRows = summarizeByClient(payments, nameById);
      break;

    case "referral":
      summaryRows = summarizeByReferral(payments, nameById);
      break;

    case "year":
      summaryRows = summarizeByYear(payments);
      break;

    case "year_client":
      summaryRows = summarizeByYearClient(payments, nameById);
      break;

    case "year_referral":
      summaryRows = summarizeByYearReferral(payments, nameById);
      break;

    case "group":
      summaryRows = summarizeByGroup(payments, groupByContactId);
      break;

    case "group_year":
      summaryRows = summarizeByGroupYear(payments, groupByContactId);
      break;
  }

  renderSummaryGrid(summaryRows, type);
}

/* =========================================================
   SUMMARY LOGIC (transaction_year-native)
========================================================= */

function summarizeByClient(payments, nameById) {
  const map = new Map();

  for (const p of payments) {
    const key = p.contact_id;
    if (!map.has(key)) {
      map.set(key, {
        client_name: nameById.get(p.contact_id) || "(unknown)",
        referral_name: nameById.get(p.referral_id) || "(none)",
        total_amount: 0,
        count: 0
      });
    }
    const row = map.get(key);
    row.total_amount += Number(p.amount) || 0;
    row.count++;
  }

  return [...map.values()];
}

function summarizeByReferral(payments, nameById) {
  const map = new Map();

  for (const p of payments) {
    const key = p.referral_id;
    if (!map.has(key)) {
      map.set(key, {
        referral_name: nameById.get(p.referral_id) || "(none)",
        total_amount: 0,
        count: 0,
        clients: new Set()
      });
    }
    const row = map.get(key);
    row.total_amount += Number(p.amount) || 0;
    row.count++;
    row.clients.add(p.contact_id);
  }

  return [...map.values()].map(r => ({
    ...r,
    clients: r.clients.size
  }));
}

function summarizeByYear(payments) {
  const map = new Map();

  for (const p of payments) {
    const year = p.transaction_year;
    if (!year) continue;

    if (!map.has(year)) {
      map.set(year, {
        year,
        total_amount: 0,
        count: 0,
        clients: new Set(),
        referrals: new Set()
      });
    }

    const row = map.get(year);
    row.total_amount += Number(p.amount) || 0;
    row.count++;
    row.clients.add(p.contact_id);
    row.referrals.add(p.referral_id);
  }

  return [...map.values()].map(r => ({
    ...r,
    clients: r.clients.size,
    referrals: r.referrals.size
  }));
}

function summarizeByYearClient(payments, nameById) {
  const map = new Map();

  for (const p of payments) {
    const year = p.transaction_year;
    if (!year) continue;

    const key = `${year}-${p.contact_id}`;

    if (!map.has(key)) {
      map.set(key, {
        year,
        client_name: nameById.get(p.contact_id) || "(unknown)",
        referral_name: nameById.get(p.referral_id) || "(none)",
        total_amount: 0,
        count: 0
      });
    }

    const row = map.get(key);
    row.total_amount += Number(p.amount) || 0;
    row.count++;
  }

  return [...map.values()];
}

function summarizeByYearReferral(payments, nameById) {
  const map = new Map();

  for (const p of payments) {
    const year = p.transaction_year;
    if (!year) continue;

    const key = `${year}-${p.referral_id}`;

    if (!map.has(key)) {
      map.set(key, {
        year,
        referral_name: nameById.get(p.referral_id) || "(none)",
        total_amount: 0,
        count: 0
      });
    }

    const row = map.get(key);
    row.total_amount += Number(p.amount) || 0;
    row.count++;
  }

  return [...map.values()];
}

function summarizeByGroup(payments, groupByContactId) {
  const map = new Map();

  for (const p of payments) {
    const groupInfo =
      groupByContactId.get(p.referral_id) || { group_id: null, group_name: "(none)" };

    const key = groupInfo.group_id || "(none)";

    if (!map.has(key)) {
      map.set(key, {
        group_id: groupInfo.group_id,
        group_name: groupInfo.group_name,
        total_amount: 0,
        count: 0,
        clients: new Set(),
        referrals: new Set()
      });
    }

    const row = map.get(key);
    row.total_amount += Number(p.amount) || 0;
    row.count++;
    row.clients.add(p.contact_id);
    row.referrals.add(p.referral_id);
  }

  return [...map.values()].map(r => ({
    ...r,
    clients: r.clients.size,
    referrals: r.referrals.size
  }));
}

function summarizeByGroupYear(payments, groupByContactId) {
  const map = new Map();

  for (const p of payments) {
    const year = p.transaction_year;
    if (!year) continue;

    const groupInfo =
      groupByContactId.get(p.referral_id) || { group_id: null, group_name: "(none)" };

    const key = `${groupInfo.group_id || "(none)"}-${year}`;

    if (!map.has(key)) {
      map.set(key, {
        year,
        group_id: groupInfo.group_id,
        group_name: groupInfo.group_name,
        total_amount: 0,
        count: 0,
        clients: new Set(),
        referrals: new Set()
      });
    }

    const row = map.get(key);
    row.total_amount += Number(p.amount) || 0;
    row.count++;
    row.clients.add(p.contact_id);
    row.referrals.add(p.referral_id);
  }

  return [...map.values()].map(r => ({
    ...r,
    clients: r.clients.size,
    referrals: r.referrals.size
  }));
}

/* =========================================================
   RENDER SUMMARY GRID (SORTABLE)
========================================================= */
function renderSummaryGrid(rows, type) {
  const container = document.getElementById("summaryGrid");
  if (!rows.length) {
    container.innerHTML = "<p>No data found.</p>";
    return;
  }

  const columnSets = {
    client: [
      { key: "expand", label: "" },
      { key: "client_name", label: "Client" },
      { key: "total_amount", label: "Total Amount", numeric: true },
      { key: "count", label: "# of Payments", numeric: true },
      { key: "referral_name", label: "Referral" }
    ],
    referral: [
      { key: "expand", label: "" },
      { key: "referral_name", label: "Referral" },
      { key: "total_amount", label: "Total Amount", numeric: true },
      { key: "count", label: "# of Payments", numeric: true },
      { key: "clients", label: "# of Clients", numeric: true }
    ],
    year: [
      { key: "expand", label: "" },
      { key: "year", label: "Year", numeric: true },
      { key: "total_amount", label: "Total Amount", numeric: true },
      { key: "count", label: "# of Payments", numeric: true },
      { key: "clients", label: "# of Clients", numeric: true },
      { key: "referrals", label: "# of Referrals", numeric: true }
    ],
    year_client: [
      { key: "expand", label: "" },
      { key: "year", label: "Year", numeric: true },
      { key: "client_name", label: "Client" },
      { key: "total_amount", label: "Total Amount", numeric: true },
      { key: "count", label: "# of Payments", numeric: true },
      { key: "referral_name", label: "Referral" }
    ],
    year_referral: [
      { key: "expand", label: "" },
      { key: "year", label: "Year", numeric: true },
      { key: "referral_name", label: "Referral" },
      { key: "total_amount", label: "Total Amount", numeric: true },
      { key: "count", label: "# of Payments", numeric: true }
    ],
    group: [
      { key: "expand", label: "" },
      { key: "group_name", label: "Group" },
      { key: "total_amount", label: "Total Amount", numeric: true },
      { key: "count", label: "# of Payments", numeric: true },
      { key: "clients", label: "# of Clients", numeric: true },
      { key: "referrals", label: "# of Referrals", numeric: true }
    ],
    group_year: [
      { key: "expand", label: "" },
      { key: "year", label: "Year", numeric: true },
      { key: "group_name", label: "Group" },
      { key: "total_amount", label: "Total Amount", numeric: true },
      { key: "count", label: "# of Payments", numeric: true },
      { key: "clients", label: "# of Clients", numeric: true },
      { key: "referrals", label: "# of Referrals", numeric: true }
    ]
  };

  const columns = columnSets[type];

  let currentSortField = columns[1].key;
  let currentSortDirection = "asc";

  function sortRows() {
    rows.sort((a, b) => {
      let A = a[currentSortField];
      let B = b[currentSortField];
      const col = columns.find(c => c.key === currentSortField);

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

  function formatCurrency(n) {
    return Number(n).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function computeTotals(rows, columns) {
    const totals = {};
    for (const col of columns) {
      if (col.numeric && col.key !== "year") {
        totals[col.key] = rows.reduce((sum, r) => {
          return sum + (Number(r[col.key]) || 0);
        }, 0);
      }
    }
    return totals;
  }

  async function loadDetails(row) {
    const year = document.getElementById("summaryYear").value;
    const project = portalState.project;

    let url = `https://financials-module.dennis-e64.workers.dev/payments/details?project=${project}`;

    if (type.includes("client")) url += `&contact_id=${row.contact_id}`;
    if (type.includes("referral")) url += `&referral_id=${row.referral_id}`;
    if (type.includes("group")) url += `&group_id=${row.group_id}`;
    if (year !== "all") url += `&year=${year}`;

    const res = await fetch(url);
    return await res.json();
  }

  function render() {
    sortRows();
    const totals = computeTotals(rows, columns);

    const headerHtml = columns
      .map(col => {
        if (col.key === "expand") return `<th></th>`;
        const isSorted = currentSortField === col.key;
        const upArrow = isSorted && currentSortDirection === "asc" ? "▲" : "△";
        const downArrow = isSorted && currentSortDirection === "desc" ? "▼" : "▽";
        return `
          <th class="sortable" data-field="${col.key}">
            ${col.label}
            <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
              <span class="sort-up">${upArrow}</span>
              <span class="sort-down">${downArrow}</span>
            </span>
          </th>
        `;
      })
      .join("");

    const rowsHtml = rows
      .map((r, i) => {
        const detailRowId = `detail-${i}`;
        return `
          <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f9f9f9"};">
            <td style="width:24px; text-align:center; cursor:pointer;" data-expand="${detailRowId}">▶</td>
            ${columns
              .filter(c => c.key !== "expand")
              .map(col => {
                let val = r[col.key];
                if (col.numeric && col.key === "total_amount") {
                  val = formatCurrency(val);
                }
                return `<td style="${col.numeric ? "text-align:right;" : ""}">${val}</td>`;
              })
              .join("")}
          </tr>
          <tr id="${detailRowId}" style="display:none; background:#f1f5ff;">
            <td colspan="${columns.length}">
              <div class="detail-container" style="padding:10px; font-size:0.9em;">Loading...</div>
            </td>
          </tr>
        `;
      })
      .join("");

    const totalsRowHtml = `
      <tr style="background:#e8f0fe; font-weight:bold;">
        <td></td>
        ${columns
          .filter(c => c.key !== "expand")
          .map(col => {
            if (col.numeric && col.key !== "year") {
              const raw = totals[col.key] || 0;
              const val =
                col.key === "total_amount"
                  ? formatCurrency(raw)
                  : raw.toLocaleString("en-US");
              return `<td style="text-align:right;">${val}</td>`;
            }
            return `<td></td>`;
          })
          .join("")}
      </tr>
    `;

    container.innerHTML = `
      <table class="notes-table" style="width:100%; border-collapse:collapse;">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>
          ${rowsHtml}
          ${totalsRowHtml}
        </tbody>
      </table>
    `;

    container.querySelectorAll("th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.dataset.field;
        if (currentSortField === field) {
          currentSortDirection =
            currentSortDirection === "asc" ? "desc" : "asc";
        } else {
          currentSortField = field;
          currentSortDirection = "asc";
        }
        render();
      });
    });

    container.querySelectorAll("[data-expand]").forEach(cell => {
      cell.addEventListener("click", async () => {
        const id = cell.dataset.expand;
        const rowEl = document.getElementById(id);
        const icon = cell;

        if (rowEl.style.display === "none") {
          icon.textContent = "▼";
          rowEl.style.display = "";
          const index = Number(id.replace("detail-", ""));
          const detailData = await loadDetails(rows[index]);

          const html = `
            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr style="background:#dce6ff;">
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Invoice</th>
                </tr>
              </thead>
              <tbody>
                ${detailData
                  .map(d => {
                    return `
                      <tr>
                        <td>${d.transaction_date}</td>
                        <td style="text-align:right;">${formatCurrency(
                          d.amount
                        )}</td>
                        <td>${d.description || ""}</td>
                        <td>${d.invoice_number || ""}</td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
          `;

          rowEl.querySelector(".detail-container").innerHTML = html;
        } else {
          icon.textContent = "▶";
          rowEl.style.display = "none";
        }
      });
    });
  }

  render();
}



