// /notes/tab-relationships.js
// Handles: Detected relationships, existing relationships, contact search, promotion, saving

import { escapeHtml, formatDateTime } from "../utilities.js";
import { renderHistory } from "./tab-history.js";

// ------------------------------------------------------------
// Attach a contact to a detected relationship row
// ------------------------------------------------------------
async function attachRelationshipContact(row, project, noteId) {
  try {
    const rawName = (row.querySelector(".rel-raw")?.textContent || "").trim();
    const typeVal = (row.querySelector(".rel-type select")?.value || "").trim();
    const roleVal = (row.querySelector(".rel-role select")?.value || "").trim();

    if (!typeVal || !roleVal) {
      alert("❌ Please select both Relationship Type and Role before getting Contact ID.");
      return;
    }

    const payload = {
      project,
      note_id: noteId,
      raw_name: rawName,
      relationship_type: typeVal,
      relationship_role: roleVal
    };

    const res = await fetch(`/api/relationships_bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project, rows: [payload] })
    });

    const data = await res.json();

    if (!data.success) {
      alert("❌ Failed to attach relationship: " + (data.error || "Unknown error"));
      return;
    }

    const rel = data.relationships[0];

    row.querySelector(".rel-contact-id").textContent = rel.related_contact_id || "";
    row.querySelector(".rel-contact-name").textContent = rel.related_name || "";
    row.querySelector(".rel-contact-type").textContent = rel.related_type || "";
    row.querySelector(".rel-contact-email").textContent = rel.related_email || "";

    alert("✅ Contact ID attached successfully.");
  } catch (err) {
    console.error("attachRelationshipContact error:", err);
    alert("❌ Error attaching relationship: " + err.message);
  }
}

// ------------------------------------------------------------
// Quick Add Contact Modal
// ------------------------------------------------------------
function openQuickAddContactModal(row, project) {
  const modal = document.createElement("div");
  modal.className = "notes-modal";

  modal.innerHTML = `
    <div class="notes-modal-card">
      <h4 style="margin:0 0 8px;">Quick Add Contact</h4>

      <div class="row" style="gap:8px; margin-bottom:8px;">
        <input class="qc-first" placeholder="First name" />
        <input class="qc-last" placeholder="Last name" />
      </div>

      <div class="row" style="gap:8px; margin-bottom:8px;">
        <input class="qc-email" placeholder="Email" />
        <input class="qc-type" placeholder="Contact type" />
      </div>

      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button class="qc-cancel secondary">Cancel</button>
        <button class="qc-save primary">Save</button>
      </div>

      <div class="qc-status muted" style="margin-top:8px;"></div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector(".qc-cancel").addEventListener("click", () => modal.remove());

  modal.querySelector(".qc-save").addEventListener("click", async () => {
    const first = modal.querySelector(".qc-first").value.trim();
    const last = modal.querySelector(".qc-last").value.trim();
    const email = modal.querySelector(".qc-email").value.trim();
    const type = modal.querySelector(".qc-type").value.trim();
    const status = modal.querySelector(".qc-status");

    if (!first || !last) {
      status.textContent = "First and last name are required.";
      return;
    }

    const payload = {
      project,
      first_name: first,
      last_name: last,
      email: email || null,
      contact_type: type || null,
      created_at: new Date().toISOString()
    };

    try {
      const resp = await fetch("https://client-portal-api.dennis-e64.workers.dev/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const text = await resp.text();
      let created = null;
      try { created = JSON.parse(text); } catch {}

      const contactId =
        (Array.isArray(created) && created[0]?.contact_id) ||
        created?.contact_id ||
        null;

      if (!contactId) {
        status.textContent = "Contact saved, but ID not returned.";
        return;
      }

      const fullName = `${first} ${last}`.trim();

      row.querySelector(".rel-contact-id").textContent = contactId;
      row.querySelector(".rel-contact-name").textContent = fullName;
      row.querySelector(".rel-contact-email").textContent = email || "";

      const typeDropdown = row.querySelector(".contact-type-dropdown");
      if (typeDropdown) typeDropdown.value = type || "";

      row.querySelector("td:last-child").innerHTML = `<input type="checkbox" class="promote-checkbox"/>`;

      modal.remove();
      alert("✅ Contact created and populated into the relationship row.");
    } catch (err) {
      status.textContent = "Network error creating contact.";
      console.error(err);
    }
  });
}

// ------------------------------------------------------------
// Dropdown builder
// ------------------------------------------------------------
function buildDropdown(options, selectedValue, className = "") {
  return `
    <select class="${className}">
      <option value="">-- Select --</option>
      ${options
        .map(
          opt => `
        <option value="${escapeHtml(opt.value)}"
          ${opt.value === selectedValue ? "selected" : ""}>
          ${escapeHtml(opt.value)}
        </option>`
        )
        .join("")}
    </select>
  `;
}

// ------------------------------------------------------------
// Main Renderer
// ------------------------------------------------------------
export async function renderRelationships(container, portalState) {
  const noteId = portalState.selectedNoteId;
  const project = portalState.project;

  if (!noteId) {
    container.innerHTML = `<p>Select a note from History to view relationships.</p>`;
    return;
  }

  try {
    // STEP 1: Fetch note + detected relationships
    const reviewUrl = `https://notes-history-module.dennis-e64.workers.dev/note_review?project=${project}&id=${noteId}`;
    const res = await fetch(reviewUrl);
    const data = await res.json();

    const subject = data.note?.subject || "(no subject)";
    const clientName = data.note?.contact_name || "(unknown)";
    const clientEmail = data.note?.contact_email || "";
    const rows = data.relationships || [];

    // STEP 2: Fetch lookups
    const lookupUrl = `https://client-portal-api.dennis-e64.workers.dev/api/lookups?project=${project}`;
    const lookupRes = await fetch(lookupUrl);
    const lookupData = await lookupRes.json();

    const roles = lookupData
      .filter(l => l.lookup_type === "relationship_role")
      .sort((a, b) => a.sort_order - b.sort_order);

    const types = lookupData
      .filter(l => l.lookup_type === "relationship_type")
      .sort((a, b) => a.sort_order - b.sort_order);

    const contactTypes = lookupData
      .filter(l => l.lookup_type === "contact_type" && l.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);

    // STEP 3: Base UI
    container.innerHTML = `
<section class="card">

  <h2>Relationships for Note: ${escapeHtml(subject)}</h2>
  <p>Client: ${escapeHtml(clientName)} (${escapeHtml(clientEmail)})</p>

  <div id="existingRelationships" class="card" style="margin-bottom:16px;">
    <h3>Existing Contact Relationships</h3>
    <div id="existingRelGrid"></div>
  </div>

  <h3 style="margin-top:20px;">Detected Relationships in Note</h3>

  <table class="notes-table">
    <thead>
      <tr>
        <th>Raw Name</th>
        <th>Relationship Type</th>
        <th>Relationship Role</th>
        <th>Contact ID</th>
        <th>Contact Name</th>
        <th>Contact Type</th>
        <th>Contact Email</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody id="relationshipsGrid"></tbody>
  </table>

  <div style="margin-top:12px;">
    <button id="btnSaveRelationships" class="primary">Save Relationships</button>
    <label style="margin-left:12px;">
      <input type="checkbox" id="chkReviewComplete" checked />
      Review Complete
    </label>
  </div>

</section>
`;

    // STEP 4: Populate detected relationships
    const grid = document.getElementById("relationshipsGrid");

    grid.innerHTML = rows
      .map(
        r => `
<tr data-relid="${r.id}">
  <td class="rel-raw">${escapeHtml(r.raw_name || "")}</td>
  <td class="rel-type">${buildDropdown(types, r.relationship_type, "rel-type-dropdown")}</td>
  <td class="rel-role">${buildDropdown(roles, r.relationship_role, "rel-role-dropdown")}</td>
  <td class="rel-contact-id">${escapeHtml(r.contact_id || "")}</td>
  <td class="rel-contact-name">${escapeHtml(r.contact_name || "")}</td>
  <td class="rel-contact-type">${buildDropdown(contactTypes, r.contact_type, "contact-type-dropdown")}</td>
  <td class="rel-contact-email">${escapeHtml(r.contact_email || "")}</td>
  <td>
    ${
      r.contact_id
        ? `<input type="checkbox" class="promote-checkbox"/>`
        : `<button class="get-id-btn">Get Contact ID</button>`
    }
  </td>
</tr>
`
      )
      .join("");

    // GET CONTACT ID logic
    grid.querySelectorAll(".get-id-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        const row = e.target.closest("tr");
        const relId = row.dataset.relid;

        const type = row.querySelector(".rel-type select")?.value?.trim() || "";
        const role = row.querySelector(".rel-role select")?.value?.trim() || "";

        if (!type || !role) {
          alert("❌ Please select both Relationship Type and Role before searching for a contact.");
          return;
        }

        // ⭐ Unified Search UI
        row.querySelector("td:last-child").innerHTML = `
<div class="inline-search">
  <input class="search-any" placeholder="Search name, business, or email" style="flex:1;" />
  <button class="do-search">Find</button>
  <div class="search-results muted">Enter criteria and click Find.</div>
</div>
`;

        // ⭐ Unified Search Logic
        row.querySelector(".do-search").addEventListener("click", async () => {
          const term = row.querySelector(".search-any").value.trim();
          const resultsDiv = row.querySelector(".search-results");

          if (!term) {
            alert("Enter something to search.");
            return;
          }

          resultsDiv.textContent = "Searching...";

          const encoded = encodeURIComponent(`*${term}*`);

          const searchUrl = `
https://client-portal-api.dennis-e64.workers.dev/api/contacts?
project=${project}&
or=(
  first_name.ilike.${encoded},
  last_name.ilike.${encoded},
  business_name.ilike.${encoded},
  search_name.ilike.${encoded},
  email.ilike.${encoded}
)
&select=contact_id,first_name,last_name,email,contact_type
`.replace(/\s+/g, "");

          try {
            const resp = await fetch(searchUrl);

            if (!resp.ok) {
              const msg = await resp.text().catch(() => "");
              alert(`Search failed (${resp.status}). ${msg}`);
              return;
            }

            const contacts = await resp.json();

            if (!Array.isArray(contacts) || contacts.length === 0) {
              resultsDiv.innerHTML = "<div class='muted'>No contacts found.</div>";
              return;
            }

            resultsDiv.innerHTML = contacts
              .map(
                c => `
<div class="contact-result"
  data-relid="${relId}"
  data-contactid="${c.contact_id}"
  data-name="${escapeHtml(c.first_name || "")} ${escapeHtml(c.last_name || "")}"
  data-type="${escapeHtml(c.contact_type || "")}"
  data-email="${escapeHtml(c.email || "")}">
  <strong>${escapeHtml(c.first_name || "")} ${escapeHtml(c.last_name || "")}</strong>
  (${escapeHtml(c.contact_type || "No type")})<br/>
  <small>${escapeHtml(c.email || "No email")}</small>
</div>
`
              )
              .join("");

            resultsDiv.querySelectorAll(".contact-result").forEach(el => {
              el.addEventListener("click", () => {
                const targetRow = document.querySelector(
                  `tr[data-relid="${el.dataset.relid}"]`
                );

                targetRow.querySelector(".rel-contact-id").textContent =
                  el.dataset.contactid || "";

                targetRow.querySelector(".rel-contact-name").textContent =
                  el.dataset.name || "";

                const typeDropdown =
                  targetRow.querySelector(".contact-type-dropdown");
                if (typeDropdown) typeDropdown.value = el.dataset.type || "";

                targetRow.querySelector(".rel-contact-email").textContent =
                  el.dataset.email || "";

                targetRow.querySelector("td:last-child").innerHTML =
                  `<input type="checkbox" class="promote-checkbox"/>`;

                alert("✅ Contact populated into relationship row.");
              });
            });
          } catch (err) {
            alert("Network error searching contacts");
            console.error(err);
          }
        });
      });
    });

    // STEP 5: Existing relationships
    const relUrl = `https://client-portal-api.dennis-e64.workers.dev/api/contact_relationships?project=${project}&source_contact_id=${portalState.clientId}`;

    try {
      const relRes = await fetch(relUrl);
      const relData = await relRes.json();

      const existingGrid = document.getElementById("existingRelGrid");

      if (Array.isArray(relData) && relData.length > 0) {
        existingGrid.innerHTML = `
<table class="notes-table">
  <thead>
    <tr>
      <th>Related Name</th>
      <th>Relationship Type</th>
      <th>Relationship Role</th>
      <th>Created At</th>
    </tr>
  </thead>
  <tbody>
    ${relData
      .map(r => {
        const relatedName = r.contacts
          ? `${r.contacts.first_name} ${r.contacts.last_name}`.trim()
          : "(unknown)";

        return `
<tr>
  <td>${escapeHtml(relatedName)}</td>
  <td>${escapeHtml(r.relationship_type || "")}</td>
  <td>${escapeHtml(r.relationship_role || "")}</td>
  <td>${escapeHtml(r.created_at || "")}</td>
</tr>
`;
      })
      .join("")}
  </tbody>
</table>
`;
      } else {
        existingGrid.innerHTML = "<p>No existing relationships found.</p>";
      }
    } catch (err) {
      console.error("Existing relationships fetch error:", err);
      document.getElementById("existingRelGrid").innerHTML =
        "<p>Error loading existing relationships.</p>";
    }

    // STEP 6: Save Relationships
    document
      .getElementById("btnSaveRelationships")
      .addEventListener("click", async () => {
        const promoteRows = [...grid.querySelectorAll("tr")].filter(
          r => r.querySelector(".promote-checkbox")?.checked
        );

        if (promoteRows.length === 0) {
          alert("No relationships selected.");
          return;
        }

        for (const row of promoteRows) {
          const relId = row.dataset.relid;
          const contactId = row.querySelector("td:nth-child(4)").textContent.trim();
          const type = row.querySelector("td:nth-child(2) select").value.trim();
          const role = row.querySelector("td:nth-child(3) select").value.trim();

          if (!contactId) {
            alert("❌ Cannot save relationship without a Contact ID.");
            continue;
          }

          if (!role || !type) {
            alert("❌ Relationship Type and Role cannot be blank.");
            continue;
          }

          const contactName = row.querySelector(".rel-contact-name").textContent.trim();
          const contactType =
            row.querySelector(".contact-type-dropdown")?.value || "";
          const contactEmail = row
            .querySelector(".rel-contact-email")
            .textContent.trim();

          // PATCH notes_relationships
          const patchPayload = {
            relationship_type: type,
            relationship_role: role,
            contact_id: contactId,
            contact_name: contactName,
            contact_type: contactType,
            contact_email: contactEmail
          };

          try {
            const patchRes = await fetch(
              `https://notes-history-module.dennis-e64.workers.dev/notes_relationships?id=eq.${relId}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patchPayload)
              }
            );

            if (!patchRes.ok) {
              const patchText = await patchRes.text();
              alert(`❌ Failed to update note relationship: ${patchText}`);
              continue;
            }
          } catch (err) {
            console.error("PATCH error:", err);
            alert("Network error while updating note relationship.");
            continue;
          }

          // POST contact_relationships
          const insertPayload = {
            project: portalState.project,
            source_contact_id: portalState.clientId,
            related_contact_id: contactId,
            relationship_role: role,
            relationship_type: type,
            notes: "",
            created_at: new Date().toISOString()
          };

          try {
            const res = await fetch(
              "https://client-portal-api.dennis-e64.workers.dev/api/contact_relationships",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(insertPayload)
              }
            );

            const text = await res.text();
            console.log("[SaveRelationships] POST contact_relationships:", res.status, text);

            if (!res.ok) {
              alert(`❌ Failed to save relationship: ${text}`);
            } else {
              console.log("Relationship saved successfully");
            }
          } catch (err) {
            console.error("Relationship error:", err);
            alert("Network error while saving relationship.");
          }

          // Step 3: PATCH contacts table to update master contact_type
          if (contactId && contactType) {
            try {
              const url = `https://client-portal-api.dennis-e64.workers.dev/api/contacts?contact_id=eq.${encodeURIComponent(contactId)}`;
              const payload = { contact_type: contactType };

              console.log("[PATCH contacts] URL:", url);
              console.log("[PATCH contacts] Payload:", payload);

              const contactPatchRes = await fetch(url, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
              });

              const responseText = await contactPatchRes.text();
              console.log("[PATCH contacts] Status:", contactPatchRes.status, responseText);

              if (!contactPatchRes.ok) {
                console.warn(`⚠️ Failed to update contact_type in contacts: ${responseText}`);
              } else {
                console.log(`✅ Contact ${contactId} type updated to ${contactType}`);
              }
            } catch (err) {
              console.error("Contact PATCH error:", err);
            }
          }
        }

        // Handle Review Complete checkbox
        const reviewComplete = document.getElementById("chkReviewComplete").checked;

        if (reviewComplete) {
          try {
            await fetch(
              "https://notes-history-module.dennis-e64.workers.dev/notes_history",
              {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  "Prefer": "return=representation"
                },
                body: JSON.stringify({
                  id: noteId,
                  updates: { needs_review: false }
                })
              }
            );

            console.log("Note marked as reviewed.");
          } catch (err) {
            console.error("Failed to update needs_review:", err);
          }
        }

        alert("✅ Relationships saved.");

        // Reset UI back to History view
        await renderHistory(container, portalState);

        document.querySelectorAll("#notes-subtabs button").forEach(b =>
          b.classList.remove("active")
        );

        document
          .querySelector('#notes-subtabs button[data-subtab="history"]')
          ?.classList.add("active");
      });
  } catch (err) {
    console.error("renderRelationships error:", err);
    container.innerHTML = `<p>Error loading relationships: ${err.message}</p>`;
  }
} // end of renderRelationships
            
