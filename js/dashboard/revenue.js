// js/dashboard/revenue.js
// Revenue sub-tab (formerly stats.js). Same tiles + SVG chart; the
// Current Period selector now lives in shared state so every tab agrees.

import {
  dashboardState, isCurrentPeriod, mountPeriodSelector,
  fetchSection, pctBadge, countBadge, MONTHS_SHORT, MONTHS_LONG
} from "./dashboard-state.js";

export async function renderDashboardRevenue(container, portalState) {
  container.innerHTML = `
    <section class="dashboard-card">
      <div class="dashboard-cat-head">
        <h2 class="dashboard-title">Revenue</h2>
        <span class="dashboard-period-note" id="rev-period-note"></span>
      </div>
      <div class="dashboard-cat-body">
        <div class="dashboard-metric-row">
          <div class="dashboard-metric-box">
            <div class="dashboard-metric-label" id="rev-mtd-label">Revenue &middot; MTD</div>
            <div class="dashboard-metric-value" id="rev-mtd"></div>
            <div class="dashboard-metric-sub" id="rev-mtd-sub"></div>
          </div>
          <div class="dashboard-metric-box">
            <div class="dashboard-metric-label">Avg Revenue / Day</div>
            <div class="dashboard-metric-value" id="rev-avg"></div>
            <div class="dashboard-metric-sub" id="rev-avg-sub"></div>
          </div>
          <div class="dashboard-metric-box">
            <div class="dashboard-metric-label" id="ref-mtd-label">Referral Revenue &middot; MTD</div>
            <div class="dashboard-metric-value" id="ref-mtd"></div>
            <div class="dashboard-metric-sub" id="ref-mtd-sub"></div>
          </div>
          <div class="dashboard-metric-box">
            <div class="dashboard-metric-label" id="ref-count-label">Referrals &middot; MTD</div>
            <div class="dashboard-metric-value" id="ref-count"></div>
            <div class="dashboard-metric-sub" id="ref-count-sub"></div>
          </div>
        </div>
        <div class="dashboard-hero">
          <div class="dashboard-hero-head">
            <div>
              <h3 class="dashboard-chart-title">Revenue by month</h3>
              <div class="dashboard-chart-sub" id="rev-chart-sub"></div>
            </div>
            <div class="dashboard-period-control" id="rev-period-control"></div>
          </div>
          <div id="dashboardRevenueChart"></div>
          <div class="dashboard-legend">
            <span><span class="swatch swatch-solid"></span>Booked</span>
            <span id="rev-legend-pace"><span class="swatch swatch-pace"></span>Pace projection</span>
          </div>
        </div>
      </div>
    </section>
  `;

  mountPeriodSelector(
    document.getElementById("rev-period-control"),
    () => paint()
  );

  await paint();

  async function paint() {
    const period = dashboardState.period;
    const isCurrent = isCurrentPeriod(period);
    const [py, pm] = period.split("-").map(Number);
    const suffix = isCurrent ? "MTD" : MONTHS_SHORT[pm - 1];
    const now = new Date();

    document.getElementById("rev-mtd-label").innerHTML   = `Revenue &middot; ${suffix}`;
    document.getElementById("ref-mtd-label").innerHTML   = `Referral Revenue &middot; ${suffix}`;
    document.getElementById("ref-count-label").innerHTML = `Referrals &middot; ${suffix}`;
    document.getElementById("rev-period-note").textContent = isCurrent
      ? `Month to date · ${MONTHS_LONG[pm - 1]} 1–${now.getDate()}`
      : `${MONTHS_LONG[pm - 1]} ${py} · full month`;
    document.getElementById("rev-chart-sub").textContent = isCurrent
      ? "Current month is to date; outlined bar is the pace projection."
      : "Six months ending at the selected period.";
    document.getElementById("rev-legend-pace").style.display = isCurrent ? "" : "none";

    ["rev-mtd","rev-avg","ref-mtd","ref-count"].forEach(id => {
      document.getElementById(id).innerHTML = "&hellip;";
    });

    let data;
    try {
      data = await fetchSection("/dashboard/revenue", portalState);
    } catch (err) {
      document.getElementById("rev-mtd").innerHTML = "&mdash;";
      document.getElementById("rev-mtd-sub").textContent = "Couldn't load revenue data. Try again.";
      ["rev-avg","ref-mtd","ref-count"].forEach(id => {
        document.getElementById(id).innerHTML = "&mdash;";
      });
      return;
    }
    const rev = data.revenue;

    const paceChange = rev.avg_per_day ? rev.avg_per_day.change_pct : null;
    const projLine = isCurrent && rev.mtd.pace_projection
      ? ` · projects to $${rev.mtd.pace_projection.toLocaleString()}`
      : "";

    document.getElementById("rev-mtd").innerHTML =
      `$${rev.mtd.amount.toLocaleString()} ${pctBadge(paceChange)}`;
    document.getElementById("rev-mtd-sub").innerHTML = `Pace vs prior month${projLine}`;

    document.getElementById("rev-avg").innerHTML =
      `$${rev.avg_per_day.current.toLocaleString()} ${pctBadge(rev.avg_per_day.change_pct)}`;
    document.getElementById("rev-avg-sub").innerHTML =
      `Prior month: $${rev.avg_per_day.last_month.toLocaleString()}/day`;

    const refRevBadge = pctBadge(rev.referrals.revenue_change_pct);
    document.getElementById("ref-mtd").innerHTML =
      `$${rev.referrals.revenue_mtd.toLocaleString()} ${refRevBadge}`;
    document.getElementById("ref-mtd-sub").innerHTML = refRevBadge
      ? "Pace vs prior month"
      : `Prior month: $${(rev.referrals.revenue_last_month ?? 0).toLocaleString()}`;

    document.getElementById("ref-count").innerHTML =
      `${rev.referrals.count_mtd} ${countBadge(rev.referrals.count_mtd, rev.referrals.count_last_month)}`;
    document.getElementById("ref-count-sub").innerHTML =
      `Prior month: ${rev.referrals.count_last_month}`;

    document.getElementById("dashboardRevenueChart").innerHTML = revenueBarChart(
      rev.monthly.labels,
      rev.monthly.values,
      isCurrent ? rev.mtd.pace_projection : null
    );
  }
}

function revenueBarChart(labels, values, paceProj) {
  const W = 460, H = 190, padL = 8, padB = 24, padT = 16;
  const n = values.length;
  const max = Math.max(...values, paceProj || 0) * 1.1 || 1;
  const bw = (W - padL * 2) / n;
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = padL + i * bw + bw * 0.18;
    const w = bw * 0.64;
    const h = (values[i] / max) * (H - padB - padT);
    const y = H - padB - h;
    const isLast = i === n - 1;
    if (isLast && paceProj && paceProj > values[i]) {
      const ph = (paceProj / max) * (H - padB - padT);
      const py = H - padB - ph;
      out += `<rect x="${x}" y="${py}" width="${w}" height="${ph}" fill="none"
              stroke="#b8860b" stroke-width="2" stroke-dasharray="4 3" rx="3"/>`;
    }
    out += `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(h, 2)}"
            fill="#b8860b" rx="3"${isLast && paceProj ? ' opacity="0.85"' : ""}/>`;
    out += `<text x="${x + w / 2}" y="${H - 7}" text-anchor="middle"
            font-size="11" fill="#6b6a63">${labels[i]}</text>`;
    if (values[i] > 0) {
      const lbl = values[i] >= 1000 ? Math.round(values[i] / 1000) + "k" : values[i];
      out += `<text x="${x + w / 2}" y="${y - 5}" text-anchor="middle"
              font-size="10.5" font-weight="600" fill="#1c1b18">${lbl}</text>`;
    }
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly revenue"
          style="width:100%;height:auto;display:block">${out}</svg>`;
}
