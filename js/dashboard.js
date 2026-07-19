// js/dashboard.js
import { renderDashboardOverview } from "./dashboard/overview.js";
import { renderDashboardRevenue } from "./dashboard/revenue.js";
import { renderDashboardClients } from "./dashboard/clients.js";
import { renderDashboardPipeline } from "./dashboard/pipeline.js";
import { renderDashboardDefaults } from "./dashboard/defaults.js";
import { renderDashboardStaff } from "./dashboard/staff.js";

export async function loadDashboardTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/dashboard.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  // Context bar (same pattern as Contacts)
  let contextBar = document.getElementById("dashboard-context-bar");
  if (!contextBar) {
    contextBar = document.createElement("div");
    contextBar.id = "dashboard-context-bar";
    contextBar.className = "contact-context-bar";
    tabContent.prepend(contextBar);
  }
  contextBar.textContent = "Dashboard Overview";

  const content = tabContent.querySelector("#dashboardContent");
  const subtabBar = tabContent.querySelector("#dashboard-subtabs");
  const fullAdmin = portalState.full_admin === true;

  // ----------------------------------------------------------
  // Which sections may this user see?
  // portalState.dashboard_allowed_widgets should be the array from
  // projects_staff (e.g. ["pulse","revenue","clients","pipeline"]).
  // If it's missing from portalState (not yet loaded at login),
  // we show all sections — the Worker still refuses data server-side,
  // so nothing leaks; the tab just shows "couldn't load".
  // TODO: populate portalState.dashboard_allowed_widgets at login.
  // ----------------------------------------------------------
  const allowed = Array.isArray(portalState.dashboard_allowed_widgets)
    ? portalState.dashboard_allowed_widgets
    : null; // null = unknown -> show all, server enforces

  const canSee = (key) =>
    fullAdmin || allowed === null || allowed.includes(key);

  // ----------------------------------------------------------
  // Build the sub-tab bar dynamically (replaces whatever the
  // template has in #dashboard-subtabs, so the HTML file needs
  // no button edits).
  // ----------------------------------------------------------
  const SECTIONS = [
    { key: "overview", label: "Overview", render: renderDashboardOverview, show: true },
    { key: "revenue",  label: "Revenue",  render: renderDashboardRevenue,  show: canSee("revenue") },
    { key: "clients",  label: "Clients",  render: renderDashboardClients,  show: canSee("clients") },
    { key: "pipeline", label: "Pipeline", render: renderDashboardPipeline, show: canSee("pipeline") },
    { key: "defaults", label: "Defaults", render: renderDashboardDefaults, show: fullAdmin },
    { key: "staff",    label: "Staff",    render: renderDashboardStaff,    show: fullAdmin }
  ];

  subtabBar.innerHTML = SECTIONS
    .filter((s) => s.show)
    .map((s) => `<button data-subtab="${s.key}">${s.label}</button>`)
    .join("");

  const wiredButtons = subtabBar.querySelectorAll("button");

  // Overview headline tiles call ctx.navigate("revenue") etc.
  const ctx = { navigate: (key) => showSubTab(key) };

  async function showSubTab(key) {
    const section = SECTIONS.find((s) => s.key === key && s.show);
    if (!section) return;
    wiredButtons.forEach((b) =>
      b.classList.toggle("active", b.dataset.subtab === key)
    );
    await section.render(content, portalState, ctx);
  }

  wiredButtons.forEach((btn) => {
    btn.addEventListener("click", () => showSubTab(btn.dataset.subtab));
  });

  // Default to Overview when the Dashboard top tab is clicked
  await showSubTab("overview");
}
