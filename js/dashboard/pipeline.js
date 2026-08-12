// js/dashboard/pipeline.js
// Pipeline sub-tab: stage bar (dynamic per-project lead_stage lookup, Open leads
// only) + summary tiles computed from status/created_at/end_date — no separate
// /dashboard/pipeline worker required.
//
// Data sources:
//   GET https://leads-module.dennis-e64.workers.dev/leads/list?project=X
//     -> project_pipeline_leads_view: lead_id, project, lead_name, contact_id,
//        contact_search_name, stage_name, status, created_at, updated_at,
//        end_date, amount
//   GET https://leads-module.dennis-e64.workers.dev/leads/config?project=X
//     -> project_lead_config row, including revenue_model
//        ('amount' | 'mmr_setup' | 'both')
//   GET https://lookups-module.dennis-e64.workers.dev/lookups/list?project=X
//     -> lead_stage lookup values (ordered by sort_order)
//
// Classification (via project's own `lead_status` lookup, no schema change):
//   Open      -> counted in the stage bar
//   Won       -> resolved-won; end_date is auto-stamped by the worker on
//                status -> "Won"
//   Lost      -> resolved-lost; end_date auto-stamped on status -> "Lost"
//   Inactive  -> excluded from the dashboard entirely (not shown as "Abandoned")
//
// Revenue tiles are driven by project_lead_config.revenue_model rather than
// inferred from which fields happen to be populated, so a brand-new project
// with zero Won leads yet still shows the right tile shape:
//   'amount'    -> single "New Revenue" tile (sum of `amount`)
//   'mmr_setup' -> "New MRR" + "Setup Revenue" tiles (potential_mmr /
//                  potential_setup_flat), kept separate since one recurs and
//                  one doesn't
//   'both'      -> all three tiles
//
// KNOWN LIMITATION: "Leads in Pipeline" prior-period comparison is computed
// retroactively from created_at/end_date (no snapshot table needed). This is
// exact for Won/Lost transitions (end_date is stamped), but a lead marked
// Inactive does NOT get end_date set, so historical as-of counts can't
// distinguish "was Inactive back then" from "was still Open back then." Only
// affects the PRIOR comparison number, not the live current count (which
// reads actual status).
import {
  dashboardState, isCurrentPeriod, mountPeriodSelector,
  pctBadge, countBadge, MONTHS_SHORT, MONTHS_LONG
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
  const todayLabel = (() => {
    const d = new Date();
    return `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  })();
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
              <h3 class="dashboard-chart-title">Pipeline as of ${todayLabel}</h3>
              <div class="dashboard-chart-sub">Open leads by stage — always today's snapshot, independent of the period selector below.</div>
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
    // NOTE: verify `portalState.user_id` matches the field name used
    // elsewhere (revenue.js / clients.js) for this project's logged-in
    // staff id - /dashboard/pipeline requires it same as every other
    // /dashboard/* route.
    let leads, stages, revenueModel, pipelineData;
    try {
      const [leadsRes, stagesRes, configRes, dashRes] = await Promise.all([
        fetchLeads(portalState.project),
        fetchStages(portalState.project),
        fetchLeadConfig(portalState.project),
        fetchDashboardPipeline(portalState.project, portalState.user_id)
      ]);
      leads = leadsRes;
      stages = stagesRes;
      revenueModel = configRes?.revenue_model || "amount";
      pipelineData = dashRes.pipeline;
    } catch (err) {
      tilesEl.innerHTML = `<div class="dashboard-metric-box">
        <div class="dashboard-metric-sub">Couldn't load pipeline data. Try again.</div></div>`;
      document.getElementById("dashboardPipelineChart").innerHTML = "";
      document.getElementById("pip-legend").innerHTML = "";
      console.error("[Dashboard Pipeline] Load error:", err.message || err);
      return;
    }
    /* -----------------------------------------------------
       STAGE BAR — live, Open leads only (still from leads-module;
       /dashboard/pipeline doesn't return a per-stage breakdown)
    ----------------------------------------------------- */
    const openLeads = leads.filter(l => l.status === "Open");
    const counts = stages.map(s => ({
      stage: s.value,
      count: openLeads.filter(l => l.stage_name === s.value).length
    }));
    const knownStageNames = new Set(stages.map(s => s.value));
    const uncategorized = openLeads.filter(l => !knownStageNames.has(l.stage_name)).length;
    if (uncategorized > 0) {
      counts.push({ stage: "Uncategorized", count: uncategorized });
    }
    document.getElementById("dashboardPipelineChart").innerHTML = stageBar(counts);
    document.getElementById("pip-legend").innerHTML = counts
      .map((c, i) => `
        <span>
          <span class="swatch" style="background:${STAGE_COLORS[i % STAGE_COLORS.length]}"></span>
          ${escapeHtml(c.stage)} (${c.count})
        </span>
      `)
      .join("");
    /* -----------------------------------------------------
       TILES — sourced from /dashboard/pipeline (server-side date
       math, same reliable pattern as Revenue/Clients) instead of
       reconstructing period filtering client-side.
    ----------------------------------------------------- */
    const suffix = isCurrent ? "MTD" : MONTHS_SHORT[pm - 1];
    const pipelineCurrent = pipelineData.leads.current;
    const pipelinePrior = pipelineData.leads.prior;
    const wonCurrentCount = pipelineData.won.current;
    const wonPriorCount = pipelineData.won.prior;
    const lostCurrentCount = pipelineData.lost.current;
    const lostPriorCount = pipelineData.lost.prior;
    const closeRateCurrent = pipelineData.close_rate.current;
    const closeRateChangePct = pipelineData.close_rate.change_pct;
    const resolvedCount = wonCurrentCount + lostCurrentCount;
    const crBadge = resolvedCount >= 10 && closeRateChangePct !== null
      ? pctBadge(closeRateChangePct)
      : "";
    /* -----------------------------------------------------
       REVENUE TILES — shape driven by project_lead_config.revenue_model.
       'amount' model uses the backend's already-computed new_revenue.
       'mmr_setup' isn't covered by /dashboard/pipeline yet, so that
       path still computes client-side from leads-module (needs the
       actual won-lead records, not just a count) - same period-range
       logic as before, kept only for this case.
    ----------------------------------------------------- */
    let revenueTilesHtml = "";
    if (revenueModel === "amount" || revenueModel === "both") {
      const newRevenue = pipelineData.won.new_revenue;
      revenueTilesHtml += tile(
        `New Revenue &middot; ${suffix}`,
        `$${newRevenue.toLocaleString()}`,
        `From ${wonCurrentCount} won lead${wonCurrentCount === 1 ? "" : "s"} this period`
      );
    }
    if (revenueModel === "mmr_setup" || revenueModel === "both") {
      const cutoffDay = isCurrent ? now.getUTCDate() : null;
      const current = monthRange(py, pm, cutoffDay);
      const wonCurrentLeads = leads.filter(l => l.status === "Won" && inRange(l.end_date, current));
      const newMrr = sumField(wonCurrentLeads, "potential_mmr");
      const newSetup = sumField(wonCurrentLeads, "potential_setup_flat");
      revenueTilesHtml +=
        tile(
          `New MRR &middot; ${suffix}`,
          `$${newMrr.toLocaleString()}`,
          `From ${wonCurrentLeads.length} won lead${wonCurrentLeads.length === 1 ? "" : "s"} this period`
        ) +
        tile(
          `Setup Revenue &middot; ${suffix}`,
          `$${newSetup.toLocaleString()}`,
          `One-time fees, this period`
        );
    }
    tilesEl.innerHTML =
      tile("Leads in Pipeline",
        `${pipelineCurrent} ${countBadge(pipelineCurrent, pipelinePrior)}`,
        `Prior month: ${pipelinePrior}`) +
      tile(`Won &middot; ${suffix}`,
        `${wonCurrentCount} ${countBadge(wonCurrentCount, wonPriorCount)}`,
        `Prior month: ${wonPriorCount}`) +
      tile(`Lost &middot; ${suffix}`,
        `${lostCurrentCount} ${countBadge(lostCurrentCount, lostPriorCount, true)}`,
        `Prior month: ${lostPriorCount}`) +
      tile(`Close Rate &middot; ${suffix}`,
        `${closeRateCurrent.toFixed(1)}% ${crBadge}`,
        `Won ÷ (won + lost), resolved this period`) +
      revenueTilesHtml;
  }
}
/* ============================================================
   FETCH
============================================================ */
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
async function fetchDashboardPipeline(project, userId) {
  const url = `
    https://client-portal-api.dennis-e64.workers.dev/dashboard/pipeline?
    project=${encodeURIComponent(project)}&user_id=${encodeURIComponent(userId)}
  `.replace(/\s+/g, "");
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(
      `/dashboard/pipeline ${res.status} ${res.statusText} - url=${url} - body=${body}`
    );
  }
  return res.json();
}
async function fetchLeadConfig(project) {
  const url = `
    https://leads-module.dennis-e64.workers.dev/leads/config?
    project=${encodeURIComponent(project)}
  `.replace(/\s+/g, "");
  const res = await fetch(url, { cache: "no-cache" });
  const data = await res.json();
  // /leads/config proxies Supabase's select=* directly through, which
  // returns an array even for a single matching row.
  return Array.isArray(data) ? data[0] : data;
}
/* ============================================================
   DATE / PERIOD HELPERS
============================================================ */
function parseDateSafe(raw) {
  if (!raw) return null;
  // Bare date-only strings ("2026-06-15") are already valid ISO and must
  // NOT get "Z" appended directly - "2026-06-15Z" is malformed (the Z
  // designator can only follow a time component). Only append "Z" when
  // there's a time component (T...) with no existing timezone marker -
  // e.g. timestamp-without-timezone columns like end_date can come back
  // as "2026-06-15T00:00:00" with no offset at all.
  const hasTime = raw.includes("T");
  const hasTz = /Z$|[+-]\d{2}:\d{2}$/.test(raw);
  const iso = (hasTime && !hasTz) ? raw + "Z" : raw;
  const t = Date.parse(iso);
  return isNaN(t) ? null : new Date(t);
}
// month is 1-12. cutoffDay: if set, range ends at that day-of-month
// (for MTD-style apples-to-apples comparison); if null, full month.
function monthRange(year, month, cutoffDay) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = cutoffDay
    ? new Date(Date.UTC(year, month - 1, cutoffDay, 23, 59, 59))
    : new Date(Date.UTC(year, month, 0, 23, 59, 59)); // last day of month
  return { start, end };
}
function inRange(rawDate, range) {
  const d = parseDateSafe(rawDate);
  if (!d) return false;
  return d >= range.start && d <= range.end;
}
function sumField(leadsArr, field) {
  return leadsArr.reduce((sum, l) => sum + (Number(l[field]) || 0), 0);
}
/* ============================================================
   RENDER HELPERS
============================================================ */
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
