// /js/staff_filter/history.js

import { renderFilterHistory as baseHistory } from "../filter/history.js";

export async function renderStaffFilterHistory(container, portalState) {
  return baseHistory(container, portalState);
}
