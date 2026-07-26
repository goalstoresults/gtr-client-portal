// js/dashboard/pipeline.js
// Pipeline sub-tab: stage-by-stage lead counts, driven entirely by each
// project's own `lead_stage` lookup values — no hardcoded won/lost concept.
//
// Data sources (both already used elsewhere in the app):
//   GET https://leads-module.dennis-e64.workers.dev/leads/list?project=X
//   GET https://lookups-module.dennis-e64.workers.dev/lookups/list?project=X

import {
  dashboardState, isCurrentPeriod, mountPeriodSelector,
  MONTHS_SHORT, MONTHS_LONG
} from "./dashboard-state.js";

const STAGE_COLORS = [
  "#1e7a46", "#b8860b", "#2f6fb0", "#8e44ad",
  "#c9622a", "#5a8f29", "#b02a24", "#4b6584",
  "#a3752e", "#3d8b8b", "#6c5ce7", "#00838f",
  "#c2185b", "#558b2f", "#5d4037", "#455a64",
  "#e67e22", "#16a085", "#7f1d1d", "#1a5276",
  "#6b4226", "#2c3e50", "#8d6e63", "#37474f"
];

export async function renderDashboardPipeline(container, portalState) {
  container.innerHTML = `
    <section class="dashboard-card">
      <div class="dashboard-cat-head">
        <h2 class="dashboard-title">Pipeline</h2>
        <span class="dashboard-period-note" id="pip-period-note"></span>
      </div>
      <div class="dashboard-cat-body">
        <div class="dashboard-metric-row" id="pip-tiles"></div>
        <div class="dashboard-hero">
          <div class="dashboard-hero-head">
            <div>
              <h3 class="dashboard-chart-title">Where your pipeline stands</h3>
              <div class="dashboard-chart-sub">Open leads by stage.</div>
            </div>
            <div class="dashboard-period-control" id="pip-period-control"></div>
          </div>
          <div id="dashboardPipelineChart"></div>
          <div class="dashboard-legend" id="pip-legend"></div>
        </div>
      </div>
    </section>
  `;

  mountPeriodSelector(
    document.getElementById("pip-period-control"),
    () => paint()
  );

  await paint();

  async function paint() {
    const period = dashboardState.period;
    const isCurrent = isCurrentPeriod(period);
    const [py, pm] = period.split("-").map(Number);
    const now = new Date();

    document.getElementById("pip-period-note").textContent = isCurrent
      ? `Month to date · ${MONTHS_LONG[pm - 1]} 1–${now.getDate()}`
      : `${MONTHS_LONG[pm - 1]} ${py} · full month`;

    const tilesEl = document.getElementById("pip-tiles");
    tilesEl.innerHTML = `<div class="dashboard-metric-box">
      <div class="dashboard-metric-sub">Loading&hellip;</div></div>`;

    let leads, stages;
    try {
      [leads, stages] = await Promise.all([
        fetchLeads(portalState.project),
        fetchStages(portalState.project)
      ]);
    } catch (err) {
      tilesEl.innerHTML = `<div class="dashboard-metric-box">
        <div class="dashboard-metric-sub">Couldn't load pipeline data. Try again.</div></div>`;
      document.getElementById("dashboardPipelineChart").innerHTML = "";
      document.getElementById("pip-legend").innerHTML = "";
      console.error("[Dashboard Pipeline] Load error:", err);
      return;
    }

    // Count leads per stage, in the project's configured stage order
    const counts = stages.map(s => ({
      stage: s.value,
      count: leads.filter(l => l.stage_name === s.value).length
    }));

    // Any leads whose stage_name doesn't match a configured lookup value
    // (renamed/removed stage, bad data, etc.) — surfaced, not silently dropped
    const knownStageNames = new Set(stages.map(s => s.value));
    const uncategorized = leads.filter(l => !knownStageNames.has(l.stage_name)).length;
    if (uncategorized > 0) {
      counts.push({ stage: "Uncategorized", count: uncategorized });
    }

    tilesEl.innerHTML = tile(
      "Leads in Pipeline",
      `${leads.length}`,
      `Across ${counts.filter(c => c.count > 0).length} stage${counts.filter(c => c.count > 0).length === 1 ? "" : "s"}`
    );

    document.getElementById("dashboardPipelineChart").innerHTML = stageBar(counts);
    document.getElementById("pip-legend").innerHTML = counts
      .map((c, i) => `
        <span>
          <span class="swatch" style="background:${STAGE_COLORS[i % STAGE_COLORS.length]}"></span>
          ${escapeHtml(c.stage)} (${c.count})
        </span>
      `)
      .join("");
  }
}

async function fetchLeads(project) {
  const url = `
    https://leads-module.dennis-e64.workers.dev/leads/list?
    project=${encodeURIComponent(project)}
  `.replace(/\s+/g, "");

  const res = await fetch(url, { cache: "no-cache" });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchStages(project) {
  const url = `
    https://lookups-module.dennis-e64.workers.dev/lookups/list?
    project=${encodeURIComponent(project)}
  `.replace(/\s+/g, "");

  const res = await fetch(url, { cache: "no-cache" });
  const data = await res.json();
  const all = Array.isArray(data.lookups) ? data.lookups : [];

  return all
    .filter(l => l.lookup_type === "lead_stage" && l.is_active !== false)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function tile(label, valueHtml, sub) {
  return `
    <div class="dashboard-metric-box">
      <div class="dashboard-metric-label">${label}</div>
      <div class="dashboard-metric-value">${valueHtml}</div>
      <div class="dashboard-metric-sub">${sub}</div>
    </div>`;
}

function stageBar(counts) {
  const total = counts.reduce((sum, c) => sum + c.count, 0) || 1;
  const W = 460, H = 64;

  let xPos = 0, rects = "";
  counts.forEach((c, i) => {
    const w = (c.count / total) * W;
    const color = STAGE_COLORS[i % STAGE_COLORS.length];
    if (w > 0) {
      rects += `<rect x="${xPos}" y="14" width="${Math.max(w - 2, 2)}" height="36"
                fill="${color}" rx="4"/>`;
      if (w > 24) {
        rects += `<text x="${xPos + w / 2}" y="37" text-anchor="middle"
                  font-size="13" font-weight="700" fill="#fff">${c.count}</text>`;
      }
    }
    xPos += w;
  });

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Leads by stage"
          style="width:100%;height:auto;display:block">${rects}</svg>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
