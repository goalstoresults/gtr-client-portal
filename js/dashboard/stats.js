// js/dashboard/stats.js
// Dashboard – Stats (Revenue section, mockup look & feel)

const MIN_COUNT_FOR_PCT = 10; // TODO: read from projects_dashboard when Defaults ships

export async function renderDashboardStats(container, portalState) {
  container.innerHTML = `
    <section class="dashboard-card">
      <div class="dashboard-cat-head">
        <h2 class="dashboard-title">Revenue</h2>
        <span class="dashboard-period-note" id="rev-period-note"></span>
      </div>
      <div class="dashboard-cat-body">
        <div class="dashboard-metric-row">
          <div class="dashboard-metric-box">
            <div class="dashboard-metric-label">Revenue &middot; MTD</div>
            <div class="dashboard-metric-value" id="rev-mtd"></div>
            <div class="dashboard-metric-sub" id="rev-mtd-sub"></div>
          </div>
          <div class="dashboard-metric-box">
            <div class="dashboard-metric-label">Avg Revenue / Day</div>
            <div class="dashboard-metric-value" id="rev-avg"></div>
            <div class="dashboard-metric-sub" id="rev-avg-sub"></div>
          </div>
          <div class="dashboard-metric-box">
            <div class="dashboard-metric-label">Referral Revenue &middot; MTD</div>
            <div class="dashboard-metric-value" id="ref-mtd"></div>
            <div class="dashboard-metric-sub" id="ref-mtd-sub"></div>
          </div>
          <div class="dashboard-metric-box">
            <div class="dashboard-metric-label">Referrals &middot; MTD</div>
            <div class="dashboard-metric-value" id="ref-count"></div>
            <div class="dashboard-metric-sub" id="ref-count-sub"></div>
          </div>
        </div>
        <div class="dashboard-hero">
          <h3 class="dashboard-chart-title">Revenue by month</h3>
          <div class="dashboard-chart-sub">Current month is to date; outlined bar is the pace projection.</div>
          <div id="dashboardRevenueChart"></div>
          <div class="dashboard-legend">
            <span><span class="swatch swatch-solid"></span>Booked</span>
            <span><span class="swatch swatch-pace"></span>Pace projection</span>
          </div>
        </div>
      </div>
    </section>
  `;

  const res = await fetch(
    `https://dashboard-module.dennis-e64.workers.dev/dashboard/revenue?project=${portalState.project}&user_id=${portalState.user_id}`,
    { cache: "no-cache" }
  );
  const data = await res.json();
  const rev = data.revenue;

  /* ---------- badge helpers ---------- */
  // For percentages the Worker already computed
  const pctBadge = (pct) => {
    if (pct === null || pct === undefined) return "";
    if (Math.abs(pct) < 0.05) return `<span class="delta delta-flat">0.0%</span>`;
    const cls = pct > 0 ? "delta-up" : "delta-down";
    const arrow = pct > 0 ? "▲" : "▼";
    return `<span class="delta ${cls}">${arrow} ${Math.abs(pct).toFixed(1)}%</span>`;
  };
  // For counts: falls back to absolute change when the base is small,
  // so 1 -> 3 shows "+2" instead of a screaming 200%
  const countBadge = (cur, prior) => {
    if (prior === null || prior === undefined) return "";
    const diff = cur - prior;
    if (diff === 0) return `<span class="delta delta-flat">0</span>`;
    if (prior < MIN_COUNT_FOR_PCT) {
      const cls = diff > 0 ? "delta-up" : "delta-down";
      return `<span class="delta ${cls}">${diff > 0 ? "+" : ""}${diff}</span>`;
    }
    return pctBadge((diff / Math.abs(prior)) * 100);
  };

  /* ---------- tiles ---------- */
  // NOTE: the MTD badge uses the PER-DAY (pace) change, matching its
  // "Pace vs last month" sub-label. rev.mtd.change_pct (raw MTD total vs
  // full last month) is apples-to-oranges mid-month and contradicts the
  // Avg/Day tile — don't use it here.
  const paceChange = rev.avg_per_day ? rev.avg_per_day.change_pct : null;

  document.getElementById("rev-mtd").innerHTML =
    `$${rev.mtd.amount.toLocaleString()} ${pctBadge(paceChange)}`;
  document.getElementById("rev-mtd-sub").innerHTML =
    `Pace vs last month · projects to $${rev.mtd.pace_projection.toLocaleString()}`;

  document.getElementById("rev-avg").innerHTML =
    `$${rev.avg_per_day.current.toLocaleString()} ${pctBadge(rev.avg_per_day.change_pct)}`;
  document.getElementById("rev-avg-sub").innerHTML =
    `Last month: $${rev.avg_per_day.last_month.toLocaleString()}/day`;

  // Referral REVENUE badge: only show if the Worker supplies a change
  // computed from referral revenue itself. Reusing referrals.change_pct
  // (a COUNT change) here was wrong — better no badge than a wrong one.
  const refRevBadge = pctBadge(rev.referrals.revenue_change_pct);
  document.getElementById("ref-mtd").innerHTML =
    `$${rev.referrals.revenue_mtd.toLocaleString()} ${refRevBadge}`;
  document.getElementById("ref-mtd-sub").innerHTML = refRevBadge
    ? "Pace vs last month"
    : `Last month: $${(rev.referrals.revenue_last_month ?? 0).toLocaleString()}`;

  document.getElementById("ref-count").innerHTML =
    `${rev.referrals.count_mtd} ${countBadge(rev.referrals.count_mtd, rev.referrals.count_last_month)}`;
  document.getElementById("ref-count-sub").innerHTML =
    `Last month: ${rev.referrals.count_last_month}`;

  /* ---------- chart (hand-rolled SVG — no Chart.js) ---------- */
  document.getElementById("dashboardRevenueChart").innerHTML =
    revenueBarChart(rev.monthly.labels, rev.monthly.values, rev.mtd.pace_projection);
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
    if (isLast && paceProj > values[i]) {
      const ph = (paceProj / max) * (H - padB - padT);
      const py = H - padB - ph;
      out += `<rect x="${x}" y="${py}" width="${w}" height="${ph}" fill="none"
              stroke="#b8860b" stroke-width="2" stroke-dasharray="4 3" rx="3"/>`;
    }
    out += `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(h, 2)}"
            fill="#b8860b" rx="3"${isLast ? ' opacity="0.85"' : ""}/>`;
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
