// /js/relationships/tab-details.js
// Relationships → Details tab (now using shared relationship-form.js)

import { escapeHtml, formatDateTime } from "../utilities.js";
import { openRelationshipForm } from "./relationship-form.js";

export async function renderRelDetails(container, portalState) {
  const contactId = portalState.selectedContactId;
  const project = portalState.project;

  if (!contactId || !project) {
    container.innerHTML = `
      <section class="card">
        <p>Select a contact to view relationships.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2>Relationships for ${escapeHtml(portalState.selectedContactName || "")}</h2>
        <button id="btnAddRel" class="btn-primary">Add Relationship</button>
      </div>

      <div id="addRelHost" style="margin-top:16px;"></div>

      <h3 style="margin-top:24px;">Relationships originating from this contact</h3>
      <div id="relOutbound"></div>

      <h3 style="margin-top:24px;">Relationships pointing to this contact</h3>
      <p class="muted" style="margin-bottom:8px;">
        These relationships originate from other contacts.  
        To modify them, visit the source contact.
      </p>
      <div id="relInbound"></div>

      <h3 style="margin-top:24px;">Referral Summary</h3>
      <div id="relReferralSummary"></div>
    </section>
  `;

  const hostAdd = container.querySelector("#addRelHost");
  const outboundDiv = container.querySelector("#relOutbound");
  const inboundDiv = container.querySelector("#relInbound");
  const referralDiv = container.querySelector("#relReferralSummary");

  /* -------------------------------------------------------
     ADD RELATIONSHIP BUTTON → Inline form
  ------------------------------------------------------- */
  container.querySelector("#btnAddRel").addEventListener("click", () => {
    hostAdd.innerHTML = ""; // clear previous
    openRelationshipForm(hostAdd, portalState, {
      mode: "add",
      contactId,
      onDone: async () => {
        await renderRelDetails(container, portalState);
      }
    });
  });

  /* -------------------------------------------------------
     LOAD OUTBOUND RELATIONSHIPS
  ------------------------------------------------------- */
  const outboundURL = `https://contacts-module.dennis-e64.workers.dev/contact_relationships?project=${project}&source_contact_id=${contactId}`;
  const outboundRes = await fetch(outboundURL, { cache: "no-cache" });
  let outboundRows = await outboundRes.json();
  if (!Array.isArray(outboundRows)) outboundRows = [];

  outboundDiv.innerHTML = `
    <table class="notes-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Role</th>
          <th>Related Contact</th>
          <th>Contact Type</th>
          <th>Financial</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${
          outboundRows.length
            ? outboundRows
                .map(
                  r => `
            <tr>
              <td>${escapeHtml(r.relationship_type || "")}</td>
              <td>${escapeHtml(r.relationship_role || "")}</td>
              <td>${escapeHtml(r.related_contact_name || "")}</td>
              <td>${escapeHtml(r.related_contact_type || "")}</td>
              <td>${r.financial_referral ? "✅" : ""}</td>
              <td>${formatDateTime(r.created_at)}</td>
              <td>
                <button class="btn-secondary btn-edit" data-id="${r.id}" data-name="${escapeHtml(r.related_contact_name || "")}">Edit</button>
                ${
                  portalState.deleteAllowed
                    ? `<button class="btn-danger btn-delete" data-id="${r.id}">Delete</button>`
                    : ""
                }
              </td>
            </tr>
            <tr id="editHost-${r.id}" style="display:none;">
              <td colspan="7"></td>
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
     EDIT HANDLERS (inline)
  ------------------------------------------------------- */
  outboundDiv.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      const rowHost = outboundDiv.querySelector(`#editHost-${id}`);

      // toggle visibility
      rowHost.style.display =
        rowHost.style.display === "none" ? "table-row" : "none";

      if (rowHost.style.display === "table-row") {
        openRelationshipForm(rowHost.querySelector("td"), portalState, {
          mode: "edit",
          relationshipId: id,
          contactId,
          relatedName: name,
          onDone: async () => {
            await renderRelDetails(container, portalState);
          }
        });
      }
    });
  });

  /* -------------------------------------------------------
     DELETE HANDLERS
  ------------------------------------------------------- */
  outboundDiv.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this relationship?")) return;

      await fetch(
        `https://contacts-module.dennis-e64.workers.dev/contact_relationships/${btn.dataset.id}?project=${project}`,
        { method: "DELETE" }
      );

      await renderRelDetails(container, portalState);
    });
  });

  /* -------------------------------------------------------
     LOAD INBOUND RELATIONSHIPS (read-only)
  ------------------------------------------------------- */
  const inboundURL = `https://contacts-module.dennis-e64.workers.dev/contact_relationships?project=${project}&related_contact_id=${contactId}`;
  const inboundRes = await fetch(inboundURL, { cache: "no-cache" });
  let inboundRows = await inboundRes.json();
  if (!Array.isArray(inboundRows)) inboundRows = [];

  inboundDiv.innerHTML = `
    <table class="notes-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Role</th>
          <th>Source Contact</th>
          <th>Contact Type</th>
          <th>Financial</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${
          inboundRows.length
            ? inboundRows
                .map(
                  r => `
            <tr>
              <td>${escapeHtml(r.relationship_type || "")}</td>
              <td>${escapeHtml(r.relationship_role || "")}</td>
              <td>${escapeHtml(r.source_contact_name || "")}</td>
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

  /* -------------------------------------------------------
     REFERRAL SUMMARY
  ------------------------------------------------------- */
  const base = `https://contacts-module.dennis-e64.workers.dev/contact_relationships?project=${project}`;

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

  referralDiv.innerHTML = `
    <div style="font-size:0.85em; color:#666; margin-bottom:10px;">
      Inbound = this contact was <strong>referred to</strong> by someone.<br>
      Outbound = this contact <strong>referred someone else</strong>.
    </div>

    <p class="muted">(Inbound: ${inboundCount}, Outbound: ${outboundCount})</p>

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
          combined.length
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
