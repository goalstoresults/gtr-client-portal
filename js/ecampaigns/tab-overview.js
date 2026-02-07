// ------------------------------------------------------------
// RENDER E‑CAMPAIGNS OVERVIEW (DEFAULT GRID STYLE)
// ------------------------------------------------------------
export async function renderECOverview(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h3>E‑Campaigns Overview</h3>
      <p>Loading overview...</p>
    </section>
  `;

  const project = portalState.project;
  const year = portalState.selectedYear || "";

  // Match Campaigns tab base URL
  const base = "https://ecampaigns-module.dennis-e64.workers.dev";

  try {
    const url = new URL(`${base}/analytics/overview`);
    url.searchParams.set("project", project);
    if (year) url.searchParams.set("year", year);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const data = await res.json();
    const { totals, rates } = data;

    container.innerHTML = `
      <section class="card">
        <h3>E‑Campaigns Overview</h3>
        <p>Engagement of your current contacts for all campaigns</p>

        <table class="notes-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Total</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Delivered</td>
              <td>${totals.delivered}</td>
              <td>-</td>
            </tr>
            <tr>
              <td>Opened</td>
              <td>${totals.opened}</td>
              <td>${formatRate(rates.open_rate)}</td>
            </tr>
            <tr>
              <td>Clicked</td>
              <td>${totals.clicked}</td>
              <td>${formatRate(rates.click_rate)}</td>
            </tr>
            <tr>
              <td>Unsubscribed</td>
              <td>${totals.unsubscribed}</td>
              <td>${formatRate(rates.unsub_rate)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    `;
  } catch (err) {
    container.innerHTML = `
      <section class="card">
        <h3>E‑Campaigns Overview</h3>
        <p class="error">Error loading overview: ${err.message}</p>
      </section>
    `;
  }
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
function formatRate(rate) {
  if (!rate || isNaN(rate)) return "0%";
  return (rate * 100).toFixed(1) + "%";
}
