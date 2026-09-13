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

    <div id="rev-paying-contacts-yoy"></div>

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
  const payingContactsYoyDiv = document.getElementById(
    "rev-paying-contacts-yoy"
  );

  const grid = document.getElementById("rev-grid");

  // ------------------------------------------------------------
  // LOAD AVAILABLE YEARS
  // ------------------------------------------------------------
  const yearsResponse = await fetchYears(portalState.project);

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

  // Populate Select Year dropdown.
  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    yearSelect.appendChild(option);
  });

  // Default primary year to the newest year available.
  yearSelect.value = String(years[years.length - 1]);

  // Populate Compare Year options and apply default selection.
  updateCompareYearOptions(Number(yearSelect.value));

  // Initial page load.
  await loadYear({
    selectedYear: Number(yearSelect.value),
    compareYear: getCompareYear()
  });

  // ------------------------------------------------------------
  // EVENT LISTENERS
  // ------------------------------------------------------------
  yearSelect.addEventListener("change", async () => {
    const selectedYear = Number(yearSelect.value);

    // Rebuild eligible prior-year choices.
    updateCompareYearOptions(selectedYear);

    await loadYear({
      selectedYear,
      compareYear: getCompareYear()
    });
  });

  compareYearSelect.addEventListener("change", async () => {
    await loadComparison({
      selectedYear: Number(yearSelect.value),
      compareYear: getCompareYear()
    });
  });

  // ------------------------------------------------------------
  // COMPARE-YEAR DROPDOWN
  // ------------------------------------------------------------
  function updateCompareYearOptions(selectedYear) {
    // Only earlier years can be comparison years.
    const eligibleCompareYears = years.filter((year) => year < selectedYear);

    compareYearSelect.innerHTML = "";

    // No earlier year exists, so do not show comparison controls or tables.
    if (!eligibleCompareYears.length) {
      compareYearWrap.style.display = "none";
      yoyDiv.innerHTML = "";
      payingContactsYoyDiv.innerHTML = "";
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

    // Default to exactly Selected Year - 1 if it exists.
    if (eligibleCompareYears.includes(previousCalendarYear)) {
      compareYearSelect.value = String(previousCalendarYear);
      return;
    }

    // Otherwise choose the closest older available year.
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
  // LOAD SELECTED-YEAR DATA
  // ------------------------------------------------------------
  async function loadYear({ selectedYear, compareYear }) {
    yearLabel.textContent = String(selectedYear);

    // Both operations are independent:
    // 1. Detailed per-contact selected-year grid
    // 2. Compact revenue + paying-contact comparison data
    const [monthlyData] = await Promise.all([
      fetchMonthlyDetailed(portalState.project, selectedYear),
      loadComparison({ selectedYear, compareYear })
    ]);

    renderGrid(monthlyData);
  }

  // ------------------------------------------------------------
  // LOAD REVENUE + PAYING-CONTACT COMPARISON
  // ------------------------------------------------------------
  async function loadComparison({ selectedYear, compareYear }) {
    if (!compareYear || compareYear >= selectedYear) {
      yoyDiv.innerHTML = "";
      payingContactsYoyDiv.innerHTML = "";
      return;
    }

    const yoy = await fetchYoY(
      portalState.project,
      selectedYear,
      compareYear
    );

    // Revenue comparison table.
    renderYoY(yoy, selectedYear, compareYear);

    // New Paying Contacts comparison table.
    renderPayingContactsYoY(yoy, selectedYear, compareYear);
  }

  // ------------------------------------------------------------
  // RENDER REVENUE YOY BLOCK
  // ------------------------------------------------------------
  function renderYoY(yoy, selectedYear, compareYear) {
    if (!yoy || !yoy.thisYear || !yoy.lastYear) {
      yoyDiv.innerHTML = "";
      return;
    }

    const thisYearData = yoy.thisYear;
    const compareYearData = yoy.lastYear;

    const compareYearHasRevenue = Object.values(compareYearData).some(
      (value) => Number(value) > 0
    );

    if (!compareYearHasRevenue) {
      yoyDiv.innerHTML = "";
      return;
    }

    const months = getMonths();

    const diffAmt = {};
    const diffPct = {};

    for (let i = 1; i <= 12; i++) {
      const key = String(i).padStart(2, "0");

      const currentAmount = Number(thisYearData[key]) || 0;
      const comparedAmount = Number(compareYearData[key]) || 0;

      // Keep future/no-current-year-revenue comparison cells blank.
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
      <h3 style="cursor: pointer;" id="revenue-yoy-toggle">
        Year‑Over‑Year Revenue Comparison (${selectedYear} vs ${compareYear})
        <span
          id="revenue-yoy-hint"
          style="font-weight: normal; font-size: 0.85em; opacity: 0.7;"
        >
          (click to expand)
        </span>
      </h3>

      <div id="revenue-yoy-body" style="display: none; margin-top: 12px;">
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

                  return `<td>${renderTrendCurrency(value)}</td>`;
                })
                .join("")}
              <td><strong>${formatCurrency(ytdAmt)}</strong></td>
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

                  return `<td>${renderTrendPercent(value)}</td>`;
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

    attachToggle({
      toggleId: "revenue-yoy-toggle",
      bodyId: "revenue-yoy-body",
      hintId: "revenue-yoy-hint"
    });
  }

  // ------------------------------------------------------------
  // RENDER PAYING CONTACTS YOY BLOCK
  // ------------------------------------------------------------
  function renderPayingContactsYoY(yoy, selectedYear, compareYear) {
    const payingContacts = yoy?.payingContacts;

    if (
      !payingContacts ||
      !payingContacts.thisYear ||
      !payingContacts.lastYear ||
      !payingContacts.thisYear.months ||
      !payingContacts.lastYear.months
    ) {
      payingContactsYoyDiv.innerHTML = "";
      return;
    }

    const thisYearMonths = payingContacts.thisYear.months;
    const compareYearMonths = payingContacts.lastYear.months;

    const compareYearHasPayingContacts = Object.values(
      compareYearMonths
    ).some((value) => Number(value) > 0);

    // If comparison year has no contacts with payments, hide this table.
    if (!compareYearHasPayingContacts) {
      payingContactsYoyDiv.innerHTML = "";
      return;
    }

    const months = getMonths();

    const diffContacts = {};
    const diffPct = {};

    for (let i = 1; i <= 12; i++) {
      const key = String(i).padStart(2, "0");

      const selectedYearCount = Number(thisYearMonths[key]) || 0;
      const compareYearCount = Number(compareYearMonths[key]) || 0;

      // Match the revenue comparison convention:
      // future/no-payment months in selected year remain blank in change rows.
      if (selectedYearCount === 0) {
        diffContacts[key] = null;
        diffPct[key] = null;
        continue;
      }

      diffContacts[key] = selectedYearCount - compareYearCount;

      diffPct[key] =
        compareYearCount === 0
          ? null
          : ((selectedYearCount - compareYearCount) / compareYearCount) * 100;
    }

    // These are unique contact counts across the matching YTD period,
    // calculated by the backend with Sets to prevent repeat-client double counting.
    const ytdThisYear =
      Number(payingContacts.thisYear.ytdUnique) || 0;

    const ytdCompareYear =
      Number(payingContacts.lastYear.ytdUnique) || 0;

    const ytdDiff = ytdThisYear - ytdCompareYear;

    const ytdPct =
      ytdCompareYear === 0
        ? null
        : (ytdDiff / ytdCompareYear) * 100;

    const row = (monthData) =>
      months
        .map((_, index) => {
          const key = String(index + 1).padStart(2, "0");
          const value = Number(monthData[key]) || 0;

          return `<td>${value}</td>`;
        })
        .join("");

    payingContactsYoyDiv.innerHTML = `
    <section class="card" style="margin-bottom: 20px;">
      <h3 style="cursor: pointer;" id="paying-contacts-yoy-toggle">
        Year‑Over‑Year Paying Contacts (${selectedYear} vs ${compareYear})
        <span
          id="paying-contacts-yoy-hint"
          style="font-weight: normal; font-size: 0.85em; opacity: 0.7;"
        >
          (click to expand)
        </span>
      </h3>

      <div
        id="paying-contacts-yoy-body"
        style="display: none; margin-top: 12px;"
      >
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
              ${row(thisYearMonths)}
              <td><strong>${ytdThisYear}</strong></td>
            </tr>

            <tr>
              <td><strong>${compareYear}</strong></td>
              ${row(compareYearMonths)}
              <td><strong>${ytdCompareYear}</strong></td>
            </tr>

            <tr>
              <td><strong>Δ Paying Contacts</strong></td>
              ${months
                .map((_, index) => {
                  const key = String(index + 1).padStart(2, "0");
                  const value = diffContacts[key];

                  if (value === null || value === undefined) {
                    return `<td></td>`;
                  }

                  return `<td>${renderTrendCount(value)}</td>`;
                })
                .join("")}
              <td><strong>${renderTrendCount(ytdDiff)}</strong></td>
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

                  return `<td>${renderTrendPercent(value)}</td>`;
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

    attachToggle({
      toggleId: "paying-contacts-yoy-toggle",
      bodyId: "paying-contacts-yoy-body",
      hintId: "paying-contacts-yoy-hint"
    });
  }

  // ------------------------------------------------------------
  // REUSABLE DISPLAY HELPERS
  // ------------------------------------------------------------
  function getMonths() {
    return [
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
  }

  function getTrendClass(value) {
    if (value > 0) return "rev-up";
    if (value < 0) return "rev-down";
    return "rev-same";
  }

  function getTrendArrow(value) {
    if (value > 0) return " ▲";
    if (value < 0) return " ▼";
    return "";
  }

  function renderTrendCurrency(value) {
    const cssClass = getTrendClass(value);
    const arrow = getTrendArrow(value);

    return `
      <span class="${cssClass}">
        ${formatCurrency(value)}${arrow}
      </span>
    `;
  }

  function renderTrendCount(value) {
    const cssClass = getTrendClass(value);
    const arrow = getTrendArrow(value);

    return `
      <span class="${cssClass}">
        ${value}${arrow}
      </span>
    `;
  }

  function renderTrendPercent(value) {
    const cssClass = getTrendClass(value);
    const arrow = getTrendArrow(value);

    return `
      <span class="${cssClass}">
        ${value.toFixed(1)}%${arrow}
      </span>
    `;
  }

  function attachToggle({ toggleId, bodyId, hintId }) {
    const toggle = document.getElementById(toggleId);
    const body = document.getElementById(bodyId);
    const hint = document.getElementById(hintId);

    if (!toggle || !body || !hint) {
      return;
    }

    toggle.onclick = () => {
      const isClosed = body.style.display === "none";

      body.style.display = isClosed ? "block" : "none";

      hint.textContent = isClosed
        ? "(click to collapse)"
        : "(click to expand)";
    };
  }

  // ------------------------------------------------------------
  // RENDER DETAILED MONTH-BY-MONTH REVENUE GRID
  // ------------------------------------------------------------
  function renderGrid(data) {
    if (!data || !data.months) {
      grid.innerHTML = `<p>No revenue data available for this year.</p>`;
      return;
    }

    const months = getMonths();

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
