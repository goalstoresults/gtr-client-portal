import { formatCurrency } from "../utilities.js";

export async function loadRevenueTab({ portalState, content }) {

content.innerHTML = `
<section class="card">
  <h2>Revenue Structure</h2>

  <div style="margin-bottom: 16px;">
    <label for="rev-year-select"><strong>Select Year:</strong></label>
    <select id="rev-year-select"></select>
  </div>

  <div id="rev-yoy"></div>

  <div id="rev-grid"></div>
</section>
`;

const yearSelect = document.getElementById("rev-year-select");
const yoyDiv = document.getElementById("rev-yoy");
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

// ------------------------------------------------------------
// LOAD YEAR (YoY + Detailed Grid)
// ------------------------------------------------------------
async function loadYear(year) {
  const yoy = await fetchYoY(portalState.project, year);
  renderYoY(yoy);

  const data = await fetchMonthlyDetailed(portalState.project, year);
  renderGrid(data);
}

// ------------------------------------------------------------
// RENDER YOY BLOCK
// ------------------------------------------------------------
function renderYoY(yoy) {
  if (!yoy || !yoy.thisYear) {
    yoyDiv.innerHTML = "";
    return;
  }

  const months = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ];

  const thisY = yoy.thisYear;
  const lastY = yoy.lastYear;

  const diffAmt = {};
  const diffPct = {};

  for (let i = 1; i <= 12; i++) {
    const key = String(i).padStart(2, "0");
    const a = thisY[key] || 0;
    const b = lastY[key] || 0;

    diffAmt[key] = a - b;
    diffPct[key] = b === 0 ? null : ((a - b) / b) * 100;
  }

  const row = (label, obj, formatter) =>
    months
      .map((_, idx) => {
        const key = String(idx + 1).padStart(2, "0");
        return `<td>${formatter(obj[key])}</td>`;
      })
      .join("");

  yoyDiv.innerHTML = `
  <section class="card" style="margin-bottom: 20px;">
    <h3 style="cursor:pointer;" id="yoy-toggle">
      Year‑Over‑Year Comparison (${yoy.year} vs ${yoy.year - 1})
    </h3>

    <div id="yoy-body" style="display:none; margin-top:12px;">
      <table class="notes-table">
        <thead>
          <tr>
            <th>Metric</th>
            ${months.map(m => `<th>${m}</th>`).join("")}
            <th>YTD</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td><strong>This Year</strong></td>
            ${row("This", thisY, v => formatCurrency(v))}
            <td><strong>${formatCurrency(yoy.totals.thisYear)}</strong></td>
          </tr>

          <tr>
            <td><strong>Last Year</strong></td>
            ${row("Last", lastY, v => formatCurrency(v))}
            <td><strong>${formatCurrency(yoy.totals.lastYear)}</strong></td>
          </tr>

          <tr>
            <td><strong>Δ Amount</strong></td>
            ${row("Diff", diffAmt, v => {
              const cls = v > 0 ? "rev-up" : v < 0 ? "rev-down" : "rev-same";
              const arrow = v > 0 ? " ▲" : v < 0 ? " ▼" : "";
              return `<span class="${cls}">${formatCurrency(v)}${arrow}</span>`;
            })}
            <td><strong>${formatCurrency(yoy.totals.thisYear - yoy.totals.lastYear)}</strong></td>
          </tr>

          <tr>
            <td><strong>Δ Percent</strong></td>
            ${row("Pct", diffPct, v => {
              if (v === null) return `<span class="rev-same">—</span>`;
              const cls = v > 0 ? "rev-up" : v < 0 ? "rev-down" : "rev-same";
              const arrow = v > 0 ? " ▲" : v < 0 ? " ▼" : "";
              return `<span class="${cls}">${v.toFixed(1)}%${arrow}</span>`;
            })}
            <td><strong>${
              yoy.totals.lastYear === 0
                ? "—"
                : ((yoy.totals.thisYear - yoy.totals.lastYear) / yoy.totals.lastYear * 100).toFixed(1) + "%"
            }</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
  `;

  // Toggle
  document.getElementById("yoy-toggle").onclick = () => {
    const body = document.getElementById("yoy-body");
    body.style.display = body.style.display === "none" ? "block" : "none";
  };
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
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ];

  const headerHtml = months.map((m) => `<th>${m}</th>`).join("");

  // Totals row
  const totalsRow = months
    .map((_, idx) => {
      const key = String(idx + 1).padStart(2, "0");
      const prevKey = String(idx).padStart(2, "0");

      const value = data.months[key] || 0;
      const prev = idx === 0 ? null : (data.months[prevKey] || 0);

      let cls = "rev-same";
      let arrow = "";

      if (prev !== null) {
        if (value > prev) { cls = "rev-up"; arrow = " ▲"; }
        else if (value < prev) { cls = "rev-down"; arrow = " ▼"; }
      }

      return `<td class="${cls}">${formatCurrency(value)}${arrow}</td>`;
    })
    .join("");

  // Contact rows
  const contactRows = data.contacts
    .map((c) => {
      const monthCells = months
        .map((_, idx) => {
          const key = String(idx + 1).padStart(2, "0");
          const prevKey = String(idx).padStart(2, "0");

          const value = c.months[key] || 0;
          const prev = idx === 0 ? null : (c.months[prevKey] || 0);

          let cls = "rev-same";
          let arrow = "";

          if (prev !== null) {
            if (value > prev) { cls = "rev-up"; arrow = " ▲"; }
            else if (value < prev) { cls = "rev-down"; arrow = " ▼"; }
          }

          return `<td class="${cls}">${formatCurrency(value)}${arrow}</td>`;
        })
        .join("");

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

async function fetchYoY(project, year) {
  try {
    const url = `https://operations-module.dennis-e64.workers.dev/revenue/yoy?project=${project}&year=${year}`;
    const res = await fetch(url, { cache: "no-cache" });
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch YoY:", err);
    return null;
  }
}

}
