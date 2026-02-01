// /js/filter/coverage.js
// Coverage Gaps — Neighborhood-first expandable UI (strict pairing)

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

      <!-- NEW: Neighborhood-first expandable list -->
      <div id="cov-grid" style="margin-top:16px;">
        <div class="mini-label">(ready)</div>
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
    const grid = document.getElementById("cov-grid");

    status.textContent = "Loading…";
    grid.innerHTML = `<div class="mini-label">Loading…</div>`;

    try {
      const res = await fetch(
        `https://filter-module.dennis-e64.workers.dev/unfiltered?days=${days}`,
        { headers: { accept: "application/json" } }
      );

      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`);

      const unusedByNeighborhood = data.unused_by_neighborhood || {};

      // Build UI
      const neighborhoods = Object.keys(unusedByNeighborhood);

      if (!neighborhoods.length) {
        grid.innerHTML = `<div class="mini-label">No neighborhoods found.</div>`;
        return;
      }

      // Build the expandable grid
      grid.innerHTML = neighborhoods
        .map(n => {
          const gaps = unusedByNeighborhood[n] || [];
          const count = gaps.length;

          return `
            <div class="cov-row" style="border:1px solid #ddd; border-radius:6px; margin-bottom:8px; background:#fafafa;">
              <div class="cov-header" data-nh="${escapeHtml(n)}"
                   style="padding:12px 16px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <strong>${escapeHtml(n)}</strong>
                  <span class="mini-label" style="margin-left:8px;">${count} missing</span>
                </div>
                <span class="cov-arrow" style="font-size:18px;">▸</span>
              </div>

              <div class="cov-body" style="display:none; padding:12px 16px; border-top:1px solid #ddd;">
                ${
                  count === 0
                    ? `<div class="mini-label">No gaps (all SqFt ranges used)</div>`
                    : `
                      <ul class="mini-list">
                        ${gaps.map(s => `<li>${escapeHtml(s)}</li>`).join("")}
                      </ul>
                    `
                }
              </div>
            </div>
          `;
        })
        .join("");

      // Add expand/collapse behavior
      grid.querySelectorAll(".cov-header").forEach(header => {
        header.onclick = () => {
          const body = header.parentElement.querySelector(".cov-body");
          const arrow = header.querySelector(".cov-arrow");

          const isOpen = body.style.display === "block";
          body.style.display = isOpen ? "none" : "block";
          arrow.textContent = isOpen ? "▸" : "▾";
        };
      });

      status.textContent = `Last ${data.window_days ?? days} days — Coverage gaps by neighborhood`;

    } catch (err) {
      status.textContent = "Error: " + err.message;
      grid.innerHTML = `<div class="mini-label" style="color:#c00;">Failed.</div>`;
    }
  };
}
