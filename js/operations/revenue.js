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

  <h3 style="margin-top: 20px;">Month By Month Revenue — (<span id="rev-year-label"></span>)</h3>
  <div id="rev-grid"></div>
</section>
`;

const yearSelect = document.getElementById("rev-year-select");
const yearLabel = document.getElementById("rev-year-label");
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
  yearLabel.textContent = year;

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

  // Month-specific differences only
  for (let i = 1; i <= 12; i++) {
    const key = String(i).padStart(2, "0");
    const a = thisY[key] || 0;
    const b = lastY[key] || 0;

    if (a === 0) {
      diffAmt[key] = null;
      diffPct[key] = null;
      continue;
    }

    diffAmt[key] = a - b;
    diffPct[key] = b === 0 ? null : ((a - b) / b) * 100;
  }

  // YTD: only months where current year has revenue
  let ytdThis = 0;
  let ytdLastMatching = 0;

  for (let i = 1; i <= 12; i++) {
    const key = String(i).padStart(2, "0");
    const a = thisY[key] || 0;
    const b = lastY[key] || 0;

    if (a === 0) continue;

    ytdThis += a;
    ytdLastMatching += b;
  }

  const ytdAmt = ytdThis - ytdLastMatching;
  const ytdPct = ytdLastMatching === 0 ? null : (ytdAmt / ytdLastMatching) * 100;

  // FULL YEAR last-year total (for display only)
  const fullLastYearTotal = yoy.totals.lastYear;

  const row = (obj, formatter) =>
    months
      .map((_, idx) => {
        const key = String(idx + 1).padStart(2, "0");
        const val = obj[key];

        if (val === null || val === undefined) return `<td></td>`;
        return `<td>${formatter(val)}</td>`;
      })
      .join("");

  yoyDiv.innerHTML = `
  <section class="card" style="margin-bottom: 20px;">
    <h3 style="cursor:pointer;" id="yoy-toggle">
      Year‑Over‑Year Comparison (${yoy.year} vs ${yoy.year - 1})
      <span id="yoy-hint" style="font-weight: normal; font-size: 0.85em; opacity: 0.7;">
        (click to expand)
      </span>
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
            ${row(thisY, v => formatCurrency(v))}
            <td><strong>${formatCurrency(ytdThis)}</strong></td>
          </tr>

          <tr>
            <td><strong>Last Year</strong></td>
            ${row(lastY, v => formatCurrency(v))}
            <td><strong>${formatCurrency(fullLastYearTotal)}</strong></td>
          </tr>

          <tr>
            <td><strong>Δ Amount</strong></td>
            ${months
              .map((_, idx) => {
                const key = String(idx + 1).padStart(2, "0");
                const v = diffAmt[key];

                if (v === null) return `<td></td>`;

                const cls = v > 0 ? "rev-up" : v < 0 ? "rev-down" : "rev-same";
                const arrow = v > 0 ? " ▲" : v < 0 ? " ▼" : "";

                return `<td><span class="${cls}">${formatCurrency(v)}${arrow}</span></td>`;
              })
              .join("")}
            <td><strong>${formatCurrency(ytdAmt)}</strong></td>
          </tr>

          <tr>
            <td><strong>Δ Percent</strong></td>
            ${months
              .map((_, idx) => {
                const key = String(idx + 1).padStart(2, "0");
                const v = diffPct[key];

                if (v === null) return `<td></td>`;

                const cls = v > 0 ? "rev-up" : v < 0 ? "rev-down" : "rev-same";
                const arrow = v > 0 ? " ▲" : v < 0 ? " ▼" : "";

                return `<td><span class="${cls}">${v.toFixed(1)}%${arrow}</span></td>`;
              })
              .join("")}
            <td><strong>${ytdPct === null ? "" : ytdPct.toFixed(1) + "%"}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
  `;

  // Toggle with hint update
  document.getElementById("yoy-toggle").onclick = () => {
    const body = document.getElementById("yoy-body");
    const hint = document.getElementById("yoy-hint");

    const isClosed = body.style.display === "none";
    body.style.display = isClosed ? "block" : "none";

    hint.textContent = isClosed ? "(click to collapse)" : "(click to expand)";
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

