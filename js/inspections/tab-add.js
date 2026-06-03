// inspections/tab-add.js
// Clean version: ONLY bulk workflow buttons

import {
  openInspectionBulkUpload,
  renderInspectionStaging
} from "./tab-add-staging.js";

export function renderInspectionAdd(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h2>Inspections – Add Inspection</h2>

      <div class="bulk-actions" style="margin-top:20px; display:flex; gap:12px;">
        <button id="inspReviewBulk" class="secondary">Review Bulk Data</button>
        <button id="inspAddBulk" class="primary">Add Bulk</button>
      </div>
    </section>
  `;

  const reviewBulkBtn = container.querySelector("#inspReviewBulk");
  const addBulkBtn = container.querySelector("#inspAddBulk");

  reviewBulkBtn.onclick = () => {
    renderInspectionStaging(container, portalState);   // ⭐ correct
  };

  addBulkBtn.onclick = () => {
    openInspectionBulkUpload(container, portalState);
  };
}
