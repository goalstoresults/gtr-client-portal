// /js/staff_filter.js
// Staff Filter module controller — loads HTML, initializes subtabs, routes to subtab modules

import { renderStaffRunFilter } from "./staff-filter/run-filter.js";
import { renderFilterHistory } from "./staff-filter/history.js";
import { renderFilterCoverage } from "./staff-filter/coverage.js";
import { renderFilterNeighborhoods } from "./staff-filter/neighborhoods.js";

console.log("[Staff Filter] loaded");

// ------------------------------------------------------------
// Load Staff Filter Tab
// ------------------------------------------------------------
export async function loadStaffFilterTab({ portalState, tabContent }) {
  await loadPartial("/components/staff-filter.html", tabContent);
  initStaffFilterModule(portalState);
}

// ------------------------------------------------------------
// Load HTML partial
// ------------------------------------------------------------
async function loadPartial(url, tabContent) {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

    const html = await res.text();
    tabContent.innerHTML = html;

    const header = tabContent.querySelector("h2");
    if (header) header.textContent = "Staff Filter";
  } catch (err) {
    tabContent.innerHTML = `
      <section class="card">
        <p>Error loading partial (${url}): ${err.message}</p>
      </section>
    `;
  }
}

// ------------------------------------------------------------
// Initialize Staff Filter module
// ------------------------------------------------------------
function initStaffFilterModule(portalState) {
  window.portalState = portalState;

  const container = document.getElementById("staff-filter-subtab-content");
  if (container) {
    container.innerHTML = `
      <section class="card">
        <p>Loading Run Filter…</p>
      </section>
    `;
  }

  // Wire subtab buttons
  document.querySelectorAll("#staff-filter-subtabs button").forEach(btn => {
    btn.addEventListener("click", () =>
      loadStaffFilterSubtab(btn.dataset.subtab, portalState)
    );
  });

  // Default subtab → Run Filter (agent)
  loadStaffFilterSubtab("agent", portalState);
}

// ------------------------------------------------------------
// Subtab Router
// ------------------------------------------------------------
async function loadStaffFilterSubtab(subtab, portalState) {
  const container = document.getElementById("staff-filter-subtab-content");
  if (!container) return;

  if (!portalState.project) {
    container.innerHTML = `<p>No project selected.</p>`;
    return;
  }

  container.innerHTML = `<p>Loading ${subtab}...</p>`;

  // Update active UI
  document
    .querySelectorAll("#staff-filter-subtabs button")
    .forEach(btn => btn.classList.remove("active"));

  document
    .querySelector(`#staff-filter-subtabs button[data-subtab="${subtab}"]`)
    ?.classList.add("active");

  // Route to subtab modules
  if (subtab === "agent") return renderStaffRunFilter(container, portalState);
  if (subtab === "history") return renderFilterHistory(container, portalState);
  if (subtab === "coverage") return renderFilterCoverage(container, portalState);
  if (subtab === "neighborhoods") return renderFilterNeighborhoods(container, portalState);

  container.innerHTML = `<p>Unknown subtab</p>`;
}
