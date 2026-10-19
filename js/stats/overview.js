// js/stats/overview.js

export async function renderStatsOverview(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h2 style="margin:0 0 16px;">Overview</h2>

      <div style="
        background:#eef2f6;
        border-left:3px solid #7ea3c9;
        border-radius:6px;
        padding:20px;
      ">
        <span style="
          display:inline-block;
          background:#fff8e1;
          color:#856404;
          border:1px solid #e8d48b;
          border-radius:4px;
          padding:4px 10px;
          font-size:12px;
          font-weight:600;
          margin-bottom:12px;
        ">Coming Soon</span>

        <h3 style="margin:0 0 10px; color:#3d4a5c;">
          Your business at a glance
        </h3>

        <p style="margin:0 0 12px; color:#5b6673; line-height:1.6;">
          A summary of your leads and their current status.
          Planned reporting includes:
        </p>

        <ul style="
          margin:0;
          padding-left:20px;
          color:#5b6673;
          line-height:1.9;
        ">
          <li>Total leads</li>
          <li>Open leads</li>
          <li>Won, lost, and abandoned leads</li>
        </ul>

        <p style="
          margin:16px 0 0;
          color:#5b6673;
          font-size:13px;
          line-height:1.6;
        ">
          Reporting is coming next. We’ll finalize these views
          based on your team’s priorities and feedback.
        </p>
      </div>
    </section>
  `;
}
