import { formatCurrency } from "../utilities.js";

export async function loadRevenueTab({ portalState, content }) {
  content.innerHTML = `
  <section class="card">
    <h2>Revenue Structure</h2>

    <div
      style="
        margin-bottom: 16px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 16px;
      "
    >
      <div>
        <label for="rev-year-select"><strong>Select Year:</strong></label>
        <select id="rev-year-select"></select>
      </div>

      <div id="rev-compare-year-wrap">
        <label for="rev-compare-year-select"><strong>Compare Year:</strong></label>
        <select id="rev-compare-year-select"></select>
      </div>
    </div>

    <div id="rev-yoy"></div>

    <h3 style="margin-top: 20px;">
      Month By Month Revenue — (<span id="rev-year-label"></span>)
    </h3>

    <div id="rev-grid"></div>
  </section>
  `;

  const yearSelect = document.getElementById("rev-year-select");
  const compareYearSelect = document.getElementById("rev-compare-year-select");
  const compareYearWrap = document.getElementById("rev-compare-year-wrap");
  const yearLabel = document.getElementById("rev-year-label");
  const yoyDiv = document.getElementById("rev-yoy");
  const grid = document.getElementById("rev-grid");

  // Load the years for this project once when the Revenue tab opens.
  const yearsResponse = await fetchYears(portalState.project);

  // Ensure values are valid numeric years and sort chronologically.
  const years = Array.isArray(yearsResponse)
    ? yearsResponse
        .map((year) => Number(year))
        .filter((year) => Number.isFinite(year))
        .sort((a, b) => a - b)
    : [];

  if (!years.length) {
    compareYearWrap.style.display = "none";
    grid.innerHTML = `<p>No revenue data found.</p>`;
    return;
  }

  // Populate the primary Select Year dropdown.
  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    yearSelect.appendChild(option);
  });

  // Default to the newest available year.
  yearSelect.value = String(years[years.length - 1]);

  // Populate comparison-year choices and default to Selected Year - 1.
  updateCompareYearOptions(Number(yearSelect.value));

  // Initial Revenue tab load.
  await loadYear({
    selectedYear: Number(yearSelect.value),
    compareYear: getCompareYear()
  });

  // When the primary year changes:
  // - Refresh valid comparison years
  // - Default comparison to selected year - 1 when it exists
  // - Reload comparison and detailed grid
  yearSelect.addEventListener("change", async () => {
    const selectedYear = Number(yearSelect.value);

    updateCompareYearOptions(selectedYear);

    await loadYear({
      selectedYear,
      compareYear: getCompareYear()
    });
  });

  // When the user chooses a different comparison year,
  // reload only the YoY section. The detailed grid still reflects Selected Year.
  compareYearSelect.addEventListener("change", async () => {
    const selectedYear = Number(yearSelect.value);
    const compareYear = getCompareYear();

    await loadComparison({
      selectedYear,
      compareYear
    });
  });

  // ------------------------------------------------------------
  // COMPARE YEAR DROPDOWN
  // ------------------------------------------------------------
  function updateCompareYearOptions(selectedYear) {
    // A comparison year must be older than the selected year.
    const eligibleCompareYears = years.filter((year) => year < selectedYear);

    compareYearSelect.innerHTML = "";

    // No earlier year exists, so hide Compare Year and YoY section.
    if (!eligibleCompareYears.length) {
      compareYearWrap.style.display = "none";
      yoyDiv.innerHTML = "";
      return;
    }

    compareYearWrap.style.display = "";

    eligibleCompareYears.forEach((year) => {
      const option = document.createElement("option");
      option.value = String(year);
      option.textContent = String(year);
      compareYearSelect.appendChild(option);
    });

    const previousCalendarYear = selectedYear - 1;

    // Requirement: default to selected year - 1 if that exact year exists.
    if (eligibleCompareYears.includes(previousCalendarYear)) {
      compareYearSelect.value = String(previousCalendarYear);
      return;
    }

    // If the immediately prior calendar year does not exist but there is
    // historical data, use the closest available prior year.
    compareYearSelect.value = String(
      eligibleCompareYears[eligibleCompareYears.length - 1]
    );
  }

  function getCompareYear() {
    if (compareYearWrap.style.display === "none") {
      return null;
    }

    const compareYear = Number(compareYearSelect.value);

    return Number.isFinite(compareYear) ? compareYear : null;
  }

  // ------------------------------------------------------------
  // LOAD SELECTED YEAR
  // ------------------------------------------------------------
  async function loadYear({ selectedYear, compareYear }) {
    yearLabel.textContent = String(selectedYear);

    // These requests are independent, so run them in parallel.
    // This loads:
    // - one detailed selected-year grid
    // - one lightweight selected-year vs compare-year summary
    const [monthlyData] = await Promise.all([
      fetchMonthlyDetailed(portalState.project, selectedYear),
      loadComparison({ selectedYear, compareYear })
    ]);

    renderGrid(monthlyData);
  }

  // ------------------------------------------------------------
  // LOAD COMPARISON
  // ------------------------------------------------------------
  async function loadComparison({ selectedYear, compareYear }) {
    // No valid older year available; comparison remains hidden.
    if (!compareYear || compareYear >= selectedYear) {
      yoyDiv.innerHTML = "";
      return;
    }

    const yoy = await fetchYoY(
      portalState.project,
      selectedYear,
      compareYear
    );

    renderYoY(yoy, selectedYear, compareYear);
  }

  // ------------------------------------------------------------
  // RENDER YOY BLOCK
  // ------------------------------------------------------------
  function renderYoY(yoy, selectedYear, compareYear) {
    if (!yoy || !yoy.thisYear || !yoy.lastYear) {
      yoyDiv.innerHTML = "";
      return;
    }

    const thisYearData = yoy.thisYear;
    const compareYearData = yoy.lastYear;

    // Do not display a comparison if the selected comparison year
    // has no revenue at all.
    const compareYearHasRevenue = Object.values(compareYearData).some(
      (value) => Number(value) > 0
    );

    if (!compareYearHasRevenue) {
      yoyDiv.innerHTML = "";
      return;
    }

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec"
    ];

    const diffAmt = {};
    const diffPct = {};

    // Preserve your existing display rule:
    // If the selected/current year has no revenue in a month,
    // leave that month's difference cells blank.
    for (let i = 1; i <= 12; i++) {
      const key = String(i).padStart(2, "0");

      const currentAmount = Number(thisYearData[key]) || 0;
      const comparedAmount = Number(compareYearData[key]) || 0;

      if (currentAmount === 0) {
        diffAmt[key] = null;
        diffPct[key] = null;
        continue;
      }

      diffAmt[key] = currentAmount - comparedAmount;

      diffPct[key] =
        comparedAmount === 0
          ? null
          : ((currentAmount - comparedAmount) / comparedAmount) * 100;
    }

    // YTD is calculated only through months in which the selected year
    // currently has revenue. This keeps partial current-year reporting fair.
    let ytdThisYear = 0;
    let ytdCompareYear = 0;

    for (let i = 1; i <= 12; i++) {
      const key = String(i).padStart(2, "0");

      const currentAmount = Number(thisYearData[key]) || 0;
      const comparedAmount = Number(compareYearData[key]) || 0;

      if (currentAmount === 0) {
        continue;
      }

      ytdThisYear += currentAmount;
      ytdCompareYear += comparedAmount;
    }

    const ytdAmt = ytdThisYear - ytdCompareYear;

    const ytdPct =
      ytdCompareYear === 0
        ? null
        : (ytdAmt / ytdCompareYear) * 100;

    // Uses the full-year total supplied by the YoY backend response.
    // Fallback prevents an error if the field is absent.
    const fullCompareYearTotal =
      Number(yoy.totals?.lastYear) || 0;

    const row = (monthData, formatter) =>
      months
        .map((_, index) => {
          const key = String(index + 1).padStart(2, "0");
          const value = Number(monthData[key]) || 0;

          return `<td>${formatter(value)}</td>`;
        })
        .join("");

    yoyDiv.innerHTML = `
    <section class="card" style="margin-bottom: 20px;">
      <h3 style="cursor: pointer;" id="yoy-toggle">
        Year‑Over‑Year Comparison (${selectedYear} vs ${compareYear})
        <span
          id="yoy-hint"
          style="font-weight: normal; font-size: 0.85em; opacity: 0.7;"
        >
          (click to expand)
        </span>
      </h3>

      <div id="yoy-body" style="display: none; margin-top: 12px;">
        <table class="notes-table">
          <thead>
            <tr>
              <th>Metric</th>
              ${months.map((month) => `<th>${month}</th>`).join("")}
              <th>YTD</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td><strong>${selectedYear}</strong></td>
              ${row(thisYearData, (value) => formatCurrency(value))}
              <td><strong>${formatCurrency(ytdThisYear)}</strong></td>
            </tr>

            <tr>
              <td><strong>${compareYear}</strong></td>
              ${row(compareYearData, (value) => formatCurrency(value))}
              <td><strong>${formatCurrency(fullCompareYearTotal)}</strong></td>
            </tr>

            <tr>
              <td><strong>Δ Amount</strong></td>
              ${months
                .map((_, index) => {
                  const key = String(index + 1).padStart(2, "0");
                  const value = diffAmt[key];

                  if (value === null || value === undefined) {
                    return `<td></td>`;
                  }

                  const cssClass =
                    value > 0
                      ? "rev-up"
                      : value < 0
                        ? "rev-down"
                        : "rev-same";

                  const arrow =
                    value > 0
                      ? " ▲"
                      : value < 0
                        ? " ▼"
                        : "";

                  return `
                    <td>
                      <span class="${cssClass}">
                        ${formatCurrency(value)}${arrow}
                      </span>
                    </td>
                  `;
                })
                .join("")}
              <td>
                <strong>${formatCurrency(ytdAmt)}</strong>
              </td>
            </tr>

            <tr>
              <td><strong>Δ Percent</strong></td>
              ${months
                .map((_, index) => {
                  const key = String(index + 1).padStart(2, "0");
                  const value = diffPct[key];

                  if (value === null || value === undefined) {
                    return `<td></td>`;
                  }

                  const cssClass =
                    value > 0
                      ? "rev-up"
                      : value < 0
                        ? "rev-down"
                        : "rev-same";

                  const arrow =
                    value > 0
                      ? " ▲"
                      : value < 0
                        ? " ▼"
                        : "";

                  return `
                    <td>
                      <span class="${cssClass}">
                        ${value.toFixed(1)}%${arrow}
                      </span>
                    </td>
                  `;
                })
                .join("")}
              <td>
                <strong>
                  ${ytdPct === null ? "" : `${ytdPct.toFixed(1)}%`}
                </strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    `;

    const yoyToggle = document.getElementById("yoy-toggle");
    const yoyBody = document.getElementById("yoy-body");
    const yoyHint = document.getElementById("yoy-hint");

    yoyToggle.onclick = () => {
      const isClosed = yoyBody.style.display === "none";

      yoyBody.style.display = isClosed ? "block" : "none";
      yoyHint.textContent = isClosed
        ? "(click to collapse)"
        : "(click to expand)";
    };
  }

  // ------------------------------------------------------------
  // RENDER DETAILED MONTH-BY-MONTH GRID
  // ------------------------------------------------------------
  function renderGrid(data) {
    if (!data || !data.months) {
      grid.innerHTML = `<p>No revenue data available for this year.</p>`;
      return;
    }

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec"
    ];

    const headerHtml = months
      .map((month) => `<th>${month}</th>`)
      .join("");

    const totalsRow = months
      .map((_, index) => {
        const key = String(index + 1).padStart(2, "0");
        const previousKey = String(index).padStart(2, "0");

        const value = Number(data.months[key]) || 0;

        const previousValue =
          index === 0
            ? null
            : Number(data.months[previousKey]) || 0;

        let cssClass = "rev-same";
        let arrow = "";

        if (previousValue !== null) {
          if (value > previousValue) {
            cssClass = "rev-up";
            arrow = " ▲";
          } else if (value < previousValue) {
            cssClass = "rev-down";
            arrow = " ▼";
          }
        }

        return `
          <td class="${cssClass}">
            ${formatCurrency(value)}${arrow}
          </td>
        `;
      })
      .join("");

    const contactRows = (data.contacts || [])
      .map((contact) => {
        const monthCells = months
          .map((_, index) => {
            const key = String(index + 1).padStart(2, "0");
            const previousKey = String(index).padStart(2, "0");

            const value = Number(contact.months?.[key]) || 0;

            const previousValue =
              index === 0
                ? null
                : Number(contact.months?.[previousKey]) || 0;

            let cssClass = "rev-same";
            let arrow = "";

            if (previousValue !== null) {
              if (value > previousValue) {
                cssClass = "rev-up";
                arrow = " ▲";
              } else if (value < previousValue) {
                cssClass = "rev-down";
                arrow = " ▼";
              }
            }

            return `
              <td class="${cssClass}">
                ${formatCurrency(value)}${arrow}
              </td>
            `;
          })
          .join("");

        return `
        <tr>
          <td>${contact.contact_name}</td>
          ${monthCells}
          <td><strong>${formatCurrency(contact.total)}</strong></td>
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

  // ------------------------------------------------------------
  // API HELPERS
  // ------------------------------------------------------------
  async function fetchYears(project) {
    try {
      const url =
        `https://operations-module.dennis-e64.workers.dev/revenue/years` +
        `?project=${encodeURIComponent(project)}`;

      const response = await fetch(url, { cache: "no-cache" });

      if (!response.ok) {
        throw new Error(`Revenue years request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to fetch revenue years:", error);
      return [];
    }
  }

  async function fetchMonthlyDetailed(project, year) {
    try {
      const url =
        `https://operations-module.dennis-e64.workers.dev/revenue/monthly-detailed` +
        `?project=${encodeURIComponent(project)}` +
        `&year=${encodeURIComponent(year)}`;

      const response = await fetch(url, { cache: "no-cache" });

      if (!response.ok) {
        throw new Error(
          `Detailed revenue request failed: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to fetch detailed revenue:", error);

      return {
        months: {},
        total: 0,
        contacts: []
      };
    }
  }

  // Backend requirement:
  //
  // GET /revenue/yoy?project=PROJECT&year=2026&compareYear=2024
  //
  // The backend must use:
  // - year as the selected/current year
  // - compareYear as the selected comparison year
  //
  // It must NOT automatically calculate compareYear = year - 1.
  async function fetchYoY(project, year, compareYear) {
    try {
      const url =
        `https://operations-module.dennis-e64.workers.dev/revenue/yoy` +
        `?project=${encodeURIComponent(project)}` +
        `&year=${encodeURIComponent(year)}` +
        `&compareYear=${encodeURIComponent(compareYear)}`;

      const response = await fetch(url, { cache: "no-cache" });

      if (!response.ok) {
        throw new Error(`YoY revenue request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to fetch YoY revenue:", error);
      return null;
    }
  }
}
