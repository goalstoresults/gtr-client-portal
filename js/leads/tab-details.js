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
  const leadData = await leadRes.json();
  const lead = Array.isArray(leadData) ? leadData[0] : leadData;

  if (!leadRes.ok || !lead || String(lead.lead_id) !== String(leadId) || lead.project !== project) {
    container.innerHTML = `<section class="card"><h2>Lead Details</h2><p>Unable to load the matching lead.</p></section>`;
    return;
  }

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
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <h2 style="margin:0;">Lead Details</h2>
        <button id="btnSaveLeadDetails" class="btn-primary">
          Save Lead Details
        </button>
      </div>
      <div id="leadDetailsForm"></div>
    </section>
  `;

  const formDiv = container.querySelector("#leadDetailsForm");

  /* -------------------------------------------------------
     STYLE TOKENS (kept local so this file stays drop-in)
  ------------------------------------------------------- */
  const sectionHeaderStyle = `
    background:#eef2f6;
    color:#3d4a5c;
    font-size:12px;
    font-weight:700;
    letter-spacing:0.07em;
    text-transform:uppercase;
    padding:10px 16px;
    margin:0 0 18px;
    border-radius:6px;
    border-left:3px solid #7ea3c9;
  `.replace(/\s+/g, " ");

  const fieldLabelStyle = `
    display:block;
    margin-bottom:16px;
  `.replace(/\s+/g, " ");

  const fieldLabelTextStyle = `
    display:block;
    font-size:13px;
    color:#5b6673;
    margin-bottom:4px;
  `.replace(/\s+/g, " ");

  const fieldInputStyle = `
    width:100%;
    padding:8px 10px;
    border:1px solid #d5dbe2;
    border-radius:4px;
    font-size:14px;
    box-sizing:border-box;
  `.replace(/\s+/g, " ");

  /* -------------------------------------------------------
     BUILD FORM (dynamic sections + fields)
  ------------------------------------------------------- */
  formDiv.innerHTML = Object.keys(sections)
    .map(sectionName => {
      const fields = sections[sectionName].sort((a, b) => a.sort_order - b.sort_order);

      const rows = fields
        .map(f => {
          const value = String(lead[f.field_key] ?? "");

          // Lookup dropdown
          if (f.lookup_type) {
            const options = lookupGroups
              .filter(l => l.lookup_type === f.lookup_type)
              .map(
                l =>
                  `<option value="${escapeHtml(String(l.value))}" ${
                    l.value === value ? "selected" : ""
                  }>${escapeHtml(l.value)}</option>`
              )
              .join("");

            return `
              <label style="${fieldLabelStyle}">
                <span style="${fieldLabelTextStyle}">${escapeHtml(f.label)}</span>
                <select data-field="${escapeHtml(String(f.field_key))}" style="${fieldInputStyle}">
                  <option value="">-- select --</option>
                  ${options}
                </select>
              </label>
            `;
          }

          // Text input
          return `
            <label style="${fieldLabelStyle}">
              <span style="${fieldLabelTextStyle}">${escapeHtml(f.label)}</span>
              <input type="text" data-field="${escapeHtml(String(f.field_key))}" value="${escapeHtml(
                value
              )}" style="${fieldInputStyle}">
            </label>
          `;
        })
        .join("");

      return `
        <div style="margin-bottom:32px;">
          <h3 style="${sectionHeaderStyle}">${escapeHtml(sectionName)}</h3>
          ${rows}
        </div>
      `;
    })
    .join("");

  /* -------------------------------------------------------
     SAVE LOGIC
  ------------------------------------------------------- */
  const saveButton = container.querySelector("#btnSaveLeadDetails");
  const card = container.querySelector(".card");
  const canEdit = () => portalState.canEdit === true && portalState.isDemoAccount !== true;
  const isCurrent = () => card.isConnected &&
    portalState.project === project && portalState.activeLeadId === leadId;

  const baseline = new Map();
  formDiv.querySelectorAll("[data-field]").forEach(el => {
    baseline.set(el.dataset.field, el.value);
    el.disabled = !canEdit();
  });
  saveButton.disabled = !canEdit();
  let saving = false;
  let reloadRequired = false;

  saveButton.addEventListener("click", async () => {
    if (saving || reloadRequired || !canEdit() || !isCurrent()) return;
    const updates = {};

    // Submit only changed controls. Ordinary saves must not reapply an
    // old stage or clear an existing value absent from the lookup list.
    formDiv.querySelectorAll("[data-field]").forEach(el => {
      if (el.value !== baseline.get(el.dataset.field)) {
        updates[el.dataset.field] = el.value === "" ? null : el.value;
      }
    });

    if (!Object.keys(updates).length) {
      alert("No changes to save.");
      return;
    }

    if (portalState.user_id) {
      updates.updated_user_id = String(portalState.user_id);
    }

    const payload = {
      id: leadId,
      updates,
      change_source: "lead_details"
    };
    if (Object.prototype.hasOwnProperty.call(lead, "updated_at")) {
      payload.expected_updated_at = lead.updated_at;
    }

    saving = true;
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
    formDiv.querySelectorAll("[data-field]").forEach(el => { el.disabled = true; });

    try {
      const res = await fetch(
        "https://leads-module.dennis-e64.workers.dev/leads/update",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      const data = await res.json().catch(() => null);
      if (!isCurrent()) return;

      if (!res.ok) {
        reloadRequired = res.status === 409 || data?.lead_saved === true;
        const message = typeof data?.error === "string"
          ? data.error : "Failed to save lead details. Reload before retrying.";
        if (!reloadRequired && res.status >= 500) reloadRequired = true;
        alert(message);
        console.error("[Lead Details] Save failed", { status: res.status });
        return;
      }

      const savedLead = Array.isArray(data) ? data[0] : null;
      if (!savedLead || String(savedLead.lead_id) !== String(leadId) || savedLead.project !== project) {
        reloadRequired = true;
        throw new Error("The save response could not be verified. Reload Lead Details before retrying.");
      }

      Object.assign(lead, savedLead);
      formDiv.querySelectorAll("[data-field]").forEach(el => {
        const key = el.dataset.field;
        if (Object.prototype.hasOwnProperty.call(savedLead, key)) {
          el.value = String(savedLead[key] ?? "");
        }
        baseline.set(key, el.value);
      });
      if (Object.prototype.hasOwnProperty.call(updates, "lead_name")) {
        portalState.activeLeadName = savedLead.lead_name || "";
        localStorage.setItem("activeLeadName", portalState.activeLeadName);
        const bar = document.getElementById("lead-context-bar");
        if (bar) bar.textContent = `Lead: ${portalState.activeLeadName} (${portalState.activeLeadContactName || ""})`;
      }
      alert("✅ Lead details saved.");
    } catch (err) {
      reloadRequired = true;
      if (isCurrent()) {
        alert("Error confirming the save: " + err.message + " Reload Lead Details before retrying.");
      }
      console.error("[Lead Details] Save request failed:", err);
    } finally {
      saving = false;
      if (isCurrent()) {
        saveButton.disabled = !canEdit() || reloadRequired;
        saveButton.textContent = reloadRequired ? "Reload Lead Details to Continue" : "Save Lead Details";
        formDiv.querySelectorAll("[data-field]").forEach(el => {
          el.disabled = !canEdit() || reloadRequired;
        });
      }
    }
  });

}
