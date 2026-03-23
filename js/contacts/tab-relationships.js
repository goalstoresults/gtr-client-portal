// js/contacts/tab-relationships.js

// Modularized Relationships Tab

import { escapeHtml, formatDateTime } from "../utilities.js";

/* -------------------------------------------------------
MAIN ENTRY: Render Relationships Tab
------------------------------------------------------- */

export async function renderContactRelationships(container, portalState, contactId) {

  if (!portalState.project || !contactId) {
    container.innerHTML = `
      <section class="card">
        <p>Select a contact from the list to view relationships.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>Relationships originating from this contact</h3>
        <button id="btnAddSourceRel" class="btn-primary">Add Relationship</button>
      </div>
      <div id="contactRelSourceGrid"></div>
    </section>

    <section class="card" style="margin-top:16px;">
      <h3>Relationships pointing to this contact</h3>
      <p style="font-size:0.9em; color:#666; margin-bottom:8px;">
        These relationships originate from other contacts. To modify them, visit the source contact.
      </p>
      <div id="contactRelRelatedGrid"></div>
    </section>

    <section class="card" style="margin-top:16px;">
      <div id="contactRelReferralGrid"></div>
    </section>
  `;

  await renderContactRelationshipsSource(
    container.querySelector("#contactRelSourceGrid"),
    portalState,
    contactId
  );

  await renderContactRelationshipsRelated(
    container.querySelector("#contactRelRelatedGrid"),
    portalState,
    contactId
  );

  await renderContactRelationshipsReferralSummary(
    container.querySelector("#contactRelReferralGrid"),
    portalState,
    contactId
  );

  container.querySelector("#btnAddSourceRel").addEventListener("click", () =>
    openRelationshipForm(container, portalState, {
      mode: "add",
      fixedSide: "source",
      contactId
    })
  );
}

/* -------------------------------------------------------
SOURCE GRID (Editable)
------------------------------------------------------- */

async function renderContactRelationshipsSource(container, portalState, contactId) {

  const url = `https://contacts-module.dennis-e64.workers.dev/contact_relationships?project=${portalState.project}&source_contact_id=${contactId}`;
  const res = await fetch(url, { cache: "no-cache" });
  let rows = await res.json();
  if (!Array.isArray(rows)) rows = [];

  container.innerHTML = `
    <table class="notes-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Role</th>
          <th>Related Contact</th>
          <th>Contact Type</th>
          <th>Financial Referral</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows.length > 0
            ? rows
                .map(
                  r => `
          <tr>
            <td>${escapeHtml(r.relationship_type || "")}</td>
            <td>${escapeHtml(r.relationship_role || "")}</td>
            <td>${escapeHtml(r.related_contact_name || r.related_contact_id || "")}</td>
            <td>${escapeHtml(r.related_contact_type || "")}</td>
            <td>${r.financial_referral ? "✅" : ""}</td>
            <td>${formatDateTime(r.created_at)}</td>
            <td>
              <button
                class="btn-secondary btn-edit"
                data-id="${r.id}"
                data-related-name="${escapeHtml(r.related_contact_name || "")}"
              >
                Edit
              </button>
              ${
                portalState.deleteAllowed
                  ? `<button class="btn-danger btn-delete" data-id="${r.id}">Delete</button>`
                  : ``
              }
            </td>
          </tr>
        `
                )
                .join("")
            : `<tr><td colspan="7">(no relationships)</td></tr>`
        }
      </tbody>
    </table>
  `;

  // Edit
  container.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      const content = document.querySelector("#contactsContent");
      openRelationshipForm(content, portalState, {
        mode: "edit",
        relationshipId: btn.dataset.id,
        contactId,
        relatedName: btn.dataset.relatedName
      });
    });
  });

  // Delete
  container.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this relationship?")) return;

      await fetch(
        `https://contacts-module.dennis-e64.workers.dev/contact_relationships/${btn.dataset.id}?project=${portalState.project}`,
        { method: "DELETE" }
      );

      await renderContactRelationshipsSource(container, portalState, contactId);
    });
  });
}

/* -------------------------------------------------------
RELATED GRID (Read‑Only)
------------------------------------------------------- */

async function renderContactRelationshipsRelated(container, portalState, contactId) {

  const url = `https://contacts-module.dennis-e64.workers.dev/contact_relationships?project=${portalState.project}&related_contact_id=${contactId}`;
  const res = await fetch(url, { cache: "no-cache" });
  let rows = await res.json();
  if (!Array.isArray(rows)) rows = [];

  rows = rows.filter(r => (r.relationship_type || "").toLowerCase() !== "referral");

  container.innerHTML = `
    <table class="notes-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Role</th>
          <th>Source Contact</th>
          <th>Contact Type</th>
          <th>Financial Referral</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows.length > 0
            ? rows
                .map(
                  r => `
          <tr>
            <td>${escapeHtml(r.relationship_type || "")}</td>
            <td>${escapeHtml(r.relationship_role || "")}</td>
            <td>${escapeHtml(r.source_contact_name || r.source_contact_id || "")}</td>
            <td>${escapeHtml(r.source_contact_type || "")}</td>
            <td>${r.financial_referral ? "✅" : ""}</td>
            <td>${formatDateTime(r.created_at)}</td>
            <td style="color:#999;">—</td>
          </tr>
        `
                )
                .join("")
            : `<tr><td colspan="7">(no relationships)</td></tr>`
        }
      </tbody>
    </table>
  `;
}

/* -------------------------------------------------------
REFERRAL SUMMARY
------------------------------------------------------- */

async function renderContactRelationshipsReferralSummary(container, portalState, contactId) {

  const base = `https://contacts-module.dennis-e64.workers.dev/contact_relationships?project=${portalState.project}`;

  const [asSourceRes, asRelatedRes] = await Promise.all([
    fetch(`${base}&source_contact_id=${contactId}`, { cache: "no-cache" }),
    fetch(`${base}&related_contact_id=${contactId}`, { cache: "no-cache" })
  ]);

  let asSource = await asSourceRes.json();
  let asRelated = await asRelatedRes.json();

  if (!Array.isArray(asSource)) asSource = [];
  if (!Array.isArray(asRelated)) asRelated = [];

  const all = [...asSource, ...asRelated].filter(
    r => (r.relationship_type || "").toLowerCase() === "referral"
  );

  const combined = [];

  for (const r of all) {
    const sourceId = r.source_contact_id;
    const relatedId = r.related_contact_id;

    const sourceName = r.source_contact_name || sourceId;
    const relatedName = r.related_contact_name || relatedId;

    const referredBy = relatedName;
    const referredTo = sourceName;

    let direction;

    if (String(contactId) === String(sourceId)) direction = "Inbound";
    else if (String(contactId) === String(relatedId)) direction = "Outbound";
    else continue;

    combined.push({
      direction,
      referredBy,
      referredTo,
      financial: r.financial_referral,
      created: r.created_at
    });
  }

  const inboundCount = combined.filter(r => r.direction === "Inbound").length;
  const outboundCount = combined.filter(r => r.direction === "Outbound").length;

  container.innerHTML = `
    <h3 style="margin-bottom:4px;">
      Referral Summary
      <span style="font-size:0.85em; color:#666;">
        (Inbound: ${inboundCount}, Outbound: ${outboundCount})
      </span>
    </h3>

    <div style="font-size:0.85em; color:#666; margin-bottom:10px;">
      Inbound = this contact was <strong>referred to</strong> by someone.<br>
      Outbound = this contact <strong>referred someone else</strong>.
    </div>

    <table class="notes-table">
      <thead>
        <tr>
          <th>Direction</th>
          <th>Referred By</th>
          <th>Referred To</th>
          <th>Financial</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        ${
          combined.length > 0
            ? combined
                .map(
                  r => `
          <tr>
            <td>${escapeHtml(r.direction)}</td>
            <td>${escapeHtml(r.referredBy)}</td>
            <td>${escapeHtml(r.referredTo)}</td>
            <td>${r.financial ? "✅" : ""}</td>
            <td>${formatDateTime(r.created)}</td>
          </tr>
        `
                )
                .join("")
            : `<tr><td colspan="5">(no referrals)</td></tr>`
        }
      </tbody>
    </table>
  `;
}

/* -------------------------------------------------------
RELATIONSHIP FORM (Add/Edit)
------------------------------------------------------- */

export async function openRelationshipForm(container, portalState, { mode, contactId, relationshipId, relatedName }) {

  const projectId = portalState.project;

  if (!projectId) {
    container.innerHTML = `<section class="card"><p>Missing project.</p></section>`;
    return;
  }

  let relationship = null;

  if (mode === "edit" && relationshipId) {
    const res = await fetch(
      `https://contacts-module.dennis-e64.workers.dev/contact_relationships/${relationshipId}?project=${encodeURIComponent(projectId)}`,
      { cache: "no-cache" }
    );
    const rows = await res.json().catch(() => []);
    relationship = Array.isArray(rows) ? rows[0] : rows;
  }

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

  // Populate Relationship Type dropdown
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

  // Populate Relationship Role dropdown
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

  // Cancel
  document.getElementById("btnCancel")?.addEventListener("click", () => {
    renderContactRelationships(container, portalState, contactId);
  });

  // Toggle related picker
  document.getElementById("btnPickRelated")?.addEventListener("click", () => {
    const picker = document.getElementById("relatedPicker");
    picker.style.display = picker.style.display === "none" ? "block" : "none";
  });

  // Find related contact
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

  // Submit handler
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

      container.innerHTML = "";
      await renderContactRelationships(container, portalState, contactId);
      container.scrollIntoView({ behavior: "smooth", block: "start" });

    } catch (err) {
      alert("Error saving relationship: " + err.message);
      console.error(err);
    }
  });

} // <-- closes openRelationshipForm()

// End of module
       
