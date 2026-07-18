// js/dashboard/stats.js
// Dashboard – Stats (Revenue section matching mockup)

export async function renderDashboardStats(container, portalState) {
  // Initial shell
  container.innerHTML = `
    <section class="card dashboard-revenue">
      <h2>Revenue Overview</h2>
      <p>Loading...</p>
    </section>
  `;

  try {
    const res = await fetch(
      `https://dashboard-module.dennis-e64.workers.dev/dashboard/revenue?project=${portalState.project}&user_id=${portalState.user_id}`,
      { cache: "no-cache" }
    );

    if (!res.ok) {
      throw new Error("Failed to load revenue data");
    }

    const data = await res.json();
    const rev = data.revenue;

    // Build metrics + chart container
    container.innerHTML = `
      <section class="card dashboard-revenue">

        <div class="metric-row">

          <!-- Revenue · MTD -->
          <div class="metric-box">
            <div class="metric-title">Revenue · MTD</div>
            <div class="metric-value">
              $${rev.mtd.amount.toLocaleString()}
              <span class="metric-change ${rev.mtd.change_pct >= 0 ? "up" : "down"}">
                ${rev.mtd.change_pct >= 0 ? "▲" : "▼"}${Math.abs(rev.mtd.change_pct)}%
              </span>
            </div>
            <div class="metric-sub">
              Pace vs last month · projects to $${rev.mtd.pace_projection.toLocaleString()}
            </div>
          </div>

          <!-- Avg Revenue / Day -->
          <div class="metric-box">
            <div class="metric-title">Avg Revenue / Day</div>
            <div class="metric-value">
              $${rev.avg_per_day.current.toLocaleString()}
              <span class="metric-change ${rev.avg_per_day.change_pct >= 0 ? "up" : "down"}">
                ${rev.avg_per_day.change_pct >= 0 ? "▲" : "▼"}${Math.abs(rev.avg_per_day.change_pct)}%
              </span>
            </div>
            <div class="metric-sub">
              Last month: $${rev.avg_per_day.last_month.toLocaleString()}/day
            </div>
          </div>

          <!-- Referral Revenue · MTD -->
          <div class="metric-box">
            <div class="metric-title">Referral Revenue · MTD</div>
            <div class="metric-value">
              $${rev.referrals.revenue_mtd.toLocaleString()}
              <span class="metric-change ${rev.referrals.change_pct >= 0 ? "up" : "down"}">
                ${rev.referrals.change_pct >= 0 ? "▲" : "▼"}${Math.abs(rev.referrals.change_pct)}%
              </span>
            </div>
            <div class="metric-sub">
              Pace vs last month
            </div>
          </div>

          <!-- Referrals · MTD -->
          <div class="metric-box">
            <div class="metric-title">Referrals · MTD</div>
            <div class="metric-value">
              ${rev.referrals.count_mtd}
              <span class="metric-change ${rev.referrals.change_pct >= 0 ? "up" : "down"}">
                ${rev.referrals.change_pct >= 0 ? "▲" : "▼"}${Math.abs(rev.referrals.change_pct)}%
              </span>
            </div>
            <div class="metric-sub">
              Last month: ${rev.referrals.count_last_month}
            </div>
          </div>

        </div>

        <div class="chart-area">
          <h3>Revenue by month</h3>
          <canvas id="dashboardRevenueChart"></canvas>
        </div>

      </section>
    `;

    // Render bar chart (assumes Chart.js is globally available as Chart)
    const ctx = document.getElementById("dashboardRevenueChart");
    if (ctx && window.Chart) {
      const labels = rev.monthly.labels;
      const values = rev.monthly.values;

      // Last bar pace projection (outline)
      const paceData = values.map((v, i) =>
        i === values.length - 1 ? rev.mtd.pace_projection : null
      );

      new window.Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Revenue",
              data: values,
              backgroundColor: "#3498db"
            },
            {
              label: "Pace Projection",
              data: paceData,
              backgroundColor: "rgba(52,152,219,0.15)",
              borderColor: "#3498db",
              borderWidth: 2
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <section class="card dashboard-revenue">
        <h2>Revenue Overview</h2>
        <p>Failed to load revenue data.</p>
      </section>
    `;
  }
}
