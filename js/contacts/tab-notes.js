// js/contacts/tab-notes.js
// Modularized Contact Notes Tab

import { escapeHtml, formatDateTime } from "../utilities.js";


/* -------------------------------------------------------
   MAIN ENTRY: Render Contact Notes
------------------------------------------------------- */
export async function renderContactNotes(container, portalState, contactId) {
  if (!portalState.project || !contactId) {
    container.innerHTML = `
      <section class="card">
        <h2>Contact Notes</h2>
        <p>Select a contact from the list first, then open Notes.</p>
      </section>
    `;
    return;
  }

  const url = `https://contacts-module.dennis-e64.workers.dev/notes_history?project=${portalState.project}&contact_id=${contactId}`;
  const res = await fetch(url, { cache: "no-cache" });
  let notes = await res.json();
  if (!Array.isArray(notes)) notes = [];

  /* -------------------------------------------------------
     RENDER NOTES TABLE
  ------------------------------------------------------- */
  container.innerHTML = `
    <section class="card">
      <h2>Notes</h2>
      <table class="notes-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Subject</th>
            <th>Summary</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="notesRows">
          ${
            notes.length > 0
              ? notes.map((n, idx) => `
                  <tr>
                     <td>${n.note_date ? formatDateTime(n.note_date) : ""}</td>
                    <td>${escapeHtml(n.subject || "")}</td>
                    <td>${escapeHtml(n.summary || "")}</td>
                    <td>
                      <button class="btn-secondary btn-expand" data-idx="${idx}" style="display:flex; align-items:center; gap:4px;">
                        ▶ Expand
                      </button>
                    </td>
                  </tr>

                  <tr class="note-details" data-idx="${idx}" style="display:none;">
                    <td colspan="4" style="background:#f9f9f9; padding:12px;">
                      <div><strong>From:</strong> ${escapeHtml(n.from_name || "")} (${escapeHtml(n.from_email || "")})</div>
                      <div><strong>Status:</strong> ${escapeHtml(n.review_status || "")}</div>
                      <div><strong>Needs Review:</strong> ${n.needs_review ? "Yes" : "No"}</div>

                      <div style="margin-top:8px;"><strong>Raw Text:</strong></div>
${ /<(p|div|br|ul|ol|li|strong|em|span|html|body|a)(\s|>)/i.test(n.raw_text)
    ? `
        <div class="html-note-block">
          ${n.raw_text}
        </div>
      `
    : `
        <div class="raw-text-block">
          ${n.raw_text}
        </div>
      `
}

                      <button class="btn-danger btn-delete-note" data-id="${n.id}" style="margin-top:8px;">
                        Delete Note
                      </button>
                    </td>
                  </tr>
                `).join("")
              : `<tr><td colspan="4">(no notes yet)</td></tr>`
          }
        </tbody>
      </table>
    </section>
  `;

  /* -------------------------------------------------------
     EXPAND / COLLAPSE HANDLERS
  ------------------------------------------------------- */
  container.querySelectorAll(".btn-expand").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = btn.dataset.idx;
      const row = container.querySelector(`.note-details[data-idx="${idx}"]`);
      const isVisible = row.style.display !== "none";

      row.style.display = isVisible ? "none" : "table-row";
      btn.innerHTML = isVisible ? "▶ Expand" : "▼ Collapse";
    });
  });

  /* -------------------------------------------------------
     DELETE NOTE HANDLERS
  ------------------------------------------------------- */
  container.querySelectorAll(".btn-delete-note").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this note?")) return;

      const noteId = btn.dataset.id;

      await fetch(
        `https://contacts-module.dennis-e64.workers.dev/notes_history/${noteId}?project=${portalState.project}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" }
        }
      );

      // Reload notes
      await renderContactNotes(container, portalState, contactId);
    });
  });
}
