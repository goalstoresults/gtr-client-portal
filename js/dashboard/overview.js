// js/dashboard/overview.js
// Overview sub-tab (default): pulse tiles on top, then ONE headline stat
// for each section the user is allowed to see.
//
// Permission rule: this module renders ONLY what /dashboard/overview returns.
// The Worker builds the payload from the user's dashboard_allowed_widgets —
// no 'revenue' in the allowlist means no revenue key in the JSON, so nothing
// to render. The front end never decides permissions.
//
// ctx = { navigate(sectionKey) }  — supplied by dashboard.js to switch sub-tabs.
//
// Worker contract: GET /dashboard/overview?project&user_id&period
// {
//   overview: {
//     pulse: {
//       days_since_campaign: 23 | null,
//       cold_list: { pct, marketable } | null,        // null = not built yet
//       hygiene: { untyped_pct, unknown_leads, total_leads } | null
//     },
//     headlines: {                                    // key absent = not permitted
//       revenue:  { amount, change_pct, projection } | null,   // null = pending
//       clients:  { active, change_pct } | null,
//       pipeline: { leads, won, change_pct } | null
//     }
//   }
// }

import { fetchSection, isCurrentPeriod, dashboardState, pctBadge, MONTHS_LONG } from "./dashboard-state.js";

export async function renderDashboardOverview(container, portalState, ctx) {
  container.innerHTML = `
    <div class="dashboard-pulse-row" id="ov-pulse"></div>
    <div class="dashboard-headline-row" id="ov-headlines"></div>
    <div class="dashboard-metric-sub" id="ov-note" style="margin-top:10px;"></div>
  `;

  let data;
  try {
    data = await fetchSection("/dashboard/overview", portalState);
  } catch (err) {
    container.innerHTML =
      `<div class="dashboard-card"><div class="dashboard-metric-sub">
        Couldn't load the overview. Try again.</div></div>`;
    return;
  }
  const ov = data.overview;

  /* ---------- pulse row ---------- */
  const pulseEl = document.getElementById("ov-pulse");
  let pulseHtml = "";

  if (ov.pulse) {
    const d = ov.pulse.days_since_campaign;
    if (d !== null && d !== undefined) {
      const state = d < 30 ? "ok" : d < 60 ? "warn" : "bad"; // TODO: thresholds from projects_dashboard
      const msg = d < 30 ? "You're in a good rhythm."
                : d < 60 ? "Getting quiet — time to plan the next send."
                : "Your list hasn't heard from you in over two months.";
      pulseHtml += pulseTile(state, d, "Days since last campaign", msg);
    }
    if (ov.pulse.cold_list) {
      const c = ov.pulse.cold_list;
      const state = c.pct < 20 ? "ok" : c.pct < 50 ? "warn" : "bad";
      pulseHtml += pulseTile(state, c.pct + "%", "List untouched in 30 days",
        `Of ${Number(c.marketable).toLocaleString()} marketable contacts.`);
    }
    if (ov.pulse.hygiene) {
      const h = ov.pulse.hygiene;
      const state = h.untyped_pct < 15 ? "ok" : h.untyped_pct < 40 ? "warn" : "bad";
      pulseHtml += pulseTile(state, h.untyped_pct + "%", "Contacts missing a type",
        `${h.unknown_leads} of ${h.total_leads} pipeline leads have no status.`);
    }
  }
  pulseEl.innerHTML = pulseHtml ||
    `<div class="dashboard-pulse dashboard-pulse-flat">
       <div><div class="dashboard-pulse-lbl">Pulse</div>
       <div class="dashboard-pulse-note">Coming soon.</div></div></div>`;

  /* ---------- headline row: only keys the Worker sent ---------- */
  const hlEl = document.getElementById("ov-headlines");
  const hl = ov.headlines || {};
  let hlHtml = "";

  if ("revenue" in hl) {
    hlHtml = hlHtml + (hl.revenue
      ? headlineTile("revenue", "Revenue",
          `$${Number(hl.revenue.amount).toLocaleString()}`,
          pctBadge(hl.revenue.change_pct),
          hl.revenue.projection && isCurrentPeriod(dashboardState.period)
            ? `Projects to $${Number(hl.revenue.projection).toLocaleString()} · View revenue →`
            : "View revenue →")
      : pendingTile("Revenue"));
  }
  if ("clients" in hl) {
    hlHtml = hlHtml + (hl.clients
      ? headlineTile("clients", "Active Clients",
          `${hl.clients.active}`,
          pctBadge(hl.clients.change_pct),
          "View clients →")
      : pendingTile("Clients"));
  }
  if ("pipeline" in hl) {
    hlHtml = hlHtml + (hl.pipeline
      ? headlineTile("pipeline", "Leads in Pipeline",
          `${hl.pipeline.leads}`,
          pctBadge(hl.pipeline.change_pct),
          `${hl.pipeline.won ?? 0} won this period · View pipeline →`)
      : pendingTile("Pipeline"));
  }
  hlEl.innerHTML = hlHtml;

  // whole tile navigates to its section tab
  hlEl.querySelectorAll("[data-section]").forEach((tileBtn) => {
    tileBtn.addEventListener("click", () => ctx.navigate(tileBtn.dataset.section));
  });

  const [py, pm] = dashboardState.period.split("-").map(Number);
  document.getElementById("ov-note").textContent = isCurrentPeriod(dashboardState.period)
    ? "" : `Showing ${MONTHS_LONG[pm - 1]} ${py}.`;
}

/* ---------- tile builders ---------- */
function pulseTile(state, big, label, note) {
  return `
    <div class="dashboard-pulse ${"dashboard-pulse-" + state}">
      <div class="dashboard-pulse-big">${big}</div>
      <div>
        <div class="dashboard-pulse-lbl">${label}</div>
        <div class="dashboard-pulse-note">${note}</div>
      </div>
    </div>`;
}

function headlineTile(sectionKey, label, value, badge, sub) {
  return `
    <button type="button" class="dashboard-headline" data-section="${sectionKey}">
      <div class="dashboard-metric-label">${label}</div>
      <div class="dashboard-metric-value">${value} ${badge}</div>
      <div class="dashboard-metric-sub">${sub}</div>
    </button>`;
}

function pendingTile(label) {
  return `
    <div class="dashboard-headline dashboard-headline-pending">
      <div class="dashboard-metric-label">${label}</div>
      <div class="dashboard-metric-value">&mdash;</div>
      <div class="dashboard-metric-sub">Coming soon.</div>
    </div>`;
}
