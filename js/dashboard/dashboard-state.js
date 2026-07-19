// js/dashboard/dashboard-state.js
// Shared state for all dashboard sub-tabs.
// One Current Period for the whole dashboard: pick May in Revenue,
// switch to Pipeline, it's still May.

const MONTHS_LONG = ["January","February","March","April","May","June","July",
                     "August","September","October","November","December"];

const now = new Date();

export const dashboardState = {
  period: periodValue(now.getFullYear(), now.getMonth()),
  currentPeriod: periodValue(now.getFullYear(), now.getMonth())
};

export function periodValue(year, monthIndex) {
  return year + "-" + String(monthIndex + 1).padStart(2, "0");
}

export function isCurrentPeriod(period) {
  return period === dashboardState.currentPeriod;
}

// Renders the "Current Period" dropdown into a container element and
// wires it to shared state. onChange fires after state is updated.
export function mountPeriodSelector(el, onChange) {
  el.innerHTML = `
    <label for="dash-period">Current Period</label>
    <select id="dash-period"></select>
  `;
  const sel = el.querySelector("select");
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const opt = document.createElement("option");
    opt.value = periodValue(d.getFullYear(), d.getMonth());
    opt.textContent = MONTHS_LONG[d.getMonth()] + " " + d.getFullYear();
    sel.appendChild(opt);
  }
  sel.value = dashboardState.period;
  sel.addEventListener("change", () => {
    dashboardState.period = sel.value;
    onChange(sel.value);
  });
}

/* ---------- shared formatting helpers ---------- */
export const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun",
                             "Jul","Aug","Sep","Oct","Nov","Dec"];
export { MONTHS_LONG };

export const MIN_COUNT_FOR_PCT = 10; // TODO: read from projects_dashboard

export function pctBadge(pct) {
  if (pct === null || pct === undefined) return "";
  if (Math.abs(pct) < 0.05) return `<span class="delta delta-flat">0.0%</span>`;
  const cls = pct > 0 ? "delta-up" : "delta-down";
  const arrow = pct > 0 ? "▲" : "▼";
  return `<span class="delta ${cls}">${arrow} ${Math.abs(pct).toFixed(1)}%</span>`;
}

// Inverted: for metrics where DOWN is good (lost deals, journey length)
export function pctBadgeInverted(pct) {
  if (pct === null || pct === undefined) return "";
  if (Math.abs(pct) < 0.05) return `<span class="delta delta-flat">0.0%</span>`;
  const cls = pct > 0 ? "delta-down" : "delta-up";
  const arrow = pct > 0 ? "▲" : "▼";
  return `<span class="delta ${cls}">${arrow} ${Math.abs(pct).toFixed(1)}%</span>`;
}

export function countBadge(cur, prior, inverted = false) {
  if (prior === null || prior === undefined) return "";
  const diff = cur - prior;
  if (diff === 0) return `<span class="delta delta-flat">0</span>`;
  if (prior < MIN_COUNT_FOR_PCT) {
    const good = inverted ? diff < 0 : diff > 0;
    const cls = good ? "delta-up" : "delta-down";
    return `<span class="delta ${cls}">${diff > 0 ? "+" : ""}${diff}</span>`;
  }
  const p = (diff / Math.abs(prior)) * 100;
  return inverted ? pctBadgeInverted(p) : pctBadge(p);
}

export const WORKER_BASE = "https://dashboard-module.dennis-e64.workers.dev";

export async function fetchSection(path, portalState) {
  const res = await fetch(
    `${WORKER_BASE}${path}?project=${portalState.project}` +
      `&user_id=${portalState.user_id}&period=${dashboardState.period}`,
    { cache: "no-cache" }
  );
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}
