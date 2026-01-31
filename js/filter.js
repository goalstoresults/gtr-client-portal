// /filter.js
// Filter module controller — loads HTML, initializes subtabs, routes to subtab modules

import { renderRunFilter } from "./filter/run.js";
import { renderFilterHistory } from "./filter/history.js";
import { renderFilterCoverage } from "./filter/coverage.js";
import { renderFilterNeighborhoods } from "./filter/neighborhoods.js";
// Phase 2:
// import { renderFilterResults } from "./filter/results.js";

console.log("[Filter.js] loaded");

// ------------------------------------------------------------
// Load Filter Tab
// ------------------------------------------------------------
export async function loadFilterTab({ portalState, tabContent }) {
  await loadPartial("/components/filter.html", tabContent);
  initFilterModule(portalState);
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
    if (header) header.textContent = "Filter";
  } catch (err) {
    tabContent.innerHTML = `
      <section class="card">
        <p>Error loading partial (${url}): ${err.message}</p>
      </section>
    `;
  }
}

// ------------------------------------------------------------
// Initialize Filter module
// ------------------------------------------------------------
function initFilterModule(portalState) {
  window.portalState = portalState;

  const container = document.getElementById("filter-subtab-content");
  if (container) {
    container.innerHTML = `
      <section class="card">
        <p>Loading Run Filter…</p>
      </section>
    `;
  }

  // Wire subtab buttons
  document.querySelectorAll("#filter-subtabs button").forEach(btn => {
    btn.addEventListener("click", () =>
      loadFilterSubtab(btn.dataset.subtab, portalState)
    );
  });

  // Default subtab
  loadFilterSubtab("run", portalState);
}

// ------------------------------------------------------------
// Subtab Router
// ------------------------------------------------------------
async function loadFilterSubtab(subtab, portalState) {
  const container = document.getElementById("filter-subtab-content");
  if (!container) return;

  if (!portalState.project) {
    container.innerHTML = `<p>No project selected.</p>`;
    return;
  }

  container.innerHTML = `<p>Loading ${subtab}...</p>`;

  // Update active UI
  document
    .querySelectorAll("#filter-subtabs button")
    .forEach(btn => btn.classList.remove("active"));

  document
    .querySelector(`#filter-subtabs button[data-subtab="${subtab}"]`)
    ?.classList.add("active");

  // Route to subtab modules
  if (subtab === "run") return renderRunFilter(container, portalState);
  if (subtab === "history") return renderFilterHistory(container, portalState);
  if (subtab === "coverage") return renderFilterCoverage(container, portalState);
  if (subtab === "neighborhoods") return renderFilterNeighborhoods(container, portalState);

  // Phase 2:
  // if (subtab === "results") return renderFilterResults(container, portalState);

  container.innerHTML = `<p>Unknown subtab</p>`;
}
