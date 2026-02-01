// /js/filter/coverage.js
// Coverage Gaps — Phase 1 parity with cleaner UI

import { escapeHtml } from "../utilities.js";

export async function renderFilterCoverage(container, portalState) {
  container.innerHTML = `
    <section class="card">

      <h3>Coverage Gaps</h3>

      <div class="inline" style="flex-wrap:wrap; gap:16px; margin-bottom:16px;">
        <label>
          Past
          <input type="number" id="cov-days" value="30" min="1" max="3650" style="width:80px;">
          days
        </label>

        <button id="cov-load" class="primary">Refresh</button>
      </div>

      <div id="cov-status" class="mini-label" style="margin-bottom:12px;"></div>

      <!-- Clean two-column layout with borders -->
      <div class="two-col" style="gap:24px;">

        <div style="border:1px solid #ddd; border-radius:6px; padding:16px; background:#fafafa;">
          <h4 style="margin-top:0;">Neighborhoods Not Used</h4>
          <ul id="cov-unused-nh" class="mini-list" style="margin-top:8px;">
            <li class="mini-label">(ready)</li>
          </ul>
        </div>

        <div style="border:1px solid #ddd; border-radius:6px; padding:16px; background:#fafafa;">
          <h4 style="margin-top:0;">SqFt Not Used</h4>
          <ul id="cov-unused-sqft" class="mini-list" style="margin-top:8px;">
            <li class="mini-label">(ready)</li>
          </ul>
        </div>

      </div>

    </section>
  `;

  // ------------------------------------------------------------
  // Load Coverage Gaps
  // ------------------------------------------------------------
  document.getElementById("cov-load").onclick = async () => {
    const days = Math.max(
      1,
      Math.min(3650, parseInt(document.getElementById("cov-days").value || "30", 10))
    );

    const status = document.getElementById("cov-status");
    const ulNh = document.getElementById("cov-unused-nh");
    const ulSq = document.getElementById("cov-unused-sqft");

    status.textContent = "Loading…";
    ulNh.innerHTML = `<li class="mini-label">Loading…</li>`;
    ulSq.innerHTML = `<li class="mini-label">Loading…</li>`;

    try {
      const res = await fetch(
        `https://filter-module.dennis-e64.workers.dev/unfiltered?days=${days}`,
        { headers: { accept: "application/json" } }
      );

      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`);

      const unusedNh = Array.isArray(data.unused_neighborhoods)
        ? data.unused_neighborhoods
        : [];

      const unusedSq = Array.isArray(data.unused_sqft)
        ? data.unused_sqft
        : [];

      // Neighborhoods
      ulNh.innerHTML = unusedNh.length
        ? unusedNh.map(n => `<li>${escapeHtml(n)}</li>`).join("")
        : `<li class="mini-label">None (all used)</li>`;

      // SqFt
      ulSq.innerHTML = unusedSq.length
        ? unusedSq.map(s => `<li>${escapeHtml(s)}</li>`).join("")
        : `<li class="mini-label">None (all used)</li>`;

      const totals = data.totals || {};

      status.textContent =
        `Last ${data.window_days ?? days} days — Neighborhoods unused: ${unusedNh.length}/${totals.neighborhoods_all ?? "–"} • SqFt unused: ${unusedSq.length}/${totals.sqft_all ?? "–"}`;

    } catch (err) {
      status.textContent = "Error: " + err.message;
      ulNh.innerHTML = `<li class="mini-label" style="color:#c00;">Failed.</li>`;
      ulSq.innerHTML = `<li class="mini-label" style="color:#c00;">Failed.</li>`;
    }
  };
}
