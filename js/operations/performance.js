export function loadPerformanceTab({ portalState, content }) {
  content.innerHTML = `
    <section class="card">
      <h2>Performance</h2>
      <p>Goals vs actual, variance, pacing, and forecasting.</p>
    </section>
  `;
}
