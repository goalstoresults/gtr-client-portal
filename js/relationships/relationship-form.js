// /js/relationships/relationship-form.js
// Shared Add/Edit Relationship Form Component

import { escapeHtml, formatDateTime } from "../utilities.js";
import { renderContactRelationships } from "../contacts/tab-relationships.js";

/* -------------------------------------------------------
SHARED RELATIONSHIP FORM (Add/Edit)
------------------------------------------------------- */

export async function openRelationshipForm(container, portalState, {
  mode,
  contactId,
  relationshipId,
  relatedName,
  onDone
}) {

  const projectId = portalState.project;
  if (!projectId) {
    container.innerHTML = `<section class="card"><p>Missing project.</p></section>`;
    return;
  }

  /* -------------------------------------------------------
  LOAD EXISTING RELATIONSHIP (EDIT MODE)
  ------------------------------------------------------- */
  let relationship = null;

  if (mode === "edit" && relationshipId) {
    const res = await fetch(
      `https://contacts-module.dennis-e64.workers.dev/contact_relationships/${relationshipId}?project=${encodeURIComponent(projectId)}`,
      { cache: "no-cache" }
    );
    const rows = await res.json().catch(() => []);
    relationship = Array.isArray(rows) ? rows[0] : rows;
  }

  /* -------------------------------------------------------
  LOAD CONTACT LIST (for name resolution)
  ------------------------------------------------------- */
  const contactsRes = await fetch(
    `https://contacts-module.dennis-e64.workers.dev/contacts/list?project=${encodeURIComponent(projectId)}&limit=500`,
    { cache: "no-cache" }
  );

  const contacts = await contactsRes.json().catch(() => []);
  const contactMap = {};

  (Array.isArray(contacts) ? contacts : []).forEach(c => {
    const name = c.contact_name || `${c.first_name || ""} ${c.last_name || ""}`.trim();
    if (c.contact_id) contactMap[c.contact_id] = name || c.contact_id;
  });

  const sourceId = relationship?.source_contact_id || contactId || "";
  const relatedId = relationship?.related_contact_id || "";

  const sourceName = contactMap[sourceId] || sourceId || "(unknown)";
  const resolvedRelatedName =
    relatedName ||
    contactMap[relatedId] ||
    relatedId ||
    "(unknown)";

  /* -------------------------------------------------------
  RENDER FORM
  ------------------------------------------------------- */
  container.innerHTML = `
    <section class="card">
      <h3>${mode === "edit" ? "Edit Relationship" : "Add Relationship"}</h3>

      <form id="relationshipForm">

        <div class="row" style="gap:12px; align-items:center;">
          <label style="min-width:160px;">Source contact</label>
          <input type="hidden" name="source_contact_id" value="${escapeHtml(sourceId)}">
          <span class="muted">${escapeHtml(sourceName)}</span>
        </div>

        <div class="row" style="gap:12px; align-items:center;">
          <label style="min-width:160px;">Related contact</label>
          <input type="hidden" name="related_contact_id" value="${escapeHtml(relatedId)}">
          <span class="muted">${escapeHtml(resolvedRelatedName)}</span>
          <button type="button" class="secondary" id="btnPickRelated">Pick</button>
        </div>

        <div class="row" style="gap:12px;">
          <label style="min-width:160px;">Relationship type</label>
          <select name="relationship_type" id="relTypeSelect" class="form-control">
            <option value="">-- Select Type --</option>
          </select>
        </div>

        <div class="row" style="gap:12px;">
          <label style="min-width:160px;">Relationship role</label>
          <select name="relationship_role" id="relRoleSelect" class="form-control">
            <option value="">-- Select Role --</option>
          </select>
        </div>

        <div class="row" style="gap:12px; align-items:center;">
          <label style="min-width:160px;">Financial referral</label>
          <input type="checkbox" name="financial_referral" ${relationship?.financial_referral ? "checked" : ""}>
        </div>

        <div class="row" style="gap:12px;">
          <label style="min-width:160px;">Notes</label>
          <textarea name="notes" rows="3" style="width:100%;">${escapeHtml(relationship?.notes || "")}</textarea>
        </div>

        <div style="margin-top:16px; display:flex; gap:12px;">
          <button type="submit" class="btn-primary">${mode === "edit" ? "Save changes" : "Add relationship"}</button>
          <button type="button" class="btn-secondary" id="btnCancel">Cancel</button>
        </div>

      </form>

      <!-- Related Contact Picker -->
      <section id="relatedPicker" class="card" style="display:none; margin-top:16px;">
        <h4>Find related contact</h4>

        <div class="row" style="gap:8px; margin-bottom:8px;">
          <input id="rel-first" placeholder="First name">
          <input id="rel-last" placeholder="Last name">
          <button id="btnFindRel" class="primary">Find</button>
        </div>

        <div id="relResults" class="muted">(enter a name and click Find)</div>
      </section>

    </section>
  `;

  /* -------------------------------------------------------
  POPULATE LOOKUPS: TYPE + ROLE
  ------------------------------------------------------- */
  const typeSelect = document.getElementById("relTypeSelect");

  fetch(`https://lookups-module.dennis-e64.workers.dev/lookups?lookup_type=relationship_type&project=${projectId}`)
    .then(r => r.json())
    .then(values => {
      if (!Array.isArray(values)) return;
      values.sort((a, b) => (a.label || a.value || "").localeCompare(b.label || b.value || ""));
      values.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.value;
        opt.textContent = v.label || v.value;
        if (v.value === relationship?.relationship_type) opt.selected = true;
        typeSelect.appendChild(opt);
      });
    });

  // Auto-check financial referral when type = Referral
  typeSelect.addEventListener("change", () => {
    if (typeSelect.value === "Referral") {
      document.querySelector('input[name="financial_referral"]').checked = true;
    }
  });

  const roleSelect = document.getElementById("relRoleSelect");

  fetch(`https://lookups-module.dennis-e64.workers.dev/lookups?lookup_type=relationship_role&project=${projectId}`)
    .then(r => r.json())
    .then(values => {
      if (!Array.isArray(values)) return;
      values.sort((a, b) => (a.label || a.value || "").localeCompare(b.label || b.value || ""));
      values.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.value;
        opt.textContent = v.label || v.value;
        if (v.value === relationship?.relationship_role) opt.selected = true;
        roleSelect.appendChild(opt);
      });
    });

  /* -------------------------------------------------------
  CANCEL HANDLER
  ------------------------------------------------------- */
  document.getElementById("btnCancel")?.addEventListener("click", () => {
    if (onDone) onDone();
  });

  /* -------------------------------------------------------
  RELATED CONTACT PICKER
  ------------------------------------------------------- */
  document.getElementById("btnPickRelated")?.addEventListener("click", () => {
    const picker = document.getElementById("relatedPicker");
    picker.style.display = picker.style.display === "none" ? "block" : "none";
  });

  document.getElementById("btnFindRel")?.addEventListener("click", async () => {
    const first = document.getElementById("rel-first").value.trim();
    const last = document.getElementById("rel-last").value.trim();

    if (!first && !last) {
      alert("Enter at least a first or last name.");
      return;
    }

    const filters = [`project.eq.${projectId}`];
    if (first) filters.push(`first_name.ilike.${first}*`);
    if (last) filters.push(`last_name.ilike.${last}*`);

    const query = filters.length > 1 ? `and=(${filters.join(",")})` : filters[0];

    const url = `https://client-portal-api.dennis-e64.workers.dev/api/contacts?${query}&select=contact_id,first_name,last_name,email,contact_type`;

    try {
      const resp = await fetch(url);
      const rows = await resp.json();

      const relResults = document.getElementById("relResults");

      relResults.innerHTML =
        Array.isArray(rows) && rows.length > 0
          ? rows
              .map(r => {
                const fullName = `${r.first_name || ""} ${r.last_name || ""}`.trim();
                return `
                  <div class="contact-result"
                    data-id="${escapeHtml(r.contact_id)}"
                    data-name="${escapeHtml(fullName)}"
                    data-email="${escapeHtml(r.email || "")}">
                    <strong>${escapeHtml(fullName)}</strong><br/>
                    <small>${escapeHtml(r.email || "")}</small><br/>
                    <small>Type: ${escapeHtml(r.contact_type || "")}</small>
                  </div>
                `;
              })
              .join("")
          : "<div class='muted'>No contacts found.</div>";

      // Click handler for selecting a related contact
      relResults.querySelectorAll(".contact-result").forEach(el => {
        el.addEventListener("click", () => {
          const id = el.dataset.id;
          const name = el.dataset.name;

          const hidden = document.querySelector('input[name="related_contact_id"]');
          const label = document.querySelector('input[name="related_contact_id"] + span');

          if (hidden) hidden.value = id || "";
          if (label) label.textContent = name || "(unknown)";

          alert("✅ Related contact selected.");
        });
      });

    } catch (err) {
      alert("Network error searching contacts.");
      console.error(err);
    }
  });

  /* -------------------------------------------------------
  SUBMIT HANDLER (Add/Edit)
  ------------------------------------------------------- */
  document.getElementById("relationshipForm")?.addEventListener("submit", async e => {
    e.preventDefault();

    const form = e.currentTarget;
    const fd = new FormData(form);

    const payload = {
      project: projectId,
      source_contact_id: fd.get("source_contact_id") || "",
      related_contact_id: fd.get("related_contact_id") || "",
      relationship_type: (fd.get("relationship_type") || "").trim(),
      relationship_role: (fd.get("relationship_role") || "").trim(),
      financial_referral: fd.get("financial_referral") === "on",
      notes: (fd.get("notes") || "").trim(),
      ...(mode === "add" ? { created_at: new Date().toISOString() } : {})
    };

    if (!payload.source_contact_id) {
      alert("Missing source contact.");
      return;
    }

    if (!payload.related_contact_id) {
      alert("Missing related contact.");
      return;
    }

    try {
      const url =
        mode === "edit"
          ? `https://contacts-module.dennis-e64.workers.dev/contact_relationships/${relationshipId}?project=${encodeURIComponent(projectId)}`
          : `https://contacts-module.dennis-e64.workers.dev/contact_relationships?project=${encodeURIComponent(projectId)}`;

      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const text = await res.text();

      if (!res.ok) {
        alert(`❌ Save failed: ${text}`);
        return;
      }

      alert("✅ Relationship saved.");

      if (onDone) {
        await onDone();
      }

    } catch (err) {
      alert("Error saving relationship: " + err.message);
      console.error(err);
    }
  });

} // end openRelationshipForm()
