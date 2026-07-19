// js/dashboard/pipeline.js
// Pipeline sub-tab: tiles + pipeline status bar (mockup look & feel).
//
// Worker contract: GET /dashboard/pipeline?project&user_id&period
// {
//   pipeline: {
//     leads:      { current, prior },                       // open leads
//     won:        { current, prior, new_revenue },          // resolved in period
//     lost:       { current, prior },                       // down = good
//     close_rate: { current, prior, change_pct },           // won/(won+lost), resolved in period
//     no_status:  { current },                              // hygiene
//     funnel:     { won, working, unknown, lost }           // snapshot for the bar
//   }
// }

import {
  dashboardState, isCurrentPeriod, mountPeriodSelector,
  fetchSection, pctBadge, countBadge, MONTHS_SHORT, MONTHS_LONG
} from "./dashboard-state.js";

export async function renderDashboardPipeline(container, portalState) {
  container.innerHTML = `
    <section class="dashboard-card">
      <div class="dashboard-cat-head">
        <h2 class="dashboard-title">Pipeline</h2>
        <span class="dashboard-period-note" id="pip-period-note"></span>
      </div>
      <div class="dashboard-cat-body">
        <div class="dashboard-metric-row" id="pip-tiles"></div>
        <div class="dashboard-hero">
          <div class="dashboard-hero-head">
            <div>
              <h3 class="dashboard-chart-title">Where your pipeline stands</h3>
              <div class="dashboard-chart-sub">Every open and resolved lead this period.</div>
            </div>
            <div class="dashboard-period-control" id="pip-period-control"></div>
          </div>
          <div id="dashboardPipelineChart"></div>
          <div class="dashboard-legend" id="pip-legend"></div>
        </div>
      </div>
    </section>
  `;

  mountPeriodSelector(
    document.getElementById("pip-period-control"),
    () => paint()
  );

  await paint();

  async function paint() {
    const period = dashboardState.period;
    const isCurrent = isCurrentPeriod(period);
    const [py, pm] = period.split("-").map(Number);
    const suffix = isCurrent ? "MTD" : MONTHS_SHORT[pm - 1];
    const now = new Date();

    document.getElementById("pip-period-note").textContent = isCurrent
      ? `Month to date · ${MONTHS_LONG[pm - 1]} 1–${now.getDate()}`
      : `${MONTHS_LONG[pm - 1]} ${py} · full month`;

    const tilesEl = document.getElementById("pip-tiles");
    tilesEl.innerHTML = `<div class="dashboard-metric-box">
      <div class="dashboard-metric-sub">Loading&hellip;</div></div>`;

    let data;
    try {
      data = await fetchSection("/dashboard/pipeline", portalState);
    } catch (err) {
      tilesEl.innerHTML = `<div class="dashboard-metric-box">
        <div class="dashboard-metric-sub">Couldn't load pipeline data. Try again.</div></div>`;
      document.getElementById("dashboardPipelineChart").innerHTML = "";
      document.getElementById("pip-legend").innerHTML = "";
      return;
    }
    const p = data.pipeline;

    // Close rate uses countBadge-style suppression via its underlying counts:
    // when resolved deals are few, percent swings are noise, so show points.
    const crBadge = (p.won.current + p.lost.current) >= 10
      ? pctBadge(p.close_rate.change_pct)
      : "";

    tilesEl.innerHTML =
      tile("Leads in Pipeline",
        `${p.leads.current} ${countBadge(p.leads.current, p.leads.prior)}`,
        `Prior month: ${p.leads.prior}`) +
      tile(`Won &middot; ${suffix}`,
        `${p.won.current} ${countBadge(p.won.current, p.won.prior)}`,
        `New revenue: $${Number(p.won.new_revenue || 0).toLocaleString()}`) +
      tile(`Lost / Abandoned &middot; ${suffix}`,
        `${p.lost.current} ${countBadge(p.lost.current, p.lost.prior, true)}`,
        `Prior month: ${p.lost.prior}`) +
      tile(`Close Rate &middot; ${suffix}`,
        `${Number(p.close_rate.current).toFixed(1)}% ${crBadge}`,
        `Won ÷ (won + lost), resolved this period`);

    const f = p.funnel;
    document.getElementById("dashboardPipelineChart").innerHTML = funnelBar(f);
    document.getElementById("pip-legend").innerHTML = `
      <span><span class="swatch" style="background:#1e7a46"></span>Won (${f.won})</span>
      <span><span class="swatch" style="background:#b8860b"></span>Working (${f.working})</span>
      <span><span class="swatch" style="background:#c9c6bd"></span>No status (${f.unknown})</span>
      <span><span class="swatch" style="background:#b02a24"></span>Lost (${f.lost})</span>`;
  }
}

function tile(label, valueHtml, sub) {
  return `
    <div class="dashboard-metric-box">
      <div class="dashboard-metric-label">${label}</div>
      <div class="dashboard-metric-value">${valueHtml}</div>
      <div class="dashboard-metric-sub">${sub}</div>
    </div>`;
}

function funnelBar(f) {
  const total = (f.won + f.working + f.unknown + f.lost) || 1;
  const W = 460, H = 64;
  const segs = [
    { v: f.won,     c: "#1e7a46" },
    { v: f.working, c: "#b8860b" },
    { v: f.unknown, c: "#c9c6bd" },
    { v: f.lost,    c: "#b02a24" }
  ];
  let xPos = 0, rects = "";
  segs.forEach((s) => {
    const w = (s.v / total) * W;
    if (w > 0) {
      rects += `<rect x="${xPos}" y="14" width="${Math.max(w - 2, 2)}" height="36"
                fill="${s.c}" rx="4"/>`;
      if (w > 34) {
        rects += `<text x="${xPos + w / 2}" y="37" text-anchor="middle"
                  font-size="13" font-weight="700" fill="#fff">${s.v}</text>`;
      }
    }
    xPos += w;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Pipeline status breakdown"
          style="width:100%;height:auto;display:block">${rects}</svg>`;
}
