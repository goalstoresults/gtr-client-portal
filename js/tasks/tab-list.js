// tab-list.js — Orchestrator for Tasks List
// This file is intentionally small. It wires together:
// - Data layer (lookups, staff, tasks)
// - Logic layer (filters, sorting, show-mine, state)
// - UI layer (DOM, rendering, events)

import {
  fetchLookups,
  fetchProjectStaff,
  fetchTasks,
  computeDueIn,
  resolveAssigned
} from "./tab-list-data.js";

import {
  initListLogic,
  applyFiltersRaw,
  applySortInPlace,
  applyShowMineFilterRaw,
  getTasks,
  getFilteredTasks,
  setFilteredTasks,
  getSortLevels,
  setSortLevels
} from "./tab-list-logic.js";

import {
  renderShell,
  renderFilterPanel,
  renderSortPanel,
  renderTable,
  wireToggles,
  wireFilterButtons,
  wireSortButtons,
  wireShowMine,
  wireExportCsv
} from "./tab-list-ui.js";

export async function loadTasksList({ portalState, container }) {

  // 1) Build the shell UI (toolbar, panels, table container)
  const { listEl, filterPanel, sortPanel } = renderShell({ portalState, container });

  // 2) Load data (lookups, staff, tasks)
  const lookups = await fetchLookups(portalState.project);
  const projectStaff = await fetchProjectStaff(portalState.project);

  // Expose to edit tab
  portalState.lookups = {
    status: lookups.filter(x => x.field === "status"),
    priority: lookups.filter(x => x.field === "priority"),
    area: lookups.filter(x => x.field === "area"),
    who_is_this_for: lookups.filter(x => x.field === "who_is_this_for")
  };
  portalState.projectStaff = projectStaff;

  // Load tasks into logic layer
  await initListLogic({ portalState });

  // 3) Render filter + sort panels
  renderFilterPanel({ filterPanel, lookups, projectStaff, portalState });
  renderSortPanel({ sortPanel });

  // 4) Wire UI events to logic
  wireToggles({ container, filterPanel, sortPanel });

  wireFilterButtons({
    filterPanel,
    portalState,
    render: () => renderTable({ listEl, portalState, projectStaff })
  });

  wireSortButtons({
    sortPanel,
    render: () => renderTable({ listEl, portalState, projectStaff })
  });

  wireShowMine({
    container,
    portalState,
    render: () => renderTable({ listEl, portalState, projectStaff })
  });

  wireExportCsv({
    container,
    portalState,
    resolveAssignedHelper: t => resolveAssigned(t, projectStaff, portalState)
  });

  // 5) Initial render
  renderTable({ listEl, portalState, projectStaff });
}
