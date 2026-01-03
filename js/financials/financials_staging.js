// financials_staging.js
// Staging subsystem: ingestion actions + staging loader

// NOTE: No utilities needed here — removed unused imports.

// ------------------------------------------------------------
// window.* staging actions
// ------------------------------------------------------------

window.autoMatchContact = async function(id) {
  const project = window.portalState?.project;
  if (!project) {
    alert("No project selected.");
    return;
  }

  await fetch(
    `https://financials-module.dennis-e64.workers.dev/staging/auto-match?id=${id}&project=${project}`
  );

  loadStagingData();
};


window.insertStagingRow = async function(id) {
  const project = window.portalState?.project;
  if (!project) {
    alert("No project selected.");
    return;
  }

  const rowEl = document.querySelector(`#row-${id}`);
  if (!rowEl) return;

  const contact = rowEl.querySelector(".contact-cell")?.textContent.trim();

  if (!contact || contact === "(none)") {
    alert("Cannot import: missing contact_id.");
    return;
  }

  const actionCell = rowEl.querySelector(".action-cell");
  if (actionCell) {
    actionCell.innerHTML = `<span style="color:#555;">Inserting...</span>`;
  }

  const res = await fetch(
    `https://financials-module.dennis-e64.workers.dev/payments/add-from-staging?id=${id}&project=${project}`,
    { method: "POST" }
  );

  let data = {};
  try { data = await res.json(); } catch {}

  if (res.ok) {
    loadStagingData();
  } else {
    if (actionCell) {
      actionCell.innerHTML = `<button onclick="fixRow('${id}')">Fix Row</button>`;
    }
    const statusCell = rowEl.querySelector(".status-cell");
    if (statusCell) {
      statusCell.textContent = "error";
      statusCell.style.color = "red";
    }
    const errorCell = rowEl.querySelector(".error-cell");
    if (errorCell) {
      errorCell.textContent = data.error || "Insert failed";
    }
  }
};


window.fixRow = async function(id) {
  const rowEl = document.querySelector(`#row-${id}`);
  if (!rowEl) return;

  const customer = rowEl.children[0].textContent.trim();
  const invoice = rowEl.children[1].textContent.trim();
  const date = rowEl.children[2].textContent.trim();
  const amount = rowEl.children[3].textContent.trim();
  const contact = rowEl.querySelector(".contact-cell").textContent.trim();

  const modal = document.createElement("div");
  modal.style = `
    position:fixed; top:0; left:0; width:100%; height:100%;
    background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center;
    z-index:9999;
  `;

  modal.innerHTML = `
    <div style="background:white; padding:20px; width:360px; border-radius:6px;">
      <h3>Fix Row</h3>

      <label>Customer Name</label>
      <input id="fix_customer" class="form-control" value="${customer}" />

      <label style="margin-top:10px;">Invoice #</label>
      <input id="fix_invoice" class="form-control" value="${invoice}" />

      <label style="margin-top:10px;">Payment Date</label>
      <input id="fix_date" class="form-control" type="date" value="${date}" />

      <label style="margin-top:10px;">Amount</label>
      <input id="fix_amount" class="form-control" type="number" step="0.01" value="${amount}" />

      <label style="margin-top:10px;">Contact ID</label>
      <input id="fix_contact" class="form-control" value="${contact === "(none)" ? "" : contact}" />

      <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:10px;">
        <button id="fix_cancel">Cancel</button>
        <button id="fix_save" class="btn-primary">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector("#fix_cancel").onclick = () => modal.remove();

  modal.querySelector("#fix_save").onclick = async () => {
    const updatedContact = document.getElementById("fix_contact").value.trim() || null;

    await fetch(
      `https://financials-module.dennis-e64.workers.dev/staging/update`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          contact_id: updatedContact,
          needs_review: updatedContact ? false : true,
          notes: ""
        })
      }
    );

    modal.remove();
    loadStagingData();
  };
};


window.refreshStagingGrid = function() {
  loadStagingData();
};


// ------------------------------------------------------------
// Core staging loader
// ------------------------------------------------------------
export async function loadStagingData() {
  const project = window.portalState?.project;
  if (!project) {
    console.error("No project selected.");
    renderStagingGrid([]);
    return;
  }

  const filter = document.getElementById("stagingFilter")?.value || "";
  const isDefault = filter === "";

  const url = isDefault
    ? `https://financials-module.dennis-e64.workers.dev/staging/list?project=${project}&status=neq.imported`
    : `https://financials-module.dennis-e64.workers.dev/staging/list?project=${project}&status=${filter}`;

  const res = await fetch(url);

  let rows = [];
  try { rows = await res.json(); } catch {}

  // renderStagingGrid is defined in financials_render.js
  renderStagingGrid(rows);
}
