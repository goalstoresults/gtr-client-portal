// js/stats/pipeline.js

export async function renderStatsPipeline(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h2 style="margin:0 0 16px;">Pipeline</h2>

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
          See where your leads stand
        </h3>

        <p style="margin:0 0 12px; color:#5b6673; line-height:1.6;">
          A view of open leads across your configured pipeline stages.
          Planned reporting includes:
        </p>

        <ul style="
          margin:0;
          padding-left:20px;
          color:#5b6673;
          line-height:1.9;
        ">
          <li>Open lead counts by stage</li>
          <li>A clear view of the current pipeline</li>
          <li>Access to the leads behind each stage count</li>
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
