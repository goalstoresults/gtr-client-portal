// /notes/tab-review.js
// Handles: Note review, metadata editing, client assignment, deletion, relationships navigation

import { escapeHtml, formatDateTime, getEasternDateOnly } from "../utilities.js";
import { renderRelationships } from "./tab-relationships.js";
import { renderHistory } from "./tab-history.js";

// ------------------------------------------------------------
// Main Renderer
// ------------------------------------------------------------
export async function renderReview(container, portalState, noteId) {
  console.log("[Review] Called with noteId:", noteId);

  if (!noteId) {
    container.innerHTML = `<p>Select a note from History to review.</p>`;
    return;
  }

  try {
    const params = new URLSearchParams({
      project: portalState.project,
      id: noteId
    });

    const url = `https://notes-history-module.dennis-e64.workers.dev/note_review?${params}`;
    const res = await fetch(url, { cache: "no-cache" });
    const data = await res.json();

    if (!res.ok || !data.note) {
      container.innerHTML = `<p>Error loading note review: ${escapeHtml(data.error || "Not found")}</p>`;
      return;
    }

    const note = data.note;
    const relationships = data.relationships || [];

    // Hydrate clientId
    portalState.clientId = note.client_id || note.contact_id || null;

    // Update context bar
    const contextBar = document.getElementById("contact-context-bar");
    if (contextBar) {
      contextBar.textContent = note.contact_name
        ? `Contact: ${note.contact_name}`
        : "Contact not linked yet";
    }

    // ------------------------------------------------------------
    // UI RENDER
    // ------------------------------------------------------------
    container.innerHTML = `
      <section class="card">

        <div class="row" style="gap:12px; margin-bottom:12px;">
          <h2 style="margin:0;">Notes Review: ${escapeHtml(note.subject || "(no subject)")}</h2>
          <button id="btnSetClient" class="btn-secondary btn-edit">Set Contact</button>
          <button id="btnDeleteNote" class="btn-danger btn-delete">Delete</button>
        </div>

        <section id="setClientForm" class="card" style="display:none; margin-bottom:16px;">
          <h3>Attach Contact to Note</h3>
          <div class="row" style="gap:12px; margin-bottom:12px;">
            <input id="filter-first" placeholder="First name" />
            <input id="filter-last" placeholder="Last name" />
            <button id="btnFindClient" class="btn-primary">Find</button>
          </div>
          <div id="clientSearchResults" class="muted">Enter criteria and click Find.</div>
        </section>

        <p><strong>Subject:</strong> ${escapeHtml(note.subject || "(no subject)")}</p>

        <!-- ⭐ NEW: EDIT SUBJECT FIELD -->
        <div class="row" style="gap:12px; align-items:center; margin-bottom:8px;">
          <label>Edit Subject:</label>
          <input 
            type="text" 
            id="editSubject" 
            style="flex:1;" 
            value="${escapeHtml(note.subject || "")}" 
          />
        </div>

        <p><strong>From:</strong> ${escapeHtml(note.from_name || "(unknown)")} (${escapeHtml(note.from_email || "no email")})</p>

        <p><strong>Created:</strong> ${
          note.created_at ? formatDateTime(note.created_at) : "(unknown)"
        }</p>

        <p><strong>Note Date:</strong> ${
          note.note_date ? formatDateTime(note.note_date) : "(unknown)"
        }</p>

        <div class="row" style="gap:12px; align-items:center; margin-bottom:8px;">
          <label>Edit Note Date:</label>
          <input type="date" id="editNoteDate" style="min-width:180px;" />
        </div>

        <p><strong>Contact:</strong> ${escapeHtml(note.contact_name || "(unknown)")} (${escapeHtml(note.contact_email || "")})</p>

        <div class="row" style="gap:12px; margin-top:12px; align-items:center;">
          <label>Review Status:
            <select id="noteStatus" class="form-control" style="min-width:160px;">
              <option value="pending">Pending</option>
              <option value="important">Important</option>
              <option value="not_important">Not Important</option>
            </select>
          </label>

          <label>
            <input type="checkbox" id="noteNeedsReview" />
            Needs Review
          </label>

          <button id="btnSaveNoteMeta" class="btn-primary">Save</button>
        </div>

        <p style="margin-top:16px;"><strong>Summary:</strong></p>
        <p>${note.summary ? escapeHtml(note.summary) : "(no summary available)"}</p>

        <details style="margin-top:20px;">
          <summary><strong>AI‑Detected Follow‑Ups</strong></summary>
          ${
            Array.isArray(note.followups_raw) && note.followups_raw.length > 0
              ? `
                <ul style="margin-top:12px; padding-left:20px;">
                  ${note.followups_raw
                    .map(
                      f => `
                      <li style="margin-bottom:8px;">
                        <strong>${escapeHtml(f.text || "")}</strong><br/>
                        <span class="muted" style="font-size:0.9em;">
                          Source: ${escapeHtml(f.source_text || "")}
                        </span>
                      </li>
                    `
                    )
                    .join("")}
                </ul>
              `
              : `<p class="muted" style="margin-top:12px;">(none detected)</p>`
          }
        </details>

        ${
          note.raw_text
            ? `
              <details style="margin-top:12px;">
                <summary>Raw Text (click to expand)</summary>
${ /<(p|div|br|ul|ol|li|strong|em|span|html|body|a)(\s|>)/i.test(note.raw_text)
    ? `
        <div class="html-note-block">
          ${note.raw_text}
        </div>
      `
    : `
        <div class="raw-text-block">
          ${note.raw_text}
        </div>
      `
}

              </details>
            `
            : ""
        }

        ${
          Array.isArray(relationships) && relationships.length > 0
            ? `
              <div class="row" style="gap:12px; margin-top:20px;">
                <h3 style="margin:0;">Relationships Detected in Note</h3>
                ${
                  note.contact_id
                    ? `<button id="btnRelationships" class="btn-primary">Notes Relationships</button>`
                    : `<span class="muted">(need to set client to continue)</span>`
                }
              </div>

              <table class="notes-table" style="margin-top:12px;">
                <thead>
                  <tr>
                    <th>Raw Name</th>
                    <th>AI First</th>
                    <th>AI Last</th>
                    <th>Role/Type</th>
                    <th>Context</th>
                  </tr>
                </thead>
                <tbody>
                  ${relationships
                    .map(
                      r => `
                        <tr>
                          <td>${escapeHtml(r.raw_name || "")}</td>
                          <td>${escapeHtml(r.first_name_ai || "")}</td>
                          <td>${escapeHtml(r.last_name_ai || "")}</td>
                          <td>${escapeHtml(r.role_label_ai || "")}</td>
                          <td>${escapeHtml(r.context_description_ai || "")}</td>
                        </tr>
                      `
                    )
                    .join("")}
                </tbody>
              </table>
            `
            : ""
        }
      </section>
    `;

    // ------------------------------------------------------------
    // PREFILL FIELDS
    // ------------------------------------------------------------
    document.getElementById("noteStatus").value = note.review_status || "pending";
    document.getElementById("noteNeedsReview").checked = !!note.needs_review;

    if (note.note_date) {
      document.getElementById("editNoteDate").value = getEasternDateOnly(note.note_date);
    }

    // ------------------------------------------------------------
    // SAVE METADATA
    // ------------------------------------------------------------
    document.getElementById("btnSaveNoteMeta").addEventListener("click", async () => {
      const status = document.getElementById("noteStatus").value;
      const needsReview = document.getElementById("noteNeedsReview").checked;
      const newDateOnly = document.getElementById("editNoteDate").value;

      const updates = {
        review_status: status,
        needs_review: needsReview
      };

      // ⭐ NEW: SUBJECT UPDATE
      const newSubject = document.getElementById("editSubject").value.trim();
      if (newSubject && newSubject !== note.subject) {
        updates.subject = newSubject;
      }

      if (newDateOnly && note.note_date) {
        const old = new Date(note.note_date);
        const [year, month, day] = newDateOnly.split("-");

        const merged = new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
          old.getHours(),
          old.getMinutes(),
          old.getSeconds()
        );

        updates.note_date = merged.toISOString();
      }

      try {
        const res = await fetch(
          "https://notes-history-module.dennis-e64.workers.dev/notes_history",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: portalState.selectedNoteId,
              updates
            })
          }
        );

        if (!res.ok) {
          const msg = await res.text().catch(() => "");
          alert(`❌ Failed to save note metadata: ${msg}`);
          return;
        }

        alert("✅ Note metadata saved.");
      } catch (err) {
        alert("Error saving note metadata: " + err.message);
        console.error(err);
      }
    });

    // ------------------------------------------------------------
    // SET CLIENT TOGGLE
    // ------------------------------------------------------------
    document.getElementById("btnSetClient").addEventListener("click", () => {
      const form = document.getElementById("setClientForm");
      form.style.display = form.style.display === "none" ? "block" : "none";
    });

    // ------------------------------------------------------------
    // RELATIONSHIPS BUTTON
    // ------------------------------------------------------------
    const relBtn = document.getElementById("btnRelationships");
    if (relBtn) {
      relBtn.addEventListener("click", () => {
        document.querySelectorAll("#notes-subtabs button").forEach(b =>
          b.classList.remove("active")
        );
        document
          .querySelector('#notes-subtabs button[data-subtab="relationships"]')
          ?.classList.add("active");

        renderRelationships(container, portalState);
      });
    }

    // ------------------------------------------------------------
    // DELETE NOTE
    // ------------------------------------------------------------
    document.getElementById("btnDeleteNote").addEventListener("click", async () => {
      if (!confirm("Are you sure you want to delete this note and all its relationships?")) return;

      try {
        const relUrl = `https://notes-history-module.dennis-e64.workers.dev/note_relationships?project=${portalState.project}&note_id=${noteId}`;
        await fetch(relUrl, { method: "DELETE" });

        const noteUrl = `https://notes-history-module.dennis-e64.workers.dev/note_history?id=${noteId}&project=${portalState.project}`;
        await fetch(noteUrl, { method: "DELETE" });

        alert("✅ Note and relationships deleted.");

        await renderHistory(container, portalState);

        document.querySelectorAll("#notes-subtabs button").forEach(b =>
          b.classList.remove("active")
        );
        document
          .querySelector('#notes-subtabs button[data-subtab="history"]')
          ?.classList.add("active");
      } catch (err) {
        alert("Error deleting note: " + err.message);
        console.error(err);
      }
    });

    // ------------------------------------------------------------
    // FIND CLIENT
    // ------------------------------------------------------------
    document.getElementById("btnFindClient").addEventListener("click", async () => {
      const first = document.getElementById("filter-first").value.trim();
      const last = document.getElementById("filter-last").value.trim();
      const resultsDiv = document.getElementById("clientSearchResults");

      resultsDiv.innerHTML = "Searching...";

      if (!first && !last) {
        resultsDiv.textContent = "❌ Enter at least a first or last name.";
        return;
      }

      const filters = [`project.eq.${portalState.project}`];
      if (first) filters.push(`first_name.ilike.${first}*`);
      if (last) filters.push(`last_name.ilike.${last}*`);

      const query =
        filters.length > 1 ? `and=(${filters.join(",")})` : filters[0];

      const url = `https://client-portal-api.dennis-e64.workers.dev/api/contacts?${query}&select=contact_id,first_name,last_name,email,contact_type`;

      try {
        const res = await fetch(url);
        if (!res.ok) {
          const msg = await res.text().catch(() => "");
          resultsDiv.textContent = `❌ Search failed (${res.status}). ${msg}`;
          return;
        }

        const contacts = await res.json();

        if (!Array.isArray(contacts) || contacts.length === 0) {
          resultsDiv.innerHTML = "<div class='muted'>No contacts found.</div>";
          return;
        }

        resultsDiv.innerHTML = contacts
          .map(
            c => `
              <div class="contact-result"
                   data-id="${c.contact_id}"
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
          el.addEventListener("click", async () => {
            const contactId = el.dataset.id;
            const contactName = el.dataset.name;
            const contactType = el.dataset.type;
            const contactEmail = el.dataset.email;

            await attachClientToNote(
              contactId,
              contactName,
              contactType,
              contactEmail,
              portalState
            );
          });
        });
      } catch (err) {
        resultsDiv.textContent = "❌ Network error searching contacts.";
        console.error(err);
      }
    });
  } catch (err) {
    container.innerHTML = `<p>Error loading note review: ${escapeHtml(err.message)}</p>`;
    console.error(err);
  }
}

// ------------------------------------------------------------
// Attach Client to Note
// ------------------------------------------------------------
async function attachClientToNote(contactId, contactName, contactType, contactEmail, portalState) {
  try {
    const payload = {
      id: portalState.selectedNoteId,
      updates: {
        contact_id: contactId,
        contact_name: contactName,
        contact_type: contactType,
        contact_email: contactEmail || null,
        updated_at: new Date().toISOString()
      }
    };

    const res = await fetch(
      "https://notes-history-module.dennis-e64.workers.dev",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    const data = await res.json().catch(() => null);

    if (!res.ok || data.status !== "ok") {
      alert(`❌ Failed to attach client: ${data.error || "Unknown error"}`);
      console.error("Attach error:", data);
      return;
    }

    alert("✅ Client attached to note.");

    portalState.clientId = contactId;

    const container = document.getElementById("notesContent");
    if (container) {
      await renderReview(container, portalState, portalState.selectedNoteId);
    }
  } catch (err) {
    alert("Error attaching client: " + err.message);
    console.error(err);
  }
}

