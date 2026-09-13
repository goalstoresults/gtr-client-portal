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

    <div id="rev-average-revenue-yoy"></div>

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

  const averageRevenueYoyDiv = document.getElementById(
    "rev-average-revenue-yoy"
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

  // Default to newest available year.
  yearSelect.value = String(years[years.length - 1]);

  // Populate valid comparison years and apply the default selection.
  updateCompareYearOptions(Number(yearSelect.value));

  // Initial tab load.
  await loadYear({
    selectedYear: Number(yearSelect.value),
    compareYear: getCompareYear()
  });

  // ------------------------------------------------------------
  // EVENT LISTENERS
  // ------------------------------------------------------------
  yearSelect.addEventListener("change", async () => {
    const selectedYear = Number(yearSelect.value);

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
    const eligibleCompareYears = years.filter((year) => year < selectedYear);

    compareYearSelect.innerHTML = "";

    // No older year exists. Hide every comparison block.
    if (!eligibleCompareYears.length) {
      compareYearWrap.style.display = "none";
      yoyDiv.innerHTML = "";
      payingContactsYoyDiv.innerHTML = "";
      averageRevenueYoyDiv.innerHTML = "";
      return;
    }

    compareYearWrap.style.display = "";

    eligibleCompareYears.forEach((year) => {
      const option = document.createElement("option");
      option.value = String(year);
      option.textContent = String(year);
      compareYearSelect.appendChild(option);
    });

    const priorCalendarYear = selectedYear - 1;

    // Default to Selected Year - 1 if that year is available.
    if (eligibleCompareYears.includes(priorCalendarYear)) {
      compareYearSelect.value = String(priorCalendarYear);
      return;
    }

    // Otherwise use the closest available earlier year.
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

    // Both calls are independent and run simultaneously:
    // - Detailed per-contact grid for Select Year
    // - Summary data for all three comparison grids
    const [monthlyData] = await Promise.all([
      fetchMonthlyDetailed(portalState.project, selectedYear),
      loadComparison({ selectedYear, compareYear })
    ]);

    renderGrid(monthlyData);
  }

  // ------------------------------------------------------------
  // LOAD ALL COMPARISON DATA
  // ------------------------------------------------------------
  async function loadComparison({ selectedYear, compareYear }) {
    if (!compareYear || compareYear >= selectedYear) {
      yoyDiv.innerHTML = "";
      payingContactsYoyDiv.innerHTML = "";
      averageRevenueYoyDiv.innerHTML = "";
      return;
    }

    const yoy = await fetchYoY(
      portalState.project,
      selectedYear,
      compareYear
    );

    // One backend response renders all three summary grids.
    renderYoY(yoy, selectedYear, compareYear);
    renderPayingContactsYoY(yoy, selectedYear, compareYear);
    renderAverageRevenueYoY(yoy, selectedYear, compareYear);
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
      const comparisonAmount = Number(compareYearData[key]) || 0;

      // Preserve existing rule: do not show a change in months with
      // no selected-year revenue yet.
      if (currentAmount === 0) {
        diffAmt[key] = null;
        diffPct[key] = null;
        continue;
      }

      diffAmt[key] = currentAmount - comparisonAmount;

      diffPct[key] =
        comparisonAmount === 0
          ? null
          : ((currentAmount - comparisonAmount) / comparisonAmount) * 100;
    }

    let ytdThisYear = 0;
    let ytdCompareYear = 0;

    for (let i = 1; i <= 12; i++) {
      const key = String(i).padStart(2, "0");

      const currentAmount = Number(thisYearData[key]) || 0;
      const comparisonAmount = Number(compareYearData[key]) || 0;

      if (currentAmount === 0) {
        continue;
      }

      ytdThisYear += currentAmount;
      ytdCompareYear += comparisonAmount;
    }

    const ytdAmountDifference = ytdThisYear - ytdCompareYear;

    const ytdPercentDifference =
      ytdCompareYear === 0
        ? null
        : (ytdAmountDifference / ytdCompareYear) * 100;

    const fullCompareYearTotal = Number(yoy.totals?.lastYear) || 0;

    const renderRevenueRow = (monthData) =>
      months
        .map((_, index) => {
          const key = String(index + 1).padStart(2, "0");
          const value = Number(monthData[key]) || 0;

          return `<td>${formatCurrency(value)}</td>`;
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
              ${renderRevenueRow(thisYearData)}
              <td><strong>${formatCurrency(ytdThisYear)}</strong></td>
            </tr>

            <tr>
              <td><strong>${compareYear}</strong></td>
              ${renderRevenueRow(compareYearData)}
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
              <td>
                <strong>${formatCurrency(ytdAmountDifference)}</strong>
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

                  return `<td>${renderTrendPercent(value)}</td>`;
                })
                .join("")}
              <td>
                <strong>
                  ${
                    ytdPercentDifference === null
                      ? ""
                      : `${ytdPercentDifference.toFixed(1)}%`
                  }
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
      !payingContacts.thisYear?.months ||
      !payingContacts.lastYear?.months
    ) {
      payingContactsYoyDiv.innerHTML = "";
      return;
    }

    const thisYearMonths = payingContacts.thisYear.months;
    const compareYearMonths = payingContacts.lastYear.months;

    const compareYearHasPayingContacts = Object.values(
      compareYearMonths
    ).some((value) => Number(value) > 0);

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

      // Keep future/no-payment selected-year months blank in difference rows.
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

    // The backend calculates these using Sets across the matching YTD months,
    // so repeat clients are counted only once in the YTD column.
    const ytdThisYear = Number(payingContacts.thisYear.ytdUnique) || 0;
    const ytdCompareYear = Number(payingContacts.lastYear.ytdUnique) || 0;

    const ytdContactDifference = ytdThisYear - ytdCompareYear;

    const ytdPercentDifference =
      ytdCompareYear === 0
        ? null
        : (ytdContactDifference / ytdCompareYear) * 100;

    const renderContactsRow = (monthData) =>
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
              ${renderContactsRow(thisYearMonths)}
              <td><strong>${ytdThisYear}</strong></td>
            </tr>

            <tr>
              <td><strong>${compareYear}</strong></td>
              ${renderContactsRow(compareYearMonths)}
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
              <td>
                <strong>${renderTrendCount(ytdContactDifference)}</strong>
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

                  return `<td>${renderTrendPercent(value)}</td>`;
                })
                .join("")}
              <td>
                <strong>
                  ${
                    ytdPercentDifference === null
                      ? ""
                      : `${ytdPercentDifference.toFixed(1)}%`
                  }
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
  // RENDER AVERAGE REVENUE PER PAYING CONTACT YOY BLOCK
  // ------------------------------------------------------------
  function renderAverageRevenueYoY(yoy, selectedYear, compareYear) {
    const payingContacts = yoy?.payingContacts;

    if (
      !yoy ||
      !yoy.thisYear ||
      !yoy.lastYear ||
      !payingContacts ||
      !payingContacts.thisYear?.months ||
      !payingContacts.lastYear?.months
    ) {
      averageRevenueYoyDiv.innerHTML = "";
      return;
    }

    const thisYearRevenue = yoy.thisYear;
    const compareYearRevenue = yoy.lastYear;

    const thisYearContacts = payingContacts.thisYear.months;
    const compareYearContacts = payingContacts.lastYear.months;

    const months = getMonths();

    const thisYearAverages = {};
    const compareYearAverages = {};
    const diffAmounts = {};
    const diffPercents = {};

    for (let i = 1; i <= 12; i++) {
      const key = String(i).padStart(2, "0");

      const thisRevenue = Number(thisYearRevenue[key]) || 0;
      const compareRevenue = Number(compareYearRevenue[key]) || 0;

      const thisContacts = Number(thisYearContacts[key]) || 0;
      const compareContacts = Number(compareYearContacts[key]) || 0;

      // A monthly average only exists if one or more contacts paid that month.
      thisYearAverages[key] =
        thisContacts > 0 ? thisRevenue / thisContacts : null;

      compareYearAverages[key] =
        compareContacts > 0 ? compareRevenue / compareContacts : null;

      // Follow the same current-year convention as the other YoY tables:
      // no selected-year revenue/contact activity = blank change cells.
      if (thisContacts === 0 || thisRevenue === 0) {
        diffAmounts[key] = null;
        diffPercents[key] = null;
        continue;
      }

      const thisAverage = thisYearAverages[key];
      const compareAverage = compareYearAverages[key];

      // If comparison year had no paying contacts in the month,
      // an average and percentage comparison cannot be calculated.
      if (compareAverage === null) {
        diffAmounts[key] = null;
        diffPercents[key] = null;
        continue;
      }

      diffAmounts[key] = thisAverage - compareAverage;

      diffPercents[key] =
        compareAverage === 0
          ? null
          : ((thisAverage - compareAverage) / compareAverage) * 100;
    }

    // Use matching YTD revenue and matching-period unique paying-contact counts.
    // Do not average the 12 monthly averages.
    let ytdThisRevenue = 0;
    let ytdCompareRevenue = 0;

    for (let i = 1; i <= 12; i++) {
      const key = String(i).padStart(2, "0");

      const thisRevenue = Number(thisYearRevenue[key]) || 0;
      const compareRevenue = Number(compareYearRevenue[key]) || 0;

      // Match existing revenue YTD calculation:
      // include only months in which the selected year has revenue.
      if (thisRevenue === 0) {
        continue;
      }

      ytdThisRevenue += thisRevenue;
      ytdCompareRevenue += compareRevenue;
    }

    const ytdThisContacts = Number(payingContacts.thisYear.ytdUnique) || 0;
    const ytdCompareContacts = Number(payingContacts.lastYear.ytdUnique) || 0;

    const ytdThisAverage =
      ytdThisContacts > 0
        ? ytdThisRevenue / ytdThisContacts
        : null;

    const ytdCompareAverage =
      ytdCompareContacts > 0
        ? ytdCompareRevenue / ytdCompareContacts
        : null;

    const ytdDifference =
      ytdThisAverage === null || ytdCompareAverage === null
        ? null
        : ytdThisAverage - ytdCompareAverage;

    const ytdPercentDifference =
      ytdDifference === null || ytdCompareAverage === 0
        ? null
        : (ytdDifference / ytdCompareAverage) * 100;

    const renderAverageRow = (averageData) =>
      months
        .map((_, index) => {
          const key = String(index + 1).padStart(2, "0");
          const value = averageData[key];

          return `<td>${value === null ? "" : formatCurrency(value)}</td>`;
        })
        .join("");

    averageRevenueYoyDiv.innerHTML = `
    <section class="card" style="margin-bottom: 20px;">
      <h3 style="cursor: pointer;" id="average-revenue-yoy-toggle">
        Year‑Over‑Year Average Revenue per Paying Contact (${selectedYear} vs ${compareYear})
        <span
          id="average-revenue-yoy-hint"
          style="font-weight: normal; font-size: 0.85em; opacity: 0.7;"
        >
          (click to expand)
        </span>
      </h3>

      <div
        id="average-revenue-yoy-body"
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
              ${renderAverageRow(thisYearAverages)}
              <td>
                <strong>
                  ${ytdThisAverage === null ? "" : formatCurrency(ytdThisAverage)}
                </strong>
              </td>
            </tr>

            <tr>
              <td><strong>${compareYear}</strong></td>
              ${renderAverageRow(compareYearAverages)}
              <td>
                <strong>
                  ${
                    ytdCompareAverage === null
                      ? ""
                      : formatCurrency(ytdCompareAverage)
                  }
                </strong>
              </td>
            </tr>

            <tr>
              <td><strong>Δ Avg. Revenue / Contact</strong></td>
              ${months
                .map((_, index) => {
                  const key = String(index + 1).padStart(2, "0");
                  const value = diffAmounts[key];

                  if (value === null || value === undefined) {
                    return `<td></td>`;
                  }

                  return `<td>${renderTrendCurrency(value)}</td>`;
                })
                .join("")}
              <td>
                <strong>
                  ${
                    ytdDifference === null
                      ? ""
                      : renderTrendCurrency(ytdDifference)
                  }
                </strong>
              </td>
            </tr>

            <tr>
              <td><strong>Δ Percent</strong></td>
              ${months
                .map((_, index) => {
                  const key = String(index + 1).padStart(2, "0");
                  const value = diffPercents[key];

                  if (value === null || value === undefined) {
                    return `<td></td>`;
                  }

                  return `<td>${renderTrendPercent(value)}</td>`;
                })
                .join("")}
              <td>
                <strong>
                  ${
                    ytdPercentDifference === null
                      ? ""
                      : renderTrendPercent(ytdPercentDifference)
                  }
                </strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    `;

    attachToggle({
      toggleId: "average-revenue-yoy-toggle",
      bodyId: "average-revenue-yoy-body",
      hintId: "average-revenue-yoy-hint"
    });
  }

  // ------------------------------------------------------------
  // REUSABLE HELPERS
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
    return `
      <span class="${getTrendClass(value)}">
        ${formatCurrency(value)}${getTrendArrow(value)}
      </span>
    `;
  }

  function renderTrendCount(value) {
    return `
      <span class="${getTrendClass(value)}">
        ${value}${getTrendArrow(value)}
      </span>
    `;
  }

  function renderTrendPercent(value) {
    return `
      <span class="${getTrendClass(value)}">
        ${value.toFixed(1)}%${getTrendArrow(value)}
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
