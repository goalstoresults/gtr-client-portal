// js/dashboard/stats.js
// Dashboard – Stats (Revenue section matching mockup)

export async function renderDashboardStats(container, portalState) {
  container.innerHTML = `
    <section class="dashboard-card">
      <h2 class="dashboard-title">Revenue Overview</h2>

      <div class="dashboard-metric-row">

        <div class="dashboard-metric-box">
          <div class="dashboard-metric-label">Revenue · MTD</div>
          <div class="dashboard-metric-value" id="rev-mtd"></div>
          <div class="dashboard-metric-sub" id="rev-mtd-sub"></div>
        </div>

        <div class="dashboard-metric-box">
          <div class="dashboard-metric-label">Avg Revenue / Day</div>
          <div class="dashboard-metric-value" id="rev-avg"></div>
          <div class="dashboard-metric-sub" id="rev-avg-sub"></div>
        </div>

        <div class="dashboard-metric-box">
          <div class="dashboard-metric-label">Referral Revenue · MTD</div>
          <div class="dashboard-metric-value" id="ref-mtd"></div>
          <div class="dashboard-metric-sub" id="ref-mtd-sub"></div>
        </div>

        <div class="dashboard-metric-box">
          <div class="dashboard-metric-label">Referrals · MTD</div>
          <div class="dashboard-metric-value" id="ref-count"></div>
          <div class="dashboard-metric-sub" id="ref-count-sub"></div>
        </div>

      </div>

      <div class="dashboard-chart-area">
        <h3 class="dashboard-chart-title">Revenue by month</h3>
        <canvas id="dashboardRevenueChart"></canvas>
      </div>
    </section>
  `;

  // Fetch data
  const res = await fetch(
    `https://dashboard-module.dennis-e64.workers.dev/dashboard/revenue?project=${portalState.project}&user_id=${portalState.user_id}`,
    { cache: "no-cache" }
  );

  const data = await res.json();
  const rev = data.revenue;

  // Helper for arrows
  const arrow = (pct) =>
    pct >= 0
      ? `<span class="metric-up">▲${pct}%</span>`
      : `<span class="metric-down">▼${Math.abs(pct)}%</span>`;

  // Fill values
  document.getElementById("rev-mtd").innerHTML =
    `$${rev.mtd.amount.toLocaleString()} ${arrow(rev.mtd.change_pct)}`;
  document.getElementById("rev-mtd-sub").innerHTML =
    `Pace vs last month · projects to $${rev.mtd.pace_projection.toLocaleString()}`;

  document.getElementById("rev-avg").innerHTML =
    `$${rev.avg_per_day.current.toLocaleString()} ${arrow(rev.avg_per_day.change_pct)}`;
  document.getElementById("rev-avg-sub").innerHTML =
    `Last month: $${rev.avg_per_day.last_month.toLocaleString()}/day`;

  document.getElementById("ref-mtd").innerHTML =
    `$${rev.referrals.revenue_mtd.toLocaleString()} ${arrow(rev.referrals.change_pct)}`;
  document.getElementById("ref-mtd-sub").innerHTML = `Pace vs last month`;

  document.getElementById("ref-count").innerHTML =
    `${rev.referrals.count_mtd} ${arrow(rev.referrals.change_pct)}`;
  document.getElementById("ref-count-sub").innerHTML =
    `Last month: ${rev.referrals.count_last_month}`;

  // Chart
  const ctx = document.getElementById("dashboardRevenueChart");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: rev.monthly.labels,
      datasets: [
        {
          label: "Revenue",
          data: rev.monthly.values,
          backgroundColor: "#3498db"
        },
        {
          label: "Pace Projection",
          data: rev.monthly.values.map((v, i) =>
            i === rev.monthly.values.length - 1 ? rev.mtd.pace_projection : null
          ),
          backgroundColor: "rgba(52,152,219,0.15)",
          borderColor: "#3498db",
          borderWidth: 2
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
}
