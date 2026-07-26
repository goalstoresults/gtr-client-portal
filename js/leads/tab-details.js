// js/leads/tab-details.js
// Dynamic Lead Details — wired to backend /leads/get and /leads/update

import { escapeHtml } from "../utilities.js";

export async function renderLeadDetails(container, portalState) {
  const leadId = portalState.activeLeadId;
  const project = portalState.project;

  if (!leadId) {
    container.innerHTML = `
      <section class="card">
        <h2>Lead Details</h2>
        <p>No lead selected.</p>
      </section>
    `;
    return;
  }

  /* -------------------------------------------------------
     FETCH CONFIGURED LEAD FIELDS (lead_tab = "details")
  ------------------------------------------------------- */
  const configUrl = `
    https://lookups-module.dennis-e64.workers.dev/lead_fields?
    project=${encodeURIComponent(project)}
  `.replace(/\s+/g, "");

  const configRes = await fetch(configUrl, { cache: "no-cache" });
  const configData = await configRes.json();

  const configured = Array.isArray(configData.rows)
    ? configData.rows.filter(r => r.lead_tab === "details")
    : [];

  if (!configured.length) {
    container.innerHTML = `
      <section class="card">
        <h2>Lead Details</h2>
        <p>No fields configured in Setup → Lead Fields.</p>
      </section>
    `;
    return;
  }

  /* -------------------------------------------------------
     FETCH LOOKUPS
  ------------------------------------------------------- */
  const lookupsUrl = `
    https://lookups-module.dennis-e64.workers.dev/lookups/list?
    project=${encodeURIComponent(project)}
  `.replace(/\s+/g, "");

  const lookupsRes = await fetch(lookupsUrl, { cache: "no-cache" });
  const lookupsData = await lookupsRes.json();

  const lookupGroups = Array.isArray(lookupsData.lookups)
    ? lookupsData.lookups
    : [];

  /* -------------------------------------------------------
     FETCH LEAD RECORD
  ------------------------------------------------------- */
  const leadUrl = `
    https://leads-module.dennis-e64.workers.dev/leads/get?
    id=${encodeURIComponent(leadId)}
  `.replace(/\s+/g, "");

  const leadRes = await fetch(leadUrl, { cache: "no-cache" });
  const lead = await leadRes.json();

  /* -------------------------------------------------------
     GROUP FIELDS BY SECTION
  ------------------------------------------------------- */
  const sections = {};
  configured.forEach(f => {
    const sec = f.section || "General";
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(f);
  });

  /* -------------------------------------------------------
     RENDER UI
  ------------------------------------------------------- */
  container.innerHTML = `
    <section class="card">
      <h2>Lead Details</h2>
      <div id="leadDetailsForm"></div>
      <button id="btnSaveLeadDetails" class="btn-primary" style="margin-top:20px;">
        Save Lead Details
      </button>
    </section>
  `;

  const formDiv = container.querySelector("#leadDetailsForm");

  /* -------------------------------------------------------
     BUILD FORM (dynamic sections + fields)
  ------------------------------------------------------- */
  formDiv.innerHTML = Object.keys(sections)
    .map(sectionName => {
      const fields = sections[sectionName].sort((a, b) => a.sort_order - b.sort_order);

      const rows = fields
        .map(f => {
          const value = lead[f.field_key] || "";

          // Lookup dropdown
          if (f.lookup_type) {
            const options = lookupGroups
              .filter(l => l.lookup_type === f.lookup_type)
              .map(
                l =>
                  `<option value="${l.value}" ${
                    l.value === value ? "selected" : ""
                  }>${escapeHtml(l.value)}</option>`
              )
              .join("");

            return `
              <label style="display:block; margin-bottom:10px;">
                <span>${escapeHtml(f.label)}</span>
                <select data-field="${f.field_key}" style="width:100%;">
                  <option value="">-- select --</option>
                  ${options}
                </select>
              </label>
            `;
          }

          // Text input
          return `
            <label style="display:block; margin-bottom:10px;">
              <span>${escapeHtml(f.label)}</span>
              <input type="text" data-field="${f.field_key}" value="${escapeHtml(
                value
              )}" style="width:100%;">
            </label>
          `;
        })
        .join("");

      return `
        <div style="margin-bottom:20px;">
          <h3>${escapeHtml(sectionName)}</h3>
          ${rows}
        </div>
      `;
    })
    .join("");

  /* -------------------------------------------------------
     SAVE LOGIC
  ------------------------------------------------------- */
  container.querySelector("#btnSaveLeadDetails").addEventListener("click", async () => {
    const updates = {};

    formDiv.querySelectorAll("[data-field]").forEach(el => {
      const val = el.value;
      updates[el.dataset.field] = val === "" ? null : val;   // ⭐ CHANGED
    });

    try {
      const res = await fetch(
        "https://leads-module.dennis-e64.workers.dev/leads/update",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: leadId,
            updates
          })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert("❌ Failed to save lead details.");
        console.error(data);
        return;
      }

      alert("✅ Lead details saved.");
    } catch (err) {
      alert("❌ Error saving lead details: " + err.message);
      console.error(err);
    }
  });

}


