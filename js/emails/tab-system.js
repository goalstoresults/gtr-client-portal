// /emails/tab-system.js
// System-wide email analytics (Coming Soon)

export async function renderEmailSystem(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h3>Email Intelligence – System Overview</h3>
      <p>This section will display network-wide analytics across all campaigns and all clients.</p>

      <ul style="margin-top:12px;">
        <li>Top-performing subject lines</li>
        <li>Best send days & times</li>
        <li>Engagement benchmarks across all users</li>
        <li>Open/click trends by month</li>
        <li>Cross-client behavioral insights</li>
      </ul>

      <p style="margin-top:16px; font-style:italic; opacity:0.7;">
        More features coming soon...
      </p>
    </section>
  `;
}
