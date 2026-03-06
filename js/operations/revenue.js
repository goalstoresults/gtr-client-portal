// /js/operations/revenue.js

import { formatCurrency } from "../utilities.js";

export async function loadRevenueTab({ portalState, content }) {
  content.innerHTML = `
<section class="card">
  <h2>Revenue Structure</h2>

  <div style="margin-bottom: 16px;">
    <label for="rev-year-select"><strong>Select Year:</strong></label>
    <select id="rev-year-select"></select>
  </div>

  <div id="rev-grid"></div>
</section>
`;

  const yearSelect = document.getElementById("rev-year-select");
  const grid = document.getElementById("rev-grid");

  // Load available years
  const years = await fetchYears(portalState.project);

  if (Array.isArray(years) && years.length > 0) {
    years.forEach((y) => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    });

    yearSelect.value = years[years.length - 1];
    loadYear(yearSelect.value);
  } else {
    grid.innerHTML = `<p>No revenue data found.</p>`;
  }

  yearSelect.addEventListener("change", () => {
    loadYear(yearSelect.value);
  });

  async function loadYear(year) {
    const data = await fetchMonthlyDetailed(portalState.project, year);
    renderGrid(data);
  }

  // ------------------------------------------------------------
  // RENDER GRID — totals + contacts + arrows + color coding
  // ------------------------------------------------------------
  function renderGrid(data) {
    if (!data || !data.months) {
      grid.innerHTML = `<p>No revenue data available for this year.</p>`;
      return;
    }

    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const headerHtml = months.map((m) => `<th>${m}</th>`).join("");

    // --- Totals row with arrows + color ---
    const totalsRow = months.map((_, idx) => {
      const key = String(idx + 1).padStart(2, "0");
      const prevKey = String(idx).padStart(2, "0");

      const value = data.months[key] || 0;
      const prev = idx === 0 ? null : (data.months[prevKey] || 0);

      let cls = "rev-same";
      let arrow = "";

      if (prev !== null) {
        if (value > prev) {
          cls = "rev-up";
          arrow = " ▲";
        } else if (value < prev) {
          cls = "rev-down";
          arrow = " ▼";
        }
      }

      return `<td class="${cls}">${formatCurrency(value)}${arrow}</td>`;
    }).join("");

    // --- Contact rows with arrows + color ---
    const contactRows = data.contacts
      .map((c) => {
        const monthCells = months.map((_, idx) => {
          const key = String(idx + 1).padStart(2, "0");
          const prevKey = String(idx).padStart(2, "0");

          const value = c.months[key] || 0;
          const prev = idx === 0 ? null : (c.months[prevKey] || 0);

          let cls = "rev-same";
          let arrow = "";

          if (prev !== null) {
            if (value > prev) {
              cls = "rev-up";
              arrow = " ▲";
            } else if (value < prev) {
              cls = "rev-down";
              arrow = " ▼";
            }
          }

          return `<td class="${cls}">${formatCurrency(value)}${arrow}</td>`;
        }).join("");

        return `
        <tr>
          <td>${c.contact_name}</td>
          ${monthCells}
          <td><strong>${formatCurrency(c.total)}</strong></td>
        </tr>
      `;
      })
      .join("");

    grid.innerHTML = `
<table class="notes-table">
  <thead>
    <tr>
      <th>Contact</th>
      ${headerHtml}
      <th>Total</th>
    </tr>
  </thead>

  <tbody>
    <tr class="totals-row">
      <td><strong>Total Revenue</strong></td>
      ${totalsRow}
      <td><strong>${formatCurrency(data.total)}</strong></td>
    </tr>

    ${contactRows}
  </tbody>
</table>
`;
  }
}

// -----------------------------
// API Helpers
// -----------------------------

async function fetchYears(project) {
  try {
    const url = `https://operations-module.dennis-e64.workers.dev/revenue/years?project=${project}`;
    const res = await fetch(url, { cache: "no-cache" });
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch revenue years:", err);
    return [];
  }
}

async function fetchMonthlyDetailed(project, year) {
  try {
    const url = `https://operations-module.dennis-e64.workers.dev/revenue/monthly-detailed?project=${project}&year=${year}`;
    const res = await fetch(url, { cache: "no-cache" });
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch detailed revenue:", err);
    return { months: {}, total: 0, contacts: [] };
  }
}
