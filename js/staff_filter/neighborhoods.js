// /js/staff_filter/neighborhoods.js

import { renderFilterNeighborhoods as baseNeighborhoods } from "../filter/neighborhoods.js";

export async function renderStaffFilterNeighborhoods(container, portalState) {
  return baseNeighborhoods(container, portalState);
}
