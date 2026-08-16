// /js/contacts/tab-relationships.js
// Contacts → Relationships Tab (now using shared relationship-form.js)

import { escapeHtml, formatDateTime } from "../utilities.js";
import { openRelationshipForm } from "../relationships/relationship-form.js";

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
        if (portalState.canEdit) {
            <button id="btnAddSourceRel" class="btn-primary">Add Relationship</button>
        }
      </div>
      <div id="contactRelSourceGrid"></div>
    </section>

    <section class="card" style="margin-top:16px;">
      <h3>Relationships pointing to this contact</h3>
      <p style="font-size:0.9em; color:#666; margin-bottom:8px;">
        These relationships originate from other contacts.  
        To modify them, visit the source contact.
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

  /* -------------------------------------------------------
     ADD RELATIONSHIP (Shared Form)
  ------------------------------------------------------- */
  container.querySelector("#btnAddSourceRel").addEventListener("click", () => {
    openRelationshipForm(container, portalState, {
      mode: "add",
      contactId,
      onDone: async () => {
        await renderContactRelationships(container, portalState, contactId);
      }
    });
  });
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
                  ${
                    portalState.canEdit
                      ? `<button
                          class="btn-secondary btn-edit"
                          data-id="${r.id}"
                          data-related-name="${escapeHtml(r.related_contact_name || "")}"
                        >
                          Edit
                        </button>`
                      : ``
                  }
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

  /* -------------------------------------------------------
     EDIT (Shared Form)
  ------------------------------------------------------- */
  container.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      const content = document.querySelector("#contactsContent");

      openRelationshipForm(content, portalState, {
        mode: "edit",
        relationshipId: btn.dataset.id,
        contactId,
        relatedName: btn.dataset.relatedName,
        onDone: async () => {
          await renderContactRelationships(container, portalState, contactId);
        }
      });
    });
  });

  /* -------------------------------------------------------
     DELETE
  ------------------------------------------------------- */
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

    let direction;
    if (String(contactId) === String(sourceId)) direction = "Inbound";
    else if (String(contactId) === String(relatedId)) direction = "Outbound";
    else continue;

    combined.push({
      direction,
      referredBy: relatedName,
      referredTo: sourceName,
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
