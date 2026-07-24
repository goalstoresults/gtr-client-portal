// js/dashboard/clients.js
// Clients sub-tab: tiles + active-clients trend (mockup look & feel).
//
// Worker contract: GET /dashboard/clients?project&user_id&period
// {
//   clients: {
//     active:      { current, prior, change_pct },
//     new_clients: { current, prior },
//     mrr:         { current, prior, change_pct } | null,   // null = not an MRR client
//     journey_rev: { current, prior, change_pct },          // avg lifetime-to-date revenue, ACTIVE clients only
//     journey_len: { current, prior, change_pct },          // avg days-as-client, ACTIVE clients only (up = good, longer tenure)
//     trend:       { labels: ["Feb",...], values: [13,...] } // 6 months, month-end counts
//   }
// }

import {
  dashboardState, isCurrentPeriod, mountPeriodSelector,
  fetchSection, pctBadge, pctBadgeInverted, countBadge, MONTHS_SHORT, MONTHS_LONG
} from "./dashboard-state.js";

export async function renderDashboardClients(container, portalState) {
  container.innerHTML = `
    <section class="dashboard-card">
      <div class="dashboard-cat-head">
        <h2 class="dashboard-title">Clients</h2>
        <span class="dashboard-period-note" id="cli-period-note"></span>
      </div>
      <div class="dashboard-cat-body">
        <div class="dashboard-metric-row" id="cli-tiles"></div>
        <div class="dashboard-hero">
          <div class="dashboard-hero-head">
            <div>
              <h3 class="dashboard-chart-title">Active clients — 6 months</h3>
              <div class="dashboard-chart-sub">Month-end counts.</div>
            </div>
            <div class="dashboard-period-control" id="cli-period-control"></div>
          </div>
          <div id="dashboardClientsChart"></div>
        </div>
      </div>
    </section>
  `;

  mountPeriodSelector(
    document.getElementById("cli-period-control"),
    () => paint()
  );

  await paint();

  async function paint() {
    const period = dashboardState.period;
    const isCurrent = isCurrentPeriod(period);
    const [py, pm] = period.split("-").map(Number);
    const suffix = isCurrent ? "MTD" : MONTHS_SHORT[pm - 1];
    const now = new Date();

    document.getElementById("cli-period-note").textContent = isCurrent
      ? `Snapshot + month to date · ${MONTHS_LONG[pm - 1]} 1–${now.getDate()}`
      : `${MONTHS_LONG[pm - 1]} ${py} · full month`;

    const tilesEl = document.getElementById("cli-tiles");
    tilesEl.innerHTML = `<div class="dashboard-metric-box">
      <div class="dashboard-metric-sub">Loading&hellip;</div></div>`;

    let data;
    try {
      data = await fetchSection("/dashboard/clients", portalState);
    } catch (err) {
      tilesEl.innerHTML = `<div class="dashboard-metric-box">
        <div class="dashboard-metric-sub">Couldn't load client data. Try again.</div></div>`;
      document.getElementById("dashboardClientsChart").innerHTML = "";
      return;
    }
    const c = data.clients;

    let tiles =
      tile("Active Clients",
        `${c.active.current} ${countBadge(c.active.current, c.active.prior)}`,
        `Prior month: ${c.active.prior}`) +
      tile(`New Clients &middot; ${suffix}`,
        `${c.new_clients.current} ${countBadge(c.new_clients.current, c.new_clients.prior)}`,
        `Prior month: ${c.new_clients.prior}`);

    if (c.mrr) {
      tiles += tile("MRR",
        `$${Number(c.mrr.current).toLocaleString()} ${pctBadge(c.mrr.change_pct)}`,
        `Prior month: $${Number(c.mrr.prior).toLocaleString()}`);
    }

    // Both journey tiles reflect CURRENT active clients only (elapsed time /
    // revenue-to-date as of today), not completed/churned journeys. A rising
    // average is a good sign (revenue growth, longer retention) for both, so
    // both use the normal (non-inverted) badge direction.
    tiles +=
      tile("Avg Current Client Journey Revenue",
        `$${Number(c.journey_rev.current).toLocaleString()} ${pctBadge(c.journey_rev.change_pct)}`,
        `Prior month: $${Number(c.journey_rev.prior).toLocaleString()}`) +
      tile("Avg Current Journey Length",
        `${daysWithYears(c.journey_len.current)} ${pctBadge(c.journey_len.change_pct)}`,
        `Prior month: ${daysWithYears(c.journey_len.prior)}`);

    tilesEl.innerHTML = tiles;

    document.getElementById("dashboardClientsChart").innerHTML =
      lineChart(c.trend.labels, c.trend.values);
  }
}

function daysWithYears(days) {
  const d = Math.round(days);
  const years = (d / 365).toFixed(1);
  return `${d} days (${years} yrs)`;
}

function tile(label, valueHtml, sub) {
  return `
    <div class="dashboard-metric-box">
      <div class="dashboard-metric-label">${label}</div>
      <div class="dashboard-metric-value">${valueHtml}</div>
      <div class="dashboard-metric-sub">${sub}</div>
    </div>`;
}

function lineChart(labels, values) {
  const W = 460, H = 190, padL = 8, padR = 8, padB = 24, padT = 18;
  const n = values.length;
  if (!n) return "";
  const min = Math.min(...values), max = Math.max(...values);
  const span = (max - min) || 1;
  const x = i => padL + (n === 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const y = v => padT + (1 - (v - min) / span) * (H - padB - padT);
  let pts = [], dots = "", lbls = "";
  for (let i = 0; i < n; i++) {
    pts.push(x(i) + "," + y(values[i]));
    dots += `<circle cx="${x(i)}" cy="${y(values[i])}" r="4" fill="#b8860b"/>`;
    dots += `<text x="${x(i)}" y="${y(values[i]) - 9}" text-anchor="middle"
             font-size="11" font-weight="600" fill="#1c1b18">${values[i]}</text>`;
    lbls += `<text x="${x(i)}" y="${H - 7}" text-anchor="middle"
             font-size="11" fill="#6b6a63">${labels[i]}</text>`;
  }
  const area = `<polygon points="${x(0)},${H - padB} ${pts.join(" ")} ${x(n - 1)},${H - padB}"
                fill="#b8860b" opacity="0.10"/>`;
  const line = `<polyline points="${pts.join(" ")}" fill="none" stroke="#b8860b"
                stroke-width="2.5" stroke-linejoin="round"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Active clients trend"
          style="width:100%;height:auto;display:block">${area}${line}${dots}${lbls}</svg>`;
}
