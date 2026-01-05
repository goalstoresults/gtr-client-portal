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

  // Load available years from operations-module
  const years = await fetchYears(portalState.project);

  if (Array.isArray(years) && years.length > 0) {
    years.forEach(y => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    });

    // Default to latest year
    yearSelect.value = years[years.length - 1];
    loadYear(yearSelect.value);
  } else {
    grid.innerHTML = `<p>No revenue data found.</p>`;
  }

  yearSelect.addEventListener("change", () => {
    loadYear(yearSelect.value);
  });

  async function loadYear(year) {
    const data = await fetchMonthlyRevenue(portalState.project, year);
    renderGrid(data);
  }

  function renderGrid(data) {
    if (!data || !data.months) {
      grid.innerHTML = `<p>No revenue data available for this year.</p>`;
      return;
    }

    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Metric</th>
            ${months.map(m => `<th>${m}</th>`).join("")}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Total Revenue</strong></td>
            ${months.map((_, idx) => {
              const key = String(idx + 1).padStart(2, "0");
              return `<td>${formatCurrency(data.months[key] || 0)}</td>`;
            }).join("")}
            <td><strong>${formatCurrency(data.total)}</strong></td>
          </tr>
        </tbody>
      </table>
    `;

    grid.innerHTML = html;
  }
}

// -----------------------------
// API Helpers
// -----------------------------

async function fetchYears(project) {
  try {
    const res = await fetch(
      `https://groups-module.dennis-e64.workers.dev/revenue/years?project=${project}`,
      { cache: "no-cache" }
    );
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch revenue years:", err);
    return [];
  }
}

async function fetchMonthlyRevenue(project, year) {
  try {
    const res = await fetch(
      `https://groups-module.dennis-e64.workers.dev/revenue/monthly?project=${project}&year=${year}`,
      { cache: "no-cache" }
    );
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch monthly revenue:", err);
    return { months: {}, total: 0 };
  }
}
