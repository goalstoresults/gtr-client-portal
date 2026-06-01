// inspections/tab-add.js
// Add tab: manual inspection entry + bulk import + staging trigger

import { escapeHtml, renderContactPicker } from "../utilities.js";
import "./tab-add-staging.js";   // staging subsystem
import { renderInspectionList } from "./tab-list.js";

/* =========================================================
   BACKEND INSERT: Add Inspection Manually
========================================================= */
export async function addInspectionManual({
  project,
  client_contact_id,
  agent_contact_id,
  inspector1_contact_id,
  inspector2_contact_id,
  inspection_date,
  inspection_type,
  address_full,
  city,
  state,
  postal_code,
  fee_total
}) {
  const res = await fetch(
    `https://inspections-module.dennis-e64.workers.dev/inspections/add`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project,
        client_contact_id,
        agent_contact_id,
        inspector1_contact_id,
        inspector2_contact_id,
        inspection_date,
        inspection_type,
        address_full,
        city,
        state,
        postal_code,
        fee_total
      })
    }
  );

  if (!res.ok) {
    throw new Error("Inspection insert failed");
  }

  return await res.json();
}

/* =========================================================
   RENDER: Add Tab
========================================================= */
export async function renderInspectionAdd(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h3>Inspections – Add Inspection</h3>
      <div id="contactPickerArea"></div>
    </section>

    <div style="margin-top:16px; display:flex; gap:12px;">
      <button id="btnLoadStaging" class="btn-primary">Review Bulk Data</button>
      <button id="btnAddBulk" class="btn-secondary">Add Bulk</button>
      <button id="btnAutoMatchAll" class="btn-secondary">Auto‑Match All</button>
    </div>

    <div id="stagingGrid" style="margin-top:16px;"></div>
  `;

  /* ---------------------------------------------------------
     Render contact picker (client)
  --------------------------------------------------------- */
  const pickerArea = document.getElementById("contactPickerArea");

  await renderContactPicker(pickerArea, portalState, async (contact) => {
    const formArea = document.createElement("div");
    await renderAddInspectionForm(formArea, portalState, contact);
    container.appendChild(formArea);
  });

  /* ---------------------------------------------------------
     Wire staging button
  --------------------------------------------------------- */
  document.getElementById("btnLoadStaging").addEventListener("click", () => {
    window.loadStagingData();
  });

  /* ---------------------------------------------------------
     Wire bulk upload button
  --------------------------------------------------------- */
  document.getElementById("btnAddBulk").addEventListener("click", () => {
    if (typeof window.showBulkUploadModal === "function") {
      window.showBulkUploadModal();
    } else {
      alert("Bulk upload modal not available.");
    }
  });

  /* ---------------------------------------------------------
     Wire Auto‑Match All button
  --------------------------------------------------------- */
  document.getElementById("btnAutoMatchAll").addEventListener("click", () => {
    if (typeof window.autoMatchAllInspections === "function") {
      window.autoMatchAllInspections();
    } else {
      alert("Auto-match-all not available.");
    }
  });
}

/* =========================================================
   RENDER: Add Inspection Form
========================================================= */
async function renderAddInspectionForm(formArea, portalState, contact) {
  formArea.innerHTML = `
    <section class="card">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
        <h3 style="margin:0;">Add Inspection for ${escapeHtml(contact.search_name || contact.contact_id)}</h3>
        <button id="btnSaveInspection" class="btn-primary">Save</button>
      </div>

      <div class="notes-row">
        <label class="notes-label">Inspection Date</label>
        <input id="inspectionDate" class="form-control" type="date" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Inspection Type</label>
        <input id="inspectionType" class="form-control" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Address</label>
        <input id="inspectionAddress" class="form-control" />
      </div>

      <div class="notes-row">
        <label class="notes-label">City</label>
        <input id="inspectionCity" class="form-control" />
      </div>

      <div class="notes-row">
        <label class="notes-label">State</label>
        <input id="inspectionState" class="form-control" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Zip</label>
        <input id="inspectionZip" class="form-control" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Total Fee</label>
        <input id="inspectionFee" class="form-control" type="number" step="0.01" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Agent Contact ID</label>
        <input id="agentContactId" class="form-control" placeholder="Optional" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Inspector 1 Contact ID</label>
        <input id="insp1ContactId" class="form-control" placeholder="Optional" />
      </div>

      <div class="notes-row">
        <label class="notes-label">Inspector 2 Contact ID</label>
        <input id="insp2ContactId" class="form-control" placeholder="Optional" />
      </div>
    </section>
  `;

  /* ---------------------------------------------------------
     Save button logic
  --------------------------------------------------------- */
  formArea.querySelector("#btnSaveInspection").addEventListener("click", async () => {
    const inspection_date = formArea.querySelector("#inspectionDate").value.trim();
    const inspection_type = formArea.querySelector("#inspectionType").value.trim();
    const address_full = formArea.querySelector("#inspectionAddress").value.trim();
    const city = formArea.querySelector("#inspectionCity").value.trim();
    const state = formArea.querySelector("#inspectionState").value.trim();
    const postal_code = formArea.querySelector("#inspectionZip").value.trim();
    const fee_total = formArea.querySelector("#inspectionFee").value.trim();

    const agent_contact_id = formArea.querySelector("#agentContactId").value.trim() || null;
    const inspector1_contact_id = formArea.querySelector("#insp1ContactId").value.trim() || null;
    const inspector2_contact_id = formArea.querySelector("#insp2ContactId").value.trim() || null;

    if (!inspection_date) {
      alert("Inspection Date is required");
      return;
    }

    try {
      await addInspectionManual({
        project: portalState.project,
        client_contact_id: contact.contact_id,
        agent_contact_id,
        inspector1_contact_id,
        inspector2_contact_id,
        inspection_date,
        inspection_type,
        address_full,
        city,
        state,
        postal_code,
        fee_total: fee_total ? parseFloat(fee_total) : null
      });

      alert("Inspection added");
      await renderInspectionList(document.getElementById("inspectionsContent"), portalState);

    } catch (err) {
      console.error(err);
      alert("Failed to add inspection");
    }
  });
}
