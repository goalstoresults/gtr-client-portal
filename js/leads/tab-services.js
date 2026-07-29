// js/leads/tab-services.js
// Additional Services — CSI (ISN) only.
//
// Mirrors ISN's own Additional Services checkbox list, backed by
// lookups where lookup_type='services'. Selections save as an array of
// lookups.id values to project_pipeline_leads.isn_services_lookup_ids
// (uuid[]) -- the Worker resolves those back to ISN's external_id + name
// at order-create time. This tab only talks to the Portal's own
// leads-module / lookups-module workers -- no ISN API calls happen here.
// ISN sync happens later, via the webhook, once the lead's stage is set to
// "Ready to Transfer".

import { escapeHtml } from "../utilities.js";

export async function renderLeadServices(container, portalState) {
  const leadId = portalState.activeLeadId;
  const project = portalState.project;

  // CSI/ISN-only tab -- nothing to show for any other project.
  if (project !== "csi") {
    container.innerHTML = "";
    return;
  }

  if (!leadId) {
    container.innerHTML = `
      <section class="card">
        <h2>Services</h2>
        <p>No lead selected.</p>
      </section>
    `;
    return;
  }

  /* -------------------------------------------------------
     FETCH SERVICES LOOKUPS
  ------------------------------------------------------- */
  const lookupsUrl = `
    https://lookups-module.dennis-e64.workers.dev/lookups/list?
    project=${encodeURIComponent(project)}
  `.replace(/\s+/g, "");

  const lookupsRes = await fetch(lookupsUrl, { cache: "no-cache" });
  const lookupsData = await lookupsRes.json();

  const services = (Array.isArray(lookupsData.lookups) ? lookupsData.lookups : [])
    .filter((l) => l.lookup_type === "services" && l.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  /* -------------------------------------------------------
     FETCH LEAD RECORD
  ------------------------------------------------------- */
  const leadUrl = `
    https://leads-module.dennis-e64.workers.dev/leads/get?
    id=${encodeURIComponent(leadId)}
  `.replace(/\s+/g, "");

  const leadRes = await fetch(leadUrl, { cache: "no-cache" });
  const lead = await leadRes.json();

  const selectedIds = new Set(
    Array.isArray(lead.isn_services_lookup_ids) ? lead.isn_services_lookup_ids : []
  );

  /* -------------------------------------------------------
     RENDER UI
  ------------------------------------------------------- */
  container.innerHTML = `
    <section class="card">
      <h2>Services</h2>
      <div id="servicesList"></div>
      <button id="btnSaveServices" class="btn-primary" style="margin-top:20px;">
        Save Services
      </button>
    </section>
  `;

  const listDiv = container.querySelector("#servicesList");

  if (!services.length) {
    listDiv.innerHTML = "<p>No services configured for this project.</p>";
    return;
  }

  listDiv.innerHTML = services
    .map(
      (s) => `
        <label style="display:block; margin-bottom:8px;">
          <input
            type="checkbox"
            data-id="${escapeHtml(s.id)}"
            ${selectedIds.has(s.id) ? "checked" : ""}
          />
          ${escapeHtml(s.value.trim())}
        </label>
      `
    )
    .join("");

  /* -------------------------------------------------------
     SAVE LOGIC -- Portal only, no ISN call from this tab
  ------------------------------------------------------- */
  container.querySelector("#btnSaveServices").addEventListener("click", async () => {
    const checked = Array.from(
      listDiv.querySelectorAll('input[type="checkbox"]:checked')
    );
    const isn_services_lookup_ids = checked.map((cb) => cb.dataset.id);

    try {
      const res = await fetch(
        "https://leads-module.dennis-e64.workers.dev/leads/update",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: leadId,
            updates: { isn_services_lookup_ids },
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert("❌ Failed to save services.");
        console.error(data);
        return;
      }

      alert("✅ Services saved.");
    } catch (err) {
      alert("❌ Error saving services: " + err.message);
      console.error(err);
    }
  });
}
