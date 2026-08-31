// /js/staff_filter/coverage.js

import { renderFilterCoverage as baseCoverage } from "../filter/coverage.js";

export async function renderStaffFilterCoverage(container, portalState) {
  return baseCoverage(container, portalState);
}
