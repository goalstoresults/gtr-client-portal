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
       //  <button id="inspAutoMatchAll" class="secondary">Auto-Match All</button>
      </div>
    </section>
  `;

  const reviewBulkBtn = container.querySelector("#inspReviewBulk");
  const addBulkBtn = container.querySelector("#inspAddBulk");
  const autoMatchAllBtn = container.querySelector("#inspAutoMatchAll");

  reviewBulkBtn.onclick = () => {
    renderInspectionStaging(container, portalState);   // ⭐ correct
  };

  addBulkBtn.onclick = () => {
    openInspectionBulkUpload(container, portalState);
  };

  autoMatchAllBtn.onclick = async () => {
    autoMatchAllBtn.disabled = true;
    autoMatchAllBtn.textContent = "Auto-Matching…";

    const res = await fetch(
      `https://inspections-module.dennis-e64.workers.dev/staging/auto-match-all?project=${encodeURIComponent(
        portalState.project
      )}`,
      { method: "POST" }
    );

    let data;
    try {
      data = await res.json();
    } catch {
      autoMatchAllBtn.disabled = false;
      autoMatchAllBtn.textContent = "Auto-Match All";
      alert("Error parsing auto-match response.");
      return;
    }

    autoMatchAllBtn.disabled = false;
    autoMatchAllBtn.textContent = "Auto-Match All";

    if (!res.ok) {
      alert(data.error || "Error running auto-match.");
      return;
    }

    alert(`Auto-match complete.\nMatched: ${data.matched || data.ready || 0}`);

    renderInspectionStaging(container, portalState);   // ⭐ correct
  };
}
